import {
  CROP_STAGES,
  EDUCATIONAL_DISCLAIMER,
  MODE_CONFIGS,
  PLOT_TEMPLATES,
  SIMULATION_MODES,
  normalizeMode
} from './constants.js';
import {
  applyCompostEffectsToPlot,
  calculateDailyEvaporation,
  computeSensorTelemetry,
  getPlotsNeedingAutoIrrigation
} from './modes.js';
import {
  advancePlotDay,
  buildHarvestReport,
  calculateProjectedYield,
  syncPlotStageAndVisual
} from './economy.js';

let activeSimulationInstance = null;

/**
 * Motor de Simulación Agrícola Educativa de AgroRescate 3D.
 * Gestiona las tres modalidades (subsistencia, precisión, ecológica),
 * etapas del cultivo de lechuga, variables de suelo/salud, tiempo virtual,
 * economía y reportes de cosecha sin acoplamiento con Three.js ni DOM.
 */
export class FarmSimulation {
  constructor(initialMode = SIMULATION_MODES.PRECISION, options = {}) {
    this.mode = normalizeMode(initialMode);
    this.initializeFarm(this.mode);

    if (options.registerAsActive !== false) {
      activeSimulationInstance = this;
    }
  }

  /**
   * Reinicia o inicializa el estado completo de la finca según la modalidad.
   * @param {'subsistence' | 'precision' | 'ecological'} mode
   * @returns {object} Estado inicializado de la finca
   */
  initializeFarm(mode = SIMULATION_MODES.PRECISION) {
    const canonicalMode = normalizeMode(mode);
    const config = MODE_CONFIGS[canonicalMode];

    this.mode = canonicalMode;
    this.modeConfig = config;
    this.day = 1;
    this.activePlotId = config.primaryPlotId;

    this.initialBudget = config.initialBudget;
    this.budget = config.initialBudget;
    this.waterReserve = config.initialWater;
    this.maxWater = config.maxWater;
    this.soilQuality = config.initialSoilQuality;
    this.waterConsumptionPerIrrigation = config.waterPerIrrigation;

    this.waterConsumed = 0;
    this.harvestedTotalKg = 0;
    this.autoIrrigationEnabled = Boolean(config.supportsAutoIrrigation);
    this.autoIrrigationsTriggered = 0;
    this.compostApplications = 0;
    this.lastAutoAction = null;

    this.economy = {
      seedExpenses: 0,
      irrigationExpenses: 0,
      compostExpenses: 0,
      waterExpenses: 0,
      totalRevenue: 0
    };

    this.harvestSequence = 0;
    this.lastHarvest = null;
    this.harvestHistory = [];
    this.recentEvents = [
      `Día 1: Finca iniciada en ${config.name}.`
    ];

    this.plots = {};
    for (const tpl of PLOT_TEMPLATES) {
      const plot = {
        id: tpl.id,
        name: tpl.name,
        modeAffinity: tpl.modeAffinity,
        cropSpecies: tpl.cropSpecies,
        cropName: tpl.cropName,
        isPlanted: false,
        daysGrown: 0,
        daysToMature: tpl.daysToMature,
        moisture: tpl.initialMoisture,
        fertility: config.initialSoilQuality,
        health: 90,
        visualState: 0,
        stage: CROP_STAGES.UNPLANTED,
        stageLabel: 'Sin sembrar',
        stageIndex: 0,
        isWithered: false,
        composted: false,
        compostCount: 0,
        waterAppliedL: 0,
        baseYieldKg: tpl.baseYieldKg,
        yieldKg: tpl.baseYieldKg,
        marketValuePerKg: tpl.marketValuePerKg
      };
      syncPlotStageAndVisual(plot);
      this.plots[tpl.id] = plot;
    }

    return this.getState();
  }

