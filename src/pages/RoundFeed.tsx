import { useParams } from "react-router-dom";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

export default function RoundFeed() {
  const { roundId } = useParams();

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <div className="p-4 pt-6 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Newspaper className="mx-auto text-muted-foreground mb-4" size={48} />
            <h2 className="text-lg font-semibold mb-2">Game Feed</h2>
            <p className="text-sm text-muted-foreground">
              Game activity and updates will appear here as you play.
            </p>
          </CardContent>
        </Card>
      </div>
      {roundId && <RoundBottomTabBar roundId={roundId} />}
    </div>
  );
}
