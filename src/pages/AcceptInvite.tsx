import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const AcceptInvite = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    checkAuthAndAccept();
  }, [code]);

  const checkAuthAndAccept = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    // User is authenticated, try to accept invite
    await acceptInvite();
  };

  const acceptInvite = async () => {
    if (!code) return;

    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc('accept_group_invite', {
        invite_code: code
      });

      if (error) throw error;

      const response = typeof data === 'string' ? JSON.parse(data) : data;

      if (response.success) {
        setResult(response);
        
        toast({
          title: response.already_member ? "Already a member" : "Success!",
          description: response.already_member 
            ? `You're already a member of ${response.group_name}`
            : `You've joined ${response.group_name}`,
        });

        // Navigate to group after a short delay
        setTimeout(() => {
          navigate(`/group/${response.group_id}`);
        }, 1500);
      } else {
        setResult({ success: false, error: response.error });
        toast({
          title: "Cannot join group",
          description: response.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      setResult({ success: false, error: error.message });
      toast({
        title: "Error",
        description: error.message || "Failed to accept invite",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    // Store the invite code in localStorage to resume after login
    localStorage.setItem('pending_invite_code', code || '');
    navigate('/auth');
  };

  if (loading || accepting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">
              {accepting ? "Joining group..." : "Loading..."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <Users size={24} />
              Group Invite
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Sign in to accept this group invitation
            </p>
            <Button onClick={handleSignIn} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              {result.success ? (
                <CheckCircle size={24} className="text-green-500" />
              ) : (
                <XCircle size={24} className="text-red-500" />
              )}
              {result.success ? "Success!" : "Cannot Join"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              {result.success 
                ? result.already_member
                  ? `You're already a member of ${result.group_name}`
                  : `You've successfully joined ${result.group_name}`
                : result.error || "Invalid or expired invite"
              }
            </p>
            {result.success ? (
              <Button onClick={() => navigate(`/group/${result.group_id}`)} className="w-full">
                Go to Group
              </Button>
            ) : (
              <Button onClick={() => navigate('/profile')} variant="outline" className="w-full">
                Back to Profile
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default AcceptInvite;