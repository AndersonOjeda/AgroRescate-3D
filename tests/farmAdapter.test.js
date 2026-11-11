import { describe, it, expect, beforeEach } from 'vitest';
import { FarmSimulation } from '../src/simulation/farmSimulation.js';
import { FarmAdapter } from '../src/integration/farmAdapter.js';

describe('FarmSimulation & FarmAdapter — Contrato Agrícola', () => {
  let sim;
  let adapter;

  beforeEach(() => {
    sim = new FarmSimulation('precision');
    adapter = new FarmAdapter(sim);
  });

  it('debe inicializar correctamente en modo precisión con valores esperados', async () => {
    const state = await adapter.getState();
    expect(state.mode).toBe('precision');
    expect(state.day).toBe(1);
    expect(state.budget).toBe(450000);
    expect(state.waterReserve).toBe(900);
    expect(state.soilQuality).toBe(80);
    expect(state.plots.plot_2.isPlanted).toBe(false);
  });

  it('debe soportar el cambio a modo subsistencia y ecológica', async () => {
    const stateSub = await adapter.initializeFarm('subsistence');
    expect(stateSub.mode).toBe('subsistence');
    expect(stateSub.budget).toBe(150000);

    const stateEco = await adapter.initializeFarm('ecological');
    expect(stateEco.mode).toBe('ecological');
    expect(stateEco.soilQuality).toBe(95);
  });

  it('debe permitir sembrar en una parcela y descontar presupuesto', async () => {
    const res = await adapter.plant('plot_1');
    expect(res.success).toBe(true);

    const state = await adapter.getState();
    expect(state.plots.plot_1.isPlanted).toBe(true);
    expect(state.plots.plot_1.visualState).toBe(1); // Brote
    expect(state.budget).toBeLessThan(450000);
  });

  it('debe permitir regar y aumentar la humedad consumiendo agua de reserva', async () => {
    await adapter.plant('plot_1');
    const waterBefore = (await adapter.getState()).waterReserve;

    const res = await adapter.irrigate('plot_1');
    expect(res.success).toBe(true);

    const stateAfter = await adapter.getState();
    expect(stateAfter.waterReserve).toBeLessThan(waterBefore);
    expect(stateAfter.plots.plot_1.moisture).toBeGreaterThan(50);
  });

  it('debe avanzar días y evolucionar el cultivo a estado maduro (visualState: 3)', async () => {
    await adapter.plant('plot_2'); // Parcela 2 madura en 2 días
    await adapter.irrigate('plot_2');

    await adapter.advanceDay(); // Día 1 crecido
    let state = await adapter.getState();
    expect(state.day).toBe(2);
    expect(state.plots.plot_2.visualState).toBe(2); // Crecimiento

    await adapter.advanceDay(); // Día 2 maduro
    state = await adapter.getState();
    expect(state.day).toBe(3);
    expect(state.plots.plot_2.visualState).toBe(3); // Madura
  });

  it('debe permitir cosechar una parcela madura e incrementar presupuesto y cosecha', async () => {
    await adapter.plant('plot_2');
    await adapter.irrigate('plot_2');
    await adapter.advanceDay();
    await adapter.advanceDay();

    const budgetBefore = (await adapter.getState()).budget;
    const res = await adapter.harvest('plot_2');

    expect(res.success).toBe(true);
    expect(res.harvestKg).toBeGreaterThan(0);
    expect(res.earnings).toBeGreaterThan(0);

    const stateAfter = await adapter.getState();
    expect(stateAfter.budget).toBeGreaterThan(budgetBefore);
    expect(stateAfter.harvestedTotalKg).toBe(res.harvestKg);
    expect(stateAfter.plots.plot_2.isPlanted).toBe(false);
    expect(stateAfter.plots.plot_2.visualState).toBe(0); // Vacía
  });

  it('debe emitir eventos stateChange a los escuchadores', async () => {
    let eventReceived = null;
    adapter.on('stateChange', (data) => {
      eventReceived = data;
    });

    await adapter.plant('plot_1');
    expect(eventReceived).not.toBeNull();
    expect(eventReceived.action).toBe('plant');
  });

  it('permite riego continuo progresivo sin disparar múltiples eventos completos de golpe', async () => {
    await adapter.plant('plot_2');
    const before = await adapter.getState();
    const startMoisture = before.plots.plot_2.moisture;

    const events = [];
    adapter.on('stateChange', (data) => events.push(data.action));

    const res1 = await adapter.irrigateContinuousStep(0.5);
    expect(res1.applied).toBe(true);
    const mid = await adapter.getState();
    expect(mid.plots.plot_2.moisture).toBeGreaterThan(startMoisture);
    expect(mid.plots.plot_2.moisture).toBeLessThan(startMoisture + 10);

    const res2 = await adapter.irrigateContinuousStep(0.5);
    expect(res2.applied).toBe(true);
    const after = await adapter.getState();
    expect(after.plots.plot_2.moisture).toBeGreaterThan(mid.plots.plot_2.moisture);
    expect(events).toEqual(['irrigateContinuous', 'irrigateContinuous']);
  });
});
