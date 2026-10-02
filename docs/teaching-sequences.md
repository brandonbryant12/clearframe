# Give the viewer time to think

Use two native canvas beats: a question with a useful reading hold, then an answer with a worked explanation. Every word and duration stays editable. The result is a linear video sequence. It does not collect a response or simulate a click.

```json
{
  "id": "question",
  "block": "canvas",
  "duration": 4.5,
  "camera": "none",
  "props": {
    "source": "Arithmetic example · 4% to 5%",
    "teaching": {
      "form": "choice",
      "phase": "question",
      "prompt": "What changed from 4% to 5%?",
      "options": ["1 percent", "5 percent", "1 percentage point"],
      "correctIndex": 2,
      "explanation": "The rates differ by 1 percentage point. The relative increase is 25%."
    }
  }
}
```

Duplicate the beat with a new ID, set `phase:"answer"`, and give it six seconds. In the answer phase, the correct option is marked and identified in text, then the explanation appears. `revealAt` defaults to 0.25 seconds and `explainAt` to 1.1 seconds. Both are relative to the answer beat. Set `motion:"none"` for immediate appearance at those times. The helper requires at least one second after the explanation appears; unfamiliar ideas usually need a longer hold. Keep the question, options, correct index and source identical across the pair.

For a sentence completion, use the same phases with:

```json
{
  "form": "gap",
  "phase": "question",
  "prompt": "Complete the statement.",
  "before": "From 4% to 5% is",
  "answer": "1 percentage point",
  "after": "higher.",
  "explanation": "Subtract the two percentages: 5 minus 4 equals 1 percentage point."
}
```

The answer stays out of the question picture. The answer phase fills the blank while retaining the surrounding sentence. Use a short, specific explanation that shows why the answer follows; a repeated answer alone is rarely enough.

`props.source` or `teaching.source` is required; conflicting values fail validation. A choice needs two or three distinct options and a zero-based `correctIndex`. `layout:"full"` adapts to landscape and portrait. `layout:"split"` reserves the right half of a landscape frame for imagery. It deliberately rejects portrait instead of shrinking both halves into unreadable columns. Use the full layout or author a custom portrait canvas.

## Pair the answer with an original 3D reveal

Use a retained still poster during the question hold and a one-way clip in the answer beat. Keep `plate.loop:false` so the object does not undo the answer. A quiz selection asset must select the same option as `correctIndex`; check its receipt and the actual view, including left-to-right ordering. The `quiz-triptych` recipe uses `seed % 3` for left, centre and right. Its seed 17 selects the right tile, which maps to option C / index 2 in this example. The `gap-bridge` insert is a metaphor for filling the blank; the actual answer belongs in native type.

Text, question duration and explanation timing can change without rerendering the 3D scene. Keep material, light and palette consistent with the film. Use a physical reveal when it helps the idea; native type alone is often the clearest version. Do not bake answer labels into a clip or imply that the viewer clicked a tile.

## Review the actual sequence

```sh
clearframe new /tmp/teaching --playbook teaching-sequences
clearframe pipeline /tmp/teaching --draft --scale 0.5 --json
```

The sample is an arithmetic teaching example. Replace the content and source before adapting it to another claim. Review question and answer sheets, then inspect the encoded moment where the answer appears. The question must give nothing away; the correct option, selected object and explanation must agree. Read all copy at delivery size and leave enough time for a first-time viewer. Mechanical checks and attractive materials alone do not establish professional quality.
