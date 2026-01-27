import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { DrillHighScores } from "@/components/DrillHighScores";
import { migrateStorageKeys } from "@/utils/storageManager";
import EightBallScore from "./EightBallScore";
import EightBallLeaderboard from "./EightBallLeaderboard";
import EightBallFeed from "./EightBallFeed";
import EightBallMessages from "./EightBallMessages";
import EightBallInfo from "./EightBallInfo";

const EightBallDrill = () => {
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
      navigate('/drills/shortgame');
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
              <h1 className="text-xl font-bold">8-Ball Circuit</h1>
              <p className="text-sm text-muted-foreground">Complete short game practice</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <DrillHighScores drillName="8-Ball Circuit" />
        <Routes>
          <Route index element={<Navigate to={fromPath ? "leaderboard" : "score"} replace />} />
          <Route path="score" element={<EightBallScore />} />
          <Route path="leaderboard" element={<EightBallLeaderboard />} />
          <Route path="feed" element={<EightBallFeed />} />
          <Route path="messages" element={<EightBallMessages />} />
          <Route path="info" element={<EightBallInfo />} />
        </Routes>
      </div>
      
      <DrillBottomTabBar drillSlug="8-ball-drill" />
    </div>
  );
};

export default EightBallDrill;
