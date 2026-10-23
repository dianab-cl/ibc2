# Deploying this site

Nothing here is deployed yet. The site is verified locally and in CI; standing
it up needs Mintlify dashboard access, which the migration could not use.

## State of play

Nothing is deployed. The tree has been verified only locally and in CI
(`mint validate`, `mint broken-links` and the generator checks), so **the first
deploy is the first time anyone sees it rendered by Mintlify**. Expect to look
at it, not just confirm it loads.

## Steps for whoever has access

1. Install and authorize the Mintlify GitHub app on the `cosmos` organization
   with access to `cosmos/ibc` (an org owner must approve it), then create a
   Mintlify project pointing at `github.com/cosmos/ibc`.
2. In **Git Settings**, enable "docs.json is in a subdirectory" and set the path
   to `/docs` (no trailing slash). Set the deploy branch to `main`; pushes to
   it deploy, and CI only runs on changes under `docs/`, `spec/`, `cli/`,
   `proto/` and `gen/`. Save; this triggers a deployment.
3. Point the domain at it.
4. Confirm `/ibc/01-introduction/01-what-is-ibc` and `/ibc-go/latest/intro` both load,
   and that the IBC-Go version switcher offers `latest` and `v10.1.x`.
5. Check how the canonical tags on the frozen pages render (see below).

**Rolling back.** Mintlify deploys whatever is on `main`. Revert the offending
commit on `main` and the site redeploys. The dashboard also lets you redeploy
an earlier commit. If the whole site is wrong, un-point the domain; nothing
else (including `cosmos/docs`) depends on it until the redirect cutover below.

## Open decisions

- **Plan tier.** Preview deployments require Pro or Enterprise. They do not
  cover pull requests opened from forks, and are publicly reachable unless the
  Enterprise access add-on is enabled. This decides how in-review docs get
  shared with people who will not run a dev server.
- **Redirects.** `cosmos/docs` still serves `/ibc/*`. When that tree is deleted,
  the same PR must add redirects; see "Redirect cutover" below.

## Site-relative canonicals

Every frozen `v10.1.x` page carries a canonical such as `/ibc-go/latest/intro`.
These are deliberately site-relative because no domain exists yet.
`check-canonicals.js` verifies that each one resolves to a real page, but not how
Mintlify renders it. Once a domain is configured, view source on a frozen page
and confirm the `<link rel="canonical">` is absolute and on the right host.

## Redirect cutover

**Where.** In `cosmos/docs`, in the `redirects` array of its root `docs.json`
(entries are `{"source": ..., "destination": ...}`; Mintlify supports `:slug*`
wildcards). The same PR that deletes `cosmos/docs`'s `ibc/` tree adds them.
Destinations must be on this site's domain, so they are absolute once it exists.

**The path rule.** Old `cosmos/docs` URLs are already clean: no numeric
prefixes, no extension. (The numbered directories like `1-introduction` were this
repo's own pre-migration layout, never `cosmos/docs` URLs.) For the ibc-go
content the new path is the old path with the product segment changed. Both the
ibc-go docs and the IBC protocol docs lived under `/ibc/` in `cosmos/docs`; here
they split, so the rule is by subtree:

| Old path in `cosmos/docs` | New path | Notes |
| --- | --- | --- |
| `/ibc/latest/:slug*` | `/ibc-go/latest/:slug*` | same subtree layout, 1:1, except `spec` below |
| `/ibc/next/:slug*` | `/ibc-go/latest/:slug*` | `next` became `latest` here |
| `/ibc/v10.1.x/:slug*` | `/ibc-go/v10.1.x/:slug*` | frozen copy |
| `/ibc/latest/spec/:slug*`, `/ibc/next/spec/:slug*` | `/ibc/spec/:slug*` | protocol specs belong to the `ibc` product, generated from `spec/` |

Worked examples:

- `/ibc/latest/apps/transfer/overview` -> `/ibc-go/latest/apps/transfer/overview`
- `/ibc/next/light-clients/proposals` -> `/ibc-go/latest/light-clients/proposals`
- `/ibc/next/spec/IBC_V2/core/ics-004-packet-semantics/PACKET` -> `/ibc/spec/IBC_V2/core/ics-004-packet-semantics/PACKET`
  (list the `spec` rules before the general `/ibc/latest/:slug*` ones)

Pages that were rewritten rather than moved need explicit entries, for example
`/ibc/next/apps/gmp/gmp` -> `/ibc-go/latest/apps/gmp`. Diff the old and new page
lists before cutover; do not rely on the wildcards alone.

**No destination here.** `ibc/next/infra/*`, `ibc/next/cosmos-evm/*` and
`ibc/next/learn/*`, and the older versions (`v0.2.0`, `v4.6.x` to `v8.5.x`), were
not migrated. Decide per tree whether `cosmos/docs` keeps serving them (simplest
for the old versions) or they redirect to the closest page here. Do not delete
a tree that has no redirect.

### Links in this tree that break at cutover

Found with:

```bash
grep -rnoE 'docs\.cosmos\.network/ibc[^) "<>`]*' docs --exclude-dir=node_modules
```

Complete list as of this commit:

| File | Target |
| --- | --- |
| `docs/ibc-go/latest/light-clients/proposals.mdx:79` | `https://docs.cosmos.network/ibc/v7.8.x/ibc/proposals` |
| `docs/ibc-go/v10.1.x/light-clients/proposals.mdx:81` | `https://docs.cosmos.network/ibc/v7.8.x/ibc/proposals` |

