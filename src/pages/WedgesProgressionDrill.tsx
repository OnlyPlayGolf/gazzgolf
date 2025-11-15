import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { DrillBottomTabBar } from "@/components/DrillBottomTabBar";
import WedgesProgressionScore from "./WedgesProgressionScore";
import WedgesProgressionInfo from "./WedgesProgressionInfo";
import WedgesProgressionFeed from "./WedgesProgressionFeed";
import WedgesProgressionLeaderboard from "./WedgesProgressionLeaderboard";
import WedgesProgressionMessages from "./WedgesProgressionMessages";

export default function WedgesProgressionDrill() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname.includes("/info")) return "info";
    if (location.pathname.includes("/feed")) return "feed";
    if (location.pathname.includes("/leaderboard")) return "leaderboard";
    if (location.pathname.includes("/messages")) return "messages";
    return "score";
  });

  useEffect(() => {
    if (location.pathname.includes("/info")) setActiveTab("info");
    else if (location.pathname.includes("/feed")) setActiveTab("feed");
    else if (location.pathname.includes("/leaderboard")) setActiveTab("leaderboard");
    else if (location.pathname.includes("/messages")) setActiveTab("messages");
    else setActiveTab("score");
  }, [location.pathname]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

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
              <h1 className="text-xl font-bold">Åberg's Wedge Ladder</h1>
              <p className="text-sm text-muted-foreground">Distance control progression</p>
            </div>
            <div className="w-10" />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {activeTab === "score" && <WedgesProgressionScore onTabChange={handleTabChange} />}
        {activeTab === "info" && <WedgesProgressionInfo />}
        {activeTab === "feed" && <WedgesProgressionFeed />}
        {activeTab === "leaderboard" && <WedgesProgressionLeaderboard />}
        {activeTab === "messages" && <WedgesProgressionMessages />}
      </div>
      
      <DrillBottomTabBar drillSlug="wedges-progression" />
    </div>
  );
}
