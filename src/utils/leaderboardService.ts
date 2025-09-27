import { getStorageItem } from "./storageManager";
import { STORAGE_KEYS } from "@/constants/app";

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  timestamp: number;
}

export interface LeaderboardData {
  friends: LeaderboardEntry[];
  group?: LeaderboardEntry[];
  groupName?: string;
}

// Mock data service - in production this would call Supabase
export const getLeaderboardData = async (drillType: string): Promise<LeaderboardData> => {
  // For now, use local storage data as mock leaderboard
  const storageKey = drillType === 'pga18' ? STORAGE_KEYS.PGA18_SCORES : STORAGE_KEYS.AGGRESSIVE_PUTTING_SCORES;
  const scores = getStorageItem(storageKey, []);
  
  // Convert scores to leaderboard format
  const leaderboard: LeaderboardEntry[] = scores.map((score: any, index: number) => ({
    id: `${score.name}_${score.timestamp}_${index}`,
    name: score.name,
    score: score.score,
    timestamp: score.timestamp
  }));
  
  // Sort by score (ascending for golf)
  leaderboard.sort((a, b) => a.score - b.score);
  
  // Mock friends and group data - in production this would filter by actual relationships
  const friends = leaderboard.filter((entry, index) => index % 3 === 0); // Mock: every 3rd entry is a "friend"
  const group = leaderboard.filter((entry, index) => index % 4 === 0); // Mock: every 4th entry is in favorite group
  
  const favoriteGroupName = getStorageItem(STORAGE_KEYS.CURRENT_GROUP_ID, null);
  const groups = getStorageItem(STORAGE_KEYS.GROUPS, []);
  const favoriteGroup = groups.find((g: any) => g.id === favoriteGroupName);
  
  return {
    friends,
    group: favoriteGroup ? group : undefined,
    groupName: favoriteGroup?.name
  };
};

export const getFavoriteGroup = () => {
  const favoriteGroupId = getStorageItem(STORAGE_KEYS.CURRENT_GROUP_ID, null);
  const groups = getStorageItem(STORAGE_KEYS.GROUPS, []);
  return groups.find((g: any) => g.id === favoriteGroupId);
};

export const setFavoriteGroup = (groupId: string | null) => {
  if (groupId) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_GROUP_ID, groupId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_GROUP_ID);
  }
};