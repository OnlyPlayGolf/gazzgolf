import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bell, Check, X, Trophy, Users, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

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
}

export const NotificationsSheet = ({ trigger }: NotificationsSheetProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  // Real-time subscription for new notifications
  useEffect(() => {
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    loadNotifications();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications((data || []) as Notification[]);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
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
      setUnreadCount(prev => Math.max(0, prev - 1));
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
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleFriendRequest = async (notificationId: string, requestId: string, accept: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    try {
      if (accept) {
        // Get the friendship details
        const { data: friendship } = await supabase
          .from('friendships')
          .select('requester, addressee')
          .eq('id', requestId)
          .single();

        if (!friendship) throw new Error('Friend request not found');

        // Update status to accepted
        const { error: updateError } = await supabase
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', requestId);

        if (updateError) throw updateError;

        // Ensure canonical pair exists
        const { error: ensureError } = await supabase
          .rpc('ensure_friendship', {
            u1: friendship.requester,
            u2: friendship.addressee
          });

        if (ensureError) throw ensureError;

        toast({
          title: "Friend request accepted",
          description: "You are now friends!",
        });
      } else {
        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('id', requestId);

        if (error) throw error;

        toast({
          title: "Friend request declined",
        });
      }

      // Delete the notification
      await deleteNotification(notificationId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process friend request.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
        {trigger || (
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative">
            <Bell size={18} />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        )}
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
                    <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                    
                    {notification.type === 'friend_request' && notification.related_id && !notification.is_read && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => handleFriendRequest(notification.id, notification.related_id!, true)}
                          disabled={loading}
                        >
                          <Check size={14} className="mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFriendRequest(notification.id, notification.related_id!, false)}
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