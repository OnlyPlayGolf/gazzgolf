import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { TopNavBar } from "@/components/TopNavBar";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { SkinsBottomTabBar } from "@/components/SkinsBottomTabBar";
import { useIsSpectator } from "@/hooks/useIsSpectator";
import { useRoundNavigation } from "@/hooks/useRoundNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info, ArrowLeft } from "lucide-react";

export default function RoundInfo() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { isSpectator, isLoading: isSpectatorLoading } = useIsSpectator('round', roundId);
  
  // Use standardized navigation hook for back button behavior
  const { handleBack } = useRoundNavigation({
    gameId: roundId || '',
    mode: 'round',
  });
  
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    if (roundId) {
      const fetchRound = async () => {
        const { data } = await supabase
          .from("rounds")
          .select("origin")
          .eq("id", roundId)
          .single();
        setOrigin(data?.origin || null);
      };
      fetchRound();
    }
  }, [roundId]);

  const renderBottomTabBar = () => {
    if (!roundId || isSpectatorLoading) return null;
    if (origin === "skins") {
      return <SkinsBottomTabBar roundId={roundId} isSpectator={isSpectator} />;
    }
    return <RoundBottomTabBar roundId={roundId} isSpectator={isSpectator} />;
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      {isSpectator ? (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-4">
          <div className="relative flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-0 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={handleBack}
            >
              <ArrowLeft size={20} />
            </Button>
            <h2 className="text-lg font-bold">Game Info</h2>
          </div>
        </div>
      ) : (
        <TopNavBar />
      )}
      <div className={`p-4 max-w-2xl mx-auto space-y-4 ${isSpectator ? 'pt-20' : 'pt-20'}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="text-primary" />
              About Stroke Play
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Overview</h3>
              <p className="text-sm text-muted-foreground">
                Stroke play is the most common format in golf. Each player counts the total number of strokes taken to complete the round. The player with the fewest strokes wins.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">How It Works</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Count every stroke on each hole</li>
                <li>• Add up your total strokes for all holes</li>
                <li>• Lowest total score wins</li>
                <li>• Handicaps can be applied for net scoring</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Scoring Terms</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Eagle:</strong> 2 under par</li>
                <li>• <strong>Birdie:</strong> 1 under par</li>
                <li>• <strong>Par:</strong> Expected strokes for the hole</li>
                <li>• <strong>Bogey:</strong> 1 over par</li>
                <li>• <strong>Double Bogey:</strong> 2 over par</li>
              </ul>
            </div>

          </CardContent>
        </Card>
      </div>
      {renderBottomTabBar()}
    </div>
  );
}
