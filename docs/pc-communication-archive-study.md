# PC communication archive study map

Date: 2026-09-02

This file records the reusable findings from `docs/` and `docs/bbs/`. The archive is a reference corpus, not a set of dependencies. The service remains a vanilla HTML/CSS/JavaScript web BBS with the existing Supabase/memory repository boundary.

## Scope and reading policy

`docs/` contains the project's recovered menus, command lists, NRE/ANSI notes, UI principles, books, images, and the 01410 reference video. A filesystem inventory on 2026-09-02 found 36 direct files in `docs/`, 9 additional handoff/reference files in `docs/docs/`, and 10,636 paths under `docs/bbs/` across 14 archive projects. Source, menu, UI, protocol, and operator documentation were inspected first; compiled objects, executables, package caches, duplicate checkouts, and media are evidence artifacts rather than implementation input. The count is deliberately exact for this checkout rather than an estimate from an earlier archive import.

### Inventory and reading boundary

The 14 archive roots are `01410.coroke.net-main`, `bbs-web-main`, `bbs_790919549_camp`, `bbs_ezbbs-master`, `bbs_lhouse`, `bbs_syncterm-20110209`, `bbs_XHOST5.22d`, `bbs_xhost511`, `enigma-bbs-master`, `lbbs-master`, `mighty-master`, `OpenSourceCommunity`, `sbbs-master_src`, and `www-main`. The 10,636 figure is the non-ignored reference/source path count from `rg --files`; `OpenSourceCommunity` also contains generated `.git`/`node_modules` content that is intentionally not part of the learning corpus. Their useful evidence falls into four groups:

1. **Service/menu behavior:** 01410 Coroke, XHOST, EZBBS, oldDOS notes, and Nownuri/Hitel recovery documents.
2. **Terminal protocol/rendering:** bbs-web, SyncTERM, SBBS ANSI parser/terminal sources, NRE catalog, and ANSI fixtures.
3. **Mail, chat, permissions, and operations:** XHOST read/write/mail sources, EZBBS guides, LBBS mail/network tests, WWIV ACS/network utilities, and the local service modules.
4. **Modern architecture reference:** Enigma's configurable menus/ACS and OpenSourceCommunity's modular community, notification, Supabase, and realtime boundaries.

The semantic audit covers representative entry points, menu definitions, command dispatch, editor state, ANSI parsing, mail/board flows, and access control for each group. It does **not** claim that every generated object, image, binary, lockfile, or duplicate source line was read manually; those artifacts do not add a separate service rule and are intentionally excluded from the implementation authority set.

The 36 direct `docs/` files were also classified: the 01410 principles/UI and viewport reports define product invariants; Nownuri/Hitel restorations and the Korean command/menu files define historical screens and vocabulary; the GO/NRE/learning catalogs define routing and encoding evidence; the four user guides and command HTML define comparative behavior; the legal documents define user-facing policy; and the PDFs/images/video are visual or historical fixtures. This classification is the reason the implementation audit can distinguish requirements from reference-only material.

A recursive inventory excluding `docs/bbs/` contains 476 files: 68 text files, 13 Markdown files, 28 PDFs, 278 JPGs, 81 PNGs, 2 JPEGs, 2 WebPs, 1 GIF, 2 HTML files, and 1 MP4. The largest visual/reference groups are the 173 Hitel guide page images, 86 Jeon Yoo-seong PC-communication guide images, 61 PDF previews, 42 Nownuri menu screens, and 21 termination notices. These counts confirm that the corpus is a mixed document-and-media archive; “complete learning” must therefore mean a verified semantic index plus targeted visual inspection, not pretending that every scan pixel has been memorized.

The supplied 01410 video is 6:11 long at 760×480/30fps (with an audio track intentionally ignored for UI study). Image-dimension checks show the Nownuri captures are 640×480 and the collected Chollian/reference images range from 340×211 upward; the PDF preview set includes high-resolution pages such as 2,873×4,069. This confirms both the original terminal aspect ratio and the need to separate low-resolution search thumbnails from readable source captures when selecting UI evidence.

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

## Material authority and discrepancies found

The local running source and its smoke tests are the authority for current behavior. The nested `docs/docs/` files are useful handoff material, but not all are current:

