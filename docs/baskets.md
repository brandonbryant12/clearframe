# Fixed-composition baskets

`fixedBasket` in `film/basket-data.mjs` answers how the cost of one unchanged basket differs across supplied dates, and how many whole baskets a fixed budget buys. Fixtures are original illustrations, not observed retail data or population inflation estimates.

Supply currency unit/decimal precision, a nonnegative integer budget in minor units, an explicit complete base date, fixed item IDs/labels/units/positive integer quantities, and strictly increasing date snapshots. Each snapshot must contain every item price key. An unknown price is explicit `null`; zero is an actual free item. A completely priced zero-cost basket is rejected because its purchase count would be unbounded. Substitution policy must be `none`.

Line cost is quantity × price. Complete basket cost is the sum. Integer division gives whole baskets; the remainder stays cash. Arithmetic uses BigInt before safe-integer conversion. The base-100 cost index retains its exact numerator/denominator alongside a floating display value. Base cost weights are expenditure weights. Missing components suppress the full cost, index, change and purchase count; their known subtotal is identified separately. Taxes, quality changes, substitutions and interpolation are never inferred.

`basketScene` in `film/baskets.mjs` composes native price and budget views for two snapshots and two to four items. Shared zero-baseline stacked bars use one declared currency domain; date groups fade without changing measured dimensions. Budget tiles have equal area and represent one whole basket each, up to twelve per date. Purchased and remaining cash share a bar whose total is the unchanged budget. Quantities, dates, sample/source copy and units stay native and editable.

New copy, four-item visual variants, extreme numeric widths and other formats require new layout review. The data helper supports up to 24 items and 120 snapshots; the scene deliberately supports less. Source validation is not final artwork acceptance.
