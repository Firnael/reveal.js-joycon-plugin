import type { Api, Options } from 'reveal.js';
import { createHIDSource } from './webhid';
import { createLaser, DEFAULT_LASER_CONFIG, type LaserAxes } from './laser';

const DEFAULT_CONFIG = {
    type: 'right',
    cooldown: 300,
    pointerSpeed: 20,
    enableStick: false,
    statusIndicator: true,
    hidConnectKey: 'c'
};

interface JoyConPluginOptions extends Options {
    joycon: {
        type: string | undefined;
        cooldown: number | undefined;
        pointerSpeed: number | undefined;
        enableStick: boolean | undefined;
        statusIndicator: boolean | undefined;
        hidConnectKey: string | false | undefined;
        laser: { fov?: number; left?: Partial<LaserAxes>; right?: Partial<LaserAxes> } | undefined;
    };
}

/** What we remember about a pad between two frames (never the Gamepad object itself) */
type PadState = {
    buttons: boolean[];
    axes: boolean[];
};

/**
 * Button indexes depend on who reads the Joy Con:
 * - 'browser': Chrome's own gamepad mapping
 * - 'raw': the bit position in the Joy Con's own simple HID report (Firefox reads that, WebHID is translated to it)
 */
type Layout = 'browser' | 'raw';

type Side = 'left' | 'right';

/** One pad, whatever the source (Gamepad API or WebHID) */
type PadInput = {
    key: string;
    layout: Layout;
    side: Side;
    buttons: boolean[];
    axes: number[];
    hid: boolean;
};

const RIGHT_JOYCON_BUTTON = {
    browser: { A: 0, X: 1, B: 2, Y: 3, SL: 4, SR: 5, ZR: 7, R: 8, PLUS: 9, STICK: 10, HOME: 16 },
    raw: { A: 0, X: 1, B: 2, Y: 3, SL: 4, SR: 5, PLUS: 9, STICK: 11, HOME: 12, R: 14, ZR: 15 }
};

const LEFT_JOYCON_BUTTON = {
    browser: { DLEFT: 0, DBOTTOM: 1, DUP: 2, DRIGHT: 3, SL: 4, SR: 5, ZL: 6, L: 8, MINUS: 9, STICK: 10, SCREENSHOT: 16 },
    // TODO verify on a real left Joy Con (from the Joy Con reverse engineering notes, not tested yet)
    raw: { DBOTTOM: 0, DRIGHT: 1, DLEFT: 2, DUP: 3, SL: 4, SR: 5, MINUS: 8, STICK: 10, SCREENSHOT: 13, L: 14, ZL: 15 }
};

/** Firefox exposes the raw HID device, and names it "vendor-product-name" (e.g. "057e-2007-Joy-Con (R)") */
function layoutOf(gamepad: Gamepad): Layout {
    return /^[0-9a-f]{4}-[0-9a-f]{4}-/i.test(gamepad.id) ? 'raw' : 'browser';
}

const isJoyConGamepad = (gamepad: Gamepad) => /057e|joy-con/i.test(gamepad.id);

/** the Gamepad API names them "Joy-Con (L)" / "Joy-Con (R)"; unknown pads use the configured type */
const sideOf = (gamepad: Gamepad, fallback: Side): Side =>
    /\(L\)/.test(gamepad.id) ? 'left' : /\(R\)/.test(gamepad.id) ? 'right' : fallback;

const AXIS = {
    LOY: 0,
    LOX: 1,
    ROY: 2,
    ROX: 3
};

const STICK_NAV_THRESHOLD = 0.85;
const POINTER_THRESHOLD = 0.2;

