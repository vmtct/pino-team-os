# WFM-TRAIN Experience-as-Code authoring

This is the developer/GPT authoring convention for bespoke internal training experiences.

## Add a new experience

1. Create a versioned component under `app/components/training/experiences/`.
2. Implement only `TrainingExperienceProps`; do not call Core or BO clients directly.
3. Export a `TrainingExperienceDefinition` with a stable slug key and positive revision.
4. Add the explicit local definition to `experiences/registry.ts`.
5. Review the exact component through a PREVIEW host.
6. Add registry/contract/browser tests.
7. Ship through normal PR/CI.
8. Publish a new Core Training ModuleVersion that pins the exact ref.

## Version rule

`(experienceKey, experienceRevision)` is immutable once a published ModuleVersion references it.
Observable content or behavior changes require a new experience revision and a new ModuleVersion.
Old revisions stay bundled while active or historical assignments need them.

## Security rule

Allowed: explicit compile-time imports and static registry entries.

Prohibited: Core/DB-provided component paths, dynamic remote imports, executable HTML/JS payloads,
`eval`, external plugin code, or silent fallback from an unknown EXPERIENCE ref to the NATIVE runner.

## Lifecycle rule

Experiences may request only bounded lifecycle signals. Core remains authoritative for assignment,
progress, assessment, sign-off, qualification and audit. A custom experience can never grant a
qualification or permission directly.

## Product rule

Do not extract a generic training builder because two experiences look similar. Reusable primitives
should emerge only after repeated real use demonstrates a stable pattern.
