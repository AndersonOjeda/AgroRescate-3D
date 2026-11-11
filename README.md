# 🌱 AgroRescate 3D: Simulador Educativo de Agricultura Inteligente

**Proyecto Final — Programación Orientada a Entornos Multimedia**  
**Universidad Cooperativa de Colombia (UCC)**  
*Fecha de Entrega y Sustentación:* 11 de Noviembre de 2026, 7:00 p. m.  
*Rol Principal:* Codex (Ingeniero Senior — Arquitectura, Renderizado 3D, Físicas, Sistemas e Integración)

---

## 🎯 1. Objetivo del Proyecto

AgroRescate 3D es un simulador educativo interactivo en tres dimensiones que permite al usuario explorar una finca rural y experimentar con tres enfoques de agricultura:

1. **Agricultura de Subsistencia:** Métodos tradicionales, bajo presupuesto inicial, alto consumo hídrico por riego convencional y rendimiento agrícola tradicional.
2. **Agricultura de Precisión (IoT):** Monitoreo con sensores de humedad de suelo, optimización de riego por aspersión/goteo tecnificado y alta eficiencia productiva.
3. **Agricultura Ecológica:** Policultivo agroecológico, fertilización orgánica mediante compostera y conservación de la calidad del suelo.

El objetivo pedagógico es demostrar cómo las decisiones agronómicas y el manejo del agua impactan la sostenibilidad, el presupuesto y la cosecha.

---

## 🏗️ 2. Arquitectura del Proyecto

El código está estructurado de forma modular y desacoplada para facilitar el trabajo concurrente entre los tres integrantes del equipo:

```text
AgroRescate 3D/
├── blender/
│   ├── generar_finca.py     # Script bpy generador reproducible de la finca
│   └── finca.blend          # Escena editable de Blender
├── docs/
│   ├── ARQUITECTURA.md      # Arquitectura técnica entre Three.js, Cannon-es, simulación y HUD
│   ├── REQUISITOS.md        # Tabla de los 8 requisitos obligatorios del docente
│   └── PRUEBAS.md           # Registro real de pruebas automatizadas y compilación
├── public/
│   ├── audio/
│   │   ├── bgm.mp3          # Música ambiental en bucle
│   │   ├── pump.wav         # Sonido espacial de bomba y aspersor (loop)
│   │   ├── water.wav        # Audio de flujo de agua
│   │   ├── success.wav      # Audio global de éxito (arpegio armónico)
│   │   └── click.wav        # Feedback auditivo de UI
│   ├── models/
│   │   ├── finca.glb        # Escenario 3D de Blender
│   │   ├── granjero.glb     # Personaje animado de Blender
│   │   ├── finca.interactivos.json
│   │   └── posiciones.json  # Coordenadas de zonas interactivas
│   └── textures/
├── src/
│   ├── core/
│   │   ├── scene.js         # Escena Three.js, cielo, niebla atmosférica y luces con sombras
│   │   ├── renderer.js      # WebGLRenderer optimizado (sombras PCF, ACESFilmic, pixel ratio)
│   │   ├── camera.js        # Configuración de perspectiva
│   │   └── gameLoop.js      # Bucle con delta time independiente de FPS y medición de rendimiento
│   ├── world/
│   │   ├── cropPlot.js      # 5 estados visuales del cultivo (vacío, brote, crecimiento, madura, marchita)
│   │   ├── environment.js   # Escenario procedural completo (casa, granero, tanque, parcelas, árboles, cercas)
│   │   ├── farmLoader.js    # Cargador de finca.glb con soporte dual y fallback automático
│   │   └── multimediaStation.js # Pantalla multimedia interactiva (Semana 3) y Portal Neón (Semana 9)
│   ├── player/
│   │   └── playerController.js # Navegación dual (3ra persona y OrbitControls), colisiones y avatar campesino
│   ├── physics/
│   │   └── physicsWorld.js  # Mundo físico Cannon-es, gravedad -9.81, suelo y cajas con masa y rebote
│   ├── systems/
│   │   ├── interactionSystem.js # Interacción centralizada con tecla [E] y proximidad
│   │   ├── triggerSystem.js     # Triggers Radiales (Vector3.distanceTo) y AABB (Box3) con cooldown
│   │   ├── particleSystem.js    # Riego por aspersión (BufferGeometry, Float32Array, Pooling) y lluvia
│   │   └── audioSystem.js       # Audio Posicional (Bomba) y Global (Éxito) con desbloqueo Web Audio
│   ├── integration/
│   │   └── farmAdapter.js   # Capa de integración desacoplada entre el motor 3D y el simulador
│   ├── simulation/
│   │   └── farmSimulation.js # Módulo agronómico contractual (3 modos, agua, suelo, días, cosecha)
│   ├── ui/
│   │   ├── hud.js           # Heads-Up Display: telemetría, alertas toast, estado y depuración
│   │   └── debugGui.js      # Panel de inspección y control académico en vivo con lil-gui (Semanas 2 y 4)
│   ├── styles/
│   │   └── main.css         # Interfaz moderna Glassmorphism adaptativa
│   └── main.js              # Orquestador del ciclo de vida de la aplicación
├── tests/
│   ├── farmAdapter.test.js  # Pruebas del contrato agrícola y los 3 modos (7 tests)
│   ├── triggers.test.js     # Pruebas de detección radial y AABB (2 tests)
│   ├── physics.test.js      # Pruebas de gravedad, cajas Cannon-Three y static obstacles (2 tests)
│   ├── particleSystem.test.js # Pruebas de pooling y memoria de partículas (2 tests)
│   ├── playerCollision.test.js # Pruebas de colisiones, wall sliding y modelos Blender GLB (9 tests)
│   └── multimediaAndCamera.test.js # Pruebas de pantalla multimedia, portal y cámara dual (5 tests)
├── index.html
├── package.json
└── README.md
```

