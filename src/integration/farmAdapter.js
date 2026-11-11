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
   * Verifica si es posible iniciar riego continuo en la bomba hidráulica.
   */
  canStartContinuousIrrigation(plotId = null) {
    if (typeof this.simulation.canStartContinuousIrrigation === 'function') {
      return this.simulation.canStartContinuousIrrigation(plotId);
    }
    return { canStart: true, targetPlotIds: null };
  }

  /**
   * Ejecuta un pulso progresivo de riego continuo mientras la bomba esté encendida.
   */
  async irrigateContinuousStep(deltaSeconds = 0.5, plotId = null, cycleSeconds = 5, maxMoisture = 100) {
    if (typeof this.simulation.irrigateContinuousStep !== 'function') {
      return { success: false, applied: false };
    }
    const result = await Promise.resolve(
      this.simulation.irrigateContinuousStep(deltaSeconds, plotId, cycleSeconds, maxMoisture)
    );
    if (result?.applied) {
      const state = result.state || (await this.getState());
      this.syncVisuals(state);
      this.emit('stateChange', { state, action: 'irrigateContinuous', result });
    }
    return result;
  }

  /**
   * Devuelve los IDs de parcelas que requieren riego automático IoT en tiempo real.
   */
  getPlotsNeedingRealtimeAutoIrrigation() {
    if (typeof this.simulation.getPlotsNeedingRealtimeAutoIrrigation === 'function') {
      return this.simulation.getPlotsNeedingRealtimeAutoIrrigation();
    }
    return [];
  }

  /**
   * Registra un evento de sesión automática IoT completada y actualiza estado/UI.
   */
  async recordAutoIrrigationSession(plotIds, totalMoistureGain, totalWaterUsedL) {
    if (typeof this.simulation.recordAutoIrrigationSession !== 'function') {
      return null;
    }
    const msg = this.simulation.recordAutoIrrigationSession(plotIds, totalMoistureGain, totalWaterUsedL);
    if (msg) {
      const state = await this.getState();
      this.emit('stateChange', { state, action: 'autoIrrigationSession', result: { message: msg } });
    }
    return msg;
  }

  /**
   * Registra en bitácora un resumen de una sesión de riego continuo al detenerse.
   */
  recordContinuousIrrigationSummary(totalMoistureGain, totalWaterUsedL) {
    if (typeof this.simulation.recordContinuousIrrigationSummary === 'function') {
      return this.simulation.recordContinuousIrrigationSummary(totalMoistureGain, totalWaterUsedL);
    }
    return null;
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
    this.syncVisuals(state);
    this.emit('stateChange', { state, action: 'applyCompost', result });
    this.emit('compostApplied', { result });
    return result;
  }

  /**
   * Ejecuta una acción opcional del simulador y notifica al HUD/escena.
   * @private
   */
  async _run(method, action, ...args) {
    if (typeof this.simulation[method] !== 'function') {
      return { success: false, message: `Acción no disponible: ${method}` };
    }
    const result = await Promise.resolve(this.simulation[method](...args));
    const state = await this.getState();
    this.syncVisuals(state);
    this.emit('stateChange', { state, action, result });
    this.emit(action, { result, args });
    return result;
  }

  /** Prepara el terreno de una parcela (habilita la siembra) */
  prepareSoil(plotId) { return this._run('prepareSoil', 'soilPrepared', plotId); }

  /** Activa/desactiva riego automático IoT (Precisión) */
  setAutoIrrigation(enabled) { return this._run('setAutoIrrigation', 'autoIrrigationChanged', enabled); }

  /** Configura el umbral de humedad del riego automático */
  setAutoIrrigationThreshold(value) { return this._run('setAutoIrrigationThreshold', 'thresholdChanged', value); }

  /** Consulta el sensor virtual de humedad */
  getSensorReading(plotId) {
    return typeof this.simulation.getSensorReading === 'function' ? this.simulation.getSensorReading(plotId) : null;
  }

  /** Exige preparar el terreno antes de sembrar */
  setRequirePreparation(enabled) {
    if (typeof this.simulation.setRequirePreparation === 'function') this.simulation.setRequirePreparation(enabled);
  }

  /**
   * Obtiene el estado actual de la simulación de forma segura
   */
  async getState() {
    const state = await Promise.resolve(this.simulation.getState());
    return state;
  }
}
