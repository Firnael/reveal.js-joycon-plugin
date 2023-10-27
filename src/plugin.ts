import type { Api, Options } from 'reveal.js';

const DEFAULT_CONFIG = {
    type: 'right',
    cooldown: 300,
    pointerSpeed: 20
};

interface JoyConPluginOptions extends Options {
    joycon: {
        type: string | undefined;
        cooldown: number | undefined;
        pointerSpeed: number | undefined;
    };
}

type GamePadControllers = {
    [key: string]: Gamepad;
};

const RIGHT_JOYCON_BUTTON = {
    A: 0,
    X: 1,
    B: 2,
    Y: 3,
    SL: 4,
    SR: 5,
    ZR: 7,
    R: 8,
    PLUS: 9,
    STICK: 10,
    HOME: 16
};

const LEFT_JOYCON_BUTTON = {
    DLEFT: 0,
    DBOTTOM: 1,
    DUP: 2,
    DRIGHT: 3,
    SL: 4,
    SR: 5,
    ZL: 6,
    L: 8,
    MINUS: 9,
    STICK: 10,
    SCREENSHOT: 16
};

const AXIS = {
    LOY: 0,
    LOX: 1,
    ROY: 2,
    ROX: 3
};

const init = (deck: Api) => {
    const config = deck.getConfig() as JoyConPluginOptions;
    console.log('Joy Con plugin loaded', config.joycon || {});

    const TYPE = config.joycon?.type || DEFAULT_CONFIG.type;
    const COOLDOWN = config.joycon?.cooldown || DEFAULT_CONFIG.cooldown;
    const POINTER_SPEED = config.joycon?.pointerSpeed || DEFAULT_CONFIG.pointerSpeed;
    const ACTIONS = {
        RIGHT: TYPE === 'left' ? LEFT_JOYCON_BUTTON.DRIGHT : RIGHT_JOYCON_BUTTON.A,
        LEFT: TYPE === 'left' ? LEFT_JOYCON_BUTTON.DLEFT : RIGHT_JOYCON_BUTTON.Y,
        UP: TYPE === 'left' ? LEFT_JOYCON_BUTTON.DUP : RIGHT_JOYCON_BUTTON.X,
        DOWN: TYPE === 'left' ? LEFT_JOYCON_BUTTON.DBOTTOM : RIGHT_JOYCON_BUTTON.B,
        PREV: TYPE === 'left' ? LEFT_JOYCON_BUTTON.SL : RIGHT_JOYCON_BUTTON.SL,
        NEXT: TYPE === 'left' ? LEFT_JOYCON_BUTTON.SR : RIGHT_JOYCON_BUTTON.SR,
        QUIT_OVERVIEW_OR_NEXT: TYPE === 'left' ? LEFT_JOYCON_BUTTON.ZL : RIGHT_JOYCON_BUTTON.ZR,
        TOGGLE_OVERVIEW: TYPE === 'left' ? LEFT_JOYCON_BUTTON.L : RIGHT_JOYCON_BUTTON.R,
        TOGGLE_POINTING: TYPE === 'left' ? LEFT_JOYCON_BUTTON.STICK : RIGHT_JOYCON_BUTTON.STICK,
        TOGGLE_PAUSE: TYPE === 'left' ? LEFT_JOYCON_BUTTON.MINUS : RIGHT_JOYCON_BUTTON.PLUS,
        TOGGLE_HELP: TYPE === 'left' ? LEFT_JOYCON_BUTTON.SCREENSHOT : RIGHT_JOYCON_BUTTON.HOME
    };

    const haveEvents = 'ongamepadconnected' in window;

    const controllers: GamePadControllers = {};
    let cooldownedButtons: string[] = [];

    /** Pointer config */
    let pointing = false;
    const pointer = document.createElement('div');
    pointer.style.position = 'absolute';
    pointer.style.width = '20px';
    pointer.style.height = '20px';
    pointer.style.boxShadow = '3px 2px 2px #333';
    pointer.style.background = '#f00';
    pointer.style.top = '50%';
    pointer.style.left = '50%';
    pointer.style.zIndex = '99';
    pointer.style.borderRadius = '50%';
    pointer.style.display = 'none';
    document.body.appendChild(pointer);

    function cooldown(button: string) {
        if (cooldownedButtons.indexOf(button) < 0) {
            cooldownedButtons.push(button);

            setTimeout(() => {
                cooldownedButtons = cooldownedButtons.filter((v) => {
                    return v !== button;
                });
            }, COOLDOWN);

            return true;
        }
        return false;
    }

    function scanGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (!gamepad) {
                continue;
            }
            if (gamepad.index in controllers) {
                controllers[gamepad.index] = gamepad;
            } else {
                addGamepad(gamepad);
            }
        }
    }

    function updateStatus() {
        if (!haveEvents) {
            scanGamepads();
        }

        for (const j in controllers) {
            if (Object.prototype.hasOwnProperty.call(controllers, j)) {
                const controller = controllers[j];
                if (!controller) {
                    continue;
                }

                // handle button presses
                for (let i = 0; i < controller.buttons.length; i++) {
                    const button = controller.buttons[i];

                    let pressed = undefined;
                    if (typeof button === 'object') {
                        pressed = button.pressed;
                    }

                    if (pressed && cooldown(`button-${i}`)) {
                        handleRightJoyConButton(i);
                    }
                }

                // handle axis presses
                // - horizontal is 0
                // - vertical is 1
                for (let i = 0; i < controller.axes.length; i++) {
                    // this contains a value between -1 and 1, depending on the axis orientation
                    const axisValue = controller.axes[i];
                    if (!axisValue) {
                        // means the axis is not being used, so the value is either -0 or 0
                        continue;
                    }

                    if (Math.abs(axisValue) > 0.85 && !pointing) {
                        if (cooldown(`axis-${i}`)) {
                            switch (i) {
                                case AXIS.LOY: {
                                    if (axisValue < 0) {
                                        deck.down();
                                    } else {
                                        deck.up();
                                    }
                                    break;
                                }
                                case AXIS.LOX: {
                                    if (axisValue < 0) {
                                        deck.left();
                                    } else {
                                        deck.right();
                                    }
                                    break;
                                }
                            }
                        }
                    }

                    if (Math.abs(axisValue) > 0.2 && pointing) {
                        const left = parseInt(pointer.style.left.replace('px', ''));
                        const top = parseInt(pointer.style.top.replace('px', ''));
                        const constrainValue = (newVal: number) => {
                            return Math.min(Math.max(newVal, 0), window.innerWidth);
                        };
                        handleRightJoyConAxis(i, axisValue, left, top, constrainValue);
                    }
                }
            }
        }

        requestAnimationFrame(updateStatus);
    }

    function handleRightJoyConAxis(
        axisIndex: number,
        axis: number,
        left: number,
        top: number,
        constrainValue: Function
    ) {
        switch (axisIndex) {
            case AXIS.LOY: {
                const newVal = -axis * POINTER_SPEED + top;
                pointer.style.top = constrainValue(newVal) + 'px';
                break;
            }
            case AXIS.LOX: {
                const newVal = axis * POINTER_SPEED + left;
                pointer.style.left = constrainValue(newVal) + 'px';
                break;
            }
        }
    }

    function handleRightJoyConButton(button: number) {
        console.log(button);
        switch (button) {
            case ACTIONS.RIGHT:
                deck.right();
                break;
            case ACTIONS.DOWN:
                deck.down();
                break;
            case ACTIONS.UP:
                deck.up();
                break;
            case ACTIONS.LEFT:
                deck.left();
                break;
            case ACTIONS.PREV:
                deck.prev();
                break;
            case ACTIONS.NEXT:
                deck.next();
                break;
            case ACTIONS.TOGGLE_OVERVIEW:
                deck.toggleOverview();
                break;
            case ACTIONS.QUIT_OVERVIEW_OR_NEXT:
                if (deck.isOverview()) {
                    deck.toggleOverview();
                } else {
                    deck.next();
                }
                break;
            case ACTIONS.TOGGLE_PAUSE:
                deck.togglePause();
                break;
            case ACTIONS.TOGGLE_POINTING:
                pointing = !pointing;
                pointer.style.display = pointing ? 'block' : 'none';
                break;
            case ACTIONS.TOGGLE_HELP:
                deck.toggleHelp();
                break;
            default:
                console.log('Button not mapped :', button);
        }
    }

    function addGamepad(gamepad: Gamepad) {
        controllers[gamepad.index] = gamepad;
        requestAnimationFrame(updateStatus);
    }

    function removeGamepad(gamepad: Gamepad) {
        delete controllers[gamepad.index];
    }

    function connecthandler(e: GamepadEvent) {
        addGamepad(e.gamepad);
        console.log(`🎮 Gamepad ${e.gamepad.index} connected ⚡`);
    }

    function disconnecthandler(e: GamepadEvent) {
        removeGamepad(e.gamepad);
        console.log(`🎮 Gamepad ${e.gamepad.index} disconnected 🔌`);
    }

    window.addEventListener('gamepadconnected', connecthandler);
    window.addEventListener('gamepaddisconnected', disconnecthandler);

    if (!haveEvents) {
        setInterval(scanGamepads, 500);
    }
};

export default () => ({
    id: 'joycon-plugin',
    init
});
