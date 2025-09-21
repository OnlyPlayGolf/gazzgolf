import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, TrendingUp } from "lucide-react";

const Home = () => {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Golf Training</h1>
          <p className="text-muted-foreground">Improve your game with structured practice</p>
        </div>

        <div className="space-y-4">
          <Card className="border-golf-light">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Target size={20} />
                Quick Practice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Jump into your putting drills and track your progress
              </p>
              <div className="text-xs text-muted-foreground">
                Latest: PGA Tour 18 Holes
              </div>
            </CardContent>
          </Card>

          <Card className="border-golf-light">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-primary">
                <TrendingUp size={20} />
                Progress Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Track your improvement across all skill areas
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Home;