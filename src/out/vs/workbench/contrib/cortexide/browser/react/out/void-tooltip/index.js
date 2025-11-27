import { styleInject } from '../chunk-6FX43ENS.js';
import { autoUpdate, computePosition, offset, flip, shift, arrow } from '../chunk-SWVXQVDT.js';
import { require_react, require_jsx_runtime, mountFnGenerator, useIsDark } from '../chunk-RJP66NWB.js';
import { __commonJS, __toESM } from '../chunk-JSBRDJBE.js';

// ../../../../../../../node_modules/classnames/index.js
var require_classnames = __commonJS({
  "../../../../../../../node_modules/classnames/index.js"(exports$1, module) {
    (function() {
      var hasOwn = {}.hasOwnProperty;
      function classNames() {
        var classes = "";
        for (var i2 = 0; i2 < arguments.length; i2++) {
          var arg = arguments[i2];
          if (arg) {
            classes = appendClass(classes, parseValue(arg));
          }
        }
        return classes;
      }
      function parseValue(arg) {
        if (typeof arg === "string" || typeof arg === "number") {
          return arg;
        }
        if (typeof arg !== "object") {
          return "";
        }
        if (Array.isArray(arg)) {
          return classNames.apply(null, arg);
        }
        if (arg.toString !== Object.prototype.toString && !arg.toString.toString().includes("[native code]")) {
          return arg.toString();
        }
        var classes = "";
        for (var key in arg) {
          if (hasOwn.call(arg, key) && arg[key]) {
            classes = appendClass(classes, key);
          }
        }
        return classes;
      }
      function appendClass(value, newClass) {
        if (!newClass) {
          return value;
        }
        if (value) {
          return value + " " + newClass;
        }
        return value + newClass;
      }
      if (typeof module !== "undefined" && module.exports) {
        classNames.default = classNames;
        module.exports = classNames;
      } else if (typeof define === "function" && typeof define.amd === "object" && define.amd) {
        define("classnames", [], function() {
          return classNames;
        });
      } else {
        window.classNames = classNames;
      }
    })();
  }
});

