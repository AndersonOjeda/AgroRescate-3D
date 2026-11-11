"""AgroRescate 3D - generador reproducible de finca low-poly para Blender.

Uso desde la raíz del proyecto:
    blender --background --python generar_finca.py

Opcional: definir AGRO_PROJECT_ROOT para generar en otra carpeta.
Salida:
    finca.blend
    public/models/finca.glb
    public/models/finca.interactivos.json

Compatible con Blender 3.6+ y versiones modernas que incluyan el exportador glTF.
Todo se crea con bpy, sin complementos de terceros ni recursos externos.
"""

import json
import math
import os
import struct
from pathlib import Path

import bpy
from mathutils import Vector


# ----------------------------- CONFIGURACIÓN -----------------------------
SCRIPT_DIR = Path(__file__).resolve().parent if "__file__" in globals() else Path.cwd()
PROJECT_ROOT = Path(os.environ.get("AGRO_PROJECT_ROOT", SCRIPT_DIR)).expanduser().resolve()
MODELS_DIR = PROJECT_ROOT / "public" / "models"
BLEND_PATH = PROJECT_ROOT / "finca.blend"
GLB_PATH = MODELS_DIR / "finca.glb"
JSON_PATH = MODELS_DIR / "finca.interactivos.json"

TERRAIN_SIZE = 40.0
INTERACTIVOS = {}
CULTIVOS = []
COLECCIONES = {}
MATERIALES = {}


# ------------------------- ESCENA Y MATERIALES ----------------------------
def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.users == 0:
            bpy.data.collections.remove(collection)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.57, 0.72, 0.89, 1)
        background.inputs["Strength"].default_value = 0.8


def make_collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    COLECCIONES[name] = col
    return col


def to_collection(obj, col):
    for previous in list(obj.users_collection):
        previous.objects.unlink(obj)
    col.objects.link(obj)
    return obj


def to_linear(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def material(key, color_hex, roughness=0.9, metallic=0):
    color_hex = color_hex.lstrip("#")
    rgb = tuple(to_linear(int(color_hex[i:i + 2], 16) / 255) for i in (0, 2, 4))
    mat = bpy.data.materials.new(key)
    mat.use_nodes = True
    mat.diffuse_color = (*rgb, 1.0)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1.0)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    MATERIALES[key] = mat
    return mat


def setup_materials():
    palette = {
        "pasto": "#82BE66", "pasto_claro": "#9FD77A",
        "tierra": "#86583B", "surco": "#69442E", "sendero": "#E3CA9C",
        "piedra": "#AEB9AF", "blanco": "#F5EBD4", "madera": "#98663B",
        "madera_clara": "#C9935F", "madera_oscura": "#674329",
        "teja_roja": "#CB654E", "teja_azul": "#6086B5", "puerta": "#704D35",
        "cristal": "#A3DCE8", "verde_1": "#B3DD74", "verde_2": "#65B34D",
        "verde_3": "#2F8747", "verde_4": "#246E48", "tronco": "#785039",
        "fruta": "#DE5947", "maiz": "#EBC353", "amarillo": "#FFD166",
        "metal": "#697D84", "metal_claro": "#B4C4C9", "tuberia": "#4B5D60",
        "agua": "#4DAACF", "panel": "#315C89", "panel_celda": "#397BAC",
        "precision": "#5E9DD2", "subsistencia": "#E2B15A", "ecologica": "#6FB887",
        "piedra_montana": "#9CACB7", "montana_verde": "#89A88F",
        "paja": "#E6BB66", "compost": "#493829", "negro": "#25333B",
        "flor": "#EAA0BF", "suelo_azul": "#BED8E6",
    }
    for key, color in palette.items():
        material(key, color, 0.55 if key in {"panel", "panel_celda", "metal", "metal_claro", "agua"} else 0.95,
                 0.28 if key in {"metal", "metal_claro"} else 0.0)


