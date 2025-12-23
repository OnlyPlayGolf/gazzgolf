import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HowToPlayStrokePlay() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="p-4 pt-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">How to Play Stroke Play</h1>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Overview</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Stroke Play is the most common format in golf. Each player counts the 
                total number of strokes taken to complete the round.
              </p>
              <p>
                The player with the fewest total strokes wins.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How It Works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Count every stroke on each hole</p>
              <p>• Add up your total strokes for all holes</p>
              <p>• Lowest total score wins</p>
              <p>• Handicaps can be applied for net scoring</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Score vs Par</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Your score is often expressed relative to par. If the course par is 72 
                and you shot 75, you're "+3" or "3 over par."
              </p>
              <p>
                <strong>Even par:</strong> Shot exactly the course par (E)
              </p>
              <p>
                <strong>Under par:</strong> Shot fewer strokes than par (-1, -2, etc.)
              </p>
              <p>
                <strong>Over par:</strong> Shot more strokes than par (+1, +2, etc.)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Handicap Play</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                When using handicaps, players receive strokes on specific holes based 
                on the stroke index. The lower the stroke index, the harder the hole.
              </p>
              <p>
                Your net score equals your gross score minus the strokes you receive 
                on each hole.
              </p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
