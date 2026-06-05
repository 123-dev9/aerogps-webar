/**
 * MapController
 * 
 * Gestiona el mapa interactivo 2D utilizando MapLibre GL:
 * - Dibuja el marcador animado del turista en tiempo real.
 * - Pinta marcadores personalizados para los monumentos.
 * - Abre el cajón inferior (Drawer) con la información del monumento seleccionado y
 *   habilita el botón de "Iniciar AR" basándose en la distancia de proximidad real.
 */
export class MapController {
  constructor(gpsService, monumentsService, onStartARCallback) {
    this.gpsService = gpsService;
    this.monumentsService = monumentsService;
    this.onStartAR = onStartARCallback;
    this.map = null;
    this.userMarker = null;
    this.monumentMarkers = new Map();
    this.selectedMonumentId = null;

    // Elementos del DOM para la ficha informativa
    this.drawerEl = this.createMonumentDrawer();
    
    // Bandera para permitir pruebas desde cualquier lugar (Modo Simulación)
    this.developerMode = true; // Por defecto true para facilitar pruebas locales
  }

  createMonumentDrawer() {
    let el = document.getElementById('monument-drawer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'monument-drawer';
      el.style.cssText = `
        position: absolute;
        bottom: -300px;
        left: 50%;
        transform: translateX(-50%);
        width: 90%;
        max-width: 420px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 24px 24px 20px 20px;
        padding: 20px;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
        z-index: 100;
        transition: bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        gap: 12px;
      `;
      document.body.appendChild(el);
    }
    return el;
  }

