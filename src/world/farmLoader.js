import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FarmEnvironment } from './environment.js';
import { applyNaturalMountainShading } from './landscapeEnhancer.js';

/**
 * Límites del terreno en Three.js para el modelo GLB de Blender (40x40 m)
 */
export const GLB_BOUNDS = {
  minX: -19.2,
  maxX: 22.2,
  minZ: -21.5,
  maxZ: 18.2
};

const GLB_OBSTACLE_PREFIXES = [
  'casarural',
  'almacen',
  'farmhousebarn',
  'farmhousesilo',
  'fabconvertedmodel',
  'bombaagua',
  'tanqueagua',
  'compostera',
  'panelsolarbase',
  'cajonherramientas',
  'espantapajarosposte',
  'fardopaja',
  'farmfence'
];

/**
 * Extrae cajas de colisión reales (Box3) de edificios y vallas desde un grafo glTF ya sanitizado por Three.js.
 * Tolera nombres con espacios/puntos sanitizados (ej. 'FAB converted model.001' -> 'FAB_converted_model001').
 * @param {THREE.Object3D} root
 * @returns {Array<object>}
 */
export function collectGlbSceneObstacles(root) {
  if (!root) return [];
  root.updateMatrixWorld(true);
  const obstacles = [];
  const seenRoots = new Set();
  const box = new THREE.Box3();

  const walk = (node) => {
    const clean = (node.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const matched = clean && GLB_OBSTACLE_PREFIXES.some((p) => clean.startsWith(p));
    if (matched && !seenRoots.has(node)) {
      box.setFromObject(node);
      if (!box.isEmpty()) {
        obstacles.push({
          id: node.name,
          type: 'box',
          minX: box.min.x,
          maxX: box.max.x,
          minZ: box.min.z,
          maxZ: box.max.z,
          height: Math.max(1.2, box.max.y - box.min.y)
        });
        seenRoots.add(node);
        return; // No duplicar hijos dentro de una estructura ya medida (ej. casa FAB o granero)
      }
    }
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        walk(node.children[i]);
      }
    }
  };

  walk(root);
  return obstacles;
}

/**
 * Obstáculos sólidos para colisión precisa contra las estructuras de finca.glb
 * Coordenadas convertidas desde generar_finca.py: [x_blender, z_blender, -y_blender]
 */
