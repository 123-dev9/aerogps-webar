/**
 * AssetService
 * Administra el catálogo de modelos 3D disponibles en la aplicación,
 * sus configuraciones iniciales por defecto (escala, elevación) y rutas.
 */
export class AssetService {
  constructor() {
    this.catalog = [
      {
        id: "Chair",
        name: "Silla de Diseño",
        file: "Chair.glb",
        description: "Silla moderna de diseño escandinavo ergonómico.",
        defaultScale: { x: 15, y: 15, z: 15 },
        defaultElevation: 0,
        icon: "armchair"
      },
      {
        id: "GeoPlanter",
        name: "Jardinera Geométrica",
        file: "GeoPlanter.glb",
        description: "Jardinera poligonal moderna para decoración y paisajismo urbano.",
        defaultScale: { x: 15, y: 15, z: 15 },
        defaultElevation: 0,
        icon: "flower2"
      }
    ];
    this.selectedModelId = "Chair";
  }

  /**
   * Obtiene el catálogo completo de modelos
   */
  getCatalog() {
    return this.catalog;
  }

  /**
   * Obtiene el modelo actualmente seleccionado
   */
  getSelectedModel() {
    return this.catalog.find(model => model.id === this.selectedModelId) || this.catalog[0];
  }

  /**
   * Cambia el modelo seleccionado actualmente
   */
  setSelectedModel(id) {
    const modelExists = this.catalog.some(model => model.id === id);
    if (modelExists) {
      this.selectedModelId = id;
      return true;
    }
    return false;
  }

  /**
   * Obtiene la ruta física del archivo GLB del modelo
   */
  getModelPath(id) {
    const model = this.catalog.find(m => m.id === id);
    return model ? `./assets/${model.file}` : null;
  }
}
