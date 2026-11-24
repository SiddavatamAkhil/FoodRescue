import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * FoodRescue mark: a leaf whose midrib continues as a hand-off stroke,
 * the moment surplus moves from one party to the next.
 */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <rect width="32" height="32" rx="7" fill={inverted ? "#FFFFFF" : "#174C3C"} />
      <path d="M9 21.5c0-7 5.2-12.2 14-13 .2 8.6-4.9 14-12 14.2" fill="none" stroke={inverted ? "#6D927B" : "#B8D6B2"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 23.5 17 15" stroke={inverted ? "#174C3C" : "#FFFFFF"} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", className, inverted = false }: { href?: string; className?: string; inverted?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="FoodRescue home">
      <LogoMark inverted={inverted} />
      <span className={cn("text-lg font-bold tracking-[-0.02em]", inverted ? "text-white" : "text-ink")}>FoodRescue</span>
    </Link>
  );
}
