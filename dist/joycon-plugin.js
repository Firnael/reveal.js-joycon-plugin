const u = {
  type: "right",
  cooldown: 300,
  pointerSpeed: 20,
  enableStick: !1,
  statusIndicator: !0
}, C = {
  browser: { A: 0, X: 1, B: 2, Y: 3, SL: 4, SR: 5, ZR: 7, R: 8, PLUS: 9, STICK: 10, HOME: 16 },
  raw: { A: 0, X: 1, B: 2, Y: 3, SL: 4, SR: 5, PLUS: 9, STICK: 11, HOME: 12, R: 14, ZR: 15 }
}, F = {
  browser: { DLEFT: 0, DBOTTOM: 1, DUP: 2, DRIGHT: 3, SL: 4, SR: 5, ZL: 6, L: 8, MINUS: 9, STICK: 10, SCREENSHOT: 16 },
  // TODO verify on a real left Joy Con (taken from the Joy Con reverse engineering notes, not tested yet)
  raw: { DLEFT: 0, DBOTTOM: 1, DUP: 2, DRIGHT: 3, SL: 4, SR: 5, MINUS: 8, STICK: 10, SCREENSHOT: 13, L: 14, ZL: 15 }
};
function X(o) {
  return /^[0-9a-f]{4}-[0-9a-f]{4}-/i.test(o.id) ? "raw" : "browser";
}
const y = {
  LOY: 0,
  LOX: 1,
  ROY: 2,
  ROX: 3
}, Y = 0.85, K = 0.2, W = (o) => {
  var R, m, h, I, G;
  const l = o.getConfig();
  console.log("Joy Con plugin loaded", l.joycon || {});
  const i = ((R = l.joycon) == null ? void 0 : R.type) || u.type, _ = ((m = l.joycon) == null ? void 0 : m.cooldown) || u.cooldown, T = ((h = l.joycon) == null ? void 0 : h.pointerSpeed) || u.pointerSpeed, x = ((I = l.joycon) == null ? void 0 : I.enableStick) ?? u.enableStick, v = ((G = l.joycon) == null ? void 0 : G.statusIndicator) ?? u.statusIndicator, O = (t) => {
    const e = F[t], n = C[t];
    return {
      RIGHT: i === "left" ? e.DRIGHT : n.A,
      LEFT: i === "left" ? e.DLEFT : n.Y,
      UP: i === "left" ? e.DUP : n.X,
      DOWN: i === "left" ? e.DBOTTOM : n.B,
      PREV: i === "left" ? e.SL : n.SL,
      NEXT: i === "left" ? e.SR : n.SR,
      QUIT_OVERVIEW_OR_NEXT: i === "left" ? e.ZL : n.ZR,
      TOGGLE_OVERVIEW: i === "left" ? e.L : n.R,
      TOGGLE_POINTING: i === "left" ? e.STICK : n.STICK,
      TOGGLE_PAUSE: i === "left" ? e.MINUS : n.PLUS,
      TOGGLE_HELP: i === "left" ? e.SCREENSHOT : n.HOME
    };
  }, P = { browser: O("browser"), raw: O("raw") }, p = /* @__PURE__ */ new Map(), w = /* @__PURE__ */ new Map();
  let f = !1;
  const s = document.createElement("div");
  s.style.position = "absolute", s.style.width = "20px", s.style.height = "20px", s.style.boxShadow = "3px 2px 2px #333", s.style.background = "#f00", s.style.top = "50%", s.style.left = "50%", s.style.zIndex = "99", s.style.borderRadius = "50%", s.style.display = "none", document.body.appendChild(s);
  const a = document.createElement("div");
  a.style.position = "fixed", a.style.left = "12px", a.style.bottom = "8px", a.style.zIndex = "100", a.style.fontSize = "22px", a.style.pointerEvents = "none", a.style.transition = "opacity 0.6s", a.style.opacity = "0", a.textContent = "🎮", document.body.appendChild(a);
  let L;
  function g(t) {
    v && (window.clearTimeout(L), a.style.filter = t ? "none" : "grayscale(1)", a.style.textDecoration = t ? "none" : "line-through red 3px", a.style.opacity = t ? "0.8" : "0.5", t && (L = window.setTimeout(() => a.style.opacity = "0", 2e3)));
  }
  function S(t) {
    const e = performance.now(), n = w.get(t);
    return n !== void 0 && e - n < _ ? !1 : (w.set(t, e), !0);
  }
  function D(t) {
    return `${t.index}:${t.id}`;
  }
  function H(t) {
    return {
      buttons: t.buttons.map((e) => e.pressed),
      axes: t.axes.map((e) => Math.abs(e) > Y)
    };
  }
  function U() {
    const t = navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.from(t).filter((e) => !!e && e.connected);
  }
  function b() {
    const t = /* @__PURE__ */ new Set();
    for (const e of U()) {
      const n = D(e);
      t.add(n);
      const E = p.get(n), d = H(e);
      if (p.set(n, d), !E) {
        console.log(`🎮 Gamepad ${n} connected ⚡`), g(!0);
        continue;
      }
      d.buttons.forEach((c, r) => {
        c && !E.buttons[r] && S(`button-${r}`) && B(r, P[X(e)]);
      }), e.axes.forEach((c, r) => {
        x && !f && d.axes[r] && !E.axes[r] && S(`axis-${r}`) && N(r, c), f && Math.abs(c) > K && M(r, c);
      });
    }
    for (const e of Array.from(p.keys()))
      t.has(e) || (p.delete(e), console.log(`🎮 Gamepad ${e} disconnected 🔌`), g(!1));
    requestAnimationFrame(b);
  }
  function N(t, e) {
    switch (t) {
      case y.LOY:
        e < 0 ? o.down() : o.up();
        break;
      case y.LOX:
        e < 0 ? o.left() : o.right();
        break;
    }
  }
  function M(t, e) {
    const n = parseInt(s.style.left.replace("px", "")) || window.innerWidth / 2, E = parseInt(s.style.top.replace("px", "")) || window.innerHeight / 2, d = (c, r) => Math.min(Math.max(c, 0), r);
    switch (t) {
      case y.LOY:
        s.style.top = d(-e * T + E, window.innerHeight) + "px";
        break;
      case y.LOX:
        s.style.left = d(e * T + n, window.innerWidth) + "px";
        break;
    }
  }
  function B(t, e) {
    switch (t) {
      case e.RIGHT:
        o.right();
        break;
      case e.DOWN:
        o.down();
        break;
      case e.UP:
        o.up();
        break;
      case e.LEFT:
        o.left();
        break;
      case e.PREV:
        o.prev();
        break;
      case e.NEXT:
        o.next();
        break;
      case e.TOGGLE_OVERVIEW:
        o.toggleOverview();
        break;
      case e.QUIT_OVERVIEW_OR_NEXT:
        o.isOverview() ? o.toggleOverview() : o.next();
        break;
      case e.TOGGLE_PAUSE:
        o.togglePause();
        break;
      case e.TOGGLE_POINTING:
        f = !f, s.style.display = f ? "block" : "none";
        break;
      case e.TOGGLE_HELP:
        o.toggleHelp();
        break;
      default:
        console.log("Button not mapped :", t);
    }
  }
  document.addEventListener("visibilitychange", () => {
    document.visibilityState === "visible" && p.clear();
  }), window.addEventListener("gamepadconnected", (t) => console.log(`🎮 gamepadconnected event (${t.gamepad.id})`)), window.addEventListener("gamepaddisconnected", (t) => console.log(`🎮 gamepaddisconnected event (${t.gamepad.id})`)), requestAnimationFrame(b);
}, $ = () => ({
  id: "joycon-plugin",
  init: W
});
export {
  $ as default
};
