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
    // Materiales comunes según salud
    this.healthyMat = new THREE.MeshLambertMaterial({ color: 0x22c55e }); // Verde vivo
    this.witheredMat = new THREE.MeshLambertMaterial({ color: 0x785338 }); // Marchito marrón

    // Materiales específicos por tipo de cultivo
    this.cornFruitMat = new THREE.MeshLambertMaterial({ color: 0xeab308 }); // Mazorca dorada
    this.tomatoFruitMat = new THREE.MeshLambertMaterial({ color: 0xef4444 }); // Tomate rojo
    this.sunflowerMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 }); // Girasol amarillo brillante
    this.pumpkinMat = new THREE.MeshLambertMaterial({ color: 0xf97316 }); // Calabaza naranja

    // Tubos de microriego por goteo para agricultura de precisión
    if (this.mode === 'precision') {
      const dripMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
      const dripGeo = new THREE.CylinderGeometry(0.03, 0.03, this.depth - 0.4, 6);
      dripGeo.rotateX(Math.PI / 2);

      for (let c = 0; c < this.cols; c++) {
        const x = -this.width / 2 + (this.width / (this.cols + 1)) * (c + 1) + 0.15;
        const dripPipe = new THREE.Mesh(dripGeo, dripMat);
        dripPipe.position.set(x, 0.16, 0);
        this.group.add(dripPipe);
      }
    }

    // Geometrías para las plantas
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 1.0, 5);
    stemGeo.translate(0, 0.5, 0);

    const leafGeo = new THREE.ConeGeometry(0.2, 0.5, 4);
    leafGeo.rotateZ(Math.PI / 4);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = -this.width / 2 + (this.width / (this.cols + 1)) * (c + 1);
        const z = -this.depth / 2 + (this.depth / (this.rows + 1)) * (r + 1);

        const plantGroup = new THREE.Group();
        plantGroup.position.set(x, 0.15, z);

        // Tallo base
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

        // Fruto / Flor según la filosofía agrícola
        let fruitMesh;
        if (this.mode === 'subsistence') {
          // Maíz tradicional: Mazorcas alargadas
          const earGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.45, 6);
          fruitMesh = new THREE.Mesh(earGeo, this.cornFruitMat);
          fruitMesh.position.set(0, 0.8, 0.1);
          fruitMesh.rotation.x = 0.25;
        } else if (this.mode === 'precision') {
          // Hortalizas tecnificadas: Tomates esféricos rojos
          const tomatoGeo = new THREE.SphereGeometry(0.16, 8, 8);
          fruitMesh = new THREE.Mesh(tomatoGeo, this.tomatoFruitMat);
          fruitMesh.position.set(0, 0.9, 0);
        } else {
          // Policultivo agroecológico: Girasoles y calabazas alternados
          if ((r + c) % 2 === 0) {
            // Girasol con centro oscuro y corona de pétalos
            const flowerGroup = new THREE.Group();
            const petalGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 10);
            petalGeo.rotateX(Math.PI / 2);
            const petals = new THREE.Mesh(petalGeo, this.sunflowerMat);
            flowerGroup.add(petals);

            const centerGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.07, 8);
            centerGeo.rotateX(Math.PI / 2);
            const center = new THREE.Mesh(centerGeo, new THREE.MeshLambertMaterial({ color: 0x451a03 }));
            flowerGroup.add(center);

            flowerGroup.position.set(0, 1.1, 0);
            fruitMesh = flowerGroup;
          } else {
            // Calabaza en la base
            const pumpkinGeo = new THREE.SphereGeometry(0.22, 8, 8);
            pumpkinGeo.scale(1.2, 0.8, 1.2);
            fruitMesh = new THREE.Mesh(pumpkinGeo, this.pumpkinMat);
            fruitMesh.position.set(0, 0.25, 0.15);
          }
        }

        fruitMesh.castShadow = true;
        fruitMesh.name = 'fruit';
        plantGroup.add(fruitMesh);

        this.group.add(plantGroup);
        this.plants.push({ group: plantGroup, stem, fruit: fruitMesh, leaf1, leaf2 });
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
