import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper } from "lucide-react";

export default function UpDownPuttingFeed() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Newspaper size={20} className="text-primary" />
            Game Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Recent activity and achievements will appear here
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
