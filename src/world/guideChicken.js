import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const GUIDE_STEPS = [
  {
    id: 'welcome',
    badge: 'Bienvenida y Controles',
    title: '¡Kikirikí! Soy Rudy, tu gallina guía e IA agrícola',
    body: 'Tu objetivo es aumentar el saldo inicial en $100.000 COP mediante las cosechas. Empieza por un surco: prepara su tierra manteniendo E y vuelve a mantener E para sembrar. Cada lote tiene cinco surcos independientes.',
    tips: [
      'Camina con W, A, S, D y mantén Shift para correr más rápido.',
      'Mueve el ratón para girar la cámara (click en el mapa para bloquear puntero, ESC para liberarlo).',
      'Mantén E cerca de parcelas para trabajar con esfuerzo real (azadón, siembra, plagas y cosecha).'
    ],
    spokenText:
      'Kikirikí. Bienvenido a AgroRescate 3D. Soy Rudy, tu gallina guía con asistente inteligente. Camina con W, A, S, D, corre con Shift, y mantén la tecla E en las parcelas y estaciones para trabajar la tierra.'
  },
  {
    id: 'plots',
    badge: 'Paso 1 · Parcelas y Esfuerzo',
    title: 'Prepara, siembra y cosecha según cada agricultura',
    body: 'Cada parcela y modalidad agrícola tiene exigencias distintas de esfuerzo campesino, agua y fertilidad.',
    tips: [
      'Parcela 1 (Subsistencia): trabajo manual intenso, mayor gasto de energía y agua.',
      'Parcela 2 (Precisión IoT): microriego eficiente y sensores con menor fatiga.',
      'Parcela 3 (Ecológica): regeneración orgánica con compost y control biológico.',
      'Vigila los brotes de plagas y mantén E para tratarlos antes de perder la cosecha.'
    ],
    spokenText:
      'En la finca hay tres parcelas con mecánicas distintas: Subsistencia, Precisión I o T y Ecológica. Prepara el terreno con el azadón manteniendo E, siembra, controla las plagas a tiempo y cosecha al madurar.'
  },
  {
    id: 'stations',
    badge: 'Paso 2 · Estaciones y Casa Rural',
    title: 'Bomba, Sensor, Compostera, Acopio y Casa Rural',
    body: 'Usa las estaciones de la finca para cuidar tus cultivos y descansa en la Casa Rural cuando baje tu energía.',
    tips: [
      'Bomba de Agua (sur): mantén E para regar la parcela activa.',
      'Sensor IoT y Compostera: consulta telemetría o prepara abono orgánico.',
      'Centro de Acopio: compra semillas y vende tus cosechas al mercado justo.',
      'Casa Rural: entra con E para ver estadísticas, avisos de cultivos y cerrar los ojos para descansar.'
    ],
    spokenText:
      'Cuida tus cultivos usando la bomba de agua, la compostera, el sensor y el centro de acopio. Cuando estés cansado o anochezca, entra a la Casa Rural para ver el estado de tus cultivos y cerrar los ojos para descansar.'
  },
  {
    id: 'modes_and_time',
    badge: 'Paso 3 · Ciclo del Día y Clima',
    title: 'El tiempo fluye: Mañana, Mediodía, Tarde y Noche',
    body: 'Ya no dependes de un botón mágico: estás a merced del clima y del paso continuo del día.',
    tips: [
      'Observa la fase del día en la barra superior (Mañana, Mediodía, Tarde y Noche).',
      'Cambia de modalidad agrícola en el panel superior o lateral para comparar sus mecánicas.',
      'B equipa o guarda el abono. El clima cambia automáticamente: vigila lluvia, calor y tormentas.'
    ],
    spokenText:
      'El día avanza de forma continua entre mañana, mediodía, tarde y noche, y el clima cambia tu finca. Mi asesor automático te avisará con viñetas y voz cuando cambie el clima o necesites actuar.'
  },
  {
    id: 'goals',
    badge: 'Paso 4 · Rudy IA Automático',
    title: 'Recibe viñetas automáticas con voz y analiza la Sostenibilidad',
    body: 'Rudy ahora funciona en modo automático: te lanza viñetas con recomendaciones de voz según tu modalidad, clima, presupuesto, energía y cultivos.',
    tips: [
      'Cuando mi marcador brille en rojo o ámbar, tengo una alerta urgente sobre tus cultivos.',
      'Abre 📊 Comparativa o 📊 Demo 3 Modos para evaluar rendimiento y ahorro hídrico.',
      'Mis recomendaciones llegan solas. El botón 🐔 Rudy permite consultas opcionales; E queda para tus labores.'
    ],
    spokenText:
      'Ahora funciono en modo automático: te daré recomendaciones en viñetas con voz según tu modalidad, clima, presupuesto y energía. Mucho éxito trabajando la tierra.'
  }
];

