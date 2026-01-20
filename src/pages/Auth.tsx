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

const baseAuthSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255, { message: "Email must be less than 255 characters" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100, { message: "Password must be less than 100 characters" }),
});

const signUpSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255, { message: "Email must be less than 255 characters" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).max(100, { message: "Password must be less than 100 characters" }),
  confirmPassword: z.string(),
  firstName: z.string().trim().min(1, { message: "First name is required" }).max(50, { message: "First name must be less than 50 characters" }),
  lastName: z.string().trim().min(1, { message: "Last name is required" }).max(50, { message: "Last name must be less than 50 characters" })
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
  const [view, setView] = useState<'signin' | 'signup' | 'forgot' | 'confirmation'>(initialView);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState('');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    let isMounted = true;
    let hasHandledInitialSession = false;

    const handleSession = (session: Session | null, source: string) => {
      if (!isMounted) return;
      
      // Prevent duplicate handling
      if (source === 'getSession' && hasHandledInitialSession) return;
      if (source === 'getSession') hasHandledInitialSession = true;
      
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
      const validatedData = baseAuthSchema.parse({ email, password });
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: "Sign In Failed",
            description: "Invalid email or password. Please check your credentials and try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sign In Failed", 
            description: error.message,
            variant: "destructive",
          });
        }
        return;
      }

      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = signUpSchema.parse({ email, password, confirmPassword, firstName, lastName });
      setLoading(true);

      const redirectUrl = `${window.location.origin}/`;
      const displayName = `${validatedData.firstName} ${validatedData.lastName}`;
      
      const { error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName,
            first_name: validatedData.firstName,
            last_name: validatedData.lastName
          }
        }
      });

      if (error) {
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

      // Store the email for confirmation screen
      setPendingConfirmationEmail(validatedData.email);
      
      // Clear form
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');
      
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
      const validatedData = baseAuthSchema.pick({ email: true }).parse({ email });
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(validatedData.email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl">Welcome to OnlyPlay Golf</CardTitle>
          </CardHeader>
          <CardContent>
            {view === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
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
                  }}
                >
                  Back to Log In
                </Button>
              </form>
            )}

            {view === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
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