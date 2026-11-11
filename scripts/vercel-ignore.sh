#!/usr/bin/env bash
# Vercel's "Ignored Build Step" (vercel.json → ignoreCommand). Exit 0 = skip this deploy,
# exit 1 = build it. Every deploy keeps a full copy of the site (about 90 MB), and the free plan
# holds 10 GB, so commits that only change notes and plans don't rebuild the site.
#
# Always builds:
#   - "Rebuild…" commits (pushed on purpose after Matt runs SQL, usually empty)
#   - empty commits, or when the changes can't be worked out (no record of the last deploy)
#   - anything that touches a file outside docs/ and Markdown (*.md)
# Skips: commits that only change docs/ or *.md files (CLAUDE.md, specs, READMEs).

msg="${VERCEL_GIT_COMMIT_MESSAGE:-$(git log -1 --pretty=%s 2>/dev/null)}"
case "$msg" in
  Rebuild*|rebuild*) echo "Build: a rebuild commit."; exit 1 ;;
esac

# Compare with the last deploy that went out. If that isn't known or isn't in Vercel's copy of the
# history, build: comparing with just the previous commit could miss code pushed in the same go.
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  echo "Build: the last deploy's commit isn't available to compare with."
  exit 1
fi
files="$(git diff --name-only "$base" HEAD 2>/dev/null)" || { echo "Build: couldn't compare with $base."; exit 1; }

if [ -z "$files" ]; then echo "Build: no file changes (an on-purpose rebuild)."; exit 1; fi

if printf '%s\n' "$files" | grep -qvE '^docs/|\.md$'; then
  echo "Build: code or content changed."
  exit 1
fi

echo "Skip: only notes changed:"
printf '  %s\n' $files
exit 0
