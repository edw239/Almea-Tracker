const CYR: Record<string, string> = {
  а: 'A', б: 'B', в: 'V', г: 'G', д: 'D', е: 'E', ё: 'E', ж: 'ZH', з: 'Z', и: 'I', й: 'Y',
  к: 'K', л: 'L', м: 'M', н: 'N', о: 'O', п: 'P', р: 'R', с: 'S', т: 'T', у: 'U', ф: 'F',
  х: 'H', ц: 'TS', ч: 'CH', ш: 'SH', щ: 'SCH', ъ: '', ы: 'Y', ь: '', э: 'E', ю: 'YU', я: 'YA',
}

export function suggestSpaceKey(name: string): string {
  const latin = [...name.trim().toLowerCase()].map((char) => CYR[char] ?? char).join('')
  const words = latin.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)
  let key = words.length >= 2 ? words.map((word) => word[0]).join('') : (words[0] ?? 'PR')
  key = key.replace(/[^A-Z0-9]/g, '')
  if (!/^[A-Z]/.test(key)) key = `P${key}`
  if (key.length < 2) key = `${key}PR`.slice(0, 2)
  return key.slice(0, 10)
}

export const TASK_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}-\d+$/
