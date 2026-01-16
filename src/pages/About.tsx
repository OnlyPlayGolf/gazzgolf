import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ExternalLink, Heart, Code, Shield, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";

const About = () => {
  const navigate = useNavigate();
  const appVersion = "1.0.0";

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
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
            <h1 className="text-xl font-bold text-foreground">About</h1>
          </div>
        </div>

        <div className="space-y-4">
          {/* App Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary-foreground">GG</span>
                </div>
                <h2 className="text-2xl font-bold text-foreground">Gazz Golf</h2>
                <p className="text-muted-foreground">Version {appVersion}</p>
              </div>
              
              <p className="text-center text-muted-foreground mb-6">
                Your complete golf training companion. Track rounds, improve your game with structured drills, compete with friends, and analyze your performance with advanced statistics.
              </p>

              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm">
                  <Heart className="h-4 w-4 mr-2" />
                  Rate Us
                </Button>
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What We Offer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded bg-primary text-primary-foreground">
                  <Code className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Structured Practice</p>
                  <p className="text-sm text-muted-foreground">400+ levels across putting, chipping, driving, and approach shots</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded bg-primary text-primary-foreground">
                  <Code className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Game Formats</p>
                  <p className="text-sm text-muted-foreground">Stroke Play, Match Play, Best Ball (Match or Stroke), Scramble, Umbriago, Wolf, and more</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded bg-primary text-primary-foreground">
                  <Code className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Advanced Analytics</p>
                  <p className="text-sm text-muted-foreground">Strokes Gained statistics and detailed performance tracking</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Legal */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="ghost" 
                className="w-full justify-start h-auto py-3"
                onClick={() => window.open('/terms', '_blank')}
              >
                <FileText className="h-4 w-4 mr-3 text-muted-foreground" />
                <span>Terms of Service</span>
                <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
              </Button>
              <Separator />
              <Button 
                variant="ghost" 
                className="w-full justify-start h-auto py-3"
                onClick={() => window.open('/privacy', '_blank')}
              >
                <Shield className="h-4 w-4 mr-3 text-muted-foreground" />
                <span>Privacy Policy</span>
                <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>

          {/* Credits */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-sm text-muted-foreground">
                Made with <Heart className="h-3 w-3 inline text-destructive" /> for golfers everywhere
              </p>
              <p className="text-center text-xs text-muted-foreground mt-2">
                © 2024 Gazz Golf. All rights reserved.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default About;
