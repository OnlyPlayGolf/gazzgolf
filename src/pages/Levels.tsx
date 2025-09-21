import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Lock } from "lucide-react";

const Levels = () => {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Levels</h1>
          <p className="text-muted-foreground">Track your skill progression</p>
        </div>

        <Card className="border-border bg-muted/30">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-locked">
              <TrendingUp size={32} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-locked mb-2">Levels Coming Soon</h3>
              <p className="text-sm text-locked">
                Skill-based progression system will be available in a future update.
              </p>
            </div>
            
            <Button disabled variant="secondary" className="bg-muted text-locked">
              <Lock size={16} className="mr-2" />
              View Levels
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Levels;