// ../../../../../../../node_modules/react-tooltip/dist/react-tooltip.min.mjs
var import_react = __toESM(require_react(), 1);
var import_classnames = __toESM(require_classnames(), 1);
var h = "react-tooltip-core-styles";
var w = "react-tooltip-base-styles";
var b = { core: false, base: false };
function S({ css: e2, id: t2 = w, type: o2 = "base", ref: r2 }) {
  var l2, n2;
  if (!e2 || "undefined" == typeof document || b[o2]) return;
  if ("core" === o2 && "undefined" != typeof process && (null === (l2 = null === process || void 0 === process ? void 0 : process.env) || void 0 === l2 ? void 0 : l2.REACT_TOOLTIP_DISABLE_CORE_STYLES)) return;
  if ("base" !== o2 && "undefined" != typeof process && (null === (n2 = null === process || void 0 === process ? void 0 : process.env) || void 0 === n2 ? void 0 : n2.REACT_TOOLTIP_DISABLE_BASE_STYLES)) return;
  "core" === o2 && (t2 = h), r2 || (r2 = {});
  const { insertAt: i2 } = r2;
  if (document.getElementById(t2)) return;
  const c2 = document.head || document.getElementsByTagName("head")[0], s2 = document.createElement("style");
  s2.id = t2, s2.type = "text/css", "top" === i2 && c2.firstChild ? c2.insertBefore(s2, c2.firstChild) : c2.appendChild(s2), s2.styleSheet ? s2.styleSheet.cssText = e2 : s2.appendChild(document.createTextNode(e2)), b[o2] = true;
}
var E = async ({ elementReference: e2 = null, tooltipReference: t2 = null, tooltipArrowReference: o2 = null, place: r2 = "top", offset: l2 = 10, strategy: n2 = "absolute", middlewares: i2 = [offset(Number(l2)), flip({ fallbackAxisSideDirection: "start" }), shift({ padding: 5 })], border: c2, arrowSize: s2 = 8 }) => {
  if (!e2) return { tooltipStyles: {}, tooltipArrowStyles: {}, place: r2 };
  if (null === t2) return { tooltipStyles: {}, tooltipArrowStyles: {}, place: r2 };
  const a2 = i2;
  return o2 ? (a2.push(arrow({ element: o2, padding: 5 })), computePosition(e2, t2, { placement: r2, strategy: n2, middleware: a2 }).then((({ x: e3, y: t3, placement: o3, middlewareData: r3 }) => {
    var l3, n3;
    const i3 = { left: `${e3}px`, top: `${t3}px`, border: c2 }, { x: a3, y: u } = null !== (l3 = r3.arrow) && void 0 !== l3 ? l3 : { x: 0, y: 0 }, d = null !== (n3 = { top: "bottom", right: "left", bottom: "top", left: "right" }[o3.split("-")[0]]) && void 0 !== n3 ? n3 : "bottom", p = c2 && { borderBottom: c2, borderRight: c2 };
    let v = 0;
    if (c2) {
      const e4 = `${c2}`.match(/(\d+)px/);
      v = (null == e4 ? void 0 : e4[1]) ? Number(e4[1]) : 1;
    }
    return { tooltipStyles: i3, tooltipArrowStyles: { left: null != a3 ? `${a3}px` : "", top: null != u ? `${u}px` : "", right: "", bottom: "", ...p, [d]: `-${s2 / 2 + v}px` }, place: o3 };
  }))) : computePosition(e2, t2, { placement: "bottom", strategy: n2, middleware: a2 }).then((({ x: e3, y: t3, placement: o3 }) => ({ tooltipStyles: { left: `${e3}px`, top: `${t3}px` }, tooltipArrowStyles: {}, place: o3 })));
};
var A = (e2, t2) => !("CSS" in window && "supports" in window.CSS) || window.CSS.supports(e2, t2);
var _ = (e2, t2, o2) => {
  let r2 = null;
  const l2 = function(...l3) {
    const n2 = () => {
      r2 = null;
    };
    !r2 && (e2.apply(this, l3), r2 = setTimeout(n2, t2));
  };
  return l2.cancel = () => {
    r2 && (clearTimeout(r2), r2 = null);
  }, l2;
};
var O = (e2) => null !== e2 && !Array.isArray(e2) && "object" == typeof e2;
var k = (e2, t2) => {
  if (e2 === t2) return true;
  if (Array.isArray(e2) && Array.isArray(t2)) return e2.length === t2.length && e2.every(((e3, o3) => k(e3, t2[o3])));
  if (Array.isArray(e2) !== Array.isArray(t2)) return false;
  if (!O(e2) || !O(t2)) return e2 === t2;
  const o2 = Object.keys(e2), r2 = Object.keys(t2);
  return o2.length === r2.length && o2.every(((o3) => k(e2[o3], t2[o3])));
};
var T = (e2) => {
  if (!(e2 instanceof HTMLElement || e2 instanceof SVGElement)) return false;
  const t2 = getComputedStyle(e2);
  return ["overflow", "overflow-x", "overflow-y"].some(((e3) => {
    const o2 = t2.getPropertyValue(e3);
    return "auto" === o2 || "scroll" === o2;
  }));
};
var L = (e2) => {
  if (!e2) return null;
  let t2 = e2.parentElement;
  for (; t2; ) {
    if (T(t2)) return t2;
    t2 = t2.parentElement;
  }
  return document.scrollingElement || document.documentElement;
};
var C = "undefined" != typeof window ? import_react.useLayoutEffect : import_react.useEffect;
var R = (e2) => {
  e2.current && (clearTimeout(e2.current), e2.current = null);
};
var x = "DEFAULT_TOOLTIP_ID";
var N = { anchorRefs: /* @__PURE__ */ new Set(), activeAnchor: { current: null }, attach: () => {
}, detach: () => {
}, setActiveAnchor: () => {
} };
var $ = (0, import_react.createContext)({ getTooltipData: () => N });
function I(e2 = x) {
  return (0, import_react.useContext)($).getTooltipData(e2);
}
var B = { tooltip: "core-styles-module_tooltip__3vRRp", fixed: "core-styles-module_fixed__pcSol", arrow: "core-styles-module_arrow__cvMwQ", noArrow: "core-styles-module_noArrow__xock6", clickable: "core-styles-module_clickable__ZuTTB", show: "core-styles-module_show__Nt9eE", closing: "core-styles-module_closing__sGnxF" };
var D = { tooltip: "styles-module_tooltip__mnnfp", arrow: "styles-module_arrow__K0L3T", dark: "styles-module_dark__xNqje", light: "styles-module_light__Z6W-X", success: "styles-module_success__A2AKt", warning: "styles-module_warning__SCK0X", error: "styles-module_error__JvumD", info: "styles-module_info__BWdHW" };
var q = ({ forwardRef: t2, id: r2, className: i2, classNameArrow: c2, variant: u = "dark", anchorId: d, anchorSelect: p, place: v = "top", offset: m = 10, events: h2 = ["hover"], openOnClick: w2 = false, positionStrategy: b2 = "absolute", middlewares: S2, wrapper: g, delayShow: A2 = 0, delayHide: O2 = 0, float: T2 = false, hidden: x2 = false, noArrow: N2 = false, clickable: $2 = false, closeOnEsc: j = false, closeOnScroll: z = false, closeOnResize: q2 = false, openEvents: H2, closeEvents: M2, globalCloseEvents: W, imperativeModeOnly: P, style: V, position: F, afterShow: K, afterHide: U, disableTooltip: X, content: Y, contentWrapperRef: G, isOpen: Z, defaultIsOpen: J = false, setIsOpen: Q, previousActiveAnchor: ee, activeAnchor: te, setActiveAnchor: oe, border: re, opacity: le, arrowColor: ne, arrowSize: ie = 8, role: ce = "tooltip" }) => {
  var se;
  const ae = (0, import_react.useRef)(null), ue = (0, import_react.useRef)(null), de = (0, import_react.useRef)(null), pe = (0, import_react.useRef)(null), ve = (0, import_react.useRef)(null), [me, fe] = (0, import_react.useState)({ tooltipStyles: {}, tooltipArrowStyles: {}, place: v }), [ye, he] = (0, import_react.useState)(false), [we, be] = (0, import_react.useState)(false), [Se, ge] = (0, import_react.useState)(null), Ee = (0, import_react.useRef)(false), Ae = (0, import_react.useRef)(null), { anchorRefs: _e, setActiveAnchor: Oe } = I(r2), ke = (0, import_react.useRef)(false), [Te, Le] = (0, import_react.useState)([]), Ce = (0, import_react.useRef)(false), Re = w2 || h2.includes("click"), xe = Re || (null == H2 ? void 0 : H2.click) || (null == H2 ? void 0 : H2.dblclick) || (null == H2 ? void 0 : H2.mousedown), Ne = H2 ? { ...H2 } : { mouseover: true, focus: true, mouseenter: false, click: false, dblclick: false, mousedown: false };
  !H2 && Re && Object.assign(Ne, { mouseenter: false, focus: false, mouseover: false, click: true });
  const $e = M2 ? { ...M2 } : { mouseout: true, blur: true, mouseleave: false, click: false, dblclick: false, mouseup: false };
  !M2 && Re && Object.assign($e, { mouseleave: false, blur: false, mouseout: false });
  const je = W ? { ...W } : { escape: j || false, scroll: z || false, resize: q2 || false, clickOutsideAnchor: xe || false };
  P && (Object.assign(Ne, { mouseover: false, focus: false, mouseenter: false, click: false, dblclick: false, mousedown: false }), Object.assign($e, { mouseout: false, blur: false, mouseleave: false, click: false, dblclick: false, mouseup: false }), Object.assign(je, { escape: false, scroll: false, resize: false, clickOutsideAnchor: false })), C((() => (Ce.current = true, () => {
    Ce.current = false;
  })), []);
  const Ie = (e2) => {
    Ce.current && (e2 && be(true), setTimeout((() => {
      Ce.current && (null == Q || Q(e2), void 0 === Z && he(e2));
    }), 10));
  };
  (0, import_react.useEffect)((() => {
    if (r2) {
      if (ye) {
        t3(ee);
        const o2 = e2(te), l2 = [.../* @__PURE__ */ new Set([...o2, r2])].filter(Boolean).join(" ");
        null == te || te.setAttribute("aria-describedby", l2);
      } else t3(te);
      return () => {
        t3(te), t3(ee);
      };
    }
    function e2(e3) {
      var t4;
      return (null === (t4 = null == e3 ? void 0 : e3.getAttribute("aria-describedby")) || void 0 === t4 ? void 0 : t4.split(" ")) || [];
    }
    function t3(t4) {
      const o2 = e2(t4).filter(((e3) => e3 !== r2));
      o2.length ? null == t4 || t4.setAttribute("aria-describedby", o2.join(" ")) : null == t4 || t4.removeAttribute("aria-describedby");
    }
  }), [te, ye, r2, ee]), (0, import_react.useEffect)((() => {
    if (void 0 === Z) return () => null;
    Z && be(true);
    const e2 = setTimeout((() => {
      he(Z);
    }), 10);
    return () => {
      clearTimeout(e2);
    };
  }), [Z]), (0, import_react.useEffect)((() => {
    if (ye !== Ee.current) if (R(ve), Ee.current = ye, ye) null == K || K();
    else {
      const e2 = ((e3) => {
        const t3 = e3.match(/^([\d.]+)(ms|s)$/);
        if (!t3) return 0;
        const [, o2, r3] = t3;
        return Number(o2) * ("ms" === r3 ? 1 : 1e3);
      })(getComputedStyle(document.body).getPropertyValue("--rt-transition-show-delay"));
      ve.current = setTimeout((() => {
        be(false), ge(null), null == U || U();
      }), e2 + 25);
    }
  }), [ye]);
  const ze = (e2) => {
    fe(((t3) => k(t3, e2) ? t3 : e2));
  }, Be = (e2 = A2) => {
    R(de), we ? Ie(true) : de.current = setTimeout((() => {
      Ie(true);
    }), e2);
  }, De = (e2 = O2) => {
    R(pe), pe.current = setTimeout((() => {
      ke.current || Ie(false);
    }), e2);
  }, qe = (e2) => {
    var t3;
    if (!e2) return;
    const o2 = null !== (t3 = e2.currentTarget) && void 0 !== t3 ? t3 : e2.target;
    if (!(null == o2 ? void 0 : o2.isConnected)) return oe(null), void Oe({ current: null });
    A2 ? Be() : Ie(true), oe(o2), Oe({ current: o2 }), R(pe);
  }, He = () => {
    $2 ? De(O2 || 100) : O2 ? De() : Ie(false), R(de);
  }, Me = ({ x: e2, y: t3 }) => {
    var o2;
    const r3 = { getBoundingClientRect: () => ({ x: e2, y: t3, width: 0, height: 0, top: t3, left: e2, right: e2, bottom: t3 }) };
    E({ place: null !== (o2 = null == Se ? void 0 : Se.place) && void 0 !== o2 ? o2 : v, offset: m, elementReference: r3, tooltipReference: ae.current, tooltipArrowReference: ue.current, strategy: b2, middlewares: S2, border: re, arrowSize: ie }).then(((e3) => {
      ze(e3);
    }));
  }, We = (e2) => {
    if (!e2) return;
    const t3 = e2, o2 = { x: t3.clientX, y: t3.clientY };
    Me(o2), Ae.current = o2;
  }, Pe = (e2) => {
    var t3;
    if (!ye) return;
    const o2 = e2.target;
    if (!o2.isConnected) return;
    if (null === (t3 = ae.current) || void 0 === t3 ? void 0 : t3.contains(o2)) return;
    [document.querySelector(`[id='${d}']`), ...Te].some(((e3) => null == e3 ? void 0 : e3.contains(o2))) || (Ie(false), R(de));
  }, Ve = _(qe, 50), Fe = _(He, 50), Ke = (e2) => {
    Fe.cancel(), Ve(e2);
  }, Ue = () => {
    Ve.cancel(), Fe();
  }, Xe = (0, import_react.useCallback)((() => {
    var e2, t3;
    const o2 = null !== (e2 = null == Se ? void 0 : Se.position) && void 0 !== e2 ? e2 : F;
    o2 ? Me(o2) : T2 ? Ae.current && Me(Ae.current) : (null == te ? void 0 : te.isConnected) && E({ place: null !== (t3 = null == Se ? void 0 : Se.place) && void 0 !== t3 ? t3 : v, offset: m, elementReference: te, tooltipReference: ae.current, tooltipArrowReference: ue.current, strategy: b2, middlewares: S2, border: re, arrowSize: ie }).then(((e3) => {
      Ce.current && ze(e3);
    }));
  }), [ye, te, Y, V, v, null == Se ? void 0 : Se.place, m, b2, F, null == Se ? void 0 : Se.position, T2, ie]);
  (0, import_react.useEffect)((() => {
    var e2, t3;
    const o2 = new Set(_e);
    Te.forEach(((e3) => {
      (null == X ? void 0 : X(e3)) || o2.add({ current: e3 });
    }));
    const r3 = document.querySelector(`[id='${d}']`);
    r3 && !(null == X ? void 0 : X(r3)) && o2.add({ current: r3 });
    const l2 = () => {
      Ie(false);
    }, n2 = L(te), i3 = L(ae.current);
    je.scroll && (window.addEventListener("scroll", l2), null == n2 || n2.addEventListener("scroll", l2), null == i3 || i3.addEventListener("scroll", l2));
    let c3 = null;
    je.resize ? window.addEventListener("resize", l2) : te && ae.current && (c3 = autoUpdate(te, ae.current, Xe, { ancestorResize: true, elementResize: true, layoutShift: true }));
    const s2 = (e3) => {
      "Escape" === e3.key && Ie(false);
    };
    je.escape && window.addEventListener("keydown", s2), je.clickOutsideAnchor && window.addEventListener("click", Pe);
    const a2 = [], u2 = (e3) => Boolean((null == e3 ? void 0 : e3.target) && (null == te ? void 0 : te.contains(e3.target))), p2 = (e3) => {
      ye && u2(e3) || qe(e3);
    }, v2 = (e3) => {
      ye && u2(e3) && He();
    }, m2 = ["mouseover", "mouseout", "mouseenter", "mouseleave", "focus", "blur"], y2 = ["click", "dblclick", "mousedown", "mouseup"];
    Object.entries(Ne).forEach((([e3, t4]) => {
      t4 && (m2.includes(e3) ? a2.push({ event: e3, listener: Ke }) : y2.includes(e3) && a2.push({ event: e3, listener: p2 }));
    })), Object.entries($e).forEach((([e3, t4]) => {
      t4 && (m2.includes(e3) ? a2.push({ event: e3, listener: Ue }) : y2.includes(e3) && a2.push({ event: e3, listener: v2 }));
    })), T2 && a2.push({ event: "pointermove", listener: We });
    const h3 = () => {
      ke.current = true;
    }, w3 = () => {
      ke.current = false, He();
    }, b3 = $2 && ($e.mouseout || $e.mouseleave);
    return b3 && (null === (e2 = ae.current) || void 0 === e2 || e2.addEventListener("mouseover", h3), null === (t3 = ae.current) || void 0 === t3 || t3.addEventListener("mouseout", w3)), a2.forEach((({ event: e3, listener: t4 }) => {
      o2.forEach(((o3) => {
        var r4;
        null === (r4 = o3.current) || void 0 === r4 || r4.addEventListener(e3, t4);
      }));
    })), () => {
      var e3, t4;
      je.scroll && (window.removeEventListener("scroll", l2), null == n2 || n2.removeEventListener("scroll", l2), null == i3 || i3.removeEventListener("scroll", l2)), je.resize ? window.removeEventListener("resize", l2) : null == c3 || c3(), je.clickOutsideAnchor && window.removeEventListener("click", Pe), je.escape && window.removeEventListener("keydown", s2), b3 && (null === (e3 = ae.current) || void 0 === e3 || e3.removeEventListener("mouseover", h3), null === (t4 = ae.current) || void 0 === t4 || t4.removeEventListener("mouseout", w3)), a2.forEach((({ event: e4, listener: t5 }) => {
        o2.forEach(((o3) => {
          var r4;
          null === (r4 = o3.current) || void 0 === r4 || r4.removeEventListener(e4, t5);
        }));
      }));
    };
  }), [te, Xe, we, _e, Te, H2, M2, W, Re, A2, O2]), (0, import_react.useEffect)((() => {
    var e2, t3;
    let o2 = null !== (t3 = null !== (e2 = null == Se ? void 0 : Se.anchorSelect) && void 0 !== e2 ? e2 : p) && void 0 !== t3 ? t3 : "";
    !o2 && r2 && (o2 = `[data-tooltip-id='${r2.replace(/'/g, "\\'")}']`);
    const l2 = new MutationObserver(((e3) => {
      const t4 = [], l3 = [];
      e3.forEach(((e4) => {
        if ("attributes" === e4.type && "data-tooltip-id" === e4.attributeName) {
          e4.target.getAttribute("data-tooltip-id") === r2 ? t4.push(e4.target) : e4.oldValue === r2 && l3.push(e4.target);
        }
        if ("childList" === e4.type) {
          if (te) {
            const t5 = [...e4.removedNodes].filter(((e5) => 1 === e5.nodeType));
            if (o2) try {
              l3.push(...t5.filter(((e5) => e5.matches(o2)))), l3.push(...t5.flatMap(((e5) => [...e5.querySelectorAll(o2)])));
            } catch (e5) {
            }
            t5.some(((e5) => {
              var t6;
              return !!(null === (t6 = null == e5 ? void 0 : e5.contains) || void 0 === t6 ? void 0 : t6.call(e5, te)) && (be(false), Ie(false), oe(null), R(de), R(pe), true);
            }));
          }
          if (o2) try {
            const r3 = [...e4.addedNodes].filter(((e5) => 1 === e5.nodeType));
            t4.push(...r3.filter(((e5) => e5.matches(o2)))), t4.push(...r3.flatMap(((e5) => [...e5.querySelectorAll(o2)])));
          } catch (e5) {
          }
        }
      })), (t4.length || l3.length) && Le(((e4) => [...e4.filter(((e5) => !l3.includes(e5))), ...t4]));
    }));
    return l2.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-tooltip-id"], attributeOldValue: true }), () => {
      l2.disconnect();
    };
  }), [r2, p, null == Se ? void 0 : Se.anchorSelect, te]), (0, import_react.useEffect)((() => {
    Xe();
  }), [Xe]), (0, import_react.useEffect)((() => {
    if (!(null == G ? void 0 : G.current)) return () => null;
    const e2 = new ResizeObserver((() => {
      setTimeout((() => Xe()));
    }));
    return e2.observe(G.current), () => {
      e2.disconnect();
    };
  }), [Y, null == G ? void 0 : G.current]), (0, import_react.useEffect)((() => {
    var e2;
    const t3 = document.querySelector(`[id='${d}']`), o2 = [...Te, t3];
    te && o2.includes(te) || oe(null !== (e2 = Te[0]) && void 0 !== e2 ? e2 : t3);
  }), [d, Te, te]), (0, import_react.useEffect)((() => (J && Ie(true), () => {
    R(de), R(pe);
  })), []), (0, import_react.useEffect)((() => {
    var e2;
    let t3 = null !== (e2 = null == Se ? void 0 : Se.anchorSelect) && void 0 !== e2 ? e2 : p;
    if (!t3 && r2 && (t3 = `[data-tooltip-id='${r2.replace(/'/g, "\\'")}']`), t3) try {
      const e3 = Array.from(document.querySelectorAll(t3));
      Le(e3);
    } catch (e3) {
      Le([]);
    }
  }), [r2, p, null == Se ? void 0 : Se.anchorSelect]), (0, import_react.useEffect)((() => {
    de.current && (R(de), Be(A2));
  }), [A2]);
  const Ye = null !== (se = null == Se ? void 0 : Se.content) && void 0 !== se ? se : Y, Ge = ye && Object.keys(me.tooltipStyles).length > 0;
  return (0, import_react.useImperativeHandle)(t2, (() => ({ open: (e2) => {
    if (null == e2 ? void 0 : e2.anchorSelect) try {
      document.querySelector(e2.anchorSelect);
    } catch (t3) {
      return void console.warn(`[react-tooltip] "${e2.anchorSelect}" is not a valid CSS selector`);
    }
    ge(null != e2 ? e2 : null), (null == e2 ? void 0 : e2.delay) ? Be(e2.delay) : Ie(true);
  }, close: (e2) => {
    (null == e2 ? void 0 : e2.delay) ? De(e2.delay) : Ie(false);
  }, activeAnchor: te, place: me.place, isOpen: Boolean(we && !x2 && Ye && Ge) }))), we && !x2 && Ye ? import_react.default.createElement(g, { id: r2, role: ce, className: (0, import_classnames.default)("react-tooltip", B.tooltip, D.tooltip, D[u], i2, `react-tooltip__place-${me.place}`, B[Ge ? "show" : "closing"], Ge ? "react-tooltip__show" : "react-tooltip__closing", "fixed" === b2 && B.fixed, $2 && B.clickable), onTransitionEnd: (e2) => {
    R(ve), ye || "opacity" !== e2.propertyName || (be(false), ge(null), null == U || U());
  }, style: { ...V, ...me.tooltipStyles, opacity: void 0 !== le && Ge ? le : void 0 }, ref: ae }, Ye, import_react.default.createElement(g, { className: (0, import_classnames.default)("react-tooltip-arrow", B.arrow, D.arrow, c2, N2 && B.noArrow), style: { ...me.tooltipArrowStyles, background: ne ? `linear-gradient(to right bottom, transparent 50%, ${ne} 50%)` : void 0, "--rt-arrow-size": `${ie}px` }, ref: ue })) : null;
};
var H = ({ content: t2 }) => import_react.default.createElement("span", { dangerouslySetInnerHTML: { __html: t2 } });
var M = import_react.default.forwardRef((({ id: t2, anchorId: r2, anchorSelect: n2, content: i2, html: c2, render: a2, className: u, classNameArrow: d, variant: p = "dark", place: v = "top", offset: m = 10, wrapper: f = "div", children: h2 = null, events: w2 = ["hover"], openOnClick: b2 = false, positionStrategy: S2 = "absolute", middlewares: g, delayShow: E2 = 0, delayHide: _2 = 0, float: O2 = false, hidden: k2 = false, noArrow: T2 = false, clickable: L2 = false, closeOnEsc: C2 = false, closeOnScroll: R2 = false, closeOnResize: x2 = false, openEvents: N2, closeEvents: $2, globalCloseEvents: j, imperativeModeOnly: z = false, style: B2, position: D2, isOpen: M2, defaultIsOpen: W = false, disableStyleInjection: P = false, border: V, opacity: F, arrowColor: K, arrowSize: U, setIsOpen: X, afterShow: Y, afterHide: G, disableTooltip: Z, role: J = "tooltip" }, Q) => {
  const [ee, te] = (0, import_react.useState)(i2), [oe, re] = (0, import_react.useState)(c2), [le, ne] = (0, import_react.useState)(v), [ie, ce] = (0, import_react.useState)(p), [se, ae] = (0, import_react.useState)(m), [ue, de] = (0, import_react.useState)(E2), [pe, ve] = (0, import_react.useState)(_2), [me, fe] = (0, import_react.useState)(O2), [ye, he] = (0, import_react.useState)(k2), [we, be] = (0, import_react.useState)(f), [Se, ge] = (0, import_react.useState)(w2), [Ee, Ae] = (0, import_react.useState)(S2), [_e, Oe] = (0, import_react.useState)(null), [ke, Te] = (0, import_react.useState)(null), Le = (0, import_react.useRef)(null), Ce = (0, import_react.useRef)(P), { anchorRefs: Re, activeAnchor: xe } = I(t2), Ne = (e2) => null == e2 ? void 0 : e2.getAttributeNames().reduce(((t3, o2) => {
    var r3;
    if (o2.startsWith("data-tooltip-")) {
      t3[o2.replace(/^data-tooltip-/, "")] = null !== (r3 = null == e2 ? void 0 : e2.getAttribute(o2)) && void 0 !== r3 ? r3 : null;
    }
    return t3;
  }), {}), $e = (e2) => {
    const t3 = { place: (e3) => {
      var t4;
      ne(null !== (t4 = e3) && void 0 !== t4 ? t4 : v);
    }, content: (e3) => {
      te(null != e3 ? e3 : i2);
    }, html: (e3) => {
      re(null != e3 ? e3 : c2);
    }, variant: (e3) => {
      var t4;
      ce(null !== (t4 = e3) && void 0 !== t4 ? t4 : p);
    }, offset: (e3) => {
      ae(null === e3 ? m : Number(e3));
    }, wrapper: (e3) => {
      var t4;
      be(null !== (t4 = e3) && void 0 !== t4 ? t4 : f);
    }, events: (e3) => {
      const t4 = null == e3 ? void 0 : e3.split(" ");
      ge(null != t4 ? t4 : w2);
    }, "position-strategy": (e3) => {
      var t4;
      Ae(null !== (t4 = e3) && void 0 !== t4 ? t4 : S2);
    }, "delay-show": (e3) => {
      de(null === e3 ? E2 : Number(e3));
    }, "delay-hide": (e3) => {
      ve(null === e3 ? _2 : Number(e3));
    }, float: (e3) => {
      fe(null === e3 ? O2 : "true" === e3);
    }, hidden: (e3) => {
      he(null === e3 ? k2 : "true" === e3);
    }, "class-name": (e3) => {
      Oe(e3);
    } };
    Object.values(t3).forEach(((e3) => e3(null))), Object.entries(e2).forEach((([e3, o2]) => {
      var r3;
      null === (r3 = t3[e3]) || void 0 === r3 || r3.call(t3, o2);
    }));
  };
  (0, import_react.useEffect)((() => {
    te(i2);
  }), [i2]), (0, import_react.useEffect)((() => {
    re(c2);
  }), [c2]), (0, import_react.useEffect)((() => {
    ne(v);
  }), [v]), (0, import_react.useEffect)((() => {
    ce(p);
  }), [p]), (0, import_react.useEffect)((() => {
    ae(m);
  }), [m]), (0, import_react.useEffect)((() => {
    de(E2);
  }), [E2]), (0, import_react.useEffect)((() => {
    ve(_2);
  }), [_2]), (0, import_react.useEffect)((() => {
    fe(O2);
  }), [O2]), (0, import_react.useEffect)((() => {
    he(k2);
  }), [k2]), (0, import_react.useEffect)((() => {
    Ae(S2);
  }), [S2]), (0, import_react.useEffect)((() => {
    Ce.current !== P && console.warn("[react-tooltip] Do not change `disableStyleInjection` dynamically.");
  }), [P]), (0, import_react.useEffect)((() => {
    "undefined" != typeof window && window.dispatchEvent(new CustomEvent("react-tooltip-inject-styles", { detail: { disableCore: "core" === P, disableBase: P } }));
  }), []), (0, import_react.useEffect)((() => {
    var e2;
    const o2 = new Set(Re);
    let l2 = n2;
    if (!l2 && t2 && (l2 = `[data-tooltip-id='${t2.replace(/'/g, "\\'")}']`), l2) try {
      document.querySelectorAll(l2).forEach(((e3) => {
        o2.add({ current: e3 });
      }));
    } catch (e3) {
      console.warn(`[react-tooltip] "${l2}" is not a valid CSS selector`);
    }
    const i3 = document.querySelector(`[id='${r2}']`);
    if (i3 && o2.add({ current: i3 }), !o2.size) return () => null;
    const c3 = null !== (e2 = null != ke ? ke : i3) && void 0 !== e2 ? e2 : xe.current, s2 = new MutationObserver(((e3) => {
      e3.forEach(((e4) => {
        var t3;
        if (!c3 || "attributes" !== e4.type || !(null === (t3 = e4.attributeName) || void 0 === t3 ? void 0 : t3.startsWith("data-tooltip-"))) return;
        const o3 = Ne(c3);
        $e(o3);
      }));
    })), a3 = { attributes: true, childList: false, subtree: false };
    if (c3) {
      const e3 = Ne(c3);
      $e(e3), s2.observe(c3, a3);
    }
    return () => {
      s2.disconnect();
    };
  }), [Re, xe, ke, r2, n2]), (0, import_react.useEffect)((() => {
    (null == B2 ? void 0 : B2.border) && console.warn("[react-tooltip] Do not set `style.border`. Use `border` prop instead."), V && !A("border", `${V}`) && console.warn(`[react-tooltip] "${V}" is not a valid \`border\`.`), (null == B2 ? void 0 : B2.opacity) && console.warn("[react-tooltip] Do not set `style.opacity`. Use `opacity` prop instead."), F && !A("opacity", `${F}`) && console.warn(`[react-tooltip] "${F}" is not a valid \`opacity\`.`);
  }), []);
  let je = h2;
  const Ie = (0, import_react.useRef)(null);
  if (a2) {
    const t3 = a2({ content: (null == ke ? void 0 : ke.getAttribute("data-tooltip-content")) || ee || null, activeAnchor: ke });
    je = t3 ? import_react.default.createElement("div", { ref: Ie, className: "react-tooltip-content-wrapper" }, t3) : null;
  } else ee && (je = ee);
  oe && (je = import_react.default.createElement(H, { content: oe }));
  const ze = { forwardRef: Q, id: t2, anchorId: r2, anchorSelect: n2, className: (0, import_classnames.default)(u, _e), classNameArrow: d, content: je, contentWrapperRef: Ie, place: le, variant: ie, offset: se, wrapper: we, events: Se, openOnClick: b2, positionStrategy: Ee, middlewares: g, delayShow: ue, delayHide: pe, float: me, hidden: ye, noArrow: T2, clickable: L2, closeOnEsc: C2, closeOnScroll: R2, closeOnResize: x2, openEvents: N2, closeEvents: $2, globalCloseEvents: j, imperativeModeOnly: z, style: B2, position: D2, isOpen: M2, defaultIsOpen: W, border: V, opacity: F, arrowColor: K, arrowSize: U, setIsOpen: X, afterShow: Y, afterHide: G, disableTooltip: Z, activeAnchor: ke, previousActiveAnchor: Le.current, setActiveAnchor: (e2) => {
    Te(((t3) => ((null == e2 ? void 0 : e2.isSameNode(t3)) || (Le.current = t3), e2)));
  }, role: J };
  return import_react.default.createElement(q, { ...ze });
}));
"undefined" != typeof window && window.addEventListener("react-tooltip-inject-styles", ((e2) => {
  e2.detail.disableCore || S({ css: `:root{--rt-color-white:#fff;--rt-color-dark:#222;--rt-color-success:#8dc572;--rt-color-error:#be6464;--rt-color-warning:#f0ad4e;--rt-color-info:#337ab7;--rt-opacity:0.9;--rt-transition-show-delay:0.15s;--rt-transition-closing-delay:0.15s;--rt-arrow-size:8px}.core-styles-module_tooltip__3vRRp{position:absolute;top:0;left:0;pointer-events:none;opacity:0;will-change:opacity}.core-styles-module_fixed__pcSol{position:fixed}.core-styles-module_arrow__cvMwQ{position:absolute;background:inherit;z-index:-1}.core-styles-module_noArrow__xock6{display:none}.core-styles-module_clickable__ZuTTB{pointer-events:auto}.core-styles-module_show__Nt9eE{opacity:var(--rt-opacity);transition:opacity var(--rt-transition-show-delay)ease-out}.core-styles-module_closing__sGnxF{opacity:0;transition:opacity var(--rt-transition-closing-delay)ease-in}`, type: "core" }), e2.detail.disableBase || S({ css: `
.styles-module_tooltip__mnnfp{padding:8px 16px;border-radius:3px;font-size:90%;width:max-content}.styles-module_arrow__K0L3T{width:var(--rt-arrow-size);height:var(--rt-arrow-size)}[class*='react-tooltip__place-top']>.styles-module_arrow__K0L3T{transform:rotate(45deg)}[class*='react-tooltip__place-right']>.styles-module_arrow__K0L3T{transform:rotate(135deg)}[class*='react-tooltip__place-bottom']>.styles-module_arrow__K0L3T{transform:rotate(225deg)}[class*='react-tooltip__place-left']>.styles-module_arrow__K0L3T{transform:rotate(315deg)}.styles-module_dark__xNqje{background:var(--rt-color-dark);color:var(--rt-color-white)}.styles-module_light__Z6W-X{background-color:var(--rt-color-white);color:var(--rt-color-dark)}.styles-module_success__A2AKt{background-color:var(--rt-color-success);color:var(--rt-color-white)}.styles-module_warning__SCK0X{background-color:var(--rt-color-warning);color:var(--rt-color-white)}.styles-module_error__JvumD{background-color:var(--rt-color-error);color:var(--rt-color-white)}.styles-module_info__BWdHW{background-color:var(--rt-color-info);color:var(--rt-color-white)}`, type: "base" });
}));

