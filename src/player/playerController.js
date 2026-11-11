import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyProceduralFarmerRig } from './farmerRig.js';

/**
 * Escala, centra en XZ, apoya en Y=0 y activa sombras en un modelo GLB de personaje.
 * @param {THREE.Object3D} model
 * @param {number} [targetHeight=2.1]
 * @returns {THREE.Object3D}
 */
export function prepareFarmerGlbModel(model, targetHeight = 2.1) {
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
    }
  });

  return model;
}

/**
 * Controlador del Jugador en Tercera Persona con soporte de modelo GLB animado,
 * colisiones sólidas, deslizamiento por paredes, sonido/polvo de pisadas, Pointer Lock
 * y modo alternativo de Cámara Orbital (OrbitControls) para inspección aérea.
 */
export class PlayerController {
  constructor(camera, domElement, scene, options = {}) {
    this.camera = camera;
    this.domElement = domElement;
    this.scene = scene;
    this.modelPath = options.modelPath ?? '/models/granjero.glb';
    this.targetHeight = options.targetHeight ?? 2.1;
    this.gltfLoader = options.gltfLoader ?? null;
    this.mixer = null;
    this.animations = {};
    this.activeAction = null;
    this.currentAnimName = null;
    this._isPlayingAction = false;
    this._actionTimer = 0;
    this._actionDuration = 0.75;
    this.rig = null;

    // Modo de cámara actual: 'third-person' (tercera persona) o 'orbit' (órbita libre con mouse)
    this.cameraMode = 'third-person';

    // Controles orbitales de Three.js (Semanas 1, 7, 8, 10)
    if (this.domElement && typeof HTMLElement !== 'undefined' && this.domElement instanceof HTMLElement) {
      this.orbitControls = new OrbitControls(this.camera, this.domElement);
      this.orbitControls.enableDamping = true;
      this.orbitControls.dampingFactor = 0.05;
      this.orbitControls.maxPolarAngle = Math.PI / 2 - 0.05; // Evita cruzar el piso
      this.orbitControls.minDistance = 3;
      this.orbitControls.maxDistance = 75;
      this.orbitControls.target.set(0, 1.2, 0);
      this.orbitControls.enabled = false;
    } else {
      this.orbitControls = null;
    }

    // Posición y orientación del jugador
    this.position = new THREE.Vector3(0, 0, -2);
    this.rotationY = 0; // Ángulo hacia donde mira el jugador

    // Parámetros de la cámara orbital en tercera persona
    this.cameraDistance = 5.5;
    this.cameraHeight = 2.2;
    this.cameraPitch = 0.25; // Ángulo vertical (inclinación)
    this.cameraYaw = 0;      // Ángulo horizontal
    this.minPitch = -0.15;   // Evita atravesar el suelo
    this.maxPitch = 1.25;

    // Velocidades
    this.walkSpeed = 6.5;
    this.runSpeed = 11.0;
    this.isSprinting = false;

    // Estado del teclado
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false
    };

    // Control de puntero
    this.isLocked = false;
    this.mouseSensitivity = 0.0022;

    // Vectores de reutilización para evitar instanciaciones en animate()
    this._moveDirection = new THREE.Vector3();
    this._cameraForward = new THREE.Vector3();
    this._cameraRight = new THREE.Vector3();
    this._desiredCameraPos = new THREE.Vector3();
    this._cameraLookTarget = new THREE.Vector3();

    // Límites del mapa para evitar caídas
    this.bounds = {
      minX: -36,
      maxX: 36,
      minZ: -36,
      maxZ: 36
    };

    // Radio de colisión del jugador
    this.radius = 0.45;

