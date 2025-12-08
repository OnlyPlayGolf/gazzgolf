import { Bot, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AIConfigSummaryProps {
  isApplied: boolean;
  summary?: string;
  assumptions?: string[];
}

export function AIConfigSummary({ isApplied, summary, assumptions }: AIConfigSummaryProps) {
  if (!isApplied) return null;

  return (
    <Card className="border-2 border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/20">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">AI Setup Applied</p>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            {summary && (
              <p className="text-sm text-muted-foreground">{summary}</p>
            )}
            {assumptions && assumptions.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  <span className="font-medium">AI Assumptions:</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                  {assumptions.map((assumption, i) => (
                    <li key={i} className="list-disc">{assumption}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground italic">
              You can edit any settings below to override AI suggestions.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
