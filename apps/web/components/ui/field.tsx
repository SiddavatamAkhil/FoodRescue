"use client";

import { forwardRef, useId, useState, cloneElement, isValidElement } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded border bg-surface px-3 text-base text-ink placeholder:text-muted/70 transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-forest/25 focus:border-forest disabled:bg-canvas disabled:text-muted";

export function controlClass(invalid?: boolean, className?: string) {
  return cn(control, invalid ? "border-danger" : "border-line-strong hover:border-ink/30", className);
}

export function Field({
  label, hint, error, required, children, className, optional,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactElement;
  className?: string;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  const child = isValidElement(children)
    ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
      })
    : children;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={(children.props as { id?: string }).id ?? id} className="block text-sm font-semibold text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-muted">(optional)</span>}
      </label>
      {child}
      {hint && !error && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} className="text-sm font-medium text-danger-text">{error}</p>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    const isInvalid = invalid || props["aria-invalid"] === true;
    return <input ref={ref} className={controlClass(isInvalid, cn("h-10", className))} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className, invalid, ...props }, ref) {
    const isInvalid = invalid || props["aria-invalid"] === true;
    return <textarea ref={ref} className={controlClass(isInvalid, cn("py-2 min-h-[96px]", className))} {...props} />;
  },
);

const CHEVRON = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235F6964' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function Select({ className, invalid, children, style, ...props }, ref) {
    const isInvalid = invalid || props["aria-invalid"] === true;
    return (
      <select
        ref={ref}
        className={controlClass(isInvalid, cn("h-10 appearance-none pr-8", className))}
        style={{ backgroundImage: CHEVRON, backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center", ...style }}
        {...props}
      >
        {children}
      </select>
    );
  },
);

export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput(props, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={show ? "text" : "password"} className="pr-11" {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r text-muted hover:text-ink"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);

export function Checkbox({ label, description, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; description?: string }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input id={props.id ?? id} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-line-strong accent-forest" {...props} />
      <label htmlFor={props.id ?? id} className="text-sm text-ink">
        {label}
        {description && <span className="block text-muted">{description}</span>}
      </label>
    </div>
  );
}

/** Segmented choice for small option sets (e.g. veg / non-veg). */
export function Segmented<T extends string>({
  value, onChange, options, label,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded border border-line-strong bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 rounded-sm px-3 text-sm font-semibold transition-colors",
            value === o.value ? "bg-forest text-white" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