    // Obstáculos sólidos del escenario para colisión física contra paredes y estructuras
    this.obstacles = [
      // 1. Casa Rural
      {
        id: 'casa_rural',
        type: 'box',
        minX: -16 - 4.2,
        maxX: -16 + 4.2,
        minZ: -14 - 3.4,
        maxZ: -14 + 3.4
      },
      // 2. Granero
      {
        id: 'granero',
        type: 'box',
        minX: 16 - 4.7,
        maxX: 16 + 4.7,
        minZ: -14 - 3.9,
        maxZ: -14 + 3.9
      },
      // 3. Tanque de Agua (patas y estructura)
      {
        id: 'tanque_agua',
        type: 'box',
        minX: -4 - 1.3,
        maxX: -4 + 1.3,
        minZ: -4 - 1.3,
        maxZ: -4 + 1.3
      },
      // 4. Bomba de Agua (motor hidráulico)
      {
        id: 'bomba_agua',
        type: 'box',
        minX: -3 - 0.7,
        maxX: -3 + 0.7,
        minZ: -3 - 0.7,
        maxZ: -3 + 0.7
      },
      // 5. Compostera
      {
        id: 'compostera',
        type: 'box',
        minX: 14 - 1.0,
        maxX: 14 + 1.0,
        minZ: 1 - 1.0,
        maxZ: 1 + 1.0
      },
      // 6. Cerca Norte
      {
        id: 'cerca_norte',
        type: 'box',
        minX: -30.5,
        maxX: 30.5,
        minZ: -34.4,
        maxZ: -33.6
      },
      // 7. Troncos de árboles (cilíndricos)
      { id: 'tree_1', type: 'circle', x: -28, z: -20, r: 0.5 },
      { id: 'tree_2', type: 'circle', x: -30, z: -10, r: 0.5 },
      { id: 'tree_3', type: 'circle', x: -25, z: 12, r: 0.5 },
      { id: 'tree_4', type: 'circle', x: -28, z: 25, r: 0.5 },
      { id: 'tree_5', type: 'circle', x: 28, z: -25, r: 0.5 },
      { id: 'tree_6', type: 'circle', x: 26, z: 22, r: 0.5 },
      { id: 'tree_7', type: 'circle', x: 30, z: 8, r: 0.5 },
      { id: 'tree_8', type: 'circle', x: -6, z: -25, r: 0.5 },
      { id: 'tree_9', type: 'circle', x: 6, z: -25, r: 0.5 }
    ];

    // Animación procedural del avatar
    this.walkCycle = 0;
    this.prevCycleSin = 0;
    this.onFootstep = null;
    this.parts = {};

    // Contenedor principal del jugador (arranca con avatar estilizado articulado y reemplaza con GLB)
    this.mesh = new THREE.Group();
    this.mesh.name = 'player_farmer';
    this.avatarVisual = this._createFarmerAvatar();
    this.mesh.add(this.avatarVisual);
    this.scene.add(this.mesh);
    this.mesh.position.copy(this.position);

    const canAutoLoadGlb = options.autoLoad !== undefined
      ? Boolean(options.autoLoad)
      : (typeof window !== 'undefined' || Boolean(options.gltfLoader));

    this.ready = canAutoLoadGlb
      ? this.loadGlbAvatar(this.modelPath)
      : Promise.resolve(false);

