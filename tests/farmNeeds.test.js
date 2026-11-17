import { describe, it, expect } from 'vitest';
import { getFarmNeed, outsideInteraction } from '../src/gameplay/farmNeeds.js';

describe('Necesidades del mundo y distancia de consulta', () => {
  it('prioriza sequía sobre cosecha y retira la urgencia al resolverla', () => {
    const p = { name: 'P1', isPlanted: true, moisture: 10, daysGrown: 3, daysToMature: 3 };
    const state = { farmerEnergy: 80, day: 2, plots: { p } };
    expect(getFarmNeed(state).title).toContain('riego');
    p.moisture = 60;
    expect(getFarmNeed(state).title).toContain('Cosecha');
  });
  it('no vuelve a pedir tratar un foco ya atendido ese día', () => {
    const state = { farmerEnergy: 80, day: 3, plots: { p: { name: 'P1', isPlanted: true, moisture: 60, pestPressure: 60, pestTreatedDay: 3, daysGrown: 1, daysToMature: 3 } } };
    expect(getFarmNeed(state).title).toContain('Vigila');
    state.day++;
    expect(getFarmNeed(state).title).toContain('Controla');
  });
  it('cierra por distancia horizontal, sin afectar el límite ni la altura', () => {
    expect(outsideInteraction({ x: 3, z: 4, y: 20 }, { x: 0, z: 0 }, 5)).toBe(false);
    expect(outsideInteraction({ x: 3, z: 4.1 }, { x: 0, z: 0 }, 5)).toBe(true);
  });
});
