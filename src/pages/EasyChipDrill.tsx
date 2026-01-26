import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { DrillHighScores } from "@/components/DrillHighScores";
import { migrateStorageKeys } from "@/utils/storageManager";
import EasyChipScore from "./EasyChipScore";
import EasyChipLeaderboard from "./EasyChipLeaderboard";
import EasyChipFeed from "./EasyChipFeed";
import EasyChipMessages from "./EasyChipMessages";
import EasyChipInfo from "./EasyChipInfo";

const EasyChipDrill = () => {
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
              <h1 className="text-xl font-bold">Easy Chip Drill</h1>
              <p className="text-sm text-muted-foreground">Build consistency on simple chips</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <DrillHighScores drillName="Easy Chip Drill" />
        <Routes>
          <Route index element={<Navigate to={fromPath ? "leaderboard" : "score"} replace />} />
          <Route path="score" element={<EasyChipScore />} />
          <Route path="leaderboard" element={<EasyChipLeaderboard />} />
          <Route path="feed" element={<EasyChipFeed />} />
          <Route path="messages" element={<EasyChipMessages />} />
          <Route path="info" element={<EasyChipInfo />} />
        </Routes>
      </div>
      
      <DrillBottomTabBar drillSlug="easy-chip" />
    </div>
  );
};

export default EasyChipDrill;
