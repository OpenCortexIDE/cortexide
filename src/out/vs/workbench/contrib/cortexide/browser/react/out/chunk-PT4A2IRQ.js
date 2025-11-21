import { require_react } from './chunk-RJP66NWB.js';
import { __toESM } from './chunk-JSBRDJBE.js';

// ../../../../../../../node_modules/lucide-react/dist/esm/createLucideIcon.js
var import_react2 = __toESM(require_react());

// ../../../../../../../node_modules/lucide-react/dist/esm/shared/src/utils.js
var toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
var toCamelCase = (string) => string.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase()
);
var toPascalCase = (string) => {
  const camelCase = toCamelCase(string);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
};
var mergeClasses = (...classes) => classes.filter((className, index, array) => {
  return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
}).join(" ").trim();
var hasA11yProp = (props) => {
  for (const prop in props) {
    if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
      return true;
    }
  }
};

// ../../../../../../../node_modules/lucide-react/dist/esm/Icon.js
var import_react = __toESM(require_react());

// ../../../../../../../node_modules/lucide-react/dist/esm/defaultAttributes.js
var defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

// ../../../../../../../node_modules/lucide-react/dist/esm/Icon.js
var Icon = (0, import_react.forwardRef)(
  ({
    color = "currentColor",
    size = 24,
    strokeWidth = 2,
    absoluteStrokeWidth,
    className = "",
    children,
    iconNode,
    ...rest
  }, ref) => {
    return (0, import_react.createElement)(
      "svg",
      {
        ref,
        ...defaultAttributes,
        width: size,
        height: size,
        stroke: color,
        strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
        className: mergeClasses("lucide", className),
        ...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
        ...rest
      },
      [
        ...iconNode.map(([tag, attrs]) => (0, import_react.createElement)(tag, attrs)),
        ...Array.isArray(children) ? children : [children]
      ]
    );
  }
);

