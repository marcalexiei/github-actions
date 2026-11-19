# Prints `<dir>/node_modules` for each project in pnpm-lock.yaml's `importers`.
# pnpm 11+ lockfiles hold two documents, so a directory can print twice.
/^importers:/ { in_importers = 1; next }
/^[^ ]/ { in_importers = 0 }
in_importers && /^  [^ ]/ {
  dir = $0
  sub(/^  /, "", dir)
  sub(/:( [{][}])?$/, "", dir)
  gsub(/^'|'$/, "", dir)
  print dir "/node_modules"
}
