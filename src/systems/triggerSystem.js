import * as THREE from 'three';

/**
 * Sistema de Triggers Espaciales: Radial (distancia euclidiana) y AABB (caja alineada con ejes)
 * Incluye gestión de estado (entrada/salida), prevención de repetición continua y cooldowns.
 */
export class TriggerSystem {
  constructor() {
    this.radialTriggers = [];
    this.aabbTriggers = [];
  }

  /**
   * Agrega un Trigger Radial usando THREE.Vector3.distanceTo
   */
  addRadialTrigger({ id, name, center, radius, onEnter, onExit, onStay, cooldownMs = 300 }) {
    this.radialTriggers.push({
      id,
      name: name || id,
      center: new THREE.Vector3(center.x, center.y ?? 0, center.z),
      radius,
      radiusSq: radius * radius,
      onEnter: typeof onEnter === 'function' ? onEnter : null,
      onExit: typeof onExit === 'function' ? onExit : null,
      onStay: typeof onStay === 'function' ? onStay : null,
      isInside: false,
      lastTriggerTime: -Infinity,
      cooldownMs
    });
  }

  /**
   * Agrega un Trigger AABB usando THREE.Box3
   */
  addAABBTrigger({ id, name, min, max, onEnter, onExit, onStay, cooldownMs = 300 }) {
    const box = new THREE.Box3(
      new THREE.Vector3(min[0], min[1], min[2]),
      new THREE.Vector3(max[0], max[1], max[2])
    );

    this.aabbTriggers.push({
      id,
      name: name || id,
      box,
      onEnter: typeof onEnter === 'function' ? onEnter : null,
      onExit: typeof onExit === 'function' ? onExit : null,
      onStay: typeof onStay === 'function' ? onStay : null,
      isInside: false,
      lastTriggerTime: -Infinity,
      cooldownMs
    });
  }

  /**
   * Evalúa todos los triggers contra la posición del jugador
   * @param {THREE.Vector3} playerPosition
   * @returns {Array<string>} Nombres de zonas activas donde el jugador se encuentra actualmente
   */
  update(playerPosition) {
    const now = performance.now();
    const activeZones = [];

    // 1. Evaluar Triggers Radiales con distanceTo / distanceToSquared
    for (let i = 0; i < this.radialTriggers.length; i++) {
      const trig = this.radialTriggers[i];
      // Ignoramos altura Y para detección en plano de terreno o consideramos distancia completa
      const distSq = (playerPosition.x - trig.center.x) ** 2 + (playerPosition.z - trig.center.z) ** 2;
      const inside = distSq <= trig.radiusSq;

      if (inside) {
        activeZones.push(trig.name);

        if (!trig.isInside) {
          // Evento de ENTRADA
          trig.isInside = true;
          if (now - trig.lastTriggerTime >= trig.cooldownMs) {
            trig.lastTriggerTime = now;
            if (trig.onEnter) trig.onEnter(trig, playerPosition);
          }
        } else {
          // Permanece adentro
          if (trig.onStay) trig.onStay(trig, playerPosition);
        }
      } else {
        if (trig.isInside) {
          // Evento de SALIDA
          trig.isInside = false;
          if (trig.onExit) trig.onExit(trig, playerPosition);
        }
      }
    }

    // 2. Evaluar Triggers AABB con THREE.Box3.containsPoint
    for (let i = 0; i < this.aabbTriggers.length; i++) {
      const trig = this.aabbTriggers[i];
      const inside = trig.box.containsPoint(playerPosition);

      if (inside) {
        activeZones.push(trig.name);

        if (!trig.isInside) {
          // Evento de ENTRADA
          trig.isInside = true;
          if (now - trig.lastTriggerTime >= trig.cooldownMs) {
            trig.lastTriggerTime = now;
            if (trig.onEnter) trig.onEnter(trig, playerPosition);
          }
        } else {
          // Permanece adentro
          if (trig.onStay) trig.onStay(trig, playerPosition);
        }
      } else {
        if (trig.isInside) {
          // Evento de SALIDA
          trig.isInside = false;
          if (trig.onExit) trig.onExit(trig, playerPosition);
        }
      }
    }

    return activeZones;
  }
}
