import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  id: string;
  username: string | null;
  display_name: string | null;
  country: string | null;
  groups: string[];
}

interface AddFriendDialogProps {
  trigger?: React.ReactNode;
  onFriendAdded?: () => void;
}

export const AddFriendDialog = ({ trigger, onFriendAdded }: AddFriendDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const handleSearchFriends = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !friendSearch.trim()) return;

    setLoading(true);
    try {
      // Search by username or display_name
      const { data: users } = await supabase
        .from('profiles')
        .select('id, username, display_name, country')
        .or(`username.ilike.%${friendSearch.trim()}%,display_name.ilike.%${friendSearch.trim()}%`)
        .neq('id', user.id)
        .limit(10);

      if (!users || users.length === 0) {
        toast({
          title: "No users found",
          description: "No users match your search.",
        });
        setSearchResults([]);
        return;
      }

      // Get group memberships for each user
      const usersWithGroups = await Promise.all(
        users.map(async (u: any) => {
          const { data: groupData } = await supabase
            .from('group_members')
            .select('groups(name)')
            .eq('user_id', u.id);

          return {
            ...u,
            groups: groupData?.map((g: any) => g.groups.name) || []
          };
        })
      );

      setSearchResults(usersWithGroups);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to search users.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (targetUserId: string, targetUsername: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Check if friendship already exists
      const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(requester.eq.${user.id},addressee.eq.${targetUserId}),and(requester.eq.${targetUserId},addressee.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        toast({
          title: "Request already exists",
          description: existing.status === 'accepted' ? "You are already friends." : "Friend request already sent.",
          variant: "destructive",
        });
        return;
      }

      // Send friend request
      const { error } = await supabase
        .from('friendships')
        .insert({
          requester: user.id,
          addressee: targetUserId,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: "Friend request sent",
        description: `Friend request sent to ${targetUsername}`,
      });

      setSearchResults([]);
      setFriendSearch("");
      setOpen(false);
      onFriendAdded?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send friend request.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
            <UserPlus size={18} />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by username..."
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchFriends()}
            />
            <Button onClick={handleSearchFriends} disabled={loading}>
              <Search size={18} />
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {result.display_name || result.username || 'Unknown'}
                  </p>
                  {result.username && (
                    <p className="text-sm text-muted-foreground">@{result.username}</p>
                  )}
                  {result.country && (
                    <p className="text-xs text-muted-foreground">{result.country}</p>
                  )}
                  {result.groups.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Groups: {result.groups.join(', ')}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSendFriendRequest(result.id, result.username || result.display_name || 'this user')}
                >
                  <UserPlus size={16} className="mr-1" />
                  Add
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};