var tt = Object.defineProperty;
var et = (a, o, t) => o in a ? tt(a, o, { enumerable: !0, configurable: !0, writable: !0, value: t }) : a[o] = t;
var T = (a, o, t) => (et(a, typeof o != "symbol" ? o + "" : o, t), t);
const nt = [0, 1, 64, 64, 0, 1, 64, 64], v = {
  SET_INPUT_REPORT_MODE: 3,
  SET_PLAYER_LIGHTS: 48,
  ENABLE_IMU: 64
}, D = {
  SUBCOMMAND_REPLY: 33,
  STANDARD_FULL: 48,
  SIMPLE_HID: 63
}, G = 0.06103, ot = 5e-3, K = 1500, st = [
  // right Joy Con (byte 3)
  [3, 8, 0],
  // A
  [3, 2, 1],
  // X
  [3, 4, 2],
  // B
  [3, 1, 3],
  // Y
  [3, 32, 4],
  // SL
  [3, 16, 5],
  // SR
  [3, 64, 14],
  // R
  [3, 128, 15],
  // ZR
  // shared (byte 4)
  [4, 1, 8],
  // minus
  [4, 2, 9],
  // plus
  [4, 4, 11],
  // right stick press
  [4, 8, 10],
  // left stick press
  [4, 16, 12],
  // home
  [4, 32, 13],
  // capture
  // left Joy Con (byte 5)
  [5, 1, 0],
  // down
  [5, 4, 1],
  // right
  [5, 8, 2],
  // left
  [5, 2, 3],
  // up
  [5, 32, 4],
  // SL
  [5, 16, 5],
  // SR
  [5, 64, 14],
  // L
  [5, 128, 15]
  // ZL
];
class it {
  constructor(o, t, s) {
    T(this, "device");
    T(this, "key");
    T(this, "side");
    T(this, "buttons", new Array(16).fill(!1));
    T(this, "gyro", [0, 0, 0]);
    T(this, "battery", "?");
    T(this, "mode", "starting");
    T(this, "hz", 0);
    T(this, "packet", 0);
    T(this, "lastFullReport", 0);
    T(this, "lastInit", 0);
    T(this, "reportTimes", []);
    T(this, "onGyro");
    T(this, "log");
    this.device = o, this.key = `hid:${o.productId.toString(16)}:${o.productName}`, this.side = o.productId === 8198 ? "left" : "right", this.onGyro = t, this.log = s, this.onReport = this.onReport.bind(this);
  }
  async start() {
    this.device.addEventListener("inputreport", this.onReport), await this.init();
  }
  stop() {
    this.device.removeEventListener("inputreport", this.onReport);
  }
  /** (re)send the setup: motion sensors on, full report mode, player light 1 as a "connected" sign */
  async init() {
    this.lastInit = performance.now();
    try {
      this.device.opened || await this.device.open(), await this.subcommand(v.ENABLE_IMU, [1]), await J(50), await this.subcommand(v.SET_INPUT_REPORT_MODE, [D.STANDARD_FULL]), await J(50), await this.subcommand(v.SET_PLAYER_LIGHTS, [1]);
    } catch (o) {
      this.log(`🎮 WebHID setup failed for ${this.device.productName}: ${o}`);
    }
  }
  /** called every second: if the full reports stopped (sleep, mode reset), send the setup again */
  async watchdog() {
    const o = performance.now();
    o - this.lastFullReport > K && o - this.lastInit > K && (this.mode = "no full reports, re-sending setup", this.log(`🎮 WebHID ${this.device.productName}: no full reports, re-sending setup`), await this.init()), this.reportTimes = this.reportTimes.filter((t) => o - t < 1e3), this.hz = this.reportTimes.length;
  }
  async subcommand(o, t) {
    const s = [this.packet++ & 15, ...nt, o, ...t];
    await this.device.sendReport(1, new Uint8Array(s));
  }
  onReport(o) {
    const t = new Uint8Array(o.data.byteLength + 1);
    if (t[0] = o.reportId, t.set(new Uint8Array(o.data.buffer, o.data.byteOffset, o.data.byteLength), 1), o.reportId === D.SIMPLE_HID) {
      const d = t[1] | t[2] << 8;
      this.buttons = this.buttons.map((e, h) => (d & 1 << h) !== 0), this.mode = "simple (no motion)";
      return;
    }
    if (o.reportId !== D.STANDARD_FULL && o.reportId !== D.SUBCOMMAND_REPLY)
      return;
    const s = new Array(16).fill(!1);
    for (const [d, e, h] of st)
      t[d] & e && (s[h] = !0);
    this.buttons = s;
    const u = ["empty", "critical", "low", "medium", "full"][t[2] >> 5] ?? "?";
    if (this.battery = t[2] & 16 ? `${u} (charging)` : u, o.reportId === D.STANDARD_FULL) {
      this.lastFullReport = performance.now(), this.reportTimes.push(this.lastFullReport), this.mode = "full (motion on)";
      const d = new DataView(t.buffer);
      for (let e = 0; e < 3; e++) {
        const h = 19 + e * 12;
        this.gyro = [
          d.getInt16(h, !0) * G,
          d.getInt16(h + 2, !0) * G,
          d.getInt16(h + 4, !0) * G
        ], this.onGyro(this.gyro, ot, this.side);
      }
    }
  }
}
const J = (a) => new Promise((o) => setTimeout(o, a)), rt = (a) => a.vendorId === 1406 && (a.productId === 8198 || a.productId === 8199);
function at(a, o) {
  const t = navigator.hid, s = /* @__PURE__ */ new Map();
  async function u(e) {
    if (!rt(e) || s.has(e))
      return;
    const h = new it(e, a, o);
    s.set(e, h), o(`🎮 WebHID ${e.productName} attached ⚡`), await h.start();
  }
  function d(e) {
    const h = s.get(e);
    h && (h.stop(), s.delete(e), o(`🎮 WebHID ${e.productName} detached 🔌`));
  }
  return t && (t.getDevices().then((e) => e.forEach(u)), t.addEventListener("connect", (e) => u(e.device)), t.addEventListener("disconnect", (e) => d(e.device)), setInterval(() => s.forEach((e) => e.watchdog()), 1e3)), {
    supported: !!t,
    /** opens Chrome's device picker: must run from a user gesture (click, key press) */
    async connect() {
      if (!t) {
        o("🎮 WebHID not available in this browser");
        return;
      }
      (await t.requestDevice({ filters: [{ vendorId: 1406 }] })).forEach(u);
    },
    pads() {
      return Array.from(s.values()).map((e) => ({
        key: e.key,
        name: e.device.productName,
        side: e.side,
        buttons: e.buttons
      }));
    },
    debug() {
      return Array.from(s.values()).map((e) => ({
        name: e.device.productName,
        mode: e.mode,
        hz: e.hz,
        battery: e.battery,
        gyro: e.gyro,
        buttons: e.buttons
      }));
    }
  };
}
const P = {
  fov: 30,
  // measured on a real left Joy Con: tip left = axis 2 positive, tip up = axis 1 negative
  left: { yawAxis: 2, pitchAxis: 1, invertX: !0, invertY: !1 },
  // TODO verify on a real right Joy Con (one axis is said to be reversed between the two)
  right: { yawAxis: 2, pitchAxis: 1, invertX: !0, invertY: !1 }
}, ct = 1.5, V = 0.65, dt = 3, z = 50, lt = 0.05;
function pt(a) {
  const o = document.createElement("div");
  Object.assign(o.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "18px",
    height: "18px",
    marginLeft: "-9px",
    marginTop: "-9px",
    borderRadius: "50%",
    background: "radial-gradient(circle, #fff 0%, #ff2a2a 35%, rgba(255, 0, 0, 0.6) 60%, rgba(255, 0, 0, 0) 72%)",
    boxShadow: "0 0 14px 6px rgba(255, 0, 0, 0.55)",
    pointerEvents: "none",
    zIndex: "101",
    display: "none"
  }), document.body.appendChild(o);
  let t = !1;
  const s = { x: 0, y: 0 }, u = { x: 0, y: 0 }, d = [0, 0, 0], e = [];
  function h(E) {
    if (e.push(E), e.length > z && e.shift(), !(e.length < z)) {
      for (let l = 0; l < 3; l++) {
        const g = e.map((f) => f[l]);
        if (Math.max(...g) - Math.min(...g) > dt)
          return;
      }
      for (let l = 0; l < 3; l++) {
        const g = e.reduce((f, O) => f + O[l], 0) / e.length;
        d[l] = d[l] + (g - d[l]) * lt;
      }
    }
  }
  function x(E) {
    return Math.sign(E) * Math.max(Math.abs(E) - ct, 0);
  }
  return {
    /** every gyroscope sample, laser on or off (off, it keeps learning the resting offset) */
    feed(E, l, g) {
      if (h(E), !t)
        return;
      const f = a[g], O = window.innerWidth / a.fov, m = x(E[f.yawAxis] - d[f.yawAxis]), L = x(E[f.pitchAxis] - d[f.pitchAxis]);
      s.x += (f.invertX ? -1 : 1) * m * l * O, s.y += (f.invertY ? -1 : 1) * L * l * O, s.x = Math.min(Math.max(s.x, 0), window.innerWidth), s.y = Math.min(Math.max(s.y, 0), window.innerHeight);
    },
    setActive(E) {
      E && !t && (s.x = u.x = window.innerWidth / 2, s.y = u.y = window.innerHeight / 2, o.style.display = "block"), !E && t && (o.style.display = "none"), t = E;
    },
    /** once per frame */
    render() {
      t && (u.x += (s.x - u.x) * V, u.y += (s.y - u.y) * V, o.style.transform = `translate(${u.x}px, ${u.y}px)`);
    },
    debug() {
      return { active: t, bias: [...d] };
    }
  };
}
const N = {
  type: "right",
  cooldown: 300,
  pointerSpeed: 20,
  enableStick: !1,
  statusIndicator: !0,
  hidConnectKey: "c"
}, ut = {
  browser: { A: 0, X: 1, B: 2, Y: 3, SL: 4, SR: 5, ZR: 7, R: 8, PLUS: 9, STICK: 10, HOME: 16 },
  raw: { A: 0, X: 1, B: 2, Y: 3, SL: 4, SR: 5, PLUS: 9, STICK: 11, HOME: 12, R: 14, ZR: 15 }
}, ht = {
  browser: { DLEFT: 0, DBOTTOM: 1, DUP: 2, DRIGHT: 3, SL: 4, SR: 5, ZL: 6, L: 8, MINUS: 9, STICK: 10, SCREENSHOT: 16 },
  // TODO verify on a real left Joy Con (from the Joy Con reverse engineering notes, not tested yet)
  raw: { DBOTTOM: 0, DRIGHT: 1, DLEFT: 2, DUP: 3, SL: 4, SR: 5, MINUS: 8, STICK: 10, SCREENSHOT: 13, L: 14, ZL: 15 }
};
function ft(a) {
  return /^[0-9a-f]{4}-[0-9a-f]{4}-/i.test(a.id) ? "raw" : "browser";
}
const yt = (a) => /057e|joy-con/i.test(a.id), Et = (a, o) => /\(L\)/.test(a.id) ? "left" : /\(R\)/.test(a.id) ? "right" : o, A = {
  LOY: 0,
  LOX: 1,
  ROY: 2,
  ROX: 3
}, Tt = 0.85, It = 0.2, wt = () => {
  const a = {
    id: "joycon-plugin",
    init: o,
    /** opens Chrome's WebHID device picker (call it from a click or a key press) */
    connectHID: async () => {
    },
    /** live state, for the test page */
    debug: () => ({})
  };
  function o(t) {
    var F, k, Y, B, W, $, X;
    const s = t.getConfig();
    console.log("Joy Con plugin loaded", s.joycon || {});
    const u = (((F = s.joycon) == null ? void 0 : F.type) || N.type) === "left" ? "left" : "right", d = ((k = s.joycon) == null ? void 0 : k.cooldown) || N.cooldown, e = ((Y = s.joycon) == null ? void 0 : Y.pointerSpeed) || N.pointerSpeed, h = ((B = s.joycon) == null ? void 0 : B.enableStick) ?? N.enableStick, x = ((W = s.joycon) == null ? void 0 : W.statusIndicator) ?? N.statusIndicator, E = (($ = s.joycon) == null ? void 0 : $.hidConnectKey) ?? N.hidConnectKey, l = (i, r) => {
      const n = ht[i], c = ut[i], p = r === "left";
      return {
        RIGHT: p ? n.DRIGHT : c.A,
        LEFT: p ? n.DLEFT : c.Y,
        UP: p ? n.DUP : c.X,
        DOWN: p ? n.DBOTTOM : c.B,
        PREV: p ? n.SL : c.SL,
        NEXT: p ? n.SR : c.SR,
        QUIT_OVERVIEW_OR_NEXT: p ? n.ZL : c.ZR,
        TOGGLE_OVERVIEW: p ? n.L : c.R,
        TOGGLE_POINTING: p ? n.STICK : c.STICK,
        TOGGLE_PAUSE: p ? n.MINUS : c.PLUS,
        TOGGLE_HELP: p ? n.SCREENSHOT : c.HOME
      };
    }, g = {
      browser: { left: l("browser", "left"), right: l("browser", "right") },
      raw: { left: l("raw", "left"), right: l("raw", "right") }
    }, f = /* @__PURE__ */ new Map(), O = /* @__PURE__ */ new Map(), m = (X = s.joycon) == null ? void 0 : X.laser, L = pt({
      fov: (m == null ? void 0 : m.fov) ?? P.fov,
      left: { ...P.left, ...m == null ? void 0 : m.left },
      right: { ...P.right, ...m == null ? void 0 : m.right }
    }), S = at(L.feed, (i) => console.log(i));
    let R = !1;
    const y = document.createElement("div");
    y.style.position = "absolute", y.style.width = "20px", y.style.height = "20px", y.style.boxShadow = "3px 2px 2px #333", y.style.background = "#f00", y.style.top = "50%", y.style.left = "50%", y.style.zIndex = "99", y.style.borderRadius = "50%", y.style.display = "none", document.body.appendChild(y);
    const I = document.createElement("div");
    I.style.position = "fixed", I.style.left = "12px", I.style.bottom = "8px", I.style.zIndex = "100", I.style.fontSize = "22px", I.style.pointerEvents = "none", I.style.transition = "opacity 0.6s", I.style.opacity = "0", I.textContent = "🎮", document.body.appendChild(I);
    let M;
    function H(i) {
      x && (window.clearTimeout(M), I.style.filter = i ? "none" : "grayscale(1)", I.style.textDecoration = i ? "none" : "line-through red 3px", I.style.opacity = i ? "0.8" : "0.5", i && (M = window.setTimeout(() => I.style.opacity = "0", 2e3)));
    }
    function U(i) {
      const r = performance.now(), n = O.get(i);
      return n !== void 0 && r - n < d ? !1 : (O.set(i, r), !0);
    }
    function Z() {
      const i = S.pads().map((n) => ({ key: n.key, layout: "raw", side: n.side, buttons: n.buttons, axes: [], hid: !0 })), r = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter((n) => !!n && n.connected).filter((n) => i.length === 0 || !yt(n)).map((n) => ({
        key: `${n.index}:${n.id}`,
        layout: ft(n),
        side: Et(n, u),
        buttons: n.buttons.map((c) => c.pressed),
        axes: [...n.axes],
        hid: !1
      }));
      return [...i, ...r];
    }
    function C() {
      const i = /* @__PURE__ */ new Set();
      let r = !1;
      for (const n of Z()) {
        i.add(n.key);
        const c = g[n.layout][n.side], p = f.get(n.key), _ = {
          buttons: n.buttons,
          axes: n.axes.map((b) => Math.abs(b) > Tt)
        };
        if (f.set(n.key, _), n.hid && _.buttons[c.TOGGLE_POINTING] && (r = !0), !p) {
          console.log(`🎮 Gamepad ${n.key} connected ⚡`), H(!0);
          continue;
        }
        _.buttons.forEach((b, w) => {
          n.hid && w === c.TOGGLE_POINTING || b && !p.buttons[w] && U(`button-${w}`) && Q(w, c);
        }), n.axes.forEach((b, w) => {
          h && !R && _.axes[w] && !p.axes[w] && U(`axis-${w}`) && j(w, b), R && Math.abs(b) > It && q(w, b);
        });
      }
      for (const n of Array.from(f.keys()))
        i.has(n) || (f.delete(n), console.log(`🎮 Gamepad ${n} disconnected 🔌`), H(!1));
      L.setActive(r), L.render(), requestAnimationFrame(C);
    }
    function j(i, r) {
      switch (i) {
        case A.LOY:
          r < 0 ? t.down() : t.up();
          break;
        case A.LOX:
          r < 0 ? t.left() : t.right();
          break;
      }
    }
    function q(i, r) {
      const n = parseInt(y.style.left.replace("px", "")) || window.innerWidth / 2, c = parseInt(y.style.top.replace("px", "")) || window.innerHeight / 2, p = (_, b) => Math.min(Math.max(_, 0), b);
      switch (i) {
        case A.LOY:
          y.style.top = p(-r * e + c, window.innerHeight) + "px";
          break;
        case A.LOX:
          y.style.left = p(r * e + n, window.innerWidth) + "px";
          break;
      }
    }
    function Q(i, r) {
      switch (i) {
        case r.RIGHT:
          t.right();
          break;
        case r.DOWN:
          t.down();
          break;
        case r.UP:
          t.up();
          break;
        case r.LEFT:
          t.left();
          break;
        case r.PREV:
          t.prev();
          break;
        case r.NEXT:
          t.next();
          break;
        case r.TOGGLE_OVERVIEW:
          t.toggleOverview();
          break;
        case r.QUIT_OVERVIEW_OR_NEXT:
          t.isOverview() ? t.toggleOverview() : t.next();
          break;
        case r.TOGGLE_PAUSE:
          t.togglePause();
          break;
        case r.TOGGLE_POINTING:
          R = !R, y.style.display = R ? "block" : "none";
          break;
        case r.TOGGLE_HELP:
          t.toggleHelp();
          break;
        default:
          console.log("Button not mapped :", i);
      }
    }
    document.addEventListener("visibilitychange", () => {
      document.visibilityState === "visible" && f.clear();
    }), window.addEventListener("gamepadconnected", (i) => console.log(`🎮 gamepadconnected event (${i.gamepad.id})`)), window.addEventListener(
      "gamepaddisconnected",
      (i) => console.log(`🎮 gamepaddisconnected event (${i.gamepad.id})`)
    ), S.supported && E && document.addEventListener("keydown", (i) => {
      i.key === E && S.pads().length === 0 && S.connect().catch((r) => console.log(`🎮 WebHID connect cancelled: ${r}`));
    }), a.connectHID = () => S.connect(), a.debug = () => ({ hid: S.debug(), laser: L.debug() }), requestAnimationFrame(C);
  }
  return a;
};
export {
  wt as default
};
