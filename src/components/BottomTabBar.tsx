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

  // Hide the tab bar on immersive round flows (tracking, summary, setup), drill game modes, umbriago, wolf, copenhagen, match play, scramble, skins, and game settings detail. Show on 21 Points setup.
  const isBasicStatsAdd = /^\/rounds\/[^/]+\/basic-track$/.test(location.pathname);
  const isAddStatsEntry = location.pathname === '/rounds/pro-setup';
  const is21PointsSetup = location.pathname === '/drill/21-points/setup';
  const hideTabBar = (
    ((location.pathname.startsWith('/rounds/') && location.pathname !== '/rounds') && !isBasicStatsAdd && !isAddStatsEntry) ||
    (location.pathname.startsWith('/drill/') && !is21PointsSetup) ||
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
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 h-[64px]">
      <div className="flex h-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            location.pathname === tab.path ||
            (tab.path === '/practice' && (location.pathname.startsWith('/drills') || location.pathname.startsWith('/levels') || location.pathname === '/categories' || location.pathname === '/leaderboards' || location.pathname === '/drill/21-points/setup')) ||
            (tab.path === '/groups' && location.pathname.startsWith('/group/'));
          
          // Special styling for Play tab
          if (tab.id === 'play') {
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className="flex-1 flex flex-col items-center justify-center h-full transition-colors"
              >
                <div className="w-[64px] h-[64px] rounded-full bg-primary flex flex-col items-center justify-center shrink-0" style={{ aspectRatio: '1 / 1' }}>
                  <Icon size={24} className="text-primary-foreground mb-0.5 w-[24px] h-[24px]" />
                  <span className="text-[11px] font-medium text-primary-foreground">{tab.label}</span>
                </div>
              </button>
            );
          }
          
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className="flex-1 flex flex-col items-center justify-center py-1 px-1 h-full transition-colors"
            >
              <div className={cn(
                "flex flex-col items-center justify-center px-2 py-1 rounded-lg transition-colors",
                isActive 
                  ? "bg-primary/10" 
                  : ""
              )}>
                <Icon 
                  size={24} 
                  className={cn(
                    "mb-0.5 w-[24px] h-[24px]",
                    isActive ? "text-primary" : "text-primary/60"
                  )} 
                />
                <span className={cn(
                  "text-[11px] font-medium",
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