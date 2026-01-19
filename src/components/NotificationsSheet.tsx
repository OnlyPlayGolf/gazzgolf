import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bell, Check, X, Trophy, Users, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: 'friend_request' | 'group_invite' | 'high_score' | 'message';
  title: string;
  message: string;
  related_id: string | null;
  related_user_id: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsSheetProps {
  trigger?: React.ReactNode;
  /**
   * - auto: show number when count is available, otherwise dot
   * - count: always show number
   * - dot: always show a dot
   */
  badgeVariant?: 'auto' | 'count' | 'dot';
  /** Cap numeric badge at N+ (default 9+) */
  badgeCap?: number;
}

export const NotificationsSheet = ({
  trigger,
  badgeVariant = 'auto',
  badgeCap = 9,
}: NotificationsSheetProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [relatedProfiles, setRelatedProfiles] = useState<Record<string, { display_name: string | null; username: string | null; avatar_url: string | null }>>({});
  const prevUnreadCountRef = useRef<number>(0);
  const [badgeBumpKey, setBadgeBumpKey] = useState(0);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  // Real-time subscription for new notifications
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });

  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    // Always load unread badge state (even when sheet is closed)
    loadUnreadCount();

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          // Only react to notifications for the signed-in user (prevents refetch storms)
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          // Keep badge updated in realtime without opening the sheet.
          loadUnreadCount();
          if (open) loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, open]);

  // Resolve profile info for related users (e.g. friend requests)
  useEffect(() => {
    const relatedUserIds = Array.from(
      new Set(
        notifications
          .filter((n) => n.type === 'friend_request' && n.related_user_id)
          .map((n) => n.related_user_id!) // safe due to filter
      )
    ).filter((id) => !relatedProfiles[id]);

    if (relatedUserIds.length === 0) return;

    const loadProfiles = async () => {
      // Use RPC to bypass profiles RLS safely (same as AddFriendFromQR)
      const rows = await Promise.all(
        relatedUserIds.map(async (id) => {
          const { data: profileRows, error } = await supabase
            .rpc('get_public_profile', { target_user_id: id });
          if (error) {
            console.error('Error loading related profile:', id, error);
            return null;
          }
          return (profileRows || [])[0] as any;
        })
      );

      setRelatedProfiles((prev) => {
        const next = { ...prev };
        for (const p of rows) {
          if (!p?.id) continue;
          next[p.id] = {
            display_name: p.display_name ?? null,
            username: p.username ?? null,
            avatar_url: p.avatar_url ?? null,
          };
        }
        return next;
      });
    };

    loadProfiles();
  }, [notifications, relatedProfiles]);

  const getDisplayName = (userId: string | null): string => {
    if (!userId) return 'Someone';
    const p = relatedProfiles[userId];
    if (!p) return 'Someone';
    return p.display_name || (p.username ? `@${p.username}` : 'Someone');
  };

  const getNotificationMessage = (notification: Notification): string => {
    if (notification.type === 'friend_request') {
      return `${getDisplayName(notification.related_user_id)} sent you a friend request`;
    }
    return notification.message;
  };

  const loadUnreadCount = async () => {
    if (!currentUserId) return;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUserId)
        .eq('is_read', false);

      if (error) throw error;
      const nextCount = count ?? 0;
      setUnreadCount(nextCount);

      // Softly animate the badge when new unread arrives
      if (nextCount > prevUnreadCountRef.current) {
        setBadgeBumpKey((k) => k + 1);
      }
      prevUnreadCountRef.current = nextCount;
    } catch (error) {
      console.error('Error loading unread notification count:', error);
      // Fall back to dot-only mode when count isn't available
      setUnreadCount(null);
    }
  };

  const loadNotifications = async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications((data || []) as Notification[]);
      // Keep the unread badge in sync while the sheet is open.
      const unread = data?.filter(n => !n.is_read).length || 0;
      setUnreadCount(unread);
      if (unread > prevUnreadCountRef.current) {
        setBadgeBumpKey((k) => k + 1);
      }
      prevUnreadCountRef.current = unread;
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => (prev === null ? null : Math.max(0, prev - 1)));
      // Confirm against backend (covers multi-device / concurrent updates)
      loadUnreadCount();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== id));
      loadUnreadCount();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleFriendRequest = async (notificationId: string, requesterId: string, accept: boolean) => {
    if (!currentUserId) return;

    setLoading(true);
    try {
      if (accept) {
        // Update friendship status using requester and addressee (matching Friends.tsx approach)
        const { error: updateError } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('requester', requesterId)
          .eq('addressee', currentUserId);

        if (updateError) throw updateError;

        toast({
          title: "Friend request accepted",
          description: "You are now friends!",
        });
      } else {
        // Delete using requester and addressee
        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('requester', requesterId)
          .eq('addressee', currentUserId);

        if (error) throw error;

        toast({
          title: "Friend request declined",
        });
      }

      // Delete the notification
      await deleteNotification(notificationId);
    } catch (error) {
      console.error('Error handling friend request:', error);
      toast({
        title: "Error",
        description: "Failed to process friend request.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const badgeText = useMemo(() => {
    if (unreadCount === null) return null;
    if (unreadCount <= 0) return null;
    if (unreadCount > badgeCap) return `${badgeCap}+`;
    return `${unreadCount}`;
  }, [unreadCount, badgeCap]);

  const hasUnread = unreadCount === null ? false : unreadCount > 0;

  const shouldShowBadge = useMemo(() => {
    if (badgeVariant === 'dot') return hasUnread;
    if (badgeVariant === 'count') return (unreadCount ?? 0) > 0;
    // auto
    return (unreadCount ?? 0) > 0;
  }, [badgeVariant, hasUnread, unreadCount]);

  const badgeNode = useMemo(() => {
    if (!shouldShowBadge) return null;

    const isDot = badgeVariant === 'dot' || (badgeVariant === 'auto' && unreadCount === null);
    const key = `${badgeBumpKey}-${isDot ? 'dot' : 'count'}-${badgeText ?? ''}`;

    if (isDot) {
      return (
        <span
          key={key}
          className={cn(
            "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive",
            "ring-2 ring-primary",
            "animate-in fade-in zoom-in-95 duration-200"
          )}
        />
      );
    }

    return (
      <Badge
        key={key}
        variant="destructive"
        className={cn(
          "absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center",
          "text-[11px] leading-none tabular-nums",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        {badgeText}
      </Badge>
    );
  }, [shouldShowBadge, badgeVariant, unreadCount, badgeBumpKey, badgeText]);

  const triggerWithBadge = useMemo(() => {
    if (trigger && isValidElement(trigger)) {
      const el: any = trigger;
      const existingClassName = el.props?.className;
      const merged = cn(existingClassName, "relative");
      return cloneElement(
        el,
        { className: merged },
        <>
          {el.props.children}
          {badgeNode}
        </>
      );
    }

    // Default trigger
    return (
      <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative">
        <Bell size={18} />
        {badgeNode}
      </Button>
    );
  }, [trigger, badgeNode]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return <Users size={16} className="text-primary" />;
      case 'group_invite':
        return <Users size={16} className="text-secondary" />;
      case 'high_score':
        return <Trophy size={16} className="text-yellow-500" />;
      case 'message':
        return <MessageCircle size={16} className="text-blue-500" />;
      default:
        return <Bell size={16} />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {triggerWithBadge}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-3 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No notifications</p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border rounded-lg ${
                  notification.is_read ? 'bg-background' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{notification.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{getNotificationMessage(notification)}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                    
                    {notification.type === 'friend_request' && notification.related_user_id && !notification.is_read && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => handleFriendRequest(notification.id, notification.related_user_id!, true)}
                          disabled={loading}
                        >
                          <Check size={14} className="mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFriendRequest(notification.id, notification.related_user_id!, false)}
                          disabled={loading}
                        >
                          <X size={14} className="mr-1" />
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <Check size={14} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteNotification(notification.id)}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};