export const GLB_OBSTACLES = [
  // 1. Casa Rural (Blender: x=7.3, y=-9.4, dims=(4.65, 4.35, 3.20) -> Three.js: x=7.3, z=9.4)
  {
    id: 'casa_rural',
    name: 'Casa Rural',
    type: 'box',
    minX: 7.3 - 2.35,
    maxX: 7.3 + 2.35,
    minZ: 9.4 - 2.20,
    maxZ: 9.4 + 2.20,
    height: 3.5
  },
  // 2. Almacén de Cosecha (Blender: x=14.0, y=-9.4, dims=(4.6, 4.55, 3.4) -> Three.js: x=14.0, z=9.4)
  {
    id: 'almacen',
    name: 'Almacén de Cosecha',
    type: 'box',
    minX: 14.0 - 2.35,
    maxX: 14.0 + 2.35,
    minZ: 9.4 - 2.30,
    maxZ: 9.4 + 2.30,
    height: 3.8
  },
  // 3. Tanque de Agua (Blender: x=13.25, y=-15.7, r=1.15, h=2.7 -> Three.js: x=13.25, z=15.7)
  {
    id: 'tanque_agua',
    name: 'Tanque de Agua',
    type: 'circle',
    x: 13.25,
    z: 15.7,
    r: 1.25,
    height: 3.0
  },
  // 4. Bomba de Agua (Blender: x=6.5, y=-15.6, dims=(1.0, 0.8, 0.83) -> Three.js: x=6.5, z=15.6)
  {
    id: 'bomba_agua',
    name: 'Bomba de Agua',
    type: 'box',
    minX: 6.5 - 0.55,
    maxX: 6.5 + 0.55,
    minZ: 15.6 - 0.45,
    maxZ: 15.6 + 0.45,
    height: 1.5
  },
  // 5. Compostera (Blender: x=-4.6, y=-15.1, dims=(1.25, 1.5, 1.0) -> Three.js: x=-4.6, z=15.1)
  {
    id: 'compostera',
    name: 'Compostera Orgánica',
    type: 'box',
    minX: -4.6 - 0.65,
    maxX: -4.6 + 0.65,
    minZ: 15.1 - 0.80,
    maxZ: 15.1 + 0.80,
    height: 1.2
  },
  // 6. Cajón de Herramientas (Blender: x=4.2, y=15.5, dims=(0.8, 0.52, 0.6) -> Three.js: x=4.2, z=-15.5)
  {
    id: 'cajon_herramientas',
    name: 'Cajón de Herramientas',
    type: 'box',
    minX: 4.2 - 0.45,
    maxX: 4.2 + 0.45,
    minZ: -15.5 - 0.30,
    maxZ: -15.5 + 0.30,
    height: 1.0
  },
  // 7. Panel Solar (Blender: x=-16.0, y=4.2, dims=(1.3, 0.9, 0.09) -> Three.js: x=-16.0, z=-4.2)
  {
    id: 'panel_solar',
    name: 'Panel Solar IoT',
    type: 'box',
    minX: -16.0 - 0.70,
    maxX: -16.0 + 0.70,
    minZ: -4.2 - 0.50,
    maxZ: -4.2 + 0.50,
    height: 1.6
  },
  // 8. Espantapájaros (Blender: x=16.0, y=15.5 -> Three.js: x=16.0, z=-15.5)
  {
    id: 'espantapajaros',
    name: 'Espantapájaros',
    type: 'circle',
    x: 16.0,
    z: -15.5,
    r: 0.55,
    height: 2.6
  },
  // 9. Árboles perimetrales de la finca (troncos sólidos cilíndricos)
  { id: 'tree_1', type: 'circle', x: -17.7, z: -17.9, r: 0.6, height: 4.0 },
  { id: 'tree_2', type: 'circle', x: 17.6, z: -17.9, r: 0.6, height: 4.0 },
  { id: 'tree_3', type: 'circle', x: -17.8, z: 17.7, r: 0.6, height: 4.0 },
  { id: 'tree_4', type: 'circle', x: 17.8, z: 17.8, r: 0.6, height: 4.0 },
  { id: 'tree_5', type: 'circle', x: -17.8, z: -1.8, r: 0.6, height: 4.0 },
  { id: 'tree_6', type: 'circle', x: 17.8, z: -1.8, r: 0.6, height: 4.0 },
  { id: 'tree_7', type: 'circle', x: 17.7, z: 3.2, r: 0.6, height: 4.0 },
  { id: 'tree_8', type: 'circle', x: -18.0, z: 3.0, r: 0.6, height: 4.0 }
];

/**
 * Límites del terreno en Three.js para el modo Procedural (80x80 m)
 */
export const PROCEDURAL_BOUNDS = {
  minX: -36,
  maxX: 36,
  minZ: -36,
  maxZ: 36
};

/**
 * Obstáculos sólidos para colisión en el entorno procedural generado por código
 */
