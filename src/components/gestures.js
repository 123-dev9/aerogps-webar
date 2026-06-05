/**
 * gesture-controls component
 * 
 * Componente que gestiona gestos multitáctiles directamente en la escena AR:
 * - Un dedo: Arrastrar el objeto sobre el plano X/Z (desplazamiento).
 * - Dos dedos (pellizco): Cambiar la escala del objeto proporcionalmente.
 * - Dos dedos (rotación): Girar el objeto en el eje Y relativo al ángulo de los dedos.
 */
export const registerGestures = () => {
  if (AFRAME.components['gesture-controls']) return;

  AFRAME.registerComponent('gesture-controls', {
    schema: {
      enabled: { type: 'boolean', default: true },
      minScale: { type: 'number', default: 2 },
      maxScale: { type: 'number', default: 150 },
      sensitivity: { type: 'number', default: 0.015 }
    },

    init: function () {
      this.handleTouchStart = this.handleTouchStart.bind(this);
      this.handleTouchMove = this.handleTouchMove.bind(this);
      this.handleTouchEnd = this.handleTouchEnd.bind(this);

      this.initialScale = this.el.object3D.scale.x;
      this.initialRotation = this.el.object3D.rotation.y;
      this.startDistance = 0;
      this.startAngle = 0;
      this.activeTouches = 0;

      // Adjuntar eventos a la escena de A-Frame
      this.el.sceneEl.addEventListener('touchstart', this.handleTouchStart, { passive: true });
      this.el.sceneEl.addEventListener('touchmove', this.handleTouchMove, { passive: true });
      this.el.sceneEl.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    },

    handleTouchStart: function (e) {
      if (!this.data.enabled) return;

      this.activeTouches = e.touches.length;

      if (e.touches.length === 2) {
        // Inicializar escala y rotación por pellizco
        this.startDistance = this.getTouchDistance(e.touches);
        this.startAngle = this.getTouchAngle(e.touches);
        this.initialScale = this.el.object3D.scale.x;
        this.initialRotation = this.el.object3D.rotation.y;
      } else if (e.touches.length === 1) {
        // Inicializar desplazamiento
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.initialPosition = {
          x: this.el.object3D.position.x,
          y: this.el.object3D.position.y,
          z: this.el.object3D.position.z
        };
      }
    },

    handleTouchMove: function (e) {
      if (!this.data.enabled) return;

      if (e.touches.length === 2 && this.activeTouches === 2) {
        // 1. Escala (Pinch)
        const currentDistance = this.getTouchDistance(e.touches);
        if (this.startDistance > 0) {
          const factor = currentDistance / this.startDistance;
          let newScale = this.initialScale * factor;
          newScale = Math.max(this.data.minScale, Math.min(this.data.maxScale, newScale));
          this.el.setAttribute('scale', `${newScale} ${newScale} ${newScale}`);
          
          // Emitir evento para que el HUD actualice su slider en tiempo real
          this.el.emit('scale-changed', { scale: newScale });
        }

        // 2. Rotación Y (Angle twist)
        const currentAngle = this.getTouchAngle(e.touches);
        const angleDiff = currentAngle - this.startAngle;
        const newRotation = this.initialRotation - angleDiff; // en radianes
        const newRotationDeg = Math.round((newRotation * 180 / Math.PI + 360) % 360);
        this.el.setAttribute('rotation', `0 ${newRotationDeg} 0`);
        
        this.el.emit('rotation-changed', { rotation: newRotationDeg });
      } else if (e.touches.length === 1 && this.activeTouches === 1) {
        // 3. Desplazamiento X/Z relativo a la cámara
        const deltaX = e.touches[0].clientX - this.touchStartX;
        const deltaY = e.touches[0].clientY - this.touchStartY;

        const camera = this.el.sceneEl.camera;
        if (!camera) return;

        // Mover el objeto en relación al ángulo horizontal (Y) de la cámara
        const cameraRotationY = camera.el.object3D.rotation.y;
        
        const cos = Math.cos(cameraRotationY);
        const sin = Math.sin(cameraRotationY);

        // Vectores de desplazamiento
        const moveX = (deltaX * cos - deltaY * sin) * this.data.sensitivity;
        const moveZ = (deltaX * sin + deltaY * cos) * this.data.sensitivity;

        const newX = this.initialPosition.x + moveX;
        const newZ = this.initialPosition.z + moveZ;

        this.el.setAttribute('position', `${newX} ${this.el.object3D.position.y} ${newZ}`);
        this.el.emit('position-changed', { x: newX, z: newZ });
      }
    },

    handleTouchEnd: function (e) {
      this.activeTouches = e.touches.length;
    },

    getTouchDistance: function (touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    },

    getTouchAngle: function (touches) {
      return Math.atan2(
        touches[1].clientY - touches[0].clientY,
        touches[1].clientX - touches[0].clientX
      );
    },

    remove: function () {
      this.el.sceneEl.removeEventListener('touchstart', this.handleTouchStart);
      this.el.sceneEl.removeEventListener('touchmove', this.handleTouchMove);
      this.el.sceneEl.removeEventListener('touchend', this.handleTouchEnd);
    }
  });
};
