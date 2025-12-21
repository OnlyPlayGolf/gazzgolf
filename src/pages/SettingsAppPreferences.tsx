import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Target, Flag, Users } from "lucide-react";
import { DEFAULT_TEE_OPTIONS } from "@/utils/teeSystem";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const SettingsAppPreferences = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [preferences, setPreferences] = useState(() => {
    const saved = localStorage.getItem('appPreferences');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure all expected keys exist with fallbacks
        return {
          defaultGameFormat: parsed.defaultGameFormat || 'stroke-play',
          defaultTee: parsed.defaultTee || 'medium',
          defaultHoles: parsed.defaultHoles || '18',
          defaultScoring: parsed.defaultScoring || 'gross'
        };
      } catch {
        return {
          defaultGameFormat: 'stroke-play',
          defaultTee: 'medium',
          defaultHoles: '18',
          defaultScoring: 'gross'
        };
      }
    }
    return {
      defaultGameFormat: 'stroke-play',
      defaultTee: 'medium',
      defaultHoles: '18',
      defaultScoring: 'gross'
    };
  });

  const handleChange = (key: string, value: string) => {
    setPreferences((prev: any) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = () => {
    localStorage.setItem('appPreferences', JSON.stringify(preferences));
    toast({
      title: "Preferences saved",
      description: "Your app preferences have been updated.",
    });
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
            <h1 className="text-xl font-bold text-foreground">App Preferences</h1>
          </div>
        </div>

        <div className="space-y-4">
          {/* Game Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Default Game Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Game Format</Label>
                <Select 
                  value={preferences.defaultGameFormat} 
                  onValueChange={(v) => handleChange('defaultGameFormat', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stroke-play">Stroke Play</SelectItem>
                    <SelectItem value="match-play">Match Play</SelectItem>
                    <SelectItem value="best-ball">Best Ball</SelectItem>
                    <SelectItem value="scramble">Scramble</SelectItem>
                    <SelectItem value="umbriago">Umbriago</SelectItem>
                    <SelectItem value="wolf">Wolf</SelectItem>
                    <SelectItem value="copenhagen">Copenhagen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default Scoring</Label>
                <Select 
                  value={preferences.defaultScoring} 
                  onValueChange={(v) => handleChange('defaultScoring', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gross">Gross (No Handicap)</SelectItem>
                    <SelectItem value="net">Net (With Handicap)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tee Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Flag className="h-4 w-4" />
                Tee Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Tee Box</Label>
                <Select 
                  value={preferences.defaultTee} 
                  onValueChange={(v) => handleChange('defaultTee', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_TEE_OPTIONS.map((tee) => (
                      <SelectItem key={tee.value} value={tee.value}>
                        {tee.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Round Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Round Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Number of Holes</Label>
                <Select 
                  value={preferences.defaultHoles} 
                  onValueChange={(v) => handleChange('defaultHoles', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9">9 Holes</SelectItem>
                    <SelectItem value="18">18 Holes</SelectItem>
                  </SelectContent>
                </Select>
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

export default SettingsAppPreferences;
