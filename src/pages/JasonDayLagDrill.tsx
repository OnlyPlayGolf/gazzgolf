import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import JasonDayLagScore from "./JasonDayLagScore";
import JasonDayLagLeaderboard from "./JasonDayLagLeaderboard";
import JasonDayLagFeed from "./JasonDayLagFeed";
import JasonDayLagMessages from "./JasonDayLagMessages";
import JasonDayLagInfo from "./JasonDayLagInfo";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { DrillHighScores } from "@/components/DrillHighScores";

const JasonDayLagDrill = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4 pt-6">
        <div className="flex items-center gap-3 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/drills/putting')}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Lag Putting Drill 8-20m</h1>
        </div>
        <DrillHighScores drillName="Lag Putting Drill 8-20m" />
        <Routes>
          <Route index element={<Navigate to="score" replace />} />
          <Route path="score" element={<JasonDayLagScore />} />
          <Route path="leaderboard" element={<JasonDayLagLeaderboard />} />
          <Route path="feed" element={<JasonDayLagFeed />} />
          <Route path="messages" element={<JasonDayLagMessages />} />
          <Route path="info" element={<JasonDayLagInfo />} />
        </Routes>
      </div>

      <DrillBottomTabBar drillSlug="jason-day-lag" />
    </div>
  );
};

export default JasonDayLagDrill;
