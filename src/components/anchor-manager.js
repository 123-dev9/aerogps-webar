/**
 * anchor-manager component
 * 
 * Componente de A-Frame que se encarga del algoritmo híbrido GPS-SLAM.
 * Posiciona el objeto 3D en coordenadas locales del motor SLAM basadas en
 * la primera lectura precisa del GPS y de la brújula del dispositivo.
 */
export const registerAnchorManager = (gpsService, telemetryService) => {
  if (AFRAME.components['anchor-manager']) return;

  AFRAME.registerComponent('anchor-manager', {
    schema: {
      lat: { type: 'number' },
      lng: { type: 'number' },
      elevation: { type: 'number', default: 0 }
    },

    init: function () {
      this.isAnchored = false;
      this.initialHeading = null;
      this.gpsService = gpsService;
      this.telemetryService = telemetryService;

      this.onOrientation = this.onOrientation.bind(this);
      
      // Suscribirse a la brújula para capturar la orientación inicial
      if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', this.onOrientation, true);
      } else {
        this.telemetryService.logError("Dispositivo no soporta DeviceOrientationEvent", "AnchorManager");
      }

      // Ocultar entidad hasta que se realice el anclaje
      this.el.setAttribute('visible', 'false');

      // Suscribirse a cambios del GPS
      this.unsubscribeGPS = this.gpsService.subscribe((gpsData) => {
        if (!this.isAnchored && gpsData.userCoords.lat !== null && this.initialHeading !== null) {
          this.anchorObject(gpsData.userCoords, gpsData.bearing, gpsData.distance);
        }
      });
      
      // Escuchar eventos manuales de re-anclaje
      this.el.addEventListener('trigger-reanchor', () => {
        this.reanchor();
      });
    },

    onOrientation: function (event) {
      if (this.initialHeading !== null) return;

      let heading = event.webkitCompassHeading;
      if (heading === undefined) {
        heading = 360 - event.alpha;
      }

      if (heading !== undefined && heading !== null && !isNaN(heading)) {
        this.initialHeading = Math.round(heading);
        // Removemos el handler para evitar recalibraciones accidentales del heading inicial
        window.removeEventListener('deviceorientation', this.onOrientation, true);
      }
    },

    anchorObject: function (userCoords, bearing, distance) {
      if (this.isAnchored || this.initialHeading === null) return;

      // Cálculo del offset relativo basado en el rumbo y orientación inicial de la cámara
      const delta = (bearing - this.initialHeading) * Math.PI / 180;
      const x = distance * Math.sin(delta);
      const z = -distance * Math.cos(delta);
      const y = this.data.elevation;

      // Posicionar físicamente la entidad en la escena SLAM
      this.el.setAttribute('position', `${x} ${y} ${z}`);
      this.el.setAttribute('visible', 'true');
      this.isAnchored = true;

      this.telemetryService.setTrackingStatus("tracking");
      console.log(`[AnchorManager] Objeto posicionado a x: ${x.toFixed(2)}m, z: ${z.toFixed(2)}m. Distancia real: ${distance.toFixed(1)}m. Bearing: ${bearing.toFixed(1)}°`);
      
      // Disparar evento para notificar al HUD/Loader
      this.el.emit('anchor-placed', { x, y, z, distance, bearing });
    },

    reanchor: function () {
      console.log('[AnchorManager] Solicitud de re-anclaje recibida.');
      this.isAnchored = false;
      this.initialHeading = null;
      this.el.setAttribute('visible', 'false');
      
      window.addEventListener('deviceorientation', this.onOrientation, true);
      this.telemetryService.setTrackingStatus("calibrating");
    },

    update: function (oldData) {
      // Si cambian las coordenadas lat/lng desde fuera y ya estábamos anclados, re-anclamos
      if (oldData.lat !== undefined && (oldData.lat !== this.data.lat || oldData.lng !== this.data.lng)) {
        this.reanchor();
      }
    },

    remove: function () {
      if (this.unsubscribeGPS) this.unsubscribeGPS();
      window.removeEventListener('deviceorientation', this.onOrientation, true);
    }
  });
};
