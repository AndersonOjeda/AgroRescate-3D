/**
 * Controles Táctiles para Celulares y Tablets (AgroRescate 3D)
 * - Joystick virtual analógico izquierdo (caminar + correr en borde exterior)
 * - Botón contextual de interacción [E] + botones rápidos (Correr, Cámara, Caja física)
 * - Activación automática en dispositivos táctiles o al primer toque de pantalla
 */

export function detectTouchSupport(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false;

  const hasMatchMedia = typeof win.matchMedia === 'function';
  const hasCoarse = hasMatchMedia && win.matchMedia('(pointer: coarse)').matches;
  const hasFine = hasMatchMedia && win.matchMedia('(pointer: fine)').matches;
  const hasHover = hasMatchMedia && win.matchMedia('(hover: hover)').matches;

  // Teléfonos y tablets reales (sin mouse/hover de PC)
  if (hasCoarse && !hasFine && !hasHover) {
    return true;
  }

  // Pantallas móviles/compactas con soporte táctil (incluye emulación DevTools)
  const hasTouchApi =
    'ontouchstart' in win ||
    (typeof win.navigator !== 'undefined' && win.navigator.maxTouchPoints > 0) ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
  const isCompactViewport =
    typeof win.innerWidth === 'number' && win.innerWidth > 0 && win.innerWidth <= 900;

  return Boolean(hasTouchApi && isCompactViewport && !hasFine);
}

