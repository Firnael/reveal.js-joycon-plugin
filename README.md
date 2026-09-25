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
| `STICK`   | `STICK`| Toggle pointer |
| `-`       | `+`    | Toggle pause |
| `CAPTURE` | `HOME` | Toggle help |

## Configuration

You can configure the plugin with the following options :

```javascript
// ...
plugins: [ /* ... */ ],
joycon: {
    type: 'right',         // or 'left', depending on the Joy Con you want to use, default is 'right'
    cooldown: 200,         // the minimum time in ms between two actions of the same button, default is 300
    pointerSpeed: 10,      // the speed of the pointer, default is 20
    enableStick: false,    // navigate with the stick (when not pointing), default is false
    statusIndicator: true  // show a discreet 🎮 in the bottom left corner on (dis)connection, default is true
}
```

## Robustness

Built to survive Bluetooth drops and the Mac going to sleep, without reloading the page:

- the pads are polled every frame (`navigator.getGamepads()`), connection events are only logged, so a reconnect is always picked up
- an action fires once per press (on the press edge), holding a button never repeats it, so a button stuck "pressed" by a dropped link cannot skip slides
- a pad that (re)connects is baselined silently: the press that wakes it up does nothing
- a single polling loop for the whole presentation, whatever connects or disconnects

Tip: keep the Mac awake while presenting with `caffeinate -dis npm run dev`.

## Development

- Clone the repo
- Install dependencies with `npm install`
- Run the test app with `npm start`
  - The Reveal API is mocked, just open the console to verify inputs are correctly handled

## Planned features

- Customize key binding through config
- Customize pointer appearance through config 
