/**
 * A small permanent indicator, bottom left: is the plugin loaded, and is the Joy Con really talking?
 *
 * - grey: plugin loaded, no controller yet
 * - green, pulsing on reports: connected and reports arriving (WebHID streams ~60 reports / s)
 * - orange: connected but silent for a while (WebHID only: the Gamepad API sends nothing between presses)
 * - red: the controller was there, and is gone
 */

export type StatusPad = {
    name: string;
    source: 'WebHID' | 'Gamepad API';
    /** performance.now() of the last report (WebHID only) */
    lastReport?: number;
    hz?: number;
};

type State = 'idle' | 'live' | 'silent' | 'connected' | 'lost';

const COLORS: Record<State, string> = {
    idle: '#9a9a9a',
    live: '#3ddc84',
    connected: '#3ddc84',
    silent: '#ff9f1a',
    lost: '#ff3b3b'
};

/** WebHID streams continuously: this much silence means the link is up but nothing arrives */
const SILENT_AFTER_MS = 1000;
/** one visible pulse at most this often, so the heartbeat reads as a blink, not a blur */
const PULSE_EVERY_MS = 250;

export function createStatus(visibleAtStart: boolean) {
    let visible = visibleAtStart;
    const box = document.createElement('div');
    Object.assign(box.style, {
        position: 'fixed',
        left: '12px',
        bottom: '8px',
        zIndex: '100',
        display: visible ? 'flex' : 'none',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '12px',
        background: 'rgba(0, 0, 0, 0.35)',
        fontSize: '16px',
        lineHeight: '1',
        opacity: '0.7',
        cursor: 'default',
        userSelect: 'none'
    });
    const icon = document.createElement('span');
    icon.textContent = '🎮';
    const dot = document.createElement('span');
    Object.assign(dot.style, {
        width: '9px',
        height: '9px',
        borderRadius: '50%',
        transition: 'transform 0.12s, box-shadow 0.12s'
    });
    // our own hover label (the native title tooltip proved unreliable)
    const label = document.createElement('span');
    Object.assign(label.style, {
        display: 'none',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#fff',
        whiteSpace: 'pre'
    });
    box.append(icon, dot, label);
    box.addEventListener('mouseenter', () => {
        label.style.display = 'inline';
        box.style.opacity = '1';
    });
    box.addEventListener('mouseleave', () => {
        label.style.display = 'none';
        box.style.opacity = '0.7';
    });
    document.body.appendChild(box);

    let everConnected = false;
    let lastPulse = 0;
    let lastState: State | undefined;

    function pulse() {
        dot.style.transform = 'scale(1.5)';
        dot.style.boxShadow = `0 0 8px 2px ${COLORS.live}`;
        setTimeout(() => {
            dot.style.transform = 'scale(1)';
            dot.style.boxShadow = 'none';
        }, 120);
    }

    return {
        /** once per frame, with every pad currently seen */
        toggle() {
            visible = !visible;
            box.style.display = visible ? 'flex' : 'none';
            lastState = undefined; // repaint on the next update
        },

        update(pads: StatusPad[]) {
            if (!visible) {
                return;
            }
            const now = performance.now();
            let state: State;
            if (pads.length === 0) {
                state = everConnected ? 'lost' : 'idle';
            } else {
                everConnected = true;
                const hid = pads.filter((p) => p.source === 'WebHID');
                const freshest = Math.max(...hid.map((p) => p.lastReport ?? 0));
                if (hid.length === 0) {
                    state = 'connected';
                } else if (now - freshest < SILENT_AFTER_MS) {
                    state = 'live';
                    if (freshest > lastPulse + PULSE_EVERY_MS) {
                        lastPulse = freshest;
                        pulse();
                    }
                } else {
                    state = 'silent';
                }
            }

            if (state !== lastState) {
                lastState = state;
                dot.style.background = COLORS[state];
                icon.style.filter = state === 'idle' || state === 'lost' ? 'grayscale(1)' : 'none';
            }
            const text = pads.length
                ? pads.map((p) => `${p.name} · ${p.source}${p.hz !== undefined ? ` · ~${Math.round(p.hz / 10) * 10} reports/s` : ''}`).join('\n')
                : state === 'lost'
                  ? 'Joy Con lost: press any button on it to wake it up'
                  : 'Joy Con plugin loaded, no controller yet';
            if (text !== label.textContent) {
                label.textContent = text;
            }
        }
    };
}
