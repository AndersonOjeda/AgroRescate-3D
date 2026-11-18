import { it, expect, vi, afterEach } from 'vitest';
import { GameModalsController } from '../src/ui/gameModals.js';
import { FarmAdapter } from '../src/integration/farmAdapter.js';
import { FarmSimulation } from '../src/simulation/farmSimulation.js';
import { WORK_START, WORK_END } from '../src/gameplay/workSchedule.js';

vi.mock('../src/ui/restTransition.js', () => ({ withRestTransition: async action => action() }));
afterEach(() => vi.unstubAllGlobals());

function setup() {
  vi.stubGlobal('document', { getElementById: () => null });
  const farm = new FarmSimulation();
  farm.timeOfDay = WORK_END;
  farm.farmerEnergy = 5;
  const controller = Object.assign(Object.create(GameModalsController.prototype), {
    farmAdapter: new FarmAdapter(farm),
    player: { unlock: vi.fn() },
    houseModal: { classList: { add: vi.fn() } },
    hud: { showToast: vi.fn() },
    onRestStarted: vi.fn(),
    onSleepCompleted: vi.fn(),
    openFarmerHouse: vi.fn()
  });
  return { farm, controller };
}

it('bloquea reentradas, avanza un solo día y despierta con energía completa', async () => {
  const { farm, controller } = setup();
  const first = controller.restAtHouse({ sleep: true, automatic: true });
  expect(controller.houseActionPending).toBe(true);
  await controller.restAtHouse({ sleep: true, automatic: true });
  await first;
  expect(farm.day).toBe(2);
  expect(farm.timeOfDay).toBe(WORK_START);
  expect(farm.farmerEnergy).toBe(100);
  expect(controller.onSleepCompleted).toHaveBeenCalledTimes(1);
  expect(controller.openFarmerHouse).not.toHaveBeenCalled();
  expect(controller.houseActionPending).toBe(false);
});