// ../../../../../../../node_modules/react-tooltip/dist/react-tooltip.min.css
styleInject(":root {\n  --rt-color-white:#fff;\n  --rt-color-dark:#222;\n  --rt-color-success:#8dc572;\n  --rt-color-error:#be6464;\n  --rt-color-warning:#f0ad4e;\n  --rt-color-info:#337ab7;\n  --rt-opacity:0.9;\n  --rt-transition-show-delay:0.15s;\n  --rt-transition-closing-delay:0.15s;\n  --rt-arrow-size:8px;\n}\n.core-styles-module_tooltip__3vRRp {\n  left: 0;\n  opacity: 0;\n  pointer-events: none;\n  position: absolute;\n  top: 0;\n  will-change: opacity;\n}\n.core-styles-module_fixed__pcSol {\n  position: fixed;\n}\n.core-styles-module_arrow__cvMwQ {\n  background: inherit;\n  position: absolute;\n  z-index: -1;\n}\n.core-styles-module_noArrow__xock6 {\n  display: none;\n}\n.core-styles-module_clickable__ZuTTB {\n  pointer-events: auto;\n}\n.core-styles-module_show__Nt9eE {\n  opacity: var(--rt-opacity);\n  transition: opacity var(--rt-transition-show-delay) ease-out;\n}\n.core-styles-module_closing__sGnxF {\n  opacity: 0;\n  transition: opacity var(--rt-transition-closing-delay) ease-in;\n}\n.styles-module_tooltip__mnnfp {\n  border-radius: 3px;\n  font-size: 90%;\n  padding: 8px 16px;\n  width: max-content;\n}\n.styles-module_arrow__K0L3T {\n  height: var(--rt-arrow-size);\n  width: var(--rt-arrow-size);\n}\n[class*=react-tooltip__place-top] > .styles-module_arrow__K0L3T {\n  transform: rotate(45deg);\n}\n[class*=react-tooltip__place-right] > .styles-module_arrow__K0L3T {\n  transform: rotate(135deg);\n}\n[class*=react-tooltip__place-bottom] > .styles-module_arrow__K0L3T {\n  transform: rotate(225deg);\n}\n[class*=react-tooltip__place-left] > .styles-module_arrow__K0L3T {\n  transform: rotate(315deg);\n}\n.styles-module_dark__xNqje {\n  background: var(--rt-color-dark);\n  color: var(--rt-color-white);\n}\n.styles-module_light__Z6W-X {\n  background-color: var(--rt-color-white);\n  color: var(--rt-color-dark);\n}\n.styles-module_success__A2AKt {\n  background-color: var(--rt-color-success);\n  color: var(--rt-color-white);\n}\n.styles-module_warning__SCK0X {\n  background-color: var(--rt-color-warning);\n  color: var(--rt-color-white);\n}\n.styles-module_error__JvumD {\n  background-color: var(--rt-color-error);\n  color: var(--rt-color-white);\n}\n.styles-module_info__BWdHW {\n  background-color: var(--rt-color-info);\n  color: var(--rt-color-white);\n}\n");

