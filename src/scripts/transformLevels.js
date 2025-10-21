// Node.js script to transform levels data
// Run with: node src/scripts/transformLevels.js

const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../data/levels.json');
const outputPath = path.join(__dirname, '../data/levels.json');

// Read the current levels data
const levelsData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Transform the data
const updatedLevels = levelsData.map(level => {
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

// Write the updated data back
fs.writeFileSync(outputPath, JSON.stringify(updatedLevels, null, 2), 'utf8');

console.log('✓ Levels renumbered successfully!');
console.log(`  Total levels: ${updatedLevels.length}`);
console.log(`  Beginner: 1-100`);
console.log(`  Intermediate: 101-200`);
console.log(`  Amateur: 201-300`);
console.log(`  Professional: 301-400`);

