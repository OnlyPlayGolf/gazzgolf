import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AIMessage, GameConfiguration } from "@/types/gameConfig";

interface CourseInfo {
  courseName: string;
  availableTees: string[];
  defaultHoles: number;
  courseHoles?: { holeNumber: number; par: number; strokeIndex: number }[];
}

interface AISetupAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  courseInfo?: CourseInfo;
  onApplyConfig: (config: GameConfiguration) => void;
}

export function AISetupAssistant({ isOpen, onClose, courseInfo, onApplyConfig }: AISetupAssistantProps) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your AI Setup Assistant. Describe any game setup you want - custom holes, special tee rules, format modifications, team rotations, handicap adjustments - and I'll configure it for you.\n\nFor example:\n• "Play Umbriago with 6-hole matches, rotating teams"\n• "Stableford with double points on par 3s"\n• "Play holes 1-3 and 12-18, back tees except hole 12"\n\nWhat would you like to play?`
    }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedConfigs, setExpandedConfigs] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const parseGameConfig = (content: string): GameConfiguration | null => {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]) as GameConfiguration;
      } catch (e) {
        console.error('Failed to parse game config:', e);
      }
    }
    return null;
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: AIMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/game-setup-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
            courseInfo,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'assistant') {
                  lastMessage.content = assistantContent;
                  lastMessage.gameConfig = parseGameConfig(assistantContent);
                }
                return newMessages;
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Final parse for game config
      const gameConfig = parseGameConfig(assistantContent);
      if (gameConfig) {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant') {
            lastMessage.gameConfig = gameConfig;
          }
          return newMessages;
        });
      }
    } catch (error: any) {
      console.error('AI Assistant error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to get AI response",
        variant: "destructive",
      });
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleConfigExpanded = (index: number) => {
    setExpandedConfigs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const handleApplyConfig = (config: GameConfiguration) => {
    onApplyConfig(config);
    toast({
      title: "Configuration Applied",
      description: `${config.baseFormat} setup with ${config.totalHoles} holes ready to go!`,
    });
    onClose();
  };

  const renderConfigPreview = (config: GameConfiguration, index: number) => {
    const isExpanded = expandedConfigs.has(index);
    
    return (
      <Card className="mt-3 p-3 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Game Configuration</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggleConfigExpanded(index)}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-1 mb-2">
          <Badge variant="secondary">{config.baseFormat.replace('_', ' ')}</Badge>
          <Badge variant="outline">{config.totalHoles} holes</Badge>
          <Badge variant="outline">{config.playerCount} players</Badge>
          {config.useHandicaps && <Badge variant="outline">Handicaps</Badge>}
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-2 text-xs">
            {config.holes.length > 0 && (
              <div>
                <span className="font-medium">Holes: </span>
                {config.holes.map(h => h.holeNumber).join(', ')}
              </div>
            )}
            {config.teeAssignments.length > 0 && (
              <div>
                <span className="font-medium">Tees: </span>
                {config.teeAssignments.map(t => `${t.playerName}: ${t.defaultTee}`).join(', ')}
              </div>
            )}
            {config.teams && config.teams.length > 0 && (
              <div>
                <span className="font-medium">Teams: </span>
                {config.teams.map(t => t.teamName).join(' vs ')}
              </div>
            )}
            {config.bonusRules && config.bonusRules.length > 0 && (
              <div>
                <span className="font-medium">Bonuses: </span>
                {config.bonusRules.map(b => b.description).join(', ')}
              </div>
            )}
            {config.assumptions.length > 0 && (
              <div className="mt-2 p-2 bg-muted rounded text-muted-foreground">
                <span className="font-medium">Assumptions: </span>
                {config.assumptions.join(' • ')}
              </div>
            )}
          </div>
        )}

        <Button
          size="sm"
          className="w-full mt-3"
          onClick={() => handleApplyConfig(config)}
        >
          <Check className="w-4 h-4 mr-2" />
          Apply Configuration
        </Button>
      </Card>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-x-4 top-16 bottom-4 max-w-xl mx-auto bg-background border rounded-xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">AI Setup Assistant</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content.replace(/```json[\s\S]*?```/g, '').trim() || (isProcessing && index === messages.length - 1 ? '...' : '')}
                  </p>
                  {message.gameConfig && renderConfigPreview(message.gameConfig, index)}
                </div>
              </div>
            ))}
            {isProcessing && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Describe your game setup..."
              disabled={isProcessing}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={isProcessing || !input.trim()}>
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
