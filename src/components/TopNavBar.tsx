import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserPlus, Bell, MessageCircle, ArrowLeft, Menu, Trophy, TrendingUp, Users, Zap, Settings, Info, MessageSquare, User as UserIcon, Mail, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AddFriendDialog } from "./AddFriendDialog";
import { NotificationsSheet } from "./NotificationsSheet";
import { MessagesSheet } from "./MessagesSheet";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";

export const TopNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<any>(null);
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
    loadProfile();
  }, []);

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

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(profileData);
  };

  const fromPage = (location.state as any)?.from;
  const showBack = fromPage && (location.pathname !== '/profile' && location.pathname !== '/');
  const backPath = fromPage === 'profile' ? '/profile' : fromPage === 'practice' ? '/practice' : '/';
  
  // Check if we're on the home page (profile page has its own menu)
  const showHamburgerMenu = location.pathname === '/';
  
  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-transform duration-300",
        visible ? "translate-y-0" : "-translate-y-full"
      )}
    >
      <div className="bg-[hsl(120,50%,20%)] px-4 py-3 flex items-center justify-between">
        {/* Left: Title */}
        <h1 className="text-white font-luxury font-semibold text-2xl">
          Gazz Golf
        </h1>

        {/* Center: Back or Menu */}
        <div className="flex-1 flex justify-center">
          {showBack ? (
            <button
              onClick={() => navigate(backPath)}
              className="flex-shrink-0 rounded-full h-10 w-10 flex items-center justify-center text-white hover:bg-white/20"
              aria-label={fromPage === 'profile' ? "Back to Profile" : "Back to Home"}
            >
              <ArrowLeft size={20} />
            </button>
          ) : showHamburgerMenu && (
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button
                  className="flex-shrink-0 rounded-full h-10 w-10 flex items-center justify-center text-white hover:bg-white/20"
                  aria-label="Open Menu"
                >
                  <Menu size={20} />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                <div className="space-y-4 mt-8">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Card key={item.id} className="border-border">
                        <CardContent className="p-0">
                          <Button
                            variant="ghost"
                            disabled={!item.available}
                            onClick={item.available && item.path ? () => { 
                              navigate(item.path, { state: { from: 'home' } }); 
                              setMenuOpen(false);
                            } : undefined}
                            className="w-full h-auto p-4 justify-start text-left disabled:opacity-60"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-3">
                                <Icon 
                                  size={20} 
                                  className={item.available ? "text-primary" : "text-muted-foreground"} 
                                />
                                <div>
                                  <div className={`font-medium ${item.available ? "text-foreground" : "text-muted-foreground"}`}>
                                    {item.label}
                                  </div>
                                  {!item.available && (
                                    <div className="text-xs text-muted-foreground">Coming soon</div>
                                  )}
                                </div>
                              </div>
                              <ChevronRight 
                                size={16} 
                                className={item.available ? "text-muted-foreground" : "text-muted-foreground"} 
                              />
                            </div>
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                  
                  {/* Feedback Link */}
                  <Card className="border-border">
                    <CardContent className="p-0">
                      <Button
                        variant="ghost"
                        asChild
                        className="w-full h-auto p-4 justify-start text-left"
                      >
                        <a href="mailto:feedback@golftraining.app" className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <Mail size={20} className="text-primary" />
                            <div>
                              <div className="font-medium text-foreground">Feedback</div>
                              <div className="text-xs text-muted-foreground">Send us your thoughts</div>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-muted-foreground" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <AddFriendDialog 
            trigger={
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-white hover:bg-white/20">
                <UserPlus size={18} />
              </Button>
            }
          />
          <NotificationsSheet 
            trigger={
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative text-white hover:bg-white/20">
                <Bell size={18} />
              </Button>
            }
          />
          <MessagesSheet 
            trigger={
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative text-white hover:bg-white/20">
                <MessageCircle size={18} />
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
};
