import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

// Evitar errores de AudioContext en entorno Node simulando AudioListener mínimo cuando haga falta
vi.mock('three', async () => {
  const actual = await vi.importActual('three');
  return {
    ...actual,
    AudioListener: class MockAudioListener extends actual.Object3D {
      constructor() {
        super();
        this.context = {
          state: 'suspended',
          currentTime: 0,
          sampleRate: 100,
          resume: vi.fn(async () => {
            this.context.state = 'running';
          }),
          createGain: () => ({
            gain: { value: 1, setTargetAtTime: vi.fn() },
            connect: vi.fn()
          }),
          createPanner: () => ({
            panningModel: 'HRTF',
            distanceModel: 'inverse',
            refDistance: 1,
            maxDistance: 10000,
            rolloffFactor: 1,
            coneInnerAngle: 360,
            coneOuterAngle: 360,
            coneOuterGain: 0,
            setOrientation: vi.fn(),
            setPosition: vi.fn(),
            connect: vi.fn()
          }),
          createBufferSource: () => ({
            buffer: null,
            loop: false,
            loopStart: 0,
            loopEnd: 0,
            detune: { value: 0, setTargetAtTime: vi.fn() },
            playbackRate: { value: 1, setTargetAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn()
          }),
          createBuffer: (ch, len) => ({
            numberOfChannels: ch,
            getChannelData: () => new Float32Array(len)
          })
        };
      }
      getInput() {
        return { connect: vi.fn() };
      }
    },
    AudioLoader: class MockAudioLoader {
      load(_path, _onLoad, _onProgress, onError) {
        if (onError) onError(new Error('No fetch in headless test'));
      }
    }
  };
});

import { AudioSystem } from '../src/systems/audioSystem.js';

describe('AudioSystem — Música de fondo (/audio/bgm.mp3)', () => {
  const originalAudio = globalThis.Audio;

  afterEach(() => {
    globalThis.Audio = originalAudio;
  });

  it('inicializa streaming HTMLAudioElement con /audio/bgm.mp3 y lo reproduce al desbloquear audio', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const created = [];
    globalThis.Audio = class FakeHtmlAudio {
      constructor(src) {
        this.src = src;
        this.loop = false;
        this.preload = '';
        this.volume = 1;
        this.paused = true;
        this.play = vi.fn(() => {
          this.paused = false;
          return Promise.resolve();
        });
        this.pause = vi.fn(() => {
          this.paused = true;
        });
        this.addEventListener = vi.fn();
        created.push(this);
      }
    };

    const camera = new THREE.PerspectiveCamera();
    const audioSystem = new AudioSystem(camera);

    expect(created).toHaveLength(1);
    expect(created[0].src).toBe('/audio/bgm.mp3');
    expect(created[0].loop).toBe(true);
    expect(audioSystem.isMusicPlaying()).toBe(false);

    await audioSystem.unlockAudio();

    expect(created[0].play).toHaveBeenCalledTimes(1);
    expect(audioSystem.isMusicPlaying()).toBe(true);

    // Al silenciar debe pausar la música y al reactivar debe volver a reproducir
    const activeAfterMute = audioSystem.toggleMute();
    expect(activeAfterMute).toBe(false);
    expect(created[0].pause).toHaveBeenCalledTimes(1);
    expect(audioSystem.isMusicPlaying()).toBe(false);

    const activeAfterUnmute = audioSystem.toggleMute();
    expect(activeAfterUnmute).toBe(true);
    expect(created[0].play).toHaveBeenCalledTimes(2);
    expect(audioSystem.isMusicPlaying()).toBe(true);
    await Promise.resolve();
    warnSpy.mockRestore();
  });

  it('usa AudioContext de respaldo cuando HTMLAudioElement falla al cargar', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const listeners = {};
    globalThis.Audio = class FailingHtmlAudio {
      constructor(src) {
        this.src = src;
        this.loop = false;
        this.preload = '';
        this.volume = 1;
        this.paused = true;
        this.play = vi.fn();
        this.pause = vi.fn();
        this.addEventListener = vi.fn((ev, cb) => {
          listeners[ev] = cb;
        });
      }
    };

    const camera = new THREE.PerspectiveCamera();
    const audioSystem = new AudioSystem(camera);

    listeners.error();
    await audioSystem._musicLoadPromise;
    expect(audioSystem._musicFailed).toBe(true);
    expect(audioSystem.ambientMusic.buffer).toBeTruthy();
    warnSpy.mockRestore();
  });

  it('ajusta y acota el volumen maestro entre 0 y 1', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const camera = new THREE.PerspectiveCamera();
    const audioSystem = new AudioSystem(camera);
    expect(audioSystem.setMasterVolume(0.5)).toBe(0.5);
    expect(audioSystem.setMasterVolume(2.0)).toBe(1.0);
    expect(audioSystem.setMasterVolume(-1.0)).toBe(0.0);
    warnSpy.mockRestore();
  });

  it('ejecuta sonido de impacto de azada contra la tierra (playHoeImpact)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const camera = new THREE.PerspectiveCamera();
    const audioSystem = new AudioSystem(camera);

    const footstepSpy = vi.spyOn(audioSystem, 'playFootstep');
    audioSystem.unlockAudio();
    audioSystem.playHoeImpact();
    // En entorno mock con AudioListener sintetizado, ejecuta sin lanzar excepciones
    expect(audioSystem.isAudioUnlocked).toBe(true);
    warnSpy.mockRestore();
    footstepSpy.mockRestore();
  });

  it('controla por separado el volumen general, de música y de efectos de sonido', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const originalAudio = globalThis.Audio;
    globalThis.Audio = class FakeHtmlAudio {
      constructor(src) {
        this.src = src;
        this.loop = false;
        this.preload = '';
        this.volume = 1;
        this.paused = true;
        this.play = vi.fn(() => Promise.resolve());
        this.pause = vi.fn();
        this.addEventListener = vi.fn();
      }
    };

    try {
      const camera = new THREE.PerspectiveCamera();
      const audioSystem = new AudioSystem(camera);
      const sfxSpy = vi.spyOn(audioSystem.globalSuccess, 'setVolume');

      expect(audioSystem.setMusicVolume(0.8)).toBe(0.8);
      expect(audioSystem.getMusicVolume()).toBe(0.8);
      expect(audioSystem.setSfxVolume(0.5)).toBe(0.5);
      expect(audioSystem.getSfxVolume()).toBe(0.5);

      // Acota entre 0 y 1
      expect(audioSystem.setMusicVolume(1.5)).toBe(1.0);
      expect(audioSystem.setSfxVolume(-0.2)).toBe(0.0);

      // Al ajustar el volumen general a 0.5, música y efectos escalan proporcionalmente
      audioSystem.setMusicVolume(0.8);
      audioSystem.setSfxVolume(0.6);
      sfxSpy.mockClear();
      audioSystem.setMasterVolume(0.5);

      expect(audioSystem.musicElement.volume).toBeCloseTo(0.4, 3);
      expect(sfxSpy).toHaveBeenCalledWith(expect.closeTo(0.7 * 0.6 * 0.5, 3));
    } finally {
      globalThis.Audio = originalAudio;
      warnSpy.mockRestore();
    }
  });
});
