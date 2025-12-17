import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Send, MessageSquare, Bug, Lightbulb, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Feedback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { id: 'general', label: 'General Feedback', icon: MessageSquare, description: 'Share your thoughts' },
    { id: 'bug', label: 'Bug Report', icon: Bug, description: 'Something not working?' },
    { id: 'idea', label: 'Feature Request', icon: Lightbulb, description: 'Suggest improvements' },
    { id: 'question', label: 'Question', icon: HelpCircle, description: 'Need clarification?' },
  ];

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter your feedback before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    // Simulate submission (replace with actual API call)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Feedback sent!",
      description: "Thank you for helping us improve. We'll review your feedback soon.",
    });
    
    setMessage("");
    setCategory("general");
    setIsSubmitting(false);
  };

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
            <div>
              <h1 className="text-xl font-bold text-foreground">Feedback</h1>
              <p className="text-sm text-muted-foreground">We'd love to hear from you</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Welcome Message */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm text-foreground">
                Your feedback helps us build a better app. Whether it's a bug, a feature idea, or just general thoughts — we're listening.
              </p>
            </CardContent>
          </Card>

          {/* Category Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What's this about?</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={category} onValueChange={setCategory} className="grid grid-cols-2 gap-3">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <div key={cat.id}>
                      <RadioGroupItem 
                        value={cat.id} 
                        id={cat.id} 
                        className="peer sr-only" 
                      />
                      <Label
                        htmlFor={cat.id}
                        className="flex flex-col items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                      >
                        <Icon className="h-5 w-5 mb-2 text-primary" />
                        <span className="text-sm font-medium">{cat.label}</span>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Message Input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Message</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Tell us what's on your mind..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[150px] resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {message.length}/1000 characters
              </p>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button 
            onClick={handleSubmit} 
            className="w-full"
            disabled={isSubmitting || !message.trim()}
          >
            {isSubmitting ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Feedback
              </>
            )}
          </Button>

          {/* Alternative Contact */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-center text-muted-foreground">
                Prefer email? Reach us at{" "}
                <a 
                  href="mailto:feedback@gazzgolf.com" 
                  className="text-primary hover:underline"
                >
                  feedback@gazzgolf.com
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Feedback;