  /**
   * Selecciona la parcela activa para inspeccionar o ejecutar acciones por defecto.
   * @param {string} plotId
   */
  setActivePlot(plotId) {
    if (!plotId || !this.plots[plotId]) {
      return { success: false, message: 'Parcela no encontrada', state: this.getState() };
    }
    this.activePlotId = plotId;
    return {
      success: true,
      activePlotId: this.activePlotId,
      state: this.getState()
    };
  }

  /**
   * Siembra lechuga en una parcela específica o en la parcela disponible activa.
   * @param {string} [plotId]
   */
  plant(plotId) {
    const target = this._resolvePlotForPlant(plotId);
    if (!target) {
      return { success: false, message: 'Parcela no encontrada' };
    }

    this.activePlotId = target.id;

    if (target.isPlanted) {
      return { success: false, message: `${target.name} ya se encuentra sembrada` };
    }

    const seedCost = this.modeConfig.seedCost;
    if (this.budget < seedCost) {
      return {
        success: false,
        message: `Presupuesto insuficiente para semillas ($${seedCost} requeridos)`
      };
    }

    this.budget -= seedCost;
    this.economy.seedExpenses += seedCost;

    target.isPlanted = true;
    target.daysGrown = 0;
    target.health = 90;
    target.waterAppliedL = 0;
    target.isWithered = false;

    const { projectedKg } = calculateProjectedYield(target, this.modeConfig);
    target.yieldKg = projectedKg;
    syncPlotStageAndVisual(target);

    const msg = `Sembraste ${target.cropName} en ${target.name} (-$${seedCost})`;
    this._recordEvent(`Día ${this.day}: ${msg}`);

    return {
      success: true,
      message: msg,
      plot: { ...target },
      state: this.getState()
    };
  }

  /**
   * Riega una parcela específica o todas las parcelas sembradas.
   * @param {string} [plotId]
   */
  irrigate(plotId) {
    if (plotId && !this.plots[plotId]) {
      return { success: false, message: 'Parcela no encontrada' };
    }

    const waterCostL = this.modeConfig.waterPerIrrigation;
    if (this.waterReserve < waterCostL) {
      return {
        success: false,
        message: '¡Reserva de agua insuficiente en el tanque! Recarga agua para continuar.'
      };
    }

    let targetPlots = [];
    if (plotId) {
      targetPlots = [this.plots[plotId]];
      this.activePlotId = plotId;
    } else {
      const planted = Object.values(this.plots).filter((p) => p.isPlanted);
      targetPlots = planted.length > 0 ? planted : Object.values(this.plots);
    }

    let cashCost = this.modeConfig.irrigationCost;
    let emergencyManualNote = '';
    if (this.budget < cashCost) {
      if (this.mode === SIMULATION_MODES.SUBSISTENCE) {
        cashCost = 0;
        emergencyManualNote = ' (riego manual sin costo operativo)';
      } else {
        return {
          success: false,
          message: `Presupuesto insuficiente para operar el riego ($${cashCost} requeridos)`
        };
      }
    }

    this.waterReserve -= waterCostL;
    this.waterConsumed += waterCostL;
    this.budget -= cashCost;
    this.economy.irrigationExpenses += cashCost;

    const perPlotWater = Math.round(waterCostL / targetPlots.length);
    const moistureGain = this.modeConfig.moistureGainPerIrrigation;

    for (const p of targetPlots) {
      p.moisture = Math.min(100, p.moisture + moistureGain);
      p.waterAppliedL += perPlotWater;

      if (p.isPlanted) {
        if (p.isWithered && p.moisture >= 15) {
          p.isWithered = false;
          p.health = Math.max(35, Math.min(100, p.health + 15));
        } else if (p.moisture <= 85) {
          p.health = Math.min(100, p.health + 2);
        }
        const { projectedKg } = calculateProjectedYield(p, this.modeConfig);
        p.yieldKg = projectedKg;
      }

      syncPlotStageAndVisual(p);
    }

    const targetLabel = plotId ? this.plots[plotId].name : 'la finca';
    const costSuffix = cashCost > 0 ? `, -$${cashCost}` : emergencyManualNote;
    const msg = `Riego aplicado en ${targetLabel} (-${waterCostL} L${costSuffix})`;
    this._recordEvent(`Día ${this.day}: ${msg}`);

    return {
      success: true,
      message: msg,
      irrigatedPlotIds: targetPlots.map((p) => p.id),
      waterReserve: this.waterReserve,
      waterConsumed: this.waterConsumed,
      state: this.getState()
    };
  }

