import * as THREE from 'three';

/**
 * WeatherSystem — Sistema Climático Dinámico y Atmosférico de AgroRescate 3D.
 * Gestiona lluvia estilizada ligada a la cámara, relámpagos controlados,
 * interpolación de cielo/luces y niebla andina, optimizado para celulares Android.
 */
export class WeatherSystem {
  constructor({ scene, camera, sunLight, hemiLight, ambientLight, particleSystem, audioSystem }) {
    this.scene = scene;
    this.camera = camera;
    this.sunLight = sunLight;
    this.hemiLight = hemiLight;
    this.ambientLight = ambientLight;
    this.particleSystem = particleSystem;
    this.audioSystem = audioSystem;

    this.currentWeather = 'clear'; // 'clear' | 'cloudy' | 'rain' | 'storm' | 'heatwave' | 'frost'
    this.targetWeather = 'clear';
    this.weatherTime = 0;
    this.windIntensity = 0.2;
    this.isLightningActive = false;
    this.lightningTimer = 0;
    this.nextLightningTime = 6 + Math.random() * 8;

    // Colores base de cielo y luz por clima
    this.weatherPresets = {
      clear: {
        sky: new THREE.Color(0xa0d8ef),
        fog: new THREE.Color(0xa0d8ef),
        sun: new THREE.Color(0xfff7e6),
        sunIntensity: 1.35,
        ambientIntensity: 0.55,
        wind: 0.2,
        rain: false
      },
      cloudy: {
        sky: new THREE.Color(0x8899a6),
        fog: new THREE.Color(0x94a3b8),
        sun: new THREE.Color(0xced8e0),
        sunIntensity: 0.8,
        ambientIntensity: 0.65,
        wind: 0.45,
        rain: false
      },
      rain: {
        sky: new THREE.Color(0x5a6d7c),
        fog: new THREE.Color(0x64748b),
        sun: new THREE.Color(0x94a3b8),
        sunIntensity: 0.45,
        ambientIntensity: 0.5,
        wind: 0.7,
        rain: true
      },
      storm: {
        sky: new THREE.Color(0x2d3748),
        fog: new THREE.Color(0x334155),
        sun: new THREE.Color(0x64748b),
        sunIntensity: 0.25,
        ambientIntensity: 0.35,
        wind: 1.0,
        rain: true
      },
      heatwave: {
        sky: new THREE.Color(0xfbcfe8),
        fog: new THREE.Color(0xfed7aa),
        sun: new THREE.Color(0xffedd5),
        sunIntensity: 1.6,
        ambientIntensity: 0.6,
        wind: 0.15,
        rain: false
      },
      frost: {
        sky: new THREE.Color(0xc7d2fe),
        fog: new THREE.Color(0xe0e7ff),
        sun: new THREE.Color(0xe0e7ff),
        sunIntensity: 1.1,
        ambientIntensity: 0.65,
        wind: 0.3,
        rain: false
      }
    };

    // Luz de relámpago temporal (sólo se enciende por microsegundos)
    this.lightningLight = new THREE.DirectionalLight(0xe0f2fe, 0);
    this.lightningLight.position.set(0, 50, 0);
    this.scene.add(this.lightningLight);

    // Sistema de lluvia estilizada ligada a la cámara (volumen local de 24x24x18m)
    this.rainDropCount = 550; // Ligero y fluido para móviles
    this.rainGeo = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainDropCount * 3);
    this.rainVelocities = new Float32Array(this.rainDropCount);

