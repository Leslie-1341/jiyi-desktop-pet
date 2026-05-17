export type PetRegistryItem = {
  id: string;
  displayName: string;
};

export const defaultPetId = 'jiyi';

export const petRegistry: PetRegistryItem[] = [
  {
    id: 'jiyi',
    displayName: '吉伊'
  }
];

export function isKnownPetId(petId: string) {
  return petRegistry.some((pet) => pet.id === petId);
}
