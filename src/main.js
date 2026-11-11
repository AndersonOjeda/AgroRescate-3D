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
import { SkySystem } from './systems/skySystem.js';
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
  const { scene, sunLight, hemiLight, ambientLight } = createScene();
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

  // 4. Sistemas de Cielo, Partículas y Audio
  const skySystem = new SkySystem({ scene, sunLight, hemiLight, ambientLight });
  const particleSystem = new ParticleSystem(scene);
  const audioSystem = new AudioSystem(camera);

  // 5. Triggers e Interacciones
  const triggerSystem = new TriggerSystem();
  const interactionSystem = new InteractionSystem();

  // 6. Navegación del Jugador
  const player = new PlayerController(camera, canvas, scene);
  player.onFootstep = () => {
    audioSystem.playFootstep();
    particleSystem.emitFootstepDust(player.getPosition());
  };

  // 7. Adaptador del Simulador Agrícola
  const farmAdapter = new FarmAdapter();
  hud.connectAdapter(farmAdapter);

  // 8. Carga del Escenario de la Finca (GLB o Procedural Fallback)
  const farmLoader = new FarmLoader(scene);
  const farmEnv = await farmLoader.loadFarm((percent, msg) => {
    hud.updateLoadingProgress(percent, msg);
  });

  // Vincular las parcelas visuales con el adaptador agrícola (procedural o nodos de etapa en finca.glb)
  if (farmEnv && farmEnv.cropPlots) {
    for (const [plotId, plotInstance] of Object.entries(farmEnv.cropPlots)) {
      farmAdapter.registerCropPlotVisual(plotId, plotInstance);
    }
  } else if (farmEnv?.type === 'glb' && farmEnv.root) {
    const createGlbPlotVisual = (zonePrefix) => {
      const stages = [1, 2, 3]
        .map((n) => farmEnv.root.getObjectByName(`cultivo_${zonePrefix}_etapa_${n}`))
        .filter(Boolean);
      if (stages.length === 0) return null;

      // Clonar materiales propios para poder tintar en marchito sin afectar árboles/pasto
      const stageMeshes = [];
      stages.forEach((stageObj) => {
        stageObj.traverse((node) => {
          if (node.isMesh && node.material) {
            node.material = node.material.clone();
            const originalColor = node.material.color ? node.material.color.clone() : null;
            stageMeshes.push({ node, originalColor, stageObj });
          }
        });
      });

      return {
        setVisualState(visualState) {
          const [s1, s2, s3] = stages;
          if (s1) s1.visible = visualState >= 1;
          if (s2) s2.visible = visualState >= 2;
          if (s3) s3.visible = visualState === 3;

          const isWithered = visualState === 4;
          stageMeshes.forEach(({ node, originalColor }) => {
            if (node.material?.color && originalColor) {
              if (isWithered) {
                node.material.color.setHex(0x785338);
              } else {
                node.material.color.copy(originalColor);
              }
            }
          });
          stages.forEach((st) => {
            if (st) st.scale.y = isWithered ? 0.65 : 1.0;
          });
        }
      };
    };

    const glbPlotMap = {
      plot_1: 'subsistencia',
      plot_2: 'precision',
      plot_3: 'ecologica'
    };
    for (const [plotId, zonePrefix] of Object.entries(glbPlotMap)) {
      const visual = createGlbPlotVisual(zonePrefix);
      if (visual) {
        farmAdapter.registerCropPlotVisual(plotId, visual);
      }
    }
  }

  // Vincular audio posicional al mesh de la bomba de agua
  const glbPumpMesh = farmEnv?.namedObjects?.get('bomba_agua');
  if (farmEnv && (farmEnv.waterPumpMesh || glbPumpMesh)) {
    audioSystem.attachPositionalWater(farmEnv.waterPumpMesh || glbPumpMesh);
  }

  // Cargar coordenadas interactivas reales del modelo GLB si está activo
  let interactivos = null;
  if (farmEnv?.type === 'glb') {
    try {
      const resp = await fetch('/models/finca.interactivos.json');
      if (resp.ok) {
        const json = await resp.json();
        interactivos = json?.interactivos || null;
      }
    } catch (err) {
      console.warn('[Main] No se pudo cargar finca.interactivos.json:', err.message);
    }
  }

  const isGlb = farmEnv?.type === 'glb';
  if (isGlb && farmEnv.root) {
    // Ajustar límites y colisiones de obstáculos al escenario finca.glb (sin usar las cajas del modo procedural)
    player.bounds = { minX: -19, maxX: 19, minZ: -19, maxZ: 19 };
    farmEnv.root.updateMatrixWorld(true);
    const glbObstacleNames = [
      'casa_rural',
      'almacen',
      'bomba_agua',
      'tanque_agua',
      'compostera',
      'fardo_paja',
      'fardo_paja.001',
      'fardo_paja.002'
    ];
    const glbObstacles = [];
    for (const obsName of glbObstacleNames) {
      const node = farmEnv.namedObjects?.get(obsName) || farmEnv.root.getObjectByName(obsName);
      if (!node) continue;
      const box = new THREE.Box3().setFromObject(node);
      if (!box.isEmpty()) {
        glbObstacles.push({
          id: obsName,
          type: 'box',
          minX: box.min.x,
          maxX: box.max.x,
          minZ: box.min.z,
          maxZ: box.max.z
        });
      }
    }
    player.setObstacles(glbObstacles);
  }
  const toVecObj = (arr, fallback) =>
    Array.isArray(arr) ? { x: arr[0], y: arr[1] ?? 0, z: arr[2] } : fallback;

  const sceneCoords = isGlb
    ? {
        pump: toVecObj(interactivos?.bomba_agua?.posicion, { x: 6.5, y: 0, z: 15.6 }),
        sensor: toVecObj(interactivos?.sensor_humedad?.posicion, { x: -4, y: 0, z: -5 }),
        compost: toVecObj(interactivos?.compostera?.posicion, { x: -4.6, y: 0, z: 15.1 }),
        warehouse: toVecObj(interactivos?.almacen?.posicion, { x: 14.0, y: 0, z: 9.4 }),
        warehouseBounds: { min: [10.5, 0, 5.5], max: [17.5, 4.0, 13.0] },
        plotRadius: 7.0,
        plotInteractDist: 7.2,
        emitterSpread: 3.4,
        plots: [
          {
            id: 'plot_1',
            name: 'Parcela 1 — Subsistencia',
            ...toVecObj(interactivos?.parcela_subsistencia?.posicion, { x: 10, y: 0, z: -10 })
          },
          {
            id: 'plot_2',
            name: 'Parcela 2 — Precisión',
            ...toVecObj(interactivos?.parcela_precision?.posicion, { x: -10, y: 0, z: -10 })
          },
          {
            id: 'plot_3',
            name: 'Parcela 3 — Ecológica',
            ...toVecObj(interactivos?.parcela_ecologica?.posicion, { x: -10, y: 0, z: 10 })
          }
        ]
      }
    : {
        pump: { x: -3, y: 0, z: -3 },
        sensor: { x: 0, y: 0, z: 10.5 },
        compost: { x: 14, y: 0, z: 1 },
        warehouse: { x: 12, y: 0, z: -7 },
        warehouseBounds: { min: [8.5, 0, -11.5], max: [15.5, 4.0, -4.5] },
        plotRadius: 4.5,
        plotInteractDist: 4.2,
        emitterSpread: 1.5,
        plots: [
          { id: 'plot_1', name: 'Parcela 1 — Subsistencia', x: -12, y: 0, z: 8 },
          { id: 'plot_2', name: 'Parcela 2 — Precisión', x: 0, y: 0, z: 14 },
          { id: 'plot_3', name: 'Parcela 3 — Ecológica', x: 12, y: 0, z: 8 }
        ]
      };

  // Alinear emisores de partículas de riego con las coordenadas reales de las parcelas
  particleSystem.setEmitters(
    sceneCoords.plots.map((p) => ({ x: p.x, y: 1.4, z: p.z })),
    sceneCoords.emitterSpread
  );

  // Sincronizar estado inicial del simulador con el HUD y los modelos 3D
  const initialState = await farmAdapter.getState();
  farmAdapter.syncVisuals(initialState);
  hud.updateFarmState(initialState);

  // 9. CONFIGURACIÓN DE TRIGGERS
  // A. Trigger Radial: Alrededor de la Bomba de Agua (Vector3.distanceTo)
  triggerSystem.addRadialTrigger({
    id: 'radial_water_pump',
    name: 'Zona: Bomba y Tanque de Agua',
    center: { x: sceneCoords.pump.x, y: 0, z: sceneCoords.pump.z },
    radius: 4.5,
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
    min: sceneCoords.warehouseBounds.min,
    max: sceneCoords.warehouseBounds.max,
    onEnter: () => {
      hud.setZone('Almacén de Cosecha');
      hud.showToast('📦 Has entrado al área de almacenamiento de cosecha', 'success', 3000);
    },
    onExit: () => {
      hud.setZone('Patio Central');
    }
  });

  // C. Triggers Radiales para cada Parcela
  const plotsData = sceneCoords.plots;

  plotsData.forEach(p => {
    triggerSystem.addRadialTrigger({
      id: `trigger_${p.id}`,
      name: `Zona: ${p.name}`,
      center: { x: p.x, y: 0, z: p.z },
      radius: sceneCoords.plotRadius,
      onEnter: () => {
        hud.setZone(p.name);
      },
      onExit: () => {
        hud.setZone('Patio Central');
      }
    });
  });

  // 10. CONFIGURACIÓN DE INTERACCIONES CENTRALIZADAS [TECLA E]
  const PLOT_EMITTER_INDEX = { plot_1: 0, plot_2: 1, plot_3: 2 };
  let isPumpSprayingManually = false;
  let irrigationBurstTimer = null;

  const mapPlotIdsToEmitters = (plotIds) => {
    if (!Array.isArray(plotIds) || plotIds.length === 0) return null;
    const indices = plotIds
      .map((id) => PLOT_EMITTER_INDEX[id])
      .filter((idx) => Number.isInteger(idx));
    return indices.length > 0 ? indices : null;
  };

  const triggerIrrigationSprayBurst = (durationMs = 3200, emitterIndices = null) => {
    if (isPumpSprayingManually) return;
    if (irrigationBurstTimer) {
      clearTimeout(irrigationBurstTimer);
      irrigationBurstTimer = null;
    }
    audioSystem.unlockAudio();
    particleSystem.setSpraying(true, emitterIndices);
    audioSystem.setWaterSound(true);

    irrigationBurstTimer = setTimeout(() => {
      irrigationBurstTimer = null;
      if (!isPumpSprayingManually) {
        particleSystem.setSpraying(false);
        audioSystem.setWaterSound(false);
      }
    }, durationMs);
  };

  // A. Bomba de Agua: Activar / Desactivar Riego
  interactionSystem.register({
    id: 'interact_pump',
    name: 'Bomba de Agua Hidráulica',
    position: { x: sceneCoords.pump.x, y: 0.5, z: sceneCoords.pump.z },
    actionText: 'Presiona E para activar sistema de riego',
    onInteract: async () => {
      audioSystem.playClick();
      const wasBursting = Boolean(irrigationBurstTimer) && !isPumpSprayingManually;
      if (irrigationBurstTimer) {
        clearTimeout(irrigationBurstTimer);
        irrigationBurstTimer = null;
      }
      let isNowSpraying;
      if (wasBursting) {
        particleSystem.setSpraying(true);
        isNowSpraying = true;
      } else {
        isNowSpraying = particleSystem.toggleSpraying();
      }
      isPumpSprayingManually = isNowSpraying;
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
        customDistance: sceneCoords.plotInteractDist,
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
    position: { x: sceneCoords.sensor.x, y: 1.0, z: sceneCoords.sensor.z },
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
    position: { x: sceneCoords.compost.x, y: 0.5, z: sceneCoords.compost.z },
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
    position: { x: sceneCoords.warehouse.x, y: 0.8, z: sceneCoords.warehouse.z },
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

  // Reproducir animación de siembra/cosecha y actualizar cultivos 3D
  farmAdapter.on('cropPlanted', ({ result }) => {
    if (result?.success) {
      player.playActionAnimation();
    }
  });

  farmAdapter.on('harvested', ({ result }) => {
    if (result?.success) {
      player.playActionAnimation();
    }
  });

  // Activar partículas de riego y audio en las parcelas regadas desde el HUD o riego automático IoT
  farmAdapter.on('irrigated', ({ plotId, result }) => {
    if (result?.success) {
      player.playActionAnimation();
    }
    if (result?.success && !isPumpSprayingManually) {
      const targetIds = result.irrigatedPlotIds || (plotId ? [plotId] : null);
      triggerIrrigationSprayBurst(3200, mapPlotIdsToEmitters(targetIds));
      audioSystem.playSuccess();
    }
  });

  farmAdapter.on('dayAdvanced', ({ result }) => {
    skySystem.triggerDayNightCycle();
    if (result?.autoTriggered && !isPumpSprayingManually) {
      triggerIrrigationSprayBurst(3200, mapPlotIdsToEmitters(result.autoIrrigatedPlotIds));
      audioSystem.playSuccess();
    }
  });

  // 11. BINDINGS DE BOTONES DEL HUD
  // Botón Comenzar
  if (hud.btnStartGame) {
    hud.btnStartGame.addEventListener('click', () => {
      audioSystem.unlockAudio();
      audioSystem.startAmbientMusic();
      audioSystem.startAmbient();
      player.requestLock();
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

  // Desbloquear audio y asegurar que suene /audio/bgm.mp3 tras cualquier interacción del jugador
  const ensureAudioOnGesture = () => {
    if (audioSystem.isMuted) return;
    if (!audioSystem.isAudioUnlocked || !audioSystem.isMusicPlaying()) {
      audioSystem.unlockAudio();
    }
  };
  window.addEventListener('pointerdown', ensureAudioOnGesture);
  window.addEventListener('keydown', ensureAudioOnGesture);

  // 12. BUCLE PRINCIPAL DE JUEGO (ANIMATE TICK)
  gameLoop.addUpdateCallback((delta, fps) => {
    // A. Actualizar jugador y cámara en tercera persona
    player.update(delta);
    const pPos = player.getPosition();
    physicsWorld.updatePlayerPosition(pPos);

    // B. Paso de física fija de Cannon-es (world.step(1/60, delta, 3)) y sincronización de matrices
    physicsWorld.step(delta);

    // C. Actualizar atmósfera (nubes + transición noche/día), entorno (molino) y partículas
    skySystem.update(delta);
    if (farmEnv && farmEnv.environment && typeof farmEnv.environment.update === 'function') {
      farmEnv.environment.update(delta);
    }
    particleSystem.update(delta);

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

  // Esperar modelo del granjero antes de revelar la escena (si falla, conserva respaldo)
  hud.updateLoadingProgress(95, 'Cargando personaje granjero...');
  await player.ready;

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
