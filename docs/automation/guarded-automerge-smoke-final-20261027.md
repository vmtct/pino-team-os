# Final guarded auto-merge smoke

Documentation-only test PR opened after the permission fix. The protected native merge should occur without manual merge when `validate` passes, and should then trigger main CI and guarded staging CD. No production, auth, migration, outbound or domain behavior changed.
