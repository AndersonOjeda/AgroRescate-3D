import { describe, it, expect } from 'vitest';
import { FarmSimulation } from '../src/simulation/farmSimulation.js';
import { FarmAdapter } from '../src/integration/farmAdapter.js';

describe('Clima extremo', () => {
  it('activa el clima dinámico en la partida y lo conserva al cambiar de modo', async () => {
    const adapter = new FarmAdapter();
    expect(adapter.simulation.enableDynamicWeather).toBe(true);
    await adapter.initializeFarm('ecological');
    expect(adapter.simulation.enableDynamicWeather).toBe(true);
  });
  it('la inundación satura menos los lotes de precisión en integral', () => {
    const sim = new FarmSimulation('integrated');
    for (const p of Object.values(sim.plots)) {
      p.isPlanted = true;
      p.moisture = 70;
    }
    const result = sim.advanceDay('flood');
    expect(result.state.currentWeather.id).toBe('flood');
    expect(sim.plots.plot_2.moisture).toBeLessThan(sim.plots.plot_1.moisture);
    expect(sim.plots.plot_1.health).toBeLessThan(90);
  });
  it('el vendaval daña cultivos y añade agua', () => {
    const sim = new FarmSimulation();
    sim.plots.plot_2.isPlanted = true;
    sim.plots.plot_2.moisture = 40;
    sim.advanceDay('storm');
    expect(sim.plots.plot_2.health).toBeLessThan(90);
    expect(sim.plots.plot_2.moisture).toBeGreaterThan(40);
  });
});
