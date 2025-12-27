import { STORAGE_KEYS } from "@/constants/app";
import { supabase } from "@/integrations/supabase/client";

const FAVORITES_KEY = STORAGE_KEYS.FAVORITES;

export interface FavoriteDrill {
  id: string;
  title: string;
  category: string;
  addedAt: number;
}

// Get favorites from localStorage (fallback for unauthenticated users)
const getLocalFavorites = (): FavoriteDrill[] => {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading local favorites:', error);
    return [];
  }
};

// Save favorites to localStorage
const setLocalFavorites = (favorites: FavoriteDrill[]) => {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Error saving local favorites:', error);
  }
};

// Sync localStorage favorites to Supabase when user logs in
export const syncLocalFavoritesToSupabase = async (userId: string) => {
  const localFavorites = getLocalFavorites();
  if (localFavorites.length === 0) return;

  try {
    for (const fav of localFavorites) {
      await supabase
        .from('user_favorites')
        .upsert({
          user_id: userId,
          drill_id: fav.id,
          drill_title: fav.title,
          drill_category: fav.category,
        }, { onConflict: 'user_id,drill_id' });
    }
    // Clear localStorage after successful sync
    localStorage.removeItem(FAVORITES_KEY);
  } catch (error) {
    console.error('Error syncing favorites to Supabase:', error);
  }
};

// Fetch favorites from Supabase
export const getFavoritesFromSupabase = async (): Promise<FavoriteDrill[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Fallback to localStorage for unauthenticated users
      return getLocalFavorites();
    }

    const { data, error } = await supabase
      .from('user_favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching favorites from Supabase:', error);
      return getLocalFavorites();
    }

    return (data || []).map(row => ({
      id: row.drill_id,
      title: row.drill_title,
      category: row.drill_category,
      addedAt: new Date(row.created_at).getTime(),
    }));
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return getLocalFavorites();
  }
};

// Add to favorites (Supabase or localStorage)
export const addToFavoritesAsync = async (drill: Omit<FavoriteDrill, 'addedAt'>): Promise<FavoriteDrill[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Fallback to localStorage
      const favorites = getLocalFavorites();
      const newFavorite: FavoriteDrill = {
        ...drill,
        addedAt: Date.now(),
      };
      const updated = [...favorites.filter(f => f.id !== drill.id), newFavorite];
      setLocalFavorites(updated);
      return updated;
    }

    const { error } = await supabase
      .from('user_favorites')
      .upsert({
        user_id: user.id,
        drill_id: drill.id,
        drill_title: drill.title,
        drill_category: drill.category,
      }, { onConflict: 'user_id,drill_id' });

    if (error) {
      console.error('Error adding favorite to Supabase:', error);
    }

    return getFavoritesFromSupabase();
  } catch (error) {
    console.error('Error adding to favorites:', error);
    return getLocalFavorites();
  }
};

// Remove from favorites (Supabase or localStorage)
export const removeFromFavoritesAsync = async (drillId: string): Promise<FavoriteDrill[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Fallback to localStorage
      const favorites = getLocalFavorites();
      const updated = favorites.filter(f => f.id !== drillId);
      setLocalFavorites(updated);
      return updated;
    }

    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('drill_id', drillId);

    if (error) {
      console.error('Error removing favorite from Supabase:', error);
    }

    return getFavoritesFromSupabase();
  } catch (error) {
    console.error('Error removing from favorites:', error);
    return getLocalFavorites();
  }
};

// Check if a drill is a favorite
export const isFavoriteAsync = async (drillId: string): Promise<boolean> => {
  const favorites = await getFavoritesFromSupabase();
  return favorites.some(f => f.id === drillId);
};

// Legacy sync functions for backward compatibility
export const getFavorites = (): FavoriteDrill[] => {
  return getLocalFavorites();
};

export const addToFavorites = (drill: Omit<FavoriteDrill, 'addedAt'>) => {
  // Trigger async version but return sync for compatibility
  addToFavoritesAsync(drill);
  
  const favorites = getLocalFavorites();
  const newFavorite: FavoriteDrill = {
    ...drill,
    addedAt: Date.now(),
  };
  const updated = [...favorites.filter(f => f.id !== drill.id), newFavorite];
  setLocalFavorites(updated);
  return updated;
};

export const removeFromFavorites = (drillId: string) => {
  // Trigger async version but return sync for compatibility
  removeFromFavoritesAsync(drillId);
  
  const favorites = getLocalFavorites();
  const updated = favorites.filter(f => f.id !== drillId);
  setLocalFavorites(updated);
  return updated;
};

export const isFavorite = (drillId: string): boolean => {
  const favorites = getLocalFavorites();
  return favorites.some(f => f.id === drillId);
};
