import type { Api, Options } from 'reveal.js';

const DEFAULT_CONFIG = {
    type: 'right',
    cooldown: 300,
    pointerSpeed: 20,
    enableStick: false,
    statusIndicator: true
};

interface JoyConPluginOptions extends Options {
    joycon: {
        type: string | undefined;
        cooldown: number | undefined;
        pointerSpeed: number | undefined;
        enableStick: boolean | undefined;
        statusIndicator: boolean | undefined;
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
 * - 'raw': the bit position in the Joy Con's own HID input report (Firefox reads that, and so would WebHID)
 */
type Layout = 'browser' | 'raw';

const RIGHT_JOYCON_BUTTON = {
    browser: { A: 0, X: 1, B: 2, Y: 3, SL: 4, SR: 5, ZR: 7, R: 8, PLUS: 9, STICK: 10, HOME: 16 },
    raw: { A: 0, X: 1, B: 2, Y: 3, SL: 4, SR: 5, PLUS: 9, STICK: 11, HOME: 12, R: 14, ZR: 15 }
};

const LEFT_JOYCON_BUTTON = {
    browser: { DLEFT: 0, DBOTTOM: 1, DUP: 2, DRIGHT: 3, SL: 4, SR: 5, ZL: 6, L: 8, MINUS: 9, STICK: 10, SCREENSHOT: 16 },
    // TODO verify on a real left Joy Con (taken from the Joy Con reverse engineering notes, not tested yet)
    raw: { DLEFT: 0, DBOTTOM: 1, DUP: 2, DRIGHT: 3, SL: 4, SR: 5, MINUS: 8, STICK: 10, SCREENSHOT: 13, L: 14, ZL: 15 }
};

/** Firefox exposes the raw HID device, and names it "vendor-product-name" (e.g. "057e-2007-Joy-Con (R)") */
function layoutOf(gamepad: Gamepad): Layout {
    return /^[0-9a-f]{4}-[0-9a-f]{4}-/i.test(gamepad.id) ? 'raw' : 'browser';
}

const AXIS = {
    LOY: 0,
    LOX: 1,
    ROY: 2,
    ROX: 3
};

const STICK_NAV_THRESHOLD = 0.85;
const POINTER_THRESHOLD = 0.2;

const init = (deck: Api) => {
    const config = deck.getConfig() as JoyConPluginOptions;
    console.log('Joy Con plugin loaded', config.joycon || {});

    const TYPE = config.joycon?.type || DEFAULT_CONFIG.type;
    const COOLDOWN = config.joycon?.cooldown || DEFAULT_CONFIG.cooldown;
    const POINTER_SPEED = config.joycon?.pointerSpeed || DEFAULT_CONFIG.pointerSpeed;
    const ENABLE_STICK = config.joycon?.enableStick ?? DEFAULT_CONFIG.enableStick;
    const STATUS_INDICATOR = config.joycon?.statusIndicator ?? DEFAULT_CONFIG.statusIndicator;
    const actionsFor = (layout: Layout) => {
        const left = LEFT_JOYCON_BUTTON[layout];
        const right = RIGHT_JOYCON_BUTTON[layout];
        return {
            RIGHT: TYPE === 'left' ? left.DRIGHT : right.A,
            LEFT: TYPE === 'left' ? left.DLEFT : right.Y,
            UP: TYPE === 'left' ? left.DUP : right.X,
            DOWN: TYPE === 'left' ? left.DBOTTOM : right.B,
            PREV: TYPE === 'left' ? left.SL : right.SL,
            NEXT: TYPE === 'left' ? left.SR : right.SR,
            QUIT_OVERVIEW_OR_NEXT: TYPE === 'left' ? left.ZL : right.ZR,
            TOGGLE_OVERVIEW: TYPE === 'left' ? left.L : right.R,
            TOGGLE_POINTING: TYPE === 'left' ? left.STICK : right.STICK,
            TOGGLE_PAUSE: TYPE === 'left' ? left.MINUS : right.PLUS,
            TOGGLE_HELP: TYPE === 'left' ? left.SCREENSHOT : right.HOME
        };
    };
    const ACTIONS_BY_LAYOUT = { browser: actionsFor('browser'), raw: actionsFor('raw') };

    /**
     * Robustness rules (Bluetooth drops, Mac sleep):
     * - we poll navigator.getGamepads() every frame and never keep a Gamepad object around,
     *   so a reconnect is picked up whatever the browser's connect/disconnect events did
     * - an action fires on the press edge only (released -> pressed), never while held,
     *   so a button frozen "pressed" by a dropped link cannot fire over and over
     * - a pad seen for the first time (or again after a drop) is baselined silently,
     *   so the press that wakes it up does not skip a slide
     */
    const pads = new Map<string, PadState>();
    const lastFired = new Map<string, number>();

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

    function padKey(gamepad: Gamepad) {
        return `${gamepad.index}:${gamepad.id}`;
    }

    function snapshot(gamepad: Gamepad): PadState {
        return {
            buttons: gamepad.buttons.map((b) => b.pressed),
            axes: gamepad.axes.map((a) => Math.abs(a) > STICK_NAV_THRESHOLD)
        };
    }

    function connectedPads(): Gamepad[] {
        const list = navigator.getGamepads ? navigator.getGamepads() : [];
        return Array.from(list).filter((g): g is Gamepad => !!g && g.connected);
    }

    function poll() {
        const seen = new Set<string>();

        for (const gamepad of connectedPads()) {
            const key = padKey(gamepad);
            seen.add(key);
            const previous = pads.get(key);
            const current = snapshot(gamepad);
            pads.set(key, current);

            if (!previous) {
                // new or reconnected pad: baseline only, no action on this frame
                console.log(`🎮 Gamepad ${key} connected ⚡`);
                showStatus(true);
                continue;
            }

            // buttons: fire on the press edge only
            current.buttons.forEach((pressed, i) => {
                if (pressed && !previous.buttons[i] && cooldown(`button-${i}`)) {
                    handleButton(i, ACTIONS_BY_LAYOUT[layoutOf(gamepad)]);
                }
            });

            // axes: stick navigation on the threshold-crossing edge, pointer while held
            gamepad.axes.forEach((axisValue, i) => {
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

    function handleButton(button: number, ACTIONS: ReturnType<typeof actionsFor>) {
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

    // after sleep or a hidden tab, start from a clean slate: every pad is re-baselined
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            pads.clear();
        }
    });

    // events are only a hint to log; the polling loop is the source of truth
    window.addEventListener('gamepadconnected', (e) => console.log(`🎮 gamepadconnected event (${e.gamepad.id})`));
    window.addEventListener('gamepaddisconnected', (e) => console.log(`🎮 gamepaddisconnected event (${e.gamepad.id})`));

    // one loop for the plugin's whole life, whatever connects or disconnects
    requestAnimationFrame(poll);
};

export default () => ({
    id: 'joycon-plugin',
    init
});
