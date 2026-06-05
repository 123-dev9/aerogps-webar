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
      },
      {
        id: "Dragon",
        name: "Dragón Volador",
        file: "Dragon.glb",
        description: "Dragón legendario animado que bate sus alas en el cielo.",
        defaultScale: { x: 0.6, y: 0.6, z: 0.6 },
        defaultElevation: 1.2,
        icon: "sparkles"
      },
      {
        id: "FerrisWheel",
        name: "Noria de Feria",
        file: "FerrisWheel.glb",
        description: "Gran noria mecánica animada girando continuamente.",
        defaultScale: { x: 0.15, y: 0.15, z: 0.15 },
        defaultElevation: 0,
        icon: "orbit"
      },
      {
        id: "Bat",
        name: "Murciélago Realista",
        file: "Bat.glb",
        description: "Murciélago animado planeando y volando.",
        defaultScale: { x: 0.6, y: 0.6, z: 0.6 },
        defaultElevation: 1.5,
        icon: "navigation"
      },
      {
        id: "Sweeper",
        name: "Robot Barredor",
        file: "Sweeper.glb",
        description: "Pequeño robot doméstico animado recorriendo el suelo.",
        defaultScale: { x: 0.6, y: 0.6, z: 0.6 },
        defaultElevation: 0,
        icon: "cpu"
      },
      {
        id: "charizard_flying_animation",
        name: "Charizard",
        file: "charizard_flying_animation.glb",
        description: "Feroz dragón animado escupiendo fuego y volando.",
        defaultScale: { x: 0.5, y: 0.5, z: 0.5 },
        defaultElevation: 1.0,
        icon: "flame"
      },
      {
        id: "girl_look_around",
        name: "Guía Sofía (3D)",
        file: "girl_look_around.glb",
        description: "Guía turística virtual en 3D que observa a su alrededor.",
        defaultScale: { x: 0.8, y: 0.8, z: 0.8 },
        defaultElevation: 0,
        icon: "user"
      },
      {
        id: "paul_talking_business",
        name: "Guía Pablo (3D)",
        file: "paul_talking_business.glb",
        description: "Guía turístico virtual que narra información histórica.",
        defaultScale: { x: 0.8, y: 0.8, z: 0.8 },
        defaultElevation: 0,
        icon: "user-check"
      },
      {
        id: "pokemon_3ds_meowth",
        name: "Meowth Animado",
        file: "pokemon_3ds_meowth.glb",
        description: "Pequeño gato Pokémon animado juguetón.",
        defaultScale: { x: 0.4, y: 0.4, z: 0.4 },
        defaultElevation: 0,
        icon: "cat"
      },
      {
        id: "pokemon_3ds_scizor",
        name: "Scizor",
        file: "pokemon_3ds_scizor.glb",
        description: "Pokémon de tipo bicho/acero animado en posición de guardia.",
        defaultScale: { x: 0.4, y: 0.4, z: 0.4 },
        defaultElevation: 0,
        icon: "shield"
      },
      {
        id: "pokemon_pokedex_3d_pro_infernape",
        name: "Infernape",
        file: "pokemon_pokedex_3d_pro_infernape.glb",
        description: "Pokémon de tipo fuego/lucha con corona de llamas.",
        defaultScale: { x: 0.4, y: 0.4, z: 0.4 },
        defaultElevation: 0,
        icon: "swords"
      },
      {
        id: "toon-bat",
        name: "Murciélago Toon",
        file: "toon-bat.glb",
        description: "Carismático murciélago animado con estilo caricaturesco.",
        defaultScale: { x: 0.5, y: 0.5, z: 0.5 },
        defaultElevation: 1.2,
        icon: "smile"
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
