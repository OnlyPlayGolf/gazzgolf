import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pencil, Info, Newspaper, List, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface RoundBottomTabBarProps {
  roundId: string;
  isSpectator?: boolean;
  isEditWindowExpired?: boolean;
}

const feedPathFor = (roundId: string) => `/rounds/${roundId}/feed`;
const FEED_LAST_SEEN_KEY = (roundId: string) => `round_feed_last_seen_${roundId}`;

export function RoundBottomTabBar({ roundId, isSpectator = false, isEditWindowExpired = false }: RoundBottomTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [feedUnreadCount, setFeedUnreadCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const locationPathnameRef = useRef(location.pathname);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    locationPathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // Load initial unread count: comments on this round since user last viewed the feed (that they didn't write)
  const loadFeedUnreadCount = async () => {
    if (!roundId || !currentUserId) return;
    try {
      const lastSeenRaw = localStorage.getItem(FEED_LAST_SEEN_KEY(roundId));
      const lastSeen = lastSeenRaw ? new Date(lastSeenRaw).toISOString() : null;
      let query = supabase
        .from("round_comments")
        .select("id", { count: "exact", head: true })
        .eq("round_id", roundId)
        .neq("user_id", currentUserId);
      if (lastSeen) {
        query = query.gt("created_at", lastSeen);
      } else {
        // Never opened feed for this round: only count last 7 days so we don't show a huge number
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gt("created_at", weekAgo.toISOString());
      }
      const { count } = await query;
      setFeedUnreadCount(Math.min(count ?? 0, 99));
    } catch (e) {
      console.error("Error loading feed unread count:", e);
    }
  };

  useEffect(() => {
    if (roundId && currentUserId) {
      loadFeedUnreadCount();
    }
  }, [roundId, currentUserId]);

  // Clear feed notification when user is on the feed tab (e.g. after navigation or deep link)
  useEffect(() => {
    if (location.pathname === feedPathFor(roundId)) {
      setFeedUnreadCount(0);
      try {
        localStorage.setItem(FEED_LAST_SEEN_KEY(roundId), new Date().toISOString());
      } catch (_) {}
    }
  }, [location.pathname, roundId]);

  const feedPath = feedPathFor(roundId);

  // When user opens the feed tab, mark as seen so future unread count is from this moment
  const handleFeedTabClick = () => {
    setFeedUnreadCount(0);
    try {
      localStorage.setItem(FEED_LAST_SEEN_KEY(roundId), new Date().toISOString());
    } catch (_) {}
    navigate(feedPath, { replace: true });
  };

  // Subscribe to new comments on this round so we can show a badge on the Game feed tab
  useEffect(() => {
    if (!roundId) return;
    const channel = supabase
      .channel(`round-feed-comments-${roundId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "round_comments",
          filter: `round_id=eq.${roundId}`,
        },
        (payload: { new?: { user_id?: string } }) => {
          const newRecord = payload?.new;
          const isFromMe = newRecord?.user_id === currentUserIdRef.current;
          const isCurrentlyOnFeed = locationPathnameRef.current === feedPath;
          if (newRecord && !isFromMe && !isCurrentlyOnFeed) {
            setFeedUnreadCount((prev) => Math.min(prev + 1, 99));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roundId]);

  const allTabs = [
    { id: "score", label: "Enter score", icon: Pencil, path: `/rounds/${roundId}/track`, hideForSpectator: true },
    { id: "leaderboard", label: "Leaderboards", icon: List, path: `/rounds/${roundId}/leaderboard`, hideForSpectator: false },
    { id: "feed", label: "Game feed", icon: Newspaper, path: feedPathFor(roundId), hideForSpectator: false },
    { id: "info", label: "Game info", icon: Info, path: `/rounds/${roundId}/info`, hideForSpectator: false },
    { id: "settings", label: "Settings", icon: Settings, path: `/rounds/${roundId}/settings`, hideForSpectator: false },
  ];

  // Hide "Enter score" tab for spectators OR when edit window has expired
  const tabs = (isSpectator || isEditWindowExpired) ? allTabs.filter(tab => !tab.hideForSpectator) : allTabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="flex items-center justify-around max-w-2xl mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          const showFeedBadge = tab.id === "feed" && feedUnreadCount > 0;

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "feed") handleFeedTabClick();
                else navigate(tab.path, { replace: true });
              }}
              className={`flex flex-col items-center gap-1 py-3 px-4 flex-1 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="relative inline-block">
                <Icon size={20} />
                {showFeedBadge && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 z-10 h-4 min-w-4 flex items-center justify-center p-0 text-[10px]"
                  >
                    {feedUnreadCount > 99 ? "99+" : feedUnreadCount}
                  </Badge>
                )}
              </span>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
