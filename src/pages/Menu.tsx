import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Settings, Info, MessageSquare, ChevronRight, Crown, HelpCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Menu = () => {
  const navigate = useNavigate();
  
  const menuItems = [
    { id: 'profile', label: 'Personal Information', description: 'Edit your profile details', icon: User, path: '/profile-settings' },
    { id: 'membership', label: 'Account Membership', description: 'View plans and benefits', icon: Crown, path: '/account-membership' },
    { id: 'settings', label: 'Settings', description: 'Metrics, notifications, privacy', icon: Settings, path: '/settings' },
    { id: 'about', label: 'About', description: 'App info and legal', icon: Info, path: '/about' },
    { id: 'feedback', label: 'Feedback', description: 'Share your thoughts', icon: MessageSquare, path: '/feedback' },
    { id: 'support', label: 'Support', description: 'FAQ and help', icon: HelpCircle, path: '/support' },
  ];

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/profile")}
              className="rounded-full flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Menu</h1>
          </div>
          <p className="text-muted-foreground ml-12">Account and app settings</p>
        </div>

        <div className="space-y-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            
            return (
              <Card key={item.id} className="border-border">
                <CardContent className="p-0">
                  <Button
                    variant="ghost"
                    onClick={() => navigate(item.path)}
                    className="w-full h-auto p-4 justify-start text-left"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Icon size={18} className="text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{item.label}</div>
                          <div className="text-xs text-muted-foreground">{item.description}</div>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
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

export default Menu;
