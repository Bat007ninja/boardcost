# BoardCost Technical Documentation

## Architecture

BoardCost is a deliberately simple static web app with a hard boundary between logic and presentation:

```
index.html          Page structure (form + estimate ticket + price breaks)
css/styles.css      All styling; no inline styles
js/calculator.js    THE ENGINE: pure functions only, no DOM access
js/app.js           UI layer: reads the form, calls the engine, renders
tests/              Jest unit tests against the engine
.github/workflows/  CI/CD pipeline (test on every push/PR, deploy on main)
docs/               Design assets, user guide, this file
scripts/            Repo automation (issue creation, re-authoring)
```

The engine (`js/calculator.js`) contains every business rule: rate tables, the blank-area model, costing steps, discount tiers, quote assembly, validation and CSV building. It exports via CommonJS when running under Node (so Jest can import it) and attaches itself to `window.BoardCost` in the browser. Because it never touches the DOM, 100% of the business logic is unit-testable without a browser or any test doubles.

The UI layer (`js/app.js`) is intentionally thin: gather a spec object from the form, hand it to `calculateQuote()`, render the returned object. It contains no arithmetic at all: if a number is wrong, the bug is in the engine and a unit test can reproduce it.

## The cost model

1. **Blank area**: the three bounding faces `(W×H + D×H + W×D)` are scaled by a per-display-type `areaFactor` (derived from measuring past cutter guides, so an FSDU with shelves uses roughly 3.2× its face area in board), then a 12% waste factor is applied.
2. **Materials**: blank area × board grade rate (£/m²) × quantity.
3. **Printing**: one-off setup (plates/make-ready) + per-m² running cost × quantity. This is why digital wins short runs and litho-lam wins long ones.
4. **Finishing**: lamination per m² across the run, plus die-cutting setup + per-unit charge if selected.
5. **Assembly**: per-unit gluing/hand-assembly labour by display type.
6. **Quote assembly**: production cost, then +35% margin, then the quantity discount (tiers at 50/100/250/500/1,000), then net total, then +20% VAT. VAT and the grand total are derived from the *rounded* net total so the quote always matches invoice arithmetic to the penny (see bug #7).

All rates are indicative and live in the tables at the top of `calculator.js`, so updating pricing never touches calculation code.

## Running locally

No build step and no server required:

```bash
git clone https://github.com/Bat007ninja/boardcost.git
cd boardcost
# open index.html in a browser, or serve it:
npx http-server .        # then visit http://localhost:8080
```

## Running the tests

```bash
npm install     # installs Jest (the only dependency)
npm test        # run the suite once
npm run test:watch      # re-run on file change (used during TDD)
npm run test:coverage   # coverage report
```

The suite (44 tests) covers every engine function: known-value calculations, comparative behaviour (e.g. litho beats digital at volume), every discount tier boundary, validation errors, quote integration checks, the VAT rounding regression, price-break ordering and CSV output.

## CI/CD

`.github/workflows/ci.yml` defines two jobs:

- **test**: on every push and pull request to `main`: checkout, Node 20 with npm cache, `npm ci`, `npm test -- --ci`. A red suite blocks the merge.
- **deploy**: only on pushes to `main` and only after `test` passes: publishes the repository to GitHub Pages, so the live site always reflects tested code on `main`.

## Contributing workflow

One ticket maps to one branch and one pull request. Feature branches are named `feature/<short-name>`, bug fixes `bugfix/<short-name>`, and every commit message references its issue (`#3`). A bug fix must add a failing regression test before the fix (see the `regression #7` test in `tests/calculator.test.js`).
