import { GPSService } from './services/gps.js';
import { TelemetryService } from './services/telemetry.js';
import { AssetService } from './services/assets.js';
import { MonumentsService } from './services/monuments.js';

import { registerAnchorManager } from './components/anchor-manager.js';
import { registerGestures } from './components/gestures.js';
import { registerGroundIndicator } from './components/ground-indicator.js';

import { HUDController } from './ui/hud.js';
import { LoaderController } from './ui/loader.js';
import { TutorialController } from './ui/tutorial.js';
import { MapController } from './ui/map.js';

// Instanciar servicios globales
const gpsService = new GPSService();
const telemetryService = new TelemetryService();
const assetService = new AssetService();
const monumentsService = new MonumentsService(gpsService);

// Registrar componentes de A-Frame vinculando servicios
registerAnchorManager(gpsService, telemetryService);
registerGestures();
registerGroundIndicator(telemetryService);

// Inicializar controladores de UI generales
const loaderController = new LoaderController();
const tutorialController = new TutorialController();
let hudController = null;
let mapController = null;

// Registro de Service Worker para soporte offline (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('[PWA] Service Worker registrado con éxito:', reg.scope))
      .catch(err => console.error('[PWA] Error al registrar Service Worker:', err));
  });
}

// Lógica de instalación PWA (Botón Instalar)
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.style.display = 'inline-block';
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Inicializar iconos Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.onclick = () => {
      installBtn.style.display = 'none';
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          console.log(`[PWA] Elección de instalación: ${choiceResult.outcome}`);
          deferredPrompt = null;
        });
      }
    };
  }

  // Cargar base de datos local de monumentos e iniciar el mapa
  monumentsService.loadMonuments().then(() => {
    mapController = new MapController(gpsService, monumentsService, startARForMonument);
    mapController.initMap('map-container');
  });

  // Activar geolocalización de fondo para actualizar el mapa en vivo
  gpsService.startTracking(
    (coords) => {
      console.log(`[GPS Track] Lat: ${coords.latitude}, Lng: ${coords.longitude}`);
    },
    (err) => {
      telemetryService.logError(err, 'gpsBackgroundTracking');
    }
  );
});

// ==========================================
// Handlers de la vista HTML (Configuración / Onclick)
// ==========================================

function selectModel(modelId, desc) {
  assetService.setSelectedModel(modelId);
  document.querySelectorAll('.model-card').forEach(card => card.classList.remove('active'));
  document.getElementById(`card-${modelId}`).classList.add('active');
  console.log(`[Main] Modelo seleccionado manualmente: ${modelId}`);
}

