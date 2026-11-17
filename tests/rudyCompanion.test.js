import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GuideChicken } from '../src/world/guideChicken.js';
import { analyzeFarmWithRudyAI } from '../src/ai/rudyAdvisor.js';
import { FarmSimulation } from '../src/simulation/farmSimulation.js';
describe('Rudy acompañante', () => {
  it('se acerca sin invadir al jugador', () => {
    const chicken = new GuideChicken(new THREE.Scene(), { autoLoad: false, position: { x: 0, y: 0, z: 0 } });
    for (let i = 0; i < 200; i++) chicken.update(0.016, { x: 8, z: 0 }, { enabled: true });
    expect(chicken.position.x).toBeGreaterThan(0);
    expect(Math.hypot(chicken.position.x - 8, chicken.position.z)).toBeGreaterThanOrEqual(6.49);
  });
  it('no atraviesa paredes', () => {
    const chicken = new GuideChicken(new THREE.Scene(), { autoLoad: false, position: { x: 0, y: 0, z: 0 } });
    const obstacles = [{ type: 'box', minX: 1, maxX: 2, minZ: -10, maxZ: 10 }];
    for (let i = 0; i < 100; i++) chicken.update(0.016, { x: 8, z: 0 }, { enabled: true, obstacles });
    expect(chicken.position.x).toBeLessThanOrEqual(0.65);
    const before = chicken.position.clone();
    chicken.update(1, { x: -8, z: 0 }, { enabled: false });
    expect(chicken.position.equals(before)).toBe(true);
  });
  it('se aparta si el jugador se acerca demasiado, incluso mientras habla', () => {
    const chicken = new GuideChicken(new THREE.Scene(), { autoLoad: false, position: { x: 0, y: 0, z: 0 } });
    chicken.setTalking(true);
    for (let i = 0; i < 100; i++) chicken.update(0.016, { x: 1, z: 0 }, { enabled: true });
    expect(Math.hypot(chicken.position.x - 1, chicken.position.z)).toBeGreaterThan(3);
  });
  it('revisa surcos no seleccionados y propone usar existencias', () => {
    const sim = new FarmSimulation('integrated'); sim.enableRows();
    const row = sim.plotRows.plot_1[4]; row.isPlanted = true; row.moisture = 10; row.fertility = 40;
    const analysis = analyzeFarmWithRudyAI(sim.getState());
    expect(analysis.priorities.some(p => p.label.includes('Surco 5') && p.label.includes('hídrico'))).toBe(true);
    expect(analysis.priorities.some(p => p.detail.includes('Ya tienes abono'))).toBe(true);
  });
  it('respeta el horario de descanso al aconsejar', () => {
    const sim = new FarmSimulation(); sim.farmerEnergy = 5; sim.timeOfDay = 0.1;
    const analysis = analyzeFarmWithRudyAI(sim.getState());
    expect(analysis.priorities.find(p => p.label.includes('Energía crítica')).detail).toContain('se habilita');
  });
});
