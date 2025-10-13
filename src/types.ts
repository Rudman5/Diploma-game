export interface ModelData {
  file: string;
  img: string;
  metadata: ModelMetadata;
}

export interface ModelMetadata {
  name: string;
  resource?: string;
  energyConsumption?: number;
}
export type ModelFiles = Record<string, ModelData>;
