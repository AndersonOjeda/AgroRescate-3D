# Arquitectura de AgroRescate 3D

**Asignatura:** Programación Orientada a Entornos Multimedia — Universidad Cooperativa de Colombia (UCC)  
**Docente:** Mg. Gabriel Guerrero Arellano  

## 1. Visión General de Capas

AgroRescate 3D desacopla estrictamente el motor gráfico (Three.js), la simulación física (Cannon-es), la lógica agrícola educativa (`FarmSimulation`) y la capa de interfaz HTML/CSS (`HUD` y `GameModalsController`):

```text
+---------------------------------------------------------------+
|                 Interfaz HTML/CSS (index.html)                |
|   HUD (hud.js)  <-->  GameModalsController (gameModals.js)    |
+-----------------------------+---------------------------------+
                              | Eventos / Llamadas asíncronas
+-----------------------------v---------------------------------+
|                   Orquestador (src/main.js)                   |
|  GameLoop (60 FPS) | InteractionSystem [E] | TriggerSystem    |
+--------+--------------------+--------------------+------------+
         |                    |                    |
+--------v-------+   +--------v--------+   +-------v-----------+
|   Three.js     |   |   Cannon-es     |   |   Simulación      |
| - FarmLoader   |   | - PhysicsWorld  |   | - FarmAdapter     |
|   (finca.glb)  |   | - Gravedad -9.8 |   | - FarmSimulation  |
| - PlayerCtrl   |   | - Cajas rígidas |   | - MissionManager  |
|   (granjero.glb|   | - Obstáculos    |   | - ResultsStore    |
|   + OrbitCtrl) |   |   estáticos GLB |   |                   |
| - ParticleSys  |   +-----------------+   +-------------------+
| - AudioSystem  |
| - SkySystem    |
| - Multimedia   |
+----------------+
```

## 2. Responsabilidad por Módulo

- **Núcleo Gráfico (`src/core/`):**
  - `scene.js`, `camera.js`, `renderer.js`: escena con iluminación direccional + hemisférica + ambiental, mapa de sombras `PCFShadowMap`, `ACESFilmicToneMapping` y control dinámico de calidad gráfica (`low`/`medium`/`high`).
  - `gameLoop.js`: bucle principal con `delta` independiente de FPS y medición real de cuadros por segundo.
- **Mundo 3D y Blender (`blender/`, `src/world/`):**
  - `blender/generar_finca.py` genera `blender/finca.blend`, `public/models/finca.glb` (40 × 40 u.) y `public/models/finca.interactivos.json` / `posiciones.json`.
  - `farmLoader.js`: carga asíncronamente `finca.glb`, vincula las mallas de etapas de cultivo (`GLBCropPlot`) y exporta `GLB_OBSTACLES`/`GLB_BOUNDS`, con alternativa procedural (`environment.js`) conmutable en vivo desde `lil-gui`.
  - `multimediaStation.js`: estación de telemetría dinámica (`CanvasTexture`) interactiva con `E` y portal cuántico neón (`THREE.Box3`).
  - `guideChicken.js`: personaje guía interactivo (Rudy) con animaciones y tutorial contextual.
- **Jugador y Físicas (`src/player/`, `src/physics/`):**
  - `playerController.js`: carga `public/models/granjero.glb` (`prepareFarmerGlbModel`) con animaciones esqueléticas (`AnimationMixer`) y respaldo `farmerRig.js`, cámara dual (3ra persona + `OrbitControls` con tecla `C`), colisiones sólidas, *Wall Sliding* y `_resolvePenetration()`.
  - `physicsWorld.js`: mundo Cannon-es (`world.step(1/60, delta, 3)`), gravedad `-9.81 m/s²`, suelo plano, colisionadores estáticos sincronizados con `setObstacles()` y cajas agrícolas dinámicas con fricción y restitución.
- **Sistemas Multimedia (`src/systems/`):**
  - `audioSystem.js`: `THREE.PositionalAudio` en la bomba de agua, `THREE.Audio` globales (éxito, finalización `playGameComplete`, clic, pisadas, ambiente), streaming de `/audio/bgm.mp3` y control maestro de volumen (`setMasterVolume`).
  - `particleSystem.js`: pool de partículas con `THREE.BufferGeometry`, `Float32Array` y `THREE.Points` sin asignaciones en `animate()` (aspersión, lluvia y polvo al caminar).
  - `triggerSystem.js`: triggers radiales (`distanceTo` / `distanceToSquared`) y AABB (`THREE.Box3`) con `onEnter`, `onStay`, `onExit` y cooldown.
  - `interactionSystem.js`: detección unificada de interactuables por proximidad con tecla `E`.
- **Simulación y Gameplay (`src/simulation/`, `src/integration/`, `src/gameplay/`):**
  - `farmSimulation.js`, `modes.js`, `economy.js`, `constants.js`: fuente única de verdad determinista para las modalidades **Subsistencia**, **Precisión (IoT)** y **Ecológica**, preparación de suelo (`prepareSoil`), cultivo de lechuga, riego manual/automático por umbral configurable (`setAutoIrrigationThreshold`), compostaje y reportes.
  - `farmAdapter.js`: bus de eventos (`stateChange`, `soilPrepared`, `cropPlanted`, `irrigated`, `compostApplied`, `thresholdChanged`, `dayAdvanced`, `harvested`) que mantiene sincronizados Three.js y HUD.
  - `missionManager.js` y `resultsStore.js`: tutorial guiado de 5 misiones y almacenamiento real de partidas con comparativa entre modalidades.
