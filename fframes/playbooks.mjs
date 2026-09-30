import fs from 'node:fs';
import path from 'node:path';
import { BLOCKS, blockByName, palette } from './catalog.mjs';
import { writeJSON, ffmpeg } from '../engine/lib/util.mjs';
import { wireframePNG } from './wireframe.mjs';
import { SKETCHES, sketch } from './sketches.mjs';
import { applyTreatment, directionTemplate, treatmentById } from './treatments.mjs';

// Example emphasis belongs to the example's wording; drop it when the text is replaced.
const beat = (block, vo, props = {}) => {
  const base = structuredClone(blockByName(block).example);
  if (('text' in props || 'title' in props) && !('emphasis' in props)) delete base.emphasis;
  // For headline blocks `text` and `title` are aliases; keep only the one the playbook set.
  if (['title', 'statement', 'endcard', 'chapter'].includes(block)) {
    if ('text' in props) delete base.title;
    if ('title' in props) delete base.text;
  }
  return { id: block, block, vo, props: { ...base, ...props } };
};
const end = beat('endcard', 'Choose one next step, and make its owner clear.');
/** Canvas props from a named sketch; storyboardFor redraws it for the requested frame. */
const drawn = name => ({ sketch: name, ...sketch(name) });
const p = (id, title, audience, inputs, beats, options = {}) => ({ id, title, audience, inputs, beats, ...options });
export const PLAYBOOKS = [
  p('concept-explainer', 'Explain a mechanism', 'A curious beginner', 'One concept, an example, a caveat', [
    beat('title', 'Headroom helps a system absorb the unexpected.', { text: 'Why headroom matters' }),
    beat('equation', 'Subtract demand from capacity. What remains is headroom.'),
    beat('waffle', 'Imagine seventy of a hundred slots are already occupied.'),
    beat('callout', 'An average can hide the moments when demand spikes.'),
    end,
  ]),
  p(
    'quarterly-update',
    'Report progress with context',
    'A team or leadership group',
    'Comparable metrics, dates, denominators, decisions',
    [
      beat('title', 'This sample update follows the work from demand to response.', { text: 'The quarter in context' }),
      beat('kpis', 'In this illustrative quarter, requests grew while response time fell.'),
      beat('line', 'The sample trend increased over six months.'),
      beat('delta', 'First response fell from four point two days to one point eight days.'),
      end,
    ],
  ),
  p(
    'decision-memo',
    'Make a trade-off explicit',
    'Decision makers',
    'Two options, consistent criteria, recommendation',
    [
      beat('title', 'A useful decision starts with the criteria.', { text: 'Choose the next approach' }),
      beat('compare', 'Large releases concentrate coordination. Smaller releases shorten feedback.'),
      beat('matrix', 'Compare setup effort, iteration, and control together.'),
      beat('callout', 'Prefer the option that is easier to test and reverse.', {
        label: 'Recommendation',
        text: 'Run a small, reversible trial.',
      }),
      end,
    ],
  ),
  p(
    'research-summary',
    'Separate a finding from its limits',
    'An informed general audience',
    'Source, method, result, uncertainty',
    [
      beat('title', 'Start with the question, then show what the evidence can support.', {
        text: 'What does the evidence say?',
      }),
      beat('steps', 'Define the sample, compare the outcomes, and check the limitations.', {
        items: [
          { title: 'Sample', detail: 'Who was included?' },
          { title: 'Method', detail: 'What was compared?' },
          { title: 'Limits', detail: 'What remains uncertain?' },
        ],
      }),
      beat('bars', 'These illustrative categories use the same baseline and units.'),
      beat('callout', 'A difference is not enough to establish its cause.', {
        text: 'Describe the uncertainty alongside the result.',
      }),
      end,
    ],
  ),
  p(
    'incident-review',
    'Explain an incident without blame',
    'Operators and stakeholders',
    'Verified timeline, impact, mitigation, follow-up',
    [
      beat('title', 'This fictional incident review follows detection through recovery.', {
        text: 'From detection to recovery',
      }),
      beat('timeline', 'The team detected the issue, contained it, and verified recovery.'),
      beat('steps', 'Find the trigger, describe the mechanism, and test the safeguard.', {
        items: [
          { title: 'Trigger', detail: 'What changed?' },
          { title: 'Mechanism', detail: 'How did it spread?' },
          { title: 'Safeguard', detail: 'How will we know?' },
        ],
      }),
      beat('list', 'Assign an owner, set a verification date, and close the loop.'),
      end,
    ],
    { theme: 'ink' },
  ),
  p(
    'product-walkthrough',
    'Show a workflow and its payoff',
    'A prospective user',
    'User problem, real steps, proof of outcome',
    [
      beat('title', 'Turn a request into a clear next action.', { text: 'A clearer handoff' }),
      beat('statement', 'A request stalls when the next owner is unclear.'),
      beat('steps', 'Capture the need, route it to an owner, and confirm the outcome.'),
      beat('compare', 'Compare the handoff before and after the workflow change.'),
      end,
    ],
    { theme: 'signal' },
  ),
  p(
    'vertical-short',
    'One idea for a small screen',
    'A social audience',
    'One claim, one example, one takeaway',
    [
      beat('statement', 'Busy is not the same as effective.'),
      beat('bars', 'In this illustrative workflow, routing takes the most time.'),
      beat('endcard', 'Start where the work waits.', {
        text: 'Measure the wait.',
        action: 'Choose one handoff to improve.',
      }),
    ],
    { format: 'vertical', captions: true, motion: 'snappy' },
  ),
  p(
    'speech-story',
    'Let speech drive the typography',
    'Viewers watching with or without sound',
    'A recording, exact transcript, measured word timestamps',
    [
      beat('kinetic', 'Make every word land exactly when you hear it.', { mode: 'highlight', maxWords: 6 }),
      beat('kinetic', 'Give the next thought room to breathe.', { mode: 'reveal', maxWords: 5 }),
      beat('kinetic', 'Then make the next step clear.', { mode: 'word', maxWords: 4 }),
    ],
    { format: 'vertical', theme: 'ink', captions: false },
  ),
  p(
    'myth-buster',
    'Correct a misconception',
    'An audience with a common assumption',
    'Myth, evidence, correction, caveat',
    [
      beat('statement', 'A high average does not mean every case is fast.', {
        text: 'Does a good average mean everyone is served?',
      }),
      beat('bars', 'Different stages can hide very different waits.'),
      beat('callout', 'Measure the tail as well as the center.', {
        label: 'The correction',
        text: 'Averages need context.',
      }),
      end,
    ],
    { theme: 'editorial' },
  ),
  p(
    'tutorial',
    'Teach a repeatable procedure',
    'A learner performing a task',
    'Prerequisites, ordered steps, expected result',
    [
      beat('title', 'Build a small experiment you can verify.', { text: 'A repeatable experiment' }),
      beat('list', 'Choose one metric, record a baseline, and name an owner.'),
      beat('steps', 'Make one change, measure it, and compare the result.', {
        items: [
          { title: 'Change', detail: 'One variable' },
          { title: 'Measure', detail: 'Same window' },
          { title: 'Compare', detail: 'Same definition' },
        ],
      }),
      beat('callout', 'A result is useful only when you can reproduce it.', {
        text: 'Record the conditions, not just the outcome.',
      }),
      end,
    ],
  ),
  p(
    'customer-story',
    'Connect a problem to a concrete outcome',
    'Prospective customers',
    'Attributed story, workflow, verified before and after',
    [
      beat('quote', 'The best handoff is the one nobody has to chase.'),
      beat('statement', 'The team needed a clearer owner for each request.', { text: 'One request. One clear owner.' }),
      beat('steps', 'Capture, route, resolve, and verify.'),
      beat('delta', 'This hypothetical example reduces response time from four point two to one point eight days.'),
      end,
    ],
    { theme: 'editorial' },
  ),
  p(
    'documentary-hybrid',
    'Ground a story in a brief visual insert',
    'A broad audience',
    'Verified story, optional reference plate, continuity brief',
    [
      beat('title', 'Use a visual moment to establish place, then return to the evidence.', {
        text: 'A story with a sense of place',
      }),
      beat('statement', 'Keep the visual language consistent across every scene.', {
        text: 'Carry one visual language through the film.',
      }),
      beat('quote', 'The best handoff is the one nobody has to chase.'),
      beat('timeline', 'Follow the sequence before drawing a conclusion.'),
      end,
    ],
    {
      theme: 'editorial',
      note: 'Replace the second beat with a 3–5 second image/video insert when it adds context. See docs/continuity.md; no paid asset is generated by scaffolding.',
    },
  ),
  p(
    'science-lesson',
    'Follow a question through an experiment',
    'Students and curious families',
    'A question, controlled comparison, observations and a trusted subject source',
    [
      beat('title', 'What could we learn by watching a seed?', {
        text: 'Start with a small question',
        support: 'An observation lesson, built around your own evidence.',
      }),
      beat('icon-grid', 'Gather a seed, a notebook, and a way to record what changes.', {
        title: 'Build an observation kit',
        items: [
          { icon: 'sprout', label: 'A subject', detail: 'Choose what to observe' },
          { icon: 'book-open', label: 'A notebook', detail: 'Record the conditions' },
          { icon: 'camera', label: 'A record', detail: 'Keep the framing consistent' },
        ],
      }),
      beat('flow', 'Ask a question, make a prediction, observe, and compare.', {
        title: 'Show how an idea is tested',
        nodes: [
          { icon: 'lightbulb', label: 'Ask' },
          { icon: 'pencil', label: 'Predict' },
          { icon: 'microscope', label: 'Observe' },
          { icon: 'book-open', label: 'Compare' },
        ],
      }),
      beat('callout', 'A prediction and an observation are different things.', {
        label: 'Think like a scientist',
        text: 'Separate what you expected from what you saw.',
        support: 'Use the actual observations in your final film.',
      }),
      beat('endcard', 'What question would you test next?', {
        text: 'Keep the question open.',
        support: 'One observation can lead to another.',
        action: 'Write your next question.',
      }),
    ],
    { theme: 'signal' },
  ),
  p(
    'cooking-guide',
    'Teach a recipe through preparation and visible checkpoints',
    'Home cooks',
    'Your tested recipe, ingredient quantities, steps and real result images',
    [
      beat('title', 'A good recipe shows what to look for, not just what to do.', {
        text: 'Make a simple herb sauce',
        support: 'Replace this outline with your own tested recipe.',
      }),
      beat('icon-grid', 'Set out the ingredients and tools before you begin.', {
        title: 'Get everything ready',
        items: [
          { icon: 'leaf', label: 'Fresh herbs', detail: 'Use your recipe quantities' },
          { icon: 'utensils', label: 'Mixing bowl', detail: 'Keep the work area ready' },
          { icon: 'chef-hat', label: 'Your base', detail: 'Choose a tested recipe' },
        ],
      }),
      beat('flow', 'Prepare the herbs, combine the ingredients, then taste and adjust.', {
        title: 'Watch the texture change',
        nodes: [
          { icon: 'leaf', label: 'Prepare', detail: 'Show the cut or chop' },
          { icon: 'utensils', label: 'Combine', detail: 'Show the consistency' },
          { icon: 'check', label: 'Adjust', detail: 'Describe your result' },
        ],
      }),
      beat('endcard', 'Save the version you want to make again.', {
        text: 'Make it your own.',
        support: 'Record the quantities and the result.',
        action: 'Add your tested variations.',
      }),
    ],
    {
      theme: 'editorial',
      note: 'Replace one beat with a real close-up when texture matters. Use authored steps and source footage rather than generated instructions or fabricated results.',
    },
  ),
  p(
    'travel-story',
    'Tell a small story about a place',
    'Friends, family and curious travelers',
    'Your route, personal observations, permission-cleared photos and accurate place names',
    [
      beat('title', 'Tell the story of a day through the details you noticed.', {
        text: 'An afternoon worth remembering',
        support: 'A fictional itinerary to replace with your own trip.',
      }),
      beat('timeline', 'Start with the first stop, then follow the day as it happened.', {
        title: 'A day at walking pace',
        items: [
          { label: 'Morning', title: 'A quiet street', detail: 'What first caught your eye?' },
          { label: 'Afternoon', title: 'A favorite corner', detail: 'One detail worth keeping' },
          { label: 'Evening', title: 'The way back', detail: 'What changed by the end?' },
        ],
      }),
      beat('icon-grid', 'A sound, a color, and a small encounter can carry a place.', {
        title: 'Keep the details',
        items: [
          { icon: 'music', label: 'A sound' },
          { icon: 'palette', label: 'A color' },
          { icon: 'map-pin', label: 'A place' },
        ],
      }),
      beat('quote', 'Replace this with a real memory in your own words.', {
        text: 'One small detail brought the whole afternoon back.',
        author: 'Fictional sample recollection',
        role: 'Replace with your own memory',
      }),
      beat('endcard', 'What will you remember from your next walk?', {
        text: 'Bring back a detail.',
        support: 'Use your own photos, recordings and words.',
        action: 'Keep a small travel journal.',
      }),
    ],
    {
      theme: 'editorial',
      note: 'Insert your own image/video plates between native scenes. Generated establishing shots must be labelled illustrative; do not present them as footage of your trip.',
    },
  ),
  p(
    'language-practice',
    'Listen, follow the words, then try the phrase',
    'Language learners',
    'A reviewed recording, exact transcript, measured word timings and a checked translation',
    [
      beat('title', 'Listen once. Then follow the words as you hear them.', {
        text: 'Hear it. See it. Try it.',
        support: 'Use a reviewed recording in your chosen language.',
      }),
      beat('kinetic', 'Where is the train station?', { mode: 'highlight', align: 'center', maxWords: 6 }),
      beat('callout', 'Pause the video and try the phrase yourself.', {
        label: 'Your turn',
        text: 'Say the phrase in your own voice.',
        support: 'Replay the recording and compare.',
      }),
      beat('kinetic', 'Where is the train station?', { mode: 'reveal', align: 'center', maxWords: 6 }),
      beat('endcard', 'Try using the phrase in a different situation.', {
        text: 'Make it useful.',
        support: 'Change one word and check the meaning.',
        action: 'Practice another short exchange.',
      }),
    ],
    {
      format: 'vertical',
      theme: 'ink',
      note: 'Use measured timing in the target language. Check font glyph coverage and pronunciation; do not infer those from a successful render.',
    },
  ),
  p(
    'personal-story',
    'Make a keepsake from a meaningful moment',
    'Friends and family',
    'Personal memories, names, dates and permission-cleared recordings or photos',
    [
      beat('title', 'Some stories begin with a moment you almost missed.', {
        text: 'The moment I kept',
        support: 'A personal story told in your own voice.',
      }),
      beat('quote', 'Replace this fictional line with the memory you want to preserve.', {
        text: 'I did not know it would become my favorite memory.',
        author: 'Fictional sample narrator',
        role: 'Replace with your own words',
      }),
      beat('timeline', 'Show what came before, what happened, and what stayed with you.', {
        title: 'Give the moment context',
        items: [
          { label: 'Before', title: 'An ordinary day', detail: 'Set the scene' },
          { label: 'The moment', title: 'Something changed', detail: 'Describe one concrete detail' },
          { label: 'After', title: 'What stayed', detail: 'Say why it matters' },
        ],
      }),
      beat('kinetic', 'This is the part I want to remember.', { mode: 'highlight', maxWords: 5 }),
      beat('endcard', 'Keep the story in your own words.', {
        text: 'A small story, kept.',
        support: 'Add the date and the people who shared it.',
        action: 'Save it for someone you love.',
      }),
    ],
    { theme: 'editorial' },
  ),
  p(
    'creative-process',
    'Show how a work develops through iteration',
    'Artists, makers and creative learners',
    'A real work in progress, process images and reflections',
    [
      beat('statement', 'The first version is a place to start.', {
        text: 'Make room for a rough first version.',
        support: 'Show the work as it changes.',
      }),
      beat('cycle', 'Imagine, make, observe, and refine.', { title: 'Let the work teach you', period: 8 }),
      beat('compare', 'Compare the intention with what the draft actually does.', {
        title: 'Look closely at the draft',
        left: { title: 'What I intended', items: ['A clear focal point', 'A quiet mood'] },
        right: { title: 'What I noticed', items: ['Too many competing shapes', 'A color worth keeping'] },
        verdict: 'Illustrative critique — replace with your own observations.',
      }),
      beat('endcard', 'Choose one change and make another version.', {
        text: 'Try the next version.',
        support: 'Keep the earlier draft so you can see the change.',
        action: 'Revise one thing.',
      }),
    ],
    { theme: 'ink' },
  ),
  p(
    'quiet-moment',
    'Create a gentle paced visual break',
    'Anyone who wants a brief pause',
    'Preferred phase labels, comfortable timing and an optional original soundtrack',
    [
      beat('title', 'Take a moment at your own pace.', {
        text: 'A little room to pause',
        support: 'Follow the visual only if the pace feels comfortable.',
      }),
      {
        id: 'breathing',
        block: 'breathing',
        duration: 28,
        props: {
          ...structuredClone(blockByName('breathing').example),
          title: 'Find your own rhythm',
          source: 'Optional visual pacing · no health claim',
        },
      },
      beat('endcard', 'Return when you are ready.', {
        text: 'Continue at your own pace.',
        support: 'A small pause can simply be a pause.',
        action: '',
      }),
    ],
    {
      theme: 'ink',
      motion: 'gentle',
      note: 'Phase durations are editable. This is a visual pacing exercise, not a therapeutic protocol or a promised health outcome.',
    },
  ),
  p(
    'data-story',
    'Tell a story with a few trustworthy numbers',
    'A general audience meeting the numbers for the first time',
    'Three to five sourced figures, their dates and denominators',
    [
      beat('chapter', 'First, the scale of the problem.', {
        number: '01',
        title: 'How much time a request really takes',
        support: 'An illustrative week, measured end to end.',
      }),
      beat('stat', 'A typical request waits more than four days for its first answer.'),
      beat('magnitude', 'One team, one company and one city ask the same question at very different scales.'),
      beat('donut', 'Most of that time goes to answering and routing, not the work itself.'),
      beat('highlight', 'An average can hide a long tail of slow requests.'),
      beat('endcard', 'Measure the wait before you change the process.', {
        title: 'Start with the wait.',
        support: 'One number, measured the same way every week.',
        action: 'Pick your first metric',
      }),
    ],
    { theme: 'midnight', backdrop: 'glow' },
  ),
  p(
    'screen-walkthrough',
    'Walk through a screen in the order people should read it',
    'New users of a product or report',
    'An approved screenshot, the reading order and one outcome per step',
    [
      beat('title', 'Here is how to read the weekly dashboard in under a minute.', {
        text: 'Read the dashboard in order',
        support: 'Three stops, one decision.',
      }),
      beat('annotate', 'Start with the total, then look at the week that stands out.', {
        title: 'Two stops before any decision',
        file: 'assets/screen.png',
        label: 'Illustrative wireframe',
      }),
      beat('checklist', 'Check the total, find the outlier, and decide who follows up.', {
        title: 'Your weekly routine',
        items: [
          { text: 'Read the total' },
          { text: 'Find the outlier week' },
          { text: 'Name one owner for follow-up' },
        ],
      }),
      beat('endcard', 'Use the same order every week.', {
        text: 'Same screen. Same order.',
        support: 'Consistency makes the changes stand out.',
        action: 'Open this week’s dashboard',
      }),
    ],
    {
      theme: 'signal',
      note: 'assets/screen.png is a generated, text-free wireframe. Replace it with an approved screenshot and move the pins (x/y from 0 to 1 across the image) onto the real elements.',
    },
  ),
  p(
    'checklist-guide',
    'Help someone get ready, one item at a time',
    'Anyone preparing for a task or trip',
    'A tested checklist, the reason for each item and one safety or quality note',
    [
      beat('title', 'Before a long walk, a short checklist saves a lot of trouble.', {
        text: 'Ready for a long walk',
        support: 'An illustrative packing list; adapt it to your route.',
      }),
      beat('checklist', 'Water, a map, a layer for the weather and a charged phone.', {
        title: 'Pack the essentials',
        items: [
          { text: 'Water for the whole route' },
          { text: 'A map that works offline' },
          { text: 'A layer for the weather' },
          { text: 'A charged phone' },
        ],
      }),
      beat('icon-grid', 'Then think about the conditions you will actually meet.', {
        title: 'Check the conditions',
        items: [
          { icon: 'sun', label: 'Daylight', detail: 'Know when it ends' },
          { icon: 'cloud-rain', label: 'Weather', detail: 'Check the forecast' },
          { icon: 'map-pin', label: 'Route', detail: 'Share it with someone' },
        ],
      }),
      beat('callout', 'Tell someone where you are going and when you expect to return.', {
        label: 'One more thing',
        icon: 'user-check',
        text: 'Share your plan before you leave.',
        emphasis: ['Share your plan'],
      }),
      beat('endcard', 'Pack the night before so the morning is simple.', {
        text: 'Pack the night before.',
        support: 'A calm start makes a better walk.',
        action: 'Save this checklist',
      }),
    ],
    { theme: 'forest', backdrop: 'glow' },
  ),
  p(
    'year-in-review',
    'Look back on a year with a clear through-line',
    'A team, community or family',
    'Verified yearly figures, one trend, one quote and what comes next',
    [
      beat('chapter', 'Here is what the year looked like.', {
        number: '2026',
        title: 'A year in review',
        support: 'Illustrative figures to replace with your own.',
      }),
      beat('kpis', 'More requests arrived, and each one was answered faster.'),
      beat('line', 'The trend climbed steadily through the second half.'),
      beat('donut', 'Most of the time went to the work that mattered most.'),
      beat('quote', 'The best handoff is the one nobody has to chase.'),
      beat('endcard', 'Next year, keep what worked and change one thing.', {
        text: 'Keep what worked.',
        support: 'Change one thing, and measure it.',
        action: 'Plan the first quarter',
      }),
    ],
    { theme: 'ember', backdrop: 'glow' },
  ),
  p(
    'scale-explainer',
    'Make a very large number feel real',
    'Curious viewers facing an abstract figure',
    'One large figure, a trustworthy comparison and a human-scale unit',
    [
      beat('statement', 'Big numbers are hard to picture until you compare them.', {
        text: 'Big numbers need a comparison.',
        emphasis: ['comparison'],
      }),
      beat('magnitude', 'Seen as areas, the difference between these groups is easy to feel.'),
      beat('waffle', 'Out of every hundred people in this illustrative group, seventy take part.', {
        title: 'Seventy in every hundred',
        icon: 'user',
        value: 70,
        total: 100,
        cols: 10,
        label: 'An illustrative share, drawn one person at a time',
      }),
      beat('highlight', 'A comparison turns an abstract number into a picture you can hold.', {
        text: 'A comparison turns an abstract number into a picture.',
        phrases: ['a picture'],
      }),
      beat('endcard', 'Choose a comparison your audience already knows.', {
        text: 'Compare it to something familiar.',
        support: 'Areas, people and everyday objects work well.',
        action: 'Find your comparison',
      }),
    ],
    { theme: 'mono' },
  ),
  p(
    'research-digest',
    'Turn a long report into a question-led short film',
    'Busy readers who will not open the report',
    'An evidence brief (clearframe ingest --markdown): the question, 3–5 sourced claims, one tension',
    [
      {
        ...beat('stat', 'Thirty-seven percent. That one figure changes the question.', {
          value: 37,
          suffix: '%',
          label: 'The figure that reframes it',
          align: 'center',
          land: 'Thirty-seven',
        }),
        id: 'hook',
        tone: 'accent',
        transition: 'cut',
      },
      {
        ...beat('statement', 'So why do we still assume the opposite?', {
          text: 'Why do we assume the opposite?',
          emphasis: ['opposite'],
          emphasisStyle: 'serif',
          align: 'center',
          support: undefined,
        }),
        id: 'question',
        transition: 'panel',
      },
      {
        ...beat('canvas', 'Here is the mechanism, step by step: collect, clean, model, then ship.', {
          title: 'How it actually works',
          ...drawn('pipeline'),
        }),
        id: 'mechanism',
        transition: 'push',
      },
      {
        ...beat('bars', 'The evidence points one way, with a clear outlier.', {
          title: 'What the evidence shows',
          growSay: 'evidence',
        }),
        id: 'evidence',
        transition: 'push',
        art: {
          over: [
            {
              type: 'path',
              d: 'M 1510 330 C 1390 300 1210 330 1085 440',
              stroke: 'accent2',
              width: 6,
              arrow: 'end',
              say: 'outlier',
            },
            {
              type: 'text',
              text: 'The outlier',
              x: 1530,
              y: 330,
              size: 38,
              font: 'bold',
              fill: 'accent2',
              enter: 'type',
              say: 'outlier',
            },
          ],
        },
      },
      {
        ...beat('kinetic', 'But the average hides who is affected most.', {
          mode: 'stack',
          emphasis: ['average', 'most'],
          emphasisStyle: 'serif',
          maxWords: 5,
        }),
        id: 'turn',
        transition: 'iris',
      },
      {
        ...beat('callout', 'So act on the distribution, not the average.', {
          label: 'What it means',
          icon: 'lightbulb',
          text: 'Act on the distribution.',
          emphasis: ['distribution'],
        }),
        id: 'meaning',
        transition: 'fade',
      },
      {
        ...beat('endcard', 'The methods and the limits are in the full report.', {
          text: 'Read the whole story.',
          action: 'Open the report',
        }),
        id: 'end',
        transition: 'fade',
      },
    ],
    {
      theme: 'noir',
      backdrop: 'glow',
      motion: 'spring',
      texture: { grain: 0.35, vignette: 0.5 },
      frame: { brand: 'Research digest', left: 'Sources on screen', right: 'Illustrative sample' },
      note: "Start from clearframe ingest --markdown report.md: it writes BRIEF.md with every figure, its sentence and its source, plus tensions and chart-ready tables. Replace every sample claim; lead with the question and the surprise, not the report's section order.",
    },
  ),
  p(
    'podcast-clip',
    'Cut a podcast moment into a vertical social clip',
    'Listeners scrolling a feed',
    'A recording and word timestamps (clearframe ingest --audio), one self-contained moment of 30–60 s',
    [
      {
        ...beat('kinetic', 'Here is the one thing nobody tells you about starting.', {
          mode: 'stack',
          emphasis: ['nobody', 'starting'],
          emphasisStyle: 'serif',
          maxWords: 6,
        }),
        id: 'hook',
        speaker: 'host',
        transition: 'cut',
      },
      {
        ...beat('kinetic', 'You do not need permission. You need a first draft that exists.', {
          mode: 'highlight',
          align: 'center',
          maxWords: 5,
        }),
        id: 'answer',
        speaker: 'guest',
        transition: 'whip',
      },
      {
        ...beat('quote', 'A first draft is a promise you make to yourself.', {
          text: 'A first draft is a promise you make to yourself.',
          author: 'Guest',
          role: 'Fictional sample quotation',
        }),
        id: 'pull',
        speaker: 'guest',
        transition: 'panel',
        tone: 'accent',
      },
      {
        ...beat('kinetic', 'So write it badly, and write it today.', {
          mode: 'stack',
          emphasis: ['badly', 'today'],
          maxWords: 6,
        }),
        id: 'close',
        speaker: 'host',
        transition: 'whip',
      },
      {
        ...beat('endcard', 'Hear the full conversation in the latest episode.', {
          text: 'Hear the whole conversation.',
          support: 'Episode link in the description.',
          action: 'Listen to the episode',
          align: 'center',
        }),
        id: 'end',
        transition: 'iris',
      },
    ],
    {
      theme: 'electric',
      backdrop: 'glow',
      motion: 'snappy',
      format: 'vertical',
      texture: { grain: 0.3, vignette: 0.5 },
      speakers: {
        host: { name: 'Host', role: 'Sample podcast', color: 'accent' },
        guest: { name: 'Guest', role: 'Sample guest', color: 'accent2' },
      },
      note: 'Import the real recording with clearframe ingest --audio episode.wav --words words.json --from START --to END --vertical. Every beat then plays its exact slice of the recording; keep the words as captions where they carry the moment, and give the rest pictures.',
    },
  ),
  p(
    'brand-spot',
    'A short, designed spot with an editorial frame',
    'Launch, announcement or channel intro',
    'One idea, three supporting beats, a call to action',
    [
      {
        ...beat('title', 'This film is drawn in code.', {
          text: 'This film is drawn in code.',
          emphasis: ['drawn'],
          emphasisStyle: 'serif',
        }),
        id: 'open',
        label: 'Introduction',
        art: {
          under: [
            {
              type: 'rect',
              x: 1300,
              y: 620,
              w: 420,
              h: 260,
              r: 30,
              fill: 'bg',
              stroke: 'accent',
              width: 3,
              rotate: -8,
              enter: 'pop',
              at: 0.6,
              echo: { count: 9, step: { x: -16, y: 6, rotate: -3 }, fade: 0.82 },
            },
          ],
        },
      },
      {
        ...beat('canvas', 'Every frame is a function of time.', {
          title: 'Every frame, on purpose',
          ...drawn('orbit'),
        }),
        id: 'system',
        label: 'How',
        transition: 'whip',
        tone: 'invert',
      },
      {
        ...beat('canvas', 'Then make it move.', drawn('burst')),
        id: 'move',
        label: 'Motion',
        transition: 'iris',
        transitionOrigin: [0.2, 0.8],
      },
      {
        ...beat('endcard', 'Now make yours.', {
          text: 'Now make yours.',
          emphasis: ['yours'],
          emphasisStyle: 'serif',
          action: 'Start a film',
        }),
        id: 'end',
        label: 'Your turn',
        transition: 'panel',
      },
    ],
    {
      theme: 'paper',
      motion: 'spring',
      texture: { grain: 0.3 },
      frame: { brand: 'clearframe', left: 'Made with ClearFrame', right: 'SVG / Rust / MP4' },
    },
  ),
  p(
    'journey',
    'A travelling-camera explainer: one drawing, explored stop by stop',
    'Anyone following a process, a supply chain, a route or a timeline',
    'Three to five stops in order, what happens at each, the whole at the end',
    [
      world(
        'source',
        'It starts as rain on the hills, collected in a reservoir.',
        [0, 0, 1920, 1080],
        [
          { type: 'rect', x: -1200, y: 820, w: 8000, h: 2400, fill: 'surface', enter: 'none', at: 0 },
          {
            type: 'path',
            d: 'M 0 820 L 260 520 L 420 660 L 640 380 L 900 700 L 1100 560 L 1350 820 Z',
            fill: 'muted',
            stroke: 'ink',
            width: 4,
            at: 0.1,
            dur: 1.4,
          },
          { type: 'particles', x: 150, y: 140, w: 900, h: 560, kind: 'rain', count: 80, fill: 'accent2', say: 'rain' },
          {
            type: 'path',
            d: 'M 1100 820 Q 1300 900 1560 860 L 1560 960 Q 1300 1000 1060 900 Z',
            fill: 'accent2',
            say: 'collected',
          },
          {
            type: 'text',
            text: 'Reservoir',
            x: 1600,
            y: 950,
            size: 56,
            font: 'bold',
            fill: 'ink',
            anchor: 'start',
            say: 'reservoir',
          },
        ],
      ),
      world(
        'plant',
        'But first, a pipe carries it to a plant that filters and cleans it.',
        [1500, 0, 1920, 1080],
        [
          {
            type: 'path',
            d: 'M 1560 900 L 2300 900 L 2300 760 L 2700 760',
            stroke: 'accent2',
            width: 22,
            say: 'pipe',
            dur: 1.4,
          },
          {
            type: 'rect',
            x: 2700,
            y: 560,
            w: 520,
            h: 260,
            r: 10,
            fill: 'surface',
            stroke: 'ink',
            width: 4,
            enter: 'grow-y',
            say: 'plant',
          },
          {
            type: 'circle',
            cx: 2830,
            cy: 690,
            r: 70,
            fill: 'none',
            stroke: 'accent',
            width: 10,
            say: 'filters',
            loop: { type: 'spin', period: 3 },
          },
          {
            type: 'circle',
            cx: 3090,
            cy: 690,
            r: 70,
            fill: 'none',
            stroke: 'accent',
            width: 10,
            say: 'cleans',
            loop: { type: 'spin', period: 3 },
          },
          {
            type: 'text',
            text: 'Treatment',
            x: 2960,
            y: 520,
            size: 56,
            font: 'bold',
            fill: 'ink',
            anchor: 'middle',
            say: 'plant',
          },
        ],
      ),
      world(
        'city',
        'Then a second network runs it under the streets, to every tap.',
        [3300, 0, 1920, 1080],
        [
          {
            type: 'path',
            d: 'M 3220 760 L 3500 760 L 3500 900 L 4900 900',
            stroke: 'accent2',
            width: 22,
            say: 'network',
            dur: 1.4,
          },
          {
            type: 'group',
            say: 'streets',
            stagger: 0.15,
            children: [3900, 4200, 4500, 4800].map(x => ({
              type: 'path',
              d: `M ${x} 820 L ${x} 680 L ${x + 110} 600 L ${x + 220} 680 L ${x + 220} 820 Z`,
              fill: 'surface',
              stroke: 'ink',
              width: 4,
            })),
          },
          {
            type: 'text',
            text: 'Your tap',
            x: 4400,
            y: 540,
            size: 56,
            font: 'bold',
            fill: 'ink',
            anchor: 'middle',
            say: 'every',
          },
          {
            type: 'circle',
            cx: 4610,
            cy: 860,
            r: 12,
            fill: 'accent2',
            say: 'tap',
            loop: { type: 'float', period: 1.2, amount: 8 },
          },
        ],
      ),
      world(
        'whole',
        'One journey, most of it out of sight.',
        [-100, -700, 5200, 2925],
        [
          {
            type: 'text',
            text: 'One journey',
            x: 2600,
            y: 300,
            size: 140,
            font: 'display',
            fill: 'accent',
            anchor: 'middle',
            say: 'journey',
          },
        ],
      ),
      {
        ...beat('endcard', 'So follow the water in your own city.', {
          text: 'Follow the water.',
          emphasis: ['water'],
          emphasisStyle: 'serif',
          support: 'Find your reservoir.',
          action: 'Start at the tap',
        }),
        id: 'end',
      },
    ],
    { theme: 'sketchbook', backdrop: 'paper', motion: 'spring', texture: { grain: 0.3 } },
  ),
];

