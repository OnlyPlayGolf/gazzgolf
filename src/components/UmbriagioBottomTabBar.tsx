import { useNavigate, useLocation } from "react-router-dom";
import { Pencil, Info, Newspaper, List, Settings } from "lucide-react";

interface UmbriagioBottomTabBarProps {
  gameId: string;
  isSpectator?: boolean;
}

export function UmbriagioBottomTabBar({ gameId, isSpectator = false }: UmbriagioBottomTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const allTabs = [
    { id: "score", label: "Enter score", icon: Pencil, path: `/umbriago/${gameId}/play`, hideForSpectator: true },
    { id: "leaderboard", label: "Leaderboards", icon: List, path: `/umbriago/${gameId}/leaderboard`, hideForSpectator: false },
    { id: "feed", label: "Game feed", icon: Newspaper, path: `/umbriago/${gameId}/feed`, hideForSpectator: false },
    { id: "info", label: "Game info", icon: Info, path: `/umbriago/${gameId}/info`, hideForSpectator: false },
    { id: "settings", label: "Settings", icon: Settings, path: `/umbriago/${gameId}/settings`, hideForSpectator: false },
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
              className={`flex flex-col items-center gap-0.5 py-1.5 px-1 flex-1 transition-colors ${
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={16} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
