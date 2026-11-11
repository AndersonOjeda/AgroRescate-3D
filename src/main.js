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
import { FarmAdapter } from './integration/farmAdapter.js';
import { HUD } from './ui/hud.js';

/**
 * Punto de Entrada Principal de AgroRescate 3D
 */
async function bootstrap() {
  console.log('🌾 Iniciando AgroRescate 3D...');

  // 1. Elementos Base de Three.js
  const canvas = document.getElementById('webgl-canvas');
  const { scene } = createScene();
  const camera = createCamera();
  const { renderer, handleResize } = createRenderer(canvas);
  const gameLoop = new GameLoop();

  window.addEventListener('resize', () => handleResize(camera));

  // 2. HUD e Interfaces
  const hud = new HUD();
  hud.updateLoadingProgress(10, 'Inicializando motor 3D y sistemas...');

  // 3. Físicas con Cannon-es
  const physicsWorld = new PhysicsWorld(scene);

  // Crear cajas agrícolas físicas iniciales en el almacén
  physicsWorld.createCrate({ id: 'crate_1', x: 13, y: 1.0, z: -6, mass: 5, color: 0xd97706 });
  physicsWorld.createCrate({ id: 'crate_2', x: 13, y: 2.0, z: -6, mass: 5, color: 0xb45309 });
  physicsWorld.createCrate({ id: 'crate_3', x: 14, y: 1.0, z: -6, mass: 5, color: 0xd97706 });

  // 4. Sistemas de Partículas y Audio
  const particleSystem = new ParticleSystem(scene);
  const audioSystem = new AudioSystem(camera);

  // 5. Triggers e Interacciones
  const triggerSystem = new TriggerSystem();
  const interactionSystem = new InteractionSystem();

  // 6. Navegación del Jugador y Efectos de Audio de Pisadas
  const player = new PlayerController(camera, canvas, scene);
  player.onFootstep = () => {
    audioSystem.playFootstep();
  };

  // 7. Adaptador del Simulador Agrícola
  const farmAdapter = new FarmAdapter();

  // 8. Carga del Escenario de la Finca (GLB o Procedural Fallback)
  const farmLoader = new FarmLoader(scene);
  const farmEnv = await farmLoader.loadFarm((percent, msg) => {
    hud.updateLoadingProgress(percent, msg);
  });

  // Vincular las parcelas visuales con el adaptador agrícola
  if (farmEnv && farmEnv.cropPlots) {
    for (const [plotId, plotInstance] of Object.entries(farmEnv.cropPlots)) {
      farmAdapter.registerCropPlotVisual(plotId, plotInstance);
    }
  }

  // Vincular audio posicional al mesh de la bomba de agua
  if (farmEnv && farmEnv.waterPumpMesh) {
    audioSystem.attachPositionalWater(farmEnv.waterPumpMesh);
  }

  // Sincronizar estado inicial del simulador con el HUD y los modelos 3D
  const initialState = await farmAdapter.getState();
  farmAdapter.syncVisuals(initialState);
  hud.updateFarmState(initialState);

  // 9. CONFIGURACIÓN DE TRIGGERS
  // A. Trigger Radial: Alrededor de la Bomba de Agua (Vector3.distanceTo)
  triggerSystem.addRadialTrigger({
    id: 'radial_water_pump',
    name: 'Zona: Bomba y Tanque de Agua',
    center: { x: -3, y: 0, z: -3 },
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
    min: [8.5, 0, -11.5],
    max: [15.5, 4.0, -4.5],
    onEnter: () => {
      hud.setZone('Almacén de Cosecha');
      hud.showToast('📦 Has entrado al área de almacenamiento de cosecha', 'success', 3000);
    },
    onExit: () => {
      hud.setZone('Patio Central');
    }
  });

  // C. Triggers Radiales para cada Parcela
  const plotsData = [
    { id: 'plot_1', name: 'Parcela 1 — Subsistencia', x: -12, z: 8 },
    { id: 'plot_2', name: 'Parcela 2 — Precisión', x: 0, z: 14 },
    { id: 'plot_3', name: 'Parcela 3 — Ecológica', x: 12, z: 8 }
  ];

  plotsData.forEach(p => {
    triggerSystem.addRadialTrigger({
      id: `trigger_${p.id}`,
      name: `Zona: ${p.name}`,
      center: { x: p.x, y: 0, z: p.z },
      radius: 4.5,
      onEnter: () => {
        hud.setZone(p.name);
      },
      onExit: () => {
        hud.setZone('Patio Central');
      }
    });
  });

  // 10. CONFIGURACIÓN DE INTERACCIONES CENTRALIZADAS [TECLA E]
  // A. Bomba de Agua: Activar / Desactivar Riego
  interactionSystem.register({
    id: 'interact_pump',
    name: 'Bomba de Agua Hidráulica',
    position: { x: -3, y: 0.5, z: -3 },
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
    plotsData.forEach(p => {
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
        customDistance: 4.2,
        onInteract: async () => {
          audioSystem.playClick();
          const currentState = await farmAdapter.getState();
          const curPlot = currentState.plots[p.id];

          if (!curPlot.isPlanted) {
            // Sembrar
            const res = await farmAdapter.plant(p.id);
            if (res.success) {
              hud.showToast(res.message, 'success');
              audioSystem.playSuccess();
            } else {
              hud.showToast(res.message, 'warning');
            }
          } else if (curPlot.daysGrown >= curPlot.daysToMature || curPlot.visualState === 4) {
            // Cosechar o limpiar
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
    position: { x: 0, y: 1.0, z: 10.5 },
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
    position: { x: 14, y: 0.5, z: 1 },
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
    position: { x: 12, y: 0.8, z: -7 },
    actionText: 'Presiona E para inspeccionar inventario o soltar caja física',
    onInteract: () => {
      audioSystem.playClick();
      physicsWorld.dropDemoCrate(player.getPosition());
      hud.showToast('📦 ¡Caja física de Cannon-es arrojada al escenario! Observa el rebote y la gravedad.', 'info');
    }
  });

  // Conectar cambio en el interactable con el prompt central del HUD
  interactionSystem.onPromptChange = (item) => {
    hud.showInteractionPrompt(item);
  };

  // Escuchar cambios de estado del adaptador agrícola para refrescar el HUD y las opciones
  farmAdapter.on('stateChange', ({ state }) => {
    hud.updateFarmState(state);

    // Actualizar los textos de acción de las parcelas
    plotsData.forEach(p => {
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

  // 11. BINDINGS DE BOTONES DEL HUD
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

  // Tecla F para soltar caja física en cualquier momento
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') {
      physicsWorld.dropDemoCrate(player.getPosition());
      hud.showToast('📦 Caja física arrojada (Tecla F)', 'info', 1800);
    } else if (e.code === 'KeyR') {
      const raining = particleSystem.toggleRain();
      hud.showToast(raining ? '🌧️ Lluvia ambiental' : '☀️ Clima despejado', 'info', 1800);
    }
  });

  // Desbloquear audio tras el primer click o tecla
  window.addEventListener('click', () => audioSystem.unlockAudio(), { once: true });
  window.addEventListener('keydown', () => audioSystem.unlockAudio(), { once: true });

  // 12. BUCLE PRINCIPAL DE JUEGO (ANIMATE TICK)
  gameLoop.addUpdateCallback((delta, fps) => {
    // A. Actualizar jugador y cámara en tercera persona
    player.update(delta);
    const pPos = player.getPosition();

    // Actualizar colisionador cinemático del jugador en Cannon-es para empujar objetos
    physicsWorld.updatePlayerPosition(pPos);

    // B. Paso de física fija de Cannon-es (world.step(1/60, delta, 3)) y sincronización de matrices
    physicsWorld.step(delta);

    // C. Actualizar sistemas de partículas (aspersores y lluvia) sin asignaciones dinámicas
    particleSystem.update(delta);

    // Actualizar animaciones ambientales (molino de viento, etc.)
    if (farmEnv && farmEnv.environment && typeof farmEnv.environment.update === 'function') {
      farmEnv.environment.update(delta);
    }

    // D. Detección de proximidad para interacción [E]
    interactionSystem.update(pPos);

    // E. Detección de zonas espaciales por triggers (Radial y AABB)
    triggerSystem.update(pPos);

    // F. Actualizar datos en el HUD
    hud.updateCoordinates(pPos.x, pPos.y, pPos.z);
    hud.updateFps(fps);

    // G. Renderizar escena
    renderer.render(scene, camera);
  });

  // Finalizar carga y arrancar el bucle
  hud.updateLoadingProgress(100, '¡Finca lista!');
  setTimeout(() => {
    hud.hideLoadingScreen();
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