export default () => {
    const plugin = {
        id: 'joycon-plugin',
        init,
        /** opens Chrome's WebHID device picker (call it from a click or a key press) */
        connectHID: async () => {},
        /** live state, for the test page */
        debug: () => ({}) as object
    };

    function init(deck: Api) {
        const config = deck.getConfig() as JoyConPluginOptions;
        console.log('Joy Con plugin loaded', config.joycon || {});

        const TYPE: Side = (config.joycon?.type || DEFAULT_CONFIG.type) === 'left' ? 'left' : 'right';
        const COOLDOWN = config.joycon?.cooldown || DEFAULT_CONFIG.cooldown;
        const POINTER_SPEED = config.joycon?.pointerSpeed || DEFAULT_CONFIG.pointerSpeed;
        const ENABLE_STICK = config.joycon?.enableStick ?? DEFAULT_CONFIG.enableStick;
        const STATUS_INDICATOR = config.joycon?.statusIndicator ?? DEFAULT_CONFIG.statusIndicator;
        const HID_CONNECT_KEY = config.joycon?.hidConnectKey ?? DEFAULT_CONFIG.hidConnectKey;
        const actionsFor = (layout: Layout, side: Side) => {
            const left = LEFT_JOYCON_BUTTON[layout];
            const right = RIGHT_JOYCON_BUTTON[layout];
            const isLeft = side === 'left';
            return {
                RIGHT: isLeft ? left.DRIGHT : right.A,
                LEFT: isLeft ? left.DLEFT : right.Y,
                UP: isLeft ? left.DUP : right.X,
                DOWN: isLeft ? left.DBOTTOM : right.B,
                PREV: isLeft ? left.SL : right.SL,
                NEXT: isLeft ? left.SR : right.SR,
                QUIT_OVERVIEW_OR_NEXT: isLeft ? left.ZL : right.ZR,
                TOGGLE_OVERVIEW: isLeft ? left.L : right.R,
                TOGGLE_POINTING: isLeft ? left.STICK : right.STICK,
                TOGGLE_PAUSE: isLeft ? left.MINUS : right.PLUS,
                TOGGLE_HELP: isLeft ? left.SCREENSHOT : right.HOME
            };
        };
        const ACTIONS = {
            browser: { left: actionsFor('browser', 'left'), right: actionsFor('browser', 'right') },
            raw: { left: actionsFor('raw', 'left'), right: actionsFor('raw', 'right') }
        };

        /**
         * Robustness rules (Bluetooth drops, Mac sleep):
         * - we poll every source every frame and never keep a Gamepad object around,
         *   so a reconnect is picked up whatever the browser's connect/disconnect events did
         * - an action fires on the press edge only (released -> pressed), never while held,
         *   so a button frozen "pressed" by a dropped link cannot fire over and over
         * - a pad seen for the first time (or again after a drop) is baselined silently,
         *   so the press that wakes it up does not skip a slide
         */
        const pads = new Map<string, PadState>();
        const lastFired = new Map<string, number>();

        /** Laser pointer (WebHID only: it needs the gyroscope): hold the stick press */
        const laserOptions = config.joycon?.laser;
        const laser = createLaser({
            fov: laserOptions?.fov ?? DEFAULT_LASER_CONFIG.fov,
            left: { ...DEFAULT_LASER_CONFIG.left, ...laserOptions?.left },
            right: { ...DEFAULT_LASER_CONFIG.right, ...laserOptions?.right }
        });
        const hid = createHIDSource(laser.feed, (message) => console.log(message));

        /** Stick pointer (Gamepad API sources): the stick press toggles it, the stick moves it */
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

        /** Connection status indicator (discreet, bottom left, hidden until a pad was seen once) */
        const status = document.createElement('div');
        status.style.position = 'fixed';
        status.style.left = '12px';
        status.style.bottom = '8px';
        status.style.zIndex = '100';
        status.style.fontSize = '22px';
        status.style.pointerEvents = 'none';
        status.style.transition = 'opacity 0.6s';
        status.style.opacity = '0';
        status.textContent = '🎮';
        document.body.appendChild(status);
        let statusTimeout: number | undefined;

        function showStatus(connected: boolean) {
            if (!STATUS_INDICATOR) {
                return;
            }
            window.clearTimeout(statusTimeout);
            status.style.filter = connected ? 'none' : 'grayscale(1)';
            status.style.textDecoration = connected ? 'none' : 'line-through red 3px';
            status.style.opacity = connected ? '0.8' : '0.5';
            if (connected) {
                // flash on (re)connect, then fade away
                statusTimeout = window.setTimeout(() => (status.style.opacity = '0'), 2000);
            }
        }

        function cooldown(key: string) {
            const now = performance.now();
            const last = lastFired.get(key);
            if (last !== undefined && now - last < COOLDOWN) {
                return false;
            }
            lastFired.set(key, now);
            return true;
        }

        /** every pad this frame: WebHID Joy Cons, plus the Gamepad API (minus the Joy Cons WebHID already reads) */
        function inputs(): PadInput[] {
            const hidPads: PadInput[] = hid
                .pads()
                .map((p) => ({ key: p.key, layout: 'raw', side: p.side, buttons: p.buttons, axes: [], hid: true }));
            const gamepads = Array.from(navigator.getGamepads ? navigator.getGamepads() : [])
                .filter((g): g is Gamepad => !!g && g.connected)
                .filter((g) => hidPads.length === 0 || !isJoyConGamepad(g))
                .map((g) => ({
                    key: `${g.index}:${g.id}`,
                    layout: layoutOf(g),
                    side: sideOf(g, TYPE),
                    buttons: g.buttons.map((b) => b.pressed),
                    axes: [...g.axes],
                    hid: false
                }));
            return [...hidPads, ...gamepads];
        }

        function poll() {
            const seen = new Set<string>();
            let laserHeld = false;

            for (const input of inputs()) {
                seen.add(input.key);
                const actions = ACTIONS[input.layout][input.side];
                const previous = pads.get(input.key);
                const current: PadState = {
                    buttons: input.buttons,
                    axes: input.axes.map((a) => Math.abs(a) > STICK_NAV_THRESHOLD)
                };
                pads.set(input.key, current);

                if (input.hid && current.buttons[actions.TOGGLE_POINTING]) {
                    laserHeld = true;
                }

                if (!previous) {
                    // new or reconnected pad: baseline only, no action on this frame
                    console.log(`🎮 Gamepad ${input.key} connected ⚡`);
                    showStatus(true);
                    continue;
                }

                // buttons: fire on the press edge only (on WebHID, the stick press is the laser, held not toggled)
                current.buttons.forEach((pressed, i) => {
                    if (input.hid && i === actions.TOGGLE_POINTING) {
                        return;
                    }
                    if (pressed && !previous.buttons[i] && cooldown(`button-${i}`)) {
                        handleButton(i, actions);
                    }
                });

                // axes: stick navigation on the threshold-crossing edge, pointer while held
                input.axes.forEach((axisValue, i) => {
                    if (ENABLE_STICK && !pointing && current.axes[i] && !previous.axes[i] && cooldown(`axis-${i}`)) {
                        handleStickNavigation(i, axisValue);
                    }
                    if (pointing && Math.abs(axisValue) > POINTER_THRESHOLD) {
                        movePointer(i, axisValue);
                    }
                });
            }

            // pads that vanished (event or not): forget them, so they get re-baselined on return
            for (const key of Array.from(pads.keys())) {
                if (!seen.has(key)) {
                    pads.delete(key);
                    console.log(`🎮 Gamepad ${key} disconnected 🔌`);
                    showStatus(false);
                }
            }

            laser.setActive(laserHeld);
            laser.render();

            requestAnimationFrame(poll);
        }

        function handleStickNavigation(axisIndex: number, axisValue: number) {
            switch (axisIndex) {
                case AXIS.LOY:
                    axisValue < 0 ? deck.down() : deck.up();
                    break;
                case AXIS.LOX:
                    axisValue < 0 ? deck.left() : deck.right();
                    break;
            }
        }

        function movePointer(axisIndex: number, axisValue: number) {
            const left = parseInt(pointer.style.left.replace('px', '')) || window.innerWidth / 2;
            const top = parseInt(pointer.style.top.replace('px', '')) || window.innerHeight / 2;
            const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
            switch (axisIndex) {
                case AXIS.LOY:
                    pointer.style.top = clamp(-axisValue * POINTER_SPEED + top, window.innerHeight) + 'px';
                    break;
                case AXIS.LOX:
                    pointer.style.left = clamp(axisValue * POINTER_SPEED + left, window.innerWidth) + 'px';
                    break;
            }
        }

        function handleButton(button: number, actions: ReturnType<typeof actionsFor>) {
            switch (button) {
                case actions.RIGHT:
                    deck.right();
                    break;
                case actions.DOWN:
                    deck.down();
                    break;
                case actions.UP:
                    deck.up();
                    break;
                case actions.LEFT:
                    deck.left();
                    break;
                case actions.PREV:
                    deck.prev();
                    break;
                case actions.NEXT:
                    deck.next();
                    break;
                case actions.TOGGLE_OVERVIEW:
                    deck.toggleOverview();
                    break;
                case actions.QUIT_OVERVIEW_OR_NEXT:
                    if (deck.isOverview()) {
                        deck.toggleOverview();
                    } else {
                        deck.next();
                    }
                    break;
                case actions.TOGGLE_PAUSE:
                    deck.togglePause();
                    break;
                case actions.TOGGLE_POINTING:
                    pointing = !pointing;
                    pointer.style.display = pointing ? 'block' : 'none';
                    break;
                case actions.TOGGLE_HELP:
                    deck.toggleHelp();
                    break;
                default:
                    console.log('Button not mapped :', button);
            }
        }

        // after sleep or a hidden tab, start from a clean slate: every pad is re-baselined
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                pads.clear();
            }
        });

        // events are only a hint to log; the polling loop is the source of truth
        window.addEventListener('gamepadconnected', (e) => console.log(`🎮 gamepadconnected event (${e.gamepad.id})`));
        window.addEventListener('gamepaddisconnected', (e) =>
            console.log(`🎮 gamepaddisconnected event (${e.gamepad.id})`)
        );

        // WebHID needs one user gesture to grant the Joy Con (Chrome remembers it afterwards): a key press is one
        if (hid.supported && HID_CONNECT_KEY) {
            document.addEventListener('keydown', (e) => {
                if (e.key === HID_CONNECT_KEY && hid.pads().length === 0) {
                    hid.connect().catch((error) => console.log(`🎮 WebHID connect cancelled: ${error}`));
                }
            });
        }

        plugin.connectHID = () => hid.connect();
        plugin.debug = () => ({ hid: hid.debug(), laser: laser.debug() });

        // one loop for the plugin's whole life, whatever connects or disconnects
        requestAnimationFrame(poll);
    }

    return plugin;
};
