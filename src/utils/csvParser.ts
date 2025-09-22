// CSV parsing utilities for baseline data

export interface PuttingBaseline {
  distance: number;
  expectedStrokes: number;
}

export interface LongGameBaseline {
  distance: number;
  tee?: number;
  fairway?: number;
  rough?: number;
  sand?: number;
}

export type LieType = 'tee' | 'fairway' | 'rough' | 'sand';

export const parsePuttingBaseline = async (csvUrl: string): Promise<PuttingBaseline[]> => {
  const response = await fetch(csvUrl);
  const text = await response.text();
  const lines = text.split('\n').filter(line => line.trim());
  
  // Skip header row
  return lines.slice(1).map(line => {
    const [distance, green] = line.split(',');
    return {
      distance: parseFloat(distance),
      expectedStrokes: parseFloat(green)
    };
  }).filter(item => !isNaN(item.distance) && !isNaN(item.expectedStrokes));
};

export const parseLongGameBaseline = async (csvUrl: string): Promise<LongGameBaseline[]> => {
  const response = await fetch(csvUrl);
  const text = await response.text();
  const lines = text.split('\n').filter(line => line.trim());
  
  // Skip header row
  return lines.slice(1).map(line => {
    const [distance, tee, fairway, rough, sand] = line.split(',');
    return {
      distance: parseFloat(distance),
      tee: tee ? parseFloat(tee) : undefined,
      fairway: fairway ? parseFloat(fairway) : undefined,
      rough: rough ? parseFloat(rough) : undefined,
      sand: sand ? parseFloat(sand) : undefined
    };
  }).filter(item => !isNaN(item.distance));
};