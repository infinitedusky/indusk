# Check PR

Analyze a pull request (GitHub), merge request (GitLab), or shelved changelist (Perforce) for review comments, status checks, and description completeness, then help address any issues found.

Use when the user wants to check a PR/MR/CL, address review feedback, or prepare a change for submission.

## Inputs

- **PR/MR/CL number** (optional): If not provided, detect the PR/MR for the current branch, or the default pending changelist for p4.

## Instructions

### 0. Detect platform

First check if the user is working in a Perforce depot by looking for a `.p4config` file or `P4CLIENT`/`P4PORT` environment variables:

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

For self-hosted GitLab instances whose hostname doesn't contain "gitlab", the user can override by passing `--vcs gitlab` as an input. For Perforce, the user can override by passing `--vcs perforce`.

### 1. Identify the PR/MR/CL

If a number was provided, use it. Otherwise, detect it:

**GitHub:**
```bash
gh pr view --json number -q .number
```

**GitLab:**
```bash
glab mr view --output json | jq '.iid'
```

**Perforce:**
```bash
p4 changes -s pending -u $P4USER -c $P4CLIENT
```

Key field differences:
- GitHub: `number`, `headRefName`, `headRefOid`
- GitLab: `iid`, `source_branch`, `sha`
- Perforce: changelist number (CL), `shelved` files for in-review CLs

### 2. Fetch PR/MR/CL details

**GitHub:**
```bash
gh pr view <PR_NUMBER> --json title,body,state,reviews,comments,headRefName,statusCheckRollup
gh api repos/{owner}/{repo}/pulls/<PR_NUMBER>/comments
```

**GitLab:**
```bash
glab mr view <MR_IID> --output json
glab api "projects/:fullpath/merge_requests/<MR_IID>/discussions"
```

For GitLab, paginate discussions if needed (add `?per_page=100&page=N`).

**Perforce:**
```bash
p4 describe -s <CL_NUMBER>
p4 describe -S <CL_NUMBER>          # shelved files for in-review CLs
p4 diff2 //...@=<CL_NUMBER> //...@=<CL_NUMBER>
p4 review -c <CL_NUMBER>            # if using p4 review workflow
```

Key Perforce CL fields:
- `Change`: changelist number
- `Status`: `pending`, `submitted`, `shelved`
- `Description`: CL description / commit message
- `Files`: files in the CL

### 3. Wait for pending checks

Before analyzing, ensure all status checks have completed. If any checks are `PENDING` or `IN_PROGRESS` (GitHub) / `running` or `pending` (GitLab), poll every 30 seconds until all checks reach a terminal state.

**GitHub:** poll `statusCheckRollup` from `gh pr view`.

**GitLab:**
```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/pipelines"
```
Pipeline statuses: `running`, `pending`, `success`, `failed`, `canceled`, `skipped`. Poll until no pipeline has `running` or `pending` status.

**Perforce:** Perforce doesn't have built-in CI checks natively. If the team uses a review tool (Swarm, etc.) or external CI triggered by shelve events, check the relevant system. Otherwise, proceed to analysis immediately.

### 4. Analyze the PR/MR

Once all checks are complete, evaluate these areas:

#### A. Status Checks

- Are all CI checks passing?
- If any are failing, identify which ones and the failure reason.

#### B. PR/MR Description

- Is the description complete and follows team conventions?
- Are all required sections filled in?
- Are there TODOs or placeholders that need updating?

#### C. Review Comments

- Inline code review comments that need addressing
- Bot review comments (e.g. `greptile-apps[bot]` on GitHub, the Greptile bot user on GitLab, linters)
- Human reviewer comments
- **Perforce:** review comments from `p4 review` or external review tools

#### D. General Comments

- Discussion comments on the PR/MR
- Bot comments (deploy previews, etc.) — usually informational
- **Perforce:** CL description should include a clear summary, affected-files rationale, and testing notes

### 5. Categorize issues

For each issue found, categorize as:

| Category | Meaning |
|---|---|
| **Actionable** | Code changes, test improvements, or fixes needed |
| **Informational** | Verification notes, questions, or FYIs that don't require changes |
| **Already addressed** | Issues that appear to be resolved by subsequent commits |

### 6. Report findings

Present a summary table:

| Area | Issue | Status | Action Needed |
|------|-------|--------|---------------|
| Status Checks | CI build failing | Failing | Fix type error in `src/api.ts` |
| Review | "Add null check" — @reviewer | Actionable | Add guard clause |
| Description | TODO placeholder in test plan | Actionable | Fill in test plan |
| Review | "Looks good" — @teammate | Informational | None |

### 7. Fix issues (if requested)

If there are actionable items:

1. Switch to the PR/MR's branch (git) or ensure files are open in the correct CL (Perforce).
2. Ask the user if they want to fix the issues.
3. If yes, make the fixes, then:

**GitHub/GitLab:**
```bash
git add <files>
git commit -m "address review feedback"
git push
```

**Perforce:**
```bash
p4 edit <file>
# make changes
p4 shelve -f -c <CL_NUMBER>
```

### 8. Resolve review threads

After addressing comments, resolve the corresponding review threads.

**Perforce** — Perforce does not have a native "resolve thread" concept. Instead, mark comments as addressed by updating the CL description or by responding in the review tool being used (Swarm, etc.). If using `p4 review`:

```bash
p4 review -c <CL_NUMBER>
```

