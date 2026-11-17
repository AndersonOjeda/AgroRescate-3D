import { describe, it, expect } from 'vitest';
import { hasPrecisionIndicators, fieldObservation } from '../src/ui/agricultureIndicators.js';
describe('Indicadores según agricultura', () => {
  it('reserva las mediciones para precisión y respeta la afinidad de cada lote en integral', () => {
    expect(hasPrecisionIndicators({ mode: 'subsistence' }, { modeAffinity: 'precision' })).toBe(false);
    expect(hasPrecisionIndicators({ mode: 'ecological' }, {})).toBe(false);
    expect(hasPrecisionIndicators({ mode: 'precision' }, {})).toBe(true);
    expect(hasPrecisionIndicators({ mode: 'integrated' }, { modeAffinity: 'precision' })).toBe(true);
    expect(hasPrecisionIndicators({ mode: 'integrated' }, { modeAffinity: 'subsistence' })).toBe(false);
  });
  it('describe señales del campo sin porcentajes ni valores ocultos', () => {
    const text = fieldObservation({ isPlanted: true, moisture: 12, fertility: 25, health: 30, pestPressure: 50, fertilizer: { remainingDays: 2 } });
    expect(text).toContain('Tierra seca');
    expect(text).toContain('Suelo agotado');
    expect(text).toContain('Plantas debilitadas');
    expect(text).not.toMatch(/[0-9%]/);
  });
});