// src2/void-tooltip/VoidTooltip.tsx
var import_jsx_runtime = (
  // use native colors so we don't have to worry about @@void-scope styles
  // --void-bg-1: var(--vscode-input-background);
  // --void-bg-1-alt: var(--vscode-badge-background);
  // --void-bg-2: var(--vscode-sideBar-background);
  // --void-bg-2-alt: color-mix(in srgb, var(--vscode-sideBar-background) 30%, var(--vscode-editor-background) 70%);
  // --void-bg-3: var(--vscode-editor-background);
  // --void-fg-0: color-mix(in srgb, var(--vscode-tab-activeForeground) 90%, black 10%);
  // --void-fg-1: var(--vscode-editor-foreground);
  // --void-fg-2: var(--vscode-input-foreground);
  // --void-fg-3: var(--vscode-input-placeholderForeground);
  // /* --void-fg-4: var(--vscode-tab-inactiveForeground); */
  // --void-fg-4: var(--vscode-list-deemphasizedForeground);
  // --void-warning: var(--vscode-charts-yellow);
  // --void-border-1: var(--vscode-commandCenter-activeBorder);
  // --void-border-2: var(--vscode-commandCenter-border);
  // --void-border-3: var(--vscode-commandCenter-inactiveBorder);
  // --void-border-4: var(--vscode-editorGroup-border);
  __toESM(require_jsx_runtime(), 1)
);
var VoidTooltip = () => {
  useIsDark();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `
				#void-tooltip, #void-tooltip-orange, #void-tooltip-green, #void-tooltip-ollama-settings, #void-tooltip-provider-info {
					font-size: 12px;
					padding: 0px 8px;
					border-radius: 6px;
					z-index: 999999;
					max-width: 300px;
					word-wrap: break-word;
				}

				#void-tooltip {
					background-color: var(--vscode-editor-background);
					color: var(--vscode-input-foreground);
				}

				#void-tooltip-orange {
					background-color: #F6762A;
					color: white;
				}

				#void-tooltip-green {
					background-color: #228B22;
					color: white;
				}

				#void-tooltip-ollama-settings, #void-tooltip-provider-info {
					background-color: var(--vscode-editor-background);
					color: var(--vscode-input-foreground);
				}

				.react-tooltip-arrow {
					z-index: -1 !important; /* Keep arrow behind content (somehow this isnt done automatically) */
				}
				` }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      M,
      {
        id: "void-tooltip",
        border: "1px solid rgba(100,100,100,.2)",
        opacity: 1,
        delayShow: 50
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      M,
      {
        id: "void-tooltip-orange",
        border: "1px solid rgba(200,200,200,.3)",
        opacity: 1,
        delayShow: 50
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      M,
      {
        id: "void-tooltip-green",
        border: "1px solid rgba(200,200,200,.3)",
        opacity: 1,
        delayShow: 50
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      M,
      {
        id: "void-tooltip-ollama-settings",
        border: "1px solid rgba(100,100,100,.2)",
        opacity: 1,
        openEvents: { mouseover: true, click: true, focus: true },
        place: "right",
        style: { pointerEvents: "all", userSelect: "text", fontSize: 11 },
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "8px 10px" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { opacity: 0.8, textAlign: "center", fontWeight: "bold", marginBottom: 8 }, children: "Good starter models" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { opacity: 0.8 }, children: [
              "For chat:",
              ` `
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { opacity: 0.8, fontWeight: "bold" }, children: "gemma3" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginBottom: 4 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { opacity: 0.8 }, children: [
              "For autocomplete:",
              ` `
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { opacity: 0.8, fontWeight: "bold" }, children: "qwen2.5-coder" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginBottom: 0 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { opacity: 0.8 }, children: "Use the largest version of these you can!" }) })
        ] })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      M,
      {
        id: "void-tooltip-provider-info",
        border: "1px solid rgba(100,100,100,.2)",
        opacity: 1,
        delayShow: 50,
        style: { pointerEvents: "all", userSelect: "text", fontSize: 11, maxWidth: "280px", paddingTop: "8px", paddingBottom: "8px" }
      }
    )
  ] });
};

// src2/void-tooltip/index.tsx
var mountVoidTooltip = mountFnGenerator(VoidTooltip);
/*! Bundled license information:

classnames/index.js:
  (*!
  	Copyright (c) 2018 Jed Watson.
  	Licensed under the MIT License (MIT), see
  	http://jedwatson.github.io/classnames
  *)

react-tooltip/dist/react-tooltip.min.mjs:
  (*
  * React Tooltip
  * {@link https://github.com/ReactTooltip/react-tooltip}
  * @copyright ReactTooltip Team
  * @license MIT
  *)
*/

export { mountVoidTooltip };
