import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { WeatherSystem } from '../src/systems/weatherSystem.js';
import { WildlifeSystem } from '../src/systems/wildlifeSystem.js';

function createWeatherFixture() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0d8ef);
  scene.fog = new THREE.Fog(0xa0d8ef, 20, 80);

  const camera = new THREE.PerspectiveCamera(60, 1.33, 0.1, 1000);
  camera.position.set(0, 2, 0);

  const sunLight = new THREE.DirectionalLight(0xfff7e6, 1.2);
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4b7741, 0.6);
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);

  const particleSystem = {
    setSpraying: vi.fn()
  };
  const audioSystem = {
    playSuccess: vi.fn()
  };

  return {
    scene,
    camera,
    sunLight,
    hemiLight,
    ambientLight,
    particleSystem,
    audioSystem
  };
}

describe('WeatherSystem — Clima Dinámico y Lluvia Ligada a Cámara', () => {
  it('inicializa con clima claro y buffer de 550 gotas optimizadas', () => {
    const fixture = createWeatherFixture();
    const weather = new WeatherSystem(fixture);

    expect(weather.currentWeather).toBe('clear');
    expect(weather.rainDropCount).toBe(550);
    expect(weather.rainGeo.attributes.position.count).toBe(550);
    expect(weather.rainMat.opacity).toBe(0.0);
  });

  it('cambia clima a lluvia e interpola opacidad y viento suavemente', () => {
    const fixture = createWeatherFixture();
    const weather = new WeatherSystem(fixture);

    weather.setWeather('rain');
    expect(weather.targetWeather).toBe('rain');

    // Simular 3 segundos de juego
    for (let i = 0; i < 30; i++) {
      weather.update(0.1);
    }

    expect(weather.rainMat.opacity).toBeGreaterThan(0.4);
    expect(weather.windIntensity).toBeGreaterThan(0.35);
  });

  it('activa relámpagos controlados durante tormentas sin memory leaks', () => {
    const fixture = createWeatherFixture();
    const weather = new WeatherSystem(fixture);

    weather.setWeather('storm', true);
    expect(weather.currentWeather).toBe('storm');
    expect(weather.lightningLight).toBeDefined();

    // Forzar el temporizador de relámpagos para dispararlo
    weather.lightningTimer = weather.nextLightningTime + 1;
    weather.update(0.05);

    expect(weather.isLightningActive).toBe(true);
    expect(weather.lightningLight.intensity).toBeGreaterThan(0);
  });
});

describe('WildlifeSystem — Fauna Ligera y Polinizadores', () => {
  it('crea mariposas con aleteo, abejas y luciérnagas', () => {
    const scene = new THREE.Scene();
    const wildlife = new WildlifeSystem(scene);

    expect(wildlife.butterflies.length).toBe(6);
    expect(wildlife.bees.length).toBe(4);
    expect(wildlife.fireflyCount).toBe(35);
    expect(wildlife.fireflyPoints).toBeDefined();
    expect(scene.getObjectByName('wildlife_system')).toBeDefined();
  });

  it('ajusta la visibilidad de luciérnagas entre el día y la noche', () => {
    const scene = new THREE.Scene();
    const wildlife = new WildlifeSystem(scene);

    // De día, luciérnagas apagadas
    wildlife.update(0.1, false);
    expect(wildlife.fireflyMat.opacity).toBeLessThan(0.05);

    // De noche, luciérnagas brillan y se elevan suavemente
    for (let i = 0; i < 20; i++) {
      wildlife.update(0.1, true);
    }
    expect(wildlife.fireflyMat.opacity).toBeGreaterThan(0.5);
  });
});
