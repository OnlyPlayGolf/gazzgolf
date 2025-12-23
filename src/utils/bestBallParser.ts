import { BestBallPlayer } from "@/types/bestBall";

/**
 * Safely parse Best Ball player arrays from database JSON
 * Provides defensive handling for null/undefined or malformed data
 */
export const parsePlayerArray = (data: unknown): BestBallPlayer[] => {
  if (!data || !Array.isArray(data)) return [];
  return data.map((p: any) => ({
    odId: p?.odId || p?.id || '',
    displayName: p?.displayName || 'Unknown',
    handicap: p?.handicap,
    teeColor: p?.teeColor,
    isTemporary: p?.isTemporary || false,
  }));
};
