# Registro de Pruebas y Validación — AgroRescate 3D

## 1. Pruebas Automatizadas (`npm test` con Vitest)

Comando ejecutado:
```bash
npm test
```

Resultado verificado tras la integración final: **12 archivos de prueba pasados, 56/56 pruebas pasadas, 0 fallos.**

| Archivo de Prueba | Tests | Qué Verifica | Estado |
|---|---|---|---|
| `tests/farmSimulation.test.js` | 8 | Inicialización de modalidades, siembra, riego, evaporación, compost, riego automático IoT, cosecha y comparativa demo. | ✅ Pasado |
| `tests/farmAdapter.test.js` | 7 | Contrato asíncrono/síncrono, emisión de eventos y sincronización visual de cultivos. | ✅ Pasado |
| `tests/gameplay.test.js` | 4 | Requisito de `prepareSoil` antes de sembrar, configuración del umbral IoT `[20, 80]`, avance secuencial de las 5 misiones y registro/comparativa real en `ResultsStore`. | ✅ Pasado |
| `tests/playerCollision.test.js` | 9 | Espacios libres, colisiones con casa, granero, tanque, bomba, *Wall Sliding* y colisionadores reales de `finca.glb` + `PhysicsWorld.setObstacles()`. | ✅ Pasado |
| `tests/playerController.test.js` | 3 | Carga y escalado de `granjero.glb`, respaldo procedural `farmerRig.js` y animaciones. | ✅ Pasado |
| `tests/multimediaAndCamera.test.js` | 5 | Estación multimedia `CanvasTexture`, portal neón `Box3` con cooldown, etapas GLB y cámara dual `OrbitControls`. | ✅ Pasado |
| `tests/hud.test.js` | 5 | Enlace con `farmAdapter`, actualización de zona, coordenadas y panel de simulación. | ✅ Pasado |
| `tests/skySystem.test.js` | 5 | Ciclo día/noche, nubes y transición de luces. | ✅ Pasado |
| `tests/audioSystem.test.js` | 3 | Reproducción de música `/audio/bgm.mp3`, respaldo Web Audio sintético y ajuste acotado del volumen maestro (`[0, 1]`). | ✅ Pasado |
| `tests/particleSystem.test.js` | 3 | Pooling de partículas (`BufferGeometry` / `Float32Array`), lluvia y polvo de pisadas. | ✅ Pasado |
| `tests/triggers.test.js` | 2 | Trigger radial euclidiano y trigger AABB `Box3`. | ✅ Pasado |
| `tests/physics.test.js` | 2 | Gravedad Cannon-es `-9.81 m/s²`, caída libre y sincronización con mallas Three.js. | ✅ Pasado |

## 2. Compilación de Producción (`npm run build`)

Comando ejecutado:
```bash
npm run build
```

Resultado verificado:
- Compilación completada con Vite (`dist/index.html`, `dist/assets/*.css`, `dist/assets/*.js`) con **0 errores**.

## 3. Verificaciones en Navegador

- **Comprobado previamente con Chrome DevTools (antes del merge de interfaces nuevas):**
  - Carga de `finca.glb`, ejecución a 60 FPS sin errores en consola, colisión frontal contra `casa_rural` deteniendo al jugador en $Z = 6.708\text{ m}$ sin atravesar paredes.
- **Pendiente de comprobación interactiva manual tras la última actualización de modales:**
  - Recorrer en navegador el flujo completo de menú inicial → selección de cada modalidad → preparación + siembra + riego + entrega en almacén → pantalla final de resultados + pausa (`ESC`) y ayuda (`H`).
