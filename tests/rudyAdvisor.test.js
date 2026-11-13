import { describe, expect, it } from 'vitest';
import { analyzeFarmWithRudyAI, askRudyAI, RUDY_QUICK_QUESTIONS } from '../src/ai/rudyAdvisor.js';
import { GuideChicken, GUIDE_STEPS } from '../src/world/guideChicken.js';

function makeMockState(overrides = {}) {
  return {
    day: 3,
    mode: 'SUBSISTENCE',
    budget: 45000,
    waterReserve: 600,
    farmerEnergy: 80,
    currentWeather: { id: 'sunny', name: 'Soleado', description: 'Día despejado' },
    plots: {
      plot_1: {
        id: 'plot_1',
        name: 'Parcela 1',
        cropName: 'Maíz',
        isPlanted: true,
        isWithered: false,
        moisture: 60,
        fertility: 70,
        health: 85,
        pestPressure: 0,
        daysGrown: 2,
        daysToMature: 5,
        modeAffinity: 'Subsistencia'
      }
    },
    ...overrides
  };
}

describe('Rudy IA — Asesor Agronómico', () => {
  it('detecta estado estable cuando no hay alertas críticas', () => {
    const analysis = analyzeFarmWithRudyAI(makeMockState(), 'Mañana');
    expect(analysis.score).toBeGreaterThanOrEqual(85);
    expect(analysis.urgency).toBe('normal');
    expect(analysis.headline).toContain('estable');
  });

  it('prioriza alertas críticas por energía baja, sequía y plagas', () => {
    const criticalState = makeMockState({
      farmerEnergy: 15,
      plots: {
        plot_1: {
          id: 'plot_1',
          name: 'Parcela 1',
          cropName: 'Maíz',
          isPlanted: true,
          isWithered: false,
          moisture: 18,
          fertility: 35,
          health: 40,
          pestPressure: 55,
          pestAction: { label: 'Retiro manual de plagas' },
          daysGrown: 2,
          daysToMature: 5
        }
      }
    });

    const analysis = analyzeFarmWithRudyAI(criticalState, 'Tarde');
    expect(analysis.urgency).toBe('critical');
    expect(analysis.score).toBeLessThan(50);
    expect(analysis.priorities.some((p) => p.label.includes('Energía crítica'))).toBe(true);
    expect(analysis.priorities.some((p) => p.label.includes('Plaga fuerte'))).toBe(true);
    expect(analysis.priorities.some((p) => p.label.includes('Estrés hídrico'))).toBe(true);
  });

  it('responde preguntas de lenguaje natural sobre agua, plagas, energía y modos', () => {
    const state = makeMockState({
      plots: {
        plot_1: {
          id: 'plot_1',
          name: 'Parcela 1',
          cropName: 'Tomate',
          isPlanted: true,
          isWithered: false,
          moisture: 25,
          fertility: 65,
          health: 70,
          pestPressure: 25,
          pestAction: { label: 'Extracto de ajo y ají' },
          daysGrown: 1,
          daysToMature: 5
        }
      }
    });

    const waterReply = askRudyAI('¿Cómo está la humedad y el riego?', state, 'Mediodía');
    expect(waterReply.title).toContain('Análisis Hídrico');
    expect(waterReply.body).toContain('Parcela 1');

    const pestReply = askRudyAI('tengo plagas qué hago', state, 'Mediodía');
    expect(pestReply.title).toContain('Sanidad Vegetal');
    expect(pestReply.tips.some((t) => t.includes('25%'))).toBe(true);

    const energyReply = askRudyAI('estoy cansado, dónde descanso?', state, 'Noche');
    expect(energyReply.title).toContain('Energía');
    expect(energyReply.body).toContain('Noche');

    const modeReply = askRudyAI('qué diferencia hay entre modalidades?', state, 'Mañana');
    expect(modeReply.title).toContain('Modalidades');
    expect(RUDY_QUICK_QUESTIONS.length).toBeGreaterThanOrEqual(4);
  });

  it('actualiza el estado de alerta y celebración en GuideChicken', () => {
    const chicken = new GuideChicken(null, { autoLoad: false });
    expect(GUIDE_STEPS.length).toBe(5);

    chicken.setAlertState('critical');
    expect(chicken.alertLevel).toBe('critical');
    expect(chicken.markerMat.color.getHex()).toBe(0xef4444);

    chicken.setAlertState('normal');
    chicken.setTalked(true);
    expect(chicken.markerMat.color.getHex()).toBe(0x34d399);

    chicken.celebrate();
    expect(chicken.celebrateTimer).toBeGreaterThan(0);
    chicken.update(0.1, { x: 1, z: 1 });
    expect(chicken.visualPivot.position.y).toBeGreaterThanOrEqual(0);
  });
});
