---
name: review-generated-prose
description: Use after regenerating docs with docs/scripts/refgen.py (the CLI reference tables in docs/ibc/ibc-cli/) or docs/scripts/specgen.py (the spec pages in docs/ibc/spec/), to read the generated output for grammar, mangling and whether it makes sense to a reader. Also use when a generated page reads badly and it is unclear whether the fix belongs in the generator, in the Go or proto source, or in spec/.
---

# Reviewing generated prose

`refgen.py all --check` and `specgen.py --check` prove that each page matches what its generator read. Neither reads the page as English, and neither can tell a correct reading from a wrong one: `--check` passes over a page that faithfully reproduces a bad description, or that the generator mangled the same way every time. (`docs/scripts/AUDIT.md` covers a different question, whether the reference tables are true against the code. This skill is about whether the output reads correctly and where a fix belongs.)

Run this after the generators are green and before the PR goes up, whenever the generated output changed materially.

## The rule that shapes everything here

Never edit a generated region.

- `docs/ibc/spec/**` is overwritten wholesale by `specgen.py`. Every page starts with a comment header saying so.
- In `docs/ibc/ibc-cli/{cli-commands,configuration,api}.mdx`, everything between a `{/* GEN:... START */}` marker and its `END` is rewritten by `refgen.py`. The prose around the markers is hand-written and safe to edit.

An edit inside generated output is not a fix. It disappears at the next regeneration and takes its reviewer's attention with it. Every finding resolves to one of four places, and deciding which is the substance of this review:

| The problem is in | Fix it in | How you can tell |
| --- | --- | --- |
| Wording or structure the generator supplies: captions, column headings, how a flag or field is rendered | `docs/scripts/refgen.py` or `docs/scripts/specgen.py` | The same phrasing or breakage recurs across many tables or pages |
| A description of a config key, flag or proto field | The doc comment in `cli/`, or the comment above the field in `proto/cli/*.proto` | The text appears once and reads like a developer's comment. See `docs/scripts/AGENTS.md` for how to resolve the plan entries that cover this |
| Spec text itself | `spec/` at the repository root | The sentence is in the source `.md`, byte for byte |
| Hand-written prose around the markers | The page itself | It is outside any `GEN` marker |

Be careful with the third row. `spec/` is the canonical standards text, versioned source rather than site copy. A wording or typo fix there is a change to a specification and goes through that repository's normal review. Do not paper over it in the generator, and do not treat a spec sentence you dislike as a generator defect.

A description that is wrong at the source stays wrong until the source is fixed. Record it, raise it, and do not hide it locally.

## What to read

Sample rather than grind. A generator makes the same mistake everywhere it meets a construct, so a defect is almost always a class, and a pattern seen twice is a pattern.

- **refgen:** the three pages, with attention to a command or config key of each shape (required and optional, with and without a default, a repeated flag, a nested message in the API page).
- **specgen:** a handful of the pages (`find docs/ibc/spec -name '*.mdx' | wc -l` gives 42 at time of writing) of different shapes: one that had no frontmatter and got a synthesized `title`, one rich in links to other specs, one with images, one with `<...>` or HTML comments in the source, one with tables.

## What to look for

**Mangling by the generator.** For specgen, the transforms are narrow and each has a failure mode:

- a relative link rewritten to the wrong absolute site path, or to a GitHub URL when the target is in fact published
- `<name,other>` turned into `&lt;name,other>` where the source meant a real tag, or the reverse
- an HTML comment turned into `{/* ... */}` that now swallows following text
- a synthesized `title` taken from the wrong heading, or a title that duplicates an `h1` in the body
- an image path that renders as literal text
- text inside a fenced code block that was rewritten (it never should be)

For refgen: a table cell that broke its row, a default shown as an internal Go value rather than what a user would type, a description cut mid-sentence, a stray backtick, a required marker that disagrees with the surrounding prose.

**Grammar and spelling**, in the generator's own wording first. A typo the generator introduces is ours and appears everywhere; a typo in a source comment is the source's.

**House style** (`docs/AGENTS.md`): no em dashes in site prose, internal links as absolute Mintlify paths with no extension. The generators should never emit a violation, so one occurrence is a template defect. Spec text is the exception: it is the source's own style.

**Whether it makes sense.** Could a competent reader who has not used this tool act on the page without guessing?

- Does a description say what to put in the field, or only restate its name?
- Does the page state the form of every value it asks for?
- Does an example agree with the table above it?
- Does a sentence assume context the page never gives?
- Is a heading ambiguous between two similarly named commands or services?

## How to report

Group findings by where they must be fixed, using the table above, because that is the order someone will act on them. For each: the page and anchor, the text as it stands, and what it should say.

Say plainly when a class of problem lives at the source and is large. "Sixteen config keys restate their own name and say nothing else" is a useful finding about doc-comment quality. Listing all sixteen is not.

If nothing needs fixing, say so in a sentence. A prose review that manufactures findings to look thorough costs more attention than it saves.

## Verifying a generator fix

After changing a generator, regenerate and confirm the fix landed everywhere the pattern appeared, not only on the page where you noticed it:

```bash
python3 docs/scripts/refgen.py all
python3 docs/scripts/specgen.py
python3 docs/scripts/refgen.py all --check && python3 docs/scripts/specgen.py --check
python3 docs/scripts/test-refgen.py && python3 docs/scripts/test-specgen.py
```

Add a unit test for anything you fix, in `test-refgen.py` or `test-specgen.py`. A defect that shipped once will ship again.
