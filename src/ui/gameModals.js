import { buildRunResult } from '../gameplay/resultsStore.js';
import { formatCOP } from '../simulation/constants.js';

/**
 * Controlador de pantallas y modales principales del juego:
 * Bienvenida + selección de modalidad, Cómo jugar (H), Acerca del proyecto,
 * Pausa (ESC), Ajustes de audio/calidad y Pantalla de Resultados + Comparativa real.
 */
export class GameModalsController {
  constructor({
    renderer,
    audioSystem,
    player,
    farmAdapter,
    missionManager,
    resultsStore,
    hud,
    onModeStarted
  }) {
    this.renderer = renderer;
    this.audioSystem = audioSystem;
    this.player = player;
    this.farmAdapter = farmAdapter;
    this.missionManager = missionManager;
    this.resultsStore = resultsStore;
    this.hud = hud;
    this.onModeStarted = onModeStarted;

    this.selectedMode = 'precision';
    this.isPaused = false;
    this.decisions = [];
    this.pendingWarehouseDelivery = false;
    this.lastRunResult = null;

    this._bindElements();
    this._bindEvents();
  }

  recordDecision(label) {
    if (!label) return;
    this.decisions.push(label);
    if (this.decisions.length > 25) this.decisions.shift();
  }

  _bindElements() {
    const g = (id) => document.getElementById(id);
    this.startOverlay = g('start-overlay');
    this.helpModal = g('help-modal');
    this.aboutModal = g('about-modal');
    this.pauseModal = g('pause-modal');
    this.resultsModal = g('results-modal');

    this.settingVolume = g('setting-volume');
    this.settingVolumeVal = g('setting-volume-val');
    this.settingQuality = g('setting-quality');
    this.pauseVolume = g('pause-volume');
    this.pauseVolumeVal = g('pause-volume-val');
    this.pauseQuality = g('pause-quality');

    this.resultsSummaryGrid = g('results-summary-grid');
    this.resultsDecisionsBox = g('results-decisions-box');
    this.resultsEduNote = g('results-edu-note');
    this.resultsComparisonWrap = g('results-comparison-wrap');
    this.resultsDisclaimer = g('results-disclaimer');
  }

