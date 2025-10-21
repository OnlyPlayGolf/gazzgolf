import levelsData from '@/data/levels.json';
import * as fs from 'fs';
import * as path from 'path';

interface LevelData {
  Level: number;
  Title: string;
  Description: string;
  Distance: string;
  Target: string;
  Type: string;
  Difficulty: string;
}

// Function to renumber levels
function renumberLevels() {
  const updatedLevels = levelsData.map((level: LevelData) => {
    let newLevel = level.Level;
    
    switch (level.Difficulty) {
      case 'Beginner':
        // Keep as is (1-100)
        newLevel = level.Level;
        break;
      case 'Intermediate':
        // Change to 101-200
        newLevel = level.Level + 100;
        break;
      case 'Amateur':
        // Change to 201-300
        newLevel = level.Level + 200;
        break;
      case 'Professional':
        // Change to 301-400
        newLevel = level.Level + 300;
        break;
    }
    
    return {
      ...level,
      Level: newLevel
    };
  });

  // Write back to the JSON file
  const filePath = path.join(__dirname, '../data/levels.json');
  fs.writeFileSync(filePath, JSON.stringify(updatedLevels, null, 2));
  
  console.log('Levels renumbered successfully!');
  console.log(`Total levels processed: ${updatedLevels.length}`);
}

// Run the renumbering
renumberLevels();