  /**
   * Recarga agua al tanque principal desde la red/reservorio local.
   * @param {number} [liters]
   */
  refillWater(liters) {
    const amount = Number.isFinite(liters) && liters > 0
      ? Math.round(liters)
      : this.modeConfig.waterRefillLiters;
    const cost = this.modeConfig.waterRefillCost;

    if (this.waterReserve >= this.maxWater) {
      return {
        success: false,
        message: 'El tanque de agua ya se encuentra al 100% de su capacidad.'
      };
    }

    if (this.budget < cost) {
      return {
        success: false,
        message: `Presupuesto insuficiente para recargar agua ($${cost} requeridos).`
      };
    }

    const added = Math.min(amount, this.maxWater - this.waterReserve);
    this.waterReserve += added;
    this.budget -= cost;
    this.economy.waterExpenses += cost;

    const msg = `Tanque recargado con +${added} L (-$${cost})`;
    this._recordEvent(`Día ${this.day}: ${msg}`);

    return {
      success: true,
      message: msg,
      waterAdded: added,
      waterReserve: this.waterReserve,
      state: this.getState()
    };
  }

  /**
   * Activa o desactiva el riego automático en modalidad Precisión.
   * @param {boolean} enabled
   */
  setAutoIrrigation(enabled) {
    if (!this.modeConfig.supportsAutoIrrigation) {
      return {
        success: false,
        message: 'El riego automático solo está disponible en Agricultura de Precisión.',
        state: this.getState()
      };
    }

    this.autoIrrigationEnabled = Boolean(enabled);
    const msg = this.autoIrrigationEnabled
      ? 'Riego automático IoT activado'
      : 'Riego automático IoT desactivado';
    this._recordEvent(`Día ${this.day}: ${msg}`);

    return {
      success: true,
      autoIrrigationEnabled: this.autoIrrigationEnabled,
      message: msg,
      state: this.getState()
    };
  }

  /**
   * Avanza un día virtual de forma determinista y reproducible.
   */
  advanceDay() {
    this.day += 1;
    this.lastAutoAction = null;
    let autoIrrigatedPlotIds = [];

    for (const plot of Object.values(this.plots)) {
      const evapRate = calculateDailyEvaporation(this.modeConfig, plot);
      advancePlotDay(plot, this.modeConfig, evapRate);
    }

    // Riego automático en modalidad Precisión cuando la humedad baja del umbral
    if (this.modeConfig.supportsAutoIrrigation && this.autoIrrigationEnabled) {
      const needing = getPlotsNeedingAutoIrrigation(
        this.plots,
        this.modeConfig.autoIrrigationThreshold
      );

      if (needing.length > 0) {
        const waterNeeded = this.modeConfig.waterPerIrrigation;
        if (this.waterReserve >= waterNeeded) {
          const opCost = this.budget >= this.modeConfig.irrigationCost
            ? this.modeConfig.irrigationCost
            : 0;
          this.waterReserve -= waterNeeded;
          this.waterConsumed += waterNeeded;
          this.budget -= opCost;
          this.economy.irrigationExpenses += opCost;
          this.autoIrrigationsTriggered += 1;

          const perPlotL = Math.round(waterNeeded / needing.length);
          for (const plot of needing) {
            plot.moisture = Math.min(100, plot.moisture + this.modeConfig.moistureGainPerIrrigation);
            plot.waterAppliedL += perPlotL;
            if (plot.isWithered && plot.moisture >= 15) {
              plot.isWithered = false;
              plot.health = Math.max(35, Math.min(100, plot.health + 12));
            }
            const { projectedKg } = calculateProjectedYield(plot, this.modeConfig);
            plot.yieldKg = projectedKg;
            syncPlotStageAndVisual(plot);
          }

          const names = needing.map((p) => p.id).join(', ');
          autoIrrigatedPlotIds = needing.map((p) => p.id);
          this.lastAutoAction = `Riego automático IoT activado en ${names} (-${waterNeeded} L)`;
          this._recordEvent(`Día ${this.day}: ${this.lastAutoAction}`);
        } else {
          this.lastAutoAction = 'Alerta IoT: humedad baja pero reserva de agua insuficiente';
          this._recordEvent(`Día ${this.day}: ${this.lastAutoAction}`);
        }
      }
    }

    this._recomputeFarmSoilQuality();

    const message = this.lastAutoAction
      ? `Amanece el Día ${this.day}. ${this.lastAutoAction}`
      : `Amanece el Día ${this.day} en la finca`;

    this._recordEvent(`Día ${this.day}: Avance diario completado`);

    return {
      success: true,
      day: this.day,
      autoTriggered: Boolean(this.lastAutoAction),
      autoIrrigatedPlotIds,
      message,
      state: this.getState()
    };
  }

