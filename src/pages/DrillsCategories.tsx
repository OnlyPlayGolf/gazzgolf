import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Target, Zap, Hammer, Activity, Star, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TopNavBar } from "@/components/TopNavBar";

const categories = [
  { id: 'favorites', name: 'Favorites', icon: Star, enabled: true, description: 'Your favorite drills' },
  { id: 'putting', name: 'Putting', icon: Target, enabled: true, description: 'Precision on the green' },
  { id: 'shortgame', name: 'Short Game', icon: Zap, enabled: true, description: 'Chipping, pitching, and bunker shots' },
  { id: 'approach', name: 'Approach', icon: Activity, enabled: true, description: 'Wedges and approach shots' },
  { id: 'teeshots', name: 'Tee Shots', icon: Target, enabled: true, description: 'Driving and tee shot accuracy' },
];

const DrillsCategories = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/practice")}
              className="rounded-full flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Test & Drills</h1>
          </div>
          <p className="text-muted-foreground">Choose your skill area to practice</p>
        </div>

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
                        className={
                          category.id === 'favorites' 
                            ? "text-amber-500" 
                            : category.enabled 
                              ? "text-primary" 
                              : "text-locked"
                        } 
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
      </div>
    </div>
  );
};

export default DrillsCategories;