"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function RequiredMark({ className }) {
  return (
    <span aria-hidden="true" className={cn("ml-0.5 text-destructive", className)}>
      *
    </span>
  );
}

export default function FieldLabel({
  htmlFor,
  label,
  children,
  required = false,
  variant = "form",
  className,
  ...props
}) {
  const content = label ?? children;

  if (!content && !required) {
    return null;
  }

  if (variant === "filter") {
    return (
      <label
        htmlFor={htmlFor}
        className={cn(
          "text-xs font-medium text-muted-foreground",
          className,
        )}
        {...props}
      >
        {content}
        {required ? <RequiredMark /> : null}
      </label>
    );
  }

  return (
    <Label htmlFor={htmlFor} className={className} {...props}>
      {content}
      {required ? <RequiredMark /> : null}
    </Label>
  );
}

export { FieldLabel };
