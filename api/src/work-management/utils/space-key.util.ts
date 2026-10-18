import { KNOWN_SPACE_KEYS, SPACE_KEY_PATTERN } from '../../common/constants';

const CYRILLIC: Record<string, string> = {
  а: 'A',
  б: 'B',
  в: 'V',
  г: 'G',
  д: 'D',
  е: 'E',
  ё: 'E',
  ж: 'ZH',
  з: 'Z',
  и: 'I',
  й: 'Y',
  к: 'K',
  л: 'L',
  м: 'M',
  н: 'N',
  о: 'O',
  п: 'P',
  р: 'R',
  с: 'S',
  т: 'T',
  у: 'U',
  ф: 'F',
  х: 'H',
  ц: 'TS',
  ч: 'CH',
  ш: 'SH',
  щ: 'SCH',
  ъ: '',
  ы: 'Y',
  ь: '',
  э: 'E',
  ю: 'YU',
  я: 'YA',
};

export function isSpaceKey(value: string): boolean {
  return SPACE_KEY_PATTERN.test(value);
}

/** Latin hint for the space form. Existing system spaces use fixed keys. */
export function suggestSpaceKey(name: string, systemKey?: string | null): string {
  if (systemKey && KNOWN_SPACE_KEYS[systemKey]) {
    return KNOWN_SPACE_KEYS[systemKey];
  }
  const latin = [...name.trim().toLowerCase()]
    .map((char) => CYRILLIC[char] ?? char)
    .join('');
  const words = latin
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((word) => word.length > 0);
  let key = '';
  if (words.length >= 2) {
    key = words.map((word) => word[0] ?? '').join('');
  } else {
    key = words[0] ?? 'PR';
  }
  key = key.replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]/.test(key)) {
    key = `P${key}`;
  }
  if (key.length < 2) {
    key = `${key}PR`.slice(0, 2);
  }
  return key.slice(0, 10);
}

export function withKeySuffix(base: string, attempt: number): string {
  if (attempt <= 1) return base;
  const suffix = String(attempt);
  return `${base.slice(0, 10 - suffix.length)}${suffix}`;
}
