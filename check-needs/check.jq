# Input: the current run attempt's jobs API pages. $workflow[0]: the workflow file's `.jobs`.
# env.NEEDS: the gate's `toJSON(needs)`.

def escape: gsub("(?<c>[\\\\.*+?^$()\\[\\]{}|])"; "\\\(.c)");

# Each `${{ }}` matches anything, even nothing, and GitHub trims the spaces that leaves.
# GitHub may append ` (matrix values)`, and a reusable workflow's jobs show as `caller / job`.
def pattern:
  .key as $key
  | .value as $job
  | if $job.name == null then [$key]
    else [$job.name | tostring | splits("\\$\\{\\{.*?\\}\\}")]
    end
  | {
      key: $key,
      # The most literal match owns a run job, so `${{ matrix.name }}` never claims the gate.
      literal: (map(gsub("\\s"; "")) | add | length),
      regex: (
        "^\\s*" + (map(escape | gsub("^\\s+|\\s+$"; "")) | join("\\s*.*\\s*")) + "\\s*"
        + "( \\(.+\\))?" + (if $job.uses == null then "" else "( / .+)?" end) + "$"
      )
    };

(env.NEEDS | fromjson | keys) as $needed
| ($workflow[0] | to_entries | map(pattern)) as $patterns
| [
    .[].jobs[]
    | . as $run
    | [$patterns[] | select(.regex as $re | $run.name | test($re))] as $matches
    | ($matches | map(.literal) | max) as $best
    | {
        name,
        conclusion: (.conclusion // .status),
        keys: [$matches[] | select(.literal == $best) | .key]
      }
  ] as $jobs
# A job no name claims fails the gate: it may be a needed one under an unexpected name.
| ($jobs | map(select(.keys == [])) | map("\(.name) matches no job in the workflow file")) as $unclaimed
| [$jobs[] | select(any(.keys[]; IN(.; $needed[]))) | .keys = [.keys[] | select(IN(.; $needed[]))]]
  as $judged
| {
    judged: ($judged | map(del(.keys))),
    errors: (
      $unclaimed
      + (($needed - ($judged | map(.keys[]))) | map("\(.) matched no job in the run"))
      # A whole needed job skipped already fails the `needs` check; a reusable workflow skips jobs.
      + ($judged | map(select(.conclusion != "success" and .conclusion != "skipped") | "\(.name): \(.conclusion)"))
    )
  }
