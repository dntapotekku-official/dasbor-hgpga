import * as React from "react"

import { cn } from "@/lib/utils"

const Card = ({
  className,
  size = "default",
  ...props
}) => {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card text-sm text-card-foreground shadow-md [--card-spacing:--spacing(4)] data-[size=sm]:[--card-spacing:--spacing(3)] *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        className
      )}
      {...props} />
  );
}

const CardHeader = ({
  className,
  ...props
}) => {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl p-(--card-spacing)",
        className
      )}
      {...props} />
  );
}

const CardTitle = ({
  className,
  ...props
}) => {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-lg leading-snug font-semibold tracking-tight",
        className
      )}
      {...props} />
  );
}

const CardDescription = ({
  className,
  ...props
}) => {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props} />
  );
}

const CardContent = ({
  className,
  ...props
}) => {
  return (
    <div
      data-slot="card-content"
      className={cn("p-(--card-spacing)", className)}
      {...props} />
  );
}

const CardFooter = ({
  className,
  ...props
}) => {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props} />
  );
};

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
