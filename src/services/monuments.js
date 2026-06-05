/**
 * MonumentsService
 * 
 * Se encarga de cargar la base de datos de monumentos locales y,
 * mediante una suscripción reactiva al GPSService, recalcula continuamente
 * las distancias y estados de proximidad (inRange) del turista.
 */
export class MonumentsService {
  constructor(gpsService) {
    this.gpsService = gpsService;
    this.monuments = [];
    this.subscribers = new Set();
    this.proximityRadius = 50; // Rango de proximidad en metros

    // Enlazar de forma reactiva las actualizaciones del GPS
    this.gpsService.subscribe(() => {
      if (this.monuments.length > 0) {
        this.notify();
      }
    });
  }

  /**
   * Carga los datos de los monumentos desde el archivo JSON
   */
  async loadMonuments() {
    try {
      const response = await fetch('./src/data/monumentos.json');
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      this.monuments = await response.json();
      this.notify();
      return this.monuments;
    } catch (e) {
      console.error("[MonumentsService] Error al cargar monumentos.json:", e);
      return [];
    }
  }

  /**
   * Suscribe un callback para recibir el catálogo actualizado con distancias
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    // Notificación inmediata al suscribirse
    if (this.monuments.length > 0) {
      callback(this.getMonumentsWithDistances());
    }
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const list = this.getMonumentsWithDistances();
    for (const callback of this.subscribers) {
      callback(list);
    }
  }

  /**
   * Devuelve la lista de monumentos enriquecida con la distancia relativa y rumbo
   */
  getMonumentsWithDistances() {
    const userLat = this.gpsService.userCoords.lat;
    const userLng = this.gpsService.userCoords.lng;

    return this.monuments.map(monument => {
      let distance = null;
      let bearing = null;

      if (userLat !== null && userLng !== null) {
        distance = this.gpsService.calculateHaversine(userLat, userLng, monument.lat, monument.lng);
        bearing = this.gpsService.calculateBearing(userLat, userLng, monument.lat, monument.lng);
      }

      return {
        ...monument,
        distance,
        bearing,
        inRange: distance !== null && distance <= this.proximityRadius
      };
    });
  }

  getMonumentById(id) {
    return this.monuments.find(m => m.id === id);
  }

  setProximityRadius(radius) {
    this.proximityRadius = radius;
    this.notify();
  }
}
