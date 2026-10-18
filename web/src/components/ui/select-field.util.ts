/** Radix Select forbids empty-string item values. */
export const SELECT_EMPTY_VALUE = '__empty__'

export function toSelectValue(value: string): string {
  return value === '' ? SELECT_EMPTY_VALUE : value
}

export function fromSelectValue(value: string): string {
  return value === SELECT_EMPTY_VALUE ? '' : value
}

/**
 * Field value for a Radix `onValueChange`, or `null` when the change is not a user pick.
 * Inside a `<form>` Radix mirrors the value into a hidden native `<select>` and reports that
 * select's value back; when the value arrives before its `<option>` is registered (options and
 * value change in one render, or options load after the value) the echo is `''`. Items cannot
 * carry `''`, so honouring it would silently wipe the value the parent just set.
 */
export function fromSelectChange(value: string): string | null {
  return value === '' ? null : fromSelectValue(value)
}
