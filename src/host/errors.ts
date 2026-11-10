export class CwtoolsToolError extends Error {
  readonly name = 'CwtoolsToolError'

  constructor(
    readonly code: string,
    message: string,
    readonly nextSteps: readonly string[] = [],
  ) {
    super(nextSteps.length === 0 ? message : message + '\nNext steps:\n- ' + nextSteps.join('\n- '))
  }
}

export function abortError(reason?: unknown): Error {
  const error = reason instanceof Error ? reason : new Error(reason === undefined ? 'Operation cancelled.' : String(reason))
  error.name = 'AbortError'
  return error
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw abortError(signal.reason)
}

export async function awaitWithAbort<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return await promise
  throwIfAborted(signal)
  let listener: (() => void) | undefined
  const aborted = new Promise<never>((_, reject) => {
    listener = () => { reject(abortError(signal.reason)) }
    signal.addEventListener('abort', listener, { once: true })
  })
  try {
    return await Promise.race([promise, aborted])
  } finally {
    if (listener !== undefined) signal.removeEventListener('abort', listener)
  }
}