**GitHub** — fetch unresolved thread IDs (paginate if needed — see appendix on GraphQL queries):

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
            nodes { body path }
          }
        }
      }
    }
  }
}'
```

If `hasNextPage` is true, repeat with `-f cursor=ENDCURSOR` to get remaining threads.

Then resolve threads that have been addressed or are informational:

```bash
gh api graphql -f query='
mutation {
  resolveReviewThread(input: {threadId: "THREAD_ID"}) {
    thread { isResolved }
  }
}'
```

Batch multiple resolutions into a single mutation using aliases (`t1`, `t2`, etc.).

**GitLab** — fetch unresolved discussions (see appendix on GitLab API):

```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/discussions?per_page=100"
```

Filter for discussions where `"resolved": false`. Collect each discussion's `id`.

Resolve each discussion individually (GitLab has no batch resolution):

```bash
glab api --method PUT \
  "projects/:fullpath/merge_requests/<MR_IID>/discussions/<DISCUSSION_ID>" \
  --field resolved=true
```

Repeat for each unresolved discussion ID.

### 9. Multiple PRs/MRs/CLs

If checking a chain of PRs/MRs/CLs, process them sequentially.

**Perforce** — to check multiple changelists at once:
```bash
p4 changes -s pending -u $P4USER -c $P4CLIENT -l
```

## Output format

Summarize:
- PR/MR/CL title or description and current state
- Platform detected (GitHub / GitLab / Perforce)
- Status checks summary (passing/failing/pending) — or N/A for Perforce
- Total issues found
- Actionable items with descriptions
- Items that can be ignored with reasons
- Recommended next steps

## Appendix: GitHub GraphQL queries

### Fetch unresolved review threads (with pagination)

```graphql
query($cursor: String) {
  repository(owner: "OWNER", name: "REPO") {
    pullRequest(number: PR_NUMBER) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
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

Pass `-f cursor=ENDCURSOR` on subsequent requests if `hasNextPage` is `true`.

### Resolve a single review thread

```graphql
mutation {
  resolveReviewThread(input: {threadId: "THREAD_ID"}) {
    thread { isResolved }
  }
}
```

### Batch-resolve multiple threads

Use GraphQL aliases to resolve several threads in one request:

```graphql
mutation {
  t1: resolveReviewThread(input: {threadId: "THREAD_ID_1"}) {
    thread { isResolved }
  }
  t2: resolveReviewThread(input: {threadId: "THREAD_ID_2"}) {
    thread { isResolved }
  }
  t3: resolveReviewThread(input: {threadId: "THREAD_ID_3"}) {
    thread { isResolved }
  }
}
```

### Fetch PR details (REST)

```bash
gh pr view <PR_NUMBER> --json title,body,state,reviews,comments,headRefName,statusCheckRollup
```

### Fetch inline review comments (REST)

```bash
gh api repos/{owner}/{repo}/pulls/<PR_NUMBER>/comments
```

## Appendix: GitLab API

`glab api` automatically resolves `:fullpath` to the URL-encoded project path from the local git remote.

### Fetch MR details

```bash
glab mr view <MR_IID> --output json
```

Key fields (compared to GitHub equivalents):
- `iid` — internal MR number (use this, not `id`)
- `source_branch` — equivalent to GitHub's `headRefName`
- `sha` — HEAD commit SHA, equivalent to GitHub's `headRefOid`
- `description` — equivalent to GitHub's `body`

### Fetch all discussions (inline + general comments)

```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/discussions?per_page=100"
```

Paginate with `&page=2`, `&page=3`, etc. until response array length is less than `per_page`.

Each discussion object:
- `id` — discussion ID (used for resolution)
- `resolved` — `true` or `false`
- `notes` — array of note objects

Each note object:
- `type` — `"DiffNote"` for inline diff comments, `null` for general comments
- `author.username` — author's username
- `body` — comment text
- `position.new_path` — file path (for `DiffNote` type)

### Filter for unresolved inline diff comments

```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/discussions?per_page=100" | \
  jq '[.[] | select(.resolved == false and (.notes[0].type == "DiffNote"))]'
```

### Resolve a single discussion

```bash
glab api --method PUT \
  "projects/:fullpath/merge_requests/<MR_IID>/discussions/<DISCUSSION_ID>" \
  --field resolved=true
```

There is no batch resolution in GitLab — issue one PUT per discussion.

### Fetch pipeline status for an MR

```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/pipelines"
```

Pipeline statuses: `running`, `pending`, `success`, `failed`, `canceled`, `skipped`.

### Fetch jobs for a specific pipeline

```bash
glab api "projects/:fullpath/pipelines/<PIPELINE_ID>/jobs"
```

Each job has `name`, `status`, `stage`, and `web_url`.

### Fetch MR notes (general comments and bot reviews)

```bash
glab api "projects/:fullpath/merge_requests/<MR_IID>/notes?per_page=100"
```

Filter by `author.username` to find bot comments. The exact bot username depends on the installation — check the first comment from the bot to identify it.

### Post a comment on an MR

```bash
glab mr note <MR_IID> --message "your message here"
```

Or via API:

```bash
glab api --method POST \
  "projects/:fullpath/merge_requests/<MR_IID>/notes" \
  --field body="your message here"
```

## Source

Adapted from [greptileai/skills](https://github.com/greptileai/skills) (`check-pr` v1.2, MIT license). Inlined into a single skill.md to fit InDusk's one-skill-per-extension format.
