import {
  CROP_STAGES,
  EDUCATIONAL_DISCLAIMER,
  SIMULATION_MODES,
  STAGE_METADATA
} from './constants.js';

/**
 * Sincroniza stage, stageLabel, stageIndex y visualState de una parcela.
 * @param {object} plot
 */
export function syncPlotStageAndVisual(plot) {
  let stage = CROP_STAGES.UNPLANTED;

  if (plot.isPlanted) {
    if (plot.isWithered || plot.moisture < 15 || plot.health <= 15) {
      stage = CROP_STAGES.WITHERED;
      plot.isWithered = true;
    } else if (plot.daysGrown >= plot.daysToMature) {
      stage = CROP_STAGES.MATURING;
      plot.isWithered = false;
    } else if (plot.daysGrown >= 1) {
      stage = CROP_STAGES.GROWING;
      plot.isWithered = false;
    } else {
      stage = CROP_STAGES.PLANTED;
      plot.isWithered = false;
    }
  } else {
    plot.isWithered = false;
  }

  const meta = STAGE_METADATA[stage];
  plot.stage = stage;
  plot.stageLabel = meta.label;
  plot.stageIndex = meta.index;
  plot.visualState = meta.visualState;
  if (!plot.isPlanted && plot.isPrepared) {
    plot.stageLabel = 'Terreno preparado';
  }
}

/**
 * Calcula la producción proyectada (kg) y valor por kg según estado agronómico.
 * @param {object} plot
 * @param {object} modeConfig
 * @returns {{ projectedKg: number, effectivePricePerKg: number }}
 */
export function calculateProjectedYield(plot, modeConfig) {
  const healthFactor = 0.45 + 0.55 * (Math.max(0, Math.min(100, plot.health)) / 100);
  const fertilityFactor = 0.72 + 0.28 * (Math.max(0, Math.min(100, plot.fertility)) / 100);
  const ecoBonus =
    modeConfig.id === SIMULATION_MODES.ECOLOGICAL &&
    (plot.composted || plot.fertility >= 85)
      ? 1.12
      : 1.0;

  const projectedKg = Math.max(
    5,
    Math.round(plot.baseYieldKg * healthFactor * fertilityFactor * ecoBonus)
  );

  const organicMultiplier =
    modeConfig.id === SIMULATION_MODES.ECOLOGICAL && plot.fertility >= 80
      ? modeConfig.organicPriceMultiplier
      : 1.0;

  const effectivePricePerKg = Number(
    (plot.marketValuePerKg * organicMultiplier).toFixed(2)
  );

  return { projectedKg, effectivePricePerKg };
}

/**
 * Avanza un día simulado en una parcela de manera determinista.
 * @param {object} plot
 * @param {object} modeConfig
 * @param {number} evapRate
 */
export function advancePlotDay(plot, modeConfig, evapRate) {
  plot.moisture = Math.max(0, Math.round(plot.moisture - evapRate));

  if (!plot.isPlanted) {
    // Suelo en descanso recupera mínimamente fertilidad en modo ecológico
    if (modeConfig.id === SIMULATION_MODES.ECOLOGICAL && plot.composted) {
      plot.fertility = Math.min(100, plot.fertility + 1);
    }
    syncPlotStageAndVisual(plot);
    return;
  }

  // Impacto de humedad en la salud de la lechuga
  let healthDelta = 0;
  if (plot.moisture < 15) {
    healthDelta = -30;
  } else if (plot.moisture < 30) {
    healthDelta = -12;
  } else if (plot.moisture < 45) {
    healthDelta = -3;
  } else if (plot.moisture <= 85) {
    healthDelta = 2;
  } else if (plot.moisture <= 92) {
    healthDelta = -2;
  } else {
    healthDelta = -4;
  }

  // Impacto de la fertilidad
  if (plot.fertility >= 80) {
    healthDelta += 1;
  } else if (plot.fertility < 40) {
    healthDelta -= 4;
  }

  // Protección del compost contra estrés moderado
  if (plot.composted && healthDelta < 0) {
    healthDelta = Math.ceil(healthDelta * 0.5);
  }

  plot.health = Math.max(0, Math.min(100, plot.health + healthDelta));

  // Desgaste de fertilidad por cultivo activo
  const fertilityLoss =
    modeConfig.id === SIMULATION_MODES.ECOLOGICAL && plot.composted
      ? 0
      : modeConfig.dailyFertilityDrain;
  plot.fertility = Math.max(10, plot.fertility - fertilityLoss);

  // Crecimiento si no hay sequía crítica ni deterioro severo
  if (plot.moisture >= 15 && plot.health > 15) {
    plot.daysGrown += 1;
  }

  const { projectedKg } = calculateProjectedYield(plot, modeConfig);
  plot.yieldKg = projectedKg;

  syncPlotStageAndVisual(plot);
}

