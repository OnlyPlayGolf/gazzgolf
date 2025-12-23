import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RoundBottomTabBar } from "@/components/RoundBottomTabBar";
import { SimpleSkinsBottomTabBar } from "@/components/SimpleSkinsBottomTabBar";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

export default function RoundFeed() {
  const { roundId } = useParams();
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    if (roundId) {
      supabase
        .from("rounds")
        .select("origin")
        .eq("id", roundId)
        .single()
        .then(({ data }) => {
          setOrigin(data?.origin || null);
        });
    }
  }, [roundId]);

  const renderBottomTabBar = () => {
    if (!roundId) return null;
    if (origin === "simple_skins") {
      return <SimpleSkinsBottomTabBar roundId={roundId} />;
    }
    return <RoundBottomTabBar roundId={roundId} />;
  };

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
      {renderBottomTabBar()}
    </div>
  );
}
