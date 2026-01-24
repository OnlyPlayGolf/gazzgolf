import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Search, ChevronDown, MessageCircle, Mail, FileText, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Support = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const faqs = [
    {
      id: '1',
      question: 'How do I track my handicap?',
      answer: 'Your handicap is automatically calculated based on your posted rounds. Go to your Profile to see your current handicap. The app uses the World Handicap System (WHS) for calculations.'
    },
    {
      id: '2',
      question: 'How do I add friends?',
      answer: 'You can add friends by searching for their username in the Friends section, scanning their QR code, or sharing your QR code with them. Go to Profile > Friends to get started.'
    },
    {
      id: '3',
      question: 'What are Strokes Gained statistics?',
      answer: 'Strokes Gained measures how many strokes you gain or lose compared to a baseline (typically tour average). It breaks down your performance into categories: Off the Tee, Approach, Short Game, and Putting.'
    },
    {
      id: '4',
      question: 'How do levels work?',
      answer: 'Levels are structured practice challenges across different skill areas. Complete levels to progress and improve specific aspects of your game. There are 400+ levels from First Timer to Pro.'
    },
    {
      id: '5',
      question: 'Can I play with friends who don\'t have the app?',
      answer: 'Yes! You can add guest players to any round. They won\'t have their own profile, but you can track their scores and include them in your games.'
    },
    {
      id: '6',
      question: 'How do I change my default tee color?',
      answer: 'Go to Menu > Settings > App Preferences to set your default tee color. You can also change it for individual rounds during setup.'
    },
    {
      id: '7',
      question: 'What game formats are available?',
      answer: 'We support Stroke Play, Match Play, Best Ball (Match Play or Stroke Play), Scramble, Umbriago, Wolf, and Copenhagen. Each format has its own rules and scoring system.'
    },
    {
      id: '8',
      question: 'How do I delete my account?',
      answer: 'Contact our support team at support@gazzgolf.com to request account deletion. We\'ll process your request within 30 days and remove all your data.'
    },
  ];

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const supportOptions = [
    {
      id: 'email',
      title: 'Email Support',
      description: 'Get help via email within 24 hours',
      icon: Mail,
      action: () => window.location.href = 'mailto:support@gazzgolf.com'
    },
    {
      id: 'feedback',
      title: 'Send Feedback',
      description: 'Share ideas or report issues',
      icon: MessageCircle,
      action: () => navigate('/feedback')
    },
    {
      id: 'docs',
      title: 'Help Documentation',
      description: 'Browse detailed guides',
      icon: FileText,
      action: () => window.open('/help', '_blank')
    },
    {
      id: 'report',
      title: 'Report a Problem',
      description: 'Something not working right?',
      icon: AlertCircle,
      action: () => navigate('/feedback')
    },
  ];

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
              <h1 className="text-xl font-bold text-foreground">Support</h1>
              <p className="text-sm text-muted-foreground">How can we help?</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            {supportOptions.map((option) => {
              const Icon = option.icon;
              return (
                <Card 
                  key={option.id} 
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={option.action}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col items-center text-center">
                      <div className="p-2 rounded-lg bg-primary text-primary-foreground mb-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <p className="font-medium text-sm">{option.title}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* FAQ Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {filteredFaqs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No results found. Try a different search term.
                  </p>
                ) : (
                  filteredFaqs.map((faq) => (
                    <Collapsible 
                      key={faq.id}
                      open={openFaq === faq.id}
                      onOpenChange={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                    >
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 text-left">
                        <span className="text-sm font-medium pr-4">{faq.question}</span>
                        <ChevronDown 
                          className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${
                            openFaq === faq.id ? 'rotate-180' : ''
                          }`} 
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-3 pb-3">
                          <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                            {faq.answer}
                          </p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <p className="text-sm text-center text-muted-foreground">
                Can't find what you're looking for?
              </p>
              <p className="text-sm text-center mt-2">
                <a 
                  href="mailto:support@gazzgolf.com" 
                  className="text-primary hover:underline font-medium"
                >
                  support@gazzgolf.com
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Support;
