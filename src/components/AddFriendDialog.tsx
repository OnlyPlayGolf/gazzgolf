import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Search, QrCode, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "react-qr-code";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  id: string;
  username: string | null;
  display_name: string | null;
  country: string | null;
  groups: string[];
  isFriend: boolean;
}

interface AddFriendDialogProps {
  trigger?: React.ReactNode;
  onFriendAdded?: () => void;
}

export const AddFriendDialog = ({ trigger, onFriendAdded }: AddFriendDialogProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [activeTab, setActiveTab] = useState("search");

  useEffect(() => {
    if (open) {
      loadCurrentUser();
    }
  }, [open]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const handleQrScan = (result: string) => {
    try {
      // Extract user ID from QR code URL
      const url = new URL(result);
      const pathParts = url.pathname.split('/');
      const userId = pathParts[pathParts.length - 1];
      
      if (userId && userId !== currentUserId) {
        setOpen(false);
        navigate(`/add-friend/${userId}`);
      } else if (userId === currentUserId) {
        toast({
          title: "Invalid QR Code",
          description: "You cannot add yourself as a friend!",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Invalid QR Code",
        description: "This QR code is not a valid friend code.",
        variant: "destructive",
      });
    }
  };

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

      // Get group memberships and friendship status for each user
      const usersWithGroupsAndFriendship = await Promise.all(
        users.map(async (u: any) => {
          const { data: groupData } = await supabase
            .from('group_members')
            .select('groups(name)')
            .eq('user_id', u.id);

          // Check if already friends
          const { data: friendshipData } = await supabase
            .from('friendships')
            .select('id, status')
            .or(`and(requester.eq.${user.id},addressee.eq.${u.id}),and(requester.eq.${u.id},addressee.eq.${user.id})`)
            .maybeSingle();

          return {
            ...u,
            groups: groupData?.map((g: any) => g.groups.name) || [],
            isFriend: friendshipData?.status === 'accepted'
          };
        })
      );

      setSearchResults(usersWithGroupsAndFriendship);
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
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">
              <Search size={16} className="mr-2" />
              Search
            </TabsTrigger>
            <TabsTrigger value="scan">
              <Camera size={16} className="mr-2" />
              Scan QR
            </TabsTrigger>
            <TabsTrigger value="myqr">
              <QrCode size={16} className="mr-2" />
              My QR
            </TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-4">
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
                  {result.isFriend ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled
                    >
                      Friends
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleSendFriendRequest(result.id, result.username || result.display_name || 'this user')}
                    >
                      <UserPlus size={16} className="mr-1" />
                      Add
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Scan QR Tab */}
          <TabsContent value="scan" className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Position the QR code within the camera frame to scan
              </p>
              <div className="w-full aspect-square max-w-sm rounded-lg overflow-hidden border-2 border-primary">
                <Scanner
                  onScan={(result) => {
                    if (result && result[0]) {
                      handleQrScan(result[0].rawValue);
                    }
                  }}
                  onError={(error) => console.error(error)}
                />
              </div>
            </div>
          </TabsContent>

          {/* My QR Tab */}
          <TabsContent value="myqr" className="space-y-4">
            <div className="flex flex-col items-center space-y-4 py-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCode 
                  value={`${window.location.origin}/add-friend/${currentUserId}`}
                  size={200}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Share this QR code with friends to let them add you instantly!
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};