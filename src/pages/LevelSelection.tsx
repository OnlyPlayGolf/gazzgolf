import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Lock, Trophy, Star, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LevelSelection = () => {
  const navigate = useNavigate();

  const tiers = [
    {
      id: "beginner",
      title: "Beginner",
      subtitle: "Start your journey here.",
      icon: Target,
      available: true,
      action: () => navigate("/levels/beginner"),
    },
    {
      id: "intermediate", 
      title: "Intermediate",
      subtitle: "Take your skills to the next stage.",
      icon: Trophy,
      available: true,
      action: () => navigate("/levels/intermediate"),
    },
    {
      id: "amateur",
      title: "Amateur", 
      subtitle: "Build confidence and consistency.",
      icon: Star,
      available: false,
    },
    {
      id: "professional",
      title: "Professional",
      subtitle: "Compete like a pro.",
      icon: Crown,
      available: false,
    },
    {
      id: "tour",
      title: "Tour",
      subtitle: "Play at the highest level.", 
      icon: Crown,
      available: false,
    },
  ];

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Choose Your Level</h1>
        </div>

        {/* Tier Cards */}
        <div className="space-y-4 max-w-md mx-auto">
          {tiers.map((tier) => {
            const IconComponent = tier.icon;
            
            return (
              <Card key={tier.id} className="rounded-2xl shadow-lg border-border">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`p-3 rounded-full ${tier.available ? 'bg-primary/10' : 'bg-muted'}`}>
                      <IconComponent 
                        size={24} 
                        className={tier.available ? 'text-primary' : 'text-muted-foreground'} 
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-foreground">
                        {tier.title}
                      </h3>
                      <p className="text-muted-foreground">{tier.subtitle}</p>
                    </div>
                  </div>

                  {tier.available ? (
                    <Button
                      onClick={tier.action}
                      className="w-full rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground"
                      size="lg"
                    >
                      View Levels
                    </Button>
                  ) : (
                    <Button
                      disabled
                      className="w-full rounded-2xl bg-muted text-muted-foreground"
                      size="lg"
                    >
                      <Lock size={16} className="mr-2" />
                      Coming Soon
                    </Button>
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

export default LevelSelection;