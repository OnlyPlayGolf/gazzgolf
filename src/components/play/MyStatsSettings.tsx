import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BarChart3, Target, Zap, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { StatsMode } from './StatsModeSelector';

interface MyStatsSettingsProps {
  currentMode: StatsMode;
  onModeChange: (mode: StatsMode) => Promise<void>;
  onDeleteStats: () => Promise<void>;
  saving?: boolean;
}

// Priority order for modes (higher = more detailed)
const MODE_PRIORITY: Record<StatsMode, number> = {
  none: 0,
  basic: 1,
  strokes_gained: 2,
};

export function MyStatsSettings({
  currentMode,
  onModeChange,
  onDeleteStats,
  saving,
}: MyStatsSettingsProps) {
  const { toast } = useToast();
  const [pendingMode, setPendingMode] = useState<StatsMode | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleModeSelect = (newMode: StatsMode) => {
    if (newMode === currentMode) return;

    // Check if downgrading
    if (MODE_PRIORITY[newMode] < MODE_PRIORITY[currentMode]) {
      setPendingMode(newMode);
      setShowConfirmDialog(true);
    } else {
      // Upgrading is safe, just update
      onModeChange(newMode);
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!pendingMode) return;

    setProcessing(true);
    try {
      // Delete existing stats
      await onDeleteStats();
      // Update to new mode
      await onModeChange(pendingMode);
      toast({ title: 'Stats mode updated', description: 'Previous statistics have been cleared.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
      setShowConfirmDialog(false);
      setPendingMode(null);
    }
  };

  const getModeLabel = (mode: StatsMode): string => {
    switch (mode) {
      case 'none':
        return 'None';
      case 'basic':
        return 'Basic Stats';
      case 'strokes_gained':
        return 'Strokes Gained';
      default:
        return mode;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-primary" />
            My Stats Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose how to track your personal statistics in this round.
          </p>

          <RadioGroup
            value={currentMode}
            onValueChange={(v) => handleModeSelect(v as StatsMode)}
            className="space-y-2"
            disabled={saving || processing}
          >
            <div
              className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                currentMode === 'none' ? 'border-green-500 bg-green-500/10' : 'hover:bg-muted/50'
              }`}
              onClick={() => handleModeSelect('none')}
            >
              <RadioGroupItem value="none" id="stats-none" className="hidden" />
              <Label htmlFor="stats-none" className="flex-1 cursor-pointer text-sm">
                None
              </Label>
            </div>

            <div
              className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                currentMode === 'basic' ? 'border-green-500 bg-green-500/10' : 'hover:bg-muted/50'
              }`}
              onClick={() => handleModeSelect('basic')}
            >
              <RadioGroupItem value="basic" id="stats-basic" className="hidden" />
              <Label htmlFor="stats-basic" className="flex-1 cursor-pointer text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                Basic Stats
                <span className="text-xs text-muted-foreground">(Fairways, GIR, Scrambling, Putts)</span>
              </Label>
            </div>

            <div
              className={`flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                currentMode === 'strokes_gained' ? 'border-green-500 bg-green-500/10' : 'hover:bg-muted/50'
              }`}
              onClick={() => handleModeSelect('strokes_gained')}
            >
              <RadioGroupItem value="strokes_gained" id="stats-sg" className="hidden" />
              <Label htmlFor="stats-sg" className="flex-1 cursor-pointer text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Strokes Gained
                <span className="text-xs text-muted-foreground">(Shot-by-shot)</span>
              </Label>
            </div>
          </RadioGroup>

          {(saving || processing) && (
            <p className="text-xs text-muted-foreground text-center">Saving...</p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Change Stats Mode?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Switching from <strong>{getModeLabel(currentMode)}</strong> to{' '}
              <strong>{getModeLabel(pendingMode || 'none')}</strong> will delete all your existing
              statistics for this round. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDowngrade}
              disabled={processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? 'Deleting...' : 'Delete Stats & Change'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