/**
 * Escala, centra en XZ, apoya en Y=0 y configura sombras/culling del modelo GLB de la gallina guía.
 * @param {THREE.Object3D} model
 * @param {number} [targetHeight=0.95]
 * @returns {THREE.Object3D}
 */
export function prepareGuideChickenModel(model, targetHeight = 0.95) {
  model.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(model);
  const rawSize = rawBox.getSize(new THREE.Vector3());

  if (rawSize.y > 0.0001) {
    const scale = targetHeight / rawSize.y;
    model.scale.setScalar(scale);
  }

  model.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());

  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= scaledBox.min.y;

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.isSkinnedMesh) {
        child.frustumCulled = false;
      }
    }
  });

  return model;
}

/**
 * NPC interactivo de gallina/gallo guía ("Rudy") que orienta al jugador sobre cómo jugar.
 */
export class GuideChicken {
  /**
   * @param {THREE.Scene} scene
   * @param {object} [options]
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.modelPath = options.modelPath ?? '/models/gallina_guia.glb';
    this.targetHeight = options.targetHeight ?? 0.95;
    this.radius = options.radius ?? 0.45;
    this.gltfLoader = options.gltfLoader ?? null;

    const pos = options.position ?? { x: 2.0, y: 0, z: -4.2 };
    this.position = new THREE.Vector3(pos.x, pos.y ?? 0, pos.z);
    // Mirar por defecto hacia el punto inicial del jugador (0, 0, -2)
    this.initialYaw = options.initialYaw ?? Math.atan2(-this.position.x, -2 - this.position.z);

    this.mixer = null;
    this.activeAction = null;
    this.hasTalked = false;
    this.isTalking = false;
    this.alertLevel = 'normal';
    this.celebrateTimer = 0;
    this.lookRange = options.lookRange ?? 6.5;

    this.group = new THREE.Group();
    this.group.name = 'guide_chicken_npc';
    this.group.position.copy(this.position);

    this.visualPivot = new THREE.Group();
    this.visualPivot.name = 'guide_chicken_pivot';
    this.visualPivot.rotation.y = this.initialYaw;
    this.group.add(this.visualPivot);

    this.visualModel = this._createFallbackVisual();
    this.visualPivot.add(this.visualModel);

    this._createGuideIndicators();

    if (this.scene) {
      this.scene.add(this.group);
    }

    const canAutoLoad = options.autoLoad !== undefined
      ? Boolean(options.autoLoad)
      : (typeof window !== 'undefined' || Boolean(options.gltfLoader));

    this.ready = canAutoLoad
      ? this.loadModel(this.modelPath)
      : Promise.resolve(false);
  }

  /**
   * Carga de forma asíncrona el modelo GLB animado y reemplaza el respaldo procedural.
   * @param {string} [url]
   * @returns {Promise<boolean>}
   */
  async loadModel(url = this.modelPath) {
    try {
      const loader = this.gltfLoader || (this.gltfLoader = new GLTFLoader());
      const gltf = await loader.loadAsync(url);
      if (!gltf || !gltf.scene) return false;

      const model = prepareGuideChickenModel(gltf.scene, this.targetHeight);
      model.name = 'guide_chicken_glb';

      if (this.visualModel) {
        this.visualPivot.remove(this.visualModel);
      }
      this.visualModel = model;
      this.visualPivot.add(model);

      if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(model);
        const clip = gltf.animations[0];
        this.activeAction = this.mixer.clipAction(clip);
        this.activeAction.setLoop(THREE.LoopRepeat, Infinity);
        this.activeAction.setEffectiveTimeScale(0.95);
        this.activeAction.play();
        this.mixer.update(0);
      }

      return true;
    } catch (err) {
      console.warn(`[GuideChicken] No se pudo cargar ${url}, se mantiene respaldo visual:`, err?.message || err);
      return false;
    }
  }

  _createFallbackVisual() {
    const fallback = new THREE.Group();
    fallback.name = 'guide_chicken_fallback';

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xfef3c7 });
    const combMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
    const beakMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), bodyMat);
    body.position.set(0, 0.36, 0);
    body.scale.set(0.9, 0.85, 1.15);
    body.castShadow = true;
    fallback.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), bodyMat);
    head.position.set(0, 0.64, 0.14);
    head.castShadow = true;
    fallback.add(head);

    const comb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.16), combMat);
    comb.position.set(0, 0.80, 0.14);
    fallback.add(comb);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.62, 0.32);
    fallback.add(beak);

    return fallback;
  }

  _createGuideIndicators() {
    this.markerBaseY = this.targetHeight + 0.34;
    this.markerGroup = new THREE.Group();
    this.markerGroup.position.set(0, this.markerBaseY, 0);

    this.markerMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.7,
      roughness: 0.25,
      metalness: 0.2
    });

    const bar = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), this.markerMat);
    bar.rotation.x = Math.PI;
    bar.position.y = 0.08;
    this.markerGroup.add(bar);

    const dot = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), this.markerMat);
    dot.position.y = -0.09;
    this.markerGroup.add(dot);

    this.group.add(this.markerGroup);

    // Anillo sutil en el suelo para destacar la zona de diálogo
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const ringGeo = new THREE.RingGeometry(0.48, 0.56, 28);
    ringGeo.rotateX(-Math.PI / 2);
    this.groundRing = new THREE.Mesh(ringGeo, this.ringMat);
    this.groundRing.position.y = 0.02;
    this.group.add(this.groundRing);
  }

  /**
   * Marca si el jugador ya consultó a Rudy y ajusta el color indicador a verde guía.
   * @param {boolean} [talked=true]
   */
  setTalked(talked = true) {
    this.hasTalked = Boolean(talked);
    this._syncIndicatorColors();
  }

  /**
   * Ajusta el nivel de alerta visual de Rudy ('normal' | 'warning' | 'critical').
   * @param {'normal'|'warning'|'critical'} level
   */
  setAlertState(level = 'normal') {
    this.alertLevel = ['critical', 'warning', 'normal'].includes(level) ? level : 'normal';
    this._syncIndicatorColors();
  }

  /**
   * Pequeño salto de celebración de Rudy (ej. al cosechar o completar una misión).
   */
  celebrate() {
    this.celebrateTimer = 1.1;
  }

  _syncIndicatorColors() {
    let hex = this.hasTalked ? 0x34d399 : 0xf59e0b;
    let emissive = this.hasTalked ? 0x059669 : 0xd97706;
    let emissiveIntensity = this.hasTalked ? 0.45 : 0.7;
    let ringOpacity = this.hasTalked ? 0.3 : 0.45;

    if (this.alertLevel === 'critical') {
      hex = 0xef4444;
      emissive = 0xdc2626;
      emissiveIntensity = 0.95;
      ringOpacity = 0.65;
    } else if (this.alertLevel === 'warning') {
      hex = 0xf59e0b;
      emissive = 0xd97706;
      emissiveIntensity = 0.8;
      ringOpacity = 0.55;
    }

    if (this.markerMat) {
      this.markerMat.color.setHex(hex);
      this.markerMat.emissive.setHex(emissive);
      this.markerMat.emissiveIntensity = emissiveIntensity;
    }
    if (this.ringMat) {
      this.ringMat.color.setHex(hex);
      this.ringMat.opacity = ringOpacity;
    }
  }

  /**
   * Ajusta la velocidad de animación cuando Rudy está hablando.
   * @param {boolean} talking
   */
  setTalking(talking) {
    this.isTalking = Boolean(talking);
    if (this.activeAction) {
      this.activeAction.setEffectiveTimeScale(this.isTalking ? 1.35 : 0.95);
    }
  }

  /**
   * Actualiza animación esquelética, indicador flotante y orientación hacia el jugador.
   * @param {number} delta
   * @param {THREE.Vector3 | { x: number, z: number } | null} [playerPosition]
   */
  update(delta, playerPosition = null, navigation = {}) {
    let moving = false;
    let walkingYaw = this.visualPivot.rotation.y;
    if (navigation.enabled && playerPosition) {
      const dx = playerPosition.x - this.position.x, dz = playerPosition.z - this.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 7.5 || distance < 4) {
        const retreat = distance < 4;
        const angle = Math.atan2(dx, dz) + (retreat ? Math.PI : 0);
        const step = Math.min(0.12, Math.max(0, delta) * 1.8, retreat ? 4 - distance : distance - 6.5);
        for (const turn of [0, 0.55, -0.55, 1.1, -1.1, 1.57, -1.57]) {
          const yaw = angle + turn;
          const x = this.position.x + Math.sin(yaw) * step, z = this.position.z + Math.cos(yaw) * step;
          const bounds = navigation.bounds;
          if (bounds && (x < bounds.minX + 0.5 || x > bounds.maxX - 0.5 || z < bounds.minZ + 0.5 || z > bounds.maxZ - 0.5)) continue;
          const blocked = (navigation.obstacles || []).some(o => o.id !== 'guide_chicken' && (o.type === 'box' ? x > o.minX - 0.35 && x < o.maxX + 0.35 && z > o.minZ - 0.35 && z < o.maxZ + 0.35 : Math.hypot(x - o.x, z - o.z) < o.r + 0.35));
          if (blocked) continue;
          this.position.x = x; this.position.z = z;
          this.group.position.copy(this.position);
          moving = step > 0;
          walkingYaw = yaw;
          break;
        }
      }
    }
    if (this.mixer) {
      this.mixer.update(delta);
    } else if (this.visualModel) {
      const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.004;
      this.visualModel.position.y = Math.sin(t) * 0.02;
    }

    if (this.celebrateTimer > 0) {
      this.celebrateTimer = Math.max(0, this.celebrateTimer - delta);
      const hop = Math.abs(Math.sin(this.celebrateTimer * Math.PI * 3)) * 0.16;
      this.visualPivot.position.y = hop;
    } else if (this.alertLevel === 'critical') {
      const alertT = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.006;
      this.visualPivot.position.y = Math.max(0, Math.sin(alertT)) * 0.04;
    } else {
      this.visualPivot.position.y = 0;
    }

    const nowSec = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
    const pulseSpeed = this.alertLevel === 'critical' ? 6.0 : this.alertLevel === 'warning' ? 4.4 : 3.2;
    if (this.markerGroup) {
      this.markerGroup.position.y = this.markerBaseY + Math.sin(nowSec * pulseSpeed) * 0.07;
      this.markerGroup.rotation.y += delta * (this.isTalking ? 3.2 : this.alertLevel === 'critical' ? 2.6 : 1.6);
    }
    if (this.groundRing) {
      const pulse = 1 + Math.sin(nowSec * pulseSpeed) * (this.alertLevel === 'critical' ? 0.09 : 0.05);
      this.groundRing.scale.setScalar(pulse);
    }

    let targetYaw = this.initialYaw;
    if (playerPosition) {
      const dx = playerPosition.x - this.position.x;
      const dz = playerPosition.z - this.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 0.001 && distSq <= this.lookRange * this.lookRange) {
        targetYaw = Math.atan2(dx, dz);
      }
    }
    if (moving) {
      targetYaw = walkingYaw;
      const gait = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.012;
      this.visualPivot.position.y += Math.abs(Math.sin(gait)) * 0.035;
      this.visualPivot.rotation.z = Math.sin(gait) * 0.06;
      this.visualPivot.rotation.x = 0.08;
    } else {
      this.visualPivot.rotation.z *= Math.exp(-delta * 8);
      this.visualPivot.rotation.x = this.isTalking ? Math.sin(Date.now() * 0.008) * 0.05 : 0;
    }

    let diff = targetYaw - this.visualPivot.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.visualPivot.rotation.y += diff * Math.min(1, delta * 6);
  }

  /**
   * Devuelve el obstáculo circular para evitar que el jugador atraviese a Rudy.
   */
  getCollisionObstacle() {
    return {
      id: 'guide_chicken',
      type: 'circle',
      x: this.position.x,
      z: this.position.z,
      r: this.radius
    };
  }
}

