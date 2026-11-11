import * as THREE from 'three';

/**
 * Representación Visual de una Parcela Agrícola con 4 a 5 Estados de Cultivo:
 * 0: Parcela sin sembrar (surcos de tierra arada)
 * 1: Semilla / brote (brotes verdes emergentes)
 * 2: Planta en crecimiento (tallos medianos)
 * 3: Planta madura (cultivo listo para cosecha)
 * 4: Planta marchita / deteriorada (coloración seca por déficit hídrico)
 *
 * Utiliza instancias y geometrías low poly compartidas para máximo rendimiento (60 FPS).
 */
export class CropPlot {
  constructor(scene, config) {
    this.scene = scene;
    this.id = config.id || 'plot_1';
    this.name = config.nombre || 'Parcela';
    this.mode = config.modo || 'subsistence';
    this.cropType = config.tipoCultivo || 'Maíz Tradicional';
    this.position = new THREE.Vector3(config.x, config.y || 0.05, config.z);
    this.width = config.width || 7;
    this.depth = config.depth || 7;
    this.rows = config.filas || 4;
    this.cols = config.columnas || 4;

    this.group = new THREE.Group();
    this.group.name = `crop_plot_${this.id}`;
    this.group.position.copy(this.position);
    this.scene.add(this.group);

    // Estado del cultivo: 0 a 4
    this.visualState = 0;

    // Crear base de tierra arada con surcos
    this._createPlotBase();

    // Crear plantas organizadas en cuadrícula de surcos
    this.plants = [];
    this._createPlantMeshes();

    // Actualizar visualización al estado inicial (0 = sin sembrar)
    this.setVisualState(0);
  }

  _createPlotBase() {
    // Parcela de tierra fértil
    const baseGeo = new THREE.BoxGeometry(this.width, 0.15, this.depth);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x3d2314, // Tierra húmeda oscura
      roughness: 0.95,
      metalness: 0.05
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.075;
    baseMesh.receiveShadow = true;
    this.group.add(baseMesh);

    // Borde de madera perimetral rústico
    const borderMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });
    const thickness = 0.15;
    const height = 0.25;

    // Bordes laterales
    const sideGeo = new THREE.BoxGeometry(thickness, height, this.depth + thickness * 2);
    const leftBorder = new THREE.Mesh(sideGeo, borderMat);
    leftBorder.position.set(-this.width / 2 - thickness / 2, height / 2, 0);
    leftBorder.castShadow = true;
    this.group.add(leftBorder);

    const rightBorder = leftBorder.clone();
    rightBorder.position.x = this.width / 2 + thickness / 2;
    this.group.add(rightBorder);

    // Bordes frontales
    const frontGeo = new THREE.BoxGeometry(this.width, height, thickness);
    const frontBorder = new THREE.Mesh(frontGeo, borderMat);
    frontBorder.position.set(0, height / 2, this.depth / 2 + thickness / 2);
    frontBorder.castShadow = true;
    this.group.add(frontBorder);

    const backBorder = frontBorder.clone();
    backBorder.position.z = -this.depth / 2 - thickness / 2;
    this.group.add(backBorder);

    // Surcos de cultivo
    const furrowMat = new THREE.MeshStandardMaterial({ color: 0x2b170c, roughness: 1.0 });
    const furrowGeo = new THREE.CylinderGeometry(0.12, 0.12, this.depth - 0.4, 6);
    furrowGeo.rotateX(Math.PI / 2);

    for (let c = 0; c < this.cols; c++) {
      const x = -this.width / 2 + (this.width / (this.cols + 1)) * (c + 1);
      const furrow = new THREE.Mesh(furrowGeo, furrowMat);
      furrow.position.set(x, 0.18, 0);
      furrow.receiveShadow = true;
      this.group.add(furrow);
    }
  }

  _createPlantMeshes() {
    // Geometrías compartidas para los tallos y hojas
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 1.0, 5);
    stemGeo.translate(0, 0.5, 0);

    const leafGeo = new THREE.ConeGeometry(0.2, 0.5, 4);
    leafGeo.rotateZ(Math.PI / 4);

    // Materiales según salud de la planta
    this.healthyMat = new THREE.MeshLambertMaterial({ color: 0x22c55e }); // Verde vivo
    this.matureFruitMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b }); // Fruto dorado/naranja
    this.witheredMat = new THREE.MeshLambertMaterial({ color: 0x785338 }); // Marchito marrón

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = -this.width / 2 + (this.width / (this.cols + 1)) * (c + 1);
        const z = -this.depth / 2 + (this.depth / (this.rows + 1)) * (r + 1);

        const plantGroup = new THREE.Group();
        plantGroup.position.set(x, 0.15, z);

        // Tallo
        const stem = new THREE.Mesh(stemGeo, this.healthyMat);
        stem.castShadow = true;
        plantGroup.add(stem);

        // Hojas
        const leaf1 = new THREE.Mesh(leafGeo, this.healthyMat);
        leaf1.position.set(0.1, 0.5, 0);
        leaf1.castShadow = true;
        plantGroup.add(leaf1);

        const leaf2 = leaf1.clone();
        leaf2.rotation.y = Math.PI;
        leaf2.position.set(-0.1, 0.6, 0);
        plantGroup.add(leaf2);

        // Fruto / Espiga (visible solo cuando madura)
        const fruitGeo = new THREE.DodecahedronGeometry(0.18);
        const fruit = new THREE.Mesh(fruitGeo, this.matureFruitMat);
        fruit.position.set(0, 1.0, 0);
        fruit.castShadow = true;
        fruit.name = 'fruit';
        plantGroup.add(fruit);

        this.group.add(plantGroup);
        this.plants.push({ group: plantGroup, stem, fruit, leaf1, leaf2 });
      }
    }
  }

  /**
   * Actualiza el estado visual del cultivo:
   * 0: Vacío / Sin sembrar
   * 1: Brote
   * 2: Creciendo
   * 3: Madura lista para cosechar
   * 4: Deteriorada / Marchita
   */
  setVisualState(state) {
    this.visualState = state;

    for (let i = 0; i < this.plants.length; i++) {
      const { group, stem, fruit, leaf1, leaf2 } = this.plants[i];

      switch (state) {
        case 0: // Parcela sin sembrar
          group.visible = false;
          break;

        case 1: // Brote inicial
          group.visible = true;
          group.scale.set(0.2, 0.2, 0.2);
          fruit.visible = false;
          stem.material = this.healthyMat;
          leaf1.material = this.healthyMat;
          leaf2.material = this.healthyMat;
          break;

        case 2: // Planta en crecimiento
          group.visible = true;
          group.scale.set(0.65, 0.65, 0.65);
          fruit.visible = false;
          stem.material = this.healthyMat;
          leaf1.material = this.healthyMat;
          leaf2.material = this.healthyMat;
          break;

        case 3: // Planta madura
          group.visible = true;
          group.scale.set(1.0, 1.0, 1.0);
          fruit.visible = true;
          stem.material = this.healthyMat;
          leaf1.material = this.healthyMat;
          leaf2.material = this.healthyMat;
          break;

        case 4: // Marchita / Deteriorada
          group.visible = true;
          group.scale.set(0.75, 0.75, 0.75);
          fruit.visible = false;
          stem.material = this.witheredMat;
          leaf1.material = this.witheredMat;
          leaf2.material = this.witheredMat;
          break;
      }
    }
  }

  getVisualState() {
    return this.visualState;
  }
}
