import * as THREE from 'three';

const DAY_SKY = new THREE.Color(0xa0d8ef);
const SUNSET_SKY = new THREE.Color(0xf59e6b);
const NIGHT_SKY = new THREE.Color(0x0b132b);
const DAWN_SKY = new THREE.Color(0xfca58a);

const DAY_FOG = new THREE.Color(0xa0d8ef);
const SUNSET_FOG = new THREE.Color(0xfdba74);
const NIGHT_FOG = new THREE.Color(0x0f172a);
const DAWN_FOG = new THREE.Color(0xfecdd3);

const DAY_CLOUD = new THREE.Color(0xffffff);
const SUNSET_CLOUD = new THREE.Color(0xffd6ba);
const NIGHT_CLOUD = new THREE.Color(0x334155);
const DAWN_CLOUD = new THREE.Color(0xfde2e4);

const DAY_SUN = new THREE.Color(0xfff7e6);
const SUNSET_SUN = new THREE.Color(0xff8c42);
const MOON_COLOR = new THREE.Color(0x93c5fd);
const DAWN_SUN = new THREE.Color(0xfdba74);

const DAY_HEMI_SKY = new THREE.Color(0xffffff);
const NIGHT_HEMI_SKY = new THREE.Color(0x334155);

/**
 * Sistema de Cielo, Nubes Low-Poly y Ciclo Día-Noche-Día para AgroRescate 3D.
 * Anima una transición atmosférica completa (Atardecer -> Noche estrellada -> Amanecer -> Día)
 * cada vez que el jugador avanza de día virtual, sin asignaciones dinámicas en update().
 */
