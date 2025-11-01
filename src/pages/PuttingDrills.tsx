import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PuttingDrills = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/drills')}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Putting Drills</h1>
            <p className="text-muted-foreground">Master your putting technique</p>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="border-golf-light hover:border-primary transition-all duration-200 cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-foreground">
                <Target size={24} className="text-primary" />
                <div>
                  <div>PGA Tour 18 Holes</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    Putting • Mixed distances
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Practice putting from tournament-style distances across 18 holes. 
                Perfect for developing consistency under pressure.
              </p>
              
              <Button 
                onClick={() => navigate('/drill/pga-tour-18/score')}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Open Drill
              </Button>
            </CardContent>
          </Card>

          <Card className="border-golf-light hover:border-primary transition-all duration-200 cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-foreground">
                <Target size={24} className="text-primary" />
                <div>
                  <div>Aggressive Putting</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    Putting • 4m, 5m, 6m cycle
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Putt from a fixed cycle of 4m, 5m, then 6m, repeating in that order. 
                Goal is to reach 15 points as quickly as possible.
              </p>
              
              <Button 
                onClick={() => navigate('/drill/aggressive-putting/score')}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Open Drill
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PuttingDrills;