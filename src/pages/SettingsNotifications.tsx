import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bell, Users, Trophy, Calendar, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const SettingsNotifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notificationSettings');
    return saved ? JSON.parse(saved) : {
      pushEnabled: true,
      gameAlerts: true,
      roundInvites: true,
      friendActivity: true,
      leaderboardUpdates: true,
      reminders: false,
      messages: true
    };
  });

  const handleToggle = (key: string) => {
    setNotifications((prev: any) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = () => {
    localStorage.setItem('notificationSettings', JSON.stringify(notifications));
    toast({
      title: "Settings saved",
      description: "Your notification preferences have been updated.",
    });
    navigate("/settings");
  };

  const notificationOptions = [
    {
      key: 'pushEnabled',
      label: 'Push Notifications',
      description: 'Enable all push notifications',
      icon: Bell,
      isMain: true
    },
    {
      key: 'gameAlerts',
      label: 'Game Alerts',
      description: 'Updates during live games',
      icon: Trophy
    },
    {
      key: 'roundInvites',
      label: 'Round Invites',
      description: 'When friends invite you to play',
      icon: Calendar
    },
    {
      key: 'friendActivity',
      label: 'Friend Activity',
      description: 'When friends complete rounds or drills',
      icon: Users
    },
    {
      key: 'leaderboardUpdates',
      label: 'Leaderboard Updates',
      description: 'When your ranking changes',
      icon: Trophy
    },
    {
      key: 'messages',
      label: 'Messages',
      description: 'New messages from friends',
      icon: MessageSquare
    },
    {
      key: 'reminders',
      label: 'Practice Reminders',
      description: 'Daily practice reminders',
      icon: Calendar
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
              onClick={() => navigate("/settings")}
              className="rounded-full flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Notifications</h1>
          </div>
        </div>

        <div className="space-y-4">
          {/* Main Toggle */}
          <Card className="border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary text-primary-foreground">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Label className="font-medium">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">Enable all notifications</p>
                  </div>
                </div>
                <Switch
                  checked={notifications.pushEnabled}
                  onCheckedChange={() => handleToggle('pushEnabled')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Individual Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {notificationOptions.filter(opt => !opt.isMain).map((option) => {
                const Icon = option.icon;
                return (
                  <div 
                    key={option.key}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <Label className="font-medium">{option.label}</Label>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={notifications[option.key]}
                      onCheckedChange={() => handleToggle(option.key)}
                      disabled={!notifications.pushEnabled}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Button onClick={handleSave} className="w-full">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsNotifications;
