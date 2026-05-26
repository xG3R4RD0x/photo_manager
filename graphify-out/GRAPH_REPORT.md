# Graph Report - .  (2026-05-26)

## Corpus Check
- 51 files · ~84,467 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 722 nodes · 991 edges · 98 communities (96 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_GUI Frontend|GUI Frontend]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_GUI Frontend|GUI Frontend]]
- [[_COMMUNITY_GUI Frontend|GUI Frontend]]
- [[_COMMUNITY_GUI Frontend|GUI Frontend]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_photo|photo]]
- [[_COMMUNITY_photo|photo]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_media|media]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_media|media]]
- [[_COMMUNITY_capabilities|capabilities]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_import|import]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_import|import]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_media|media]]
- [[_COMMUNITY_opencode|opencode]]
- [[_COMMUNITY_schemas|schemas]]
- [[_COMMUNITY_schemas|schemas]]

## God Nodes (most connected - your core abstractions)
1. `allow` - 76 edges
2. `deny` - 76 edges
3. `permissions` - 31 edges
4. `permissions` - 30 edges
5. `useUIStore` - 29 edges
6. `compilerOptions` - 24 edges
7. `usePhotoStore` - 21 edges
8. `permissions` - 11 edges
9. `permissions` - 9 edges
10. `useFolderBrowse()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `DuplicateCheckBar()` --calls--> `useUIStore`  [EXTRACTED]
  gui-frontend/src/components/DuplicateCheckBar.tsx → gui-frontend/src/stores/useUIStore.ts
- `FormatSection()` --calls--> `useUIStore`  [EXTRACTED]
  gui-frontend/src/components/FormatSection.tsx → gui-frontend/src/stores/useUIStore.ts
- `ImportModal()` --calls--> `useUIStore`  [EXTRACTED]
  gui-frontend/src/components/ImportModal.tsx → gui-frontend/src/stores/useUIStore.ts
- `MetadataSection()` --calls--> `usePhotoStore`  [EXTRACTED]
  gui-frontend/src/components/MetadataSection.tsx → gui-frontend/src/stores/usePhotoStore.ts
- `PreviewModal()` --calls--> `useUIStore`  [EXTRACTED]
  gui-frontend/src/components/PreviewModal.tsx → gui-frontend/src/stores/useUIStore.ts

## Communities (98 total, 2 thin omitted)

### Community 0 - "GUI Frontend"
Cohesion: 0.07
Nodes (50): DestinationTreeSection(), DuplicateCheckBar(), FormatSection(), TEMPLATES, ImportModal(), EXIFData, MetadataSection(), DayGroup (+42 more)

### Community 1 - "schemas"
Cohesion: 0.05
Nodes (41): commands, description, identifier, commands, description, identifier, commands, description (+33 more)

### Community 2 - "schemas"
Cohesion: 0.06
Nodes (33): commands, description, identifier, commands, description, identifier, commands, description (+25 more)

### Community 3 - "GUI Frontend"
Cohesion: 0.08
Nodes (16): DirEntry, DupProgress, EXIFData, generate_thumbnail(), generate_thumbnail_impl(), get_config(), get_thumbnail(), list_directory_tree() (+8 more)

### Community 4 - "GUI Frontend"
Cohesion: 0.07
Nodes (26): compilerOptions, allowSyntheticDefaultImports, alwaysStrict, esModuleInterop, isolatedModules, jsx, lib, module (+18 more)

### Community 5 - "GUI Frontend"
Cohesion: 0.08
Nodes (25): dependencies, react, react-dom, react-window, @tauri-apps/api, @tauri-apps/plugin-dialog, @tauri-apps/plugin-fs, zustand (+17 more)

### Community 6 - "schemas"
Cohesion: 0.13
Nodes (22): core, core:app, default_permission, global_scope_schema, permission_sets, default_permission, core:event, default_permission (+14 more)

### Community 7 - "photo"
Cohesion: 0.10
Nodes (20): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+12 more)

### Community 8 - "photo"
Cohesion: 0.15
Nodes (12): devDependencies, @tauri-apps/cli, name, scripts, build, dev, tauri, tauri:build (+4 more)

### Community 9 - "schemas"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 10 - "schemas"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 11 - "media"
Cohesion: 0.26
Nodes (8): extract_date_with_fallback(), extract_exif_date(), extract_exif_date_fast(), extract_exif_from_partial_read(), get_cache_key(), get_file_modification_date(), parse_exif_date(), PhotoMetadata

### Community 12 - "schemas"
Cohesion: 0.14
Nodes (12): commands, description, identifier, commands, description, identifier, commands, description (+4 more)

### Community 13 - "schemas"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 14 - "schemas"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 15 - "schemas"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 16 - "schemas"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 17 - "schemas"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 18 - "schemas"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 19 - "schemas"
Cohesion: 0.22
Nodes (9): commands, description, identifier, deny, commands, description, identifier, allow-append (+1 more)

### Community 20 - "schemas"
Cohesion: 0.25
Nodes (8): description, identifier, permissions, commands, description, identifier, allow-set-app-theme, deny-fetch-data-store-identifiers

### Community 21 - "schemas"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 22 - "schemas"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 23 - "schemas"
Cohesion: 0.29
Nodes (6): main-window, description, identifier, local, permissions, windows

### Community 24 - "media"
Cohesion: 0.33
Nodes (3): find_photo_folder(), list_all_removable_drives(), RemovableDrive

### Community 25 - "capabilities"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 26 - "schemas"
Cohesion: 0.33
Nodes (6): commands, allow, commands, description, identifier, deny-identifier

### Community 27 - "import"
Cohesion: 0.50
Nodes (3): apply_template(), build_destination_tree(), TreeNode

### Community 28 - "schemas"
Cohesion: 0.40
Nodes (5): commands, description, identifier, permissions, allow-items

### Community 29 - "schemas"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 30 - "schemas"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 31 - "import"
Cohesion: 0.50
Nodes (4): apply_template(), copy_with_template(), ImportJob, ImportProgress

### Community 32 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-app-show

### Community 33 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-default-window-icon

### Community 34 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-identifier

### Community 35 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-name

### Community 36 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-remove-data-store

### Community 37 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-supports-multiple-windows

### Community 38 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-remove-listener

### Community 39 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-version

### Community 40 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-app-hide

### Community 41 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-bundle-type

### Community 42 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-fetch-data-store-identifiers

### Community 43 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-register-listener

### Community 44 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-remove-listener

### Community 45 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-set-dock-visibility

### Community 46 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-tauri-version

### Community 47 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-version

### Community 48 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-app-hide

### Community 49 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-app-show

### Community 50 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-bundle-type

### Community 51 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-default-window-icon

### Community 52 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-name

### Community 53 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-register-listener

### Community 54 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-remove-data-store

### Community 55 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-set-app-theme

### Community 56 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-set-dock-visibility

### Community 57 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-supports-multiple-windows

### Community 58 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-get

### Community 59 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-set-accelerator

### Community 60 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-set-as-window-menu

### Community 61 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-create-default

### Community 62 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-is-checked

### Community 63 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-is-enabled

### Community 64 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-popup

### Community 65 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-prepend

### Community 66 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-remove

### Community 67 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-remove-at

### Community 68 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-set-as-app-menu

### Community 69 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-set-as-help-menu-for-nsapp

### Community 70 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-set-checked

### Community 71 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-set-enabled

### Community 72 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-set-icon

### Community 73 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-set-text

### Community 74 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, allow-text

### Community 75 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-append

### Community 76 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-get

### Community 77 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-insert

### Community 78 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-is-checked

### Community 79 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-is-enabled

### Community 80 - "schemas"
Cohesion: 0.50
Nodes (4): commands, description, identifier, deny-items

### Community 81 - "schemas"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 82 - "schemas"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 83 - "schemas"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 84 - "schemas"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 87 - "schemas"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 88 - "schemas"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

## Knowledge Gaps
- **353 isolated node(s):** `name`, `version`, `type`, `workspaces`, `dev` (+348 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `allow` connect `schemas` to `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `deny` connect `schemas` to `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `permissions` connect `schemas` to `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`, `schemas`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _353 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `GUI Frontend` be split into smaller, more focused modules?**
  _Cohesion score 0.06522522522522523 - nodes in this community are weakly interconnected._
- **Should `schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `schemas` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._