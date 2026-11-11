import * as THREE from 'three';

const BONE_NAMES = [
  'hips',
  'spine',
  'head',
  'leftUpperArm',
  'leftForeArm',
  'rightUpperArm',
  'rightForeArm',
  'leftThigh',
  'leftShin',
  'rightThigh',
  'rightShin'
];

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Empaqueta hasta 4 pares [indiceHueso, peso] normalizados para un vértice.
 */
function assignTopFourWeights(candidates, vertexIndex, skinIndices, skinWeights) {
  candidates.sort((a, b) => b[1] - a[1]);
  let total = 0;
  const count = Math.min(4, candidates.length);
  for (let i = 0; i < count; i++) {
    total += candidates[i][1];
  }
  const offset = vertexIndex * 4;
  if (total <= 0.00001) {
    skinIndices[offset] = 1; // spine por seguridad
    skinWeights[offset] = 1;
    return;
  }
  const inv = 1 / total;
  for (let i = 0; i < count; i++) {
    skinIndices[offset + i] = candidates[i][0];
    skinWeights[offset + i] = candidates[i][1] * inv;
  }
}

/**
 * Calcula atributos skinIndex / skinWeight para un personaje humanoide en pose T.
 */
function buildHumanoidSkinAttributes(geometry, box) {
  const posAttr = geometry.attributes.position;
  const vertexCount = posAttr.count;
  const height = Math.max(box.max.y - box.min.y, 0.0001);
  const centerX = (box.min.x + box.max.x) * 0.5;
  const centerZ = (box.min.z + box.max.z) * 0.5;

  const skinIndices = new Uint16Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);
  const pairs = [];

  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const ny = (y - box.min.y) / height;
    const nx = (x - centerX) / height;
    const nz = (z - centerZ) / height;
    const absX = Math.abs(nx);

    // 1. Cabeza y sombrero (parte superior)
    const headWeight = smoothstep(0.695, 0.745, ny);

    // 2. Brazos en pose T (excluir mochila trasera solo en el centro del torso |nx| < 0.15)
    const armXBlend = smoothstep(0.095, 0.14, absX);
    const armYBlend = smoothstep(0.50, 0.54, ny) * (1 - smoothstep(0.68, 0.71, ny));
    const clearOfBackpack = smoothstep(0.135, 0.16, absX);
    const armZBlend = Math.max(clearOfBackpack, smoothstep(-0.07, -0.045, nz));
    const armWeight = armXBlend * armYBlend * armZBlend * (1 - headWeight);

    // 3. Piernas (debajo de cadera/entrepierna)
    const legWeight = (1 - smoothstep(0.385, 0.44, ny)) * (1 - headWeight) * (1 - armWeight);

    // 4. Torso restante repartido suavemente entre cadera y columna
    const torsoWeight = Math.max(0, 1 - headWeight - armWeight - legWeight);
    const spineRatio = smoothstep(0.43, 0.53, ny);

    pairs.length = 0;

    if (headWeight > 0.0001) {
      pairs.push([2, headWeight]);
    }

    if (armWeight > 0.0001) {
      const foreRatio = smoothstep(0.215, 0.255, absX);
      const upperW = armWeight * (1 - foreRatio);
      const foreW = armWeight * foreRatio;
      const isLeft = nx >= 0;
      const upperIdx = isLeft ? 3 : 5;
      const foreIdx = isLeft ? 4 : 6;
      if (upperW > 0.0001) pairs.push([upperIdx, upperW]);
      if (foreW > 0.0001) pairs.push([foreIdx, foreW]);
    }

    if (legWeight > 0.0001) {
      const shinRatio = 1 - smoothstep(0.195, 0.25, ny);
      const leftRatio = smoothstep(-0.012, 0.012, nx);
      const rightRatio = 1 - leftRatio;
      const thighFactor = legWeight * (1 - shinRatio);
      const shinFactor = legWeight * shinRatio;

      if (leftRatio * thighFactor > 0.0001) pairs.push([7, leftRatio * thighFactor]);
      if (leftRatio * shinFactor > 0.0001) pairs.push([8, leftRatio * shinFactor]);
      if (rightRatio * thighFactor > 0.0001) pairs.push([9, rightRatio * thighFactor]);
      if (rightRatio * shinFactor > 0.0001) pairs.push([10, rightRatio * shinFactor]);
    }

    if (torsoWeight > 0.0001) {
      const hipsW = torsoWeight * (1 - spineRatio);
      const spineW = torsoWeight * spineRatio;
      if (hipsW > 0.0001) pairs.push([0, hipsW]);
      if (spineW > 0.0001) pairs.push([1, spineW]);
    }

    assignTopFourWeights(pairs, i, skinIndices, skinWeights);
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
}

