import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Trophy, BarChart3, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AuthGuard from "@/components/AuthGuard";

const PracticeContent = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Practice</h1>
          <p className="text-muted-foreground">Improve your game with competitive practice</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Card 
            className="border-2 hover:border-primary transition-all duration-200 cursor-pointer"
            onClick={() => navigate('/leaderboards')}
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-foreground">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Trophy size={32} className="text-primary" />
                </div>
                <div>
                  <div className="text-2xl">Leaderboards</div>
                  <div className="text-sm font-normal text-muted-foreground mt-1">
                    Levels and drills leaderboards
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
          </Card>

          <Card 
            className="border-2 hover:border-primary transition-all duration-200 cursor-pointer"
            onClick={() => navigate('/levels', { state: { from: 'practice' } })}
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-foreground">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <TrendingUp size={32} className="text-primary" />
                </div>
                <div>
                  <div className="text-2xl">Levels</div>
                  <div className="text-sm font-normal text-muted-foreground mt-1">
                    Track your skill progression
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Turn your golf practice into a video game
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-2 hover:border-primary transition-all duration-200 cursor-pointer"
            onClick={() => navigate('/categories', { state: { from: 'practice' } })}
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-foreground">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Target size={32} className="text-primary" />
                </div>
                <div>
                  <div className="text-2xl">Drills & Tests</div>
                  <div className="text-sm font-normal text-muted-foreground mt-1">
                    Game-like practice
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Improve your game and climb the leaderboards
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-2 hover:border-primary transition-all duration-200 cursor-pointer"
            onClick={() => navigate('/rounds/pro-setup')}
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-foreground">
              <div className="p-3 bg-primary/10 rounded-lg">
                  <BarChart3 size={32} className="text-primary" />
                </div>
                <div>
                  <div className="text-2xl">Add Stats</div>
                  <div className="text-sm font-normal text-muted-foreground mt-1">
                    Track strokes gained
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Detailed shot-by-shot tracking with strokes gained analysis
              </p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

const Practice = () => {
  return (
    <AuthGuard>
      <PracticeContent />
    </AuthGuard>
  );
};

export default Practice;
