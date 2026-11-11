import * as THREE from 'three';

/**
 * Módulo de Escena e Iluminación 3D para AgroRescate 3D
 */
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0d8ef); // Cielo rural despejado
  scene.fog = new THREE.Fog(0xa0d8ef, 75, 240);

  // 1. Luz Hemisférica (Cielo suave y rebote del suelo)
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4a6b32, 0.6);
  hemiLight.position.set(0, 50, 0);
  scene.add(hemiLight);

  // 2. Luz Solar Direccional con sombras optimizadas
  const sunLight = new THREE.DirectionalLight(0xfff7e6, 1.2);
  sunLight.position.set(25, 40, 20);
  sunLight.castShadow = true;

  // Parámetros de la cámara de sombra para cubrir toda la finca (~60x60m)
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 100;

  const d = 40;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;

  scene.add(sunLight);

  // 3. Luz de relleno ambiental suave
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambientLight);

  return {
    scene,
    sunLight,
    hemiLight,
    ambientLight
  };
}