export class TouchControls {
  constructor({
    container = null,
    document: docRef = typeof document !== 'undefined' ? document : null,
    player = null,
    interactionSystem = null,
    onToggleCamera = null,
    onDropCrate = null,
    forceEnable = false
  } = {}) {
    this.doc = docRef;
    this.container = container || (docRef ? docRef.getElementById('app') || docRef.body : null);
    this.player = player;
    this.interactionSystem = interactionSystem;
    this.onToggleCamera = onToggleCamera;
    this.onDropCrate = onDropCrate;
    this.forceEnable = Boolean(forceEnable);

    this.enabled = Boolean(this.forceEnable || detectTouchSupport());
    this.sprintLocked = false;
    this._stickTouchId = null;
    this._maxRadius = 44;
    this._deadzone = 0.12;
    this._currentInteractable = null;

    if (!this.doc || !this.container) return;

    this._buildDom();
    this._bindJoystick();
    this._bindButtons();

    if (this.enabled) {
      this.enable();
    } else if (typeof window !== 'undefined' && window.addEventListener) {
      this._onFirstTouch = () => {
        if (detectTouchSupport()) {
          this.enable();
        }
      };
      window.addEventListener('touchstart', this._onFirstTouch, { passive: true });
    }

    if (!this.forceEnable && typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', () => {
        if (detectTouchSupport()) this.enable();
        else this.disable();
      });
    }
  }

  _buildDom() {
    const d = this.doc;
    const root = d.createElement('div');
    root.id = 'mobile-controls';
    root.className = 'mobile-controls hidden';

    // Joystick izquierdo
    const joyWrap = d.createElement('div');
    joyWrap.id = 'mobile-joystick';
    joyWrap.className = 'mobile-joystick';

    const joyBase = d.createElement('div');
    joyBase.className = 'mobile-joystick-base';

    const joyKnob = d.createElement('div');
    joyKnob.id = 'mobile-joystick-knob';
    joyKnob.className = 'mobile-joystick-knob';

    const joyHint = d.createElement('div');
    joyHint.className = 'mobile-joystick-hint';
    joyHint.textContent = 'Mover';

    joyBase.appendChild(joyKnob);
    joyWrap.appendChild(joyBase);
    joyWrap.appendChild(joyHint);

    // Botones táctiles lado derecho
    const actions = d.createElement('div');
    actions.id = 'mobile-actions';
    actions.className = 'mobile-actions';

    const quickRow = d.createElement('div');
    quickRow.className = 'mobile-quick-row';

    const btnSprint = d.createElement('button');
    btnSprint.id = 'mobile-btn-sprint';
    btnSprint.type = 'button';
    btnSprint.className = 'mobile-action-mini';
    btnSprint.textContent = '🏃';
    btnSprint.title = 'Alternar correr';

    const btnCam = d.createElement('button');
    btnCam.id = 'mobile-btn-cam';
    btnCam.type = 'button';
    btnCam.className = 'mobile-action-mini';
    btnCam.textContent = '🎥';
    btnCam.title = 'Cambiar cámara';

    const btnCrate = d.createElement('button');
    btnCrate.id = 'mobile-btn-crate';
    btnCrate.type = 'button';
    btnCrate.className = 'mobile-action-mini';
    btnCrate.textContent = '📦';
    btnCrate.title = 'Soltar caja física';

    quickRow.appendChild(btnSprint);
    quickRow.appendChild(btnCam);
    quickRow.appendChild(btnCrate);

    const btnInteract = d.createElement('button');
    btnInteract.id = 'mobile-btn-interact';
    btnInteract.type = 'button';
    btnInteract.className = 'mobile-interact-btn';

    const interactIcon = d.createElement('span');
    interactIcon.className = 'mobile-interact-icon';
    interactIcon.textContent = '✋';

    const interactLabel = d.createElement('span');
    interactLabel.id = 'mobile-interact-label';
    interactLabel.className = 'mobile-interact-label';
    interactLabel.textContent = 'Acción';

    btnInteract.appendChild(interactIcon);
    btnInteract.appendChild(interactLabel);

    actions.appendChild(quickRow);
    actions.appendChild(btnInteract);

    root.appendChild(joyWrap);
    root.appendChild(actions);
    this.container.appendChild(root);

    this.rootEl = root;
    this.joyWrapEl = joyWrap;
    this.joyBaseEl = joyBase;
    this.joyKnobEl = joyKnob;
    this.btnSprintEl = btnSprint;
    this.btnCamEl = btnCam;
    this.btnCrateEl = btnCrate;
    this.btnInteractEl = btnInteract;
    this.interactLabelEl = interactLabel;
  }

  _findTouch(touchList, id) {
    if (!touchList) return null;
    for (let i = 0; i < touchList.length; i++) {
      if (touchList[i].identifier === id) return touchList[i];
    }
    return null;
  }

  _bindJoystick() {
    if (!this.joyBaseEl) return;

    const updateStickFromClient = (clientX, clientY) => {
      const rect = this.joyBaseEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = Math.max(24, rect.width * 0.38 || this._maxRadius);

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > radius) {
        const scale = radius / dist;
        dx *= scale;
        dy *= scale;
      }

      if (this.joyKnobEl) {
        this.joyKnobEl.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      }

      const normRatio = Math.min(1, dist / radius);
      if (normRatio < this._deadzone) {
        this.joyBaseEl.classList.remove('sprinting');
        this.player?.setTouchMove(0, 0, this.sprintLocked);
        return;
      }

      const nx = dx / radius;
      const ny = -dy / radius; // Arriba = avanzar (+1)
      const edgeSprint = normRatio > 0.88;
      const sprinting = this.sprintLocked || edgeSprint;

      this.joyBaseEl.classList.toggle('sprinting', sprinting);
      this.player?.setTouchMove(nx, ny, sprinting);
    };

    const resetStick = () => {
      this._stickTouchId = null;
      if (this.joyKnobEl) {
        this.joyKnobEl.style.transform = 'translate3d(0px, 0px, 0)';
      }
      this.joyBaseEl.classList.remove('active', 'sprinting');
      this.player?.setTouchMove(0, 0, this.sprintLocked);
    };

    this.joyBaseEl.addEventListener('touchstart', (e) => {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (this._stickTouchId === null && e.changedTouches && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        this._stickTouchId = t.identifier;
        this.joyBaseEl.classList.add('active');
        updateStickFromClient(t.clientX, t.clientY);
      }
    }, { passive: false });

    this.joyBaseEl.addEventListener('touchmove', (e) => {
      if (this._stickTouchId === null) return;
      const t = this._findTouch(e.touches, this._stickTouchId) ||
        this._findTouch(e.changedTouches, this._stickTouchId);
      if (!t) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      updateStickFromClient(t.clientX, t.clientY);
    }, { passive: false });

    const onStickEnd = (e) => {
      if (this._stickTouchId === null) return;
      if (this._findTouch(e.changedTouches, this._stickTouchId)) {
        e.stopPropagation();
        resetStick();
      }
    };

    this.joyBaseEl.addEventListener('touchend', onStickEnd, { passive: true });
    this.joyBaseEl.addEventListener('touchcancel', onStickEnd, { passive: true });
  }

  _bindButtons() {
    const bindTap = (el, handler) => {
      if (!el) return;
      let handledTouch = false;
      el.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        handledTouch = true;
        handler();
      }, { passive: false });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (handledTouch) {
          handledTouch = false;
          return;
        }
        handler();
      });
    };

    bindTap(this.btnInteractEl, () => {
      this.interactionSystem?.triggerInteraction();
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(12);
      }
    });

    bindTap(this.btnSprintEl, () => {
      this.sprintLocked = !this.sprintLocked;
      this.btnSprintEl.classList.toggle('active', this.sprintLocked);
      this.player?.setTouchSprint(this.sprintLocked);
    });

    bindTap(this.btnCamEl, () => {
      if (this.onToggleCamera) {
        this.onToggleCamera();
      } else {
        this.player?.toggleCameraMode();
      }
    });

    bindTap(this.btnCrateEl, () => {
      if (this.onDropCrate) {
        this.onDropCrate();
      }
    });
  }

  /**
   * Resalta el botón principal de acción cuando hay un objeto interactivo cercano.
   * @param {object|null} item
   */
  setInteractable(item) {
    this._currentInteractable = item || null;
    if (!this.btnInteractEl || !this.interactLabelEl) return;

    if (item) {
      this.btnInteractEl.classList.add('ready');
      this.btnInteractEl.disabled = false;
      const shortName = item.name ? String(item.name).split('—')[0].trim() : 'Acción';
      this.interactLabelEl.textContent = shortName.length > 14 ? 'Interactuar' : shortName;
    } else {
      this.btnInteractEl.classList.remove('ready');
      this.interactLabelEl.textContent = 'Acción';
    }
  }

  enable() {
    this.enabled = true;
    this.rootEl?.classList.remove('hidden');
    if (this.doc?.body?.classList) {
      this.doc.body.classList.add('is-touch-device');
    }
  }

  disable() {
    this.enabled = false;
    this.rootEl?.classList.add('hidden');
    if (this.doc?.body?.classList) {
      this.doc.body.classList.remove('is-touch-device');
    }
  }

  isVisible() {
    return Boolean(this.rootEl && !this.rootEl.classList.contains('hidden'));
  }
}
