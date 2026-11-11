import * as THREE from 'three';

/**
 * Embellecedor del Paisaje Natural Andino para AgroRescate 3D.
 * - Colorea las montañas importadas de finca.glb (que venían con Material.002 blanco)
 *   usando gradientes naturales por altitud (pasto, bosque andino y roca musgosa).
 * - Extiende el horizonte con un valle ondulado, colinas lejanas y árboles perimetrales
 *   optimizados con InstancedMesh (2 draw calls totales) para mantener 60 FPS.
 */

const _v = new THREE.Vector3();
const _cLow = new THREE.Color(0x4f8f3b);
const _cMid = new THREE.Color(0x2f6336);
const _cRock = new THREE.Color(0x556654);
const _cPeak = new THREE.Color(0x6e7b6d);
const _cTmp = new THREE.Color();

function pseudoNoise(x, z) {
  return (
    Math.sin(x * 0.045) * Math.cos(z * 0.045) * 0.55 +
    Math.sin(x * 0.11 + z * 0.08) * 0.30 +
    Math.cos(x * 0.02 - z * 0.035) * 0.45
  );
}

/**
 * Recolorea mallas Mountain* del GLB para eliminar el aspecto blanco plano sin editar finca.glb.
 * @param {THREE.Object3D} modelScene
 * @returns {number} Cantidad de montañas estilizadas
 */
export function applyNaturalMountainShading(modelScene) {
  if (!modelScene) return 0;
  modelScene.updateMatrixWorld(true);

  const mountainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.0,
    flatShading: true
  });

  const box = new THREE.Box3();
  let count = 0;

  modelScene.traverse((child) => {
    if (!child.isMesh || !child.geometry?.attributes?.position) return;
    const isMountain =
      /^(mountain|montana)/i.test(child.name || '') ||
      child.material?.name === 'Material.002';
    if (!isMountain) return;

    box.setFromObject(child);
    const minY = box.min.y;
    const spanY = Math.max(0.5, box.max.y - minY);

    const pos = child.geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
      const jitter = pseudoNoise(_v.x * 2.5, _v.z * 2.5) * 0.06;
      const t = Math.max(0, Math.min(1, (_v.y - minY) / spanY + jitter));

      if (t < 0.32) {
        _cTmp.lerpColors(_cLow, _cMid, t / 0.32);
      } else if (t < 0.72) {
        _cTmp.lerpColors(_cMid, _cRock, (t - 0.32) / 0.40);
      } else {
        _cTmp.lerpColors(_cRock, _cPeak, (t - 0.72) / 0.28);
      }

      colors[i * 3] = _cTmp.r;
      colors[i * 3 + 1] = _cTmp.g;
      colors[i * 3 + 2] = _cTmp.b;
    }

    child.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    child.material = mountainMat;
    child.receiveShadow = true;
    child.castShadow = false;
    count += 1;
  });

  return count;
}

/**
 * Construye el valle circundante natural 360° fuera de los límites de la finca.
 * @param {THREE.Scene} scene
 * @returns {THREE.Group}
 */
