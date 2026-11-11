/**
 * ============================================================================
 * SIMULADOR AGRÍCOLA EDUCATIVO (MÓDULO DE RESPALDO / CONTRATO PROVISIONAL)
 * ============================================================================
 * Este archivo implementa el contrato acordado para el Compañero 3.
 * Si el Compañero 3 entrega su versión final de `src/simulation/`,
 * puede reemplazar este archivo o conectarse directamente mediante `src/integration/farmAdapter.js`.
 *
 * MODOS EDUCATIVOS:
 * 1. 'subsistence' (Agricultura de Subsistencia):
 *    Bajo presupuesto inicial, alto consumo de agua, rendimiento tradicional.
 * 2. 'precision' (Agricultura de Precisión):
 *    Sensores IoT, riego controlado y optimizado, mayor productividad.
 * 3. 'ecological' (Agricultura Ecológica):
 *    Enriquecimiento orgánico con compost, alta retención hídrica, cosecha premium.
 */

export class FarmSimulation {
  constructor(initialMode = 'precision') {
    this.mode = initialMode;
    this.initializeFarm(initialMode);
  }

  /**
   * Reinicia o inicializa el estado de la finca según el modo seleccionado
   * @param {'subsistence' | 'precision' | 'ecological'} mode
   */
  initializeFarm(mode = 'precision') {
    this.mode = mode;
    this.day = 1;

    // Configuración agronómica según filosofía
    if (mode === 'subsistence') {
      this.budget = 500;
      this.waterReserve = 600;
      this.maxWater = 1000;
      this.soilQuality = 60; // Porcentaje
      this.waterConsumptionPerIrrigation = 120;
    } else if (mode === 'precision') {
      this.budget = 1400;
      this.waterReserve = 900;
      this.maxWater = 1500;
      this.soilQuality = 80;
      this.waterConsumptionPerIrrigation = 60; // Riego inteligente de alta eficiencia
    } else {
      // ecological
      this.budget = 850;
      this.waterReserve = 800;
      this.maxWater = 1200;
      this.soilQuality = 95;
      this.waterConsumptionPerIrrigation = 80;
    }

    this.harvestedTotalKg = 0;

    // Estado individual de las 3 parcelas
    this.plots = {
      plot_1: {
        id: 'plot_1',
        name: 'Parcela 1 — Subsistencia',
        cropName: 'Maíz Tradicional',
        isPlanted: false,
        daysGrown: 0,
        daysToMature: 3,
        moisture: 50,
        visualState: 0, // 0: vacía, 1: brote, 2: crecimiento, 3: madura, 4: marchita
        yieldKg: 45,
        marketValuePerKg: 5
      },
      plot_2: {
        id: 'plot_2',
        name: 'Parcela 2 — Precisión',
        cropName: 'Hortalizas Tecnificadas',
        isPlanted: false,
        daysGrown: 0,
        daysToMature: 2,
        moisture: 75,
        visualState: 0,
        yieldKg: 85,
        marketValuePerKg: 7
      },
      plot_3: {
        id: 'plot_3',
        name: 'Parcela 3 — Ecológica',
        cropName: 'Policultivo Agroecológico',
        isPlanted: false,
        daysGrown: 0,
        daysToMature: 3,
        moisture: 65,
        visualState: 0,
        yieldKg: 65,
        marketValuePerKg: 9
      }
    };

    return this.getState();
  }

  /**
   * Siembra una parcela específica o la primera disponible
   * @param {string} [plotId]
   */
  plant(plotId) {
    const target = this._resolvePlot(plotId);
    if (!target) {
      return { success: false, message: 'Parcela no encontrada' };
    }

    if (target.isPlanted) {
      return { success: false, message: `${target.name} ya se encuentra sembrada` };
    }

    const seedCost = this.mode === 'precision' ? 60 : 35;
    if (this.budget < seedCost) {
      return { success: false, message: 'Presupuesto insuficiente para semillas' };
    }

    this.budget -= seedCost;
    target.isPlanted = true;
    target.daysGrown = 0;
    target.visualState = 1; // Brote inicial

    return {
      success: true,
      message: `Sembraste ${target.cropName} en ${target.name} (-$${seedCost})`,
      plot: target,
      state: this.getState()
    };
  }

