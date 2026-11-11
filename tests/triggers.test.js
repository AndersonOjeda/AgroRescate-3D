import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { TriggerSystem } from '../src/systems/triggerSystem.js';

describe('TriggerSystem — Triggers Radiales y AABB', () => {
  it('debe detectar entrada y salida con trigger radial (Vector3.distanceTo)', () => {
    const triggerSystem = new TriggerSystem();
    const onEnter = vi.fn();
    const onExit = vi.fn();

    triggerSystem.addRadialTrigger({
      id: 'test_pump',
      name: 'Bomba',
      center: { x: 0, y: 0, z: 0 },
      radius: 5.0,
      onEnter,
      onExit
    });

    // 1. Jugador lejos (x: 10) -> Fuera
    let zones = triggerSystem.update(new THREE.Vector3(10, 0, 0));
    expect(zones.length).toBe(0);
    expect(onEnter).not.toHaveBeenCalled();

    // 2. Jugador entra a la zona (x: 3) -> Entrada
    zones = triggerSystem.update(new THREE.Vector3(3, 0, 0));
    expect(zones).toContain('Bomba');
    expect(onEnter).toHaveBeenCalledTimes(1);

    // 3. Jugador permanece adentro (x: 2) -> No repite onEnter
    zones = triggerSystem.update(new THREE.Vector3(2, 0, 0));
    expect(zones).toContain('Bomba');
    expect(onEnter).toHaveBeenCalledTimes(1);

    // 4. Jugador sale (x: 8) -> Salida
    zones = triggerSystem.update(new THREE.Vector3(8, 0, 0));
    expect(zones.length).toBe(0);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('debe detectar entrada y salida con trigger AABB (Box3)', () => {
    const triggerSystem = new TriggerSystem();
    const onEnter = vi.fn();
    const onExit = vi.fn();

    triggerSystem.addAABBTrigger({
      id: 'test_warehouse',
      name: 'Almacén',
      min: [10, 0, 10],
      max: [20, 5, 20],
      onEnter,
      onExit
    });

    // 1. Jugador fuera (0, 0, 0)
    let zones = triggerSystem.update(new THREE.Vector3(0, 0, 0));
    expect(zones.length).toBe(0);
    expect(onEnter).not.toHaveBeenCalled();

    // 2. Jugador entra a la caja (15, 1, 15)
    zones = triggerSystem.update(new THREE.Vector3(15, 1, 15));
    expect(zones).toContain('Almacén');
    expect(onEnter).toHaveBeenCalledTimes(1);

    // 3. Jugador sale de la caja (25, 1, 15)
    zones = triggerSystem.update(new THREE.Vector3(25, 1, 15));
    expect(zones.length).toBe(0);
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
