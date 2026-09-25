# RevealJS - The Joy Con Plugin

<img src="joycon-icon.webp" alt="Joy Con icon" width="120" />

Control your RevealJS presentation with a Joy Con !

Mapping is done for both the right and left joy cons, independently.

Heavily inspired by [reveal.js-gamepad-plugin](https://github.com/bibixx/reveal.js-gamepad-plugin) from [bibixx](https://github.com/bibixx)

Joy Con icon by [u/Carusofilms](https://www.reddit.com/user/Carusofilms/), shared freely in [this post](https://www.reddit.com/r/NintendoSwitch/comments/5ywk3r/its_not_perfect_but_i_just_finished_a_vector/).

## Installation

### From NPM

```bash
npm install --save reveal.js-joycon-plugin
```

Once installed, you can include the plugin as an ES module:

```javascript
import Reveal from 'reveal.js';
import RevealJoyCon from 'reveal.js-joycon-plugin';

const deck = new Reveal();
deck.initialize({
    // ...
    plugins: [
        // ...,
        RevealJoyCon
    ]
})
```

## Key bindings

By default, the plugin is configured with the following key bindings :

| Left      | Right  | Action |
| --------- | ------ | ------ |
| `RIGHT`   | `A`    | Right |
| `DOWN`    | `B`    | Down |
| `UP`      | `X`    | Up |
| `LEFT`    | `Y`    | Left |
| `SR`      | `SR`   | Next slide |
| `SL`      | `SL`   | Previous slide |
| `L`       | `R`    | Toggle overview |
| `ZL`      | `ZR`   | Quit overview / Next slide |
| `STICK`   | `STICK`| Laser pointer while held (WebHID) / toggle pointer (Gamepad API) |
| `-`       | `+`    | Toggle pause |
| `CAPTURE` | `HOME` | Toggle help |

The side of each Joy Con is detected on its own (its product id, or "(L)" / "(R)" in its name), so the left and right mappings apply to the right controller whatever `type` says.

## WebHID and the laser pointer (Chrome)

On macOS, a lone Joy Con is a "micro gamepad" for Apple's GameController layer, and **Chrome and Safari don't expose it through the Gamepad API** (Firefox does, it reads the raw device). So in Chrome the plugin talks to the Joy Con directly over [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API):

- **first time only**: press `c` (or call `connectHID()` from a click) and pick the Joy Con in Chrome's window. Chrome remembers the permission for this origin (host + port): after that, the Joy Con attaches on its own, at page load and on every reconnection
- player light 1 turns on when the plugin has taken over the Joy Con
- **laser pointer**: hold the stick press and point the Joy Con at the screen like a remote. The dot starts at the center on every press and follows the gyroscope; release to hide it

The plugin's keys (`c` connect, `i` indicator) are registered through Reveal's own key bindings, so Reveal's default action on those keys never fires (with `c`: closing an overlay), and they are listed in Reveal's help (`?`).

Both sources run side by side: WebHID for Joy Cons in Chrome, the Gamepad API for everything else (a Joy Con read by WebHID is ignored on the Gamepad API side, so nothing fires twice).

## Configuration

You can configure the plugin with the following options :

```javascript
// ...
plugins: [ /* ... */ ],
joycon: {
    type: 'right',         // or 'left': fallback when the side of a controller can't be detected, default is 'right'
    cooldown: 200,         // the minimum time in ms between two actions of the same button, default is 300
    pointerSpeed: 10,      // the speed of the stick pointer (Gamepad API), default is 20
    enableStick: false,    // navigate with the stick (when not pointing), default is false
    statusIndicator: true, // show the 🎮 indicator in the bottom left corner at load (see below), default is true
    statusToggleKey: 'i',  // letter key showing / hiding the indicator live (false to disable), default is 'i'
    hidConnectKey: 'c',    // letter key opening the WebHID device picker (false to disable), default is 'c'
    laser: {
        fov: 30,           // degrees of wrist rotation to sweep the whole screen width, default is 30
        // which gyroscope axis moves the dot, per side (defaults measured on a left Joy Con, right one to verify)
        left: { yawAxis: 2, pitchAxis: 1, invertX: true, invertY: false },
        right: { yawAxis: 2, pitchAxis: 1, invertX: true, invertY: false }
    }
}
```

## Status indicator

A small 🎮 with a colored dot, bottom left (hover it for details: name, source, reports per second). Press `i` to show / hide it live, or set `statusIndicator: false` to start hidden:

| Dot | Meaning |
| --- | --- |
| grey | plugin loaded, no controller yet |
| green, pulsing | connected, and reports arriving (WebHID streams ~60 reports / s, the dot blinks with them) |
| orange | WebHID Joy Con connected but silent for over a second: looks connected, sends nothing |
| red | the controller was there and is gone: press any button on it to wake it up |

With the Gamepad API (Firefox), a Joy Con only sends something when a button changes, so silence can't be told apart from a quiet hand: the dot stays green while it is connected.

## Robustness

Built to survive Bluetooth drops and the Mac going to sleep, without reloading the page:

- the pads are polled every frame (`navigator.getGamepads()`), connection events are only logged, so a reconnect is always picked up
- an action fires once per press (on the press edge), holding a button never repeats it, so a button stuck "pressed" by a dropped link cannot skip slides
- a pad that (re)connects is baselined silently: the press that wakes it up does nothing
- a single polling loop for the whole presentation, whatever connects or disconnects
- WebHID: a watchdog re-sends the Joy Con setup whenever its reports stop (sleep, reconnection)

On stage:

- keep the Mac awake while presenting with `caffeinate -dis npm run dev`
- if the Joy Con drops, press any button: that wakes it up and reconnects it, and that press does nothing on the slides
- if the Joy Con looks connected in macOS but sends nothing at all, "forget" it in the Bluetooth settings and pair it again (seen after the battery ran flat)

## Development

- Clone the repo
- Install dependencies with `npm install`
- Run the test app with `npm start` and open it in Chrome (WebHID) or Firefox
  - The Reveal API is mocked: the page shows what the browser sees, what the plugin did (a fake slide counter), the WebHID state and the live gyroscope, and an event log

## Planned features

- Customize key binding through config
- Customize pointer appearance through config 
