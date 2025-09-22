import { PuttingBaseline, LongGameBaseline, LieType } from './csvParser';

// Linear interpolation with clamping to table range
export const linearInterpolate = (
  x: number,
  data: Array<{ x: number; y: number }>
): number => {
  if (data.length === 0) return 0;
  
  // Sort data by x values
  const sortedData = [...data].sort((a, b) => a.x - b.x);
  
  // Clamp to table range
  if (x <= sortedData[0].x) return sortedData[0].y;
  if (x >= sortedData[sortedData.length - 1].x) return sortedData[sortedData.length - 1].y;
  
  // Find surrounding points
  for (let i = 0; i < sortedData.length - 1; i++) {
    const x1 = sortedData[i].x;
    const y1 = sortedData[i].y;
    const x2 = sortedData[i + 1].x;
    const y2 = sortedData[i + 1].y;
    
    if (x >= x1 && x <= x2) {
      // Linear interpolation: y = y1 + (y2 - y1) * (x - x1) / (x2 - x1)
      return y1 + (y2 - y1) * (x - x1) / (x2 - x1);
    }
  }
  
  return sortedData[sortedData.length - 1].y;
};

export const interpE_Putting = (
  distanceFt: number,
  puttingTable: PuttingBaseline[]
): number => {
  const data = puttingTable.map(row => ({
    x: row.distance,
    y: row.expectedStrokes
  }));
  
  return linearInterpolate(distanceFt, data);
};

export const interpE_Long = (
  distanceYds: number,
  lie: LieType,
  longgameTable: LongGameBaseline[]
): number => {
  const data = longgameTable
    .filter(row => row[lie] !== undefined)
    .map(row => ({
      x: row.distance,
      y: row[lie]!
    }));
  
  return linearInterpolate(distanceYds, data);
};