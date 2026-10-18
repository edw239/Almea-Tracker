import type { ReactElement, ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { cn } from '../lib/utils';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (
    options: ConfirmOptions & { defaultValue?: string; placeholder?: string },
  ) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type Mode = 'confirm' | 'prompt';

interface DialogState extends ConfirmOptions {
  mode: Mode;
  open: boolean;
  defaultValue?: string;
  placeholder?: string;
}

const INITIAL: DialogState = {
  mode: 'confirm',
  open: false,
  title: '',
};

export function ConfirmProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, setState] = useState<DialogState>(INITIAL);
  const [promptValue, setPromptValue] = useState('');
  const resolverRef = useRef<((value: boolean | string | null) => void) | null>(null);

  const close = useCallback((result: boolean | string | null) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(INITIAL);
    setPromptValue('');
  }, []);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = (value) => resolve(Boolean(value));
      setState({ ...options, mode: 'confirm', open: true });
    });
  }, []);

  const prompt = useCallback(
    (
      options: ConfirmOptions & { defaultValue?: string; placeholder?: string },
    ): Promise<string | null> => {
      return new Promise((resolve) => {
        resolverRef.current = (value) => {
          if (typeof value === 'string') resolve(value);
          else resolve(null);
        };
        setPromptValue(options.defaultValue ?? '');
        setState({
          ...options,
          mode: 'prompt',
          open: true,
          defaultValue: options.defaultValue,
          placeholder: options.placeholder,
        });
      });
    },
    [],
  );

  const value = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  const handleConfirm = (): void => {
    if (state.mode === 'prompt') {
      const trimmed = promptValue.trim();
      if (!trimmed) return;
      close(trimmed);
      return;
    }
    close(true);
  };

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <AlertDialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) close(state.mode === 'prompt' ? null : false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state.title}</AlertDialogTitle>
            {state.description ? (
              <AlertDialogDescription asChild={typeof state.description !== 'string'}>
                {typeof state.description === 'string' ? (
                  state.description
                ) : (
                  <div>{state.description}</div>
                )}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          {state.mode === 'prompt' ? (
            <input
              className="input-field px-3 py-2 text-sm"
              value={promptValue}
              placeholder={state.placeholder}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              autoFocus
            />
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{state.cancelLabel ?? 'Отмена'}</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                state.destructive && 'bg-destructive text-destructive-foreground hover:opacity-90',
              )}
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={state.mode === 'prompt' && promptValue.trim().length === 0}
            >
              {state.confirmLabel ?? (state.mode === 'prompt' ? 'Сохранить' : 'Подтвердить')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx;
}
