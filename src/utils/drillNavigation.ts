/**
 * Maps drill titles to their corresponding route slugs
 */
export const getDrillSlugFromTitle = (drillTitle: string): string | null => {
  // Normalize the title first to handle variations
  const normalizedTitle = normalizeDrillTitle(drillTitle);
  
  const titleToSlug: Record<string, string> = {
    'PGA Tour 18-hole': 'pga-tour-18',
    'PGA Tour 18-hole Test': 'pga-tour-18', // Legacy
    'Aggressive Putting 4-6m': 'aggressive-putting',
    'Up & Down Putts 6-10m': 'up-down-putting',
    'Short Putt Test': 'short-putting-test',
    'Lag Putting Drill 8-20m': 'jason-day-lag',
    '8-Ball Circuit': '8-ball-drill',
    'Easy Chip Drill': 'easy-chip',
    'Wedge Game 40-80m': 'wedges-2-laps',
    'Wedge Ladder 60-120m': 'wedges-progression',
    'Approach Control 130-180m': 'approach-control',
    '9 Windows Shot Shape': 'tw-9-windows',
    '9 Windows Shot Shape Test': 'tw-9-windows', // Legacy
    'Shot Shape Master': 'shot-shape-master',
    'Driver Control Drill': 'driver-control',
    '18 Up & Downs': 'up-downs-test',
  };
  
  return titleToSlug[normalizedTitle] || null;
};

/**
 * Normalize drill titles (map old/variant titles to canonical ones)
 */
const normalizeDrillTitle = (title: string): string => {
  const titleMap: Record<string, string> = {
    '18-hole PGA Tour Putting Test': 'PGA Tour 18-hole',
    "PGA Tour 18 Holes": 'PGA Tour 18-hole',
    "PGA Tour 18-hole Test": 'PGA Tour 18-hole',
    "PGA Tour 18-hole": 'PGA Tour 18-hole',
    "TW's 9 Windows Test": "9 Windows Shot Shape",
    "9 Windows Shot Shape Test": "9 Windows Shot Shape",
    "9 Windows Shot Shape": "9 Windows Shot Shape",
    "Aggressive Putting": "Aggressive Putting 4-6m",
    "Aggressive Putting 4-6m": "Aggressive Putting 4-6m",
    "Short Putt Test": "Short Putt Test",
    "Up & Down Putts 6-10m": "Up & Down Putts 6-10m",
    "Lag Putting Drill 8-20m": "Lag Putting Drill 8-20m",
    "8-Ball Circuit": "8-Ball Circuit",
    "18 Up & Downs": "18 Up & Downs",
    "Easy Chip Drill": "Easy Chip Drill",
    "Approach Control 130-180m": "Approach Control 130-180m",
    "Wedge Ladder 60-120m": "Wedge Ladder 60-120m",
    "Wedge Game 40-80m": "Wedge Game 40-80m",
    "Shot Shape Master": "Shot Shape Master",
    "Driver Control Drill": "Driver Control Drill",
  };
  return titleMap[title] || title;
};
