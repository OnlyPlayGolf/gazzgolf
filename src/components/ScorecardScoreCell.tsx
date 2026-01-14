import { cn } from "@/lib/utils";

interface ScorecardScoreCellProps {
  score: number | null | undefined;
  par: number;
  className?: string;
}

/**
 * Renders a score cell for use in scorecard tables with unified styling:
 * - Eagle or better (2+ under): solid orange circle
 * - Birdie (1 under): solid red circle
 * - Par: plain number (no shape)
 * - Bogey (1 over): solid light-blue square
 * - Double bogey (2 over): solid navy square
 * - Triple bogey or worse (3+ over): solid black square
 * 
 * All shapes have white centered text. Designed for compact scorecard display.
 */
export function ScorecardScoreCell({ score, par, className }: ScorecardScoreCellProps) {
  // Handle empty/null scores
  if (score === null || score === undefined || score === 0) {
    return <span className={cn("text-muted-foreground", className)}>-</span>;
  }

  // Handle conceded holes (represented as -1)
  if (score === -1) {
    return <span className={cn("text-muted-foreground", className)}>–</span>;
  }

  const diff = score - par;

  // Base styles for all shapes - optimized for scorecard table cells
  const baseShape = "inline-flex items-center justify-center w-[18px] h-[18px] text-[10px] font-bold text-white leading-none";
  const circleStyle = "rounded-full";
  const squareStyle = "rounded-[2px]";

  // Eagle or better (2+ under par) - solid orange circle
  if (diff <= -2) {
    return (
      <span className={cn(baseShape, circleStyle, "bg-orange-500", className)}>
        {score}
      </span>
    );
  }

  // Birdie (1 under par) - solid red circle
  if (diff === -1) {
    return (
      <span className={cn(baseShape, circleStyle, "bg-red-500", className)}>
        {score}
      </span>
    );
  }

  // Par - plain number (no shape)
  if (diff === 0) {
    return (
      <span className={cn("inline-flex items-center justify-center w-[18px] h-[18px] text-[10px] font-semibold text-foreground leading-none", className)}>
        {score}
      </span>
    );
  }

  // Bogey (1 over par) - solid light-blue square
  if (diff === 1) {
    return (
      <span className={cn(baseShape, squareStyle, "bg-sky-400", className)}>
        {score}
      </span>
    );
  }

  // Double bogey (2 over par) - solid navy square
  if (diff === 2) {
    return (
      <span className={cn(baseShape, squareStyle, "bg-blue-800", className)}>
        {score}
      </span>
    );
  }

  // Triple bogey or worse (3+ over par) - solid black square
  return (
    <span className={cn(baseShape, squareStyle, "bg-gray-900", className)}>
      {score}
    </span>
  );
}

/**
 * Returns styling info for a score to allow custom rendering
 */
export function getScoreStyling(score: number | null | undefined, par: number): {
  bgColor: string;
  textColor: string;
  shape: 'circle' | 'square' | 'none';
  isSpecial: boolean;
} {
  if (score === null || score === undefined || score === 0 || score === -1) {
    return { bgColor: '', textColor: 'text-muted-foreground', shape: 'none', isSpecial: false };
  }

  const diff = score - par;

  // Eagle or better
  if (diff <= -2) {
    return { bgColor: 'bg-orange-500', textColor: 'text-white', shape: 'circle', isSpecial: true };
  }

  // Birdie
  if (diff === -1) {
    return { bgColor: 'bg-red-500', textColor: 'text-white', shape: 'circle', isSpecial: true };
  }

  // Par
  if (diff === 0) {
    return { bgColor: '', textColor: 'text-foreground', shape: 'none', isSpecial: false };
  }

  // Bogey
  if (diff === 1) {
    return { bgColor: 'bg-sky-400', textColor: 'text-white', shape: 'square', isSpecial: true };
  }

  // Double bogey
  if (diff === 2) {
    return { bgColor: 'bg-blue-800', textColor: 'text-white', shape: 'square', isSpecial: true };
  }

  // Triple bogey or worse
  return { bgColor: 'bg-gray-900', textColor: 'text-white', shape: 'square', isSpecial: true };
}
