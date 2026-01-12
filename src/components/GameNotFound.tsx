import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home, RotateCcw } from "lucide-react";

interface GameNotFoundProps {
  /** Called when "Retry" button is clicked */
  onRetry?: () => void;
  /** Custom message to display */
  message?: string;
}

export function GameNotFound({ 
  onRetry, 
  message = "This round was deleted or is no longer available." 
}: GameNotFoundProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Round Not Found</h2>
            <p className="text-muted-foreground text-sm">{message}</p>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => navigate("/")} 
              className="w-full"
            >
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            
            {onRetry && (
              <Button 
                onClick={onRetry} 
                variant="outline" 
                className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
