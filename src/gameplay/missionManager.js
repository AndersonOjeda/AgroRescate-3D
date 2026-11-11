/**
 * Gestor de Misiones (tutorial guiado) de AgroRescate 3D.
 * Lógica pura (sin DOM ni Three.js): recibe eventos de juego y avanza misiones.
 *
 * Eventos soportados (type):
 *  - 'enteredPlot'      { plotId }
 *  - 'soilPrepared'
 *  - 'planted'
 *  - 'irrigated'
 *  - 'special'          { kind: 'compost' | 'sensor' | 'threshold' | 'autoIrrigation' | 'manualIrrigation' }
 *  - 'dayAdvanced'      { state }
 *  - 'harvested'        { success, harvestKg }
 *  - 'visitedWarehouse'
 *  - 'resultsViewed'
 */

export const MODE_SPECIAL_ACTION = {
  subsistence: { kind: 'manualIrrigation', label: 'Riega a mano 2 veces con el balde (recurso limitado)' },
  precision: { kind: 'sensor', label: 'Consulta el sensor IoT o ajusta el umbral de riego automático' },
  ecological: { kind: 'compost', label: 'Aplica compost orgánico desde la compostera' }
};

const PRIMARY_PLOT = { subsistence: 'plot_1', precision: 'plot_2', ecological: 'plot_3' };

export function buildMissions(mode) {
  const special = MODE_SPECIAL_ACTION[mode] || MODE_SPECIAL_ACTION.subsistence;
  return [
    {
      id: 'm1',
      title: 'Misión 1: Preparar la finca',
      tasks: [
        { id: 'reachPlot', label: 'Llega a tu parcela asignada', done: false },
        { id: 'prepare', label: 'Prepara el terreno (E o botón «Preparar»)', done: false }
      ]
    },
    {
      id: 'm2',
      title: 'Misión 2: Primera siembra',
      tasks: [{ id: 'plant', label: 'Siembra lechuga en la parcela', done: false }]
    },
    {
      id: 'm3',
      title: 'Misión 3: Cuidar el cultivo',
      tasks: [
        { id: 'irrigate', label: 'Aplica riego al cultivo', done: false },
        { id: 'special', label: special.label, done: false }
      ]
    },
    {
      id: 'm4',
      title: 'Misión 4: Crecimiento',
      tasks: [{ id: 'mature', label: 'Avanza días hasta que la lechuga madure sana', done: false }]
    },
    {
      id: 'm5',
      title: 'Misión 5: Cosecha',
      tasks: [
        { id: 'harvest', label: 'Cosecha la lechuga', done: false },
        { id: 'warehouse', label: 'Lleva la cosecha al almacén', done: false },
        { id: 'results', label: 'Consulta tus resultados', done: false }
      ]
    }
  ];
}

export class MissionManager {
  constructor(mode = 'subsistence') {
    this.listeners = [];
    this.reset(mode);
  }

  reset(mode) {
    this.mode = mode;
    this.primaryPlotId = PRIMARY_PLOT[mode] || 'plot_1';
    this.missions = buildMissions(mode);
    this.manualIrrigations = 0;
    this.hasHarvest = false;
    this._notify(null);
  }

  onChange(cb) {
    this.listeners.push(cb);
  }

  _notify(completedTask) {
    for (const cb of this.listeners) cb(this.getSnapshot(), completedTask);
  }

  _complete(taskId) {
    for (const m of this.missions) {
      const t = m.tasks.find((x) => x.id === taskId);
      if (t && !t.done) {
        // Solo se completa si las misiones previas están completas (orden del tutorial),
        // excepto tareas pasivas que el jugador pudo hacer antes.
        t.done = true;
        this._notify(t);
        return true;
      }
    }
    return false;
  }

  /**
   * Procesa un evento de juego.
   * @returns {boolean} true si alguna tarea se completó
   */
  handleEvent(event) {
    if (!event || !event.type) return false;
    switch (event.type) {
      case 'enteredPlot':
        return event.plotId === this.primaryPlotId ? this._complete('reachPlot') : false;
      case 'soilPrepared':
        return this._complete('prepare');
      case 'planted':
        return this._complete('plant');
      case 'irrigated': {
        let changed = this._complete('irrigate');
        if (this.mode === 'subsistence') {
          this.manualIrrigations += 1;
          if (this.manualIrrigations >= 2) changed = this._complete('special') || changed;
        }
        return changed;
      }
      case 'special': {
        const expected = MODE_SPECIAL_ACTION[this.mode]?.kind;
        const ok =
          event.kind === expected ||
          (this.mode === 'precision' && ['sensor', 'threshold', 'autoIrrigation'].includes(event.kind));
        return ok ? this._complete('special') : false;
      }
      case 'dayAdvanced': {
        const plot = event.state?.plots?.[this.primaryPlotId];
        if (plot && plot.isPlanted && plot.daysGrown >= plot.daysToMature && !plot.isWithered) {
          return this._complete('mature');
        }
        return false;
      }
      case 'harvested':
        if (event.success && event.harvestKg > 0) {
          this.hasHarvest = true;
          return this._complete('harvest');
        }
        return false;
      case 'visitedWarehouse':
        return this.hasHarvest ? this._complete('warehouse') : false;
      case 'resultsViewed':
        return this.hasHarvest ? this._complete('results') : false;
      default:
        return false;
    }
  }

  getCurrentMission() {
    return this.missions.find((m) => m.tasks.some((t) => !t.done)) || null;
  }

  isComplete() {
    return this.missions.every((m) => m.tasks.every((t) => t.done));
  }

  getSnapshot() {
    const current = this.getCurrentMission();
    const all = this.missions.flatMap((m) => m.tasks);
    return {
      mode: this.mode,
      current: current ? JSON.parse(JSON.stringify(current)) : null,
      completedTasks: all.filter((t) => t.done).length,
      totalTasks: all.length,
      complete: this.isComplete()
    };
  }
}
