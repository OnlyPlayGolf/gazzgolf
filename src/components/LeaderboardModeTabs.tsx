import { cn } from "@/lib/utils";

export type LeaderboardMode = 'primary' | 'stroke_play';

interface LeaderboardModeTabsProps {
  primaryLabel: string;
  activeMode: LeaderboardMode;
  onModeChange: (mode: LeaderboardMode) => void;
  strokePlayEnabled?: boolean;
}

export function LeaderboardModeTabs({
  primaryLabel,
  activeMode,
  onModeChange,
  strokePlayEnabled = true,
}: LeaderboardModeTabsProps) {
  if (!strokePlayEnabled) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-1 py-2 px-4 bg-muted/30 border-b">
      <button
        onClick={() => onModeChange('primary')}
        className={cn(
          "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
          activeMode === 'primary'
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        {primaryLabel}
      </button>
      <span className="text-muted-foreground mx-1">|</span>
      <button
        onClick={() => onModeChange('stroke_play')}
        className={cn(
          "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
          activeMode === 'stroke_play'
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        Stroke Play
      </button>
    </div>
  );
}
