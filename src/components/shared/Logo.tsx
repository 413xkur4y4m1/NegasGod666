import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-8 w-auto", className)}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="LaSalle Gestiona Logo"
    >
      <rect width="100" height="100" rx="12" fill="currentColor" />
      <path
        d="M25 25V75H40V60H65V75H80V25H65V40H40V25H25Z"
        fill="white"
      />
      <title>LaSalle Gestiona</title>
    </svg>
  );
}
