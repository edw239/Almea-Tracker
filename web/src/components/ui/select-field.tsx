import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { fromSelectChange, toSelectValue } from './select-field.util'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

export interface SelectFieldOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

export interface SelectFieldProps {
  value: string
  onValueChange: (value: string) => void
  options: readonly SelectFieldOption[]
  placeholder?: string
  size?: 'default' | 'sm' | 'field'
  disabled?: boolean
  className?: string
  contentClassName?: string
  id?: string
  name?: string
  'aria-label'?: string
}

/**
 * Drop-in replacement for native `<select>`: same value/onChange contract,
 * including empty string as “all / unset”.
 */
export function SelectField({
  value,
  onValueChange,
  options,
  placeholder,
  size = 'field',
  disabled = false,
  className,
  contentClassName,
  id,
  name,
  'aria-label': ariaLabel,
}: SelectFieldProps): ReactElement {
  const radixValue = toSelectValue(value)
  const knownValues = new Set(options.map((option) => toSelectValue(option.value)))

  return (
    <Select
      value={knownValues.has(radixValue) ? radixValue : undefined}
      onValueChange={(next) => {
        const picked = fromSelectChange(next)
        if (picked !== null) onValueChange(picked)
      }}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger id={id} size={size} className={className} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((option) => (
          <SelectItem
            key={option.value === '' ? '__empty__' : option.value}
            value={toSelectValue(option.value)}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function selectFieldClass(compact: boolean): string {
  return cn(compact ? 'h-8 min-w-[8rem] w-auto' : 'h-9 min-w-[9rem] w-auto')
}
