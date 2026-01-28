import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { migrateStorageKeys } from "@/utils/storageManager";
import TwentyOnePointsScore from "./TwentyOnePointsScore";
import TwentyOnePointsInfo from "./TwentyOnePointsInfo";
import TwentyOnePointsFeed from "./TwentyOnePointsFeed";
import TwentyOnePointsLeaderboard from "./TwentyOnePointsLeaderboard";

export default function TwentyOnePointsDrill() {
  const navigate = useNavigate();

  useEffect(() => {
    migrateStorageKeys();
  }, []);

  const handleBackClick = () => {
    navigate("/drill/21-points/setup");
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
              className="rounded-full shrink-0"
            >
              <ArrowLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">21 Points</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Be the first to reach 21 points or more</p>
            </div>
            <div className="w-10 shrink-0" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Routes>
          <Route index element={<Navigate to="score" replace />} />
          <Route path="score" element={<TwentyOnePointsScore />} />
          <Route path="info" element={<TwentyOnePointsInfo />} />
          <Route path="feed" element={<TwentyOnePointsFeed />} />
          <Route path="leaderboard" element={<TwentyOnePointsLeaderboard />} />
        </Routes>
      </div>

      <DrillBottomTabBar drillSlug="21-points" hideDrillWord />
    </div>
  );
}
