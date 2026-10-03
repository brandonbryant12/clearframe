# Method provenance and rights

All numerical inputs and compositions are original fictional examples. No market observations, third-party code, imagery or audio are copied. Original files use the bundled MIT license; engine fonts retain their existing OFL notices.

- [Aswath Damodaran, discounted cash-flow models](https://pages.stern.nyu.edu/adamodar/New_Home_Page/lectures/ddm.html), consulted 2026-10-03: the constant-growth model values the first future payment divided by discount minus growth. We independently implement that formula for a fictional annual payment stream with an explicit domain rule. The historical company examples and macro estimates on that page are not reused.
- [OpenStax, Net Present Value method](https://openstax.org/books/principles-finance/pages/16-2-net-present-value-npv-method), consulted 2026-10-03: future cash flows are discounted to time zero and combined with the initial cash flow. We independently sum each declared end-year payment and subtract the supplied initial outlay.

For C0 as the annual time-zero basis, effective annual growth g and discount r (both converted from percent), finite NPV = sum from t=1 to N of C0*((1+g)/(1+r))^t minus initial outlay. There is no terminal receipt. Perpetual value = C0*(1+g)/(r-g) minus initial outlay, supported only for r>g. This contract leaves cells outside that declared model domain undefined, even if a degenerate zero-flow stream could be defined separately.

Rates, initial outlay, horizon, units and timing are authored assumptions. No tax, inflation adjustment, leverage, default, reinvestment, probability or uncertainty model is inferred. Values are sensitivities of these formulas, not investment guidance.
