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
            detune: { value: 0 },
            playbackRate: { value: 1 },
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
});
