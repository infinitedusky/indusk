# Greploop

Iteratively fix a PR/MR/CL until Greptile gives a perfect review: 5/5 confidence, zero unresolved comments.

Use when the user wants to fully optimize a PR (GitHub), MR (GitLab), or shelved changelist (Perforce) against Greptile's code review standards.

**Requires the Greptile bot to be installed on the repo** (the SaaS reviewer service). If the project doesn't use Greptile, use [`check-pr`](../check-pr/) instead — it covers PR hygiene without the Greptile-specific trigger/poll loop.

## Inputs

- **PR/MR/CL number** (optional): If not provided, detect the PR/MR for the current branch, or the default pending changelist for p4.

## Instructions

### 0. Detect platform

First check for Perforce, then fall back to git remote detection:

```bash
if p4 info >/dev/null 2>&1; then
  VCS="perforce"
else
  REMOTE_URL=$(git remote get-url origin)
  if echo "$REMOTE_URL" | grep -qi "gitlab"; then
    VCS="gitlab"
  else
    VCS="github"
  fi
fi
```

For self-hosted GitLab instances whose hostname doesn't contain "gitlab", the user can override by passing `--vcs gitlab`. For Perforce, pass `--vcs perforce`.

### 1. Identify the PR/MR/CL

**GitHub:**
```bash
gh pr view --json number,headRefName -q '{number: .number, branch: .headRefName}'
```

**GitLab:**
```bash
glab mr view --output json | jq '{iid: .iid, branch: .source_branch}'
```

Switch to the PR/MR branch if not already on it.

**Perforce:**
```bash
p4 changes -s pending -u $P4USER -c $P4CLIENT
p4 describe -s <CL_NUMBER>
```

Ensure the correct workspace (`p4 client`) is set before proceeding.

Key field differences:
- GitHub: `number`, `headRefName`, `headRefOid`
- GitLab: `iid`, `source_branch`, `sha`
- Perforce: changelist number, `P4CLIENT`, shelved files

### 2. Loop

Repeat the following cycle. **Max 5 iterations** to avoid runaway loops.

#### A. Trigger Greptile review

Push/shelve the latest changes (if any):

**GitHub/GitLab:**
```bash
git push
```

**Perforce:**
```bash
p4 shelve -f -c <CL_NUMBER>
```

Wait for checks to start after push/shelve:

```bash
sleep 5
```

**GitHub** — check if Greptile is already running before posting a new trigger comment:

```bash
GREPTILE_STATE=$(gh pr checks <PR_NUMBER> --json name,state | jq -r '.[] | select(.name | test("greptile"; "i")) | .state')
```

If Greptile is **not** already running (`PENDING` or `IN_PROGRESS`), request a fresh review:

```bash
if [ "$GREPTILE_STATE" != "PENDING" ] && [ "$GREPTILE_STATE" != "IN_PROGRESS" ]; then
  gh pr comment <PR_NUMBER> --body "@greptile review"
fi
```

Then poll for the Greptile check run to complete:

```bash
HEAD_SHA=$(gh pr view <PR_NUMBER> --json headRefOid -q .headRefOid)

while true; do
  GREPTILE_CHECK=$(gh api "repos/{owner}/{repo}/commits/$HEAD_SHA/check-runs" \
    --jq '.check_runs[] | select(.name | test("greptile"; "i"))' 2>/dev/null)

  if [ -z "$GREPTILE_CHECK" ]; then
    echo "Waiting for Greptile check to appear..."
    sleep 5
    continue
  fi

  STATUS=$(echo "$GREPTILE_CHECK" | jq -r '.status // "completed"')
  CONCLUSION=$(echo "$GREPTILE_CHECK" | jq -r '.conclusion // "pending"')

  if [ "$STATUS" = "completed" ]; then
    if [ "$CONCLUSION" = "success" ]; then
      echo "Greptile check passed!"
    else
      echo "Greptile check completed with: $CONCLUSION"
    fi
    break
  fi

  echo "Waiting for Greptile... (status: $STATUS)"
  sleep 10
done
```

**GitLab** — check if Greptile is already running before posting a trigger comment:

```bash
PIPELINES=$(glab api "projects/:fullpath/merge_requests/<MR_IID>/pipelines")
GREPTILE_RUNNING=$(echo "$PIPELINES" | jq '[.[] | select(.status == "running" or .status == "pending")] | length')
```

If no pipeline is running, post a trigger comment:

```bash
if [ "$GREPTILE_RUNNING" = "0" ]; then
  glab mr note <MR_IID> --message "@greptile review"
fi
```

**Perforce** — Perforce does not have native check runs. If Greptile is integrated via a webhook triggered on `p4 shelve`, wait for it to process. Check your Greptile installation's webhook endpoint or dashboard for the review status. Poll by re-fetching the Greptile review comment on the CL until a score appears.

Then poll for the Greptile pipeline job to complete (see GitLab API appendix):