function getCurrentGPS() {
  const gpsBtn = document.querySelector('.btn-gps');
  const origContent = gpsBtn.innerHTML;
  gpsBtn.innerHTML = `<i data-lucide="loader" class="spin" style="width: 16px; height: 16px;"></i> Buscando...`;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  navigator.geolocation.getCurrentPosition(
    (position) => {
      document.getElementById('lat-input').value = position.coords.latitude.toFixed(6);
      document.getElementById('lng-input').value = position.coords.longitude.toFixed(6);
      gpsBtn.innerHTML = origContent;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },
    (err) => {
      telemetryService.logError(err, 'getCurrentGPS');
      alert(`No se pudo obtener el GPS: ${err.message}`);
      gpsBtn.innerHTML = origContent;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

function setOffsetGPS() {
  const offsetBtn = document.querySelector('.btn-offset');
  const origContent = offsetBtn.innerHTML;
  offsetBtn.innerHTML = `<i data-lucide="loader" class="spin" style="width: 16px; height: 16px;"></i> Localizando...`;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      
      const offsetMeters = 5;
      const latOffset = offsetMeters / 111111;
      const newLat = userLat + latOffset;
      const newLng = userLng;

      document.getElementById('lat-input').value = newLat.toFixed(6);
      document.getElementById('lng-input').value = newLng.toFixed(6);
      
      offsetBtn.innerHTML = origContent;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      alert('Coordenadas configuradas a 5 metros al Norte.');
    },
    (err) => {
      telemetryService.logError(err, 'setOffsetGPS');
      alert(`Error de offset: ${err.message}`);
      offsetBtn.innerHTML = origContent;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

/**
 * Inicia la AR de forma manual para coordenadas ingresadas en los inputs
 */
function startAR() {
  const targetLat = parseFloat(document.getElementById('lat-input').value);
  const targetLng = parseFloat(document.getElementById('lng-input').value);

  if (isNaN(targetLat) || isNaN(targetLng)) {
    alert('Ingresa coordenadas de destino válidas.');
    return;
  }

  const selectedModel = assetService.getSelectedModel();
  
  // Convertir entrada manual en un objeto monumento virtual
  const virtualMonument = {
    id: "manual_placement",
    nombre: selectedModel.name,
    lat: targetLat,
    lng: targetLng,
    modelo: selectedModel.id,
    defaultScale: selectedModel.defaultScale,
    defaultElevation: selectedModel.defaultElevation
  };

  startARForMonument(virtualMonument);
}

/**
 * Inicia la escena de Realidad Aumentada para un Monumento específico
 */
function startARForMonument(monument) {
  // Si el mapa está abierto, ocultar panel de detalles
  if (mapController) mapController.hideDrawer();

  // Configurar las coordenadas de destino en el servicio de GPS
  gpsService.setTarget(monument.lat, monument.lng);

  // Mostrar el cargador
  loaderController.show("Calibrando sensores ópticos y anclaje SLAM...");

  // Solicitar orientación en iOS si aplica
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then(state => {
        if (state !== 'granted') console.warn("Orientación denegada.");
      }).catch(console.error);
  }

  // Cargar A-Scene de 8th Wall dinámicamente
  const sceneContainer = document.getElementById('scene-container');
  const modelFile = monument.modelo; // ej. Chair o GeoPlanter

  sceneContainer.innerHTML = `
    <a-scene
      xrweb="disableWorldTracking: false"
      embedded
      renderer="antialias: true; logarithmicDepthBuffer: true; colorManagement: true;"
    >
      <a-assets>
        <a-asset-item id="model-3d" src="./assets/${modelFile}.glb"></a-asset-item>
      </a-assets>

      <!-- Indicador visual del suelo detectado por 8th Wall -->
      <a-entity ground-indicator id="reticle">
        <a-ring color="#06b6d4" radius-inner="0.3" radius-outer="0.4" opacity="0.8"></a-ring>
      </a-entity>

      <!-- Objeto 3D con anclaje híbrido GPS-SLAM y gestos interactivos -->
      <a-entity
        id="ar-entity-model"
        gltf-model="#model-3d"
        anchor-manager="lat: ${monument.lat}; lng: ${monument.lng}; elevation: 0;"
        gesture-controls="minScale: 2; maxScale: 150;"
        scale="15 15 15"
      ></a-entity>

      <a-camera position="0 1.6 0" raycaster="objects: #ar-entity-model" cursor="fuse: false; rayOrigin: mouse;"></a-camera>
    </a-scene>
  `;

  // Transicionar pantallas
  document.getElementById('config-screen').style.opacity = '0';
  setTimeout(() => {
    document.getElementById('config-screen').style.display = 'none';
    sceneContainer.style.display = 'block';

    // Instanciar HUD
    hudController = new HUDController(gpsService, telemetryService, assetService, stopAR);
    hudController.show();
    
    // Sobrescribir nombre del objeto en el HUD
    const hudModelName = document.getElementById('hud-model-name');
    if (hudModelName) hudModelName.innerText = monument.nombre;

    // Mostrar tutorial onboarding
    tutorialController.show();

    // Ocultar loader cuando el anchor esté fijado
    const modelEntity = document.getElementById('ar-entity-model');
    if (modelEntity) {
      modelEntity.addEventListener('anchor-placed', () => {
        loaderController.hide();
      }, { once: true });
    }

    // Timeout de respaldo
    setTimeout(() => {
      loaderController.hide();
    }, 5000);

  }, 500);
}

function stopAR() {
  loaderController.show("Cerrando visor de cámara...");

  // Ocultar HUD y Tutorial
  if (hudController) {
    hudController.hide();
    hudController = null;
  }
  tutorialController.hide();

  // Destruir A-Scene
  const sceneContainer = document.getElementById('scene-container');
  sceneContainer.style.display = 'none';
  sceneContainer.innerHTML = '';

  // Limpiar transmisiones de vídeo colgadas
  document.querySelectorAll('video').forEach(video => {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    video.remove();
  });

  // Mostrar el panel de configuración
  document.getElementById('config-screen').style.display = 'flex';
  setTimeout(() => {
    document.getElementById('config-screen').style.opacity = '1';
    loaderController.hide();
  }, 100);
}

// Exportar al objeto global window
window.selectModel = selectModel;
window.getCurrentGPS = getCurrentGPS;
window.setOffsetGPS = setOffsetGPS;
window.startAR = startAR;
window.stopAR = stopAR;
