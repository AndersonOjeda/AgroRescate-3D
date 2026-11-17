import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { attachHoeAtHand, solveSupportGrip } from '../src/player/toolGrip.js';

describe('Agarre y apoyo articulado', () => {
  it('reduce el error entre la mano de apoyo y el mango', () => {
    const root = new THREE.Group();
    const upper = new THREE.Bone();
    const fore = new THREE.Bone();
    root.add(upper); upper.add(fore); fore.position.x = 1;
    const offset = new THREE.Vector3(1, 0, 0);
    const target = new THREE.Vector3(1, 0.8, 0.2);
    root.updateMatrixWorld(true);
    const before = fore.localToWorld(offset.clone()).distanceTo(target);
    solveSupportGrip(upper, fore, offset, target, 20);
    root.updateMatrixWorld(true);
    const after = fore.localToWorld(offset.clone()).distanceTo(target);
    expect(after).toBeLessThan(before * 0.1);
    expect(upper.quaternion.length()).toBeCloseTo(1);
  });
  it('sitúa el agarre principal en la muñeca sin heredar una herramienta diminuta', () => {
    const root = new THREE.Group(); root.scale.setScalar(0.01);
    const fore = new THREE.Bone(); fore.position.x = -24; root.add(fore);
    const tool = new THREE.Group(); tool.rotation.set(-1.18, 0.12, -0.22);
    attachHoeAtHand(tool, fore);
    root.updateMatrixWorld(true);
    const grip = tool.localToWorld(new THREE.Vector3(0, 0.12, 0));
    const wrist = fore.localToWorld(new THREE.Vector3(-24, 0, 0));
    expect(grip.distanceTo(wrist)).toBeLessThan(0.00001);
    expect(tool.getWorldScale(new THREE.Vector3()).x).toBeCloseTo(0.85);
  });
});
