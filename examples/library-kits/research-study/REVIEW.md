# Independent research-study review

## Final bounded review — 2026-10-03

**Verdict: prototype; no remaining material findings in the inspected sources and encoded frames.** The two initial chart issues and the later landscape gate subtitle collision are resolved. This verdict covers the named landscape and vertical specimens only. **No continuous playback has been observed.** Frame samples, automated continuity checks and saved-scene reload evidence do not establish subjective playback quality or approve square/4:5 variants.

### Exact artifacts and inspected evidence

The six current compositor runs below are under their respective `<variant>/build/pipeline/` directories. Each run contains `video.mp4`, check/QA results and deterministic seek evidence.

| Variant | Run |
| --- | --- |
| comparison-landscape | `2026-10-03T02-46-02-000Z-a98df9a6` |
| comparison-vertical | `2026-10-03T02-46-06-752Z-25370514` |
| interval-landscape | `2026-10-03T02-46-11-177Z-9e95a98f` |
| interval-vertical | `2026-10-03T02-46-15-821Z-6790e8f4` |
| gate-landscape | `2026-10-03T03-03-18-434Z-fcf18d41` |
| gate-vertical | `2026-10-03T03-01-09-896Z-feb7e24d` |

Independently decoded each chart's actual encoded video at 0, 2, 4.5 and 11.9 seconds, and each final gate composition at 0, 1.3, 2, 3, 4 and 5.9 seconds, with a 360-pixel output width. All 28 final phase images were visually inspected; retained copies are in `evidence/independent-review/<variant>/`. Also inspected the four chart timeline sheets. The six gate images in `gate-landscape-before-subtitle-fix/` intentionally preserve the superseded run `2026-10-03T03-01-04-479Z-1a369d7d` and are not final delivery frames.

These are single-scene specimens with no interior edit joins. The opening and final samples show valid frames. The gate is explicitly a one-way open-and-hold action, not a seamless loop; its end-to-start discontinuity must not be treated as loop approval.

### Resolved findings

1. **Undefined event in the interval title — resolved.** Both encoded formats now read “Delay declines in the observation window.” This matches the fictional July–January window without inventing an intervention or change event. The source and no-causation qualification remain visible.
2. **Hardcoded endpoint ratio — resolved.** `build.mjs` derives the endpoint percentage and rejects a nonpositive reference denominator. Both encoded formats show “50% of reference,” consistent with 20h/40h. This verifies the supplied fixture and derivation, not arbitrary future inputs.
3. **Landscape gate subtitle intersects hardware — resolved.** The first gate composition placed the end of “Closed → opens once → holds open” over the upper crossbar/handle around x=175–203, y=39–49 in the 360-pixel view, throughout the inspected duration. The corrected run uses “Closed → opening → open,” at the same readable size, and ends clearly before the hardware in all six inspected phases. Portrait retains the longer line with ample separation. This was a native composition choice and needed no new Blender render.

### Chart findings

The final comparison keys show 142 and 122, matching the original index series and their 42%/22% total growth. The interval keys show 20h and 40h. The axes stay fixed across the inspected reveal phases; the July shading remains at the same elapsed-date position. Endpoint values and the ratio annotation arrive after the line reveal, avoiding a temporary association between an unfinished line and its terminal value.

At 360 pixels, both formats keep the headline, key, units, endpoints and source readable. Landscape is compact, especially the interval's six y ticks and explanatory line, but the inspected text does not overlap. Portrait provides more separation and a clear leader to the observed endpoint. The subdued violet band reads as a time interval; the on-screen source explicitly rejects a causal inference. These clips work as focused chart specimens, with a short reveal followed by a comparison hold. They are not evidence of a complete narrated-film argument or pacing review.

Read `check-encoded.py` and its retained `build/encoded-proportions.json` results. The reported audit covers 1,440 decoded frames, 116 native coordinate/tick/shade checks, 15,228 visible observation probes, 2,376 reveal-front probes and 944 future-column probes, with zero failures. It uses a 720-pixel audit width and a 3-pixel encoded tolerance. It excludes the first/last 0.5 seconds from pixel probes, excludes 6,308 observation probes where series are closer than 6 pixels, and skips overlapping reveal-front probes. Native mapping uses the original inputs and actual elapsed dates. These are useful fixture-specific checks; they do not prove every pixel, hidden/overlapping marks, area/volume encodings, arbitrary replacement data or subjective playback. The reviewer inspected the implementation/results rather than rerunning this full audit.

### Gate findings

In both final formats the closed gate reaches the channel floor, the opening samples create a growing clearance below it, and the 4s/5.9s samples hold the raised gate in the guides. The spindle remains visibly connected to the moving gate and fixed upper hardware; no obvious guide collision, detached spindle or false side passage is visible in the inspected views. The fixed handle is a stylized connection, not evidence of a simulated drive, force or hydraulic system. These are sampled-view judgments, not exhaustive collision detection through every frame.

The porcelain channel, charcoal guides, orange gate and violet floor separate clearly. Portrait gives the mechanism more screen area; landscape retains a legible silhouette and now keeps both text lines clear of it. Native headline, state sequence and qualitative footnote remain readable at 360 pixels. No liquid motion, level, flow rate or quantity is shown; the explicit qualitative qualification agrees with the imagery.

