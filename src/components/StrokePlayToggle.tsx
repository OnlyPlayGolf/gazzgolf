import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStrokePlayEnabled } from "@/hooks/useStrokePlayEnabled";

interface StrokePlayToggleProps {
  gameId: string | undefined;
  gameType: string;
}

export function StrokePlayToggle({ gameId, gameType }: StrokePlayToggleProps) {
  const { strokePlayEnabled, setStrokePlayEnabled } = useStrokePlayEnabled(gameId, gameType);

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label>Stroke Play Leaderboard</Label>
        <p className="text-xs text-muted-foreground">
          Show individual stroke play scores alongside this game
        </p>
      </div>
      <Switch checked={strokePlayEnabled} onCheckedChange={setStrokePlayEnabled} />
    </div>
  );
}
