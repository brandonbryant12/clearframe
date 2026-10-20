# ClearFrame low-evidence rules

This is an owned ClearFrame Oxlint plugin derived from
[`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop) at commit
`446268e5d15baa968eaec669ff65358d36ae6259`. The source is vendored under the
upstream MIT license so this repository can review and change every rule with
the rest of its guardrails.

## Enforced policy

The root `.oxlintrc.json` enables the rules that have a high-signal mapping to
ClearFrame's TypeScript and Effect contracts:

- `no-chained-type-assertions`: production values must not fabricate evidence
  through assertion chains. Tests can construct deliberately invalid values.
- `no-known-value-widening`: production literals keep their inferred keys and
  discriminants by default; explicit closed or finite owner contracts remain
  valid when they define a stable module or package API. The rule rejects
  widening into `unknown`, `object`, or an open dictionary.
- `no-object-parameters`: function inputs use an owner type instead of the
  broad `object` type.
- `no-reflect-apply` and `no-reflect-get`: dynamic access is hidden behind a
  typed interface or decoded at the boundary.
- `no-shape-in-symbol-names`: production symbols use domain roles instead of
  structural placeholder names.
- `no-unknown-type-aliases`: aliases must not hide an `unknown` boundary.
- `no-widen-then-assert`: known values must not be widened and asserted back.

`no-chained-type-assertions` and `no-known-value-widening` are disabled only in
test and fixture files because negative schema tests intentionally construct
invalid runtime values. The remaining enabled rules apply to tests too.

## Reviewed but not enabled

The other upstream rules remain available for focused audits, but they are not
part of the default lint gate:

- The blanket module-mock ban conflicts with existing focused React and process
  composition tests. ClearFrame still prefers Effect layers, repository
  interfaces, and shared test factories for domain behavior.
- `unknown` and `typeof` are valid at I/O and schema-decoding boundaries. The
  repository requires decoding there instead of banning the representation.
- Conditional object spreads preserve exact optional-property semantics and
  are not inherently low evidence in this codebase.
- A required comment on every type assertion produced thousands of low-signal
  comments. ClearFrame instead bans impossible casts and assertion chains.
- Unsafe dictionaries are handled through owner contracts and `JsonValue`
  where the boundary is JSON; a blanket rule cannot distinguish provider and
  parser boundaries without type information.

Change the plugin and its policy together. Add a focused rule test before
enabling another rule in the root lint gate.

The root lint gate checks this package for correctness and TypeScript issues.
The vendored AST resolvers are exempt from product code-size and cognitive
complexity ceilings; their behavior is instead protected by the upstream rule
matrices in `test:scripts` and this package's strict TypeScript check.