  /**
   * Cosecha una parcela madura (o limpia una parcela marchita) y genera
   * el reporte educativo simplificado según las decisiones del jugador.
   * @param {string} [plotId]
   */
  harvest(plotId) {
    const target = this._resolvePlotForHarvest(plotId);
    if (!target) {
      return { success: false, message: 'Parcela no encontrada' };
    }

    this.activePlotId = target.id;

    if (!target.isPlanted) {
      return { success: false, message: 'No hay cultivos para cosechar en esta parcela' };
    }

    if (target.visualState === 4 || target.isWithered) {
      this.harvestSequence += 1;
      const report = buildHarvestReport({
        harvestId: this.harvestSequence,
        plot: target,
        modeConfig: this.modeConfig,
        harvestKg: 0,
        earnings: 0,
        effectivePricePerKg: 0,
        totalExpenses: this._getTotalExpenses(),
        waterUsedInPlot: target.waterAppliedL,
        day: this.day
      });
      report.qualityGrade = 'Pérdida por sequía (D)';
      report.feedback = [
        'El cultivo de lechuga se marchitó por falta de agua prolongada.',
        'Recuerda vigilar la humedad del suelo y regar antes de bajar del 15%.'
      ];

      this.lastHarvest = report;
      this.harvestHistory.push(report);

      target.isPlanted = false;
      target.daysGrown = 0;
      target.health = 90;
      target.waterAppliedL = 0;
      target.yieldKg = target.baseYieldKg;
      syncPlotStageAndVisual(target);

      const msg =
        'El cultivo estaba deteriorado por sequía. Limpiaste la parcela sin ganancias.';
      this._recordEvent(`Día ${this.day}: ${msg}`);

      return {
        success: true,
        message: msg,
        earnings: 0,
        harvestKg: 0,
        stage: CROP_STAGES.HARVESTED,
        report,
        state: this.getState()
      };
    }

    if (target.daysGrown < target.daysToMature) {
      return {
        success: false,
        message: `El cultivo aún está en ${target.stageLabel.toLowerCase()} (${target.daysGrown}/${target.daysToMature} días)`
      };
    }

    const { projectedKg, effectivePricePerKg } = calculateProjectedYield(
      target,
      this.modeConfig
    );
    const earnings = Math.round(projectedKg * effectivePricePerKg);

    this.budget += earnings;
    this.economy.totalRevenue += earnings;
    this.harvestedTotalKg += projectedKg;

    this.harvestSequence += 1;
    const report = buildHarvestReport({
      harvestId: this.harvestSequence,
      plot: target,
      modeConfig: this.modeConfig,
      harvestKg: projectedKg,
      earnings,
      effectivePricePerKg,
      totalExpenses: this._getTotalExpenses(),
      waterUsedInPlot: target.waterAppliedL,
      day: this.day
    });

    this.lastHarvest = report;
    this.harvestHistory.push(report);

    // Desgaste post-cosecha de fertilidad según conservación del suelo
    const postHarvestDrain =
      this.mode === SIMULATION_MODES.ECOLOGICAL && target.composted
        ? 0
        : this.modeConfig.harvestFertilityDrain;
    target.fertility = Math.max(10, target.fertility - postHarvestDrain);

    // Resetear cama de cultivo lista para un nuevo ciclo
    target.isPlanted = false;
    target.daysGrown = 0;
    target.health = 90;
    target.waterAppliedL = 0;
    target.yieldKg = target.baseYieldKg;
    syncPlotStageAndVisual(target);
    this._recomputeFarmSoilQuality();

    const msg = `¡Cosecha exitosa! Recolectaste ${projectedKg} kg de ${target.cropName} (+$${earnings})`;
    this._recordEvent(`Día ${this.day}: ${msg}`);

    return {
      success: true,
      message: msg,
      earnings,
      harvestKg: projectedKg,
      stage: CROP_STAGES.HARVESTED,
      report,
      state: this.getState()
    };
  }

