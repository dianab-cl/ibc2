# IBC Docs Site Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Mintlify documentation site at `docs/` in `cosmos/ibc` serving this monorepo's docs and the ibc-go docs migrated out of `cosmos/docs`.

**Architecture:** Two products under one site root — `docs/ibc/` (this monorepo, unversioned) and `docs/ibc-go/` (`latest` plus a frozen `v10.1.x`). Content arrives three ways: hand-converted (the 36 monorepo files), scripted import from `cosmos/docs` (ibc-go), and generated from canonical sources (protocol specs via `specgen.py`, CLI reference tables via the existing `refgen.py`). Nothing is deployed in this phase; success is verified locally and in CI.

**Tech Stack:** Mintlify `mint` ^4.2.7 (Node), Python 3 for generators, GitHub Actions.

**Spec:** `specs/2026-10-13-ibc-docs-migration-design.md`

## Global Constraints

- Mintlify site root is `docs/`. `docs.json` must sit at `docs/docs.json` and cannot move; content cannot live above it.
- `docs/` holds exactly: `AGENTS.md`, `docs.json`, `package.json`, `ibc/`, `ibc-go/`, `scripts/`, `mintlify/`.
- No number prefixes in any new filename or directory.
- No `next/` tier. `ibc-go/` holds `latest/` and `v10.1.x/` only.
- **No Solidity in `docs/ibc-go/**`** — no code blocks, type definitions, contract names, or `solidity-ibc-eureka` source links. Only explicit cross-references into `docs/ibc/ibc-solidity-contracts/`.
- `spec/` at the repo root is canonical and must not be edited by any task in this plan.
- Python tests follow the existing convention in `test-refgen.py`: a `@case("name")` decorator collecting into module-level `PASS`/`FAIL` lists, bare `def _():` bodies, run as `python3 <file>`, exit 1 on failure. No pytest, no unittest.
- Python files outside `docs/**` carry `# SPDX-License-Identifier: Apache-2.0` as the second line.
- Commit after every task. Five-to-nine commits land as one pull request.

## Review Focus

1. **`refgen.py` resolving the wrong repo root.** The `dirname` chain fails by computing a wrong path, not by raising. Pinned in Task 3.
2. **Generator destructiveness and non-idempotence.** `specgen.py` writes a tree; a second run must change nothing, and it must never write outside `docs/ibc/spec/`. Pinned in Task 4.
3. **Link-rewrite over-matching.** `/ibc/next/` → `/ibc-go/latest/` must not fire inside fenced code blocks or on near-miss prefixes like `/ibc/nextgen`. Pinned in Task 5.
4. **Dangling canonical URLs.** A frozen `v10.1.x` page whose `canonical:` points at a `latest` path that does not exist sends search engines to a 404. Pinned in Task 6.
5. **Solidity leaking into `ibc-go/`.** The invariant is asserted once at the end but introduced across three tasks. Pinned in Task 9.

---

### Task 1: Scaffold the site and unblock CI

The license-header fix comes first. Without it, every `.mdx` created by any later task fails `license-headers.yml`.

**Files:**
- Modify: `.licenserc.yaml:11-30` (the `paths-ignore` list)
- Create: `docs/package.json`
- Create: `docs/docs.json`
- Create: `docs/mintlify/style.css`
- Create: `docs/AGENTS.md`
- Create: `.github/workflows/docs.yml`
- Modify: `.gitignore:19`

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/docs.json` with a `navigation.dropdowns` array that later tasks append to; a `docs/mintlify/` directory for machinery.

- [ ] **Step 1: Add the `docs/` ignores to `.licenserc.yaml`**

Replace the line `    - "docs/**/*.md"` with:

```yaml
    # The Mintlify site. Prose and site assets carry no source header; the
    # generators under docs/scripts/ do, via the catch-all rule above.
    - "docs/**/*.md"
    - "docs/**/*.mdx"
    - "docs/**/*.css"
    - "docs/**/*.js"
    - "docs/**/*.png"
    - "docs/**/*.jpg"
    - "docs/**/*.gif"
    - "docs/**/*.webp"
```

- [ ] **Step 2: Verify the ignore list is valid YAML and still covers Python**

Run: `python3 -c "import yaml,sys; d=yaml.safe_load(open('.licenserc.yaml')); p=d['header']['paths-ignore']; print('mdx ignored:', 'docs/**/*.mdx' in p); print('py still covered:', not any(x.endswith('.py') for x in p))"`

Expected: `mdx ignored: True` and `py still covered: True`

- [ ] **Step 3: Create `docs/package.json`**

```json
{
  "name": "ibc-documentation",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "npx mint dev",
    "broken-links": "npx mint broken-links"
  },
  "dependencies": {
    "mint": "^4.2.7"
  }
}
```

- [ ] **Step 4: Create `docs/docs.json`**

Copy the theme block from `cosmos/docs` verbatim so styling matches, with navigation reduced to the two products. Page arrays stay empty here; later tasks fill them.

```json
{
  "$schema": "https://mintlify.com/docs.json",
  "name": "IBC Documentation",
  "description": "Documentation for the Inter-Blockchain Communication protocol, its Go implementation, and the IBC CLI.",
  "theme": "mint",
  "colors": { "primary": "#000000", "light": "#cccccc", "dark": "#0E0E0E" },
  "icons": { "library": "lucide" },
  "styling": {
    "codeblocks": {
      "theme": { "light": "github-light-high-contrast", "dark": "github-dark-high-contrast" }
    }
  },
  "favicon": { "light": "/mintlify/assets/brand/cosmos.svg", "dark": "/mintlify/assets/brand/cosmos-dark.svg" },
  "logo": {
    "light": "/mintlify/assets/brand/cosmos-wordmark-dark.svg",
    "dark": "/mintlify/assets/brand/cosmos-wordmark.svg"
  },
  "contextual": { "options": ["copy", "view", "chatgpt", "claude", "perplexity", "mcp", "cursor", "vscode"] },
  "navigation": {
    "dropdowns": [
      { "dropdown": "IBC", "icon": "book-open", "groups": [] },
      { "dropdown": "IBC-Go", "icon": "code", "versions": [] }
    ]
  }
}
```

- [ ] **Step 5: Copy brand assets and stylesheet from cosmos/docs**

```bash
mkdir -p docs/mintlify/assets/brand docs/mintlify/images docs/mintlify/scripts
cp "$COSMOS_DOCS/style.css" docs/mintlify/style.css
cp "$COSMOS_DOCS"/assets/brand/cosmos.svg \
   "$COSMOS_DOCS"/assets/brand/cosmos-dark.svg \
   "$COSMOS_DOCS"/assets/brand/cosmos-wordmark.svg \
   "$COSMOS_DOCS"/assets/brand/cosmos-wordmark-dark.svg \
   docs/mintlify/assets/brand/
```

`$COSMOS_DOCS` is a local checkout of `github.com/cosmos/docs`. If a named brand file is absent, list `assets/brand/` and take the nearest equivalent rather than inventing a filename.

- [ ] **Step 6: Verify the config parses and the dev server starts**

Run: `cd docs && npx mint validate`
Expected: no schema errors. An empty `groups`/`versions` array is valid.

- [ ] **Step 7: Create `docs/AGENTS.md`**

```markdown
# AGENTS.md — the docs tree

The Mintlify site lives here. `docs/` is the site root: Mintlify resolves every
page path relative to `docs/docs.json`, and nothing above `docs/` is reachable
from the site.

## Layout

| Path | What it is |
|---|---|
| `docs.json` | Navigation and theme. **Cannot move** — this file defines the site root. |
| `ibc/` | This monorepo's docs. Unversioned, tracks `main`. |
| `ibc-go/latest/` | ibc-go docs. Edit here. |
| `ibc-go/v10.1.x/` | Frozen. Do not edit except to fix a critical error. |
| `ibc/spec/` | **Generated** from the repo's `spec/`. Never edit by hand. |
| `scripts/` | Generators that read repo source code. |
| `mintlify/` | Site machinery: stylesheet, images, brand assets, versioning scripts. |

## Rules

- **No Solidity in `ibc-go/`.** It documents the Go implementation. Link to
  `ibc/ibc-solidity-contracts/` instead.
