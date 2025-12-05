import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HowToPlayUmbriago() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="text-primary" />
              How to Play Umbriago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Overview</h3>
              <p className="text-sm text-muted-foreground">
                A 2v2 team game where points are won across 4 categories on every hole. The team with the most points at the end wins. No handicaps – scratch play only.
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">4 Ways to Win Points Each Hole</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Team Low:</strong> Team with the lowest combined score wins 1 point</li>
                <li>• <strong>Individual Low:</strong> Team of the player with the lowest score wins 1 point</li>
                <li>• <strong>Closest to Pin (GIR):</strong> Measured after the regulation shot (1 on par 3, 2 on par 4, 3 on par 5). Ball must be on the green – a ball off the green cannot win even if closer</li>
                <li>• <strong>Birdie or Better:</strong> If only one team makes birdie (or better), they win 1 point</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Tee-Off Order</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• The team leading in points tees off first</li>
                <li>• If tied, the team that came back from a losing position goes first</li>
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Umbriago (Bonus!)</h3>
              <p className="text-sm text-muted-foreground">
                Win all 4 categories on a single hole? Your points are <strong>doubled</strong> (4 → 8 points)!
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Doubles & Double Backs</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Double:</strong> Before a hole, the losing team can call "Double" to multiply that hole's points by 2</li>
                <li>• <strong>Double Back:</strong> After everyone has played their shot, the opposing team may call "Double Back" to instead multiply the points for that hole by 4</li>
              </ul>
            </div>

            <Button
              onClick={() => navigate('/umbriago/setup')}
              className="w-full"
              size="lg"
            >
              Start Umbriago Game
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
