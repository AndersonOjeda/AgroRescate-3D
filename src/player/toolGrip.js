import * as THREE from 'three';

/** Ajusta el brazo de apoyo a un segundo agarre sobre el mango. */
export function solveSupportGrip(upperArm, foreArm, handOffset, worldTarget, iterations = 8) {
  const end = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const current = new THREE.Vector3();
  const inverse = new THREE.Quaternion();
  const correction = new THREE.Quaternion();
  const limited = new THREE.Quaternion();
  for (let pass = 0; pass < iterations; pass++) {
    for (const joint of [foreArm, upperArm]) {
      joint.updateWorldMatrix(true, true);
      end.copy(handOffset); foreArm.localToWorld(end);
      joint.getWorldPosition(origin);
      joint.parent.getWorldQuaternion(inverse).invert();
      current.copy(end).sub(origin).applyQuaternion(inverse).normalize();
      desired.copy(worldTarget).sub(origin).applyQuaternion(inverse).normalize();
      if (!current.lengthSq() || !desired.lengthSq()) continue;
      correction.setFromUnitVectors(current, desired);
      limited.identity().slerp(correction, Math.min(1, 0.35 / Math.max(0.001, correction.angleTo(new THREE.Quaternion()))));
      joint.quaternion.premultiply(limited).normalize();
    }
  }
}

export function attachHoeAtHand(tool, foreArm) {
  foreArm.add(tool);
  foreArm.updateWorldMatrix(true, true);
  const worldScale = new THREE.Vector3();
  foreArm.getWorldScale(worldScale);
  tool.scale.set(0.85 / worldScale.x, 0.85 / worldScale.y, 0.85 / worldScale.z);
  const wrist = new THREE.Vector3(-Math.abs(foreArm.position.x), 0, 0);
  const grip = new THREE.Vector3(0, 0.12, 0).multiply(tool.scale).applyQuaternion(tool.quaternion);
  tool.position.copy(wrist).sub(grip);
}