function createSkeletonForBox(box) {
  const height = Math.max(box.max.y - box.min.y, 0.0001);
  const cx = (box.min.x + box.max.x) * 0.5;
  const cz = (box.min.z + box.max.z) * 0.5;
  const by = box.min.y;

  const bones = BONE_NAMES.map((name) => {
    const bone = new THREE.Bone();
    bone.name = name;
    return bone;
  });

  const [
    hips,
    spine,
    head,
    leftUpperArm,
    leftForeArm,
    rightUpperArm,
    rightForeArm,
    leftThigh,
    leftShin,
    rightThigh,
    rightShin
  ] = bones;

  hips.position.set(cx, by + 0.42 * height, cz);

  hips.add(spine);
  spine.position.set(0, 0.14 * height, 0);

  spine.add(head);
  head.position.set(0, 0.16 * height, 0);

  spine.add(leftUpperArm);
  leftUpperArm.position.set(0.115 * height, 0.075 * height, -0.005 * height);
  leftUpperArm.add(leftForeArm);
  leftForeArm.position.set(0.12 * height, -0.005 * height, 0);

  spine.add(rightUpperArm);
  rightUpperArm.position.set(-0.115 * height, 0.075 * height, -0.005 * height);
  rightUpperArm.add(rightForeArm);
  rightForeArm.position.set(-0.12 * height, -0.005 * height, 0);

  hips.add(leftThigh);
  leftThigh.position.set(0.065 * height, -0.01 * height, 0);
  leftThigh.add(leftShin);
  leftShin.position.set(0, -0.19 * height, 0);

  hips.add(rightThigh);
  rightThigh.position.set(-0.065 * height, -0.01 * height, 0);
  rightThigh.add(rightShin);
  rightShin.position.set(0, -0.19 * height, 0);

  return {
    bones,
    hipsRestPosition: hips.position.clone(),
    height
  };
}

function makeQuatTrack(boneName, times, eulersXYZ) {
  const values = [];
  const euler = new THREE.Euler(0, 0, 0, 'XYZ');
  const q = new THREE.Quaternion();
  let prevQ = null;

  for (let i = 0; i < eulersXYZ.length; i++) {
    const [rx, ry, rz] = eulersXYZ[i];
    euler.set(rx, ry, rz, 'XYZ');
    q.setFromEuler(euler);
    if (prevQ && prevQ.dot(q) < 0) {
      q.set(-q.x, -q.y, -q.z, -q.w);
    }
    values.push(q.x, q.y, q.z, q.w);
    prevQ = q.clone();
  }

  return new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values);
}

function makePosTrack(boneName, times, basePos, offsets) {
  const values = [];
  for (let i = 0; i < offsets.length; i++) {
    const [dx, dy, dz] = offsets[i];
    values.push(basePos.x + dx, basePos.y + dy, basePos.z + dz);
  }
  return new THREE.VectorKeyframeTrack(`${boneName}.position`, times, values);
}

/**
 * Crea clips de animación procedural (idle, walk, run, action) sobre la jerarquía de huesos.
 */
