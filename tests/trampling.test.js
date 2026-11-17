import { describe, it, expect } from 'vitest';
import { findTrampledPlant } from '../src/gameplay/trampling.js';
import { FarmSimulation } from '../src/simulation/farmSimulation.js';

describe('Pisoteo de cultivos', () => {
  it('detecta cruzar una planta y permite caminar entre hileras o quedarse quieto', () => {
    const points = [{ x: 0, z: 0, index: 0 }];
    expect(findTrampledPlant(points, { x: -1, z: 0 }, { x: 1, z: 0 })).toBe(points[0]);
    expect(findTrampledPlant(points, { x: -1, z: 1 }, { x: 1, z: 1 })).toBeNull();
    expect(findTrampledPlant(points, { x: 0, z: 0 }, { x: 0, z: 0 })).toBeNull();
  });
  it('acumula daño limitado por planta y lo conserva hasta cosechar', () => {
    const s = new FarmSimulation();
    s.plant('plot_2');
    const p = s.plots.plot_2;
    const health = p.health;
    for (let i = 0; i < 3; i++) expect(s.trampleCrop('plot_2', 0).success).toBe(true);
    expect(p.health).toBe(health - 12);
    expect(p.trampledPlants[0]).toBe(3);
    expect(s.trampleCrop('plot_2', 0).success).toBe(false);
    p.daysGrown = p.daysToMature;
    expect(s.harvest('plot_2').success).toBe(true);
    expect(p.trampledPlants).toEqual({});
  });
  it('no daña parcelas vacías o cultivos ya perdidos', () => {
    const s = new FarmSimulation();
    expect(s.trampleCrop('plot_2', 0).success).toBe(false);
    s.plots.plot_2.isPlanted = true;
    s.plots.plot_2.isWithered = true;
    expect(s.trampleCrop('plot_2', 0).success).toBe(false);
  });
});
