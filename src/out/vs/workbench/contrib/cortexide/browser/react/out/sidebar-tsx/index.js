import { ErrorBoundary_default, SidebarChat } from '../chunk-RM77YOHK.js';
import '../chunk-PT4A2IRQ.js';
import '../chunk-6FX43ENS.js';
import '../chunk-SWVXQVDT.js';
import { require_jsx_runtime, mountFnGenerator, useIsDark } from '../chunk-RJP66NWB.js';
import { __toESM } from '../chunk-JSBRDJBE.js';

// src2/sidebar-tsx/Sidebar.tsx
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var Sidebar = ({ className }) => {
  const isDark = useIsDark();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      className: `void-scope ${isDark ? "void-dark" : ""}`,
      style: { width: "100%", height: "100%" },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          className: ` void-w-full void-h-full void-bg-void-bg-2 void-text-void-fg-1 `,
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `void-w-full void-h-full`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SidebarChat, {}) }) })
        }
      )
    }
  );
};

// src2/sidebar-tsx/index.tsx
var mountSidebar = mountFnGenerator(Sidebar);

export { mountSidebar };
