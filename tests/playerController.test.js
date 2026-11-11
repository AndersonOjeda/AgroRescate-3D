import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { PlayerController, prepareFarmerGlbModel } from '../src/player/playerController.js';
import { applyProceduralFarmerRig } from '../src/player/farmerRig.js';

function createHumanoidMockScene() {
  const root = new THREE.Group();
  // Malla compuesta con vértices distribuidos desde los pies hasta el sombrero y ambos brazos T-pose
  const positions = [];
  for (let iy = 0; iy <= 10; iy++) {
    const y = iy / 10;
    for (let ix = -3; ix <= 3; ix++) {
      const x = (ix / 3) * 0.36;
      positions.push(x, y, 0.01);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(positions.slice(), 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.name = 'tripo_test_mesh';
  root.add(mesh);
  return { root, mesh };
}

describe('PlayerController — Modelo GLB, Rigging Procedural y Respaldo', () => {
  it('escala, centra en XZ, apoya en Y=0 y activa sombras al preparar el GLB', () => {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.74, 1.0, 0.39);
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(1.5, 0.5, -2.0);
    group.add(mesh);

    prepareFarmerGlbModel(group, 2.1);

    const finalBox = new THREE.Box3().setFromObject(group);
    const finalSize = finalBox.getSize(new THREE.Vector3());
    const finalCenter = finalBox.getCenter(new THREE.Vector3());

    expect(finalSize.y).toBeCloseTo(2.1, 4);
    expect(finalBox.min.y).toBeCloseTo(0, 4);
    expect(finalCenter.x).toBeCloseTo(0, 4);
    expect(finalCenter.z).toBeCloseTo(0, 4);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });

  it('genera esqueleto de 11 huesos, pesos normalizados y baja brazos de pose T en idle', () => {
    const { root } = createHumanoidMockScene();
    prepareFarmerGlbModel(root, 2.1);
    const rig = applyProceduralFarmerRig(root);

    expect(rig).toBeTruthy();
    expect(rig.bones.length).toBe(11);
    expect(rig.skinnedMesh.isSkinnedMesh).toBe(true);
    expect(Object.keys(rig.actions)).toEqual(['idle', 'walk', 'run', 'action']);

    const weights = rig.skinnedMesh.geometry.attributes.skinWeight;
    for (let i = 0; i < weights.count; i++) {
      const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
      expect(sum).toBeCloseTo(1.0, 4);
    }

    // Reproducir idle debe rotar hombros hacia abajo desde la pose T
    rig.actions.idle.play();
    rig.mixer.update(0.1);
    const leftUpperArm = rig.bones.find((b) => b.name === 'leftUpperArm');
    const rightUpperArm = rig.bones.find((b) => b.name === 'rightUpperArm');
    expect(leftUpperArm.rotation.z).toBeLessThan(-0.8);
    expect(rightUpperArm.rotation.z).toBeGreaterThan(0.8);
  });

  it('reemplaza el avatar temporal, alterna idle/walk/run/action y conserva respaldo ante error', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 200);
    const { root: mockGlbRoot } = createHumanoidMockScene();

    const mockLoader = {
      loadAsync: vi.fn(async () => ({ scene: mockGlbRoot, animations: [] }))
    };

    const player = new PlayerController(camera, null, scene, {
      modelPath: '/models/granjero.glb',
      gltfLoader: mockLoader,
      autoLoad: false
    });

    const initialGroupRef = player.mesh;
    expect(player.mesh.children.length).toBe(1);
    expect(player.avatarVisual.name).toBe('player_farmer_fallback');

    const loaded = await player.loadGlbAvatar('/models/granjero.glb');
    expect(loaded).toBe(true);
    expect(mockLoader.loadAsync).toHaveBeenCalledWith('/models/granjero.glb');
    expect(player.mesh).toBe(initialGroupRef);
    expect(player.avatarVisual).toBe(mockGlbRoot);
    expect(player.currentAnimName).toBe('idle');

    // Al caminar activa 'walk'
    player.keys.forward = true;
    player.update(0.05);
    expect(player.mesh.position.z).toBeLessThan(-2);
    expect(player.currentAnimName).toBe('walk');

    // Con Shift activa 'run'
    player.isSprinting = true;
    player.update(0.05);
    expect(player.currentAnimName).toBe('run');

    // Al detenerse vuelve a 'idle' y puede disparar 'action'
    player.keys.forward = false;
    player.isSprinting = false;
    player.update(0.05);
    expect(player.currentAnimName).toBe('idle');

    expect(player.playActionAnimation()).toBe(true);
    expect(player.currentAnimName).toBe('action');
    player.update(0.8); // Al terminar el clip de 0.72s regresa a idle
    expect(player.currentAnimName).toBe('idle');

    // Si falla la carga de otro GLB, conserva el avatar actual sin romper la escena
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    player.gltfLoader = {
      loadAsync: vi.fn(async () => {
        throw new Error('404 Not Found');
      })
    };
    const failed = await player.loadGlbAvatar('/models/inexistente.glb');
    expect(failed).toBe(false);
    expect(player.avatarVisual).toBe(mockGlbRoot);
    warnSpy.mockRestore();
  });
});
