import { cn } from "@/lib/utils";

interface GolfScoreDisplayProps {
  score: number | null;
  par: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Displays a golf score with traditional styling:
 * - Albatross (3 under): triple circle
 * - Eagle (2 under): double circle
 * - Birdie (1 under): single circle
 * - Par: plain number
 * - Bogey (1 over): single box
 * - Double bogey (2 over): double box
 * - Triple bogey (3 over): triple box
 * - Quadruple bogey+ (4+ over): quadruple box
 */
export function GolfScoreDisplay({ score, par, className, size = "sm" }: GolfScoreDisplayProps) {
  if (score === null || score === undefined) {
    return <span className={cn("text-muted-foreground", className)}>-</span>;
  }

  const diff = score - par;
  
  // Size configurations
  const sizeConfig = {
    sm: { base: "w-6 h-6 text-xs", ring: "ring-1", gap: 1 },
    md: { base: "w-8 h-8 text-sm", ring: "ring-[1.5px]", gap: 1.5 },
    lg: { base: "w-10 h-10 text-base", ring: "ring-2", gap: 2 },
  };

  const config = sizeConfig[size];

  // Under par - circles
  if (diff < 0) {
    const circleCount = Math.min(Math.abs(diff), 3); // Max 3 circles (albatross)
    
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div 
          className={cn(
            "flex items-center justify-center rounded-full font-semibold",
            config.base,
            config.ring,
            "ring-foreground/70"
          )}
          style={{
            boxShadow: circleCount >= 2 
              ? `0 0 0 ${config.gap * 2 + 1}px transparent, 0 0 0 ${config.gap * 2 + 2}px hsl(var(--foreground) / 0.7)${circleCount >= 3 ? `, 0 0 0 ${config.gap * 4 + 3}px transparent, 0 0 0 ${config.gap * 4 + 4}px hsl(var(--foreground) / 0.7)` : ''}` 
              : undefined
          }}
        >
          {score}
        </div>
      </div>
    );
  }

  // Par - plain number
  if (diff === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className={cn("flex items-center justify-center font-medium", config.base)}>
          {score}
        </div>
      </div>
    );
  }

  // Over par - boxes
  const boxCount = Math.min(diff, 4); // Max 4 boxes (quadruple bogey)
  
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div 
        className={cn(
          "flex items-center justify-center font-semibold",
          config.base,
          config.ring,
          "ring-foreground/70"
        )}
        style={{
          boxShadow: boxCount >= 2 
            ? `0 0 0 ${config.gap * 2 + 1}px transparent, 0 0 0 ${config.gap * 2 + 2}px hsl(var(--foreground) / 0.7)${boxCount >= 3 ? `, 0 0 0 ${config.gap * 4 + 3}px transparent, 0 0 0 ${config.gap * 4 + 4}px hsl(var(--foreground) / 0.7)${boxCount >= 4 ? `, 0 0 0 ${config.gap * 6 + 5}px transparent, 0 0 0 ${config.gap * 6 + 6}px hsl(var(--foreground) / 0.7)` : ''}` : ''}` 
            : undefined
        }}
      >
        {score}
      </div>
    </div>
  );
}