def tag_interaction(obj, key, kind, x, y, radius=1.7, *, width=None, length=None, details=None):
    """Registra coordenadas PARA THREE.JS: [x, altura, -y_blender]."""
    obj["interactable"] = True
    obj["interaction_key"] = key
    obj["interaction_type"] = kind
    info = {
        "nodo_glb": obj.name,
        "tipo": kind,
        "posicion": [round(x, 3), 0.0, round(-y, 3)],
        "radio_interaccion": radius,
    }
    if width is not None:
        info["tamano_xz"] = [width, length]
        info["limites_xz"] = {
            "x": [round(x - width / 2, 3), round(x + width / 2, 3)],
            "z": [round(-y - length / 2, 3), round(-y + length / 2, 3)],
        }
    if details:
        info.update(details)
    INTERACTIVOS[key] = info
    return obj


def cube(name, location, dimensions, mat_key, col, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(MATERIALES[mat_key])
    to_collection(obj, col)
    return obj


def cylinder(name, location, radius, depth, mat_key, col, vertices=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(MATERIALES[mat_key])
    to_collection(obj, col)
    return obj


def cone(name, location, radius, depth, mat_key, col, vertices=7, radius_top=0):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius_top,
                                    depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(MATERIALES[mat_key])
    to_collection(obj, col)
    return obj


def beam(name, start, end, thickness, mat_key, col):
    a, b = Vector(start), Vector(end)
    center = (a + b) * 0.5
    delta = b - a
    obj = cube(name, center, (thickness, thickness, delta.length), mat_key, col)
    obj.rotation_euler = delta.to_track_quat("Z", "Y").to_euler()
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def pitched_roof(name, x, y, eave, width, length, rise, mat_key, col):
    """Techo a dos aguas: solo 6 vértices, sin modificadores."""
    w, l = width / 2, length / 2
    verts = [(-w, -l, 0), (0, -l, rise), (w, -l, 0),
             (-w, l, 0), (0, l, rise), (w, l, 0)]
    faces = [(0, 1, 4, 3), (1, 2, 5, 4), (0, 2, 1), (3, 4, 5), (0, 3, 5, 2)]
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(MATERIALES[mat_key])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    col.objects.link(obj)
    obj.location = (x, y, eave)
    return obj


# --------- AGRUPACIÓN DE CULTIVOS/DECORACIÓN EN POCAS MALLAS --------------
class MeshBatch:
    """Une muchas primitivas en una malla con varios materiales (pocas draw calls)."""

    def __init__(self):
        self.vertices, self.faces, self.indices = [], [], []
        self.material_keys = []

    def _push(self, vertices, faces, mat_key):
        if mat_key not in self.material_keys:
            self.material_keys.append(mat_key)
        mat_idx = self.material_keys.index(mat_key)
        offset = len(self.vertices)
        self.vertices.extend(vertices)
        for face in faces:
            self.faces.append(tuple(v + offset for v in face))
            self.indices.append(mat_idx)

    def box(self, xyz, dims, mat_key):
        x, y, z = xyz
        a, b, c = (n / 2 for n in dims)
        vv = [(x-a,y-b,z-c), (x+a,y-b,z-c), (x+a,y+b,z-c), (x-a,y+b,z-c),
              (x-a,y-b,z+c), (x+a,y-b,z+c), (x+a,y+b,z+c), (x-a,y+b,z+c)]
        ff = [(0,3,2,1), (4,5,6,7), (0,1,5,4), (1,2,6,5),
              (2,3,7,6), (3,0,4,7)]
        self._push(vv, ff, mat_key)

    def octa(self, xyz, radius, height, mat_key):
        x, y, z = xyz
        vv = [(x-radius,y,z), (x,y-radius,z), (x+radius,y,z),
              (x,y+radius,z), (x,y,z+height), (x,y,z-height)]
        ff = [(0,1,4), (1,2,4), (2,3,4), (3,0,4),
              (1,0,5), (2,1,5), (3,2,5), (0,3,5)]
        self._push(vv, ff, mat_key)

    def cone(self, xyz, radius, height, mat_key, n=7):
        x, y, z = xyz
        vv = [(x + radius * math.cos(i * 2 * math.pi / n),
               y + radius * math.sin(i * 2 * math.pi / n), z)
              for i in range(n)]
        vv.append((x, y, z + height))
        apex = n
        ff = [tuple(reversed(range(n)))] + [(i, (i + 1) % n, apex) for i in range(n)]
        self._push(vv, ff, mat_key)

    def build(self, name, col, extras=None):
        mesh = bpy.data.meshes.new(name + "_mesh")
        mesh.from_pydata(self.vertices, [], self.faces)
        for mat_key in self.material_keys:
            mesh.materials.append(MATERIALES[mat_key])
        mesh.update()
        for poly, idx in zip(mesh.polygons, self.indices):
            poly.material_index = idx
            poly.use_smooth = False
        obj = bpy.data.objects.new(name, mesh)
        col.objects.link(obj)
        if extras:
            for key, value in extras.items():
                obj[key] = value
        return obj


# -------------------------------- TERRENO ---------------------------------
def create_terrain(col):
    cube("terreno_40x40", (0,0,-0.27), (40,40,0.5), "pasto", col)
    cube("camino_principal_norte_sur", (0,0,0.013), (2.4,38,0.07), "sendero", col)
    cube("camino_principal_este_oeste", (0,0,0.017), (38,2.4,0.08), "sendero", col)
    cube("camino_edificios", (9,-4.35,0.02), (18,1.45,0.08), "sendero", col)
    for x in (7.3, 14.0):
        cube("acceso_edificio", (x,-5.7,0.03), (1.35,3.2,0.09), "sendero", col)
    cube("camino_bomba_y_tanque", (10.1,-13.05,0.025), (10.4,1.25,0.08), "sendero", col)
    cube("camino_servicio_vertical", (4.55,-12.25,0.026), (1.2,15.2,0.08), "sendero", col)


def plot(name, x, y, field_color, accent, col):
    base = cube(name, (x,y,0.12), (13,13,0.18), field_color, col)
    tag_interaction(base, name, "parcela", x, y, 2.2, width=13, length=13,
                    details={"agricultura": name.replace("parcela_", "")})
    border = MeshBatch()
    for edge_x in (x-6.48, x+6.48):
        border.box((edge_x,y,0.26), (0.11,12.7,0.18), accent)
    for edge_y in (y-6.48, y+6.48):
        border.box((x,edge_y,0.26), (12.7,0.11,0.18), accent)
    border.build(name + "_bordes", col)
    return base


def add_maize(batch, x, y, stage, z=0.38):
    h = {1: 0.34, 2: 0.82, 3: 1.52}[stage]
    batch.box((x,y,z+h/2), (0.11,0.11,h), "verde_3")
    leaves = {1: 2, 2: 4, 3: 6}[stage]
    for i in range(leaves):
        side = -1 if i % 2 else 1
        zz = z + h * (0.30 + 0.54 * i/max(1,leaves-1))
        batch.octa((x + side * 0.19, y, zz), 0.23 if stage > 1 else 0.14,
                   0.055, "verde_2")
    if stage == 3:
        batch.cone((x,y,z+h-0.02), 0.15, 0.24, "maiz", n=5)
        batch.octa((x+0.17,y,z+h*0.65), 0.11, 0.20, "maiz")


def add_tomato(batch, x, y, stage, z=0.38):
    h = {1: 0.25, 2: 0.58, 3: 1.02}[stage]
    batch.box((x,y,z+h/2), (0.09,0.09,h), "verde_3")
    count = {1: 2, 2: 4, 3: 7}[stage]
    for i in range(count):
        theta = 2 * math.pi * i / count
        r = 0.18 if stage == 1 else 0.32
        batch.octa((x + math.cos(theta)*r, y + math.sin(theta)*r,
                    z + h * (0.45 + 0.4*(i % 3)/3)), 0.17, 0.12, "verde_2")
    if stage == 3:
        for i in range(3):
            theta = math.pi * i * 0.77
            batch.octa((x + 0.21*math.cos(theta), y + 0.21*math.sin(theta),
                        z + 0.34 + i * 0.14), 0.13, 0.14, "fruta")


def add_lettuce(batch, x, y, stage, z=0.43):
    size = {1: 0.15, 2: 0.28, 3: 0.41}[stage]
    petals = {1: 3, 2: 5, 3: 7}[stage]
    for i in range(petals):
        theta = 2 * math.pi * i / petals
        r = size * 0.72
        batch.octa((x + r*math.cos(theta), y + r*math.sin(theta), z+size*0.60),
                   size*0.65, size*0.78, "verde_1" if i % 3 == 0 else "verde_2")
    batch.octa((x,y,z+size*0.65), size*0.65, size, "verde_3")


def create_crops(col_precision, col_subsistencia, col_eco):
    # Tres niveles de crecimiento visibles a la vez para demostración educativa.
    def grow_zone(zone, crop_kind, col, coordinates, zbase):
        by_stage = {1: MeshBatch(), 2: MeshBatch(), 3: MeshBatch()}
        placements = {1: [], 2: [], 3: []}
        for x, y, stage in coordinates:
            if crop_kind == "maiz":
                add_maize(by_stage[stage], x, y, stage, zbase)
            elif crop_kind == "tomate":
                add_tomato(by_stage[stage], x, y, stage, zbase)
            else:
                add_lettuce(by_stage[stage], x, y, stage, zbase)
            placements[stage].append([round(x,3), 0, round(-y,3)])
        for stage in (1,2,3):
            name = f"cultivo_{zone}_etapa_{stage}"
            by_stage[stage].build(name, col,
                                  {"cultivo": crop_kind, "growth_stage": stage, "zone": zone})
            CULTIVOS.append({"nodo_glb": name, "parcela": "parcela_"+zone,
                             "especie": crop_kind, "etapa": stage,
                             "posiciones": placements[stage]})

    positions = []
    for i, x in enumerate((-14.7,-12.25,-9.8,-7.35,-4.9)):
        for j, y in enumerate((5.9,7.9,9.9,11.9,13.9)):
            positions.append((x,y,1 if j == 0 else 2 if j in (1,2) else 3))
    grow_zone("precision", "maiz", col_precision, positions, 0.40)

    positions = []
    for i, x in enumerate((5.15,7.55,9.95,12.35,14.75)):
        for j, y in enumerate((5.9,7.9,9.9,11.9,13.9)):
            positions.append((x,y,1 if j == 0 else 2 if j in (1,2) else 3))
    grow_zone("subsistencia", "tomate", col_subsistencia, positions, 0.40)

    positions = []
    for j, y in enumerate((-6.2,-9.2,-12.2,-15.1)):
        for x in (-14.4,-12.9,-11.4,-9.25,-7.75,-6.25):
            positions.append((x,y,1 if j == 0 else 2 if j == 1 else 3))
    grow_zone("ecologica", "lechuga", col_eco, positions, 0.48)


def create_precision(col, irrigation_col):
    plot("parcela_precision", -10, 10, "tierra", "precision", col)
    beds = MeshBatch()
    for x in (-14.7,-12.25,-9.8,-7.35,-4.9):
        beds.box((x,9.9,0.26), (1.05,10.3,0.16), "surco")
    beds.build("surcos_precision", col)
    pipes = MeshBatch()
    for x in (-14.7,-12.25,-9.8,-7.35,-4.9):
        pipes.box((x-0.5,9.9,0.36), (0.065,10.3,0.07), "tuberia")
        for y in (6.2,8.1,10.0,11.9,13.8):
            pipes.box((x-0.50,y,0.39), (0.13,0.09,0.06), "agua")
    pipes.build("riego_goteo_precision", irrigation_col)

    for i, (x,y) in enumerate(((-15.3,15.3),(-4.5,15.3))):
        cylinder("aspersor_base_%d"%i, (x,y,0.5), 0.16,0.7,"metal",irrigation_col,6)
        cylinder("aspersor_cabeza_%d"%i, (x,y,1.0), 0.30,0.15,"agua",irrigation_col,8)
        beam("brazo_aspersor_%d"%i, (x-0.26,y,0.99),(x+0.26,y,0.99),0.08,"metal_claro",irrigation_col)

    sensor = cylinder("sensor_humedad", (-4.0,5.0,0.68), 0.15,1.05,"metal_claro",col,6)
    cube("sensor_humedad_display",(-4,5,1.29),(0.5,0.26,0.35),"panel",col)
    cube("sensor_humedad_led",(-4,4.849,1.30),(0.15,0.05,0.10),"verde_1",col)
    tag_interaction(sensor, "sensor_humedad", "sensor", -4,5,1.5,
                    details={"parcela":"parcela_precision", "magnitud":"humedad_suelo"})
    # Panel en un lateral sin bloquear los caminos principales.
    cube("panel_solar_base",(-16.0,4.2,0.66),(0.18,0.18,0.9),"metal",col)
    cube("panel_solar",(-16.0,4.2,1.25),(1.3,0.9,0.09),"panel",col,
         rotation=(math.radians(22),0,0))
    for ox in (-0.35,0.0,0.35):
        cube("celda_solar",(-16.0+ox,4.19,1.32),(0.25,0.62,0.012),"panel_celda",col,
             rotation=(math.radians(22),0,0))


def create_subsistence(col):
    plot("parcela_subsistencia", 10,10,"tierra","subsistencia",col)
    beds = MeshBatch()
    for x in (5.15,7.55,9.95,12.35,14.75):
        beds.box((x,9.9,0.25),(1.17,10.35,0.15),"surco")
    beds.build("surcos_subsistencia",col)
    # Espantapájaros pequeño en la esquina superior, sin tapar la circulación.
    beam("espantapajaros_poste",(16,15.5,0.25),(16,15.5,2.2),0.17,"madera",col)
    beam("espantapajaros_brazos",(15.4,15.5,1.61),(16.6,15.5,1.61),0.14,"madera",col)
    cube("espantapajaros_camisa",(16,15.5,1.43),(0.75,0.45,0.58),"teja_roja",col)
    cylinder("espantapajaros_cabeza",(16,15.5,2.2),0.25,0.42,"paja",col,8)
    cone("espantapajaros_sombrero",(16,15.5,2.51),0.45,0.23,"madera_oscura",col,7)
    cube("cajon_herramientas",(4.2,15.5,0.5),(0.8,0.52,0.6),"madera",col)
    beam("azada_mango",(4.2,15.3,0.5),(3.8,15.3,1.75),0.11,"madera_clara",col)
    cube("azada_cabeza",(3.8,15.3,1.75),(0.52,0.1,0.18),"metal",col)


def create_ecological(col):
    plot("parcela_ecologica",-10,-10,"pasto_claro","ecologica",col)
    raised = MeshBatch()
    for y in (-6.2,-9.2,-12.2,-15.1):
        for x in (-13.1,-7.6):
            raised.box((x,y,0.29),(4.85,1.45,0.32),"madera")
            raised.box((x,y,0.49),(4.55,1.2,0.1),"tierra")
    raised.build("bancales_ecologicos",col)
    compost = cube("compostera",(-4.6,-15.1,0.65),(1.25,1.5,1.0),"madera_oscura",col)
    cube("compostera_contenido",(-4.6,-15.1,1.18),(1.08,1.27,0.10),"compost",col)
    for y in (-15.7,-15.2,-14.7):
        cube("compostera_lama",(-5.26,y,0.7),(0.07,0.14,0.95),"madera_clara",col)
    tag_interaction(compost,"compostera","compostaje",-4.6,-15.1,1.6,
                    details={"parcela":"parcela_ecologica"})
    # Flores melíferas en extremos; un objeto combinado en vez de decenas de mallas.
    flowers = MeshBatch()
    for x,y in ((-15.7,-5.0),(-5.3,-5.1),(-15.5,-16),(-8,-16),(-5.5,-13.5)):
        flowers.box((x,y,0.43),(0.06,0.06,0.65),"verde_3")
        flowers.octa((x,y,0.81),0.16,0.16,"flor")
    flowers.build("flores_polinizadoras",col)


# -------------------------------- EDIFICIOS -------------------------------
def create_buildings(col, water_col):
    x, y = 7.3,-9.4
    cube("casa_rural",(x,y,1.81),(4.65,4.35,3.20),"blanco",col)
    pitched_roof("techo_casa",x,y,3.43,5.35,4.9,1.17,"teja_roja",col)
    cube("puerta_casa",(x,y+2.19,1.21),(1.0,0.10,2.0),"puerta",col)
    cylinder("pomo_casa",(x+0.34,y+2.28,1.18),0.045,0.08,"amarillo",col,6)
    for wx in (x-1.43,x+1.43):
        cube("ventana_casa",(wx,y+2.19,1.95),(0.85,0.10,0.87),"cristal",col)
        cube("marco_ventana",(wx,y+2.26,1.95),(0.065,0.07,0.95),"madera_oscura",col)
        cube("marco_ventana",(wx,y+2.26,1.95),(0.93,0.07,0.065),"madera_oscura",col)
    cube("chimenea",(x-1.12,y-0.75,4.1),(0.58,0.56,1.25),"piedra",col)

    x,y=14.0,-9.4
    barn=cube("almacen",(x,y,1.92),(4.6,4.55,3.4),"madera",col)
    tag_interaction(barn,"almacen","almacenamiento",x,y,2.2,
                    details={"acceso_three":[14,0,6.9]})
    pitched_roof("techo_almacen",x,y,3.65,5.26,5.03,1.3,"teja_azul",col)
    for ox in (-0.59,0.59):
        cube("porton_almacen",(x+ox,y+2.32,1.48),(1.08,0.12,2.6),"madera_oscura",col)
    for ox in (-1.05,1.05):
        cube("bisagra_almacen",(x+ox,y+2.40,1.55),(0.13,0.12,0.27),"metal",col)
    for i in range(3):
        cube("fardo_paja",(16.3,-14.3,0.38+i*0.52),(0.98,0.83,0.48),"paja",col)

    # Zona técnica, al sur de los edificios.
    pump = cube("bomba_agua",(6.5,-15.6,0.68),(1.0,0.8,0.83),"metal",water_col)
    cylinder("motor_bomba",(6.5,-15.6,1.24),0.39,0.35,"panel",water_col,8)
    beam("tubo_succion",(6.8,-15.6,0.7),(7.65,-15.6,0.7),0.20,"tuberia",water_col)
    cube("indicador_bomba",(6.5,-16.03,0.73),(0.35,0.07,0.25),"agua",water_col)
    tag_interaction(pump,"bomba_agua","riego",6.5,-15.6,1.8,
                    details={"sistema":"aspersores_y_goteo"})

    tank = cylinder("tanque_agua",(13.25,-15.7,1.6),1.15,2.70,"agua",water_col,10)
    cylinder("tapa_tanque",(13.25,-15.7,3.02),1.20,0.15,"metal",water_col,10)
    for dx,dy in ((-1.0,-1.0),(-1.0,1.0),(1.0,-1.0),(1.0,1.0)):
        beam("soporte_tanque",(13.25+dx*0.62,-15.7+dy*0.62,0.25),
             (13.25+dx*0.62,-15.7+dy*0.62,0.65),0.15,"metal",water_col)
    tag_interaction(tank,"tanque_agua","reserva_agua",13.25,-15.7,2.0,
                    details={"capacidad_referencial_litros":1000})
    beam("tuberia_bomba_tanque",(7.65,-15.6,0.38),(12.0,-15.7,0.38),0.13,"tuberia",water_col)


# ----------------------------- DECORACIÓN --------------------------------
def create_fence(col):
    fence = MeshBatch()
    coords = [i for i in range(-18, 19, 3)]  # 13 postes en cada eje
    for edge_y in (-19,19):
        for x in coords:
            if edge_y == -19 and abs(x) <= 2:
                continue  # acceso principal de 4 m
            fence.box((x,edge_y,0.67),(0.20,0.20,1.32),"madera_oscura")
        for a,b in zip(coords[:-1],coords[1:]):
            mid = (a+b)*0.5
            if edge_y == -19 and abs(mid) <= 2.5:
                continue
            for z in (0.57,1.04):
                fence.box((mid,edge_y,z),(3.0,0.11,0.12),"madera_clara")
    for edge_x in (-19,19):
        for y in coords:
            fence.box((edge_x,y,0.67),(0.20,0.20,1.32),"madera_oscura")
        for a,b in zip(coords[:-1],coords[1:]):
            for z in (0.57,1.04):
                fence.box((edge_x,(a+b)/2,z),(0.11,3.0,0.12),"madera_clara")
    fence.build("cerca_perimetral",col)


def create_trees_and_landscape(col):
    trees = MeshBatch()
    # No se colocan árboles sobre el eje de las rutas.
    tree_positions = [(-17.7,17.9,1.0),(17.6,17.9,0.95),(-17.8,-17.7,1.1),
                      (17.8,-17.8,1.0),(-17.8,1.8,0.85),(17.8,1.8,0.86),
                      (17.7,-3.2,0.84),(-18.0,-3.0,0.84)]
    for i,(x,y,s) in enumerate(tree_positions):
        trees.box((x,y,1.13*s),(0.39*s,0.39*s,2.22*s),"tronco")
        trees.octa((x,y,3.12*s),1.40*s,1.52*s,"verde_3")
        trees.octa((x-0.60*s,y-0.10*s,2.78*s),0.92*s,0.86*s,"verde_2")
        trees.octa((x+0.65*s,y+0.10*s,2.82*s),0.92*s,0.86*s,"verde_4")
        if i % 2 == 0:
            trees.octa((x+0.64*s,y-0.20*s,2.90*s),0.14*s,0.14*s,"fruta")
    trees.build("arboles_decorativos",col)
    mountains = MeshBatch()
    for x,y,r,h in [(-27,26,9.3,10),(-13,28,10.0,12),(2,29,10.0,13),
                    (18,27,10.0,11),(30,25,10.0,9),(-30,-26,9,8),(29,-26,9,8)]:
        mountains.cone((x,y,-0.65),r,h,"montana_verde" if x%2 else "piedra_montana",n=7)
        mountains.cone((x,y,-0.65+h*0.78),r*0.23,h*0.22,"blanco",n=7)
    mountains.build("montanas_de_fondo",col)
    # Pequeñas piedras de sendero para un acabado más vistoso.
    stones = MeshBatch()
    for x,y in ((2,2),(-2,-2),(-2,2),(2,-2),(3,-1.6),(8,-3.3),(14,-3.3)):
        stones.octa((x,y,0.11),0.28,0.11,"piedra")
    stones.build("piedras_decorativas",col)


def create_blender_preview():
    """Cámara y luz se guardan en .blend; se excluyen del archivo GLB."""
    light_data = bpy.data.lights.new("Sol_finca", "SUN")
    light_data.energy = 2.0
    sun = bpy.data.objects.new("Sol_finca", light_data)
    COLECCIONES["99_Camara_y_Luz"].objects.link(sun)
    sun.rotation_euler = (math.radians(27),math.radians(-18),math.radians(-32))
    camera_data = bpy.data.cameras.new("Camara_general")
    cam = bpy.data.objects.new("Camara_general", camera_data)
    COLECCIONES["99_Camara_y_Luz"].objects.link(cam)
    cam.location = (42,-54,50)
    direction = Vector((0,0,0)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z","Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 57
    bpy.context.scene.camera = cam


# -------------------------------- EXPORTACIÓN ----------------------------
def validate_glb(path, mandatory_names):
    """Comprueba estructura GLB 2.0 y presencia de nodos requeridos."""
    blob = path.read_bytes()
    if len(blob) < 32 or blob[:4] != b"glTF":
        raise RuntimeError("No se generó un GLB válido (cabecera glTF ausente)")
    magic, version, total_length = struct.unpack_from("<4sII",blob,0)
    if version != 2 or total_length != len(blob):
        raise RuntimeError("Longitud o versión del GLB incorrecta")
    chunk_len, chunk_type = struct.unpack_from("<I4s",blob,12)
    if chunk_type != b"JSON":
        raise RuntimeError("El primer bloque del GLB debe ser JSON")
    document = json.loads(blob[20:20+chunk_len].decode("utf8"))
    nodes = {obj.get("name") for obj in document.get("nodes",[])}
    missing = set(mandatory_names) - nodes
    if missing:
        raise RuntimeError("Faltan nodos en el GLB: " + ", ".join(sorted(missing)))
    if not document.get("meshes") or not document.get("materials"):
        raise RuntimeError("GLB incompleto: no tiene mallas o materiales")
    return len(nodes), len(document["meshes"]), len(document["materials"])


def export_scene():
    MODELS_DIR.mkdir(parents=True,exist_ok=True)
    PROJECT_ROOT.mkdir(parents=True,exist_ok=True)
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "PNG"
    # Selección desactivada: el exportador incluirá todos los objetos MESH.
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)
    if not hasattr(bpy.ops.export_scene,"gltf"):
        try:
            bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
        except Exception as exc:
            raise RuntimeError("Activa el exportador glTF 2.0 en Blender") from exc

    # Filtrar parámetros por versión: la API del exportador cambia entre Blender 3/4/5.
    expected = dict(filepath=str(GLB_PATH), export_format="GLB", export_yup=True,
                    export_extras=True, export_materials="EXPORT", export_normals=True,
                    export_texcoords=False, export_animations=False, export_cameras=False,
                    export_lights=False, export_skins=False, export_morph=False,
                    use_selection=False, export_apply=False)
    allowed = {prop.identifier for prop in bpy.ops.export_scene.gltf.get_rna_type().properties}
    options = {key:value for key,value in expected.items() if key in allowed}
    result = bpy.ops.export_scene.gltf(**options)
    if "FINISHED" not in result or not GLB_PATH.exists():
        raise RuntimeError("Blender no pudo exportar el archivo GLB")

    metadata = {
        "proyecto":"AgroRescate 3D",
        "archivo_glb":"/models/finca.glb",
        "unidades":"metros aproximados (1 unidad Blender = 1 unidad Three.js)",
        "coordenadas":"Three.js (X horizontal, Y vertical, Z profundidad)",
        "conversion_blender_a_three":"[x_blender, z_blender, -y_blender]",
        "terreno":{"centro":[0,0,0],"tamano_xz":[40,40],
                   "limites_xz":{"x":[-20,20],"z":[-20,20]}},
        "spawn_jugador":{"posicion":[0,0,17.7],"orientacion":"hacia z negativo"},
        "caminos_transitables":[
            {"id":"principal_norte_sur","centro":[0,0,0],"tamano_xz":[2.4,38]},
            {"id":"principal_este_oeste","centro":[0,0,0],"tamano_xz":[38,2.4]},
            {"id":"acceso_edificios","centro":[9,0,4.35],"tamano_xz":[18,1.45]},
        ],
        "interactivos":INTERACTIVOS,
        "cultivos":CULTIVOS,
        "nota":"Las posiciones son puntos de interacción sobre el suelo; los nodos GLB conservan geometría y pivotes propios. Las etapas se muestran simultáneamente como ejemplos, sin lógica de juego.",
    }
    JSON_PATH.write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding="utf8")

    required = ("parcela_precision","parcela_subsistencia","parcela_ecologica",
                "bomba_agua","almacen","compostera","sensor_humedad",
                "cultivo_precision_etapa_1","cultivo_precision_etapa_2",
                "cultivo_precision_etapa_3")
    node_count, mesh_count, mat_count = validate_glb(GLB_PATH, required)
    print("\n=== AGRORESCATE 3D: EXPORTACIÓN TERMINADA ===")
    print("Proyecto editable:", BLEND_PATH)
    print("Modelo web GLB:", GLB_PATH)
    print("Coordenadas JSON:", JSON_PATH)
    print(f"Archivo: {GLB_PATH.stat().st_size/1024/1024:.2f} MB")
    print(f"Nodos GLB: {node_count}; mallas: {mesh_count}; materiales: {mat_count}")
    print("Objetos interactivos:",", ".join(sorted(INTERACTIVOS)))


def main():
    reset_scene()
    setup_materials()
    names = ["00_Terreno_y_Caminos","01_Parcela_Precision",
             "02_Parcela_Subsistencia","03_Parcela_Ecologica",
             "04_Casa_y_Almacen","05_Agua_y_Riego",
             "06_Decoracion","99_Camara_y_Luz"]
    for name in names:
        make_collection(name)
    create_terrain(COLECCIONES[names[0]])
    create_precision(COLECCIONES[names[1]],COLECCIONES[names[5]])
    create_subsistence(COLECCIONES[names[2]])
    create_ecological(COLECCIONES[names[3]])
    create_crops(COLECCIONES[names[1]],COLECCIONES[names[2]],COLECCIONES[names[3]])
    create_buildings(COLECCIONES[names[4]],COLECCIONES[names[5]])
    create_fence(COLECCIONES[names[6]])
    create_trees_and_landscape(COLECCIONES[names[6]])
    create_blender_preview()
    export_scene()


if __name__ == "__main__":
    main()
