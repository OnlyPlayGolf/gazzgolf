import levelsData from '@/data/levels.json';

// Generate the complete updated JSON
export const generateUpdatedLevelsJSON = () => {
  const updated = levelsData.map((level: any) => {
    const offset = {
      'Beginner': 0,
      'Intermediate': 100,
      'Amateur': 200,
      'Professional': 300
    }[level.Difficulty] || 0;
    
    return {
      Level: level.Level + offset,
      Title: level.Title,
      Description: level.Description,
      Distance: level.Distance,
      Target: level.Target,
      Type: level.Type,
      Difficulty: level.Difficulty
    };
  });
  
  return updated;
};

// For debugging - log the ranges
export const logLevelRanges = () => {
  const updated = generateUpdatedLevelsJSON();
  const byDifficulty = {
    Beginner: updated.filter(l => l.Difficulty === 'Beginner'),
    Intermediate: updated.filter(l => l.Difficulty === 'Intermediate'),
    Amateur: updated.filter(l => l.Difficulty === 'Amateur'),
    Professional: updated.filter(l => l.Difficulty === 'Professional')
  };
  
  Object.entries(byDifficulty).forEach(([diff, levels]) => {
    const nums = levels.map(l => l.Level);
    console.log(`${diff}: ${Math.min(...nums)}-${Math.max(...nums)} (${levels.length} levels)`);
  });
};
