/**
 * Registro de resultados de partidas (en memoria, con persistencia opcional en localStorage).
 * Todos los indicadores provienen del estado real del simulador; no se inventan datos.
 */

const MODE_LABELS = {
  subsistence: 'Subsistencia',
  precision: 'Precisión',
  ecological: 'Ecológica'
};

const EDUCATIONAL_NOTES = {
  subsistence:
    'La agricultura de subsistencia prioriza cubrir necesidades alimentarias con herramientas básicas. El riego manual consume más agua por aplicación y el presupuesto es reducido, por eso cada decisión cuenta.',
  precision:
    'La agricultura de precisión usa datos (aquí, un sensor virtual) para decidir cuándo regar. Regar solo bajo el umbral reduce el desperdicio de agua, aunque la tecnología implica costos.',
  ecological:
    'La agricultura ecológica busca conservar la salud del suelo. El compost mejora la fertilidad y la retención de humedad en este modelo educativo, reduciendo el desgaste del suelo tras la cosecha.'
};

/**
 * Construye el resumen de una partida a partir del estado del simulador y el reporte de cosecha.
 * @param {object} state  Estado devuelto por FarmSimulation.getState()
 * @param {object} report Reporte de cosecha (state.lastHarvest)
 * @param {string[]} decisions Acciones registradas por el jugador
 */
export function buildRunResult(state, report, decisions = []) {
  if (!state) throw new Error('Estado requerido para construir resultados');
  const plot = report?.plotId ? state.plots?.[report.plotId] : state.plots?.[state.activePlotId];
  return {
    mode: state.mode,
    modeLabel: MODE_LABELS[state.mode] || state.mode,
    days: state.day,
    waterConsumed: state.waterConsumed,
    expenses: state.economy?.totalExpenses ?? 0,
    revenue: state.economy?.totalRevenue ?? 0,
    netProfit: state.economy?.netProfit ?? 0,
    budget: state.budget,
    soilQuality: state.soilQuality,
    finalMoisture: plot?.moisture ?? state.moisture,
    cropHealth: report?.healthAtHarvest ?? report?.health ?? state.cropHealth,
    harvestKg: report?.harvestKg ?? state.harvestedTotalKg ?? 0,
    qualityGrade: report?.qualityGrade ?? null,
    compostApplications: state.compostApplications ?? 0,
    autoIrrigations: state.autoIrrigationsTriggered ?? 0,
    decisions: [...decisions],
    note: EDUCATIONAL_NOTES[state.mode] || '',
    disclaimer: state.disclaimer || ''
  };
}

export class ResultsStore {
  constructor(storage = null, key = 'agrorescate3d.results') {
    this.storage = storage;
    this.key = key;
    this.results = [];
    if (this.storage) {
      try {
        const raw = this.storage.getItem(this.key);
        if (raw) this.results = JSON.parse(raw);
      } catch {
        this.results = [];
      }
    }
  }

  add(result) {
    this.results.push({ ...result, id: this.results.length + 1 });
    this._persist();
    return this.results[this.results.length - 1];
  }

  getAll() {
    return this.results.map((r) => ({ ...r }));
  }

  /** Último resultado registrado por modalidad (para la tabla comparativa) */
  getComparison() {
    const latest = {};
    for (const r of this.results) latest[r.mode] = r;
    return ['subsistence', 'precision', 'ecological']
      .filter((m) => latest[m])
      .map((m) => ({ ...latest[m] }));
  }

  clear() {
    this.results = [];
    this._persist();
  }

  _persist() {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.key, JSON.stringify(this.results));
    } catch {
      /* almacenamiento no disponible: se conserva en memoria */
    }
  }
}
