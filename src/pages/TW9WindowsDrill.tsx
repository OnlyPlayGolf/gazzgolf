import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import TW9WindowsScore from "./TW9WindowsScore";
import TW9WindowsLeaderboard from "./TW9WindowsLeaderboard";
import TW9WindowsFeed from "./TW9WindowsFeed";
import TW9WindowsMessages from "./TW9WindowsMessages";
import TW9WindowsInfo from "./TW9WindowsInfo";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import { DrillHighScores } from "@/components/DrillHighScores";

const TW9WindowsDrill = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from;

  const handleBackClick = () => {
    if (fromPath) {
      navigate(fromPath);
    } else {
      navigate('/drills/approach');
    }
  };

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4 pt-6">
        <div className="flex items-center gap-3 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBackClick}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-xl font-bold text-foreground">9 Windows Shot Shape Test</h1>
        </div>
        <DrillHighScores drillName="9 Windows Shot Shape Test" />
        <Routes>
          <Route index element={<Navigate to={fromPath ? "leaderboard" : "score"} replace />} />
          <Route path="score" element={<TW9WindowsScore />} />
          <Route path="leaderboard" element={<TW9WindowsLeaderboard />} />
          <Route path="feed" element={<TW9WindowsFeed />} />
          <Route path="messages" element={<TW9WindowsMessages />} />
          <Route path="info" element={<TW9WindowsInfo />} />
        </Routes>
      </div>

      <DrillBottomTabBar drillSlug="tw-9-windows" />
    </div>
  );
};

export default TW9WindowsDrill;
