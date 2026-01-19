import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AIMessage, GameConfiguration } from "@/types/gameConfig";
import { cn } from "@/lib/utils";

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
  currentConfig?: Partial<GameConfiguration>;
}

export function AISetupAssistant({ isOpen, onClose, courseInfo, onApplyConfig, currentConfig }: AISetupAssistantProps) {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      role: 'assistant',
      content: `I'm your game configuration controller. Tell me what you want and I'll set it up immediately.\n\nExamples:\n• "Play Copenhagen"\n• "Best ball with handicaps"\n• "Front 9 only"\n• "Add skins game"\n\nWhat would you like to configure?`
    }
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAppliedConfig, setLastAppliedConfig] = useState<string | null>(null);
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

  const getConfigSummary = (config: GameConfiguration): string => {
    const parts: string[] = [];
    parts.push(config.baseFormat.replace('_', ' '));
    parts.push(`${config.totalHoles} holes`);
    if (config.teams?.length) parts.push(`${config.teams.length} teams`);
    return parts.join(' • ');
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
            currentConfig,
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

      // Auto-apply the configuration immediately
      const gameConfig = parseGameConfig(assistantContent);
      if (gameConfig) {
        const configKey = JSON.stringify(gameConfig);
        if (configKey !== lastAppliedConfig) {
          onApplyConfig(gameConfig);
          setLastAppliedConfig(configKey);
          
          toast({
            title: "Configuration applied",
            description: getConfigSummary(gameConfig),
            duration: 2000,
          });
        }

        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.role === 'assistant') {
            lastMessage.gameConfig = gameConfig;
            lastMessage.configApplied = true;
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

  const renderAppliedBadge = (config: GameConfiguration) => (
    <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-primary text-primary-foreground border border-primary/20">
      <CheckCircle2 className="w-4 h-4 text-primary" />
      <span className="text-xs font-medium text-primary">Applied:</span>
      <div className="flex flex-wrap gap-1">
        <Badge variant="secondary" className="text-xs">{config.baseFormat.replace('_', ' ')}</Badge>
        <Badge variant="outline" className="text-xs">{config.totalHoles} holes</Badge>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl h-[85vh] max-h-[700px] bg-background border rounded-xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-primary/5 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">AI Game Controller</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg p-3",
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content.replace(/```json[\s\S]*?```/g, '').trim() || (isProcessing && index === messages.length - 1 ? '...' : '')}
                  </p>
                  {message.gameConfig && message.configApplied && renderAppliedBadge(message.gameConfig)}
                </div>
              </div>
            ))}
            {isProcessing && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Configuring...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-background shrink-0">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Tell me what to configure..."
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
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Changes apply immediately • No confirmation needed
          </p>
        </div>
      </div>
    </div>
  );
}