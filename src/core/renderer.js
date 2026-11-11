import * as THREE from 'three';

/**
 * Módulo de Renderizado WebGL optimizado para AgroRescate 3D
 */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });

  // Configuración de renderizado (tope 1.25 para evitar caída de FPS en pantallas HiDPI)
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));

  // Sombras optimizadas
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // Mapeo tonal cinematográfico y espacio de color lineal
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Manejo de redimensionado de ventana
  function handleResize(camera) {
    if (!camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  }

  return {
    renderer,
    handleResize
  };
}