  initMap(containerId) {
    // Si MapLibre no está cargado en el HTML, cancelamos
    if (typeof maplibregl === 'undefined') {
      console.error("[MapController] MapLibre GL no está cargado.");
      return;
    }

    // Centro inicial: Catedral de Girona
    const initialCenter = [2.826359, 41.987679];

    // Estilo personalizado oscuro (CARTO Dark Matter raster tiles)
    const style = {
      version: 8,
      sources: {
        'carto-dark': {
          type: 'raster',
          tiles: ['https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors, &copy; CARTO'
        }
      },
      layers: [
        {
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 20
        }
      ]
    };

    this.map = new maplibregl.Map({
      container: containerId,
      style: style,
      center: initialCenter,
      zoom: 14,
      pitch: 0,
      bearing: 0
    });

    // Añadir controles de zoom
    this.map.addControl(new maplibregl.NavigationControl(), 'top-left');

    // Suscribirse a las actualizaciones de monumentos (que reaccionan al GPS)
    this.unsubscribeMonuments = this.monumentsService.subscribe((list) => {
      this.updateMarkers(list);
      this.updateDrawerInfo(list);
    });

    // Suscribirse al GPS para reposicionar el marcador del usuario
    this.unsubscribeGPS = this.gpsService.subscribe((gpsData) => {
      if (gpsData.userCoords.lat !== null) {
        this.updateUserMarker(gpsData.userCoords.lat, gpsData.userCoords.lng);
      }
    });

    // Cerrar el panel si se hace click en el mapa vacío
    this.map.on('click', (e) => {
      // Ignorar clicks sobre marcadores
      if (e.originalEvent.target.closest('.mapboxgl-marker')) return;
      this.hideDrawer();
    });
  }

  updateUserMarker(lat, lng) {
    if (!this.map) return;

    const coords = [lng, lat];

    if (!this.userMarker) {
      // Crear elemento HTML personalizado para el indicador azul de ubicación
      const el = document.createElement('div');
      el.className = 'user-gps-marker';
      el.style.cssText = `
        width: 16px;
        height: 16px;
        background: var(--accent-cyan);
        border: 2.5px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 12px var(--accent-cyan-glow);
        animation: pulse-marker 1.8s infinite;
      `;

      // Definir la animación del punto pulsante
      const styleEl = document.createElement('style');
      styleEl.innerHTML = `
        @keyframes pulse-marker {
          0% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(6, 182, 212, 0); }
          100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); }
        }
      `;
      document.head.appendChild(styleEl);

      this.userMarker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(this.map);
    } else {
      this.userMarker.setLngLat(coords);
    }
  }

  updateMarkers(monumentsList) {
    if (!this.map) return;

    monumentsList.forEach((monument) => {
      if (!this.monumentMarkers.has(monument.id)) {
        // Marcador HTML personalizado (estilo pin futurista)
        const el = document.createElement('div');
        el.className = `monument-marker pin-${monument.id}`;
        el.style.cssText = `
          width: 32px;
          height: 32px;
          background: rgba(10, 14, 26, 0.85);
          border: 2px solid ${monument.inRange ? 'var(--accent-green)' : 'var(--primary)'};
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        `;

        const iconEl = document.createElement('div');
        iconEl.innerHTML = `📍`;
        iconEl.style.cssText = `
          transform: rotate(45deg);
          font-size: 14px;
        `;
        el.appendChild(iconEl);

        // Click en el marcador
        el.onclick = (e) => {
          e.stopPropagation();
          this.selectMonument(monument.id);
        };

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([monument.lng, monument.lat])
          .addTo(this.map);

        this.monumentMarkers.set(monument.id, marker);
      } else {
        // Actualizar color de borde según el rango
        const marker = this.monumentMarkers.get(monument.id);
        const el = marker.getElement();
        el.style.borderColor = monument.inRange ? 'var(--accent-green)' : 'var(--primary)';
      }
    });
  }

  selectMonument(id) {
    this.selectedMonumentId = id;
    const list = this.monumentsService.getMonumentsWithDistances();
    this.updateDrawerInfo(list);
    
    // Centrar mapa en el monumento seleccionado
    const monument = list.find(m => m.id === id);
    if (monument && this.map) {
      this.map.easeTo({
        center: [monument.lng, monument.lat],
        zoom: 16,
        duration: 800
      });
    }
  }

  updateDrawerInfo(monumentsList) {
    if (!this.selectedMonumentId) return;

    const monument = monumentsList.find(m => m.id === this.selectedMonumentId);
    if (!monument) return;

    const distanceText = monument.distance !== null
      ? (monument.distance >= 1000 ? `${(monument.distance / 1000).toFixed(2)} km` : `${monument.distance.toFixed(0)} m`)
      : 'Calculando distancia...';

    // Determinar si habilitamos el botón AR
    const canStartAR = monument.inRange || this.developerMode;

    this.drawerEl.innerHTML = `
      <div style="width: 40px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; align-self: center; margin-bottom: 4px;"></div>
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <h2 style="font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700; color: #fff;">${monument.nombre}</h2>
          <p style="font-size: 11px; text-transform: uppercase; color: var(--accent-cyan); font-weight: 600; letter-spacing: 0.5px; margin-top: 2px;">
            Distancia: ${distanceText}
          </p>
        </div>
        <button id="close-drawer-btn" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size: 18px;">&times;</button>
      </div>
      <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin: 4px 0 10px 0;">${monument.descripcion}</p>
      
      ${!canStartAR ? `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px dashed rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 10px 14px; text-align: center; font-size: 11px; color: #ef4444; font-weight: 600;">
          ⚠️ Acércate a menos de 50 metros del monumento para desbloquear la AR.
        </div>
      ` : ''}

      <button id="start-ar-btn" class="btn btn-primary" style="margin-top: 4px; ${!canStartAR ? 'opacity: 0.5; pointer-events: none; filter: grayscale(1);' : ''}">
        <i data-lucide="sparkles" style="width: 16px; height: 16px;"></i>
        INICIAR EXPERIENCIA AR
      </button>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Evento de cerrar drawer
    const closeBtn = this.drawerEl.querySelector('#close-drawer-btn');
    if (closeBtn) closeBtn.onclick = () => this.hideDrawer();

    // Evento de iniciar AR
    const startArBtn = this.drawerEl.querySelector('#start-ar-btn');
    if (startArBtn && canStartAR) {
      startArBtn.onclick = () => {
        this.hideDrawer();
        if (this.onStartAR) this.onStartAR(monument);
      };
    }

    // Mostrar deslizándolo hacia arriba
    this.drawerEl.style.bottom = '16px';
  }

  hideDrawer() {
    this.drawerEl.style.bottom = '-300px';
    this.selectedMonumentId = null;
  }

  destroy() {
    this.hideDrawer();
    if (this.unsubscribeMonuments) this.unsubscribeMonuments();
    if (this.unsubscribeGPS) this.unsubscribeGPS();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.userMarker = null;
    this.monumentMarkers.clear();
  }
}
