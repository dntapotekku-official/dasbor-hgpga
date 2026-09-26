"use client";

import FieldLabel from "@/components/field-label";
import { cn } from "@/lib/utils";

export default function FilterField({
  label,
  htmlFor,
  required = false,
  children,
  className,
  labelClassName,
  ...props
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)} {...props}>
      <FieldLabel
        htmlFor={htmlFor}
        label={label}
        required={required}
        variant="filter"
        className={labelClassName}
      />
      {children}
    </div>
  );
}

export { FilterField };
