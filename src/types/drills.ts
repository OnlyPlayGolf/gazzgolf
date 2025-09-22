import { LieType } from '@/utils/csvParser';

export type DrillType = 'putting' | 'longGame';

export interface UserDrill {
  id: string;
  title: string;
  type: DrillType;
  startDistances: number[];
  targetReps: number;
  unit: 'feet' | 'yards';
  lie?: LieType; // Required for long game drills
  createdAt: number;
}

export interface DrillRep {
  id: string;
  startDistance: number;
  holed: boolean;
  leaveDistance: number; // In feet for putting distance
  strokesGained: number;
  timestamp: number;
}

export interface DrillSession {
  id: string;
  drillId: string;
  drillTitle: string;
  reps: DrillRep[];
  totalStrokesGained: number;
  averageStrokesGained: number;
  startedAt: number;
  completedAt?: number;
  targetReps: number;
}

export interface DrillOutcome {
  type: 'holed' | 'missed';
  leaveDistance?: number;
}