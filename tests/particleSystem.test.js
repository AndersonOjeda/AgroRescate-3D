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

  it('debe permitir reubicar emisores a coordenadas GLB y regar parcelas selectivamente', () => {
    const scene = new THREE.Scene();
    const particles = new ParticleSystem(scene);
    const initialBufferRef = particles.sprinklerGeometry.attributes.position.array;

    particles.setEmitters(
      [
        { x: 10, y: 1.4, z: -10 },
        { x: -10, y: 1.4, z: -10 },
        { x: -10, y: 1.4, z: 10 }
      ],
      3.4
    );

    expect(particles.emitters[0].x).toBe(10);
    expect(particles.emitters[0].z).toBe(-10);
    expect(particles.emitters[1].x).toBe(-10);
    expect(particles.emitters[2].z).toBe(10);

    // Activar solo el emisor 1 (Parcela 2)
    particles.setSpraying(true, [1]);
    particles.update(0.016);

    expect(particles.activeEmitters).toEqual([false, true, false]);
    // Emisor 0 permanece oculto bajo el suelo (-100) y emisor 1 activo arriba (> 0)
    expect(particles.sprinklerPositions[1]).toBe(-100);
    expect(particles.sprinklerPositions[particles.particlesPerSprinkler * 3 + 1]).toBeGreaterThan(0);
    expect(particles.sprinklerGeometry.attributes.position.array).toBe(initialBufferRef);
  });
});
