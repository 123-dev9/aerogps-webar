/**
 * CustomPositionsService
 * 
 * Gestiona el ciclo de vida de las posiciones GPS personalizadas (anclajes)
 * guardadas por el usuario en localStorage. Permite agregar, eliminar,
 * exportar e importar posiciones, además de integrarlas reactivamente
 * en el catálogo de monumentos general.
 */
export class CustomPositionsService {
  constructor(monumentsService, gpsService, assetService) {
    this.monumentsService = monumentsService;
    this.gpsService = gpsService;
    this.assetService = assetService;
  }

  /**
   * Obtiene la lista completa de posiciones personalizadas guardadas
   */
  getPositions() {
    try {
      const data = localStorage.getItem('custom_positions');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("[CustomPositionsService] Error al leer localStorage:", e);
      return [];
    }
  }

  /**
   * Guarda una nueva posición y sincroniza con el catálogo de monumentos
   */
  savePosition(name, modelId, lat, lng, scaleMultiplier = 1.0, elevation = 0.0) {
    const positions = this.getPositions();
    
    // Obtener configuración por defecto del modelo
    const modelCatalog = this.assetService.getCatalog();
    const model = modelCatalog.find(m => m.id === modelId) || modelCatalog[0];
    
    // Calcular escala y elevación finales a partir del multiplicador y base
    const baseScale = model.defaultScale ? model.defaultScale.x : 1.0;
    const finalScaleValue = baseScale * scaleMultiplier;
    
    const newPosition = {
      id: 'custom_' + Date.now(),
      nombre: name.trim() || `Posición ${positions.length + 1}`,
      modelo: modelId,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      defaultScale: { x: finalScaleValue, y: finalScaleValue, z: finalScaleValue },
      defaultElevation: parseFloat(elevation),
      scaleMultiplier: parseFloat(scaleMultiplier),
      isCustom: true
    };

    positions.push(newPosition);
    localStorage.setItem('custom_positions', JSON.stringify(positions));
    
    // Forzar recarga en el servicio de monumentos y notificar
    this.monumentsService.loadCustomPositions();
    return newPosition;
  }

  /**
   * Elimina una posición específica
   */
  deletePosition(id) {
    let positions = this.getPositions();
    positions = positions.filter(pos => pos.id !== id);
    localStorage.setItem('custom_positions', JSON.stringify(positions));
    
    // Forzar recarga en el servicio de monumentos y notificar
    this.monumentsService.loadCustomPositions();
  }

  /**
   * Exporta la lista de posiciones actual como una cadena JSON
   */
  exportPositions() {
    return JSON.stringify(this.getPositions(), null, 2);
  }

  /**
   * Importa una lista de posiciones desde una cadena JSON
   */
  importPositions(jsonString) {
    try {
      if (!jsonString || !jsonString.trim()) {
        throw new Error("El contenido JSON está vacío.");
      }
      
      const parsed = JSON.parse(jsonString);
      const listToImport = Array.isArray(parsed) ? parsed : [parsed];
      
      const currentPositions = this.getPositions();
      
      listToImport.forEach(pos => {
        if (!pos.modelo || isNaN(parseFloat(pos.lat)) || isNaN(parseFloat(pos.lng))) {
          throw new Error("El objeto no contiene coordenadas válidas o modelo.");
        }
        
        // Estructura limpia e independiente de IDs colisionados
        const modelCatalog = this.assetService.getCatalog();
        const model = modelCatalog.find(m => m.id === pos.modelo) || modelCatalog[0];
        
        const scaleMult = pos.scaleMultiplier !== undefined ? parseFloat(pos.scaleMultiplier) : 1.0;
        const baseScale = model.defaultScale ? model.defaultScale.x : 1.0;
        const finalScaleValue = baseScale * scaleMult;

        currentPositions.push({
          id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          nombre: (pos.nombre || `Posición Importada`).trim(),
          modelo: pos.modelo,
          lat: parseFloat(pos.lat),
          lng: parseFloat(pos.lng),
          defaultScale: { x: finalScaleValue, y: finalScaleValue, z: finalScaleValue },
          defaultElevation: parseFloat(pos.defaultElevation !== undefined ? pos.defaultElevation : 0),
          scaleMultiplier: scaleMult,
          isCustom: true
        });
      });

      localStorage.setItem('custom_positions', JSON.stringify(currentPositions));
      
      // Sincronizar y refrescar
      this.monumentsService.loadCustomPositions();
      return true;
    } catch (e) {
      console.error("[CustomPositionsService] Error al importar posiciones:", e);
      throw e;
    }
  }
}