Read both `build/verify-{landscape,vertical}/verification.json` reports: each describes a 144-frame master with `loop: false`, passed mechanical checks and an exact saved-scene poster reload (zero changed channels, matching pixel hashes). This supports reproducibility of the tested saved scene/frame; it is not a reviewer-observed Blender session or proof that every reopened frame was compared. The six current compositor reports contain no check errors/warnings, zero detected QA pops and matching sequential/shuffled seek hashes. Automated checks complement, rather than replace, the visual review.

### Provenance and remaining boundaries

The three inspected reference JPEGs and verified hashes establish three graphics reproduced on one publisher page. They do not establish original social-post provenance, a complete house style, designer endorsement or a Blender workflow. The original fictional data, native layouts and original qualitative sculpture are distinct adaptations; no source market trajectories, logos or reference screenshots are redistributed in the kit.

No further structural changes are requested for these six prototypes. Preserve the five most consequential boundaries when reusing or promoting them: (1) complete subjective continuous-playback review before promotion, (2) retain the narrower publisher-level attribution, (3) recompute and recheck charts after input changes, (4) keep the gate qualitative and nonlooping, and (5) separately compose and review any new aspect ratio. No renderer/tool defect was established in this review.

---

## Initial source and still review — historical record

**Provisional verdict: prototype; two material source/claim issues require correction.** The current visual adaptation is distinct from the inspected reference graphics. The gate is an original qualitative companion, not a quantitative reservoir or evidence of the referenced designer's 3D practice. Encoded compositor outputs and gate masters were still being rendered when this initial review was recorded.

Reviewed `DIRECTION.md`, `SOURCES.md`, `references.json`, original `source/inputs.json`, native `build.mjs`/`verify.mjs`, and `library/sculptures/reserve-gate.py`. Inspected the three local reference JPEGs, the interval-vertical native sheet, and the landscape/vertical `gate-look-*-v2/poster.png` images. No reference pixels were copied into this review or redistributed.

### Source interpretation and provenance

The locally inspected liquidity, regimes and trend JPEGs match all three SHA-256 values in `references.json`. Their white fields, gray/charcoal hierarchy, orange comparisons, violet emphasis, contextual annotations and dense secondary data panels support the documented observations. This is three images from one publisher page, not verification of three independent social posts or a comprehensive house style. The original-post provenance remains unverified, as the kit correctly states.

The native specimen adopts color/hierarchy ideas while using new fictional subjects, original numbers, a simpler single panel, a stable large key, sparse axes and explicit source copy. It does not reproduce the market trajectories, dense lower panels, source marks, company branding or source text layout. The gate translates the palette into new geometry and materials; the observed references do not establish a Timmer Blender workflow, endorsement or matching physical mechanism. These distinctions should remain in the final provenance text.

### Independent quantitative checks

- Capacity moves from 100 to 142 and demand from 100 to 122: respective total growth of 42% and 22%. Their shared index basis supports the aggregate growth comparison. A line chart's declared 90–150 index domain is not a zero-baseline bar encoding; retain the visible domain ticks.
- Delay's final 20 hours divided by the reference's final 40 hours is exactly 0.5. The current “Half the reference” statement is arithmetically correct for the supplied endpoint.
- The calendar domain has 365 elapsed days. July 1 is day 181, so the shaded interval should start at 181/365 = 49.589% of plotting width and cover the remaining 184/365 = 50.411%. The source maps the shading with actual elapsed dates, not an assumed half-year width. The inspected portrait sheet is consistent with that boundary.
- The gate script has no liquid amount, data-driven fill, flow-rate or volume representation. The gate lift is an authored monotonic smoothstep after a 20% hold, reaches its final position at 65%, then holds. This is source evidence, not confirmation of the rendered motion. The spindle's location/scale preserve its connection to the rising gate and fixed crossbar in the declared geometry.

### Material issues raised before final rendering

1. **Undefined event in the interval title.** “Delay falls after the change” asserts an event and time relationship not supplied by the inputs. The fixture defines a July–January observation window, but no change event; the delay series already declines before July. The no-causation footnote does not establish the asserted event. Use a descriptive title such as “Delay declines across the observation window,” or explicitly supply and mark the fictional event and ensure the claim fits the data. This is a claim/composition problem, not a plotted-coordinate defect. It is present from the first frame through the hold in the initial native specimen.
2. **The reusable ratio annotation is hardcoded.** `build.mjs` uses literal “Half the reference,” while `DIRECTION.md` says the callout is computed from the endpoint ratio. The current fixture is correct, but replacing the inputs can leave a false annotation. Derive the ratio text from the selected observed/reference endpoints, or validate that the ratio is exactly one half before using that phrase. This is a source-contract problem; the current 20h/40h arithmetic does not require changing.

### Initial visual findings and limits

The portrait interval sheet has legible hierarchy, a restrained shaded interval, distinct charcoal/orange series and a clear endpoint annotation positioned away from the data. The violet explanation states a descriptive window; it does not by itself imply an intervention or causal relationship. Standalone encoded 360-pixel review remains pending.

The gate posters show a coherent porcelain/graphite/orange mechanism, a clear raised gate, visible guide hardware and a neutral field. Portrait is recomposed with generous space for native text. These posters do not establish the closed position, continuous travel, rail clearance throughout the action, native-label placement or final composited phone readability.

**No continuous playback has been observed.** The six compositor outputs, encoded gate phases, joins, 360-pixel final compositions and saved-scene reproduction need their own bounded evidence before a final review conclusion. Preserve prototype status while those requirements or subjective continuous playback remain unverified. Landscape/vertical review does not approve square or 4:5 output.
