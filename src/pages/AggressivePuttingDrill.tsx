import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation, Routes, Route, Navigate } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { DrillHighScores } from "@/components/DrillHighScores";
import { migrateStorageKeys } from "@/utils/storageManager";
import AggressivePuttingScore from "./AggressivePuttingScore";
import AggressivePuttingLeaderboard from "./AggressivePuttingLeaderboard";
import AggressivePuttingFeed from "./AggressivePuttingFeed";
import AggressivePuttingMessages from "./AggressivePuttingMessages";
import AggressivePuttingInfo from "./AggressivePuttingInfo";

const AggressivePuttingDrill = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    migrateStorageKeys();
  }, []);

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/drills/putting')}
              className="rounded-full"
            >
              <ArrowLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">Aggressive Putting</h1>
              <p className="text-sm text-muted-foreground">Reach 15 points as quickly as possible</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <DrillHighScores drillName="Aggressive Putting" />
        <Routes>
          <Route index element={<Navigate to="score" replace />} />
          <Route path="score" element={<AggressivePuttingScore />} />
          <Route path="leaderboard" element={<AggressivePuttingLeaderboard />} />
          <Route path="feed" element={<AggressivePuttingFeed />} />
          <Route path="messages" element={<AggressivePuttingMessages />} />
          <Route path="info" element={<AggressivePuttingInfo />} />
        </Routes>
      </div>
      
      <DrillBottomTabBar drillSlug="aggressive-putting" />
    </div>
  );
};

export default AggressivePuttingDrill;