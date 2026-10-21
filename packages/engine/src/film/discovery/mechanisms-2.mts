import type { MechanismEntry } from './contracts.mjs';

export const mechanisms2: MechanismEntry[] = [
  [
    'graph',
    'How an input changes an output: a curve from a stated formula, a point that rides it as the input moves, dashed guides to both axes, and labelled marks. Shows a shape, not data (no tick numbers).',
    'dose and response, price and demand, practice and skill (diminishing returns), how busy a system is and how long you wait (a queue), growth that compounds, a cycle',
    'canvas props.graph: fn {kind: linear|power|exponential|logistic|saturating|log|queue|wave|bell, …params}, x, y labels, sweep {from,to,say}, marks',
    'docs/canvas.md',
    {
      block: 'canvas',
      props: {
        graph: {
          fn: { kind: 'queue', measure: 'waiting' },
          x: { domain: [0, 0.95], label: 'How busy the desk is' },
          y: { label: 'People waiting' },
          sweep: { from: 0.1, to: 0.92, say: 'busier', dur: 3 },
          marks: [{ x: 0.5, label: 'half busy', say: 'half' }],
        },
      },
    },
  ],
  [
    'accumulate',
    'Small amounts adding up: a rate over time is cut into equal steps that appear in order under the curve, then lift and stack into one column whose height is their sum (normalised, not on the rate axis).',
    'savings or debt building up, rain filling a reservoir, small daily habits compounding into a result, distance from speed, a backlog growing from a steady inflow',
    'canvas props.accumulate: rate {kind,…}, steps 4–24, rateLabel, totalLabel, fill {say}, stack {say}',
    'docs/canvas.md',
    {
      block: 'canvas',
      props: {
        accumulate: {
          rate: { kind: 'saturating', L: 1, k: 3 },
          x: { domain: [0, 1], label: 'Weeks' },
          rateLabel: 'Saved each week',
          totalLabel: 'Saved so far',
          steps: 12,
          fill: { say: 'each' },
          stack: { say: 'together' },
        },
      },
    },
  ],
  [
    'estimate',
    'Noisy measurements settling into an estimate: simulated readings scatter around a value, their running average steadies, a band of ±1 standard error narrows with more of them, and the same dots gather into the spread of outcomes. More samples shrink random error, assuming independent, fairly drawn samples; they do not remove bias. Labelled Simulated.',
    'why the average of a few reviews or survey answers swings by chance and many swing less (if they are a fair sample), sensor or lab readings averaging out, why an A/B test needs enough users to see past noise (not past a flawed setup), sampling error in a poll (not who was asked), why one bad week is not a trend',
    'canvas props.estimate: value, spread, bias, count 8–60, seed, label, meanLabel, trueLabel, show {say,dur}, gather {say}',
    'docs/canvas.md',
    {
      block: 'canvas',
      props: {
        estimate: {
          count: 36,
          seed: 11,
          label: 'Each review',
          meanLabel: 'Average so far',
          trueLabel: 'What it is really like',
          show: { say: 'arrive', dur: 4 },
          gather: { say: 'spread' },
        },
      },
    },
  ],
  [
    'field',
    'Where things flow: arrows show the push at every point of a flow field and particles follow its numerically integrated streamlines at a constant pace (routes follow the field; speeds do not), so where things end up is a consequence of the field. The field is a chosen shape, not a fitted model.',
    'wind and currents, optimisation sliding downhill (a valley), a cycle that keeps going (a swirl); as a qualitative metaphor only, not a validated crowd or market simulation: shoppers drifting toward a checkout or a market settling to equilibrium (a sink), two pulls in tension (a saddle)',
    'canvas props.field: kind drift|swirl|source|sink|saddle|valley, particles, flow {say,dur}, labels [{text,pos}]',
    'docs/canvas.md',
    {
      block: 'canvas',
      props: {
        field: {
          kind: 'sink',
          particles: 18,
          flow: { say: 'drift', dur: 4 },
          labels: [{ text: 'checkout', pos: [0, -0.15] }],
        },
      },
    },
  ],
];
