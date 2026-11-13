import * as THREE from 'three';

/**
 * Sistema Centralizado de Interacciones con la Tecla E y Soporte de Esfuerzo Campesino (Hold).
 * - Detecta proximidad con objetos interactivos registrados.
 * - Distingue entre interacciones instantáneas (diálogos, menús) y faenas físicas pesadas
 *   (labranza con azada, siembra, cosecha) que requieren mantener presionada la tecla E
 *   o el botón táctil, reflejando el arduo esfuerzo del campesino colombiano.
 * - Emite callbacks de progreso continuo para el HUD (anillo radial y barra de faena).
 */
export class InteractionSystem {
  constructor() {
    this.interactables = [];
    this.currentInteractable = null;
    this.onPromptChange = null;
    this.maxInteractionDistance = 3.8;
    this.maxInteractionDistanceSq = this.maxInteractionDistance * this.maxInteractionDistance;

    this.isHolding = false;
    this.holdTimer = 0;
    this.holdingInteractable = null;
    this.onHoldProgress = null; // (progress 0..1, interactable, isCancelled)

    this._lastTime = null;
    this._setupKeyListener();
  }

  /**
   * Registra un objeto interactivo en el mundo.
   * @param {object} config
   */
  register({
    id,
    name,
    position,
    actionText = 'Interactuar',
    customDistance = null,
    holdDuration = 0, // En segundos. 0 = instantáneo; >0 = requiere mantener presionado
    onHoldStart = null,
    onHoldCancel = null,
    onInteract
  }) {
    const interactable = {
      id,
      name,
      position: new THREE.Vector3(position.x, position.y ?? 0, position.z),
      actionText,
      maxDistSq: customDistance ? customDistance * customDistance : this.maxInteractionDistanceSq,
      holdDuration: Number(holdDuration) || 0,
      onHoldStart: typeof onHoldStart === 'function' ? onHoldStart : null,
      onHoldCancel: typeof onHoldCancel === 'function' ? onHoldCancel : null,
      onInteract: typeof onInteract === 'function' ? onInteract : null,
      enabled: true
    };

    this.interactables.push(interactable);
    return interactable;
  }

  unregister(id) {
    if (this.holdingInteractable && this.holdingInteractable.id === id) {
      this.stopHold(true);
    }
    this.interactables = this.interactables.filter((item) => item.id !== id);
    if (this.currentInteractable && this.currentInteractable.id === id) {
      this.currentInteractable = null;
      if (this.onPromptChange) this.onPromptChange(null);
    }
  }

  updateActionText(id, newActionText, newHoldDuration = null) {
    const item = this.interactables.find((it) => it.id === id);
    if (item) {
      item.actionText = newActionText;
      if (newHoldDuration !== null) {
        item.holdDuration = Number(newHoldDuration) || 0;
      }
      if (this.currentInteractable && this.currentInteractable.id === id) {
        if (this.onPromptChange) this.onPromptChange(item);
      }
    }
  }

  _setupKeyListener() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (!e.repeat) {
          this.startHold();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyE') {
        this.stopHold(true);
      }
    });
  }

  /**
   * Inicia el proceso de mantener presionado o ejecuta de inmediato si no requiere esfuerzo.
   */
  startHold() {
    if (!this.currentInteractable || !this.currentInteractable.enabled) return false;

    // Si la interacción es instantánea (diálogo Rudy, tienda, casa, bomba)
    if (!this.currentInteractable.holdDuration || this.currentInteractable.holdDuration <= 0) {
      this.triggerInteraction();
      return true;
    }

    // Faena física pesada (labranza, siembra, cosecha)
    this.isHolding = true;
    this.holdTimer = 0;
    this.holdingInteractable = this.currentInteractable;

    if (this.holdingInteractable.onHoldStart) {
      this.holdingInteractable.onHoldStart(this.holdingInteractable);
    }
    if (this.onHoldProgress) {
      this.onHoldProgress(0, this.holdingInteractable, false);
    }
    return true;
  }

  /**
   * Cancela la faena física si se suelta la tecla/botón antes de completarla.
   * @param {boolean} [cancelledByUser=true]
   */
  stopHold(cancelledByUser = true) {
    if (!this.isHolding) return;
    const target = this.holdingInteractable;
    this.isHolding = false;
    this.holdTimer = 0;
    this.holdingInteractable = null;

    if (target && target.onHoldCancel) {
      target.onHoldCancel(target);
    }
    if (this.onHoldProgress) {
      this.onHoldProgress(0, target, cancelledByUser);
    }
  }

  /**
   * Ejecuta la interacción con el objeto enfocado actualmente.
   */
  triggerInteraction() {
    if (this.currentInteractable && this.currentInteractable.enabled) {
      if (this.currentInteractable.onInteract) {
        this.currentInteractable.onInteract(this.currentInteractable);
      }
    }
  }

  /**
   * Actualiza el objeto interactivo más cercano y avanza el temporizador de esfuerzo.
   * @param {THREE.Vector3|object} playerPosition
   * @param {number} [delta=null]
   */
  update(playerPosition, delta = null) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = delta !== null ? delta : (this._lastTime ? Math.min(0.1, (now - this._lastTime) / 1000) : 0.016);
    this._lastTime = now;

    let closestItem = null;
    let closestDistSq = Infinity;

    for (let i = 0; i < this.interactables.length; i++) {
      const item = this.interactables[i];
      if (!item.enabled) continue;

      const distSq =
        (playerPosition.x - item.position.x) ** 2 +
        (playerPosition.y - item.position.y) ** 2 +
        (playerPosition.z - item.position.z) ** 2;

      if (distSq <= item.maxDistSq && distSq < closestDistSq) {
        closestDistSq = distSq;
        closestItem = item;
      }
    }

    if (closestItem !== this.currentInteractable) {
      if (this.isHolding) {
        this.stopHold(true);
      }
      this.currentInteractable = closestItem;
      if (this.onPromptChange) {
        this.onPromptChange(this.currentInteractable);
      }
    }

    // Progreso continuo de la faena física
    if (this.isHolding && this.holdingInteractable) {
      this.holdTimer += dt;
      const targetDuration = this.holdingInteractable.holdDuration || 1.5;
      const progress = Math.min(1.0, this.holdTimer / targetDuration);

      if (this.onHoldProgress) {
        this.onHoldProgress(progress, this.holdingInteractable, false);
      }

      if (progress >= 1.0) {
        const completedItem = this.holdingInteractable;
        this.isHolding = false;
        this.holdTimer = 0;
        this.holdingInteractable = null;

        if (this.onHoldProgress) {
          this.onHoldProgress(1.0, completedItem, false);
        }

        if (completedItem && completedItem.enabled && completedItem.onInteract) {
          completedItem.onInteract(completedItem);
        }
      }
    }
  }

  getCurrentInteractable() {
    return this.currentInteractable;
  }
}
