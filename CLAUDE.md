# CLAUDE.md

Operating manual for Claude Code in this repo.

## What this is

A Reveal.js plugin to drive a presentation with a Nintendo Switch Joy Con (published on npm as
`reveal.js-joycon-plugin`). Its owner presents conference talks with it, live on stage: **robustness beats
features**. A dropped Bluetooth link or a sleeping Mac must never cost a reload or a skipped slide.

Consumers: the talks in `../` (`paper-mario-stop-n-swop-talk`, `pokemon-glitches-asm-talk`,
`fast-inverse-sqrt-talk`, `reveal-react-template` use the npm 1.0.0) and `../talk-netcode`.

## Layout

| Path | Role |
|---|---|
| `src/plugin.ts` | Reveal plugin: one polling loop over every input source, press-edge actions, status indicator, stick pointer |
| `src/webhid.ts` | WebHID source (Chrome): Joy Con setup (subcommands), report parsing, watchdog |
| `src/laser.ts` | Gyroscope laser pointer (hold the stick press) |
| `dist/` | **Committed** build output, what npm consumers get: rebuild before committing |
| `index.html`, `main.js` | Test page (`npm start`): mocked Reveal API, everything shown on the page |
| `index.d.ts` | Module typing for consumers |

## Commands

- `npm start`: test page (Vite). Open it in Chrome (WebHID) or Firefox (Gamepad API, raw device).
- `npx tsc --noEmit -p .`: typecheck (Vite does not typecheck).
- `npx vite build`: build `dist/`.
- Publishing to npm is done by the owner, never by Claude.

## Hard-won facts (don't re-learn them)

- **Chrome and Safari on macOS don't see a lone Joy Con through the Gamepad API.** Apple's GameController
  layer classifies it as a `microGamepad` (no `extendedGamepad`); both browsers skip it. Firefox reads the raw
  HID device and sees it. Hence WebHID in Chrome. (Checked with a Swift probe on macOS 26.5, Chrome 153.)
- **Three button layouts**, picked per pad: `browser` (Chrome's Gamepad API mapping, from the original code,
  not re-verified since Chrome can't see a lone Joy Con here), `raw` (bit order of the simple HID report
  0x3F: what Firefox exposes, verified on a right Joy Con), and WebHID, which parses the full report 0x30 and
  **translates it into `raw`** so one mapping serves both.
- **Side detection**: WebHID product id (0x2006 left, 0x2007 right), or "(L)" / "(R)" in the Gamepad id. The
  `type` option is only a fallback. Stick press is raw #11 on the right Joy Con, #10 on the left.
- **Actions fire on the press edge only**, and a pad that (re)appears is baselined silently. Level-triggered
  buttons + a cooldown used to skip slides when a link froze a button "pressed".
- **Never keep Gamepad objects**; poll `navigator.getGamepads()` every frame. One `requestAnimationFrame`
  loop for the plugin's life (the 1.0.0 started one more per reconnection).
- **WebHID setup** (output report 0x01: packet counter, neutral rumble `00 01 40 40 00 01 40 40`,
  subcommand): IMU on (0x40 0x01), full mode (0x03 0x30), player light 1 (0x30 0x01). The watchdog re-sends
  it when no 0x30 report came for 1.5 s. Protocol reference:
  [dekuNukem/Nintendo_Switch_Reverse_Engineering](https://github.com/dekuNukem/Nintendo_Switch_Reverse_Engineering).
- **Laser axes** (Joy Con held like a remote): measured on a left Joy Con, yaw = gyro axis 2 (tip left =
  positive, so `invertX`), pitch = axis 1 (tip up = negative). **Right Joy Con axes not verified yet**
  (one axis is said to be reversed between the two). Gyro offset is learned whenever the Joy Con is still.
- **Joy Con quirks**: after a Bluetooth drop it sleeps, a button press reconnects it (normal, not a bug).
  After the battery ran flat, it once stayed "connected" in macOS while sending nothing: forget + re-pair
  fixed it.
- **A command-line GameController listener (Swift) receives no button input**: useless as an instrument.
  Firefox or `ioreg` read the raw device instead.

## Testing

- **Real hardware is the only proof.** The protocol: press-to-wake baseline, one action per press (hold SR:
  one `next`), Bluetooth off/on, Mac sleep/wake, without reloading the page. Plus, for WebHID: player light,
  ~60-66 reports/s, laser follows the wrist, reload attaches without the picker.
- **Headless logic checks** are cheap and worth it before asking for a hardware run: headless Chrome
  (`--headless=new --virtual-time-budget`), a `requestAnimationFrame` polyfill on `setTimeout` (rAF doesn't tick
  there), a fake `navigator.getGamepads()` or a fake `navigator.hid` device dispatching `inputreport` events,
  and the UMD build (`window.reveal['js - The Joy Con plugin']`).

## Open items

- Verify on hardware: right Joy Con laser axes, left Joy Con `raw` layout in Firefox, Chrome's `browser`
  layout on a setup where Chrome does expose the Joy Con.
- Publish a new version to npm (owner), then bump the talks.
