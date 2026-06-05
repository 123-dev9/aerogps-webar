/**
 * GPSService
 * Encapsula la lógica de geolocalización, cálculo de rumbo (Bearing)
 * y distancia (Haversine), además del ciclo de vida de watchPosition.
 */
export class GPSService {
  constructor() {
    this.userCoords = { lat: null, lng: null };
    this.targetCoords = { lat: null, lng: null };
    this.accuracy = null;
    this.watchId = null;
    this.subscribers = new Set();
  }

  /**
   * Configura las coordenadas del objeto destino
   */
  setTarget(lat, lng) {
    this.targetCoords = { lat, lng };
    this.notify();
  }

  /**
   * Se suscribe a los cambios del GPS
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    // Devuelve una función para desuscribirse
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const data = {
      userCoords: { ...this.userCoords },
      targetCoords: { ...this.targetCoords },
      accuracy: this.accuracy,
      distance: this.getDistance(),
      bearing: this.getBearing()
    };
    for (const callback of this.subscribers) {
      callback(data);
    }
  }

  /**
   * Comienza a observar la posición del usuario
   */
  startTracking(onSuccess, onError) {
    if (!navigator.geolocation) {
      const err = new Error("La geolocalización no es soportada por este dispositivo.");
      if (onError) onError(err);
      return;
    }

    // Si ya hay un tracking activo, lo detenemos primero
    this.stopTracking();

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.userCoords.lat = position.coords.latitude;
        this.userCoords.lng = position.coords.longitude;
        this.accuracy = position.coords.accuracy;
        
        if (onSuccess) onSuccess(position.coords);
        this.notify();
      },
      (error) => {
        if (onError) onError(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000
      }
    );
  }

  /**
   * Detiene el tracking de GPS
   */
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Obtiene la distancia en metros entre el usuario y el objetivo
   */
  getDistance() {
    if (this.userCoords.lat === null || this.targetCoords.lat === null) return null;
    return this.calculateHaversine(
      this.userCoords.lat,
      this.userCoords.lng,
      this.targetCoords.lat,
      this.targetCoords.lng
    );
  }

  /**
   * Obtiene el rumbo absoluto (0-360 grados) hacia el objetivo
   */
  getBearing() {
    if (this.userCoords.lat === null || this.targetCoords.lat === null) return null;
    return this.calculateBearing(
      this.userCoords.lat,
      this.userCoords.lng,
      this.targetCoords.lat,
      this.targetCoords.lng
    );
  }

  /**
   * Calcula la distancia usando la fórmula de Haversine
   */
  calculateHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // metros
  }

  /**
   * Calcula el ángulo del rumbo (Bearing) en grados sexagesimales
   */
  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }
}
