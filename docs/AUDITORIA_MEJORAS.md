# Auditoría Inicial y Plan de Ejecución — AgroRescate 3D: Edición Mundo Vivo

**Fecha de Auditoría:** 13 de Noviembre de 2026  
**Proyecto:** AgroRescate 3D — Siembra, experimenta y aprende  
**Institución:** Universidad Cooperativa de Colombia (UCC)  
**Asignatura:** Programación Orientada a Entornos Multimedia  
**Docente:** Mg. Gabriel Guerrero Arellano  
**Estudiante / Desarrollador:** Anderson Ojeda  

---

## 1. Estado Inicial del Repositorio y Arquitectura

### 1.1 Estructura del Proyecto
* **Motor 3D:** Three.js `r168+` con WebGLRenderer optimizado (`alpha: false`, `powerPreference: 'high-performance'`).
* **Físicas:** Cannon-es v0.20.0 para colisiones y cajas físicas dinámicas.
* **Escenario 3D:** `public/models/finca.glb` (13.51 MB, 572 nodos, 528 mallas, 40x40 m de finca central) + horizonte procedural andino de 440x440 m en `landscapeEnhancer.js`.
* **Personaje y Rig:** `public/models/granjero.glb` (9.89 MB), transformado en tiempo de ejecución a `SkinnedMesh` procedural con esqueleto de 11 huesos en `farmerRig.js`.
* **Tutorial y Guía:** `public/models/gallina_guia.glb` (1.09 MB) para Rudy la gallina guía con animaciones de cabeza y aleteo.
* **Simulación Agrícola:** `farmSimulation.js` (desacoplada de Three.js y DOM), gestionando 3 parcelas, 4 modalidades, economía SIPSA-DANE/Corabastos en COP y variables de suelo/salud.
* **Pruebas y Build:** Vitest con 14 suites y 70 tests unitarios pasando al 100%. `vite build` compila en ~2.8s.

---

## 2. Verificación de los 8 Requisitos Académicos del Profesor

| Requisito Académico | Estado Observado | Ubicación en Código |
| :--- | :---: | :--- |
| **1. Escenario 3D Low-Poly** | ✅ Cumplido | `farmLoader.js` / `landscapeEnhancer.js` con montañas andinas y valle 360°. |
| **2. Personaje 3D y Controles (WASD/Flechas/Mouse + Touch)** | ✅ Cumplido | `playerController.js` y `touchControls.js` con puntero bloqueado y joystick virtual. |
| **3. Sistema de Cámaras (1ra y 3ra persona)** | ✅ Cumplido | `camera.js` con alternancia fluida (`V` o botón cámara en móvil). |
| **4. Animaciones (Idle, Walk, Run, Action, Gallina)** | ✅ Cumplido | `farmerRig.js` con clips de animación procedurales en tiempo real. |
| **5. Físicas y Colisiones (AABB, Triggers, Cajas Cannon-es)** | ✅ Cumplido | `physicsWorld.js` con gravedad, rebotes y triggers perimetrales. |
| **6. Audio Espacial y Efectos Sonoros (WebAudio)** | ✅ Cumplido | `audioSystem.js` con música de fondo, pasos, bomba posicional y cloqueos. |
| **7. Sistema de Partículas (Riego y Lluvia con Pooling)** | ✅ Cumplido | `particleSystem.js` con Float32Array, THREE.Points y cero GC en frame loop. |
| **8. Interfaz de Usuario / HUD y Elementos Multimedia** | ✅ Cumplido | `hud.js`, `gameModals.js` y `multimediaStation.js` con video procedural en canvas. |

---

## 3. Problemas Identificados y Oportunidades de Mejora ("Mundo Vivo")

1. **Clima Estático:** El clima actual solo cambia variables matemáticas numéricas; no hay lluvia visible estilizada sobre la cámara, ni relámpagos, ni cielo nublado/lluvioso en tiempo real.
2. **Ciclo Día/Noche Desconectado:** La noche actual solo ocurre durante un micro-evento de avance; falta una progresión ambiental orgánica con luciérnagas, estrellas y transición de luz solar andina.
3. **Vegetación Inmóvil:** Los árboles, bancales y cultivos están completamente tiesos; falta un shader ligero de oscilación por viento (breeze vertex sway) en mallas clave.
4. **Ausencia de Fauna Viva (Insectos y Aves):** Las parcelas carecen de polinizadores (mariposas, abejas) que indiquen biológicamente la salud del cultivo.
5. **Herramientas Visuales:** La azada modelada en el GLB debe verse en las manos del campesino durante la animación `hoe`.

---

## 4. Prioridades de Implementación

1. **`WeatherSystem` Modular:**
   * Climas: Soleado, Nublado, Lluvia estilizada cerca de la cámara, Tormenta con relámpagos controlados y Niebla andina.
   * Cero impacto en FPS para Android (partículas concentradas en radio cercano al jugador, `Float32Array`).
2. **`WildlifeSystem` (Fauna y Polinizadores):**
   * Mariposas y abejas low-poly sobrevolando las flores y el lote ecológico.
   * Luciérnagas nocturnas flotantes.
   * Aves lejanas en el cielo andino con trayectoria circular.
3. **Vegetación Dinámica (Viento Procedural):**
   * Oscilación de ramas y hojas reactiva al viento del clima activo.
4. **Herramienta en Mano y Animaciones Campesinas:**
   * Emparentar la azada a la mano del campesino durante la faena agrícola.
5. **Preservación Estricta de Pruebas y Rendimiento:**
   * Mantener los 70 tests pasando y verificar FPS estables en móviles.
