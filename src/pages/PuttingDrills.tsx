import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TopNavBar } from "@/components/TopNavBar";

const PuttingDrills = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
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
                  <div>Short Putting</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    Putting • Under pressure
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Start at 3 feet. Make putts from four positions around the hole to move back. Miss once and restart.
              </p>
              
              <Button 
                onClick={() => navigate('/drill/short-putting-test/score')}
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
                  <div>PGA Tour 18 Holes</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    Putting • Mixed distances
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                18 putts based on the PGA Tour's average first putt per hole. A great drill to use for overall putting practice, compete with friends, test yourself against tour standards or dial in your speed control.
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
                The Aggressive Putting drill helps you commit with confidence inside six meters. We're training speed and confidence - no hesitant strokes.
              </p>
              
              <Button 
                onClick={() => navigate('/drill/aggressive-putting/score')}
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
                  <div>Up & Down Putting</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    Putting • Uphill & downhill
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                A speed control test that challenges you on both uphill and downhill putts. Learn how elevation changes affect your pace and break.
              </p>
              
              <Button 
                onClick={() => navigate('/drill/up-down-putting/score')}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Open
              </Button>
            </CardContent>
          </Card>

          <Card className="border-golf-light hover:border-primary transition-all duration-200 cursor-pointer">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-foreground">
                <Target size={24} className="text-primary" />
                <div>
                  <div>Jason Day's Lag Drill</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    Putting • 8-20m lag putting
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                18 randomized putts from 8-20 meters. A great drill for improving lag putting and reducing three putts. Score points based on proximity. Get as many points as possible!
              </p>
              
              <Button 
                onClick={() => navigate('/drill/jason-day-lag/score')}
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