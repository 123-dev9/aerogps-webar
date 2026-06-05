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

  // Generar lista de personajes animada dinámicamente en el HTML
  const characterContainer = document.getElementById('character-list-container');
  if (characterContainer) {
    characterContainer.innerHTML = assetService.getCatalog().map((model, idx) => {
      const emoji = getEmojiForModel(model.id);
      return `
        <div class="character-card ${model.id === 'Dragon' ? 'active' : ''}" onclick="selectCharacter('${model.id}')" id="char-card-${model.id}">
          <div class="character-card-icon">${emoji}</div>
          <div class="character-card-name">${model.name}</div>
          <div class="character-card-file">${model.file}</div>
        </div>
      `;
    }).join('');
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

// Helper de iconos emoji para el catálogo
function getEmojiForModel(id) {
  switch (id) {
    case 'Chair': return '🪑';
    case 'GeoPlanter': return '🪴';
    case 'Dragon': return '🐉';
    case 'charizard_flying_animation': return '🔥';
    case 'FerrisWheel': return '🎡';
    case 'Bat': return '🦇';
    case 'toon-bat': return '🦇';
    case 'Sweeper': return '🤖';
    case 'girl_look_around': return '👩';
    case 'paul_talking_business': return '👨';
    case 'pokemon_3ds_meowth': return '🐱';
    case 'pokemon_3ds_scizor': return '✂️';
    case 'pokemon_pokedex_3d_pro_infernape': return '🐒';
    default: return '📦';
  }
}

// ==========================================
// Ruteador y Navegación SPA
// ==========================================

function switchView(viewId) {
  // Ocultar todas las sub-vistas del panel principal
  document.getElementById('dashboard-view').style.display = 'none';
  document.getElementById('map-view').style.display = 'none';
  document.getElementById('character-view').style.display = 'none';
  document.getElementById('sandbox-view').style.display = 'none';

  const specialDemos = document.getElementById('special-demos-view');
  const galleryTitle = document.getElementById('gallery-title');
  if (specialDemos) specialDemos.style.display = 'none';
  if (galleryTitle) galleryTitle.style.display = 'none';

  // Mostrar la vista objetivo
  if (viewId === 'dashboard') {
    document.getElementById('dashboard-view').style.display = 'grid';
    if (specialDemos) specialDemos.style.display = 'grid';
    if (galleryTitle) galleryTitle.style.display = 'flex';
  } else {
    const targetView = document.getElementById(`${viewId}-view`);
    if (targetView) {
      targetView.style.display = 'block';
    }
  }

  // Si abrimos la vista del mapa, necesitamos forzar el redimensionado en MapLibre GL
  if (viewId === 'map' && mapController && mapController.map) {
    setTimeout(() => {
      mapController.map.resize();
    }, 100);
  }

  // Refrescar iconos Lucide inyectados
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Control del personaje seleccionado
let selectedCharacterId = 'Dragon';

function selectCharacter(id) {
  selectedCharacterId = id;
  document.querySelectorAll('.character-card').forEach(card => card.classList.remove('active'));
  const activeCard = document.getElementById(`char-card-${id}`);
  if (activeCard) activeCard.classList.add('active');
  console.log(`[Main] Personaje seleccionado: ${id}`);
}

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
 * Inicia la escena de Realidad Aumentada para un Monumento o Personaje específico
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
  let modelFile = monument.modelo; // ej. Chair o Dragon
  if (!modelFile.endsWith('.glb')) {
    modelFile = `${modelFile}.glb`;
  }

  const defaultScaleVal = monument.defaultScale ? monument.defaultScale.x : 15;
  const defaultElevationVal = monument.defaultElevation !== undefined ? monument.defaultElevation : 0;
  const scaleAttr = `${defaultScaleVal} ${defaultScaleVal} ${defaultScaleVal}`;
  
  // Comprobar si es un modelo animado
  const isAnimated = monument.isAnimated || (monument.id !== 'Chair' && monument.id !== 'GeoPlanter');
  const animationMixerAttr = isAnimated ? 'animation-mixer' : '';

  sceneContainer.innerHTML = `
    <a-scene
      xrweb="disableWorldTracking: false"
      embedded
      renderer="antialias: true; logarithmicDepthBuffer: true; colorManagement: true;"
    >
      <a-assets>
        <a-asset-item id="model-3d" src="./assets/${modelFile}"></a-asset-item>
      </a-assets>

      <!-- Indicador visual del suelo detectado por 8th Wall -->
      <a-entity ground-indicator id="reticle">
        <a-ring color="#06b6d4" radius-inner="0.3" radius-outer="0.4" opacity="0.8"></a-ring>
      </a-entity>

      <!-- Objeto 3D con anclaje híbrido GPS-SLAM y gestos interactivos -->
      <a-entity
        id="ar-entity-model"
        gltf-model="#model-3d"
        anchor-manager="lat: ${monument.lat}; lng: ${monument.lng}; elevation: ${defaultElevationVal};"
        gesture-controls="minScale: ${defaultScaleVal * 0.1}; maxScale: ${defaultScaleVal * 10};"
        scale="${scaleAttr}"
        ${animationMixerAttr}
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

/**
 * Inicia la AR para el personaje animado seleccionado
 */
function startCharacterAR() {
  const model = assetService.getCatalog().find(m => m.id === selectedCharacterId);
  if (!model) return;

  const userLat = gpsService.userCoords.lat !== null ? gpsService.userCoords.lat : 41.296611;
  const userLng = gpsService.userCoords.lng !== null ? gpsService.userCoords.lng : 2.760382;

  const virtualMonument = {
    id: model.id,
    nombre: model.name,
    lat: userLat,
    lng: userLng,
    modelo: model.id,
    defaultScale: model.defaultScale,
    defaultElevation: model.defaultElevation,
    isAnimated: true
  };

  startARForMonument(virtualMonument);
}

/**
 * Inicia la escena del Multiverso AR con 4 modelos distribuidos
 */
function startMultiversoAR() {
  if (mapController) mapController.hideDrawer();

  const centerLat = gpsService.userCoords.lat !== null ? gpsService.userCoords.lat : 41.296611;
  const centerLng = gpsService.userCoords.lng !== null ? gpsService.userCoords.lng : 2.760382;

  gpsService.setTarget(centerLat, centerLng);
  loaderController.show("Iniciando Multiverso 3D (4 objetos animados)...");

  // Distribuir 4m en direcciones cardinales
  const latOffset = 4 / 111111;
  const lngOffset = 4 / (111111 * Math.cos(centerLat * Math.PI / 180));

  const northLat = centerLat + latOffset, northLng = centerLng;
  const southLat = centerLat - latOffset, southLng = centerLng;
  const eastLat = centerLat, eastLng = centerLng + lngOffset;
  const westLat = centerLat, westLng = centerLng - lngOffset;

  const sceneContainer = document.getElementById('scene-container');
  sceneContainer.innerHTML = `
    <a-scene
      xrweb="disableWorldTracking: false"
      embedded
      renderer="antialias: true; logarithmicDepthBuffer: true; colorManagement: true;"
    >
      <a-assets>
        <a-asset-item id="model-dragon" src="./assets/Dragon.glb"></a-asset-item>
        <a-asset-item id="model-ferris" src="./assets/FerrisWheel.glb"></a-asset-item>
        <a-asset-item id="model-bat" src="./assets/Bat.glb"></a-asset-item>
        <a-asset-item id="model-sweeper" src="./assets/Sweeper.glb"></a-asset-item>
      </a-assets>

      <!-- Indicador visual del suelo detectado por 8th Wall -->
      <a-entity ground-indicator id="reticle">
        <a-ring color="#06b6d4" radius-inner="0.3" radius-outer="0.4" opacity="0.8"></a-ring>
      </a-entity>

      <!-- OBJETO 1: Dragón (4m al Norte) -->
      <a-entity
        id="entity-dragon"
        gltf-model="#model-dragon"
        anchor-manager="lat: ${northLat}; lng: ${northLng}; elevation: 1.2;"
        gesture-controls="minScale: 0.05; maxScale: 15; sensitivity: 0.005;"
        scale="0.6 0.6 0.6"
        animation-mixer
      >
        <a-text value="Dragon Volador" position="0 2.2 0" align="center" color="#06b6d4" width="4" wrap-count="15"></a-text>
      </a-entity>

      <!-- OBJETO 2: Noria (4m al Sur) -->
      <a-entity
        id="entity-ferris"
        gltf-model="#model-ferris"
        anchor-manager="lat: ${southLat}; lng: ${southLng}; elevation: 0;"
        gesture-controls="minScale: 0.01; maxScale: 5; sensitivity: 0.002;"
        scale="0.15 0.15 0.15"
        animation-mixer
      >
        <a-text value="Noria Gigante" position="0 3.2 0" align="center" color="#10b981" width="4" wrap-count="15"></a-text>
      </a-entity>

      <!-- OBJETO 3: Murciélago (4m al Este) -->
      <a-entity
        id="entity-bat"
        gltf-model="#model-bat"
        anchor-manager="lat: ${eastLat}; lng: ${eastLng}; elevation: 1.5;"
        gesture-controls="minScale: 0.05; maxScale: 15; sensitivity: 0.005;"
        scale="0.6 0.6 0.6"
        animation-mixer
      >
        <a-text value="Murcielago" position="0 1.2 0" align="center" color="#f43f5e" width="4" wrap-count="15"></a-text>
      </a-entity>

      <!-- OBJETO 4: Robot Barredor (4m al Oeste) -->
      <a-entity
        id="entity-sweeper"
        gltf-model="#model-sweeper"
        anchor-manager="lat: ${westLat}; lng: ${westLng}; elevation: 0;"
        gesture-controls="minScale: 0.05; maxScale: 15; sensitivity: 0.005;"
        scale="0.6 0.6 0.6"
        animation-mixer
      >
        <a-text value="Robot Barredor" position="0 1.5 0" align="center" color="#a855f7" width="4" wrap-count="15"></a-text>
      </a-entity>

      <a-camera position="0 1.6 0" raycaster="objects: #entity-dragon, #entity-ferris, #entity-bat, #entity-sweeper" cursor="fuse: false; rayOrigin: mouse;"></a-camera>
    </a-scene>
  `;

  document.getElementById('config-screen').style.opacity = '0';
  setTimeout(() => {
    document.getElementById('config-screen').style.display = 'none';
    sceneContainer.style.display = 'block';

    hudController = new HUDController(gpsService, telemetryService, assetService, stopAR);
    hudController.show();
    
    const hudModelName = document.getElementById('hud-model-name');
    if (hudModelName) hudModelName.innerText = "Multiverso 3D";

    tutorialController.show();

    const firstEntity = document.getElementById('entity-dragon');
    if (firstEntity) {
      firstEntity.addEventListener('anchor-placed', () => {
        loaderController.hide();
      }, { once: true });
    }

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

// Exportar al objeto global window para enlaces HTML
window.selectModel = selectModel;
window.getCurrentGPS = getCurrentGPS;
window.setOffsetGPS = setOffsetGPS;
window.startAR = startAR;
window.stopAR = stopAR;
window.switchView = switchView;
window.selectCharacter = selectCharacter;
window.startCharacterAR = startCharacterAR;
window.startMultiversoAR = startMultiversoAR;