export const PROCEDURAL_OBSTACLES = [
  // 1. Casa Rural Procedural (-16, 0, -14)
  {
    id: 'casa_rural',
    name: 'Casa Rural',
    type: 'box',
    minX: -16 - 4.2,
    maxX: -16 + 4.2,
    minZ: -14 - 3.4,
    maxZ: -14 + 3.4,
    height: 4.5
  },
  // 2. Granero Procedural (16, 0, -14)
  {
    id: 'granero',
    name: 'Granero',
    type: 'box',
    minX: 16 - 4.7,
    maxX: 16 + 4.7,
    minZ: -14 - 3.9,
    maxZ: -14 + 3.9,
    height: 5.0
  },
  // 3. Tanque de Agua (-4, 0, -4)
  {
    id: 'tanque_agua',
    name: 'Tanque de Agua',
    type: 'box',
    minX: -4 - 1.3,
    maxX: -4 + 1.3,
    minZ: -4 - 1.3,
    maxZ: -4 + 1.3,
    height: 4.0
  },
  // 4. Bomba de Agua (-3, 0, -3)
  {
    id: 'bomba_agua',
    name: 'Bomba de Agua',
    type: 'box',
    minX: -3 - 0.7,
    maxX: -3 + 0.7,
    minZ: -3 - 0.7,
    maxZ: -3 + 0.7,
    height: 1.5
  },
  // 5. Compostera (14, 0, 1)
  {
    id: 'compostera',
    name: 'Compostera Orgánica',
    type: 'box',
    minX: 14 - 1.0,
    maxX: 14 + 1.0,
    minZ: 1 - 1.0,
    maxZ: 1 + 1.0,
    height: 1.5
  },
  // 6. Cerca Norte
  {
    id: 'cerca_norte',
    name: 'Cerca Norte',
    type: 'box',
    minX: -30.5,
    maxX: 30.5,
    minZ: -34.4,
    maxZ: -33.6,
    height: 1.2
  },
  // 7. Árboles
  { id: 'tree_1', type: 'circle', x: -28, z: -20, r: 0.6, height: 4.0 },
  { id: 'tree_2', type: 'circle', x: -30, z: -10, r: 0.6, height: 4.0 },
  { id: 'tree_3', type: 'circle', x: -25, z: 12, r: 0.6, height: 4.0 },
  { id: 'tree_4', type: 'circle', x: -28, z: 25, r: 0.6, height: 4.0 },
  { id: 'tree_5', type: 'circle', x: 28, z: -25, r: 0.6, height: 4.0 },
  { id: 'tree_6', type: 'circle', x: 30, z: -12, r: 0.6, height: 4.0 },
  { id: 'tree_7', type: 'circle', x: 26, z: 15, r: 0.6, height: 4.0 },
  { id: 'tree_8', type: 'circle', x: 28, z: 28, r: 0.6, height: 4.0 }
];

/**
 * Adaptador de Parcela para el Modelo GLB de Blender
 * Controla la visibilidad de los 3 estadios de cultivo (etapa 1, 2, 3)
 * exportados desde Blender (generar_finca.py).
 */
export class GLBCropPlot {
  constructor(id, name, stages) {
    this.id = id;
    this.name = name;
    this.stages = stages || {}; // { 1: mesh1, 2: mesh2, 3: mesh3 }
    this.visualState = 0;
    this.setVisualState(0);
  }

  setVisualState(stateIndex) {
    this.visualState = stateIndex;
    // 0: Sin sembrar (todos invisibles)
    // 1: Brote (etapa 1 visible)
    // 2: Crecimiento (etapa 2 visible)
    // 3: Maduro (etapa 3 visible)
    // 4: Marchito (etapa 3 visible con tono marchito)
    if (this.stages[1]) this.stages[1].visible = (stateIndex === 1);
    if (this.stages[2]) this.stages[2].visible = (stateIndex === 2);
    if (this.stages[3]) this.stages[3].visible = (stateIndex === 3 || stateIndex === 4);

    if (this.stages[3] && stateIndex === 4) {
      this.stages[3].traverse(child => {
        if (child.isMesh && child.material) {
          if (!child._origColor) child._origColor = child.material.color.clone();
          child.material.color.setHex(0x854d0e); // Color marchito
        }
      });
    } else if (this.stages[3] && stateIndex === 3) {
      this.stages[3].traverse(child => {
        if (child.isMesh && child.material && child._origColor) {
          child.material.color.copy(child._origColor);
        }
      });
    }
  }
}