function buildFarmerAnimationClips(hipsRestPosition, height) {
  // 1. IDLE (3.2s): brazos relajados abajo, respiración suave y vistazo tranquilo
  const idleT = [0, 0.8, 1.6, 2.4, 3.2];
  const idleClip = new THREE.AnimationClip('idle', 3.2, [
    makePosTrack('hips', idleT, hipsRestPosition, [
      [0, 0, 0],
      [0, 0.008 * height, 0],
      [0, 0, 0],
      [0, 0.008 * height, 0],
      [0, 0, 0]
    ]),
    makeQuatTrack('spine', idleT, [
      [0.02, 0, 0],
      [0.05, 0.03, 0.015],
      [0.02, 0, 0],
      [0.05, -0.03, -0.015],
      [0.02, 0, 0]
    ]),
    makeQuatTrack('head', idleT, [
      [0.02, 0, 0],
      [-0.02, 0.14, 0],
      [0.03, 0, 0],
      [-0.02, -0.14, 0],
      [0.02, 0, 0]
    ]),
    makeQuatTrack('leftUpperArm', idleT, [
      [-0.04, 0, -1.11],
      [0.02, 0, -1.07],
      [-0.04, 0, -1.11],
      [-0.02, 0, -1.07],
      [-0.04, 0, -1.11]
    ]),
    makeQuatTrack('rightUpperArm', idleT, [
      [-0.04, 0, 1.11],
      [-0.02, 0, 1.07],
      [-0.04, 0, 1.11],
      [0.02, 0, 1.07],
      [-0.04, 0, 1.11]
    ]),
    makeQuatTrack('leftForeArm', idleT, [
      [0, -0.32, 0],
      [0, -0.38, 0],
      [0, -0.32, 0],
      [0, -0.36, 0],
      [0, -0.32, 0]
    ]),
    makeQuatTrack('rightForeArm', idleT, [
      [0, 0.32, 0],
      [0, 0.36, 0],
      [0, 0.32, 0],
      [0, 0.38, 0],
      [0, 0.32, 0]
    ]),
    makeQuatTrack('leftThigh', idleT, [
      [-0.03, 0, 0.02],
      [-0.03, 0, 0.02],
      [-0.03, 0, 0.02],
      [-0.03, 0, 0.02],
      [-0.03, 0, 0.02]
    ]),
    makeQuatTrack('leftShin', idleT, [
      [0.06, 0, 0],
      [0.06, 0, 0],
      [0.06, 0, 0],
      [0.06, 0, 0],
      [0.06, 0, 0]
    ]),
    makeQuatTrack('rightThigh', idleT, [
      [-0.03, 0, -0.02],
      [-0.03, 0, -0.02],
      [-0.03, 0, -0.02],
      [-0.03, 0, -0.02],
      [-0.03, 0, -0.02]
    ]),
    makeQuatTrack('rightShin', idleT, [
      [0.06, 0, 0],
      [0.06, 0, 0],
      [0.06, 0, 0],
      [0.06, 0, 0],
      [0.06, 0, 0]
    ])
  ]);

  // 2. WALK (0.8s): zancada natural con rodillas, balanceo de brazos y torsión de torso
  const walkT = [0, 0.2, 0.4, 0.6, 0.8];
  const walkClip = new THREE.AnimationClip('walk', 0.8, [
    makePosTrack('hips', walkT, hipsRestPosition, [
      [0, -0.012 * height, 0],
      [0, 0.016 * height, 0],
      [0, -0.012 * height, 0],
      [0, 0.016 * height, 0],
      [0, -0.012 * height, 0]
    ]),
    makeQuatTrack('spine', walkT, [
      [0.08, -0.08, 0.02],
      [0.05, 0, 0],
      [0.08, 0.08, -0.02],
      [0.05, 0, 0],
      [0.08, -0.08, 0.02]
    ]),
    makeQuatTrack('head', walkT, [
      [-0.04, 0.06, 0],
      [-0.02, 0, 0],
      [-0.04, -0.06, 0],
      [-0.02, 0, 0],
      [-0.04, 0.06, 0]
    ]),
    makeQuatTrack('leftThigh', walkT, [
      [-0.48, 0, 0],
      [0.02, 0, 0],
      [0.40, 0, 0],
      [-0.12, 0, 0],
      [-0.48, 0, 0]
    ]),
    makeQuatTrack('leftShin', walkT, [
      [0.14, 0, 0],
      [0.08, 0, 0],
      [0.52, 0, 0],
      [0.78, 0, 0],
      [0.14, 0, 0]
    ]),
    makeQuatTrack('rightThigh', walkT, [
      [0.40, 0, 0],
      [-0.12, 0, 0],
      [-0.48, 0, 0],
      [0.02, 0, 0],
      [0.40, 0, 0]
    ]),
    makeQuatTrack('rightShin', walkT, [
      [0.52, 0, 0],
      [0.78, 0, 0],
      [0.14, 0, 0],
      [0.08, 0, 0],
      [0.52, 0, 0]
    ]),
    makeQuatTrack('leftUpperArm', walkT, [
      [0.36, 0, -1.11],
      [0, 0, -1.14],
      [-0.44, 0, -1.10],
      [0, 0, -1.14],
      [0.36, 0, -1.11]
    ]),
    makeQuatTrack('leftForeArm', walkT, [
      [0, -0.34, 0],
      [0, -0.45, 0],
      [0, -0.62, 0],
      [0, -0.45, 0],
      [0, -0.34, 0]
    ]),
    makeQuatTrack('rightUpperArm', walkT, [
      [-0.44, 0, 1.10],
      [0, 0, 1.14],
      [0.36, 0, 1.11],
      [0, 0, 1.14],
      [-0.44, 0, 1.10]
    ]),
    makeQuatTrack('rightForeArm', walkT, [
      [0, 0.62, 0],
      [0, 0.45, 0],
      [0, 0.34, 0],
      [0, 0.45, 0],
      [0, 0.62, 0]
    ])
  ]);

  // 3. RUN (0.52s): carrera energética al usar Shift
  const runT = [0, 0.13, 0.26, 0.39, 0.52];
  const runClip = new THREE.AnimationClip('run', 0.52, [
    makePosTrack('hips', runT, hipsRestPosition, [
      [0, -0.022 * height, 0],
      [0, 0.024 * height, 0],
      [0, -0.022 * height, 0],
      [0, 0.024 * height, 0],
      [0, -0.022 * height, 0]
    ]),
    makeQuatTrack('spine', runT, [
      [0.18, -0.12, 0.03],
      [0.15, 0, 0],
      [0.18, 0.12, -0.03],
      [0.15, 0, 0],
      [0.18, -0.12, 0.03]
    ]),
    makeQuatTrack('head', runT, [
      [-0.10, 0.08, 0],
      [-0.08, 0, 0],
      [-0.10, -0.08, 0],
      [-0.08, 0, 0],
      [-0.10, 0.08, 0]
    ]),
    makeQuatTrack('leftThigh', runT, [
      [-0.78, 0, 0],
      [0.05, 0, 0],
      [0.64, 0, 0],
      [-0.22, 0, 0],
      [-0.78, 0, 0]
    ]),
    makeQuatTrack('leftShin', runT, [
      [0.24, 0, 0],
      [0.14, 0, 0],
      [0.92, 0, 0],
      [1.12, 0, 0],
      [0.24, 0, 0]
    ]),
    makeQuatTrack('rightThigh', runT, [
      [0.64, 0, 0],
      [-0.22, 0, 0],
      [-0.78, 0, 0],
      [0.05, 0, 0],
      [0.64, 0, 0]
    ]),
    makeQuatTrack('rightShin', runT, [
      [0.92, 0, 0],
      [1.12, 0, 0],
      [0.24, 0, 0],
      [0.14, 0, 0],
      [0.92, 0, 0]
    ]),
    makeQuatTrack('leftUpperArm', runT, [
      [0.58, 0, -1.04],
      [0, 0, -1.10],
      [-0.68, 0, -1.02],
      [0, 0, -1.10],
      [0.58, 0, -1.04]
    ]),
    makeQuatTrack('leftForeArm', runT, [
      [0, -0.95, 0],
      [0, -1.08, 0],
      [0, -1.22, 0],
      [0, -1.08, 0],
      [0, -0.95, 0]
    ]),
    makeQuatTrack('rightUpperArm', runT, [
      [-0.68, 0, 1.02],
      [0, 0, 1.10],
      [0.58, 0, 1.04],
      [0, 0, 1.10],
      [-0.68, 0, 1.02]
    ]),
    makeQuatTrack('rightForeArm', runT, [
      [0, 1.22, 0],
      [0, 1.08, 0],
      [0, 0.95, 0],
      [0, 1.08, 0],
      [0, 1.22, 0]
    ])
  ]);

  // 4. ACTION (0.75s): agacharse con flexión de rodillas y extender manos hacia el suelo
  //    (preparar terreno / sembrar / regar / compostar / cosechar)
  const actT = [0, 0.22, 0.52, 0.75];
  const actionClip = new THREE.AnimationClip('action', 0.75, [
    makePosTrack('hips', actT, hipsRestPosition, [
      [0, 0, 0],
      [0, -0.16 * height, 0],
      [0, -0.14 * height, 0],
      [0, 0, 0]
    ]),
    makeQuatTrack('spine', actT, [
      [0.02, 0, 0],
      [0.78, 0, 0],
      [0.68, -0.08, 0],
      [0.02, 0, 0]
    ]),
    makeQuatTrack('head', actT, [
      [0.02, 0, 0],
      [0.24, 0, 0],
      [0.18, 0, 0],
      [0.02, 0, 0]
    ]),
    makeQuatTrack('leftThigh', actT, [
      [-0.03, 0, 0.02],
      [-0.72, 0, 0.06],
      [-0.64, 0, 0.05],
      [-0.03, 0, 0.02]
    ]),
    makeQuatTrack('leftShin', actT, [
      [0.06, 0, 0],
      [1.15, 0, 0],
      [1.02, 0, 0],
      [0.06, 0, 0]
    ]),
    makeQuatTrack('rightThigh', actT, [
      [-0.03, 0, -0.02],
      [-0.72, 0, -0.06],
      [-0.64, 0, -0.05],
      [-0.03, 0, -0.02]
    ]),
    makeQuatTrack('rightShin', actT, [
      [0.06, 0, 0],
      [1.15, 0, 0],
      [1.02, 0, 0],
      [0.06, 0, 0]
    ]),
    makeQuatTrack('leftUpperArm', actT, [
      [-0.04, 0, -1.11],
      [-1.25, 0, -0.82],
      [-1.10, 0.15, -0.92],
      [-0.04, 0, -1.11]
    ]),
    makeQuatTrack('leftForeArm', actT, [
      [0, -0.32, 0],
      [0, -0.78, 0],
      [0, -0.52, 0],
      [0, -0.32, 0]
    ]),
    makeQuatTrack('rightUpperArm', actT, [
      [-0.04, 0, 1.11],
      [-1.25, 0, 0.82],
      [-1.10, -0.15, 0.92],
      [-0.04, 0, 1.11]
    ]),
    makeQuatTrack('rightForeArm', actT, [
      [0, 0.32, 0],
      [0, 0.78, 0],
      [0, 0.52, 0],
      [0, 0.32, 0]
    ])
  ]);

  return {
    idle: idleClip,
    walk: walkClip,
    run: runClip,
    action: actionClip
  };
}

