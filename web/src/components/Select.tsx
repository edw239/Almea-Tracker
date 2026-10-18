import type { ReactElement, ReactNode } from 'react'
import { SelectField, type SelectFieldOption } from './ui/select-field'

export type SelectOption<T extends string = string> = {
  value: T
  label: string
  disabled?: boolean
}

type SelectVariant = 'field' | 'toolbar' | 'inline'

type SelectProps<T extends string = string> = {
  value: T
  options: ReadonlyArray<SelectOption<T>>
  onChange: (value: T) => void
  id?: string
  disabled?: boolean
  placeholder?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  className?: string
  /** `field` — form; `toolbar` / `inline` — compact. */
  variant?: SelectVariant
}

const SIZE_BY_VARIANT: Record<SelectVariant, 'default' | 'sm' | 'field'> = {
  field: 'field',
  toolbar: 'sm',
  inline: 'sm',
}

/**
 * Compatibility wrapper over SelectField for existing call sites.
 * Prefer importing SelectField directly in new code.
 */
export function Select<T extends string = string>({
  value,
  options,
  onChange,
  id,
  disabled,
  placeholder,
  className,
  variant = 'field',
  'aria-label': ariaLabel,
}: SelectProps<T>): ReactElement {
  const mapped: SelectFieldOption[] = options.map((option) => ({
    value: option.value,
    label: option.label as ReactNode,
    disabled: option.disabled,
  }))

  return (
    <SelectField
      id={id}
      value={value}
      options={mapped}
      onValueChange={(next) => onChange(next as T)}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      size={SIZE_BY_VARIANT[variant]}
      aria-label={ariaLabel}
    />
  )
}
