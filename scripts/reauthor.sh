#!/usr/bin/env bash
# Re-stamp every commit in this repo with your own name and email so the
# history links to your GitHub account. Run BEFORE pushing.
#
# Usage: bash scripts/reauthor.sh "Your Name" "your-email@example.com"
set -euo pipefail

NAME="${1:?Usage: bash scripts/reauthor.sh \"Your Name\" \"email\"}"
EMAIL="${2:?Usage: bash scripts/reauthor.sh \"Your Name\" \"email\"}"

export FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch -f --env-filter "
export GIT_AUTHOR_NAME=\"$NAME\"
export GIT_AUTHOR_EMAIL=\"$EMAIL\"
export GIT_COMMITTER_NAME=\"$NAME\"
export GIT_COMMITTER_EMAIL=\"$EMAIL\"
" -- --all

git config user.name "$NAME"
git config user.email "$EMAIL"
echo "Done — all commits now authored by $NAME <$EMAIL>."
