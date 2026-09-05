# PLT-WEB-CMS / F1-BO implementation note

Feature identity: `PLT-WEB-CMS` / `public-web-editorial-cms`.

```yaml
Team Surface Decision

surface: BO
primary_device: DESKTOP

tos:
  app_family: NONE
  entry_context:
  footer_items: []
  theme:
  primary_action:
  capture_requirements:

bo:
  sidebar_group: Content
  subnavigation: Website CMS
  primary_layout: SPLIT_VIEW

shared:
  permission_context: Core GLOBAL content.web.view/edit/publish/rollback/media.manage
  cross_domain_links: Canonical public Media asset identity only

founder_layout_review: APPROVED
```

The BO facade exposes only the registered slot list/detail/history reads and draft/publish/rollback commands. Manifest synchronization, arbitrary keys/URLs, page layout, and business truth remain outside this surface.
