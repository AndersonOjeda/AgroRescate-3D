import GUI from 'lil-gui';

/**
 * Panel de Control y Depuración Académica con lil-gui (Semanas 2 y 4)
 * Permite al profesor inspeccionar en vivo todos los módulos de la rúbrica:
 * Cámaras, Físicas Cannon-es, Partículas GPU, Iluminación PBR, Audio y Simulación.
 */
export class DebugGUI {
  constructor({
    scene,
    sunLight,
    ambientLight,
    hemiLight,
    player,
    farmAdapter,
    physicsWorld,
    particleSystem,
    audioSystem,
    farmLoader,
    multimediaStation,
    hud
  }) {
    this.gui = new GUI({ title: '🌱 AgroRescate 3D — Panel UCC' });
    this.gui.close(); // Plegado por defecto para no tapar el HUD

    // 1. CARPETA: CÁMARA Y NAVEGACIÓN (Semanas 1, 6, 7, 10)
    const fCam = this.gui.addFolder('🎥 Cámara y Navegación');
    const camParams = {
      modo: player.cameraMode === 'orbit' ? 'Órbita Libre' : 'Tercera Persona',
      distancia: player.cameraDistance,
      sensibilidad: player.mouseSensitivity,
      resetSpawn: () => {
        player.setPosition(0, 0, -2);
        hud.showToast('📍 Jugador retornado al punto de inicio', 'info');
      }
    };

    fCam.add(camParams, 'modo', ['Tercera Persona', 'Órbita Libre']).name('Modo Cámara').onChange((val) => {
      player.setCameraMode(val === 'Órbita Libre' ? 'orbit' : 'third-person');
      hud.showToast(`Cámara cambiada a: ${val}`, 'info');
    });

    fCam.add(camParams, 'distancia', 2.0, 15.0, 0.5).name('Distancia 3ra Persona').onChange((val) => {
      player.cameraDistance = val;
    });

    fCam.add(camParams, 'sensibilidad', 0.001, 0.008, 0.0005).name('Sensibilidad Mouse').onChange((val) => {
      player.mouseSensitivity = val;
    });

    fCam.add(camParams, 'resetSpawn').name('🔄 Reaparecer en Inicio');

    // 2. CARPETA: SIMULACIÓN AGRÍCOLA (Compañero 3 & Adaptador)
    const fFarm = this.gui.addFolder('🌾 Simulación Agrícola');
    const farmParams = {
      enfoque: 'precision',
      sembrarTodo: async () => {
        await farmAdapter.plant('plot_1');
        await farmAdapter.plant('plot_2');
        await farmAdapter.plant('plot_3');
        audioSystem.playSuccess();
        hud.showToast('🌱 Todas las parcelas sembradas', 'success');
      },
      regar: async () => {
        await farmAdapter.irrigate();
        particleSystem.setSpraying(true);
        audioSystem.setWaterSound(true);
        hud.showToast('💧 Riego general activado', 'info');
      },
      avanzarDia: async () => {
        const res = await farmAdapter.advanceDay();
        audioSystem.playClick();
        hud.showToast(res.message, 'info');
      },
      cosecharTodo: async () => {
        await farmAdapter.harvest('plot_1');
        await farmAdapter.harvest('plot_2');
        await farmAdapter.harvest('plot_3');
        audioSystem.playSuccess();
        hud.showToast('🌾 Cosecha ejecutada', 'success');
      },
      compostar: async () => {
        const res = await farmAdapter.applyCompost();
        audioSystem.playSuccess();
        hud.showToast(res.message, 'success');
      }
    };

    fFarm.add(farmParams, 'enfoque', ['subsistence', 'precision', 'ecological']).name('Modo Finca').onChange(async (val) => {
      await farmAdapter.initializeFarm(val);
      audioSystem.playSuccess();
      hud.showToast(`Modo agrícola cambiado a: ${val.toUpperCase()}`, 'info');
    });

    fFarm.add(farmParams, 'sembrarTodo').name('🌱 Sembrar Parcelas');
    fFarm.add(farmParams, 'regar').name('💧 Activar Riego');
    fFarm.add(farmParams, 'avanzarDia').name('☀️ Avanzar 1 Día');
    fFarm.add(farmParams, 'cosecharTodo').name('🧺 Cosechar Disponibles');
    fFarm.add(farmParams, 'compostar').name('♻️ Aplicar Abono Orgánico');

    // 3. CARPETA: FÍSICAS CANNON-ES (Semanas 5, 6, 10)
    const fPhys = this.gui.addFolder('📦 Físicas 3D (Cannon-es)');
    const physParams = {
      gravedadY: physicsWorld.world.gravity.y,
      soltarCaja: () => {
        physicsWorld.dropDemoCrate(player.getPosition());
        audioSystem.playClick();
        hud.showToast('📦 Caja dinámica soltada con gravedad y rebote', 'success');
      },
      resetearCajas: () => {
        physicsWorld.resetCrates();
        hud.showToast('🔄 Posiciones de cajas restauradas', 'info');
      }
    };

    fPhys.add(physParams, 'gravedadY', -25, 0, 0.5).name('Gravedad Y (m/s²)').onChange((val) => {
      physicsWorld.world.gravity.set(0, val, 0);
    });

    fPhys.add(physParams, 'soltarCaja').name('📥 Soltar Caja Dinámica');
    fPhys.add(physParams, 'resetearCajas').name('🔄 Resetear Cajas');

    // 4. CARPETA: SISTEMAS DE PARTÍCULAS (Semanas 4, 9, 10)
    const fPart = this.gui.addFolder('🌧️ Sistemas de Partículas GPU');
    const partParams = {
      aspersores: particleSystem.isSpraying,
      lluvia: particleSystem.isRaining
    };

    fPart.add(partParams, 'aspersores').name('Riego por Aspersión').onChange((val) => {
      particleSystem.setSpraying(val);
      audioSystem.setWaterSound(val);
      hud.showToast(val ? 'Aspersores encendidos' : 'Aspersores apagados', 'info');
    });

    fPart.add(partParams, 'lluvia').name('Lluvia Ambiental').onChange((val) => {
      particleSystem.setRaining(val);
      hud.showToast(val ? '🌧️ Lluvia activada' : '☀️ Clima despejado', 'info');
    });

    // 5. CARPETA: ILUMINACIÓN PBR Y ATMÓSFERA (Semanas 2, 4, 7)
    const fLight = this.gui.addFolder('☀️ Iluminación PBR');
    if (sunLight) {
      fLight.add(sunLight, 'intensity', 0.2, 3.0, 0.1).name('Luz Solar (Key Light)');
    }
    if (ambientLight) {
      fLight.add(ambientLight, 'intensity', 0.05, 1.0, 0.05).name('Luz Ambiental (Fill)');
    }
    if (hemiLight) {
      fLight.add(hemiLight, 'intensity', 0.1, 1.5, 0.1).name('Luz Hemisférica');
    }

    // 6. CARPETA: AUDIO ESPACIAL Y MULTIMEDIA (Semanas 3, 9, 10)
    const fAudio = this.gui.addFolder('🔊 Audio 3D y Multimedia');
    const audioParams = {
      silenciar: audioSystem.isMuted,
      probarExito: () => audioSystem.playSuccess(),
      probarClic: () => audioSystem.playClick(),
      pausarPantalla: () => {
        if (multimediaStation) {
          const playing = multimediaStation.togglePlay();
          hud.showToast(playing ? 'Pantalla multimedia reanudada' : 'Pantalla multimedia pausada', 'info');
        }
      }
    };

    fAudio.add(audioParams, 'silenciar').name('Silenciar Audio').onChange(() => {
      audioSystem.toggleMute();
    });
    fAudio.add(audioParams, 'probarExito').name('🔔 Sonido de Éxito (Global)');
    fAudio.add(audioParams, 'probarClic').name('🔘 Sonido de Clic (UI)');
    fAudio.add(audioParams, 'pausarPantalla').name('⏯️ Pausar Pantalla (Semana 3)');

    // 7. CARPETA: ESCENARIO 3D (Semanas 7, 8, 10)
    const fScene = this.gui.addFolder('🏗️ Escenario 3D');
    const sceneParams = {
      modelo: farmLoader.currentEnvironment?.type === 'glb' ? 'Blender (.GLB)' : 'Procedural (Three.js)'
    };

    fScene.add(sceneParams, 'modelo', ['Blender (.GLB)', 'Procedural (Three.js)']).name('Modelo Activo').onChange((val) => {
      const type = val === 'Blender (.GLB)' ? 'glb' : 'procedural';
      farmLoader.switchEnvironment(type);
      hud.showToast(`Escenario cambiado a: ${val}`, 'success');
    });

    this.fCam = fCam;
    this.fFarm = fFarm;
    this.fPhys = fPhys;
    this.fPart = fPart;
    this.fLight = fLight;
    this.fAudio = fAudio;
    this.fScene = fScene;
  }

  show() {
    this.gui.show();
  }

  hide() {
    this.gui.hide();
  }

  toggle() {
    if (this.gui._hidden) {
      this.gui.show();
    } else {
      this.gui.hide();
    }
  }

  destroy() {
    this.gui.destroy();
  }
}
