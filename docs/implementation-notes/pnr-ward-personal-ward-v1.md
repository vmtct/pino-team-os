# PNR-WARD Personal Ward V1 — Team implementation note

Feature: `PNR-WARD` / `pinoria-wardrobe-loadout`.

Team Surface Decision

- surface: `BO`
- primary_device: `DESKTOP`
- tos.app_family: `NONE`
- bo.sidebar_group: `Pinoria > Wardrobe`
- bo.subnavigation: `Personal Wards`
- bo.primary_layout: `SPLIT_VIEW`
- shared.permission_context: canonical Core `pinoria.ward.subject.*` permissions
- founder_layout_review: `APPROVED` by Founder direction in this delivery slice

The page manages Student and Staff through one PinoriaSelf-native Personal Ward. Character has eight canonical Ward slots; Relics have eight independent Relic slots. Collection supports ALL / CHARACTER / ACCESSORY / RELIC quick filters and dense image+name cards. Companion, TOS, TV, House and World are explicitly outside this BO slice.