/**
 * Convierte la malla estática principal del GLB del granjero en un SkinnedMesh
 * con esqueleto humanoide (11 huesos) y clips de animación idle, walk, run y action.
 * @param {THREE.Object3D} modelRoot
 * @returns {{ skinnedMesh: THREE.SkinnedMesh, skeleton: THREE.Skeleton, bones: THREE.Bone[], mixer: THREE.AnimationMixer, actions: Object } | null}
 */
export function applyProceduralFarmerRig(modelRoot) {
  let targetMesh = null;
  let largestVertexCount = -1;

  modelRoot.traverse((node) => {
    if (node.isMesh && !node.isSkinnedMesh && node.geometry?.attributes?.position) {
      const count = node.geometry.attributes.position.count;
      if (count > largestVertexCount) {
        largestVertexCount = count;
        targetMesh = node;
      }
    }
  });

  if (!targetMesh || !targetMesh.parent) return null;

  const geometry = targetMesh.geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox.clone();

  buildHumanoidSkinAttributes(geometry, box);

  const skinnedMesh = new THREE.SkinnedMesh(geometry, targetMesh.material);
  skinnedMesh.name = targetMesh.name || 'farmer_skinned_mesh';
  skinnedMesh.position.copy(targetMesh.position);
  skinnedMesh.rotation.copy(targetMesh.rotation);
  skinnedMesh.scale.copy(targetMesh.scale);
  skinnedMesh.castShadow = true;
  skinnedMesh.receiveShadow = true;
  skinnedMesh.frustumCulled = false;

  const parent = targetMesh.parent;
  parent.remove(targetMesh);
  parent.add(skinnedMesh);

  const { bones, hipsRestPosition, height } = createSkeletonForBox(box);
  skinnedMesh.add(bones[0]); // hips

  const skeleton = new THREE.Skeleton(bones);
  skinnedMesh.updateMatrixWorld(true);
  skinnedMesh.bind(skeleton);

  const clips = buildFarmerAnimationClips(hipsRestPosition, height);
  const mixer = new THREE.AnimationMixer(skinnedMesh);

  const actions = {
    idle: mixer.clipAction(clips.idle),
    walk: mixer.clipAction(clips.walk),
    run: mixer.clipAction(clips.run),
    action: mixer.clipAction(clips.action)
  };

  actions.idle.setLoop(THREE.LoopRepeat, Infinity);
  actions.walk.setLoop(THREE.LoopRepeat, Infinity);
  actions.run.setLoop(THREE.LoopRepeat, Infinity);
  actions.action.setLoop(THREE.LoopOnce, 1);
  actions.action.clampWhenFinished = true;

  return {
    skinnedMesh,
    skeleton,
    bones,
    mixer,
    actions,
    clips
  };
}

