import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type FadeSlideProps = {
  children: ReactNode;
  className?: string;
  y?: number;
  durationMs?: number;
};

export function FadeSlide({
  children,
  className,
  y = 8,
  durationMs = 180,
}: FadeSlideProps) {
  const shouldReduceMotion = useReducedMotion();

  const transition = {
    duration: durationMs / 1000,
    ease: [0.22, 1, 0.36, 1], // easeOutCubic-ish
  } as const;

  return (
    <motion.div
      className={className}
      initial={
        shouldReduceMotion
          ? { opacity: 0 }
          : {
              opacity: 0,
              y,
            }
      }
      animate={{ opacity: 1, y: 0 }}
      exit={
        shouldReduceMotion
          ? { opacity: 0 }
          : {
              opacity: 0,
              y: -y,
            }
      }
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

