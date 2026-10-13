# Enterprise brief bench

Mock source documents for the kind of films ClearFrame is mostly asked for: benefits, retirement,
client updates, training and compliance at a financial-services firm or any large employer. They
exist to test the harness, not to inform anyone. Every company, plan, figure and person in them is
fictional; the figures are the fictional company's own plan terms or internal results, so a film cites
the document it came from.

Use them to:

- run the same brief through different models and compare the films and the trajectories
  (`node engine/cli.mjs runlog DIR` plus the agent's own notes)
- check that a harness change makes films less like narrated slides (`critique`, a fresh look at the
  `sheet`, `qa` phone sheet) without making every film look the same
- try new library pieces on material that is deliberately dry

Each brief says who the film is for, what they should do afterwards, the length and the source
document. Briefs never prescribe blocks, palettes or treatments; choosing those is the test.

Local only: draft voice (`voice --draft`, the OS voice), `align --whisper`, no generated images or
footage unless a run is explicitly about them.
