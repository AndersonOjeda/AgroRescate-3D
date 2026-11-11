import * as THREE from 'three';

/**
 * Sistema de Partículas Optimizado para Riego Agrícola y Lluvia Ambiental
 * Utiliza THREE.BufferGeometry, Float32Array, THREE.Points y un sistema estricto de Pooling
 * sin ninguna asignación dinámica de memoria dentro del bucle de animación.
 */
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;

    // --- 1. SISTEMA DE RIEGO POR ASPERSIÓN ---
    this.isSpraying = false;
    this.sprinklerCount = 3;
    this.particlesPerSprinkler = 600;
    this.totalSprinklerParticles = this.sprinklerCount * this.particlesPerSprinkler;

    // Orígenes de los emisores (aspersores sobre las 3 parcelas)
    this.emitters = [
      new THREE.Vector3(-12, 1.3, 8),  // Parcela 1
      new THREE.Vector3(0, 1.3, 14),   // Parcela 2
      new THREE.Vector3(12, 1.3, 8)    // Parcela 3
    ];

    // Buffers pre-asignados
    this.sprinklerPositions = new Float32Array(this.totalSprinklerParticles * 3);
    this.sprinklerVelocities = new Float32Array(this.totalSprinklerParticles * 3);
    this.sprinklerLifetimes = new Float32Array(this.totalSprinklerParticles);
    this.sprinklerMaxLifetimes = new Float32Array(this.totalSprinklerParticles);

    this._initSprinklerParticles();

    // Geometría y Mesh de puntos para aspersores
    this.sprinklerGeometry = new THREE.BufferGeometry();
    this.sprinklerGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.sprinklerPositions, 3)
    );

    this.sprinklerMaterial = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.16,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.sprinklerPoints = new THREE.Points(this.sprinklerGeometry, this.sprinklerMaterial);
    this.sprinklerPoints.frustumCulled = false;
    this.scene.add(this.sprinklerPoints);

    // Ocultar inicialmente bajo el suelo
    this._hideSprinklerParticles();

    // --- 2. SISTEMA DE LLUVIA AMBIENTAL ---
    this.isRaining = false;
    this.rainCount = 1800;
    this.rainPositions = new Float32Array(this.rainCount * 3);
    this.rainVelocities = new Float32Array(this.rainCount);

    this._initRainParticles();

    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.rainPositions, 3)
    );

    this.rainMaterial = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.12,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });

    this.rainPoints = new THREE.Points(this.rainGeometry, this.rainMaterial);
    this.rainPoints.frustumCulled = false;
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);

    // --- 3. SISTEMA DE POLVO DE PISADAS AL DESPLAZARSE ---
    this.dustCount = 60;
    this.dustPositions = new Float32Array(this.dustCount * 3);
    this.dustVelocities = new Float32Array(this.dustCount * 3);
    this.dustLifetimes = new Float32Array(this.dustCount);
    this.dustMaxLifetimes = new Float32Array(this.dustCount);
    this.dustActive = new Uint8Array(this.dustCount);
    this.dustIndex = 0;

    for (let i = 0; i < this.dustCount; i++) {
      this.dustPositions[i * 3 + 1] = -100;
      this.dustActive[i] = 0;
    }

    this.dustGeometry = new THREE.BufferGeometry();
    this.dustGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.dustPositions, 3)
    );

    this.dustMaterial = new THREE.PointsMaterial({
      color: 0xd4a373, // Polvo ocre rural
      size: 0.18,
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    });

    this.dustPoints = new THREE.Points(this.dustGeometry, this.dustMaterial);
    this.dustPoints.frustumCulled = false;
    this.scene.add(this.dustPoints);
  }

  _initSprinklerParticles() {
    for (let s = 0; s < this.sprinklerCount; s++) {
      const emitter = this.emitters[s];
      for (let p = 0; p < this.particlesPerSprinkler; p++) {
        const idx = s * this.particlesPerSprinkler + p;
        this._resetSprinklerParticle(idx, emitter);
      }
    }
  }

  _resetSprinklerParticle(idx, emitter) {
    const p3 = idx * 3;
    // Posición inicial en el emisor
    this.sprinklerPositions[p3] = emitter.x;
    this.sprinklerPositions[p3 + 1] = emitter.y;
    this.sprinklerPositions[p3 + 2] = emitter.z;

    // Velocidad con ángulo radial y elevación parabólica
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.5 + Math.random() * 3.5;
    const upwardSpeed = 2.0 + Math.random() * 3.0;

    this.sprinklerVelocities[p3] = Math.cos(angle) * speed;
    this.sprinklerVelocities[p3 + 1] = upwardSpeed;
    this.sprinklerVelocities[p3 + 2] = Math.sin(angle) * speed;

    this.sprinklerLifetimes[idx] = 0;
    this.sprinklerMaxLifetimes[idx] = 1.0 + Math.random() * 0.8;
  }

  _hideSprinklerParticles() {
    for (let i = 0; i < this.totalSprinklerParticles; i++) {
      this.sprinklerPositions[i * 3 + 1] = -100; // Debajo del suelo
    }
    this.sprinklerGeometry.attributes.position.needsUpdate = true;
  }

  _initRainParticles() {
    for (let i = 0; i < this.rainCount; i++) {
      const i3 = i * 3;
      this.rainPositions[i3] = (Math.random() - 0.5) * 70;
      this.rainPositions[i3 + 1] = Math.random() * 35;
      this.rainPositions[i3 + 2] = (Math.random() - 0.5) * 70;
      this.rainVelocities[i] = 20 + Math.random() * 10;
    }
  }

  /**
   * Activa o desactiva el riego por aspersión
   */
  setSpraying(active) {
    this.isSpraying = active;
    if (!active) {
      this._hideSprinklerParticles();
    }
  }

  toggleSpraying() {
    this.setSpraying(!this.isSpraying);
    return this.isSpraying;
  }

  /**
   * Activa o desactiva lluvia ambiental
   */
  toggleRain() {
    this.isRaining = !this.isRaining;
    this.rainPoints.visible = this.isRaining;
    return this.isRaining;
  }

  /**
   * Genera un efecto visual de polvo sutil bajo las botas del agricultor al desplazarse
   */
  emitFootstepDust(pos) {
    if (!pos) return;
    const count = 4;
    for (let k = 0; k < count; k++) {
      const idx = this.dustIndex;
      this.dustIndex = (this.dustIndex + 1) % this.dustCount;
      const i3 = idx * 3;

      this.dustPositions[i3] = pos.x + (Math.random() - 0.5) * 0.22;
      this.dustPositions[i3 + 1] = 0.05 + Math.random() * 0.06;
      this.dustPositions[i3 + 2] = pos.z + (Math.random() - 0.5) * 0.22;

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 0.6;
      this.dustVelocities[i3] = Math.cos(angle) * speed;
      this.dustVelocities[i3 + 1] = 0.4 + Math.random() * 0.5;
      this.dustVelocities[i3 + 2] = Math.sin(angle) * speed;

      this.dustLifetimes[idx] = 0;
      this.dustMaxLifetimes[idx] = 0.35 + Math.random() * 0.2;
      this.dustActive[idx] = 1;
    }
  }

  /**
   * Actualización de partículas llamada en el bucle animate()
   * Reutiliza vectores y memoria pre-asignada sin crear objetos nuevos
   */
  update(delta) {
    const gravity = 9.81;

    // 1. Actualizar Riego
    if (this.isSpraying) {
      const posAttr = this.sprinklerGeometry.attributes.position;
      const posArray = posAttr.array;

      for (let s = 0; s < this.sprinklerCount; s++) {
        const emitter = this.emitters[s];
        const startIdx = s * this.particlesPerSprinkler;
        const endIdx = startIdx + this.particlesPerSprinkler;

        for (let i = startIdx; i < endIdx; i++) {
          const i3 = i * 3;

          this.sprinklerLifetimes[i] += delta;

          // Si alcanzó el tiempo de vida o cayó al suelo (y <= 0.05), reciclar inmediatamente
          if (
            this.sprinklerLifetimes[i] >= this.sprinklerMaxLifetimes[i] ||
            posArray[i3 + 1] <= 0.05
          ) {
            this._resetSprinklerParticle(i, emitter);
            continue;
          }

          // Aplicar gravedad parabólica hacia abajo
          this.sprinklerVelocities[i3 + 1] -= gravity * delta * 1.5;

          // Integrar posición
          posArray[i3] += this.sprinklerVelocities[i3] * delta;
          posArray[i3 + 1] += this.sprinklerVelocities[i3 + 1] * delta;
          posArray[i3 + 2] += this.sprinklerVelocities[i3 + 2] * delta;
        }
      }

      posAttr.needsUpdate = true;
    }

    // 2. Actualizar Lluvia Ambiental
    if (this.isRaining) {
      const rainPosAttr = this.rainGeometry.attributes.position;
      const rainPosArray = rainPosAttr.array;

      for (let i = 0; i < this.rainCount; i++) {
        const i3 = i * 3;
        rainPosArray[i3 + 1] -= this.rainVelocities[i] * delta;

        // Si la gota llega al suelo, reaparece en el cielo
        if (rainPosArray[i3 + 1] <= 0) {
          rainPosArray[i3 + 1] = 30 + Math.random() * 5;
          rainPosArray[i3] = (Math.random() - 0.5) * 70;
          rainPosArray[i3 + 2] = (Math.random() - 0.5) * 70;
        }
      }

      rainPosAttr.needsUpdate = true;
    }

    // 3. Actualizar Polvo de Pisadas
    let dustNeedsUpdate = false;
    for (let i = 0; i < this.dustCount; i++) {
      if (this.dustActive[i]) {
        this.dustLifetimes[i] += delta;
        const i3 = i * 3;

        if (this.dustLifetimes[i] >= this.dustMaxLifetimes[i]) {
          this.dustActive[i] = 0;
          this.dustPositions[i3 + 1] = -100;
          dustNeedsUpdate = true;
          continue;
        }

        this.dustVelocities[i3 + 1] -= gravity * delta * 0.6;
        this.dustPositions[i3] += this.dustVelocities[i3] * delta;
        this.dustPositions[i3 + 1] += this.dustVelocities[i3 + 1] * delta;
        this.dustPositions[i3 + 2] += this.dustVelocities[i3 + 2] * delta;
        dustNeedsUpdate = true;
      }
    }
    if (dustNeedsUpdate) {
      this.dustGeometry.attributes.position.needsUpdate = true;
    }
  }
}
