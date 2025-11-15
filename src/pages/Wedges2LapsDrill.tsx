import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { migrateStorageKeys } from "@/utils/storageManager";
import Wedges2LapsScore from "./Wedges2LapsScore";
import Wedges2LapsLeaderboard from "./Wedges2LapsLeaderboard";
import Wedges2LapsFeed from "./Wedges2LapsFeed";
import Wedges2LapsMessages from "./Wedges2LapsMessages";
import Wedges2LapsInfo from "./Wedges2LapsInfo";

const Wedges2LapsDrill = () => {
  const navigate = useNavigate();

  useEffect(() => {
    migrateStorageKeys();
  }, []);

  return (
    <div className="min-h-screen pb-24 bg-background">
      <div className="bg-card border-b border-border">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/drills/approach')}
              className="rounded-full"
            >
              <ArrowLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">Wedges 40–80 m — 2 Laps</h1>
              <p className="text-sm text-muted-foreground">Distance control practice</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Routes>
          <Route index element={<Navigate to="score" replace />} />
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
