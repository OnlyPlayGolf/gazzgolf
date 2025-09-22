// Unit conversion utilities

export type PuttingUnit = 'meters' | 'feet';
export type LongGameUnit = 'meters' | 'yards';

// Convert putting distance to meters (canonical storage)
export const convertToMeters = (value: number, unit: PuttingUnit): number => {
  return unit === 'feet' ? value / 3.28084 : value;
};

// Convert putting distance from meters to display unit
export const convertFromMeters = (value: number, unit: PuttingUnit): number => {
  return unit === 'feet' ? value * 3.28084 : value;
};

// Convert long game distance to meters (canonical storage)
export const convertLongGameToMeters = (value: number, unit: LongGameUnit): number => {
  return unit === 'yards' ? value / 1.09361 : value;
};

// Convert long game distance from meters to display unit
export const convertLongGameFromMeters = (value: number, unit: LongGameUnit): number => {
  return unit === 'yards' ? value * 1.09361 : value;
};

// Format distance with appropriate precision
export const formatDistance = (value: number, unit: PuttingUnit | LongGameUnit): string => {
  const precision = unit === 'meters' ? 2 : 1;
  return value.toFixed(precision);
};

// Validation ranges (in meters)
export const PUTTING_RANGE_METERS = { min: 0.03, max: 4.57 }; // ~0.1-15 ft
export const PROXIMITY_RANGE_METERS = { min: 0, max: 100 }; // 0-100 m

// Get validation range for display
export const getValidationRange = (unit: PuttingUnit | LongGameUnit, type: 'putting' | 'proximity') => {
  if (type === 'putting') {
    const min = convertFromMeters(PUTTING_RANGE_METERS.min, unit as PuttingUnit);
    const max = convertFromMeters(PUTTING_RANGE_METERS.max, unit as PuttingUnit);
    return { min, max };
  } else {
    if (unit === 'yards') {
      return { min: 0, max: 109.36 }; // ~100m in yards
    }
    return { min: 0, max: 100 };
  }
};