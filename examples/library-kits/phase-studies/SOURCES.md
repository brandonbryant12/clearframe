# Sources and provenance

All values, dates, titles and short quadrant descriptions in `inputs.json` are original fictional fixtures. No company, economic series, actual machine reading or source chart image is reproduced.

Method reference inspected October 3, 2026: [NIST/SEMATECH, Scatter Plot](https://www.itl.nist.gov/div898/handbook/eda/section3/scatterp.htm). It describes paired x/y observations, distinguishes association from causation, and warns that connecting lines can introduce interpolative artifacts. This implementation explicitly labels the segments as guides and never moves an observed marker through an invented intermediate state. Calendar timing, gap rules and quadrant/reference definitions are our declared contracts, not an algorithm copied from NIST.

Each storyboard has visible fictional attribution and a source entry naming this input, its current calculation helper and the interpretation limits. `audit.json` retains full-precision observations and classifications. Native geometry and encoded review evidence must be regenerated after relevant source changes.

Original implementation and assets are MIT-licensed. Bundled native fonts retain their existing SIL OFL notices and pinned provenance. No third-party source code or data is imported here.
