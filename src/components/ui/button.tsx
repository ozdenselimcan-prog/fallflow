import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-sm",
  secondary: "bg-card text-foreground border border-border hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  danger: "bg-danger text-white hover:opacity-90",
} as const;
const sizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" } as const;

interface StyleOpts {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
}

/** Klassen auch für Links nutzbar: <Link className={buttonStyles({ variant: "primary" })}>. */
export const buttonStyles = ({ variant = "primary", size = "md", className }: StyleOpts = {}) =>
  cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );

export function Button({
  variant,
  size,
  className,
  loading,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & StyleOpts & { loading?: boolean }) {
  return (
    <button type={type} className={buttonStyles({ variant, size, className })} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
