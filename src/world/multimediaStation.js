import * as THREE from 'three';

/**
 * Estación Multimedia Interactiva (Semana 3) y Portal de Teletransporte (Semana 9)
 *
 * Cumple los requisitos pedagógicos de:
 * - Semana 3: Textura dinámica de video / lienzo interactivo proyectado en 3D (VideoTexture / CanvasTexture)
 *   con reproducción/pausa interactiva para políticas de autoplay.
 * - Semana 9: Portal de teletransporte con TorusGeometry neón, rotación continua y
 *   detección de entrada mediante AABB (Box3) con tiempo de enfriamiento (cooldown).
 */
export class MultimediaStation {
  constructor(scene, position = new THREE.Vector3(2, 0, -4)) {
    this.scene = scene;
    this.position = position;
    this.isPlaying = true;
    this.currentTipIndex = 0;
    this.lastTipChange = 0;
    this.time = 0;

    this.tips = [
      '💧 Riego Inteligente: Optimiza un 45% el consumo hídrico con aspersión localizada.',
      '📡 Sensores IoT: Telemetría en tiempo real de humedad y temperatura radicular.',
      '🌱 Agricultura Orgánica: El compostaje restaura nutrientes y biomasa del suelo.',
      '🌾 Cosecha Sostenible: Rotación de parcelas para evitar la degradación del terreno.'
    ];

    // 1. Crear lienzo 2D en memoria para la textura animada (Video / Canvas Texture)
    if (typeof document !== 'undefined' && document.createElement) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 1024;
      this.canvas.height = 576; // Relación de aspecto 16:9
      this.ctx = this.canvas.getContext('2d');

      this.canvasTexture = new THREE.CanvasTexture(this.canvas);
      this.canvasTexture.minFilter = THREE.LinearFilter;
      this.canvasTexture.magFilter = THREE.LinearFilter;
    } else {
      this.canvas = null;
      this.ctx = null;
      this.canvasTexture = new THREE.Texture();
    }

    // 2. Construir la pantalla 3D
    this.stationGroup = new THREE.Group();
    this.stationGroup.position.copy(this.position);
    this.scene.add(this.stationGroup);

    this._buildScreenMesh();

    // 3. Construir el Portal Cuántico de Teletransporte (Semana 9)
    this._buildTeleportPortal();
  }

  _buildScreenMesh() {
    // Marco exterior de soporte
    const frameGeo = new THREE.BoxGeometry(3.8, 2.3, 0.15);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.2
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 2.1;
    frame.castShadow = true;
    this.stationGroup.add(frame);

    // Pantalla multimedia emisiva con la textura interactiva (Semana 3)
    const screenGeo = new THREE.PlaneGeometry(3.6, 2.1);
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.canvasTexture,
      side: THREE.DoubleSide
    });
    this.screenMesh = new THREE.Mesh(screenGeo, screenMat);
    this.screenMesh.position.set(0, 2.1, 0.08);
    this.stationGroup.add(this.screenMesh);

    // Pedestal cilíndrico metálico
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.0, 16);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 0.5;
    pole.castShadow = true;
    this.stationGroup.add(pole);

    // Base de apoyo en el suelo
    const baseGeo = new THREE.CylinderGeometry(0.6, 0.7, 0.1, 16);
    const base = new THREE.Mesh(baseGeo, poleMat);
    base.position.y = 0.05;
    base.receiveShadow = true;
    this.stationGroup.add(base);
  }

  _buildTeleportPortal() {
    // Portal Neón de la Semana 9 (TorusGeometry con rotación continua)
    const portalGeo = new THREE.TorusGeometry(1.2, 0.12, 16, 48);
    const portalMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true
    });
    this.portalMesh = new THREE.Mesh(portalGeo, portalMat);
    this.portalMesh.position.set(0, 1.8, -12); // Ubicado cerca del perímetro tecnológico
    this.scene.add(this.portalMesh);

    // Caja delimitadora AABB invisible para el trigger de teletransporte
    this.portalBox = new THREE.Box3();
    this.portalBox.setFromCenterAndSize(
      this.portalMesh.position,
      new THREE.Vector3(2.4, 3.2, 2.4)
    );

    this.canTeleport = true;
  }

  /**
   * Actualiza los gráficos del lienzo multimedia y la animación del portal
   */
  update(delta) {
    this.time += delta;

    // 1. Animación del Portal Neón (Semana 9)
    if (this.portalMesh) {
      this.portalMesh.rotation.z += 0.025;
      this.portalMesh.rotation.x = Math.sin(this.time * 2) * 0.1;
    }

    // 2. Renderizar contenido multimedia en el lienzo a 60 FPS si está reproduciendo
    if (this.isPlaying) {
      this._renderCanvasContent();
      this.canvasTexture.needsUpdate = true;
    }
  }

  _renderCanvasContent() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Fondo degradado tecnológico
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Cuadrícula sutil de fondo
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Barra superior
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, w, 60);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('🌱 AGRORESCATE 3D — ESTACIÓN DE TELEMETRÍA EDUCATIVA', 25, 40);

    // Indicador "EN VIVO" parpadeante
    const blink = Math.sin(this.time * 6) > 0;
    ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(w - 120, 32, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('EN VIVO', w - 100, 38);

    // Gráfica de telemetría animada (Onda sinusoidal dinámica simulando humedad del suelo)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 30; x < w - 30; x += 4) {
      const y = 200 + Math.sin(x * 0.015 + this.time * 4) * 35 + Math.cos(x * 0.03 - this.time * 2) * 15;
      if (x === 30) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Relleno transparente bajo la curva
    ctx.lineTo(w - 30, 290);
    ctx.lineTo(30, 290);
    ctx.closePath();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fill();

    // Panel de métricas inferiores
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.fillRect(30, 320, w - 60, 95);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(30, 320, w - 60, 95);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px monospace';
    ctx.fillText('Humedad Suelo: 68% [ÓPTIMO]', 50, 355);
    ctx.fillText('Eficiencia Hídrica: 92% [A+]', 50, 385);
    ctx.fillText('Radiación Solar: 4.8 kWh/m²', 520, 355);
    ctx.fillText('Salud Microbiana: 88% [ALTA]', 520, 385);

    // Tip educativo rotativo
    if (this.time - this.lastTipChange > 4.5) {
      this.currentTipIndex = (this.currentTipIndex + 1) % this.tips.length;
      this.lastTipChange = this.time;
    }

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('💡 ' + this.tips[this.currentTipIndex], 30, 470);

    // Pie con control de estado
    ctx.fillStyle = '#64748b';
    ctx.font = '15px monospace';
    ctx.fillText('Presiona [E] frente a la pantalla para pausar/reanudar el canal de telemetría', 30, 525);
  }

  /**
   * Alterna entre reproducir y pausar el contenido multimedia
   */
  togglePlay() {
    this.isPlaying = !this.isPlaying;
    return this.isPlaying;
  }

  /**
   * Comprueba si el jugador o la cámara ha ingresado al portal de teletransporte (Semana 9)
   */
  checkTeleport(targetPosition) {
    if (!this.canTeleport || !this.portalBox || !targetPosition) return false;

    if (this.portalBox.containsPoint(targetPosition)) {
      this.canTeleport = false;
      setTimeout(() => {
        this.canTeleport = true;
      }, 3500); // Cooldown de 3.5 segundos como enseñó el profesor
      return true;
    }
    return false;
  }
}
