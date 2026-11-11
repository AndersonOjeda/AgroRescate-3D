import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MultimediaStation } from '../src/world/multimediaStation.js';
import { PlayerController } from '../src/player/playerController.js';
import { GLBCropPlot } from '../src/world/farmLoader.js';
import { FarmEnvironment } from '../src/world/environment.js';

describe('MultimediaStation & Portales — Requisitos Semanas 3 y 9', () => {
  it('debe inicializar la estación multimedia con textura y portal neón', () => {
    const scene = new THREE.Scene();
    const station = new MultimediaStation(scene, new THREE.Vector3(0, 0, 0));

    expect(station.canvas).toBeDefined();
    expect(station.canvasTexture).toBeDefined();
    expect(station.portalMesh).toBeDefined();
    expect(station.portalBox).toBeDefined();
    expect(station.isPlaying).toBe(true);
  });

  it('debe permitir pausar y reanudar la pantalla multimedia (Autoplay policy)', () => {
    const scene = new THREE.Scene();
    const station = new MultimediaStation(scene, new THREE.Vector3(0, 0, 0));

    expect(station.isPlaying).toBe(true);
    station.togglePlay();
    expect(station.isPlaying).toBe(false);
    station.togglePlay();
    expect(station.isPlaying).toBe(true);
  });

  it('debe detectar la entrada al portal de teletransporte y aplicar cooldown', () => {
    const scene = new THREE.Scene();
    const station = new MultimediaStation(scene, new THREE.Vector3(0, 0, 0));

    // Posición del portal está en (0, 1.8, -12)
    const insidePortal = new THREE.Vector3(0, 1.8, -12);
    const outsidePortal = new THREE.Vector3(10, 0, 10);

    expect(station.checkTeleport(outsidePortal)).toBe(false);
    expect(station.checkTeleport(insidePortal)).toBe(true);

    // Segundo intento inmediato debe ser bloqueado por el cooldown de 3.5s
    expect(station.checkTeleport(insidePortal)).toBe(false);
  });
});

describe('GLBCropPlot — Adaptador de Crecimiento para Activos Blender', () => {
  it('debe gestionar visibilidad secuencial de las etapas 1, 2 y 3', () => {
    const stage1 = new THREE.Mesh();
    const stage2 = new THREE.Mesh();
    const stage3 = new THREE.Mesh();

    const glbPlot = new GLBCropPlot('test_plot', 'Parcela Test', {
      1: stage1,
      2: stage2,
      3: stage3
    });

    // Estado 0: Todas ocultas
    glbPlot.setVisualState(0);
    expect(stage1.visible).toBe(false);
    expect(stage2.visible).toBe(false);
    expect(stage3.visible).toBe(false);

    // Estado 1: Brote
    glbPlot.setVisualState(1);
    expect(stage1.visible).toBe(true);
    expect(stage2.visible).toBe(false);
    expect(stage3.visible).toBe(false);

    // Estado 2: Crecimiento
    glbPlot.setVisualState(2);
    expect(stage1.visible).toBe(false);
    expect(stage2.visible).toBe(true);
    expect(stage3.visible).toBe(false);

    // Estado 3: Maduro
    glbPlot.setVisualState(3);
    expect(stage1.visible).toBe(false);
    expect(stage2.visible).toBe(false);
    expect(stage3.visible).toBe(true);
  });
});

describe('PlayerController — Modos de Cámara Dual', () => {
  it('debe alternar limpiamente entre Tercera Persona y Órbita Libre', () => {
    const camera = new THREE.PerspectiveCamera();
    const scene = new THREE.Scene();
    const player = new PlayerController(camera, null, scene);

    expect(player.cameraMode).toBe('third-person');

    const nextMode = player.toggleCameraMode();
    expect(nextMode).toBe('orbit');
    expect(player.cameraMode).toBe('orbit');

    const prevMode = player.toggleCameraMode();
    expect(prevMode).toBe('third-person');
    expect(player.cameraMode).toBe('third-person');
  });
});

describe('FarmEnvironment — Aislamiento de Parcelas Procedurales bajo el Grupo Principal', () => {
  it('incluye sus CropPlot dentro de env.group para ocultarlos completos al usar finca.glb', () => {
    const scene = new THREE.Scene();
    const env = new FarmEnvironment(scene);

    expect(Object.keys(env.cropPlots)).toEqual(['plot_1', 'plot_2', 'plot_3']);
    for (const plot of Object.values(env.cropPlots)) {
      expect(plot.group.parent).toBe(env.group);
    }

    // Ningún crop_plot_* debe quedar suelto como hijo directo de scene
    const strayPlots = scene.children.filter((c) => c.name?.startsWith('crop_plot_'));
    expect(strayPlots.length).toBe(0);
  });
});
