import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bell, Check, X, Trophy, Users, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { getNotificationActionUrl, getNotificationActions } from "@/utils/notificationActions";

interface Notification {
  id: string;
  type: 'friend_request' | 'group_invite' | 'high_score' | 'message';
  title: string;
  message: string;
  related_id: string | null;
  related_user_id: string | null;
  action_url: string | null;
  metadata: Record<string, any> | null;
  context_id: string | null;
  is_read: boolean;
  created_at: string;
}

// Notification types that are informational only (no user action required)
const INFORMATIONAL_TYPES = ['high_score', 'message'];

// Notification types that require user action (accept/decline)
const ACTIONABLE_TYPES = ['friend_request', 'group_invite'];

interface GroupedNotification {
  key: string;
  type: string;
  title: string;
  notifications: Notification[];
  isRead: boolean;
  latestTime: Date;
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
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [relatedProfiles, setRelatedProfiles] = useState<Record<string, { display_name: string | null; username: string | null; avatar_url: string | null }>>({});
  const prevUnreadCountRef = useRef<number>(0);
  const [badgeBumpKey, setBadgeBumpKey] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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
      // Only count actionable unread notifications for the badge
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, is_read')
        .eq('user_id', currentUserId)
        .eq('is_read', false);

      if (error) throw error;
      const nextCount = (data || []).filter(n => ACTIONABLE_TYPES.includes(n.type)).length;
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
        .limit(100);

      if (error) throw error;

      const allNotifications = (data || []) as Notification[];
      
      // Separate actionable and informational notifications
      const actionableNotifications = allNotifications.filter(n => ACTIONABLE_TYPES.includes(n.type));
      const informationalNotifications = allNotifications.filter(n => INFORMATIONAL_TYPES.includes(n.type));
      
      // Auto-mark all informational notifications as read (they don't need user action)
      const unreadInformational = informationalNotifications.filter(n => !n.is_read);
      
      if (unreadInformational.length > 0) {
        // Mark them as read in the database immediately
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .in('id', unreadInformational.map(n => n.id));
        
        // Update local state to reflect the change
        informationalNotifications.forEach(n => {
          if (INFORMATIONAL_TYPES.includes(n.type)) {
            n.is_read = true;
          }
        });
      }
      
      // Delete informational notifications beyond 30 (keep only the 30 most recent)
      if (informationalNotifications.length > 30) {
        const toDelete = informationalNotifications.slice(30);
        const deleteIds = toDelete.map(n => n.id);
        
        await supabase
          .from('notifications')
          .delete()
          .in('id', deleteIds);
        
        // Remove deleted notifications from our data
        informationalNotifications.splice(30);
      }
      
      // Combine: all actionable + limited informational (max 10 for display)
      const limitedInformational = informationalNotifications.slice(0, 10);
      const notificationsToShow = [...actionableNotifications, ...limitedInformational]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setNotifications(notificationsToShow);
      
