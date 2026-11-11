import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PlayerController } from '../src/player/playerController.js';
import { GLB_OBSTACLES, GLB_BOUNDS, PROCEDURAL_OBSTACLES, PROCEDURAL_BOUNDS } from '../src/world/farmLoader.js';
import { PhysicsWorld } from '../src/physics/physicsWorld.js';

describe('PlayerController — Colisiones contra Paredes y Estructuras', () => {
  it('no debe colisionar en espacios abiertos transitables', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(camera, null, scene);

    // Patio central abierto
    expect(player.isColliding(0, -2)).toBe(false);
    expect(player.isColliding(0, 4)).toBe(false);
  });

  it('debe bloquear la entrada a las paredes de la Casa Rural', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(camera, null, scene);

    // Casa Rural está centrada en (-16, -14)
    expect(player.isColliding(-16, -14)).toBe(true);
    // Borde de la pared con el radio del jugador
    expect(player.isColliding(-12.5, -14)).toBe(true);
  });

  it('debe bloquear la entrada a las paredes del Granero', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(camera, null, scene);

    // Granero está centrado en (16, -14)
    expect(player.isColliding(16, -14)).toBe(true);
    expect(player.isColliding(14, -14)).toBe(true);
  });

  it('debe bloquear colisión contra el Tanque y la Bomba de Agua', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(camera, null, scene);

    expect(player.isColliding(-4, -4)).toBe(true); // Tanque
    expect(player.isColliding(-3, -3)).toBe(true); // Bomba
  });

  it('no debe permitir atravesar una pared al actualizar movimiento hacia ella', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(camera, null, scene);

    // Ubicamos al jugador justo al frente de la casa rural en Z = -9.5 (la pared está en Z <= -10.6)
    player.setPosition(-16, 0, -9.5);
    expect(player.isColliding(-16, -9.5)).toBe(false);

    // Simulamos presionar 'forward' avanzando hacia el norte (hacia la casa rural)
    player.keys.forward = true;
    player.cameraYaw = 0; // Mirando hacia -Z

    // Intentamos avanzar hacia la pared con varios pasos de tiempo
    for (let i = 0; i < 20; i++) {
      player.update(0.016);
    }

    // La posición Z del jugador NUNCA debe cruzar dentro de la pared de la casa
    expect(player.position.z).toBeGreaterThan(-10.7);
    expect(player.isColliding(player.position.x, player.position.z)).toBe(false);
  });

  it('debe permitir deslizamiento lateral (Wall Sliding) al chocar en ángulo contra una pared', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(camera, null, scene);

    // Ubicar al jugador frente a la casa
    player.setPosition(-16, 0, -10.0);

    // Intentar mover diagonalmente: hacia adelante (bloqueado por la casa) y hacia la derecha (libre)
    player.keys.forward = true;
    player.keys.right = true;
    player.cameraYaw = 0;

    const initialX = player.position.x;
    for (let i = 0; i < 15; i++) {
      player.update(0.016);
    }

    // Z debe haber quedado frenado por la pared, pero X debe haberse deslizado hacia la derecha
    expect(player.position.x).toBeGreaterThan(initialX);
    expect(player.position.z).toBeGreaterThan(-10.7);
  });

  it('debe colisionar con precisión contra los modelos GLB de Blender (casa_rural, almacen, tanque)', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(camera, null, scene);

    // Inyectar obstáculos del modelo GLB de Blender
    player.setObstacles(GLB_OBSTACLES, GLB_BOUNDS);

    // 1. Casa Rural en GLB está centrada en (7.3, 9.4)
    expect(player.isColliding(7.3, 9.4)).toBe(true);
    // Borde de la pared de la casa
    expect(player.isColliding(5.0, 9.4)).toBe(true);

    // 2. Almacén de Cosecha en GLB está centrado en (14.0, 9.4)
    expect(player.isColliding(14.0, 9.4)).toBe(true);
    expect(player.isColliding(12.0, 9.4)).toBe(true);

    // 3. Tanque de Agua en GLB (13.25, 15.7)
    expect(player.isColliding(13.25, 15.7)).toBe(true);

    // 4. Bomba de Agua en GLB (6.5, 15.6)
    expect(player.isColliding(6.5, 15.6)).toBe(true);

    // 5. Compostera en GLB (-4.6, 15.1)
    expect(player.isColliding(-4.6, 15.1)).toBe(true);

    // 6. Límites perimetrales del terreno GLB (finca2: X[-19.2..22.2], Z[-21.5..18.0])
    expect(player.isColliding(23.0, 0)).toBe(true);
    expect(player.isColliding(-19.5, 0)).toBe(true);
    expect(player.isColliding(0, 19.5)).toBe(true);
    expect(player.isColliding(0, -22.5)).toBe(true);

    // 7. Área despejada transitable en GLB
    expect(player.isColliding(0, 0)).toBe(false);
    expect(player.isColliding(0, 17.7)).toBe(false); // Spawn
  });

  it('no debe permitir penetrar las paredes del modelo GLB de Blender en movimiento frontal', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const player = new PlayerController(camera, null, scene);

    player.setObstacles(GLB_OBSTACLES, GLB_BOUNDS);

    // Situamos al jugador frente a la casa_rural de GLB (Z=6.5, la pared frontal empieza en Z=7.05 con radio)
    player.setPosition(7.3, 0, 6.5);
    expect(player.isColliding(7.3, 6.5)).toBe(false);

    // Mirando hacia +Z (hacia la casa rural)
    player.cameraYaw = Math.PI; // Mirando hacia +Z
    player.keys.forward = true;

    for (let i = 0; i < 30; i++) {
      player.update(0.016);
    }

    // La posición Z NUNCA debe haber ingresado dentro de la casa (Z <= 6.85)
    expect(player.position.z).toBeLessThan(7.0);
    expect(player.isColliding(player.position.x, player.position.z)).toBe(false);
  });

  it('debe actualizar los cuerpos estáticos de Cannon-es con PhysicsWorld.setObstacles()', () => {
    const scene = new THREE.Scene();
    const physicsWorld = new PhysicsWorld(scene);

    expect(physicsWorld.staticObstacleBodies.length).toBe(2);

    physicsWorld.setObstacles(GLB_OBSTACLES);
    // Debe haber registrado todos los obstáculos de GLB como cuerpos físicos estáticos
    expect(physicsWorld.staticObstacleBodies.length).toBe(GLB_OBSTACLES.length);
  });
});
