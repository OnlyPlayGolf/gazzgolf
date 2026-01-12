import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TopNavBar } from "@/components/TopNavBar";

const ShortGameDrills = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
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
          <Card className="border-golf-light hover:border-primary transition-all duration-200 cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-foreground">
                <Target size={24} className="text-primary" />
                <div>
                  <div>Easy Chip Drill</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    Short Game • Consecutive chips
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Build consistency on simple chip shots. See how many chips in a row you can land inside one wedge length from the hole.
              </p>
              
              <Button 
                onClick={() => navigate('/drill/easy-chip/score')}
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
                  <div>8-Ball Drill</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    Short Game • Circuit points
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Perform circuit 5 times across 8 stations with point-based scoring system
              </p>
              
              <Button 
                onClick={() => navigate('/drill/8-ball-points')}
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

export default ShortGameDrills;