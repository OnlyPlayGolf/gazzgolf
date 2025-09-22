import { LieType } from '@/utils/csvParser';

export type DrillType = 'putting' | 'longGame';

export interface UserDrill {
  id: string;
  title: string;
  type: DrillType;
  startDistances: number[]; // Always stored in canonical meters
  targetReps: number;
  unit: 'meters' | 'feet' | 'yards'; // Display unit preference
  lie?: LieType; // Required for long game drills
  createdAt: number;
}

export interface DrillRep {
  id: string;
  startDistance: number; // Always in canonical meters
  holed: boolean;
  endLie?: LieType | 'green';
  endDistance?: number; // Always in canonical meters, undefined if holed
  proximity?: number; // For long game drills, always in canonical meters
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
  endLie?: LieType | 'green';
  endDistance?: number;
}