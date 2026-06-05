/**
 * LoaderController
 * 
 * Controla los estados de la pantalla de carga e instrucciones de inicialización.
 * Muestra alertas al usuario mientras se calibra la brújula y la señal GPS
 * y oculta el loader cuando el motor SLAM está sincronizado.
 */
export class LoaderController {
  constructor() {
    this.loaderEl = document.getElementById('loading-screen');
    this.loaderTextEl = document.getElementById('loading-text');
  }

  /**
   * Muestra la pantalla de carga con un texto personalizado
   */
  show(text = "Cargando experiencia WebAR...") {
    if (this.loaderTextEl) {
      this.loaderTextEl.innerText = text;
    }
    this.loaderEl.style.display = 'flex';
    this.loaderEl.style.opacity = '1';
  }

  /**
   * Actualiza únicamente el texto sin alterar la visibilidad
   */
  updateText(text) {
    if (this.loaderTextEl) {
      this.loaderTextEl.innerText = text;
    }
  }

  /**
   * Oculta de manera fluida la pantalla de carga
   */
  hide() {
    this.loaderEl.style.opacity = '0';
    setTimeout(() => {
      this.loaderEl.style.display = 'none';
    }, 400); // Dar margen a la animación CSS de fundido
  }
}
