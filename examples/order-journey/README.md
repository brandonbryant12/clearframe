# Order journey: one idea, two looks

A 14-second example of choosing a look for an audience. It was curated by hand to demonstrate the new cast shapes; it is not agent output.

One story, an order travelling from a tap to a doorstep, is told with the same cast moves in two looks:

| Look | Palette | Feels like | Good for |
|---|---|---|---|
| `drawn` | `ink` | pen on paper, warm, human | an internal explainer, a customer-facing "how it works" |
| `pixel` | `lcd` | a handheld game, playful, retro | a launch teaser, a game or developer audience, a social clip |

| Beat | Narration | Picture |
|---|---|---|
| `order` | "Someone taps Buy, and the order flies to the server." | An envelope splits out of the phone on "Buy" and travels to the server. |
| `stock` | "It checks the stock." | A wave runs through the server and the database; the database is underlined on "stock". |
| `pack` | "The order becomes a parcel," | The server works at the envelope, which becomes a box (`swap` `by`). |
| `ship` | "rides the truck to the door," | The parcel folds into the truck (`merge`), and the truck travels to the flag. |
| `done` | "and arrives." | The flag waves; a closing hold. |

It uses the composed shapes `phone`, `envelope`, `server`, `database`, `box`, `truck` and `flag`. Find them with `node engine/cli.mjs find "order delivery"`.

## Make it

```sh
node examples/order-journey/build.mjs        # writes storyboard-{drawn,pixel}-{landscape,vertical}.json
mkdir -p build/order && cp examples/order-journey/storyboard-pixel-vertical.json build/order/storyboard.json
node engine/cli.mjs draft build/order        # free local draft voice
```

On this Mac each variant is 421 frames, about 4 s to render. `check` reports 0 errors in all four.
