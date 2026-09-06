# WFM-TIME-BO/F3 Correction UI

Team Surface Decision remains BO / DESKTOP / Workforce / SPLIT_VIEW from F1.

F3 adds `Correct attendance` only inside the existing Timekeeping detail panel for CLOSED sessions. It displays immutable `Recorded` facts separately from the Core-projected `Corrected` effective facts and latest correction provenance. Save sends one bounded Core correction command with a fresh idempotency key and exact `expectedLatestCorrectionId`, then refetches Core before presenting the result. There is no optimistic attendance truth.

OPEN/missed-checkout resolution is intentionally absent and labeled as F4-owned. Team does not implement attendance ordering, Center/workDate, lineage, or correction authorization rules locally.
