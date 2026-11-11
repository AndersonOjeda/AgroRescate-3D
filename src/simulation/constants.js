/**
 * Configuraciones constantes, etapas de cultivo y parámetros educativos
 * para los tres enfoques agrícolas de AgroRescate 3D.
 *
 * NOTA: Todos los valores numéricos son parámetros educativos de demostración
 * diseñados para ilustrar diferencias entre enfoques agrícolas y no representan
 * datos agronómicos o científicos validados.
 */

export const EDUCATIONAL_DISCLAIMER =
  'Valores educativos de demostración (no representan datos científicos validados).';

export const SIMULATION_MODES = Object.freeze({
  SUBSISTENCE: 'subsistence',
  PRECISION: 'precision',
  ECOLOGICAL: 'ecological'
});

export const CROP_STAGES = Object.freeze({
  UNPLANTED: 'sin_sembrar',
  PLANTED: 'sembrado',
  GROWING: 'crecimiento',
  MATURING: 'maduracion',
  HARVESTED: 'cosecha',
  WITHERED: 'marchito'
});

export const STAGE_METADATA = Object.freeze({
  [CROP_STAGES.UNPLANTED]: { index: 0, label: 'Sin sembrar', visualState: 0 },
  [CROP_STAGES.PLANTED]: { index: 1, label: 'Sembrado', visualState: 1 },
  [CROP_STAGES.GROWING]: { index: 2, label: 'Crecimiento', visualState: 2 },
  [CROP_STAGES.MATURING]: { index: 3, label: 'Maduración', visualState: 3 },
  [CROP_STAGES.HARVESTED]: { index: 4, label: 'Cosecha', visualState: 0 },
  [CROP_STAGES.WITHERED]: { index: 2, label: 'Marchito', visualState: 4 }
});

export const MODE_CONFIGS = Object.freeze({
  [SIMULATION_MODES.SUBSISTENCE]: {
    id: SIMULATION_MODES.SUBSISTENCE,
    name: 'Agricultura de Subsistencia',
    shortName: 'Subsistencia',
    badge: 'Manual · Recursos limitados',
    description:
      'Riego manual tradicional con bajo presupuesto inicial, mayor consumo de agua por evento y desgaste gradual del suelo.',
    primaryPlotId: 'plot_1',
    initialBudget: 500,
    initialWater: 600,
    maxWater: 1000,
    initialSoilQuality: 60,
    waterPerIrrigation: 120,
    moistureGainPerIrrigation: 30,
    evaporationRate: 20,
    dailyFertilityDrain: 3,
    harvestFertilityDrain: 5,
    seedCost: 35,
    irrigationCost: 6,
    compostCost: 20,
    waterRefillLiters: 250,
    waterRefillCost: 25,
    supportsSensor: false,
    supportsAutoIrrigation: false,
    autoIrrigationThreshold: 0,
    organicPriceMultiplier: 1.0,
    compostMoistureBonus: 2,
    compostFertilityGain: 10
  },
  [SIMULATION_MODES.PRECISION]: {
    id: SIMULATION_MODES.PRECISION,
    name: 'Agricultura de Precisión (IoT)',
    shortName: 'Precisión IoT',
    badge: 'Sensores · Riego automático',
    description:
      'Monitoreo por sensor virtual de humedad, micro-riego automático cuando baja el umbral hídrico y alta eficiencia productiva.',
    primaryPlotId: 'plot_2',
    initialBudget: 1400,
    initialWater: 900,
    maxWater: 1500,
    initialSoilQuality: 80,
    waterPerIrrigation: 60,
    moistureGainPerIrrigation: 35,
    evaporationRate: 16,
    dailyFertilityDrain: 2,
    harvestFertilityDrain: 3,
    seedCost: 60,
    irrigationCost: 4,
    compostCost: 20,
    waterRefillLiters: 300,
    waterRefillCost: 25,
    supportsSensor: true,
    supportsAutoIrrigation: true,
    autoIrrigationThreshold: 45,
    organicPriceMultiplier: 1.05,
    compostMoistureBonus: 2,
    compostFertilityGain: 10
  },
  [SIMULATION_MODES.ECOLOGICAL]: {
    id: SIMULATION_MODES.ECOLOGICAL,
    name: 'Agricultura Ecológica',
    shortName: 'Ecológica',
    badge: 'Compostaje · Conservación',
    description:
      'Uso de compost orgánico para regenerar la fertilidad, retener mejor la humedad del suelo y obtener cosechas ecológicas de mayor valor.',
    primaryPlotId: 'plot_3',
    initialBudget: 850,
    initialWater: 800,
    maxWater: 1200,
    initialSoilQuality: 95,
    waterPerIrrigation: 80,
    moistureGainPerIrrigation: 35,
    evaporationRate: 11,
    dailyFertilityDrain: 1,
    harvestFertilityDrain: 2,
    seedCost: 45,
    irrigationCost: 4,
    compostCost: 0,
    waterRefillLiters: 280,
    waterRefillCost: 25,
    supportsSensor: false,
    supportsAutoIrrigation: false,
    autoIrrigationThreshold: 0,
    organicPriceMultiplier: 1.25,
    compostMoistureBonus: 4,
    compostFertilityGain: 15
  }
});

export const PLOT_TEMPLATES = Object.freeze([
  {
    id: 'plot_1',
    name: 'Parcela 1 — Subsistencia',
    modeAffinity: SIMULATION_MODES.SUBSISTENCE,
    cropSpecies: 'Lechuga',
    cropName: 'Lechuga Criolla',
    daysToMature: 3,
    initialMoisture: 50,
    baseYieldKg: 45,
    marketValuePerKg: 5
  },
  {
    id: 'plot_2',
    name: 'Parcela 2 — Precisión',
    modeAffinity: SIMULATION_MODES.PRECISION,
    cropSpecies: 'Lechuga',
    cropName: 'Lechuga Tecnificada',
    daysToMature: 2,
    initialMoisture: 75,
    baseYieldKg: 85,
    marketValuePerKg: 7
  },
  {
    id: 'plot_3',
    name: 'Parcela 3 — Ecológica',
    modeAffinity: SIMULATION_MODES.ECOLOGICAL,
    cropSpecies: 'Lechuga',
    cropName: 'Lechuga Orgánica',
    daysToMature: 3,
    initialMoisture: 65,
    baseYieldKg: 65,
    marketValuePerKg: 9
  }
]);

const MODE_ALIASES = Object.freeze({
  subsistence: SIMULATION_MODES.SUBSISTENCE,
  subsistencia: SIMULATION_MODES.SUBSISTENCE,
  precision: SIMULATION_MODES.PRECISION,
  precisión: SIMULATION_MODES.PRECISION,
  ecological: SIMULATION_MODES.ECOLOGICAL,
  ecologica: SIMULATION_MODES.ECOLOGICAL,
  ecológica: SIMULATION_MODES.ECOLOGICAL
});

/**
 * Normaliza nombres de modalidad en inglés o español al identificador canónico.
 * @param {string} mode
 * @returns {'subsistence' | 'precision' | 'ecological'}
 */
export function normalizeMode(mode) {
  if (typeof mode !== 'string') return SIMULATION_MODES.PRECISION;
  const key = mode.trim().toLowerCase();
  return MODE_ALIASES[key] || SIMULATION_MODES.PRECISION;
}
