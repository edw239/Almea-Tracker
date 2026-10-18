import * as React from 'react'
import { cn } from '../../lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      className={cn('input-field px-3 py-2.5 text-sm', className)}
      ref={ref}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
