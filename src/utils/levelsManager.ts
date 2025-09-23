import { Level, LevelProgress } from '@/types/levels';
import { STORAGE_KEYS } from '@/constants/app';
import { getStorageItem, setStorageItem } from '@/utils/storageManager';
import levelsData from '@/data/levels.json';

// Generate safe ID from title
export const generateLevelId = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

// Load and process levels data
export const loadLevels = (): Level[] => {
  return levelsData.map((levelData: any) => ({
    id: generateLevelId(levelData.Title),
    level: levelData.Level,
    title: levelData.Title,
    description: levelData.Description,
    distance: levelData.Distance,
    target: levelData.Target,
    type: levelData.Type,
    difficulty: levelData.Difficulty,
  }));
};

// Get level progress from storage
export const getLevelProgress = (): Record<string, LevelProgress> => {
  return getStorageItem(STORAGE_KEYS.LEVELS_STATE, {});
};

// Save level progress to storage
export const saveLevelProgress = (progress: Record<string, LevelProgress>) => {
  setStorageItem(STORAGE_KEYS.LEVELS_STATE, progress);
};

// Mark level as completed
export const completeLevelz = (levelId: string, attempts: number = 1) => {
  const progress = getLevelProgress();
  progress[levelId] = {
    levelId,
    completed: true,
    completedAt: Date.now(),
    attempts,
  };
  saveLevelProgress(progress);
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