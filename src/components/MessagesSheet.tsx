import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, ArrowLeft, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

const MessageBubble = ({ message }: { message: Message }) => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  const isOwnMessage = message.sender_id === currentUserId;

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-lg p-3 ${
          isOwnMessage
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        }`}
      >
        {!isOwnMessage && (
          <p className="text-xs font-medium mb-1">{message.sender_name}</p>
        )}
        <p className="text-sm">{message.content}</p>
        <p className={`text-xs mt-1 ${isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
};

interface Conversation {
  id: string;
  type: 'friend' | 'group';
  name: string;
  group_id?: string;
  other_user_id?: string;
  last_message?: string;
  last_message_time?: string;
  updated_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface MessagesSheetProps {
  trigger?: React.ReactNode;
}

export const MessagesSheet = ({ trigger }: MessagesSheetProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      loadConversations();
    }
  }, [open]);

  // Subscribe to real-time message updates for unread count
  useEffect(() => {
    const channel = supabase
      .channel('all-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          loadUnreadCount();
          if (open) {
            loadConversations();
          }
        }
      )
      .subscribe();

    loadUnreadCount();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open]);

  useEffect(() => {
    if (selectedConversation) {
      const loadAndMark = async () => {
        await loadMessages(selectedConversation.id);
        await markConversationAsRead(selectedConversation.id);
        await loadUnreadCount();
      };
      loadAndMark();
      const channel = supabase
        .channel(`messages-${selectedConversation.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`
          },
          async () => {
            await loadMessages(selectedConversation.id);
            await markConversationAsRead(selectedConversation.id);
            await loadUnreadCount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadUnreadCount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Friend conversations where I'm an explicit participant
      const { data: participantConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      const friendConversationIds = (participantConvs || []).map((c: any) => c.conversation_id);

      // Group conversations for groups I'm a member of
      const { data: myGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      const groupIds = (myGroups || []).map((g: any) => g.group_id);

      let groupConversationIds: string[] = [];
      if (groupIds.length > 0) {
        const { data: groupConversations } = await supabase
          .from('conversations')
          .select('id')
          .eq('type', 'group')
          .in('group_id', groupIds);
        groupConversationIds = (groupConversations || []).map((c: any) => c.id);
      }

      const conversationIds = [...friendConversationIds, ...groupConversationIds];

      if (conversationIds.length === 0) {
        setTotalUnreadCount(0);
        return;
      }

      // Count unread messages not sent by me
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .eq('is_read', false)
        .neq('sender_id', user.id);

      setTotalUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };


  const loadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Get friend conversations
      const { data: friendConvs } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations!inner(id, type, updated_at)
        `)
        .eq('user_id', user.id)
        .eq('conversations.type', 'friend');

      const friendConversations = await Promise.all(
        (friendConvs || []).map(async (conv: any) => {
          // Get other participant
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conv.conversation_id)
            .neq('user_id', user.id);

          const otherUserId = participants?.[0]?.user_id;
          let otherUserProfile = null;
          
          if (otherUserId) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, username, email')
              .eq('id', otherUserId)
              .single();
            otherUserProfile = profile;
          }

          const otherUser = {
            user_id: otherUserId,
            profiles: otherUserProfile
          };
          
          // Get last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.conversation_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count for this conversation
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.conversation_id)
            .eq('is_read', false)
            .neq('sender_id', user.id);

          return {
            id: conv.conversation_id,
            type: 'friend' as const,
            name: otherUserProfile?.display_name || otherUserProfile?.username || (otherUserProfile?.email ? otherUserProfile.email.split('@')[0] : 'Unknown'),
            other_user_id: otherUser?.user_id,
            last_message: lastMsg?.content,
            last_message_time: lastMsg?.created_at,
            updated_at: conv.conversations.updated_at,
            unread_count: unreadCount || 0
          };
        })
      );

      // Get group conversations
      const { data: groupConvs } = await supabase
        .from('conversations')
        .select(`
          id,
          type,
          updated_at,
          groups!inner(id, name)
        `)
        .eq('type', 'group')
        .not('group_id', 'is', null);

      const groupConversations = await Promise.all(
        (groupConvs || []).map(async (conv: any) => {
          // Check if user is member
          const { data: membership } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', conv.groups.id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!membership) return null;

          // Get last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get unread count for this conversation
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);

          return {
            id: conv.id,
            type: 'group' as const,
            name: conv.groups.name,
            group_id: conv.groups.id,
            last_message: lastMsg?.content,
            last_message_time: lastMsg?.created_at,
            updated_at: conv.updated_at,
            unread_count: unreadCount || 0
          };
        })
      );

      const allConversations = [
        ...friendConversations,
        ...groupConversations.filter(c => c !== null)
      ].sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      setConversations(allConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at, is_read')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set(data.map((msg: any) => msg.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', senderIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const formattedMessages = data.map((msg: any) => {
        const profile = profilesMap.get(msg.sender_id);
        return {
          id: msg.id,
          sender_id: msg.sender_id,
          sender_name: profile?.display_name || profile?.username || 'Unknown',
          content: msg.content,
          created_at: msg.created_at,
          is_read: msg.is_read
        };
      });

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          content: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage("");
      await loadMessages(selectedConversation.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getOrCreateConversation = async (friendId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Check if conversation exists
      const { data: existing } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (existing) {
        for (const conv of existing) {
          const { data: otherParticipant } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conv.conversation_id)
            .eq('user_id', friendId)
            .maybeSingle();

          if (otherParticipant) {
            return conv.conversation_id;
          }
        }
      }

      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({ type: 'friend' })
        .select()
        .single();

      if (convError) throw convError;

      // Add participants
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: newConv.id, user_id: user.id },
          { conversation_id: newConv.id, user_id: friendId }
        ]);

      if (partError) throw partError;

      return newConv.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 relative">
            <MessageCircle size={18} />
            {totalUnreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
              >
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-6 pb-4">
          <div className="flex items-center gap-2">
            {selectedConversation && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedConversation(null)}
              >
                <ArrowLeft size={18} />
              </Button>
            )}
            <SheetTitle>
              {selectedConversation ? selectedConversation.name : 'Messages'}
            </SheetTitle>
          </div>
        </SheetHeader>

        {!selectedConversation ? (
          <div className="px-6 pb-6 space-y-2 max-h-[calc(100vh-8rem)] overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No conversations yet</p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {conv.type === 'group' ? <Users size={18} /> : conv.name[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium truncate">{conv.name}</h4>
                        {conv.last_message_time && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conv.last_message_time), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      {conv.last_message && (
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {conv.last_message}
                        </p>
                      )}
                    </div>
                    {conv.unread_count > 0 && (
                      <Badge variant="destructive" className="ml-auto">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex-1 overflow-y-auto px-6 space-y-4">
              {messages.map((msg) => {
                return (
                  <MessageBubble key={msg.id} message={msg} />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  disabled={loading}
                />
                <Button onClick={sendMessage} disabled={loading || !newMessage.trim()}>
                  <Send size={18} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};