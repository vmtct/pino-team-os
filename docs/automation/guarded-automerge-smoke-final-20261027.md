# Final guarded auto-merge smoke

Documentation-only test PR opened after the permission fix. The protected native merge should occur without manual merge when `validate` passes, and should then trigger main CI and guarded staging CD. No production, auth, migration, outbound or domain behavior changed.

Final rerun: protected branch plus required `validate`, pre-green native auto-merge admission, guarded staging CD after main CI.

Scoped token retry: `contents:write` and `pull-requests:write` apply only to trusted admission workflow.