// ../../../../../../../node_modules/lucide-react/dist/esm/createLucideIcon.js
var createLucideIcon = (iconName, iconNode) => {
  const Component = (0, import_react2.forwardRef)(
    ({ className, ...props }, ref) => (0, import_react2.createElement)(Icon, {
      ref,
      iconNode,
      className: mergeClasses(
        `lucide-${toKebabCase(toPascalCase(iconName))}`,
        `lucide-${iconName}`,
        className
      ),
      ...props
    })
  );
  Component.displayName = toPascalCase(iconName);
  return Component;
};

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/asterisk.js
var __iconNode = [
  ["path", { d: "M12 6v12", key: "1vza4d" }],
  ["path", { d: "M17.196 9 6.804 15", key: "1ah31z" }],
  ["path", { d: "m6.804 9 10.392 6", key: "1b6pxd" }]
];
var Asterisk = createLucideIcon("asterisk", __iconNode);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/check.js
var __iconNode2 = [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]];
var Check = createLucideIcon("check", __iconNode2);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/chevron-right.js
var __iconNode3 = [["path", { d: "m9 18 6-6-6-6", key: "mthhwq" }]];
var ChevronRight = createLucideIcon("chevron-right", __iconNode3);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/ellipsis-vertical.js
var __iconNode4 = [
  ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }],
  ["circle", { cx: "12", cy: "5", r: "1", key: "gxeob9" }],
  ["circle", { cx: "12", cy: "19", r: "1", key: "lyex9k" }]
];
var EllipsisVertical = createLucideIcon("ellipsis-vertical", __iconNode4);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/loader-circle.js
var __iconNode5 = [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }]];
var LoaderCircle = createLucideIcon("loader-circle", __iconNode5);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/lock.js
var __iconNode6 = [
  ["rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2", key: "1w4ew1" }],
  ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4", key: "fwvmzm" }]
];
var Lock = createLucideIcon("lock", __iconNode6);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/move-down.js
var __iconNode7 = [
  ["path", { d: "M8 18L12 22L16 18", key: "cskvfv" }],
  ["path", { d: "M12 2V22", key: "r89rzk" }]
];
var MoveDown = createLucideIcon("move-down", __iconNode7);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/move-left.js
var __iconNode8 = [
  ["path", { d: "M6 8L2 12L6 16", key: "kyvwex" }],
  ["path", { d: "M2 12H22", key: "1m8cig" }]
];
var MoveLeft = createLucideIcon("move-left", __iconNode8);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/move-right.js
var __iconNode9 = [
  ["path", { d: "M18 8L22 12L18 16", key: "1r0oui" }],
  ["path", { d: "M2 12H22", key: "1m8cig" }]
];
var MoveRight = createLucideIcon("move-right", __iconNode9);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/move-up.js
var __iconNode10 = [
  ["path", { d: "M8 6L12 2L16 6", key: "1yvkyx" }],
  ["path", { d: "M12 2V22", key: "r89rzk" }]
];
var MoveUp = createLucideIcon("move-up", __iconNode10);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/plus.js
var __iconNode11 = [
  ["path", { d: "M5 12h14", key: "1ays0h" }],
  ["path", { d: "M12 5v14", key: "s699le" }]
];
var Plus = createLucideIcon("plus", __iconNode11);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/refresh-cw.js
var __iconNode12 = [
  ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", key: "v9h5vc" }],
  ["path", { d: "M21 3v5h-5", key: "1q7to0" }],
  ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", key: "3uifl3" }],
  ["path", { d: "M8 16H3v5", key: "1cv678" }]
];
var RefreshCw = createLucideIcon("refresh-cw", __iconNode12);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/x.js
var __iconNode13 = [
  ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
  ["path", { d: "m6 6 12 12", key: "d8bk6v" }]
];
var X = createLucideIcon("x", __iconNode13);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/ban.js
var __iconNode14 = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "m4.9 4.9 14.2 14.2", key: "1m5liu" }]
];
var Ban = createLucideIcon("ban", __iconNode14);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/chevron-down.js
var __iconNode15 = [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]];
var ChevronDown = createLucideIcon("chevron-down", __iconNode15);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/chevron-left.js
var __iconNode16 = [["path", { d: "m15 18-6-6 6-6", key: "1wnfg3" }]];
var ChevronLeft = createLucideIcon("chevron-left", __iconNode16);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/chevron-up.js
var __iconNode17 = [["path", { d: "m18 15-6-6-6 6", key: "153udz" }]];
var ChevronUp = createLucideIcon("chevron-up", __iconNode17);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/circle-alert.js
var __iconNode18 = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
  ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }]
];
var CircleAlert = createLucideIcon("circle-alert", __iconNode18);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/circle-ellipsis.js
var __iconNode19 = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "M17 12h.01", key: "1m0b6t" }],
  ["path", { d: "M12 12h.01", key: "1mp3jc" }],
  ["path", { d: "M7 12h.01", key: "eqddd0" }]
];
var CircleEllipsis = createLucideIcon("circle-ellipsis", __iconNode19);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/circle-plus.js
var __iconNode20 = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "M8 12h8", key: "1wcyev" }],
  ["path", { d: "M12 8v8", key: "napkw2" }]
];
var CirclePlus = createLucideIcon("circle-plus", __iconNode20);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/copy.js
var __iconNode21 = [
  ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2", key: "17jyea" }],
  ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2", key: "zix9uf" }]
];
var Copy = createLucideIcon("copy", __iconNode21);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/dot.js
var __iconNode22 = [["circle", { cx: "12.1", cy: "12.1", r: "1", key: "18d7e5" }]];
var Dot = createLucideIcon("dot", __iconNode22);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/file-symlink.js
var __iconNode23 = [
  ["path", { d: "m10 18 3-3-3-3", key: "18f6ys" }],
  ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
  [
    "path",
    {
      d: "M4 11V4a2 2 0 0 1 2-2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7",
      key: "50q2rw"
    }
  ]
];
var FileSymlink = createLucideIcon("file-symlink", __iconNode23);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/file-text.js
var __iconNode24 = [
  ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
  ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }],
  ["path", { d: "M10 9H8", key: "b1mrlr" }],
  ["path", { d: "M16 13H8", key: "t4e002" }],
  ["path", { d: "M16 17H8", key: "z1uh3a" }]
];
var FileText = createLucideIcon("file-text", __iconNode24);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/file.js
var __iconNode25 = [
  ["path", { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z", key: "1rqfz7" }],
  ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4", key: "tnqrlb" }]
];
var File = createLucideIcon("file", __iconNode25);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/folder.js
var __iconNode26 = [
  [
    "path",
    {
      d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
      key: "1kt360"
    }
  ]
];
var Folder = createLucideIcon("folder", __iconNode26);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/image.js
var __iconNode27 = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2", key: "1m3agn" }],
  ["circle", { cx: "9", cy: "9", r: "2", key: "af1f0g" }],
  ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21", key: "1xmnt7" }]
];
var Image = createLucideIcon("image", __iconNode27);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/info.js
var __iconNode28 = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "M12 16v-4", key: "1dtifu" }],
  ["path", { d: "M12 8h.01", key: "e9boi3" }]
];
var Info = createLucideIcon("info", __iconNode28);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/message-circle-question.js
var __iconNode29 = [
  ["path", { d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z", key: "vv11sd" }],
  ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", key: "1u773s" }],
  ["path", { d: "M12 17h.01", key: "p32p05" }]
];
var MessageCircleQuestion = createLucideIcon("message-circle-question", __iconNode29);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/pencil.js
var __iconNode30 = [
  [
    "path",
    {
      d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
      key: "1a8usu"
    }
  ],
  ["path", { d: "m15 5 4 4", key: "1mk7zo" }]
];
var Pencil = createLucideIcon("pencil", __iconNode30);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/play.js
var __iconNode31 = [["polygon", { points: "6 3 20 12 6 21 6 3", key: "1oa8hb" }]];
var Play = createLucideIcon("play", __iconNode31);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/rotate-ccw.js
var __iconNode32 = [
  ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "1357e3" }],
  ["path", { d: "M3 3v5h5", key: "1xhq8a" }]
];
var RotateCcw = createLucideIcon("rotate-ccw", __iconNode32);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/square.js
var __iconNode33 = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }]
];
var Square = createLucideIcon("square", __iconNode33);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/text.js
var __iconNode34 = [
  ["path", { d: "M15 18H3", key: "olowqp" }],
  ["path", { d: "M17 6H3", key: "16j9eg" }],
  ["path", { d: "M21 12H3", key: "2avoz0" }]
];
var Text = createLucideIcon("text", __iconNode34);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/trash-2.js
var __iconNode35 = [
  ["path", { d: "M3 6h18", key: "d0wm0j" }],
  ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", key: "4alrt4" }],
  ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", key: "v07s0e" }],
  ["line", { x1: "10", x2: "10", y1: "11", y2: "17", key: "1uufr5" }],
  ["line", { x1: "14", x2: "14", y1: "11", y2: "17", key: "xtxkd" }]
];
var Trash2 = createLucideIcon("trash-2", __iconNode35);