- **Never hand-edit `ibc/spec/`.** Edit `spec/` at the repo root and regenerate.
- **No number prefixes** in filenames. Navigation order lives in `docs.json`.
- There is no `next/` tier. Document unreleased features in `latest/` with a
  version callout.

## Generators

| Script | Reads | Writes |
|---|---|---|
| `scripts/refgen.py` | `cli/`, `proto/`, `gen/` | CLI reference tables in `ibc/ibc-cli/` |
| `scripts/specgen.py` | `spec/` | `ibc/spec/` |

Both have a `--check` mode that CI runs. After changing `cli/`, `proto/` or
`gen/`, follow `scripts/AGENTS.md`.

Site tooling — version freezing, link checking — is in `mintlify/scripts/`.

## Running it

```bash
cd docs && npm install && npx mint dev
```
```

- [ ] **Step 8: Create `.github/workflows/docs.yml`**

```yaml
name: docs
on:
  pull_request:
    paths: ["docs/**", "spec/**"]
  push:
    branches: [main]
    paths: ["docs/**", "spec/**"]

permissions:
  contents: read

jobs:
  links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Check for broken links
        working-directory: docs
        run: npx --yes mint@4 broken-links
```

- [ ] **Step 9: Update the stale path in `.gitignore`**

Replace `# Python bytecode from docs/6-ibc-cli/tools` with `# Python bytecode from docs/scripts`.

- [ ] **Step 10: Verify existing CI still passes locally**

Run: `make lint 2>/dev/null || echo "no make lint target; rely on CI"`
Expected: either a clean lint or the fallback message. Do not proceed if lint reports errors in files this task touched.

- [ ] **Step 11: Commit**

```bash
git add .licenserc.yaml .gitignore .github/workflows/docs.yml docs/
git commit -m "docs: scaffold the Mintlify site at docs/

Adds docs.json, package.json, brand assets and the link-check workflow.
Extends .licenserc.yaml to cover .mdx and site assets, which the
conversion in the next commit would otherwise fail."
```

---

### Task 2: Convert the monorepo docs to MDX

The 36 existing `.md` files move from numbered directories to clean paths under `docs/ibc/`.