---

## 🎮 3. Controles de Juego

| Tecla / Control | Acción |
| :--- | :--- |
| **W, A, S, D** | Desplazamiento del agricultor en el plano XZ |
| **Shift** | Correr / Aumentar velocidad de movimiento |
| **Mouse** | Rotar cámara orbital en tercera persona (Pointer Lock) |
| **C** | **Alternar Modo de Cámara:** Tercera persona vs. Órbita Libre (`OrbitControls`) |
| **E** | **Interactuar** con el objeto más cercano (Bomba, Parcela, Sensor, Compostera, Almacén, Pantalla) |
| **F** | **Demostración física:** Arrojar una nueva caja dinámica con Cannon-es |
| **R** | Alternar lluvia ambiental y partículas atmosféricas |
| **H** | Abrir / cerrar la ventana **Cómo jugar** |
| **ESC** | Pausar simulación (volumen, calidad gráfica, reiniciar o menú) o cerrar modales |

---

## ⚡ 4. Requisitos Técnicos Cumplidos

1. **Renderizado 3D (Three.js & WebGL):**
   - Iluminación hemisférica, ambiental y solar direccional con mapa de sombras optimizado.
   - Tonemapping `ACESFilmicToneMapping` y espacio de color lineal sRGB.
   - Límite de pixel ratio (`Math.min(window.devicePixelRatio, 2)`) para garantizar 60 FPS estables.
2. **Navegación, Modelo Estilizado y Animaciones Procedurales:**
   - Cámara orbital en tercera persona con interpolación suave (`lerp`).
   - **Avatar Orgánico Articulado:** Campesino estilizado con overol de mezclilla, tirantes con hebillas de latón, camisa de franela, rostro detallado con bigote, sombrero de paja de ala curva con cinta verde y cartuchera lateral de campo.
   - **Animaciones Esqueléticas Procedurales:**
     - Zancada dinámica con balanceo coordinado de piernas y brazos opuestos.
     - Mayor amplitud, inclinación aerodinámica del torso y zancada rápida al correr con `Shift`.
     - Balanceo vertical rítmico de pelvis al desplazarse.
     - Animación suave de respiración e inactividad (*Idle*) al detenerse.
   - **Audio de Pisadas Dinámico:** Detección de impacto de pisada contra el terreno con modulación tonal y volumen aleatorio.
   - **Colisiones Sólidas y Wall Sliding:** Bloqueo físico en paredes de casas, granero, tanque, bomba, cercas y troncos de árboles con deslizamiento fluido.
   - **Molino de Viento:** Estructura rural con aspas rotatorias continuas que aportan vida al entorno.
   - **Modal de Comparativa Agronómica:** Panel interactivo en el HUD (`📊 Comparativa`) para exponer el análisis agronómico y de recursos en la sustentación.
