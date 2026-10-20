// A window on a calendar: a month card draws, the opening day is marked, the open window sweeps
// across the weeks to the last day, which is circled as if by hand, and the days outside the
// window fall back. An optional "today" ring shows where the viewer stands. A key beside the
// card (below it in tall frames) says what each mark means. The month's length, its first
// weekday and the window come from sketchParams. Moments: OPEN, CLOSE (and TODAY when set).
export const AT = { OPEN: 1.0, CLOSE: 2.9, TODAY: 4.5 };

export const WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
