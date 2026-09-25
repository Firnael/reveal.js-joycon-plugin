/**
 * Talk to the Joy Con directly over WebHID (Chrome only).
 *
 * Why: on macOS, a lone Joy Con is a "micro gamepad" for Apple's GameController layer, and Chrome / Safari don't
 * expose those through the Gamepad API. WebHID reads the Joy Con's own reports, like Firefox does, and it is also the
 * only way to get the motion sensors (the gyroscope drives the laser pointer).
 *
 * Protocol reference: https://github.com/dekuNukem/Nintendo_Switch_Reverse_Engineering
 * (bluetooth_hid_notes.md, bluetooth_hid_subcommands_notes.md, imu_sensor_notes.md)
 */

/** Minimal WebHID typings (not in TypeScript's DOM lib) */
interface HIDDeviceLike extends EventTarget {
    opened: boolean;
    vendorId: number;
    productId: number;
    productName: string;
    open(): Promise<void>;
    sendReport(reportId: number, data: Uint8Array): Promise<void>;
}
interface HIDInputReportEventLike extends Event {
    data: DataView;
    reportId: number;
}
interface HIDConnectionEventLike extends Event {
    device: HIDDeviceLike;
}
interface HIDLike extends EventTarget {
    getDevices(): Promise<HIDDeviceLike[]>;
    requestDevice(options: { filters: { vendorId: number; productId?: number }[] }): Promise<HIDDeviceLike[]>;
}

const NINTENDO_VENDOR_ID = 0x057e;
const JOYCON_LEFT = 0x2006;
const JOYCON_RIGHT = 0x2007;

const NEUTRAL_RUMBLE = [0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40];
const SUBCOMMAND = {
    SET_INPUT_REPORT_MODE: 0x03,
    SET_PLAYER_LIGHTS: 0x30,
    ENABLE_IMU: 0x40
};
const REPORT = {
    SUBCOMMAND_REPLY: 0x21,
    STANDARD_FULL: 0x30,
    SIMPLE_HID: 0x3f
};

/** uncalibrated conversion for the default ±2000 dps range; the laser removes the offset itself */
const GYRO_DPS_PER_DIGIT = 0.06103;
/** the Joy Con sends 3 motion samples per report, 5 ms apart */
const IMU_SAMPLE_DT = 0.005;
/** in full mode the Joy Con reports at 60 Hz: silence this long means the mode was lost (sleep, reconnect) */
const FULL_MODE_TIMEOUT_MS = 1500;

/**
 * Buttons are translated to the "raw" layout (bit order of the simple HID report, the one Firefox exposes),
 * so the plugin handles every source with the same mapping.
 * [byte in the full 0x30 report, bit mask, raw index]
 */
const FULL_REPORT_BUTTONS: [number, number, number][] = [
    // right Joy Con (byte 3)
    [3, 0x08, 0], // A
    [3, 0x02, 1], // X
    [3, 0x04, 2], // B
    [3, 0x01, 3], // Y
    [3, 0x20, 4], // SL
    [3, 0x10, 5], // SR
    [3, 0x40, 14], // R
    [3, 0x80, 15], // ZR
    // shared (byte 4)
    [4, 0x01, 8], // minus
    [4, 0x02, 9], // plus
    [4, 0x04, 11], // right stick press
    [4, 0x08, 10], // left stick press
    [4, 0x10, 12], // home
    [4, 0x20, 13], // capture
    // left Joy Con (byte 5)
    [5, 0x01, 0], // down
    [5, 0x04, 1], // right
    [5, 0x08, 2], // left
    [5, 0x02, 3], // up
    [5, 0x20, 4], // SL
    [5, 0x10, 5], // SR
    [5, 0x40, 14], // L
    [5, 0x80, 15] // ZL
];

export type Side = 'left' | 'right';

export type HIDPad = {
    key: string;
    name: string;
    side: Side;
    buttons: boolean[];
    /** performance.now() of the last report of any kind */
    lastReport: number;
    hz: number;
};

export type HIDDebug = {
    name: string;
    mode: string;
    hz: number;
    battery: string;
    gyro: [number, number, number];
    buttons: boolean[];
};

type GyroListener = (gyro: [number, number, number], dt: number, side: Side) => void;

class JoyCon {
    readonly device: HIDDeviceLike;
    readonly key: string;
    readonly side: Side;
    buttons: boolean[] = new Array(16).fill(false);
    gyro: [number, number, number] = [0, 0, 0];
    battery = '?';
    mode = 'starting';
    hz = 0;
    lastReport = 0;
    private packet = 0;
    private lastFullReport = 0;
    private lastInit = 0;
    private reportTimes: number[] = [];
    private readonly onGyro: GyroListener;
    private readonly log: (message: string) => void;

    constructor(device: HIDDeviceLike, onGyro: GyroListener, log: (message: string) => void) {
        this.device = device;
        this.key = `hid:${device.productId.toString(16)}:${device.productName}`;
        this.side = device.productId === JOYCON_LEFT ? 'left' : 'right';
        this.onGyro = onGyro;
        this.log = log;
        this.onReport = this.onReport.bind(this);
    }

    async start() {
        this.device.addEventListener('inputreport', this.onReport as EventListener);
        await this.init();
    }

    stop() {
        this.device.removeEventListener('inputreport', this.onReport as EventListener);
    }