      // Only count actionable unread notifications for the badge
      const actionableUnread = actionableNotifications.filter(n => !n.is_read).length;
      setUnreadCount(actionableUnread);
      if (actionableUnread > prevUnreadCountRef.current) {
        setBadgeBumpKey((k) => k + 1);
      }
      prevUnreadCountRef.current = actionableUnread;
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  // Group notifications by type and related_id (for similar notifications)
  const groupedNotifications = useMemo(() => {
    const groups = new Map<string, GroupedNotification>();
    const ungrouped: Notification[] = [];

    notifications.forEach((notification) => {
      // Group high_score notifications by drill_id if there are multiple
      if (notification.type === 'high_score' && notification.related_id) {
        const key = `high_score_${notification.related_id}`;
        const existing = groups.get(key);
        
        if (existing) {
          existing.notifications.push(notification);
          if (new Date(notification.created_at) > existing.latestTime) {
            existing.latestTime = new Date(notification.created_at);
            existing.isRead = notification.is_read;
          }
        } else {
          groups.set(key, {
            key,
            type: notification.type,
            title: notification.title,
            notifications: [notification],
            isRead: notification.is_read,
            latestTime: new Date(notification.created_at),
          });
        }
      } else {
        // Don't group other types
        ungrouped.push(notification);
      }
    });

    // Convert groups to array and filter out single-item groups (show them as ungrouped)
    const groupedArray: (GroupedNotification | Notification)[] = [];
    
    groups.forEach((group) => {
      if (group.notifications.length > 1) {
        groupedArray.push(group);
      } else {
        ungrouped.push(group.notifications[0]);
      }
    });

    // Sort: unread first, then by time
    const sorted = [
      ...groupedArray,
      ...ungrouped
    ].sort((a, b) => {
      const aTime = 'notifications' in a 
        ? a.latestTime.getTime()
        : new Date(a.created_at).getTime();
      const bTime = 'notifications' in b
        ? b.latestTime.getTime()
        : new Date(b.created_at).getTime();
      
      const aRead = 'notifications' in a ? a.isRead : a.is_read;
      const bRead = 'notifications' in b ? b.isRead : b.is_read;
      
      if (aRead !== bRead) {
        return aRead ? 1 : -1; // Unread first
      }
      return bTime - aTime; // Newest first
    });

    return sorted;
  }, [notifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.type === 'high_score' && notification.related_id) {
      // For high_score notifications, fetch the drill title and navigate to leaderboards
      try {
        const { data: drillData, error: drillError } = await supabase
          .from('drills')
          .select('title')
          .eq('id', notification.related_id)
          .single();
        
        if (drillError) {
          console.error('Error fetching drill:', drillError);
          setOpen(false);
          navigate('/leaderboards');
          return;
        }
        
        if (drillData?.title) {
          // Auto-mark as read
          if (INFORMATIONAL_TYPES.includes(notification.type)) {
            markAsRead(notification.id);
          }
          setOpen(false);
          // Navigate to leaderboards with the drill title as a query parameter
          navigate(`/leaderboards?drill=${encodeURIComponent(drillData.title)}&section=drills`);
        } else {
          console.warn('Drill not found for notification:', notification.related_id);
          setOpen(false);
          navigate('/leaderboards?section=drills');
        }
      } catch (error) {
        console.error('Error fetching drill info:', error);
        setOpen(false);
        navigate('/leaderboards?section=drills');
      }
      return;
    }
    
    // For other notification types, use the standard URL generation
    const url = getNotificationActionUrl(
      notification.type,
      notification.related_id,
      notification.related_user_id,
      notification.action_url
    );
    
    if (url) {
      // Auto-mark informational notifications as read when clicked
      if (INFORMATIONAL_TYPES.includes(notification.type)) {
        markAsRead(notification.id);
      }
      setOpen(false);
      navigate(url);
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

  // Check if a notification type is clickable (should navigate somewhere)
  const isClickable = (type: string) => type === 'high_score';

  // Check if a notification type requires action buttons (accept/decline)
  const isActionable = (type: string) => ACTIONABLE_TYPES.includes(type);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {triggerWithBadge}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3 flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No notifications</p>
          ) : (
            groupedNotifications.map((item) => {
              // Render grouped notification
              if ('notifications' in item) {
                const group = item as GroupedNotification;
                const isExpanded = expandedGroups.has(group.key);
                const unreadCount = group.notifications.filter(n => !n.is_read).length;
                
                return (
                  <div
                    key={group.key}
                    className={`p-4 border rounded-lg ${
                      group.isRead ? 'bg-background' : 'bg-muted/50'
                    } ${INFORMATIONAL_TYPES.includes(group.type) ? 'cursor-pointer hover:bg-muted/70' : ''}`}
                    onClick={() => {
                      if (INFORMATIONAL_TYPES.includes(group.type) && group.notifications[0]) {
                        handleNotificationClick(group.notifications[0]);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getIcon(group.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{group.title}</h4>
                          <Badge variant="secondary" className="ml-2">
                            {group.notifications.length}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {unreadCount > 0 
                            ? `${unreadCount} new ${unreadCount === 1 ? 'update' : 'updates'}`
                            : `${group.notifications.length} ${group.notifications.length === 1 ? 'notification' : 'notifications'}`
                          }
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(group.latestTime, { addSuffix: true })}
                        </p>
                        
                        {isExpanded && (
                          <div className="mt-3 space-y-2">
                            {group.notifications.map((notification) => (
                              <div
                                key={notification.id}
                                className={`p-2 rounded border ${
                                  notification.is_read ? 'bg-background' : 'bg-muted/30'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNotificationClick(notification);
                                }}
                              >
                                <p className="text-xs text-muted-foreground">
                                  {getNotificationMessage(notification)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newExpanded = new Set(expandedGroups);
                            if (isExpanded) {
                              newExpanded.delete(group.key);
                            } else {
                              newExpanded.add(group.key);
                            }
                            setExpandedGroups(newExpanded);
                          }}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={14} className="mr-1" />
                              Collapse
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} className="mr-1" />
                              Expand
                            </>
                          )}
                        </Button>
                      </div>
                      {ACTIONABLE_TYPES.includes(group.type) && (
                        <div className="flex flex-col gap-1">
                          {!group.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                group.notifications.forEach(n => markAsRead(n.id));
                              }}
                            >
                              <Check size={14} />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              
              // Render single notification
              const notification = item as Notification;
              const actions = getNotificationActions(
                notification.type,
                notification.related_id,
                notification.related_user_id,
                notification.action_url,
                (url) => {
                  markAsRead(notification.id);
                  setOpen(false);
                  navigate(url);
                }
              );
              
              return (
                <div
                  key={notification.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    notification.is_read ? 'bg-background' : 'bg-muted/50'
                  } hover:bg-muted`}
                  onClick={() => handleNotificationClick(notification)}
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
                        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
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
                      
                      {actions.length > 0 && !INFORMATIONAL_TYPES.includes(notification.type) && (
                        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                          {actions.map((action, idx) => (
                            <Button
                              key={idx}
                              size="sm"
                              variant={action.variant || 'default'}
                              onClick={action.action}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      )}

                      {/* Show hint for informational notifications */}
                      {INFORMATIONAL_TYPES.includes(notification.type) && notification.type === 'high_score' && (
                        <p className="text-xs text-primary mt-2">Tap to view leaderboard</p>
                      )}
                    </div>
                    {ACTIONABLE_TYPES.includes(notification.type) && (
                      <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
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
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};