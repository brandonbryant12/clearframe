import { frame } from './_material-kit.mjs';

// A landscape has room for object and copy side by side. Squarer frames put the
// object below the copy; merely shrinking the landscape layout would crop its edge.
export const studyFrame = (w, h) => {
  const f = frame(w, h);
  if (w > h * 1.1) return f;
  if (h > w * 1.5) return f;
  return { ...f, cx: w * 0.53, cy: h * 0.70, m: f.m * (h > w * 1.1 ? 0.86 : 0.72) };
};