    for (let i = 0; i < this.rainDropCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 26;
      this.rainPositions[i * 3 + 1] = Math.random() * 16;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 26;
      this.rainVelocities[i] = 18 + Math.random() * 12;
    }

    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.18,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });

    this.rainPoints = new THREE.Points(this.rainGeo, this.rainMat);
    this.rainPoints.frustumCulled = false;
    this.scene.add(this.rainPoints);
  }

  setWeather(weatherKey, immediate = false) {
    if (weatherKey === 'flood') weatherKey = 'storm';
    const key = (weatherKey || 'clear').toLowerCase();
    if (!this.weatherPresets[key]) return;
    this.targetWeather = key;
    if (immediate) {
      this.currentWeather = key;
      this._applyPresetInstant(this.weatherPresets[key]);
    }
  }

  _applyPresetInstant(p) {
    if (this.scene.background) this.scene.background.copy(p.sky);
    if (this.scene.fog) this.scene.fog.color.copy(p.fog);
    if (this.sunLight) {
      this.sunLight.color.copy(p.sun);
      this.sunLight.intensity = p.sunIntensity;
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = p.ambientIntensity;
    }
    this.windIntensity = p.wind;
    this.rainMat.opacity = p.rain ? 0.75 : 0.0;
  }

  update(delta, options = {}) {
    this.weatherTime += delta;

    // Interpolación suave hacia el clima objetivo
    const targetP = this.weatherPresets[this.targetWeather] || this.weatherPresets.clear;
    const lerpSpeed = 1 - Math.exp(-Math.max(0, delta) * 1.5);
    const overcastTargets = { clear: 0, heatwave: 0, drought: 0.12, frost: 0.28, cloudy: 0.45, rain: 0.72, storm: 0.95 };
    const stormTargets = { clear: 0, heatwave: 0, drought: 0, frost: 0, cloudy: 0.12, rain: 0.45, storm: 0.95 };
    this._overcastBlend = THREE.MathUtils.lerp(this._overcastBlend || 0, overcastTargets[this.targetWeather] ?? 0, lerpSpeed);
    this._stormBlend = THREE.MathUtils.lerp(this._stormBlend || 0, stormTargets[this.targetWeather] ?? 0, lerpSpeed);

    if (options.skySystem && typeof options.skySystem.setWeatherDynamics === 'function') {
      options.skySystem.setWeatherDynamics({
        overcast: this._overcastBlend,
        storminess: this._stormBlend,
        wind: this.windIntensity
      });
    }

    if (options.preserveDayCycle) {
      // Cuando el ciclo Mañana/Mediodía/Tarde/Noche está activo, solo matizamos la atmósfera
      // para climas nublados/lluviosos sin borrar la noche ni el atardecer.
      if (this._overcastBlend > 0.01) {
        if (this.scene.background && this.scene.background.isColor) {
          this.scene.background.lerp(targetP.sky, this._overcastBlend * 0.45);
        }
        if (this.scene.fog && this.scene.fog.color) {
          this.scene.fog.color.lerp(targetP.fog, this._overcastBlend * 0.50);
        }
        if (this.sunLight) {
          this.sunLight.intensity *= (1 - this._overcastBlend * 0.55);
        }
      }
    } else {
      if (this.scene.background && this.scene.background.isColor) {
        this.scene.background.lerp(targetP.sky, lerpSpeed);
      }
      if (this.scene.fog && this.scene.fog.color) {
        this.scene.fog.color.lerp(targetP.fog, lerpSpeed);
      }
      if (this.sunLight) {
        this.sunLight.color.lerp(targetP.sun, lerpSpeed);
        this.sunLight.intensity = THREE.MathUtils.lerp(this.sunLight.intensity, targetP.sunIntensity, lerpSpeed);
      }
      if (this.ambientLight) {
        this.ambientLight.intensity = THREE.MathUtils.lerp(this.ambientLight.intensity, targetP.ambientIntensity, lerpSpeed);
      }
    }
    this.windIntensity = THREE.MathUtils.lerp(this.windIntensity, targetP.wind, lerpSpeed);

    // Lluvia ligada a la cámara
    const targetRainOpacity = targetP.rain ? (this.targetWeather === 'storm' ? 0.95 : 0.65) : 0.0;
    this.rainMat.opacity = THREE.MathUtils.lerp(this.rainMat.opacity, targetRainOpacity, 1 - Math.exp(-Math.max(0, delta) * 3));

    if (this.rainMat.opacity > 0.02) {
      this._updateRainDrops(delta);
    }

    // Efectos de tormenta (relámpagos ocasionales)
    if (this.targetWeather === 'storm') {
      this._updateLightning(delta);
    } else if (this.lightningLight.intensity > 0) {
      this.lightningLight.intensity = 0;
    }
  }

  _updateRainDrops(delta) {
    const camPos = this.camera ? this.camera.position : { x: 0, y: 2, z: 0 };
    const pos = this.rainPositions;
    const vel = this.rainVelocities;
    const count = this.rainDropCount;
    const windX = Math.sin(this.weatherTime * 1.8) * this.windIntensity * 4.0;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      pos[idx + 1] -= vel[i] * delta;
      pos[idx] += windX * delta;

      // Si cae debajo del suelo relativo a la cámara, reubicar arriba
      if (pos[idx + 1] < 0 || Math.abs(pos[idx] - camPos.x) > 14 || Math.abs(pos[idx + 2] - camPos.z) > 14) {
        pos[idx] = camPos.x + (Math.random() - 0.5) * 24;
        pos[idx + 1] = camPos.y + 10 + Math.random() * 5;
        pos[idx + 2] = camPos.z + (Math.random() - 0.5) * 24;
      }
    }
    this.rainGeo.attributes.position.needsUpdate = true;
  }

  _updateLightning(delta) {
    this.lightningTimer += delta;
    if (this.lightningTimer >= this.nextLightningTime) {
      this.lightningTimer = 0;
      this.nextLightningTime = 7 + Math.random() * 10;
      this.isLightningActive = true;

      // Destello de 2 fases (flash doble)
      this.lightningLight.intensity = 2.8;
      if (this.scene.background && this.scene.background.isColor) {
        this.scene.background.setHex(0xdbeafe);
      }

      setTimeout(() => {
        this.lightningLight.intensity = 0.4;
        setTimeout(() => {
          this.lightningLight.intensity = 2.2;
          setTimeout(() => {
            this.lightningLight.intensity = 0;
            this.isLightningActive = false;
          }, 80);
        }, 60);
      }, 70);
    }
  }

  dispose() {
    if (this.rainGeo) this.rainGeo.dispose();
    if (this.rainMat) this.rainMat.dispose();
    if (this.rainPoints) this.scene.remove(this.rainPoints);
    if (this.lightningLight) this.scene.remove(this.lightningLight);
  }
}
