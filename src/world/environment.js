import * as THREE from 'three';
import { CropPlot } from './cropPlot.js';

/**
 * Entorno 3D Procedural Completo de la Finca Rural
 * Incluye: Terreno con caminos, Casa Rural, Granero, Tanque y Bomba de Agua,
 * 3 Parcelas con cultivos, Aspersores, Sensores IoT de humedad, Compostera,
 * Almacén de Cosecha, Cercas, Árboles y Vegetación low-poly.
 */
export class FarmEnvironment {
  constructor(scene, posicionesConfig) {
    this.scene = scene;
    this.config = posicionesConfig?.elementos || {};

    this.group = new THREE.Group();
    this.group.name = 'farm_environment';
    this.scene.add(this.group);

    // Referencias a elementos clave para interactividad
    this.waterPumpMesh = null;
    this.humiditySensorMesh = null;
    this.composterMesh = null;
    this.warehouseMesh = null;
    this.cropPlots = {};

    this._buildEnvironment();
  }

  _buildEnvironment() {
    this._createTerrain();
    this._createRuralHouse();
    this._createBarn();
    this._createWaterTankAndPump();
    this._createCropPlots();
    this._createHumiditySensors();
    this._createComposter();
    this._createWarehouseArea();
    this._createVegetationAndFences();
  }

