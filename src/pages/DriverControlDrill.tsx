import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { DrillHighScores } from "@/components/DrillHighScores";
import DriverControlScore from "./DriverControlScore";
import DriverControlInfo from "./DriverControlInfo";
import DriverControlFeed from "./DriverControlFeed";
import DriverControlLeaderboard from "./DriverControlLeaderboard";
import DriverControlMessages from "./DriverControlMessages";

export default function DriverControlDrill() {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/drills/teeshots')}
              className="rounded-full"
            >
              <ArrowLeft size={24} />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold">Driver Control Drill</h1>
              <p className="text-sm text-muted-foreground">Fairway accuracy test</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <DrillHighScores drillName="Driver Control Drill" />
        <Routes>
          <Route path="/" element={<Navigate to="score" replace />} />
          <Route path="score" element={<DriverControlScore />} />
          <Route path="info" element={<DriverControlInfo />} />
          <Route path="feed" element={<DriverControlFeed />} />
          <Route path="leaderboard" element={<DriverControlLeaderboard />} />
          <Route path="messages" element={<DriverControlMessages />} />
        </Routes>
      </div>
      <DrillBottomTabBar drillSlug="driver-control" />
    </div>
  );
}
