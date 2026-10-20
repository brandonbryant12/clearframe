import type { CanvasElement, Fail } from '../types.mjs';

interface PathCursor {
  index: number;
  command: string | null;
  x: number;
  y: number;
  startX: number;
  startY: number;
}

function tokensForPath(
  data: string,
  label: string,
  fail: Fail,
): (number | string)[] {
  const space = /\s*,?\s*/y;
  const command = /[MLHVZmlhvz]/y;
  const number = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
  const tokens: (number | string)[] = [];
  let at = 0;
  while (at < data.length) {
    space.lastIndex = at;
    space.exec(data);
    const tokenAt = space.lastIndex;
    command.lastIndex = tokenAt;
    const letter = command.exec(data);
    if (letter) {
      tokens.push(letter[0]);
      at = command.lastIndex;
      continue;
    }
    number.lastIndex = tokenAt;
    const numeric = number.exec(data);
    if (!numeric)
      fail(
        `${label} has path data that cannot be read exactly at "${data.slice(at, at + 12).trim()}"`,
      );
    tokens.push(Number(numeric[0]));
    at = number.lastIndex;
  }
  return tokens;
}

function nextNumber(
  tokens: readonly (number | string)[],
  cursor: PathCursor,
  label: string,
  fail: Fail,
): number {
  const value = tokens[cursor.index++];
  if (typeof value !== 'number' || !Number.isFinite(value))
    fail(`${label} has a ${cursor.command} without its numbers`);
  return value;
}

function moveCursor(
  tokens: readonly (number | string)[],
  cursor: PathCursor,
  label: string,
  fail: Fail,
): void {
  const command = cursor.command;
  if (command == null || command.toLowerCase() === 'z')
    fail(`${label} has a number with no command before it`);
  const relative = command === command.toLowerCase();
  const originX = relative ? cursor.x : 0;
  const originY = relative ? cursor.y : 0;
  switch (command.toLowerCase()) {
    case 'm':
      cursor.x = originX + nextNumber(tokens, cursor, label, fail);
      cursor.y = originY + nextNumber(tokens, cursor, label, fail);
      cursor.startX = cursor.x;
      cursor.startY = cursor.y;
      cursor.command = relative ? 'l' : 'L';
      break;
    case 'l':
      cursor.x = originX + nextNumber(tokens, cursor, label, fail);
      cursor.y = originY + nextNumber(tokens, cursor, label, fail);
      break;
    case 'h':
      cursor.x = originX + nextNumber(tokens, cursor, label, fail);
      break;
    case 'v':
      cursor.y = originY + nextNumber(tokens, cursor, label, fail);
      break;
  }
}

/** Straight SVG segments have exact bounds; curved paths require measured geometry. */
export function pathBox(
  element: CanvasElement,
  where: string,
  fail: Fail,
): number[] {
  const label = `${where}: ${element.id ?? 'a path'}`;
  const data = String(element.d).trim();
  if (/[CSQTAcsqta]/.test(data))
    fail(
      `${label} is curved; its exact box is not known here, so frame a shape around it`,
    );
  const tokens = tokensForPath(data, label, fail);
  const cursor: PathCursor = {
    index: 0,
    command: null,
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
  };
  const xs: number[] = [],
    ys: number[] = [];
  while (cursor.index < tokens.length) {
    const token = tokens[cursor.index];
    if (typeof token === 'string') {
      cursor.command = token;
      cursor.index++;
      if (token.toLowerCase() === 'z') {
        cursor.x = cursor.startX;
        cursor.y = cursor.startY;
      }
      continue;
    }
    moveCursor(tokens, cursor, label, fail);
    xs.push(cursor.x);
    ys.push(cursor.y);
  }
  if (!xs.length) fail(`${label} has no points`);
  const half =
    element.stroke != null && element.stroke !== 'none'
      ? (element.width ?? 2) / 2
      : 0;
  return [
    Math.min(...xs) - half,
    Math.min(...ys) - half,
    Math.max(...xs) + half,
    Math.max(...ys) + half,
  ];
}
