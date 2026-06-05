/**
 * TelemetryService
 * Se encarga del monitoreo de rendimiento en tiempo real (FPS, tracking status,
 * consumo de recursos) y la gestión centralizada de excepciones y logs de error.
 */
export class TelemetryService {
  constructor() {
    this.fps = 0;
    this.lastTime = performance.now();
    this.frames = 0;
    this.trackingStatus = "initializing"; // 'initializing', 'tracking', 'lost', 'failed'
    this.errors = [];
    this.performanceSubscribers = new Set();
    this.errorSubscribers = new Set();

    this.startFPSCounter();
    this.setupGlobalErrorHandler();
  }

  startFPSCounter() {
    const measure = () => {
      this.frames++;
      const now = performance.now();
      if (now >= this.lastTime + 1000) {
        this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
        this.frames = 0;
        this.lastTime = now;
        this.notifyPerformance();
      }
      requestAnimationFrame(measure);
    };
    requestAnimationFrame(measure);
  }

  setTrackingStatus(status) {
    this.trackingStatus = status;
    this.notifyPerformance();
  }

  /**
   * Captura y registra errores en la consola y notifica a los componentes visuales
   */
  logError(error, context = "general") {
    console.error(`[Telemetry Error] Contexto: ${context} ->`, error);
    const errorDetail = {
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      context
    };
    this.errors.push(errorDetail);
    this.notifyError(errorDetail);
  }

  setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
      this.logError(event.error || event.message, 'unhandled_runtime');
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.logError(event.reason, 'unhandled_promise');
    });
  }

  subscribePerformance(callback) {
    this.performanceSubscribers.add(callback);
    return () => this.performanceSubscribers.delete(callback);
  }

  subscribeError(callback) {
    this.errorSubscribers.add(callback);
    return () => this.errorSubscribers.delete(callback);
  }

  notifyPerformance() {
    // performance.memory está disponible principalmente en Chrome/Android
    const memoryUsage = window.performance && window.performance.memory
      ? Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024)
      : null;

    const data = {
      fps: this.fps,
      trackingStatus: this.trackingStatus,
      memory: memoryUsage
    };

    for (const callback of this.performanceSubscribers) {
      callback(data);
    }
  }

  notifyError(errorDetail) {
    for (const callback of this.errorSubscribers) {
      callback(errorDetail);
    }
  }
}
