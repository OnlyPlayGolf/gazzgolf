import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Target, Zap, Hammer, Activity, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AddFriendDialog } from "@/components/AddFriendDialog";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { MessagesSheet } from "@/components/MessagesSheet";

const categories = [
  { id: 'putting', name: 'Putting', icon: Target, enabled: true, description: 'Precision on the green' },
  { id: 'shortgame', name: 'Short Game', icon: Zap, enabled: true, description: 'Chipping, pitching, and bunker shots' },
  { id: 'wedges', name: 'Wedges', icon: Hammer, enabled: true, description: 'Sand and lob shots' },
  { id: 'longgame', name: 'Long Game', icon: Activity, enabled: true, description: 'Mid to long range shots' },
  { id: 'favourites', name: 'Favourites', icon: Star, enabled: true, description: 'Your starred drills' },
];

const DrillsCategories = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Practice Drills</h1>
              <p className="text-muted-foreground">Choose your skill area to practice</p>
            </div>
            <div className="flex items-center gap-2">
              <AddFriendDialog />
              <MessagesSheet />
              <NotificationsSheet />
            </div>
          </div>
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
      </div>
    </div>
  );
};

export default DrillsCategories;