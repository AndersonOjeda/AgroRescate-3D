import * as THREE from 'three';

/**
 * WildlifeSystem — Sistema de Fauna Ligera, Polinizadores y Vida Ambiental.
 * - Mariposas y Abejas con vuelo en lemniscata/espiral sobre flores y cultivos ecológicos.
 * - Luciérnagas nocturnas flotantes de bajo costo computacional (THREE.Points).
 * - Aves lejanas en el horizonte andino.
 * Cero physics/Cannon-es en fauna; 60 FPS estables en Android.
 */
export class WildlifeSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'wildlife_system';
    this.scene.add(this.group);

    this.time = 0;
    this.butterflies = [];
    this.bees = [];

    this._createPollinators();
    this._createFireflies();
    this._createHighBirds();
  }

  _createPollinators() {
    // 1. Mariposas (low-poly con 2 alas que aletean)
    const wingGeo = new THREE.BufferGeometry();
    const wingVerts = new Float32Array([
      0, 0, 0,
      0.15, 0.12, 0,
      0.14, -0.08, 0
    ]);
    wingGeo.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));
    wingGeo.computeVertexNormals();

    const butterflyColors = [0xf59e0b, 0x38bdf8, 0xec4899, 0xa855f7];

    // Spawns cerca de flores ecológicas y huertas
    const flowerCenters = [
      { x: -10, y: 0.8, z: -10 },
      { x: -6, y: 0.7, z: -14 },
      { x: 10, y: 0.8, z: 10 },
      { x: 0, y: 0.9, z: -2 }
    ];

    for (let i = 0; i < 6; i++) {
      const bGroup = new THREE.Group();
      const col = butterflyColors[i % butterflyColors.length];
      const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });

      const leftWing = new THREE.Mesh(wingGeo, mat);
      const rightWing = new THREE.Mesh(wingGeo, mat);
      rightWing.scale.x = -1;

      bGroup.add(leftWing);
      bGroup.add(rightWing);

      const center = flowerCenters[i % flowerCenters.length];
      bGroup.position.set(center.x + (Math.random() - 0.5) * 3, center.y, center.z + (Math.random() - 0.5) * 3);

      this.group.add(bGroup);
      this.butterflies.push({
        group: bGroup,
        leftWing,
        rightWing,
        center: new THREE.Vector3(center.x, center.y, center.z),
        speed: 1.2 + Math.random() * 0.8,
        radius: 1.2 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2
      });
    }

    // 2. Abejas (pequeños óvalos dorados zumbando)
    const beeGeo = new THREE.SphereGeometry(0.045, 4, 4);
    const beeMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
    for (let i = 0; i < 4; i++) {
      const bee = new THREE.Mesh(beeGeo, beeMat);
      const center = flowerCenters[i % flowerCenters.length];
      bee.position.set(center.x, center.y + 0.3, center.z);
      this.group.add(bee);
      this.bees.push({
        mesh: bee,
        center: new THREE.Vector3(center.x, center.y + 0.2, center.z),
        speed: 2.2 + Math.random() * 1.0,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  _createFireflies() {
    this.fireflyCount = 35;
    this.fireflyPositions = new Float32Array(this.fireflyCount * 3);

    for (let i = 0; i < this.fireflyCount; i++) {
      this.fireflyPositions[i * 3] = (Math.random() - 0.5) * 34;
      this.fireflyPositions[i * 3 + 1] = 0.4 + Math.random() * 1.8;
      this.fireflyPositions[i * 3 + 2] = (Math.random() - 0.5) * 34;
    }

    this.fireflyGeo = new THREE.BufferGeometry();
    this.fireflyGeo.setAttribute('position', new THREE.BufferAttribute(this.fireflyPositions, 3));

    this.fireflyMat = new THREE.PointsMaterial({
      color: 0xa3e635,
      size: 0.22,
      transparent: true,
      opacity: 0.0, // Solo visible de noche/atardecer
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.fireflyPoints = new THREE.Points(this.fireflyGeo, this.fireflyMat);
    this.fireflyPoints.frustumCulled = false;
    this.group.add(this.fireflyPoints);
  }

  _createHighBirds() {
    // 3 siluetas de pájaros lejanos en formación sobre el horizonte andino
    this.birdsGroup = new THREE.Group();
    const birdMat = new THREE.LineBasicMaterial({ color: 0x1e293b, linewidth: 2 });

    for (let i = 0; i < 3; i++) {
      const bGeo = new THREE.BufferGeometry();
      const pts = new Float32Array([
        -0.4, -0.1, 0,
        0, 0, 0,
        0.4, -0.1, 0
      ]);
      bGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const bMesh = new THREE.Line(bGeo, birdMat);
      bMesh.position.set((i - 1) * 3, 24 + i * 1.2, (i - 1) * 2);
      this.birdsGroup.add(bMesh);
    }

    this.group.add(this.birdsGroup);
  }

  update(delta, isNight = false) {
    this.time += delta;

    // Aleteo y trayectoria de mariposas
    const flap = Math.sin(this.time * 16);
    this.butterflies.forEach((b) => {
      b.leftWing.rotation.y = flap * 0.85;
      b.rightWing.rotation.y = -flap * 0.85;

      const t = this.time * b.speed + b.phase;
      // Trayectoria en forma de 8 (lemniscata) suave
      b.group.position.x = b.center.x + Math.sin(t) * b.radius;
      b.group.position.z = b.center.z + Math.sin(t * 2) * (b.radius * 0.5);
      b.group.position.y = b.center.y + Math.sin(t * 3) * 0.25;
      b.group.rotation.y = Math.atan2(Math.cos(t * 2), Math.cos(t));
    });

    // Vuelo rápido de abejas
    this.bees.forEach((bee) => {
      const t = this.time * bee.speed + bee.phase;
      bee.mesh.position.x = bee.center.x + Math.cos(t * 1.4) * 0.9;
      bee.mesh.position.z = bee.center.z + Math.sin(t * 1.8) * 0.9;
      bee.mesh.position.y = bee.center.y + Math.sin(t * 4) * 0.15;
    });

    // Luciérnagas (brillan de noche o al anochecer)
    const targetFireflyOp = isNight ? 0.85 : 0.0;
    this.fireflyMat.opacity = THREE.MathUtils.lerp(this.fireflyMat.opacity, targetFireflyOp, delta * 2.0);

    if (this.fireflyMat.opacity > 0.05) {
      const pos = this.fireflyPositions;
      for (let i = 0; i < this.fireflyCount; i++) {
        pos[i * 3 + 1] += Math.sin(this.time * 2 + i) * 0.003;
      }
      this.fireflyGeo.attributes.position.needsUpdate = true;
    }

    // Aves lejanas orbitando sobre la finca
    if (this.birdsGroup) {
      this.birdsGroup.rotation.y += delta * 0.08;
    }
  }

  dispose() {
    if (this.fireflyGeo) this.fireflyGeo.dispose();
    if (this.fireflyMat) this.fireflyMat.dispose();
    if (this.group) this.scene.remove(this.group);
  }
}
