import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, Routes, Route, Navigate } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { migrateStorageKeys } from "@/utils/storageManager";
import PGATour18Score from "./PGATour18Score";
import PGATour18Leaderboard from "./PGATour18Leaderboard";
import PGATour18Feed from "./PGATour18Feed";
import PGATour18Messages from "./PGATour18Messages";
import PGATour18Info from "./PGATour18Info";

const PGATour18Drill = () => {
  const navigate = useNavigate();

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
              <h1 className="text-xl font-bold">PGA Tour 18 Holes</h1>
              <p className="text-sm text-muted-foreground">Tournament-style putting practice</p>
            </div>
            <div className="w-10" />
          </div>
        </div>

        {/* Drill Info Banner */}
        <div className="bg-primary text-primary-foreground py-4 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">PRACTICE DRILL</div>
              <div className="text-sm opacity-90">PUTTING</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">18</div>
              <div className="text-xs opacity-90">Holes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">Mixed</div>
              <div className="text-xs opacity-90">Distances</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Routes>
          <Route index element={<Navigate to="score" replace />} />
          <Route path="score" element={<PGATour18Score />} />
          <Route path="leaderboard" element={<PGATour18Leaderboard />} />
          <Route path="feed" element={<PGATour18Feed />} />
          <Route path="messages" element={<PGATour18Messages />} />
          <Route path="info" element={<PGATour18Info />} />
        </Routes>
      </div>
      
      <DrillBottomTabBar drillSlug="pga-tour-18" />
    </div>
  );
};

export default PGATour18Drill;