export class SkySystem {
  constructor({ scene, sunLight, hemiLight, ambientLight }) {
    this.scene = scene;
    this.sunLight = sunLight;
    this.hemiLight = hemiLight;
    this.ambientLight = ambientLight;

    this.isTransitioning = false;
    this.cycleProgress = 0;
    this.cycleDuration = 3.8; // Segundos del ciclo rápido manual (dormir / botón avanzar)
    this.phaseName = 'Día';

    // Ciclo natural continuo (Mañana -> Mediodía -> Tarde -> Noche)
    this.autoCycleEnabled = false;
    this.dayLengthSeconds = 48; // 48s reales = 1 día completo (12s por fase)
    this.timeOfDay = 0.08;      // 0..1 (0.00-0.25 Mañana, 0.25-0.50 Mediodía, 0.50-0.75 Tarde, 0.75-1.00 Noche)
    this.onDayComplete = null;

    // Colores temporales reutilizables (cero garbage collection en update)
    this._tmpSky = new THREE.Color();
    this._tmpFog = new THREE.Color();
    this._tmpCloud = new THREE.Color();
    this._tmpSun = new THREE.Color();
    this._tmpHemi = new THREE.Color();

    this.clouds = [];
    this.cloudMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92
    });

    this.skyGroup = new THREE.Group();
    this.skyGroup.name = 'sky_atmosphere';
    this.scene.add(this.skyGroup);

    this._createClouds();
    this._createMoonAndStars();
  }

  _createClouds() {
    const puffGeo = new THREE.IcosahedronGeometry(1.0, 1);
    const cloudConfigs = [
      { x: -38, y: 24, z: -26, scale: 2.3, speed: 1.1 },
      { x: -16, y: 27, z: -34, scale: 2.8, speed: 0.85 },
      { x: 10, y: 25, z: -28, scale: 2.1, speed: 1.25 },
      { x: 34, y: 28, z: -20, scale: 2.6, speed: 0.95 },
      { x: -42, y: 26, z: 6, scale: 2.4, speed: 1.05 },
      { x: -10, y: 29, z: 12, scale: 2.9, speed: 0.78 },
      { x: 22, y: 25, z: 8, scale: 2.0, speed: 1.3 },
      { x: 44, y: 27, z: 22, scale: 2.5, speed: 0.9 },
      { x: -24, y: 24, z: 32, scale: 2.2, speed: 1.15 },
      { x: 8, y: 28, z: 36, scale: 2.7, speed: 0.82 }
    ];

    const puffOffsets = [
      [0, 0, 0, 1.35, 0.85, 1.0],
      [-1.15, -0.15, 0.15, 1.0, 0.72, 0.88],
      [1.15, -0.1, -0.1, 1.05, 0.75, 0.9],
      [0.2, 0.45, 0.1, 0.95, 0.72, 0.85]
    ];

    for (const cfg of cloudConfigs) {
      const cloudGroup = new THREE.Group();
      for (const [ox, oy, oz, sx, sy, sz] of puffOffsets) {
        const puff = new THREE.Mesh(puffGeo, this.cloudMaterial);
        puff.position.set(ox, oy, oz);
        puff.scale.set(sx, sy, sz);
        cloudGroup.add(puff);
      }
      cloudGroup.position.set(cfg.x, cfg.y, cfg.z);
      cloudGroup.scale.setScalar(cfg.scale);

      this.skyGroup.add(cloudGroup);
      this.clouds.push({
        group: cloudGroup,
        speed: cfg.speed,
        baseY: cfg.y,
        phase: cfg.x * 0.1
      });
    }
  }

  _createMoonAndStars() {
    // Luna low-poly brillante para la fase nocturna
    const moonGeo = new THREE.IcosahedronGeometry(2.6, 1);
    this.moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0,
      fog: false
    });
    this.moonMesh = new THREE.Mesh(moonGeo, this.moonMaterial);
    this.moonMesh.position.set(-22, 34, -22);
    this.moonMesh.visible = false;
    this.skyGroup.add(this.moonMesh);

    // Campo de estrellas
    const starCount = 260;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      // Distribución determinista en domo superior
      const theta = ((i * 137.5) % 360) * (Math.PI / 180);
      const radius = 58 + (i % 15);
      const height = 22 + ((i * 19) % 36);
      starPositions[i * 3] = Math.cos(theta) * radius;
      starPositions[i * 3 + 1] = height;
      starPositions[i * 3 + 2] = Math.sin(theta) * radius;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xf8fafc,
      size: 0.45,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false
    });
    this.starsPoints = new THREE.Points(starGeo, this.starMaterial);
    this.starsPoints.visible = false;
    this.skyGroup.add(this.starsPoints);
  }

  /**
   * Activa o desactiva el ciclo natural continuo (Mañana -> Mediodía -> Tarde -> Noche).
   * @param {boolean} enabled
   * @param {{ dayLengthSeconds?: number, startTimeOfDay?: number, onDayComplete?: Function }} [options]
   */
  setAutoCycle(enabled, options = {}) {
    this.autoCycleEnabled = Boolean(enabled);
    if (typeof options.dayLengthSeconds === 'number' && options.dayLengthSeconds > 0) {
      this.dayLengthSeconds = options.dayLengthSeconds;
    }
    if (typeof options.startTimeOfDay === 'number') {
      this.timeOfDay = ((options.startTimeOfDay % 1) + 1) % 1;
    }
    if (typeof options.onDayComplete === 'function') {
      this.onDayComplete = options.onDayComplete;
    }
    if (this.autoCycleEnabled && !this.isTransitioning) {
      this._applyTimeOfDay(this.timeOfDay);
    }
  }

  /**
   * Inicia la transición animada Atardecer -> Noche -> Amanecer -> Día.
   */
  triggerDayNightCycle() {
    this.isTransitioning = true;
    this.cycleProgress = 0;
  }

  /**
   * Actualiza el desplazamiento de nubes y el ciclo día/noche cada frame.
   * @param {number} delta
   */
  update(delta) {
    // 1. Movimiento suave continuo de nubes
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.group.position.x += c.speed * delta;
      if (c.group.position.x > 62) {
        c.group.position.x = -62;
      }
    }

    if (this.isTransitioning) {
      this.cycleProgress += delta / this.cycleDuration;
      if (this.cycleProgress >= 1) {
        this.cycleProgress = 1;
        this.isTransitioning = false;
        this.timeOfDay = 0.08;
        if (this.autoCycleEnabled) {
          this._applyTimeOfDay(this.timeOfDay);
        } else {
          this._applyDayState();
        }
        return;
      }

      this._applyCycleAtProgress(this.cycleProgress);
      return;
    }

    // 2. Avance continuo del reloj solar (Mañana -> Mediodía -> Tarde -> Noche)
    if (this.autoCycleEnabled) {
      this.timeOfDay += Math.max(0, delta) / this.dayLengthSeconds;
      if (this.timeOfDay >= 1) {
        this.timeOfDay -= Math.floor(this.timeOfDay);
        this._applyTimeOfDay(this.timeOfDay);
        if (this.onDayComplete) {
          this.onDayComplete();
        }
      } else {
        this._applyTimeOfDay(this.timeOfDay);
      }
    }
  }

  /**
   * Aplica iluminación, cielo, sol, luna y estrellas según la hora continua del día (0..1):
   * - 0.00 .. 0.25: Mañana (amanecer rosado hacia mañana fresca)
   * - 0.25 .. 0.50: Mediodía (sol cenital brillante)
   * - 0.50 .. 0.75: Tarde (luz cálida hacia atardecer andino)
   * - 0.75 .. 1.00: Noche (ocaso hacia noche estrellada y pre-alba)
   */
  _applyTimeOfDay(t) {
    if (t < 0.25) {
      // MAÑANA (0.00 -> 0.25)
      const u = t / 0.25;
      this.phaseName = 'Mañana';
      const skyMix = Math.min(1, u / 0.4);
      this._tmpSky.lerpColors(DAWN_SKY, DAY_SKY, skyMix);
      this._tmpFog.lerpColors(DAWN_FOG, DAY_FOG, skyMix);
      this._tmpCloud.lerpColors(DAWN_CLOUD, DAY_CLOUD, skyMix);
      this._tmpSun.lerpColors(DAWN_SUN, DAY_SUN, skyMix);

      this._setEnvironmentColors(
        this._tmpSky,
        this._tmpFog,
        this._tmpCloud,
        this._tmpSun,
        0.78 + 0.37 * u,
        DAY_HEMI_SKY,
        0.45 + 0.15 * u,
        0.28 + 0.07 * u
      );
      if (this.sunLight) {
        this.sunLight.position.set(36 - 20 * u, 14 + 22 * u, 18 + 2 * u);
      }
      const nightFade = Math.max(0, 1 - u / 0.2);
      this._setNightVisibility(nightFade * 0.4, nightFade * 0.4);
    } else if (t < 0.50) {
      // MEDIODÍA (0.25 -> 0.50)
      const u = (t - 0.25) / 0.25;
      this.phaseName = 'Mediodía';
      const zenith = Math.sin(u * Math.PI); // Pico al centro del mediodía
      this._setEnvironmentColors(
        DAY_SKY,
        DAY_FOG,
        DAY_CLOUD,
        DAY_SUN,
        1.15 + 0.20 * zenith,
        DAY_HEMI_SKY,
        0.60 + 0.08 * zenith,
        0.35 + 0.04 * zenith
      );
      if (this.sunLight) {
        this.sunLight.position.set(16 - 28 * u, 36 + 10 * zenith, 20);
      }
      this._setNightVisibility(0, 0);
    } else if (t < 0.75) {
      // TARDE (0.50 -> 0.75)
      const u = (t - 0.50) / 0.25;
      this.phaseName = 'Tarde';
      const sunsetMix = Math.max(0, (u - 0.30) / 0.70);
      this._tmpSky.lerpColors(DAY_SKY, SUNSET_SKY, sunsetMix);
      this._tmpFog.lerpColors(DAY_FOG, SUNSET_FOG, sunsetMix);
      this._tmpCloud.lerpColors(DAY_CLOUD, SUNSET_CLOUD, sunsetMix);
      this._tmpSun.lerpColors(DAY_SUN, SUNSET_SUN, sunsetMix);

      this._setEnvironmentColors(
        this._tmpSky,
        this._tmpFog,
        this._tmpCloud,
        this._tmpSun,
        1.15 - 0.65 * sunsetMix,
        DAY_HEMI_SKY,
        0.60 - 0.20 * sunsetMix,
        0.35 - 0.10 * sunsetMix
      );
      if (this.sunLight) {
        this.sunLight.position.set(-12 - 28 * u, 36 - 28 * u, 20 - 10 * u);
      }
      this._setNightVisibility(0, 0);
    } else {
      // NOCHE (0.75 -> 1.00)
      const u = (t - 0.75) / 0.25;
      this.phaseName = 'Noche';
      if (u < 0.22) {
        const k = u / 0.22;
        this._tmpSky.lerpColors(SUNSET_SKY, NIGHT_SKY, k);
        this._tmpFog.lerpColors(SUNSET_FOG, NIGHT_FOG, k);
        this._tmpCloud.lerpColors(SUNSET_CLOUD, NIGHT_CLOUD, k);
        this._tmpSun.lerpColors(SUNSET_SUN, MOON_COLOR, k);
        this._tmpHemi.lerpColors(DAY_HEMI_SKY, NIGHT_HEMI_SKY, k);
        this._setEnvironmentColors(
          this._tmpSky,
          this._tmpFog,
          this._tmpCloud,
          this._tmpSun,
          0.50 * (1 - k) + 0.42 * k,
          this._tmpHemi,
          0.40 - 0.18 * k,
          0.25 - 0.05 * k
        );
        this._setNightVisibility(k, k * 0.95);
      } else if (u < 0.85) {
        this._setEnvironmentColors(
          NIGHT_SKY,
          NIGHT_FOG,
          NIGHT_CLOUD,
          MOON_COLOR,
          0.42,
          NIGHT_HEMI_SKY,
          0.22,
          0.20
        );
        this._setNightVisibility(1, 0.95);
      } else {
        // Pre-alba preparando el amanecer del siguiente día
        const k = (u - 0.85) / 0.15;
        this._tmpSky.lerpColors(NIGHT_SKY, DAWN_SKY, k);
        this._tmpFog.lerpColors(NIGHT_FOG, DAWN_FOG, k);
        this._tmpCloud.lerpColors(NIGHT_CLOUD, DAWN_CLOUD, k);
        this._tmpSun.lerpColors(MOON_COLOR, DAWN_SUN, k);
        this._tmpHemi.lerpColors(NIGHT_HEMI_SKY, DAY_HEMI_SKY, k);
        this._setEnvironmentColors(
          this._tmpSky,
          this._tmpFog,
          this._tmpCloud,
          this._tmpSun,
          0.42 + 0.36 * k,
          this._tmpHemi,
          0.22 + 0.23 * k,
          0.20 + 0.08 * k
        );
        this._setNightVisibility(1 - k * 0.6, (1 - k * 0.6) * 0.95);
      }
      if (this.sunLight) {
        this.sunLight.position.set(-22, 34, -22);
      }
    }
  }

  _applyCycleAtProgress(p) {
    if (p < 0.25) {
      // Atardecer (Día -> Ocaso)
      const t = p / 0.25;
      this.phaseName = 'Atardecer';
      this._tmpSky.lerpColors(DAY_SKY, SUNSET_SKY, t);
      this._tmpFog.lerpColors(DAY_FOG, SUNSET_FOG, t);
      this._tmpCloud.lerpColors(DAY_CLOUD, SUNSET_CLOUD, t);
      this._tmpSun.lerpColors(DAY_SUN, SUNSET_SUN, t);
      this._tmpHemi.copy(DAY_HEMI_SKY);

      this._setEnvironmentColors(
        this._tmpSky,
        this._tmpFog,
        this._tmpCloud,
        this._tmpSun,
        1.2 - 0.65 * t,
        this._tmpHemi,
        0.6 - 0.2 * t,
        0.35 - 0.1 * t
      );
      if (this.sunLight) {
        this.sunLight.position.set(25 - 60 * t, 40 - 32 * t, 20 - 8 * t);
      }
      this._setNightVisibility(0, 0);
    } else if (p < 0.48) {
      // Anochecer (Ocaso -> Noche)
      const t = (p - 0.25) / 0.23;
      this.phaseName = 'Noche';
      this._tmpSky.lerpColors(SUNSET_SKY, NIGHT_SKY, t);
      this._tmpFog.lerpColors(SUNSET_FOG, NIGHT_FOG, t);
      this._tmpCloud.lerpColors(SUNSET_CLOUD, NIGHT_CLOUD, t);
      this._tmpSun.lerpColors(SUNSET_SUN, MOON_COLOR, t);
      this._tmpHemi.lerpColors(DAY_HEMI_SKY, NIGHT_HEMI_SKY, t);

      const celestialIntensity = t < 0.4 ? 0.55 * (1 - t / 0.4) : 0.42 * ((t - 0.4) / 0.6);
      this._setEnvironmentColors(
        this._tmpSky,
        this._tmpFog,
        this._tmpCloud,
        this._tmpSun,
        celestialIntensity,
        this._tmpHemi,
        0.4 - 0.18 * t,
        0.25 - 0.05 * t
      );
      if (this.sunLight) {
        if (t >= 0.4) {
          this.sunLight.position.set(-22, 34, -22);
        } else {
          this.sunLight.position.set(-35, 8 - 6 * t, 12);
        }
      }
      this._setNightVisibility(t, t * 0.95);
    } else if (p < 0.65) {
      // Noche estrellada
      this.phaseName = 'Noche';
      this._setEnvironmentColors(
        NIGHT_SKY,
        NIGHT_FOG,
        NIGHT_CLOUD,
        MOON_COLOR,
        0.42,
        NIGHT_HEMI_SKY,
        0.22,
        0.2
      );
      if (this.sunLight) {
        this.sunLight.position.set(-22, 34, -22);
      }
      this._setNightVisibility(1, 0.95);
    } else if (p < 0.85) {
      // Amanecer (Noche -> Alba)
      const t = (p - 0.65) / 0.2;
      this.phaseName = 'Amanecer';
      this._tmpSky.lerpColors(NIGHT_SKY, DAWN_SKY, t);
      this._tmpFog.lerpColors(NIGHT_FOG, DAWN_FOG, t);
      this._tmpCloud.lerpColors(NIGHT_CLOUD, DAWN_CLOUD, t);
      this._tmpSun.lerpColors(MOON_COLOR, DAWN_SUN, t);
      this._tmpHemi.lerpColors(NIGHT_HEMI_SKY, DAY_HEMI_SKY, t);

      this._setEnvironmentColors(
        this._tmpSky,
        this._tmpFog,
        this._tmpCloud,
        this._tmpSun,
        0.42 + 0.38 * t,
        this._tmpHemi,
        0.22 + 0.24 * t,
        0.2 + 0.08 * t
      );
      if (this.sunLight) {
        this.sunLight.position.set(34, 10 + 14 * t, 18);
      }
      this._setNightVisibility(1 - t, (1 - t) * 0.95);
    } else {
      // Mañana (Alba -> Día pleno)
      const t = (p - 0.85) / 0.15;
      this.phaseName = 'Día';
      this._tmpSky.lerpColors(DAWN_SKY, DAY_SKY, t);
      this._tmpFog.lerpColors(DAWN_FOG, DAY_FOG, t);
      this._tmpCloud.lerpColors(DAWN_CLOUD, DAY_CLOUD, t);
      this._tmpSun.lerpColors(DAWN_SUN, DAY_SUN, t);

      this._setEnvironmentColors(
        this._tmpSky,
        this._tmpFog,
        this._tmpCloud,
        this._tmpSun,
        0.8 + 0.4 * t,
        DAY_HEMI_SKY,
        0.46 + 0.14 * t,
        0.28 + 0.07 * t
      );
      if (this.sunLight) {
        this.sunLight.position.set(34 - 9 * t, 24 + 16 * t, 18 + 2 * t);
      }
      this._setNightVisibility(0, 0);
    }
  }

  _applyDayState() {
    this.phaseName = 'Día';
    this._setEnvironmentColors(
      DAY_SKY,
      DAY_FOG,
      DAY_CLOUD,
      DAY_SUN,
      1.2,
      DAY_HEMI_SKY,
      0.6,
      0.35
    );
    if (this.sunLight) {
      this.sunLight.position.set(25, 40, 20);
    }
    this._setNightVisibility(0, 0);
  }

  _setEnvironmentColors(sky, fog, cloud, sunColor, sunIntensity, hemiColor, hemiIntensity, ambientIntensity) {
    if (this.scene.background && this.scene.background.isColor) {
      this.scene.background.copy(sky);
    }
    if (this.scene.fog && this.scene.fog.color) {
      this.scene.fog.color.copy(fog);
    }
    this.cloudMaterial.color.copy(cloud);

    if (this.sunLight) {
      this.sunLight.color.copy(sunColor);
      this.sunLight.intensity = sunIntensity;
    }
    if (this.hemiLight) {
      this.hemiLight.color.copy(hemiColor);
      this.hemiLight.intensity = hemiIntensity;
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = ambientIntensity;
    }
  }

  _setNightVisibility(moonOpacity, starOpacity) {
    this.moonMaterial.opacity = moonOpacity;
    this.moonMesh.visible = moonOpacity > 0.02;
    this.starMaterial.opacity = starOpacity;
    this.starsPoints.visible = starOpacity > 0.02;
  }
}

