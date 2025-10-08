import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Settings, Info, MessageSquare, ChevronRight, Zap, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Menu = () => {
  const navigate = useNavigate();
  
  const menuItems = [
    { id: 'rounds', label: 'Round Tracker', icon: TrendingUp, available: true, path: '/rounds' },
    { id: 'user-drills', label: 'User Drills', icon: Zap, available: true, path: '/user-drills' },
    { id: 'profile', label: 'Profile', icon: User, available: true, path: '/profile' },
    { id: 'settings', label: 'Settings', icon: Settings, available: false },
    { id: 'about', label: 'About', icon: Info, available: false },
  ];

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Menu</h1>
          <p className="text-muted-foreground">Account and app settings</p>
        </div>

        <div className="space-y-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            
            return (
              <Card key={item.id} className="border-border">
                <CardContent className="p-0">
                  <Button
                    variant="ghost"
                    disabled={!item.available}
                    onClick={item.available && item.path ? () => navigate(item.path) : undefined}
                    className="w-full h-auto p-4 justify-start text-left disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <Icon 
                          size={20} 
                          className={item.available ? "text-primary" : "text-locked"} 
                        />
                        <div>
                          <div className={`font-medium ${item.available ? "text-foreground" : "text-locked"}`}>
                            {item.label}
                          </div>
                          {!item.available && (
                            <div className="text-xs text-locked">Coming soon</div>
                          )}
                        </div>
                      </div>
                      <ChevronRight 
                        size={16} 
                        className={item.available ? "text-muted-foreground" : "text-locked"} 
                      />
                    </div>
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {/* Feedback Link */}
          <Card className="border-golf-light">
            <CardContent className="p-0">
              <Button
                variant="ghost"
                asChild
                className="w-full h-auto p-4 justify-start text-left hover:bg-golf-light/10"
              >
                <a href="mailto:feedback@golftraining.app" className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <MessageSquare size={20} className="text-primary" />
                    <div>
                      <div className="font-medium text-foreground">Feedback</div>
                      <div className="text-xs text-muted-foreground">Send us your thoughts</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Menu;