import { GPSService } from './services/gps.js';
import { TelemetryService } from './services/telemetry.js';
import { AssetService } from './services/assets.js';
import { MonumentsService } from './services/monuments.js';
import { CustomPositionsService } from './services/custom-positions.js';

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
const customPositionsService = new CustomPositionsService(monumentsService, gpsService, assetService);

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

  // Llenar selector de modelos en el gestor de posiciones personalizadas
  const customModelSelect = document.getElementById('custom-model-select');
  if (customModelSelect) {
    customModelSelect.innerHTML = assetService.getCatalog().map(model => {
      const emoji = getEmojiForModel(model.id);
      return `<option value="${model.id}">${emoji} ${model.name}</option>`;
    }).join('');
  }

  // Cargar base de datos local de monumentos e iniciar el mapa
  monumentsService.loadMonuments().then(() => {
    mapController = new MapController(gpsService, monumentsService, startARForMonument);
    mapController.initMap('map-container');
  });

  // Activar geolocalización de fondo para actualizar el mapa en vivo y las distancias personalizadas
  gpsService.startTracking(
    (coords) => {
      console.log(`[GPS Track] Lat: ${coords.latitude}, Lng: ${coords.longitude}`);
    },
    (err) => {
      telemetryService.logError(err, 'gpsBackgroundTracking');
    }
  );

  // Suscripción al GPS para actualizar la lista de distancias personalizadas en tiempo real
  gpsService.subscribe((gpsData) => {
    const cpView = document.getElementById('custom-positions-view');
    if (cpView && cpView.style.display !== 'none') {
      const positions = customPositionsService.getPositions();
      positions.forEach(pos => {
        const distEl = document.getElementById(`dist-${pos.id}`);
        if (distEl && gpsData.userCoords.lat !== null) {
          const dist = gpsService.calculateHaversine(gpsData.userCoords.lat, gpsData.userCoords.lng, pos.lat, pos.lng);
          distEl.innerText = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist.toFixed(0)} m`;
        }
      });
    }
  });
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
  
  const customPosView = document.getElementById('custom-positions-view');
  if (customPosView) customPosView.style.display = 'none';

  const specialDemos = document.getElementById('special-demos-view');
  const galleryTitle = document.getElementById('gallery-title');
  const advancedDemos = document.getElementById('advanced-demos-view');
  const advancedTitle = document.getElementById('advanced-gallery-title');
  
  if (specialDemos) specialDemos.style.display = 'none';
  if (galleryTitle) galleryTitle.style.display = 'none';
  if (advancedDemos) advancedDemos.style.display = 'none';
  if (advancedTitle) advancedTitle.style.display = 'none';

  // Mostrar la vista objetivo
  if (viewId === 'dashboard') {
    document.getElementById('dashboard-view').style.display = 'grid';
    if (specialDemos) specialDemos.style.display = 'grid';
    if (galleryTitle) galleryTitle.style.display = 'flex';
    if (advancedDemos) advancedDemos.style.display = 'grid';
    if (advancedTitle) advancedTitle.style.display = 'flex';
  } else {
    const targetView = document.getElementById(`${viewId}-view`);
    if (targetView) {
      targetView.style.display = 'block';
    }
  }

  // Cargar lista de posiciones guardadas si es la vista del gestor
  if (viewId === 'custom-positions') {
    renderCustomPositionsList();
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

// ====================================================
// LOGICA DE POSICIONES PERSONALIZADAS (UI EVENT HANDLERS)
// ====================================================

let editingPositionId = null;

function renderCustomPositionsList() {
  const listContainer = document.getElementById('custom-positions-list');
  if (!listContainer) return;

  const positions = customPositionsService.getPositions();
  if (positions.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 24px; border: 1px dashed var(--border-color); border-radius: 16px; background: rgba(0,0,0,0.1); width: 100%;">
        No tienes posiciones guardadas. ¡Usa el formulario para crear una!
      </div>
    `;
    return;
  }

  const catalog = assetService.getCatalog();
  const userLat = gpsService.userCoords.lat;
  const userLng = gpsService.userCoords.lng;

  listContainer.innerHTML = positions.map(pos => {
    const model = catalog.find(m => m.id === pos.modelo) || { name: pos.modelo };
    const emoji = getEmojiForModel(pos.modelo);
    
    let distanceText = '--';
    if (userLat !== null && userLng !== null) {
      const dist = gpsService.calculateHaversine(userLat, userLng, pos.lat, pos.lng);
      distanceText = dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist.toFixed(0)} m`;
    }

    return `
      <div class="custom-pos-card" id="pos-card-${pos.id}">
        <div class="custom-pos-header">
          <span class="custom-pos-title">${pos.nombre}</span>
          <span class="custom-pos-distance" id="dist-${pos.id}">${distanceText}</span>
        </div>
        <div class="custom-pos-meta">
          <div class="custom-pos-model">
            <span>${emoji}</span>
            <span>${model.name}</span>
          </div>
          <span class="custom-pos-coords">${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}</span>
        </div>
        <div class="custom-pos-actions">
          <button class="btn-card-action btn-card-ar" onclick="startCustomPositionAR('${pos.id}')">
            <i data-lucide="sparkles" style="width: 12px; height: 12px;"></i> Iniciar AR
          </button>
          <button class="btn-card-action btn-card-map" onclick="showCustomPositionOnMap('${pos.id}')">
            <i data-lucide="map" style="width: 12px; height: 12px;"></i> Mapa
          </button>
          <button class="btn-card-action btn-card-edit" onclick="editCustomPosition('${pos.id}')" style="max-width: 36px; flex: none; color: #f59e0b; background: rgba(245, 158, 11, 0.05); border-color: rgba(245, 158, 11, 0.2);">
            <i data-lucide="pencil" style="width: 12px; height: 12px;"></i>
          </button>
          <button class="btn-card-action btn-card-delete" onclick="deleteCustomPosition('${pos.id}')">
            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function getCustomCurrentGPS() {
  const gpsBtn = document.querySelector('#custom-positions-view .btn-gps');
  const origContent = gpsBtn.innerHTML;
  gpsBtn.innerHTML = `<i data-lucide="loader" class="spin" style="width: 16px; height: 16px;"></i> Buscando...`;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  navigator.geolocation.getCurrentPosition(
    (position) => {
      document.getElementById('custom-lat-input').value = position.coords.latitude.toFixed(6);
      document.getElementById('custom-lng-input').value = position.coords.longitude.toFixed(6);
      gpsBtn.innerHTML = origContent;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },
    (err) => {
      telemetryService.logError(err, 'getCustomCurrentGPS');
      alert(`No se pudo obtener el GPS: ${err.message}`);
      gpsBtn.innerHTML = origContent;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

function setCustomOffsetGPS() {
  const offsetBtn = document.querySelector('#custom-positions-view .btn-offset');
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

      document.getElementById('custom-lat-input').value = newLat.toFixed(6);
      document.getElementById('custom-lng-input').value = newLng.toFixed(6);
      
      offsetBtn.innerHTML = origContent;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },
    (err) => {
      telemetryService.logError(err, 'setCustomOffsetGPS');
      alert(`Error de offset: ${err.message}`);
      offsetBtn.innerHTML = origContent;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

function saveNewCustomPosition() {
  const nameInput = document.getElementById('custom-name-input');
  const modelSelect = document.getElementById('custom-model-select');
  const latInput = document.getElementById('custom-lat-input');
  const lngInput = document.getElementById('custom-lng-input');
  const scaleInput = document.getElementById('custom-scale-input');
  const elevationInput = document.getElementById('custom-elevation-input');

  const name = nameInput.value;
  const modelId = modelSelect.value;
  const lat = parseFloat(latInput.value);
  const lng = parseFloat(lngInput.value);
  const scaleMultiplier = parseFloat(scaleInput.value || 1.0);
  const elevation = parseFloat(elevationInput.value || 0.0);

  if (isNaN(lat) || isNaN(lng)) {
    alert('Ingresa coordenadas de latitud y longitud válidas.');
    return;
  }

  if (editingPositionId) {
    customPositionsService.updatePosition(editingPositionId, name, modelId, lat, lng, scaleMultiplier, elevation);
    cancelEditing();
    alert('Posición actualizada correctamente.');
  } else {
    customPositionsService.savePosition(name, modelId, lat, lng, scaleMultiplier, elevation);
    alert('Posición guardada correctamente.');
    
    // Limpiar campos
    nameInput.value = '';
    latInput.value = '';
    lngInput.value = '';
    scaleInput.value = '1.0';
    elevationInput.value = '0.0';
  }

  renderCustomPositionsList();
}

function editCustomPosition(id) {
  const positions = customPositionsService.getPositions();
  const pos = positions.find(p => p.id === id);
  if (pos) {
    editingPositionId = id;
    
    // Cargar campos en el formulario
    document.getElementById('custom-name-input').value = pos.nombre;
    document.getElementById('custom-model-select').value = pos.modelo;
    document.getElementById('custom-lat-input').value = pos.lat;
    document.getElementById('custom-lng-input').value = pos.lng;
    document.getElementById('custom-scale-input').value = pos.scaleMultiplier !== undefined ? pos.scaleMultiplier : 1.0;
    document.getElementById('custom-elevation-input').value = pos.defaultElevation !== undefined ? pos.defaultElevation : 0.0;
    
    // Cambiar el botón principal y añadir el de cancelar
    const saveBtn = document.querySelector('#custom-positions-view .btn-primary');
    if (saveBtn) {
      saveBtn.innerHTML = `<i data-lucide="check" style="width: 16px; height: 16px;"></i> Actualizar Posición`;
      
      let cancelEditBtn = document.getElementById('cancel-edit-btn');
      if (!cancelEditBtn) {
        cancelEditBtn = document.createElement('button');
        cancelEditBtn.id = 'cancel-edit-btn';
        cancelEditBtn.className = 'btn';
        cancelEditBtn.style.cssText = 'width: 100%; margin-top: 8px; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05); color: #f87171;';
        cancelEditBtn.innerHTML = `<i data-lucide="x" style="width: 15px; height: 15px;"></i> Cancelar Edición`;
        saveBtn.parentNode.insertBefore(cancelEditBtn, saveBtn.nextSibling);
        
        cancelEditBtn.onclick = () => {
          cancelEditing();
        };
      }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Subir scroll al formulario
    document.getElementById('custom-positions-view').scrollTop = 0;
  }
}

function cancelEditing() {
  editingPositionId = null;
  document.getElementById('custom-name-input').value = '';
  document.getElementById('custom-lat-input').value = '';
  document.getElementById('custom-lng-input').value = '';
  document.getElementById('custom-scale-input').value = '1.0';
  document.getElementById('custom-elevation-input').value = '0.0';
  
  const saveBtn = document.querySelector('#custom-positions-view .btn-primary');
  if (saveBtn) {
    saveBtn.innerHTML = `<i data-lucide="plus" style="width: 16px; height: 16px;"></i> Guardar Posición`;
  }
  
  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) cancelBtn.remove();
  
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function deleteCustomPosition(id) {
  if (confirm('¿Deseas eliminar esta posición personalizada? Se quitará de tu lista y del mapa.')) {
    customPositionsService.deletePosition(id);
    renderCustomPositionsList();
  }
}

function startCustomPositionAR(id) {
  const positions = customPositionsService.getPositions();
  const pos = positions.find(p => p.id === id);
  if (pos) {
    startARForMonument({
      id: pos.id,
      nombre: pos.nombre,
      lat: pos.lat,
      lng: pos.lng,
      modelo: pos.modelo,
      defaultScale: pos.defaultScale,
      defaultElevation: pos.defaultElevation,
      isCustom: true
    });
  }
}

// Exponer funciones globales
function showCustomPositionOnMap(id) {
  const positions = customPositionsService.getPositions();
  const pos = positions.find(p => p.id === id);
  if (pos && mapController) {
    switchView('map');
    setTimeout(() => {
      mapController.selectMonument(pos.id);
    }, 200);
  }
}

function exportPositionsToText() {
  const jsonString = customPositionsService.exportPositions();
  const textarea = document.getElementById('import-export-area');
  textarea.value = jsonString;
  
  navigator.clipboard.writeText(jsonString).then(() => {
    alert('JSON de posiciones copiado al portapapeles. Puedes pegarlo en el chat.');
  }).catch(err => {
    alert('No se pudo copiar automáticamente. Por favor, copia el texto del cuadro manualmente.');
  });
}

function importPositionsFromText() {
  const textarea = document.getElementById('import-export-area');
  const jsonString = textarea.value;
  if (!jsonString.trim()) {
    alert('Pega un JSON válido en el cuadro de texto para importarlo.');
    return;
  }

  try {
    customPositionsService.importPositions(jsonString);
    textarea.value = '';
    renderCustomPositionsList();
    alert('Posiciones importadas con éxito. Ahora aparecen en tu lista y en el mapa.');
  } catch (e) {
    alert('Error al importar posiciones: ' + e.message);
  }
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

// Exponer las nuevas funciones del gestor de posiciones
window.renderCustomPositionsList = renderCustomPositionsList;
window.getCustomCurrentGPS = getCustomCurrentGPS;
window.setCustomOffsetGPS = setCustomOffsetGPS;
window.saveNewCustomPosition = saveNewCustomPosition;
window.editCustomPosition = editCustomPosition;
window.cancelEditing = cancelEditing;
window.deleteCustomPosition = deleteCustomPosition;
window.startCustomPositionAR = startCustomPositionAR;
window.showCustomPositionOnMap = showCustomPositionOnMap;
window.exportPositionsToText = exportPositionsToText;
window.importPositionsFromText = importPositionsFromText;
