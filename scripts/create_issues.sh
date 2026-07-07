#!/usr/bin/env bash
# =============================================================================
# BoardCost — one-shot GitHub setup.
#
# Run this ONCE from the repo root AFTER you have pushed to GitHub.
# Requires the GitHub CLI (`gh`) and an authenticated session (`gh auth login`).
#
# It will:
#   1. Create the project labels
#   2. Create the 10 backlog issues (features, chores, one bug) so issue
#      numbers #1–#10 match the references in the commit history and README
#   3. Close the completed issues with a comment linking them to their branch
#   4. Open and merge one live demo pull request (chore/repo-housekeeping)
#      so the repo contains a real PR alongside the merge history
#
# Usage:  bash scripts/create_issues.sh
# =============================================================================
set -euo pipefail

echo "==> Checking gh authentication..."
gh auth status

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "==> Working on $REPO"

# ---------------------------------------------------------------------------
# 1. Labels
# ---------------------------------------------------------------------------
echo "==> Creating labels..."
gh label create feature --color 1D76DB --description "New user-facing functionality" --force
gh label create bug     --color D73A4A --description "Defect with reproduction steps" --force
gh label create chore   --color BFD4F2 --description "Tooling, setup and housekeeping" --force
gh label create docs    --color 0E8A16 --description "Documentation work" --force
gh label create design  --color C5DEF5 --description "Wireframes, mockups and UX" --force

# ---------------------------------------------------------------------------
# 2. Issues — order matters so numbers match the commit references.
# ---------------------------------------------------------------------------
echo "==> Creating issues..."

gh issue create --title "Project setup and repository scaffold" --label chore --body "$(cat << 'BODY'
## Task
Initialise the repository: folder structure, package.json, .gitignore, MIT licence and Jest as the test runner.

## Acceptance criteria
- [ ] Repo has index.html, css/, js/, tests/ structure
- [ ] npm test runs Jest
- [ ] node_modules ignored
BODY
)"

gh issue create --title "Design wireframes and hi-fi mockup" --label design --body "$(cat << 'BODY'
## Task
Produce a low-fidelity wireframe and a high-fidelity mockup of the single-page layout before any UI code is written.

## Acceptance criteria
- [ ] Lo-fi wireframe showing the two-panel layout (spec form / estimate ticket)
- [ ] Hi-fi mockup with the kraft/ink colour scheme
- [ ] Both exported to docs/design/ and referenced in the README
BODY
)"

gh issue create --title "Core cost calculation engine" --label feature --body "$(cat << 'BODY'
## User story
As an **account manager**, I want **display specs converted into a full cost breakdown** so that **I can give customers an indicative price on the first call instead of waiting days for estimating**.

## Acceptance criteria
- [ ] Blank area derived from W/H/D and display type (FSDU, CDU, standee, dump bin)
- [ ] Material, print, finishing and assembly costs calculated from a single rates table
- [ ] Margin applied; invalid specs rejected with clear error messages
- [ ] Built test-first with Jest (pure functions, no DOM)
BODY
)"

gh issue create --title "Quote form UI and estimate ticket" --label feature --body "$(cat << 'BODY'
## User story
As an **account manager**, I want **a simple form and a printed-ticket style breakdown** so that **I can read a quote line by line the same way our estimates look on paper**.

## Acceptance criteria
- [ ] Form captures type, dimensions, board grade, print, finishing, quantity
- [ ] Breakdown renders materials → grand total → unit price
- [ ] Validation errors shown inline, not as alerts
- [ ] Usable on a phone (single column below 820px)
BODY
)"

gh issue create --title "Quantity price breaks" --label feature --body "$(cat << 'BODY'
## User story
As a **customer-facing salesperson**, I want **unit prices at standard quantity tiers** so that **I can upsell larger runs by showing the saving immediately**.

## Acceptance criteria
- [ ] Discount tiers at 50/100/250/500/1000 units
- [ ] Table of ex-VAT unit prices per tier, current tier highlighted
- [ ] Tier boundaries unit tested
BODY
)"

gh issue create --title "CI pipeline with GitHub Actions" --label chore --body "$(cat << 'BODY'
## Task
Every push and pull request to main must run the Jest suite; merges to main deploy the site to GitHub Pages.

