import { buildRunResult } from '../gameplay/resultsStore.js';
import { formatCOP } from '../simulation/constants.js';
import { withRestTransition } from './restTransition.js';
import { outsideInteraction } from '../gameplay/farmNeeds.js';

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
    this.warehouseModal = g('warehouse-store-modal');
    this.houseModal = g('farmer-house-modal');

    this.settingVolume = g('setting-volume');
    this.settingVolumeVal = g('setting-volume-val');
    this.settingMusic = g('setting-music');
    this.settingMusicVal = g('setting-music-val');
    this.settingSfx = g('setting-sfx');
    this.settingSfxVal = g('setting-sfx-val');
    this.settingQuality = g('setting-quality');

    this.pauseVolume = g('pause-volume');
    this.pauseVolumeVal = g('pause-volume-val');
    this.pauseMusic = g('pause-music');
    this.pauseMusicVal = g('pause-music-val');
    this.pauseSfx = g('pause-sfx');
    this.pauseSfxVal = g('pause-sfx-val');
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

    // Tienda / Almacén
    document.getElementById('btn-close-store')?.addEventListener('click', () => this.closeWarehouseStore());
    document.getElementById('btn-store-done')?.addEventListener('click', () => this.closeWarehouseStore());
    for (const [id, kind] of [['btn-buy-compost', 'compost'], ['btn-buy-nutrients', 'nutrients']]) {
      document.getElementById(id)?.addEventListener('click', async () => {
        const result = await this.farmAdapter.buyFertilizer(kind);
        this.hud?.showToast(result.message, result.success ? 'success' : 'warning');
      });
    }

    // Casa Campesina
    document.getElementById('btn-close-house')?.addEventListener('click', () => this.closeFarmerHouse());
    document.getElementById('btn-house-continue')?.addEventListener('click', () => this.closeFarmerHouse());
    const houseAction = async (sleep) => {
      if (this.houseActionPending) return;
      this.houseActionPending = true;
      const buttons = ['btn-house-rest', 'btn-house-sleep'].map(id => document.getElementById(id));
      buttons.forEach(button => { if (button) button.disabled = true; });
      try {
        await withRestTransition(async () => {
        const result = await this.farmAdapter.restAtFarmerHouse({ sleep });
        if (!result.success) { this.hud?.showToast(result.message, 'warning'); return; }
        this.hud?.showToast(sleep ? 'Amaneció un nuevo día. Revisa el clima y las parcelas antes de salir.' : result.message, 'success', 5000);
        this.audioSystem?.playSuccess();
        await this.openFarmerHouse();
        }, sleep);
      } catch {
        this.hud?.showToast('No se pudo completar el descanso. Inténtalo otra vez.', 'warning');
      } finally {
        this.houseActionPending = false;
        const state = await this.farmAdapter.getState();
        const availability = state.restAvailability;
        buttons.forEach((button, index) => {
          if (button) button.disabled = !(index === 0 ? availability?.canRest : availability?.canSleep);
        });
      }
    };
    document.getElementById('btn-house-rest')?.addEventListener('click', () => houseAction(false));
    document.getElementById('btn-house-sleep')?.addEventListener('click', () => houseAction(true));

    // Volumen (General, Música, Efectos) y Calidad gráfica sincronizados entre menú y pausa
    const STORAGE_KEY = 'agrorescate_settings_v1';
    const saveSettings = (patch) => {
      try {
        if (typeof localStorage === 'undefined') return;
        const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...patch }));
      } catch {
        // Ignorar si el almacenamiento local está restringido
      }
    };

    const syncMasterVolume = (raw) => {
      const pct = Math.max(0, Math.min(100, Math.round(Number(raw))));
      if (!Number.isFinite(pct)) return;
      this.audioSystem?.setMasterVolume(pct / 100);
      if (this.settingVolume) this.settingVolume.value = String(pct);
      if (this.pauseVolume) this.pauseVolume.value = String(pct);
      if (this.settingVolumeVal) this.settingVolumeVal.textContent = `${pct}%`;
      if (this.pauseVolumeVal) this.pauseVolumeVal.textContent = `${pct}%`;
      saveSettings({ masterPct: pct });
    };

    const syncMusicVolume = (raw) => {
      const pct = Math.max(0, Math.min(100, Math.round(Number(raw))));
      if (!Number.isFinite(pct)) return;
      this.audioSystem?.setMusicVolume(pct / 100);
      if (this.settingMusic) this.settingMusic.value = String(pct);
      if (this.pauseMusic) this.pauseMusic.value = String(pct);
      if (this.settingMusicVal) this.settingMusicVal.textContent = `${pct}%`;
      if (this.pauseMusicVal) this.pauseMusicVal.textContent = `${pct}%`;
      saveSettings({ musicPct: pct });
    };

    const syncSfxVolume = (raw) => {
      const pct = Math.max(0, Math.min(100, Math.round(Number(raw))));
      if (!Number.isFinite(pct)) return;
      this.audioSystem?.setSfxVolume(pct / 100);
      if (this.settingSfx) this.settingSfx.value = String(pct);
      if (this.pauseSfx) this.pauseSfx.value = String(pct);
      if (this.settingSfxVal) this.settingSfxVal.textContent = `${pct}%`;
      if (this.pauseSfxVal) this.pauseSfxVal.textContent = `${pct}%`;
      saveSettings({ sfxPct: pct });
    };

    this.settingVolume?.addEventListener('input', (e) => syncMasterVolume(e.target.value));
    this.pauseVolume?.addEventListener('input', (e) => syncMasterVolume(e.target.value));
    this.settingMusic?.addEventListener('input', (e) => syncMusicVolume(e.target.value));
    this.pauseMusic?.addEventListener('input', (e) => syncMusicVolume(e.target.value));
    this.settingSfx?.addEventListener('input', (e) => syncSfxVolume(e.target.value));
    this.pauseSfx?.addEventListener('input', (e) => syncSfxVolume(e.target.value));
    // Reproducir un toque de prueba al soltar el deslizador de efectos
    this.settingSfx?.addEventListener('change', () => this.audioSystem?.playClick());
    this.pauseSfx?.addEventListener('change', () => this.audioSystem?.playClick());

    // Restaurar ajustes guardados si existen
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (typeof saved.masterPct === 'number') syncMasterVolume(saved.masterPct);
        if (typeof saved.musicPct === 'number') syncMusicVolume(saved.musicPct);
        if (typeof saved.sfxPct === 'number') syncSfxVolume(saved.sfxPct);
      }
    } catch {
      // Ignorar errores de parseo
    }

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

  /**
   * Abre el Centro de Acopio y Tienda Campesina (Almacén).
   */
  async openWarehouseStore() {
    if (!this.warehouseModal) return;
    this.player?.unlock();
    const state = await this.farmAdapter.getState();

    const seedsListEl = document.getElementById('store-seeds-list');
    if (seedsListEl) {
      seedsListEl.innerHTML = `
        <div class="store-seed-card ${state.selectedSeedId === 'native_community' ? 'selected' : ''}" data-seed="native_community">
          <div class="store-seed-header">
            <strong>🌱 Semilla Criolla Campesina</strong>
            <span class="store-price">$10.000 COP</span>
          </div>
          <p class="store-desc">Comprada a campesinos vecinos. Gran resistencia genética a sequía y plagas locales.</p>
          <button type="button" class="btn-select-seed hud-btn" data-seed-btn="native_community">
            ${state.selectedSeedId === 'native_community' ? '✓ Seleccionada' : 'Seleccionar'}
          </button>
        </div>
        <div class="store-seed-card ${state.selectedSeedId === 'commercial_certified' ? 'selected' : ''}" data-seed="commercial_certified">
          <div class="store-seed-header">
            <strong>🏷️ Semilla Comercial Certificada</strong>
            <span class="store-price">$38.000 COP</span>
          </div>
          <p class="store-desc">Distribuidora agropecuaria. Madura más rápido pero exige abundantes riegos y agroquímicos.</p>
          <button type="button" class="btn-select-seed hud-btn" data-seed-btn="commercial_certified">
            ${state.selectedSeedId === 'commercial_certified' ? '✓ Seleccionada' : 'Seleccionar'}
          </button>
        </div>
        <div class="store-seed-card ${state.selectedSeedId === 'own_harvest' ? 'selected' : ''}" data-seed="own_harvest">
          <div class="store-seed-header">
            <strong>🌾 Semillero Propio Campesino</strong>
            <span class="store-price">$0 COP (Disp: ${state.ownSeedInventory || 0})</span>
          </div>
          <p class="store-desc">Reservada de tu mejor cosecha. Máxima soberanía alimentaria y costo cero.</p>
          <button type="button" class="btn-select-seed hud-btn" data-seed-btn="own_harvest" ${state.ownSeedInventory <= 0 ? 'disabled' : ''}>
            ${state.selectedSeedId === 'own_harvest' ? '✓ Seleccionada' : (state.ownSeedInventory > 0 ? 'Seleccionar' : 'Agotada')}
          </button>
        </div>
      `;

      seedsListEl.querySelectorAll('[data-seed-btn]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const seedId = e.currentTarget.dataset.seedBtn;
          this.farmAdapter.setSelectedSeedVariety(seedId);
          this.recordDecision(`Semilla seleccionada en almacén: ${seedId}`);
          this.hud?.showToast(`Semilla activa: ${seedId}`, 'success', 2500);
          this.openWarehouseStore();
        });
      });
    }

    const harvestBoxEl = document.getElementById('store-harvest-box');
    if (harvestBoxEl) {
      harvestBoxEl.innerHTML = `
        <div class="harvest-summary-tile">
          <div><strong>Total Cosechado:</strong> ${state.harvestedTotalKg || 0} kg</div>
          <div><strong>Ingresos Netos:</strong> ${formatCOP(state.economy?.netProfit || 0, { withCurrency: true, showPlus: true })}</div>
          <div><strong>Semillas Propias en Bodega:</strong> ${state.ownSeedInventory || 0} unidades</div>
        </div>
        <p class="store-tip">💡 <em>Comercio Justo:</em> Si cosechas lechugas con salud superior al 80%, obtienes semillas propias para la siguiente siembra sin costo.</p>
      `;
    }

    this.warehouseModal.classList.remove('hidden');
  }

  closeWarehouseStore({ relock = true } = {}) {
    this.warehouseModal?.classList.add('hidden');
    if (relock) this._relockIfPlaying();
  }

  /**
   * Abre el Modal de la Casa Campesina (Hogar y Descanso).
   */
  async openFarmerHouse() {
    if (!this.houseModal) return;
    this.player?.unlock();
    const state = await this.farmAdapter.getState();

    const energyEl = document.getElementById('house-energy-val');
    const dayEl = document.getElementById('house-day-val');
    const budgetEl = document.getElementById('house-budget-val');
    if (energyEl) energyEl.textContent = `${state.farmerEnergy ?? 100}%`;
    if (dayEl) dayEl.textContent = `Día ${state.day}`;
    if (budgetEl) budgetEl.textContent = formatCOP(state.budget, { withCurrency: true });

    const weatherEl = document.getElementById('house-weather');
    const summary = document.getElementById('house-crop-status');
    if (summary) summary.textContent = 'Tus cultivos siguen activos. Consulta sus barras y alertas en el tablero en vivo.';
    if (weatherEl) weatherEl.textContent = (state.currentWeather?.name || 'Clima despejado') + ': ' + (state.currentWeather?.description || '');
    const choresEl = document.getElementById('house-chores');
    if (choresEl) {
      choresEl.replaceChildren();
      for (const plot of Object.values(state.plots)) {
        const item = document.createElement('li');
        const task = plot.isWithered ? 'Retirar cultivo perdido' : !plot.isPrepared ? 'Preparar la tierra' : !plot.isPlanted ? 'Sembrar' : plot.daysGrown >= plot.daysToMature ? 'Cosechar hoy' : plot.pestPressure >= 15 ? `${plot.pestAction?.label || 'Controlar plaga'} (${plot.pestPressure}%)` : plot.moisture < 40 ? 'Revisar el riego' : 'Vigilar el crecimiento';
        item.textContent = (plot.cropName || plot.id) + ': ' + task + ' · humedad ' + plot.moisture + '%';
        choresEl.appendChild(item);
      }
    }
    this.houseModal.classList.remove('hidden');
  }

  closeFarmerHouse({ relock = true } = {}) {
    if (this.houseActionPending) return;
    this.houseModal?.classList.add('hidden');
    if (relock) this._relockIfPlaying();
  }

  updateWorldMenus(position) {
    if (this.houseActionPending) return;
    for (const binding of this.worldMenus || []) {
      const modal = binding.kind === 'house' ? this.houseModal : this.warehouseModal;
      if (modal && !modal.classList.contains('hidden') && outsideInteraction(position, binding.position, binding.radius)) {
        if (binding.kind === 'house') this.closeFarmerHouse({ relock: false });
        else this.closeWarehouseStore({ relock: false });
        this.hud?.showToast('Te alejaste del edificio. Menú cerrado.', 'info', 1800);
      }
    }
  }
}