```bash
HEAD_SHA=$(glab mr view <MR_IID> --output json | jq -r '.sha')

while true; do
  PIPELINES=$(glab api "projects/:fullpath/merge_requests/<MR_IID>/pipelines")
  PIPELINE_ID=$(echo "$PIPELINES" | jq -r --arg sha "$HEAD_SHA" \
    '[.[] | select(.sha == $sha)] | sort_by(.id) | last | .id // empty')

  if [ -z "$PIPELINE_ID" ]; then
    echo "Waiting for Greptile pipeline to appear..."
    sleep 5
    continue
  fi

  JOBS=$(glab api "projects/:fullpath/pipelines/$PIPELINE_ID/jobs")
  GREPTILE_JOB=$(echo "$JOBS" | jq '.[] | select(.name | test("greptile"; "i"))')

  if [ -z "$GREPTILE_JOB" ]; then
    echo "Waiting for Greptile job to appear..."
    sleep 5
    continue
  fi

  JOB_STATUS=$(echo "$GREPTILE_JOB" | jq -r '.status')

  if [ "$JOB_STATUS" = "success" ] || [ "$JOB_STATUS" = "failed" ] || [ "$JOB_STATUS" = "canceled" ]; then
    echo "Greptile job completed with: $JOB_STATUS"
    break
  fi

  echo "Waiting for Greptile... (status: $JOB_STATUS)"
  sleep 10
done
```

#### B. Fetch Greptile review results

Greptile may surface its score in two places — check **both** (three for Perforce):

**GitHub:**

1. PR description (body):
```bash
gh pr view <PR_NUMBER> --json body -q '.body'
```

2. PR reviews:
```bash
gh api repos/{owner}/{repo}/pulls/<PR_NUMBER>/reviews
```

Look for the most recent entry from `greptile-apps[bot]` or `greptile-apps-staging[bot]`.

**GitLab:**

1. MR description (body):
```bash
glab mr view <MR_IID> --output json | jq -r '.description'
```

2. MR notes (comments):
```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/notes"
```

Filter for notes from the Greptile bot user (check the `author.username` field — the exact username may vary per installation; verify on first run).

**Perforce:**

1. CL description:
```bash
p4 describe -s <CL_NUMBER>
```
Check the description field for a Greptile-appended score block.

2. CL comments / review notes — if your installation uses a review tool such as Helix Swarm, fetch comments via its API:

```
GET /api/v11/comments?topic=reviews/<REVIEW_ID>
```

Response fields of interest:
- `user` (author username)
- `body` (comment text)
- flags/state indicating whether the comment is resolved

Filter to comments authored by the Greptile bot:
- Prefer exact username match if known
- Otherwise heuristic where the author name contains "greptile" (case-insensitive)

For all platforms, parse the text for:
- **Confidence score**: a pattern like `3/5` or `5/5` (or `Confidence: 3/5`).
- **Comment count**: number of inline review comments noted in the summary.

Use whichever source has the **most recent** score.

Also fetch all unresolved inline comments:

**GitHub:**
```bash
gh api repos/{owner}/{repo}/pulls/<PR_NUMBER>/comments
```

**GitLab:**
```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/discussions"
```

Filter to `DiffNote` type discussions (`notes[0].type == "DiffNote"`) from Greptile that are on the latest commit and not yet resolved (`"resolved": false`).

**Perforce** — if using Swarm:

```
GET /api/v11/comments?topic=reviews/<REVIEW_ID>
```

Filter to comments from the Greptile bot user that have not been marked as resolved/addressed.

#### C. Check exit conditions

Stop the loop if **any** of these are true:

- Confidence score is **5/5** AND there are **zero unresolved comments**
- Max iterations reached (report current state)

#### D. Fix actionable comments

For each unresolved Greptile comment:

1. Read the file and understand the comment in context.
2. Determine if it's actionable (code change needed) or informational.
3. If actionable, make the fix.
4. If informational or a false positive, note it but still resolve the thread.

#### E. Resolve threads

**GitHub** — fetch unresolved review threads and resolve all that have been addressed (see GraphQL appendix):

```bash
gh api graphql -f query='
query($cursor: String) {
  repository(owner: "OWNER", name: "REPO") {
    pullRequest(number: PR_NUMBER) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes { body path author { login } }
          }
        }
      }
    }
  }
}'
```

Resolve addressed threads:

```bash
gh api graphql -f query='
mutation {
  t1: resolveReviewThread(input: {threadId: "ID1"}) { thread { isResolved } }
  t2: resolveReviewThread(input: {threadId: "ID2"}) { thread { isResolved } }
}'
```

**GitLab** — fetch unresolved discussions and resolve each one (see GitLab API appendix):

```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/discussions?per_page=100"
```

Filter for `"resolved": false` discussions. Then resolve each by its `id`:

```bash
glab api --method PUT \
  "projects/:fullpath/merge_requests/<MR_IID>/discussions/<DISCUSSION_ID>" \
  --field resolved=true
```

Repeat for each unresolved discussion ID. (GitLab has no batch resolution — loop through each one.)

