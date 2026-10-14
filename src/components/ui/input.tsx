import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative min-w-0 w-full flex-1">
      <div
        aria-hidden
        className="pixel-corner pixel-bordered pixel-shadow pointer-events-none absolute inset-0 [--pf-fill:var(--card)]"
      />
      <InputPrimitive
        type={type}
        data-slot="input"
        className={cn(
          "relative z-10 h-12 w-full bg-transparent px-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  )
}

export { Input }
