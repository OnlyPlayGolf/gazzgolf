import { TopNavBar } from "@/components/TopNavBar";
import DriverControlComponent from "@/components/drills/DriverControlComponent";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function DriverControlScore() {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/drills/teeshots')}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Driver Control Drill</h1>
        </div>
        <DriverControlComponent />
      </div>
    </div>
  );
}
