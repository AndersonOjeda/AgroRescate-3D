import * as CANNON from 'cannon-es';
import * as THREE from 'three';

/**
 * Módulo de Físicas 3D con Cannon-es
 * Incluye gravedad -9.81, suelo estático, cajas agrícolas con masa, fricción y restitución,
 * y sincronización precisa con los meshes de Three.js usando paso temporal fijo.
 */
export class PhysicsWorld {
  constructor(scene) {
    this.scene = scene;

    // 1. Inicializar Mundo Físico de Cannon-es
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.81, 0);

    // Algoritmo de broadphase para rendimiento óptimo
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    // Materiales físicos y coeficientes de fricción y rebote (restitución)
    this.groundMaterial = new CANNON.Material('ground');
    this.boxMaterial = new CANNON.Material('box');

    const boxGroundContact = new CANNON.ContactMaterial(
      this.groundMaterial,
      this.boxMaterial,
      {
        friction: 0.45,
        restitution: 0.35 // Rebote elástico visible para demostración
      }
    );
    this.world.addContactMaterial(boxGroundContact);

    const boxBoxContact = new CANNON.ContactMaterial(
      this.boxMaterial,
      this.boxMaterial,
      {
        friction: 0.4,
        restitution: 0.25
      }
    );
    this.world.addContactMaterial(boxBoxContact);

    // Lista de sincronización de cuerpos físicos con meshes de Three.js
    this.syncBodies = [];

    // 2. Crear suelo físico estático a Y = 0 y paredes de estructuras
    this._createStaticGround();
    this._createStaticObstacles();

    // 3. Crear cuerpo cinemático del jugador para interactuar físicamente empujando cajas
    this.playerBody = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Sphere(0.65),
      position: new CANNON.Vec3(0, 0.7, -2)
    });
    this.world.addBody(this.playerBody);

    // 4. Crear cajas agrícolas dinámicas iniciales
    this.crates = [];
  }

  _createStaticGround() {
    // Suelo infinito orientado hacia +Y (rotado -PI/2 en X)
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: this.groundMaterial
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    groundBody.position.set(0, 0, 0);
    this.world.addBody(groundBody);
    this.groundBody = groundBody;
  }

  _createStaticObstacles() {
    // 1. Paredes de la Casa Rural en Cannon-es
    const houseShape = new CANNON.Box(new CANNON.Vec3(4.2, 3.0, 3.4));
    const houseBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: houseShape,
      position: new CANNON.Vec3(-16, 2.25, -14),
      material: this.groundMaterial
    });
    this.world.addBody(houseBody);

    // 2. Paredes del Granero en Cannon-es
    const barnShape = new CANNON.Box(new CANNON.Vec3(4.7, 3.5, 3.9));
    const barnBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: barnShape,
      position: new CANNON.Vec3(16, 3.0, -14),
      material: this.groundMaterial
    });
    this.world.addBody(barnBody);
  }

  /**
   * Crea una caja agrícola dinámica con física real
   */
  createCrate({ id, x = 12, y = 3, z = -7, size = [0.9, 0.9, 0.9], mass = 5, color = 0xd97706 }) {
    const halfExtents = new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2);
    const boxShape = new CANNON.Box(halfExtents);

    const body = new CANNON.Body({
      mass: mass,
      shape: boxShape,
      position: new CANNON.Vec3(x, y, z),
      material: this.boxMaterial,
      linearDamping: 0.05,
      angularDamping: 0.05
    });

    // Pequeño impulso angular aleatorio para que ruede y muestre rebote natural
    body.angularVelocity.set(
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5
    );

    this.world.addBody(body);

    // Mesh correspondiente en Three.js (textura / estilo de huacal de madera)
    const boxGeo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const boxMat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.8,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(boxGeo, boxMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = id || `crate_${this.syncBodies.length + 1}`;
    this.scene.add(mesh);

    const syncItem = { body, mesh, id: mesh.name, initialPos: { x, y, z } };
    this.syncBodies.push(syncItem);
    this.crates.push(syncItem);

    return syncItem;
  }

  /**
   * Deja caer una caja desde altura para demostración en vivo (tecla F o botón HUD)
   */
  dropDemoCrate(playerPos) {
    const spawnX = playerPos ? playerPos.x + (Math.random() * 2 - 1) : 0;
    const spawnZ = playerPos ? playerPos.z + (Math.random() * 2 - 1) : 0;
    const spawnY = Math.max(5.0, (playerPos ? playerPos.y : 0) + 5.0);

    const crate = this.createCrate({
      id: `demo_crate_${Date.now()}`,
      x: spawnX,
      y: spawnY,
      z: spawnZ,
      size: [0.8, 0.8, 0.8],
      mass: 4,
      color: 0xeab308 // Amarillo dorado agrícola
    });

    // Impulso inicial
    crate.body.velocity.set(
      (Math.random() - 0.5) * 2,
      -1,
      (Math.random() - 0.5) * 2
    );

    return crate;
  }

  /**
   * Resetea la posición de las cajas fijas del almacén
   */
  resetCrates() {
    this.crates.forEach(crate => {
      crate.body.position.set(crate.initialPos.x, crate.initialPos.y, crate.initialPos.z);
      crate.body.velocity.set(0, 0, 0);
      crate.body.angularVelocity.set(0, 0, 0);
      crate.body.quaternion.set(0, 0, 0, 1);
    });
  }

  /**
   * Actualiza la posición del cuerpo cinemático del jugador para empujar objetos físicos
   */
  updatePlayerPosition(playerPos) {
    if (this.playerBody && playerPos) {
      this.playerBody.position.set(playerPos.x, playerPos.y + 0.7, playerPos.z);
    }
  }

  /**
   * Paso temporal fijo de Cannon-es: world.step(1/60, deltaTime, 3)
   * seguido de la sincronización de matrices de posición y rotación con Three.js
   */
  step(deltaTime) {
    const fixedTimeStep = 1 / 60;
    const maxSubSteps = 3;
    this.world.step(fixedTimeStep, deltaTime, maxSubSteps);

    // Sincronizar posición y rotación de Cannon hacia Three.js
    for (let i = 0; i < this.syncBodies.length; i++) {
      const { body, mesh } = this.syncBodies[i];
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
  }

  getBodiesCount() {
    return this.syncBodies.length;
  }
}
