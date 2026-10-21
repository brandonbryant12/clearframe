import { buildPortal } from './portal/build.mjs';
export default {
  name: 'portal',

  keep: true,

  order: 90,

  summary:
    'A task done in an app: the cursor opens a section, picks a card, changes one value and saves; a confirmation lands and the view leans in on the new value.',

  use: 'Benefits portals, HR and expense apps, banking and settings: "log in, go to Retirement, change your rate", the step a film asks people to take. Set sketchParams.device to "phone" for a mobile app (a sign-in app, a bank app, an expenses app) or "desktop" for a browser; by default a vertical film gets the phone. Replace APP, STEP1 (the section), STEP2 (the card), OTHER (a second card), FIELD, OLD and NEW (its value before and after) and DONE with sketchText (also Home, Pay, Documents, Welcome back, Save); land CLICK1, CLICK2, CHANGE and SAVE on words with sketchSay.',

  params: {
    device: {
      default: 'auto',
      oneOf: ['auto', 'desktop', 'phone'],
      about:
        'desktop: a browser window with a side menu; phone: the same steps in a phone app with tabs; auto (the default): a phone in a tall frame, a browser otherwise',
    },
  },
  build: buildPortal,
};
