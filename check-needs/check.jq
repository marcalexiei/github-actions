# Input: the run's jobs API pages. $workflow[0]: the workflow file's `.jobs`.
# env.NEEDS: the gate's `toJSON(needs)`.

def escape: gsub("(?<c>[\\\\.*+?^$()\\[\\]{}|])"; "\\\(.c)");

# Each `${{ }}` matches anything; GitHub may append ` (matrix values)`,
# and a reusable workflow's jobs show as `caller / job`.
def pattern:
  .key as $key
  | .value as $job
  | if $job.name == null then [$key]
    else [$job.name | tostring | splits("\\$\\{\\{.*?\\}\\}")]
    end
  | {
      key: $key,
      # The most literal match owns a run job, so `${{ matrix.name }}` never claims the gate.
      literal: (add | length),
      regex: (
        "^" + (map(escape) | join(".+")) + "( \\(.+\\))?"
        + (if $job.uses == null then "" else "( / .+)?" end) + "$"
      )
    };

(env.NEEDS | fromjson | keys) as $needed
| ($workflow[0] | to_entries | map(pattern)) as $patterns
| [
    [.[].jobs[]]
    | group_by(.name)[]
    # "Re-run failed jobs" leaves the earlier attempts listed.
    | (map(.run_attempt) | max) as $attempt
    | .[]
    | select(.run_attempt == $attempt)
    | . as $run
    | [$patterns[] | select(.regex as $re | $run.name | test($re))] as $matches
    | ($matches | map(.literal) | max) as $best
    | [$matches[] | select(.literal == $best and IN(.key; $needed[])) | .key] as $keys
    | select($keys | length > 0)
    | {name, conclusion: (.conclusion // .status), $keys}
  ] as $judged
| {
    judged: $judged,
    errors: (
      (($needed - ($judged | map(.keys[]))) | map("\(.) matched no job in the run"))
      + ($judged | map(select(.conclusion != "success") | "\(.name): \(.conclusion)"))
    )
  }
