import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PlayerController } from '../src/player/playerController.js';

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
});
