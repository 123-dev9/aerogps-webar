/**
 * ground-indicator component
 * 
 * Muestra una retícula circular (reticle) en el suelo real.
 * Utiliza las APIs de Hit Test de 8th Wall en móvil para detectar planos del suelo,
 * y un fallback de proyección sobre el plano Y=0 para pruebas locales en ordenador.
 */
export const registerGroundIndicator = (telemetryService) => {
  if (AFRAME.components['ground-indicator']) return;

  AFRAME.registerComponent('ground-indicator', {
    schema: {
      enabled: { type: 'boolean', default: true }
    },

    init: function () {
      this.tick = AFRAME.utils.throttleTick(this.tick, 40, this);
      this.el.setAttribute('visible', 'false');
      
      // Orientación horizontal inicial (plana sobre el suelo en A-Frame)
      this.el.setAttribute('rotation', '-90 0 0');
      
      this.raycaster = new THREE.Raycaster();
      this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Plano XZ virtual en Y=0
      this.intersection = new THREE.Vector3();
    },

    tick: function () {
      if (!this.data.enabled) {
        this.el.setAttribute('visible', 'false');
        return;
      }

      // 1. Intento de uso de APIs de 8th Wall (Móvil / WebAR real)
      if (typeof window.XR8 !== 'undefined' && window.XR8.XrController) {
        try {
          const hitResults = window.XR8.XrController.hitTest(
            window.innerWidth / 2,
            window.innerHeight / 2,
            ['surface', 'surface-mesh', 'fallback']
          );

          if (hitResults && hitResults.length > 0) {
            const hit = hitResults[0];
            this.el.setAttribute('position', `${hit.position.x} ${hit.position.y} ${hit.position.z}`);
            this.el.setAttribute('visible', 'true');
            
            // Si el objeto principal no se ha anclado, mandamos evento
            this.el.emit('ground-found', { position: hit.position });
            return;
          }
        } catch (e) {
          telemetryService.logError(e, 'GroundIndicator_HitTest');
        }
      }

      // 2. Fallback de proyección de cámara (Desktop / Pruebas en navegador PC)
      const scene = this.el.sceneEl;
      if (scene && scene.camera) {
        const camera = scene.camera;
        // Raycast en el centro de la pantalla
        const ndc = new THREE.Vector2(0, 0); // (0,0) es el centro
        this.raycaster.setFromCamera(ndc, camera);
        
        // Intersección con el plano Y=0
        if (this.raycaster.ray.intersectPlane(this.plane, this.intersection)) {
          // Solo mostrar si el rayo apunta hacia abajo (el suelo está por debajo de la cámara)
          if (camera.position.y > 0) {
            this.el.setAttribute('position', `${this.intersection.x} 0 ${this.intersection.z}`);
            this.el.setAttribute('visible', 'true');
          } else {
            this.el.setAttribute('visible', 'false');
          }
        }
      } else {
        this.el.setAttribute('visible', 'false');
      }
    }
  });
};
