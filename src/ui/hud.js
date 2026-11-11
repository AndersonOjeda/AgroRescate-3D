import './hud.css';
import {
  advanceDay,
  applyCompost,
  getActiveSimulation,
  harvest,
  initializeFarm,
  irrigate,
  plant,
  refillWater,
  runModesComparisonDemo,
  setActivePlot,
  setAutoIrrigation
} from '../simulation/farmSimulation.js';
import { CROP_STAGES, EDUCATIONAL_DISCLAIMER, SIMULATION_MODES } from '../simulation/constants.js';
import { GUIDE_STEPS } from '../world/guideChicken.js';

const LIFECYCLE_STEPS = [
  { key: CROP_STAGES.UNPLANTED, label: 'Sin sembrar' },
  { key: CROP_STAGES.PLANTED, label: 'Sembrado' },
  { key: CROP_STAGES.GROWING, label: 'Crecimiento' },
  { key: CROP_STAGES.MATURING, label: 'Maduración' },
  { key: CROP_STAGES.HARVESTED, label: 'Cosecha' }
];

const MODE_LABELS = {
  [SIMULATION_MODES.SUBSISTENCE]: 'Subsistencia',
  [SIMULATION_MODES.PRECISION]: 'Precisión IoT',
  [SIMULATION_MODES.ECOLOGICAL]: 'Ecológica'
};

/**
 * Gestor del HUD (Heads-Up Display) e Interfaces de Usuario de AgroRescate 3D.
 * Conecta el motor Three.js y la simulación agrícola con paneles HTML/CSS modernos,
 * responsivos y no intrusivos.
 */
export class HUD {
  constructor(options = {}) {
    this.doc = options.document || (typeof document !== 'undefined' ? document : null);
    this.adapter = options.adapter || null;
    this.actionHandlers = options.actionHandlers || null;
    this.container = options.container || null;

    this.lastState = null;
    this.currentZone = 'Patio Central';
    this.currentCoords = { x: 0, y: 0, z: 0 };
    this.isCollapsed = Boolean(options.collapsed);
    this._lastDisplayedHarvestId = null;

    this.chickenGuideSteps = GUIDE_STEPS;
    this.chickenGuideIndex = 0;
    this.chickenVoiceEnabled = true;
    this.onChickenGuideStepChange = null;
    this.onChickenGuideClose = null;
    this.onChickenVoiceToggle = null;

    if (!this.doc) return;

    this._bindExistingElements();
    this._setupHelpModal();
    this._setupReportModal();
    this._mountSimulationHud();
  }

  _bindExistingElements() {
    const d = this.doc;
    this.loadingScreen = d.getElementById('loading-screen');
    this.loadingBar = d.getElementById('loading-bar');
    this.loadingStatus = d.getElementById('loading-status');

    this.startOverlay = d.getElementById('start-overlay');
    this.btnStartGame = d.getElementById('btn-start-game');

    this.interactionPrompt = d.getElementById('interaction-prompt');
    this.promptAction = d.getElementById('prompt-action');
    this.promptTarget = d.getElementById('prompt-target');

    this.modeSelector = d.getElementById('mode-selector');
    this.hudDay = d.getElementById('hud-day');
    this.hudWater = d.getElementById('hud-water');
    this.meterWater = d.getElementById('meter-water');
    this.hudSoil = d.getElementById('hud-soil');
    this.meterSoil = d.getElementById('meter-soil');
    this.hudBudget = d.getElementById('hud-budget');
    this.hudHarvest = d.getElementById('hud-harvest');
    this.btnAdvanceDay = d.getElementById('btn-advance-day');

    this.zoneName = d.getElementById('zone-name');
    this.toastContainer = d.getElementById('toast-container');

    this.debugCoords = d.getElementById('debug-coords');
    this.debugFps = d.getElementById('debug-fps');
    this.debugPhysics = d.getElementById('debug-physics');

    this.btnToggleSound = d.getElementById('btn-toggle-sound');
    this.soundIcon = d.getElementById('sound-icon');
    this.btnToggleRain = d.getElementById('btn-toggle-rain');
    this.btnSpawnCrate = d.getElementById('btn-spawn-crate');
    this.btnShowReport = d.getElementById('btn-show-report');
    this.btnShowGuide = d.getElementById('btn-show-guide');
    this.btnShowHelp = d.getElementById('btn-show-help');
    this.reportModal = d.getElementById('report-modal');
    this.btnCloseReport = d.getElementById('btn-close-report');
  }

