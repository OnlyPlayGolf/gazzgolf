import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Target, Award, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AddFriendDialog } from "@/components/AddFriendDialog";
import { NotificationsSheet } from "@/components/NotificationsSheet";
import { MessagesSheet } from "@/components/MessagesSheet";

const levelCategories = [
  {
    id: 'beginner',
    title: 'Beginner',
    description: 'Start your journey here.',
    icon: Target,
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    description: 'Take your skills to the next stage.',
    icon: Trophy,
  },
  {
    id: 'amateur',
    title: 'Amateur',
    description: 'Build confidence and consistency.',
    icon: Award,
  },
  {
    id: 'professional',
    title: 'Professional',
    description: 'Compete like a pro.',
    icon: Star,
  },
];

const Levels = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Choose Your Level</h1>
              <p className="text-muted-foreground">Select your stage and start leveling up</p>
            </div>
            <div className="flex items-center gap-2">
              <AddFriendDialog />
              <MessagesSheet />
              <NotificationsSheet />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {levelCategories.map((category) => {
            const Icon = category.icon;
            
            return (
              <Card key={category.id} className="border-golf-light hover:border-primary transition-all duration-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-foreground">
                    <Icon size={24} className="text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>{category.title}</span>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {category.description}
                  </p>
                  
                  <Button 
                    onClick={() => navigate(`/levels/${category.id}`)}
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

export default Levels;