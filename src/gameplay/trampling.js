export function findTrampledPlant(points, from, to, radius = 0.24) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq < 0.0001) return null;
  return points.find(point => {
    const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSq));
    return Math.hypot(point.x - from.x - t * dx, point.z - from.z - t * dz) < radius;
  }) || null;
}
