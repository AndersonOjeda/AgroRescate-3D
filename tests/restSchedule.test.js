import { describe, it, expect } from 'vitest';
import { FarmSimulation } from '../src/simulation/farmSimulation.js';
import { WORK_START, WORK_END, isBedtime } from '../src/gameplay/workSchedule.js';
describe('Horario campesino', () => {
  it('comienza a las 07:00 y obliga a dormir desde las 18:00, nunca antes', () => {
    const s = new FarmSimulation();
    expect(s.timeOfDay).toBe(WORK_START);
    s.timeOfDay = WORK_END - 0.0001;
    expect(s.getRestAvailability().canSleep).toBe(false);
    expect(isBedtime(s.timeOfDay)).toBe(false);
    s.timeOfDay = WORK_END;
    expect(isBedtime(s.timeOfDay)).toBe(true);
    expect(s.restAtFarmerHouse({ sleep: true }).success).toBe(true);
    expect(s.day).toBe(2);
    expect(s.timeOfDay).toBe(WORK_START);
    expect(s.restAtFarmerHouse({ sleep: true }).success).toBe(false);
  });
  it.each(['rain', 'storm', 'flood'])('permite refugiarse por %s por la mañana una sola vez y sin avanzar el día', id => {
    const s = new FarmSimulation(); s.timeOfDay = 0.1; s.currentWeather = { id }; s.farmerEnergy = 10;
    expect(s.getRestAvailability().canRest).toBe(true);
    expect(s.restAtFarmerHouse().success).toBe(true);
    expect(s.day).toBe(1);
    expect(s.farmerEnergy).toBe(100);
    expect(s.restAtFarmerHouse().success).toBe(false);
    s.timeOfDay = 0.55;
    expect(s.restAtFarmerHouse().success).toBe(false);
    expect(s.restAtFarmerHouse({ sleep: true }).success).toBe(false);
  });
  it('rechaza descanso y sueño en la mañana sin cambiar energía ni día', () => {
    const s = new FarmSimulation(); s.timeOfDay = 0.1; s.farmerEnergy = 10;
    expect(s.restAtFarmerHouse().success).toBe(false);
    expect(s.restAtFarmerHouse({ sleep: true }).success).toBe(false);
    expect(s.day).toBe(1); expect(s.farmerEnergy).toBe(10);
  });
  it('permite solo una siesta por tarde y habilita otra al día siguiente', () => {
    const s = new FarmSimulation(); s.timeOfDay = 0.55;
    expect(s.restAtFarmerHouse().success).toBe(true);
    expect(s.restAtFarmerHouse().success).toBe(false);
    s.advanceDay('clear'); s.timeOfDay = 0.55;
    expect(s.restAtFarmerHouse().success).toBe(true);
  });
  it('dormir de noche avanza exactamente un día y recupera energía', () => {
    const s = new FarmSimulation(); s.timeOfDay = 0.8; s.farmerEnergy = 5;
    expect(s.restAtFarmerHouse({ sleep: true }).success).toBe(true);
    expect(s.day).toBe(2); expect(s.farmerEnergy).toBe(100);
    expect(s.restAtFarmerHouse({ sleep: true }).success).toBe(false);
  });
});
