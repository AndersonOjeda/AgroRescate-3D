import { SIMULATION_MODES } from './constants.js';

/**
 * Calcula la evaporación diaria determinista para una parcela según la modalidad
 * y si posee cobertura orgánica/compost aplicado.
 * @param {object} modeConfig
 * @param {object} plot
 * @returns {number}
 */
export function calculateDailyEvaporation(modeConfig, plot) {
  let evap = modeConfig.evaporationRate;
  if (plot.composted) {
    evap = Math.max(6, evap - modeConfig.compostMoistureBonus);
  }
  return evap;
}

/**
 * Clasifica el nivel de humedad del suelo para el cultivo de lechuga.
 * @param {number} moisture
 * @returns {{ code: string, label: string, recommendation: string }}
 */
export function classifyMoistureStatus(moisture) {
  if (moisture < 15) {
    return {
      code: 'critico',
      label: 'Crítico (Sequía)',
      recommendation: 'Riego urgente requerido para evitar marchitamiento.'
    };
  }
  if (moisture < 45) {
    return {
      code: 'bajo',
      label: 'Bajo',
      recommendation: 'Humedad por debajo del rango óptimo (45%–85%); conviene regar.'
    };
  }
  if (moisture <= 85) {
    return {
      code: 'optimo',
      label: 'Óptimo',
      recommendation: 'Humedad ideal para crecimiento uniforme de la lechuga.'
    };
  }
  return {
    code: 'exceso',
    label: 'Saturado',
    recommendation: 'Evitar exceso de riego temporalmente para proteger raíces.'
  };
}

/**
 * Genera la telemetría del sensor virtual de humedad por parcela.
 * En modalidad Precisión el sensor está activo en tiempo real; en otras
 * modalidades reporta lectura básica de referencia.
 * @param {Record<string, object>} plots
 * @param {object} modeConfig
 * @param {boolean} autoIrrigationEnabled
 * @param {string|null} lastAutoAction
 * @returns {object}
 */
export function computeSensorTelemetry(
  plots,
  modeConfig,
  autoIrrigationEnabled,
  lastAutoAction = null,
  configuredThreshold = null
) {
  const readings = {};
  const targetMoisture = 65;
  const thresholdMoisture = Number.isFinite(configuredThreshold)
    ? configuredThreshold
    : (modeConfig.autoIrrigationThreshold || 45);

  for (const [plotId, plot] of Object.entries(plots)) {
    const status = classifyMoistureStatus(plot.moisture);
    const deficitPct = Math.max(0, targetMoisture - plot.moisture);
    readings[plotId] = {
      plotId,
      moisture: plot.moisture,
      fertility: plot.fertility,
      health: plot.health,
      statusCode: status.code,
      statusLabel: status.label,
      optimalRange: '45% – 85%',
      deficitPct,
      needsIrrigation: plot.isPlanted && plot.moisture < thresholdMoisture,
      recommendation: status.recommendation
    };
  }

  return {
    enabled: Boolean(modeConfig.supportsSensor),
    sensorActiveLabel: modeConfig.supportsSensor
      ? 'Sensor IoT Activo (Lectura continua)'
      : 'Sensor IoT Inactivo en esta modalidad',
    autoIrrigationEnabled: Boolean(modeConfig.supportsAutoIrrigation && autoIrrigationEnabled),
    thresholdMoisture,
    lastAutoAction,
    readings
  };
}

/**
 * Determina qué parcelas sembradas requieren riego automático en Precisión.
 * @param {Record<string, object>} plots
 * @param {number} threshold
 * @returns {object[]}
 */
export function getPlotsNeedingAutoIrrigation(plots, threshold) {
  return Object.values(plots).filter(
    (plot) => plot.isPlanted && plot.moisture < threshold
  );
}

/**
 * Aplica los efectos del compostaje orgánico sobre una parcela.
 * @param {object} plot
 * @param {object} modeConfig
 */
export function applyCompostEffectsToPlot(plot, modeConfig) {
  const fertilityGain = modeConfig.compostFertilityGain;
  plot.fertility = Math.min(100, plot.fertility + fertilityGain);
  plot.composted = true;
  plot.compostCount += 1;

  if (modeConfig.id === SIMULATION_MODES.ECOLOGICAL) {
    plot.moisture = Math.min(100, plot.moisture + 5);
    plot.health = Math.min(100, plot.health + 8);
  } else {
    plot.health = Math.min(100, plot.health + 4);
  }
}

