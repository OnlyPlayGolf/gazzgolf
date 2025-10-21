// Utility to transform levels data with new numbering
import levelsData from '@/data/levels.json';

export function getUpdatedLevelsData() {
  return levelsData.map((level: any) => {
    let newLevelNumber = level.Level;
    
    switch (level.Difficulty) {
      case 'Beginner':
        // Keep as is (1-100)
        newLevelNumber = level.Level;
        break;
      case 'Intermediate':
        // Change to 101-200
        newLevelNumber = level.Level + 100;
        break;
      case 'Amateur':
        // Change to 201-300
        newLevelNumber = level.Level + 200;
        break;
      case 'Professional':
        // Change to 301-400
        newLevelNumber = level.Level + 300;
        break;
    }
    
    return {
      ...level,
      Level: newLevelNumber
    };
  });
}

// Export as JSON string for copying
export function exportUpdatedLevels() {
  const updated = getUpdatedLevelsData();
  return JSON.stringify(updated, null, 2);
}
