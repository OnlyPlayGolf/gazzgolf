export interface Level {
  id: string; // Generated from title
  level: number; // Original level number
  title: string;
  description: string;
  distance: string;
  target: string;
  type: string;
  difficulty: string;
  completed?: boolean;
  completedAt?: number;
}

export interface LevelProgress {
  levelId: string;
  completed: boolean;
  completedAt: number;
  attempts?: number;
}