#### F. Commit and push / re-shelve

**GitHub/GitLab:**
```bash
git add -A
git commit -m "address greptile review feedback (greploop iteration N)"
git push
```

**Perforce:**
```bash
p4 shelve -f -c <CL_NUMBER>
```

Wait for checks to start after push/shelve:

```bash
sleep 5
```

Then go back to step **A**.

### 3. Report

After exiting the loop, summarize:

| Field              | Value      |
| ------------------ | ---------- |
| Platform           | GitHub / GitLab / Perforce |
| Iterations         | N          |
| Final confidence   | X/5        |
| Comments resolved  | N          |
| Remaining comments | N (if any) |

If the loop exited due to max iterations, list any remaining unresolved comments and suggest next steps.

## Output format

```
Greploop complete.
  Platform:      GitHub
  Iterations:    2
  Confidence:    5/5
  Resolved:      7 comments
  Remaining:     0
```

If not fully resolved:

```
Greploop stopped after 5 iterations.
  Platform:      GitLab
  Confidence:    4/5
  Resolved:      12 comments
  Remaining:     2

Remaining issues:
  - src/auth.ts:45 — "Consider rate limiting this endpoint"
  - src/db.ts:112 — "Missing index on user_id column"
```

Perforce example:

```
Greploop complete.
  Platform:      Perforce
  Changelist:    12345
  Iterations:    3
  Confidence:    5/5
  Resolved:      9 comments
  Remaining:     0
```

## Appendix: GitHub GraphQL queries

### Fetch unresolved review threads (paginated)

```graphql
query($cursor: String) {
  repository(owner: "OWNER", name: "REPO") {
    pullRequest(number: PR_NUMBER) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          comments(first: 3) {
            nodes {
              body
              path
              author { login }
              createdAt
            }
          }
        }
      }
    }
  }
}
```

### Batch-resolve threads

```graphql
mutation {
  t1: resolveReviewThread(input: {threadId: "ID1"}) { thread { isResolved } }
  t2: resolveReviewThread(input: {threadId: "ID2"}) { thread { isResolved } }
}
```

## Appendix: GitLab API

`glab api` automatically resolves `:fullpath` to the URL-encoded project path from the local git remote.

### Fetch MR details

```bash
glab mr view <MR_IID> --output json
```

Key fields:
- `iid` — internal MR number (use this, not `id`)
- `source_branch` — equivalent to GitHub's `headRefName`
- `sha` — HEAD commit SHA
- `description` — MR body (Greptile may update this with the confidence score)

### Trigger Greptile review

```bash
glab mr note <MR_IID> --message "@greptile review"
```

### Fetch pipelines for an MR

```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/pipelines"
```

Check `status` field: `running`, `pending`, `success`, `failed`, `canceled`, `skipped`.

### Fetch jobs for a pipeline (to find the Greptile job)

```bash
glab api "projects/:fullpath/pipelines/<PIPELINE_ID>/jobs"
```

Filter jobs where `name` matches `greptile` (case-insensitive). Terminal statuses: `success`, `failed`, `canceled`.

### Check if any pipeline is running

```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/pipelines" | \
  jq '[.[] | select(.status == "running" or .status == "pending")] | length'
```

Returns `0` if no pipelines are running/pending.

### Find pipeline for a specific commit SHA

```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/pipelines" | \
  jq -r --arg sha "COMMIT_SHA" '[.[] | select(.sha == $sha)] | sort_by(.id) | last | .id // empty'
```

### Fetch MR notes (to find Greptile's confidence score)

```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/notes?per_page=100&sort=desc&order_by=created_at"
```

Filter by `author.username` for the Greptile bot. Scan `body` for a confidence pattern like `3/5` or `5/5`.

The Greptile bot username on GitLab may differ from GitHub's `greptile-apps[bot]` — check the first Greptile comment on the MR to identify the exact username.

### Fetch unresolved discussions (inline comments)

```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/discussions?per_page=100"
```

Paginate with `&page=2`, etc. until response array length < `per_page`.

Filter for unresolved inline diff comments from Greptile:
```bash
jq '[.[] | select(.resolved == false and (.notes[0].type == "DiffNote") and (.notes[0].author.username == "GREPTILE_BOT_USERNAME"))]'
```

Each discussion has:
- `id` — use this for resolution
- `notes[0].body` — the comment text
- `notes[0].position.new_path` — file path

### Resolve a discussion

```bash
glab api --method PUT \
  "projects/:fullpath/merge_requests/<MR_IID>/discussions/<DISCUSSION_ID>" \
  --field resolved=true
```

GitLab has no batch resolution — issue one PUT per discussion.

## See Also

- [`check-pr`](../check-pr/) — generic PR hygiene without the Greptile loop. Use this when the repo doesn't have Greptile installed.

## Source

Adapted from [greptileai/skills](https://github.com/greptileai/skills) (`greploop` v1.2, MIT license). Inlined into a single skill.md to fit InDusk's one-skill-per-extension format.
