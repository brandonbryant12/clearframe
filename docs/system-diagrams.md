# System diagrams

A pull request, an architecture or a state machine is explained by **changes to one picture**, not by a new drawing per beat. `canvas.props.diagram` declares a small cast of components with stable identities, then `steps` change that cast over time: components arrive, are marked and removed, are replaced in place, change status, and requests travel along the connections. It compiles to ordinary native canvas shapes (editable, seek-safe, no image generation).

Start a PR film with `new FILM --playbook pr-walkthrough --treatment business`. Print a starting diagram to adapt with `clearframe sketch architecture`, `component-change` or `state-machine`: each prints its editable `diagram` source, not compiled shapes.

```json
{
  "block": "canvas",
  "props": {
    "title": "The change: hand the work to a queue",
    "diagram": {
      "nodes": [
        { "id": "user", "label": "User", "kind": "user" },
        { "id": "api", "label": "API" },
        { "id": "queue", "label": "Job queue", "kind": "queue" },
        { "id": "builder", "label": "Report builder" },
        { "id": "db", "label": "Database", "kind": "database" }
      ],
      "edges": [
        { "from": "user", "to": "api", "label": "request" },
        { "from": "api", "to": "builder", "label": "inline" },
        { "from": "api", "to": "queue", "label": "enqueue" },
        { "from": "queue", "to": "builder", "flow": true },
        { "from": "builder", "to": "db", "label": "query" }
      ],
      "steps": [
        { "say": "puts a job queue", "remove": "api-builder" },
        { "say": "queue", "add": "queue" },
        { "say": "answers at once", "send": ["user", "api"], "label": "request" },
        { "say": "worker builds", "send": ["queue", "builder", "db"] }
      ]
    }
  }
}
```

## The cast

- **Nodes**: `id` (stable slug), `label` (≤ 28 characters), `kind` (`service`, `user`, `database`, `queue`, `state`, `external` — dashed, for third parties), optional `status` (`neutral`, `active`, `added`, `removed`, `error`; added/removed/error also carry a badge, so colour is never the only signal). Up to 8 per shot.
- **Edges**: `from`, `to`, optional `id` (default `from-to`), `label`, `status`, `style: dashed` (asynchronous or optional), `flow: true` (marching dashes for continuous traffic). Up to 12. `from === to` draws a self-transition loop.
- **Groups**: `[{id, label, nodes}]` draws a dashed boundary (a service, a trust zone, "new in this PR"). A boundary that would enclose a non-member fails rather than misleading.

## Steps: change over time

Each step has `at` (seconds) or `say` (a spoken cue) and one action:

| Step | What the viewer sees |
| --- | --- |
| `add: id or [ids]` | Components or connectors arrive (staggered); a component added during the shot reads as **added**, and so does new wiring to it |
| `remove: id or [ids]` | Marked **removed**, then gone; its connectors are marked and leave with it |
| `replace: old, with: new` | The old component is removed and the new one arrives **in its place** |
| `set: {id: status}` | A component or connector changes status (a fade, so the change reads as a change) |
| `send: [ids], label?, dur?` | A request travels hop by hop along existing connections (either direction, so a response can return), slipping behind each component; arrival pulses the component. `label` rides the first hop |

Nodes and edges also accept their own `at|say`, `exitAt|exitSay`. Defaults keep the picture honest: untimed components cascade in; a connector waits until both ends are on screen and leaves with a removed end. The compiler rejects, with the reason: a connector drawn before its ends, one that outlives an end, a request sent before its connector is drawn, a replacement before the old component has gone, overlapping components, and labels too long to read at the frame's size.

Spoken cues resolve before compiling, so `say` timing is exact. Cue the step that changes the picture to the word that names the change.

## Across beats

Node ids are identities. Consecutive canvas beats that share a node id **morph**: the component stays on screen across the cut and slides to its new place, and shared connectors re-route. Reuse ids only for the same component; give a different component a different id. The PR playbook shows the pattern: *before* (the old path, a request travelling it, the problem marked), *change* (the same components; the removed connection, the new one added in place, the new path exercised), *states* (the lifecycle the change introduces).

## Layout and routing

Components are laid out in ranks along the connections (sources first), left to right in landscape and top to bottom in tall frames; `direction` overrides it. A replacement shares the slot of what it replaces, so the layout does not jump when it arrives. `area: [x, y, w, h]` (0–1 of the frame) confines the diagram, e.g. to the left half beside a half-screen plate. Explicit `x`/`y` (0–1 of the area) pin a component.

Connectors are orthogonal with rounded corners. Several on one side of a component take separate ports; elbows that share a gap take separate runs, ordered to avoid crossings; two-way pairs run side by side with labels on opposite sides; a connector that would pass through a component on screen detours over or beside it; labels go where they collide least. This is a small-diagram router for 1–8 components, not a general graph engine: inspect the contact sheet, and split a larger system into shots (a context shot, then a zoomed shot of the part that changed) rather than crowding one.

## Writing a PR film

Read the actual diff. Follow a concrete trigger → previous behaviour → changed mechanism → verified result. Name components by what the code calls them. Show evidence (tests, runs, measurements) with sources; a merge or a review is not proof of deployment. Keep the camera still while viewers read relationships (the business treatment sets the film camera to `none`, and diagram beats hold still by default): the motion that explains is the diagram's own — arrivals, removals, requests. For custom drawing, combine `diagram` with ordinary `elements`, and `art.over` annotations on any block. Review frames before, during and after each change, and the complete encoded film.
