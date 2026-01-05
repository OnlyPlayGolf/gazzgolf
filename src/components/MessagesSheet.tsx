import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, ArrowLeft, Users, Search, Plus } from "lucide-react";
import { ProfilePhoto } from "@/components/ProfilePhoto";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

const MessageBubble = ({ message, currentUserId }: { message: Message; currentUserId: string | null }) => {
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

type FilterType = 'all' | 'groups' | 'friends';

export const MessagesSheet = ({ trigger }: MessagesSheetProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New message dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [friends, setFriends] = useState<{ id: string; display_name: string | null; username: string | null; }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [createSearch, setCreateSearch] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (open) {
      loadConversations();
    }
  }, [open]);

  useEffect(() => {
    filterConversations();
  }, [conversations, searchQuery, filter]);

  useEffect(() => {
    if (createOpen) {
      loadFriendsAndGroups();
    }
  }, [createOpen]);

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

  const filterConversations = () => {
    let filtered = conversations;

    if (filter === 'friends') {
      filtered = filtered.filter(c => c.type === 'friend');
    } else if (filter === 'groups') {
      filtered = filtered.filter(c => c.type === 'group');
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by most recent message
    filtered = filtered.sort((a, b) => {
      const timeA = a.last_message_time || a.updated_at;
      const timeB = b.last_message_time || b.updated_at;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });

    setFilteredConversations(filtered);
  };

  const loadFriendsAndGroups = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: friendsPairs } = await supabase
      .from('friends_pairs')
      .select('a, b')
      .or(`a.eq.${user.id},b.eq.${user.id}`);

    const friendIds = (friendsPairs || []).map((pair: any) =>
      pair.a === user.id ? pair.b : pair.a
    );

    if (friendIds.length > 0) {
      const { data: friendProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', friendIds);
      setFriends(friendProfiles || []);
    } else {
      setFriends([]);
    }

    const { data: myGroups } = await supabase
      .from('group_members')
      .select('groups!inner(id, name)')
      .eq('user_id', user.id);

    setGroups((myGroups || []).map((g: any) => ({ id: g.groups.id, name: g.groups.name })));
  };

  const handleStartFriendChat = async (friendId: string) => {
    try {
      const { data, error } = await (supabase as any).rpc('ensure_friend_conversation', { friend_id: friendId });
      if (error) throw error;
      const convId = data as string;
      setCreateOpen(false);
      await loadConversations();
      const conv = conversations.find(c => c.id === convId);
      if (conv) setSelectedConversation(conv);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Could not start conversation.', variant: 'destructive' });
    }
  };

  const handleStartGroupChat = async (groupId: string) => {
    try {
      const { data, error } = await (supabase as any).rpc('ensure_group_conversation', { p_group_id: groupId });
      if (error) throw error;
      const convId = data as string;
      setCreateOpen(false);
      await loadConversations();
      const conv = conversations.find(c => c.id === convId);
      if (conv) setSelectedConversation(conv);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Could not start group conversation.', variant: 'destructive' });
    }
  };

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
      const { data: overview, error } = await supabase.rpc('conversations_overview');
      if (error) throw error;

      const baseConversations: Conversation[] = (overview || []).map((c: any) => ({
        id: c.id,
        type: (c.type as 'friend' | 'group'),
        name: c.name || 'Unknown',
        group_id: c.group_id || undefined,
        other_user_id: c.other_user_id || undefined,
        last_message: c.last_message || undefined,
        last_message_time: c.last_message_time || undefined,
        updated_at: c.updated_at,
        unread_count: 0,
      }));

      // Compute unread counts per conversation (messages not sent by me and is_read=false)
      const withUnread = await Promise.all(
        baseConversations.map(async (conv) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);
          return { ...conv, unread_count: count || 0 } as Conversation;
        })
      );

      // Improve names that came as 'Unknown' by falling back to email prefix
      const unknowns = withUnread.filter(c => c.name === 'Unknown' && c.other_user_id);
      if (unknowns.length > 0) {
        const ids = unknowns.map(u => u.other_user_id!)
          .filter((v, i, a) => a.indexOf(v) === i);
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name, username, email')
          .in('id', ids);
        const pMap = new Map((profs || []).map(p => [p.id, p]));
        withUnread.forEach((c) => {
          if (c.name === 'Unknown' && c.other_user_id) {
            const p = pMap.get(c.other_user_id);
            if (p) {
              c.name = p.display_name || p.username || (p.email ? String(p.email).split('@')[0] : 'Unknown');
            }
          }
        });
      }

      // Sort by most recent message
      withUnread.sort((a, b) => {
        const timeA = a.last_message_time || a.updated_at;
        const timeB = b.last_message_time || b.updated_at;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });

      setConversations(withUnread);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const markConversationAsRead = async (conversationId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Mark all messages in this conversation (not sent by me) as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('is_read', false)
        .neq('sender_id', user.id);
    } catch (error) {
      console.error('Error marking messages as read:', error);
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
      await loadConversations();
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
        {!selectedConversation ? (
          <>
            <SheetHeader className="p-6 pb-4 border-b">
              <SheetTitle className="text-2xl text-center">Messages</SheetTitle>
            </SheetHeader>
            
            <div className="p-6 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input
                  placeholder="Search for friends and groups"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                  className="flex-1"
                >
                  All
                </Button>
                <Button
                  variant={filter === 'groups' ? 'default' : 'outline'}
                  onClick={() => setFilter('groups')}
                  className="flex-1"
                >
                  Groups
                </Button>
                <Button
                  variant={filter === 'friends' ? 'default' : 'outline'}
                  onClick={() => setFilter('friends')}
                  className="flex-1"
                >
                  Friends
                </Button>
              </div>

              <div className="flex justify-end">
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="secondary" className="gap-1">
                      <Plus size={16} /> New Message
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Start a new conversation</DialogTitle>
                      <DialogDescription>Choose a friend or group to start chatting.</DialogDescription>
                    </DialogHeader>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                      <Input
                        placeholder="Search friends or groups"
                        value={createSearch}
                        onChange={(e) => setCreateSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Friends</h4>
                        {friends.filter(f => {
                          const q = createSearch.toLowerCase();
                          const name = (f.display_name || f.username || '').toLowerCase();
                          return !q || name.includes(q);
                        }).map(f => (
                          <button
                            key={f.id}
                            onClick={() => handleStartFriendChat(f.id)}
                            className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors mb-2"
                          >
                            {(f.display_name || f.username) || 'Unknown user'}
                          </button>
                        ))}
                        {friends.length === 0 && (
                          <p className="text-sm text-muted-foreground">No friends found.</p>
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-2">Groups</h4>
                        {groups.filter(g => {
                          const q = createSearch.toLowerCase();
                          return !q || g.name.toLowerCase().includes(q);
                        }).map(g => (
                          <button
                            key={g.id}
                            onClick={() => handleStartGroupChat(g.id)}
                            className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors mb-2"
                          >
                            {g.name}
                          </button>
                        ))}
                        {groups.length === 0 && (
                          <p className="text-sm text-muted-foreground">No groups found.</p>
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-24rem)] overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {searchQuery ? 'No conversations found' : 'No conversations yet'}
                  </p>
                ) : (
                  filteredConversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <ProfilePhoto
                          alt={conv.name}
                          fallback={conv.type === 'group' ? conv.name : conv.name}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium truncate">
                              {conv.name}
                              {conv.type === 'group' && <span className="text-muted-foreground text-sm ml-2">(group)</span>}
                            </h4>
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
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="p-6 pb-4 border-b">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft size={18} />
                </Button>
                <SheetTitle className="text-xl">{selectedConversation.name}</SheetTitle>
              </div>
            </SheetHeader>

            <div className="flex flex-col h-[calc(100vh-8rem)]">
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} currentUserId={currentUserId} />
                ))}
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
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};