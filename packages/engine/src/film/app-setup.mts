import type {
  CanvasElement,
  ElementFields,
  Fail,
  FrameSize,
} from './types.mjs';
import type { AppInput } from './app-contracts.mjs';
import { round, APP_FIELDS, TIMING } from './app-common.mjs';
export function appSetup(
  input: AppInput,
  at: string,
  fail: Fail,
  canvas?: FrameSize,
) {
  for (const key of Object.keys(input))
    if (key !== 'type' && !APP_FIELDS.includes(key) && !TIMING.includes(key))
      fail(
        `${at}: unsupported app field ${key} (an app takes ${APP_FIELDS.join(', ')}, plus the timing fields every element takes)`,
      );
  // A tall frame gets the phone unless told otherwise, as `portal` does.
  const {
    type: _type,
    x = 0,
    y = 0,
    w: width,
    h: height,
    device = canvas && canvas.height > canvas.width * 1.2 ? 'phone' : 'window',
    title,
    tabs = [],
    heading,
    open,
    upload,
    fields = [],
    button,
    pages,
    size = 32,
    ...rest
  } = input;
  const id = rest.id ?? 'app';
  const phone = device === 'phone';
  if (!['window', 'phone'].includes(device))
    fail(`${at}.device must be window or phone`);
  if (typeof title !== 'string' || !title.trim() || title.length > 28)
    fail(`${at}.title must be the app's name, up to 28 characters`);
  if (
    !Array.isArray(tabs) ||
    tabs.length > 3 ||
    tabs.some((t) => typeof t !== 'string' || !t.trim() || t.length > 14)
  )
    fail(`${at}.tabs must be up to three short tab names`);
  if (!Number.isFinite(size) || size < 24 || size > 48)
    fail(`${at}.size must be 24–48 (the field type, in px)`);
  const s = size;
  // A window that is the scene's subject fills it; one beside something else says how wide.
  const w = width ?? (phone ? 640 : 1180);
  const pad = phone ? 44 : 48;
  const inner = w - pad * 2;
  const els: CanvasElement[] = [];
  const text = (
    t: string,
    tx: number,
    ty: number,
    px: number,
    font: string,
    fill: string,
    extra: ElementFields = {},
  ): CanvasElement => ({
    type: 'text',
    text: t,
    x: round(tx),
    y: round(ty),
    size: round(px),
    font,
    fill,
    ...extra,
  });
  const pill = (
    pid: string,
    px: number,
    py: number,
    pw: number,
    ph: number,
    label: string,
    {
      fill = 'surface',
      ink = 'ink',
      font = 'strong',
      stroke = fill === 'surface' ? 'muted' : 'none',
    }: { fill?: string; ink?: string; font?: string; stroke?: string } = {},
  ): CanvasElement => ({
    type: 'group',
    id: pid,
    children: [
      {
        type: 'rect',
        x: round(px),
        y: round(py),
        w: round(pw),
        h: round(ph),
        r: round(ph * 0.24),
        fill,
        stroke,
        width: 2,
      },
      text(label, px + pw / 2, py + ph * 0.64, s, font, ink, {
        anchor: 'middle',
      }),
    ],
  });
  const label = (t: string, lx: number, ly: number): CanvasElement =>
    text(t, lx, ly, s * 0.9, 'text', 'muted');
  const fieldH = round(s * 2.5);
  const used = new Set<string>();
  // Ids stay unique across pages: a part a later page repeats takes that page's number.
  const uid = (base: string, page: number): string => {
    if (used.has(base)) return `${base}-${page + 1}`;
    used.add(base);
    return base;
  };
  return {
    input,
    at,
    fail,
    canvas,
    id,
    x,
    y,
    height,
    rest,
    phone,
    title,
    tabs,
    heading,
    open,
    upload,
    fields,
    button,
    pages,
    s,
    w,
    pad,
    inner,
    els,
    text,
    pill,
    label,
    fieldH,
    uid,
    cy: phone ? 92 : 0,
  };
}
