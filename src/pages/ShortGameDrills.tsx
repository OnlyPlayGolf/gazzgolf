import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ShortGameDrills = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="flex items-center mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/drills')}
            className="mr-3"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Short Game Drills</h1>
            <p className="text-muted-foreground">Master your short game skills</p>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="border-golf-light">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Target size={20} />
                8-Ball Drill (Points)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-3">
                Perform circuit 5 times across 8 stations with point-based scoring system
              </p>
              
              <div className="space-y-3 mb-4">
                <div>
                  <h4 className="font-medium mb-2">Stations (8):</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Chip 10m</li>
                    <li>• Chip 30m</li>
                    <li>• Pitch 20m</li>
                    <li>• Pitch 40m</li>
                    <li>• Lob 15m</li>
                    <li>• Lob 25m</li>
                    <li>• Bunker 10m</li>
                    <li>• Bunker 20m</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Scoring:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Holed: <span className="font-medium">4 pts</span></li>
                    <li>• Within 1m: <span className="font-medium">3 pts</span></li>
                    <li>• Within 2m: <span className="font-medium">2 pts</span></li>
                    <li>• Within 3m: <span className="font-medium">1 pt</span></li>
                  </ul>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate('/drill/8-ball-points')}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl"
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

export default ShortGameDrills;