- `docs/docs/prompt-api.txt` describes an older JSON/MariaDB-style skeleton and old paths. It must not override the current Node HTTP server, repository drivers, or Supabase boundary.
- `docs/docs/CMD_UPDATE_PLAN.txt` contains a real and useful command model (contextual P/M, list L, Enter/F paging, A/N article traversal, O and `/Q` chat flow, LT/LI search), but it is internally inconsistent. Its opening “final applied” block and chapter 10 remove LS/PF/PE and legacy aliases, while chapter 6 and portions of chapters 4–8 still prescribe first-release compatibility for LS, PF, PE, DIR, SW/SI/SN/LN, `[`/`]`, CR, and US.
- The inconsistency is observable in the current code: `public/js/core/commandService.js`, `commandRouterGlobalNavigation.js`, `commandRouterBrowse.js`, and `commandNormalizer.js` still expose or normalize several of those aliases (for example LS and PF). Therefore the document describes a target policy, not proof that the policy is already deployed.
- `legacy/txt/help.txt`, runtime help generation, footer hints, and state handlers must be checked together; changing only a static help asset would leave the user-facing command contract split.

This gives a concrete definition of “understood”: historical behavior is separated from the current implementation, stale handoff text is marked as stale, and every proposed command change has a source-of-truth conflict recorded before code is changed.

## Consolidated model learned from the materials

The shared PC-communication model is now explicit: a data-driven hierarchical menu resolves numeric paths and GO codes; each screen owns a contextual action set; keyboard, click, and hint-bar entries dispatch the same action; editors advance through target/title/body/validation/save states; board and mail records use bounded paging and sequential traversal; ANSI/CSI is parsed as a safe 80-column cell protocol; and guest/member/sysop permissions are part of the screen contract. Native modem/Telnet/ZMODEM/FTN transports, DOS filesystem layouts, and archived binaries are historical implementation details, not requirements for this web service.

## UI-specific audit

The visual corpus confirms a stable terminal composition rather than one universal skin. Representative local assets include 16 files in `docs/ref_images`, 21 termination notices in `docs/종료공지`, 42 recovered Nownuri menu screens in `docs/NOWNURI_MENUS`, 8 Nownuri capture screens in `docs/nowro-capture`, and 61 PDF preview images. The 01410 video and Chollian/Nownuri captures consistently show:

- a 4:3-era fixed terminal canvas, dark blue/black or cyan background, bright fixed-width glyphs, and strong horizontal rules;
- a header with service/menu name, centered screen title, and page/position indicator;
- dense numbered rows with column alignment, reverse-video/category labels, and compact status text;
- a bottom command/status line that remains visually separate from the body and prompt;
- cursor-led keyboard entry as the primary interaction, with selection/number rows as the natural click/touch targets in the web adaptation.

The current implementation preserves these semantics through `buildTopHeader()`/ANSI builders, an 80-column logical grid in `ansiRenderUtils.js`, HTML hotspot overlays in `menuHotspotUtils.js`, shared command tokens in `appEvents.js`, and a separate `#cmd-hint`/`#terminal-prompt-row` footer contract in `style.css`. It intentionally adapts the original 640px/4:3 canvas to a responsive viewport: desktop caps the frame at 800px, while mobile scales the terminal font and reflows prose without changing command order. This is a UI-rule match, not a claim of pixel-identical video reproduction.

The extracted Hitel guide pages reinforce the same visual contract: a chapter/page title strip, dense black-and-white terminal screenshots, numbered command rows, and a bottom status line. They also show that historical command sets were service-specific and much denser than the modern web footer; the current app must preserve the visual hierarchy without blindly exposing every historical command.

The remaining representative manuals add two useful distinctions. Light House exposes separate command tables for the main menu, board, PDS, and personal areas (including context-specific `F/B/A`, `LS/LT/LI`, `UP/DN`, and `MEMO`), while its ANSI manual documents cursor/erase/insert/delete/save/restore sequences and color modes. Mighty models `BaseMenu`, `BaseExec`, `BbsData`, and `TextMenu` as distinct UI/session roles, with messages stored in editable data assets. These reinforce contextual commands and stateful screens, but their DOS encodings and executable/font constraints are not copied into the web client.

The compact `bbs_790919549_camp` source confirms the same model from a different implementation: `START.C` loads a serialized menu tree, accepts numeric selections, handles guest login, and displays a terminal header/status line; `MAIN.C` owns board/mail/chat state; `SYSOP.C` edits menu nodes and stores mail records. Its linked-list menu fields (`downp`, `neqp`, `upp`, depth, form, display label, GO code, read/write levels) are direct evidence that menu navigation and permissions belong to data/state, not isolated page markup.

Two modern references make the web interaction boundary explicit. Enigma's HJSON menu templates bind command values to actions, define per-form focus/validation/save states, and allow menu art/configuration to change independently. The bbs-web `useSmartMouse.ts` parser converts numbered rows, parenthesized commands, URLs, and article/news rows into terminal-coordinate hit boxes, removes same-line overlaps deterministically, and dispatches the captured command through the same input path. These are the direct precedents for the current `menuHotspotUtils.js`/`appEvents.js` overlay instead of adding ad-hoc click handlers per screen.

