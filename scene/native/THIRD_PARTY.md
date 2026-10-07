# Third-party code in the scene engine

## Rate functions from Manim (3b1b/manim)

`src/motion.rs` (`smooth`, `bezier` and `named`) adapts the rate functions of
`manimlib/utils/rate_functions.py` from https://github.com/3b1b/manim at revision
`fafa083a4fb274bba9cabde0b6e2f50ba6da0622`:

- Source file SHA-256: `08e1cb99d97efe53820507adfcdd7fb7501af0c9eee9a9c28ac68f9a7edb2b4c`.
- Licence file SHA-256 (`LICENSE.md` at the same revision): `fe450f4b69c56c80e4ba2f3226174d1af417e7c1728362ed81a8f6c0b909eb43`.

**What was adapted.** The curves were translated from Python to Rust: `smooth`, `rush_into`, `rush_from`, `slow_into`, `double_smooth`, `there_and_back`, `there_and_back_with_pause` (pause ratio 1/3), `running_start` (pull −0.5), `overshoot` (pull 1.5), `wiggle` (2 wiggles), `lingering` and `exponential_decay` (half-life 0.1).

**ClearFrame's changes.**
- Inputs are clamped to [0, 1].
- The names are camelCase: `thereAndBackPause` and `decay` are the last two.
- The parameters are fixed at the upstream defaults.

Nothing else from Manim (rendering, scenes or assets) is included. Nothing from 3b1b/videos is included; that repository is CC BY-NC-SA 4.0, a different licence.

```
MIT License

Copyright (c) 2020-2026 3Blue1Brown LLC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
