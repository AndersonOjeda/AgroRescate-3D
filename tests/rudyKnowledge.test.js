import { describe, it, expect } from 'vitest';
import { FarmSimulation } from '../src/simulation/farmSimulation.js';
import { askRudyAI } from '../src/ai/rudyAdvisor.js';
function farm() { const sim = new FarmSimulation('integrated'); sim.enableRows(); return sim; }
describe('Conocimiento de Rudy sobre reglas y situación real', () => {
  it('explica preparación, inventario y abono sin confundir el tema al mencionar un surco', () => {
    const sim = farm();
    expect(askRudyAI('por que no puedo sembrar el surco', sim.getState()).body).toContain('prepara');
    const reply = askRudyAI('como aplico abono en el surco', sim.getState());
    expect(reply.title).toContain('Abono');
    expect(reply.tips.some(t => t.includes('B'))).toBe(true);
  });
  it('da el tratamiento del surco no seleccionado y deja de recomendar repetirlo tras atenderlo', () => {
    const sim = farm();
    sim.plotRows.plot_2[4].isPlanted = true;
    sim.plotRows.plot_2[4].pestPressure = 80;
    const before = askRudyAI('plagas que hago', sim.getState());
    expect(before.tips.join(' ')).toContain('Surco 5');
    expect(before.tips.join(' ')).toContain('1200');
    sim.selectRow('plot_2', 4); sim.controlPests('plot_2');
    const after = askRudyAI('plagas que hago', sim.getState());
    expect(after.body).toContain('No hay focos');
  });
  it('muestra la meta y actualiza el inventario tras comprar', () => {
    const sim = farm();
    expect(askRudyAI('como gano la partida', sim.getState()).body).toContain(sim.getState().goal.target.toLocaleString('es-CO'));
    sim.buyFertilizer('compost');
    expect(askRudyAI('que tengo en el inventario', sim.getState()).tips.join(' ')).toContain('3 compost');
  });
  it('informa producción pendiente y lista con los datos de hoy', () => {
    const sim = farm(); sim.useComposter();
    expect(askRudyAI('como va el compost', sim.getState()).tips.join(' ')).toContain('día 3');
    sim.advanceDay('clear'); sim.advanceDay('clear');
    expect(askRudyAI('como va el compost', sim.getState()).tips.join(' ')).toContain('ya maduró');
  });
});
