import { useNavigate, useLocation } from "react-router-dom";
import { Pencil, Info, Newspaper, List, Settings } from "lucide-react";

interface RoundBottomTabBarProps {
  roundId: string;
  isSpectator?: boolean;
}

export function RoundBottomTabBar({ roundId, isSpectator = false }: RoundBottomTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const allTabs = [
    { id: "score", label: "Enter score", icon: Pencil, path: `/rounds/${roundId}/track`, hideForSpectator: true },
    { id: "leaderboard", label: "Leaderboards", icon: List, path: `/rounds/${roundId}/leaderboard`, hideForSpectator: false },
    { id: "feed", label: "Game feed", icon: Newspaper, path: `/rounds/${roundId}/feed`, hideForSpectator: false },
    { id: "info", label: "Game info", icon: Info, path: `/rounds/${roundId}/info`, hideForSpectator: false },
    { id: "settings", label: "Settings", icon: Settings, path: `/rounds/${roundId}/settings`, hideForSpectator: false },
  ];

  const tabs = isSpectator ? allTabs.filter(tab => !tab.hideForSpectator) : allTabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="flex items-center justify-around max-w-2xl mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path, { replace: true })}
              className={`flex flex-col items-center gap-1 py-3 px-4 flex-1 transition-colors ${
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
