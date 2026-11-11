import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { GuideChicken, GUIDE_STEPS, prepareGuideChickenModel } from '../src/world/guideChicken.js';
import { HUD } from '../src/ui/hud.js';

function createMockElement(tagName = 'div') {
  const listeners = new Map();
  const classSet = new Set();

  return {
    tagName: tagName.toUpperCase(),
    id: '',
    textContent: '',
    value: '',
    disabled: false,
    dataset: {},
    style: {},
    children: [],
    parentNode: null,
    _innerHTML: '',
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(val) {
      this._innerHTML = val;
      if (val === '') this.children = [];
    },
    get className() {
      return Array.from(classSet).join(' ');
    },
    set className(val) {
      classSet.clear();
      String(val)
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => classSet.add(c));
    },
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
    removeChild(child) {
      this.children = this.children.filter((c) => c !== child);
      child.parentNode = null;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(evt) {
      (listeners.get(evt.type) || []).forEach((fn) => fn(evt));
    },
    click() {
      this.dispatchEvent({ type: 'click', target: this });
    }
  };
}

function createMockDoc() {
  const byId = new Map();
  const root = createMockElement('div');
  root.id = 'app';
  byId.set('app', root);

  const registerIds = (el) => {
    if (el.id) byId.set(el.id, el);
    for (const child of el.children) registerIds(child);
  };

  return {
    body: root,
    createElement(tag) {
      const el = createMockElement(tag);
      const origAppend = el.appendChild.bind(el);
      el.appendChild = (child) => {
        origAppend(child);
        registerIds(child);
        return child;
      };
      return el;
    },
    getElementById(id) {
      registerIds(root);
      return byId.get(id) || null;
    }
  };
}

describe('GuideChicken — Gallina Guía 3D e Instrucciones Interactivas', () => {
  it('escala el modelo de la gallina, lo centra en XZ y lo apoya en Y=0', () => {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(100, 150, 120);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
    mesh.position.set(12, 69, -8);
    group.add(mesh);

    prepareGuideChickenModel(group, 0.95);

    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    expect(size.y).toBeCloseTo(0.95, 4);
    expect(box.min.y).toBeCloseTo(0, 4);
    expect(center.x).toBeCloseTo(0, 4);
    expect(center.z).toBeCloseTo(0, 4);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });

  it('carga GLB con animación Take 001, orienta hacia el jugador y provee obstáculo circular', async () => {
    const scene = new THREE.Scene();
    const glbRoot = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 2, 1);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
    glbRoot.add(mesh);

    const track = new THREE.VectorKeyframeTrack('.position', [0, 1], [0, 0, 0, 0, 0.1, 0]);
    const clip = new THREE.AnimationClip('Take 001', 1, [track]);
    const mockLoader = {
      loadAsync: vi.fn(async () => ({ scene: glbRoot, animations: [clip] }))
    };

    const chicken = new GuideChicken(scene, {
      position: { x: 2.0, y: 0, z: -4.2 },
      gltfLoader: mockLoader,
      autoLoad: false
    });

    const loaded = await chicken.loadModel();
    expect(loaded).toBe(true);
    expect(mockLoader.loadAsync).toHaveBeenCalledWith('/models/gallina_guia.glb');
    expect(chicken.mixer).toBeTruthy();
    expect(chicken.activeAction).toBeTruthy();

    const obstacle = chicken.getCollisionObstacle();
    expect(obstacle).toEqual({
      id: 'guide_chicken',
      type: 'circle',
      x: 2.0,
      z: -4.2,
      r: 0.45
    });

    // Jugador al oeste (-X) respecto a Rudy en el mismo Z debe hacerla rotar hacia -PI/2
    const initialYaw = chicken.visualPivot.rotation.y;
    for (let i = 0; i < 20; i++) {
      chicken.update(0.05, { x: 0.0, z: -4.2 });
    }
    expect(chicken.visualPivot.rotation.y).not.toBeCloseTo(initialYaw, 2);
    expect(chicken.visualPivot.rotation.y).toBeCloseTo(-Math.PI / 2, 1);
  });

  it('mantiene el respaldo visual si falla la carga del GLB', async () => {
    const scene = new THREE.Scene();
    const failingLoader = {
      loadAsync: vi.fn(async () => {
        throw new Error('404 Not Found');
      })
    };

    const chicken = new GuideChicken(scene, {
      gltfLoader: failingLoader,
      autoLoad: false
    });
    const ok = await chicken.loadModel();

    expect(ok).toBe(false);
    expect(chicken.visualModel.name).toBe('guide_chicken_fallback');
  });

  it('navega por todas las instrucciones de juego en el HUD y cierra al finalizar', () => {
    const doc = createMockDoc();
    const hud = new HUD({ document: doc });
    const stepChanges = [];
    const closes = [];

    hud.onChickenGuideStepChange = (step, idx, total) => stepChanges.push([step.id, idx, total]);
    hud.onChickenGuideClose = (opts) => closes.push(opts);

    expect(hud.isChickenGuideOpen()).toBe(false);
    hud.openChickenGuide(0);
    expect(hud.isChickenGuideOpen()).toBe(true);
    expect(hud.guideRefs.title.textContent).toBe(GUIDE_STEPS[0].title);
    expect(hud.guideRefs.prevBtn.disabled).toBe(true);

    for (let i = 1; i < GUIDE_STEPS.length; i++) {
      hud.nextChickenGuideStep({ closeAtEnd: true, relock: false });
      expect(hud.guideRefs.title.textContent).toBe(GUIDE_STEPS[i].title);
      expect(hud.guideRefs.tips.children.length).toBe(GUIDE_STEPS[i].tips.length);
    }

    expect(hud.guideRefs.nextBtn.textContent).toContain('¡A jugar!');
    hud.nextChickenGuideStep({ closeAtEnd: true, relock: true });

    expect(hud.isChickenGuideOpen()).toBe(false);
    expect(stepChanges.length).toBe(GUIDE_STEPS.length);
    expect(closes).toEqual([{ relock: true }]);
  });
});