  /**
   * Aplica compost orgánico para mejorar fertilidad, retención hídrica y salud.
   * @param {string} [plotId]
   */
  applyCompost(plotId) {
    if (plotId && !this.plots[plotId]) {
      return { success: false, message: 'Parcela no encontrada' };
    }

    const cost = this.modeConfig.compostCost;
    if (this.budget < cost) {
      return {
        success: false,
        message: `Presupuesto insuficiente para compost ($${cost} requeridos)`
      };
    }

    this.budget -= cost;
    this.economy.compostExpenses += cost;
    this.compostApplications += 1;

    const targets = plotId
      ? [this.plots[plotId]]
      : Object.values(this.plots);

    for (const plot of targets) {
      applyCompostEffectsToPlot(plot, this.modeConfig);
      if (plot.isPlanted) {
        const { projectedKg } = calculateProjectedYield(plot, this.modeConfig);
        plot.yieldKg = projectedKg;
      }
      syncPlotStageAndVisual(plot);
    }

    this._recomputeFarmSoilQuality();

    const scopeLabel = plotId ? this.plots[plotId].name : 'toda la finca';
    const costText = cost > 0 ? ` (-$${cost})` : ' (compostera propia, sin costo)';
    const msg = `Compost orgánico aplicado en ${scopeLabel}${costText}. Fertilidad del suelo: ${this.soilQuality}%`;
    this._recordEvent(`Día ${this.day}: ${msg}`);

    return {
      success: true,
      message: msg,
      soilQuality: this.soilQuality,
      fertility: this.soilQuality,
      state: this.getState()
    };
  }

  /**
   * Devuelve la lectura del sensor virtual para una parcela o la parcela activa.
   * @param {string} [plotId]
   */
  getSensorReading(plotId) {
    const targetId = plotId && this.plots[plotId] ? plotId : this.activePlotId;
    const telemetry = computeSensorTelemetry(
      this.plots,
      this.modeConfig,
      this.autoIrrigationEnabled,
      this.lastAutoAction
    );
    return {
      enabled: telemetry.enabled,
      sensorActiveLabel: telemetry.sensorActiveLabel,
      reading: telemetry.readings[targetId] || null,
      allReadings: telemetry.readings
    };
  }

