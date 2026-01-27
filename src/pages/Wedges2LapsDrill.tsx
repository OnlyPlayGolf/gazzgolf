import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { DrillHighScores } from "@/components/DrillHighScores";
import { migrateStorageKeys } from "@/utils/storageManager";
import Wedges2LapsScore from "./Wedges2LapsScore";
import Wedges2LapsLeaderboard from "./Wedges2LapsLeaderboard";
import Wedges2LapsFeed from "./Wedges2LapsFeed";
import Wedges2LapsMessages from "./Wedges2LapsMessages";
import Wedges2LapsInfo from "./Wedges2LapsInfo";

const Wedges2LapsDrill = () => {
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
      navigate('/drills/approach');
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
              <h1 className="text-xl font-bold">Wedge Game 40-80m</h1>
              <p className="text-sm text-muted-foreground">Distance control practice</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <DrillHighScores drillName="Wedge Game 40-80m" />
        <Routes>
          <Route index element={<Navigate to={fromPath ? "leaderboard" : "score"} replace />} />
          <Route path="score" element={<Wedges2LapsScore />} />
          <Route path="leaderboard" element={<Wedges2LapsLeaderboard />} />
          <Route path="feed" element={<Wedges2LapsFeed />} />
          <Route path="messages" element={<Wedges2LapsMessages />} />
          <Route path="info" element={<Wedges2LapsInfo />} />
        </Routes>
      </div>
      
      <DrillBottomTabBar drillSlug="wedges-2-laps" />
    </div>
  );
};

export default Wedges2LapsDrill;
