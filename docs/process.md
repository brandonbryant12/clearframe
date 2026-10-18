# Process: where work waits

`canvas.props.process` shows a serial flow of work (intake, review, approval, payment) and where it waits. It is a deterministic model of rates the author states, stepped one period at a time. The picture shows the model's computed state; it never draws a queue it did not compute.

```json
{
  "block": "canvas", "min": 12,
  "vo": "Ten requests arrive each day. Review can finish eight, so two more wait every day. Then review gets a second reviewer, and the queue drains.",
  "props": {
    "moments": {"HIRE": "second reviewer"},
    "process": {
      "id": "requests", "title": "Where requests wait", "unit": "requests", "period": "day", "arrivals": 10, "done": "Completed",
      "stages": [{"id": "intake", "label": "Intake", "capacity": 12}, {"id": "review", "label": "Review", "capacity": 8}, {"id": "approve", "label": "Approval", "capacity": 12}],
      "runs": [{"periods": 5, "say": "Review", "dur": 4}, {"periods": 5, "cue": "HIRE", "dur": 4, "set": {"review": 12}}]
    }
  }
}
```

## The model

Each period, the `arrivals` join the first stage's queue. Then each stage in order takes up to its `capacity` from its queue and hands it on; the last stage's work is done.

- **Whole items.** Arrivals, capacities and starting queues are whole numbers.
- **Mass-conserving.** Everything that has arrived (plus anything waiting at the `start`) is either waiting before a stage or done. The model checks this every period.
- **Runs carry state.** `runs` are stretches of model time: `periods`, shown over `dur` seconds, starting on `say`, `cue` (a [named moment](moments.md)) or `at`. A later run can `set` new capacities. It starts from exactly the state the previous run left, so a raised capacity drains an existing queue at the computed rate (here 12 − 10 = 2 a day); the queue never disappears at once.
- **`start`** gives queues already waiting when the film begins.
- **Serial flows only.** Every item passes through every stage once. Branches, rework loops and priorities are not modelled; split such a process into shots or use a [diagram](system-diagrams.md) for its shape.

The arithmetic is exact and repeatable. The model is an illustration of stated assumptions, not a forecast: the source line says "Illustrative model of stated rates" unless `source` names a real one. A storyboard `sources` entry is required.

## The picture

- **The assumptions** (arrivals and the unit of capacity) are printed under the title.
- **Stage cards** show each stage's capacity. A capacity that changes is marked when its run starts.
- **Each queue** is drawn beside its stage: one square per waiting item (or per `token` items, with a key); a partial group fills the proportional width of its final square, with its exact count and its change in the last period ("10 waiting · +2 a day").
- **The period clock** ("Day 5") and the done count update once per period.
- **Wide frames** lay the stages out in a row with queues above them; **tall frames** stack them in a column with queues to the right.
- **Too many squares** (more than 40 in a wide frame) are refused, with a suggested `token` size.

At least 0.4 s per period, so every count can be read. Runs cannot overlap, and the model must finish inside the beat.

Example: `examples/where-work-waits`. Tests: `node --test test/process.test.mjs`.
