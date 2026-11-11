import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FarmEnvironment } from './environment.js';

/**
 * Cargador Robusto del Escenario 3D de la Finca
 * Gestiona la carga de /models/finca.glb y /models/posiciones.json.
 * Si el archivo GLB aún no ha sido entregado por el compañero de Blender,
 * activa de forma transparente el entorno procedural sin interrumpir la ejecución.
 */
export class FarmLoader {
  constructor(scene) {
    this.scene = scene;
    this.gltfLoader = new GLTFLoader();
    this.isLoaded = false;
    this.isLoading = false;
    this.currentEnvironment = null;
    this.modelPath = '/models/finca.glb';
    this.positionsPath = '/models/posiciones.json';
    this.namedObjects = new Map();
  }

  /**
   * Carga el archivo de posiciones JSON
   */
  async loadPositionsConfig() {
    try {
      const response = await fetch(this.positionsPath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data;
    } catch (err) {
      console.warn('[FarmLoader] posiciones.json no disponible, usando configuración por defecto:', err.message);
      return null;
    }
  }

  /**
   * Carga la finca: Intenta GLB real primero; si no existe, genera el entorno procedural
   * @param {Function} onProgressCallback - Callback con porcentaje (0 - 100)
   */
  async loadFarm(onProgressCallback = () => {}) {
    if (this.isLoaded) {
      console.warn('[FarmLoader] La finca ya ha sido cargada previamente.');
      return this.currentEnvironment;
    }

    this.isLoading = true;
    const positionsConfig = await this.loadPositionsConfig();

    onProgressCallback(25, 'Comprobando modelo 3D GLB...');

    const glbAvailable = await this._checkGlbExists(this.modelPath);

    if (glbAvailable) {
      try {
        onProgressCallback(40, 'Cargando finca.glb de Blender...');
        const gltf = await this._loadGLTF(this.modelPath, onProgressCallback);
        this._processLoadedGLB(gltf.scene);
        this.scene.add(gltf.scene);

        this.currentEnvironment = {
          type: 'glb',
          root: gltf.scene,
          namedObjects: this.namedObjects,
          config: positionsConfig
        };

        this.isLoaded = true;
        this.isLoading = false;
        onProgressCallback(100, 'Escenario GLB cargado exitosamente.');
        return this.currentEnvironment;
      } catch (glbError) {
        console.warn('[FarmLoader] Error al cargar finca.glb, usando fallback procedural:', glbError);
      }
    }

    // Fallback: Entorno procedural completo
    onProgressCallback(65, 'Generando escenario de finca rural procedural...');
    const proceduralEnv = new FarmEnvironment(this.scene, positionsConfig);

    this.currentEnvironment = {
      type: 'procedural',
      environment: proceduralEnv,
      cropPlots: proceduralEnv.cropPlots,
      waterPumpMesh: proceduralEnv.waterPumpMesh,
      humiditySensorMesh: proceduralEnv.humiditySensorMesh,
      composterMesh: proceduralEnv.composterMesh,
      warehouseMesh: proceduralEnv.warehouseMesh,
      config: positionsConfig
    };

    this.isLoaded = true;
    this.isLoading = false;
    onProgressCallback(100, 'Escenario de la finca inicializado correctamente.');
    return this.currentEnvironment;
  }

  async _checkGlbExists(url) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return false;
      const contentType = response.headers.get('content-type') || '';
      // Si Vite devuelve text/html (fallback de SPA) significa que el archivo .glb no existe
      if (contentType.includes('text/html')) return false;
      return true;
    } catch {
      return false;
    }
  }

  _loadGLTF(url, onProgress) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => resolve(gltf),
        (xhr) => {
          if (xhr.lengthComputable) {
            const percent = 40 + Math.round((xhr.loaded / xhr.total) * 50);
            onProgress(percent, `Descargando activos 3D (${percent}%)...`);
          }
        },
        (error) => reject(error)
      );
    });
  }

  _processLoadedGLB(modelScene) {
    modelScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.name) {
          this.namedObjects.set(child.name.toLowerCase(), child);
        }
      }
    });
  }

  getEnvironment() {
    return this.currentEnvironment;
  }
}
