import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from '../../lib/icons'
import { cn } from '../../lib/utils'

const Drawer = DialogPrimitive.Root
const DrawerTrigger = DialogPrimitive.Trigger
const DrawerClose = DialogPrimitive.Close
const DrawerPortal = DialogPrimitive.Portal

const DrawerOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
))
DrawerOverlay.displayName = 'DrawerOverlay'

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: 'right' | 'left'
    showClose?: boolean
  }
>(({ className, children, side = 'right', showClose = true, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-y-0 z-50 flex w-full max-w-lg flex-col bg-elevated text-foreground outline-none',
        side === 'right' ? 'right-0' : 'left-0',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        side === 'right'
          ? 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
          : 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
        className,
      )}
      {...props}
    >
      {children}
      {showClose ? (
        <DialogPrimitive.Close
          className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-inset hover:text-foreground focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          aria-label="Закрыть"
        >
          <X size={16} />
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = 'DrawerContent'

function DrawerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div
      className={cn('flex flex-col gap-1.5 border-b border-border px-5 py-4 pr-12', className)}
      {...props}
    />
  )
}

function DrawerBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', className)} {...props} />
}

function DrawerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('border-t border-border px-5 py-4', className)} {...props} />
}

const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('font-display text-lg font-semibold tracking-tight', className)}
    {...props}
  />
))
DrawerTitle.displayName = 'DrawerTitle'

const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DrawerDescription.displayName = 'DrawerDescription'

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
