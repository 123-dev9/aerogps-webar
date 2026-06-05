# AeroGPS WebAR 🌍✨

Una aplicación web de **Realidad Aumentada (WebAR) basada en localización (GPS)** y de código abierto. Permite posicionar modelos 3D (`.glb`) en coordenadas GPS del mundo real y verlos en tiempo real utilizando el navegador del teléfono móvil, sin necesidad de instalar ninguna aplicación nativa.

## 🚀 Características principales

- **Selector de modelos 3D:** Tarjetas interactivas para elegir entre diferentes objetos (por ejemplo, una Silla de diseño o una Jardinera geométrica).
- **Fórmula de Haversine integrada:** Calcula la distancia exacta en metros/kilómetros desde la posición GPS actual del usuario hasta el objeto 3D.
- **Brújula de navegación HUD:** Una aguja en pantalla apunta dinámicamente hacia la dirección física donde está el modelo 3D (utilizando la combinación de la brújula interna del móvil y el cálculo del rumbo/bearing).
- **Herramientas de ajuste en tiempo real (HUD):**
  - **Escala:** Amplía o reduce el tamaño del modelo 3D directamente en pantalla.
  - **Rotación:** Gira el objeto en Y para alinearlo visualmente.
  - **Altura:** Eleva o entierra el objeto para que coincida perfectamente con el suelo real.
- **Colocación con Offset (Recomendado):** Calcula de forma inteligente una coordenada de destino a **5 metros al Norte** de tu ubicación actual para facilitar las pruebas rápidas sin aparecer dentro del propio objeto 3D.

---

## 🛠️ Tecnologías utilizadas

1. **[AR.js](https://github.com/AR-js-org/AR.js):** Motor de realidad aumentada ligero y de código abierto para la web.
2. **[A-Frame](https://aframe.io/):** Framework web para crear experiencias de realidad virtual y 3D declarativas.
3. **HTML5 Geolocation API:** Para obtener las coordenadas GPS del dispositivo en tiempo real.
4. **Device Orientation API:** Para calibrar la rotación del móvil y alimentar la brújula HUD.
5. **Lucide Icons & Google Fonts (Outfit / Space Grotesk):** Para una interfaz limpia, moderna y con efecto *glassmorphism* (vidrio esmerilado).

---

## 💻 Instrucciones para correr en Local

### 1. Requisito de Seguridad (MANDATORIO)
Los navegadores móviles **bloquean la cámara y el GPS** si no se accede mediante una conexión **HTTPS** segura. Para probarlo en tu móvil, debes usar un servidor local seguro o un túnel.

### 2. Levantar servidor local
En la carpeta del proyecto, ejecuta:
```bash
npx serve
```
*Esto iniciará un servidor local en `http://localhost:3000` (o similar).*

### 3. Crear un túnel HTTPS (para pruebas en el móvil)
Usa **ngrok** para exponer tu servidor local a Internet bajo HTTPS:
```bash
ngrok http 3000
```
Copia el enlace seguro `https://xxxxxxxx.ngrok-free.app` y ábrelo en el navegador de tu móvil.

---

## 🌐 Despliegue en GitHub Pages (Gratuito)

La forma más fácil de compartir tu aplicación y tener HTTPS gratis de forma permanente es a través de **GitHub Pages**:

1. Crea un repositorio en tu cuenta de GitHub (por ejemplo, `aerogps-webar`).
2. Sube estos archivos a la rama principal (`main`).
3. Ve a la pestaña **Settings** (Configuración) de tu repositorio en GitHub.
4. Busca la sección **Pages** en el menú izquierdo.
5. Bajo **Build and deployment**, selecciona la rama `main` y haz clic en **Save** (Guardar).
6. En un par de minutos, GitHub te dará un enlace seguro `https://tu-usuario.github.io/aerogps-webar/` que podrás abrir directamente en cualquier móvil.

---

## 📂 Estructura del Proyecto

```
.
├── index.html          # Código fuente principal (Frontend & Lógica AR)
├── README.md           # Documentación del proyecto
└── assets/             # Modelos 3D en formato GLTF/GLB
    ├── Chair.glb       # Silla de diseño interactiva
    └── GeoPlanter.glb  # Jardinera geométrica
```
