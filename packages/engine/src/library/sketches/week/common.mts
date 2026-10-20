export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    days?: number;
    today?: number;
    due?: number;
    tasks?: number[];
    after?: boolean;
  };
}

// One working week, for "three small things by Friday": five day columns (seven with the
// weekend), the start day marked as today, up to four task cards that drop into the days they
// belong to on their words, and the due day circled by hand with a short label in that day.
// An optional "after" card sits past the week's edge: on its word an arrow pushes out to it and a
// copy of the due label rides the arrow, so missing the day reads as something that slips.
// Wide frames lay the days out as columns; square and tall frames stack them as rows (an agenda)
// sized to fill the frame. The week, its days and the tasks' days come from sketchParams; no
// month or date is drawn. Moments: ONE … FOUR (each task), DUE, AFTER (with after) and TODAY
// (on any word).
export const WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const CUES = ['ONE', 'TWO', 'THREE', 'FOUR'] as const;
