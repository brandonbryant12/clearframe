# Research and recorded conversations

A source does not dictate a visual style. A long report can become an investigation, a mechanism, a field diary or a short editorial argument. A podcast can become a typographic clip, a drawn explanation or a spacious visual essay. Choose the form from the idea, its evidence and the intended audience.

These playbooks and directions are examples of complete arcs. They are editable storyboards, not fixed scene templates. You can replace their drawings, reorder their beats, change the camera grammar, combine arcs, add an original canvas scene or bring in approved source imagery. Keep the source requirements even when every visual choice changes.

| Starting point | Narrative move | Picture and edit | Bring from the source |
|---|---|---|---|
| `research-digest` playbook | A surprising fact opens a question; explore its mechanism in a place | A continuous illustrated world; the camera discovers evidence inside it | One consistent dataset, the setting, mechanism, tension and supported takeaway |
| `research-evidence` direction (`research-digest` + `research-study`) | Question → observation/inference → missing test → qualified conclusion | The report's own pages (canvas `document`), each claim marked on its words (`marks`), a held question | Exact claims, methods, counterevidence, limitations and citations |
| `data-story` playbook | Establish the main finding, explain the support, close on the implication | A few sourced figures that build and morph across cuts | A small set of compatible findings and their sources |
| `podcast-clip` playbook | A compact hook, answer and memorable line | Quick typographic changes, speaker distinction and a social end card | The exact recording, measured words, actual speaker identity and verified quotation |
| `podcast-picture` direction (`podcast-clip` + `workplace`) | Each idea the guest explains gets its own picture | Small drawn pictures over readable captions (`examples/podcast-pictures`) | The exact recording and measured words |

## Pick or invent a direction

```sh
node engine/cli.mjs directions research
node engine/cli.mjs directions podcast
node engine/cli.mjs start /tmp/report-film --document report.md --direction research-evidence
node engine/cli.mjs ingest /tmp/episode-film --audio episode.wav --direction podcast-picture
```

Directions combine a starting arc, treatment and story/picture/pace guidance. The defaults are independent: `--playbook`, `--treatment` and `--theme` can override them. Tags suggest suitable material; they do not limit which source can use a direction. Add a custom `library/directions/*.json` through `--library DIR`, or author directly without choosing a profile. See [the JSON contract](../library/README.md#directions).

A recording import still starts with timed kinetic captions. It now honors the visual treatment and writes the direction brief, while preserving exact imported narration, speakers, cuts and word metadata. The agent uses that brief to draw source-specific pictures; the profile never replaces the audio with its illustrative playbook. The research importer likewise keeps the real evidence separate from sample starter claims until the agent authors the story.

## Make variation structural

Vary a film at several levels before trying a new palette:

- **Argument:** start with a disputed claim, a concrete example, a counterexample or a question left unanswered.
- **Picture:** choose a place, a physical object, a document, a drawn mechanism, typography or approved footage.
- **Edit:** use an accumulating world, a montage, a repeated composition with changed state or a continuous held shot.
- **Time:** leave a pause where the thought needs one; quicken only where the source supports it.
- **Voice:** decide what the picture adds to the spoken words and which few words deserve to remain on screen.

The research and podcast directions deliberately contrast. The evidence direction stays on the report's own page: a canvas `document` scrolls to the passage and `marks` circle, underline or highlight the words that make the claim as they are read. The `podcast-picture` direction gives each idea the guest explains its own small drawing over readable captions. Colour changes alone do not create that difference.

## Preserve the research

Ingest the report before writing the film. Read the evidence brief alongside the source. Keep a source entry and a visible citation for each substantive claim or figure, including dates and units where needed. Separate the report's observations from its interpretation and from the film author's explanation. Preserve limitations that change the meaning of the conclusion.

A playbook's sample story is a hypothetical demonstration. It asserts no real study result. Replace its words, visible source lines and `sources` metadata together. A quantitative chart belongs in the film only when there is a real comparable dataset behind it.

```sh
node engine/cli.mjs ingest /tmp/research-film --markdown report.md --direction research-evidence
node engine/cli.mjs new /tmp/research-film-tall --playbook research-digest --treatment research-study --vertical
```

## Preserve the conversation

For a real podcast, import the recording and measured word timestamps. The recording supplies the words and their timing. A playbook's sample narration is an authored demonstration, not a guest quote or a transcript. Never substitute its narration for a speaker's actual words.

Select a moment whose own language has the intended arc. Keep speaker identity, word order, meaningful pauses and context intact. If the excerpt has a different shape, change the storyboard to fit it. A held picture can span several spoken ideas; a new scene is not required for every sentence. A held picture is an artistic choice, not an instruction to extend every imported recording.

```sh
node engine/cli.mjs ingest /tmp/podcast-recording --audio episode.wav --from 120 --to 165 --vertical --direction podcast-picture
```

Use `examples/podcast-pictures` as a visual reference while editing the imported project's native storyboard. Review the actual audio and measured words at each change of thought. Inspect both frame shapes before rendering the final cut.
