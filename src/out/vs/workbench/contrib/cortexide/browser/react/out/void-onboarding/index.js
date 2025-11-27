import { ErrorBoundary_default, OneClickSwitchButton, SettingsForProvider, OllamaSetupInstructions, ModelDump } from '../chunk-RM77YOHK.js';
import { Check, Lock, ChevronRight } from '../chunk-PT4A2IRQ.js';
import '../chunk-SWVXQVDT.js';
import { require_react, require_jsx_runtime, mountFnGenerator, useSettingsState, useIsDark, useAccessor } from '../chunk-RJP66NWB.js';
import { __toESM } from '../chunk-JSBRDJBE.js';
import { providerNames, localProviderNames, displayInfoOfProviderName, isFeatureNameDisabled } from 'vs/workbench/contrib/cortexide/browser/common/cortexideSettingsTypes.js';
import { FileAccess } from 'vs/base/common/network.js';

// src2/void-onboarding/VoidOnboarding.tsx
var import_react = __toESM(require_react(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var OVERRIDE_VALUE = false;
FileAccess.asBrowserUri("vs/workbench/browser/media/cortexide-main.png").toString(true);
var welcomeHighlights = [
  "Chat + Quick Edit",
  "Fast Apply diffs",
  "PDF & image uploads",
  "Local & cloud models"
];
var welcomeStats = [
  { label: "Uploads", value: "PDFs + Images", detail: "Drop specs, screenshots, and research straight into chat" },
  { label: "Fast Apply", value: "Line-by-line", detail: "Approve every change from the diff that generated it" },
  { label: "Model router", value: "Auto-switch", detail: "Chooses Anthropic, GPT-4o, Gemini, DeepSeek, or Ollama per task" },
  { label: "Void upgrades", value: "More built-ins", detail: "Fast Apply, attachments, and SCM-aware prompts out of the box" }
];
var VoidOnboarding = () => {
  const voidSettingsState = useSettingsState();
  const isOnboardingComplete = voidSettingsState.globalSettings.isOnboardingComplete || OVERRIDE_VALUE;
  const isDark = useIsDark();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `void-scope ${isDark ? "void-dark" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      className: ` void-fixed void-inset-0 void-z-[99999] void-flex void-items-start void-justify-center void-px-6 void-py-12 void-bg-[#050507] void-backdrop-blur-[28px] void-overflow-y-auto void-transition-all void-duration-700 void-ease-in-out ${isOnboardingComplete ? "void-opacity-0 void-translate-y-4 void-pointer-events-none" : "void-opacity-100 void-pointer-events-auto"} `,
      style: {
        backgroundImage: "radial-gradient(circle at 18% -15%, rgba(255,255,255,0.06), transparent 55%), radial-gradient(circle at 82% 0%, rgba(0,0,0,0.55), transparent 50%)"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-w-full void-max-w-[1200px] void-py-6", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VoidOnboardingContent, {}) }) })
    }
  ) });
};
var VoidIcon = () => {
  const [imageError, setImageError] = (0, import_react.useState)(false);
  const [imageSrc, setImageSrc] = (0, import_react.useState)(() => {
    try {
      return FileAccess.asBrowserUri("vs/workbench/browser/media/cortexide-main.png").toString(true);
    } catch (e) {
      try {
        return FileAccess.asBrowserUri("vs/workbench/browser/media/cortexide-main.png").toString();
      } catch (e2) {
        return "";
      }
    }
  });
  const [retryCount, setRetryCount] = (0, import_react.useState)(0);
  const handleImageError = () => {
    if (retryCount === 0) {
      setRetryCount(1);
      try {
        const altUri = FileAccess.asBrowserUri("vs/workbench/browser/media/cortexide-main.png").toString();
        setImageSrc(altUri);
      } catch (e) {
        setImageError(true);
      }
    } else {
      setImageError(true);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-w-full void-max-w-[220px] void-aspect-square void-rounded-full void-border void-border-white/10 void-bg-black void-shadow-[0_45px_120px_rgba(0,0,0,0.95)] void-overflow-hidden void-flex void-items-center void-justify-center", children: imageError || !imageSrc ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-w-full void-h-full void-flex void-items-center void-justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-text-white/40 void-text-4xl void-font-light", children: "C" }) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "img",
    {
      src: imageSrc,
      alt: "CortexIDE logo",
      className: "void-w-full void-h-full void-object-contain void-opacity-95",
      draggable: false,
      onError: handleImageError,
      onLoad: () => {
        setImageError(false);
      },
      loading: "eager"
    }
  ) });
};
var FADE_DURATION_MS = 2e3;
var FadeIn = ({ children, className, delayMs = 0, durationMs, ...props }) => {
  const [opacity, setOpacity] = (0, import_react.useState)(0);
  const effectiveDurationMs = durationMs ?? FADE_DURATION_MS;
  (0, import_react.useEffect)(() => {
    const timeout = setTimeout(() => {
      setOpacity(1);
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [setOpacity, delayMs]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className, style: { opacity, transition: `opacity ${effectiveDurationMs}ms ease-in-out` }, ...props, children });
};
var tabNames = ["Free", "Paid", "Local"];
var cloudProviders = ["googleVertex", "liteLLM", "microsoftAzure", "awsBedrock", "openAICompatible"];
var providerNamesOfTab = {
  Free: ["gemini", "openRouter"],
  Local: localProviderNames,
  Paid: providerNames.filter((pn) => !["gemini", "openRouter", ...localProviderNames, ...cloudProviders].includes(pn)),
  "Cloud/Other": cloudProviders
};
var descriptionOfTab = {
  Free: `Providers with a 100% free tier. Add as many as you'd like!`,
  Paid: `Connect directly with any provider (bring your own key).`,
  Local: `Active providers should appear automatically. Add as many as you'd like! `,
  "Cloud/Other": `Add as many as you'd like! Reach out for custom configuration requests.`
};
var featureNameMap = [
  { display: "Chat", featureName: "Chat" },
  { display: "Quick Edit", featureName: "Ctrl+K" },
  { display: "Autocomplete", featureName: "Autocomplete" },
  { display: "Fast Apply", featureName: "Apply" },
  { display: "Source Control", featureName: "SCM" }
];
var AddProvidersPage = ({ pageIndex, setPageIndex }) => {
  const [currentTab, setCurrentTab] = (0, import_react.useState)("Free");
  const settingsState = useSettingsState();
  const [errorMessage, setErrorMessage] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    let timeoutId = null;
    if (errorMessage) {
      timeoutId = setTimeout(() => {
        setErrorMessage(null);
      }, 5e3);
    }
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [errorMessage]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-flex-col void-gap-8 void-w-full void-min-h-[75vh] void-max-w-[1000px] void-mx-auto", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-space-y-2 void-text-center md:void-text-left", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "void-text-xs void-uppercase void-tracking-[0.35em] void-text-void-fg-4", children: "Step 02" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "void-text-4xl void-font-light void-text-void-fg-0", children: "Choose your model providers" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "void-text-base void-text-void-fg-3 void-max-w-2xl void-mx-auto md:void-mx-0", children: "Load multiple providers at once. CortexIDE can route Chat, Quick Edit, and Autocomplete to the strongest model on every request." })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-flex-col md:void-flex-row void-flex-1 void-gap-6", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "md:void-w-1/3 void-w-full void-flex void-flex-col void-gap-6 void-p-6 void-rounded-[28px] void-border void-border-void-border-3 void-bg-void-bg-2/70 void-shadow-[0_35px_90px_rgba(0,0,0,0.35)] void-h-full void-overflow-y-auto", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-flex void-flex-wrap md:void-flex-col void-gap-2", children: [...tabNames, "Cloud/Other"].map(
          (tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              className: ` void-w-full void-rounded-2xl void-px-4 void-py-3 void-text-left void-text-sm void-font-medium void-tracking-wide void-transition-all void-duration-200 ${currentTab === tab ? "void-bg-gradient-to-r void-from-[#0e70c0] void-to-[#6b5bff] void-text-white void-shadow-[0_18px_40px_rgba(28,107,219,0.35)]" : "void-bg-void-bg-3/90 void-text-void-fg-2 void-border void-border-void-border-3 hover:void-border-void-border-1"} `,
              onClick: () => {
                setCurrentTab(tab);
                setErrorMessage(null);
              },
              children: tab
            },
            tab
          )
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-grid void-gap-3 void-mt-2 void-text-sm", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "void-uppercase void-text-[11px] void-tracking-[0.4em] void-text-void-fg-4", children: "Feature coverage" }),
          featureNameMap.map(({ display, featureName }) => {
            const hasModel = settingsState.modelSelectionOfFeature[featureName] !== null;
            return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-items-center void-justify-between void-rounded-2xl void-border void-border-void-border-4/80 void-bg-void-bg-3/60 void-px-4 void-py-3", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: display }),
              hasModel ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "void-inline-flex void-items-center void-gap-1 void-text-emerald-400 void-text-xs void-font-medium", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "void-w-4 void-h-4" }),
                " Connected"
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "void-text-xs void-text-void-fg-4", children: "Pending" })
            ] }, featureName);
          })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex-1 void-flex void-flex-col void-rounded-[32px] void-border void-border-void-border-3 void-bg-void-bg-1/70 void-backdrop-blur-xl void-shadow-[0_45px_120px_rgba(0,0,0,0.45)] void-p-6", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-w-full void-max-w-xl void-mx-auto void-text-center void-mb-8 void-space-y-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "void-text-xs void-uppercase void-tracking-[0.35em] void-text-void-fg-4", children: "Active tab" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-text-4xl void-font-light void-text-void-fg-0", children: currentTab }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-text-sm void-text-void-fg-3", children: descriptionOfTab[currentTab] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-space-y-6 void-overflow-y-auto void-pr-1 void-flex-1", children: providerNamesOfTab[currentTab].map(
          (providerName) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-rounded-2xl void-border void-border-void-border-3/80 void-bg-void-bg-3/60 void-p-5 void-shadow-[0_10px_30px_rgba(0,0,0,0.35)]", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-items-center void-justify-between void-mb-3", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-text-xl void-font-medium void-text-void-fg-0 void-flex void-items-center void-gap-2", children: [
                "Add ",
                displayInfoOfProviderName(providerName).title,
                (providerName === "gemini" || providerName === "openRouter") && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "span",
                  {
                    "data-tooltip-id": "void-tooltip-provider-info",
                    "data-tooltip-place": "right",
                    className: "void-text-xs void-text-blue-400",
                    "data-tooltip-content": providerName === "gemini" ? "Gemini 2.5 Pro offers 25 free chats daily, Flash offers ~500. Upgrade later if you exhaust credits." : "OpenRouter grants 50 free chats a day (1000 with a $10 deposit) on models tagged :free.",
                    children: "Details"
                  }
                )
              ] }),
              providerName === "ollama" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "void-inline-flex void-items-center void-gap-1 void-text-xs void-text-void-fg-3", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { size: 12 }),
                " Local"
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsForProvider, { providerName, showProviderTitle: false, showProviderSuggestions: true }),
            providerName === "ollama" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-mt-4 void-rounded-xl void-border void-border-void-border-4/80 void-bg-black/20", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OllamaSetupInstructions, {}) })
          ] }, providerName)
        ) }),
        (currentTab === "Local" || currentTab === "Cloud/Other") && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-w-full void-mt-6 void-rounded-2xl void-border void-border-void-border-4/80 void-bg-void-bg-2/70 void-p-6", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-flex void-items-center void-gap-2 void-mb-4", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-text-xl void-font-medium", children: "Models" }) }),
          currentTab === "Local" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-text-sm void-text-void-fg-3 void-mb-4", children: "Local models auto-detect when possible. Add custom entries to fine tune routing." }),
          currentTab === "Local" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelDump, { filteredProviders: localProviderNames }),
          currentTab === "Cloud/Other" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelDump, { filteredProviders: cloudProviders })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-flex-col void-gap-3 void-items-end void-w-full void-mt-6", children: [
          errorMessage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-w-full void-text-sm void-rounded-2xl void-border void-border-void-warning/30 void-bg-void-warning/15 void-text-void-warning void-px-4 void-py-3 void-text-right", children: errorMessage }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-items-center void-gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviousButton, { onClick: () => setPageIndex(pageIndex - 1) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              NextButton,
              {
                onClick: () => {
                  const isDisabled = isFeatureNameDisabled("Chat", settingsState);
                  if (!isDisabled) {
                    setPageIndex(pageIndex + 1);
                    setErrorMessage(null);
                  } else {
                    setErrorMessage("Please connect at least one Chat-capable model before moving on.");
                  }
                }
              }
            )
          ] })
        ] })
      ] })
    ] })
  ] });
};
var NextButton = ({ onClick, ...props }) => {
  const { disabled, className = "", ...buttonProps } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "button",
    {
      type: "button",
      onClick: disabled ? void 0 : onClick,
      onDoubleClick: onClick,
      className: ` void-inline-flex void-items-center void-gap-2 void-px-6 void-py-2.5 void-rounded-2xl void-font-semibold void-tracking-tight void-transition-all void-duration-300 void-border void-border-white/10 ${disabled ? "void-bg-white/5 void-text-white/35 void-cursor-not-allowed" : "void-bg-gradient-to-r void-from-[#2a2c34] void-via-[#1b1c23] void-to-[#101117] void-text-white void-shadow-[0_25px_55px_rgba(0,0,0,0.55)] hover:void-translate-y-[-1px] hover:void-shadow-[0_30px_70px_rgba(0,0,0,0.65)]"} ${className} `,
      ...disabled && {
        "data-tooltip-id": "void-tooltip",
        "data-tooltip-content": "Please enter all required fields or choose another provider",
        "data-tooltip-place": "top"
      },
      ...buttonProps,
      children: [
        "Next",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "void-w-4 void-h-4" })
      ]
    }
  );
};
var PreviousButton = ({ onClick, ...props }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      onClick,
      className: "void-px-5 void-py-2.5 void-rounded-2xl void-border void-border-white/15 void-bg-white/5 void-text-white/70 hover:void-text-white hover:void-border-white/40 hover:void-bg-white/10 void-transition-all void-duration-200",
      ...props,
      children: "Back"
    }
  );
};
var OnboardingPageShell = ({
  top,
  bottom,
  content,
  hasMaxWidth = true,
  className = ""
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: `void-min-h-[70vh] void-w-full ${className}`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: ` void-text-lg void-flex void-flex-col void-gap-6 void-w-full void-h-full void-mx-auto void-px-8 void-py-10 void-rounded-[32px] void-border void-border-void-border-3 void-bg-void-bg-2/70 void-backdrop-blur-xl void-shadow-[0_30px_90px_rgba(0,0,0,0.45)] ${hasMaxWidth ? "void-max-w-[720px]" : ""} void-max-h-[calc(100vh-6rem)] void-overflow-y-auto `, children: [
    top && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FadeIn, { className: "void-w-full void-mb-auto", children: top }),
    content && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FadeIn, { className: "void-w-full void-my-auto", children: content }),
    bottom && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-w-full void-pt-6", children: bottom })
  ] }) });
};
var WelcomePage = ({ onNext, onSkip }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-space-y-8", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-rounded-[32px] void-border void-border-void-border-2 void-bg-void-bg-2/90 void-backdrop-blur-2xl void-shadow-[0_60px_140px_rgba(0,0,0,0.75)] void-px-10 void-py-12", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-flex-col lg:void-flex-row void-gap-10 void-items-center", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex-1 void-flex void-flex-col void-gap-6 void-text-center lg:void-text-left", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "void-text-xs void-uppercase void-tracking-[0.45em] void-text-void-fg-4", children: "Welcome" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { className: "void-text-5xl void-font-light void-text-void-fg-0", children: "Build with the editor AI actually ships in" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "void-text-base void-text-void-fg-2 void-mt-3 void-max-w-xl void-mx-auto lg:void-mx-0", children: "CortexIDE keeps Chat, Quick Edit, Fast Apply, and source control in the same dark workspace\u2014and it adds native PDF + image uploads so product specs and design mocks travel with every conversation." })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-flex void-flex-wrap void-gap-3 void-justify-center lg:void-justify-start", children: welcomeHighlights.map(
        (highlight) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "void-px-3 void-py-1.5 void-rounded-full void-border void-border-void-border-3 void-bg-void-bg-3/80 void-text-xs void-tracking-[0.3em] void-uppercase void-text-void-fg-3", children: highlight }, highlight)
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-flex-wrap void-gap-3 void-justify-center lg:void-justify-start", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          PrimaryActionButton,
          {
            ringSize: "xl",
            onClick: (e) => {
              e.preventDefault();
              e.stopPropagation();
              onNext();
            },
            className: "void-cursor-pointer active:void-scale-[0.98]",
            children: "Start guided setup"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          SecondaryActionButton,
          {
            onClick: (e) => {
              e.preventDefault();
              e.stopPropagation();
              onSkip();
            },
            className: "void-cursor-pointer active:void-scale-[0.98]",
            children: "Skip for now"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex-1 void-w-full void-flex void-flex-col void-items-center void-gap-6", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-relative void-w-full void-max-w-sm void-aspect-square", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-absolute void-inset-0 void-bg-gradient-to-br void-from-white/10 void-via-transparent void-to-transparent void-blur-3xl void-rounded-[32px]" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-relative void-w-full void-h-full void-rounded-[28px] void-border void-border-void-border-2 void-bg-void-bg-3/80 void-shadow-[0_45px_110px_rgba(0,0,0,0.7)] void-flex void-items-center void-justify-center void-p-6", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VoidIcon, {}) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-grid void-grid-cols-2 void-gap-4 void-w-full void-max-w-sm", children: welcomeStats.map(
        ({ label, value, detail }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-rounded-2xl void-border void-border-void-border-3 void-bg-void-bg-3/80 void-p-4 void-text-center void-text-void-fg-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "void-text-[11px] void-uppercase void-tracking-[0.4em] void-text-void-fg-4", children: label }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "void-text-lg void-font-medium void-text-void-fg-0 void-mt-2", children: value }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "void-text-xs void-text-void-fg-3 void-mt-1", children: detail })
        ] }, label)
      ) })
    ] })
  ] }) }) });
};
var PrimaryActionButton = ({ children, className = "", ringSize, ...props }) => {
  const sizingClass = ringSize === "xl" ? "px-10 py-4 text-lg" : ringSize === "screen" ? "px-16 py-8 text-2xl w-full" : "px-5 py-2.5 text-base";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      className: ` void-inline-flex void-items-center void-justify-center void-gap-2 void-rounded-[18px] void-font-semibold void-tracking-tight void-text-white void-border void-border-white/10 void-bg-gradient-to-r void-from-[#3a3d47] void-via-[#23252c] void-to-[#111216] void-shadow-[0_35px_80px_rgba(0,0,0,0.6)] hover:void-shadow-[0_45px_100px_rgba(0,0,0,0.7)] hover:void-translate-y-[-1px] focus-visible:void-ring-2 focus-visible:void-ring-offset-2 focus-visible:void-ring-white/20 focus-visible:void-ring-offset-[#050612] void-transition-all void-duration-300 ${sizingClass} ${className} `,
      ...props,
      children
    }
  );
};
var SecondaryActionButton = ({ children, className = "", ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "button",
  {
    type: "button",
    className: ` void-inline-flex void-items-center void-justify-center void-gap-2 void-rounded-2xl void-px-5 void-py-2.5 void-border void-border-void-border-2 void-text-void-fg-2 hover:void-text-void-fg-0 hover:void-border-void-border-1 void-transition-all void-duration-200 ${className} `,
    ...props,
    children
  }
);
var VoidOnboardingContent = () => {
  const accessor = useAccessor();
  const cortexideSettingsService = accessor.get("ICortexideSettingsService");
  const voidMetricsService = accessor.get("IMetricsService");
  const voidSettingsState = useSettingsState();
  const [pageIndex, setPageIndex] = (0, import_react.useState)(0);
  const [wantToUseOption, setWantToUseOption] = (0, import_react.useState)("smart");
  const [selectedIntelligentProvider, setSelectedIntelligentProvider] = (0, import_react.useState)("anthropic");
  const [selectedPrivateProvider, setSelectedPrivateProvider] = (0, import_react.useState)("ollama");
  const [selectedAffordableProvider, setSelectedAffordableProvider] = (0, import_react.useState)("gemini");
  const [selectedAllProvider, setSelectedAllProvider] = (0, import_react.useState)("anthropic");
  const getSelectedProvider = () => {
    switch (wantToUseOption) {
      case "smart":
        return selectedIntelligentProvider;
      case "private":
        return selectedPrivateProvider;
      case "cheap":
        return selectedAffordableProvider;
      case "all":
        return selectedAllProvider;
    }
  };
  const providerNamesOfWantToUseOption = {
    smart: ["anthropic", "openAI", "gemini", "openRouter"],
    private: ["ollama", "vLLM", "openAICompatible", "lmStudio"],
    cheap: ["gemini", "deepseek", "openRouter", "ollama", "vLLM"],
    all: providerNames
  };
  const selectedProviderName = getSelectedProvider();
  selectedProviderName && voidSettingsState.settingsOfProvider[selectedProviderName]._didFillInProviderSettings;
  selectedProviderName && voidSettingsState.settingsOfProvider[selectedProviderName].apiKey ? voidSettingsState.settingsOfProvider[selectedProviderName].apiKey.length > 15 : true;
  selectedProviderName && voidSettingsState.settingsOfProvider[selectedProviderName].models.length >= 1;
  const skipOnboarding = (reason) => {
    cortexideSettingsService.setGlobalSetting("isOnboardingComplete", true);
    voidMetricsService.capture("Skipped Onboarding", { reason, pageIndex, wantToUseOption, selectedProviderName });
  };
  const lastPagePrevAndNextButtons = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-max-w-[600px] void-w-full void-mx-auto void-flex void-flex-col void-items-end", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-items-center void-gap-2", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      PreviousButton,
      {
        onClick: () => {
          setPageIndex(pageIndex - 1);
        }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      SecondaryActionButton,
      {
        onClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          skipOnboarding("final-step-skip");
        },
        className: "void-cursor-pointer active:void-scale-[0.98]",
        children: "Skip for now"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      PrimaryActionButton,
      {
        onClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          cortexideSettingsService.setGlobalSetting("isOnboardingComplete", true);
          voidMetricsService.capture("Completed Onboarding", { selectedProviderName, wantToUseOption });
        },
        ringSize: voidSettingsState.globalSettings.isOnboardingComplete ? "screen" : void 0,
        className: "void-cursor-pointer active:void-scale-[0.98]",
        children: "Start with CortexIDE"
      }
    )
  ] }) });
  (0, import_react.useEffect)(() => {
    if (selectedIntelligentProvider === void 0) {
      setSelectedIntelligentProvider(providerNamesOfWantToUseOption["smart"][0]);
    }
    if (selectedPrivateProvider === void 0) {
      setSelectedPrivateProvider(providerNamesOfWantToUseOption["private"][0]);
    }
    if (selectedAffordableProvider === void 0) {
      setSelectedAffordableProvider(providerNamesOfWantToUseOption["cheap"][0]);
    }
    if (selectedAllProvider === void 0) {
      setSelectedAllProvider(providerNamesOfWantToUseOption["all"][0]);
    }
  }, []);
  (0, import_react.useEffect)(() => {
    if (!voidSettingsState.globalSettings.isOnboardingComplete) {
      setPageIndex(0);
    }
  }, [setPageIndex, voidSettingsState.globalSettings.isOnboardingComplete]);
  const contentOfIdx = {
    0: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WelcomePage, { onNext: () => setPageIndex(1), onSkip: () => skipOnboarding("welcome-skip") }),
    1: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      OnboardingPageShell,
      {
        hasMaxWidth: false,
        content: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AddProvidersPage, { pageIndex, setPageIndex })
      }
    ),
    2: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      OnboardingPageShell,
      {
        content: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-text-5xl void-font-light void-text-center", children: "Settings and Themes" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-mt-8 void-text-center void-flex void-flex-col void-items-center void-gap-4 void-w-full void-max-w-md void-mx-auto", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h4", { className: "void-text-void-fg-3 void-mb-4", children: "Transfer your settings from an existing editor?" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OneClickSwitchButton, { className: "void-w-full void-px-4 void-py-2", fromEditor: "VS Code" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OneClickSwitchButton, { className: "void-w-full void-px-4 void-py-2", fromEditor: "Cursor" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OneClickSwitchButton, { className: "void-w-full void-px-4 void-py-2", fromEditor: "Windsurf" })
          ] })
        ] }),
        bottom: lastPagePrevAndNextButtons
      }
    )
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-w-full void-h-[80vh] void-text-left void-mx-auto void-flex void-flex-col void-items-center void-justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ErrorBoundary_default, { children: contentOfIdx[pageIndex] }) }, pageIndex);
};

// src2/void-onboarding/index.tsx
var mountVoidOnboarding = mountFnGenerator(VoidOnboarding);

export { mountVoidOnboarding };
