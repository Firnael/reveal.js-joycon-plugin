/** This file is for testing the plugin using Vite: everything shows up on the page, not only in the console */
import Plugin from './src/plugin';

const $ = (id) => document.getElementById(id);
const t0 = performance.now();
const stamp = () => ((performance.now() - t0) / 1000).toFixed(2).padStart(7) + 's';

function append(logId, text) {
    const line = document.createElement('div');
    line.className = 'flash';
    line.innerHTML = `<span class="t">${stamp()}</span> ${text}`;
    $(logId).prepend(line);
}

document.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => ($(b.dataset.clear).innerHTML = '')));

/**
 * Mirror the plugin's console messages (load, connect, disconnect, unmapped button) into the events log
 */
const originalLog = console.log.bind(console);
console.log = (...args) => {
    originalLog(...args);
    const text = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    append('events', `<b>plugin</b> ${text}`);
};

document.addEventListener('visibilitychange', () => append('events', `page ${document.visibilityState} (sleep or tab switch)`));

/**
 * Mock the Reveal API: a fake deck with an h.v slide index, so "one press = one move" is visible at a glance
 */
const slide = { h: 0, v: 0, overview: false, paused: false, help: false };

function render(action) {
    $('slide').textContent = `${slide.h}.${slide.v}`;
    $('flags').textContent = [slide.overview && 'overview', slide.paused && 'paused', slide.help && 'help']
        .filter(Boolean)
        .join(' · ');
    append('actions', action);
}

const RevealMock = {
    left: () => { slide.h = Math.max(0, slide.h - 1); slide.v = 0; render('left'); },
    right: () => { slide.h++; slide.v = 0; render('right'); },
    up: () => { slide.v = Math.max(0, slide.v - 1); render('up'); },
    down: () => { slide.v++; render('down'); },
    next: () => { slide.v++; render('next'); },
    prev: () => { slide.v > 0 ? slide.v-- : (slide.h = Math.max(0, slide.h - 1)); render('prev'); },
    isOverview: () => slide.overview,
    toggleOverview: () => { slide.overview = !slide.overview; render('toggleOverview'); },
    togglePause: () => { slide.paused = !slide.paused; render('togglePause'); },
    toggleHelp: () => { slide.help = !slide.help; render('toggleHelp'); },
    getConfig: () => {
        return {
            joycon: {
                type: 'right',
                cooldown: 200,
                pointerSpeed: 25
            }
        };
    }
};

/**
 * Raw gamepad view, polled on its own, independently of the plugin (tells OS issues from plugin issues)
 */
const BUTTON_NAMES = {
    browser: {
        right: { 0: 'A', 1: 'X', 2: 'B', 3: 'Y', 4: 'SL', 5: 'SR', 7: 'ZR', 8: 'R', 9: '+', 10: 'STICK', 16: 'HOME' },
        left: { 0: '◀', 1: '▼', 2: '▲', 3: '▶', 4: 'SL', 5: 'SR', 6: 'ZL', 8: 'L', 9: '−', 10: 'STICK', 16: 'CAPTURE' }
    },
    // raw HID bit order (Firefox); left side not verified on a real left Joy Con yet
    raw: {
        right: { 0: 'A', 1: 'X', 2: 'B', 3: 'Y', 4: 'SL', 5: 'SR', 9: '+', 11: 'STICK', 12: 'HOME', 14: 'R', 15: 'ZR' },
        left: { 0: '▼', 1: '▶', 2: '◀', 3: '▲', 4: 'SL', 5: 'SR', 8: '−', 10: 'STICK', 13: 'CAPTURE', 14: 'L', 15: 'ZL' }
    }
};
const known = new Map(); // pad key -> last "connected" flag, to log changes only

