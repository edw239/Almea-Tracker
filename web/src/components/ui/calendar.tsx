import type { CSSProperties, ReactElement } from 'react';
import { ChevronLeft, ChevronRight } from '../../lib/icons';
import { DayPicker, getDefaultClassNames, type DayPickerProps } from 'react-day-picker';
import { ru } from 'react-day-picker/locale';
import { cn } from '../../lib/utils';

export type CalendarDensity = 'default' | 'compact';

export type CalendarProps = DayPickerProps & {
  density?: CalendarDensity;
};

/**
 * The library sets a 44px day on `.rdp-root` in an unlayered stylesheet, which beats
 * any `@layer` override. Seven of those cells are wider than the 18rem picker, and the
 * popover does not clip, so the next-month chevron hangs past the time row. Inline
 * variables win on the same element. 2rem matches the compact day button.
 */
const COMPACT_DAY_VARS = {
  '--rdp-day-height': '2rem',
  '--rdp-day-width': '2rem',
  '--rdp-day_button-height': '2rem',
  '--rdp-day_button-width': '2rem',
  '--rdp-nav_button-height': '1.75rem',
  '--rdp-nav_button-width': '1.75rem',
  '--rdp-nav-height': '2rem',
} as CSSProperties;

const NAV_BUTTON_CLASS =
  'inline-flex items-center justify-center rounded-lg text-subtle-foreground transition-all duration-150 ease-out hover:bg-inset hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30';

const DAY_BUTTON_CLASS =
  'relative z-[1] mx-auto flex cursor-pointer items-center justify-center rounded-lg p-0 font-normal text-muted-foreground transition-[background-color,color,box-shadow] duration-150 ease-out hover:bg-inset hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:font-semibold';

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = ru,
  density = 'default',
  ...props
}: CalendarProps): ReactElement {
  const defaults = getDefaultClassNames();
  const compact = density === 'compact';

  return (
    <DayPicker
      locale={locale}
      showOutsideDays={showOutsideDays}
      className={cn(compact ? 'p-2' : 'p-3', className)}
      style={compact ? COMPACT_DAY_VARS : undefined}
      classNames={{
        root: cn('w-fit', defaults.root),
        months: cn('relative flex flex-col', compact ? 'gap-2' : 'gap-3', defaults.months),
        month: cn('flex w-full flex-col', compact ? 'gap-1' : 'gap-2', defaults.month),
        month_caption: cn(
          'relative flex items-center justify-center',
          compact ? 'mb-0.5 h-8 px-8' : 'mb-1 h-9 px-9',
          defaults.month_caption,
        ),
        caption_label: cn(
          'pointer-events-none font-semibold capitalize text-foreground',
          compact ? 'text-xs' : 'text-sm',
          defaults.caption_label,
        ),
        nav: cn('absolute inset-x-1 top-0 z-[2] flex items-center justify-between', defaults.nav),
        button_previous: cn(
          NAV_BUTTON_CLASS,
          compact ? 'size-7' : 'size-8',
          defaults.button_previous,
        ),
        button_next: cn(NAV_BUTTON_CLASS, compact ? 'size-7' : 'size-8', defaults.button_next),
        weekdays: cn('flex', defaults.weekdays),
        weekday: cn(
          'text-center font-medium uppercase tracking-wide text-subtle-foreground',
          compact ? 'w-8 text-[0.65rem]' : 'w-9 text-[0.7rem]',
          defaults.weekday,
        ),
        week: cn('flex w-full', compact ? 'mt-0' : 'mt-0.5', defaults.week),
        day: cn('relative p-0 text-center', defaults.day),
        day_button: cn(
          DAY_BUTTON_CLASS,
          compact ? 'size-8 text-xs' : 'size-9 text-sm',
          defaults.day_button,
        ),
        selected: 'rounded-lg',
        today: 'rounded-lg',
        outside: 'text-subtle-foreground/50',
        disabled: 'text-subtle-foreground/40 opacity-40',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chevronClass, orientation, ...chevronProps }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
          return <Icon className={cn('size-4', chevronClass)} {...chevronProps} />;
        },
      }}
      {...props}
    />
  );
}
