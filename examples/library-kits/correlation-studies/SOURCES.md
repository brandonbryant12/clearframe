# Provenance and method

All return observations, labels and case narratives in `inputs.json` are original fictional examples. No market dataset, forecast, claim about a real investment or external chart artwork is imported. The source and native composition are original MIT-licensed work; bundled fonts retain their existing OFL notices.

Pearson's centered-sum formula was checked against [NIST Dataplot: Correlation](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/correlat.htm), accessed 2026-10-03. The implementation is independent. For paired values x and y, it divides the sum of centered cross-products by the product of the two centered-vector lengths. Positive affine normalization before centering avoids overflow/underflow without changing the correlation. No NIST software, images or example data are copied.

The local contract adds explicit policies: supplied monthly simple returns in percent, common contiguous calendar-month-end dates, inclusive window endpoints, pairwise complete observations, no filling/carrying, and an authored minimum sample. A constant vector or too few pairs yields an undefined cell with its reason. The matrix is descriptive and need not be positive semidefinite under pairwise deletion. No p-values, causality, predictive interpretation, annualization, level-to-return conversion or portfolio-risk estimate is provided.