**Files:**
- Delete: `docs/1-introduction/`, `docs/2-how-ibc-works/`, `docs/3-applications/`, `docs/4-light-clients/`, `docs/5-ibc-solidity-contracts/`, `docs/6-ibc-cli/` (the `.md` files; `6-ibc-cli/tools/` is handled in Task 3)
- Create: `docs/ibc/**/*.mdx` (29 pages)
- Modify: `docs/docs.json` (the `IBC` dropdown's `groups`)
- Modify: `docs/README.md`

**Interfaces:**
- Consumes: `docs/docs.json` from Task 1.
- Produces: page paths `ibc/introduction/what-is-ibc`, `ibc/how-ibc-works/*`, `ibc/applications/*`, `ibc/light-clients/*`, `ibc/ibc-solidity-contracts/*`, `ibc/ibc-cli/*` — Task 3 writes into three of the `ibc-cli` pages.

- [ ] **Step 1: Map every old path to its new path**

```bash
cat > /tmp/docs-map.txt <<'MAP'
docs/1-introduction/1-what-is-ibc.md                       docs/ibc/introduction/what-is-ibc.mdx
docs/2-how-ibc-works/1-overview.md                         docs/ibc/how-ibc-works/overview.mdx
docs/2-how-ibc-works/2-packets-and-applications.md         docs/ibc/how-ibc-works/packets-and-applications.mdx
docs/2-how-ibc-works/3-core-router-and-store.md            docs/ibc/how-ibc-works/core-router-and-store.mdx
docs/2-how-ibc-works/4-clients-and-counterparties.md       docs/ibc/how-ibc-works/clients-and-counterparties.mdx
docs/2-how-ibc-works/5-relayer.md                          docs/ibc/how-ibc-works/relayer.mdx
docs/2-how-ibc-works/6-packet-lifecycle.md                 docs/ibc/how-ibc-works/packet-lifecycle.mdx
docs/3-applications/1-gmp.md                               docs/ibc/applications/gmp.mdx
docs/3-applications/2-make-a-cross-chain-gmp-call.md       docs/ibc/applications/make-a-cross-chain-gmp-call.mdx
docs/3-applications/3-ift.md                               docs/ibc/applications/ift.mdx
docs/4-light-clients/1-attestation-light-client.md         docs/ibc/light-clients/attestation-light-client.mdx
docs/4-light-clients/2-attestors.md                        docs/ibc/light-clients/attestors.mdx
docs/4-light-clients/3-besu-qbft-light-client.md           docs/ibc/light-clients/besu-qbft-light-client.mdx
docs/5-ibc-solidity-contracts/1-overview.md                docs/ibc/ibc-solidity-contracts/overview.mdx
docs/5-ibc-solidity-contracts/2-ics26-router.md            docs/ibc/ibc-solidity-contracts/ics26-router.mdx
docs/5-ibc-solidity-contracts/3-ics27-gmp-and-accounts.md  docs/ibc/ibc-solidity-contracts/ics27-gmp-and-accounts.mdx
docs/5-ibc-solidity-contracts/4-ift-contracts.md           docs/ibc/ibc-solidity-contracts/ift-contracts.mdx
docs/5-ibc-solidity-contracts/5-attestation-light-client.md docs/ibc/ibc-solidity-contracts/attestation-light-client.mdx
docs/5-ibc-solidity-contracts/6-permissions-and-upgrades.md docs/ibc/ibc-solidity-contracts/permissions-and-upgrades.mdx
docs/6-ibc-cli/1-overview.md                               docs/ibc/ibc-cli/overview.mdx
docs/6-ibc-cli/2-tutorial-deploy-ibc-and-send-a-token.md   docs/ibc/ibc-cli/tutorial-deploy-ibc-and-send-a-token.mdx
docs/6-ibc-cli/3-run-a-standalone-attestor.md              docs/ibc/ibc-cli/run-a-standalone-attestor.mdx
docs/6-ibc-cli/4-run-a-standalone-relayer.md               docs/ibc/ibc-cli/run-a-standalone-relayer.mdx
docs/6-ibc-cli/5-configuration.md                          docs/ibc/ibc-cli/configuration.mdx
docs/6-ibc-cli/6-cli-commands.md                           docs/ibc/ibc-cli/cli-commands.mdx
docs/6-ibc-cli/7-api.md                                    docs/ibc/ibc-cli/api.mdx
MAP
wc -l /tmp/docs-map.txt
```

Expected: 26 lines. The map is the contract for every later rewrite; if a file in `docs/[1-6]-*/` is missing from it, add it before continuing.

- [ ] **Step 2: Move the files with history preserved**

```bash
while read -r old new; do
  mkdir -p "$(dirname "$new")"
  git mv "$old" "$new"
done < /tmp/docs-map.txt
git status --short | head -40
```

- [ ] **Step 3: Rewrite internal links to the new paths**

Old links are relative with numbered segments, e.g. `](2-how-ibc-works/5-relayer.md)`. Rewrite each to an absolute site path:

```bash
python3 - <<'PY'
import re, pathlib
pairs = [l.split() for l in open('/tmp/docs-map.txt') if l.strip()]
# old repo-relative path -> new site URL
url = {old[len('docs/'):]: '/' + new[len('docs/'):-len('.mdx')] for old, new in pairs}
for _, new in pairs:
    p = pathlib.Path(new); t = p.read_text(); orig = t
    for old_rel, site in sorted(url.items(), key=lambda kv: -len(kv[0])):
        t = t.replace('(' + old_rel + ')', '(' + site + ')')
        t = t.replace('(../' + old_rel + ')', '(' + site + ')')
        t = t.replace('(./' + old_rel.split('/')[-1] + ')', '(' + site + ')')
    if t != orig:
        p.write_text(t)
        print('rewrote', new)
PY
```

- [ ] **Step 4: Verify no numbered links survive**

Run: `grep -rnE '\]\([^)]*[0-9]-[a-z-]+\.md\)' docs/ibc/ || echo "clean"`
Expected: `clean`

- [ ] **Step 5: Confirm frontmatter is present on every page**

These files already carry `title` and `description` frontmatter. Verify rather than assume:

```bash
python3 - <<'PY'
import pathlib, sys
bad = []
for p in sorted(pathlib.Path('docs/ibc').rglob('*.mdx')):
    head = p.read_text().split('\n', 1)[0]
    if head.strip() != '---':
        bad.append(str(p))
print('missing frontmatter:', bad or 'none')
sys.exit(1 if bad else 0)
PY
```

Expected: `missing frontmatter: none`, exit 0. For any file listed, add `title` and `description` derived from its first `#` heading and opening sentence.

- [ ] **Step 6: Fill the IBC dropdown in `docs.json`**

Replace `{ "dropdown": "IBC", "icon": "book-open", "groups": [] }` with groups whose `pages` arrays hold the 26 paths from the map, minus the `docs/` prefix and `.mdx` suffix, in the order the map lists them:

```json
{
  "dropdown": "IBC",
  "icon": "book-open",
  "groups": [
    { "group": "Introduction", "pages": ["ibc/introduction/what-is-ibc"] },
    { "group": "How IBC works", "pages": [
      "ibc/how-ibc-works/overview",
      "ibc/how-ibc-works/packets-and-applications",
      "ibc/how-ibc-works/core-router-and-store",
      "ibc/how-ibc-works/clients-and-counterparties",
      "ibc/how-ibc-works/relayer",
      "ibc/how-ibc-works/packet-lifecycle"
    ] },
    { "group": "Applications", "pages": [
      "ibc/applications/gmp",
      "ibc/applications/make-a-cross-chain-gmp-call",
      "ibc/applications/ift"
    ] },
    { "group": "Light clients", "pages": [
      "ibc/light-clients/attestation-light-client",
      "ibc/light-clients/attestors",
      "ibc/light-clients/besu-qbft-light-client"
    ] },
    { "group": "IBC-Solidity contracts", "pages": [
      "ibc/ibc-solidity-contracts/overview",
      "ibc/ibc-solidity-contracts/ics26-router",
      "ibc/ibc-solidity-contracts/ics27-gmp-and-accounts",
      "ibc/ibc-solidity-contracts/ift-contracts",
      "ibc/ibc-solidity-contracts/attestation-light-client",
      "ibc/ibc-solidity-contracts/permissions-and-upgrades"
    ] },
    { "group": "IBC CLI", "pages": [
      "ibc/ibc-cli/overview",
      "ibc/ibc-cli/tutorial-deploy-ibc-and-send-a-token",
      "ibc/ibc-cli/run-a-standalone-attestor",
      "ibc/ibc-cli/run-a-standalone-relayer",
      "ibc/ibc-cli/configuration",
      "ibc/ibc-cli/cli-commands",
      "ibc/ibc-cli/api"
    ] }
  ]
}
```

- [ ] **Step 7: Update `docs/README.md` to the new paths**

Rewrite each link target using the same map. The README stays the ordered index for GitHub browsing — that is the role it plays now that filenames carry no numbers.

- [ ] **Step 8: Verify the site builds with no broken links**

Run: `cd docs && npx mint broken-links`
Expected: zero broken links.

- [ ] **Step 9: Commit**

```bash
git add -A docs/
git commit -m "docs: convert the monorepo docs to MDX under docs/ibc

Moves 26 pages out of numbered directories into clean paths, rewrites
internal links to absolute site paths, and wires the IBC navigation."
```

---

### Task 3: Relocate refgen and pin its root resolution

`refgen.py` writes into three pages that Task 2 just moved, so it is repointed and relocated together.

**Files:**
- Move: `docs/6-ibc-cli/tools/{refgen.py,test-refgen.py,test-refgen-e2e.py,probe-config.yml,probe-config-otel.yml,AGENTS.md,AUDIT.md,REFERENCE.md}` → `docs/scripts/`
- Modify: `docs/scripts/refgen.py:89-90` and its hardcoded path strings
- Modify: `docs/scripts/AGENTS.md`, `docs/scripts/REFERENCE.md`
- Create: test case in `docs/scripts/test-refgen.py`

**Interfaces:**
- Consumes: the `ibc/ibc-cli/{api,configuration,cli-commands}.mdx` pages from Task 2.
- Produces: `python3 docs/scripts/refgen.py all --check` as a CI-callable gate.

- [ ] **Step 1: Write the failing test for root resolution**

This is Review Focus item 1. Append to `docs/scripts/test-refgen.py`, before the trailing `for name in PASS:` block:

```python
@case("ROOT resolves to the repository root, not a directory inside docs/")
def _():
    # The chain of dirname() calls is tied to this file's depth. Moving the
    # script without adjusting it resolves a wrong root silently: the script
    # then finds no cli/ and reports an empty CLI rather than failing.
    assert os.path.isdir(os.path.join(refgen.ROOT, "cli")), refgen.ROOT
    assert os.path.isdir(os.path.join(refgen.ROOT, "proto")), refgen.ROOT
    assert os.path.isfile(os.path.join(refgen.ROOT, "go.work")) or \
        os.path.isfile(os.path.join(refgen.ROOT, "Makefile")), refgen.ROOT
```

- [ ] **Step 2: Move the files, then run the test to watch it fail**

```bash
mkdir -p docs/scripts
git mv docs/6-ibc-cli/tools/* docs/scripts/
rmdir docs/6-ibc-cli/tools docs/6-ibc-cli 2>/dev/null || true
python3 docs/scripts/test-refgen.py
```

Expected: FAIL on "ROOT resolves to the repository root" — `ROOT` is now one level too high, so `cli` is not found there.

- [ ] **Step 3: Fix the dirname depth**

At `docs/scripts/refgen.py:89-90`, the file is now at `docs/scripts/refgen.py`, which is two directories below the root. Replace the four-call chain with three:

```python
ROOT = os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))))
IBC = ROOT
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python3 docs/scripts/test-refgen.py`
Expected: all cases pass, including the new one. Exit 0.

- [ ] **Step 5: Update the hardcoded path strings**

```bash
grep -rln 'docs/6-ibc-cli' docs/scripts/ | while read -r f; do
  sed -i '' 's|docs/6-ibc-cli/tools/|docs/scripts/|g; s|docs/6-ibc-cli/|docs/ibc/ibc-cli/|g' "$f"
done
grep -rn 'docs/6-ibc-cli' docs/scripts/ || echo "clean"
```

Expected: `clean`. On Linux use `sed -i` without the `''`.

- [ ] **Step 6: Repoint the docstring invocations at the real page paths**

In `docs/scripts/refgen.py`, the usage examples near the top reference `ibc-docs/ibc-cli/*.mdx`. Replace with the paths Task 2 created:

```
    python3 docs/scripts/refgen.py api    docs/ibc/ibc-cli/api.mdx
    python3 docs/scripts/refgen.py config docs/ibc/ibc-cli/configuration.mdx
    python3 docs/scripts/refgen.py cli    docs/ibc/ibc-cli/cli-commands.mdx
```

- [ ] **Step 7: Verify the generator agrees with the pages**

Run: `python3 docs/scripts/refgen.py all --check`
Expected: exit 0. A non-zero exit means the `GEN:` regions drifted during the `.md` → `.mdx` conversion — run `python3 docs/scripts/refgen.py all` to heal them, inspect the diff to confirm only region bodies changed, then re-run `--check`.

- [ ] **Step 8: Add the check to CI**

In `.github/workflows/docs.yml`, add a second job:

```yaml
  generators:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: CLI reference tables match the code
        run: python3 docs/scripts/refgen.py all --check
      - name: refgen unit tests
        run: python3 docs/scripts/test-refgen.py
```

- [ ] **Step 9: Commit**

```bash
git add -A docs/ .github/workflows/docs.yml
git commit -m "docs: move refgen to docs/scripts and pin its root resolution

The repo root was derived from this file's depth with four dirname calls.
At the new location the correct count is three, and getting it wrong fails
silently rather than raising, so a test now asserts ROOT contains cli/."
```

---

### Task 4: Generate the protocol specs from `spec/`

**Files:**
- Create: `docs/scripts/specgen.py`
- Create: `docs/scripts/test-specgen.py`
- Create: `docs/ibc/spec/**` (generated, committed)
- Modify: `docs/docs.json`, `.github/workflows/docs.yml`

**Interfaces:**
- Consumes: `spec/**/*.md` (read-only).
- Produces: `specgen.generate(root, out) -> list[str]` returning written paths; `specgen.transform(text, rel) -> str`; CLI `python3 docs/scripts/specgen.py [--check]`.

- [ ] **Step 1: Write the failing tests**

Create `docs/scripts/test-specgen.py`. These cover the transform rules and Review Focus item 2:

```python
#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0

"""Tests for docs/scripts/specgen.py.

    python3 docs/scripts/test-specgen.py
"""
import os
import sys
import tempfile
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import specgen  # noqa: E402

PASS, FAIL = [], []


def case(name):
    def deco(fn):
        try:
            fn()
            PASS.append(name)
        except Exception as e:
            FAIL.append((name, e, traceback.format_exc()))
        return fn
    return deco


REL = "core/ics-004-channel-and-packet-semantics/README.md"


@case("strips the .md suffix from internal links")
def _():
    out = specgen.transform("See [upgrades](./UPGRADES.md) for details.", REL)
    assert "](./UPGRADES)" in out, out


@case("leaves external .md links alone")
def _():
    src = "See [the readme](https://github.com/cosmos/ibc/blob/main/README.md)."
    assert specgen.transform(src, REL) == src


@case("absolutizes a relative image path")
def _():
    out = specgen.transform("![Dataflow](dataflow.png)", REL)
    want = "/ibc/spec/core/ics-004-channel-and-packet-semantics/dataflow.png"
    assert want in out, out


@case("leaves an already-absolute image path alone")
def _():
    src = "![X](/ibc/spec/core/x/y.png)"
    assert specgen.transform(src, REL) == src


@case("does not rewrite inside fenced code blocks")
def _():
    src = "```go\n// see ./UPGRADES.md\n```\n"
    assert "./UPGRADES.md" in specgen.transform(src, REL)


@case("preserves ICS frontmatter untouched")
def _():
    src = "---\nics: 4\ntitle: Channel & Packet Semantics\n---\n\nBody.\n"
    out = specgen.transform(src, REL)
    assert out.startswith("---\nics: 4\ntitle: Channel & Packet Semantics\n---"), out


@case("excludes the governance files from publication")
def _():
    for name in ("CONTRIBUTING.md", "PROCESS.md",
                 "STANDARDS_COMMITTEE.md", "ics-template.md"):
        assert specgen.excluded(name), name
    assert not specgen.excluded("core/ics-004-channel-and-packet-semantics/README.md")


@case("generating twice changes nothing the second time")
def _():
    # Idempotence is the property that makes --check meaningful in CI.
    with tempfile.TemporaryDirectory() as out:
        root = specgen.ROOT
        first = specgen.generate(root, out)
        before = {p: open(os.path.join(out, p), "rb").read() for p in first}
        second = specgen.generate(root, out)
        assert sorted(first) == sorted(second), (len(first), len(second))
        after = {p: open(os.path.join(out, p), "rb").read() for p in second}
        assert before == after, "second run changed bytes"


@case("never writes outside the output directory")
def _():
    with tempfile.TemporaryDirectory() as out:
        written = specgen.generate(specgen.ROOT, out)
        for rel in written:
            full = os.path.realpath(os.path.join(out, rel))
            assert full.startswith(os.path.realpath(out) + os.sep), full


@case("publishes the ICS-027 GMP spec the stale docs copy lacked")
def _():
    with tempfile.TemporaryDirectory() as out:
        written = specgen.generate(specgen.ROOT, out)
        assert "IBC_V2/app/ics-027-gmp/README.mdx" in written, written[:5]


for name in PASS:
    print(f"  ok    {name}")
for name, e, tb in FAIL:
    print(f"  FAIL  {name}: {e}")
print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print()
    print(FAIL[0][2])
sys.exit(1 if FAIL else 0)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python3 docs/scripts/test-specgen.py`
Expected: `ModuleNotFoundError: No module named 'specgen'`

- [ ] **Step 3: Write `docs/scripts/specgen.py`**

```python
#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0

"""Generate docs/ibc/spec/ from the canonical spec/ at the repository root.

The specs are versioned source, not prose written for the docs site. They live
at spec/ and are edited there. This script renders them as Mintlify pages so
the site can publish them without a second copy drifting out of date -- which
is exactly what happened to the copy in cosmos/docs, frozen at 2026-04-09 and
missing the ICS-027 GMP spec entirely.

    python3 docs/scripts/specgen.py            # write docs/ibc/spec/
    python3 docs/scripts/specgen.py --check    # exit 1 if the tree is stale

The transform is deliberately narrow. Source files already carry ICS
frontmatter including `title`, so nothing is synthesised:

  1. .md -> .mdx
  2. internal links lose their .md suffix
  3. relative image paths become absolute site paths
  4. image files are copied alongside

Text inside fenced code blocks is never rewritten.
"""
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "spec")
OUT = os.path.join(ROOT, "docs", "ibc", "spec")
SITE_BASE = "/ibc/spec"