export function createNaturalHorizon(scene) {
  const group = new THREE.Group();
  group.name = 'natural_andes_horizon';

  // 1. Valle ondulado extenso (440x440 m), plano debajo de la finca para evitar Z-fighting
  const valleyGeo = new THREE.PlaneGeometry(440, 440, 40, 40);
  valleyGeo.rotateX(-Math.PI / 2);

  const pos = valleyGeo.attributes.position;
  const vColors = new Float32Array(pos.count * 3);
  const cMeadow = new THREE.Color(0x639947);
  const cDeepGrass = new THREE.Color(0x417435);
  const cHill = new THREE.Color(0x325e36);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const edgeDist = Math.max(Math.abs(x), Math.abs(z));

    let y = -0.32;
    if (edgeDist > 26) {
      const blend = Math.min(1, (edgeDist - 26) / 38);
      const radial = Math.hypot(x, z);
      const ridge =
        Math.max(0, (radial - 55) * 0.12) +
        (pseudoNoise(x * 0.55, z * 0.55) + 0.6) * 4.2;
      y = -0.32 + ridge * blend;
    }
    pos.setY(i, y);

    const hFactor = Math.max(0, Math.min(1, (y + 0.3) / 16));
    const shade = 0.5 + 0.5 * Math.sin(x * 0.08 + z * 0.06);
    _cTmp.lerpColors(cMeadow, cDeepGrass, shade * 0.65);
    _cTmp.lerp(cHill, hFactor * 0.75);

    vColors[i * 3] = _cTmp.r;
    vColors[i * 3 + 1] = _cTmp.g;
    vColors[i * 3 + 2] = _cTmp.b;
  }

  valleyGeo.setAttribute('color', new THREE.BufferAttribute(vColors, 3));
  valleyGeo.computeVertexNormals();

  const valleyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0.0,
    flatShading: true
  });
  const valleyMesh = new THREE.Mesh(valleyGeo, valleyMat);
  valleyMesh.receiveShadow = false;
  group.add(valleyMesh);

  // 2. Cordillera lejana de colinas suaves con InstancedMesh (1 draw call en lugar de 24)
  const hillGeo = new THREE.ConeGeometry(1, 1, 7);
  const ridgeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    flatShading: true
  });
  const hillsInst = new THREE.InstancedMesh(hillGeo, ridgeMat, 24);
  const hillDummy = new THREE.Object3D();
  const hillColorA = new THREE.Color(0x3b6e44);
  const hillColorB = new THREE.Color(0x4b7d5b);

  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2 + (i % 2) * 0.08;
    const dist = 105 + (i % 3) * 22;
    const radius = 24 + (i % 4) * 6;
    const height = 16 + ((i * 7) % 14);
    hillDummy.position.set(Math.cos(angle) * dist, height * 0.42 - 1.5, Math.sin(angle) * dist);
    hillDummy.scale.set(radius, height, radius * 0.85);
    hillDummy.rotation.y = angle + i;
    hillDummy.updateMatrix();
    hillsInst.setMatrixAt(i, hillDummy.matrix);
    hillsInst.setColorAt(i, i % 2 === 0 ? hillColorA : hillColorB);
  }
  hillsInst.instanceMatrix.needsUpdate = true;
  if (hillsInst.instanceColor) hillsInst.instanceColor.needsUpdate = true;
  group.add(hillsInst);

  // 3. Arboleda perimetral externa con InstancedMesh (solo 2 draw calls)
  const treeCoords = [];
  for (let i = 0; i < 42; i++) {
    const angle = (i / 42) * Math.PI * 2 + (i % 3) * 0.05;
    const dist = 27 + (i % 5) * 6.5;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (Math.max(Math.abs(x), Math.abs(z)) <= 24) continue;
    const scale = 0.85 + (i % 4) * 0.25;
    treeCoords.push({ x, z, scale });
  }

  if (treeCoords.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.0, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b442a, roughness: 0.95 });
    const crownGeo = new THREE.DodecahedronGeometry(1.35, 0);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0x3f8439,
      roughness: 0.9,
      flatShading: true
    });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCoords.length);
    const dummy = new THREE.Object3D();
    const crownTint = new THREE.Color();

    treeCoords.forEach((t, idx) => {
      dummy.position.set(t.x, 0.8 * t.scale, t.z);
      dummy.scale.set(t.scale, t.scale, t.scale);
      dummy.rotation.y = idx * 0.9;
      dummy.updateMatrix();
      trunks.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(t.x, 2.45 * t.scale, t.z);
      dummy.scale.set(t.scale, t.scale * 1.15, t.scale);
      dummy.updateMatrix();
      crowns.setMatrixAt(idx, dummy.matrix);

      crownTint.setHSL(0.30 + (idx % 3) * 0.025, 0.45, 0.34 + (idx % 4) * 0.03);
      crowns.setColorAt(idx, crownTint);
    });

    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    group.add(trunks);
    group.add(crowns);
  }

  scene.add(group);
  return group;
}
