# PC communication archive study map

Date: 2026-09-02

This file records the reusable findings from `docs/` and `docs/bbs/`. The archive is a reference corpus, not a set of dependencies. The service remains a vanilla HTML/CSS/JavaScript web BBS with the existing Supabase/memory repository boundary.

## Scope and reading policy

`docs/` contains the project's recovered menus, command lists, NRE/ANSI notes, UI principles, books, images, and the 01410 reference video. `docs/bbs/` contains 14 archived BBS implementations and emulators, with approximately 21,700 files. Source, menu, UI, protocol, and operator documentation were inspected first; compiled objects, executables, package caches, duplicate checkouts, and media are evidence artifacts rather than implementation input.

## Archive-to-service findings

| Archive | Evidence inspected | Reusable service lesson | Not copied |
| --- | --- | --- | --- |
| `docs/bbs/01410.coroke.net-main` | `routes.json`, `static/index.js`, `static/index.css`, README | Menu routes are data; top title, command footer, URL history, touch focus, and board read/write are one terminal session | Kotlin/Spring server, OAuth providers, dial-up audio, fixed 640px canvas |
| `docs/bbs/bbs-web-main` | `useTerminalEmulation.ts`, `useSmartMouse.ts`, `TerminalCanvas.tsx`, terminal constants | Keep cursor state, CSI handling, screen dimensions, and mouse hit testing separate; keyboard and pointer actions must share a command | React/TypeScript stack, Socket.IO/ZMODEM transport, canvas-only rendering |
| `docs/bbs/bbs_XHOST5.22d` and `bbs_xhost511` | `gocode.c`, `xmenu.c`, `write.c`, `bbsread.c`, `bbssub.c`, `view.c` | Hierarchical GO searches the menu tree; P/M/N/F/B/Q/X are context actions; write flow is staged (target/title/body/confirm) with permission gates; lists support numeric selection and paging | DOS/Telnet process model, binary files, native filesystem session state |
| `docs/bbs/bbs_ezbbs-master` | README, `MENUEDIT`, `USEREDIT`, Delphi forms | Menus and user-facing text are editable data, not hard-coded screen logic | Delphi desktop editor and Telnet daemon |
| `docs/bbs/mighty-master` | README and ANSI/editor sources | 1995–96 BBS operation treated ANSI art, file areas, and host utilities as first-class modules | Borland C/C++ toolchain and native binaries |
| `docs/bbs/enigma-bbs-master` | README and docs for menus, MCI, ACS, message/file areas, WFC | Configurable menus/themes, access control, message areas, ANSI/SAUCE, and multi-node operational boundaries are explicit capabilities | SSH/Telnet servers, door processes, FidoNet/NNTP/Gopher transports |
| `docs/bbs/lbbs-master` | README, protocol/network and mail test names | Mail, connection, and failure paths need explicit state and deterministic tests | Full SMTP/IMAP/IRC/FTP server implementation |
| `docs/bbs/sbbs-master_src` | SyncTERM, terminal, protocol and standards files | Terminal behavior should be tested as a protocol contract, not only by screenshots | Native terminal client and modem protocol implementation |
| `docs/bbs/www-main` | WWIV network/ACS and utility sources | Access control and network boundaries belong in a service layer | WWIV network daemon and CMake toolchain |
| `docs/bbs/bbs_lhouse` and `bbs_790919549_camp` | operator manual and feature notes | Sysop operations, board permissions, mail, chat, and operator-editable forms are recurring BBS concepts | Original encoding/font assumptions and native host administration |

## Common rules extracted from the corpus

1. **Menu is a map.** A menu entry has a door/number, display name, GO code, parent, route, access rule, and optional help/footer. The current menu tree and `resolveAnyMenuNodeTarget()` already implement most of this; new aliases must be registered as data and tested before exposing them.
2. **Navigation is contextual.** `P`/`M` return to a parent or main menu, while `N`/`F` and `B`/`A` page or move between records. `Q`/`X` cancel or exit. A command must be interpreted by the current screen capability, not by a global one-character rule.
3. **One action, many inputs.** A clickable row, keyboard token, and typed command must invoke the same action. The hint bar describes the action but is not the error-message channel.
4. **Editors are sessions.** Recipient/target, title, body, validation, confirmation, cancel, and save are separate states. Empty-field errors stay beside the field/body, and `Ctrl+S`, final-dot, Enter, Tab, and Escape are explicit transitions.
5. **ANSI is a bounded protocol.** Preserve 80-column cell accounting, cursor movement, erase/insert/delete, scroll regions, colors, and safe handling of unknown control sequences. Nurie `.NRE`/Johab bytes are reference fixtures, not files to execute in the browser.
6. **Long content is different from chrome.** Menus and game screens should fit the terminal frame; long posts, news, help, and mail bodies may use a deliberate content viewport. This distinction prevents hidden clipping while preserving readable content.
7. **Permissions are part of the screen contract.** Guest/member/sysop access, write restrictions, and board/mail capability errors are rendered as user-facing messages without leaking repository or provider errors.

## Current implementation alignment

- `public/js/core/menuService.js` and `menuNavigation.js` provide the data-driven menu index, parent lookup, route reconstruction, and historical GO aliases.
- `public/js/core/commandRouter*.js` provides screen-aware P/M/B/F/A/N/Q handling and shared click/keyboard routing, but its action definitions remain distributed across modules.
- `public/js/core/ansiRenderUtils.js` contains the service-safe CSI renderer; `docs/NURIE_NRE_CATALOG.md` defines the supported versus excluded NRE range.
- `public/js/core/memoScreens.js`, `postScreens.js`, and `contactSysopScreen.js` implement staged editors and inline validation.
- `public/style.css` and `scripts/smoke-mobile-viewports.js` enforce the terminal frame across portrait, landscape, and short desktop viewports.

## Application priority

The next substantial improvement should be a **screen action contract**: define each screen's allowed actions (command token, click target, keyboard key, destination, and hint category) in one registry, then make the command footer and router consume that registry. This directly combines the XHOST context loop, the 01410 route map, and the bbs-web smart-mouse contract while reducing the risk of one input path working and another silently doing nothing.

The following are deliberately out of scope unless the service requirements change: modem/Telnet/ZMODEM transport, native DOS file/session layout, React/canvas migration, and automatic execution of archived binaries or unknown `.NRE` files.

## Verification references

- `npm run smoke:go-ansi`
- `npm run smoke:command-parity`
- `npm run smoke:full-traversal`
- `npm run smoke:mobile`
- `npm run loop:verify`