# Governance and process documents. They describe how the standards process
# works, not what the standards say, and are read on GitHub.
EXCLUDE = {
    "CONTRIBUTING.md",
    "PROCESS.md",
    "STANDARDS_COMMITTEE.md",
    "ics-template.md",
}

IMAGE_EXT = (".png", ".svg", ".jpg", ".jpeg", ".gif", ".webp")

_FENCE = re.compile(r"(```.*?```|~~~.*?~~~)", re.S)
_LINK = re.compile(r"\]\((?!https?://)([^)]+?)\.md(#[^)]*)?\)")
_IMAGE = re.compile(r"!\[([^\]]*)\]\((?!https?://|/)([^)]+?)\)")


def excluded(rel):
    """True if this spec/-relative path is not published."""
    return rel in EXCLUDE or os.path.basename(rel) in EXCLUDE


def _outside_fences(text, fn):
    """Apply fn to the parts of text that are not fenced code blocks."""
    return "".join(part if i % 2 else fn(part)
                   for i, part in enumerate(_FENCE.split(text)))


def transform(text, rel):
    """Rewrite one document. `rel` is its path relative to spec/."""
    site_dir = SITE_BASE + "/" + os.path.dirname(rel) if os.path.dirname(rel) \
        else SITE_BASE

    def fix(chunk):
        chunk = _LINK.sub(lambda m: "](" + m.group(1) + (m.group(2) or "") + ")",
                          chunk)

        def img(m):
            alt, path = m.group(1), m.group(2)
            if not path.lower().endswith(IMAGE_EXT):
                return m.group(0)
            clean = path[2:] if path.startswith("./") else path
            return f"![{alt}]({site_dir}/{clean})"

        return _IMAGE.sub(img, chunk)

    return _outside_fences(text, fix)


def generate(root, out):
    """Render spec/ into `out`. Returns the written paths, relative to `out`."""
    src = os.path.join(root, "spec")
    written = []
    for dirpath, _, names in os.walk(src):
        for name in sorted(names):
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, src)
            if excluded(rel):
                continue
            if name.endswith(".md"):
                dest_rel = rel[:-len(".md")] + ".mdx"
                dest = os.path.join(out, dest_rel)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with open(full, encoding="utf-8") as fh:
                    body = transform(fh.read(), rel)
                with open(dest, "w", encoding="utf-8") as fh:
                    fh.write(body)
                written.append(dest_rel)
            elif name.lower().endswith(IMAGE_EXT):
                dest = os.path.join(out, rel)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copyfile(full, dest)
                written.append(rel)
    return written


