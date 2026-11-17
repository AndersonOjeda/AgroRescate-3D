import { describe, it, expect } from 'vitest';
import { FarmSimulation } from '../src/simulation/farmSimulation.js';
import { advanceFertilizer } from '../src/simulation/fertilizer.js';
function farm() { const sim = new FarmSimulation('integrated'); sim.enableRows(); return sim; }
describe('Abonado por surco y producción de compost', () => {
  it('consume una dosis, no mejora instantáneamente y no afecta al vecino', () => {
    const sim = farm(); const p = sim.plots.plot_1;
    const fertility = p.fertility;
    expect(sim.applyCompost('plot_1').success).toBe(true);
    expect(p.fertility).toBe(fertility);
    expect(sim.fertilizerStock.compost).toBe(1);
    expect(sim.plotRows.plot_1[1].fertilizer).toBeUndefined();
    const energy = sim.farmerEnergy;
    expect(sim.applyCompost('plot_1').success).toBe(false);
    expect(sim.farmerEnergy).toBe(energy);
    advanceFertilizer(p, 'clear');
    expect(p.fertility).toBe(fertility + 4);
    expect(p.fertilizer.remainingDays).toBe(2);
  });
  it('diferencia recursos, duración y esfuerzo por agricultura', () => {
    const sim = farm();
    for (const id of ['plot_1', 'plot_2', 'plot_3']) sim.plots[id].fertility = 60;
    const snapshot = sim.getState();
    expect(snapshot.plots.plot_1.fertilizerAdvice).toMatchObject({ stock: 'compost', days: 3, energy: 8 });
    expect(snapshot.plots.plot_2.fertilizerAdvice).toMatchObject({ stock: 'nutrients', days: 2, energy: 5 });
    expect(snapshot.plots.plot_3.fertilizerAdvice).toMatchObject({ stock: 'compost', days: 4, energy: 10 });
    sim.applyCompost('plot_2');
    expect(sim.fertilizerStock.nutrients).toBe(1);
    expect(sim.fertilizerStock.compost).toBe(2);
  });
  it('rechaza suelo fértil, falta de dosis o energía sin cobrar', () => {
    const sim = farm();
    expect(sim.applyCompost('plot_3').success).toBe(false);
    sim.fertilizerStock.compost = 0;
    expect(sim.applyCompost('plot_1').success).toBe(false);
    sim.fertilizerStock.compost = 2; sim.farmerEnergy = 0;
    expect(sim.applyCompost('plot_1').success).toBe(false);
    expect(sim.fertilizerStock.compost).toBe(2);
  });
  it('la lluvia reduce el aprovechamiento y la protección termina', () => {
    const p = { fertility: 50, fertilizer: { gain: 8, remainingDays: 1, stock: 'nutrients' } };
    advanceFertilizer(p, 'storm');
    expect(p.fertility).toBe(54);
    expect(p.fertilizer.washed).toBe(true);
    advanceFertilizer(p, 'clear');
    expect(p.fertility).toBe(54);
  });
  it('madura residuos sin duplicar lotes ni recolecciones y permite compras', () => {
    const sim = farm();
    expect(sim.useComposter().success).toBe(true);
    expect(sim.cropResidues).toBe(0);
    expect(sim.useComposter().success).toBe(false);
    sim.advanceDay('clear'); sim.advanceDay('clear');
    expect(sim.getState().compostBatch.ready).toBe(true);
    expect(sim.useComposter().success).toBe(true);
    expect(sim.fertilizerStock.compost).toBe(4);
    expect(sim.useComposter().success).toBe(false);
    const cash = sim.budget;
    expect(sim.buyFertilizer('nutrients').success).toBe(true);
    expect(sim.budget).toBe(cash - 4500);
    expect(sim.economy.compostExpenses).toBe(4500);
  });
});
