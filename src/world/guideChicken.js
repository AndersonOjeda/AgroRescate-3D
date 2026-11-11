import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const GUIDE_STEPS = [
  {
    id: 'welcome',
    badge: 'Bienvenida y Controles',
    title: '¡Kikirikí! Soy Rudy, tu gallina guía',
    body: 'Bienvenido a AgroRescate 3D. Tu misión es gestionar la finca y comparar qué enfoque agrícola logra mejor cosecha cuidando el agua y la salud del suelo.',
    tips: [
      'Camina con W, A, S, D y mantén Shift para correr más rápido.',
      'Mueve el ratón para girar la cámara (click en el mapa para bloquear puntero, ESC para liberarlo).',
      'Acércate a parcelas, bomba, sensor, compostera o granero y presiona E para interactuar.'
    ],
    spokenText:
      'Kikirikí. Bienvenido a AgroRescate 3D. Soy Rudy, tu gallina guía. Camina con W, A, S, D, corre con Shift, gira la cámara con el ratón y presiona la tecla E cerca de los elementos de la finca para interactuar.'
  },
  {
    id: 'plots',
    badge: 'Paso 1 · Parcelas',
    title: 'Siembra y cosecha en las 3 Parcelas',
    body: 'Cada parcela representa un sistema distinto. Camina hasta su zona o selecciónala en el Panel Agrícola lateral.',
    tips: [
      'Parcela 1 (Subsistencia, noreste): siembra tradicional con mayor consumo de agua.',
      'Parcela 2 (Precisión IoT, noroeste): usa microriego eficiente y sensores de humedad.',
      'Parcela 3 (Ecológica, suroeste): aprovecha compost orgánico para regenerar el suelo.',
      'Presiona E en una parcela vacía para sembrar y vuelve a presionar E cuando madure para cosechar.'
    ],
    spokenText:
      'En la finca hay tres parcelas: Subsistencia al noreste, Precisión I o T al noroeste y Ecológica al suroeste. Acércate a una parcela y presiona E para sembrar, y vuelve a presionar E cuando el cultivo madure para cosecharlo.'
  },
  {
    id: 'stations',
    badge: 'Paso 2 · Estaciones',
    title: 'Usa la Bomba, el Sensor, la Compostera y el Granero',
    body: 'Los cultivos pierden humedad cada día. Usa las estaciones de la finca para mantenerlos sanos y evitar que se marchiten.',
    tips: [
      'Bomba y Tanque de Agua (sur): presiona E para activar el riego en tu parcela activa o recargar agua.',
      'Sensor de Humedad IoT (junto a la Parcela 2): presiona E para consultar la telemetría de humedad y suelo.',
      'Compostera Orgánica (suroeste): presiona E para aplicar abono orgánico y mejorar la fertilidad.',
      'Granero y Silo (sureste): acércate al frente y presiona E para lanzar cajas físicas con Cannon-es.'
    ],
    spokenText:
      'Cuida tus cultivos usando las estaciones: presiona E en la bomba de agua para regar, en el sensor de humedad para ver telemetría en vivo, en la compostera para abonar el suelo y frente al silo del granero para probar cajas físicas.'
  },
  {
    id: 'modes_and_time',
    badge: 'Paso 3 · Tiempo y Modos',
    title: 'Cambia de Modo Agrícola y Avanza Días',
    body: 'Experimenta cómo responden los cultivos al paso del tiempo, al clima y a cada tecnología agrícola.',
    tips: [
      'En la barra superior o panel izquierdo cambia entre Subsistencia, Precisión IoT y Ecológica.',
      'Pulsa Avanzar Día para hacer crecer los cultivos y observar el ciclo de día y noche.',
      'Atajos útiles: R alterna lluvia ambiental y F lanza una caja física donde estés parado.'
    ],
    spokenText:
      'Usa la barra superior o el panel izquierdo para cambiar entre los modos Subsistencia, Precisión y Ecológica. Pulsa Avanzar Día para ver crecer los cultivos y observar el cielo, y recuerda que R cambia la lluvia y F lanza una caja física.'
  },
  {
    id: 'goals',
    badge: 'Paso 4 · Objetivo Final',
    title: 'Analiza la Comparativa y Sostenibilidad',
    body: 'Administra bien tu presupuesto ($), reserva hídrica (L) y salud del suelo (%) antes de que tus plantas sufran estrés hídrico.',
    tips: [
      'Si la humedad baja demasiado al avanzar el día, el cultivo puede marchitarse (E para limpiarlo).',
      'Abre 📊 Comparativa en la esquina inferior derecha o 📊 Demo 3 Modos para comparar rendimiento y ahorro de agua.',
      'Cuando quieras volver a escuchar las instrucciones, acércate a mí o pulsa 🐔 Guía en la barra inferior.'
    ],
    spokenText:
      'Controla tu presupuesto, tu agua y la salud del suelo cada día. Cuando termines tus pruebas, abre el botón Comparativa o Demo tres modos para ver qué sistema produce más cuidando el agua. Mucho éxito en la finca.'
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
    if (this.markerMat) {
      this.markerMat.color.setHex(this.hasTalked ? 0x34d399 : 0xf59e0b);
      this.markerMat.emissive.setHex(this.hasTalked ? 0x059669 : 0xd97706);
      this.markerMat.emissiveIntensity = this.hasTalked ? 0.45 : 0.7;
    }
    if (this.ringMat) {
      this.ringMat.color.setHex(this.hasTalked ? 0x34d399 : 0xfbbf24);
      this.ringMat.opacity = this.hasTalked ? 0.3 : 0.45;
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
  update(delta, playerPosition = null) {
    if (this.mixer) {
      this.mixer.update(delta);
    } else if (this.visualModel) {
      const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.004;
      this.visualModel.position.y = Math.sin(t) * 0.02;
    }

    const nowSec = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
    if (this.markerGroup) {
      this.markerGroup.position.y = this.markerBaseY + Math.sin(nowSec * 3.2) * 0.07;
      this.markerGroup.rotation.y += delta * (this.isTalking ? 3.2 : 1.6);
    }
    if (this.groundRing) {
      const pulse = 1 + Math.sin(nowSec * 3.0) * 0.05;
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

