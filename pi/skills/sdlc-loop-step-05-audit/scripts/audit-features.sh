#!/usr/bin/env bash
# sdlc-loop step-05 gate: the feature map matches its contract.
#
# Usage: audit-features.sh [features-dir]   (default: resource/features)
#
# Checks, per feature file: a Type line naming Behavior or Surface, the
# required sections in order, an Anchors section, and every anchor
# "path: needle" greps in its file. Checks the index links every feature
# file and that every sub-feature ID has exactly one home. Exits non-zero
# on any failure and names what failed.
set -uo pipefail

dir="${1:-resource/features}"
fail=0
all_ids=""

if [ ! -f "$dir/README.md" ]; then
  echo "FAIL missing index $dir/README.md"
  exit 1
fi

for f in "$dir"/*.md; do
  [ "$f" = "$dir/README.md" ] && continue
  base="$(basename "$f")"

  # Required sections, in order.
  prev=0
  for h in "## Sub-features" "## How to get to it (user POV)" "## Driving it" "## Gotchas" "## Anchors"; do
    line="$(grep -n "^$h" "$f" | head -1 | cut -d: -f1)"
    if [ -z "$line" ]; then
      echo "FAIL $base: missing section '$h'"
      fail=1
      continue
    fi
    if [ "$line" -le "$prev" ]; then
      echo "FAIL $base: section '$h' out of order"
      fail=1
    fi
    prev="$line"
  done

  # Type line names Behavior or Surface.
  if ! grep -qE '^Type: (Behavior|Surface)$' "$f"; then
    echo "FAIL $base: missing 'Type: Behavior' or 'Type: Surface' line"
    fail=1
  fi

  # Sub-feature IDs, collected for the uniqueness check below.
  all_ids="$all_ids
$(awk '/^## Sub-features/{f=1;next} /^## /{f=0} f && /^- `/{ match($0, /`[^`]+`/); print substr($0, RSTART+1, RLENGTH-2) }' "$f")"

  # Anchors: "- <path>: <needle>" bullets under ## Anchors.
  in_anchors=0
  while IFS= read -r l; do
    case "$l" in
      "## Anchors") in_anchors=1; continue ;;
      "## "*) in_anchors=0; continue ;;
    esac
    [ "$in_anchors" = 1 ] || continue
    case "$l" in
      "- "*)
        spec="${l#- }"
        path="${spec%%:*}"
        needle="${spec#*: }"
        if [ ! -f "$path" ]; then
          echo "FAIL $base: anchor path missing: $path"
          fail=1
        elif ! grep -qF "$needle" "$path"; then
          echo "FAIL $base: anchor needle not found in $path: $needle"
          fail=1
        fi
        ;;
    esac
  done < "$f"

  # Index links every feature file.
  if ! grep -qF "$base" "$dir/README.md"; then
    echo "FAIL README.md: no link to $base"
    fail=1
  fi
done

# Every sub-feature ID has exactly one home.
dup="$(printf '%s\n' "$all_ids" | sed '/^$/d' | sort | uniq -d)"
if [ -n "$dup" ]; then
  echo "FAIL sub-feature ID defined in more than one file: $(printf '%s' "$dup" | tr '\n' ' ')"
  fail=1
fi

if [ "$fail" = 1 ]; then
  exit 1
fi
echo "feature map audit: PASS"
