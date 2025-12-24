import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Settings } from "lucide-react";
import { TopNavBar } from "@/components/TopNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function StrokePlaySettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [mulligansPerPlayer, setMulligansPerPlayer] = useState(0);
  const [handicapEnabled, setHandicapEnabled] = useState(false);
  const [gimmesEnabled, setGimmesEnabled] = useState(false);

  useEffect(() => {
    // Load saved settings
    const savedSettings = sessionStorage.getItem('strokePlaySettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setMulligansPerPlayer(settings.mulligansPerPlayer || 0);
      setHandicapEnabled(settings.handicapEnabled || false);
      setGimmesEnabled(settings.gimmesEnabled || false);
    }
  }, []);

  const handleSave = () => {
    const settings = {
      mulligansPerPlayer,
      handicapEnabled,
      gimmesEnabled,
    };
    sessionStorage.setItem('strokePlaySettings', JSON.stringify(settings));
    toast({
      title: "Settings saved",
      description: "Your stroke play settings have been updated",
    });
    navigate('/rounds-play');
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-muted/20">
      <TopNavBar />
      <div className="p-4 pt-20 max-w-2xl mx-auto space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/rounds-play')}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="text-primary" />
              Stroke Play Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm">Overview</h3>
              <p className="text-sm text-muted-foreground">
                Standard stroke play where each player counts their total strokes. The player with the lowest total score wins.
              </p>
            </div>

            {/* Handicap toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="handicap">Use Handicaps</Label>
                <p className="text-xs text-muted-foreground">
                  Apply player handicaps to scoring
                </p>
              </div>
              <Switch
                id="handicap"
                checked={handicapEnabled}
                onCheckedChange={setHandicapEnabled}
              />
            </div>

            {/* Mulligans per player */}
            <div className="space-y-2">
              <Label htmlFor="mulligans">Mulligans per Player</Label>
              <Select 
                value={mulligansPerPlayer.toString()} 
                onValueChange={(value) => setMulligansPerPlayer(parseInt(value))}
              >
                <SelectTrigger id="mulligans">
                  <SelectValue placeholder="Select mulligans" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No mulligans</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="9">1 per 9 holes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Number of allowed do-overs per player during the round
              </p>
            </div>

            {/* Gimmes toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="gimmes">Allow Gimmes</Label>
                <p className="text-xs text-muted-foreground">
                  Short putts can be conceded without being played
                </p>
              </div>
              <Switch
                id="gimmes"
                checked={gimmesEnabled}
                onCheckedChange={setGimmesEnabled}
              />
            </div>

            <Button
              onClick={handleSave}
              className="w-full"
              size="lg"
            >
              Save Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
