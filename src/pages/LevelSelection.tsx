import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Trophy, Star, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AddFriendDialog } from "@/components/AddFriendDialog";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { MessagesSheet } from "@/components/MessagesSheet";

const LevelSelection = () => {
  const navigate = useNavigate();

  const tiers = [
    {
      id: "beginner",
      title: "Beginner",
      subtitle: "Start your journey here.",
      icon: Target,
      action: () => navigate("/levels/beginner"),
    },
    {
      id: "intermediate", 
      title: "Intermediate",
      subtitle: "Take your skills to the next stage.",
      icon: Trophy,
      action: () => navigate("/levels/intermediate"),
    },
    {
      id: "amateur",
      title: "Amateur", 
      subtitle: "Build confidence and consistency.",
      icon: Star,
      action: () => navigate("/levels/amateur"),
    },
    {
      id: "professional",
      title: "Professional",
      subtitle: "Compete like a pro.",
      icon: Crown,
      action: () => navigate("/levels/professional"),
    },
  ];

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Choose Your Level</h1>
              <p className="text-muted-foreground">Select your stage and start leveling up.</p>
            </div>
            <div className="flex items-center gap-2">
              <AddFriendDialog />
              <MessagesSheet />
              <NotificationsSheet />
            </div>
          </div>
        </div>

        {/* Tier Cards */}
        <div className="space-y-6 max-w-md mx-auto">
          {tiers.map((tier) => {
            const IconComponent = tier.icon;
            
            return (
              <Card
                key={tier.id}
                onClick={tier.action}
                role="button"
                tabIndex={0}
                className="cursor-pointer border-golf-light hover:border-primary transition-all duration-200 hover-scale"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-foreground">
                    <IconComponent size={24} className="text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>{tier.title}</span>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {tier.subtitle}
                  </p>
                  
                  <Button 
                    onClick={(e) => { e.stopPropagation(); tier.action(); }}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    View Levels
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LevelSelection;