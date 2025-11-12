import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

export default function ShotShapeMasterFeed() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Newspaper className="text-muted-foreground mb-4" size={48} />
            <h3 className="text-lg font-medium text-foreground mb-2">Game Feed</h3>
            <p className="text-muted-foreground text-center">
              See your friends' scores and recent activity here
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
