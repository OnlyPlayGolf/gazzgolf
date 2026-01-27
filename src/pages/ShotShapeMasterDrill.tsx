import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { DrillHighScores } from "@/components/DrillHighScores";
import ShotShapeMasterScore from "./ShotShapeMasterScore";
import ShotShapeMasterInfo from "./ShotShapeMasterInfo";
import ShotShapeMasterFeed from "./ShotShapeMasterFeed";
import ShotShapeMasterLeaderboard from "./ShotShapeMasterLeaderboard";
import ShotShapeMasterMessages from "./ShotShapeMasterMessages";

export default function ShotShapeMasterDrill() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from;

  const handleBackClick = () => {
    if (fromPath) {
      navigate(fromPath);
    } else {
      navigate('/drills/teeshots');
    }
  };

  return (
    <div className="pb-20 min-h-screen bg-background">
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
              <h1 className="text-xl font-bold">Shot Shape Master</h1>
              <p className="text-sm text-muted-foreground">Master draws and fades</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <DrillHighScores drillName="Shot Shape Master" />
        <Routes>
          <Route path="/" element={<Navigate to={fromPath ? "leaderboard" : "score"} replace />} />
          <Route path="score" element={<ShotShapeMasterScore />} />
          <Route path="info" element={<ShotShapeMasterInfo />} />
          <Route path="feed" element={<ShotShapeMasterFeed />} />
          <Route path="leaderboard" element={<ShotShapeMasterLeaderboard />} />
          <Route path="messages" element={<ShotShapeMasterMessages />} />
        </Routes>
      </div>
      <DrillBottomTabBar drillSlug="shot-shape-master" />
    </div>
  );
}
