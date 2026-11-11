import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { PlayerController } from '../src/player/playerController.js';
import { TouchControls } from '../src/ui/touchControls.js';

function createMockElement(tagName = 'div') {
  const listeners = new Map();
  const classSet = new Set();

  return {
    tagName: tagName.toUpperCase(),
    id: '',
    type: '',
    textContent: '',
    title: '',
    disabled: false,
    style: {},
    children: [],
    parentNode: null,
    classList: {
      add: (...cls) => cls.forEach((c) => classSet.add(c)),
      remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classSet.has(c)) classSet.delete(c);
          else classSet.add(c);
        } else if (force) {
          classSet.add(c);
        } else {
          classSet.delete(c);
        }
      },
      contains: (c) => classSet.has(c)
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 120, height: 120 };
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(evt) {
      const fns = listeners.get(evt.type) || [];
      fns.forEach((fn) => fn(evt));
    },
    click() {
      this.dispatchEvent({ type: 'click', stopPropagation: () => {} });
    }
  };
}

function createMockDocument() {
  const root = createMockElement('div');
  root.id = 'app';
  const body = createMockElement('body');
  const byId = new Map([['app', root]]);

  return {
    body,
    createElement(tag) {
      return createMockElement(tag);
    },
    getElementById(id) {
      return byId.get(id) || null;
    }
  };
}

describe('Controles Táctiles Móviles y PlayerController.setTouchMove', () => {
  it('mueve al jugador según el joystick analógico y activa caminar/correr', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 200);
    const player = new PlayerController(camera, null, scene, { autoLoad: false });

    const startZ = player.getPosition().z;
    player.setTouchMove(0, 0.5, false);
    player.update(0.1);
    const walkZ = player.getPosition().z;
    expect(walkZ).toBeLessThan(startZ);

    player.setTouchMove(0, 1.0, true);
    player.update(0.1);
    const runZ = player.getPosition().z;
    expect(walkZ - runZ).toBeGreaterThan(startZ - walkZ);

    player.setTouchMove(0, 0, false);
    player.update(0.1);
    expect(player.touchMove.magnitude).toBe(0);
  });

  it('monta joystick, sincroniza el interactuable cercano y dispara acciones táctiles', () => {
    const doc = createMockDocument();
    const container = doc.getElementById('app');
    const setTouchMove = vi.fn();
    const setTouchSprint = vi.fn();
    const toggleCameraMode = vi.fn(() => 'orbit');
    const triggerInteraction = vi.fn();
    const onDropCrate = vi.fn();

    const controls = new TouchControls({
      container,
      document: doc,
      player: { setTouchMove, setTouchSprint, toggleCameraMode },
      interactionSystem: { triggerInteraction },
      onDropCrate,
      forceEnable: true
    });

    expect(controls.isVisible()).toBe(true);
    expect(doc.body.classList.contains('is-touch-device')).toBe(true);

    // Simular arrastre hacia arriba en el joystick (centro en 60,60; subir a y=12 => ny > 0.88 => sprint)
    controls.joyBaseEl.dispatchEvent({
      type: 'touchstart',
      cancelable: true,
      preventDefault: () => {},
      stopPropagation: () => {},
      changedTouches: [{ identifier: 1, clientX: 60, clientY: 12 }]
    });
    expect(setTouchMove).toHaveBeenCalled();
    const [nx, ny, sprinting] = setTouchMove.mock.calls[0];
    expect(Math.abs(nx)).toBeLessThan(0.01);
    expect(ny).toBeGreaterThan(0.9);
    expect(sprinting).toBe(true);

    controls.joyBaseEl.dispatchEvent({
      type: 'touchend',
      stopPropagation: () => {},
      changedTouches: [{ identifier: 1 }]
    });
    expect(setTouchMove).toHaveBeenLastCalledWith(0, 0, false);

    // Botón contextual de interacción
    controls.setInteractable({ id: 'plot_2', name: 'Parcela 2 — Precisión' });
    expect(controls.btnInteractEl.classList.contains('ready')).toBe(true);
    expect(controls.interactLabelEl.textContent).toBe('Parcela 2');

    controls.btnInteractEl.click();
    expect(triggerInteraction).toHaveBeenCalledTimes(1);

    controls.setInteractable(null);
    expect(controls.btnInteractEl.classList.contains('ready')).toBe(false);

    // Botón rápido de sprint y caja física
    controls.btnSprintEl.click();
    expect(setTouchSprint).toHaveBeenCalledWith(true);
    controls.btnCrateEl.click();
    expect(onDropCrate).toHaveBeenCalledTimes(1);
  });
});
