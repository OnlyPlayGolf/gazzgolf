import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StrokePlaySettings {
  mulligansPerPlayer: number;
  handicapEnabled: boolean;
}

interface StrokePlaySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: StrokePlaySettings;
  onSettingsChange: (settings: StrokePlaySettings) => void;
}

export function StrokePlaySettingsDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: StrokePlaySettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<StrokePlaySettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stroke Play Settings</DialogTitle>
          <DialogDescription>
            Configure game settings for your round
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Mulligans per player */}
          <div className="space-y-2">
            <Label htmlFor="mulligans">Mulligans per Player</Label>
            <Select 
              value={localSettings.mulligansPerPlayer.toString()} 
              onValueChange={(value) => setLocalSettings({ ...localSettings, mulligansPerPlayer: parseInt(value) })}
            >
              <SelectTrigger id="mulligans">
                <SelectValue placeholder="Select mulligans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 (No mulligans)</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="9">9 (1 per hole on 9)</SelectItem>
                <SelectItem value="18">18 (1 per hole on 18)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Number of allowed do-overs per player during the round
            </p>
          </div>

          {/* Handicap toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="handicap">Use Handicaps</Label>
              <p className="text-xs text-muted-foreground">
                Apply player handicaps to scoring
              </p>
            </div>
            <Switch
              id="handicap"
              checked={localSettings.handicapEnabled}
              onCheckedChange={(checked) => setLocalSettings({ ...localSettings, handicapEnabled: checked })}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