  /**
   * Devuelve una copia inmutable y completa del estado actual de la finca.
   */
  getState() {
    const plotList = Object.values(this.plots);
    const activePlot = this.plots[this.activePlotId] || plotList[0];
    const plantedPlots = plotList.filter((p) => p.isPlanted);

    const averageMoisture = Math.round(
      plotList.reduce((acc, p) => acc + p.moisture, 0) / plotList.length
    );

    const cropHealth = plantedPlots.length > 0
      ? Math.round(plantedPlots.reduce((acc, p) => acc + p.health, 0) / plantedPlots.length)
      : activePlot.health;

    const totalExpenses = this._getTotalExpenses();
    const netProfit = this.economy.totalRevenue - totalExpenses;

    const sensor = computeSensorTelemetry(
      this.plots,
      this.modeConfig,
      this.autoIrrigationEnabled,
      this.lastAutoAction
    );

    const availableActions = {
      canPlant: !activePlot.isPlanted && this.budget >= this.modeConfig.seedCost,
      canIrrigate:
        this.waterReserve >= this.waterConsumptionPerIrrigation &&
        (this.budget >= this.modeConfig.irrigationCost ||
          this.mode === SIMULATION_MODES.SUBSISTENCE),
      canHarvest:
        activePlot.isPlanted &&
        (activePlot.daysGrown >= activePlot.daysToMature || activePlot.isWithered),
      canCompost: this.budget >= this.modeConfig.compostCost,
      canRefillWater:
        this.waterReserve < this.maxWater && this.budget >= this.modeConfig.waterRefillCost,
      canToggleAutoIrrigation: Boolean(this.modeConfig.supportsAutoIrrigation)
    };

    return {
      mode: this.mode,
      modeName: this.modeConfig.name,
      modeShortName: this.modeConfig.shortName,
      modeBadge: this.modeConfig.badge,
      modeDescription: this.modeConfig.description,
      day: this.day,
      activePlotId: this.activePlotId,
      budget: this.budget,
      waterReserve: this.waterReserve,
      maxWater: this.maxWater,
      waterConsumed: this.waterConsumed,
      waterConsumptionPerIrrigation: this.waterConsumptionPerIrrigation,
      soilQuality: this.soilQuality,
      fertility: this.soilQuality,
      moisture: activePlot.moisture,
      averageMoisture,
      cropHealth,
      harvestedTotalKg: this.harvestedTotalKg,
      seedCost: this.modeConfig.seedCost,
      irrigationCost: this.modeConfig.irrigationCost,
      compostCost: this.modeConfig.compostCost,
      evaporationRate: calculateDailyEvaporation(this.modeConfig, activePlot),
      autoIrrigationEnabled: this.autoIrrigationEnabled,
      autoIrrigationsTriggered: this.autoIrrigationsTriggered,
      compostApplications: this.compostApplications,
      availableActions,
      sensor,
      economy: {
        initialBudget: this.initialBudget,
        currentBudget: this.budget,
        totalRevenue: this.economy.totalRevenue,
        totalExpenses,
        netProfit,
        ...this.economy
      },
      lastHarvest: this.lastHarvest ? JSON.parse(JSON.stringify(this.lastHarvest)) : null,
      harvestHistory: JSON.parse(JSON.stringify(this.harvestHistory)),
      recentEvents: [...this.recentEvents],
      disclaimer: EDUCATIONAL_DISCLAIMER,
      plots: JSON.parse(JSON.stringify(this.plots))
    };
  }

  _getTotalExpenses() {
    return (
      this.economy.seedExpenses +
      this.economy.irrigationExpenses +
      this.economy.compostExpenses +
      this.economy.waterExpenses
    );
  }

  _recomputeFarmSoilQuality() {
    const plotList = Object.values(this.plots);
    const avg =
      plotList.reduce((acc, p) => acc + p.fertility, 0) / plotList.length;
    this.soilQuality = Math.round(avg);
  }

  _recordEvent(entry) {
    this.recentEvents.unshift(entry);
    if (this.recentEvents.length > 6) {
      this.recentEvents.length = 6;
    }
  }

