import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { InteractionSystem } from '../src/systems/interactionSystem.js';
import { FarmSimulation } from '../src/simulation/farmSimulation.js';

describe('InteractionSystem — Esfuerzo Físico Campesino (Hold [E])', () => {
  it('no permite saltarse el esfuerzo mediante la interacción directa ni reiniciarlo', () => {
    const sys = new InteractionSystem();
    const done = vi.fn();
    sys.register({ id: 'labor', name: 'Faena', position: { x: 0, z: 0 }, holdDuration: 2, onInteract: done });
    sys.update(new THREE.Vector3());
    sys.triggerInteraction();
    expect(done).not.toHaveBeenCalled();
    sys.update(new THREE.Vector3(), 1);
    sys.startHold();
    expect(sys.holdTimer).toBe(1);
    sys.canInteract = () => false;
    sys.update(new THREE.Vector3(), 2);
    expect(sys.isHolding).toBe(false);
    expect(done).not.toHaveBeenCalled();
  });

  it('permite cancelar desde onHoldStart sin publicar un progreso fantasma', () => {
    const sys = new InteractionSystem();
    sys.register({ id: 'labor', position: { x: 0, z: 0 }, holdDuration: 2, onHoldStart: () => sys.stopHold(true) });
    sys.update(new THREE.Vector3());
    expect(sys.startHold()).toBe(false);
    expect(sys.holdingInteractable).toBeNull();
  });
  it('ejecuta inmediatamente las interacciones instantáneas (holdDuration: 0)', () => {
    const sys = new InteractionSystem();
    const onInteract = vi.fn();

    sys.register({
      id: 'interact_store',
      name: 'Tienda Campesina',
      position: { x: 0, y: 0, z: 0 },
      holdDuration: 0,
      onInteract
    });

    sys.update(new THREE.Vector3(0, 0, 0));
    expect(sys.getCurrentInteractable()?.id).toBe('interact_store');

    sys.startHold();
    expect(onInteract).toHaveBeenCalledTimes(1);
    expect(sys.isHolding).toBe(false);
  });

  it('requiere sostener la acción física continua para labranza pesada (holdDuration > 0)', () => {
    const sys = new InteractionSystem();
    const onHoldStart = vi.fn();
    const onHoldCancel = vi.fn();
    const onInteract = vi.fn();
    const onHoldProgress = vi.fn();
    sys.onHoldProgress = onHoldProgress;

    sys.register({
      id: 'interact_plot_1',
      name: 'Parcela 1',
      position: { x: 0, y: 0, z: 0 },
      holdDuration: 1.5,
      onHoldStart,
      onHoldCancel,
      onInteract
    });

    sys.update(new THREE.Vector3(0, 0, 0));
    sys.startHold();

    expect(sys.isHolding).toBe(true);
    expect(onHoldStart).toHaveBeenCalledTimes(1);
    expect(onInteract).not.toHaveBeenCalled();

    // Simular avance de 0.6s (40% de progreso)
    sys.update(new THREE.Vector3(0, 0, 0), 0.6);
    expect(sys.isHolding).toBe(true);
    expect(onInteract).not.toHaveBeenCalled();

    // El jugador suelta la tecla antes de tiempo (interrupción)
    sys.stopHold(true);
    expect(sys.isHolding).toBe(false);
    expect(onHoldCancel).toHaveBeenCalledTimes(1);
    expect(onInteract).not.toHaveBeenCalled();

    // El jugador vuelve a sostener hasta el 100%
    sys.startHold();
    sys.update(new THREE.Vector3(0, 0, 0), 1.6); // supera los 1.5s
    expect(onInteract).toHaveBeenCalledTimes(1);
    expect(sys.isHolding).toBe(false);
  });
});

describe('Fatiga y Desgaste Físico del Campesino', () => {
  it('impide labrar el suelo si el campesino está exhausto (<20 energía)', () => {
    const sim = new FarmSimulation('subsistence');
    expect(sim.farmerEnergy).toBe(100);

    // Agotar energía
    sim.farmerEnergy = 10;
    const res = sim.prepareSoil('plot_1');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/fuerzas|exhausto/i);

    // Descansar en Casa Campesina con agua de panela
    const restRes = sim.restAtFarmerHouse();
    expect(restRes.success).toBe(true);
    expect(sim.farmerEnergy).toBe(100);

    // Ahora sí puede labrar
    const prepRes = sim.prepareSoil('plot_1');
    expect(prepRes.success).toBe(true);
    expect(sim.farmerEnergy).toBe(80);
  });
});
