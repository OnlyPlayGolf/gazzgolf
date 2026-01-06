import { PuttingBaseline, LongGameBaseline, LieType } from './csvParser';
import { interpE_Putting, interpE_Long } from './interpolation';

// Unit conversion constants
// Baseline data uses: putting = feet, long game = yards
// App inputs are in meters
const METERS_TO_FEET = 3.28084;
const METERS_TO_YARDS = 1.09361;

export interface StrokesGainedCalculator {
  calculateStrokesGained: (
    drillType: 'putting' | 'longGame',
    startDistance: number,
    startLie: LieType | 'green',
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
    startLie: LieType | 'green',
    holed: boolean,
    endLie: LieType | 'green',
    endDistance: number
  ): number => {
    // Convert input distances from meters to the appropriate units
    // Putting: meters -> feet
    // Long game: meters -> yards
    
    // Calculate E_start
    let expectedStart: number;
    if (drillType === 'putting') {
      // For putting, start is always on green, distance in feet
      const startFeet = startDistance * METERS_TO_FEET;
      expectedStart = interpE_Putting(startFeet, puttingTable);
    } else {
      // For long game, distance in yards
      const startYards = startDistance * METERS_TO_YARDS;
      // Handle 'green' as a lie type for starts (shouldn't happen for long game, but handle gracefully)
      const effectiveStartLie = startLie === 'green' ? 'fairway' : startLie;
      expectedStart = interpE_Long(startYards, effectiveStartLie, longgameTable);
    }
    
    // Calculate E_end
    let expectedEnd: number;
    if (holed) {
      expectedEnd = 0;
    } else if (endLie === 'green') {
      // End on green = putting distance in feet
      const endFeet = endDistance * METERS_TO_FEET;
      expectedEnd = interpE_Putting(endFeet, puttingTable);
    } else {
      // End in long game lie = distance in yards
      const endYards = endDistance * METERS_TO_YARDS;
      expectedEnd = interpE_Long(endYards, endLie as LieType, longgameTable);
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