import { PuttingBaseline, LongGameBaseline, LieType } from './csvParser';
import { interpE_Putting, interpE_Long } from './interpolation';

export interface StrokesGainedCalculator {
  calculateStrokesGained: (
    drillType: 'putting' | 'longGame',
    startDistance: number,
    startLie: LieType,
    holed: boolean,
    endLie: LieType | 'green',
    endDistance: number
  ) => number;
}

export const createStrokesGainedCalculator = (
  puttingTable: PuttingBaseline[],
  longgameTable: LongGameBaseline[]
): StrokesGainedCalculator => {
  
  const calculateStrokesGained = (
    drillType: 'putting' | 'longGame',
    startDistance: number,
    startLie: LieType,
    holed: boolean,
    endLie: LieType | 'green',
    endDistance: number
  ): number => {
    // Calculate E_start
    let expectedStart: number;
    if (drillType === 'putting') {
      expectedStart = interpE_Putting(startDistance, puttingTable);
    } else {
      expectedStart = interpE_Long(startDistance, startLie, longgameTable);
    }
    
    // Calculate E_end
    let expectedEnd: number;
    if (holed) {
      expectedEnd = 0;
    } else if (endLie === 'green') {
      expectedEnd = interpE_Putting(endDistance, puttingTable);
    } else {
      expectedEnd = interpE_Long(endDistance, endLie as LieType, longgameTable);
    }
    
    // SG = E_start - (1 + E_end)
    const sg = expectedStart - (1 + expectedEnd);
    return Math.round(sg * 100) / 100; // Round to 0.01
  };
  
  return {
    calculateStrokesGained
  };
};

export const validateDistance = (
  distance: number,
  type: 'putting' | 'longGame',
  puttingTable?: PuttingBaseline[],
  longgameTable?: LongGameBaseline[]
): boolean => {
  if (distance <= 0) return false;
  
  if (type === 'putting' && puttingTable) {
    const minDist = Math.min(...puttingTable.map(p => p.distance));
    const maxDist = Math.max(...puttingTable.map(p => p.distance));
    return distance >= minDist && distance <= maxDist;
  }
  
  if (type === 'longGame' && longgameTable) {
    const minDist = Math.min(...longgameTable.map(l => l.distance));
    const maxDist = Math.max(...longgameTable.map(l => l.distance));
    return distance >= minDist && distance <= maxDist;
  }
  
  return true;
};