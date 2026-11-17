import { describe, it, expect } from 'vitest';
import { FarmSimulation } from '../src/simulation/farmSimulation.js';

function farm() {
  const sim = new FarmSimulation('integrated');
  sim.enableRows(); sim.setRequirePreparation(true);
  return sim;
}
describe('Surcos independientes y meta de partida', () => {
  it('crea cinco surcos por lote y conserva la modalidad', () => {
    const sim = farm();
    expect(Object.values(sim.getState().plots).map(p => p.rows.length)).toEqual([5, 5, 5]);
    expect(sim.getState().plots.plot_3.rows[0].modeAffinity).toBe('ecological');
    expect(sim.selectRow('plot_3', 4)).toBe(true);
    expect(sim.selectRow('plot_3', 5)).toBe(false);
  });
  it('preparar y sembrar un surco no prepara ni siembra a los vecinos', () => {
    const sim = farm();
    sim.selectRow('plot_1', 1);
    expect(sim.plant('plot_1').success).toBe(false);
    expect(sim.prepareSoil('plot_1').success).toBe(true);
    expect(sim.plant('plot_1').success).toBe(true);
    const rows = sim.getState().plots.plot_1.rows;
    expect(rows[1].isPlanted).toBe(true);
    expect(rows[0].isPrepared).toBe(false);
    expect(rows[2].isPlanted).toBe(false);
  });
  it('todos crecen y sufren el clima aunque no estén seleccionados', () => {
    const sim = farm();
    sim.selectRow('plot_2', 0); sim.prepareSoil('plot_2'); sim.plant('plot_2');
    sim.selectRow('plot_2', 1); sim.prepareSoil('plot_2'); sim.plant('plot_2');
    sim.selectRow('plot_2', 4); sim.advanceDay('clear');
    const rows = sim.getState().plots.plot_2.rows;
    expect(rows[0].daysGrown).toBe(1); expect(rows[1].daysGrown).toBe(1);
    expect(rows[4].isPlanted).toBe(false);
  });
  it('cosechar exige volver a preparar ese surco y la victoria se conserva', () => {
    const sim = farm();
    sim.prepareSoil('plot_2'); sim.plant('plot_2');
    sim.plots.plot_2.daysGrown = 3;
    expect(sim.harvest('plot_2').success).toBe(true);
    expect(sim.plots.plot_2.isPrepared).toBe(false);
    expect(sim.plant('plot_2').success).toBe(false);
    expect(sim.getState().goal.complete).toBe(false);
    sim.budget = sim.initialBudget + 100000;
    expect(sim.getState().goal.complete).toBe(true);
    sim.budget -= 1000;
    expect(sim.getState().goal.complete).toBe(true);
    sim.initializeFarm('ecological');
    expect(sim.getState().goal.complete).toBe(false);
    expect(sim.getState().plots.plot_3.rows).toHaveLength(5);
  });
  it.each(['plot_1', 'plot_2', 'plot_3'])('%s exige cinco preparaciones y cinco siembras para llenarlo', plotId => {
    const sim = farm();
    sim.budget = 1000000;
    for (let index = 0; index < 5; index++) {
      sim.farmerEnergy = 100;
      expect(sim.selectRow(plotId, index)).toBe(true);
      expect(sim.plant(plotId).success).toBe(false);
      expect(sim.prepareSoil(plotId).success).toBe(true);
      expect(sim.plant(plotId).success).toBe(true);
      expect(sim.plant(plotId).success).toBe(false);
      const rows = sim.getState().plots[plotId].rows;
      expect(rows.filter(row => row.isPlanted)).toHaveLength(index + 1);
      expect(rows.slice(index + 1).every(row => !row.isPrepared && !row.isPlanted)).toBe(true);
    }
    for (const [id, plot] of Object.entries(sim.getState().plots)) {
      if (id !== plotId) expect(plot.rows.every(row => !row.isPlanted)).toBe(true);
    }
  });
});