/** One stop of a travelling-camera world: canvas props drawn in world coordinates. */
function world(id, vo, view, elements) {
  // A half-second tail lets each stop's last drawing be read before the camera moves on.
  return { id, block: 'canvas', vo, tail: 0.5, props: { world: 'journey', view, rough: true, elements } };
}

export function storyboardFor(id, { title, theme, vertical } = {}) {
  const book = PLAYBOOKS.find(p => p.id === id);
  if (!book) throw new Error(`Unknown playbook ${id}`);
  const sb = {
    version: 2,
    title: title ?? book.title,
    logline: book.title,
    format: { preset: vertical ? 'vertical' : (book.format ?? 'landscape'), fps: 30 },
    theme: theme ?? book.theme ?? 'paper',
    motion: { preset: book.motion ?? 'gentle', intensity: 0.65 },
    transition: 'fade',
    backdrop: book.backdrop ?? 'none',
    chrome: false,
    captions: book.captions ?? false,
    music: false,
    ...(book.texture ? { texture: book.texture } : {}),
    ...(book.frame ? { frame: book.frame } : {}),
    ...(book.speakers ? { speakers: book.speakers } : {}),
    ...(book.voice ? { voice: book.voice } : {}),
    sources: [{ id: 'sample', title: 'Hypothetical sample data and fictional quotations — replace before publishing' }],
    continuity: {
      maxGeneratedShare: 0.2,
      treatment: 'Restrained editorial graphics, generous space, no generated text',
      camera: 'Locked or a slow push',
      lighting: 'Soft, diffuse',
      motion: 'Slow left-to-right movement',
    },
    beats: structuredClone(book.beats),
  };
  // Sketch coordinates are frame pixels: re-draw them for the requested frame.
  for (const b of sb.beats) {
    const name = b.props?.sketch;
    if (!name) continue;
    if (vertical || book.format === 'vertical') b.props.elements = sketch(name, 'vertical').elements;
    delete b.props.sketch;
    delete b.props.view;
    delete b.props.stagger;
  }
  const ids = new Map();
  for (const b of sb.beats) {
    const n = (ids.get(b.id) ?? 0) + 1;
    ids.set(b.id, n);
    if (n > 1) b.id += `-${n}`;
  }
  palette(sb.theme);
  return sb;
}
export function scaffold(dir, options = {}) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`${dir} is not empty`);
  const id = options.playbook ?? options.recipe ?? 'concept-explainer',
    sb = storyboardFor(id, options),
    book = PLAYBOOKS.find(p => p.id === id);
  if (options.treatment) {
    applyTreatment(sb, options.treatment);
    if (options.theme) sb.theme = options.theme;
  }
  fs.mkdirSync(dir, { recursive: true });
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  fs.writeFileSync(
    path.join(dir, 'DIRECTION.md'),
    directionTemplate(sb, options.treatment ? treatmentById(options.treatment) : null),
  );
  // Placeholder screenshots are generated locally: text-free, palette-matched and clearly illustrative.
  if (sb.beats.some(b => b.props?.file === 'assets/screen.png')) {
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'assets/screen.png'), wireframePNG(palette(sb.theme)));
  }
  fs.writeFileSync(
    path.join(dir, 'BRIEF.md'),
    `# ${sb.title}\n\nPlaybook: ${id}\nAudience: ${book.audience}\nRequired inputs: ${book.inputs}\n\n${book.note ?? ''}\n\nReplace all sample claims and sources. Choose a palette and motion intensity in storyboard.json. The playbook is a starting structure: add, remove or reorder native blocks to serve the story.\n`,
  );
  return sb;
}
const GALLERY_SECONDS = {
  kinetic: 6,
  breathing: 8,
  cycle: 8,
  highlight: 5,
  donut: 5,
  magnitude: 5,
  checklist: 5,
  annotate: 6,
  kpis: 5,
  waffle: 5,
  delta: 5,
  canvas: 5,
};
/** Every canvas sketch as its own beat (ambient sketches sit under a statement). */
export function sketchGallery({ vertical = false, theme = 'paper', only } = {}) {
  const sb = storyboardFor('concept-explainer', { theme, vertical });
  sb.title = 'Canvas sketches';
  sb.backdrop = 'glow';
  sb.beats = SKETCHES.filter(s => !only || only.includes(s.name)).map(s => {
    const props = sketch(s.name, vertical ? 'vertical' : 'landscape');
    return props.layer === 'under'
      ? {
          id: s.name,
          block: 'statement',
          duration: 5,
          art: { under: props.elements },
          props: { text: 'A held frame that still breathes.' },
        }
      : {
          id: s.name,
          block: 'canvas',
          duration: 5,
          props: { kicker: 'Sketch', title: s.name[0].toUpperCase() + s.name.slice(1), elements: props.elements },
        };
  });
  return sb;
}
export async function writeGallery(dir, { vertical = false, theme = 'paper', only, sketches = false } = {}) {
  if (fs.existsSync(path.join(dir, 'storyboard.json')))
    throw new Error('Gallery destination already contains a storyboard; choose a fresh directory.');
  if (sketches) {
    fs.mkdirSync(dir, { recursive: true });
    const sb = sketchGallery({ vertical, theme, only });
    writeJSON(path.join(dir, 'storyboard.json'), sb);
    return sb;
  }
  const colors = palette(theme);
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  await ffmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=${colors.surface}:s=960x540:r=30:d=4`,
    '-vf',
    `drawbox=x=100:y=120:w=240:h=240:color=${colors.accent}:t=fill`,
    '-an',
    '-c:v',
    'libx264',
    '-threads',
    '1',
    '-pix_fmt',
    'yuv420p',
    path.join(dir, 'assets/demo.mp4'),
  ]);
  fs.writeFileSync(path.join(dir, 'assets/demo.png'), wireframePNG(colors));
  const sb = storyboardFor('concept-explainer', { theme, vertical });
  sb.title = 'Native building blocks';
  sb.beats = BLOCKS.filter(b => !only || only.includes(b.name)).map(b => ({
    id: b.name,
    block: b.name,
    duration: GALLERY_SECONDS[b.name] ?? 4,
    ...(b.vo ? { vo: b.vo } : {}),
    props: {
      ...structuredClone(b.example),
      ...(['image', 'annotate'].includes(b.name) ? { file: 'assets/demo.png' } : {}),
    },
  }));
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  return sb;
}
