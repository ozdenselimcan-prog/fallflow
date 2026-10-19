import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils";

export function Logo({ className, imgClassName, href = "/" }: { className?: string; imgClassName?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center", className)}>
      <Image src="/brand/logo-full.png" alt={siteConfig.name} width={775} height={209} priority className={cn("h-7 w-auto", imgClassName)} />
    </Link>
  );
}
