# Illustrative finance calculations

`engine/lib/finance.mjs` prepares auditable numeric inputs for explanatory graphics. These pure functions do not render anything or obtain live data. No expected returns, tax limits, plan provisions or payment quotes are built in. Model version: **1**.

The first implementation supports T02 and the calculation portions of R01–R06, R08 and R09. The broader chart/statistics transforms remain future work. R07 displays supplied payout quotations and conditions; it deliberately does not compute actuarial valuation or imply equivalence. Visual acceptance remains separate from calculation correctness.

## Contracts

| Export | Inputs and result |
|---|---|
| `periodicRate(annualEffectiveRate, periodsPerYear)` | Converts an effective annual rate via `(1 + annual)^(1 / periods) - 1`; this is not a nominal APR conversion. |
| `matchingContribution({compensation, employeeContribution, tiers})` | Each `{through, rate}` is a cumulative fraction of the same period's eligible compensation and a marginal match multiplier. Returns each band's eligible contribution and match. `aboveMatchThreshold` means contributions above the last tier, not an estimate of lost matching funds. |
| `vestedBalance({employeeBalance, employerBalance, creditedService, schedule})` | `{service, fraction}` steps start at zero service and increase. Employee balance remains owned; employer balance is split into owned and unvested amounts. Credited service is an input, not inferred from calendar dates. |
| `salaryServiceBenefit({annualCompensation, creditedYears, annualAccrualRate, adjustmentFactor})` | Explicit salary-times-service formula, annual result and annual/12 monthly illustration. Every factor is required. Other pension formulas need another adapter. |
| `accountLedger({openingBalance, cashflowTiming, periods})` | Period rows and totals reconcile contributions, investment gains/losses, charged fees, funded withdrawals, unpaid fees and withdrawal shortfall. |
| `feeComparison({account, baselineFeeRate, comparisonFeeRate})` | Runs identical returns and cashflows under two per-period asset fee rates. Returns both ledgers, the ending balance difference, charged-fee difference, gain difference and funded-withdrawal difference. Existing fee fields are rejected. |
| `purchasingPower(nominalAmount, priceIndex, baseIndex)` | Returns nominal amount × base index / current index. Both indices must be positive, comparable and explicitly supplied. |

Rates are fractions: `0.01` means 1%. Monetary inputs use one consistent currency unit; currency conversion is outside the model. Match periods, compensation periods and contributions must have the same basis. There is no automatic annual true-up, legal limit or catch-up contribution logic. Supply those rules through a separately validated plan adapter when required.

## Ledger event order

Each period requires a unique `label` and explicit `returnRate`. Labels identify ordered input periods; the helper does not parse dates or infer elapsed time. Omitted employee contribution, employer contribution, withdrawal, fee rate and flat fee are zero. Explicit nulls, nonfinite values, unknown keys and return rates below −100% fail validation.

- `cashflowTiming: "start"`: contributions → requested withdrawal up to available cash → return → fees.
- `cashflowTiming: "end"`: return → fees → contributions → requested withdrawal up to available cash.

The asset fee is `post-return balance × feeRate`, plus the supplied `feeAmount`. A fee cannot consume more than the available balance; the unpaid amount remains visible. Unfunded requested withdrawals are likewise recorded, never drawn as negative payable cash. This is an explicit illustrative convention, not a representation of every provider's accounting. Negative balances, credit, tax withholding, daily accrual and intraperiod cashflows are outside this model.

`closing = opening + employee + employer + gain − charged fees − funded withdrawals`.

The comparison gap includes differences in growth and potentially funded withdrawals; it must not be labeled simply “fees paid.” Without payout differences: ending balance gap = charged-fee difference + gain difference. With different funded withdrawals, subtract the baseline-minus-comparison withdrawal difference as well.

## Evidence and precision

The independent fixtures check closed-form annuity values, hand-computed match bands, pension arithmetic, an explicit two-period fee example, reordered return paths and per-period conservation. Reproduce them with:

```sh
node --test --test-concurrency=2 test/finance.test.mjs
node examples/finance-calculations/build.mjs
```

Values use binary floating-point arithmetic with no intermediate currency rounding. Amounts and computed values are bounded to magnitude 10^12; account paths to 1,200 periods. This is an educational graphics contract, not a payroll ledger. Round for display only, consistently; inspect small residuals with a suitable tolerance. Dates, currency and source disclosures travel in the specimen evidence, and must stay visible in downstream graphics.

The [sample inputs](../examples/finance-calculations/inputs.json) and generated [results](../examples/finance-calculations/results.json) demonstrate retirement and a separate project-reserve scenario. All amounts, returns and rules there are fictional. They establish calculation behavior, not visual quality or actual plan entitlement.

The [IRS vesting guidance](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-vesting) supports separating employee ownership from employer vesting. [Department of Labor plan types](https://www.dol.gov/general/topic/retirement/typesofplans) distinguishes account accumulation from a benefit promise. [Investor.gov's calculator](https://www.investor.gov/financial-tools-calculators/calculators/compound-interest-calculator) illustrates explicit compounding inputs. None supplies the fictional fixture parameters. Primary pages checked October 2, 2026.
