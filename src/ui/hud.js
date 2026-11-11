/**
 * Gestor del HUD (Heads-Up Display) e Interfaces de Usuario de AgroRescate 3D
 * Conecta los datos del motor 3D y de la simulación con los elementos HTML del DOM.
 */
export class HUD {
  constructor() {
    // Referencias al DOM
    this.loadingScreen = document.getElementById('loading-screen');
    this.loadingBar = document.getElementById('loading-bar');
    this.loadingStatus = document.getElementById('loading-status');

    this.startOverlay = document.getElementById('start-overlay');
    this.btnStartGame = document.getElementById('btn-start-game');

    this.interactionPrompt = document.getElementById('interaction-prompt');
    this.promptAction = document.getElementById('prompt-action');
    this.promptTarget = document.getElementById('prompt-target');

    this.modeSelector = document.getElementById('mode-selector');
    this.hudDay = document.getElementById('hud-day');
    this.hudWater = document.getElementById('hud-water');
    this.meterWater = document.getElementById('meter-water');
    this.hudSoil = document.getElementById('hud-soil');
    this.meterSoil = document.getElementById('meter-soil');
    this.hudBudget = document.getElementById('hud-budget');
    this.hudHarvest = document.getElementById('hud-harvest');
    this.btnAdvanceDay = document.getElementById('btn-advance-day');

    this.zoneName = document.getElementById('zone-name');
    this.toastContainer = document.getElementById('toast-container');

    this.debugCoords = document.getElementById('debug-coords');
    this.debugFps = document.getElementById('debug-fps');
    this.debugPhysics = document.getElementById('debug-physics');

    this.btnToggleCam = document.getElementById('btn-toggle-cam');
    this.btnToggleGui = document.getElementById('btn-toggle-gui');
    this.btnToggleSound = document.getElementById('btn-toggle-sound');
    this.soundIcon = document.getElementById('sound-icon');
    this.btnToggleRain = document.getElementById('btn-toggle-rain');
    this.btnSpawnCrate = document.getElementById('btn-spawn-crate');
    this.btnShowReport = document.getElementById('btn-show-report');
    this.btnShowHelp = document.getElementById('btn-show-help');
    this.reportModal = document.getElementById('report-modal');
    this.btnCloseReport = document.getElementById('btn-close-report');

    this._setupHelpModal();
    this._setupReportModal();
  }

  /**
   * Actualiza la barra y estado de carga
   */
  updateLoadingProgress(percent, message) {
    if (this.loadingBar) {
      this.loadingBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (this.loadingStatus && message) {
      this.loadingStatus.textContent = message;
    }
  }

  /**
   * Oculta la pantalla de carga con transición suave
   */
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

  /**
   * Muestra u oculta el prompt central de interacción [E]
   */
  showInteractionPrompt(interactable) {
    if (!this.interactionPrompt) return;

    if (interactable) {
      this.promptAction.textContent = interactable.actionText || 'Presiona E';
      this.promptTarget.textContent = interactable.name || '';
      this.interactionPrompt.classList.remove('hidden');
    } else {
      this.interactionPrompt.classList.add('hidden');
    }
  }

  /**
   * Actualiza el indicador de zona actual
   */
  setZone(zoneText) {
    if (this.zoneName && zoneText) {
      this.zoneName.textContent = zoneText;
    }
  }

  /**
   * Actualiza las coordenadas del jugador para depuración y navegación
   */
  updateCoordinates(x, y, z) {
    if (this.debugCoords) {
      this.debugCoords.textContent = `X: ${x.toFixed(1)} | Y: ${y.toFixed(1)} | Z: ${z.toFixed(1)}`;
    }
  }

  /**
   * Actualiza el contador de FPS
   */
  updateFps(fps) {
    if (this.debugFps) {
      this.debugFps.textContent = fps;
      this.debugFps.style.color = fps >= 45 ? '#34d399' : fps >= 25 ? '#f59e0b' : '#ef4444';
    }
  }

  /**
   * Actualiza los paneles con los datos de la simulación agrícola
   */
  updateFarmState(state) {
    if (!state) return;

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
  }

  /**
   * Muestra un mensaje flotante (Toast)
   */
  showToast(message, type = 'info', durationMs = 3800) {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
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

  _setupHelpModal() {
    if (this.btnShowHelp) {
      this.btnShowHelp.addEventListener('click', () => {
        if (this.startOverlay) {
          this.startOverlay.classList.remove('hidden');
        }
      });
    }
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

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.reportModal && !this.reportModal.classList.contains('hidden')) {
        this.reportModal.classList.add('hidden');
      }
    });
  }
}
