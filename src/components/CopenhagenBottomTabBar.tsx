import { useNavigate, useLocation } from "react-router-dom";
import { Pencil, Info, Newspaper, List, Settings } from "lucide-react";

interface CopenhagenBottomTabBarProps {
  gameId: string;
}

export function CopenhagenBottomTabBar({ gameId }: CopenhagenBottomTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const tabs = [
    { id: "score", label: "Enter score", icon: Pencil, path: `/copenhagen/${gameId}/play` },
    { id: "info", label: "Game info", icon: Info, path: `/copenhagen/${gameId}/info` },
    { id: "feed", label: "Game feed", icon: Newspaper, path: `/copenhagen/${gameId}/feed` },
    { id: "leaderboard", label: "Leaderboards", icon: List, path: `/copenhagen/${gameId}/leaderboard` },
    { id: "settings", label: "Settings", icon: Settings, path: `/copenhagen/${gameId}/settings` },
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
