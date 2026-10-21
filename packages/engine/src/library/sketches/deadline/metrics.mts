export function deadlineMetrics(stacked: boolean, small: boolean) {
  if (stacked)
    return {
      legendLabel: 40,
      legendType: 36,
      legendRadius: 36,
      monthType: 52,
      monthBaseline: 78,
      dayType: 36,
      legendGap: 104,
      headerHeight: 172,
    };
  if (small)
    return {
      legendLabel: 30,
      legendType: 28,
      legendRadius: 30,
      monthType: 36,
      monthBaseline: 56,
      dayType: 28,
      legendGap: 100,
      headerHeight: 124,
    };
  return {
    legendLabel: 42,
    legendType: 34,
    legendRadius: 38,
    monthType: 44,
    monthBaseline: 62,
    dayType: 34,
    legendGap: 128,
    headerHeight: 136,
  };
}