  _resolvePlotForPlant(plotId) {
    if (plotId) return this.plots[plotId] || null;
    const preferred = this.plots[this.activePlotId];
    if (preferred && !preferred.isPlanted) return preferred;
    const firstEmpty = Object.values(this.plots).find((p) => !p.isPlanted);
    return firstEmpty || preferred || Object.values(this.plots)[0];
  }

  _resolvePlotForHarvest(plotId) {
    if (plotId) return this.plots[plotId] || null;
    const all = Object.values(this.plots);
    const mature = all.find(
      (p) => p.isPlanted && (p.daysGrown >= p.daysToMature || p.visualState === 4)
    );
    if (mature) return mature;
    const preferred = this.plots[this.activePlotId];
    if (preferred && preferred.isPlanted) return preferred;
    const planted = all.find((p) => p.isPlanted);
    return planted || preferred || all[0];
  }
}

/**
 * Devuelve la instancia activa compartida del simulador (crea una si aún no existe).
 * @returns {FarmSimulation}
 */
export function getActiveSimulation() {
  if (!activeSimulationInstance) {
    activeSimulationInstance = new FarmSimulation(SIMULATION_MODES.PRECISION);
  }
  return activeSimulationInstance;
}

/**
 * Inicializa o reinicia la finca en una modalidad específica.
 * @param {'subsistence' | 'precision' | 'ecological'} [mode]
 */
export function initializeFarm(mode = SIMULATION_MODES.PRECISION) {
  return getActiveSimulation().initializeFarm(mode);
}

/**
 * Siembra una parcela en el simulador activo.
 * @param {string} [plotId]
 */
export function plant(plotId) {
  return getActiveSimulation().plant(plotId);
}

/**
 * Riega una parcela o el campo en el simulador activo.
 * @param {string} [plotId]
 */
export function irrigate(plotId) {
  return getActiveSimulation().irrigate(plotId);
}

/**
 * Avanza un día virtual en el simulador activo.
 */
export function advanceDay() {
  return getActiveSimulation().advanceDay();
}

/**
 * Cosecha una parcela lista en el simulador activo.
 * @param {string} [plotId]
 */
export function harvest(plotId) {
  return getActiveSimulation().harvest(plotId);
}

/**
 * Aplica compost orgánico en el simulador activo.
 * @param {string} [plotId]
 */
export function applyCompost(plotId) {
  return getActiveSimulation().applyCompost(plotId);
}

/**
 * Activa o desactiva el riego automático en modo Precisión.
 * @param {boolean} enabled
 */
export function setAutoIrrigation(enabled) {
  return getActiveSimulation().setAutoIrrigation(enabled);
}

/**
 * Recarga el tanque de agua de la finca.
 * @param {number} [liters]
 */
export function refillWater(liters) {
  return getActiveSimulation().refillWater(liters);
}

/**
 * Cambia la parcela enfocada para lectura y acciones rápidas.
 * @param {string} plotId
 */
export function setActivePlot(plotId) {
  return getActiveSimulation().setActivePlot(plotId);
}

/**
 * Consulta la telemetría del sensor virtual para una parcela.
 * @param {string} [plotId]
 */
export function getSensorReading(plotId) {
  return getActiveSimulation().getSensorReading(plotId);
}

/**
 * Obtiene el estado inmutable actual de la finca.
 */
export function getState() {
  return getActiveSimulation().getState();
}

/**
 * Ejecuta una demostración determinista y aislada de las tres modalidades
 * agrícolas con cultivo de lechuga para comparación educativa.
 * @returns {{ results: object[], disclaimer: string }}
 */
