# PAP-1014 — scoped TOS DS V4

Authority: docs/tos-v4-authority-manifest.md and pinned PAP-934 ZIP. Prototype stays local.

AppPhoneFrame/phone-frame.module.css own the only mobile frame. Primitives/primitives.module.css own shared controls, isolation, focus trap/restoration and feedback; TosDesignSystem.tsx exposes compatibility aliases. Header CSS is from V4. tokens.css is the sole scoped semantic palette; system.css and ordered cascade layers retain the source contract. Station uses a separate full-width desktop layout.

npm run tos:ds:check is a source contract guard, not visual parity or real Core readiness. Whole-app migration remains PARTIAL; see docs/tos-v4-candidate-checkpoint.md. No merge, deploy or Production authority.
