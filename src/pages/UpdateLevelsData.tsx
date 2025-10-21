import { Button } from "@/components/ui/button";
import { getUpdatedLevelsData, exportUpdatedLevels } from "@/utils/updateLevelsData";

const UpdateLevelsData = () => {
  const handleDownload = () => {
    const jsonString = exportUpdatedLevels();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'levels_updated.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    const jsonString = exportUpdatedLevels();
    navigator.clipboard.writeText(jsonString);
    alert('Updated levels JSON copied to clipboard!');
  };

  const stats = getUpdatedLevelsData();
  const beginnerLevels = stats.filter((l: any) => l.Difficulty === 'Beginner');
  const intermediateLevels = stats.filter((l: any) => l.Difficulty === 'Intermediate');
  const amateurLevels = stats.filter((l: any) => l.Difficulty === 'Amateur');
  const professionalLevels = stats.filter((l: any) => l.Difficulty === 'Professional');

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Update Levels Data</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">New Level Ranges:</h2>
        <ul className="space-y-1">
          <li>Beginner: Levels {Math.min(...beginnerLevels.map((l: any) => l.Level))} - {Math.max(...beginnerLevels.map((l: any) => l.Level))}</li>
          <li>Intermediate: Levels {Math.min(...intermediateLevels.map((l: any) => l.Level))} - {Math.max(...intermediateLevels.map((l: any) => l.Level))}</li>
          <li>Amateur: Levels {Math.min(...amateurLevels.map((l: any) => l.Level))} - {Math.max(...amateurLevels.map((l: any) => l.Level))}</li>
          <li>Professional: Levels {Math.min(...professionalLevels.map((l: any) => l.Level))} - {Math.max(...professionalLevels.map((l: any) => l.Level))}</li>
        </ul>
      </div>

      <div className="space-x-4">
        <Button onClick={handleDownload}>
          Download Updated JSON
        </Button>
        <Button onClick={handleCopy} variant="outline">
          Copy to Clipboard
        </Button>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        This will generate the updated levels.json file with sequential level numbers across all difficulty tiers.
        Download the file and replace the existing src/data/levels.json file with it.
      </p>
    </div>
  );
};

export default UpdateLevelsData;