  _bindEvents() {
    // Selección de tarjetas de modalidad
    const modeCards = document.querySelectorAll('.mode-card[data-mode]');
    modeCards.forEach((card) => {
      card.addEventListener('click', (e) => {
        const mode = card.dataset.mode;
        this._highlightMode(mode);
        if (e.target.closest('.btn-mode-start')) {
          this.startNewGame(mode);
        }
      });
    });

    const startButtons = document.querySelectorAll('[data-start-mode]');
    startButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startNewGame(btn.dataset.startMode);
      });
    });

    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.startNewGame(this.selectedMode);
    });

    // Navegación desde bienvenida y HUD
    document.getElementById('btn-menu-how-to')?.addEventListener('click', () => this.openHelp());
    document.getElementById('btn-menu-about')?.addEventListener('click', () => this.openAbout());
    document.getElementById('btn-close-help')?.addEventListener('click', () => this.closeHelp());
    document.getElementById('btn-close-about')?.addEventListener('click', () => this.closeAbout());
    document.getElementById('btn-show-help')?.addEventListener('click', () => this.openHelp());

    // Pausa
    document.getElementById('btn-pause-game')?.addEventListener('click', () => this.togglePause());
    document.getElementById('btn-close-pause')?.addEventListener('click', () => this.setPaused(false));
    document.getElementById('btn-resume-game')?.addEventListener('click', () => this.setPaused(false));
    document.getElementById('btn-restart-mode')?.addEventListener('click', async () => {
      this.setPaused(false, { relock: false });
      await this.startNewGame(this.selectedMode);
    });
    document.getElementById('btn-back-menu')?.addEventListener('click', () => {
      this.setPaused(false, { relock: false });
      this.openMainMenu();
    });

    // Resultados
    document.getElementById('btn-show-results')?.addEventListener('click', () => this.showResults());
    document.getElementById('btn-close-results')?.addEventListener('click', () => this.closeResults());
    document.getElementById('btn-results-continue')?.addEventListener('click', () => this.closeResults());
    document.getElementById('btn-results-retry')?.addEventListener('click', async () => {
      this.closeResults({ relock: false });
      await this.startNewGame(this.selectedMode);
    });
    document.getElementById('btn-results-switch')?.addEventListener('click', () => {
      this.closeResults({ relock: false });
      this.openMainMenu();
    });

    // Volumen y Calidad gráfica sincronizados entre menú y pausa
    const syncVolume = (raw) => {
      const pct = Math.max(0, Math.min(100, Number(raw)));
      this.audioSystem?.setMasterVolume(pct / 100);
      if (this.settingVolume) this.settingVolume.value = String(pct);
      if (this.pauseVolume) this.pauseVolume.value = String(pct);
      if (this.settingVolumeVal) this.settingVolumeVal.textContent = `${pct}%`;
      if (this.pauseVolumeVal) this.pauseVolumeVal.textContent = `${pct}%`;
    };
    this.settingVolume?.addEventListener('input', (e) => syncVolume(e.target.value));
    this.pauseVolume?.addEventListener('input', (e) => syncVolume(e.target.value));

    const applyQuality = (q) => {
      if (this.settingQuality) this.settingQuality.value = q;
      if (this.pauseQuality) this.pauseQuality.value = q;
      if (!this.renderer) return;
      if (q === 'low') {
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
      } else if (q === 'high') {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        this.renderer.shadowMap.enabled = true;
      } else {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        this.renderer.shadowMap.enabled = true;
      }
      this.hud?.showToast(`Calidad gráfica: ${q.toUpperCase()}`, 'info', 1800);
    };
    this.settingQuality?.addEventListener('change', (e) => applyQuality(e.target.value));
    this.pauseQuality?.addEventListener('change', (e) => applyQuality(e.target.value));

    // Atajos globales: H (Ayuda) y ESC (Pausa / cerrar modales)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyH') {
        if (this.helpModal?.classList.contains('hidden')) this.openHelp();
        else this.closeHelp();
      } else if (e.code === 'Escape') {
        if (this.helpModal && !this.helpModal.classList.contains('hidden')) {
          this.closeHelp();
        } else if (this.aboutModal && !this.aboutModal.classList.contains('hidden')) {
          this.closeAbout();
        } else if (this.resultsModal && !this.resultsModal.classList.contains('hidden')) {
          this.closeResults();
        } else if (this.startOverlay && this.startOverlay.classList.contains('hidden')) {
          this.togglePause();
        }
      }
    });
  }

  _highlightMode(mode) {
    this.selectedMode = mode;
    document.querySelectorAll('.mode-card[data-mode]').forEach((c) => {
      c.classList.toggle('active', c.dataset.mode === mode);
    });
  }

  async startNewGame(mode) {
    this._highlightMode(mode);
    this.decisions = [`Inicio en modalidad ${mode}`];
    this.pendingWarehouseDelivery = false;
    this.lastRunResult = null;
    this.farmAdapter.setRequirePreparation(true);
    const state = await this.farmAdapter.initializeFarm(mode);
    this.missionManager.reset(mode);
    this.hud.renderMission(this.missionManager.getSnapshot(), 'Estado cosecha: En desarrollo');
    this.hud.updateFarmState(state);

    if (this.startOverlay) this.startOverlay.classList.add('hidden');
    this.audioSystem?.unlockAudio();
    this.audioSystem?.startAmbientMusic();
    this.audioSystem?.startAmbient();
    this.player?.requestLock();
    if (this.onModeStarted) this.onModeStarted(mode, state);
  }

  openMainMenu() {
    this.player?.unlock();
    if (this.startOverlay) this.startOverlay.classList.remove('hidden');
  }

  openHelp() {
    this.player?.unlock();
    this.helpModal?.classList.remove('hidden');
  }

  _relockIfPlaying() {
    const inGame =
      !this.isPaused &&
      (!this.startOverlay || this.startOverlay.classList.contains('hidden')) &&
      (!this.helpModal || this.helpModal.classList.contains('hidden')) &&
      (!this.aboutModal || this.aboutModal.classList.contains('hidden')) &&
      (!this.resultsModal || this.resultsModal.classList.contains('hidden'));
    if (inGame && this.player?.cameraMode === 'third-person') {
      this.player.requestLock();
    }
  }

  closeHelp() {
    this.helpModal?.classList.add('hidden');
    this._relockIfPlaying();
  }

  openAbout() {
    this.player?.unlock();
    this.aboutModal?.classList.remove('hidden');
  }

  closeAbout() {
    this.aboutModal?.classList.add('hidden');
    this._relockIfPlaying();
  }

  togglePause() {
    this.setPaused(!this.isPaused);
  }

  setPaused(paused, { relock = true } = {}) {
    this.isPaused = Boolean(paused);
    if (this.isPaused) {
      this.player?.unlock();
      this.pauseModal?.classList.remove('hidden');
    } else {
      this.pauseModal?.classList.add('hidden');
      if (relock) this._relockIfPlaying();
    }
  }

  recordHarvest(state, report) {
    const run = buildRunResult(state, report, this.decisions);
    this.lastRunResult = this.resultsStore.add(run);
    this.pendingWarehouseDelivery = Boolean(report && report.harvestKg > 0);
  }

  async showResults() {
    this.player?.unlock();
    const state = await this.farmAdapter.getState();
    const run =
      this.lastRunResult ||
      buildRunResult(state, state.lastHarvest, this.decisions);

    this.missionManager.handleEvent({ type: 'resultsViewed' });
    this.hud.renderMission(
      this.missionManager.getSnapshot(),
      this.pendingWarehouseDelivery
        ? 'Estado cosecha: Lista para entregar en almacén'
        : run.harvestKg > 0
          ? 'Estado cosecha: Completada y consultada'
          : 'Estado cosecha: En desarrollo'
    );

    if (this.resultsSummaryGrid) {
      this.resultsSummaryGrid.innerHTML = '';
      const metrics = [
        ['Modalidad', run.modeLabel],
        ['Días transcurridos', `${run.days} días`],
        ['Agua consumida', `${run.waterConsumed} L`],
        ['Gastos / Neto', `${formatCOP(run.expenses)} / ${formatCOP(run.netProfit, { withCurrency: true, showPlus: true })}`],
        ['Salud del suelo', `${run.soilQuality}%`],
        ['Humedad final', `${run.finalMoisture}%`],
        ['Salud del cultivo', `${run.cropHealth}%`],
        ['Producción simulada', `${run.harvestKg} kg`]
      ];
      for (const [k, v] of metrics) {
        const card = document.createElement('div');
        card.className = 'results-stat';
        const ke = document.createElement('div');
        ke.className = 'results-stat-k';
        ke.textContent = k;
        const ve = document.createElement('div');
        ve.className = 'results-stat-v';
        ve.textContent = v;
        card.appendChild(ke);
        card.appendChild(ve);
        this.resultsSummaryGrid.appendChild(card);
      }
    }

    if (this.resultsDecisionsBox) {
      this.resultsDecisionsBox.innerHTML = '';
      const title = document.createElement('strong');
      title.textContent = 'Resumen de decisiones registradas:';
      const ul = document.createElement('ul');
      const list = run.decisions.length > 0 ? run.decisions : ['Sin acciones registradas aún.'];
      for (const item of list.slice(-10)) {
        const li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
      }
      this.resultsDecisionsBox.appendChild(title);
      this.resultsDecisionsBox.appendChild(ul);
    }

    if (this.resultsEduNote) this.resultsEduNote.textContent = run.note;
    if (this.resultsDisclaimer) this.resultsDisclaimer.textContent = run.disclaimer;

    if (this.resultsComparisonWrap) {
      const comp = this.resultsStore.getComparison();
      this.resultsComparisonWrap.innerHTML = '';
      if (comp.length > 0) {
        const h = document.createElement('strong');
        h.textContent = 'Comparativa real entre modalidades jugadas:';
        const tbl = document.createElement('table');
        tbl.innerHTML = `<thead><tr><th>Modalidad</th><th>Días</th><th>Agua</th><th>Suelo</th><th>Producción</th><th>Neto</th></tr></thead>`;
        const tbody = document.createElement('tbody');
        for (const r of comp) {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${r.modeLabel}</td><td>${r.days}</td><td>${r.waterConsumed} L</td><td>${r.soilQuality}%</td><td>${r.harvestKg} kg</td><td>${formatCOP(r.netProfit, { withCurrency: true, showPlus: true })}</td>`;
          tbody.appendChild(tr);
        }
        tbl.appendChild(tbody);
        this.resultsComparisonWrap.appendChild(h);
        this.resultsComparisonWrap.appendChild(tbl);
      }
    }

    this.resultsModal?.classList.remove('hidden');
  }

  closeResults({ relock = true } = {}) {
    this.resultsModal?.classList.add('hidden');
    if (relock) this._relockIfPlaying();
  }
}
