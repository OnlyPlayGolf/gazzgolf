import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { BestBallBottomTabBar } from "@/components/BestBallBottomTabBar";

export default function BestBallFeed() {
  const { gameId } = useParams();

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="p-4 pt-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Game Feed</h1>
        
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Game updates will appear here
          </p>
        </Card>
      </div>

      {gameId && <BestBallBottomTabBar gameId={gameId} />}
    </div>
  );
}