    this._setupInputListeners();
  }

  /**
   * Carga de forma asíncrona el modelo 3D del granjero en formato GLB y aplica rigging/animaciones.
   * @param {string} [modelUrl]
   * @returns {Promise<boolean>}
   */
  async loadGlbAvatar(modelUrl = this.modelPath) {
    try {
      const loader = this.gltfLoader || (this.gltfLoader = new GLTFLoader());
      const gltf = await loader.loadAsync(modelUrl);
      if (!gltf || !gltf.scene) return false;

      const model = prepareFarmerGlbModel(gltf.scene, this.targetHeight);
      model.name = 'farmer_glb_model';

      if (this.avatarVisual) {
        this.mesh.remove(this.avatarVisual);
      }
      this.parts = {};
      this.avatarVisual = model;
      this.mesh.add(model);

      if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(model);
        this.animations = {};
        gltf.animations.forEach((clip, idx) => {
          const key = (clip.name || `clip_${idx}`).toLowerCase();
          this.animations[key] = this.mixer.clipAction(clip);
        });
        this.activeAction = this.animations.idle || this.mixer.clipAction(gltf.animations[0]);
        this.currentAnimName = this.animations.idle ? 'idle' : 'clip_0';
        this.activeAction.play();
      } else {
        const rig = applyProceduralFarmerRig(model);
        if (rig) {
          this.rig = rig;
          this.mixer = rig.mixer;
          this.animations = rig.actions;
          this.currentAnimName = 'idle';
          this.activeAction = rig.actions.idle;
          this.activeAction.play();
          this.mixer.update(0);

          this.mixer.addEventListener('finished', (event) => {
            if (event.action === this.animations.action) {
              this._isPlayingAction = false;
              this._fadeToAnimation('idle', 0.2);
            }
          });
        }
      }

      return true;
    } catch (err) {
      console.warn(`[PlayerController] No se pudo cargar ${modelUrl}, se mantiene avatar de respaldo:`, err?.message || err);
      return false;
    }
  }

  _fadeToAnimation(name, duration = 0.16) {
    const nextAction = this.animations[name];
    if (!nextAction || this.currentAnimName === name) return;

    const prevAction = this.activeAction;
    this.currentAnimName = name;
    this.activeAction = nextAction;

    nextAction.enabled = true;
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);
    nextAction.play();
    if (prevAction && prevAction !== nextAction) {
      prevAction.crossFadeTo(nextAction, duration, false);
    }
  }

  /**
   * Reproduce la animación breve de trabajo agrícola (sembrar/regar/cosechar).
   * @returns {boolean}
   */
  playActionAnimation() {
    this._actionTimer = this._actionDuration;
    const actionAnim = this.animations.action;
    if (!actionAnim) {
      if (this.parts && this.parts.pelvis) {
        this._isPlayingAction = true;
        return true;
      }
      return false;
    }

    const prevAction = this.activeAction;
    this._isPlayingAction = true;
    this.currentAnimName = 'action';
    this.activeAction = actionAnim;

    actionAnim.enabled = true;
    actionAnim.reset();
    actionAnim.setEffectiveTimeScale(1);
    actionAnim.setEffectiveWeight(1);
    actionAnim.play();
    if (prevAction && prevAction !== actionAnim) {
      prevAction.crossFadeTo(actionAnim, 0.12, false);
    }
    return true;
  }

  /**
   * Crea un avatar 3D estilizado y orgánico con extremidades articuladas,
   * overol con tirantes, camisa de franela, sombrero campesino detallado y rostro expresivo.
   */
  _createFarmerAvatar() {
    const root = new THREE.Group();
    root.name = 'player_farmer_fallback';

    // Materiales con acabado suave y estilizado
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xfad6bf }); // Piel suave
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0xef4444 }); // Camisa franela roja
    const overallMat = new THREE.MeshLambertMaterial({ color: 0x2563eb }); // Overol azul mezclilla
    const strapMat = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }); // Tirantes
    const buckleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 }); // Hebillas de latón
    const hatStrawMat = new THREE.MeshLambertMaterial({ color: 0xf5cf78 }); // Paja de sombrero tejida
    const hatRibbonMat = new THREE.MeshLambertMaterial({ color: 0x065f46 }); // Cinta verde esmeralda
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x451a03 }); // Cuero oscuro
    const bootSoleMat = new THREE.MeshLambertMaterial({ color: 0x291404 }); // Suela de bota
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b }); // Ojos
    const leatherPouchMat = new THREE.MeshLambertMaterial({ color: 0x78350f }); // Cartuchera de herramientas

    // 1. PELVIS (Punto pivote inferior sobre las piernas)
    const pelvis = new THREE.Group();
    pelvis.position.y = 0.68;
    root.add(pelvis);

    const pelvisMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.21, 0.25, 10),
      overallMat
    );
    pelvisMesh.castShadow = true;
    pelvis.add(pelvisMesh);

    // Bolso/cartuchera lateral de campo
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.12), leatherPouchMat);
    pouch.position.set(0.26, 0.02, 0.05);
    pouch.rotation.z = -0.15;
    pouch.castShadow = true;
    pelvis.add(pouch);

    // 2. TORSO (Pecho, tirantes y botones)
    const torso = new THREE.Group();
    torso.position.y = 0.15;
    pelvis.add(torso);

    // Camisa / Pecho
    const chest = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.25, 0.52, 10),
      shirtMat
    );
    chest.position.y = 0.26;
    chest.castShadow = true;
    torso.add(chest);

    // Peto del overol (pechera azul frontal)
    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.08), overallMat);
    bib.position.set(0, 0.24, 0.15);
    torso.add(bib);

    // Hebillas doradas de los tirantes
    const buckleGeo = new THREE.BoxGeometry(0.07, 0.07, 0.03);
    const leftBuckle = new THREE.Mesh(buckleGeo, buckleMat);
    leftBuckle.position.set(-0.11, 0.37, 0.19);
    torso.add(leftBuckle);

    const rightBuckle = leftBuckle.clone();
    rightBuckle.position.x = 0.11;
    torso.add(rightBuckle);

    // 3. CABEZA Y SOMBRERO CAMPESINO
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.56, 0);
    torso.add(headGroup);

    // Cabeza redondeada estilizada
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 12), skinMat);
    head.position.y = 0.14;
    head.scale.set(1.0, 1.08, 1.0);
    head.castShadow = true;
    headGroup.add(head);

    // Ojos expresivos
    const eyeGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.08, 0.17, 0.21);
    headGroup.add(leftEye);

    const rightEye = leftEye.clone();
    rightEye.position.x = 0.08;
    headGroup.add(rightEye);

    // Nariz redondeada
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), skinMat);
    nose.position.set(0, 0.13, 0.24);
    headGroup.add(nose);

    // Bigote campesino clásico
    const stacheGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.18, 6);
    stacheGeo.rotateZ(Math.PI / 2);
    const mustache = new THREE.Mesh(stacheGeo, bootMat);
    mustache.position.set(0, 0.08, 0.23);
    headGroup.add(mustache);

    // SOMBRERO CAMPESINO DE PAJA (Ala ancha curva + copa + cinta verde)
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.27, -0.02);
    hatGroup.rotation.x = -0.08; // Ligera inclinación hacia atrás
    headGroup.add(hatGroup);

    // Ala de paja
    const hatBrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.64, 0.62, 0.04, 16),
      hatStrawMat
    );
    hatBrim.castShadow = true;
    hatGroup.add(hatBrim);

    // Copa del sombrero
    const hatCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 0.32, 16),
      hatStrawMat
    );
    hatCrown.position.y = 0.16;
    hatCrown.castShadow = true;
    hatGroup.add(hatCrown);

    // Cinta verde decorativa
    const hatRibbon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.385, 0.385, 0.07, 16),
      hatRibbonMat
    );
    hatRibbon.position.y = 0.05;
    hatGroup.add(hatRibbon);

    // 4. BRAZO IZQUIERDO ARTICULADO (Hombro -> Manga -> Mano)
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.34, 0.44, 0);
    torso.add(leftArm);

    const lUpperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.075, 0.34, 8),
      shirtMat
    );
    lUpperArm.position.y = -0.16;
    lUpperArm.castShadow = true;
    leftArm.add(lUpperArm);

    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), skinMat);
    lHand.position.y = -0.36;
    lHand.castShadow = true;
    leftArm.add(lHand);

    // 5. BRAZO DERECHO ARTICULADO
    const rightArm = new THREE.Group();
    rightArm.position.set(0.34, 0.44, 0);
    torso.add(rightArm);

    const rUpperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.075, 0.34, 8),
      shirtMat
    );
    rUpperArm.position.y = -0.16;
    rUpperArm.castShadow = true;
    rightArm.add(rUpperArm);

    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), skinMat);
    rHand.position.y = -0.36;
    rHand.castShadow = true;
    rightArm.add(rHand);

    // 6. PIERNA IZQUIERDA ARTICULADA (Cadera -> Muslo -> Bota)
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.15, -0.08, 0);
    pelvis.add(leftLeg);

    const lThigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.10, 0.38, 8),
      overallMat
    );
    lThigh.position.y = -0.18;
    lThigh.castShadow = true;
    leftLeg.add(lThigh);

    // Bota campesina con puntera
    const lBoot = new THREE.Group();
    lBoot.position.set(0, -0.38, 0);
    const lBootLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.18, 8), bootMat);
    lBootLeg.position.y = 0.04;
    lBootLeg.castShadow = true;
    lBoot.add(lBootLeg);

    const lBootFoot = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.12, 0.30), bootMat);
    lBootFoot.position.set(0, -0.05, 0.06);
    lBootFoot.castShadow = true;
    lBoot.add(lBootFoot);

    const lSole = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.04, 0.32), bootSoleMat);
    lSole.position.set(0, -0.11, 0.06);
    lBoot.add(lSole);

    leftLeg.add(lBoot);

    // 7. PIERNA DERECHA ARTICULADA
    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.15, -0.08, 0);
    pelvis.add(rightLeg);

    const rThigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.10, 0.38, 8),
      overallMat
    );
    rThigh.position.y = -0.18;
    rThigh.castShadow = true;
    rightLeg.add(rThigh);

    const rBoot = lBoot.clone();
    rightLeg.add(rBoot);

    // Guardar referencias a las articulaciones animables
    this.parts = {
      root,
      pelvis,
      torso,
      headGroup,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg
    };

    return root;
  }

  _setupInputListeners() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Teclado
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = true;
          break;
        case 'KeyC':
          this.toggleCameraMode();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = false;
          break;
      }
    });

    // Control de puntero
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
      const startOverlay = document.getElementById('start-overlay');
      if (startOverlay) {
        if (this.isLocked) {
          startOverlay.classList.add('hidden');
        }
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;

      this.cameraYaw -= e.movementX * this.mouseSensitivity;
      this.cameraPitch -= e.movementY * this.mouseSensitivity;

      // Limitar pitch para que la cámara no baje del suelo ni dé la vuelta
      this.cameraPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.cameraPitch));
    });
  }

  requestLock() {
    if (this.domElement && this.domElement.requestPointerLock) {
      try {
        const res = this.domElement.requestPointerLock();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      } catch {
        /* pointer lock requiere gesto de usuario válido */
      }
    }
  }

  unlock() {
    if (typeof document !== 'undefined' && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  /**
   * Cambia el modo de cámara entre 'third-person' y 'orbit' (OrbitControls)
   */
  setCameraMode(mode) {
    if (mode !== 'third-person' && mode !== 'orbit') return;
    this.cameraMode = mode;

    if (mode === 'orbit') {
      this.unlock();
      if (this.orbitControls) {
        this.orbitControls.enabled = true;
        this.orbitControls.target.set(this.position.x, 1.2, this.position.z);
        this.orbitControls.update();
      }
    } else {
      if (this.orbitControls) {
        this.orbitControls.enabled = false;
      }
    }

    if (this.onCameraModeChange) {
      this.onCameraModeChange(this.cameraMode);
    }
  }

  toggleCameraMode() {
    const nextMode = this.cameraMode === 'third-person' ? 'orbit' : 'third-person';
    this.setCameraMode(nextMode);
    return nextMode;
  }

  addObstacle(obstacle) {
    this.obstacles.push(obstacle);
  }

  setObstacles(obstacles) {
    this.obstacles = Array.isArray(obstacles) ? obstacles : [];
  }

  /**
   * Configura dinámicamente la lista de obstáculos y límites según el escenario activo
   */
  setObstacles(obstacles, bounds) {
    if (Array.isArray(obstacles) && obstacles.length > 0) {
      this.obstacles = obstacles;
    }
    if (bounds) {
      this.bounds = bounds;
    }
    this._resolvePenetration();
  }

  /**
   * Empuja al jugador hacia afuera de cualquier pared si se encuentra penetrando una superficie
   */
  _resolvePenetration() {
    // 1. Límites del mapa (evita salir del terreno)
    if (this.position.x < this.bounds.minX + this.radius) this.position.x = this.bounds.minX + this.radius;
    if (this.position.x > this.bounds.maxX - this.radius) this.position.x = this.bounds.maxX - this.radius;
    if (this.position.z < this.bounds.minZ + this.radius) this.position.z = this.bounds.minZ + this.radius;
    if (this.position.z > this.bounds.maxZ - this.radius) this.position.z = this.bounds.maxZ - this.radius;

    // 2. Obstáculos sólidos (cajas y paredes)
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (obs.type === 'box') {
        const minX = obs.minX - this.radius;
        const maxX = obs.maxX + this.radius;
        const minZ = obs.minZ - this.radius;
        const maxZ = obs.maxZ + this.radius;

        if (
          this.position.x > minX &&
          this.position.x < maxX &&
          this.position.z > minZ &&
          this.position.z < maxZ
        ) {
          const distLeft = Math.abs(this.position.x - minX);
          const distRight = Math.abs(maxX - this.position.x);
          const distTop = Math.abs(this.position.z - minZ);
          const distBottom = Math.abs(maxZ - this.position.z);

          const minDist = Math.min(distLeft, distRight, distTop, distBottom);
          if (minDist === distLeft) this.position.x = minX - 0.02;
          else if (minDist === distRight) this.position.x = maxX + 0.02;
          else if (minDist === distTop) this.position.z = minZ - 0.02;
          else this.position.z = maxZ + 0.02;
        }
      } else if (obs.type === 'circle') {
        const dx = this.position.x - obs.x;
        const dz = this.position.z - obs.z;
        const distSq = dx * dx + dz * dz;
        const minDist = this.radius + obs.r;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const pushDist = minDist + 0.02;
            this.position.x = obs.x + (dx / dist) * pushDist;
            this.position.z = obs.z + (dz / dist) * pushDist;
          } else {
            this.position.x += minDist + 0.02;
          }
        }
      }
    }
  }

  /**
   * Comprueba si una coordenada (x, z) colisiona contra las paredes o estructuras sólidas
   */
  isColliding(x, z) {
    // 1. Límites del mapa
    if (
      x < this.bounds.minX + this.radius ||
      x > this.bounds.maxX - this.radius ||
      z < this.bounds.minZ + this.radius ||
      z > this.bounds.maxZ - this.radius
    ) {
      return true;
    }

    // 2. Obstáculos y paredes de la finca
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (obs.type === 'box') {
        if (
          x >= obs.minX - this.radius &&
          x <= obs.maxX + this.radius &&
          z >= obs.minZ - this.radius &&
          z <= obs.maxZ + this.radius
        ) {
          return true;
        }
      } else if (obs.type === 'circle') {
        const dx = x - obs.x;
        const dz = z - obs.z;
        const distSq = dx * dx + dz * dz;
        const minDist = this.radius + obs.r;
        if (distSq <= minDist * minDist) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Actualización por cuadro con delta time
   */
  update(delta) {
    // Si estamos en modo OrbitControls, la cámara es libre y el avatar permanece en reposo
    if (this.cameraMode === 'orbit') {
      if (this.orbitControls) {
        this.orbitControls.update();
      }
      if (this.mixer) {
        this.mixer.update(delta);
      }
      if (this.parts && this.parts.pelvis) {
        const breathTime = performance.now() * 0.002;
        this.parts.pelvis.position.y = 0.68 + Math.sin(breathTime) * 0.015;
        this.parts.torso.scale.y = 1.0 + Math.sin(breathTime) * 0.015;
      }
      return;
    }

    const speed = this.isSprinting ? this.runSpeed : this.walkSpeed;

    // Calcular dirección frontal y lateral de la cámara en el plano XZ
    this._cameraForward.set(
      -Math.sin(this.cameraYaw),
      0,
      -Math.cos(this.cameraYaw)
    ).normalize();

    this._cameraRight.set(
      Math.cos(this.cameraYaw),
      0,
      -Math.sin(this.cameraYaw)
    ).normalize();

    this._moveDirection.set(0, 0, 0);

    if (this.keys.forward) this._moveDirection.add(this._cameraForward);
    if (this.keys.backward) this._moveDirection.sub(this._cameraForward);
    if (this.keys.right) this._moveDirection.add(this._cameraRight);
    if (this.keys.left) this._moveDirection.sub(this._cameraRight);

    const isMoving = this._moveDirection.lengthSq() > 0.0001;

    if (isMoving) {
      this._moveDirection.normalize();

      const moveStep = speed * delta;
      const dx = this._moveDirection.x * moveStep;
      const dz = this._moveDirection.z * moveStep;

      // Desplazamiento y resolución de colisión con deslizamiento por paredes (Wall Sliding)
      const targetX = this.position.x + dx;
      if (!this.isColliding(targetX, this.position.z)) {
        this.position.x = targetX;
      }

      const targetZ = this.position.z + dz;
      if (!this.isColliding(this.position.x, targetZ)) {
        this.position.z = targetZ;
      }

      // Verificación estricta de límites y paredes
      this._resolvePenetration();

      // Suelo plano a nivel Y = 0 (los pies en Y=0)
      this.position.y = 0;

      // Rotar avatar suavemente hacia la dirección de avance
      const targetRotationY = Math.atan2(this._moveDirection.x, this._moveDirection.z);
      // Interpolación suave del ángulo
      let diff = targetRotationY - this.rotationY;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.rotationY += diff * Math.min(1, delta * 12);
    }

    // Actualizar posición del mesh
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;

    // Cadencia de pisadas para sonido y partículas de polvo tanto en GLB como en respaldo
    if (isMoving) {
      const cycleSpeed = this.isSprinting ? 12.5 : 8.0;
      this.walkCycle += delta * cycleSpeed;
      const sinVal = Math.sin(this.walkCycle);
      if ((this.prevCycleSin <= 0 && sinVal > 0) || (this.prevCycleSin >= 0 && sinVal < 0)) {
        if (this.onFootstep) this.onFootstep();
      }
      this.prevCycleSin = sinVal;
    }

    if (isMoving && this._isPlayingAction) {
      this._isPlayingAction = false;
    }

    if (this.mixer) {
      if (this.animations && !this._isPlayingAction) {
        const targetAnim = isMoving
          ? (this.isSprinting && this.animations.run ? 'run' : (this.animations.walk ? 'walk' : 'idle'))
          : 'idle';
        this._fadeToAnimation(targetAnim, 0.16);
      }
      this.mixer.update(delta);
    } else if (this.parts && this.parts.pelvis) {
      // ANIMACIONES PROCEDURALES DEL RESPALDO ARTICULADO (Agacharse, Caminar, Correr e Inactivo)
      if (this._isPlayingAction && this._actionTimer > 0) {
        this._actionTimer = Math.max(0, this._actionTimer - delta);
        const phase = Math.sin((1 - this._actionTimer / this._actionDuration) * Math.PI);
        this.parts.pelvis.position.y = 0.68 - 0.24 * phase;
        this.parts.torso.rotation.x = 0.72 * phase;
        this.parts.leftLeg.rotation.x = -0.55 * phase;
        this.parts.rightLeg.rotation.x = -0.55 * phase;
        this.parts.leftArm.rotation.x = -1.15 * phase;
        this.parts.rightArm.rotation.x = -1.15 * phase;
        if (this._actionTimer <= 0) {
          this._isPlayingAction = false;
        }
      } else if (isMoving) {
        const legAmplitude = this.isSprinting ? 0.85 : 0.50;
        const armAmplitude = this.isSprinting ? 0.85 : 0.50;
        const bobAmount = this.isSprinting ? 0.08 : 0.045;

        const sinVal = Math.sin(this.walkCycle);
        const cosVal = Math.cos(this.walkCycle);

        this.parts.leftLeg.rotation.x = sinVal * legAmplitude;
        this.parts.rightLeg.rotation.x = -sinVal * legAmplitude;
        this.parts.leftArm.rotation.x = -sinVal * armAmplitude;
        this.parts.rightArm.rotation.x = sinVal * armAmplitude;
        this.parts.pelvis.position.y = 0.68 + Math.abs(cosVal) * bobAmount;

        const targetTorsoLean = this.isSprinting ? 0.22 : 0.08;
        this.parts.torso.rotation.x = THREE.MathUtils.lerp(this.parts.torso.rotation.x, targetTorsoLean, delta * 10);
        this.parts.torso.rotation.y = sinVal * 0.06;
      } else {
        const returnSpeed = delta * 8;
        this.parts.leftLeg.rotation.x = THREE.MathUtils.lerp(this.parts.leftLeg.rotation.x, 0, returnSpeed);
        this.parts.rightLeg.rotation.x = THREE.MathUtils.lerp(this.parts.rightLeg.rotation.x, 0, returnSpeed);
        this.parts.leftArm.rotation.x = THREE.MathUtils.lerp(this.parts.leftArm.rotation.x, 0, returnSpeed);
        this.parts.rightArm.rotation.x = THREE.MathUtils.lerp(this.parts.rightArm.rotation.x, 0, returnSpeed);
        this.parts.torso.rotation.x = THREE.MathUtils.lerp(this.parts.torso.rotation.x, 0, returnSpeed);
        this.parts.torso.rotation.y = THREE.MathUtils.lerp(this.parts.torso.rotation.y, 0, returnSpeed);

        const breathTime = performance.now() * 0.002;
        this.parts.pelvis.position.y = 0.68 + Math.sin(breathTime) * 0.015;
        this.parts.torso.scale.y = 1.0 + Math.sin(breathTime) * 0.015;
      }
    }

    // Calcular posición de cámara en 3ra persona con esféricas
    const horizDist = this.cameraDistance * Math.cos(this.cameraPitch);
    const vertDist = this.cameraDistance * Math.sin(this.cameraPitch) + this.cameraHeight;

    this._desiredCameraPos.set(
      this.position.x + Math.sin(this.cameraYaw) * horizDist,
      Math.max(0.6, this.position.y + vertDist), // Asegura que nunca atraviese el suelo
      this.position.z + Math.cos(this.cameraYaw) * horizDist
    );

    // Suavizado de cámara (lerp)
    this.camera.position.lerp(this._desiredCameraPos, Math.min(1, delta * 14));

    // Mirar hacia la cabeza del agricultor
    this._cameraLookTarget.set(
      this.position.x,
      this.position.y + 1.4,
      this.position.z
    );
    this.camera.lookAt(this._cameraLookTarget);
  }

  getPosition() {
    return this.position;
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.mesh.position.copy(this.position);
  }
}
