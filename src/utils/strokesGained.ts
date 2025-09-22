import { PuttingBaseline, LongGameBaseline, LieType } from './csvParser';
import { interpE_Putting, interpE_Long } from './interpolation';

export interface StrokesGainedCalculator {
  calculatePuttingSG: (startDistanceFt: number, leaveDistanceFt: number, holed: boolean) => number;
  calculateLongGameSG: (startDistanceYds: number, lie: LieType, leaveDistanceFt: number) => number;
}

export const createStrokesGainedCalculator = (
  puttingTable: PuttingBaseline[],
  longgameTable: LongGameBaseline[]
): StrokesGainedCalculator => {
  
  const calculatePuttingSG = (
    startDistanceFt: number,
    leaveDistanceFt: number,
    holed: boolean
  ): number => {
    const expectedStart = interpE_Putting(startDistanceFt, puttingTable);
    const expectedLeave = holed ? 0 : interpE_Putting(leaveDistanceFt, puttingTable);
    
    // SG = E_putt(d0) - (1 + E_putt(d1))
    const sg = expectedStart - (1 + expectedLeave);
    return Math.round(sg * 100) / 100; // Round to 0.01
  };
  
  const calculateLongGameSG = (
    startDistanceYds: number,
    lie: LieType,
    leaveDistanceFt: number
  ): number => {
    const expectedStart = interpE_Long(startDistanceYds, lie, longgameTable);
    const expectedLeave = interpE_Putting(leaveDistanceFt, puttingTable);
    
    // SG = E_long(d0, lie) - (1 + E_putt(d1))
    const sg = expectedStart - (1 + expectedLeave);
    return Math.round(sg * 100) / 100; // Round to 0.01
  };
  
  return {
    calculatePuttingSG,
    calculateLongGameSG
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