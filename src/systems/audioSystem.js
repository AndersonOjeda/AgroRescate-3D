import * as THREE from 'three';

/**
 * Sistema de Audio Espacial y Global usando Web Audio API con Three.js
 * Incluye PositionalAudio atenuado con la distancia, Audio global de éxito,
 * gestión estricta de políticas de autoplay del navegador y generador sintético de respaldo.
 */
export class AudioSystem {
  constructor(camera) {
    this.camera = camera;
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);

    this.audioLoader = new THREE.AudioLoader();
    this.isAudioUnlocked = false;
    this.isMuted = false;

    // Audio Posicional (Bomba de agua / Riego)
    this.positionalWater = new THREE.PositionalAudio(this.listener);
    this.positionalWater.setRefDistance(3.0);
    this.positionalWater.setMaxDistance(25.0);
    this.positionalWater.setRolloffFactor(1.5);
    this.positionalWater.setDistanceModel('linear');
    this.positionalWater.setLoop(true);
    this.positionalWater.setVolume(0.85);

    // Audio Global (Efectos de éxito / misión)
    this.globalSuccess = new THREE.Audio(this.listener);
    this.globalSuccess.setVolume(0.7);

    // Audio Global (Click de UI)
    this.globalClick = new THREE.Audio(this.listener);
    this.globalClick.setVolume(0.4);

    // Audio de Pisadas del Jugador
    this.footstepAudio = new THREE.Audio(this.listener);
    this.footstepAudio.setVolume(0.35);

    // Audio de Ambiente Rural sutil (brisa y campo)
    this.ambientAudio = new THREE.Audio(this.listener);
    this.ambientAudio.setLoop(true);
    this.ambientAudio.setVolume(0.08);

    // Música ambiental de fondo en bucle (/audio/bgm.mp3 vía streaming HTMLAudioElement con respaldo sintético)
    this.isMusicEnabled = true;
    this.musicPath = '/audio/bgm.mp3';
    this.musicVolume = 0.45;
    this.musicElement = null;
    this._musicFailed = false;
    this.ambientMusic = new THREE.Audio(this.listener);
    this.ambientMusic.setLoop(true);
    this.ambientMusic.setVolume(this.musicVolume);

