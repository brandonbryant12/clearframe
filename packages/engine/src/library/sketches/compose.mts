import { buildCompose } from './compose/build.mjs';
export default {
  name: 'compose',

  keep: true,

  order: 102,

  summary:
    'The same email, one different button: a draft with an attached file, the old button struck through as the file shakes and greys, the new button lit and pressed, the file lighting up as it uploads and turning into a link with a lock; optionally a tag lands on the link (it expires) and Send pulses with a confirmation.',

  use: 'Compliance and security habits that are "the same email, one different button": send client documents through a secure link instead of attaching them, Encrypt before sending: an email being written and sent (a message received, such as Report phish, is inspect with report: true). Set sketchParams.device to "phone" for a mail app or "desktop" for a mail window (auto, the default, gives a tall frame the phone); expires true adds the tag on the link, send true adds Send and its confirmation. Replace RECIPIENT (who it is to), SUBJECT, BODY (one line of the email), FILE (the attachment, e.g. "Statement_Q2.pdf"), OLD and NEW (the two buttons, e.g. "Attach" and "Share securely"), LINKTEXT (what the file becomes, e.g. "Secure link: client signs in"), EXPIRY (with expires, e.g. "Expires in 7 days") and DONE (with send, e.g. "Sent securely") with sketchText. Keep RECIPIENT, SUBJECT, FILE and LINKTEXT to about 25 characters, the buttons to one or two words and BODY to one short sentence: a longer line shrinks to fit its field and is too small to read on a phone; land OLD (the old button, "instead of Attach"), NEW (the new one, "press Share securely"), LINK ("goes up as a link"), EXPIRES ("expires") and SEND ("send") on words in that order with sketchSay. For a step through several screens of an app, use portal; to point at the parts of a message, inspect.',

  params: {
    device: {
      default: 'auto',
      oneOf: ['auto', 'desktop', 'phone'],
      about:
        'desktop: a mail window with a toolbar; phone: a mail app (Send at the top, the two buttons along the bottom); auto (the default): a phone in a tall frame, a desktop window otherwise',
    },
    expires: {
      default: false,
      about: 'true: on EXPIRES, a tag (EXPIRY) lands on the link chip',
    },
    send: {
      default: false,
      about:
        'true: on SEND, the Send button pulses and a confirmation (DONE) pops up',
    },
  },
  build: buildCompose,
};
