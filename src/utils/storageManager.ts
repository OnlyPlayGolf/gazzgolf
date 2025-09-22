import { STORAGE_KEYS, OLD_STORAGE_KEYS } from "@/constants/app";

// Migration function to move data from old keys to new keys
export const migrateStorageKeys = () => {
  const migrations = [
    { old: OLD_STORAGE_KEYS.DISPLAY_NAME, new: STORAGE_KEYS.DISPLAY_NAME },
    { old: OLD_STORAGE_KEYS.FRIENDS, new: STORAGE_KEYS.FRIENDS },
    { old: OLD_STORAGE_KEYS.GROUPS, new: STORAGE_KEYS.GROUPS },
    { old: OLD_STORAGE_KEYS.CURRENT_GROUP_ID, new: STORAGE_KEYS.CURRENT_GROUP_ID },
    { old: OLD_STORAGE_KEYS.PGA18_SCORES, new: STORAGE_KEYS.PGA18_SCORES },
    { old: OLD_STORAGE_KEYS.AGGRESSIVE_PUTTING_SCORES, new: STORAGE_KEYS.AGGRESSIVE_PUTTING_SCORES },
    { old: OLD_STORAGE_KEYS.LEVELS_STATE, new: STORAGE_KEYS.LEVELS_STATE },
    // Legacy key from original implementation
    { old: "pga18_total_putts", new: STORAGE_KEYS.PGA18_SCORES },
  ];

  migrations.forEach(({ old, new: newKey }) => {
    const oldValue = localStorage.getItem(old);
    if (oldValue && !localStorage.getItem(newKey)) {
      // Special handling for pga18_total_putts -> app_pga18_scores migration
      if (old === "pga18_total_putts") {
        const displayName = localStorage.getItem(STORAGE_KEYS.DISPLAY_NAME) || "User";
        const score = {
          name: displayName,
          score: parseInt(oldValue),
          timestamp: Date.now(),
        };
        localStorage.setItem(newKey, JSON.stringify([score]));
      } else {
        localStorage.setItem(newKey, oldValue);
      }
      localStorage.removeItem(old);
    }
  });
};

// Storage utilities
export const getStorageItem = (key: string, defaultValue?: any) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return localStorage.getItem(key) || defaultValue;
  }
};

export const setStorageItem = (key: string, value: any) => {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save to storage:', error);
  }
};