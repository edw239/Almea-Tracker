import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

import { toast } from 'sonner'
import { resetToastBridgeForTests, toastStoreError } from './toast-bridge'

describe('toastStoreError', () => {
  beforeEach(() => {
    resetToastBridgeForTests()
    vi.mocked(toast.error).mockClear()
  })

  it('shows an error toast', () => {
    toastStoreError('Не удалось сохранить')
    expect(toast.error).toHaveBeenCalledWith('Не удалось сохранить')
  })

  it('dedupes identical messages within the window', () => {
    toastStoreError('Ошибка')
    toastStoreError('Ошибка')
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('allows a different message immediately', () => {
    toastStoreError('A')
    toastStoreError('B')
    expect(toast.error).toHaveBeenCalledTimes(2)
  })
})
