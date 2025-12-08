import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { TopNavBar } from "@/components/TopNavBar";
import { ProStatsAverages } from "@/components/ProStatsAverages";

const PerformanceStats = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/profile")}
              className="rounded-full flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Performance Stats</h1>
          </div>
          <p className="text-muted-foreground">Your strokes gained averages from Pro Stats rounds</p>
        </div>

        <ProStatsAverages />
      </div>
    </div>
  );
};

export default PerformanceStats;
