import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { DrillHighScores } from "@/components/DrillHighScores";
import { migrateStorageKeys } from "@/utils/storageManager";
import PGATour18Score from "./PGATour18Score";
import PGATour18Leaderboard from "./PGATour18Leaderboard";
import PGATour18Feed from "./PGATour18Feed";
import PGATour18Messages from "./PGATour18Messages";
import PGATour18Info from "./PGATour18Info";

const PGATour18Drill = () => {
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
      {/* Header */}
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
              <h1 className="text-xl font-bold">PGA Tour 18-hole Test</h1>
              <p className="text-sm text-muted-foreground">Tournament-style putting practice</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <DrillHighScores drillName="PGA Tour 18-hole Test" />
        <Routes>
          <Route index element={<Navigate to={fromPath ? "leaderboard" : "score"} replace />} />
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
