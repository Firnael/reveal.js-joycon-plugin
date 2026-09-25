var ot = Object.defineProperty;
var st = (a, e, t) => e in a ? ot(a, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : a[e] = t;
var m = (a, e, t) => (st(a, typeof e != "symbol" ? e + "" : e, t), t);
const it = [0, 1, 64, 64, 0, 1, 64, 64], C = {
  SET_INPUT_REPORT_MODE: 3,
  SET_PLAYER_LIGHTS: 48,
  ENABLE_IMU: 64
}, v = {
  SUBCOMMAND_REPLY: 33,
  STANDARD_FULL: 48,
  SIMPLE_HID: 63
}, G = 0.06103, at = 5e-3, X = 1500, rt = [
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
class ct {
  constructor(e, t, s) {
    m(this, "device");
    m(this, "key");
    m(this, "side");
    m(this, "buttons", new Array(16).fill(!1));
    m(this, "gyro", [0, 0, 0]);
    m(this, "battery", "?");
    m(this, "mode", "starting");
    m(this, "hz", 0);
    m(this, "lastReport", 0);
    m(this, "packet", 0);
    m(this, "lastFullReport", 0);
    m(this, "lastInit", 0);
    m(this, "reportTimes", []);
    m(this, "onGyro");
    m(this, "log");
    this.device = e, this.key = `hid:${e.productId.toString(16)}:${e.productName}`, this.side = e.productId === 8198 ? "left" : "right", this.onGyro = t, this.log = s, this.onReport = this.onReport.bind(this);
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
      this.device.opened || await this.device.open(), await this.subcommand(C.ENABLE_IMU, [1]), await V(50), await this.subcommand(C.SET_INPUT_REPORT_MODE, [v.STANDARD_FULL]), await V(50), await this.subcommand(C.SET_PLAYER_LIGHTS, [1]);
    } catch (e) {
      this.log(`🎮 WebHID setup failed for ${this.device.productName}: ${e}`);
    }
  }
  /** called every second: if the full reports stopped (sleep, mode reset), send the setup again */
  async watchdog() {
    const e = performance.now();
    e - this.lastFullReport > X && e - this.lastInit > X && (this.mode = "no full reports, re-sending setup", this.log(`🎮 WebHID ${this.device.productName}: no full reports, re-sending setup`), await this.init()), this.reportTimes = this.reportTimes.filter((t) => e - t < 1e3), this.hz = this.reportTimes.length;
  }
  async subcommand(e, t) {
    const s = [this.packet++ & 15, ...it, e, ...t];
    await this.device.sendReport(1, new Uint8Array(s));
  }
  onReport(e) {
    const t = new Uint8Array(e.data.byteLength + 1);
    if (t[0] = e.reportId, t.set(new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength), 1), this.lastReport = performance.now(), e.reportId === v.SIMPLE_HID) {
      const l = t[1] | t[2] << 8;
      this.buttons = this.buttons.map((n, f) => (l & 1 << f) !== 0), this.mode = "simple (no motion)";
      return;
    }
    if (e.reportId !== v.STANDARD_FULL && e.reportId !== v.SUBCOMMAND_REPLY)
      return;
    const s = new Array(16).fill(!1);
    for (const [l, n, f] of rt)
      t[l] & n && (s[f] = !0);
    this.buttons = s;
    const d = ["empty", "critical", "low", "medium", "full"][t[2] >> 5] ?? "?";
    if (this.battery = t[2] & 16 ? `${d} (charging)` : d, e.reportId === v.STANDARD_FULL) {
      this.lastFullReport = performance.now(), this.reportTimes.push(this.lastFullReport), this.mode = "full (motion on)";
      const l = new DataView(t.buffer);
      for (let n = 0; n < 3; n++) {
        const f = 19 + n * 12;
        this.gyro = [
          l.getInt16(f, !0) * G,
          l.getInt16(f + 2, !0) * G,
          l.getInt16(f + 4, !0) * G
        ], this.onGyro(this.gyro, at, this.side);
      }
    }
  }
}
const V = (a) => new Promise((e) => setTimeout(e, a)), dt = (a) => a.vendorId === 1406 && (a.productId === 8198 || a.productId === 8199);
function lt(a, e) {
  const t = navigator.hid, s = /* @__PURE__ */ new Map();
  async function d(n) {
    if (!dt(n) || s.has(n))
      return;
    const f = new ct(n, a, e);
    s.set(n, f), e(`🎮 WebHID ${n.productName} attached ⚡`), await f.start();
  }
  function l(n) {
    const f = s.get(n);
    f && (f.stop(), s.delete(n), e(`🎮 WebHID ${n.productName} detached 🔌`));
  }
  return t && (t.getDevices().then((n) => n.forEach(d)), t.addEventListener("connect", (n) => d(n.device)), t.addEventListener("disconnect", (n) => l(n.device)), setInterval(() => s.forEach((n) => n.watchdog()), 1e3)), {
    supported: !!t,
    /** opens Chrome's device picker: must run from a user gesture (click, key press) */
    async connect() {
      if (!t) {
        e("🎮 WebHID not available in this browser");
        return;
      }
      (await t.requestDevice({ filters: [{ vendorId: 1406 }] })).forEach(d);
    },
    pads() {
      return Array.from(s.values()).map((n) => ({
        key: n.key,
        name: n.device.productName,
        side: n.side,
        buttons: n.buttons,
        lastReport: n.lastReport,
        hz: n.hz
      }));
    },
    debug() {
      return Array.from(s.values()).map((n) => ({
        name: n.device.productName,
        mode: n.mode,
        hz: n.hz,
        battery: n.battery,
        gyro: n.gyro,
        buttons: n.buttons
      }));
    }
  };
}
const M = {
  fov: 30,
  // measured on a real left Joy Con: tip left = axis 2 positive, tip up = axis 1 negative
  left: { yawAxis: 2, pitchAxis: 1, invertX: !0, invertY: !1 },
  // TODO verify on a real right Joy Con (one axis is said to be reversed between the two)
  right: { yawAxis: 2, pitchAxis: 1, invertX: !0, invertY: !1 }
}, pt = 1.5, j = 0.65, ut = 3, Z = 50, ft = 0.05;
function ht(a) {
  const e = document.createElement("div");
  Object.assign(e.style, {
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
  }), document.body.appendChild(e);
  let t = !1;
  const s = { x: 0, y: 0 }, d = { x: 0, y: 0 }, l = [0, 0, 0], n = [];
  function f(y) {
    if (n.push(y), n.length > Z && n.shift(), !(n.length < Z)) {
      for (let u = 0; u < 3; u++) {
        const b = n.map((p) => p[u]);
        if (Math.max(...b) - Math.min(...b) > ut)
          return;
      }
      for (let u = 0; u < 3; u++) {
        const b = n.reduce((p, T) => p + T[u], 0) / n.length;
        l[u] = l[u] + (b - l[u]) * ft;
      }
    }
  }
  function O(y) {
    return Math.sign(y) * Math.max(Math.abs(y) - pt, 0);
  }
  return {
    /** every gyroscope sample, laser on or off (off, it keeps learning the resting offset) */
    feed(y, u, b) {
      if (f(y), !t)
        return;
      const p = a[b], T = window.innerWidth / a.fov, I = O(y[p.yawAxis] - l[p.yawAxis]), g = O(y[p.pitchAxis] - l[p.pitchAxis]);
      s.x += (p.invertX ? -1 : 1) * I * u * T, s.y += (p.invertY ? -1 : 1) * g * u * T, s.x = Math.min(Math.max(s.x, 0), window.innerWidth), s.y = Math.min(Math.max(s.y, 0), window.innerHeight);
    },
    setActive(y) {
      y && !t && (s.x = d.x = window.innerWidth / 2, s.y = d.y = window.innerHeight / 2, e.style.display = "block"), !y && t && (e.style.display = "none"), t = y;
    },
    /** once per frame */
    render() {
      t && (d.x += (s.x - d.x) * j, d.y += (s.y - d.y) * j, e.style.transform = `translate(${d.x}px, ${d.y}px)`);
    },
    debug() {
      return { active: t, bias: [...l] };
    }
  };
}
const q = {
  idle: "#9a9a9a",
  live: "#3ddc84",
  connected: "#3ddc84",
  silent: "#ff9f1a",
  lost: "#ff3b3b"
}, yt = 1e3, Et = 250;
function mt(a) {
  let e = a;
  const t = document.createElement("div");
  Object.assign(t.style, {
    position: "fixed",
    left: "12px",
    bottom: "8px",
    zIndex: "100",
    display: e ? "flex" : "none",
    alignItems: "center",
    gap: "6px",
    padding: "3px 8px",
    borderRadius: "12px",
    background: "rgba(0, 0, 0, 0.35)",
    fontSize: "16px",
    lineHeight: "1",
    opacity: "0.7",
    cursor: "default",
    userSelect: "none"
  });
  const s = document.createElement("span");
  s.textContent = "🎮";
  const d = document.createElement("span");
  Object.assign(d.style, {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    transition: "transform 0.12s, box-shadow 0.12s"
  });
  const l = document.createElement("span");
  Object.assign(l.style, {
    display: "none",
    fontFamily: "system-ui, sans-serif",
    fontSize: "12px",
    color: "#fff",
    whiteSpace: "pre"
  }), t.append(s, d, l), t.addEventListener("mouseenter", () => {
    l.style.display = "inline", t.style.opacity = "1";
  }), t.addEventListener("mouseleave", () => {
    l.style.display = "none", t.style.opacity = "0.7";
  }), document.body.appendChild(t);
  let n = !1, f = 0, O;
  function y() {
    d.style.transform = "scale(1.5)", d.style.boxShadow = `0 0 8px 2px ${q.live}`, setTimeout(() => {
      d.style.transform = "scale(1)", d.style.boxShadow = "none";
    }, 120);
  }
  return {
    /** once per frame, with every pad currently seen */
    toggle() {
      e = !e, t.style.display = e ? "flex" : "none", O = void 0;
    },
    update(u) {
      if (!e)
        return;
      const b = performance.now();
      let p;
      if (u.length === 0)
        p = n ? "lost" : "idle";
      else {
        n = !0;
        const I = u.filter((L) => L.source === "WebHID"), g = Math.max(...I.map((L) => L.lastReport ?? 0));
        I.length === 0 ? p = "connected" : b - g < yt ? (p = "live", g > f + Et && (f = g, y())) : p = "silent";
      }
      p !== O && (O = p, d.style.background = q[p], s.style.filter = p === "idle" || p === "lost" ? "grayscale(1)" : "none");
      const T = u.length ? u.map((I) => `${I.name} · ${I.source}${I.hz !== void 0 ? ` · ~${Math.round(I.hz / 10) * 10} reports/s` : ""}`).join(`
`) : p === "lost" ? "Joy Con lost: press any button on it to wake it up" : "Joy Con plugin loaded, no controller yet";
      T !== l.textContent && (l.textContent = T);
    }
  };
}
const R = {
  type: "right",
  cooldown: 300,
  pointerSpeed: 20,
  enableStick: !1,
  statusIndicator: !0,
  statusToggleKey: "i",
  hidConnectKey: "c"
}, gt = {
  browser: { A: 0, X: 1, B: 2, Y: 3, SL: 4, SR: 5, ZR: 7, R: 8, PLUS: 9, STICK: 10, HOME: 16 },
  raw: { A: 0, X: 1, B: 2, Y: 3, SL: 4, SR: 5, PLUS: 9, STICK: 11, HOME: 12, R: 14, ZR: 15 }
}, bt = {
  browser: { DLEFT: 0, DBOTTOM: 1, DUP: 2, DRIGHT: 3, SL: 4, SR: 5, ZL: 6, L: 8, MINUS: 9, STICK: 10, SCREENSHOT: 16 },
  // TODO verify on a real left Joy Con (from the Joy Con reverse engineering notes, not tested yet)
  raw: { DBOTTOM: 0, DRIGHT: 1, DLEFT: 2, DUP: 3, SL: 4, SR: 5, MINUS: 8, STICK: 10, SCREENSHOT: 13, L: 14, ZL: 15 }
};
function Tt(a) {
  return /^[0-9a-f]{4}-[0-9a-f]{4}-/i.test(a.id) ? "raw" : "browser";
}
const It = (a) => /057e|joy-con/i.test(a.id), wt = (a, e) => /\(L\)/.test(a.id) ? "left" : /\(R\)/.test(a.id) ? "right" : e, A = {
  LOY: 0,
  LOX: 1,
  ROY: 2,
  ROX: 3
}, Ot = 0.85, Lt = 0.2, Rt = () => {
  const a = {
    id: "joycon-plugin",
    init: e,
    /** opens Chrome's WebHID device picker (call it from a click or a key press) */
    connectHID: async () => {
    },
    /** live state, for the test page */
    debug: () => ({})
  };
  function e(t) {
    var k, Y, $, W, B, K, z, J;
    const s = t.getConfig();
    console.log("Joy Con plugin loaded", s.joycon || {});
    const d = (((k = s.joycon) == null ? void 0 : k.type) || R.type) === "left" ? "left" : "right", l = ((Y = s.joycon) == null ? void 0 : Y.cooldown) || R.cooldown, n = (($ = s.joycon) == null ? void 0 : $.pointerSpeed) || R.pointerSpeed, f = ((W = s.joycon) == null ? void 0 : W.enableStick) ?? R.enableStick, O = ((B = s.joycon) == null ? void 0 : B.statusIndicator) ?? R.statusIndicator, y = ((K = s.joycon) == null ? void 0 : K.hidConnectKey) ?? R.hidConnectKey, u = ((z = s.joycon) == null ? void 0 : z.statusToggleKey) ?? R.statusToggleKey, b = (c, r) => {
      const o = bt[c], i = gt[c], h = r === "left";
      return {
        RIGHT: h ? o.DRIGHT : i.A,
        LEFT: h ? o.DLEFT : i.Y,
        UP: h ? o.DUP : i.X,
        DOWN: h ? o.DBOTTOM : i.B,
        PREV: h ? o.SL : i.SL,
        NEXT: h ? o.SR : i.SR,
        QUIT_OVERVIEW_OR_NEXT: h ? o.ZL : i.ZR,
        TOGGLE_OVERVIEW: h ? o.L : i.R,
        TOGGLE_POINTING: h ? o.STICK : i.STICK,
        TOGGLE_PAUSE: h ? o.MINUS : i.PLUS,
        TOGGLE_HELP: h ? o.SCREENSHOT : i.HOME
      };
    }, p = {
      browser: { left: b("browser", "left"), right: b("browser", "right") },
      raw: { left: b("raw", "left"), right: b("raw", "right") }
    }, T = /* @__PURE__ */ new Map(), I = /* @__PURE__ */ new Map(), g = (J = s.joycon) == null ? void 0 : J.laser, L = ht({
      fov: (g == null ? void 0 : g.fov) ?? M.fov,
      left: { ...M.left, ...g == null ? void 0 : g.left },
      right: { ...M.right, ...g == null ? void 0 : g.right }
    }), x = lt(L.feed, (c) => console.log(c));
    let N = !1;
    const E = document.createElement("div");
    E.style.position = "absolute", E.style.width = "20px", E.style.height = "20px", E.style.boxShadow = "3px 2px 2px #333", E.style.background = "#f00", E.style.top = "50%", E.style.left = "50%", E.style.zIndex = "99", E.style.borderRadius = "50%", E.style.display = "none", document.body.appendChild(E);
    const P = mt(O);
    function H(c) {
      const r = performance.now(), o = I.get(c);
      return o !== void 0 && r - o < l ? !1 : (I.set(c, r), !0);
    }
    function Q() {
      const c = x.pads().map((o) => ({
        key: o.key,
        layout: "raw",
        side: o.side,
        buttons: o.buttons,
        axes: [],
        hid: !0,
        status: { name: o.name, source: "WebHID", lastReport: o.lastReport, hz: o.hz }
      })), r = Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter((o) => !!o && o.connected).filter((o) => c.length === 0 || !It(o)).map((o) => ({
        key: `${o.index}:${o.id}`,
        layout: Tt(o),
        side: wt(o, d),
        buttons: o.buttons.map((i) => i.pressed),
        axes: [...o.axes],
        hid: !1,
        status: { name: o.id, source: "Gamepad API" }
      }));
      return [...c, ...r];
    }
    function U() {
      const c = /* @__PURE__ */ new Set();
      let r = !1;
      const o = Q();
      P.update(o.map((i) => i.status));
      for (const i of o) {
        c.add(i.key);
        const h = p[i.layout][i.side], D = T.get(i.key), _ = {
          buttons: i.buttons,
          axes: i.axes.map((S) => Math.abs(S) > Ot)
        };
        if (T.set(i.key, _), i.hid && _.buttons[h.TOGGLE_POINTING] && (r = !0), !D) {
          console.log(`🎮 Gamepad ${i.key} connected ⚡`);
          continue;
        }
        _.buttons.forEach((S, w) => {
          i.hid && w === h.TOGGLE_POINTING || S && !D.buttons[w] && H(`button-${w}`) && nt(w, h);
        }), i.axes.forEach((S, w) => {
          f && !N && _.axes[w] && !D.axes[w] && H(`axis-${w}`) && tt(w, S), N && Math.abs(S) > Lt && et(w, S);
        });
      }
      for (const i of Array.from(T.keys()))
        c.has(i) || (T.delete(i), console.log(`🎮 Gamepad ${i} disconnected 🔌`));
      L.setActive(r), L.render(), requestAnimationFrame(U);
    }
    function tt(c, r) {
      switch (c) {
        case A.LOY:
          r < 0 ? t.down() : t.up();
          break;
        case A.LOX:
          r < 0 ? t.left() : t.right();
          break;
      }
    }
    function et(c, r) {
      const o = parseInt(E.style.left.replace("px", "")) || window.innerWidth / 2, i = parseInt(E.style.top.replace("px", "")) || window.innerHeight / 2, h = (D, _) => Math.min(Math.max(D, 0), _);
      switch (c) {
        case A.LOY:
          E.style.top = h(-r * n + i, window.innerHeight) + "px";
          break;
        case A.LOX:
          E.style.left = h(r * n + o, window.innerWidth) + "px";
          break;
      }
    }
    function nt(c, r) {
      switch (c) {
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
          N = !N, E.style.display = N ? "block" : "none";
          break;
        case r.TOGGLE_HELP:
          t.toggleHelp();
          break;
        default:
          console.log("Button not mapped :", c);
      }
    }
    document.addEventListener("visibilitychange", () => {
      document.visibilityState === "visible" && T.clear();
    }), window.addEventListener("gamepadconnected", (c) => console.log(`🎮 gamepadconnected event (${c.gamepad.id})`)), window.addEventListener(
      "gamepaddisconnected",
      (c) => console.log(`🎮 gamepaddisconnected event (${c.gamepad.id})`)
    );
    function F(c, r, o) {
      const i = c.toUpperCase();
      typeof t.addKeyBinding == "function" ? t.addKeyBinding({ keyCode: i.charCodeAt(0), key: i, description: r }, o) : document.addEventListener("keydown", (h) => h.key.toUpperCase() === i && o());
    }
    x.supported && y && F(
      y,
      "Connect the Joy Con (WebHID)",
      () => x.connect().catch((c) => console.log(`🎮 WebHID connect cancelled: ${c}`))
    ), u && F(u, "Show / hide the Joy Con indicator", () => P.toggle()), a.connectHID = () => x.connect(), a.debug = () => ({ hid: x.debug(), laser: L.debug() }), requestAnimationFrame(U);
  }
  return a;
};
export {
  Rt as default
};
