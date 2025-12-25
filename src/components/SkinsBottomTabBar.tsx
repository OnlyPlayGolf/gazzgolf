import { useNavigate, useLocation } from "react-router-dom";
import { Pencil, Info, Newspaper, List, Settings } from "lucide-react";

interface SkinsBottomTabBarProps {
  roundId: string;
}

export function SkinsBottomTabBar({ roundId }: SkinsBottomTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const tabs = [
    { id: "score", label: "Enter score", icon: Pencil, path: `/skins/${roundId}/track` },
    { id: "info", label: "Game info", icon: Info, path: `/skins/${roundId}/info` },
    { id: "feed", label: "Game feed", icon: Newspaper, path: `/rounds/${roundId}/feed` },
    { id: "leaderboard", label: "Leaderboard", icon: List, path: `/skins/${roundId}/leaderboard` },
    { id: "settings", label: "Settings", icon: Settings, path: `/skins/${roundId}/settings` },
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