import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { DrillHighScores } from "@/components/DrillHighScores";
import { migrateStorageKeys } from "@/utils/storageManager";
import UpDownPuttingScore from "./UpDownPuttingScore";
import UpDownPuttingLeaderboard from "./UpDownPuttingLeaderboard";
import UpDownPuttingFeed from "./UpDownPuttingFeed";
import UpDownPuttingMessages from "./UpDownPuttingMessages";
import UpDownPuttingInfo from "./UpDownPuttingInfo";

const UpDownPuttingDrill = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from;

  useEffect(() => {
    migrateStorageKeys();
  }, []);

  const handleBackClick = () => {
    if (fromPath) {
      navigate(fromPath);
    } else {
      navigate('/drills/putting');
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="bg-card border-b border-border">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackClick}
              className="rounded-full"
            >
              <ArrowLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">Up & Down Putts 6-10m</h1>
              <p className="text-sm text-muted-foreground">Master uphill and downhill control</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <DrillHighScores drillName="Up & Down Putts 6-10m" />
        <Routes>
          <Route index element={<Navigate to={fromPath ? "leaderboard" : "score"} replace />} />
          <Route path="score" element={<UpDownPuttingScore />} />
          <Route path="leaderboard" element={<UpDownPuttingLeaderboard />} />
          <Route path="feed" element={<UpDownPuttingFeed />} />
          <Route path="messages" element={<UpDownPuttingMessages />} />
          <Route path="info" element={<UpDownPuttingInfo />} />
        </Routes>
      </div>
      
      <DrillBottomTabBar drillSlug="up-down-putting" hideDrillWord />
    </div>
  );
};

export default UpDownPuttingDrill;