// ../../../../../../../node_modules/lucide-react/dist/esm/icons/triangle-alert.js
var __iconNode36 = [
  [
    "path",
    {
      d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
      key: "wmoenq"
    }
  ],
  ["path", { d: "M12 9v4", key: "juzpu7" }],
  ["path", { d: "M12 17h.01", key: "p32p05" }]
];
var TriangleAlert = createLucideIcon("triangle-alert", __iconNode36);
/*! Bundled license information:

lucide-react/dist/esm/shared/src/utils.js:
lucide-react/dist/esm/defaultAttributes.js:
lucide-react/dist/esm/Icon.js:
lucide-react/dist/esm/createLucideIcon.js:
lucide-react/dist/esm/icons/asterisk.js:
lucide-react/dist/esm/icons/check.js:
lucide-react/dist/esm/icons/chevron-right.js:
lucide-react/dist/esm/icons/ellipsis-vertical.js:
lucide-react/dist/esm/icons/loader-circle.js:
lucide-react/dist/esm/icons/lock.js:
lucide-react/dist/esm/icons/move-down.js:
lucide-react/dist/esm/icons/move-left.js:
lucide-react/dist/esm/icons/move-right.js:
lucide-react/dist/esm/icons/move-up.js:
lucide-react/dist/esm/icons/plus.js:
lucide-react/dist/esm/icons/refresh-cw.js:
lucide-react/dist/esm/icons/x.js:
lucide-react/dist/esm/icons/ban.js:
lucide-react/dist/esm/icons/chevron-down.js:
lucide-react/dist/esm/icons/chevron-left.js:
lucide-react/dist/esm/icons/chevron-up.js:
lucide-react/dist/esm/icons/circle-alert.js:
lucide-react/dist/esm/icons/circle-ellipsis.js:
lucide-react/dist/esm/icons/circle-plus.js:
lucide-react/dist/esm/icons/copy.js:
lucide-react/dist/esm/icons/dot.js:
lucide-react/dist/esm/icons/file-symlink.js:
lucide-react/dist/esm/icons/file-text.js:
lucide-react/dist/esm/icons/file.js:
lucide-react/dist/esm/icons/folder.js:
lucide-react/dist/esm/icons/image.js:
lucide-react/dist/esm/icons/info.js:
lucide-react/dist/esm/icons/message-circle-question.js:
lucide-react/dist/esm/icons/pencil.js:
lucide-react/dist/esm/icons/play.js:
lucide-react/dist/esm/icons/rotate-ccw.js:
lucide-react/dist/esm/icons/square.js:
lucide-react/dist/esm/icons/text.js:
lucide-react/dist/esm/icons/trash-2.js:
lucide-react/dist/esm/icons/triangle-alert.js:
lucide-react/dist/esm/lucide-react.js:
  (**
   * @license lucide-react v0.503.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/

export { Asterisk, Ban, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleAlert, CircleEllipsis, CirclePlus, Copy, Dot, EllipsisVertical, File, FileSymlink, FileText, Folder, Image, Info, LoaderCircle, Lock, MessageCircleQuestion, MoveDown, MoveLeft, MoveRight, MoveUp, Pencil, Play, Plus, RefreshCw, RotateCcw, Square, Text, Trash2, TriangleAlert, X };
