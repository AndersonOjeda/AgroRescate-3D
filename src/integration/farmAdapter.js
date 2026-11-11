import { FarmSimulation } from '../simulation/farmSimulation.js';

/**
 * Capa de Integración Desacoplada entre el Motor 3D y el Simulador Agrícola
 * Encapsula llamadas asíncronas/síncronas, normaliza respuestas,
 * sincroniza los estados visuales en el mundo 3D y notifica al HUD.
 */
export class FarmAdapter {
  constructor(externalSimulationModule = null) {
    // Si el compañero 3 inyecta su módulo, se usa; de lo contrario, se usa la simulación de respaldo
    this.simulation = externalSimulationModule || new FarmSimulation('precision');
    this.listeners = new Map();
    this.cropPlotVisuals = new Map(); // Mapa de instancias de CropPlot 3D
  }

  /**
   * Registra las representaciones visuales 3D de las parcelas para sincronizarlas
   */
  registerCropPlotVisual(plotId, cropPlotInstance) {
    this.cropPlotVisuals.set(plotId, cropPlotInstance);
  }

  /**
   * Suscribe escuchadores a eventos del ciclo agrícola
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.set(
        event,
        this.listeners.get(event).filter(cb => cb !== callback)
      );
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      callbacks.forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error en listener de evento '${event}':`, err);
        }
      });
    }
  }

  /**
   * Sincroniza los estados visuales de los modelos 3D con el estado de la simulación
   */
  syncVisuals(state) {
    if (!state || !state.plots) return;

    for (const [plotId, plotData] of Object.entries(state.plots)) {
      const visual = this.cropPlotVisuals.get(plotId);
      if (visual && typeof visual.setVisualState === 'function') {
        visual.setVisualState(plotData.visualState);
      }
    }
  }

  /**
   * Inicializa o cambia el modo de la granja ('subsistence' | 'precision' | 'ecological')
   */
  async initializeFarm(mode) {
    const rawResult = await Promise.resolve(this.simulation.initializeFarm(mode));
    const state = await this.getState();
    this.syncVisuals(state);
    this.emit('stateChange', { state, action: 'initialize', mode });
    return state;
  }

  /**
   * Solicita sembrar un cultivo en una parcela
   */
  async plant(plotId) {
    const result = await Promise.resolve(this.simulation.plant(plotId));
    const state = await this.getState();
    this.syncVisuals(state);
    this.emit('stateChange', { state, action: 'plant', result });
    this.emit('cropPlanted', { plotId, result });
    return result;
  }

  /**
   * Solicita regar una parcela o todo el campo
   */
  async irrigate(plotId) {
    const result = await Promise.resolve(this.simulation.irrigate(plotId));
    const state = await this.getState();
    this.syncVisuals(state);
    this.emit('stateChange', { state, action: 'irrigate', result });
    this.emit('irrigated', { plotId, result });
    return result;
  }

  /**
   * Solicita avanzar el día
   */
  async advanceDay() {
    const result = await Promise.resolve(this.simulation.advanceDay());
    const state = await this.getState();
    this.syncVisuals(state);
    this.emit('stateChange', { state, action: 'advanceDay', result });
    this.emit('dayAdvanced', { day: state.day, result });
    return result;
  }

  /**
   * Solicita cosechar una parcela
   */
  async harvest(plotId) {
    const result = await Promise.resolve(this.simulation.harvest(plotId));
    const state = await this.getState();
    this.syncVisuals(state);
    this.emit('stateChange', { state, action: 'harvest', result });
    this.emit('harvested', { plotId, result });
    return result;
  }

  /**
   * Aplica compost orgánico
   */
  async applyCompost() {
    let result;
    if (typeof this.simulation.applyCompost === 'function') {
      result = await Promise.resolve(this.simulation.applyCompost());
    } else {
      result = { success: true, message: 'Compost orgánico aplicado' };
    }
    const state = await this.getState();
    this.emit('stateChange', { state, action: 'applyCompost', result });
    return result;
  }

  /**
   * Obtiene el estado actual de la simulación de forma segura
   */
  async getState() {
    const state = await Promise.resolve(this.simulation.getState());
    return state;
  }
}