  // 1. TERRENO CON CAMINOS
  _createTerrain() {
    // Terreno base
    const terrainGeo = new THREE.PlaneGeometry(80, 80, 20, 20);
    terrainGeo.rotateX(-Math.PI / 2);

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x4d7c0f, // Verde pasto rural
      roughness: 0.9,
      metalness: 0.05
    });

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    terrain.position.y = 0;
    this.group.add(terrain);

    // Camino rural de tierra (forma de cruz / senderos conectores)
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x854d0e, // Tierra compacta
      roughness: 1.0
    });

    // Sendero horizontal principal
    const pathMainGeo = new THREE.PlaneGeometry(4, 40);
    pathMainGeo.rotateX(-Math.PI / 2);
    const pathMain = new THREE.Mesh(pathMainGeo, pathMat);
    pathMain.position.set(0, 0.01, -2);
    pathMain.receiveShadow = true;
    this.group.add(pathMain);

    // Sendero transversal
    const pathCrossGeo = new THREE.PlaneGeometry(36, 3.5);
    pathCrossGeo.rotateX(-Math.PI / 2);
    const pathCross = new THREE.Mesh(pathCrossGeo, pathMat);
    pathCross.position.set(0, 0.012, 0);
    pathCross.receiveShadow = true;
    this.group.add(pathCross);
  }

  // 2. CASA RURAL
  _createRuralHouse() {
    const housePos = this.config.casaRural || { x: -16, y: 0, z: -14 };
    const houseGroup = new THREE.Group();
    houseGroup.position.set(housePos.x, housePos.y || 0, housePos.z);
    houseGroup.rotation.y = housePos.rotacionY || 0.2;
    houseGroup.name = 'casa_rural';

    // Paredes de mampostería blanca/crema
    const wallsGeo = new THREE.BoxGeometry(8, 4.5, 6.5);
    const wallsMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
    const walls = new THREE.Mesh(wallsGeo, wallsMat);
    walls.position.y = 2.25;
    walls.castShadow = true;
    walls.receiveShadow = true;
    houseGroup.add(walls);

    // Techo a dos aguas de tejas rojas
    const roofGeo = new THREE.ConeGeometry(5.8, 2.5, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x991b1b });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 5.75;
    roof.castShadow = true;
    houseGroup.add(roof);

    // Chimenea
    const chimneyGeo = new THREE.BoxGeometry(0.8, 2.2, 0.8);
    const chimneyMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(2, 6.0, 1.2);
    chimney.castShadow = true;
    houseGroup.add(chimney);

    // Puerta de madera
    const doorGeo = new THREE.BoxGeometry(1.2, 2.4, 0.1);
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x451a03 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.2, 3.3);
    houseGroup.add(door);

    // Ventanas
    const winGeo = new THREE.BoxGeometry(1.1, 1.1, 0.1);
    const winMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });
    const winLeft = new THREE.Mesh(winGeo, winMat);
    winLeft.position.set(-2.2, 2.4, 3.3);
    houseGroup.add(winLeft);

    const winRight = winLeft.clone();
    winRight.position.x = 2.2;
    houseGroup.add(winRight);

    this.group.add(houseGroup);
  }

  // 3. GRANERO RURAL
  _createBarn() {
    const barnPos = this.config.granero || { x: 16, y: 0, z: -14 };
    const barnGroup = new THREE.Group();
    barnGroup.position.set(barnPos.x, barnPos.y || 0, barnPos.z);
    barnGroup.rotation.y = barnPos.rotacionY || -0.2;
    barnGroup.name = 'granero';

    // Paredes de madera roja clásica de granero
    const barnWallsGeo = new THREE.BoxGeometry(9, 6.0, 7.5);
    const barnWallsMat = new THREE.MeshLambertMaterial({ color: 0xb91c1c });
    const barnWalls = new THREE.Mesh(barnWallsGeo, barnWallsMat);
    barnWalls.position.y = 3.0;
    barnWalls.castShadow = true;
    barnWalls.receiveShadow = true;
    barnGroup.add(barnWalls);

    // Techo abuhardillado
    const barnRoofGeo = new THREE.ConeGeometry(6.5, 3.0, 4);
    barnRoofGeo.rotateY(Math.PI / 4);
    const barnRoofMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const barnRoof = new THREE.Mesh(barnRoofGeo, barnRoofMat);
    barnRoof.position.y = 7.5;
    barnRoof.castShadow = true;
    barnGroup.add(barnRoof);

    // Gran puerta corredera
    const barnDoorGeo = new THREE.BoxGeometry(3.0, 3.5, 0.15);
    const barnDoorMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const barnDoor = new THREE.Mesh(barnDoorGeo, barnDoorMat);
    barnDoor.position.set(0, 1.75, 3.8);
    barnGroup.add(barnDoor);

    this.group.add(barnGroup);
  }

  // 4. TANQUE ELEVADO Y BOMBA DE AGUA
  _createWaterTankAndPump() {
    const tankPos = this.config.tanqueAgua || { x: -4, y: 0, z: -4 };
    const tankGroup = new THREE.Group();
    tankGroup.position.set(tankPos.x, tankPos.y || 0, tankPos.z);
    tankGroup.name = 'tanque_agua';

    // Patas de soporte de madera
    const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.5, 6);
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const offsets = [
      [-1.0, -1.0], [1.0, -1.0],
      [-1.0, 1.0], [1.0, 1.0]
    ];
    offsets.forEach(([ox, oz]) => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(ox, 2.25, oz);
      leg.castShadow = true;
      tankGroup.add(leg);
    });

    // Cilindro del tanque de agua
    const tankGeo = new THREE.CylinderGeometry(1.6, 1.6, 2.5, 12);
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Azul metálico
      roughness: 0.4,
      metalness: 0.6
    });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.y = 5.5;
    tank.castShadow = true;
    tankGroup.add(tank);

    // Tubería vertical que baja a la bomba
    const pipeGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
    const pipe = new THREE.Mesh(pipeGeo, metalMat);
    pipe.position.set(1.0, 2.1, 0.8);
    tankGroup.add(pipe);

    this.group.add(tankGroup);

    // BOMBA DE AGUA MECÁNICA INTERACTIVA
    const pumpPos = this.config.bombaAgua || { x: -3, y: 0, z: -3 };
    const pumpGroup = new THREE.Group();
    pumpGroup.position.set(pumpPos.x, pumpPos.y || 0, pumpPos.z);
    pumpGroup.name = 'bomba_agua';

    // Base de hormigón
    const baseGeo = new THREE.BoxGeometry(1.2, 0.4, 1.2);
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.2;
    base.receiveShadow = true;
    pumpGroup.add(base);

    // Motor de la bomba
    const motorGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10);
    motorGeo.rotateZ(Math.PI / 2);
    const motorMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a, // Verde industrial
      roughness: 0.5,
      metalness: 0.5
    });
    const motor = new THREE.Mesh(motorGeo, motorMat);
    motor.position.set(0, 0.7, 0);
    motor.castShadow = true;
    pumpGroup.add(motor);

    // Manómetro / Válvula roja
    const valveGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 8);
    const valveMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
    const valve = new THREE.Mesh(valveGeo, valveMat);
    valve.position.set(0, 1.15, 0);
    pumpGroup.add(valve);

    this.waterPumpMesh = pumpGroup;
    this.group.add(pumpGroup);
  }

  // 5. PARCELAS AGRÍCOLAS
  _createCropPlots() {
    const plotsConfig = this.config.parcelas || [
      { id: 'plot_1', nombre: 'Parcela 1 — Subsistencia', modo: 'subsistence', x: -12, z: 8, tipoCultivo: 'Maíz Tradicional' },
      { id: 'plot_2', nombre: 'Parcela 2 — Precisión', modo: 'precision', x: 0, z: 14, tipoCultivo: 'Hortalizas Tecnificadas' },
      { id: 'plot_3', nombre: 'Parcela 3 — Ecológica', modo: 'ecological', x: 12, z: 8, tipoCultivo: 'Policultivo Agroecológico' }
    ];

    plotsConfig.forEach(cfg => {
      const plot = new CropPlot(this.scene, cfg);
      this.cropPlots[cfg.id] = plot;
    });

    // Aspersores físicos en cada parcela
    const sprinklers = this.config.aspersores || [
      { id: 'sprinkler_1', x: -12, y: 1.2, z: 8 },
      { id: 'sprinkler_2', x: 0, y: 1.2, z: 14 },
      { id: 'sprinkler_3', x: 12, y: 1.2, z: 8 }
    ];

    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const nozzleGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.9, roughness: 0.2 });

    sprinklers.forEach(s => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(s.x, 0.6, s.z);
      post.castShadow = true;
      this.group.add(post);

      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      nozzle.position.set(s.x, 1.2, s.z);
      this.group.add(nozzle);
    });
  }

  // 6. SENSORES VIRTUALES IOT DE HUMEDAD
  _createHumiditySensors() {
    const sensorGroup = new THREE.Group();
    sensorGroup.position.set(0, 0, 10.5);
    sensorGroup.name = 'sensor_humedad';

    // Poste metálico
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 0.7;
    pole.castShadow = true;
    sensorGroup.add(pole);

    // Caja de control IoT
    const boxGeo = new THREE.BoxGeometry(0.3, 0.4, 0.2);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.y = 1.2;
    sensorGroup.add(box);

    // Mini panel solar
    const solarGeo = new THREE.BoxGeometry(0.45, 0.03, 0.35);
    solarGeo.rotateX(0.4);
    const solarMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.2, metalness: 0.7 });
    const solar = new THREE.Mesh(solarGeo, solarMat);
    solar.position.set(0, 1.45, 0);
    sensorGroup.add(solar);

    // LED indicador de estado de humedad (verde / ámbar)
    const ledGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 1.2, 0.12);
    sensorGroup.add(led);

    this.humiditySensorMesh = sensorGroup;
    this.humiditySensorLed = led;
    this.group.add(sensorGroup);
  }

  // 7. COMPOSTERA
  _createComposter() {
    const compPos = this.config.compostera || { x: 14, y: 0, z: 1 };
    const compGroup = new THREE.Group();
    compGroup.position.set(compPos.x, compPos.y || 0, compPos.z);
    compGroup.name = 'compostera';

    // Cajón de listones de madera
    const slatMat = new THREE.MeshLambertMaterial({ color: 0x5c3d2e });
    const size = 1.8;
    const height = 1.0;

    // Listones de madera
    const slatGeo = new THREE.BoxGeometry(size, 0.12, 0.08);
    for (let layer = 0; layer < 4; layer++) {
      const y = 0.15 + layer * 0.24;
      // Frontal
      const sFront = new THREE.Mesh(slatGeo, slatMat);
      sFront.position.set(0, y, size / 2);
      compGroup.add(sFront);
      // Trasero
      const sBack = sFront.clone();
      sBack.position.z = -size / 2;
      compGroup.add(sBack);
    }

    // Abono orgánico oscuro en el interior
    const soilGeo = new THREE.BoxGeometry(size - 0.2, 0.7, size - 0.2);
    const soilMat = new THREE.MeshLambertMaterial({ color: 0x1a0f07 });
    const soil = new THREE.Mesh(soilGeo, soilMat);
    soil.position.y = 0.35;
    compGroup.add(soil);

    this.composterMesh = compGroup;
    this.group.add(compGroup);
  }

  // 8. ÁREA DE ALMACENAMIENTO Y COSECHA (Warehouse AABB)
  _createWarehouseArea() {
    const wPos = this.config.almacenCosecha || { x: 12, y: 0, z: -8 };
    const wGroup = new THREE.Group();
    wGroup.position.set(wPos.x, wPos.y || 0, wPos.z);
    wGroup.name = 'almacen_cosecha';

    // Cobertizo abierto con techo de chapa
    const roofGeo = new THREE.BoxGeometry(6.5, 0.15, 6.0);
    roofGeo.rotateZ(0.08);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.3 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 3.4, 0);
    roof.castShadow = true;
    wGroup.add(roof);

    // Pilares de madera de soporte
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.4, 6);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
    const postsCoords = [
      [-2.8, -2.5], [2.8, -2.5],
      [-2.8, 2.5], [2.8, 2.5]
    ];
    postsCoords.forEach(([px, pz]) => {
      const p = new THREE.Mesh(postGeo, postMat);
      p.position.set(px, 1.7, pz);
      p.castShadow = true;
      wGroup.add(p);
    });

    // Tarima de madera
    const deckGeo = new THREE.BoxGeometry(6.2, 0.2, 5.8);
    const deckMat = new THREE.MeshLambertMaterial({ color: 0xa16207 });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = 0.1;
    deck.receiveShadow = true;
    wGroup.add(deck);

    this.warehouseMesh = wGroup;
    this.group.add(wGroup);
  }

  // 9. VEGETACIÓN LOW-POLY, CERCAS Y ROCAS
  _createVegetationAndFences() {
    // Árboles de pino y roble low poly
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3d2e });
    const foliagePineMat = new THREE.MeshLambertMaterial({ color: 0x166534 });
    const foliageOakMat = new THREE.MeshLambertMaterial({ color: 0x15803d });

    const treePositions = [
      { x: -28, z: -20, type: 'pine', scale: 1.2 },
      { x: -30, z: -10, type: 'oak', scale: 1.0 },
      { x: -25, z: 12, type: 'pine', scale: 0.9 },
      { x: -28, z: 25, type: 'oak', scale: 1.3 },
      { x: 28, z: -25, type: 'oak', scale: 1.1 },
      { x: 26, z: 22, type: 'pine', scale: 1.2 },
      { x: 30, z: 8, type: 'pine', scale: 1.0 },
      { x: -6, z: -25, type: 'oak', scale: 1.0 },
      { x: 6, z: -25, type: 'pine', scale: 1.1 }
    ];

    treePositions.forEach(t => {
      const tree = new THREE.Group();
      tree.position.set(t.x, 0, t.z);
      tree.scale.set(t.scale, t.scale, t.scale);

      // Tronco
      const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.0, 6);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.0;
      trunk.castShadow = true;
      tree.add(trunk);

      if (t.type === 'pine') {
        // Conos superpuestos de pino
        for (let c = 0; c < 3; c++) {
          const coneGeo = new THREE.ConeGeometry(1.8 - c * 0.4, 1.8, 6);
          const cone = new THREE.Mesh(coneGeo, foliagePineMat);
          cone.position.y = 2.4 + c * 1.2;
          cone.castShadow = true;
          tree.add(cone);
        }
      } else {
        // Copa esférica facetada de roble
        const foliageGeo = new THREE.DodecahedronGeometry(1.8);
        const foliage = new THREE.Mesh(foliageGeo, foliageOakMat);
        foliage.position.y = 3.2;
        foliage.castShadow = true;
        tree.add(foliage);
      }

      this.group.add(tree);
    });

    // Cercas perimetrales de madera rústica
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0x92400e });
    const postGeo = new THREE.BoxGeometry(0.12, 1.1, 0.12);
    const railGeo = new THREE.BoxGeometry(3.0, 0.1, 0.06);

    // Tramo de cerca norte
    for (let x = -30; x <= 30; x += 3) {
      const post = new THREE.Mesh(postGeo, fenceMat);
      post.position.set(x, 0.55, -34);
      post.castShadow = true;
      this.group.add(post);

      if (x < 30) {
        const rail1 = new THREE.Mesh(railGeo, fenceMat);
        rail1.position.set(x + 1.5, 0.4, -34);
        this.group.add(rail1);

        const rail2 = rail1.clone();
        rail2.position.y = 0.8;
        this.group.add(rail2);
      }
    }
  }

  getPlot(plotId) {
    return this.cropPlots[plotId];
  }

  getAllPlots() {
    return this.cropPlots;
  }
}
