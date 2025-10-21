import { Level, LevelProgress } from '@/types/levels';
import { STORAGE_KEYS } from '@/constants/app';
import { getStorageItem, setStorageItem } from '@/utils/storageManager';
import levelsData from '@/data/levels.json';
import { supabase } from '@/integrations/supabase/client';

// Generate safe ID from title
export const generateLevelId = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

// Load and process levels data with sequential numbering
export const loadLevels = (): Level[] => {
  return levelsData.map((levelData: any) => {
    // Apply offset based on difficulty for sequential numbering
    const offsets: Record<string, number> = {
      'Beginner': 0,      // 1-100
      'Intermediate': 100, // 101-200
      'Amateur': 200,     // 201-300
      'Professional': 300 // 301-400
    };
    
    return {
      id: generateLevelId(levelData.Title),
      level: levelData.Level + (offsets[levelData.Difficulty] || 0),
      title: levelData.Title,
      description: levelData.Description,
      distance: levelData.Distance,
      target: levelData.Target,
      type: levelData.Type,
      difficulty: levelData.Difficulty,
    };
  });
};

// Get level progress from storage
export const getLevelProgress = (): Record<string, LevelProgress> => {
  return getStorageItem(STORAGE_KEYS.LEVELS_STATE, {});
};

// Save level progress to storage
export const saveLevelProgress = (progress: Record<string, LevelProgress>) => {
  setStorageItem(STORAGE_KEYS.LEVELS_STATE, progress);
};

// Mark level as completed and sync to database
export const completeLevelz = async (levelId: string, attempts: number = 1) => {
  const progress = getLevelProgress();
  progress[levelId] = {
    levelId,
    completed: true,
    completedAt: Date.now(),
    attempts,
  };
  saveLevelProgress(progress);

  // Sync to database with manual upsert (no unique index required)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get the level number from the loaded levels
    const levels = loadLevels();
    const level = levels.find(l => l.id === levelId);
    const levelNumber = level?.level ?? null;

    const { data: existing } = await supabase
      .from('level_progress')
      .select('id, attempts, completed')
      .eq('user_id', user.id)
      .eq('level_id', levelId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('level_progress')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          attempts: attempts ?? existing.attempts ?? 1,
          level_number: levelNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (existing as any).id);
    } else {
      await supabase
        .from('level_progress')
        .insert({
          user_id: user.id,
          level_id: levelId,
          completed: true,
          completed_at: new Date().toISOString(),
          attempts: attempts ?? 1,
          level_number: levelNumber,
          updated_at: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error('Error syncing level progress to database:', error);
  }
};

// One-time sync of local storage progress to Supabase
export const syncLocalLevelsToDB = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const progress = getLevelProgress();
    const entries = Object.values(progress);
    const levels = loadLevels();

    for (const entry of entries) {
      if (!entry?.levelId) continue;
      
      // Get the level number from the loaded levels
      const level = levels.find(l => l.id === entry.levelId);
      const levelNumber = level?.level ?? null;
      
      const { data: existing } = await supabase
        .from('level_progress')
        .select('id, attempts, completed')
        .eq('user_id', user.id)
        .eq('level_id', entry.levelId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('level_progress')
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
            attempts: entry.attempts ?? existing.attempts ?? 1,
            level_number: levelNumber,
            updated_at: new Date().toISOString(),
          })
          .eq('id', (existing as any).id);
      } else {
        await supabase
          .from('level_progress')
          .insert({
            user_id: user.id,
            level_id: entry.levelId,
            completed: true,
            completed_at: new Date().toISOString(),
            attempts: entry.attempts ?? 1,
            level_number: levelNumber,
            updated_at: new Date().toISOString(),
          });
      }
    }
  } catch (e) {
    console.error('Error during level progress sync:', e);
  }
};

// Get levels with progress
export const getLevelsWithProgress = (): Level[] => {
  const levels = loadLevels();
  const progress = getLevelProgress();
  
  return levels.map(level => ({
    ...level,
    completed: progress[level.id]?.completed || false,
    completedAt: progress[level.id]?.completedAt,
  }));
};

// Get completion stats
export const getCompletionStats = () => {
  const levels = getLevelsWithProgress();
  const completed = levels.filter(level => level.completed).length;
  const total = levels.length;
  
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
};