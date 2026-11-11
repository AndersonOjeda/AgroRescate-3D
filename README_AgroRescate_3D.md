# AgroRescate 3D — finca low-poly con Blender y Three.js

## Entregables

- `generar_finca.py`: **script completo** de Blender (`bpy`), sin recursos externos.
- `public/models/finca.glb`: **se genera al ejecutar Blender**, sirve para la web.
- `finca.blend`: **se genera al ejecutar Blender**, editable.
- `public/models/finca.interactivos.json`: **se genera al ejecutar Blender**; también se incluye una copia inicial lista para revisar.
- `verificar_exportacion.py`: comprueba que el archivo GLB generado es válido, usa glTF 2.0, contiene materiales, mallas y nombres requeridos.

## Organización de carpetas

```text
AgroRescate-3D/
├── generar_finca.py
├── verificar_exportacion.py
├── finca.blend               (generado)
└── public/
    └── models/
        ├── finca.glb         (generado)
        └── finca.interactivos.json
```

## Ejecución mediante terminal

1. Instalar Blender 3.6 o superior, preferentemente una versión estable reciente.
2. Copiar los scripts a la raíz de **tu proyecto web** (la carpeta que contiene `public`).
3. Ejecutar en esa carpeta:

```bash
blender --background --python generar_finca.py
```

**Windows / PowerShell** (cambiar la versión/ruta según tu instalación):

```powershell
& "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" --background --python ".\generar_finca.py"
```

Si `blender` no está en el `PATH`, invocar su `blender.exe` con la ruta completa. También puedes abrir Blender → Scripting → Open → elegir `generar_finca.py` → Run Script; en ese caso usa `AGRO_PROJECT_ROOT` si necesitas controlar la carpeta de salida.

Para apuntar a otra raíz de proyecto:

```powershell
$env:AGRO_PROJECT_ROOT="D:\proyectos\AgroRescate-3D"
& "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" --background --python "D:\scripts\generar_finca.py"
```

**Advertencia:** el generador reinicia la escena de Blender antes de crear los modelos. No lo ejecutes sobre un proyecto abierto con cambios sin guardar.

## Comprobación automatizada

```bash
python verificar_exportacion.py
```

Deberías ver `VALIDACIÓN CORRECTA`. El propio generador de Blender también comprueba el contenedor GLB y los siete nodos interactivos obligatorios.

## Convención de coordenadas

Blender: **Z hacia arriba** → Three.js (glTF): **Y hacia arriba**.

La conversión que usa el JSON es `[x_blender, z_blender, -y_blender]`.

Ejemplos:

| Objeto | Blender XYZ | Three.js XYZ |
| --- | --- | --- |
| parcela_precision | (-10, 10, 0) | (-10, 0, -10) |
| parcela_subsistencia | (10, 10, 0) | (10, 0, -10) |
| parcela_ecologica | (-10, -10, 0) | (-10, 0, 10) |
| bomba_agua | (6.5, -15.6, 0) | (6.5, 0, 15.6) |
| almacen | (14, -9.4, 0) | (14, 0, 9.4) |

El JSON incluye los centros de las parcelas, límites X/Z, puntos de interacción y ubicaciones de cultivos de tres etapas. La representación por etapas es **estática**; no implementa crecimiento ni otra mecánica.

## Comprobaciones visuales recomendadas

- Abrir `finca.blend` en Blender: ver la escena, cámara y los grupos por colecciones.
- Abrir `finca.glb` en un visor de glTF/Three.js y comprobar colores y orientación vertical.
- En Three.js, cargar por ruta `/models/finca.glb`, ya que `public/` se publica desde la raíz web.
- Confirmar que `getObjectByName('almacen')` (o cualquier otro nombre requerido) encuentra un objeto.
- Revisar que el personaje aparece cerca de `spawn_jugador` (`[0, 0, 17.7]`) y que la altura del terreno coincide con la del personaje.
- Verificar que los caminos de aproximadamente 2.4 unidades no estén obstaculizados, y que la colisión del jugador la implemente el juego (el archivo es geometría, **no** añade física).
- Consultar el rendimiento en móvil: el escenario usa geometría sencilla y cultivos agrupados por zona/etapa, pero habrá que medir FPS reales en navegador.

## Restricciones técnicas

El script **no modifica ningún archivo JavaScript** ni implementa controles, NPC, físicas, interacción o riego funcional. Los objetos tecnológicos son representaciones low poly. No requiere descargar texturas, por lo que los colores Principled BSDF se exportan como materiales PBR glTF.
