import { useNavigate, useLocation } from "react-router-dom";
import { Pencil, Info, Newspaper, List, Settings } from "lucide-react";

interface SkinsBottomTabBarProps {
  roundId: string;
  isSpectator?: boolean;
}

export function SkinsBottomTabBar({ roundId, isSpectator = false }: SkinsBottomTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const allTabs = [
    { id: "score", label: "Enter score", icon: Pencil, path: `/skins/${roundId}/track`, hideForSpectator: true },
    { id: "leaderboard", label: "Leaderboard", icon: List, path: `/skins/${roundId}/leaderboard`, hideForSpectator: false },
    { id: "feed", label: "Game feed", icon: Newspaper, path: `/rounds/${roundId}/feed`, hideForSpectator: false },
    { id: "info", label: "Game info", icon: Info, path: `/skins/${roundId}/info`, hideForSpectator: false },
    { id: "settings", label: "Settings", icon: Settings, path: `/skins/${roundId}/settings`, hideForSpectator: false },
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
              onClick={() => navigate(tab.path)}
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