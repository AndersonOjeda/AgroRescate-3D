# Matriz de Cumplimiento — Los 8 Requisitos Obligatorios del Docente

**Docente:** Mg. Gabriel Guerrero Arellano  
**Asignatura:** Programación Orientada a Entornos Multimedia (UCC)

| # | Requisito del Profesor | Módulo / Archivo | Cómo Demostrarlo en Vivo | Estado |
|---|---|---|---|---|
| **1** | **Escenario 3D en Blender (`.glb`) con iluminación y sombras en Three.js** | `blender/generar_finca.py`, `public/models/finca.glb`, `src/world/farmLoader.js`, `src/core/scene.js` | Al iniciar el juego carga `finca.glb` (terreno 40×40, casa rural, almacén, 3 parcelas, bomba, tanque, compostera, sensor y cerca) con `castShadow`/`receiveShadow`. Conmutable en vivo con `lil-gui`. | ✅ Verificado |
| **2** | **Navegación fluida (`OrbitControls` o `PointerLockControls` + 3ra persona)** | `src/player/playerController.js`, `src/player/farmerRig.js`, `public/models/granjero.glb` | Caminar/correr con `WASD` + `Shift`, rotar cámara con Pointer Lock (`Mouse`), alternar a vista orbital libre (`OrbitControls`) con tecla `C` o botón `🎥 Cámara`. | ✅ Verificado |
| **3** | **Audio 3D: `PositionalAudio` anclado + `THREE.Audio` global** | `src/systems/audioSystem.js`, `src/main.js` | Activar la bomba de agua con `E` y alejarse/acercarse para oír la atenuación de `PositionalAudio`; cosechar o completar entrega para escuchar `THREE.Audio` global (`playSuccess` / `playGameComplete`). Volumen ajustable desde menú y pausa. | ✅ Verificado |
| **4** | **Triggers: ≥ 1 Radial (`distanceTo`) y ≥ 1 AABB (`THREE.Box3`)** | `src/systems/triggerSystem.js`, `src/main.js` | Acercarse a la bomba/parcelas dispara el trigger radial; entrar al almacén dispara el trigger AABB (`THREE.Box3`) con `onEnter`, `onStay` y `onExit` (actualiza zona y recibe la cosecha). | ✅ Verificado |
| **5** | **Partículas: `BufferGeometry` + `Float32Array` + `Points` con física** | `src/systems/particleSystem.js` | Activar riego (botón `💧 Regar` o bomba con `E`) o lluvia (`R` / botón `🌧️ Clima`). Usa pool prealojado de partículas con trayectoria parabólica y gravedad sin crear objetos en `animate()`. | ✅ Verificado |
| **6** | **Físicas Cannon-es: masa, gravedad, colisiones, rebote y sincronización** | `src/physics/physicsWorld.js`, `src/player/playerController.js` | Presionar `F` o `📦 Caída Física` cerca del almacén: cae una caja rígida con gravedad `-9.81 m/s²`, rebota con restitución y choca contra el suelo, el jugador y los colisionadores estáticos de `finca.glb`. | ✅ Verificado |
| **7** | **HUD HTML/CSS: zona actual, coordenadas X/Y/Z y variables agrícolas** | `index.html`, `src/ui/hud.js`, `src/ui/hud.css`, `src/ui/gameModals.js` | Barra superior con modo/día/agua/suelo/presupuesto/cosecha + botón Pausa; panel lateral agrícola + misiones; barra inferior con `Zona` y `POS: X \| Y \| Z` en tiempo real. | ✅ Verificado |
| **8** | **Optimización: objetivo 60 FPS sin instanciaciones en `animate()`** | `src/core/gameLoop.js`, `src/core/renderer.js`, `src/player/playerController.js` | Contador real de `FPS` visible en el HUD inferior. Vectores reutilizables, pooling de partículas y paso físico fijo `1/60`. | ✅ Verificado |

## Cumplimiento del Prompt Maestro
- **Bienvenida y Modalidades:** Pantalla inicial con título, subtítulo *"Siembra, experimenta y aprende"*, botones *"Nueva partida"*, *"Cómo jugar"* (`H`), *"Acerca del proyecto"*, volumen maestro, calidad gráfica y tarjetas detalladas de Subsistencia, Precisión IoT y Ecológica.
- **Ciclo Completo del Cultivo:** Preparar terreno → Sembrar lechuga → Regar y acción especial (balde / sensor IoT con umbral configurable / compost orgánico) → Avanzar días → Cosechar → Entregar en almacén → Consultar resultados y comparativa real entre modalidades jugadas.
- **Tutorial Guiado:** 5 misiones progresivas en `#mission-hud` sincronizadas con la simulación.
- **Modo Demostración:** Botón `⚡ Demo Ciclo` en el HUD para acelerar la maduración durante la sustentación de 5 minutos sin alterar el modo normal.
