# Flat graphics, native depth and true 3D

Choose the picture that helps the viewer read the claim. **Flat graphics** are the first choice for precise comparisons, many categories, small differences, dense evidence and signed values on diverging scales. **Native dimensional KPIs** add shallow depth to one headline, a short comparison or a progress measure while keeping type and data editable. **True 3D** earns its render cost when contact, assembly, changing viewpoint, occlusion or light explains the subject. A shaded bar does not need Blender.

The native KPI option composes ordinary canvas shapes and text. Changing a number requires only the normal native render. It does not generate an image, rerun Blender or bake labels into a clip. Call it native dimensional or 3D-style geometry; it is not a physically rendered Blender scene.

## Five restrained forms

| Form | Good use | Data contract |
|---|---|---|
| `pedestal` | One headline result or a signed return | The plinth is decorative and has fixed dimensions. Only the native type carries the value. Any finite signed number is allowed. |
| `comparison` | Two to four comparable nonnegative values | Front-face heights share a zero baseline and one domain. Each extrusion has the same shallow depth. Out-of-domain values fail validation. |
| `rail` | Progress toward a positive total | The coloured front face is exactly `value / total` of the track length. Zero draws no positive filled shape. Negative values, zero totals and values above the total fail validation. |
| `stack` | Two to four contributions to one explicit total | Each front width is `value / total` on the same track. Nonnegative contributions cannot exceed the total. A remaining amount stays visible and is labelled. Unit and total are required. |
| `seesaw` | A qualitative comparison of two values in the same unit | The value labels are literal. Equal values, including two zeros, make a level beam. Fixed decorative blocks and a bounded tilt indicate which side is larger; the angle is not a measured quantity or a physical torque model. Unit is required. |

Use a flat diverging chart for signed comparisons, or a flat chart with a clear above-target scale when progress can exceed its goal. Do not clip or coerce those values into these bounded forms. Keep a fixed explicit domain when viewers compare shots across time. A comparison with no supplied domain uses a shared maximum for that one shot, and its axis states the scale.

## Author one editable metric

```json
{
  "id": "margin",
  "block": "canvas",
  "duration": 6,
  "camera": "none",
  "props": {
    "source": "Illustrative figures — replace with the exact source",
    "kpi": {
      "form": "comparison",
      "label": "Operating margin",
      "unit": "Percent of revenue",
      "suffix": "%",
      "decimals": 1,
      "domain": [0, 40],
      "values": [
        { "label": "Before", "value": 31.2 },
        { "label": "After", "value": 33.5 }
      ],
      "motion": { "preset": "stagger", "duration": 0.85, "stagger": 0.18 }
    }
  }
}
```

For a headline use `{"form":"pedestal","label":"Weekly return","value":-0.49,"suffix":"%","decimals":2,"motion":"none"}`. For progress use `{"form":"rail","label":"Delivery","unit":"Tasks completed","value":72,"total":100,"motion":{"preset":"reveal","duration":0.9}}`. Supply the exact visible source in `props.source` or `kpi.source`; conflicting sources are rejected. Numeric strings, booleans, `NaN` and infinities are rejected. `decimals` accepts 0–3; `prefix` and `suffix` format the native labels without changing the data.

A contribution template uses `{"form":"stack","label":"Where the work goes","unit":"Hours per week","total":40,"values":[{"label":"Delivery","value":20},{"label":"Planning","value":10},{"label":"Support","value":6}],"motion":{"preset":"stagger","duration":0.55,"stagger":0.12}}`. The remaining four hours stay visible on the track. A seesaw uses `{"form":"seesaw","label":"Requests by channel","unit":"Requests this week","values":[{"label":"Email","value":24},{"label":"Chat","value":36}],"motion":{"preset":"reveal","duration":1.1}}`. It keeps the values stationary and gives the beam one restrained tilt. Use a flat chart when the viewer must judge the size of a small difference precisely.

KPI layout uses the final frame dimensions and redraws for landscape, vertical, square and portrait. Optional `props.elements` are drawn over the result in final frame pixels. On a 1920×1080 comparison, a short supplementary result can sit at `x:1690, y:292, anchor:"end", size:40`; inspect it with your actual label and unit. Avoid an extra canvas title because `kpi.label` already supplies the headline. Do not combine the KPI shorthand with `chart`, `sketch` or `plates` on the same canvas.

## Motion that preserves the measurement

| Preset | Behavior |
|---|---|
| `none` | All values and geometry are present from the first frame. Use for reduced motion or when the viewer needs immediate comparison. |
| `reveal` | Data front faces grow from zero to their literal value on the fixed scale. The pedestal instead makes one small decorative lift and fade. |
| `stagger` | Comparison bars use the same reveal with a bounded delay between them. Stack segments build in sequence, with each face settling before the next starts. |
| `emphasis` | Data dimensions and labels remain static. One shallow outline or underline changes opacity; it never enlarges the amount. `focus` selects a comparison index, defaulting to the last one. |

Use an explicit `motion` object when timing matters. `duration` is 0.2–2 seconds, or 0 for `none`. `stagger` is 0–0.6 seconds and applies only to comparisons or stacks using the stagger preset. Defaults are a restrained 0.9-second reveal and a 0.18-second stagger when that preset is selected. A stack's duration applies to each segment; keep it short or extend the beat. Validation requires at least one second after the final reveal settles. Motion is deterministic and has no unbounded loop or flashing state.

During a data reveal, final value labels and decorative depth wait until that front face reaches its final value. They do not claim that an intermediate bar is already the final result. Axis, unit and source remain readable. Each KPI beat has separate shape identities, so a new metric cannot accidentally morph out of the previous metric's full-value shape.

Give the viewer a useful hold after the last value settles. Two or three seconds is a starting point for a short comparison; allow more for unfamiliar units or supplementary context. Do not add camera orbit, perspective tilt or large bounce to a quantitative face. Use emphasis sparingly and let exact values, axes and category labels do the comparison work. Colour should support those labels rather than carry the only distinction.

## Review at the size people will watch

```sh
node engine/cli.mjs new /tmp/dimensional-kpis --playbook dimensional-kpis
node engine/cli.mjs pipeline /tmp/dimensional-kpis --draft --scale 0.5 --json
node engine/cli.mjs new /tmp/dimensional-kpis-tall --playbook dimensional-kpis --vertical
node engine/cli.mjs pipeline /tmp/dimensional-kpis-tall --draft --scale 0.5 --json
```

The sample contains invented values and no narration. Replace its visible sources and numbers before using it as evidence. Review the contact and phone sheets, then inspect encoded motion and the final hold. Confirm that zero is zero, every bar uses the same scale, the top/right extrusion is decoration, and the data face is easy to read. Check that units, source and labels fit without relying on colour alone. Prefer fewer categories and shorter labels on a phone. Try `motion:"none"` as a reduced-motion presentation; decorative movement should not be needed to understand the result.

Use original 3D sculpture clips for a reveal, a material transition or a mechanism, then return to flat or native dimensional graphics when exact evidence arrives. Keep factual copy and charts native over the imagery. Real product identity belongs to approved models, logos or recordings; an abstract sculpture is a metaphor. Preserve the scene and render receipt for a true-3D insert, but do not require a fresh 3D render merely to update a KPI.
