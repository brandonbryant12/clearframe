import type { MechanismEntry } from './contracts.mjs';

export const mechanisms3: MechanismEntry[] = [
  [
    'rate-functions',
    "Motion with character, from Manim's rate functions (MIT): thereAndBack (go and return: point at a thing), wiggle (draw the eye), runningStart (pull back, then go), overshoot, rushInto, rushFrom, lingering, doubleSmooth, smooth, decay.",
    'a nudge that returns, a highlight that pulses once, a move with anticipation, a settle that overshoots',
    'ease on any key or route: {ease: "thereAndBack"}',
    'scene/native/THIRD_PARTY.md',
    {
      block: 'canvas',
      props: {
        elements: [
          {
            type: 'circle',
            cx: 960,
            cy: 540,
            r: 80,
            fill: 'accent',
            origin: [960, 540],
            keys: [{ say: 'this', scale: 1.4, dur: 0.6, ease: 'thereAndBack' }],
          },
        ],
      },
    },
  ],
  [
    'board',
    'Several pictures as panels of one world (place: [x, y]): the camera holds close on each, travels across the gaps, then pulls back to show them side by side, each still alive: the relation between each detail and the whole.',
    'a showreel, a recap, a product tour, a story in a few moments, "together they are…"',
    'canvas props.world + view + place',
    'docs/canvas.md',
    {
      beats: [
        {
          block: 'canvas',
          props: {
            world: 'board',
            view: [0, 0, 1920, 1080],
            place: [0, 0],
            sketch: 'compose',
          },
        },
        {
          block: 'canvas',
          props: {
            world: 'board',
            view: [2080, 0, 1920, 1080],
            place: [2080, 0],
            sketch: 'portal',
          },
        },
        {
          block: 'canvas',
          props: {
            world: 'board',
            view: [-260, -530, 4520, 2543],
            elements: [
              {
                type: 'text',
                text: 'The line that ties them together',
                x: 1960,
                y: 1400,
                size: 150,
                anchor: 'middle',
                say: 'together',
              },
            ],
          },
        },
      ],
      note: 'place moves and scales a drawing but does not clip it: cover gaps with bg rects in the last beat if a drawing spills. Words the whole view would shrink should exitAt after their beat.',
    },
  ],
  [
    'world',
    'One drawing the camera travels through across several scenes (world + view), so the film moves through a place instead of cutting between slides.',
    'a journey, a process in stations, a map, a pull-back to the whole',
    'canvas props.world + view',
    'docs/canvas.md',
    null,
  ],
  [
    'into',
    'A cut that goes through something: the camera moves forward through an element of the last scene (an app screen, a policy page, one tile of a share) until it overfills the frame, and the next scene comes up inside it.',
    'a turn in the story: from the figure into one of the cases it counts, from the phone into its screen, from the page into its clause',
    'beat into: "element id" (the transition)',
    'docs/style.md',
    null,
  ],
];
