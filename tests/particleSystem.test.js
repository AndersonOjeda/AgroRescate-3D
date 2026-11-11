import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ParticleSystem } from '../src/systems/particleSystem.js';

describe('ParticleSystem — Riego por Aspersión y Pooling', () => {
  it('debe inicializar buffers con Float32Array y reutilizar memoria', () => {
    const scene = new THREE.Scene();
    const particles = new ParticleSystem(scene);

    expect(particles.sprinklerPositions instanceof Float32Array).toBe(true);
    expect(particles.sprinklerVelocities instanceof Float32Array).toBe(true);
    expect(particles.totalSprinklerParticles).toBe(1800); // 3 aspersores * 600

    // Por defecto apagado
    expect(particles.isSpraying).toBe(false);

    // Activar riego
    particles.setSpraying(true);
    expect(particles.isSpraying).toBe(true);

    // Simular 10 frames de animación
    const initialBufferRef = particles.sprinklerGeometry.attributes.position.array;
    for (let i = 0; i < 10; i++) {
      particles.update(0.016);
    }

    // La referencia del buffer no debe cambiar (reutilización estricta sin asignaciones dinámicas)
    expect(particles.sprinklerGeometry.attributes.position.array).toBe(initialBufferRef);
  });

  it('debe permitir alternar lluvia ambiental', () => {
    const scene = new THREE.Scene();
    const particles = new ParticleSystem(scene);

    expect(particles.isRaining).toBe(false);
    particles.toggleRain();
    expect(particles.isRaining).toBe(true);
    expect(particles.rainPoints.visible).toBe(true);
  });
});
