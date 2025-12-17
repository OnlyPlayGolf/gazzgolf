import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const SettingsMetrics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [distanceUnit, setDistanceUnit] = useState(() => 
    localStorage.getItem('distanceUnit') || 'meters'
  );
  const [handicapSystem, setHandicapSystem] = useState(() => 
    localStorage.getItem('handicapSystem') || 'whs'
  );

  const handleSave = () => {
    localStorage.setItem('distanceUnit', distanceUnit);
    localStorage.setItem('handicapSystem', handicapSystem);
    toast({
      title: "Settings saved",
      description: "Your metric preferences have been updated.",
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
            <h1 className="text-xl font-bold text-foreground">Metrics & Units</h1>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distance Units</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={distanceUnit} onValueChange={setDistanceUnit}>
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="meters" id="meters" />
                  <Label htmlFor="meters" className="flex-1 cursor-pointer">
                    <div className="font-medium">Meters</div>
                    <div className="text-sm text-muted-foreground">Display distances in meters (m)</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="yards" id="yards" />
                  <Label htmlFor="yards" className="flex-1 cursor-pointer">
                    <div className="font-medium">Yards</div>
                    <div className="text-sm text-muted-foreground">Display distances in yards (yd)</div>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Handicap System</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={handicapSystem} onValueChange={setHandicapSystem}>
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="whs" id="whs" />
                  <Label htmlFor="whs" className="flex-1 cursor-pointer">
                    <div className="font-medium">World Handicap System (WHS)</div>
                    <div className="text-sm text-muted-foreground">Standard global handicap system</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="course" id="course" />
                  <Label htmlFor="course" className="flex-1 cursor-pointer">
                    <div className="font-medium">Course Handicap</div>
                    <div className="text-sm text-muted-foreground">Adjusted for specific course difficulty</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="playing" id="playing" />
                  <Label htmlFor="playing" className="flex-1 cursor-pointer">
                    <div className="font-medium">Playing Handicap</div>
                    <div className="text-sm text-muted-foreground">Adjusted for competition format</div>
                  </Label>
                </div>
              </RadioGroup>
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

export default SettingsMetrics;
