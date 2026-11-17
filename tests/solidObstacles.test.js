import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { PlayerController } from '../src/player/playerController.js';
import { PhysicsWorld } from '../src/physics/physicsWorld.js';

function fixture() {
  const scene = new THREE.Scene();
  const player = new PlayerController(new THREE.PerspectiveCamera(), null, scene);
  player.setObstacles([], { minX: -20, maxX: 20, minZ: -20, maxZ: 20 });
  player.setPosition(0, 0, 2);
  player.cameraYaw = 0;
  player.keys.forward = true;
  return { player, scene };
}

describe('Obstáculos sólidos y locomoción', () => {
  it('sube automáticamente a camas transitables, reduce la marcha y vuelve al suelo al salir', () => {
    const { player } = fixture();
    player.addObstacle({ walkable: true, type: 'box', height: 0.3, minX: -3, maxX: 3, minZ: -8, maxZ: 1 });
    expect(player.isColliding(0, 0)).toBe(false);
    for (let i = 0; i < 40; i++) player.update(0.016);
    expect(player.getGroundHeight()).toBe(0.3);
    expect(player.position.y).toBeCloseTo(0.3, 2);
    const before = player.position.z;
    player.update(0.1);
    expect(before - player.position.z).toBeCloseTo(player.walkSpeed * 0.75 * 0.1, 3);
    for (let i = 0; i < 240; i++) player.update(0.016);
    expect(player.getGroundHeight()).toBe(0);
    expect(player.position.y).toBeCloseTo(0, 2);
  });
  it('un obstáculo alto no se convierte en escalón por tener la marca transitable', () => {
    const { player } = fixture();
    player.addObstacle({ walkable: true, type: 'box', height: 2, minX: -3, maxX: 3, minZ: -3, maxZ: 0 });
    expect(player.isColliding(0, -1)).toBe(true);
    expect(player.getGroundHeight(0, -1)).toBe(0);
  });
  it('no atraviesa bordes delgados con pasos largos y deja de emitir pisadas al bloquearse', () => {
    const { player } = fixture();
    player.addObstacle({ type: 'box', minX: -3, maxX: 3, minZ: 0, maxZ: 0.05 });
    for (let i = 0; i < 10; i++) player.update(0.25);
    expect(player.position.z).toBeGreaterThanOrEqual(0.05 + player.radius);
    player.onFootstep = vi.fn();
    for (let i = 0; i < 20; i++) player.update(0.016);
    expect(player.onFootstep).not.toHaveBeenCalled();
    expect(player.movementRatio).toBe(0);
  });
  it('las cajas giradas bloquean al personaje y las cajas altas no crean paredes invisibles', () => {
    const { player, scene } = fixture();
    const physics = new PhysicsWorld(scene);
    const crate = physics.createCrate({ id: 'test', x: 0, y: 0.5, z: 0 });
    crate.body.quaternion.setFromEuler(0, Math.PI / 4, 0);
    player.obstacles.push(...physics.getPlayerObstacles());
    for (let i = 0; i < 20; i++) player.update(0.1);
    expect(player.position.z).toBeGreaterThan(0.9);
    crate.body.position.y = 5;
    expect(physics.getPlayerObstacles()).toHaveLength(0);
    crate.body.position.y = 0.5;
    crate.body.position.x = 5;
    expect(physics.getPlayerObstacles()[0].minX).toBeGreaterThan(4);
  });
  it('una cama elevada bloquea su perímetro y el interior, conservando acceso desde fuera', () => {
    const { player } = fixture();
    player.addObstacle({ type: 'box', minX: -3.65, maxX: 3.65, minZ: -7.65, maxZ: -0.35 });
    for (let i = 0; i < 20; i++) player.update(0.1);
    expect(player.position.z).toBeGreaterThanOrEqual(-0.35 + player.radius);
    expect(player.isColliding(0, -4)).toBe(true);
    expect(player.isColliding(5, -4)).toBe(false);
  });
});
