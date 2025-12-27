import { useLocation, useNavigate } from "react-router-dom";
import { FileText, Info, Users, Trophy, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface WolfBottomTabBarProps {
  gameId: string;
  isSpectator?: boolean;
}

export function WolfBottomTabBar({ gameId, isSpectator = false }: WolfBottomTabBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const allTabs = [
    { id: "play", label: "Enter Score", icon: FileText, path: `/wolf/${gameId}/play`, hideForSpectator: true },
    { id: "info", label: "Game Info", icon: Info, path: `/wolf/${gameId}/info`, hideForSpectator: false },
    { id: "feed", label: "Game Feed", icon: Users, path: `/wolf/${gameId}/feed`, hideForSpectator: false },
    { id: "leaderboard", label: "Leaderboards", icon: Trophy, path: `/wolf/${gameId}/leaderboard`, hideForSpectator: false },
    { id: "settings", label: "Settings", icon: Settings, path: `/wolf/${gameId}/settings`, hideForSpectator: false },
  ];

  const tabs = isSpectator ? allTabs.filter(tab => !tab.hideForSpectator) : allTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex justify-around items-center h-16 max-w-2xl mx-auto">
        {tabs.map((tab) => {
          const isActive = currentPath === tab.path;
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon size={20} />
              <span className="text-[10px] mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
