import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { BarChart3, Target, Zap } from 'lucide-react';
import { StatsMode } from './StatsModeSelector';

interface PlayerStatsModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: StatsMode) => Promise<void>;
  currentMode?: StatsMode;
  saving?: boolean;
}

export function PlayerStatsModeDialog({
  open,
  onOpenChange,
  onSelect,
  currentMode,
  saving,
}: PlayerStatsModeDialogProps) {
  const [selectedMode, setSelectedMode] = useState<StatsMode>(currentMode ?? 'none');

  // Keep dialog selection in sync with the latest saved mode
  useEffect(() => {
    if (!open) return;
    setSelectedMode(currentMode ?? 'none');
  }, [open, currentMode]);

  const handleConfirm = async () => {
    await onSelect(selectedMode);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Stats for me in this round
          </DialogTitle>
          <DialogDescription>
            Choose how you want to track your personal statistics during this game.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedMode}
          onValueChange={(v) => setSelectedMode(v as StatsMode)}
          className="space-y-3 py-4"
        >
          <div
            className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
              selectedMode === 'none' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
            }`}
            onClick={() => setSelectedMode('none')}
          >
            <RadioGroupItem value="none" id="none" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="none" className="text-sm font-medium cursor-pointer">
                None
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                No personal statistics will be tracked
              </p>
            </div>
          </div>

          <div
            className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
              selectedMode === 'basic' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
            }`}
            onClick={() => setSelectedMode('basic')}
          >
            <RadioGroupItem value="basic" id="basic" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="basic" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                Basic Stats
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Track fairways hit, greens in regulation, and putts per hole
              </p>
            </div>
          </div>

          <div
            className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
              selectedMode === 'strokes_gained' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
            }`}
            onClick={() => setSelectedMode('strokes_gained')}
          >
            <RadioGroupItem value="strokes_gained" id="strokes_gained" className="mt-0.5" />
            <div className="flex-1">
              <Label htmlFor="strokes_gained" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Strokes Gained
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Detailed shot-by-shot tracking for strokes gained analysis
              </p>
            </div>
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? 'Saving...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
