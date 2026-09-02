# Vertical viewport audit (2026-09-02)

The terminal UI is checked across portrait, landscape, and short desktop viewports. The audit covers the 31 standard routes used by `smoke-mobile-viewports.js`.

- Portrait: 320x568, 360x740, 390x844, and 430x932.
- Landscape: 568x320 and 844x390.
- Short desktop: 1024x600.

Short desktop and compact landscape layouts use proportional ANSI font and line sizing so the terminal content fits the viewport without an internal vertical scrollbar. The landscape footer and command hint remain single-line and clipped safely within the viewport.

The mobile smoke test records `#terminal-screen` `scrollHeight` and `clientHeight` and fails when content exceeds the visible terminal area or when the footer/command input is clipped. Portrait checks also cover touch targets, click/keyboard interaction, and long-text wrapping; landscape checks retain horizontal overflow protection.

Run the deterministic audit with memory repositories:

```powershell
$env:BOARD_REPOSITORY_DRIVER='memory'
$env:MEMBER_REPOSITORY_DRIVER='memory'
$env:MEMO_REPOSITORY_DRIVER='memory'
$env:ATTACHMENT_REPOSITORY_DRIVER='memory'
$env:CHAT_ROOM_REPOSITORY_DRIVER='memory'
$env:ACTIVITY_REPOSITORY_DRIVER='memory'
$env:RSS_CACHE_DRIVER='memory'
npm run smoke:mobile
```
