# Night city: a document turned into one continuous world

A 47-second explainer built from a (synthetic) research brief on urban night heat. Every figure is sample data from made-up sources, labelled as such. It is here to show craft, not facts.

It began as nine slide-like scenes, each a heading over a graphic. Three rounds with an independent reviewer turned it into one drawing explored by a travelling camera:

- **One world** (`props.world: "city"`). Every canvas beat adds to the same night city, and the camera travels between camera rects (`view: [x, y, w, h]`). The stations are laid out in story order:
  - the chart is the sky above the city (tilt up);
  - the heat story is a push into one roof;
  - the street plan lies under the ground (tilt down);
  - the survey sits beside it.
  - The last beat pulls back to the opening shot, changed.
- **An interruption, then a return.** The kinetic turn ("not shared evenly") is a colour-blocked card with an iris. The next world beat resumes from the camera's last view.
- **The world changes state.** A `behind: true` day sky fades in on "day" and out on "sunset" / "after dark", under everything already drawn.
- **Show the phenomenon.** The hook sets the sun, drops both thermometers (`keys` with `scaleY`), and turns the gap into "7°C" on "Seven". A later beat re-uses the same roof: the heat fills it, then a cool roof drains it.
- **Tidy while away.** Labels that would clutter a later wide shot leave at an `exitAt` after their beat ends, while the camera is elsewhere.

Regenerate with `python3 make.py`. Then run `node engine/cli.mjs draft DIR` from the repository root with this folder as DIR.