  _setupReportModal() {
    if (this.btnShowReport && this.reportModal) {
      this.btnShowReport.addEventListener('click', () => {
        this.reportModal.classList.remove('hidden');
      });
    }

    if (this.btnCloseReport && this.reportModal) {
      this.btnCloseReport.addEventListener('click', () => {
        this.reportModal.classList.add('hidden');
      });
    }

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
          if (this.reportModal && !this.reportModal.classList.contains('hidden')) {
            this.reportModal.classList.add('hidden');
          }
          if (this.isChickenGuideOpen()) {
            this.closeChickenGuide({ relock: false });
          }
        }
      });
    }
  }

  /**
   * Permite conectar opcionalmente el FarmAdapter de Three.js para que los
   * botones del HUD disparen también audio, partículas y sincronización 3D.
   */
  connectAdapter(adapter) {
    this.adapter = adapter;
  }

  /**
   * Permite inyectar manejadores personalizados (útil para pruebas o integración).
   */
  setActionHandlers(handlers) {
    this.actionHandlers = handlers;
  }

  updateLoadingProgress(percent, message) {
    if (this.loadingBar) {
      this.loadingBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (this.loadingStatus && message) {
      this.loadingStatus.textContent = message;
    }
  }

  hideLoadingScreen() {
    if (this.loadingScreen) {
      this.loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        this.loadingScreen.style.display = 'none';
        if (this.startOverlay) {
          this.startOverlay.classList.remove('hidden');
        }
      }, 600);
    }
  }

  showInteractionPrompt(interactable) {
    if (!this.interactionPrompt) return;

    if (interactable && !this.isChickenGuideOpen()) {
      if (this.promptAction) {
        this.promptAction.textContent = interactable.actionText || 'Presiona E';
      }
      if (this.promptTarget) {
        this.promptTarget.textContent = interactable.name || '';
      }
      this.interactionPrompt.classList.remove('hidden');
    } else {
      this.interactionPrompt.classList.add('hidden');
    }
  }

  /**
   * Recibe desde Three.js la zona actual del jugador y enfoca la parcela correspondiente.
   * @param {string} zoneText
   */
  setZone(zoneText) {
    if (!zoneText) return;
    this.currentZone = zoneText;

    if (this.zoneName) {
      this.zoneName.textContent = zoneText;
    }
    if (this.panelRefs?.threeZone) {
      this.panelRefs.threeZone.textContent = zoneText;
    }

    const detectedPlotId = this._detectPlotIdFromZone(zoneText);
    if (detectedPlotId && this.lastState?.activePlotId !== detectedPlotId) {
      if (this.actionHandlers?.setActivePlot) {
        this.actionHandlers.setActivePlot(detectedPlotId);
      } else if (typeof this.adapter?.simulation?.setActivePlot === 'function') {
        const res = this.adapter.simulation.setActivePlot(detectedPlotId);
        if (res?.state) this.updateFarmState(res.state);
      } else {
        const res = setActivePlot(detectedPlotId);
        if (res?.state) this.updateFarmState(res.state);
      }
    }
  }

  /**
   * Recibe desde Three.js las coordenadas X, Y, Z del jugador.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  updateCoordinates(x, y, z) {
    this.currentCoords = { x, y, z };
    const formatted = `X: ${x.toFixed(1)} | Y: ${y.toFixed(1)} | Z: ${z.toFixed(1)}`;
    if (formatted === this._lastCoordsText) return;
    this._lastCoordsText = formatted;
    if (this.debugCoords) {
      this.debugCoords.textContent = formatted;
    }
    if (this.panelRefs?.threeCoords) {
      this.panelRefs.threeCoords.textContent = formatted;
    }
  }

  updateFps(fps) {
    if (this.debugFps) {
      this.debugFps.textContent = fps;
      this.debugFps.style.color = fps >= 45 ? '#34d399' : fps >= 25 ? '#f59e0b' : '#ef4444';
    }
  }

  /**
   * Actualiza tanto la barra superior legacy como el panel agrícola completo.
   * @param {object} state
   */
  updateFarmState(state) {
    if (!state) return;
    this.lastState = state;

    if (this.hudDay) this.hudDay.textContent = state.day;
    if (this.hudBudget) this.hudBudget.textContent = `$${state.budget.toLocaleString()}`;
    if (this.hudHarvest) this.hudHarvest.textContent = `${state.harvestedTotalKg} kg`;

    if (this.hudWater && this.meterWater) {
      this.hudWater.textContent = `${state.waterReserve} L`;
      const waterPct = Math.round((state.waterReserve / (state.maxWater || 1000)) * 100);
      this.meterWater.style.width = `${Math.max(0, Math.min(100, waterPct))}%`;
    }

    if (this.hudSoil && this.meterSoil) {
      this.hudSoil.textContent = `${state.soilQuality}%`;
      this.meterSoil.style.width = `${Math.max(0, Math.min(100, state.soilQuality))}%`;
    }

    if (this.modeSelector && state.mode) {
      this.modeSelector.value = state.mode;
    }

    if (!this.panelRefs) return;

    this._renderPanelState(state);
    this._syncHarvestCard(state);
  }

  showToast(message, type = 'info', durationMs = 3800) {
    if (!this.toastContainer || !this.doc) return;

    const toast = this.doc.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, durationMs);
  }

  togglePanel() {
    this.isCollapsed = !this.isCollapsed;
    if (this.panelRefs?.panel) {
      this.panelRefs.panel.classList.toggle('collapsed', this.isCollapsed);
    }
    if (this.panelRefs?.toggleBtn) {
      this.panelRefs.toggleBtn.textContent = this.isCollapsed
        ? '🌾 Mostrar Panel Agrícola'
        : '🌾 Ocultar Panel Agrícola';
    }
  }

  openComparisonDemo() {
    if (!this.demoModal || !this.panelRefs?.demoGrid) return;
    const { results, disclaimer } = runModesComparisonDemo();
    const grid = this.panelRefs.demoGrid;
    grid.innerHTML = '';

    for (const item of results) {
      const col = this.doc.createElement('div');
      col.className = 'agro-demo-col';

      const title = this.doc.createElement('h3');
      title.textContent = item.modeName;
      col.appendChild(title);

      const rows = [
        ['Cultivo', item.plotUsed],
        ['Días simulados', `${item.daysSimulated} días`],
        ['Agua consumida', `${item.waterConsumedL} L`],
        ['Humedad final', `${item.finalMoisture}%`],
        ['Fertilidad final', `${item.finalFertility}%`],
        ['Salud cosecha', `${item.healthAtHarvest}%`],
        ['Producción', `${item.harvestKg} kg`],
        ['Calidad', item.qualityGrade],
        ['Ingresos', `$${item.earnings}`],
        ['Balance neto', `$${item.netProfit}`],
        ['Sostenibilidad', `${item.sustainabilityScore}/100`]
      ];

      for (const [k, v] of rows) {
        const row = this.doc.createElement('div');
        row.className = 'agro-demo-row';
        const spanK = this.doc.createElement('span');
        spanK.textContent = k;
        const spanV = this.doc.createElement('strong');
        spanV.textContent = v;
        row.appendChild(spanK);
        row.appendChild(spanV);
        col.appendChild(row);
      }

      const note = this.doc.createElement('p');
      note.className = 'agro-hud-disclaimer';
      note.textContent = item.keyMechanism;
      col.appendChild(note);

      const applyBtn = this.doc.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'agro-hud-action-btn primary';
      applyBtn.textContent = `Probar ${MODE_LABELS[item.mode] || item.mode}`;
      applyBtn.addEventListener('click', () => {
        this._handleModeSwitch(item.mode);
        this.closeComparisonDemo();
      });
      col.appendChild(applyBtn);

      grid.appendChild(col);
    }

    if (this.panelRefs.demoDisclaimer) {
      this.panelRefs.demoDisclaimer.textContent = disclaimer;
    }

    this.demoModal.classList.remove('hidden');
  }

  closeComparisonDemo() {
    if (this.demoModal) {
      this.demoModal.classList.add('hidden');
    }
  }

  destroy() {
    if (this.dockEl?.parentNode) this.dockEl.parentNode.removeChild(this.dockEl);
    if (this.harvestCardEl?.parentNode) this.harvestCardEl.parentNode.removeChild(this.harvestCardEl);
    if (this.demoModal?.parentNode) this.demoModal.parentNode.removeChild(this.demoModal);
    if (this.guideCardEl?.parentNode) this.guideCardEl.parentNode.removeChild(this.guideCardEl);
  }

  _setupHelpModal() {
    if (this.btnShowHelp) {
      this.btnShowHelp.addEventListener('click', () => {
        if (this.startOverlay) {
          this.startOverlay.classList.remove('hidden');
        }
      });
    }
    if (this.btnShowGuide) {
      this.btnShowGuide.addEventListener('click', () => {
        if (this.isChickenGuideOpen()) {
          this.closeChickenGuide({ relock: false });
        } else {
          this.openChickenGuide(0);
        }
      });
    }
  }

  _mountSimulationHud() {
    const d = this.doc;
    const host = this.container || d.getElementById('app') || d.body;
    if (!host) return;

    const dock = d.createElement('aside');
    dock.id = 'agro-sim-dock';
    dock.className = 'agro-hud-dock';

    const toggleBtn = d.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.id = 'agro-hud-toggle';
    toggleBtn.className = 'agro-hud-toggle';
    toggleBtn.textContent = this.isCollapsed
      ? '🌾 Mostrar Panel Agrícola'
      : '🌾 Ocultar Panel Agrícola';
    toggleBtn.addEventListener('click', () => this.togglePanel());
    dock.appendChild(toggleBtn);

    const panel = d.createElement('section');
    panel.id = 'agro-hud-panel';
    panel.className = `agro-hud-panel${this.isCollapsed ? ' collapsed' : ''}`;

    // 1. Encabezado de Modalidad y Botón Demo 3 Modos
    const header = d.createElement('div');
    header.className = 'agro-hud-header';
    const headerLeft = d.createElement('div');
    const title = d.createElement('div');
    title.className = 'agro-hud-title';
    title.textContent = '🌱 Simulación Agrícola';
    const modeBadge = d.createElement('span');
    modeBadge.id = 'agro-mode-badge';
    modeBadge.className = 'agro-hud-mode-badge mode-precision';
    modeBadge.textContent = 'Precisión IoT';
    headerLeft.appendChild(title);
    headerLeft.appendChild(modeBadge);

    const demoBtn = d.createElement('button');
    demoBtn.type = 'button';
    demoBtn.id = 'agro-btn-demo';
    demoBtn.className = 'agro-hud-demo-btn';
    demoBtn.textContent = '📊 Demo 3 Modos';
    demoBtn.addEventListener('click', () => this.openComparisonDemo());

    header.appendChild(headerLeft);
    header.appendChild(demoBtn);
    panel.appendChild(header);

    // 2. Selector rápido de modalidad
    const modePillsWrap = d.createElement('div');
    modePillsWrap.className = 'agro-hud-mode-pills';
    const modeButtons = {};
    for (const modeId of [
      SIMULATION_MODES.SUBSISTENCE,
      SIMULATION_MODES.PRECISION,
      SIMULATION_MODES.ECOLOGICAL
    ]) {
      const btn = d.createElement('button');
      btn.type = 'button';
      btn.className = 'agro-hud-mode-pill';
      btn.dataset.mode = modeId;
      btn.textContent = MODE_LABELS[modeId];
      btn.addEventListener('click', () => this._handleModeSwitch(modeId));
      modeButtons[modeId] = btn;
      modePillsWrap.appendChild(btn);
    }
    panel.appendChild(modePillsWrap);

    // 3. Selector de Parcelas
    const plotTabsWrap = d.createElement('div');
    plotTabsWrap.className = 'agro-hud-plot-tabs';
    const plotButtons = {};
    for (const [plotId, label] of [
      ['plot_1', 'Parcela 1'],
      ['plot_2', 'Parcela 2'],
      ['plot_3', 'Parcela 3']
    ]) {
      const btn = d.createElement('button');
      btn.type = 'button';
      btn.className = 'agro-hud-plot-tab';
      btn.dataset.plotId = plotId;
      btn.textContent = label;
      btn.addEventListener('click', () => this._executeAction('setActivePlot', plotId));
      plotButtons[plotId] = btn;
      plotTabsWrap.appendChild(btn);
    }
    panel.appendChild(plotTabsWrap);

    // 4. Tarjeta de Cultivo y Etapas (5 etapas de la Lechuga)
    const cropCard = d.createElement('div');
    cropCard.className = 'agro-hud-crop-card';

    const cropTop = d.createElement('div');
    cropTop.className = 'agro-hud-crop-top';
    const cropName = d.createElement('span');
    cropName.id = 'agro-crop-name';
    cropName.className = 'agro-hud-crop-name';
    cropName.textContent = 'Lechuga Tecnificada';
    const cropStage = d.createElement('span');
    cropStage.id = 'agro-crop-stage';
    cropStage.className = 'agro-hud-crop-stage';
    cropStage.textContent = 'Sin sembrar';
    cropTop.appendChild(cropName);
    cropTop.appendChild(cropStage);
    cropCard.appendChild(cropTop);

    const stepper = d.createElement('div');
    stepper.className = 'agro-hud-stepper';
    const stepNodes = [];
    for (const step of LIFECYCLE_STEPS) {
      const stepEl = d.createElement('div');
      stepEl.className = 'agro-hud-step';
      const bar = d.createElement('div');
      bar.className = 'agro-hud-step-bar';
      const lbl = d.createElement('span');
      lbl.className = 'agro-hud-step-label';
      lbl.textContent = step.label;
      stepEl.appendChild(bar);
      stepEl.appendChild(lbl);
      stepNodes.push({ key: step.key, el: stepEl });
      stepper.appendChild(stepEl);
    }
    cropCard.appendChild(stepper);

    const cropMeta = d.createElement('div');
    cropMeta.className = 'agro-hud-crop-meta';
    const cropDays = d.createElement('span');
    cropDays.id = 'agro-crop-days';
    cropDays.textContent = 'Ciclo: 0/2 días';
    const cropYield = d.createElement('span');
    cropYield.id = 'agro-crop-yield';
    cropYield.textContent = 'Est: 85 kg';
    cropMeta.appendChild(cropDays);
    cropMeta.appendChild(cropYield);
    cropCard.appendChild(cropMeta);

    panel.appendChild(cropCard);

    // 5. Barras de Humedad, Fertilidad y Salud
    const metrics = d.createElement('div');
    metrics.className = 'agro-hud-metrics';
    const moistureMetric = this._createMetricBar('Humedad del suelo', 'moisture');
    const fertilityMetric = this._createMetricBar('Fertilidad del suelo', 'fertility');
    const healthMetric = this._createMetricBar('Salud de la lechuga', 'health');
    metrics.appendChild(moistureMetric.row);
    metrics.appendChild(fertilityMetric.row);
    metrics.appendChild(healthMetric.row);
    panel.appendChild(metrics);

    // 6. Economía y Consumo Hídrico
    const econGrid = d.createElement('div');
    econGrid.className = 'agro-hud-econ-grid';
    const statDay = this._createStatBox('Día Virtual', 'Día 1');
    const statBudget = this._createStatBox('Presupuesto', '$1,400');
    const statWaterUsed = this._createStatBox('Consumo Agua', '0 L');
    const statBalance = this._createStatBox('Gastos / Neto', '$0 / $0');
    econGrid.appendChild(statDay.box);
    econGrid.appendChild(statBudget.box);
    econGrid.appendChild(statWaterUsed.box);
    econGrid.appendChild(statBalance.box);
    panel.appendChild(econGrid);

    // 7. Módulo Específico de Modalidad (Sensor IoT / Manual / Compost)
    const modeBox = d.createElement('div');
    modeBox.className = 'agro-hud-mode-box';
    const modeBoxHead = d.createElement('div');
    modeBoxHead.className = 'agro-hud-mode-box-title';
    const modeBoxTitle = d.createElement('span');
    modeBoxTitle.textContent = 'Sensor Virtual IoT';
    const autoBtn = d.createElement('button');
    autoBtn.type = 'button';
    autoBtn.id = 'agro-btn-auto-irrigate';
    autoBtn.className = 'agro-hud-switch-btn';
    autoBtn.textContent = 'Riego Auto: ON';
    autoBtn.addEventListener('click', () => {
      const next = !(this.lastState?.autoIrrigationEnabled);
      this._executeAction('setAutoIrrigation', next);
    });
    modeBoxHead.appendChild(modeBoxTitle);
    modeBoxHead.appendChild(autoBtn);

    const modeBoxText = d.createElement('div');
    modeBoxText.id = 'agro-mode-detail';
    modeBoxText.textContent = 'Lectura óptima de humedad.';

    modeBox.appendChild(modeBoxHead);
    modeBox.appendChild(modeBoxText);
    panel.appendChild(modeBox);

    // 8. Acciones Disponibles
    const actionsGrid = d.createElement('div');
    actionsGrid.className = 'agro-hud-actions';

    const btnPlant = this._createActionButton('agro-btn-plant', '🌱 Sembrar', () =>
      this._executeAction('plant', this._getSelectedPlotId())
    );
    const btnIrrigate = this._createActionButton('agro-btn-irrigate', '💧 Regar', () =>
      this._executeAction('irrigate', this._getSelectedPlotId())
    );
    const btnCompost = this._createActionButton('agro-btn-compost', '♻️ Compost', () =>
      this._executeAction('applyCompost', this._getSelectedPlotId())
    );
    const btnHarvest = this._createActionButton('agro-btn-harvest', '🌾 Cosechar', () =>
      this._executeAction('harvest', this._getSelectedPlotId())
    );
    const btnRefill = this._createActionButton('agro-btn-refill', '🛢️ +Agua', () =>
      this._executeAction('refillWater')
    );
    const btnAdvance = this._createActionButton(
      'agro-btn-advance',
      '⏩ Avanzar Día',
      () => this._handleAdvanceDay(),
      'primary'
    );

    actionsGrid.appendChild(btnPlant);
    actionsGrid.appendChild(btnIrrigate);
    actionsGrid.appendChild(btnCompost);
    actionsGrid.appendChild(btnHarvest);
    actionsGrid.appendChild(btnRefill);
    actionsGrid.appendChild(btnAdvance);
    panel.appendChild(actionsGrid);

    // 9. Telemetría recibida desde Three.js + Disclaimer educativo
    const threeBox = d.createElement('div');
    threeBox.className = 'agro-hud-three-box';
    const zoneLine = d.createElement('div');
    zoneLine.className = 'agro-hud-three-line';
    const zoneLbl = d.createElement('span');
    zoneLbl.textContent = 'Zona 3D:';
    const threeZone = d.createElement('strong');
    threeZone.id = 'agro-three-zone';
    threeZone.textContent = this.currentZone;
    zoneLine.appendChild(zoneLbl);
    zoneLine.appendChild(threeZone);

    const coordsLine = d.createElement('div');
    coordsLine.className = 'agro-hud-three-line';
    const coordsLbl = d.createElement('span');
    coordsLbl.textContent = 'Coords:';
    const threeCoords = d.createElement('span');
    threeCoords.id = 'agro-three-coords';
    threeCoords.textContent = 'X: 0.0 | Y: 0.0 | Z: 0.0';
    coordsLine.appendChild(coordsLbl);
    coordsLine.appendChild(threeCoords);

    const disclaimer = d.createElement('div');
    disclaimer.className = 'agro-hud-disclaimer';
    disclaimer.textContent = EDUCATIONAL_DISCLAIMER;

    threeBox.appendChild(zoneLine);
    threeBox.appendChild(coordsLine);
    threeBox.appendChild(disclaimer);
    panel.appendChild(threeBox);

    dock.appendChild(panel);
    host.appendChild(dock);

    // Tarjeta flotante de resultado educativo de cosecha
    const harvestCard = d.createElement('section');
    harvestCard.id = 'agro-harvest-card';
    harvestCard.className = 'agro-harvest-card hidden';

    const hHead = d.createElement('div');
    hHead.className = 'agro-harvest-head';
    const hTitle = d.createElement('div');
    hTitle.className = 'agro-harvest-title';
    hTitle.textContent = '🌾 Resultado de Cosecha';
    const hClose = d.createElement('button');
    hClose.type = 'button';
    hClose.className = 'agro-close-btn';
    hClose.textContent = '×';
    hClose.addEventListener('click', () => harvestCard.classList.add('hidden'));
    hHead.appendChild(hTitle);
    hHead.appendChild(hClose);

    const hMetrics = d.createElement('div');
    hMetrics.className = 'agro-harvest-metrics';
    const hFeedback = d.createElement('ul');
    hFeedback.className = 'agro-harvest-feedback';
    const hDisclaimer = d.createElement('div');
    hDisclaimer.className = 'agro-hud-disclaimer';
    hDisclaimer.textContent = EDUCATIONAL_DISCLAIMER;

    harvestCard.appendChild(hHead);
    harvestCard.appendChild(hMetrics);
    harvestCard.appendChild(hFeedback);
    harvestCard.appendChild(hDisclaimer);
    host.appendChild(harvestCard);

    // Modal de Demostración Comparativa de los 3 Modos
    const demoModal = d.createElement('div');
    demoModal.id = 'agro-demo-modal';
    demoModal.className = 'agro-demo-modal hidden';
    const demoDialog = d.createElement('div');
    demoDialog.className = 'agro-demo-dialog';

    const demoHead = d.createElement('div');
    demoHead.className = 'agro-harvest-head';
    const demoTitle = d.createElement('h2');
    demoTitle.textContent = '📊 Demostración Comparativa: 3 Enfoques Agrícolas';
    demoTitle.style.fontSize = '1.05rem';
    const demoClose = d.createElement('button');
    demoClose.type = 'button';
    demoClose.className = 'agro-close-btn';
    demoClose.textContent = '×';
    demoClose.addEventListener('click', () => this.closeComparisonDemo());
    demoHead.appendChild(demoTitle);
    demoHead.appendChild(demoClose);

    const demoGrid = d.createElement('div');
    demoGrid.className = 'agro-demo-grid';
    const demoDisclaimer = d.createElement('div');
    demoDisclaimer.className = 'agro-hud-disclaimer';
    demoDisclaimer.textContent = EDUCATIONAL_DISCLAIMER;

    demoDialog.appendChild(demoHead);
    demoDialog.appendChild(demoGrid);
    demoDialog.appendChild(demoDisclaimer);
    demoModal.appendChild(demoDialog);
    demoModal.addEventListener('click', (e) => {
      if (e.target === demoModal) this.closeComparisonDemo();
    });
    host.appendChild(demoModal);

    this.dockEl = dock;
    this.harvestCardEl = harvestCard;
    this.demoModal = demoModal;
    this._mountChickenGuide(host);

    this.panelRefs = {
      toggleBtn,
      panel,
      modeBadge,
      modeButtons,
      plotButtons,
      cropName,
      cropStage,
      stepNodes,
      cropDays,
      cropYield,
      moistureMetric,
      fertilityMetric,
      healthMetric,
      statDay,
      statBudget,
      statWaterUsed,
      statBalance,
      modeBoxTitle,
      autoBtn,
      modeBoxText,
      btnPlant,
      btnIrrigate,
      btnCompost,
      btnHarvest,
      btnRefill,
      btnAdvance,
      threeZone,
      threeCoords,
      hMetrics,
      hFeedback,
      demoGrid,
      demoDisclaimer
    };
  }

  _mountChickenGuide(host) {
    const d = this.doc;
    const card = d.createElement('section');
    card.id = 'agro-guide-card';
    card.className = 'agro-guide-card hidden';

    const head = d.createElement('div');
    head.className = 'agro-guide-head';

    const speaker = d.createElement('div');
    speaker.className = 'agro-guide-speaker';
    const speakerName = d.createElement('span');
    speakerName.textContent = '🐔 Rudy — Gallina Guía';
    const badge = d.createElement('span');
    badge.id = 'agro-guide-badge';
    badge.className = 'agro-guide-badge';
    badge.textContent = '1 / 5';
    speaker.appendChild(speakerName);
    speaker.appendChild(badge);

    const closeBtn = d.createElement('button');
    closeBtn.type = 'button';
    closeBtn.id = 'agro-guide-close';
    closeBtn.className = 'agro-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.closeChickenGuide({ relock: true }));

    head.appendChild(speaker);
    head.appendChild(closeBtn);

    const title = d.createElement('h3');
    title.id = 'agro-guide-title';
    title.className = 'agro-guide-title';

    const body = d.createElement('p');
    body.id = 'agro-guide-body';
    body.className = 'agro-guide-body';

    const tips = d.createElement('ul');
    tips.id = 'agro-guide-tips';
    tips.className = 'agro-guide-tips';

    const actions = d.createElement('div');
    actions.className = 'agro-guide-actions';

    const voiceBtn = d.createElement('button');
    voiceBtn.type = 'button';
    voiceBtn.id = 'agro-guide-voice';
    voiceBtn.className = 'agro-guide-btn voice-active';
    voiceBtn.textContent = '🔊 Voz: ON';
    voiceBtn.addEventListener('click', () => this.toggleChickenVoice());

    const nav = d.createElement('div');
    nav.className = 'agro-guide-nav';

    const prevBtn = d.createElement('button');
    prevBtn.type = 'button';
    prevBtn.id = 'agro-guide-prev';
    prevBtn.className = 'agro-guide-btn';
    prevBtn.textContent = '◀ Anterior';
    prevBtn.addEventListener('click', () => this.prevChickenGuideStep());

    const nextBtn = d.createElement('button');
    nextBtn.type = 'button';
    nextBtn.id = 'agro-guide-next';
    nextBtn.className = 'agro-guide-btn primary';
    nextBtn.textContent = 'Siguiente ▶';
    nextBtn.addEventListener('click', () => this.nextChickenGuideStep({ closeAtEnd: true, relock: true }));

    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    actions.appendChild(voiceBtn);
    actions.appendChild(nav);

    const hint = d.createElement('div');
    hint.className = 'agro-guide-hint';
    const hintLeft = d.createElement('span');
    hintLeft.textContent = 'Presiona E cerca de Rudy para avanzar';
    const hintRight = d.createElement('span');
    hintRight.textContent = 'ESC para cerrar';
    hint.appendChild(hintLeft);
    hint.appendChild(hintRight);

    card.appendChild(head);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(tips);
    card.appendChild(actions);
    card.appendChild(hint);
    host.appendChild(card);

    this.guideCardEl = card;
    this.guideRefs = {
      badge,
      title,
      body,
      tips,
      voiceBtn,
      prevBtn,
      nextBtn
    };
    this._renderChickenGuideStep();
  }

  isChickenGuideOpen() {
    return Boolean(this.guideCardEl && !this.guideCardEl.classList.contains('hidden'));
  }

  openChickenGuide(stepIndex = 0, options = {}) {
    if (!this.guideCardEl) return null;
    const total = this.chickenGuideSteps.length;
    this.chickenGuideIndex = Math.max(0, Math.min(total - 1, stepIndex));
    this.guideCardEl.classList.remove('hidden');
    if (this.interactionPrompt) {
      this.interactionPrompt.classList.add('hidden');
    }
    const step = this._renderChickenGuideStep();
    if (!options.silent && typeof this.onChickenGuideStepChange === 'function') {
      this.onChickenGuideStepChange(step, this.chickenGuideIndex, total, this.chickenVoiceEnabled);
    }
    return step;
  }

  nextChickenGuideStep(options = {}) {
    const total = this.chickenGuideSteps.length;
    if (this.chickenGuideIndex + 1 >= total) {
      if (options.closeAtEnd !== false) {
        this.closeChickenGuide({ relock: options.relock });
        return null;
      }
      this.chickenGuideIndex = 0;
    } else {
      this.chickenGuideIndex += 1;
    }
    const step = this._renderChickenGuideStep();
    if (!options.silent && typeof this.onChickenGuideStepChange === 'function') {
      this.onChickenGuideStepChange(step, this.chickenGuideIndex, total, this.chickenVoiceEnabled);
    }
    return step;
  }

  prevChickenGuideStep(options = {}) {
    const total = this.chickenGuideSteps.length;
    this.chickenGuideIndex = Math.max(0, this.chickenGuideIndex - 1);
    const step = this._renderChickenGuideStep();
    if (!options.silent && typeof this.onChickenGuideStepChange === 'function') {
      this.onChickenGuideStepChange(step, this.chickenGuideIndex, total, this.chickenVoiceEnabled);
    }
    return step;
  }

  closeChickenGuide(options = {}) {
    if (this.guideCardEl) {
      this.guideCardEl.classList.add('hidden');
    }
    if (typeof this.onChickenGuideClose === 'function') {
      this.onChickenGuideClose(options);
    }
  }

  toggleChickenVoice() {
    this.chickenVoiceEnabled = !this.chickenVoiceEnabled;
    if (this.guideRefs?.voiceBtn) {
      this.guideRefs.voiceBtn.textContent = this.chickenVoiceEnabled ? '🔊 Voz: ON' : '🔇 Voz: OFF';
      this.guideRefs.voiceBtn.classList.toggle('voice-active', this.chickenVoiceEnabled);
    }
    const step = this.chickenGuideSteps[this.chickenGuideIndex];
    if (typeof this.onChickenVoiceToggle === 'function') {
      this.onChickenVoiceToggle(this.chickenVoiceEnabled, step);
    }
    return this.chickenVoiceEnabled;
  }

  _renderChickenGuideStep() {
    const total = this.chickenGuideSteps.length;
    const step = this.chickenGuideSteps[this.chickenGuideIndex] || this.chickenGuideSteps[0];
    if (!this.guideRefs || !step) return step;

    const { badge, title, body, tips, voiceBtn, prevBtn, nextBtn } = this.guideRefs;
    badge.textContent = `${step.badge} (${this.chickenGuideIndex + 1}/${total})`;
    title.textContent = step.title;
    body.textContent = step.body;

    tips.innerHTML = '';
    for (const tipText of step.tips || []) {
      const li = this.doc.createElement('li');
      li.textContent = tipText;
      tips.appendChild(li);
    }

    voiceBtn.textContent = this.chickenVoiceEnabled ? '🔊 Voz: ON' : '🔇 Voz: OFF';
    voiceBtn.classList.toggle('voice-active', this.chickenVoiceEnabled);

    prevBtn.disabled = this.chickenGuideIndex === 0;
    const isLast = this.chickenGuideIndex >= total - 1;
    nextBtn.textContent = isLast ? '¡A jugar! 🚜' : 'Siguiente ▶';
    return step;
  }

  _createMetricBar(labelText, fillClass) {
    const d = this.doc;
    const row = d.createElement('div');
    row.className = 'agro-hud-metric-row';
    const head = d.createElement('div');
    head.className = 'agro-hud-metric-head';
    const label = d.createElement('span');
    label.className = 'agro-hud-metric-label';
    label.textContent = labelText;
    const val = d.createElement('span');
    val.className = 'agro-hud-metric-val';
    val.textContent = '0%';
    head.appendChild(label);
    head.appendChild(val);

    const track = d.createElement('div');
    track.className = 'agro-hud-bar-track';
    const fill = d.createElement('div');
    fill.className = `agro-hud-bar-fill ${fillClass}`;
    fill.style.width = '0%';
    track.appendChild(fill);

    row.appendChild(head);
    row.appendChild(track);
    return { row, val, fill, baseClass: fillClass };
  }

  _createStatBox(keyText, initialVal) {
    const d = this.doc;
    const box = d.createElement('div');
    box.className = 'agro-hud-stat-box';
    const k = d.createElement('div');
    k.className = 'agro-hud-stat-k';
    k.textContent = keyText;
    const v = d.createElement('div');
    v.className = 'agro-hud-stat-v';
    v.textContent = initialVal;
    box.appendChild(k);
    box.appendChild(v);
    return { box, val: v };
  }

  _createActionButton(id, text, handler, variant = '') {
    const btn = this.doc.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.className = `agro-hud-action-btn${variant ? ` ${variant}` : ''}`;
    btn.textContent = text;
    btn.addEventListener('click', handler);
    return btn;
  }

  _renderPanelState(state) {
    const refs = this.panelRefs;
    const activePlot =
      state.plots?.[state.activePlotId] || Object.values(state.plots || {})[0];
    if (!activePlot) return;

    // Modalidad y botones de modalidad
    refs.modeBadge.className = `agro-hud-mode-badge mode-${state.mode}`;
    refs.modeBadge.textContent = state.modeBadge || MODE_LABELS[state.mode] || state.mode;

    for (const [modeId, btn] of Object.entries(refs.modeButtons)) {
      btn.classList.toggle('active', modeId === state.mode);
    }

    for (const [plotId, btn] of Object.entries(refs.plotButtons)) {
      btn.classList.toggle('active', plotId === activePlot.id);
    }

    // Cultivo y etapas
    refs.cropName.textContent = `${activePlot.cropName} (${activePlot.id.replace('plot_', 'P')})`;
    refs.cropStage.textContent = activePlot.stageLabel || 'Sin sembrar';
    refs.cropStage.className = 'agro-hud-crop-stage';
    if (activePlot.isWithered) {
      refs.cropStage.classList.add('withered');
    } else if (activePlot.daysGrown >= activePlot.daysToMature && activePlot.isPlanted) {
      refs.cropStage.classList.add('mature');
    }

    const justHarvestedHere =
      Boolean(state.lastHarvest) &&
      state.lastHarvest.plotId === activePlot.id &&
      state.lastHarvest.dayHarvested === state.day &&
      !activePlot.isPlanted;

    const currentStageIndex = justHarvestedHere ? 4 : activePlot.stageIndex || 0;
    refs.stepNodes.forEach(({ el }, idx) => {
      el.classList.toggle('done', idx < currentStageIndex);
      el.classList.toggle('current', idx === currentStageIndex);
    });

    refs.cropDays.textContent = activePlot.isPlanted
      ? `Ciclo: ${activePlot.daysGrown}/${activePlot.daysToMature} días`
      : `Madurez: ${activePlot.daysToMature} días`;
    refs.cropYield.textContent = `Est: ${activePlot.yieldKg} kg`;

    // Barras de Humedad, Fertilidad y Salud
    this._updateBar(refs.moistureMetric, activePlot.moisture, 25, 45);
    this._updateBar(refs.fertilityMetric, activePlot.fertility, 40, 65);
    this._updateBar(refs.healthMetric, activePlot.health, 35, 65);

    // Economía y agua
    refs.statDay.val.textContent = `Día ${state.day}`;
    refs.statBudget.val.textContent = `$${state.budget.toLocaleString()}`;
    refs.statWaterUsed.val.textContent = `${state.waterConsumed ?? 0} L`;
    const expenses = state.economy?.totalExpenses ?? 0;
    const net = state.economy?.netProfit ?? 0;
    refs.statBalance.val.textContent = `-$${expenses} / ${net >= 0 ? '+' : ''}$${net}`;

    // Panel específico de modalidad
    this._renderModeDetailBox(state, activePlot);

    // Disponibilidad de acciones
    const avail = state.availableActions || {};
    refs.btnPlant.disabled = !avail.canPlant;
    refs.btnPlant.textContent = `🌱 Sembrar ($${state.seedCost ?? 35})`;

    refs.btnIrrigate.disabled = !avail.canIrrigate;
    refs.btnIrrigate.textContent = `💧 Regar (-${state.waterConsumptionPerIrrigation ?? 80}L)`;

    refs.btnCompost.disabled = !avail.canCompost;
    refs.btnCompost.textContent =
      state.compostCost > 0 ? `♻️ Compost ($${state.compostCost})` : '♻️ Compost (Gratis)';

    refs.btnHarvest.disabled = !avail.canHarvest;
    refs.btnHarvest.textContent = activePlot.isWithered ? '🧹 Limpiar' : '🌾 Cosechar';

    refs.btnRefill.disabled = !avail.canRefillWater;
  }

  _updateBar(metricRef, rawVal, dangerThreshold, warnThreshold) {
    const val = Math.max(0, Math.min(100, Math.round(rawVal ?? 0)));
    metricRef.val.textContent = `${val}%`;
    metricRef.fill.style.width = `${val}%`;

    let levelClass = metricRef.baseClass;
    if (val < dangerThreshold) {
      levelClass = 'danger';
    } else if (val < warnThreshold) {
      levelClass = 'warn';
    }
    metricRef.fill.className = `agro-hud-bar-fill ${levelClass}`;
  }

  _renderModeDetailBox(state, activePlot) {
    const refs = this.panelRefs;
    const reading = state.sensor?.readings?.[activePlot.id];

    if (state.mode === SIMULATION_MODES.PRECISION) {
      refs.modeBoxTitle.textContent = '📡 Sensor Virtual IoT';
      refs.autoBtn.style.display = 'inline-block';
      refs.autoBtn.textContent = state.autoIrrigationEnabled
        ? 'Riego Auto: ON'
        : 'Riego Auto: OFF';
      refs.autoBtn.classList.toggle('off', !state.autoIrrigationEnabled);

      const statusText = reading
        ? `${reading.statusLabel} (${reading.moisture}%). ${reading.recommendation}`
        : 'Sensor listo.';
      const autoLog = state.sensor?.lastAutoAction ? ` · ${state.sensor.lastAutoAction}` : '';
      refs.modeBoxText.textContent = `${statusText}${autoLog}`;
    } else if (state.mode === SIMULATION_MODES.ECOLOGICAL) {
      refs.modeBoxTitle.textContent = '♻️ Compostaje y Conservación';
      refs.autoBtn.style.display = 'none';
      const evap = state.evaporationRate ?? 11;
      const compostState = activePlot.composted
        ? `Cobertura orgánica activa (evap. ${evap}%/día, prima +25%).`
        : `Sin compost aplicado aún (evap. ${evap}%/día). Aplica compost gratis.`;
      refs.modeBoxText.textContent = `${compostState} Aplicaciones: ${state.compostApplications ?? 0}.`;
    } else {
      refs.modeBoxTitle.textContent = '🪣 Riego Manual (Subsistencia)';
      refs.autoBtn.style.display = 'none';
      refs.modeBoxText.textContent =
        `Consumo alto (${state.waterConsumptionPerIrrigation} L/riego) y evaporación ${state.evaporationRate ?? 20}%/día. Controla reserva (${state.waterReserve} L).`;
    }
  }

  _syncHarvestCard(state) {
    if (!this.harvestCardEl || !this.panelRefs) return;

    const report = state.lastHarvest;
    if (!report) {
      this._lastDisplayedHarvestId = null;
      this.harvestCardEl.classList.add('hidden');
      return;
    }

    if (report.id === this._lastDisplayedHarvestId) return;
    this._lastDisplayedHarvestId = report.id;

    const { hMetrics, hFeedback } = this.panelRefs;
    hMetrics.innerHTML = '';
    hFeedback.innerHTML = '';

    const summaryPairs = [
      ['Cultivo', report.cropName],
      ['Calidad', report.qualityGrade],
      ['Cosechado', `${report.harvestKg} kg`],
      ['Ingreso', `+$${report.earnings}`],
      ['Eficiencia agua', `${report.waterEfficiencyKgPer100L} kg/100L`],
      ['Sostenibilidad', `${report.sustainabilityScore}/100`]
    ];

    for (const [k, v] of summaryPairs) {
      const box = this._createStatBox(k, v);
      hMetrics.appendChild(box.box);
    }

    for (const tip of report.feedback || []) {
      const li = this.doc.createElement('li');
      li.textContent = tip;
      hFeedback.appendChild(li);
    }

    this.harvestCardEl.classList.remove('hidden');
  }

  _getSelectedPlotId() {
    return this.lastState?.activePlotId || 'plot_2';
  }

  _detectPlotIdFromZone(zoneText) {
    const normalized = zoneText.toLowerCase();
    if (normalized.includes('parcela 1') || normalized.includes('subsistencia')) return 'plot_1';
    if (normalized.includes('parcela 2') || normalized.includes('precisión') || normalized.includes('precision')) {
      return 'plot_2';
    }
    if (normalized.includes('parcela 3') || normalized.includes('ecológica') || normalized.includes('ecologica')) {
      return 'plot_3';
    }
    return null;
  }

  async _handleModeSwitch(mode) {
    if (this.actionHandlers?.initializeFarm) {
      await this.actionHandlers.initializeFarm(mode);
      return;
    }
    if (this.adapter) {
      await this.adapter.initializeFarm(mode);
      this.showToast(`Modo cambiado a: ${MODE_LABELS[mode] || mode}`, 'info');
      return;
    }
    if (this.modeSelector) {
      this.modeSelector.value = mode;
      const EventCtor = typeof Event !== 'undefined' ? Event : null;
      if (EventCtor && typeof this.modeSelector.dispatchEvent === 'function') {
        this.modeSelector.dispatchEvent(new EventCtor('change'));
        return;
      }
    }
    const state = initializeFarm(mode);
    this.updateFarmState(state);
    this.showToast(`Modo cambiado a: ${MODE_LABELS[mode] || mode}`, 'info');
  }

  async _handleAdvanceDay() {
    if (this.actionHandlers?.advanceDay) {
      await this.actionHandlers.advanceDay();
      return;
    }
    if (this.adapter) {
      const res = await this.adapter.advanceDay();
      if (res?.message) {
        this.showToast(res.message, 'info');
      }
      return;
    }
    if (this.btnAdvanceDay && typeof this.btnAdvanceDay.click === 'function') {
      this.btnAdvanceDay.click();
      return;
    }
    const res = advanceDay();
    if (res?.state) this.updateFarmState(res.state);
    if (res?.message) this.showToast(res.message, 'info');
  }

  async _executeAction(actionName, arg) {
    if (this.actionHandlers && typeof this.actionHandlers[actionName] === 'function') {
      return this.actionHandlers[actionName](arg);
    }

    if (this.adapter && typeof this.adapter[actionName] === 'function') {
      const res = await this.adapter[actionName](arg);
      if (res?.message) {
        this.showToast(res.message, res.success === false ? 'warning' : 'success');
      }
      return res;
    }

    const fallbackFns = {
      plant,
      irrigate,
      harvest,
      applyCompost,
      setAutoIrrigation,
      refillWater,
      setActivePlot
    };

    const fn = fallbackFns[actionName] || getActiveSimulation()?.[actionName];
    if (typeof fn !== 'function') return null;

    const res = fn(arg);
    if (res?.state) {
      this.updateFarmState(res.state);
    }
    if (res?.message) {
      this.showToast(res.message, res.success === false ? 'warning' : 'success');
    }
    return res;
  }
}