  /**
   * Riega una parcela específica o el sistema completo
   * @param {string} [plotId]
   */
  irrigate(plotId) {
    if (this.waterReserve < this.waterConsumptionPerIrrigation) {
      return { success: false, message: '¡Reserva de agua insuficiente en el tanque!' };
    }

    this.waterReserve -= this.waterConsumptionPerIrrigation;

    let targetPlots = [];
    if (plotId && this.plots[plotId]) {
      targetPlots = [this.plots[plotId]];
    } else {
      // Si no se especifica parcela, riega todas las sembradas
      targetPlots = Object.values(this.plots);
    }

    targetPlots.forEach(p => {
      p.moisture = Math.min(100, p.moisture + 35);
      // Si estaba marchita y se recupera la humedad, volver al estado maduro o crecimiento
      if (p.visualState === 4 && p.isPlanted) {
        p.visualState = p.daysGrown >= p.daysToMature ? 3 : 2;
      }
    });

    return {
      success: true,
      message: `Sistema de riego activado (-${this.waterConsumptionPerIrrigation} L de agua)`,
      waterReserve: this.waterReserve,
      state: this.getState()
    };
  }

  /**
   * Avanza un día en el calendario de la finca
   */
  advanceDay() {
    this.day += 1;

    // Lógica diaria de evaporación y crecimiento
    Object.values(this.plots).forEach(p => {
      // Pérdida de humedad según modo
      const evapRate = this.mode === 'ecological' ? 12 : 20; // La ecológica retiene mejor
      p.moisture = Math.max(0, p.moisture - evapRate);

      if (p.isPlanted) {
        // Si hay sequía crítica, la planta se deteriora
        if (p.moisture < 15) {
          p.visualState = 4; // Marchita
        } else {
          p.daysGrown += 1;

          if (p.daysGrown >= p.daysToMature) {
            p.visualState = 3; // Madura
          } else if (p.daysGrown >= 1) {
            p.visualState = 2; // Crecimiento
          } else {
            p.visualState = 1; // Brote
          }
        }
      }
    });

    // Pequeño aporte de lluvia / recarga de agua ocasional
    if (Math.random() < 0.35) {
      const rainGain = 100;
      this.waterReserve = Math.min(this.maxWater, this.waterReserve + rainGain);
    }

    return {
      success: true,
      day: this.day,
      message: `Amanece el Día ${this.day} en la finca`,
      state: this.getState()
    };
  }

  /**
   * Cosecha una parcela madura
   * @param {string} [plotId]
   */
  harvest(plotId) {
    const target = this._resolvePlot(plotId);
    if (!target) {
      return { success: false, message: 'Parcela no encontrada' };
    }

    if (!target.isPlanted) {
      return { success: false, message: 'No hay cultivos para cosechar en esta parcela' };
    }

    if (target.visualState === 4) {
      // Cosecha de cultivo marchito (pérdida)
      target.isPlanted = false;
      target.daysGrown = 0;
      target.visualState = 0;
      return {
        success: true,
        message: `El cultivo estaba deteriorado por sequía. Limpiaste la parcela sin ganancias.`,
        earnings: 0,
        harvestKg: 0,
        state: this.getState()
      };
    }

    if (target.daysGrown < target.daysToMature) {
      return { success: false, message: `El cultivo aún está creciendo (${target.daysGrown}/${target.daysToMature} días)` };
    }

    const earnings = target.yieldKg * target.marketValuePerKg;
    this.budget += earnings;
    this.harvestedTotalKg += target.yieldKg;

    // Resetear parcela a estado limpio
    target.isPlanted = false;
    target.daysGrown = 0;
    target.visualState = 0;

    return {
      success: true,
      message: `¡Cosecha exitosa! Recolectaste ${target.yieldKg} kg de ${target.cropName} (+$${earnings})`,
      earnings,
      harvestKg: target.yieldKg,
      state: this.getState()
    };
  }

  /**
   * Enriquecimiento con compost (exclusivo o potenciamiento)
   */
  applyCompost() {
    this.soilQuality = Math.min(100, this.soilQuality + 15);
    return {
      success: true,
      message: `Compost orgánico aplicado al suelo. Calidad del suelo: ${this.soilQuality}%`,
      soilQuality: this.soilQuality,
      state: this.getState()
    };
  }

  /**
   * Devuelve el estado completo e inmutable de la finca
   */
  getState() {
    return {
      mode: this.mode,
      day: this.day,
      budget: this.budget,
      waterReserve: this.waterReserve,
      maxWater: this.maxWater,
      soilQuality: this.soilQuality,
      harvestedTotalKg: this.harvestedTotalKg,
      plots: JSON.parse(JSON.stringify(this.plots))
    };
  }

  _resolvePlot(plotId) {
    if (plotId && this.plots[plotId]) return this.plots[plotId];
    // Buscar la primera parcela sembrada o la primera libre
    const all = Object.values(this.plots);
    return all.find(p => p.isPlanted) || all[0];
  }
}
