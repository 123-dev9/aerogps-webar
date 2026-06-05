/**
 * HUDController
 * 
 * Gestiona el HUD overlay interactivo en pantalla durante la experiencia AR:
 * - Actualización dinámica de métricas (distancia, rumbo, brújula).
 * - Sincronización bidireccional de transformaciones (sliders HUD <-> gestos multitáctiles en 3D).
 * - Despliegue de telemetría de rendimiento y errores en tiempo real.
 */
export class HUDController {
  constructor(gpsService, telemetryService, assetService, onBackCallback) {
    this.gpsService = gpsService;
    this.telemetryService = telemetryService;
    this.assetService = assetService;
    this.onBack = onBackCallback;

    // Elementos del DOM
    this.hudEl = document.getElementById('ar-hud');
    this.compassArrowEl = document.getElementById('compass-arrow');
    this.distanceValEl = document.getElementById('hud-distance');
    this.bearingValEl = document.getElementById('hud-bearing');
    this.modelNameValEl = document.getElementById('hud-model-name');
    this.gpsTargetValEl = document.getElementById('hud-target-gps');
    
    // Telemetría UI
    this.gpsAccuracyEl = document.getElementById('gps-accuracy-text');
    this.deviceHeadingEl = document.getElementById('device-heading-text');
    this.performanceOverlayEl = this.createPerformanceOverlay();

    // Paneles de ajuste (sliders)
    this.sliderPanelEl = document.getElementById('slider-panel');
    this.sliderTitleEl = document.getElementById('slider-title');
    this.sliderValueEl = document.getElementById('slider-value');
    this.sliderInputEl = document.getElementById('slider-input');

    // Estado local de transformación
    this.activeSliderType = null;
    this.state = {
      scale: 15,
      rotation: 0,
      elevation: 0,
      deviceHeading: 0
    };

    // Configuraciones de Sliders
    this.sliderSettings = {
      scale: { title: 'Ajuste de Escala', min: 2, max: 150, step: 1, unit: 'x' },
      rotation: { title: 'Rotación del Objeto', min: 0, max: 360, step: 5, unit: '°' },
      elevation: { title: 'Altura del Objeto', min: -5, max: 10, step: 0.1, unit: 'm' }
    };

    this.initEvents();
  }

