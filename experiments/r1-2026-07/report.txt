## R1 Stage 1 — arm A (tool only) vs arm C (hook)

| Metric                | Arm A (tool only) | Arm C (hook) |
| --------------------- | ----------------: | -----------: |
| Sessions              |                4 |            3 |
| Retrieval attempted   |              4/4 |          3/3 |
| Retrieval succeeded   |              4/4 |          3/3 |
| Retrieval before code |        2/4 (50%) |    2/3 (67%) |
|   95% CI (Wilson)     |          15%–85% |      21%–94% |
| Wrong retrieval       |                1 |            0 |
| Missed retrieval      |              0/4 |          1/3 |
| Unnecessary (avg)     |             1.00 |         3.00 |
| Median latency (ms)   |             0.17 |         0.18 |
| Version-skew failures |                0 |            0 |

### Arm A verdict: 50% auto-retrieval (CI 15%–85%)
Decision band: 40–89% → run Stage 2 (stub arm)

### First action (default instinct)
- arm a: Bash:4
- arm c: Bash:2, ToolSearch:1

### Per-category, arm A (before_code / n)
- auth: 2/2
- billing: 0/2

### Per-task, arm A
- auth: before_code 2/2, missed 0/2
- billing: before_code 0/2, missed 0/2

### Representative failures (arm A, no retrieval before code)
- a-billing-1: first_action=Bash, attempted=true, n_brain_calls=10
- a-billing-2: first_action=Bash, attempted=true, n_brain_calls=2
