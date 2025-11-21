import { STORAGE_KEYS } from "@/constants/app";

const FAVORITES_KEY = STORAGE_KEYS.FAVORITES;

export interface FavoriteDrill {
  id: string;
  title: string;
  category: string;
  addedAt: number;
}

export const getFavorites = (): FavoriteDrill[] => {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading favorites:', error);
    return [];
  }
};

export const addToFavorites = (drill: Omit<FavoriteDrill, 'addedAt'>) => {
  try {
    const favorites = getFavorites();
    const newFavorite: FavoriteDrill = {
      ...drill,
      addedAt: Date.now(),
    };
    
    const updated = [...favorites.filter(f => f.id !== drill.id), newFavorite];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Error adding to favorites:', error);
    return getFavorites();
  }
};

export const removeFromFavorites = (drillId: string) => {
  try {
    const favorites = getFavorites();
    const updated = favorites.filter(f => f.id !== drillId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Error removing from favorites:', error);
    return getFavorites();
  }
};

export const isFavorite = (drillId: string): boolean => {
  const favorites = getFavorites();
  return favorites.some(f => f.id === drillId);
};