3. **Físicas (Cannon-es):**
   - `CANNON.World` con gravedad vertical de `-9.81 m/s²`.
   - Suelo estático con material de fricción.
   - Cajas dinámicas con masa, colisiones y restitución elástica (rebote demostrable con tecla `F` o botón en HUD).
   - Paso temporal fijo: `world.step(1 / 60, deltaTime, 3)`.
4. **Triggers:**
   - **Radial (`THREE.Vector3.distanceTo`):** Aplicado en la bomba de agua y parcelas, con detección de `onEnter` y `onExit`.
   - **AABB (`THREE.Box3`):** Aplicado al cobertizo de almacenamiento y cosecha.
   - Cooldown y gestión de estado interno para evitar repeticiones continuas.
5. **Sistema de Partículas:**
   - Aspersores en las tres parcelas usando `THREE.BufferGeometry`, `Float32Array` y `THREE.Points`.
   - Trayectoria parabólica con gravedad y reciclaje estricto (Pooling) sin instanciar memoria en `animate()`.
   - Efecto secundario de lluvia ambiental conmutable.
6. **Audio Espacial y Global:**
   - `THREE.PositionalAudio` anclado al mesh de la bomba de agua con atenuación por distancia.
   - `THREE.Audio` global para campanada de éxito tras cosechas o acciones clave.
   - Manejo de restricciones de reproducción automática (`AudioContext.resume()`).
7. **Estados Visuales del Cultivo:**
   - 0: Parcela vacía (surcos de tierra arada)
   - 1: Semilla / Brote inicial
   - 2: Planta en crecimiento
   - 3: Planta madura con frutos
   - 4: Planta marchita por déficit hídrico
8. **Integración con Compañeros:**
   - **Compañero 2 (Blender):** `FarmLoader` busca `/models/finca.glb` y utiliza `posiciones.json`. Si no existe, activa el entorno procedural de respaldo sin interrumpir la demostración.
   - **Compañero 3 (Simulación & HUD):** `FarmAdapter` expone un contrato normalizado (`initializeFarm`, `plant`, `irrigate`, `advanceDay`, `harvest`, `getState`) con soporte para respuestas síncronas o asíncronas y eventos desacoplados.

---

## 🧪 5. Pruebas y Validación

El proyecto cuenta con una suite completa de pruebas automatizadas con Vitest:

```bash
# Ejecutar todas las pruebas unitarias
npm test
```

### Resultados de Verificación (56/56 Pruebas Pasadas en 12 Suites):
- **`tests/farmSimulation.test.js`** y **`tests/farmAdapter.test.js`**: 15 pruebas (modos, siembra, riego, evaporación, compost, cosecha y eventos).
- **`tests/gameplay.test.js`**: 4 pruebas (preparación previa del terreno, umbral IoT configurable, 5 misiones guiadas y resultados comparativos reales).
- **`tests/playerCollision.test.js`** y **`tests/playerController.test.js`**: 12 pruebas (colisiones GLB y procedurales, *Wall Sliding*, `granjero.glb` y Cannon-es).
- **`tests/multimediaAndCamera.test.js`**, **`tests/hud.test.js`** y **`tests/skySystem.test.js`**: 15 pruebas (pantalla multimedia, portal `Box3`, cámara dual `OrbitControls`, HUD y cielo).
- **`tests/audioSystem.test.js`**, **`tests/particleSystem.test.js`**, **`tests/triggers.test.js`** y **`tests/physics.test.js`**: 10 pruebas (volumen maestro, música, pooling de partículas, triggers radial/AABB y gravedad).
- **`npm run build`**: Compilación de producción en Vite completada con 0 errores. Ver detalle completo en [docs/PRUEBAS.md](docs/PRUEBAS.md).

---

## 🚀 6. Instalación y Ejecución

```bash
# 1. Clonar o acceder a la carpeta del proyecto
cd "AgroRescate 3D"

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor de desarrollo
npm run dev

# 4. Abrir en el navegador:
# http://localhost:5173/
```

Para compilar para entrega o producción:
```bash
npm run build
npm run preview
```