export function runModesComparisonDemo() {
  const results = [];

  // 1. Demostración Subsistencia (riego manual y menor presupuesto)
  const simSub = new FarmSimulation(SIMULATION_MODES.SUBSISTENCE, { registerAsActive: false });
  simSub.plant('plot_1');
  simSub.irrigate('plot_1');
  simSub.advanceDay();
  simSub.advanceDay();
  simSub.irrigate('plot_1');
  simSub.advanceDay();
  const harvestSub = simSub.harvest('plot_1');
  const stateSub = simSub.getState();
  results.push({
    mode: stateSub.mode,
    modeName: stateSub.modeName,
    plotUsed: 'Parcela 1 (Lechuga Criolla)',
    daysSimulated: stateSub.day,
    waterConsumedL: stateSub.waterConsumed,
    finalMoisture: stateSub.plots.plot_1.moisture,
    finalFertility: stateSub.plots.plot_1.fertility,
    healthAtHarvest: harvestSub.report.healthAtHarvest,
    harvestKg: harvestSub.harvestKg,
    earnings: harvestSub.earnings,
    totalExpenses: stateSub.economy.totalExpenses,
    netProfit: stateSub.economy.netProfit,
    sustainabilityScore: harvestSub.report.sustainabilityScore,
    qualityGrade: harvestSub.report.qualityGrade,
    keyMechanism: 'Riego manual frecuente y desgaste gradual de fertilidad'
  });

  // 2. Demostración Precisión (sensor virtual + riego automático)
  const simPre = new FarmSimulation(SIMULATION_MODES.PRECISION, { registerAsActive: false });
  simPre.plant('plot_2');
  simPre.advanceDay();
  simPre.advanceDay(); // Humedad cae < 45% y el sensor IoT activa riego automático
  const harvestPre = simPre.harvest('plot_2');
  const statePre = simPre.getState();
  results.push({
    mode: statePre.mode,
    modeName: statePre.modeName,
    plotUsed: 'Parcela 2 (Lechuga Tecnificada)',
    daysSimulated: statePre.day,
    waterConsumedL: statePre.waterConsumed,
    finalMoisture: statePre.plots.plot_2.moisture,
    finalFertility: statePre.plots.plot_2.fertility,
    healthAtHarvest: harvestPre.report.healthAtHarvest,
    harvestKg: harvestPre.harvestKg,
    earnings: harvestPre.earnings,
    totalExpenses: statePre.economy.totalExpenses,
    netProfit: statePre.economy.netProfit,
    sustainabilityScore: harvestPre.report.sustainabilityScore,
    qualityGrade: harvestPre.report.qualityGrade,
    autoIrrigationsTriggered: statePre.autoIrrigationsTriggered,
    keyMechanism: 'Sensor IoT detecta déficit y dispara micro-riego automático'
  });

  // 3. Demostración Ecológica (compostaje + conservación hídrica y de fertilidad)
  const simEco = new FarmSimulation(SIMULATION_MODES.ECOLOGICAL, { registerAsActive: false });
  simEco.plant('plot_3');
  simEco.applyCompost('plot_3');
  simEco.advanceDay();
  simEco.advanceDay();
  simEco.irrigate('plot_3');
  simEco.advanceDay();
  const harvestEco = simEco.harvest('plot_3');
  const stateEco = simEco.getState();
  results.push({
    mode: stateEco.mode,
    modeName: stateEco.modeName,
    plotUsed: 'Parcela 3 (Lechuga Orgánica)',
    daysSimulated: stateEco.day,
    waterConsumedL: stateEco.waterConsumed,
    finalMoisture: stateEco.plots.plot_3.moisture,
    finalFertility: stateEco.plots.plot_3.fertility,
    healthAtHarvest: harvestEco.report.healthAtHarvest,
    harvestKg: harvestEco.harvestKg,
    earnings: harvestEco.earnings,
    totalExpenses: stateEco.economy.totalExpenses,
    netProfit: stateEco.economy.netProfit,
    sustainabilityScore: harvestEco.report.sustainabilityScore,
    qualityGrade: harvestEco.report.qualityGrade,
    compostApplications: stateEco.compostApplications,
    keyMechanism: 'Compostaje orgánico conserva fertilidad, reduce evaporación y da prima ecológica'
  });

  return {
    results,
    disclaimer: EDUCATIONAL_DISCLAIMER
  };
}
