import type { PictureMatcher } from './contracts.mjs';
export function matchesPicture(match: PictureMatcher, text: string): boolean {
  if (typeof match === 'function') return match(text);
  if (match instanceof RegExp) return match.test(text);
  return match.some((pattern) => pattern.test(text));
}
function afterPhrase(
  text: string,
  start: RegExp,
  end: RegExp,
  stop: RegExp,
): boolean {
  for (const found of text.matchAll(start)) {
    const tail = text.slice(found.index + found[0].length).split(stop, 1)[0];
    if (end.test(tail)) return true;
  }
  return false;
}
const DROP = /\b(fell|dropped|dipped|declined|slid|sank|tumbled)\b/gi;
const RECOVERY =
  /\b(recover(ed|y)|bounced back|rebound(ed)?|back (to|by|above|where))/i;
const LOSS =
  /\b(fell|dropped|dipped|declined|slid|sank|tumbled|lost|(was|were) down)/gi;
const PERCENT = /^( by)?( about| almost| nearly)? \d+(\.\d+)?( ?%| percent)/i;
const DATE_START = /\b(from|since|between|by|on) (the )?\d/i;
const MONTH_START =
  /\b(from|since|between|by|on) (the )?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
export function drawdownLine(text: string): boolean {
  if (
    /\bdraw-?downs?/i.test(text) ||
    /\bsharp (dip|drop|fall|decline|sell-?off)/i.test(text)
  )
    return true;
  if (afterPhrase(text, DROP, RECOVERY, /[.;]/)) return true;
  for (const found of text.matchAll(LOSS)) {
    const tail = text.slice(found.index + found[0].length);
    const percentage = tail.match(PERCENT);
    if (!percentage) continue;
    const dates = tail.slice(percentage[0].length).split(/[.;]/, 1)[0];
    if (DATE_START.test(dates) || MONTH_START.test(dates)) return true;
  }
  return false;
}
export function carryoverLine(text: string): boolean {
  const passive = /\b(do nothing|don'?t (do anything|make (any )?changes))\b/gi;
  const carries =
    /\b(carr(y|ies)|rolls?|stays?) (over|forward|into|the same)\b/i;
  if (afterPhrase(text, passive, carries, /\./)) return true;
  return [
    /\b(elections?|coverage|plans?|choices) (\w+ ){0,3}carr(y|ies) (over|forward|into)\b/i,
    /\b(elections?|coverage|plans?|choices) (\w+ ){0,3}rolls? (over|forward|into)\b/i,
  ].some((pattern) => pattern.test(text));
}
