# AgroRescate 3D — Módulo de Simulación Agrícola y HUD

Módulos independientes en JavaScript ES Modules (compatibles con Vite) que implementan la lógica agronómica, economía, tiempo virtual, reporte educativo de cosecha e interfaz HUD de **AgroRescate 3D**, sin depender ni modificar el motor gráfico principal en Three.js / Cannon-es.

> **Aviso educativo:** Todos los valores numéricos (evaporación, consumo hídrico, fertilidad, rendimiento y precios) son **valores educativos de demostración** para ilustrar conceptos de sostenibilidad y gestión agrícola; no representan datos científicos o agronómicos validados.

---

## 1. Estructura de Archivos

```text
src/
├── simulation/
│   ├── constants.js        # Modalidades, etapas del cultivo de lechuga y parámetros demo
│   ├── modes.js            # Lógica de riego manual, sensor virtual IoT y compostaje
│   ├── economy.js          # Salud, crecimiento determinista, rendimiento y reporte de cosecha
│   ├── farmSimulation.js   # Clase FarmSimulation y funciones exportadas del contrato
│   └── README.md           # Esta guía de arquitectura e integración
└── ui/
    ├── hud.js              # Clase HUD: telemetría, etapas, acciones, tarjeta de cosecha y demo
    └── hud.css             # Estilos Glassmorphism responsivos prefijados (.agro-hud-*)
```

---

## 2. Contrato Público de Simulación (`src/simulation/farmSimulation.js`)

El módulo expone tanto la clase `FarmSimulation` (utilizada por `src/integration/farmAdapter.js`) como funciones directas sobre la instancia activa:

- `initializeFarm(mode)`: reinicia la finca en `'subsistence'`, `'precision'` o `'ecological'` (acepta alias en español `'subsistencia'`, `'precisión'`, `'ecológica'`). Devuelve el estado inicial.
- `plant(plotId?)`: siembra lechuga en la parcela indicada o en la parcela activa disponible y descuenta el costo de semilla.
- `irrigate(plotId?)`: aplica riego en una parcela o en las parcelas sembradas, descontando agua del tanque y costo operativo.
- `advanceDay()`: avanza un día virtual de forma **100% determinista y reproducible** (evaporación, actualización de salud/fertilidad, crecimiento y riego automático IoT en Precisión).
- `harvest(plotId?)`: cosecha una parcela madura (o limpia una parcela marchita) y devuelve el reporte educativo con calidad, eficiencia hídrica, sostenibilidad y recomendaciones.
- `getState()`: devuelve una copia inmutable del estado completo (`mode`, `day`, `moisture`, `fertility`, `cropHealth`, `budget`, `waterReserve`, `waterConsumed`, `economy`, `sensor`, `lastHarvest`, `plots`, etc.).

### Funciones complementarias
- `applyCompost(plotId?)`: enriquece la fertilidad, mejora la retención de humedad y protege la salud del cultivo.
- `setAutoIrrigation(enabled)`: activa o desactiva el riego automático en modo Precisión.
- `refillWater(liters?)`: recarga el tanque de agua desde el presupuesto.
- `setActivePlot(plotId)`: cambia la parcela enfocada en el HUD.
- `getSensorReading(plotId?)`: consulta la lectura del sensor virtual de humedad.
- `runModesComparisonDemo()`: ejecuta una simulación comparativa aislada de los tres enfoques agrícolas sin alterar la partida en curso.

---

## 3. Cultivo Inicial (Lechuga) y Etapas

Cada parcela gestiona el ciclo completo de la **Lechuga** y su mapeo al `visualState` (`0..4`) esperado por `src/world/cropPlot.js`:

| Etapa (`stage`) | Etiqueta en HUD | `visualState` 3D | Descripción |
| :--- | :--- | :---: | :--- |
| `sin_sembrar` | Sin sembrar | `0` | Parcela disponible con surcos vacíos |
| `sembrado` | Sembrado | `1` | Semilla/brote recién plantado (`daysGrown === 0`) |
| `crecimiento` | Crecimiento | `2` | Desarrollo vegetativo según días simulados |
| `maduracion` | Maduración | `3` | Cultivo maduro listo para cosechar |
| `cosecha` | Cosecha | `0` *(tras recolectar)* | Registro de recolección y evaluación educativa |
| `marchito` | Marchito | `4` | Deterioro por déficit hídrico (`moisture < 15%`) |

---

## 4. Modalidades Agrícolas

1. **Subsistencia (`subsistence`)**: presupuesto inicial limitado (`$500`), tanque reducido (`600 L`), **riego manual** de alto consumo (`120 L`), evaporación más alta (`20%/día`) y desgaste gradual de fertilidad.
2. **Precisión (`precision`)**: **sensor virtual de humedad** en tiempo real y **riego automático** cuando la humedad de una parcela sembrada desciende por debajo del `45%` (`60 L` por evento).
3. **Ecológica (`ecological`)**: **compostaje orgánico** sin costo adicional desde la compostera, conservación de fertilidad (`0` desgaste diario cuando tiene compost), menor evaporación (`7%/día` con compost) y prima de valor ecológico en cosecha (`+25%` si fertilidad ≥ `80%`).

---

## 5. Integración con Three.js y el HUD (`src/ui/hud.js`)

El motor gráfico existente (`src/main.js` + `src/integration/farmAdapter.js`) ya se integra automáticamente con `FarmSimulation` y `HUD`:

### A. Recepción de coordenadas y zona desde Three.js
En el bucle de juego (`animate` / `gameLoop`), Three.js envía los datos al HUD sin que el HUD toque `THREE`:
```js
hud.updateCoordinates(playerPos.x, playerPos.y, playerPos.z);
hud.setZone('Parcela 2 — Precisión'); // Enfoca automáticamente plot_2 en el HUD
```

### B. Sincronización con `FarmAdapter`
`FarmAdapter` invoca `initializeFarm`, `plant`, `irrigate`, `advanceDay`, `harvest`, `applyCompost` y `getState`, sincroniza `CropPlot.setVisualState(plot.visualState)` y notifica al HUD mediante `hud.updateFarmState(state)`.

Opcionalmente, si el integrador desea que los botones directos del panel HUD también disparen los efectos 3D de `FarmAdapter` (audio, partículas y mallas en clic directo), puede conectar el adaptador en una línea tras instanciar ambos:
```js
hud.connectAdapter(farmAdapter);
```

---

## 6. Pruebas Unitarias y Demostración

```bash
# Ejecutar todas las pruebas unitarias (simulación, HUD y motor)
npm test

# Verificar compilación de producción con Vite
npm run build
```

Dentro de la aplicación ejecutada con `npm run dev`, el botón **`📊 Demo 3 Modos`** en el panel agrícola del HUD ejecuta `runModesComparisonDemo()` y muestra la comparativa lado a lado de Subsistencia, Precisión y Ecológica.

