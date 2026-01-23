import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { DrillHighScores } from "@/components/DrillHighScores";
import ApproachControlScore from "./ApproachControlScore";
import ApproachControlInfo from "./ApproachControlInfo";
import ApproachControlFeed from "./ApproachControlFeed";
import ApproachControlLeaderboard from "./ApproachControlLeaderboard";
import ApproachControlMessages from "./ApproachControlMessages";

export default function ApproachControlDrill() {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
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
              <h1 className="text-xl font-bold">Approach Control</h1>
              <p className="text-sm text-muted-foreground">Precision from 130-180 meters</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <DrillHighScores drillName="Approach Control" />
        <Routes>
          <Route path="/" element={<Navigate to="score" replace />} />
          <Route path="score" element={<ApproachControlScore />} />
          <Route path="info" element={<ApproachControlInfo />} />
          <Route path="feed" element={<ApproachControlFeed />} />
          <Route path="leaderboard" element={<ApproachControlLeaderboard />} />
          <Route path="messages" element={<ApproachControlMessages />} />
        </Routes>
      </div>
      <DrillBottomTabBar drillSlug="approach-control" />
    </div>
  );
}
