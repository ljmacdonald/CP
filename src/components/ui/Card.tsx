import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", children, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(20,20,15,0.04)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
