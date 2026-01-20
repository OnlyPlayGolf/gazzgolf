import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserPlus, Bell, MessageCircle, ArrowLeft, Menu, Trophy, TrendingUp, Users, Zap, Settings, Info, MessageSquare, User as UserIcon, Mail, ChevronRight } from "lucide-react";
import { AddFriendDialog } from "./AddFriendDialog";
import { NotificationsSheet } from "./NotificationsSheet";
import { MessagesSheet } from "./MessagesSheet";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import onlyplayLogo from "@/assets/onlyplay-golf-logo.png";

interface TopNavBarProps {
  hideNotifications?: boolean;
  profile?: any;
}

export const TopNavBar = ({ profile, hideNotifications = false }: TopNavBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { id: 'profile', label: 'Personal Information', icon: UserIcon, available: true, path: '/profile-settings' },
    { id: 'leaderboards', label: 'Leaderboards', icon: Trophy, available: true, path: '/leaderboards' },
    { id: 'rounds', label: 'Round Stats', icon: TrendingUp, available: true, path: '/rounds' },
    { id: 'played-rounds', label: 'Played Rounds', icon: Users, available: true, path: '/played-rounds' },
    { id: 'user-drills', label: 'User Drills', icon: Zap, available: true, path: '/user-drills' },
    { id: 'friends', label: 'Friends', icon: Users, available: true, path: '/friends' },
    { id: 'settings', label: 'Settings', icon: Settings, available: false },
    { id: 'about', label: 'About', icon: Info, available: false },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // Scrolling down
        setVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up
        setVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Never show back button in TopNavBar
  
  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-transform duration-300",
        visible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="bg-primary px-4 py-1.5 flex items-center justify-between">
        {/* Left: Logo */}
        <img
          src={onlyplayLogo}
          alt="OnlyPlay Golf"
          className="h-14 brightness-0 invert cursor-pointer"
          onClick={() => {
            navigate('/');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        {/* Center: Empty space for balance */}
        <div className="flex-1 flex justify-center">
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <AddFriendDialog 
            showQrTabs={false}
            trigger={
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-white hover:bg-white/20">
                <UserPlus size={18} fill="white" />
              </Button>
            }
          />
          {!hideNotifications && (
            <NotificationsSheet 
              trigger={
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative text-white hover:bg-white/20">
                  <Bell size={18} fill="white" strokeWidth={0} />
                </Button>
              }
            />
          )}
          <MessagesSheet 
            trigger={
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative text-white hover:bg-white/20">
                <MessageCircle size={18} fill="white" strokeWidth={0} />
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
};
