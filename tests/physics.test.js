import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PhysicsWorld } from '../src/physics/physicsWorld.js';

describe('PhysicsWorld — Simulación Física con Cannon-es', () => {
  it('debe configurar gravedad -9.81 y suelo estático', () => {
    const scene = new THREE.Scene();
    const physics = new PhysicsWorld(scene);

    expect(physics.world.gravity.y).toBe(-9.81);
    expect(physics.groundBody).toBeDefined();
    expect(physics.groundBody.mass).toBe(0); // Estático
  });

  it('debe crear cajas dinámicas y sincronizar posición bajo gravedad', () => {
    const scene = new THREE.Scene();
    const physics = new PhysicsWorld(scene);

    const crate = physics.createCrate({
      id: 'test_box',
      x: 0,
      y: 10,
      z: 0,
      mass: 5
    });

    expect(crate.body.mass).toBe(5);
    expect(crate.mesh.position.y).toBe(10);

    // Ejecutar pasos de simulación física con paso fijo
    for (let i = 0; i < 30; i++) {
      physics.step(1 / 60);
    }

    // La caja debe haber caído por gravedad
    expect(crate.body.position.y).toBeLessThan(10);
    // El mesh de Three.js debe sincronizarse con el body de Cannon
    expect(crate.mesh.position.y).toBeCloseTo(crate.body.position.y, 4);
  });
});