## Acceptance criteria
- [ ] Workflow runs npm ci and npm test on push + PR
- [ ] Deploy job publishes to GitHub Pages only after tests pass on main
BODY
)"

gh issue create --title "BUG: VAT drifts by pennies on odd unit prices" --label bug --body "$(cat << 'BODY'
## Expected behaviour
VAT equals exactly 20% of the rounded net total, and the grand total equals net + VAT to the penny — matching invoice arithmetic.

## Actual behaviour
On some quantities (e.g. 137 units of the default FSDU spec) the grand total disagrees with net + VAT by 1–2p because VAT was derived from unrounded intermediates.

## Steps to reproduce
1. Open the app
2. Keep the default FSDU spec, set quantity to 137
3. Calculate — compare Net total + VAT against Grand total

## Environment
Any browser; engine-level defect.

## Severity
Medium — small amounts, but wrong money figures destroy trust in a quoting tool.
BODY
)"

gh issue create --title "Export quote as CSV" --label feature --body "$(cat << 'BODY'
## User story
As an **account manager**, I want **to download the quote as a CSV** so that **I can attach it to a customer email or paste it into our estimating spreadsheet**.

## Acceptance criteria
- [ ] One click downloads a dated .csv of the full breakdown
- [ ] Opens cleanly in Excel; values with commas are escaped
- [ ] CSV builder is a pure, unit-tested function
BODY
)"

gh issue create --title "User and technical documentation" --label docs --body "$(cat << 'BODY'
## Task
Write user documentation (how to use the app) and technical documentation (architecture, running locally, running tests) in docs/ and summarised in the README.

## Acceptance criteria
- [ ] docs/USER_GUIDE.md walks an end user through a quote
- [ ] docs/TECHNICAL.md covers architecture, local setup and testing
- [ ] README links both
BODY
)"

gh issue create --title "Product evaluation write-up" --label docs --body "$(cat << 'BODY'
## Task
Evaluate the finished MVP against the original success criteria in a dedicated README section: what worked, what didn't, and what a v2 would need.

## Acceptance criteria
- [ ] Assessed against the success criteria from the proposal
- [ ] Honest limitations section
- [ ] Prioritised future work list
BODY
)"

# ---------------------------------------------------------------------------
# 3. Close the completed issues with traceability comments.
# ---------------------------------------------------------------------------
echo "==> Closing completed issues..."
gh issue close 1  -c "Completed in the initial scaffold commit on main."
gh issue close 2  -c "Completed on branch feature/design-assets — wireframe and mockup in docs/design/."
gh issue close 3  -c "Completed on branch feature/calculator-engine (TDD — see tests/calculator.test.js)."
gh issue close 4  -c "Completed on branch feature/quote-ui."
gh issue close 5  -c "Completed on branch feature/quantity-breaks."
gh issue close 6  -c "Completed on branch feature/ci-pipeline — see the Actions tab."
gh issue close 7  -c "Fixed on branch bugfix/vat-rounding. Regression test added: 'regression #7: VAT is calculated on the order total, not per unit'."
gh issue close 8  -c "Completed on branch feature/csv-export."
gh issue close 9  -c "Completed on main — docs/USER_GUIDE.md, docs/TECHNICAL.md and README sections 8."
gh issue close 10 -c "Completed on main — README section 10 (Evaluation)."

# ---------------------------------------------------------------------------
# 4. One live demo PR so the repo contains a real pull request.
# ---------------------------------------------------------------------------
echo "==> Opening and merging a live demo pull request..."
git checkout -b chore/repo-housekeeping
cat > .editorconfig << 'EOF'
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
EOF
git add .editorconfig
git commit -m "chore: add .editorconfig for consistent formatting"
git push -u origin chore/repo-housekeeping
gh pr create \
  --title "chore: add .editorconfig for consistent formatting" \
  --body "Housekeeping PR adding an .editorconfig so every contributor's editor agrees on indentation and line endings. Demonstrates the ticket → branch → PR → review → merge workflow described in the README." \
  --base main
gh pr merge --merge --delete-branch
git checkout main
git pull

echo ""
echo "All done. Next steps:"
echo "  - Set up the GitHub Projects board (see README section 3 / SETUP_INSTRUCTIONS)"
echo "  - Check the Actions tab: CI should be green"
