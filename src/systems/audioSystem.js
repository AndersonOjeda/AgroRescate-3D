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

    // Audio de Ambiente Rural (brisa y campo)
    this.ambientAudio = new THREE.Audio(this.listener);
    this.ambientAudio.setLoop(true);
    this.ambientAudio.setVolume(0.28);

    this.loadedBuffers = {};
    this._loadAudioAssets();
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
   * Vincula el audio posicional al mesh de la bomba de agua o aspersor
   */
  attachPositionalWater(targetMesh) {
    if (targetMesh) {
      targetMesh.add(this.positionalWater);
    }
  }

  /**
   * Reanuda el contexto de audio tras la primera interacción del usuario (requisito de navegadores)
   */
  async unlockAudio() {
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
    if (this.isMuted) return;
    if (this.footstepAudio && this.footstepAudio.buffer) {
      if (this.footstepAudio.isPlaying) {
        this.footstepAudio.stop();
      }
      // Modulación sutil de volumen y tono para realismo
      this.footstepAudio.setVolume(0.28 + Math.random() * 0.12);
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
      if (this.ambientAudio.isPlaying) this.ambientAudio.pause();
    } else {
      if (this.ambientAudio.buffer) this.ambientAudio.play();
    }
    return !this.isMuted;
  }
}