def main(argv):
    check = "--check" in argv
    if check:
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            for rel in generate(ROOT, tmp):
                a, b = os.path.join(tmp, rel), os.path.join(OUT, rel)
                if not os.path.exists(b):
                    print(f"missing: docs/ibc/spec/{rel}")
                    return 1
                if open(a, "rb").read() != open(b, "rb").read():
                    print(f"stale: docs/ibc/spec/{rel}")
                    print("run: python3 docs/scripts/specgen.py")
                    return 1
        print("docs/ibc/spec is up to date with spec/")
        return 0
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    written = generate(ROOT, OUT)
    print(f"wrote {len(written)} files to docs/ibc/spec/")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 docs/scripts/test-specgen.py`
Expected: `10 passed, 0 failed`, exit 0.

- [ ] **Step 5: Generate the tree**

Run: `python3 docs/scripts/specgen.py`
Expected: `wrote N files to docs/ibc/spec/` with N ≥ 42.

- [ ] **Step 6: Verify the generated output against the spec's acceptance criterion**

```bash
find docs/ibc/spec -name '*.mdx' | wc -l
test -f docs/ibc/spec/IBC_V2/app/ics-027-gmp/README.mdx && echo "GMP spec present"
python3 docs/scripts/specgen.py --check
```

Expected: 42 pages, `GMP spec present`, and `docs/ibc/spec is up to date with spec/`.

- [ ] **Step 7: Add the spec group to `docs.json`**

Append a group to the `IBC` dropdown listing the generated pages. Build the list from the generated tree rather than by hand:

```bash
python3 - <<'PY'
import json, pathlib
pages = sorted(str(p)[len('docs/'):-len('.mdx')]
               for p in pathlib.Path('docs/ibc/spec').rglob('*.mdx'))
d = json.load(open('docs/docs.json'))
for dd in d['navigation']['dropdowns']:
    if dd.get('dropdown') == 'IBC':
        dd['groups'].append({"group": "Specification", "pages": pages})
json.dump(d, open('docs/docs.json', 'w'), indent=2)
print(len(pages), 'spec pages added to navigation')
PY
```

- [ ] **Step 8: Add the generator check to CI**

In the `generators` job of `.github/workflows/docs.yml`, add:

```yaml
      - name: Published specs match spec/
        run: python3 docs/scripts/specgen.py --check
      - name: specgen unit tests
        run: python3 docs/scripts/test-specgen.py
```

- [ ] **Step 9: Verify links across the whole site**

Run: `cd docs && npx mint broken-links`
Expected: zero broken links.

- [ ] **Step 10: Commit**

```bash
git add -A docs/ .github/workflows/docs.yml
git commit -m "docs: generate docs/ibc/spec from the canonical spec/

