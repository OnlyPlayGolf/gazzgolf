import { useParams } from "react-router-dom";
import { WolfBottomTabBar } from "@/components/WolfBottomTabBar";
import { Card } from "@/components/ui/card";

export default function WolfFeed() {
  const { gameId } = useParams();

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="bg-primary text-primary-foreground py-4 px-4">
        <h1 className="text-xl font-bold text-center">Game Feed</h1>
      </div>
      
      <div className="max-w-2xl mx-auto p-4">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Game activity will appear here.</p>
        </Card>
      </div>

      <WolfBottomTabBar gameId={gameId!} />
    </div>
  );
}
