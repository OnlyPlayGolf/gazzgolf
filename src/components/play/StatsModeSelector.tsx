import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3 } from "lucide-react";

export type StatsMode = 'none' | 'basic' | 'strokes_gained';

interface StatsModeSelectorProps {
  value: StatsMode;
  onChange: (value: StatsMode) => void;
  className?: string;
}

export function StatsModeSelector({ value, onChange, className }: StatsModeSelectorProps) {
  return (
    <div className={`space-y-2 ${className || ''}`}>
      <Label className="flex items-center gap-2">
        <BarChart3 size={16} className="text-primary" />
        Track Statistics
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as StatsMode)}>
        <SelectTrigger>
          <SelectValue placeholder="Select stats mode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="basic">Basic Stats (Fairways, GIR, Scrambling, Putts)</SelectItem>
          <SelectItem value="strokes_gained">Strokes Gained</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {value === 'none' && "No statistics will be tracked during play"}
        {value === 'basic' && "Track fairways hit, greens in regulation, scrambling, and putts per hole"}
        {value === 'strokes_gained' && "Track detailed shot-by-shot data for strokes gained analysis"}
      </p>
    </div>
  );
}
