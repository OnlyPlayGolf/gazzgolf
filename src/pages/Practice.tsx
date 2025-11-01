import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Target, Zap, Hammer, Activity, Star, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getLevelsWithProgress } from "@/utils/levelsManager";
import { Level } from "@/types/levels";

const categories = [
  { id: 'putting', name: 'Putting', icon: Target, enabled: true, description: 'Precision on the green' },
  { id: 'shortgame', name: 'Short Game', icon: Zap, enabled: true, description: 'Chipping, pitching, and bunker shots' },
  { id: 'wedges', name: 'Wedges', icon: Hammer, enabled: true, description: 'Sand and lob shots' },
  { id: 'longgame', name: 'Long Game', icon: Activity, enabled: true, description: 'Mid to long range shots' },
  { id: 'favourites', name: 'Favourites', icon: Star, enabled: true, description: 'Your starred drills' },
];

const Practice = () => {
  const [activeTab, setActiveTab] = useState("drills");
  const navigate = useNavigate();

  // Get levels data for Levels tab
  const allLevels = getLevelsWithProgress();
  const difficulties = ['beginner', 'intermediate', 'advanced'];

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "putt":
        return "bg-primary text-primary-foreground";
      case "chip":
        return "bg-secondary text-secondary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Practice</h1>
          <p className="text-muted-foreground">Improve your game with drills and levels</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="drills">Drills</TabsTrigger>
            <TabsTrigger value="levels">Levels</TabsTrigger>
          </TabsList>
          
          <TabsContent value="drills" className="mt-0">
            <div className="grid gap-4">
              {categories.map((category) => {
                const Icon = category.icon;
                
                return (
                  <Card 
                    key={category.id} 
                    className={cn(
                      "transition-all duration-200",
                      category.enabled 
                        ? "border-golf-light hover:border-primary cursor-pointer" 
                        : "border-border bg-muted/30"
                    )}
                    onClick={() => category.enabled && navigate(`/drills/${category.id}`)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className={cn(
                        "flex items-center justify-between",
                        category.enabled ? "text-foreground" : "text-locked"
                      )}>
                        <div className="flex items-center gap-3">
                          <Icon 
                            size={24} 
                            className={category.enabled ? "text-primary" : "text-locked"} 
                          />
                          <span>{category.name}</span>
                        </div>
                        {!category.enabled && <Lock size={16} className="text-locked" />}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={cn(
                        "text-sm mb-4",
                        category.enabled ? "text-muted-foreground" : "text-locked"
                      )}>
                        {category.description}
                      </p>
                      
                      {category.enabled ? (
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/drills/${category.id}`);
                          }}
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          View Drills
                        </Button>
                      ) : (
                        <div className="flex items-center justify-between">
                          <Button disabled variant="secondary" className="bg-muted text-locked">
                            Coming Soon
                          </Button>
                          <span className="text-xs text-locked">Locked</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
          
          <TabsContent value="levels" className="mt-0">
            <div className="grid gap-4">
              {difficulties.map((difficulty) => {
                const difficultyLevels = allLevels.filter(
                  (level) => level.difficulty.toLowerCase() === difficulty.toLowerCase()
                );
                const completed = difficultyLevels.filter((level) => level.completed).length;
                const total = difficultyLevels.length;
                const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <Card 
                    key={difficulty}
                    className="border-golf-light hover:border-primary cursor-pointer transition-all duration-200"
                    onClick={() => navigate(`/levels/${difficulty}`)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between text-foreground">
                        <div className="flex items-center gap-3">
                          <Target size={24} className="text-primary" />
                          <span className="capitalize">{difficulty}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {completed}/{total}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <Progress value={percentage} className="h-2" />
                        <p className="text-sm text-muted-foreground">
                          {percentage}% Complete
                        </p>
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/levels/${difficulty}`);
                          }}
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          Start Training
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Practice;