/**
 * Construye el reporte educativo simplificado al completar una cosecha.
 * @param {object} params
 * @returns {object}
 */
export function buildHarvestReport({
  harvestId,
  plot,
  modeConfig,
  harvestKg,
  earnings,
  effectivePricePerKg,
  totalExpenses,
  waterUsedInPlot,
  day
}) {
  const waterDenominator = Math.max(20, waterUsedInPlot || modeConfig.waterPerIrrigation);
  const waterEfficiency = Number(((harvestKg / waterDenominator) * 100).toFixed(1));

  let qualityGrade = 'Estándar (B)';
  if (plot.health >= 90 && plot.fertility >= 80) {
    qualityGrade = 'Óptima (A+)';
  } else if (plot.health >= 75 && plot.fertility >= 65) {
    qualityGrade = 'Buena (A)';
  } else if (plot.health < 50 || plot.fertility < 45) {
    qualityGrade = 'Baja (C)';
  }

  const sustainabilityRaw =
    plot.fertility * 0.45 +
    plot.health * 0.35 +
    Math.min(100, waterEfficiency * 1.4) * 0.2 +
    (modeConfig.id === SIMULATION_MODES.ECOLOGICAL && plot.composted ? 8 : 0);
  const sustainabilityScore = Math.max(0, Math.min(100, Math.round(sustainabilityRaw)));

  const feedback = [];
  if (modeConfig.id === SIMULATION_MODES.PRECISION) {
    feedback.push(
      'El monitoreo de humedad optimizó el riego y redujo el desperdicio de agua.'
    );
  } else if (modeConfig.id === SIMULATION_MODES.ECOLOGICAL) {
    feedback.push(
      plot.composted
        ? 'El compostaje conservó la fertilidad y mejoró la retención hídrica del suelo.'
        : 'Aplicar compost en modalidad ecológica potencia la retención de humedad y el valor de cosecha.'
    );
  } else {
    feedback.push(
      'El riego manual consumió más agua por evento; vigila la reserva del tanque para evitar estrés hídrico.'
    );
  }

  if (plot.health < 75) {
    feedback.push(
      'La salud de la lechuga bajó por variaciones de humedad; procura mantenerla entre 45% y 85%.'
    );
  } else {
    feedback.push(
      'Mantuviste una salud foliar sobresaliente durante el ciclo de la lechuga.'
    );
  }

  if (plot.fertility < 60) {
    feedback.push(
      'La fertilidad del suelo descendió; considera aplicar compost orgánico antes de la próxima siembra.'
    );
  }

  return {
    id: harvestId,
    plotId: plot.id,
    plotName: plot.name,
    cropSpecies: plot.cropSpecies,
    cropName: plot.cropName,
    stage: CROP_STAGES.HARVESTED,
    stageLabel: STAGE_METADATA[CROP_STAGES.HARVESTED].label,
    mode: modeConfig.id,
    modeName: modeConfig.name,
    dayHarvested: day,
    harvestKg,
    effectivePricePerKg,
    earnings,
    netBalanceEstimate: earnings - totalExpenses,
    healthAtHarvest: plot.health,
    fertilityAtHarvest: plot.fertility,
    moistureAtHarvest: plot.moisture,
    waterUsedL: waterUsedInPlot,
    waterEfficiencyKgPer100L: waterEfficiency,
    qualityGrade,
    sustainabilityScore,
    feedback,
    disclaimer: EDUCATIONAL_DISCLAIMER
  };
}

