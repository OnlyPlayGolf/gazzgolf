import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Eye, Share2, Users, BarChart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const SettingsPrivacy = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [privacy, setPrivacy] = useState(() => {
    const saved = localStorage.getItem('privacySettings');
    return saved ? JSON.parse(saved) : {
      profileVisibility: 'friends',
      showInLeaderboards: true,
      shareRoundData: true,
      allowFriendRequests: true,
      showOnlineStatus: true
    };
  });

  const handleToggle = (key: string) => {
    setPrivacy((prev: any) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleVisibilityChange = (value: string) => {
    setPrivacy((prev: any) => ({
      ...prev,
      profileVisibility: value
    }));
  };

  const handleSave = () => {
    localStorage.setItem('privacySettings', JSON.stringify(privacy));
    toast({
      title: "Privacy settings saved",
      description: "Your privacy preferences have been updated.",
    });
    navigate("/settings");
  };

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
            <h1 className="text-xl font-bold text-foreground">Privacy</h1>
          </div>
        </div>

        <div className="space-y-4">
          {/* Profile Visibility */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Profile Visibility
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                value={privacy.profileVisibility} 
                onValueChange={handleVisibilityChange}
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="public" id="public" />
                  <Label htmlFor="public" className="flex-1 cursor-pointer">
                    <div className="font-medium">Public</div>
                    <div className="text-sm text-muted-foreground">Anyone can view your profile</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="friends" id="friends" />
                  <Label htmlFor="friends" className="flex-1 cursor-pointer">
                    <div className="font-medium">Friends Only</div>
                    <div className="text-sm text-muted-foreground">Only friends can see your full profile</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="private" id="private" />
                  <Label htmlFor="private" className="flex-1 cursor-pointer">
                    <div className="font-medium">Private</div>
                    <div className="text-sm text-muted-foreground">Only you can see your profile</div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Data Sharing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 className="h-4 w-4" />
                Data Sharing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <BarChart className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="font-medium">Show in Leaderboards</Label>
                    <p className="text-xs text-muted-foreground">Appear in public and group leaderboards</p>
                  </div>
                </div>
                <Switch
                  checked={privacy.showInLeaderboards}
                  onCheckedChange={() => handleToggle('showInLeaderboards')}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="font-medium">Share Round Data</Label>
                    <p className="text-xs text-muted-foreground">Allow friends to see your rounds</p>
                  </div>
                </div>
                <Switch
                  checked={privacy.shareRoundData}
                  onCheckedChange={() => handleToggle('shareRoundData')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Social */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Social
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-medium">Allow Friend Requests</Label>
                  <p className="text-xs text-muted-foreground">Let others send you friend requests</p>
                </div>
                <Switch
                  checked={privacy.allowFriendRequests}
                  onCheckedChange={() => handleToggle('allowFriendRequests')}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-medium">Show Online Status</Label>
                  <p className="text-xs text-muted-foreground">Let friends see when you're active</p>
                </div>
                <Switch
                  checked={privacy.showOnlineStatus}
                  onCheckedChange={() => handleToggle('showOnlineStatus')}
                />
              </div>
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

export default SettingsPrivacy;
