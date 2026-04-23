/**
 * Reusable CSS animation utilities (no framer-motion dependency).
 * Uses Tailwind + CSS custom properties for smooth, performant animations.
 * Respects prefers-reduced-motion via Tailwind's `motion-safe:` and `motion-reduce:` variants.
 */

/** Delay class by index for stagger effects */
export function staggerDelay(index: number, base = 50): string {
  const ms = index * base;
  return `animation-delay: ${ms}ms`;
}

/** Returns inline style object for stagger animations */
export function staggerStyle(index: number, base = 60): React.CSSProperties {
  return {
    animationDelay: `${index * base}ms`,
    animationFillMode: "both",
  };
}

/** Section entrance animation class string */
export const fadeUp =
  "animate-in fade-in-0 slide-in-from-bottom-4 duration-500 fill-mode-both";

/** Card hover class string */
export const cardHover =
  "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5";

/** Fast fade in */
export const fadeIn = "animate-in fade-in-0 duration-300 fill-mode-both";
