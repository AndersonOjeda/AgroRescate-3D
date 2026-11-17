import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { SkySystem } from '../src/systems/skySystem.js';
import { AudioSystem } from '../src/systems/audioSystem.js';

function createSkyTestFixture() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0d8ef);
  scene.fog = new THREE.Fog(0xa0d8ef, 35, 95);

  const sunLight = new THREE.DirectionalLight(0xfff7e6, 1.2);
  sunLight.position.set(25, 40, 20);
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4b7741, 0.6);
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);

  return { scene, sunLight, hemiLight, ambientLight };
}

function createFakeAudioChannel() {
  return {
    buffer: null,
    isPlaying: false,
    setBuffer(buf) {
      this.buffer = buf;
    },
    play: vi.fn(function play() {
      this.isPlaying = true;
    }),
    pause: vi.fn(function pause() {
      this.isPlaying = false;
    }),
    stop: vi.fn(function stop() {
      this.isPlaying = false;
    })
  };
}

describe('SkySystem — Nubes 3D y Ciclo Día-Noche-Día', () => {
  it('sincroniza reloj, recorrido Este-Oeste y dirección de las sombras', () => {
    const fixture = createSkyTestFixture();
    const sky = new SkySystem(fixture);
    sky.setAutoCycle(true, { startTimeOfDay: 0.04 });
    expect(sky.getClockInfo().formatted).toBe('06:00');
    expect(sky.sunMesh.position.x).toBeGreaterThan(50);
    sky.setAutoCycle(true, { startTimeOfDay: 0.38 });
    expect(sky.getClockInfo().formatted).toBe('12:00');
    expect(sky.sunMesh.position.y).toBeCloseTo(44);
    expect(fixture.sunLight.position.distanceTo(sky.sunMesh.position)).toBeLessThan(0.001);
    sky.setAutoCycle(true, { startTimeOfDay: 0.70 });
    expect(sky.sunMesh.position.x).toBeLessThan(-50);
    expect(sky.sunHaloMesh.isSprite).toBe(true);
    sky.setAutoCycle(true, { startTimeOfDay: 0.85 });
    expect(sky.sunMesh.visible).toBe(false);
  });
  it('crea 10 nubes animadas, luna y 260 estrellas ocultas de día', () => {
    const fixture = createSkyTestFixture();
    const sky = new SkySystem(fixture);

    expect(sky.clouds.length).toBe(10);
    expect(sky.moonMesh.visible).toBe(false);
    expect(sky.starsPoints.visible).toBe(false);
    expect(sky.starsPoints.geometry.attributes.position.count).toBe(260);
    expect(sky.phaseName).toBe('Día');

    const firstCloud = sky.clouds[0];
    const startX = firstCloud.group.position.x;
    sky.update(0.5);
    expect(firstCloud.group.position.x).toBeCloseTo(startX + firstCloud.speed * 0.5, 4);

    // Envolver nube al superar X = 62
    firstCloud.group.position.x = 61.9;
    sky.update(1.0);
    expect(firstCloud.group.position.x).toBe(-62);
  });

  it('transiciona Atardecer -> Noche -> Amanecer -> Día al avanzar de día y restaura el sol', () => {
    const fixture = createSkyTestFixture();
    const sky = new SkySystem(fixture);

    sky.triggerDayNightCycle();
    expect(sky.isTransitioning).toBe(true);
    expect(sky.cycleProgress).toBe(0);

    // 1. Atardecer (~15% del ciclo)
    sky.update(sky.cycleDuration * 0.15);
    expect(sky.phaseName).toBe('Atardecer');
    expect(fixture.sunLight.intensity).toBeLessThan(1.2);

    // 2. Noche estrellada (~55% del ciclo)
    sky.update(sky.cycleDuration * 0.40);
    expect(sky.phaseName).toBe('Noche');
    expect(sky.moonMesh.visible).toBe(true);
    expect(sky.starsPoints.visible).toBe(true);
    expect(fixture.scene.background.getHex()).toBe(0x0b132b);

    // 3. Amanecer (~75% del ciclo)
    sky.update(sky.cycleDuration * 0.20);
    expect(sky.phaseName).toBe('Amanecer');

    // 4. Regreso completo a Día
    sky.update(sky.cycleDuration * 0.30);
    expect(sky.isTransitioning).toBe(false);
    expect(sky.cycleProgress).toBe(1);
    expect(sky.phaseName).toBe('Día');
    expect(sky.moonMesh.visible).toBe(false);
    expect(sky.starsPoints.visible).toBe(false);
    expect(fixture.sunLight.intensity).toBe(1.2);
    expect(fixture.scene.background.getHex()).toBe(0xa0d8ef);
  });

  it('recorre de forma continua Mañana -> Mediodía -> Tarde -> Noche y dispara onDayComplete al amanecer', () => {
    const fixture = createSkyTestFixture();
    const sky = new SkySystem(fixture);
    const onDayComplete = vi.fn();

    sky.setAutoCycle(true, {
      dayLengthSeconds: 40,
      startTimeOfDay: 0.05,
      onDayComplete
    });

    expect(sky.phaseName).toBe('Mañana');

    // Avanzar a Mediodía (+10s => 0.30)
    sky.update(10);
    expect(sky.phaseName).toBe('Mediodía');
    expect(fixture.sunLight.intensity).toBeGreaterThanOrEqual(1.15);

    // Avanzar a Tarde (+10s => 0.55)
    sky.update(10);
    expect(sky.phaseName).toBe('Tarde');

    // Avanzar a Noche (+10s => 0.80)
    sky.update(10);
    expect(sky.phaseName).toBe('Noche');
    expect(sky.moonMesh.visible).toBe(true);
    expect(sky.starsPoints.visible).toBe(true);

    // Completar la noche (+10s => >= 1.00): vuelve a Mañana y llama onDayComplete
    sky.update(10);
    expect(onDayComplete).toHaveBeenCalledTimes(1);
    expect(sky.phaseName).toBe('Mañana');
  });

  it('anima el arco solar desde madrugada hasta anochecer y acumula/oscurece nubes con lluvia', () => {
    const fixture = createSkyTestFixture();
    const sky = new SkySystem(fixture);
    sky.setAutoCycle(true, { dayLengthSeconds: 40, startTimeOfDay: 0.02 });

    // Madrugada / Amanecer (06:00) -> sol bajo al este
    sky.setAutoCycle(true, { dayLengthSeconds: 40, startTimeOfDay: 0.04 });
    sky.update(0.01);
    expect(sky.getClockInfo().formatted).toBe('06:00');
    const dawnSunY = sky.sunMesh.position.y;
    const dawnSunX = sky.sunMesh.position.x;

    // Mediodía (12:00) -> sol alto en el cenit
    sky.setAutoCycle(true, { dayLengthSeconds: 40, startTimeOfDay: 0.38 });
    sky.update(0.01);
    expect(sky.getClockInfo().formatted).toBe('12:00');
    expect(sky.sunMesh.position.y).toBeGreaterThan(dawnSunY);
    expect(sky.sunMesh.position.x).toBeLessThan(dawnSunX);
    expect(sky.sunMesh.visible).toBe(true);

    // Noche profunda -> disco solar oculto bajo el horizonte
    sky.setAutoCycle(true, { dayLengthSeconds: 40, startTimeOfDay: 0.85 });
    sky.update(0.01);
    expect(sky.sunMesh.visible).toBe(false);

    // Clima lluvioso/tormenta -> nubes más grandes, más bajas y más oscuras
    sky.setAutoCycle(true, { dayLengthSeconds: 40, startTimeOfDay: 0.35 });
    sky.update(0.01);
    const clearColorLum = sky.cloudMaterial.color.r + sky.cloudMaterial.color.g + sky.cloudMaterial.color.b;
    const clearScale = sky.clouds[0].group.scale.x;
    const clearY = sky.clouds[0].group.position.y;

    sky.setWeatherDynamics({ overcast: 0.9, storminess: 0.8, wind: 1.0 });
    sky.update(0.01);
    const stormColorLum = sky.cloudMaterial.color.r + sky.cloudMaterial.color.g + sky.cloudMaterial.color.b;
    expect(stormColorLum).toBeLessThan(clearColorLum);
    expect(sky.clouds[0].group.scale.x).toBeGreaterThan(clearScale);
    expect(sky.clouds[0].group.position.y).toBeLessThan(clearY);
  });
});

