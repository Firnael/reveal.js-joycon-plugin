/**
 * A laser pointer driven by the Joy Con's gyroscope: hold the stick press, point, the dot follows your wrist.
 *
 * - the dot starts at the center of the screen on every press, so gyroscope drift never builds up
 * - the gyroscope's resting offset is learned whenever the Joy Con is still (no calibration step)
 * - a small dead zone and some smoothing hide hand tremor
 */

type Side = 'left' | 'right';

/** which gyroscope axis (0, 1, 2) turns the tip left / right (yaw) and up / down (pitch), held like a remote */
export type LaserAxes = {
    yawAxis: number;
    pitchAxis: number;
    invertX: boolean;
    invertY: boolean;
};

export type LaserConfig = {
    /** degrees of wrist rotation to sweep the whole screen width */
    fov: number;
    left: LaserAxes;
    right: LaserAxes;
};

export const DEFAULT_LASER_CONFIG: LaserConfig = {
    fov: 30,
    // measured on a real left Joy Con: tip left = axis 2 positive, tip up = axis 1 negative
    left: { yawAxis: 2, pitchAxis: 1, invertX: true, invertY: false },
    // TODO verify on a real right Joy Con (one axis is said to be reversed between the two)
    right: { yawAxis: 2, pitchAxis: 1, invertX: true, invertY: false }
};

/** rotation speeds under this are treated as tremor / noise (degrees per second) */
const DEAD_ZONE_DPS = 1.5;
/** display smoothing per frame (1 = raw, lower = smoother but laggier) */
const SMOOTHING = 0.65;
/** a window of samples is "still" if no axis moves more than this (degrees per second) */
const STILL_SPREAD_DPS = 3;
const STILL_WINDOW = 50; // samples, 5 ms each: 0.25 s
const BIAS_LEARNING_RATE = 0.05;

export function createLaser(config: LaserConfig) {
    const dot = document.createElement('div');
    Object.assign(dot.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '18px',
        height: '18px',
        marginLeft: '-9px',
        marginTop: '-9px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, #fff 0%, #ff2a2a 35%, rgba(255, 0, 0, 0.6) 60%, rgba(255, 0, 0, 0) 72%)',
        boxShadow: '0 0 14px 6px rgba(255, 0, 0, 0.55)',
        pointerEvents: 'none',
        zIndex: '101',
        display: 'none'
    });
    document.body.appendChild(dot);

    let active = false;
    const target = { x: 0, y: 0 };
    const shown = { x: 0, y: 0 };
    const bias: [number, number, number] = [0, 0, 0];
    const window_: [number, number, number][] = [];

    function learnBias(gyro: [number, number, number]) {
        window_.push(gyro);
        if (window_.length > STILL_WINDOW) {
            window_.shift();
        }
        if (window_.length < STILL_WINDOW) {
            return;
        }
        for (let axis = 0; axis < 3; axis++) {
            const values = window_.map((g) => g[axis]!);
            if (Math.max(...values) - Math.min(...values) > STILL_SPREAD_DPS) {
                return; // moving: keep the current offset
            }
        }
        for (let axis = 0; axis < 3; axis++) {
            const mean = window_.reduce((sum, g) => sum + g[axis]!, 0) / window_.length;
            bias[axis] = bias[axis]! + (mean - bias[axis]!) * BIAS_LEARNING_RATE;
        }
    }

    function deadZone(rate: number) {
        return Math.sign(rate) * Math.max(Math.abs(rate) - DEAD_ZONE_DPS, 0);
    }

    return {
        /** every gyroscope sample, laser on or off (off, it keeps learning the resting offset) */
        feed(gyro: [number, number, number], dt: number, side: Side) {
            learnBias(gyro);
            if (!active) {
                return;
            }
            const axes = config[side];
            const pxPerDegree = window.innerWidth / config.fov;
            const yaw = deadZone(gyro[axes.yawAxis]! - bias[axes.yawAxis]!);
            const pitch = deadZone(gyro[axes.pitchAxis]! - bias[axes.pitchAxis]!);
            target.x += (axes.invertX ? -1 : 1) * yaw * dt * pxPerDegree;
            target.y += (axes.invertY ? -1 : 1) * pitch * dt * pxPerDegree;
            target.x = Math.min(Math.max(target.x, 0), window.innerWidth);
            target.y = Math.min(Math.max(target.y, 0), window.innerHeight);
        },

        setActive(on: boolean) {
            if (on && !active) {
                target.x = shown.x = window.innerWidth / 2;
                target.y = shown.y = window.innerHeight / 2;
                dot.style.display = 'block';
            }
            if (!on && active) {
                dot.style.display = 'none';
            }
            active = on;
        },

        /** once per frame */
        render() {
            if (!active) {
                return;
            }
            shown.x += (target.x - shown.x) * SMOOTHING;
            shown.y += (target.y - shown.y) * SMOOTHING;
            dot.style.transform = `translate(${shown.x}px, ${shown.y}px)`;
        },

        debug() {
            return { active, bias: [...bias] as [number, number, number] };
        }
    };
}
