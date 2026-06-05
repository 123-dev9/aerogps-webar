/**
 * TutorialController
 * 
 * Gestiona un banner flotante animado de bienvenida y onboarding interactivo.
 * Se muestra la primera vez que el usuario inicia la experiencia AR,
 * guiándole en la calibración y el control de gestos táctiles.
 * Utiliza localStorage para registrar la finalización del onboarding.
 */
export class TutorialController {
  constructor() {
    this.completed = localStorage.getItem('aerogps_tutorial_completed') === 'true';
    this.container = null;
    this.tips = [
      "Mueve el móvil lentamente en círculos para calibrar la cámara y escanear el suelo.",
      "Una vez colocado, arrastra con 1 dedo para mover el objeto por el espacio.",
      "Usa 2 dedos (pellizco) para cambiar la escala y rotarlo libremente."
    ];
    this.currentTipIndex = 0;
    this.tipInterval = null;

    if (!this.completed) {
      this.createTutorialBanner();
    }
  }

  createTutorialBanner() {
    this.container = document.createElement('div');
    this.container.id = 'ar-tutorial';
    this.container.style.cssText = `
      position: absolute;
      top: 85px;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      width: 90%;
      max-width: 360px;
      background: rgba(10, 14, 26, 0.85);
      border: 1px solid var(--accent-cyan);
      box-shadow: 0 0 15px var(--accent-cyan-glow);
      border-radius: 16px;
      padding: 12px 18px;
      color: var(--text-main);
      z-index: 1000;
      text-align: center;
      pointer-events: auto;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      opacity: 0;
      transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    const textEl = document.createElement('p');
    textEl.id = 'tutorial-text';
    textEl.style.cssText = `
      font-size: 13px;
      line-height: 1.5;
      font-weight: 500;
      transition: opacity 0.3s;
    `;
    textEl.innerText = this.tips[0];
    this.container.appendChild(textEl);

    // Botón de cerrar / omitir
    const closeBtn = document.createElement('button');
    closeBtn.innerText = "Entendido";
    closeBtn.style.cssText = `
      margin-top: 10px;
      background: linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%);
      border: none;
      color: #fff;
      padding: 6px 16px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 11px;
      box-shadow: 0 2px 8px var(--primary-glow);
    `;
    closeBtn.onclick = () => this.complete();
    this.container.appendChild(closeBtn);

    document.body.appendChild(this.container);
  }

  show() {
    if (this.completed || !this.container) return;

    // Mostrar con efecto fade-in
    setTimeout(() => {
      this.container.style.opacity = '1';
      this.container.style.transform = 'translateX(-50%) translateY(0)';
    }, 800);

    // Intervalo para rotar las instrucciones
    this.tipInterval = setInterval(() => {
      this.currentTipIndex = (this.currentTipIndex + 1) % this.tips.length;
      const textEl = document.getElementById('tutorial-text');
      if (textEl) {
        textEl.style.opacity = '0';
        setTimeout(() => {
          textEl.innerText = this.tips[this.currentTipIndex];
          textEl.style.opacity = '1';
        }, 300);
      }
    }, 5500);
  }

  hide() {
    if (this.container) {
      this.container.style.opacity = '0';
      this.container.style.transform = 'translateX(-50%) translateY(-20px)';
    }
    if (this.tipInterval) {
      clearInterval(this.tipInterval);
    }
  }

  complete() {
    this.hide();
    localStorage.setItem('aerogps_tutorial_completed', 'true');
    this.completed = true;
    setTimeout(() => {
      if (this.container) {
        this.container.remove();
      }
    }, 500);
  }
}