describe('AudioSystem — Música de Fondo Relajante y Silencio', () => {
  it('genera un bucle estéreo de respaldo sin chasquidos y tolera entornos sin Web Audio', async () => {
    const headlessAudio = Object.create(AudioSystem.prototype);
    headlessAudio.listener = { context: null };
    expect(headlessAudio._createAmbientMusicBuffer()).toBeNull();

    const sampleRate = 8000;
    const mockContext = {
      sampleRate,
      state: 'running',
      createBuffer(channels, length, sr) {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        return {
          numberOfChannels: channels,
          length,
          sampleRate: sr,
          getChannelData: (idx) => data[idx]
        };
      }
    };

    const audio = Object.create(AudioSystem.prototype);
    audio.listener = { context: mockContext };
    audio.loadedBuffers = {};
    audio.ambientMusic = createFakeAudioChannel();
    await audio._initAmbientMusic();

    const buf = audio.loadedBuffers.music;
    expect(buf).toBeTruthy();
    expect(buf.numberOfChannels).toBe(2);
    expect(buf.length).toBe(sampleRate * 16);

    const left = buf.getChannelData(0);
    // Amplitud acotada y envolvente suave cerca del inicio para evitar clics de bucle
    expect(Math.abs(left[0])).toBeLessThan(0.02);
    let maxAmp = 0;
    let allFinite = true;
    for (let i = 0; i < left.length; i++) {
      if (!Number.isFinite(left[i])) {
        allFinite = false;
      }
      const abs = Math.abs(left[i]);
      if (abs > maxAmp) maxAmp = abs;
    }
    expect(allFinite).toBe(true);
    expect(maxAmp).toBeGreaterThan(0.02);
    expect(maxAmp).toBeLessThanOrEqual(0.5);
  });

  it('carga /audio/bgm.mp3 y reproduce al completar la decodificación si ya fue desbloqueado', async () => {
    const mp3Buffer = { duration: 120, numberOfChannels: 2 };
    const audio = Object.create(AudioSystem.prototype);
    audio.listener = { context: { state: 'running' } };
    audio.isAudioUnlocked = true;
    audio.isMuted = false;
    audio.isMusicEnabled = true;
    audio.musicPath = '/audio/bgm.mp3';
    audio.loadedBuffers = {};
    audio.ambientMusic = createFakeAudioChannel();
    audio.audioLoader = {
      load: vi.fn((path, onLoad) => {
        expect(path).toBe('/audio/bgm.mp3');
        onLoad(mp3Buffer);
      })
    };

    await audio._initAmbientMusic();
    expect(audio.loadedBuffers.music).toBe(mp3Buffer);
    expect(audio.ambientMusic.buffer).toBe(mp3Buffer);
    expect(audio.ambientMusic.play).toHaveBeenCalledTimes(1);
    expect(audio.ambientMusic.isPlaying).toBe(true);
  });

  it('inicia la música al desbloquear el audio y respeta toggleMute()', async () => {
    const resume = vi.fn(async () => {
      mockContext.state = 'running';
    });
    const mockContext = {
      sampleRate: 4000,
      state: 'suspended',
      resume,
      createBuffer(channels, length, sr) {
        const data = Array.from({ length: channels }, () => new Float32Array(length));
        return {
          numberOfChannels: channels,
          length,
          sampleRate: sr,
          getChannelData: (idx) => data[idx]
        };
      }
    };

    const audio = Object.create(AudioSystem.prototype);
    audio.listener = { context: mockContext };
    audio.isAudioUnlocked = false;
    audio.isMuted = false;
    audio.isMusicEnabled = true;
    audio.loadedBuffers = {};
    audio.positionalWater = createFakeAudioChannel();
    audio.globalSuccess = createFakeAudioChannel();
    audio.ambientMusic = createFakeAudioChannel();
    await audio._initAmbientMusic();

    const unlocked = await audio.unlockAudio();
    expect(unlocked).toBe(true);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(audio.ambientMusic.play).toHaveBeenCalledTimes(1);
    expect(audio.ambientMusic.isPlaying).toBe(true);

    // Silenciar pausa la música; activar de nuevo la reanuda
    const unmutedAfterFirstToggle = audio.toggleMute();
    expect(unmutedAfterFirstToggle).toBe(false);
    expect(audio.ambientMusic.pause).toHaveBeenCalledTimes(1);
    expect(audio.ambientMusic.isPlaying).toBe(false);

    const unmutedAfterSecondToggle = audio.toggleMute();
    expect(unmutedAfterSecondToggle).toBe(true);
    expect(audio.ambientMusic.play).toHaveBeenCalledTimes(2);
    expect(audio.ambientMusic.isPlaying).toBe(true);
  });
});
