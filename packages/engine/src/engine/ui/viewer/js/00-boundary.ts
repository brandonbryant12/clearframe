import { store } from './00-core.js';
// Everything the page reads from outside itself (the built page data, the local server, this
// browser's storage, the DOM it wrote) is checked here, once, into the models the page uses.
// A value that does not fit is refused with the place it broke, never passed on as if it fit.

export class DecodeError extends Error {
  constructor(
    readonly at: string,
    expected: string,
  ) {
    super(`Unexpected data at ${at}: expected ${expected}.`);
    this.name = 'DecodeError';
  }
}

/** Checks one value read at `at` (a path for the error) and returns it as the page's model. */
type Decoder<T> = (input: unknown, at: string) => T;

export function isRecord(
  input: unknown,
): input is Readonly<Record<string, unknown>> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
export function text(input: unknown, at: string): string {
  if (typeof input !== 'string') throw new DecodeError(at, 'text');
  return input;
}
export function numeric(input: unknown, at: string): number {
  if (typeof input !== 'number' || Number.isNaN(input))
    throw new DecodeError(at, 'a number');
  return input;
}
export function flag(input: unknown, at: string): boolean {
  if (typeof input !== 'boolean') throw new DecodeError(at, 'true or false');
  return input;
}
/** Words shown as they come: text, or a number written as text. */
export function words(input: unknown, at: string): string {
  if (typeof input === 'number') return String(input);
  return text(input, at);
}
export function listOf<T>(item: Decoder<T>): Decoder<T[]> {
  return (input, at) => {
    if (!Array.isArray(input)) throw new DecodeError(at, 'a list');
    return input.map((x, i) => item(x, `${at}[${i}]`));
  };
}
/** A list whose unreadable entries are dropped (this browser's own records, written by older pages). */
export function readableOf<T>(item: Decoder<T>): Decoder<T[]> {
  return (input, at) => {
    if (!Array.isArray(input)) throw new DecodeError(at, 'a list');
    const out: T[] = [];
    input.forEach((x, i) => {
      try {
        out.push(item(x, `${at}[${i}]`));
      } catch (e) {
        if (!(e instanceof DecodeError)) throw e;
      }
    });
    return out;
  };
}
export function oneOf<const T extends string>(
  values: readonly T[],
): Decoder<T> {
  return (input, at) => {
    const value = text(input, at),
      hit = values.find((v) => v === value);
    if (hit === undefined) throw new DecodeError(at, values.join(' or '));
    return hit;
  };
}

/** One object's fields: `req` must be present, `opt` may be missing (undefined) or null. */
export class Fields {
  private constructor(
    readonly raw: Readonly<Record<string, unknown>>,
    private readonly at: string,
  ) {}
  static of(input: unknown, at: string): Fields {
    if (!isRecord(input)) throw new DecodeError(at, 'an object');
    return new Fields(input, at);
  }
  req<T>(key: string, decode: Decoder<T>): T {
    return decode(this.raw[key], `${this.at}.${key}`);
  }
  opt<T>(key: string, decode: Decoder<T>): T | null | undefined {
    const value = this.raw[key];
    if (value === undefined || value === null) return value;
    return decode(value, `${this.at}.${key}`);
  }
}

/** This browser's saved value under `key`, or `fallback` when it is missing or no longer fits. */
export function stored<T>(key: string, decode: Decoder<T>, fallback: T): T {
  const value = store.get(key, null);
  if (value === null || value === undefined) return fallback;
  try {
    return decode(value, key);
  } catch (e) {
    if (e instanceof DecodeError) return fallback;
    throw e;
  }
}

// ---------------------------------------------------------------- requests

/** A refused request: the server's own words and its HTTP status. */
export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'RequestError';
  }
}
/** What went wrong, in words, and the HTTP status when a server answered (0 when none did). */
export function failureOf(e: unknown): { message: string; status: number } {
  if (!(e instanceof Error)) return { message: String(e), status: 0 };
  return {
    message: e.message,
    status: 'status' in e && typeof e.status === 'number' ? e.status : 0,
  };
}
/** The `error` a refusing server wrote in its JSON reply, if any. */
export function serverError(body: unknown): string | null {
  return isRecord(body) && typeof body.error === 'string' && body.error
    ? body.error
    : null;
}

// ---------------------------------------------------------------- the page's own elements

type ElementKind<T extends Element> = abstract new (...args: never[]) => T;

/** The element the page wrote at `selector` under `root`, of the kind it wrote there. */
export function find<T extends Element>(
  root: ParentNode,
  selector: string,
  kind: ElementKind<T>,
): T {
  const found = root.querySelector(selector);
  if (!(found instanceof kind))
    throw new Error(`The page lost its ${selector} element.`);
  return found;
}
export function byId<T extends Element>(id: string, kind: ElementKind<T>): T {
  const found = document.getElementById(id);
  if (!(found instanceof kind))
    throw new Error(`The page lost its #${id} element.`);
  return found;
}
export function byIdOptional<T extends Element>(
  id: string,
  kind: ElementKind<T>,
): T | null {
  const found = document.getElementById(id);
  return found instanceof kind ? found : null;
}
/** The nearest element matching `selector` from where an event happened. */
export function hit(e: Event, selector: string): HTMLElement | null {
  const target = e.target;
  if (!(target instanceof Element)) return null;
  const found = target.closest(selector);
  return found instanceof HTMLElement ? found : null;
}
/** A form control's value. Inputs, textareas and selects all carry one; anything else has none. */
export function valueOf(node: Element | null): string | null {
  return node && 'value' in node && typeof node.value === 'string'
    ? node.value
    : null;
}
/** Turn a button (or any control) on or off. */
export function setDisabled(node: Element | null, disabled: boolean): void {
  if (node && 'disabled' in node) node.disabled = disabled;
}
/** Whether focus is in a place where keys type words rather than drive the page. */
export function typingIn(pattern: RegExp): boolean {
  return pattern.test(document.activeElement?.tagName ?? '');
}
