import { cn } from "@/lib/utils";

interface GolfScoreDisplayProps {
  score: number | null | undefined;
  par: number;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

/**
 * Displays a golf score with standardized visual styling:
 * - Eagle or better (2+ under): solid orange circle
 * - Birdie (1 under): solid red circle
 * - Par: plain number (no shape)
 * - Bogey (1 over): solid light-blue square
 * - Double bogey (2 over): solid navy square
 * - Triple bogey or worse (3+ over): solid black square
 * 
 * All shapes have white centered text.
 */
export function GolfScoreDisplay({ score, par, className, size = "sm" }: GolfScoreDisplayProps) {
  if (score === null || score === undefined || score === 0 || score === -1) {
    return <span className={cn("text-muted-foreground", className)}>{score === -1 ? "–" : "-"}</span>;
  }

  const diff = score - par;
  
  // Size configurations
  const sizeConfig = {
    xs: { 
      container: "w-4 h-4 text-[9px]",
      borderRadius: "rounded-full",
      squareRadius: "rounded-[2px]",
    },
    sm: { 
      container: "w-5 h-5 text-[10px]",
      borderRadius: "rounded-full",
      squareRadius: "rounded-[3px]",
    },
    md: { 
      container: "w-6 h-6 text-xs",
      borderRadius: "rounded-full",
      squareRadius: "rounded-[4px]",
    },
    lg: { 
      container: "w-8 h-8 text-sm",
      borderRadius: "rounded-full",
      squareRadius: "rounded-[5px]",
    },
  };

  const config = sizeConfig[size];

  // Eagle or better (2+ under par) - solid orange circle
  if (diff <= -2) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div 
          className={cn(
            "flex items-center justify-center font-bold text-white",
            config.container,
            config.borderRadius,
            "bg-amber-500"
          )}
        >
          {score}
        </div>
      </div>
    );
  }

  // Birdie (1 under par) - solid red circle
  if (diff === -1) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div 
          className={cn(
            "flex items-center justify-center font-bold text-white",
            config.container,
            config.borderRadius,
            "bg-red-500"
          )}
        >
          {score}
        </div>
      </div>
    );
  }

  // Par - plain number (no shape)
  if (diff === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className={cn("flex items-center justify-center font-semibold text-foreground", config.container)}>
          {score}
        </div>
      </div>
    );
  }

  // Bogey (1 over par) - solid light-blue square
  if (diff === 1) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div 
          className={cn(
            "flex items-center justify-center font-bold text-white",
            config.container,
            config.squareRadius,
            "bg-sky-400"
          )}
        >
          {score}
        </div>
      </div>
    );
  }

  // Double bogey (2 over par) - solid navy square
  if (diff === 2) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div 
          className={cn(
            "flex items-center justify-center font-bold text-white",
            config.container,
            config.squareRadius,
            "bg-blue-800"
          )}
        >
          {score}
        </div>
      </div>
    );
  }

  // Triple bogey or worse (3+ over par) - solid black square
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div 
        className={cn(
          "flex items-center justify-center font-bold text-white",
          config.container,
          config.squareRadius,
          "bg-gray-900"
        )}
      >
        {score}
      </div>
    </div>
  );
}
