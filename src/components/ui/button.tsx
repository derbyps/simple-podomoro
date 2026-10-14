import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "pixel-corner pixel-bordered pixel-shadow inline-flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent px-4 py-3 text-sm font-medium whitespace-nowrap select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "text-primary-foreground",
        outline: "text-foreground",
        secondary: "text-secondary-foreground",
        ghost: "text-foreground pixel-shadow-none",
        destructive: "text-destructive-foreground",
        link: "text-accent-foreground pixel-shadow-none underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11",
        xs: "min-h-8 px-2 text-xs",
        sm: "min-h-9 px-3 text-sm",
        lg: "min-h-12 px-5",
        icon: "size-11",
        "icon-xs": "size-8",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
