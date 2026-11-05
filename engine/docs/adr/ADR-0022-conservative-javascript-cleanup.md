# ADR-0022: Preserve ambiguous JavaScript during built-in cleanup

Status: Accepted

## Context

The line scanner deleted any line containing `sourceMappingURL=`, including real
statements and string data. It also removed line-looking text inside multiline
templates and continued strings, and ignored `remove_source_maps = false`.

## Decision

Remove only standalone line directives when the policy enables that transform.
When input contains a template delimiter, a backslash, or a block-comment opener,
leave it unchanged by this cleanup pass. Preserve line endings and recognized
license/preservation comments. Delegate broader stripping to a parser-based JS
path instead of attempting a partial JavaScript lexer.

This is a conservative loss of cleanup coverage, not a claim of universal JavaScript
compatibility. Other optional engine stages can still alter behavior. No RRS axis
or weight changes; retained metadata may legitimately lower a measurement.

## Validation

Regressions cover marker text in code, multiline templates/comments/strings,
disabled source-map removal, line endings and license notices. Existing engine
tests remain required. REAguard's separate parser-based JavaScript lane has browser
behavior tests; those do not certify every engine transform.
