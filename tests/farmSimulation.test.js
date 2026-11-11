import { describe, it, expect, beforeEach } from 'vitest';
import {
  FarmSimulation,
  advanceDay,
  applyCompost,
  getSensorReading,
  getState,
  harvest,
  initializeFarm,
  irrigate,
  plant,
  refillWater,
  runModesComparisonDemo,
  setActivePlot,
  setAutoIrrigation
} from '../src/simulation/farmSimulation.js';
import { CROP_STAGES, EDUCATIONAL_DISCLAIMER, SIMULATION_MODES } from '../src/simulation/constants.js';

describe('Sistema de Simulación Agrícola — AgroRescate 3D', () => {
  beforeEach(() => {
    initializeFarm(SIMULATION_MODES.PRECISION);
  });

  it('expone las funciones contractuales independientes y normaliza modalidades', () => {
    const subState = initializeFarm('subsistencia');
    expect(subState.mode).toBe(SIMULATION_MODES.SUBSISTENCE);
    expect(subState.budget).toBe(500);
    expect(subState.waterReserve).toBe(600);
    expect(subState.fertility).toBe(60);

    const ecoState = initializeFarm('ecológica');
    expect(ecoState.mode).toBe(SIMULATION_MODES.ECOLOGICAL);
    expect(ecoState.budget).toBe(850);
    expect(ecoState.soilQuality).toBe(95);

    const preState = initializeFarm('precision');
    expect(preState.mode).toBe(SIMULATION_MODES.PRECISION);
    expect(preState.disclaimer).toBe(EDUCATIONAL_DISCLAIMER);
  });

  it('gestiona las 5 etapas del cultivo de lechuga y la recuperación por marchitamiento', () => {
    initializeFarm(SIMULATION_MODES.SUBSISTENCE);

    let state = getState();
    expect(state.plots.plot_1.cropSpecies).toBe('Lechuga');
    expect(state.plots.plot_1.stage).toBe(CROP_STAGES.UNPLANTED);
    expect(state.plots.plot_1.visualState).toBe(0);

    // 1. Sembrado
    const plantRes = plant();
    expect(plantRes.success).toBe(true);
    state = getState();
    expect(state.plots.plot_1.stage).toBe(CROP_STAGES.PLANTED);
    expect(state.plots.plot_1.visualState).toBe(1);

    // 2. Crecimiento
    irrigate('plot_1');
    advanceDay();
    state = getState();
    expect(state.plots.plot_1.stage).toBe(CROP_STAGES.GROWING);
    expect(state.plots.plot_1.visualState).toBe(2);

    // 3. Maduración tras completar días requeridos (3 días en plot_1)
    advanceDay();
    advanceDay();
    state = getState();
    expect(state.plots.plot_1.stage).toBe(CROP_STAGES.MATURING);
    expect(state.plots.plot_1.visualState).toBe(3);

    // 4. Cosecha y reporte educativo
    const harvestRes = harvest();
    expect(harvestRes.success).toBe(true);
    expect(harvestRes.stage).toBe(CROP_STAGES.HARVESTED);
    expect(harvestRes.harvestKg).toBeGreaterThan(0);
    expect(harvestRes.report.qualityGrade).toBeDefined();
    expect(harvestRes.report.feedback.length).toBeGreaterThan(0);

    // Parcela vuelve a sin sembrar para el siguiente ciclo
    state = getState();
    expect(state.plots.plot_1.stage).toBe(CROP_STAGES.UNPLANTED);
    expect(state.lastHarvest.stage).toBe(CROP_STAGES.HARVESTED);
  });

  it('deteriora la planta por sequía crítica (<15%) y permite recuperarla al regar', () => {
    initializeFarm(SIMULATION_MODES.SUBSISTENCE);
    plant('plot_1'); // moisture inicial = 50, evap = 20/día

    advanceDay(); // 50 -> 30
    advanceDay(); // 30 -> 10 (<15% => marchito)
    let state = getState();
    expect(state.plots.plot_1.moisture).toBeLessThan(15);
    expect(state.plots.plot_1.stage).toBe(CROP_STAGES.WITHERED);
    expect(state.plots.plot_1.visualState).toBe(4);
    expect(state.plots.plot_1.health).toBeLessThan(90);

    // Riego recupera el estado activo de la planta
    const irrRes = irrigate('plot_1');
    expect(irrRes.success).toBe(true);
    state = getState();
    expect(state.plots.plot_1.isWithered).toBe(false);
    expect(state.plots.plot_1.visualState).toBe(2);
  });

  it('produce resultados 100% deterministas y reproducibles al avanzar días', () => {
    const runSequence = () => {
      const sim = new FarmSimulation(SIMULATION_MODES.SUBSISTENCE, { registerAsActive: false });
      sim.plant('plot_1');
      sim.irrigate('plot_1');
      sim.advanceDay();
      sim.advanceDay();
      sim.advanceDay();
      sim.harvest('plot_1');
      return sim.getState();
    };

    const runA = runSequence();
    const runB = runSequence();
    expect(runA).toEqual(runB);
  });

  it('en modo Precisión activa el sensor virtual IoT y el riego automático por umbral', () => {
    initializeFarm(SIMULATION_MODES.PRECISION);
    plant('plot_2'); // moisture inicial = 75, evap = 16/día, umbral auto = 45%

    const sensorDay1 = getSensorReading('plot_2');
    expect(sensorDay1.enabled).toBe(true);
    expect(sensorDay1.reading.statusCode).toBe('optimo');

    advanceDay(); // 75 -> 59 (no dispara auto-riego aún)
    expect(getState().autoIrrigationsTriggered).toBe(0);

    const day2Res = advanceDay(); // 59 -> 43 (<45% -> dispara micro-riego automático +35 => 78)
    expect(day2Res.autoTriggered).toBe(true);

    const state = getState();
    expect(state.autoIrrigationsTriggered).toBe(1);
    expect(state.plots.plot_2.moisture).toBe(78);
    expect(state.waterConsumed).toBe(60);

    // Permite desactivar el riego automático manualmente
    const toggleRes = setAutoIrrigation(false);
    expect(toggleRes.success).toBe(true);
    expect(getState().autoIrrigationEnabled).toBe(false);
  });

  it('en modo Ecológica conserva fertilidad, reduce evaporación con compost y da prima de valor', () => {
    initializeFarm(SIMULATION_MODES.ECOLOGICAL);
    plant('plot_3'); // moisture = 65, evap base = 11, con compost = 7

    const compostRes = applyCompost('plot_3');
    expect(compostRes.success).toBe(true);

    let state = getState();
    expect(state.plots.plot_3.composted).toBe(true);
    expect(state.plots.plot_3.fertility).toBe(100);
    expect(state.economy.compostExpenses).toBe(0); // Compostera propia sin costo en modo ecológico

    advanceDay();
    advanceDay();
    advanceDay();
    state = getState();
    // 65 + 5 (compost) = 70; 3 días * 7% evap = 21% -> 49% humedad restante
    expect(state.plots.plot_3.moisture).toBe(49);
    expect(state.plots.plot_3.fertility).toBe(100);

    const harv = harvest('plot_3');
    expect(harv.success).toBe(true);
    // Con compostaje en ecológica conserva la fertilidad post-cosecha
    expect(getState().plots.plot_3.fertility).toBe(100);
    expect(harv.report.sustainabilityScore).toBeGreaterThanOrEqual(80);
  });

  it('controla economía, consumo de agua, recarga de tanque y validación de errores', () => {
    initializeFarm(SIMULATION_MODES.SUBSISTENCE);
    expect(setActivePlot('inexistente').success).toBe(false);
    expect(harvest('plot_1').success).toBe(false);

    // Gasto de siembra y riego
    plant('plot_1');
    irrigate('plot_1');
    let state = getState();
    expect(state.economy.seedExpenses).toBe(35);
    expect(state.economy.irrigationExpenses).toBe(6);
    expect(state.waterConsumed).toBe(120);

    // Recarga de agua
    const refillRes = refillWater(200);
    expect(refillRes.success).toBe(true);
    expect(getState().waterReserve).toBe(680);
  });

  it('ejecuta demostración comparativa de los tres modos sin alterar la partida activa', () => {
    initializeFarm(SIMULATION_MODES.SUBSISTENCE);
    const before = getState();

    const demo = runModesComparisonDemo();
    expect(demo.results).toHaveLength(3);
    expect(demo.results.map((r) => r.mode)).toEqual([
      SIMULATION_MODES.SUBSISTENCE,
      SIMULATION_MODES.PRECISION,
      SIMULATION_MODES.ECOLOGICAL
    ]);
    expect(demo.results[1].waterConsumedL).toBeLessThan(demo.results[0].waterConsumedL);
    expect(demo.results[2].finalFertility).toBeGreaterThan(demo.results[0].finalFertility);
    expect(demo.disclaimer).toBe(EDUCATIONAL_DISCLAIMER);

    // La simulación activa permanece intacta
    expect(getState()).toEqual(before);
  });

  it('incrementa la humedad de forma progresiva por tiempo activo de riego continuo y detiene al 100%', () => {
    const sim = new FarmSimulation(SIMULATION_MODES.SUBSISTENCE, { registerAsActive: false });
    sim.plant('plot_1');
    const initialState = sim.getState();
    const initialMoisture = initialState.plots.plot_1.moisture; // 50
    const initialWater = initialState.waterReserve; // 600

    const canStart = sim.canStartContinuousIrrigation('plot_1');
    expect(canStart.canStart).toBe(true);

    // Un pulso de 0.5s en Subsistencia (30% / 5s = +3% y -12L) no debe llenar de golpe
    const step1 = sim.irrigateContinuousStep(0.5, 'plot_1', 5);
    expect(step1.success).toBe(true);
    expect(step1.applied).toBe(true);
    expect(step1.moistureGain).toBe(3);
    expect(step1.waterUsedL).toBe(12);
    expect(sim.getState().plots.plot_1.moisture).toBe(initialMoisture + 3);
    expect(sim.getState().waterReserve).toBe(initialWater - 12);

    // Varios pulsos acumulan humedad gradualmente hasta alcanzar 100% y reportar stoppedReason='all_full'
    let lastStep = step1;
    for (let i = 0; i < 30 && !lastStep.stoppedReason; i++) {
      lastStep = sim.irrigateContinuousStep(0.5, 'plot_1', 5);
    }
    expect(sim.getState().plots.plot_1.moisture).toBe(100);
    expect(lastStep.stoppedReason).toBe('all_full');
    expect(sim.canStartContinuousIrrigation('plot_1').canStart).toBe(false);
  });
});