LBBS's `menus.conf` is a minimal but clear declarative example of `title`, key-to-action bindings, and `return`/`quit` transitions. SBBS SyncTERM's scrollback UI adds a second interaction layer: keyboard arrows/PageUp/PageDown, mouse wheel, click-to-open/copy URL, drag selection, and a help screen all operate on the same terminal cell buffer. The web service keeps the useful parity principle while excluding native clipboard, URL, and transport APIs that are outside its scope.

The remaining UI risk is therefore measurable: any new screen must preserve header → body → prompt → hint/status ordering, logical cell widths, non-overlapping hotspots, and mobile text containment. A screenshot that merely “looks retro” is insufficient evidence; the interaction and geometry smoke tests must also pass.

## Application priority

The next substantial improvement should be a **screen action contract**: define each screen's allowed actions (command token, click target, keyboard key, destination, and hint category) in one registry, then make the command footer and router consume that registry. This directly combines the XHOST context loop, the 01410 route map, and the bbs-web smart-mouse contract while reducing the risk of one input path working and another silently doing nothing.

The following are deliberately out of scope unless the service requirements change: modem/Telnet/ZMODEM transport, native DOS file/session layout, React/canvas migration, and automatic execution of archived binaries or unknown `.NRE` files.

## Verification references

- `npm run smoke:go-ansi`
- `npm run smoke:command-parity`
- `npm run smoke:full-traversal`
- `npm run smoke:mobile`
- `npm run loop:verify`

## Reuse lookup for future development

Use this table before implementing a new feature. The first column is the authoritative local evidence to reopen; the second is the rule already learned from it; the last column is the current service boundary.

| When changing | Reopen these materials | Apply in `www-bbs` | Keep out of scope |
| --- | --- | --- | --- |
| Header, page title, separators, footer | `docs/01410-ui-reference.md`, `docs/01410-common-principles.md`, `docs/_pdf_preview/`, `docs/nowro-capture/` | `buildTopHeader()`, ANSI builders, `#terminal-footer`, `#cmd-hint`, `#terminal-prompt-row` | Pixel-identical video reproduction, audio, modem timing |
| GO or numeric menu navigation | `nurie/HITEL.MNU`, `nurie-source/GOMENU.C`, `docs/PC통신_GO_호환성_카탈로그.md`, XHOST `gocode.c`/`xmenu.c` | `menuService.js`, `menuNavigationActions.js`, state-aware router | DOS menu files or executing archived binaries |
| Board/post list and article flow | XHOST `bbsread.c`/`bbssub.c`/`write.c`, `docs/USER_GUIDE_*.txt`, Hitel guide page captures | browse/post-view routers, post screens, repository pagination | Native record files and original CP949 storage layout |
| Mail/memo/editor | XHOST mail sources, `docs/NOWNURI_*`, Hitel guide email pages, Enigma `private_mail.in.hjson` | `memoScreens.js`, `commandRouterMemo.js`, mail repository/API | SMTP/POP3/IMAP server implementation |
| Chat and presence | XHOST chat paths, Nownuri menu captures, Enigma main menu, LBBS tests | `commandRouterChat.js`, chat repositories/realtime boundary | Telnet/IRC relay and multi-node daemon |
| ANSI/NRE rendering | `docs/NURIE_NRE_CATALOG.md`, Nurie `.NRE` samples, SBBS `ansi_parser.*`, bbs-web `useTerminalEmulation.ts` | `ansiRenderUtils.js`, bounded CSI support, safe unknown-sequence handling | Direct browser execution of raw CP949/Johab NRE bytes |
| Click/touch parity | bbs-web `useSmartMouse.ts`, 01410 Coroke `static/index.js`, `docs/01410-common-principles.md` | `menuHotspotUtils.js`, `appEvents.js`, shared command dispatch | Separate one-off click behavior that bypasses keyboard routing |
| Mobile overflow and viewport | `docs/01410-ui-reference.md`, `docs/vertical-viewport-audit.md`, image/capture dimensions | responsive `style.css`, `smoke-mobile-viewports.js`, text wrapping helpers | Replacing the terminal with card/grid UI |
| Permissions and operator controls | XHOST `write.c`/`view.c`, camp `SYSOP.C`, WWIV ACS sources, Enigma ACS docs | repository authorization, guest/member/sysop screen contract | Trusting client-side role flags or exposing service-role secrets |

When a source conflicts with current code, prefer the current service contract and record the historical behavior as a compatibility decision. In particular, do not infer that every command listed in an old manual should be exposed; verify that a destination screen/API and a keyboard/click action both exist first.
