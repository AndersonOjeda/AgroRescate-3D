import * as THREE from 'three';
import { createScene } from './core/scene.js';
import { createRenderer } from './core/renderer.js';
import { createCamera } from './core/camera.js';
import { GameLoop } from './core/gameLoop.js';
import { PlayerController } from './player/playerController.js';
import { PhysicsWorld } from './physics/physicsWorld.js';
import { TriggerSystem } from './systems/triggerSystem.js';
import { ParticleSystem } from './systems/particleSystem.js';
import { AudioSystem } from './systems/audioSystem.js';
import { InteractionSystem } from './systems/interactionSystem.js';
import { FarmLoader } from './world/farmLoader.js';
import { MultimediaStation } from './world/multimediaStation.js';
import { FarmAdapter } from './integration/farmAdapter.js';
import { HUD } from './ui/hud.js';
import { DebugGUI } from './ui/debugGui.js';

/**
 * Punto de Entrada Principal de AgroRescate 3D
 * Integra todos los módulos y laboratorios de las 12 semanas de Programación de Entornos Multimedia
 */
async function bootstrap() {
  console.log('🌾 Iniciando AgroRescate 3D — Universidad Cooperativa de Colombia...');

  // 1. Elementos Base de Three.js (Semanas 1 y 4)
  const canvas = document.getElementById('webgl-canvas');
  const sceneElements = createScene();
  const scene = sceneElements.scene;
  const camera = createCamera();
  const { renderer, handleResize } = createRenderer(canvas);
  const gameLoop = new GameLoop();

  window.addEventListener('resize', () => handleResize(camera));

  // 2. HUD e Interfaces (Semana 9 y 10)
  const hud = new HUD();
  hud.updateLoadingProgress(10, 'Inicializando motor 3D y sistemas...');

  // 3. Físicas con Cannon-es (Semanas 5, 6 y 10)
  const physicsWorld = new PhysicsWorld(scene);

  // 4. Sistemas de Partículas (Semanas 4, 9, 10) y Audio Espacial (Semanas 3, 9, 10)
  const particleSystem = new ParticleSystem(scene);
  const audioSystem = new AudioSystem(camera);

  // 5. Triggers e Interacciones (Semanas 6 y 9)
  const triggerSystem = new TriggerSystem();
  const interactionSystem = new InteractionSystem();

  // 6. Navegación del Jugador y Controles de Cámara (Semanas 1, 6, 7, 10)
  const player = new PlayerController(camera, canvas, scene);
  player.onFootstep = () => {
    audioSystem.playFootstep();
  };

  // 7. Adaptador del Simulador Agrícola (Compañero 3)
  const farmAdapter = new FarmAdapter();

  // 8. Carga del Escenario de la Finca (Semanas 7, 8 y 10)
  const farmLoader = new FarmLoader(scene);
  const farmEnv = await farmLoader.loadFarm((percent, msg) => {
    hud.updateLoadingProgress(percent, msg);
  });

  const coords = farmEnv.coordinates;

  // Sincronizar obstáculos y límites físicos dinámicamente con el entorno cargado (GLB / Procedural)
  if (farmEnv.obstacles) {
    player.setObstacles(farmEnv.obstacles, farmEnv.bounds);
    physicsWorld.setObstacles(farmEnv.obstacles);
  }

  // Ubicar al jugador en el punto de spawn configurado
  player.setPosition(coords.spawn.x, coords.spawn.y, coords.spawn.z);

  // Crear cajas agrícolas físicas de Cannon-es en el almacén
  physicsWorld.createCrate({ id: 'crate_1', x: coords.almacenPos.x - 1, y: 1.0, z: coords.almacenPos.z, mass: 5, color: 0xd97706 });
  physicsWorld.createCrate({ id: 'crate_2', x: coords.almacenPos.x - 1, y: 2.0, z: coords.almacenPos.z, mass: 5, color: 0xb45309 });
  physicsWorld.createCrate({ id: 'crate_3', x: coords.almacenPos.x, y: 1.0, z: coords.almacenPos.z, mass: 5, color: 0xd97706 });

  // Configurar orígenes de aspersores según las parcelas del escenario activo
  particleSystem.setEmitters([
    new THREE.Vector3(coords.plots[0].x, 1.3, coords.plots[0].z),
    new THREE.Vector3(coords.plots[1].x, 1.3, coords.plots[1].z),
    new THREE.Vector3(coords.plots[2].x, 1.3, coords.plots[2].z)
  ]);

  // Vincular las parcelas visuales con el adaptador agrícola
  const bindCropPlots = (env) => {
    if (env && env.cropPlots) {
      for (const [plotId, plotInstance] of Object.entries(env.cropPlots)) {
        farmAdapter.registerCropPlotVisual(plotId, plotInstance);
      }
    }
  };
  bindCropPlots(farmEnv);

  // Vincular audio posicional al mesh de la bomba de agua
  if (farmEnv && farmEnv.waterPumpMesh) {
    audioSystem.attachPositionalWater(farmEnv.waterPumpMesh);
  }

  // 9. Estación Multimedia Interactiva (Semana 3) y Portal Neón (Semana 9)
  const multimediaStation = new MultimediaStation(
    scene,
    new THREE.Vector3(coords.spawn.x + 2.5, 0, coords.spawn.z - 3.5)
  );

  // Sincronizar estado inicial del simulador con el HUD y los modelos 3D
  const initialState = await farmAdapter.getState();
  farmAdapter.syncVisuals(initialState);
  hud.updateFarmState(initialState);

  // 10. CONFIGURACIÓN DE TRIGGERS (Semana 9 & 10)
  // A. Trigger Radial: Alrededor de la Bomba de Agua (Vector3.distanceTo)
  triggerSystem.addRadialTrigger({
    id: 'radial_water_pump',
    name: 'Zona: Bomba y Tanque de Agua',
    center: { x: coords.bomba.x, y: 0, z: coords.bomba.z },
    radius: 4.8,
    onEnter: () => {
      hud.setZone('Bomba y Tanque de Agua');
      hud.showToast('📍 Te has acercado a la estación de bombeo', 'info', 2500);
    },
    onExit: () => {
      hud.setZone('Patio Central');
    }
  });

  // B. Trigger AABB: Almacén de Cosecha (THREE.Box3)
  triggerSystem.addAABBTrigger({
    id: 'aabb_warehouse',
    name: 'Zona: Almacén y Centro de Cosecha',
    min: coords.almacenAABB.min,
    max: coords.almacenAABB.max,
    onEnter: () => {
      hud.setZone('Almacén de Cosecha');
      hud.showToast('📦 Has entrado al área de almacenamiento de cosecha', 'success', 3000);
    },
    onExit: () => {
      hud.setZone('Patio Central');
    }
  });

  // C. Triggers Radiales para cada Parcela
  coords.plots.forEach(p => {
    triggerSystem.addRadialTrigger({
      id: `trigger_${p.id}`,
      name: `Zona: ${p.name}`,
      center: { x: p.x, y: 0, z: p.z },
      radius: 5.5,
      onEnter: () => {
        hud.setZone(p.name);
      },
      onExit: () => {
        hud.setZone('Patio Central');
      }
    });
  });

  // 11. CONFIGURACIÓN DE INTERACCIONES CENTRALIZADAS [TECLA E]
  // A. Bomba de Agua: Activar / Desactivar Riego
  interactionSystem.register({
    id: 'interact_pump',
    name: 'Bomba de Agua Hidráulica',
    position: { x: coords.bomba.x, y: 0.5, z: coords.bomba.z },
    actionText: 'Presiona E para activar sistema de riego',
    onInteract: async () => {
      audioSystem.playClick();
      const isNowSpraying = particleSystem.toggleSpraying();
      audioSystem.setWaterSound(isNowSpraying);

      if (isNowSpraying) {
        interactionSystem.updateActionText('interact_pump', 'Presiona E para apagar sistema de riego');
        const res = await farmAdapter.irrigate();
        if (res.success) {
          hud.showToast(res.message, 'success');
          audioSystem.playSuccess();
        } else {
          hud.showToast(res.message, 'warning');
        }
      } else {
        interactionSystem.updateActionText('interact_pump', 'Presiona E para activar sistema de riego');
        hud.showToast('Riego detenido', 'info');
      }
    }
  });

  // B. Parcelas Agrícolas: Sembrar / Cosechar según estado
  const setupPlotInteractions = (state) => {
    coords.plots.forEach(p => {
      const plotState = state.plots[p.id];
      let actionText = 'Presiona E para sembrar';
      if (plotState) {
        if (!plotState.isPlanted) {
          actionText = `Presiona E para sembrar ${plotState.cropName}`;
        } else if (plotState.daysGrown >= plotState.daysToMature) {
          actionText = `Presiona E para cosechar ${plotState.cropName} (${plotState.yieldKg} kg)`;
        } else if (plotState.visualState === 4) {
          actionText = `Presiona E para limpiar cultivo marchito`;
        } else {
          actionText = `Cultivo creciendo (${plotState.daysGrown}/${plotState.daysToMature} días)`;
        }
      }

      interactionSystem.register({
        id: `interact_${p.id}`,
        name: p.name,
        position: { x: p.x, y: 0.5, z: p.z },
        actionText: actionText,
        customDistance: 5.2,
        onInteract: async () => {
          audioSystem.playClick();
          const currentState = await farmAdapter.getState();
          const curPlot = currentState.plots[p.id];

          if (!curPlot.isPlanted) {
            const res = await farmAdapter.plant(p.id);
            if (res.success) {
              hud.showToast(res.message, 'success');
              audioSystem.playSuccess();
            } else {
              hud.showToast(res.message, 'warning');
            }
          } else if (curPlot.daysGrown >= curPlot.daysToMature || curPlot.visualState === 4) {
            const res = await farmAdapter.harvest(p.id);
            if (res.success) {
              hud.showToast(res.message, 'success');
              audioSystem.playSuccess();
            } else {
              hud.showToast(res.message, 'warning');
            }
          } else {
            hud.showToast(`El cultivo está en desarrollo (${curPlot.daysGrown}/${curPlot.daysToMature} días). Riega o avanza el día.`, 'info');
          }
        }
      });
    });
  };

  setupPlotInteractions(initialState);

  // C. Sensor IoT de Humedad
  interactionSystem.register({
    id: 'interact_sensor',
    name: 'Sensor IoT de Humedad de Suelo',
    position: { x: coords.sensor.x, y: coords.sensor.y, z: coords.sensor.z },
    actionText: 'Presiona E para consultar telemetría del sensor',
    onInteract: async () => {
      audioSystem.playClick();
      const state = await farmAdapter.getState();
      const p2 = state.plots.plot_2;
      hud.showToast(`📊 Telemetría Sensor: Humedad suelo = ${p2.moisture}% | Salud suelo = ${state.soilQuality}%`, 'info', 4500);
    }
  });

  // D. Compostera Orgánica
  interactionSystem.register({
    id: 'interact_compost',
    name: 'Compostera Orgánica',
    position: { x: coords.compostera.x, y: coords.compostera.y, z: coords.compostera.z },
    actionText: 'Presiona E para aplicar abono orgánico',
    onInteract: async () => {
      audioSystem.playClick();
      const res = await farmAdapter.applyCompost();
      if (res.success) {
        hud.showToast(res.message, 'success');
        audioSystem.playSuccess();
      }
    }
  });

  // E. Almacén de Cosecha / Cajas de Cannon-es
  interactionSystem.register({
    id: 'interact_warehouse',
    name: 'Almacén de Cosecha y Cajas Físicas',
    position: { x: coords.almacenPos.x, y: coords.almacenPos.y, z: coords.almacenPos.z },
    actionText: 'Presiona E para soltar caja física (Cannon-es)',
    onInteract: () => {
      audioSystem.playClick();
      physicsWorld.dropDemoCrate(player.getPosition());
      hud.showToast('📦 ¡Caja física de Cannon-es arrojada al escenario! Observa el rebote y la gravedad.', 'info');
    }
  });

  // F. Estación Multimedia Interactiva (Semana 3)
  interactionSystem.register({
    id: 'interact_multimedia',
    name: 'Estación Multimedia de Telemetría (Semana 3)',
    position: { x: coords.spawn.x + 2.5, y: 1.5, z: coords.spawn.z - 3.5 },
    actionText: 'Presiona E para pausar/reanudar pantalla multimedia',
    onInteract: () => {
      audioSystem.playClick();
      const isPlaying = multimediaStation.togglePlay();
      hud.showToast(isPlaying ? '📺 Pantalla multimedia reanudada' : '⏸️ Pantalla multimedia pausada', 'info');
    }
  });

  // Conectar cambio en el interactable con el prompt central del HUD
  interactionSystem.onPromptChange = (item) => {
    hud.showInteractionPrompt(item);
  };

  // Escuchar cambios de estado del adaptador agrícola para refrescar el HUD y las opciones
  farmAdapter.on('stateChange', ({ state }) => {
    hud.updateFarmState(state);

    coords.plots.forEach(p => {
      const plotState = state.plots[p.id];
      if (plotState) {
        let actionText = '';
        if (!plotState.isPlanted) {
          actionText = `Presiona E para sembrar ${plotState.cropName}`;
        } else if (plotState.daysGrown >= plotState.daysToMature) {
          actionText = `Presiona E para cosechar ${plotState.cropName} (${plotState.yieldKg} kg)`;
        } else if (plotState.visualState === 4) {
          actionText = `Presiona E para limpiar cultivo marchito`;
        } else {
          actionText = `Cultivo creciendo (${plotState.daysGrown}/${plotState.daysToMature} días)`;
        }
        interactionSystem.updateActionText(`interact_${p.id}`, actionText);
      }
    });
  });

  // Cambio de entorno dinámico (GLB <-> Procedural)
  farmLoader.onEnvironmentChange = (newEnv) => {
    if (newEnv.obstacles) {
      player.setObstacles(newEnv.obstacles, newEnv.bounds);
      physicsWorld.setObstacles(newEnv.obstacles);
    }
    bindCropPlots(newEnv);
    if (newEnv.waterPumpMesh) {
      audioSystem.attachPositionalWater(newEnv.waterPumpMesh);
    }
    farmAdapter.syncVisuals(initialState);
  };

  // 12. PANEL DE CONTROL lil-gui (Semanas 2 y 4)
  const debugGui = new DebugGUI({
    scene,
    sunLight: sceneElements.sunLight,
    ambientLight: sceneElements.ambientLight,
    hemiLight: sceneElements.hemiLight,
    player,
    farmAdapter,
    physicsWorld,
    particleSystem,
    audioSystem,
    farmLoader,
    multimediaStation,
    hud
  });

  // 13. BINDINGS DE BOTONES DEL HUD
  // Botón Comenzar
  if (hud.btnStartGame) {
    hud.btnStartGame.addEventListener('click', () => {
      player.requestLock();
      audioSystem.unlockAudio();
      audioSystem.startAmbient();
    });
  }

  // Selector de modo agrícola
  if (hud.modeSelector) {
    hud.modeSelector.addEventListener('change', async (e) => {
      const mode = e.target.value;
      audioSystem.playClick();
      const newState = await farmAdapter.initializeFarm(mode);
      hud.showToast(`Modo cambiado a: ${mode.toUpperCase()}`, 'info');
      audioSystem.playSuccess();
    });
  }

  // Botón Avanzar Día
  if (hud.btnAdvanceDay) {
    hud.btnAdvanceDay.addEventListener('click', async () => {
      audioSystem.playClick();
      const res = await farmAdapter.advanceDay();
      if (res.success) {
        hud.showToast(res.message, 'info');
      }
    });
  }

  // Botón Alternar Audio
  if (hud.btnToggleSound) {
    hud.btnToggleSound.addEventListener('click', () => {
      const active = audioSystem.toggleMute();
      if (hud.soundIcon) {
        hud.soundIcon.textContent = active ? '🔊' : '🔇';
      }
      hud.showToast(active ? 'Audio activado' : 'Audio silenciado', 'info', 1800);
    });
  }

  // Botón Alternar Lluvia
  if (hud.btnToggleRain) {
    hud.btnToggleRain.addEventListener('click', () => {
      const raining = particleSystem.toggleRain();
      audioSystem.playClick();
      hud.showToast(raining ? '🌧️ Lluvia ambiental activada' : '☀️ Clima despejado', 'info', 2000);
    });
  }

  // Botón Demostración de Físicas
  if (hud.btnSpawnCrate) {
    hud.btnSpawnCrate.addEventListener('click', () => {
      audioSystem.playClick();
      physicsWorld.dropDemoCrate(player.getPosition());
      hud.showToast('📦 Demostración de Cannon-es: Nueva caja dinámica con gravedad y rebote', 'success', 2500);
    });
  }

  // Botón Alternar Modo de Cámara (3ra Persona / OrbitControls)
  if (hud.btnToggleCam) {
    hud.btnToggleCam.addEventListener('click', () => {
      audioSystem.playClick();
      const mode = player.toggleCameraMode();
      hud.showToast(mode === 'orbit' ? '🛸 Cámara: Órbita Libre (Mouse Drag/Zoom)' : '🏃 Cámara: Tercera Persona (WASD)', 'info');
    });
  }

  // Botón Alternar Panel lil-gui
  if (hud.btnToggleGui) {
    hud.btnToggleGui.addEventListener('click', () => {
      audioSystem.playClick();
      debugGui.toggle();
    });
  }

  // Teclas Rápidas de Navegación y Atajos
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') {
      physicsWorld.dropDemoCrate(player.getPosition());
      hud.showToast('📦 Caja física arrojada (Tecla F)', 'info', 1800);
    } else if (e.code === 'KeyR') {
      const raining = particleSystem.toggleRain();
      hud.showToast(raining ? '🌧️ Lluvia ambiental' : '☀️ Clima despejado', 'info', 1800);
    }
  });

  // Desbloquear audio tras el primer click o tecla (Políticas de Autoplay)
  window.addEventListener('click', () => audioSystem.unlockAudio(), { once: true });
  window.addEventListener('keydown', () => audioSystem.unlockAudio(), { once: true });

  // 14. BUCLE PRINCIPAL DE JUEGO (ANIMATE TICK) — 60 FPS
  gameLoop.addUpdateCallback((delta, fps) => {
    // A. Actualizar jugador y cámara
    player.update(delta);
    const pPos = player.getPosition();

    // Actualizar colisionador cinemático del jugador en Cannon-es
    physicsWorld.updatePlayerPosition(pPos);

    // B. Paso de física fija de Cannon-es y sincronización de matrices
    physicsWorld.step(delta);

    // C. Actualizar sistemas de partículas (aspersores, lluvia y polvo) sin asignaciones dinámicas
    particleSystem.update(delta);

    // D. Actualizar estación multimedia animada y portal neón (Semanas 3 y 9)
    multimediaStation.update(delta);

    // Detección de Teletransporte por Bounding Box (Semana 9)
    if (multimediaStation.checkTeleport(pPos)) {
      audioSystem.playSuccess();
      hud.showToast('🌀 ¡Portal Cuántico activado! Teletransportando al centro de la finca...', 'success', 3500);
      player.setPosition(coords.spawn.x, coords.spawn.y, coords.spawn.z);
    }

    // Actualizar animaciones ambientales
    if (farmEnv && farmEnv.environment && typeof farmEnv.environment.update === 'function') {
      farmEnv.environment.update(delta);
    }

    // E. Detección de proximidad para interacción [E]
    interactionSystem.update(pPos);

    // F. Detección de zonas espaciales por triggers (Radial y AABB)
    triggerSystem.update(pPos);

    // G. Actualizar datos en el HUD
    hud.updateCoordinates(pPos.x, pPos.y, pPos.z);
    hud.updateFps(fps);

    // H. Renderizar escena
    renderer.render(scene, camera);
  });

  // Finalizar carga y arrancar el bucle
  hud.updateLoadingProgress(100, '¡Finca lista!');
  setTimeout(() => {
    hud.hideLoadingScreen();
    window.__agro = { player, farmLoader, physicsWorld, farmAdapter };
    gameLoop.start();
    console.log('✅ AgroRescate 3D inicializado y ejecutándose a 60 FPS.');
  }, 400);
}

// Iniciar aplicación al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
