const u = {
  type: "right",
  cooldown: 300,
  pointerSpeed: 20
}, c = {
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
}, r = {
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
}, g = {
  LOY: 0,
  LOX: 1,
  ROY: 2,
  ROX: 3
}, U = (n) => {
  var h, m, w;
  const E = n.getConfig();
  console.log("Joy Con plugin loaded", E.joycon || {});
  const s = ((h = E.joycon) == null ? void 0 : h.type) || u.type, x = ((m = E.joycon) == null ? void 0 : m.cooldown) || u.cooldown, L = ((w = E.joycon) == null ? void 0 : w.pointerSpeed) || u.pointerSpeed, i = {
    RIGHT: s === "left" ? r.DRIGHT : c.A,
    LEFT: s === "left" ? r.DLEFT : c.Y,
    UP: s === "left" ? r.DUP : c.X,
    DOWN: s === "left" ? r.DBOTTOM : c.B,
    PREV: s === "left" ? r.SL : c.SL,
    NEXT: s === "left" ? r.SR : c.SR,
    QUIT_OVERVIEW_OR_NEXT: s === "left" ? r.ZL : c.ZR,
    TOGGLE_OVERVIEW: s === "left" ? r.L : c.R,
    TOGGLE_POINTING: s === "left" ? r.STICK : c.STICK,
    TOGGLE_PAUSE: s === "left" ? r.MINUS : c.PLUS,
    TOGGLE_HELP: s === "left" ? r.SCREENSHOT : c.HOME
  }, y = "ongamepadconnected" in window, p = {};
  let T = [], f = !1;
  const o = document.createElement("div");
  o.style.position = "absolute", o.style.width = "20px", o.style.height = "20px", o.style.boxShadow = "3px 2px 2px #333", o.style.background = "#f00", o.style.top = "50%", o.style.left = "50%", o.style.zIndex = "99", o.style.borderRadius = "50%", o.style.display = "none", document.body.appendChild(o);
  function G(e) {
    return T.indexOf(e) < 0 ? (T.push(e), setTimeout(() => {
      T = T.filter((a) => a !== e);
    }, x), !0) : !1;
  }
  function S() {
    const e = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let a = 0; a < e.length; a++) {
      const t = e[a];
      t && (t.index in p ? p[t.index] = t : R(t));
    }
  }
  function I() {
    y || S();
    for (const e in p)
      if (Object.prototype.hasOwnProperty.call(p, e)) {
        const a = p[e];
        if (!a)
          continue;
        for (let t = 0; t < a.buttons.length; t++) {
          const l = a.buttons[t];
          let d;
          typeof l == "object" && (d = l.pressed), d && G(`button-${t}`) && N(t);
        }
        for (let t = 0; t < a.axes.length; t++) {
          const l = a.axes[t];
          if (l) {
            if (Math.abs(l) > 0.85 && !f && G(`axis-${t}`))
              switch (t) {
                case g.LOY: {
                  l < 0 ? n.down() : n.up();
                  break;
                }
                case g.LOX: {
                  l < 0 ? n.left() : n.right();
                  break;
                }
              }
            if (Math.abs(l) > 0.2 && f) {
              const d = parseInt(o.style.left.replace("px", "")), O = parseInt(o.style.top.replace("px", ""));
              b(t, l, d, O, (C) => Math.min(Math.max(C, 0), window.innerWidth));
            }
          }
        }
      }
    requestAnimationFrame(I);
  }
  function b(e, a, t, l, d) {
    switch (e) {
      case g.LOY: {
        const O = -a * L + l;
        o.style.top = d(O) + "px";
        break;
      }
      case g.LOX: {
        const O = a * L + t;
        o.style.left = d(O) + "px";
        break;
      }
    }
  }
  function N(e) {
    switch (console.log(e), e) {
      case i.RIGHT:
        n.right();
        break;
      case i.DOWN:
        n.down();
        break;
      case i.UP:
        n.up();
        break;
      case i.LEFT:
        n.left();
        break;
      case i.PREV:
        n.prev();
        break;
      case i.NEXT:
        n.next();
        break;
      case i.TOGGLE_OVERVIEW:
        n.toggleOverview();
        break;
      case i.QUIT_OVERVIEW_OR_NEXT:
        n.isOverview() ? n.toggleOverview() : n.next();
        break;
      case i.TOGGLE_PAUSE:
        n.togglePause();
        break;
      case i.TOGGLE_POINTING:
        f = !f, o.style.display = f ? "block" : "none";
        break;
      case i.TOGGLE_HELP:
        n.toggleHelp();
        break;
      default:
        console.log("Button not mapped :", e);
    }
  }
  function R(e) {
    p[e.index] = e, requestAnimationFrame(I);
  }
  function _(e) {
    delete p[e.index];
  }
  function P(e) {
    R(e.gamepad), console.log(`🎮 Gamepad ${e.gamepad.index} connected ⚡`);
  }
  function v(e) {
    _(e.gamepad), console.log(`🎮 Gamepad ${e.gamepad.index} disconnected 🔌`);
  }
  window.addEventListener("gamepadconnected", P), window.addEventListener("gamepaddisconnected", v), y || setInterval(S, 500);
}, D = () => ({
  id: "joycon-plugin",
  init: U
});
export {
  D as default
};
