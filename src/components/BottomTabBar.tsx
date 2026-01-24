import { Home, Target, Users, Play, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'practice', label: 'Practice', icon: Target, path: '/practice' },
  { id: 'play', label: 'Play', icon: Play, path: '/rounds-play' },
  { id: 'groups', label: 'Groups', icon: Users, path: '/groups' },
  { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
];

export const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide the tab bar on immersive round flows (tracking, summary, setup), drill game modes, umbriago, wolf, copenhagen, match play, scramble, skins, and game settings detail
  const isBasicStatsAdd = /^\/rounds\/[^/]+\/basic-track$/.test(location.pathname);
  const isAddStatsEntry = location.pathname === '/rounds/pro-setup';
  const hideTabBar = (
    ((location.pathname.startsWith('/rounds/') && location.pathname !== '/rounds') && !isBasicStatsAdd && !isAddStatsEntry) ||
    location.pathname.startsWith('/drill/') ||
    location.pathname.startsWith('/umbriago/') ||
    location.pathname.startsWith('/wolf/') ||
    location.pathname.startsWith('/copenhagen/') ||
    location.pathname.startsWith('/match-play/') ||
    location.pathname.startsWith('/best-ball/') ||
    location.pathname.startsWith('/scramble/') ||
    location.pathname.startsWith('/skins/') ||
    location.pathname.startsWith('/game-settings/')
  );
  if (hideTabBar) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            location.pathname === tab.path ||
            (tab.path === '/practice' && (location.pathname.startsWith('/drills') || location.pathname.startsWith('/levels') || location.pathname === '/categories'));
          
          // Special styling for Play tab
          if (tab.id === 'play') {
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className="flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[56px] transition-colors"
              >
                <div className="w-14 h-14 rounded-full bg-primary flex flex-col items-center justify-center">
                  <Icon size={20} className="text-primary-foreground mb-0.5" />
                  <span className="text-[10px] font-medium text-primary-foreground">{tab.label}</span>
                </div>
              </button>
            );
          }
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className="flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[56px] transition-colors"
            >
              <div className={cn(
                "flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors",
                isActive 
                  ? "bg-primary/10" 
                  : ""
              )}>
                <Icon 
                  size={20} 
                  className={cn(
                    "mb-0.5",
                    isActive ? "text-primary" : "text-primary/60"
                  )} 
                />
                <span className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-primary" : "text-primary/60"
                )}>
                  {tab.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};