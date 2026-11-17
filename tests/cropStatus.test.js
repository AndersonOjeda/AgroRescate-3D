import { describe, it, expect } from 'vitest';
import { cropWarnings } from '../src/ui/cropStatus.js';

describe('Alertas de cultivos', () => {
  it('muestra todos los problemas simultáneos y el clima', () => {
    const warnings = cropWarnings({ isPlanted: true, moisture: 20, fertility: 25, health: 30, pestPressure: 45, daysGrown: 1, daysToMature: 3 }, { id: 'storm', name: 'Vendaval', description: 'Daño foliar' });
    expect(warnings).toHaveLength(5);
    expect(warnings.join(' ')).toContain('Vendaval');
  });
  it('no recomienda regar terrenos inundados ni cultivos perdidos', () => {
    expect(cropWarnings({ isPlanted: true, moisture: 95 })).toContain('Exceso de agua: suspende el riego.');
    expect(cropWarnings({ isPlanted: true, isWithered: true, moisture: 0 })).toEqual(['Cultivo perdido: retira los restos.']);
  });
});
