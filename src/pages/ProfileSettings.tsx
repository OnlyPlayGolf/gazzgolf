import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from '@supabase/supabase-js';

const ProfileSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    country: '',
    handicap: '',
    homeClub: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setSession(session);
          setUser(session.user);
          return;
        }
        if (event === "SIGNED_OUT") {
          setSession(null);
          setUser(null);
          navigate("/auth");
          return;
        }
        const { data: { session: current } } = await supabase.auth.getSession();
        setSession(current);
        setUser(current?.user ?? null);
        if (!current?.user) navigate("/auth");
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setProfile(profileData);
      
      const nameParts = (profileData?.display_name || '').split(' ');
      setFormData({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        country: profileData?.country || '',
        handicap: profileData?.handicap || '',
        homeClub: profileData?.home_club || ''
      });
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const displayName = `${formData.firstName} ${formData.lastName}`.trim();
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          display_name: displayName,
          country: formData.country,
          handicap: formData.handicap,
          home_club: formData.homeClub
        })
        .eq('id', user.id);

      if (error) throw error;
      
      await loadUserData();
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      navigate('/profile');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/avatar.${fileExt}`;

    setUploadingAvatar(true);
    try {
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await loadUserData();

      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload avatar.",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/menu")}
              className="rounded-full flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Personal Information</h1>
          </div>
        </div>

        {/* Avatar Section */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center">
              <label htmlFor="avatar-upload" className="relative mb-4 cursor-pointer group">
                <Avatar className="h-24 w-24">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                      {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : 
                       profile?.email ? profile.email.charAt(0).toUpperCase() : "?"}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="absolute bottom-0 right-0 p-2 bg-primary rounded-full group-hover:bg-primary/90 transition-colors">
                  <Camera size={14} className="text-primary-foreground" />
                </div>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
              </label>
              <p className="text-sm text-muted-foreground">
                {uploadingAvatar ? "Uploading..." : "Tap to change photo"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Form Fields */}
        <Card className="mb-4">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first-name" className="text-sm font-medium">First Name</Label>
                <Input
                  id="first-name"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="last-name" className="text-sm font-medium">Last Name</Label>
                <Input
                  id="last-name"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name"
                  className="mt-1.5"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                value={user?.email || ""}
                disabled
                className="mt-1.5 bg-muted/50"
              />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>
          </CardContent>
        </Card>

        {/* Golf Details */}
        <Card className="mb-4">
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-foreground mb-2">Golf Details</h3>
            
            <div>
              <Label htmlFor="handicap" className="text-sm font-medium">Handicap</Label>
              <Input
                id="handicap"
                value={formData.handicap}
                onChange={(e) => setFormData(prev => ({ ...prev, handicap: e.target.value }))}
                placeholder="e.g. 12.4 or +2.4"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">Use + for plus handicaps (e.g. +2.4)</p>
            </div>
            
            <div>
              <Label htmlFor="home-club" className="text-sm font-medium">Home Club</Label>
              <Input
                id="home-club"
                value={formData.homeClub}
                onChange={(e) => setFormData(prev => ({ ...prev, homeClub: e.target.value }))}
                placeholder="Your golf club"
                className="mt-1.5"
              />
            </div>
            
            <div>
              <Label htmlFor="country" className="text-sm font-medium">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                placeholder="Your country"
                className="mt-1.5"
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button 
          onClick={handleSaveProfile} 
          disabled={isSaving}
          className="w-full"
          size="lg"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default ProfileSettings;
