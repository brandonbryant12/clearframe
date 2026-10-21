import { AsyncLocalStorage } from 'node:async_hooks';
import * as Effect from 'effect/Effect';

class CommandScope {
  readonly controller = new AbortController();
  readonly pending = new Set<Promise<void>>();
  readonly cleanups = new Set<() => Promise<void>>();
  closing = false;

  track<A>(promise: Promise<A>): Promise<A> {
    const settled = promise.then(
      () => undefined,
      () => undefined,
    );
    this.pending.add(settled);
    void settled.then(() => this.pending.delete(settled));
    return promise;
  }

  register(cleanup: () => Promise<void>): void {
    if (this.closing) this.track(cleanup());
    else this.cleanups.add(cleanup);
  }

  async close(): Promise<void> {
    this.closing = true;
    this.controller.abort();
    const cleanup = Promise.allSettled(
      [...this.cleanups].map((release) => release()),
    );
    while (this.pending.size) await Promise.all([...this.pending]);
    const failures = (await cleanup).filter(
      (result) => result.status === 'rejected',
    );
    if (failures.length)
      throw new AggregateError(
        failures.map((result) => result.reason),
        'Command shutdown failed.',
      );
  }
}

const current = new AsyncLocalStorage<CommandScope>();

/** Promise adapters inherit the CLI's lifetime, and its finalizer joins their child Effects. */
export function runCommandEffect<A, E>(
  effect: Effect.Effect<A, E>,
  signal?: AbortSignal,
): Promise<A> {
  const scope = current.getStore();
  const signals = [scope?.controller.signal, signal].filter(
    (value): value is AbortSignal => value !== undefined,
  );
  const abort = signals.length ? AbortSignal.any(signals) : undefined;
  const promise = Effect.runPromise(
    effect,
    abort ? { signal: abort } : undefined,
  );
  return scope ? scope.track(promise) : promise;
}

/** Register a non-Effect resource, such as the HTTP studio, with the current command scope. */
export function onCommandShutdown(cleanup: () => Promise<void>): boolean {
  const scope = current.getStore();
  if (!scope) return false;
  scope.register(cleanup);
  return true;
}

export const hasCommandScope = () => current.getStore() !== undefined;

/** Keep NodeRuntime's signal handling, but complete owned Promise work before its teardown exits. */
export function commandScope<A, E>(
  execute: () => Promise<A>,
  failure: (cause: unknown) => E,
): Effect.Effect<A, E> {
  return Effect.acquireUseRelease(
    Effect.sync(() => new CommandScope()),
    (scope) =>
      Effect.tryPromise({
        try: () => scope.track(current.run(scope, execute)),
        catch: failure,
      }),
    (scope) => Effect.promise(() => scope.close()),
  );
}
