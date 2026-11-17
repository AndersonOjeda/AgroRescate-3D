import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FarmSimulation } from '../src/simulation/farmSimulation.js';
import { advancePests, resetPests } from '../src/simulation/pests.js';
import { PestVisualSystem } from '../src/systems/pestVisualSystem.js';
import { FarmAdapter } from '../src/integration/farmAdapter.js';

function plot(id, pressure = 0) {
  return { id, name: id, isPlanted: true, health: 100, moisture: 60, pestPressure: pressure, pestProtectionDays: 0 };
}

describe('Plagas y presión de la jornada', () => {
  it('avisa antes de causar daño y el calor acelera los focos', () => {
    const clear = { a: plot('a') };
    const hot = { a: plot('a') };
    expect(advancePests(clear, 'clear')).toHaveLength(1);
    advancePests(hot, 'heatwave');
    expect(clear.a.health).toBe(100);
    expect(hot.a.pestPressure).toBeGreaterThan(clear.a.pestPressure);
    advancePests(clear, 'clear');
    expect(clear.a.health).toBeLessThan(100);
  });

  it('propaga desde focos previos sin depender del orden de las parcelas', () => {
    const a = { a: plot('a', 50), b: plot('b', 25), c: plot('c', 0) };
    const b = { c: plot('c', 0), b: plot('b', 25), a: plot('a', 50) };
    advancePests(a, 'clear');
    advancePests(b, 'clear');
    expect(a).toEqual(b);
    expect(a.c.pestPressure).toBe(26);
  });

  it('protege dos amaneceres y limpia las parcelas vacías', () => {
    const p = plot('a', 40);
    p.pestProtectionDays = 2;
    advancePests({ a: p }, 'heatwave');
    expect(p.pestPressure).toBe(24);
    advancePests({ a: p }, 'heatwave');
    expect(p.pestPressure).toBe(8);
    advancePests({ a: p }, 'heatwave');
    expect(p.pestPressure).toBeGreaterThan(8);
    p.isPlanted = false;
    advancePests({ a: p }, 'clear');
    expect(p.pestPressure).toBe(0);
  });

  it('controla plagas sin dinero, cobra energía y rechaza repeticiones', async () => {
    const sim = new FarmSimulation('subsistence');
    sim.plant('plot_1');
    const p = sim.plots.plot_1;
    p.pestPressure = 90;
    p.health = 60;
    sim.budget = 0;
    sim.farmerEnergy = 30;
    const adapter = new FarmAdapter(sim);
    expect((await adapter.controlPests('plot_1')).success).toBe(true);
    expect(sim.farmerEnergy).toBe(18);
    expect(p.health).toBe(60);
    expect(p.pestPressure).toBe(35);
    expect((await adapter.controlPests('plot_1')).success).toBe(false);
    expect(sim.farmerEnergy).toBe(18);
  });

  it('no trata con energía insuficiente y conserva el estado', () => {
    const sim = new FarmSimulation();
    sim.plant('plot_2');
    sim.plots.plot_2.pestPressure = 60;
    sim.farmerEnergy = 5;
    const before = sim.getState();
    expect(sim.controlPests('plot_2').success).toBe(false);
    expect(sim.getState()).toEqual(before);
  });

  it('en calor exige y cobra exactamente la energía anunciada', () => {
    const sim = new FarmSimulation();
    sim.plant('plot_2');
    sim.plots.plot_2.pestPressure = 30;
    sim.currentWeather = { id: 'heatwave' };
    const required = sim.getState().plots.plot_2.pestAction.energy;
    sim.farmerEnergy = required - 1;
    expect(sim.controlPests('plot_2').success).toBe(false);
    sim.farmerEnergy = required;
    expect(sim.controlPests('plot_2').success).toBe(true);
    expect(sim.farmerEnergy).toBe(0);
  });

  it('descuidar el foco destruye salud mientras el cuidado temprano evita la escalada', () => {
    const neglected = plot('a', 20);
    const cared = plot('a', 0);
    cared.pestProtectionDays = 2;
    for (let day = 0; day < 5; day++) {
      advancePests({ a: neglected }, 'heatwave');
      advancePests({ a: cared }, 'heatwave');
      if (cared.pestPressure >= 15) {
        cared.pestPressure = Math.max(0, cared.pestPressure - 55);
        cared.pestProtectionDays = 2;
      }
    }
    expect(neglected.pestPressure).toBe(100);
    expect(neglected.health).toBeLessThan(40);
    expect(cared.health).toBe(100);
  });

  it('integral conserva las tres acciones y cobra lo anunciado para cada lote', () => {
    const sim = new FarmSimulation('integrated');
    const expected = [
      ['plot_1', 'manual', 12, 0, 55, 2],
      ['plot_2', 'traps', 8, 1200, 70, 2],
      ['plot_3', 'ecological', 16, 0, 45, 3]
    ];
    for (const [id, method, energy, cost, reduction, days] of expected) {
      sim.plots[id].isPlanted = true;
      sim.plots[id].pestPressure = 90;
      sim.farmerEnergy = 100;
      const before = sim.getState();
      const action = before.plots[id].pestAction;
      expect(action).toMatchObject({ method, energy, cost, reduction, protectionDays: days });
      expect(sim.controlPests(id).success).toBe(true);
      expect(sim.farmerEnergy).toBe(100 - energy);
      expect(sim.budget).toBe(before.budget - cost);
      expect(sim.plots[id].pestPressure).toBe(90 - reduction);
      expect(sim.plots[id].pestProtectionDays).toBe(days);
      expect(sim.getState().economy.totalExpenses).toBe(before.economy.totalExpenses + cost);
    }
  });

  it('usa la modalidad elegida en todos los lotes fuera de integral y actualiza al reiniciar', () => {
    const sim = new FarmSimulation('ecological');
    expect(Object.values(sim.getState().plots).every(p => p.pestAction.method === 'ecological')).toBe(true);
    sim.initializeFarm('precision');
    expect(Object.values(sim.getState().plots).every(p => p.pestAction.method === 'traps')).toBe(true);
    sim.initializeFarm('subsistence');
    expect(Object.values(sim.getState().plots).every(p => p.pestAction.method === 'manual')).toBe(true);
  });

  it('ofrece y ejecuta respaldo manual en precisión cuando falta presupuesto', () => {
    const sim = new FarmSimulation('precision');
    sim.plots.plot_2.isPlanted = true;
    sim.plots.plot_2.pestPressure = 60;
    sim.budget = 1199;
    const action = sim.getState().plots.plot_2.pestAction;
    expect(action).toMatchObject({ method: 'manual', fallback: true, cost: 0, energy: 12 });
    expect(sim.controlPests('plot_2').success).toBe(true);
    expect(sim.budget).toBe(1199);
    expect(sim.plots.plot_2.pestPressure).toBe(5);
  });

  it('el compost ecológico reduce más el crecimiento de plagas', () => {
    const traditional = { ...plot('a'), composted: true, modeAffinity: 'subsistence' };
    const ecological = { ...plot('b'), composted: true, modeAffinity: 'ecological' };
    advancePests({ a: traditional, b: ecological }, 'clear');
    expect(ecological.pestPressure).toBeLessThan(traditional.pestPressure);
  });

  it('cosechar limpia el foco y no regala semillas por resetear salud', () => {
    const sim = new FarmSimulation();
    sim.plant('plot_2');
    const p = sim.plots.plot_2;
    p.daysGrown = p.daysToMature;
    p.health = 60;
    p.pestPressure = 70;
    const result = sim.harvest('plot_2');
    expect(result.success).toBe(true);
    expect(result.seedGained).toBe(false);
    expect(p.pestPressure).toBe(0);
  });

  it('limita enjambres, muestra control y libera recursos de escena', () => {
    const scene = new THREE.Scene();
    const fx = new PestVisualSystem(scene, [{ id: 'a', x: 0, z: 0 }]);
    const p = plot('a', 100);
    fx.sync({ plots: { a: p } });
    fx.update(0.1);
    expect(fx.plots[0].bodies.count).toBe(36);
    expect(fx.plots[0].group.visible).toBe(true);
    resetPests(p);
    fx.sync({ plots: { a: p } });
    fx.showTreatment('a');
    fx.update(0.1);
    expect(fx.plots[0].ring.material.color.getHex()).toBe(0x34d399);
    fx.update(3);
    expect(fx.plots[0].group.visible).toBe(false);
    fx.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
