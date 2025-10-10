import { cn } from "@/lib/utils";
import Image from "next/image";
import logoImage from '@/app/logo.png';

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src={logoImage}
      alt="LaSalle Gestiona Logo"
      className={cn("h-8 w-auto", className)}
      priority
    />
  );
}
