import * as THREE from 'three';

/** Enjambres instanciados: geometría compartida, sin crear objetos por fotograma. */
export class PestVisualSystem {
  constructor(scene, plots, spread = 3) {
    this.scene = scene;
    this.time = 0;
    this.spread = spread;
    this.dummy = new THREE.Object3D();
    this.bodyGeometry = new THREE.SphereGeometry(0.055, 5, 4);
    this.wingGeometry = new THREE.PlaneGeometry(0.19, 0.08);
    this.ringGeometry = new THREE.RingGeometry(spread + 0.2, spread + 0.3, 48);
    this.plots = plots.map(plot => {
      const group = new THREE.Group();
      group.position.set(plot.x, 0, plot.z);
      group.name = `pest_swarm_${plot.id}`;
      const bodies = new THREE.InstancedMesh(this.bodyGeometry, new THREE.MeshBasicMaterial({ color: 0x30200d }), 36);
      const wings = new THREE.InstancedMesh(this.wingGeometry, new THREE.MeshBasicMaterial({ color: 0xfde68a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }), 36);
      bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      wings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      bodies.frustumCulled = wings.frustumCulled = false;
      const ring = new THREE.Mesh(this.ringGeometry, new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.23;
      group.add(bodies, wings, ring);
      scene.add(group);
      group.visible = false;
      return { id: plot.id, group, bodies, wings, ring, pressure: 0, relief: 0 };
    });
  }

  sync(state) {
    for (const visual of this.plots) {
      const plot = state.plots[visual.id];
      visual.pressure = plot?.isPlanted ? plot.pestPressure || 0 : 0;
      visual.protected = plot?.isPlanted && plot.pestProtectionDays > 0;
      visual.bodies.count = visual.wings.count = visual.pressure >= 15 ? Math.ceil(visual.pressure * 0.36) : 0;
      if (!plot?.isPlanted) visual.relief = 0;
    }
  }

  showTreatment(plotId) {
    const visual = this.plots.find(p => p.id === plotId);
    if (visual) visual.relief = 2.5;
  }

  update(delta) {
    this.time += Math.min(delta, 0.1);
    for (const p of this.plots) {
      p.relief = Math.max(0, p.relief - delta);
      p.group.visible = p.pressure >= 15 || p.protected || p.relief > 0;
      if (!p.group.visible) continue;
      const treated = p.relief > 0 || p.protected;
      p.ring.material.color.setHex(treated ? 0x34d399 : p.pressure >= 70 ? 0xef4444 : 0xf59e0b);
      p.ring.material.opacity = treated ? 0.25 : 0.3 + Math.sin(this.time * 2) * 0.1;
      p.ring.scale.setScalar(p.relief > 0 ? 1 + (2.5 - p.relief) * 0.12 : 1);
      for (let i = 0; i < p.bodies.count; i++) {
        const phase = this.time * (1.3 + (i % 5) * 0.17) + i * 2.399;
        const radius = this.spread * (0.25 + (i % 7) / 10);
        this.dummy.position.set(Math.cos(phase) * radius, 0.65 + (i % 4) * 0.25 + Math.sin(phase * 2) * 0.18, Math.sin(phase * 0.9) * radius);
        this.dummy.rotation.set(0, -phase, 0);
        this.dummy.scale.set(1, 0.65, 1.7);
        this.dummy.updateMatrix();
        p.bodies.setMatrixAt(i, this.dummy.matrix);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.rotation.z = Math.sin(this.time * 35 + i) * 0.9;
        this.dummy.updateMatrix();
        p.wings.setMatrixAt(i, this.dummy.matrix);
      }
      p.bodies.instanceMatrix.needsUpdate = p.wings.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const p of this.plots) {
      this.scene.remove(p.group);
      p.bodies.material.dispose();
      p.wings.material.dispose();
      p.ring.material.dispose();
    }
    this.bodyGeometry.dispose();
    this.wingGeometry.dispose();
    this.ringGeometry.dispose();
  }
}