The cosmos/docs copy of these specs was a derived snapshot from
2026-04-09 missing the ICS-027 GMP spec. Generating instead of copying
means the published specs cannot drift; CI enforces it with --check."
```

---

### Task 5: Import ibc-go `latest`

**Files:**
- Create: `docs/scripts/import-ibc-go.py` (throwaway — deleted in Task 9)
- Create: `docs/ibc-go/latest/**` (~190 pages)
- Create: `docs/mintlify/images/**` (13 files)
- Modify: `docs/docs.json`

**Interfaces:**
- Consumes: `$COSMOS_DOCS/ibc/next/`.
- Produces: `docs/ibc-go/latest/**`; page paths of the form `ibc-go/latest/<rest>`.

- [ ] **Step 1: Write the failing test for link rewriting**

This is Review Focus item 3. Create `docs/scripts/test-import-ibc-go.py`:

```python
#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0

"""Tests for the one-off ibc-go importer.

    python3 docs/scripts/test-import-ibc-go.py
"""
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib
imp = importlib.import_module("import-ibc-go")

PASS, FAIL = [], []


def case(name):
    def deco(fn):
        try:
            fn()
            PASS.append(name)
        except Exception as e:
            FAIL.append((name, e, traceback.format_exc()))
        return fn
    return deco


@case("rewrites a next/ link to ibc-go/latest/")
def _():
    out = imp.rewrite("See [overview](/ibc/next/ibc/overview).")
    assert "(/ibc-go/latest/ibc/overview)" in out, out


@case("rewrites a latest/ link to ibc-go/latest/")
def _():
    out = imp.rewrite("See [overview](/ibc/latest/ibc/overview).")
    assert "(/ibc-go/latest/ibc/overview)" in out, out


@case("does not fire on a near-miss prefix")
def _():
    # /ibc/nextgen is a different path and must survive untouched.
    src = "See [gen](/ibc/nextgen/thing)."
    assert imp.rewrite(src) == src, imp.rewrite(src)


@case("does not rewrite inside a fenced code block")
def _():
    src = "```bash\ncurl https://example.com/ibc/next/x\n```\n"
    assert "/ibc/next/x" in imp.rewrite(src)


@case("rewrites shared image paths into the site images directory")
def _():
    out = imp.rewrite("![x](/ibc/images/diagrams/lifecycle.png)")
    assert "(/mintlify/images/diagrams/lifecycle.png)" in out, out


@case("strips noindex and canonical from frontmatter")
def _():
    src = ("---\nnoindex: true\n"
           "canonical: 'https://docs.cosmos.network/ibc/latest/ibc/overview'\n"
           "title: Overview\n---\n\nBody.\n")
    out = imp.strip_seo(src)
    assert "noindex" not in out and "canonical" not in out, out
    assert "title: Overview" in out, out


@case("leaves a page without frontmatter alone")
def _():
    src = "# Heading\n\nBody.\n"
    assert imp.strip_seo(src) == src


for name in PASS:
    print(f"  ok    {name}")
for name, e, tb in FAIL:
    print(f"  FAIL  {name}: {e}")
print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
if FAIL:
    print()
    print(FAIL[0][2])
sys.exit(1 if FAIL else 0)
```

- [ ] **Step 2: Run to verify failure**

Run: `python3 docs/scripts/test-import-ibc-go.py`
Expected: `ModuleNotFoundError: No module named 'import-ibc-go'`

- [ ] **Step 3: Write the importer**

```python
#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0

"""One-off importer: cosmos/docs ibc/next -> docs/ibc-go/latest.

Deleted once the migration lands. It exists as a script rather than a manual
copy so the import can be re-run if cosmos/docs moves before the PR merges.

    COSMOS_DOCS=../docs python3 docs/scripts/import-ibc-go.py
"""
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "docs", "ibc-go", "latest")
IMAGES_OUT = os.path.join(ROOT, "docs", "mintlify", "images")

# Not ibc-go material. The monorepo's own docs under docs/ibc/ cover these,
# except cosmos-evm, which is an Eureka tutorial with no ibc-go counterpart.
DROP = ("infra", "learn", "cosmos-evm", "apps/ift", "spec",
        "apps/gmp", "light-clients/attestation")

_FENCE = re.compile(r"(```.*?```|~~~.*?~~~)", re.S)
# The trailing / is what keeps /ibc/nextgen from matching.
_VER = re.compile(r"/ibc/(?:next|latest)/")
_IMG = re.compile(r"/ibc/images/")
_SEO = re.compile(r"^(?:noindex|canonical):.*$\n?", re.M)


def _outside_fences(text, fn):
    return "".join(part if i % 2 else fn(part)
                   for i, part in enumerate(_FENCE.split(text)))


def rewrite(text):
    """Repoint version and image paths at their new homes."""
    def fix(chunk):
        chunk = _IMG.sub("/mintlify/images/", chunk)
        return _VER.sub("/ibc-go/latest/", chunk)
    return _outside_fences(text, fix)


def strip_seo(text):
    """Remove the noindex/canonical pair the old next/ tier carried."""
    if not text.startswith("---"):
        return text
    end = text.find("\n---", 3)
    if end == -1:
        return text
    head, rest = text[:end], text[end:]
    return _SEO.sub("", head) + rest


def dropped(rel):
    return any(rel == d or rel.startswith(d + "/") for d in DROP)


def main():
    src_root = os.environ.get("COSMOS_DOCS")
    if not src_root:
        print("set COSMOS_DOCS to a checkout of github.com/cosmos/docs")
        return 2
    src = os.path.join(src_root, "ibc", "next")
    if not os.path.isdir(src):
        print(f"not found: {src}")
        return 2

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    n = 0
    for dirpath, _, names in os.walk(src):
        for name in sorted(names):
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, src)
            if dropped(rel):
                continue
            dest = os.path.join(OUT, rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            if name.endswith(".mdx") or name.endswith(".md"):
                with open(full, encoding="utf-8") as fh:
                    body = rewrite(strip_seo(fh.read()))
                dest = dest[:-len(".md")] + ".mdx" if name.endswith(".md") else dest
                with open(dest, "w", encoding="utf-8") as fh:
                    fh.write(body)
            else:
                shutil.copyfile(full, dest)
            n += 1
    print(f"imported {n} files to docs/ibc-go/latest/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 docs/scripts/test-import-ibc-go.py`
Expected: `7 passed, 0 failed`

- [ ] **Step 5: Run the import**

```bash
COSMOS_DOCS="$COSMOS_DOCS" python3 docs/scripts/import-ibc-go.py
find docs/ibc-go/latest -name '*.mdx' | wc -l
```

Expected: roughly 150 pages — 186 in `next/` minus the dropped trees.

- [ ] **Step 6: Copy only the referenced shared images**

The source `ibc/images/` holds 49 files; only 13 are referenced.

```bash
mkdir -p docs/mintlify/images
grep -rhoE '/mintlify/images/[A-Za-z0-9/._-]+' docs/ibc-go/latest | sort -u \
  | sed 's|^/mintlify/images/||' | while read -r rel; do
      mkdir -p "docs/mintlify/images/$(dirname "$rel")"
      cp "$COSMOS_DOCS/ibc/images/$rel" "docs/mintlify/images/$rel"
    done
find docs/mintlify/images -type f | wc -l
du -sh docs/mintlify/images
```

Expected: 13 files. Record the size — Task 6 reuses this directory rather than copying a second set.

- [ ] **Step 7: Verify no version paths survived**

```bash
grep -rn '/ibc/next/\|/ibc/latest/' docs/ibc-go/latest/ || echo "clean"
grep -rn '/ibc/images/' docs/ibc-go/latest/ || echo "images clean"
```

Expected: `clean` and `images clean`.

- [ ] **Step 8: Add the IBC-Go dropdown to `docs.json`**

Mirror the `IBC Protocol` dropdown structure from `cosmos/docs`, with `latest` as the only version for now. Build the page list from the imported tree:

```bash
python3 - <<'PY'
import json, pathlib
pages = sorted(str(p)[len('docs/'):-len('.mdx')]
               for p in pathlib.Path('docs/ibc-go/latest').rglob('*.mdx'))
d = json.load(open('docs/docs.json'))
for dd in d['navigation']['dropdowns']:
    if dd.get('dropdown') == 'IBC-Go':
        dd['versions'] = [{"version": "latest",
                           "groups": [{"group": "Documentation", "pages": pages}]}]
json.dump(d, open('docs/docs.json', 'w'), indent=2)
print(len(pages), 'pages')
PY
```

Then split that single `Documentation` group into the real groups, following the `IBC Protocol` dropdown in `$COSMOS_DOCS/docs.json` for group names and ordering. Every page must appear exactly once.

- [ ] **Step 9: Verify links**

Run: `cd docs && npx mint broken-links`
Expected: zero broken links. Links into dropped trees (`/ibc-go/latest/learn/...`, `/ibc-go/latest/infra/...`) will surface here — repoint each at its `docs/ibc/` counterpart.

- [ ] **Step 10: Commit**

```bash
git add -A docs/
git commit -m "docs: import ibc-go latest from cosmos/docs

Imports ibc/next, which measurement showed to be a superset of ibc/latest,
dropping the four trees the monorepo docs already cover. Version and image
paths are rewritten outside fenced code blocks only."
```

---

### Task 6: Freeze ibc-go v10.1.x and port the versioning scripts

**Files:**
- Create: `docs/ibc-go/v10.1.x/**` (189 pages)
- Create: `docs/mintlify/scripts/{version-manager.js,tag-archived.js,check-github-refs.js,check-github-refs.test.js,verify-links-live.js,sync-latest-to-next.js,package.json}`
- Create: `docs/mintlify/versions.json`
- Modify: `docs/docs.json`

**Interfaces:**
- Consumes: `$COSMOS_DOCS/ibc/v10.1.x/`, `$COSMOS_DOCS/scripts/versioning/`.
- Produces: `docs/mintlify/versions.json` as the version registry the freeze script reads.

- [ ] **Step 1: Import the frozen tree**

```bash
COSMOS_DOCS="$COSMOS_DOCS" python3 - <<'PY'
import os, shutil, sys
sys.path.insert(0, 'docs/scripts')
import importlib
imp = importlib.import_module("import-ibc-go")
src = os.path.join(os.environ['COSMOS_DOCS'], 'ibc', 'v10.1.x')
out = 'docs/ibc-go/v10.1.x'
if os.path.isdir(out):
    shutil.rmtree(out)
n = 0
for dirpath, _, names in os.walk(src):
    for name in sorted(names):
        full = os.path.join(dirpath, name)
        rel = os.path.relpath(full, src)
        dest = os.path.join(out, rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if name.endswith('.mdx'):
            body = open(full, encoding='utf-8').read()
            # v10.1.x links point within v10.1.x; only images move.
            body = body.replace('/ibc/images/', '/mintlify/images/')
            body = body.replace('/ibc/v10.1.x/', '/ibc-go/v10.1.x/')
            open(dest, 'w', encoding='utf-8').write(body)
        else:
            shutil.copyfile(full, dest)
        n += 1
print('imported', n)
PY
find docs/ibc-go/v10.1.x -name '*.mdx' | wc -l
```

Expected: 189 files imported.

- [ ] **Step 2: Copy any images this tree references that `latest` did not**

```bash
grep -rhoE '/mintlify/images/[A-Za-z0-9/._-]+' docs/ibc-go/v10.1.x | sort -u \
  | sed 's|^/mintlify/images/||' | while read -r rel; do
      [ -f "docs/mintlify/images/$rel" ] && continue
      mkdir -p "docs/mintlify/images/$(dirname "$rel")"
      cp "$COSMOS_DOCS/ibc/images/$rel" "docs/mintlify/images/$rel"
      echo "added $rel"
    done
find docs/mintlify/images -type f | wc -l
du -sh docs/mintlify/images
```

Expected: few or no additions. Both trees share one `images/` directory — this is the dedup the spec calls for; record the final size.

- [ ] **Step 3: Write the failing test for canonical targets**

This is Review Focus item 4. Create `docs/mintlify/scripts/check-canonicals.js`:

```javascript
#!/usr/bin/env node
// Every frozen page must carry noindex and a canonical that resolves to a
// real page in latest/. A canonical pointing at a 404 is worse than none:
// it tells search engines to rank a page that does not exist.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const FROZEN = path.join(ROOT, "ibc-go", "v10.1.x");
const LATEST = path.join(ROOT, "ibc-go", "latest");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : full.endsWith(".mdx") ? [full] : [];
  });
}

const problems = [];
for (const file of walk(FROZEN)) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(FROZEN, file);
  if (!/^noindex:\s*true\s*$/m.test(text)) {
    problems.push(`${rel}: missing "noindex: true"`);
    continue;
  }
  const m = text.match(/^canonical:\s*'?([^'\n]+)'?\s*$/m);
  if (!m) {
    problems.push(`${rel}: missing canonical`);
    continue;
  }
  const target = m[1].replace(/^.*\/ibc-go\/latest\//, "");
  if (!fs.existsSync(path.join(LATEST, target + ".mdx"))) {
    problems.push(`${rel}: canonical points at a missing page: ${target}`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log("all frozen pages carry noindex and a resolvable canonical");
```

- [ ] **Step 4: Run it to verify it fails**

Run: `node docs/mintlify/scripts/check-canonicals.js`
Expected: FAIL — the imported pages carry canonicals pointing at `docs.cosmos.network/ibc/latest/...`, and some v10 pages have no `latest` counterpart.

- [ ] **Step 5: Port `tag-archived.js` and restamp the tree**

Copy `$COSMOS_DOCS/scripts/versioning/tag-archived.js` to `docs/mintlify/scripts/`, then adjust its two assumptions: the product path becomes `ibc-go/` and the canonical base becomes the site-relative `/ibc-go/latest/`. Run it against the frozen tree:

```bash
node docs/mintlify/scripts/tag-archived.js --product ibc-go --version v10.1.x
node docs/mintlify/scripts/check-canonicals.js
```

Expected: the check now reports only pages with genuinely no `latest` counterpart.

- [ ] **Step 6: Resolve the pages with no `latest` counterpart**

For each remaining problem, point the canonical at the nearest surviving page — usually the section index — rather than deleting it. Re-run until clean.

Run: `node docs/mintlify/scripts/check-canonicals.js`
Expected: `all frozen pages carry noindex and a resolvable canonical`

- [ ] **Step 7: Create `docs/mintlify/versions.json`**

```json
{
  "products": {
    "ibc-go": {
      "versions": ["latest", "v10.1.x"],
      "defaultVersion": "latest",
      "repository": "cosmos/ibc-go",
      "changelogPath": "CHANGELOG.md",
      "latestDisplayVersion": "v11.0.x"
    }
  }
}
```

- [ ] **Step 8: Port the remaining versioning scripts**

Copy from `$COSMOS_DOCS/scripts/versioning/`: `version-manager.js`, `check-github-refs.js`, `check-github-refs.test.js`, `verify-links-live.js`, `sync-latest-to-next.js`, and a `package.json` carrying only the dependencies those five need. In `version-manager.js`, delete the `next/` → `latest/` copy step: the freeze is now `latest/` → `vX.Y.x/` plus stamping plus registry update. Leave `sync-latest-to-next.js` unmodified — it is carried unused so the `next/` tier can be stood up later in one command.

- [ ] **Step 9: Add v10.1.x to the navigation**

```bash
python3 - <<'PY'
import json, pathlib
pages = sorted(str(p)[len('docs/'):-len('.mdx')]
               for p in pathlib.Path('docs/ibc-go/v10.1.x').rglob('*.mdx'))
d = json.load(open('docs/docs.json'))
for dd in d['navigation']['dropdowns']:
    if dd.get('dropdown') == 'IBC-Go':
        dd['versions'].append({"version": "v10.1.x",
                               "groups": [{"group": "Documentation", "pages": pages}]})
json.dump(d, open('docs/docs.json', 'w'), indent=2)
print(len(pages), 'frozen pages')
PY
```

Mirror the group structure used for `latest` so the two versions navigate alike.

- [ ] **Step 10: Add the canonical check to CI and verify links**

Add to the `generators` job in `.github/workflows/docs.yml`:

```yaml
      - name: Frozen versions carry resolvable canonicals
        run: node docs/mintlify/scripts/check-canonicals.js
```

Run: `cd docs && npx mint broken-links`
Expected: zero broken links.

- [ ] **Step 11: Commit**

```bash
git add -A docs/ .github/workflows/docs.yml
git commit -m "docs: freeze ibc-go v10.1.x and port the versioning scripts

Both versions share one images/ directory. A new check asserts every
frozen page carries noindex and a canonical that resolves to a real page
in latest, since a canonical pointing at a 404 is worse than none."
```

---

### Task 7: Add the navigation drift check

**Files:**
- Create: `docs/mintlify/scripts/check-nav.js`
- Modify: `.github/workflows/docs.yml`

**Interfaces:**
- Consumes: `docs/docs.json` and the page trees from Tasks 2, 4, 5, 6.
- Produces: `node docs/mintlify/scripts/check-nav.js` as a CI gate.

- [ ] **Step 1: Write the check**

```javascript
#!/usr/bin/env node
// Two drift conditions, both of which ship silently: a page that exists but
// is unreachable from the sidebar, and a nav entry pointing at a file that
// was renamed or removed.
const fs = require("fs");
const path = require("path");

const DOCS = path.resolve(__dirname, "..", "..");
const config = JSON.parse(fs.readFileSync(path.join(DOCS, "docs.json"), "utf8"));

// docs/scripts holds generator documentation, not site pages.
const IGNORED = ["scripts/"];

function collectPages(node, out) {
  if (Array.isArray(node)) { node.forEach((n) => collectPages(n, out)); return out; }
  if (node && typeof node === "object") {
    if (Array.isArray(node.pages)) {
      node.pages.forEach((p) => (typeof p === "string" ? out.add(p) : collectPages(p, out)));
    }
    Object.entries(node).forEach(([k, v]) => k !== "pages" && collectPages(v, out));
  }
  return out;
}

function walk(dir, base) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full, base);
    if (!e.name.endsWith(".mdx")) return [];
    return [path.relative(base, full).replace(/\.mdx$/, "")];
  });
}

const inNav = collectPages(config.navigation, new Set());
const onDisk = ["ibc", "ibc-go"].flatMap((d) => walk(path.join(DOCS, d), DOCS));

const orphans = onDisk.filter((p) => !inNav.has(p) && !IGNORED.some((i) => p.startsWith(i)));
const dangling = [...inNav].filter((p) => !fs.existsSync(path.join(DOCS, p + ".mdx")));

if (orphans.length || dangling.length) {
  if (orphans.length) {
    console.error(`${orphans.length} page(s) not in navigation:`);
    orphans.forEach((p) => console.error(`  ${p}`));
  }
  if (dangling.length) {
    console.error(`${dangling.length} navigation entr(ies) with no file:`);
    dangling.forEach((p) => console.error(`  ${p}`));
  }
  process.exit(1);
}
console.log(`navigation and files agree (${onDisk.length} pages)`);
```

- [ ] **Step 2: Run it**

Run: `node docs/mintlify/scripts/check-nav.js`
Expected: either agreement, or a precise list. Fix every reported page by adding it to the right group in `docs.json` or removing the stale entry. Do not suppress a page by adding it to `IGNORED` — that list is for non-site directories only.

- [ ] **Step 3: Add to CI**

```yaml
      - name: Navigation matches the file tree
        run: node docs/mintlify/scripts/check-nav.js
```

- [ ] **Step 4: Commit**

```bash
git add -A docs/mintlify/scripts/check-nav.js .github/workflows/docs.yml
git commit -m "docs: fail CI when navigation and the file tree disagree

Catches both drift directions: a page unreachable from the sidebar, and
a nav entry pointing at a file that moved."
```

---

### Task 8: Write the Go-only GMP and attestation pages

The source pages are Solidity-dominant: `gmp.mdx` carries 27 Solidity references against 8 Go. Reuse their structure and protocol narrative; write the implementation detail from `ibc-go` and from `spec/IBC_V2/app/ics-027-gmp/README.md`, which the stale docs copy never had.

**Files:**
- Create: `docs/ibc-go/latest/apps/gmp.mdx`
- Create: `docs/ibc-go/latest/light-clients/attestation/attestation-light-client.mdx`
- Modify: `docs/docs.json`

**Interfaces:**
- Consumes: `$COSMOS_DOCS/ibc/next/apps/gmp/gmp.mdx` and `.../light-clients/attestation/attestation-light-client.mdx` as structural references; `spec/IBC_V2/app/ics-027-gmp/README.md` as the protocol source.
- Produces: page paths `ibc-go/latest/apps/gmp` and `ibc-go/latest/light-clients/attestation/attestation-light-client`.

- [ ] **Step 1: Read the three sources**

```bash
cat "$COSMOS_DOCS/ibc/next/apps/gmp/gmp.mdx"
cat spec/IBC_V2/app/ics-027-gmp/README.md
ls modules/apps/27-gmp 2>/dev/null || echo "ibc-go is a separate repo; read github.com/cosmos/ibc-go/tree/main/modules/apps/27-gmp"
```

Note which sections are protocol narrative (reusable verbatim) and which are Solidity specifics (replaced).

- [ ] **Step 2: Write `docs/ibc-go/latest/apps/gmp.mdx`**

Keep the source's section order — Overview, How it works, Data structures, Sending a call, Receiving, Acknowledgements — so a reader moving between the two sites is not disoriented. Replace every Solidity artifact with its Go counterpart:

- `struct GMPPacketData` in Solidity → the Go `GMPPacketData` type from `modules/apps/27-gmp/types`
- `sendCall` (EVM) → `MsgSendCall` and the message server
- `ICS27GMP.sol` links → `github.com/cosmos/ibc-go/tree/main/modules/apps/27-gmp`

Frontmatter:

```yaml
---
title: General Message Passing (GMP)
description: "How the ibc-go ICS27-GMP module executes cross-chain contract calls through deterministically derived accounts."
---
```

Where the EVM side is genuinely relevant, link to `/ibc/ibc-solidity-contracts/ics27-gmp-and-accounts` rather than describing it.

- [ ] **Step 3: Write the attestation light client page**

Same treatment at `docs/ibc-go/latest/light-clients/attestation/attestation-light-client.mdx`, from the Go light client in `modules/light-clients/attestations`. The import in the source page — `import ibcattestations "github.com/cosmos/ibc-go/v11/modules/light-clients/attestations"` — names the package to document.

```yaml
---
title: The attestation light client
description: "How the ibc-go attestation light client verifies state a quorum of attestors has signed."
---
```

Cross-link to `/ibc/light-clients/attestation-light-client` for the protocol-level description and `/ibc/ibc-solidity-contracts/attestation-light-client` for the EVM implementation.

- [ ] **Step 4: Verify the Solidity invariant on the two new pages**

```bash
grep -niE 'solidity|\.sol\b|solidity-ibc-eureka' \
  docs/ibc-go/latest/apps/gmp.mdx \
  docs/ibc-go/latest/light-clients/attestation/attestation-light-client.mdx \
  || echo "clean"
```

Expected: `clean`, or only lines that are Markdown links into `/ibc/ibc-solidity-contracts/`. Any Solidity code block, type definition or `solidity-ibc-eureka` source link is a failure.

- [ ] **Step 5: Add both pages to navigation**

Add `ibc-go/latest/apps/gmp` to the Apps group and `ibc-go/latest/light-clients/attestation/attestation-light-client` to the Light clients group in the `latest` version of the IBC-Go dropdown.

- [ ] **Step 6: Verify**

```bash
node docs/mintlify/scripts/check-nav.js
cd docs && npx mint broken-links
```

Expected: navigation agrees; zero broken links.

- [ ] **Step 7: Commit**

```bash
git add -A docs/
git commit -m "docs: add Go-only GMP and attestation light client pages

Written from ibc-go and spec/IBC_V2/app/ics-027-gmp rather than adapted
from the Solidity-dominant originals. EVM detail is linked, not described."
```

---

### Task 9: Final verification and handoff

**Files:**
- Delete: `docs/scripts/import-ibc-go.py`, `docs/scripts/test-import-ibc-go.py`
- Create: `docs/mintlify/DEPLOYMENT.md`
- Modify: `.github/PULL_REQUEST_TEMPLATE.md:28`, `.github/ISSUE_TEMPLATE/release-tracker.md:49`

**Interfaces:**
- Consumes: everything.
- Produces: a verified site and a deployment checklist for whoever has Mintlify dashboard access.

- [ ] **Step 1: Assert the Solidity invariant across the whole product**

This is Review Focus item 5 — the invariant is introduced across Tasks 5, 6 and 8 but asserted only here.

```bash
grep -rniE 'solidity|\.sol\b|solidity-ibc-eureka' docs/ibc-go/ \
  | grep -v '/ibc/ibc-solidity-contracts/' \
  || echo "INVARIANT HOLDS"
```

Expected: `INVARIANT HOLDS`. Every line that appears is either a Solidity reference to remove or a cross-link to rewrite as `/ibc/ibc-solidity-contracts/...`.

- [ ] **Step 2: Run every gate**

```bash
python3 docs/scripts/refgen.py all --check
python3 docs/scripts/test-refgen.py
python3 docs/scripts/specgen.py --check
python3 docs/scripts/test-specgen.py
node docs/mintlify/scripts/check-canonicals.js
node docs/mintlify/scripts/check-nav.js
cd docs && npx mint broken-links
```

Expected: every command exits 0.

- [ ] **Step 3: Confirm the agreed directory shape**

```bash
ls docs/
```

Expected exactly: `AGENTS.md  docs.json  ibc  ibc-go  mintlify  package.json  scripts`. Anything else is a stray from an earlier task.

- [ ] **Step 4: Delete the one-off importer**

```bash
git rm docs/scripts/import-ibc-go.py docs/scripts/test-import-ibc-go.py
```

It has served its purpose. Leaving it invites someone to re-run it against a tree that has since been hand-edited.

- [ ] **Step 5: Verify the license workflow passes on the new tree**

```bash
python3 -c "
import yaml
p = yaml.safe_load(open('.licenserc.yaml'))['header']['paths-ignore']
print('mdx:', 'docs/**/*.mdx' in p)
"
grep -L 'SPDX-License-Identifier' docs/scripts/*.py || echo "all generators carry SPDX"
```

Expected: `mdx: True` and `all generators carry SPDX`.

- [ ] **Step 6: Update the repo templates**

In `.github/PULL_REQUEST_TEMPLATE.md:28` and `.github/ISSUE_TEMPLATE/release-tracker.md:49`, the phrase "Updated documentation (`docs/`)" still reads correctly, but add a pointer so contributors find the generators:

```
- [ ] Updated documentation (`docs/`) if anything is changed. See `docs/AGENTS.md`.
```

- [ ] **Step 7: Write the deployment handoff**

Create `docs/mintlify/DEPLOYMENT.md`:

```markdown
# Deploying this site

Nothing here is deployed yet. The site is verified locally and in CI; standing
it up needs Mintlify dashboard access, which the migration could not do.

## Steps for whoever has access

1. Create a Mintlify project pointing at `github.com/cosmos/ibc`.
2. In **Git Settings**, enable "docs.json is in a subdirectory" and set the path
   to `/docs` (no trailing slash). Save — this triggers a deployment.
3. Point the domain at it.
4. Confirm `/ibc/introduction/what-is-ibc` and `/ibc-go/latest/intro` both load,
   and that the IBC-Go version switcher offers `latest` and `v10.1.x`.

## Open decisions

- **Plan tier.** Preview deployments require Pro or Enterprise. They do not
  cover pull requests opened from forks, and are publicly reachable unless the
  Enterprise access add-on is enabled. This decides how in-review docs get
  shared with people who will not run a dev server.
- **Redirects.** `cosmos/docs` still serves `/ibc/*`. When that tree is deleted,
  the same PR should add redirects from `/ibc/next/*` and `/ibc/latest/*` to
  the paths here.
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "docs: verify the migrated site and document deployment handoff

Removes the one-off importer, asserts the no-Solidity invariant across
ibc-go/, and records what the Mintlify dashboard steps are for whoever
has access."
```

- [ ] **Step 9: Open the pull request**

```bash
git push -u origin HEAD
gh pr create --repo cosmos/ibc \
  --title "docs: migrate ibc-go docs into a Mintlify site at docs/" \
  --body "Implements specs/2026-10-13-ibc-docs-migration-design.md.

Stands up a Mintlify site at \`docs/\` serving two products: \`ibc/\` (this
monorepo) and \`ibc-go/\` (\`latest\` plus a frozen \`v10.1.x\`), migrated out of
cosmos/docs. Nothing is deployed; the site is verified locally and in CI.

Review commit by commit — each one leaves the site building.

Two things worth knowing before reading the diff:

- **Protocol specs are generated, not copied.** The \`ibc/next/spec\` tree in
  cosmos/docs is a derived snapshot from 2026-04-09 missing the ICS-027 GMP
  spec. \`docs/scripts/specgen.py\` renders them from the canonical \`spec/\`
  instead, with \`--check\` in CI.
- **The GMP and attestation pages are new prose**, not adapted imports. The
  originals were Solidity-dominant; these are written from ibc-go.

cosmos/docs is untouched. Deleting its \`ibc/\` tree and adding redirects is a
follow-up — see \`docs/mintlify/DEPLOYMENT.md\`."
```

---

## Notes for the executor

**`$COSMOS_DOCS`** must point at a local checkout of `github.com/cosmos/docs` throughout Tasks 1, 5 and 6. Export it once at the start.

**File counts in this plan are measurements, not estimates**, taken 2026-10-13 against `cosmos/docs` at its then-current `main` and `cosmos/ibc` at `c60e3414`. If a count comes out materially different, the source moved — stop and reconcile rather than adjusting the number.

**Three tasks have no unit tests and rely on verification commands instead**: Task 1 (configuration), Task 2 (content conversion) and Task 8 (prose). Their gates are `mint validate`, `mint broken-links`, `check-nav.js` and the Solidity grep. Treat a failing gate as a failing test.