function renderPad(pad) {
    const layout = /^[0-9a-f]{4}-[0-9a-f]{4}-/i.test(pad.id) ? BUTTON_NAMES.raw : BUTTON_NAMES.browser;
    const names = /\(L\)|left/i.test(pad.id) ? layout.left : layout.right;
    const buttons = pad.buttons
        .map((b, i) => `<div class="btn ${b.pressed ? 'on' : ''}">${names[i] ?? '·'}<small>#${i}</small></div>`)
        .join('');
    const axes = pad.axes
        .map((a, i) => {
            const width = Math.abs(a) * 50;
            const left = a < 0 ? 50 - width : 50;
            return `<div class="axis">axis ${i}: ${a.toFixed(2)}<div class="bar"><span style="left:${left}%;width:${width}%"></span></div></div>`;
        })
        .join('');
    return `<div class="pad">
        <div class="pad-title">${pad.id}<span class="badge ${pad.connected ? '' : 'off'}">${pad.connected ? 'connected' : 'disconnected'}</span></div>
        <div class="buttons">${buttons}</div>
        <div class="axes">${axes}</div>
    </div>`;
}

function renderPads() {
    const pads = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean);

    const keys = new Set();
    for (const pad of pads) {
        const key = `${pad.index}:${pad.id}`;
        keys.add(key);
        if (known.get(key) !== pad.connected) {
            append('events', `<b>browser</b> sees pad ${key} (connected: ${pad.connected})`);
            known.set(key, pad.connected);
        }
    }
    for (const key of Array.from(known.keys())) {
        if (!keys.has(key)) {
            append('events', `<b>browser</b> lost pad ${key}`);
            known.delete(key);
        }
    }

    $('pads').innerHTML = pads.length
        ? pads.map(renderPad).join('')
        : '<p class="empty">No gamepad: press a button on the Joy Con (or it is disconnected).</p>';

    requestAnimationFrame(renderPads);
}

requestAnimationFrame(renderPads);

const plugin = Plugin();
plugin.init(RevealMock);

/**
 * WebHID panel + live gyroscope (from the plugin's debug state)
 */
$('hid-connect').addEventListener('click', () =>
    plugin.connectHID().catch((error) => append('events', `WebHID connect cancelled: ${error}`))
);
if (!navigator.hid) {
    $('hid-connect').disabled = true;
    $('hid').innerHTML = '<p class="empty">WebHID is not available in this browser (Chrome only).</p>';
}

const GYRO_RANGE_DPS = 200;

let laserWasActive = false;

function renderHID() {
    const { hid = [], laser } = plugin.debug();
    // the laser is not a slide action: log its on / off edges in the plugin's action log
    if (laser && laser.active !== laserWasActive) {
        laserWasActive = laser.active;
        append('actions', laser.active ? 'laser on 🔴' : 'laser off');
    }
    if (navigator.hid) {
        $('hid').innerHTML = hid.length
            ? hid
                  .map((j) => {
                      const names = /\(L\)/.test(j.name) ? BUTTON_NAMES.raw.left : BUTTON_NAMES.raw.right;
                      const buttons = j.buttons
                          .map((pressed, i) => (names[i] ? `<div class="btn ${pressed ? 'on' : ''}">${names[i]}<small>#${i}</small></div>` : ''))
                          .join('');
                      return `<div class="kv">
                          <span>device</span><span>${j.name}</span>
                          <span>mode</span><span>${j.mode}</span>
                          <span>reports</span><span>${j.hz} / s</span>
                          <span>battery</span><span>${j.battery}</span>
                          <span>laser</span><span>${laser.active ? '🔴 on' : 'off (hold the stick press)'}</span>
                      </div><div class="buttons">${buttons}</div>`;
                  })
                  .join('')
            : '<p class="empty">No WebHID Joy Con: click the button above and pick it.</p>';
    }

    const gyro = hid[0]?.gyro ?? [0, 0, 0];
    $('gyro').innerHTML = gyro
        .map((value, axis) => {
            const rate = value - (laser?.bias[axis] ?? 0);
            const width = Math.min(Math.abs(rate) / GYRO_RANGE_DPS, 1) * 50;
            const left = rate < 0 ? 50 - width : 50;
            return `<div class="gyro-axis">axis ${axis}: <b>${rate >= 0 ? '+' : ''}${rate.toFixed(1)}</b>
                <span class="t">(offset ${(laser?.bias[axis] ?? 0).toFixed(1)})</span>
                <div class="bar"><span style="left:${left}%;width:${width}%"></span></div></div>`;
        })
        .join('');

    requestAnimationFrame(renderHID);
}

requestAnimationFrame(renderHID);