/**
 * Cargador Robusto del Escenario 3D de la Finca
 * Gestiona la carga de /models/finca.glb y /models/finca.interactivos.json.
 * Proporciona soporte bidireccional:
 * - Modo Blender (.GLB): modelo modelado y exportado de Blender.
 * - Modo Procedural (Three.js): escenario geométrico generado por código.
 * Permite alternar en tiempo real entre ambos para demostración y evaluación.
 */
export class FarmLoader {
  constructor(scene) {
    this.scene = scene;
    this.gltfLoader = new GLTFLoader();
    this.isLoaded = false;
    this.isLoading = false;
    this.currentEnvironment = null;
    this.modelPath = '/models/finca.glb';
    this.positionsPath = '/models/finca.interactivos.json';
    this.fallbackPositionsPath = '/models/posiciones.json';
    this.namedObjects = new Map();

    this.glbScene = null;
    this.proceduralEnv = null;
    this.onEnvironmentChange = null;
  }

  /**
   * Carga el archivo de posiciones JSON
   */
  async loadPositionsConfig() {
    try {
      let response = await fetch(this.positionsPath);
      if (!response.ok) {
        response = await fetch(this.fallbackPositionsPath);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data;
    } catch (err) {
      console.warn('[FarmLoader] Archivo de posiciones no disponible, usando configuración por defecto:', err.message);
      return null;
    }
  }

  /**
   * Carga la finca: Intenta GLB real primero; si existe, prepara ambos entornos
   * @param {Function} onProgressCallback - Callback con porcentaje (0 - 100)
   */
  async loadFarm(onProgressCallback = () => {}) {
    if (this.isLoaded) {
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
        this.glbScene = gltf.scene;
        this._processLoadedGLB(this.glbScene);
        this.scene.add(this.glbScene);

        // Crear parcelas GLB conectadas a las mallas de etapas
        const glbCropPlots = {
          plot_1: new GLBCropPlot('plot_1', 'Parcela 1 — Subsistencia', {
            1: this.namedObjects.get('cultivo_subsistencia_etapa_1'),
            2: this.namedObjects.get('cultivo_subsistencia_etapa_2'),
            3: this.namedObjects.get('cultivo_subsistencia_etapa_3')
          }),
          plot_2: new GLBCropPlot('plot_2', 'Parcela 2 — Precisión', {
            1: this.namedObjects.get('cultivo_precision_etapa_1'),
            2: this.namedObjects.get('cultivo_precision_etapa_2'),
            3: this.namedObjects.get('cultivo_precision_etapa_3')
          }),
          plot_3: new GLBCropPlot('plot_3', 'Parcela 3 — Ecológica', {
            1: this.namedObjects.get('cultivo_ecologica_etapa_1'),
            2: this.namedObjects.get('cultivo_ecologica_etapa_2'),
            3: this.namedObjects.get('cultivo_ecologica_etapa_3')
          })
        };

        const glbCoordinates = {
          type: 'glb',
          spawn: { x: 0, y: 0, z: 17.7 },
          bomba: { x: 6.5, y: 0.5, z: 15.6 },
          almacenAABB: { min: [11.5, 0, 7.0], max: [16.5, 4.0, 12.0] },
          almacenPos: { x: 14, y: 0.8, z: 9.4 },
          sensor: { x: -4, y: 1.0, z: -5 },
          compostera: { x: -4.6, y: 0.5, z: 15.1 },
          plots: [
            { id: 'plot_1', name: 'Parcela 1 — Subsistencia', x: 10, z: -10 },
            { id: 'plot_2', name: 'Parcela 2 — Precisión', x: -10, z: -10 },
            { id: 'plot_3', name: 'Parcela 3 — Ecológica', x: -10, z: 10 }
          ]
        };

        // Crear también el entorno procedural como alternativa de visualización en vivo
        this.proceduralEnv = new FarmEnvironment(this.scene, positionsConfig);
        this.proceduralEnv.group.visible = false; // Inicialmente oculto

        this.currentEnvironment = {
          type: 'glb',
          root: this.glbScene,
          cropPlots: glbCropPlots,
          waterPumpMesh: this.namedObjects.get('bomba_agua') || this.glbScene,
          humiditySensorMesh: this.namedObjects.get('sensor_humedad'),
          composterMesh: this.namedObjects.get('compostera'),
          warehouseMesh: this.namedObjects.get('almacen'),
          coordinates: glbCoordinates,
          obstacles: GLB_OBSTACLES,
          bounds: GLB_BOUNDS,
          namedObjects: this.namedObjects,
          config: positionsConfig,
          environment: { update: (delta) => {} }
        };

        this.isLoaded = true;
        this.isLoading = false;
        onProgressCallback(100, 'Escenario GLB de Blender cargado exitosamente.');
        return this.currentEnvironment;
      } catch (glbError) {
        console.warn('[FarmLoader] Error al cargar finca.glb, usando fallback procedural:', glbError);
      }
    }

    // Fallback exclusivo: Entorno procedural completo
    onProgressCallback(65, 'Generando escenario de finca rural procedural...');
    this.proceduralEnv = new FarmEnvironment(this.scene, positionsConfig);

    const proceduralCoordinates = {
      type: 'procedural',
      spawn: { x: 0, y: 0, z: -2 },
      bomba: { x: -3, y: 0.5, z: -3 },
      almacenAABB: { min: [8.5, 0, -11.5], max: [15.5, 4.0, -4.5] },
      almacenPos: { x: 12, y: 0.8, z: -7 },
      sensor: { x: 0, y: 1.0, z: 10.5 },
      compostera: { x: 14, y: 0.5, z: 1 },
      plots: [
        { id: 'plot_1', name: 'Parcela 1 — Subsistencia', x: -12, z: 8 },
        { id: 'plot_2', name: 'Parcela 2 — Precisión', x: 0, z: 14 },
        { id: 'plot_3', name: 'Parcela 3 — Ecológica', x: 12, z: 8 }
      ]
    };

    this.currentEnvironment = {
      type: 'procedural',
      environment: this.proceduralEnv,
      cropPlots: this.proceduralEnv.cropPlots,
      waterPumpMesh: this.proceduralEnv.waterPumpMesh,
      humiditySensorMesh: this.proceduralEnv.humiditySensorMesh,
      composterMesh: this.proceduralEnv.composterMesh,
      warehouseMesh: this.proceduralEnv.warehouseMesh,
      coordinates: proceduralCoordinates,
      obstacles: PROCEDURAL_OBSTACLES,
      bounds: PROCEDURAL_BOUNDS,
      config: positionsConfig
    };

    this.isLoaded = true;
    this.isLoading = false;
    onProgressCallback(100, 'Escenario de la finca inicializado correctamente.');
    return this.currentEnvironment;
  }

