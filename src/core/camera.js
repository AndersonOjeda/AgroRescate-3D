import * as THREE from 'three';

/**
 * Módulo de Cámara para AgroRescate 3D
 */
export function createCamera() {
  const fov = 60;
  const aspect = window.innerWidth / window.innerHeight;
  const near = 0.1;
  const far = 500;

  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 5, 8);

  return camera;
}