    this.loadedBuffers = {};
    this._musicLoadPromise = null;
    this._loadAudioAssets();
    this._setupMusicElement();
  }

  /**
   * Carga los archivos de audio WAV desde /audio/ o genera buffers sintéticos en memoria
   */
  async _loadAudioAssets() {
    const assets = [
      { key: 'pump', path: '/audio/pump.wav', target: this.positionalWater },
      { key: 'success', path: '/audio/success.wav', target: this.globalSuccess },
      { key: 'click', path: '/audio/click.wav', target: this.globalClick },
      { key: 'footstep', path: '/audio/footstep.wav', target: this.footstepAudio },
      { key: 'ambient', path: '/audio/ambient.wav', target: this.ambientAudio }
    ];

    for (const asset of assets) {
      try {
        const buffer = await this._loadBuffer(asset.path);
        this.loadedBuffers[asset.key] = buffer;
        asset.target.setBuffer(buffer);
      } catch (err) {
        console.warn(`[AudioSystem] No se pudo cargar ${asset.path}, generando respaldo sintético:`, err);
        const fallback = this._createFallbackBuffer(asset.key);
        if (fallback) {
          asset.target.setBuffer(fallback);
        }
      }
    }
  }

  _loadBuffer(path) {
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        path,
        (buffer) => resolve(buffer),
        undefined,
        (err) => reject(err)
      );
    });
  }

  /**
   * Generador de buffers Web Audio sintéticos de respaldo
   */
  _createFallbackBuffer(type) {
    const ctx = this.listener.context;
    if (!ctx) return null;

    if (type === 'pump') {
      const sampleRate = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, sampleRate * 2, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const pulse = Math.sin(2 * Math.PI * 4 * t);
        data[i] = (Math.random() * 2 - 1) * 0.25 * (0.5 + 0.5 * pulse);
      }
      return buffer;
    } else if (type === 'success') {
      const sampleRate = ctx.sampleRate;
      const buffer = ctx.createBuffer(1, sampleRate * 1.2, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 4);
        data[i] = Math.sin(2 * Math.PI * 659.25 * t) * env * 0.3;
      }
      return buffer;
    }
    return null;
  }

  /**
   * Carga la música de fondo (/audio/bgm.mp3) o genera respaldo sintético si no está disponible.
   */
  async _initAmbientMusic() {
    if (this._musicLoadPromise) return this._musicLoadPromise;

    this._musicLoadPromise = (async () => {
      let buffer = null;
      if (this.audioLoader && this.musicPath) {
        try {
          buffer = await this._loadBuffer(this.musicPath);
        } catch (err) {
          console.warn(`[AudioSystem] No se pudo cargar ${this.musicPath}, usando respaldo sintético:`, err?.message || err);
        }
      }

      if (!buffer) {
        buffer = this._createAmbientMusicBuffer();
      }

      if (buffer) {
        this.loadedBuffers.music = buffer;
        this.ambientMusic.setBuffer(buffer);
        if (this.isAudioUnlocked && !this.isMuted && this.isMusicEnabled && !this.ambientMusic.isPlaying) {
          this.ambientMusic.play();
        }
      }

      return buffer;
    })();

    return this._musicLoadPromise;
  }

  /**
   * Genera un bucle estéreo de 16 segundos con acordes cálidos y notas suaves de arpa.
   */
  _createAmbientMusicBuffer() {
    const ctx = this.listener?.context;
    if (!ctx || typeof ctx.createBuffer !== 'function') return null;

    const sampleRate = ctx.sampleRate || 44100;
    const loopDuration = 16;
    const barDuration = 4;
    const totalSamples = Math.floor(sampleRate * loopDuration);
    const buffer = ctx.createBuffer(2, totalSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;

    // Progresión apacible: Cmaj9 -> Am9 -> Fmaj9 -> G6
    const progression = [
      { pad: [130.81, 196.0, 293.66, 329.63], melody: [523.25, 659.25, 587.33, 440.0, 659.25] },
      { pad: [110.0, 164.81, 246.94, 261.63], melody: [440.0, 523.25, 659.25, 587.33, 523.25] },
      { pad: [87.31, 130.81, 196.0, 220.0], melody: [523.25, 440.0, 587.33, 523.25, 392.0] },
      { pad: [98.0, 146.83, 220.0, 246.94], melody: [392.0, 493.88, 587.33, 659.25, 587.33] }
    ];
    const noteStarts = [0.2, 0.95, 1.7, 2.45, 3.15];

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const barIndex = Math.min(3, Math.floor(t / barDuration));
      const barT = t - barIndex * barDuration;
      const chord = progression[barIndex];

      // Envolvente suave por compás (cero en los bordes para bucle sin chasquidos)
      const padEnv = Math.pow(Math.sin((Math.PI * barT) / barDuration), 0.75);
      let padSample = 0;
      for (let k = 0; k < chord.pad.length; k++) {
        const freq = chord.pad[k];
        const voice = Math.sin(2 * Math.PI * freq * barT) + 0.18 * Math.sin(2 * Math.PI * freq * 2 * barT);
        padSample += voice * 0.042;
      }
      padSample *= padEnv;

      // Arpegio tipo kalimba/arpa con ligera apertura estéreo
      let arpLeft = 0;
      let arpRight = 0;
      for (let n = 0; n < noteStarts.length; n++) {
        const dt = barT - noteStarts[n];
        if (dt >= 0 && dt < 0.85) {
          const attack = Math.min(1, dt / 0.025);
          const tailFade = Math.min(1, (0.85 - dt) / 0.08);
          const env = attack * tailFade * Math.exp(-dt * 3.6);
          const freq = chord.melody[n];
          const tone = (Math.sin(2 * Math.PI * freq * dt) + 0.25 * Math.sin(2 * Math.PI * freq * 2 * dt)) * env * 0.075;
          const pan = n % 2 === 0 ? 0.38 : 0.62;
          arpLeft += tone * (1 - pan * 0.5);
          arpRight += tone * (0.5 + pan * 0.5);
        }
      }

      // Brisa de fondo casi imperceptible modulada suavemente
      const breezeL = Math.sin(2 * Math.PI * 0.125 * t) * 0.008;
      const breezeR = Math.cos(2 * Math.PI * 0.125 * t) * 0.008;

      left[i] = Math.max(-0.5, Math.min(0.5, padSample + arpLeft + breezeL));
      right[i] = Math.max(-0.5, Math.min(0.5, padSample + arpRight + breezeR));
    }

    return buffer;
  }

  /**
   * Inicializa la música de fondo en streaming con HTMLAudioElement para inicio instantáneo.
   * Si el navegador no la soporta o falla al cargar, usa AudioLoader + respaldo sintético.
   */
  _setupMusicElement() {
    if (typeof globalThis.Audio === 'function') {
      try {
        const audioEl = new globalThis.Audio(this.musicPath);
        audioEl.loop = true;
        audioEl.preload = 'auto';
        audioEl.volume = this.musicVolume;
        audioEl.addEventListener?.('error', () => {
          this._musicFailed = true;
          console.warn(`[AudioSystem] Error al cargar ${this.musicPath} en <audio>, activando respaldo.`);
          this._initAmbientMusic();
        });
        this.musicElement = audioEl;
        return;
      } catch (err) {
        console.warn(`[AudioSystem] No se pudo crear Audio(${this.musicPath}):`, err?.message || err);
      }
    }
    this._initAmbientMusic();
  }

  /**
   * Indica si la música de fondo está reproduciéndose actualmente.
   */
  isMusicPlaying() {
    if (this.musicElement && !this._musicFailed) {
      return !this.musicElement.paused;
    }
    return Boolean(this.ambientMusic?.isPlaying);
  }

  /**
   * Inicia la música de fondo (/audio/bgm.mp3) si no está silenciada.
   */
  startAmbientMusic() {
    if (this.isMuted || !this.isMusicEnabled) return false;

    if (this.musicElement && !this._musicFailed) {
      this.musicElement.loop = true;
      this.musicElement.volume = this.musicVolume;
      if (!this.musicElement.paused) return true;
      try {
        const playResult = this.musicElement.play();
        if (playResult && typeof playResult.catch === 'function') {
          playResult.catch((err) => {
            console.warn('[AudioSystem] Reproducción de música pendiente de interacción:', err?.message || err);
          });
        }
        return true;
      } catch (err) {
        console.warn('[AudioSystem] Error reproduciendo música de fondo:', err);
        return false;
      }
    }

    if (!this.listener?.context) return false;
    if (!this.ambientMusic.buffer) {
      this._initAmbientMusic();
      return false;
    }
    if (!this.ambientMusic.isPlaying) {
      this.ambientMusic.play();
      return true;
    }
    return Boolean(this.ambientMusic.isPlaying);
  }

  /**
   * Vincula el audio posicional al mesh de la bomba de agua o aspersor
   */
  attachPositionalWater(targetMesh) {
    if (targetMesh) {
      targetMesh.add(this.positionalWater);
    }
  }

  /**
   * Reanuda el contexto de audio y dispara la música en el mismo gesto del usuario
   */
  async unlockAudio() {
    // Disparar <audio> síncronamente dentro de la interacción del usuario antes del await
    if (!this.isMuted && this.isMusicEnabled) {
      this.startAmbientMusic();
    }

    const ctx = this.listener.context;
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        this.isAudioUnlocked = true;
      } catch (e) {
        console.warn('Error al desbloquear Web Audio:', e);
      }
    } else {
      this.isAudioUnlocked = true;
    }

    if (this.isAudioUnlocked && !this.isMuted && this.isMusicEnabled && !this.isMusicPlaying()) {
      this.startAmbientMusic();
    }
    return this.isAudioUnlocked;
  }

  /**
   * Inicia o detiene el sonido posicional de riego
   */
  setWaterSound(isPlaying) {
    if (!this.positionalWater.buffer) return;

    if (isPlaying && !this.isMuted) {
      this.unlockAudio();
      if (!this.positionalWater.isPlaying) {
        this.positionalWater.play();
      }
    } else {
      if (this.positionalWater.isPlaying) {
        this.positionalWater.pause();
      }
    }
  }

  /**
   * Reproduce el sonido global de éxito al completar una acción o misión
   */
  playSuccess() {
    if (this.isMuted) return;
    this.unlockAudio();
    if (this.globalSuccess.buffer) {
      if (this.globalSuccess.isPlaying) {
        this.globalSuccess.stop();
      }
      this.globalSuccess.play();
    }
  }

  /**
   * Reproduce un click rápido de interacción
   */
  playClick() {
    if (this.isMuted) return;
    this.unlockAudio();
    if (this.globalClick.buffer) {
      if (this.globalClick.isPlaying) {
        this.globalClick.stop();
      }
      this.globalClick.play();
    }
  }

  /**
   * Reproduce el sonido de una pisada del jugador con modulación sutil de tono
   */
  playFootstep() {
    if (this.isMuted || !this.isAudioUnlocked) return;
    if (this.footstepAudio && this.footstepAudio.buffer) {
      if (this.footstepAudio.isPlaying) {
        this.footstepAudio.stop();
      }
      this.footstepAudio.setVolume(0.26 + Math.random() * 0.12);
      this.footstepAudio.playbackRate = 0.95 + Math.random() * 0.15;
      this.footstepAudio.play();
    }
  }

  /**
   * Inicia el sonido ambiente continuo de brisa rural
   */
  startAmbient() {
    if (this.isMuted) return;
    this.unlockAudio();
    if (this.ambientAudio && this.ambientAudio.buffer && !this.ambientAudio.isPlaying) {
      this.ambientAudio.play();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      if (this.positionalWater.isPlaying) this.positionalWater.pause();
      if (this.globalSuccess.isPlaying) this.globalSuccess.stop();
      if (this.footstepAudio?.isPlaying) this.footstepAudio.stop();
      if (this.ambientAudio?.isPlaying) this.ambientAudio.pause();
      if (this.musicElement && !this.musicElement.paused) this.musicElement.pause();
      if (this.ambientMusic.isPlaying) this.ambientMusic.pause();
    } else {
      this.unlockAudio();
      this.startAmbientMusic();
      if (this.ambientAudio?.buffer && !this.ambientAudio.isPlaying) {
        this.ambientAudio.play();
      }
    }
    return !this.isMuted;
  }
}
