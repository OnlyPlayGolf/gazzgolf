import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Ruler, Globe, Bell, Shield, Sliders } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Settings = () => {
  const navigate = useNavigate();

  const settingsSections = [
    {
      id: 'metrics',
      label: 'Metrics & Units',
      description: 'Distance units, handicap system',
      icon: Ruler,
      path: '/settings/metrics'
    },
    {
      id: 'language',
      label: 'Language',
      description: 'App language preferences',
      icon: Globe,
      path: '/settings/language'
    },
    {
      id: 'notifications',
      label: 'Notifications',
      description: 'Push notifications, alerts',
      icon: Bell,
      path: '/settings/notifications'
    },
    {
      id: 'privacy',
      label: 'Privacy',
      description: 'Profile visibility, data sharing',
      icon: Shield,
      path: '/settings/privacy'
    },
    {
      id: 'preferences',
      label: 'App Preferences',
      description: 'Default game formats, tees',
      icon: Sliders,
      path: '/settings/preferences'
    }
  ];

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/menu")}
              className="rounded-full flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">Customize your experience</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            
            return (
              <Card key={section.id} className="border-border">
                <CardContent className="p-0">
                  <Button
                    variant="ghost"
                    onClick={() => navigate(section.path)}
                    className="w-full h-auto p-4 justify-start text-left"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <Icon size={18} className="text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {section.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {section.description}
                          </div>
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

export default Settings;
