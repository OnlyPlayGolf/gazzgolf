import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Trophy, Star, Crown, Zap, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TopNavBar } from "@/components/TopNavBar";

const LevelSelection = () => {
  const navigate = useNavigate();

  const tiers = [
    {
      id: "beginner",
      title: "First Timer",
      subtitle: "Start your journey here.",
      icon: Target,
      action: () => navigate("/levels/beginner"),
    },
    {
      id: "intermediate", 
      title: "Beginner",
      subtitle: "Take your skills to the next stage.",
      icon: Zap,
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
      title: "Pro",
      subtitle: "Compete like a pro.",
      icon: Crown,
      action: () => navigate("/levels/professional"),
    },
    {
      id: "tour",
      title: "Tour",
      subtitle: "Elite level mastery.",
      icon: Trophy,
      action: () => navigate("/levels/tour"),
    },
  ];

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
            <h1 className="text-2xl font-bold text-foreground">Choose Your Level</h1>
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