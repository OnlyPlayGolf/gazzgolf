import { useNavigate, useLocation } from "react-router-dom";
import { Pencil, Info, Newspaper, List, Settings } from "lucide-react";

interface ScrambleBottomTabBarProps {
  gameId: string;
}

export function ScrambleBottomTabBar({ gameId }: ScrambleBottomTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const tabs = [
    { id: "score", label: "Enter score", icon: Pencil, path: `/scramble/${gameId}/play` },
    { id: "info", label: "Game info", icon: Info, path: `/scramble/${gameId}/info` },
    { id: "feed", label: "Game feed", icon: Newspaper, path: `/scramble/${gameId}/feed` },
    { id: "leaderboard", label: "Leaderboards", icon: List, path: `/scramble/${gameId}/leaderboard` },
    { id: "settings", label: "Settings", icon: Settings, path: `/scramble/${gameId}/settings` },
  ];

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
