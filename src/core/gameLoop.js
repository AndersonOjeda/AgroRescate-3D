/**
 * Bucle Principal de Juego desacoplado con cálculo de Delta Time y FPS
 */
export class GameLoop {
  constructor() {
    this.updateCallbacks = [];
    this.isRunning = false;
    this.animationFrameId = null;
    this.lastTime = performance.now();

    // Métricas de FPS
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
  }

  addUpdateCallback(fn) {
    if (typeof fn === 'function' && !this.updateCallbacks.includes(fn)) {
      this.updateCallbacks.push(fn);
    }
  }

  removeUpdateCallback(fn) {
    this.updateCallbacks = this.updateCallbacks.filter(cb => cb !== fn);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.lastFpsUpdate = performance.now();
    this.frameCount = 0;

    const tick = (now) => {
      if (!this.isRunning) return;

      const rawDelta = (now - this.lastTime) / 1000;
      this.lastTime = now;

      // Limitar delta time para prevenir saltos físicos por congelamiento de pestañas
      const delta = Math.min(Math.max(rawDelta, 0.0001), 0.1);

      // Medición de FPS
      this.frameCount++;
      if (now - this.lastFpsUpdate >= 500) {
        this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
        this.frameCount = 0;
        this.lastFpsUpdate = now;
      }

      for (let i = 0; i < this.updateCallbacks.length; i++) {
        try {
          this.updateCallbacks[i](delta, this.fps);
        } catch (err) {
          console.error('Error en callback de gameLoop:', err);
        }
      }

      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  getFps() {
    return this.fps;
  }
}
