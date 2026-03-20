import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, Lock, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { z } from 'zod';
import { getPublicAppUrl } from "@/utils/publicAppUrl";
import { getFriendlyAuthErrorMessage } from "@/utils/authErrorMessages";

const baseAuthSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255, { message: "Email must be less than 255 characters" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100, { message: "Password must be less than 100 characters" }),
});

const signUpSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255, { message: "Email must be less than 255 characters" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100, { message: "Password must be less than 100 characters" }),
  confirmPassword: z.string(),
  firstName: z.string().trim().min(1, { message: "First name is required" }).max(50, { message: "First name must be less than 50 characters" }),
  lastName: z.string().trim().min(1, { message: "Last name is required" }).max(50, { message: "Last name must be less than 50 characters" }),
  country: z.string().trim().min(1, { message: "Country is required" }).max(80, { message: "Country must be less than 80 characters" }),
  homeClub: z.string().trim().min(1, { message: "Home club is required" }).max(120, { message: "Home club must be less than 120 characters" }),
  handicap: z.string().trim().min(1, { message: "Handicap is required" }).max(20, { message: "Handicap must be less than 20 characters" })
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Check if we should start on signup view from navigation state
  const initialView = (location.state as { view?: string } | null)?.view === 'signup' ? 'signup' : 'signin';
  const [view, setView] = useState<'signin' | 'signup' | 'forgot' | 'confirmation' | 'reset'>(initialView);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState('');
  const [homeClub, setHomeClub] = useState('');
  const [handicap, setHandicap] = useState('');

  // If we arrived via invite link, persist invite code so post-auth can resume.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const invite = params.get('invite');
    const nextView = params.get('view');

    if (invite) {
      localStorage.setItem('pending_invite_code', invite);
    }

    if (nextView === 'signup' || nextView === 'signin') {
      setView(nextView);
    }
  }, [location.search]);

  useEffect(() => {
    setFormError(null);
  }, [view]);

  useEffect(() => {
    let isMounted = true;
    let hasHandledInitialSession = false;
    let isPasswordRecovery = false;

    // Check URL hash for recovery token before setting up listeners
    // This prevents the race condition where getSession redirects before PASSWORD_RECOVERY fires
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('type=magiclink'))) {
      isPasswordRecovery = true;
    }

    const handleSession = (session: Session | null, source: string) => {
      if (!isMounted) return;

      // Prevent duplicate handling
      if (source === 'getSession' && hasHandledInitialSession) return;
      if (source === 'getSession') hasHandledInitialSession = true;

      // Don't redirect away if we're waiting for PASSWORD_RECOVERY event
      if (isPasswordRecovery && source === 'getSession') {
        setSession(session);
        setUser(session?.user ?? null);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      const isConfirmed = Boolean(session?.user?.email_confirmed_at);
      const currentEmail = session?.user?.email ?? "";

      // If the user exists but isn't confirmed yet, keep them signed in but show the confirmation screen
      if (session?.user && !isConfirmed) {
        if (currentEmail) setPendingConfirmationEmail(currentEmail);
        setView('confirmation');
        return;
      }

      // If confirmed, redirect into the app
      if (session?.user && isConfirmed) {
        const pendingInviteCode = localStorage.getItem('pending_invite_code');
        if (pendingInviteCode) {
          localStorage.removeItem('pending_invite_code');
          navigate(`/invite/${pendingInviteCode}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Mark that we've handled a session from the listener
        hasHandledInitialSession = true;

        // Intercept password recovery — show the reset form instead of redirecting
        if (event === 'PASSWORD_RECOVERY') {
          isPasswordRecovery = false; // Handled now
          if (!isMounted) return;
          setSession(session);
          setUser(session?.user ?? null);
          setView('reset');
          return;
        }

        handleSession(session, 'onAuthStateChange');
      }
    );

    // THEN check for existing session (only if listener hasn't fired yet)
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session, 'getSession');
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setFormError(null);
      const validatedData = baseAuthSchema.parse({ email, password });
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) {
        const friendly = getFriendlyAuthErrorMessage(error, "signIn");
        setFormError(friendly);
        toast({
          title: "Sign in failed",
          description: friendly,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const friendly = error.errors[0]?.message || "Something went wrong. Please try again.";
        setFormError(friendly);
        toast({
          title: "Validation Error",
          description: friendly,
          variant: "destructive",
        });
      } else {
        const friendly = getFriendlyAuthErrorMessage(error, "signIn");
        setFormError(friendly);
        toast({
          title: "Error",
          description: friendly,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = signUpSchema.parse({
        email,
        password,
        confirmPassword,
        firstName,
        lastName,
        country,
        homeClub,
        handicap,
      });
      setLoading(true);

      const pendingInviteCode = localStorage.getItem('pending_invite_code');
      const redirectUrl = pendingInviteCode
        ? `${getPublicAppUrl()}/auth?invite=${encodeURIComponent(pendingInviteCode)}`
        : `${getPublicAppUrl()}/auth`;
      const displayName = `${validatedData.firstName} ${validatedData.lastName}`;
      
      const { data, error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName,
            first_name: validatedData.firstName,
            last_name: validatedData.lastName,
            country: validatedData.country,
            home_club: validatedData.homeClub,
            handicap: validatedData.handicap,
          }
        }
      });

      if (error) {
        console.error("[auth.signUp] failed", {
          message: error.message,
          name: (error as any)?.name,
          status: (error as any)?.status,
          code: (error as any)?.code,
          redirectUrl,
        });
        if (error.message.includes('User already registered')) {
          toast({
            title: "Account Exists",
            description: "An account with this email already exists. Please sign in instead.",
            variant: "destructive",
          });
          setView('signin');
        } else {
          toast({
            title: "Sign Up Failed",
            description: error.message,
            variant: "destructive", 
          });
        }
        return;
      }

      // Directly upsert profile fields so they persist even if the DB trigger
      // is an older version that only copies display_name and email.
      if (data.user) {
        const profilePayload = {
          id: data.user.id,
          email: validatedData.email,
          display_name: displayName,
          country: validatedData.country,
          home_club: validatedData.homeClub,
          handicap: validatedData.handicap,
        };
        // Use the session from signUp if available (autoconfirm), otherwise
        // syncOwnProfileFromAuth will handle it when the session is established.
        supabase
          .from('profiles')
          .upsert(profilePayload, { onConflict: 'id' })
          .then(({ error: upsertError }) => {
            if (upsertError) {
              console.warn('[auth.signUp] profile upsert fallback failed:', upsertError.message);
            }
          });
      }

      // Store the email for confirmation screen
      setPendingConfirmationEmail(validatedData.email);

      // Clear form
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');
      setCountry('');
      setHomeClub('');
      setHandicap('');
      
      // Show confirmation screen instead of redirecting to signin
      setView('confirmation');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setFormError(null);
      const validatedData = baseAuthSchema.pick({ email: true }).parse({ email });
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(validatedData.email, {
        redirectTo: `${getPublicAppUrl()}/auth/callback`,
      });

      if (error) {
        console.error("[auth.resetPasswordForEmail] failed", {
          message: error.message,
          name: (error as any)?.name,
          status: (error as any)?.status,
          code: (error as any)?.code,
          redirectTo: `${getPublicAppUrl()}/auth`,
        });
        const friendly = getFriendlyAuthErrorMessage(error, "resetPassword");
        setFormError(friendly);
        toast({
          title: "Error",
          description: friendly,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Email Sent!",
        description: "Check your email for a password reset link.",
      });
      
      setView('signin');
    } catch (error) {
      if (error instanceof z.ZodError) {
        const friendly = error.errors[0]?.message || "Something went wrong. Please try again.";
        setFormError(friendly);
        toast({
          title: "Validation Error",
          description: friendly,
          variant: "destructive",
        });
      } else {
        const friendly = getFriendlyAuthErrorMessage(error, "resetPassword");
        setFormError(friendly);
        toast({
          title: "Error",
          description: friendly,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">
              {view === 'reset' ? 'Reset Password' : 'Welcome to OnlyPlay Golf'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {view === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                {formError && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {formError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button 
                  type="button"
                  variant="link"
                  className="w-full text-sm text-primary p-0 h-auto"
                  onClick={() => setView('forgot')}
                >
                  Forgot Password?
                </Button>
                
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={loading}
                >
                  {loading ? "Logging In..." : "Log In"}
                </Button>

                <Button 
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setView('signup')}
                >
                  Create New Account
                </Button>
              </form>
            )}

            {view === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                {formError && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {formError}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signup-firstname">First Name</Label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="signup-firstname"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-lastname">Last Name</Label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="signup-lastname"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-country">Country</Label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="signup-country"
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Enter your country"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-homeclub">Home Club</Label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="signup-homeclub"
                      type="text"
                      value={homeClub}
                      onChange={(e) => setHomeClub(e.target.value)}
                      placeholder="Enter your home club"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-handicap">Handicap</Label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="signup-handicap"
                      type="text"
                      value={handicap}
                      onChange={(e) => setHandicap(e.target.value)}
                      placeholder="e.g. 12.4 or +2.4"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password (min 6 characters)"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={loading}
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>

                <Button 
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setView('signin');
                    setEmail('');
                    setPassword('');
                    setConfirmPassword('');
                    setFirstName('');
                    setLastName('');
                    setCountry('');
                    setHomeClub('');
                    setHandicap('');
                  }}
                >
                  Back to Log In
                </Button>
              </form>
            )}

            {view === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {formError && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {formError}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email</Label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>

                <Button 
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setView('signin');
                    setEmail('');
                  }}
                >
                  Back to Log In
                </Button>
              </form>
            )}

            {view === 'reset' && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setFormError(null);
                if (newPassword.length < 6) {
                  setFormError("Password must be at least 6 characters");
                  return;
                }
                if (newPassword !== confirmNewPassword) {
                  setFormError("Passwords don't match");
                  return;
                }
                setLoading(true);
                try {
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  if (error) {
                    setFormError(error.message);
                  } else {
                    toast({
                      title: "Password updated",
                      description: "Your password has been reset successfully.",
                    });
                    setNewPassword('');
                    setConfirmNewPassword('');
                    navigate('/', { replace: true });
                  }
                } catch (err: any) {
                  setFormError(err.message || "Something went wrong");
                } finally {
                  setLoading(false);
                }
              }} className="space-y-4">
                {formError && (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    {formError}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Enter your new password below.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      id="confirm-new-password"
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={loading}
                >
                  {loading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            )}

            {view === 'confirmation' && (
              <div className="space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                    <Mail size={32} className="text-primary" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Check Your Email</h3>
                  <p className="text-muted-foreground">
                    We've sent a confirmation link to:
                  </p>
                  <p className="font-medium text-primary">{pendingConfirmationEmail}</p>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  Please click the link in the email to confirm your account. You won't be able to sign in until your email is confirmed.
                </p>
                
                <div className="pt-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Didn't receive the email? Check your spam folder or try signing up again.
                  </p>
                  
                  <Button 
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setView('signin');
                      setEmail('');
                      setPendingConfirmationEmail('');
                    }}
                  >
                    Back to Log In
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;