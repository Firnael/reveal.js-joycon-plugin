# RevealJS - The Joy Con Plugin

Control your RevealJS presentation with a Joy Con !

Mapping is done for both the right and left joy cons, independently.

Heavily inspired by [reveal.js-gamepad-plugin](https://github.com/bibixx/reveal.js-gamepad-plugin) from [bibixx](https://github.com/bibixx)

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
    type: 'right',   // or 'left', depending on the Joy Con you want to use, default is 'right'
    cooldown: 200,   // the time in ms between two actions, default is 300
    pointerSpeed: 10 // the speed of the pointer, default is 20
}
```

## Development

- Clone the repo
- Install dependencies with `npm install`
- Run the test app with `npm start`
  - The Reveal API is mocked, just open the console to verify inputs are correctly handled

## Planned features

- Customize key binding through config
- Customize pointer appearance through config 
