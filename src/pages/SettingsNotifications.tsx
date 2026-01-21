import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bell, Users, Trophy, Calendar, MessageSquare, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface NotificationPreferences {
  enabled: boolean;
  friend_request_enabled: boolean;
  group_invite_enabled: boolean;
  high_score_enabled: boolean;
  message_enabled: boolean;
  round_completed_enabled: boolean;
  achievement_unlocked_enabled: boolean;
  group_activity_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_enabled: boolean;
  auto_delete_read_after_days: number | null;
  auto_delete_unread_after_days: number | null;
}

const SettingsNotifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: true,
    friend_request_enabled: true,
    group_invite_enabled: true,
    high_score_enabled: true,
    message_enabled: true,
    round_completed_enabled: true,
    achievement_unlocked_enabled: true,
    group_activity_enabled: true,
    quiet_hours_start: null,
    quiet_hours_end: null,
    quiet_hours_enabled: false,
    auto_delete_read_after_days: 30,
    auto_delete_unread_after_days: 90,
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        loadPreferences();
      } else {
        setLoading(false);
      }
    });
  }, []);

  const loadPreferences = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setPreferences({
          enabled: data.enabled ?? true,
          friend_request_enabled: data.friend_request_enabled ?? true,
          group_invite_enabled: data.group_invite_enabled ?? true,
          high_score_enabled: data.high_score_enabled ?? true,
          message_enabled: data.message_enabled ?? true,
          round_completed_enabled: data.round_completed_enabled ?? true,
          achievement_unlocked_enabled: data.achievement_unlocked_enabled ?? true,
          group_activity_enabled: data.group_activity_enabled ?? true,
          quiet_hours_start: data.quiet_hours_start,
          quiet_hours_end: data.quiet_hours_end,
          quiet_hours_enabled: data.quiet_hours_enabled ?? false,
          auto_delete_read_after_days: data.auto_delete_read_after_days ?? 30,
          auto_delete_unread_after_days: data.auto_delete_unread_after_days ?? 90,
        });
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your notification preferences have been updated.",
      });
      navigate("/settings");
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save notification preferences.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const notificationOptions = [
    {
      key: 'friend_request_enabled' as keyof NotificationPreferences,
      label: 'Friend Requests',
      description: 'When someone sends you a friend request',
      icon: Users
    },
    {
      key: 'group_invite_enabled' as keyof NotificationPreferences,
      label: 'Group Invites',
      description: 'When you\'re invited to join a group',
      icon: Users
    },
    {
      key: 'high_score_enabled' as keyof NotificationPreferences,
      label: 'Leaderboard Updates',
      description: 'When someone takes the lead on a drill',
      icon: Trophy
    },
    {
      key: 'message_enabled' as keyof NotificationPreferences,
      label: 'Messages',
      description: 'New messages from friends',
      icon: MessageSquare
    },
    {
      key: 'round_completed_enabled' as keyof NotificationPreferences,
      label: 'Round Completed',
      description: 'When friends complete rounds',
      icon: Calendar
    },
    {
      key: 'achievement_unlocked_enabled' as keyof NotificationPreferences,
      label: 'Achievements',
      description: 'When you unlock achievements',
      icon: Trophy
    },
    {
      key: 'group_activity_enabled' as keyof NotificationPreferences,
      label: 'Group Activity',
      description: 'Activity updates from your groups',
      icon: Users
    }
  ];

  if (loading) {
    return (
      <div className="pb-20 min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading preferences...</p>
      </div>
    );
  }

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
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <Label className="font-medium">Enable Notifications</Label>
                    <p className="text-sm text-muted-foreground">Master toggle for all notifications</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.enabled}
                  onCheckedChange={() => handleToggle('enabled')}
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
              {notificationOptions.map((option) => {
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
                      checked={preferences[option.key] as boolean}
                      onCheckedChange={() => handleToggle(option.key)}
                      disabled={!preferences.enabled}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Quiet Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Moon className="h-4 w-4" />
                Quiet Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Enable Quiet Hours</Label>
                  <p className="text-xs text-muted-foreground">Pause notifications during these hours</p>
                </div>
                <Switch
                  checked={preferences.quiet_hours_enabled}
                  onCheckedChange={() => handleToggle('quiet_hours_enabled')}
                />
              </div>
              {preferences.quiet_hours_enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Start Time</Label>
                    <input
                      type="time"
                      value={preferences.quiet_hours_start || '22:00'}
                      onChange={(e) => setPreferences(prev => ({ ...prev, quiet_hours_start: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">End Time</Label>
                    <input
                      type="time"
                      value={preferences.quiet_hours_end || '08:00'}
                      onChange={(e) => setPreferences(prev => ({ ...prev, quiet_hours_end: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleSave} className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsNotifications;
