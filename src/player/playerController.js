import * as THREE from 'three';

/**
 * Controlador del Jugador en Tercera Persona con avatar low-poly,
 * rotación suave de cámara, colisiones con límites y soporte de Pointer Lock.
 */
export class PlayerController {
  constructor(camera, domElement, scene) {
    this.camera = camera;
    this.domElement = domElement;
    this.scene = scene;

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

    // Crear avatar visual del agricultor
    this.mesh = this._createFarmerAvatar();
    this.scene.add(this.mesh);
    this.mesh.position.copy(this.position);

    this._setupInputListeners();
  }

  /**
   * Crea un avatar low-poly estilizado de agricultor con sombrero y overol
   */
  _createFarmerAvatar() {
    const group = new THREE.Group();
    group.name = 'player_farmer';

    // Materiales compartidos
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffd1b3 });
    const hatMat = new THREE.MeshLambertMaterial({ color: 0xd4a373 }); // Paja
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x2563eb }); // Camisa azul
    const overallMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a }); // Overol
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x451a03 }); // Botas marrón

    // Torso / Camisa y overol
    const torsoGeo = new THREE.BoxGeometry(0.7, 0.8, 0.45);
    const torso = new THREE.Mesh(torsoGeo, overallMat);
    torso.position.y = 0.9;
    torso.castShadow = true;
    torso.receiveShadow = true;
    group.add(torso);

    // Cabeza
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.55;
    head.castShadow = true;
    group.add(head);

    // Sombrero campesino (ala y copa)
    const hatBrimGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.06, 12);
    const hatBrim = new THREE.Mesh(hatBrimGeo, hatMat);
    hatBrim.position.y = 1.8;
    hatBrim.castShadow = true;
    group.add(hatBrim);

    const hatTopGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.35, 12);
    const hatTop = new THREE.Mesh(hatTopGeo, hatMat);
    hatTop.position.y = 2.0;
    hatTop.castShadow = true;
    group.add(hatTop);

    // Piernas / Botas
    const legGeo = new THREE.BoxGeometry(0.25, 0.55, 0.3);
    const leftLeg = new THREE.Mesh(legGeo, bootMat);
    leftLeg.position.set(-0.2, 0.28, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, bootMat);
    rightLeg.position.set(0.2, 0.28, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Brazos
    const armGeo = new THREE.BoxGeometry(0.2, 0.65, 0.22);
    const leftArm = new THREE.Mesh(armGeo, shirtMat);
    leftArm.position.set(-0.48, 0.9, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, shirtMat);
    rightArm.position.set(0.48, 0.9, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    return group;
  }

  _setupInputListeners() {
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
      this.domElement.requestPointerLock();
    }
  }

  unlock() {
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  /**
   * Actualización por cuadro con delta time
   */
  update(delta) {
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

      // Mover al jugador con delta time constante
      this.position.x += this._moveDirection.x * speed * delta;
      this.position.z += this._moveDirection.z * speed * delta;

      // Restricción dentro de los límites del terreno
      this.position.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.position.x));
      this.position.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, this.position.z));

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

    // Balanceo sutil de caminata
    if (isMoving) {
      const walkTime = performance.now() * 0.008 * (this.isSprinting ? 1.5 : 1.0);
      this.mesh.position.y = Math.abs(Math.sin(walkTime)) * 0.08;
    } else {
      this.mesh.position.y = 0;
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
