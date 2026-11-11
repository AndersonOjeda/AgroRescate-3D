import { describe, it, expect } from 'vitest';
import { FarmSimulation } from '../src/simulation/farmSimulation.js';
import { MissionManager } from '../src/gameplay/missionManager.js';
import { ResultsStore, buildRunResult } from '../src/gameplay/resultsStore.js';

describe('Ciclo Completo, Misiones y Resultados', () => {
  it('exige preparar el terreno antes de sembrar cuando requirePreparation está activo', () => {
    const sim = new FarmSimulation('subsistence', { registerAsActive: false });
    sim.setRequirePreparation(true);

    const failPlant = sim.plant('plot_1');
    expect(failPlant.success).toBe(false);

    const prep = sim.prepareSoil('plot_1');
    expect(prep.success).toBe(true);
    expect(prep.plot.stageLabel).toBe('Terreno preparado');

    const okPlant = sim.plant('plot_1');
    expect(okPlant.success).toBe(true);
    expect(okPlant.plot.isPrepared).toBe(true);
  });

  it('permite configurar el umbral de riego automático IoT en Precisión y lo acota entre 20 y 80%', () => {
    const sim = new FarmSimulation('precision', { registerAsActive: false });

    expect(sim.setAutoIrrigationThreshold(60).threshold).toBe(60);
    expect(sim.setAutoIrrigationThreshold(95).threshold).toBe(80);
    expect(sim.setAutoIrrigationThreshold(5).threshold).toBe(20);

    sim.plant('plot_2');
    // Bajamos la humedad por debajo del umbral configurado (60%)
    sim.plots.plot_2.moisture = 52;
    sim.setAutoIrrigationThreshold(60);
    const dayRes = sim.advanceDay();
    expect(dayRes.autoTriggered).toBe(true);
    expect(dayRes.autoIrrigatedPlotIds).toContain('plot_2');
  });

  it('completa las 5 misiones guiadas secuencialmente según la modalidad', () => {
    const mm = new MissionManager('precision');
    expect(mm.getCurrentMission().id).toBe('m1');

    mm.handleEvent({ type: 'enteredPlot', plotId: 'plot_2' });
    mm.handleEvent({ type: 'soilPrepared' });
    expect(mm.getCurrentMission().id).toBe('m2');

    mm.handleEvent({ type: 'planted' });
    expect(mm.getCurrentMission().id).toBe('m3');

    mm.handleEvent({ type: 'irrigated' });
    mm.handleEvent({ type: 'special', kind: 'sensor' });
    expect(mm.getCurrentMission().id).toBe('m4');

    mm.handleEvent({
      type: 'dayAdvanced',
      state: { plots: { plot_2: { isPlanted: true, daysGrown: 2, daysToMature: 2, isWithered: false } } }
    });
    expect(mm.getCurrentMission().id).toBe('m5');

    mm.handleEvent({ type: 'harvested', success: true, harvestKg: 80 });
    mm.handleEvent({ type: 'visitedWarehouse' });
    mm.handleEvent({ type: 'resultsViewed' });
    expect(mm.isComplete()).toBe(true);
  });

  it('almacena resultados reales y construye comparativa entre modalidades', () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v)
    };
    const store = new ResultsStore(storage);

    const simSub = new FarmSimulation('subsistence', { registerAsActive: false });
    simSub.prepareSoil('plot_1');
    simSub.plant('plot_1');
    for (let i = 0; i < 4; i++) {
      if (i === 1 || i === 2) simSub.irrigate('plot_1');
      simSub.advanceDay();
    }
    const harvSub = simSub.harvest('plot_1');
    store.add(buildRunResult(harvSub.state, harvSub.report, ['Siembra manual']));

    const simEco = new FarmSimulation('ecological', { registerAsActive: false });
    simEco.prepareSoil('plot_3');
    simEco.plant('plot_3');
    simEco.applyCompost('plot_3');
    for (let i = 0; i < 3; i++) simEco.advanceDay();
    const harvEco = simEco.harvest('plot_3');
    store.add(buildRunResult(harvEco.state, harvEco.report, ['Compost aplicado']));

    const comp = store.getComparison();
    expect(comp.length).toBe(2);
    expect(comp.map((c) => c.mode)).toEqual(['subsistence', 'ecological']);
    expect(comp[0].harvestKg).toBeGreaterThan(0);
    expect(comp[1].compostApplications).toBe(1);
  });

  it('detecta niveles bajos en tiempo real según el umbral configurado en Precisión IoT y detiene al alcanzar objetivo', () => {
    const sim = new FarmSimulation('precision', { registerAsActive: false });
    sim.plant('plot_2'); // plot_2 inicia en 75% de humedad
    expect(sim.getPlotsNeedingRealtimeAutoIrrigation()).toEqual([]);

    // Al subir el umbral a 80%, el sensor debe detectar inmediatamente que plot_2 (75%) necesita riego
    sim.setAutoIrrigationThreshold(80);
    const state = sim.getState();
    expect(state.sensor.thresholdMoisture).toBe(80);
    expect(state.sensor.readings.plot_2.needsIrrigation).toBe(true);
    expect(sim.getPlotsNeedingRealtimeAutoIrrigation()).toEqual(['plot_2']);

    // Riego automático progresivo hasta el objetivo óptimo (85%)
    let last = null;
    for (let i = 0; i < 12; i++) {
      last = sim.irrigateContinuousStep(0.5, 'plot_2', 5, 85);
      if (last.stoppedReason) break;
    }
    expect(sim.getState().plots.plot_2.moisture).toBe(85);
    expect(last.stoppedReason).toBe('target_reached');
    expect(sim.getPlotsNeedingRealtimeAutoIrrigation()).toEqual([]);
  });

  it('permite operar la modalidad Finca Integral (3 en 1) con reglas reales independientes por lote sin restringir lotes en modos individuales', () => {
    // 1. En un modo individual, las 3 parcelas siguen siendo accesibles sin bloqueo
    const singleSim = new FarmSimulation('subsistence', { registerAsActive: false });
    expect(singleSim.plant('plot_2').success).toBe(true);
    expect(singleSim.plant('plot_3').success).toBe(true);

    // 2. En modo Integral (3 en 1), cada parcela conserva su fertilidad, costos y automatización propios
    const sim = new FarmSimulation('integrated', { registerAsActive: false });
    const start = sim.getState();
    expect(start.mode).toBe('integrated');
    expect(start.plots.plot_1.fertility).toBe(60);
    expect(start.plots.plot_2.fertility).toBe(80);
    expect(start.plots.plot_3.fertility).toBe(95);

    // Sembrar los 3 lotes cobra $22.000 + $45.000 + $32.000 = $99.000 COP
    sim.plant('plot_1');
    sim.plant('plot_2');
    sim.plant('plot_3');
    expect(sim.getState().economy.seedExpenses).toBe(99000);

    // Compost en P3 es gratis, mientras en P1 cuesta $18.000
    expect(sim.applyCompost('plot_3').success).toBe(true);
    expect(sim.getState().economy.compostExpenses).toBe(0);
    expect(sim.applyCompost('plot_1').success).toBe(true);
    expect(sim.getState().economy.compostExpenses).toBe(18000);

    // Si los 3 lotes bajan a 30% de humedad, solo P2 (Precisión IoT) dispara riego automático
    sim.plots.plot_1.moisture = 30;
    sim.plots.plot_2.moisture = 30;
    sim.plots.plot_3.moisture = 30;
    expect(sim.getPlotsNeedingRealtimeAutoIrrigation()).toEqual(['plot_2']);

    const dayRes = sim.advanceDay();
    expect(dayRes.autoTriggered).toBe(true);
    expect(dayRes.autoIrrigatedPlotIds).toEqual(['plot_2']);
  });
});
