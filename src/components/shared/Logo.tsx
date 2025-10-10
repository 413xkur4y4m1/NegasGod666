import { cn } from "@/lib/utils";
import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="LaSalle Gestiona Logo"
      width={100}
      height={100}
      className={cn("h-8 w-auto", className)}
    />
  );
}
