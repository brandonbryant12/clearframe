# Pull requests and systems

Start with `new FILM --playbook pr-walkthrough --treatment business`. The three starter sketches are `architecture`, `state-machine` and `component-change`. They contain native editable type, user silhouettes, service cards, database cylinders, queue marks, state pills and drawn connectors. They adapt to landscape, square and portrait. Replace their illustrative labels with the actual system.

For arbitrary small systems, use `canvas.props.diagram`:

```json
{
  "block": "canvas",
  "camera": "none",
  "props": {
    "title": "The request reaches storage",
    "diagram": {
      "nodes": [
        {"id":"user", "label":"User", "kind":"user"},
        {"id":"api", "label":"API", "status":"active"},
        {"id":"db", "label":"Database", "kind":"database", "at":1}
      ],
      "edges": [
        {"from":"user", "to":"api", "label":"request", "at":0.4},
        {"from":"api", "to":"db", "label":"query", "at":1.4}
      ]
    }
  }
}
```

Use 1–6 nodes and up to 10 edges per shot. Node kinds: `service`, `user`, `database`, `queue`, `state`. Status: `neutral`, `active`, `added` or `removed`; additions and removals carry a plus/minus as well as color. Node labels and optional edge labels have a 24-character limit. `direction: auto|horizontal|vertical` chooses the default grid. Explicit `x` and `y` in 0–1 place centers inside the safe area; supply both. Split large systems into multiple shots. This is a small-diagram layout, not a general obstacle-routing engine: inspect crossings and use custom native paths where needed.

Nodes and edges accept `at` or `say`, `dur`, `exitAt` or `exitSay`, and `exitDur`. Connectors draw once. Use `say` on the matching node and connector when narrated entrances need alignment. Removal cues must be authored on both the component and its incident edges. Put a replacement at the old node's position after its exit. Keep stable ids only for the same semantic object across scenes; the renderer uses shared ids for continuity.

For custom user drawings, combine `diagram` with ordinary `elements`: paths with `enter: draw`, annotation arrows, circles and native labels. `art.over` adds the same annotations to any block. These remain editable vector geometry; diagrams need no image generation.

A PR film follows a concrete trigger → previous behavior → changed mechanism → verified result. Read the actual diff. Cite test or runtime evidence without claiming deployment from a merge or code review. Keep the camera still while viewers inspect relationships. Review frames before, during and after the replacement and the complete encoded film.
