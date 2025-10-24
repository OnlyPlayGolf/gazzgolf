import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Send, ArrowLeft, Users, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useSearchParams } from "react-router-dom";

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

type FilterType = 'all' | 'groups' | 'friends';

export const ProfileMessages = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
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
    loadConversations();

    // Subscribe to all message changes to update conversation list in real-time
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
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-select conversation from URL parameter
  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === conversationId);
      if (conversation) {
        setSelectedConversation(conversation);
      }
    }
  }, [searchParams, conversations]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
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
          () => {
            loadMessages(selectedConversation.id);
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

  useEffect(() => {
    filterConversations();
  }, [conversations, searchQuery, filter]);

  const filterConversations = () => {
    let filtered = conversations;

    // Apply type filter
    if (filter === 'friends') {
      filtered = filtered.filter(c => c.type === 'friend');
    } else if (filter === 'groups') {
      filtered = filtered.filter(c => c.type === 'group');
    }

    // Apply search filter
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

  // Load friends and groups when opening the New Message dialog
  useEffect(() => {
    if (createOpen) {
      loadFriendsAndGroups();
    }
  }, [createOpen]);

  const loadFriendsAndGroups = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Friends
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

    // Groups
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

  const loadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { data, error } = await (supabase as any).rpc('conversations_overview');
      if (error) throw error;

      const mapped: Conversation[] = (data || []).map((row: any) => ({
        id: row.id,
        type: row.type === 'group' ? 'group' : 'friend',
        name: row.name || 'Unknown',
        group_id: row.group_id || undefined,
        other_user_id: row.other_user_id || undefined,
        last_message: row.last_message || undefined,
        last_message_time: row.last_message_time || undefined,
        updated_at: row.updated_at,
        unread_count: 0,
      }));

      setConversations(mapped);
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

      if (!data || data.length === 0) {
        setMessages([]);
        return;
      }

      const senderIds = [...new Set(data.map((msg: any) => msg.sender_id))];
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', senderIds);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
      }

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const formattedMessages = data.map((msg: any) => {
        const profile = profilesMap.get(msg.sender_id);
        const senderName = profile?.display_name || profile?.username || 'Unknown User';
        return {
          id: msg.id,
          sender_id: msg.sender_id,
          sender_name: senderName,
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

  if (selectedConversation) {
    return (
      <div className="flex flex-col h-[calc(100vh-16rem)]">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedConversation(null)}
          >
            <ArrowLeft size={18} />
          </Button>
          <h2 className="text-xl font-bold">{selectedConversation.name}</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-4 border rounded-lg p-4 bg-muted/30">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} currentUserId={currentUserId} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="flex gap-2 mt-4">
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
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-center">Messages</h2>
      
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
                    className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors"
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
                    className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors"
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

      <div className="space-y-2">
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
                <Avatar>
                  <AvatarFallback>
                    {conv.type === 'group' ? <Users size={18} /> : conv.name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
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
  );
};
