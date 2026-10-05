import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = HTMLAttributes<HTMLElement> & {
  interactive?: boolean;
  children: ReactNode;
};

export function Card({ interactive = false, className = "", children, ...props }: CardProps) {
  return (
    <article
      className={`card${interactive ? " card--interactive" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </article>
  );
}
