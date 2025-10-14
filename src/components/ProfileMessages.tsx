import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Send, ArrowLeft, Users } from "lucide-react";
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

type FilterType = 'all' | 'groups' | 'friends';

export const ProfileMessages = () => {
  const { toast } = useToast();
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  useEffect(() => {
    loadConversations();
  }, []);

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

    setFilteredConversations(filtered);
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
        .eq('user_id', user.id);

      const friendConversations = await Promise.all(
        (friendConvs || []).map(async (conv: any) => {
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
              .select('display_name, username')
              .eq('id', otherUserId)
              .single();
            otherUserProfile = profile;
          }

          const otherUser = {
            user_id: otherUserId,
            profiles: otherUserProfile
          };
          
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.conversation_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: conv.conversation_id,
            type: 'friend' as const,
            name: otherUser?.profiles?.display_name || otherUser?.profiles?.username || 'Unknown',
            other_user_id: otherUser?.user_id,
            last_message: lastMsg?.content,
            last_message_time: lastMsg?.created_at,
            updated_at: conv.conversations.updated_at,
            unread_count: 0
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
          const { data: membership } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', conv.groups.id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (!membership) return null;

          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: conv.id,
            type: 'group' as const,
            name: conv.groups.name,
            group_id: conv.groups.id,
            last_message: lastMsg?.content,
            last_message_time: lastMsg?.created_at,
            updated_at: conv.updated_at,
            unread_count: 0
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
