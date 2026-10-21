export function inspectMetrics(side: boolean, compact: boolean) {
  if (side)
    return {
      fs: { from: 34, subject: 50, line: 34, button: 32, file: 30, label: 42 },
      pad: 52,
      badge: 28,
      avatar: 64,
      linkHeight: 80,
      callout: 84,
      bar: 84,
      buttonWidth: 300,
      buttonHeight: 58,
      buttonFont: 28,
      shieldRadius: 116,
      toastHeight: 100,
      toastFont: 37,
      pointerScale: 1.2,
    };
  if (compact)
    return {
      fs: { from: 30, subject: 40, line: 30, button: 30, file: 28, label: 34 },
      pad: 44,
      badge: 22,
      avatar: 60,
      linkHeight: 72,
      callout: 66,
      bar: 72,
      buttonWidth: 276,
      buttonHeight: 52,
      buttonFont: 27,
      shieldRadius: 84,
      toastHeight: 92,
      toastFont: 34,
      pointerScale: 1.25,
    };
  return {
    fs: { from: 34, subject: 46, line: 34, button: 34, file: 30, label: 38 },
    pad: 44,
    badge: 22,
    avatar: 60,
    linkHeight: 72,
    callout: 84,
    bar: 92,
    buttonWidth: 330,
    buttonHeight: 64,
    buttonFont: 31,
    shieldRadius: 124,
    toastHeight: 110,
    toastFont: 40,
    pointerScale: 1.4,
  };
}

export function rowAir(side: boolean, compact: boolean, attach: boolean) {
  if (compact || (side && attach)) return 1;
  return side ? 1.25 : 1.4;
}
