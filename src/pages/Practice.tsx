import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Practice = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Practice</h1>
          <p className="text-muted-foreground">Improve your game with drills and levels</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Card 
            className="border-2 hover:border-primary transition-all duration-200 cursor-pointer"
            onClick={() => navigate('/categories')}
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-foreground">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Target size={32} className="text-primary" />
                </div>
                <div>
                  <div className="text-2xl">Drills</div>
                  <div className="text-sm font-normal text-muted-foreground mt-1">
                    Practice specific skills
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Choose from putting, short game, wedges, and more
              </p>
            </CardContent>
          </Card>

          <Card 
            className="border-2 hover:border-primary transition-all duration-200 cursor-pointer"
            onClick={() => navigate('/levels')}
          >
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-foreground">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Trophy size={32} className="text-primary" />
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
                See where you stand across all aspects of the game
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Practice;