    /** (re)send the setup: motion sensors on, full report mode, player light 1 as a "connected" sign */
    async init() {
        this.lastInit = performance.now();
        try {
            if (!this.device.opened) {
                await this.device.open();
            }
            await this.subcommand(SUBCOMMAND.ENABLE_IMU, [0x01]);
            await wait(50);
            await this.subcommand(SUBCOMMAND.SET_INPUT_REPORT_MODE, [REPORT.STANDARD_FULL]);
            await wait(50);
            await this.subcommand(SUBCOMMAND.SET_PLAYER_LIGHTS, [0x01]);
        } catch (error) {
            this.log(`🎮 WebHID setup failed for ${this.device.productName}: ${error}`);
        }
    }

    /** called every second: if the full reports stopped (sleep, mode reset), send the setup again */
    async watchdog() {
        const now = performance.now();
        if (now - this.lastFullReport > FULL_MODE_TIMEOUT_MS && now - this.lastInit > FULL_MODE_TIMEOUT_MS) {
            this.mode = 'no full reports, re-sending setup';
            this.log(`🎮 WebHID ${this.device.productName}: no full reports, re-sending setup`);
            await this.init();
        }
        this.reportTimes = this.reportTimes.filter((t) => now - t < 1000);
        this.hz = this.reportTimes.length;
    }

    private async subcommand(id: number, args: number[]) {
        const data = [this.packet++ & 0x0f, ...NEUTRAL_RUMBLE, id, ...args];
        await this.device.sendReport(0x01, new Uint8Array(data));
    }

    private onReport(event: HIDInputReportEventLike) {
        // put the report id back in front, so offsets match the protocol notes
        const bytes = new Uint8Array(event.data.byteLength + 1);
        bytes[0] = event.reportId;
        bytes.set(new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength), 1);
        this.lastReport = performance.now();

        if (event.reportId === REPORT.SIMPLE_HID) {
            // simple mode: 2 bytes of buttons, already in raw bit order
            const bits = bytes[1]! | (bytes[2]! << 8);
            this.buttons = this.buttons.map((_, i) => (bits & (1 << i)) !== 0);
            this.mode = 'simple (no motion)';
            return;
        }

        if (event.reportId !== REPORT.STANDARD_FULL && event.reportId !== REPORT.SUBCOMMAND_REPLY) {
            return;
        }

        const buttons: boolean[] = new Array(16).fill(false);
        for (const [byte, mask, index] of FULL_REPORT_BUTTONS) {
            if (bytes[byte]! & mask) {
                buttons[index] = true;
            }
        }
        this.buttons = buttons;
        // high nibble of byte 2: level in its top 3 bits, charging flag in its lowest bit
        const level = ['empty', 'critical', 'low', 'medium', 'full'][bytes[2]! >> 5] ?? '?';
        this.battery = bytes[2]! & 0x10 ? `${level} (charging)` : level;

        if (event.reportId === REPORT.STANDARD_FULL) {
            this.lastFullReport = performance.now();
            this.reportTimes.push(this.lastFullReport);
            this.mode = 'full (motion on)';
            const view = new DataView(bytes.buffer);
            for (let sample = 0; sample < 3; sample++) {
                const offset = 19 + sample * 12;
                this.gyro = [
                    view.getInt16(offset, true) * GYRO_DPS_PER_DIGIT,
                    view.getInt16(offset + 2, true) * GYRO_DPS_PER_DIGIT,
                    view.getInt16(offset + 4, true) * GYRO_DPS_PER_DIGIT
                ];
                this.onGyro(this.gyro, IMU_SAMPLE_DT, this.side);
            }
        }
    }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isJoyCon = (device: HIDDeviceLike) =>
    device.vendorId === NINTENDO_VENDOR_ID && (device.productId === JOYCON_LEFT || device.productId === JOYCON_RIGHT);

export function createHIDSource(onGyro: GyroListener, log: (message: string) => void) {
    const hid = (navigator as unknown as { hid?: HIDLike }).hid;
    const joycons = new Map<HIDDeviceLike, JoyCon>();

    async function attach(device: HIDDeviceLike) {
        if (!isJoyCon(device) || joycons.has(device)) {
            return;
        }
        const joycon = new JoyCon(device, onGyro, log);
        joycons.set(device, joycon);
        log(`🎮 WebHID ${device.productName} attached ⚡`);
        await joycon.start();
    }

    function detach(device: HIDDeviceLike) {
        const joycon = joycons.get(device);
        if (joycon) {
            joycon.stop();
            joycons.delete(device);
            log(`🎮 WebHID ${device.productName} detached 🔌`);
        }
    }

    if (hid) {
        // devices granted before (Chrome remembers the permission per origin) come back on their own
        hid.getDevices().then((devices) => devices.forEach(attach));
        hid.addEventListener('connect', (e) => attach((e as HIDConnectionEventLike).device));
        hid.addEventListener('disconnect', (e) => detach((e as HIDConnectionEventLike).device));
        setInterval(() => joycons.forEach((joycon) => joycon.watchdog()), 1000);
    }

    return {
        supported: !!hid,

        /** opens Chrome's device picker: must run from a user gesture (click, key press) */
        async connect() {
            if (!hid) {
                log('🎮 WebHID not available in this browser');
                return;
            }
            const devices = await hid.requestDevice({ filters: [{ vendorId: NINTENDO_VENDOR_ID }] });
            devices.forEach(attach);
        },

        pads(): HIDPad[] {
            return Array.from(joycons.values()).map((j) => ({
                key: j.key,
                name: j.device.productName,
                side: j.side,
                buttons: j.buttons,
                lastReport: j.lastReport,
                hz: j.hz
            }));
        },

        debug(): HIDDebug[] {
            return Array.from(joycons.values()).map((j) => ({
                name: j.device.productName,
                mode: j.mode,
                hz: j.hz,
                battery: j.battery,
                gyro: j.gyro,
                buttons: j.buttons
            }));
        }
    };
}
