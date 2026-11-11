import { describe, it, expect, beforeEach } from 'vitest';
import { HUD } from '../src/ui/hud.js';
import {
  getState,
  initializeFarm,
  plant,
  advanceDay,
  harvest
} from '../src/simulation/farmSimulation.js';
import { SIMULATION_MODES } from '../src/simulation/constants.js';

function createMockElement(tagName = 'div') {
  const listeners = new Map();
  const classSet = new Set();

  const el = {
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
      const fns = listeners.get(evt.type) || [];
      fns.forEach((fn) => fn(evt));
    },
    click() {
      this.dispatchEvent({ type: 'click', target: this });
    }
  };
  return el;
}

function createMockDocument() {
  const byId = new Map();
  const root = createMockElement('div');
  root.id = 'app';
  byId.set('app', root);

  const registerIds = (el) => {
    if (el.id) byId.set(el.id, el);
    for (const child of el.children) registerIds(child);
  };

  // Elementos legacy esperados por main.js e index.html
  const legacyIds = [
    'hud-day',
    'hud-water',
    'meter-water',
    'hud-soil',
    'meter-soil',
    'hud-budget',
    'hud-harvest',
    'mode-selector',
    'btn-advance-day',
    'zone-name',
    'toast-container',
    'debug-coords',
    'debug-fps'
  ];
  for (const id of legacyIds) {
    const el = createMockElement(id === 'mode-selector' ? 'select' : 'div');
    el.id = id;
    root.appendChild(el);
    byId.set(id, el);
  }

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

describe('HUD — Interfaz de Simulación e Integración con Three.js', () => {
  let doc;
  let hud;

  beforeEach(() => {
    initializeFarm(SIMULATION_MODES.PRECISION);
    doc = createMockDocument();
    hud = new HUD({ document: doc });
  });

  it('recibe coordenadas y zona actual desde Three.js y enfoca la parcela correspondiente', () => {
    hud.updateFarmState(getState());
    hud.updateCoordinates(12.34, 0.5, -8.76);

    expect(doc.getElementById('debug-coords').textContent).toBe('X: 12.3 | Y: 0.5 | Z: -8.8');
    expect(doc.getElementById('agro-three-coords').textContent).toBe('X: 12.3 | Y: 0.5 | Z: -8.8');

    hud.setZone('Parcela 3 — Ecológica');
    expect(doc.getElementById('zone-name').textContent).toBe('Parcela 3 — Ecológica');
    expect(doc.getElementById('agro-three-zone').textContent).toBe('Parcela 3 — Ecológica');
    expect(getState().activePlotId).toBe('plot_3');
  });

  it('actualiza humedad, fertilidad, salud, presupuesto, modalidad y etapas del cultivo', () => {
    initializeFarm(SIMULATION_MODES.SUBSISTENCE);
    plant('plot_1');
    hud.updateFarmState(getState());

    expect(doc.getElementById('hud-day').textContent).toBe(1);
    expect(doc.getElementById('hud-budget').textContent).toBe('$465');
    expect(doc.getElementById('agro-crop-stage').textContent).toBe('Sembrado');
    expect(doc.getElementById('agro-mode-badge').textContent).toContain('Manual');
    expect(hud.panelRefs.moistureMetric.val.textContent).toBe('50%');
    expect(hud.panelRefs.fertilityMetric.val.textContent).toBe('60%');
    expect(hud.panelRefs.healthMetric.val.textContent).toBe('90%');
  });

  it('muestra automáticamente la tarjeta educativa de cosecha y la comparativa de 3 modos', () => {
    initializeFarm(SIMULATION_MODES.PRECISION);
    plant('plot_2');
    advanceDay();
    advanceDay();
    harvest('plot_2');

    hud.updateFarmState(getState());
    expect(hud.harvestCardEl.classList.contains('hidden')).toBe(false);
    expect(hud.panelRefs.hFeedback.children.length).toBeGreaterThan(0);

    hud.openComparisonDemo();
    expect(hud.demoModal.classList.contains('hidden')).toBe(false);
    expect(hud.panelRefs.demoGrid.children.length).toBe(3);
  });

  it('ejecuta acciones desde botones del HUD en modo autónomo', async () => {
    hud.updateFarmState(getState());
    hud.panelRefs.btnPlant.click();

    expect(getState().plots.plot_2.isPlanted).toBe(true);
    expect(doc.getElementById('agro-crop-stage').textContent).toBe('Sembrado');

    hud.panelRefs.autoBtn.click();
    expect(getState().autoIrrigationEnabled).toBe(false);
  });

  it('delega el riego y las acciones al FarmAdapter conectado cuando se hace clic en Regar', async () => {
    const calls = [];
    const mockAdapter = {
      async irrigate(plotId) {
        calls.push(['irrigate', plotId]);
        return { success: true, message: 'Riego ejecutado en adaptador' };
      }
    };

    hud.connectAdapter(mockAdapter);
    hud.updateFarmState(getState());
    hud.panelRefs.btnIrrigate.click();

    await Promise.resolve();
    expect(calls).toEqual([['irrigate', 'plot_2']]);
  });
});

