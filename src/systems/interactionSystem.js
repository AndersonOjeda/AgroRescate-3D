import * as THREE from 'three';

/**
 * Sistema Centralizado de Interacciones con la Tecla E
 * Detecta proximidad con objetos interactivos registrados, despacha callbacks y
 * emite datos para la interfaz (HUD) y el adaptador agrícola.
 */
export class InteractionSystem {
  constructor() {
    this.interactables = [];
    this.currentInteractable = null;
    this.onPromptChange = null;
    this.maxInteractionDistance = 3.8; // Distancia máxima para interactuar
    this.maxInteractionDistanceSq = this.maxInteractionDistance * this.maxInteractionDistance;

    this._setupKeyListener();
  }

  /**
   * Registra un objeto interactivo en el mundo
   */
  register({
    id,
    name,
    position,
    actionText = 'Interactuar',
    customDistance = null,
    onInteract
  }) {
    const interactable = {
      id,
      name,
      position: new THREE.Vector3(position.x, position.y ?? 0, position.z),
      actionText,
      maxDistSq: customDistance ? customDistance * customDistance : this.maxInteractionDistanceSq,
      onInteract: typeof onInteract === 'function' ? onInteract : null,
      enabled: true
    };

    this.interactables.push(interactable);
    return interactable;
  }

  unregister(id) {
    this.interactables = this.interactables.filter(item => item.id !== id);
    if (this.currentInteractable && this.currentInteractable.id === id) {
      this.currentInteractable = null;
      if (this.onPromptChange) this.onPromptChange(null);
    }
  }

  updateActionText(id, newActionText) {
    const item = this.interactables.find(it => it.id === id);
    if (item) {
      item.actionText = newActionText;
      if (this.currentInteractable && this.currentInteractable.id === id) {
        if (this.onPromptChange) this.onPromptChange(item);
      }
    }
  }

  _setupKeyListener() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        this.triggerInteraction();
      }
    });
  }

  /**
   * Ejecuta la interacción con el objeto enfocado actualmente
   */
  triggerInteraction() {
    if (this.currentInteractable && this.currentInteractable.enabled) {
      if (this.currentInteractable.onInteract) {
        this.currentInteractable.onInteract(this.currentInteractable);
      }
    }
  }

  /**
   * Actualiza el objeto interactivo más cercano a la posición del jugador
   */
  update(playerPosition) {
    let closestItem = null;
    let closestDistSq = Infinity;

    for (let i = 0; i < this.interactables.length; i++) {
      const item = this.interactables[i];
      if (!item.enabled) continue;

      const distSq = (playerPosition.x - item.position.x) ** 2 +
                     (playerPosition.y - item.position.y) ** 2 +
                     (playerPosition.z - item.position.z) ** 2;

      if (distSq <= item.maxDistSq && distSq < closestDistSq) {
        closestDistSq = distSq;
        closestItem = item;
      }
    }

    if (closestItem !== this.currentInteractable) {
      this.currentInteractable = closestItem;
      if (this.onPromptChange) {
        this.onPromptChange(this.currentInteractable);
      }
    }
  }

  getCurrentInteractable() {
    return this.currentInteractable;
  }
}