  createPerformanceOverlay() {
    // Buscar si ya existe o crearlo dinámicamente
    let el = document.getElementById('hud-performance');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hud-performance';
      el.style.cssText = `
        position: absolute;
        top: 80px;
        left: 16px;
        background: rgba(10, 14, 26, 0.7);
        border: 1px solid var(--border-color);
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 11px;
        font-family: 'Space Grotesk', sans-serif;
        color: var(--text-muted);
        pointer-events: none;
        backdrop-filter: blur(8px);
        display: none;
      `;
      document.body.appendChild(el);
    }
    return el;
  }

  initEvents() {
    // Registrar el botón de volver
    const backBtn = this.hudEl.querySelector('.btn-back');
    if (backBtn) {
      backBtn.onclick = () => {
        if (this.onBack) this.onBack();
      };
    }

    // Registrar los botones del sidebar para sliders
    const scaleBtn = document.getElementById('btn-scale');
    if (scaleBtn) scaleBtn.onclick = () => this.toggleSlider('scale');

    const rotationBtn = document.getElementById('btn-rotation');
    if (rotationBtn) rotationBtn.onclick = () => this.toggleSlider('rotation');

    const elevationBtn = document.getElementById('btn-elevation');
    if (elevationBtn) elevationBtn.onclick = () => this.toggleSlider('elevation');

    // Registrar cambios del slider input
    this.sliderInputEl.oninput = (e) => this.handleSliderUIChange(e.target.value);
  }

  show() {
    const model = this.assetService.getSelectedModel();
    this.state.scale = model.defaultScale.x;
    this.state.elevation = model.defaultElevation;
    this.state.rotation = 0;

    this.modelNameValEl.innerText = model.name;
    const target = this.gpsService.targetCoords;
    this.gpsTargetValEl.innerText = `${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}`;

    this.hudEl.style.display = 'flex';
    this.performanceOverlayEl.style.display = 'block';

    // Suscribirse a los servicios
    this.unsubscribeGPS = this.gpsService.subscribe((data) => this.updateGPSMetrics(data));
    this.unsubscribeTelemetry = this.telemetryService.subscribePerformance((data) => this.updatePerformanceMetrics(data));
    this.unsubscribeError = this.telemetryService.subscribeError((error) => this.displayRuntimeError(error));

    // Suscribirse a orientación de brújula
    this.onOrientationChange = (e) => {
      let heading = e.webkitCompassHeading;
      if (heading === undefined) heading = 360 - e.alpha;
      if (heading !== undefined && heading !== null && !isNaN(heading)) {
        this.state.deviceHeading = Math.round(heading);
        this.deviceHeadingEl.innerText = `Sensor: ${this.state.deviceHeading}°`;
      }
    };
    window.addEventListener('deviceorientation', this.onOrientationChange, true);

    // Enlazar los eventos que emite la entidad 3D para la vinculación bidireccional
    setTimeout(() => {
      this.bindModelGestures();
    }, 1000); // Dar un margen para que A-Frame cree la entidad en el DOM
  }

  hide() {
    this.hudEl.style.display = 'none';
    this.performanceOverlayEl.style.display = 'none';
    this.sliderPanelEl.style.display = 'none';
    this.activeSliderType = null;

    // Desactivar iconos activos
    document.querySelectorAll('.sidebar-tool').forEach(el => el.classList.remove('active'));

    // Desuscribirse
    if (this.unsubscribeGPS) this.unsubscribeGPS();
    if (this.unsubscribeTelemetry) this.unsubscribeTelemetry();
    if (this.unsubscribeError) this.unsubscribeError();
    window.removeEventListener('deviceorientation', this.onOrientationChange, true);

    this.unbindModelGestures();
  }

  bindModelGestures() {
    this.modelEntity = document.getElementById('ar-entity-model');
    if (!this.modelEntity) return;

    this.onModelScale = (e) => {
      this.state.scale = Math.round(e.detail.scale);
      if (this.activeSliderType === 'scale') {
        this.sliderInputEl.value = this.state.scale;
        this.sliderValueEl.innerText = this.state.scale + 'x';
      }
    };

    this.onModelRotation = (e) => {
      this.state.rotation = Math.round(e.detail.rotation);
      if (this.activeSliderType === 'rotation') {
        this.sliderInputEl.value = this.state.rotation;
        this.sliderValueEl.innerText = this.state.rotation + '°';
      }
    };

    this.modelEntity.addEventListener('scale-changed', this.onModelScale);
    this.modelEntity.addEventListener('rotation-changed', this.onModelRotation);
  }

  unbindModelGestures() {
    if (this.modelEntity) {
      this.modelEntity.removeEventListener('scale-changed', this.onModelScale);
      this.modelEntity.removeEventListener('rotation-changed', this.onModelRotation);
    }
  }

  updateGPSMetrics(gpsData) {
    if (gpsData.distance !== null) {
      if (gpsData.distance >= 1000) {
        this.distanceValEl.innerText = `${(gpsData.distance / 1000).toFixed(2)} km`;
      } else {
        this.distanceValEl.innerText = `${gpsData.distance.toFixed(1)} m`;
      }
    }

    if (gpsData.bearing !== null) {
      this.bearingValEl.innerText = `${Math.round(gpsData.bearing)}°`;
      
      // Rotar brújula
      const relativeAngle = (gpsData.bearing - this.state.deviceHeading + 360) % 360;
      this.compassArrowEl.style.transform = `rotate(${relativeAngle}deg)`;
    }

    if (gpsData.accuracy !== null) {
      this.gpsAccuracyEl.innerText = `GPS Precisión: ±${gpsData.accuracy.toFixed(1)}m`;
    }
  }

  updatePerformanceMetrics(telemetryData) {
    // Telemetría en el pequeño cuadro lateral superior izquierdo
    this.performanceOverlayEl.innerHTML = `
      <div style="font-weight: 600; color: #fff; margin-bottom: 2px;">TELEMETRÍA</div>
      <div>FPS: <span style="color: var(--accent-cyan); font-weight: 600;">${telemetryData.fps}</span></div>
      <div>Tracking: <span style="text-transform: uppercase; font-weight: 600; color: ${this.getTrackingColor(telemetryData.trackingStatus)}">${telemetryData.trackingStatus}</span></div>
      ${telemetryData.memory ? `<div>Memoria: <span style="color: #fff;">${telemetryData.memory} MB</span></div>` : ''}
    `;
  }

  getTrackingColor(status) {
    switch (status) {
      case 'tracking': return 'var(--accent-green)';
      case 'calibrating': return '#eab308'; // amarillo
      case 'lost': return '#ef4444'; // rojo
      default: return 'var(--text-muted)';
    }
  }

  displayRuntimeError(error) {
    // Alerta visual de error no intrusivo en el HUD
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: absolute;
      bottom: 250px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(239, 68, 68, 0.9);
      color: #fff;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2);
    `;
    toast.innerText = `Error: ${error.message} (${error.context})`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  toggleSlider(type) {
    // Desactivar herramientas activas previas en UI
    document.querySelectorAll('.sidebar-tool').forEach(el => el.classList.remove('active'));

    if (this.activeSliderType === type) {
      this.sliderPanelEl.style.display = 'none';
      this.activeSliderType = null;
    } else {
      this.activeSliderType = type;
      document.getElementById(`btn-${type}`).parentElement.classList.add('active');

      const settings = this.sliderSettings[type];
      this.sliderTitleEl.innerText = settings.title;
      this.sliderInputEl.min = settings.min;
      this.sliderInputEl.max = settings.max;
      this.sliderInputEl.step = settings.step;

      let currentValue = this.state[type];
      this.sliderInputEl.value = currentValue;
      this.sliderValueEl.innerText = currentValue + settings.unit;

      this.sliderPanelEl.style.display = 'flex';
    }
  }

  handleSliderUIChange(val) {
    const type = this.activeSliderType;
    if (!type) return;

    const settings = this.sliderSettings[type];
    this.state[type] = parseFloat(val);
    this.sliderValueEl.innerText = val + settings.unit;

    if (!this.modelEntity) {
      this.modelEntity = document.getElementById('ar-entity-model');
    }
    if (!this.modelEntity) return;

    if (type === 'scale') {
      this.modelEntity.setAttribute('scale', `${val} ${val} ${val}`);
    } else if (type === 'rotation') {
      this.modelEntity.setAttribute('rotation', `0 ${val} 0`);
    } else if (type === 'elevation') {
      // Modifica la elevación sin perder X y Z
      const currentPos = this.modelEntity.getAttribute('position');
      this.modelEntity.setAttribute('position', `${currentPos.x} ${val} ${currentPos.z}`);
    }
  }
}
