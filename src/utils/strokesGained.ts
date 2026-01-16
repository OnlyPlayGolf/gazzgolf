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
  calculateOBStrokesGained: (
    drillType: 'putting' | 'longGame',
    startDistance: number,
    startLie: LieType | 'green'
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
    // Validate inputs
    if (startDistance <= 0) {
      console.warn('Invalid start distance:', startDistance);
      return 0;
    }
    
    if (!holed && endDistance < 0) {
      console.warn('Invalid end distance:', endDistance);
      return 0;
    }
    
    // Validate distance ranges
    if (drillType === 'putting') {
      const startFeet = startDistance * METERS_TO_FEET;
      const minDist = Math.min(...puttingTable.map(p => p.distance));
      const maxDist = Math.max(...puttingTable.map(p => p.distance));
      if (startFeet < minDist || startFeet > maxDist) {
        console.warn(`Putting distance ${startFeet}ft out of range [${minDist}, ${maxDist}]`);
      }
    } else {
      const startYards = startDistance * METERS_TO_YARDS;
      const minDist = Math.min(...longgameTable.map(l => l.distance));
      const maxDist = Math.max(...longgameTable.map(l => l.distance));
      if (startYards < minDist || startYards > maxDist) {
        console.warn(`Long game distance ${startYards}yds out of range [${minDist}, ${maxDist}]`);
      }
    }
    
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
  
  const calculateOBStrokesGained = (
    drillType: 'putting' | 'longGame',
    startDistance: number,
    startLie: LieType | 'green'
  ): number => {
    // Validate inputs
    if (startDistance <= 0) {
      console.warn('Invalid start distance for OB:', startDistance);
      return 0;
    }
    
    // Calculate E_start
    let expectedStart: number;
    if (drillType === 'putting') {
      const startFeet = startDistance * METERS_TO_FEET;
      expectedStart = interpE_Putting(startFeet, puttingTable);
    } else {
      const startYards = startDistance * METERS_TO_YARDS;
      const effectiveStartLie = startLie === 'green' ? 'fairway' : startLie;
      expectedStart = interpE_Long(startYards, effectiveStartLie, longgameTable);
    }
    
    // For OB: You take 1 stroke, end up in the same position (or worse)
    // SG = E_start - (1 + E_start) = -1
    // But we should penalize more - typically OB loses about 2 strokes
    // SG = E_start - (1 + E_start + 1) = -2 (1 stroke taken + 1 penalty stroke)
    // However, since you end up back at the same position, it's more like:
    // SG = E_start - (1 + E_start) = -1 for the shot, and the penalty is the re-tee/drop
    // Standard approach: OB shot loses the expected strokes from that position
    // Since you're taking a stroke and not improving, SG = -expectedStart
    // But with penalty, it's typically around -2 to -2.5 strokes
    // We'll use: SG = E_start - (1 + E_start + 1) = -2
    // This accounts for: 1 stroke taken + 1 penalty stroke + ending in same/worse position
    const sg = expectedStart - (1 + expectedStart + 1); // = -2
    return Math.round(sg * 100) / 100;
  };
  
  return {
    calculateStrokesGained,
    calculateOBStrokesGained
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