Re-run the grep before cutover. Links to `docs.cosmos.network/sdk/...` are
unaffected.

**The v7.8.x decision.** Both links point at a version that was never
migrated, so no redirect rule above covers it. Options:

1. `cosmos/docs` keeps serving `/ibc/v7.8.x/*` after cutover. Zero edits here;
   the links keep working. **Recommended**: v7.8.x is end-of-life, so keeping a
   static tree costs nothing and removes the decision.
2. Rewrite both links to the ibc-go repository at the `v7.8.x` tag.
   Self-contained, but links to source, not rendered docs.
3. Drop the sentence. Loses a pointer some readers use.

If option 1 is chosen, scope the deletion in `cosmos/docs` to exclude
`ibc/v7.8.x`.

## Accepted exceptions to the no-Solidity invariant

The invariant: `docs/ibc-go/` contains no Solidity code blocks, no `.sol` type
definitions, no contract names and no Solidity source links. It targets Solidity
content, not repository names. A grep for `solidity|\.sol\b|solidity-ibc-eureka`
over `docs/ibc-go/` returns 9 lines, all reviewed and accepted:

- 5 sanctioned cross-links to `/ibc/06-ibc-solidity-contracts/...`:
  `latest/light-clients/attestation/attestation-light-client.mdx` lines 18, 79, 187
  and `latest/apps/gmp.mdx` lines 12, 237.
- `gmp.mdx:109`: the literal Go constant value `application/x-solidity-abi`.
- `gmp.mdx:111`: names the Go file `types/solidity_abi.go`, with its cross-link in
  the same paragraph.
- 2 links to `ics20.rs`, a **Rust** cosmwasm helper that merely lives in a
  repository named `solidity-ibc-eureka`, in
  `latest/middleware/callbacks/callbacks-IBCv2.mdx:24` and
  `v10.1.x/middleware/callbacks/callbacks-IBCv2.mdx:26` (upstream ibc-go prose).

A future audit should not re-litigate these. A new hit outside this list is a
real finding.

## Tooling

Every gate uses `npx --yes mint@4`. A stale globally installed `mint` lacks
`validate` and silently disables that gate. Where each gate runs:

| Gate | CI (`.github/workflows/docs.yml`) | Locally |
| --- | --- | --- |
| `mint@4 validate` (`links` job, runs first) | yes | `cd docs && npx --yes mint@4 validate` |
| `mint@4 broken-links` (`links` job) | yes | `cd docs && npx --yes mint@4 broken-links` |
| `refgen.py all --check`, `test-refgen.py`, `specgen.py --check`, `test-specgen.py` (`generators` job) | yes | from the repo root |
| `check-canonicals.js`, `check-nav.js`, `check-github-refs.test.js` (`generators` job) | yes | `node docs/mintlify/scripts/<name>` |

`docs/package.json`'s `dev` and `broken-links` scripts pin `mint@4` for the
same reason: a bare `npx mint` can pick up a stale global install and silently
run a different version of the gate. Keep the pin on any script added here.

## First real version freeze

`docs/mintlify/scripts/version-manager.js` has been smoke-tested but never run
for real. Its first use rewrites `docs.json` with `JSON.stringify`, producing
roughly 600 lines of reformatting that will bury the real change in review.
Consider landing a formatting-only commit first, or review that diff with
whitespace ignored. Run `mint validate` and `mint broken-links` after the first
freeze.