  /**
   * Alterna entre el modelo GLB de Blender y el modelo Procedural de Three.js
   */
  switchEnvironment(type) {
    if (!this.glbScene || !this.proceduralEnv) return;

    if (type === 'glb') {
      this.glbScene.visible = true;
      this.proceduralEnv.group.visible = false;
      this.currentEnvironment.type = 'glb';
      this.currentEnvironment.waterPumpMesh = this.namedObjects.get('bomba_agua') || this.glbScene;
      this.currentEnvironment.humiditySensorMesh = this.namedObjects.get('sensor_humedad');
      this.currentEnvironment.composterMesh = this.namedObjects.get('compostera');
      this.currentEnvironment.warehouseMesh = this.namedObjects.get('almacen');
      this.currentEnvironment.obstacles = GLB_OBSTACLES;
      this.currentEnvironment.bounds = GLB_BOUNDS;
      this.currentEnvironment.coordinates = {
        type: 'glb',
        spawn: { x: 0, y: 0, z: 17.7 },
        bomba: { x: 6.5, y: 0.5, z: 15.6 },
        almacenAABB: { min: [11.5, 0, 7.0], max: [16.5, 4.0, 12.0] },
        almacenPos: { x: 14, y: 0.8, z: 9.4 },
        sensor: { x: -4, y: 1.0, z: -5 },
        compostera: { x: -4.6, y: 0.5, z: 15.1 },
        plots: [
          { id: 'plot_1', name: 'Parcela 1 — Subsistencia', x: 10, z: -10 },
          { id: 'plot_2', name: 'Parcela 2 — Precisión', x: -10, z: -10 },
          { id: 'plot_3', name: 'Parcela 3 — Ecológica', x: -10, z: 10 }
        ]
      };
      this.currentEnvironment.cropPlots = {
        plot_1: new GLBCropPlot('plot_1', 'Parcela 1 — Subsistencia', {
          1: this.namedObjects.get('cultivo_subsistencia_etapa_1'),
          2: this.namedObjects.get('cultivo_subsistencia_etapa_2'),
          3: this.namedObjects.get('cultivo_subsistencia_etapa_3')
        }),
        plot_2: new GLBCropPlot('plot_2', 'Parcela 2 — Precisión', {
          1: this.namedObjects.get('cultivo_precision_etapa_1'),
          2: this.namedObjects.get('cultivo_precision_etapa_2'),
          3: this.namedObjects.get('cultivo_precision_etapa_3')
        }),
        plot_3: new GLBCropPlot('plot_3', 'Parcela 3 — Ecológica', {
          1: this.namedObjects.get('cultivo_ecologica_etapa_1'),
          2: this.namedObjects.get('cultivo_ecologica_etapa_2'),
          3: this.namedObjects.get('cultivo_ecologica_etapa_3')
        })
      };
    } else {
      this.glbScene.visible = false;
      this.proceduralEnv.group.visible = true;
      this.currentEnvironment.type = 'procedural';
      this.currentEnvironment.waterPumpMesh = this.proceduralEnv.waterPumpMesh;
      this.currentEnvironment.humiditySensorMesh = this.proceduralEnv.humiditySensorMesh;
      this.currentEnvironment.composterMesh = this.proceduralEnv.composterMesh;
      this.currentEnvironment.warehouseMesh = this.proceduralEnv.warehouseMesh;
      this.currentEnvironment.cropPlots = this.proceduralEnv.cropPlots;
      this.currentEnvironment.obstacles = PROCEDURAL_OBSTACLES;
      this.currentEnvironment.bounds = PROCEDURAL_BOUNDS;
      this.currentEnvironment.coordinates = {
        type: 'procedural',
        spawn: { x: 0, y: 0, z: -2 },
        bomba: { x: -3, y: 0.5, z: -3 },
        almacenAABB: { min: [8.5, 0, -11.5], max: [15.5, 4.0, -4.5] },
        almacenPos: { x: 12, y: 0.8, z: -7 },
        sensor: { x: 0, y: 1.0, z: 10.5 },
        compostera: { x: 14, y: 0.5, z: 1 },
        plots: [
          { id: 'plot_1', name: 'Parcela 1 — Subsistencia', x: -12, z: 8 },
          { id: 'plot_2', name: 'Parcela 2 — Precisión', x: 0, z: 14 },
          { id: 'plot_3', name: 'Parcela 3 — Ecológica', x: 12, z: 8 }
        ]
      };
      this.currentEnvironment.environment = this.proceduralEnv;
    }

    if (this.onEnvironmentChange) {
      this.onEnvironmentChange(this.currentEnvironment);
    }
    return this.currentEnvironment;
  }

  async _checkGlbExists(url) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) return false;
      const contentType = response.headers.get('content-type') || '';
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
      if (child.name) {
        const key = child.name.toLowerCase();
        if (!this.namedObjects.has(key)) {
          this.namedObjects.set(key, child);
        }
      }
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    applyNaturalMountainShading(modelScene);
  }

  getEnvironment() {
    return this.currentEnvironment;
  }
}
