import { jiyiPetConfig } from './jiyi';
import { defaultPetId } from '../../shared/petRegistry';

export const petConfigs = {
  jiyi: jiyiPetConfig
};

export { defaultPetId };

export type PetId = keyof typeof petConfigs;

export function getPetConfig(petId: string) {
  return petConfigs[petId as PetId] ?? petConfigs[defaultPetId];
}

export type { PetConfig, PetState } from './types';
