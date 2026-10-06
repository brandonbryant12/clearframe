import fork from './scenario-fork.mjs';
import { body, round, tall } from '../../film/sketch-kit.mjs';

export default {
  name: 'scenario-origin',
  order: 63,
  summary: 'A close view of the common starting point as the assumptions split its path.',
  use: 'First shot of a scenario world. Follow with scenario-outcomes in the same world to reveal the possibilities.',
  build(w, h) {
    const r = body(w, h), vertical = tall(w, h);
    const x = r.x + r.w * 0.1, y = r.y + r.h * 0.5;
    const view = [round(x - w * (vertical ? 0.15 : 0.19)), round(y - h * 0.22), round(w * 0.44), round(h * 0.44)];
    return {
      view,
      viewFrom: [round(view[0] - w * 0.04), round(view[1] - h * 0.04), round(w * 0.52), round(h * 0.52)],
      viewDur: 2.6,
      elements: fork.build(w, h).elements.filter(e => !/^scenario-(end|label)-/.test(e.id)),
    };
  },
};
