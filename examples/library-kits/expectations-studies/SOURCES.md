# Sources and rights

All case data, prose and native geometry in this kit are original fictional examples. Dates describe the authored examples, not real economic releases or investment outcomes. No source chart, photograph, logo or external dataset is redistributed. Original kit code and content use the repository's MIT license; bundled fonts retain their pinned OFL notices.

The methods were checked against primary references on 2026-10-03:

- [St. Louis Fed: real-time periods](https://fred.stlouisfed.org/docs/api/fred/realtime_period.html) distinguishes an observation period from the time when its information was available. Cutoffs here include releases on the cutoff date.
- [ALFRED download help](https://alfred.stlouisfed.org/help/downloaddata) describes vintage dates and later revisions. This kit implements its own small explicit release log; it does not call or claim to replicate the ALFRED service.
- [US Treasury interest-rate FAQ](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/interest-rates-frequently-asked-questions) distinguishes a dated maturity curve from a forecast of future rates. The fictional quotes here are not Treasury data, CMT estimates or a fitted official curve. Negative example quotes do not assert that published nominal CMT rates are negative.
- [US Treasury yield-curve methodology](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology) documents that constructing a fitted curve is a separate model. This kit only positions supplied quotes and does not bootstrap or fit a curve.
- [R stats: sample quantiles](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/quantile.html) identifies type 7 as a continuous sample-quantile convention. The independent implementation uses zero-based rank `h=(n-1)p` and linear interpolation between its adjacent supplied sorted values. Equal scenario weights are descriptive, not calibrated likelihoods.

The source inspiration IDs in the research inventory identify the storytelling stress tests. They do not supply or license this kit's numerical inputs.
