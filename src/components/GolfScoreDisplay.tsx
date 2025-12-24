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
    sm: { 
      innerSize: "w-5 h-5 text-[10px]", 
      borderWidth: 1,
      gap: 2,
    },
    md: { 
      innerSize: "w-6 h-6 text-xs", 
      borderWidth: 1.5,
      gap: 2,
    },
    lg: { 
      innerSize: "w-8 h-8 text-sm", 
      borderWidth: 2,
      gap: 3,
    },
  };

  const config = sizeConfig[size];

  // Under par - circles (concentric rings)
  if (diff < 0) {
    const circleCount = Math.min(Math.abs(diff), 3); // Max 3 circles (albatross)
    
    // Calculate outer padding for nested circles
    const totalPadding = (circleCount - 1) * (config.borderWidth + config.gap);
    
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div 
          className="relative flex items-center justify-center"
          style={{ padding: totalPadding }}
        >
          {/* Outer circles */}
          {circleCount >= 3 && (
            <div 
              className="absolute inset-0 rounded-full border-foreground/70"
              style={{ borderWidth: config.borderWidth }}
            />
          )}
          {circleCount >= 2 && (
            <div 
              className="absolute rounded-full border-foreground/70"
              style={{ 
                borderWidth: config.borderWidth,
                inset: circleCount >= 3 ? config.borderWidth + config.gap : 0,
              }}
            />
          )}
          {/* Inner circle with score */}
          <div 
            className={cn(
              "flex items-center justify-center rounded-full font-semibold border-foreground/70",
              config.innerSize
            )}
            style={{ borderWidth: config.borderWidth }}
          >
            {score}
          </div>
        </div>
      </div>
    );
  }

  // Par - plain number
  if (diff === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className={cn("flex items-center justify-center font-medium", config.innerSize)}>
          {score}
        </div>
      </div>
    );
  }

  // Over par - boxes (concentric squares)
  const boxCount = Math.min(diff, 4); // Max 4 boxes (quadruple bogey)
  
  // Calculate outer padding for nested boxes
  const totalPadding = (boxCount - 1) * (config.borderWidth + config.gap);
  
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div 
        className="relative flex items-center justify-center"
        style={{ padding: totalPadding }}
      >
        {/* Outer boxes */}
        {boxCount >= 4 && (
          <div 
            className="absolute inset-0 border-foreground/70"
            style={{ borderWidth: config.borderWidth }}
          />
        )}
        {boxCount >= 3 && (
          <div 
            className="absolute border-foreground/70"
            style={{ 
              borderWidth: config.borderWidth,
              inset: boxCount >= 4 ? config.borderWidth + config.gap : 0,
            }}
          />
        )}
        {boxCount >= 2 && (
          <div 
            className="absolute border-foreground/70"
            style={{ 
              borderWidth: config.borderWidth,
              inset: boxCount >= 4 
                ? (config.borderWidth + config.gap) * 2 
                : boxCount >= 3 
                  ? config.borderWidth + config.gap 
                  : 0,
            }}
          />
        )}
        {/* Inner box with score */}
        <div 
          className={cn(
            "flex items-center justify-center font-semibold border-foreground/70",
            config.innerSize
          )}
          style={{ borderWidth: config.borderWidth }}
        >
          {score}
        </div>
      </div>
    </div>
  );
}
