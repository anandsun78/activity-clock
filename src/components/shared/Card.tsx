import React from "react";

type CardProps = {
  className?: string;
  children: React.ReactNode;
};

export function Card({ className, children }: CardProps) {
  const classes = ["card", className].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
}

type CardHeaderProps = {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

export function CardHeader({ className, style, children }: CardHeaderProps) {
  const classes = ["card-header", className].filter(Boolean).join(" ");
  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}

type ChipProps = {
  className?: string;
  children: React.ReactNode;
  as?: "span" | "div";
};

export function Chip({ className, children, as = "span" }: ChipProps) {
  const Comp = as;
  const classes = ["chip", className].filter(Boolean).join(" ");
  return <Comp className={classes}>{children}</Comp>;
}
