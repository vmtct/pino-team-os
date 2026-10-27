# Guarded auto-merge staging smoke

This documentation-only change verifies GitHub-native merge admission for new same-repository safe PRs after branch protection and policy activation on 2026-10-27. It must be merged only after `validate` passes and must trigger the existing main push CI → guarded Team staging CD. No Production, migration, auth or outbound changes.
