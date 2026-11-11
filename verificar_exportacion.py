"""Verifica /public/models/finca.glb y finca.interactivos.json sin Blender.

Ejecutar desde la raíz del proyecto: python verificar_exportacion.py
"""
import json
import struct
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
GLB = PROJECT_ROOT / "public" / "models" / "finca.glb"
META = PROJECT_ROOT / "public" / "models" / "finca.interactivos.json"
MANDATORY = {"parcela_precision", "parcela_subsistencia", "parcela_ecologica",
             "bomba_agua", "almacen", "compostera", "sensor_humedad"}
MANDATORY |= {f"cultivo_{zone}_etapa_{stage}"
              for zone in ("precision", "subsistencia", "ecologica")
              for stage in (1, 2, 3)}


def main():
    errors = []
    if not GLB.is_file() or GLB.stat().st_size < 32:
        errors.append("No existe un GLB válido en public/models/finca.glb")
    else:
        data = GLB.read_bytes()
        magic, version, file_length = struct.unpack_from("<4sII", data, 0)
        if magic != b"glTF" or version != 2 or file_length != len(data):
            errors.append("Cabecera GLB inválida")
        else:
            chunk_length, chunk_type = struct.unpack_from("<I4s",data,12)
            if chunk_type != b"JSON":
                errors.append("No se encontró el bloque JSON de glTF")
            else:
                doc = json.loads(data[20:20+chunk_length].decode("utf8"))
                node_names = {node.get("name") for node in doc.get("nodes", [])}
                missing = MANDATORY - node_names
                if missing:
                    errors.append("Faltan nodos: " + ", ".join(sorted(missing)))
                if not doc.get("meshes") or not doc.get("materials"):
                    errors.append("Faltan mallas o materiales en el GLB")
                print(f"GLB: {len(data)/1048576:.2f} MB, "
                      f"{len(doc.get('nodes',[]))} nodos, "
                      f"{len(doc.get('meshes',[]))} mallas")
    if not META.is_file():
        errors.append("No existe public/models/finca.interactivos.json")
    else:
        meta = json.loads(META.read_text(encoding="utf8"))
        inter = meta.get("interactivos",{})
        missing = set(["parcela_precision","parcela_subsistencia","parcela_ecologica",
                       "bomba_agua","almacen","compostera","sensor_humedad"]) - set(inter)
        if missing:
            errors.append("Faltan interactivos JSON: "+", ".join(sorted(missing)))
        for name, detail in inter.items():
            if not isinstance(detail.get("posicion"),list) or len(detail["posicion"]) != 3:
                errors.append(f"Posición Three.js inválida: {name}")
        expected_stages = {(z,e) for z in ("precision","subsistencia","ecologica")
                            for e in (1,2,3)}
        actual_stages = {(c.get("parcela", "").removeprefix("parcela_"),c.get("etapa"))
                         for c in meta.get("cultivos",[])}
        if expected_stages - actual_stages:
            errors.append("Faltan etapas del cultivo en el JSON")
        print(f"JSON: {len(inter)} objetos interactivos; "
              f"{len(meta.get('cultivos', []))} grupos de cultivos")
    if errors:
        print("\nERRORES:")
        for issue in errors:
            print("-",issue)
        sys.exit(1)
    print("\nVALIDACIÓN CORRECTA: formatos, materiales, nodos y coordenadas presentes.")
    print("Aún es recomendable inspeccionar visualmente el resultado en Blender y en Three.js.")


if __name__ == "__main__":
    main()
