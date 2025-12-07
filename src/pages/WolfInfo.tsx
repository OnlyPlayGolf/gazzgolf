import { useParams } from "react-router-dom";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
import { Card } from "@/components/ui/card";

export default function WolfInfo() {
  const { gameId } = useParams();

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="bg-primary text-primary-foreground py-4 px-4">
        <h1 className="text-xl font-bold text-center">Game Info</h1>
      </div>
      
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">How Wolf Works</h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p><strong>Wolf Rotation:</strong> The Wolf rotates each hole. On Hole 1, the last player in order is Wolf, then it cycles.</p>
            <p><strong>Choose Partner or Lone Wolf:</strong> After seeing tee shots, the Wolf can pick a partner or go solo (Lone Wolf).</p>
            <p><strong>Matchups:</strong> Wolf + partner vs others, OR Lone Wolf vs everyone.</p>
            <p><strong>Scoring:</strong> Best ball determines winner. Lone Wolf win = big points. Team win = shared points.</p>
          </div>
        </Card>
        
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Points Guide</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Lone Wolf wins solo</span>
              <span className="font-bold text-green-600">+3 pts</span>
            </div>
            <div className="flex justify-between">
              <span>Lone Wolf loses (opponents each)</span>
              <span className="font-bold text-red-600">+1 pt</span>
            </div>
            <div className="flex justify-between">
              <span>Team win (each member)</span>
              <span className="font-bold text-blue-600">+1 pt</span>
            </div>
          </div>
        </Card>
      </div>

      <WolfBottomTabBar gameId={gameId!} />
    </div>
  );
}
