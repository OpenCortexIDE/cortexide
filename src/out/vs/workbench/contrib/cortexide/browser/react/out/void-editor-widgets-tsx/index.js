import { MoveRight, MoveUp, MoveDown, MoveLeft, EllipsisVertical, Check, X } from '../chunk-PT4A2IRQ.js';
import '../chunk-6FX43ENS.js';
import { require_react, require_jsx_runtime, mountFnGenerator, useIsDark, useAccessor, useCommandBarState } from '../chunk-RJP66NWB.js';
import { __toESM } from '../chunk-JSBRDJBE.js';
import { CORTEXIDE_GOTO_PREV_DIFF_ACTION_ID, CORTEXIDE_GOTO_NEXT_DIFF_ACTION_ID, CORTEXIDE_GOTO_PREV_URI_ACTION_ID, CORTEXIDE_GOTO_NEXT_URI_ACTION_ID, CORTEXIDE_ACCEPT_FILE_ACTION_ID, CORTEXIDE_REJECT_FILE_ACTION_ID, CORTEXIDE_ACCEPT_ALL_DIFFS_ACTION_ID, CORTEXIDE_REJECT_ALL_DIFFS_ACTION_ID, CORTEXIDE_CTRL_L_ACTION_ID, CORTEXIDE_CTRL_K_ACTION_ID, CORTEXIDE_OPEN_SETTINGS_ACTION_ID } from 'vs/workbench/contrib/cortexide/browser/actionIDs.js';

// src2/void-editor-widgets-tsx/VoidCommandBar.tsx
var import_react = __toESM(require_react(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var VoidCommandBarMain = ({ uri, editor }) => {
  const isDark = useIsDark();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      className: `void-scope ${isDark ? "void-dark" : ""}`,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VoidCommandBar, { uri, editor })
    }
  );
};
var AcceptAllButtonWrapper = ({ text, onClick, className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "button",
  {
    className: ` void-px-2 void-py-0.5 void-flex void-items-center void-gap-1 void-text-white void-text-[11px] void-text-nowrap void-h-full void-rounded-none void-cursor-pointer ${className} `,
    style: {
      backgroundColor: "var(--vscode-button-background)",
      color: "var(--vscode-button-foreground)",
      border: "none"
    },
    type: "button",
    onClick,
    ...props,
    children: text ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: text }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { size: 16 })
  }
);
var RejectAllButtonWrapper = ({ text, onClick, className, ...props }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
  "button",
  {
    className: ` void-px-2 void-py-0.5 void-flex void-items-center void-gap-1 void-text-white void-text-[11px] void-text-nowrap void-h-full void-rounded-none void-cursor-pointer ${className} `,
    style: {
      backgroundColor: "var(--vscode-button-secondaryBackground)",
      color: "var(--vscode-button-secondaryForeground)",
      border: "none"
    },
    type: "button",
    onClick,
    ...props,
    children: text ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: text }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { size: 16 })
  }
);
var VoidCommandBar = ({ uri, editor }) => {
  const accessor = useAccessor();
  const editCodeService = accessor.get("IEditCodeService");
  accessor.get("ICodeEditorService");
  const metricsService = accessor.get("IMetricsService");
  accessor.get("ICommandService");
  const commandBarService = accessor.get("ICortexideCommandBarService");
  accessor.get("ICortexideModelService");
  const keybindingService = accessor.get("IKeybindingService");
  const { stateOfURI: commandBarState, sortedURIs: sortedCommandBarURIs } = useCommandBarState();
  const [showAcceptRejectAllButtons, setShowAcceptRejectAllButtons] = (0, import_react.useState)(false);
  const _latestValidUriIdxRef = (0, import_react.useRef)(null);
  const i_ = sortedCommandBarURIs.findIndex((e) => e.fsPath === uri?.fsPath);
  const currFileIdx = i_ === -1 ? null : i_;
  (0, import_react.useEffect)(() => {
    if (currFileIdx !== null) _latestValidUriIdxRef.current = currFileIdx;
  }, [currFileIdx]);
  currFileIdx !== null ? currFileIdx : _latestValidUriIdxRef.current === null ? null : _latestValidUriIdxRef.current < sortedCommandBarURIs.length ? _latestValidUriIdxRef.current : null;
  (0, import_react.useEffect)(() => {
    setTimeout(() => {
      if (!uri) return;
      const s = commandBarService.stateOfURI[uri.fsPath];
      if (!s) return;
      const { diffIdx } = s;
      commandBarService.goToDiffIdx(diffIdx ?? 0);
    }, 50);
  }, [uri, commandBarService]);
  if (uri?.scheme !== "file") return null;
  const currDiffIdx = uri ? commandBarState[uri.fsPath]?.diffIdx ?? null : null;
  const sortedDiffIds = uri ? commandBarState[uri.fsPath]?.sortedDiffIds ?? [] : [];
  const sortedDiffZoneIds = uri ? commandBarState[uri.fsPath]?.sortedDiffZoneIds ?? [] : [];
  const isADiffInThisFile = sortedDiffIds.length !== 0;
  sortedDiffZoneIds.length !== 0;
  const isADiffZoneInAnyFile = sortedCommandBarURIs.length !== 0;
  const streamState = uri ? commandBarService.getStreamState(uri) : null;
  const showAcceptRejectAll = streamState === "idle-has-changes";
  const nextDiffIdx = commandBarService.getNextDiffIdx(1);
  const prevDiffIdx = commandBarService.getNextDiffIdx(-1);
  const nextURIIdx = commandBarService.getNextUriIdx(1);
  const prevURIIdx = commandBarService.getNextUriIdx(-1);
  const upDownDisabled = prevDiffIdx === null || nextDiffIdx === null;
  const leftRightDisabled = prevURIIdx === null || nextURIIdx === null;
  const onAcceptFile = () => {
    if (!uri) return;
    editCodeService.acceptOrRejectAllDiffAreas({ uri, behavior: "accept", removeCtrlKs: false, _addToHistory: true });
    metricsService.capture("Accept File", {});
  };
  const onRejectFile = () => {
    if (!uri) return;
    editCodeService.acceptOrRejectAllDiffAreas({ uri, behavior: "reject", removeCtrlKs: false, _addToHistory: true });
    metricsService.capture("Reject File", {});
  };
  const onAcceptAll = () => {
    commandBarService.acceptOrRejectAllFiles({ behavior: "accept" });
    metricsService.capture("Accept All", {});
    setShowAcceptRejectAllButtons(false);
  };
  const onRejectAll = () => {
    commandBarService.acceptOrRejectAllFiles({ behavior: "reject" });
    metricsService.capture("Reject All", {});
    setShowAcceptRejectAllButtons(false);
  };
  const _upKeybinding = keybindingService.lookupKeybinding(CORTEXIDE_GOTO_PREV_DIFF_ACTION_ID);
  const _downKeybinding = keybindingService.lookupKeybinding(CORTEXIDE_GOTO_NEXT_DIFF_ACTION_ID);
  const _leftKeybinding = keybindingService.lookupKeybinding(CORTEXIDE_GOTO_PREV_URI_ACTION_ID);
  const _rightKeybinding = keybindingService.lookupKeybinding(CORTEXIDE_GOTO_NEXT_URI_ACTION_ID);
  const _acceptFileKeybinding = keybindingService.lookupKeybinding(CORTEXIDE_ACCEPT_FILE_ACTION_ID);
  const _rejectFileKeybinding = keybindingService.lookupKeybinding(CORTEXIDE_REJECT_FILE_ACTION_ID);
  const _acceptAllKeybinding = keybindingService.lookupKeybinding(CORTEXIDE_ACCEPT_ALL_DIFFS_ACTION_ID);
  const _rejectAllKeybinding = keybindingService.lookupKeybinding(CORTEXIDE_REJECT_ALL_DIFFS_ACTION_ID);
  const upKeybindLabel = editCodeService.processRawKeybindingText(_upKeybinding?.getLabel() || "");
  const downKeybindLabel = editCodeService.processRawKeybindingText(_downKeybinding?.getLabel() || "");
  const leftKeybindLabel = editCodeService.processRawKeybindingText(_leftKeybinding?.getLabel() || "");
  const rightKeybindLabel = editCodeService.processRawKeybindingText(_rightKeybinding?.getLabel() || "");
  const acceptFileKeybindLabel = editCodeService.processRawKeybindingText(_acceptFileKeybinding?.getAriaLabel() || "");
  const rejectFileKeybindLabel = editCodeService.processRawKeybindingText(_rejectFileKeybinding?.getAriaLabel() || "");
  const acceptAllKeybindLabel = editCodeService.processRawKeybindingText(_acceptAllKeybinding?.getAriaLabel() || "");
  const rejectAllKeybindLabel = editCodeService.processRawKeybindingText(_rejectAllKeybinding?.getAriaLabel() || "");
  if (!isADiffZoneInAnyFile) return null;
  if (currFileIdx === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-pointer-events-auto", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-bg-void-bg-2 void-shadow-md void-border void-border-void-border-2 [&>*:first-child]:void-pl-3 [&>*:last-child]:void-pr-3 [&>*]:void-border-r [&>*]:void-border-void-border-2 [&>*:last-child]:void-border-r-0", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-flex void-items-center void-px-3", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "void-text-xs void-whitespace-nowrap", children: `${sortedCommandBarURIs.length} file${sortedCommandBarURIs.length === 1 ? "" : "s"} changed` }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          className: "void-text-xs void-whitespace-nowrap void-cursor-pointer void-flex void-items-center void-justify-center void-gap-1 void-bg-[var(--vscode-button-background)] void-text-[var(--vscode-button-foreground)] hover:void-opacity-90 void-h-full void-px-3",
          onClick: () => commandBarService.goToURIIdx(nextURIIdx),
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              commandBarService.goToURIIdx(nextURIIdx);
            }
          },
          children: [
            "Next ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoveRight, { className: "void-size-3 void-my-1" })
          ]
        }
      )
    ] }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-pointer-events-auto", children: [
    showAcceptRejectAllButtons && showAcceptRejectAll && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-flex void-justify-end void-mb-1", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "void-inline-flex void-bg-void-bg-2 void-rounded void-shadow-md void-border void-border-void-border-2 void-overflow-hidden", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-items-center [&>*]:void-border-r [&>*]:void-border-void-border-2 [&>*:last-child]:void-border-r-0", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        AcceptAllButtonWrapper,
        {
          text: `Accept All`,
          "data-tooltip-id": "void-tooltip",
          "data-tooltip-content": acceptAllKeybindLabel,
          "data-tooltip-delay-show": 500,
          onClick: onAcceptAll
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        RejectAllButtonWrapper,
        {
          text: `Reject All`,
          "data-tooltip-id": "void-tooltip",
          "data-tooltip-content": rejectAllKeybindLabel,
          "data-tooltip-delay-show": 500,
          onClick: onRejectAll
        }
      )
    ] }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-items-center void-bg-void-bg-2 void-rounded void-shadow-md void-border void-border-void-border-2 [&>*:first-child]:void-pl-3 [&>*:last-child]:void-pr-3 [&>*]:void-px-3 [&>*]:void-border-r [&>*]:void-border-void-border-2 [&>*:last-child]:void-border-r-0", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-items-center void-py-0.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            className: "void-cursor-pointer",
            disabled: upDownDisabled,
            onClick: () => commandBarService.goToDiffIdx(prevDiffIdx),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                commandBarService.goToDiffIdx(prevDiffIdx);
              }
            },
            "data-tooltip-id": "void-tooltip",
            "data-tooltip-content": `${upKeybindLabel ? `${upKeybindLabel}` : ""}`,
            "data-tooltip-delay-show": 500,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoveUp, { className: "void-size-3 void-transition-opacity void-duration-200 void-opacity-70 hover:void-opacity-100" })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `void-text-xs void-whitespace-nowrap void-px-1 ${!isADiffInThisFile ? "void-opacity-70" : ""}`, children: isADiffInThisFile ? `Diff ${(currDiffIdx ?? 0) + 1} of ${sortedDiffIds.length}` : streamState === "streaming" ? "No changes yet" : "No changes" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            className: "void-cursor-pointer",
            disabled: upDownDisabled,
            onClick: () => commandBarService.goToDiffIdx(nextDiffIdx),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                commandBarService.goToDiffIdx(nextDiffIdx);
              }
            },
            "data-tooltip-id": "void-tooltip",
            "data-tooltip-content": `${downKeybindLabel ? `${downKeybindLabel}` : ""}`,
            "data-tooltip-delay-show": 500,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoveDown, { className: "void-size-3 void-transition-opacity void-duration-200 void-opacity-70 hover:void-opacity-100" })
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-items-center void-py-0.5", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            className: "void-cursor-pointer",
            disabled: leftRightDisabled,
            onClick: () => commandBarService.goToURIIdx(prevURIIdx),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                commandBarService.goToURIIdx(prevURIIdx);
              }
            },
            "data-tooltip-id": "void-tooltip",
            "data-tooltip-content": `${leftKeybindLabel ? `${leftKeybindLabel}` : ""}`,
            "data-tooltip-delay-show": 500,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoveLeft, { className: "void-size-3 void-transition-opacity void-duration-200 void-opacity-70 hover:void-opacity-100" })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "void-text-xs void-whitespace-nowrap void-px-1 void-mx-0.5", children: currFileIdx !== null ? `File ${currFileIdx + 1} of ${sortedCommandBarURIs.length}` : `${sortedCommandBarURIs.length} file${sortedCommandBarURIs.length === 1 ? "" : "s"}` }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            className: "void-cursor-pointer",
            disabled: leftRightDisabled,
            onClick: () => commandBarService.goToURIIdx(nextURIIdx),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                commandBarService.goToURIIdx(nextURIIdx);
              }
            },
            "data-tooltip-id": "void-tooltip",
            "data-tooltip-content": `${rightKeybindLabel ? `${rightKeybindLabel}` : ""}`,
            "data-tooltip-delay-show": 500,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MoveRight, { className: "void-size-3 void-transition-opacity void-duration-200 void-opacity-70 hover:void-opacity-100" })
          }
        )
      ] }),
      showAcceptRejectAll && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-self-stretch void-gap-0 !void-px-0 !void-py-0", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          AcceptAllButtonWrapper,
          {
            text: `Accept File`,
            "data-tooltip-id": "void-tooltip",
            "data-tooltip-content": acceptFileKeybindLabel,
            "data-tooltip-delay-show": 500,
            onClick: onAcceptFile
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          RejectAllButtonWrapper,
          {
            text: `Reject File`,
            "data-tooltip-id": "void-tooltip",
            "data-tooltip-content": rejectFileKeybindLabel,
            "data-tooltip-delay-show": 500,
            onClick: onRejectFile
          }
        )
      ] }),
      showAcceptRejectAll && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "!void-px-0 !void-py-0 void-self-stretch void-flex void-justify-center void-items-center", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          className: "void-cursor-pointer void-px-1 void-self-stretch void-flex void-justify-center void-items-center",
          onClick: () => setShowAcceptRejectAllButtons(!showAcceptRejectAllButtons),
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            EllipsisVertical,
            {
              className: "void-size-3"
            }
          )
        }
      ) })
    ] })
  ] });
};
var import_react2 = __toESM(require_react(), 1);
var import_jsx_runtime2 = __toESM(require_jsx_runtime(), 1);
var VoidSelectionHelperMain = (props) => {
  const isDark = useIsDark();
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "div",
    {
      className: `void-scope ${isDark ? "void-dark" : ""}`,
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(VoidSelectionHelper, { ...props })
    }
  );
};
var VoidSelectionHelper = ({ rerenderKey }) => {
  const accessor = useAccessor();
  const keybindingService = accessor.get("IKeybindingService");
  const commandService = accessor.get("ICommandService");
  const ctrlLKeybind = keybindingService.lookupKeybinding(CORTEXIDE_CTRL_L_ACTION_ID);
  const ctrlKKeybind = keybindingService.lookupKeybinding(CORTEXIDE_CTRL_K_ACTION_ID);
  const dividerHTML = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "void-w-[0.5px] void-bg-void-border-3" });
  const [reactRerenderCount, setReactRerenderKey] = (0, import_react2.useState)(rerenderKey);
  const [clickState, setClickState] = (0, import_react2.useState)("init");
  (0, import_react2.useEffect)(() => {
    const disposable = commandService.onWillExecuteCommand((e) => {
      if (e.commandId === CORTEXIDE_CTRL_L_ACTION_ID || e.commandId === CORTEXIDE_CTRL_K_ACTION_ID) {
        setClickState("clickedOption");
      }
    });
    return () => {
      disposable.dispose();
    };
  }, [commandService, setClickState]);
  if (reactRerenderCount !== rerenderKey) {
    setReactRerenderKey(rerenderKey);
    setClickState("init");
  }
  if (clickState === "clickedOption") {
    return null;
  }
  const defaultHTML = /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    ctrlLKeybind && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        className: " void-flex void-items-center void-px-2 void-py-1.5 void-cursor-pointer ",
        onClick: () => {
          commandService.executeCommand(CORTEXIDE_CTRL_L_ACTION_ID);
          setClickState("clickedOption");
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "Add to Chat" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "void-ml-1 void-px-1 void-rounded void-bg-[var(--vscode-keybindingLabel-background)] void-text-[var(--vscode-keybindingLabel-foreground)] void-border void-border-[var(--vscode-keybindingLabel-border)]", children: ctrlLKeybind.getLabel() })
        ]
      }
    ),
    ctrlLKeybind && ctrlKKeybind && dividerHTML,
    ctrlKKeybind && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "div",
      {
        className: " void-flex void-items-center void-px-2 void-py-1.5 void-cursor-pointer ",
        onClick: () => {
          commandService.executeCommand(CORTEXIDE_CTRL_K_ACTION_ID);
          setClickState("clickedOption");
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "void-ml-1", children: "Edit Inline" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "void-ml-1 void-px-1 void-rounded void-bg-[var(--vscode-keybindingLabel-background)] void-text-[var(--vscode-keybindingLabel-foreground)] void-border void-border-[var(--vscode-keybindingLabel-border)]", children: ctrlKKeybind.getLabel() })
        ]
      }
    ),
    dividerHTML,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        className: " void-flex void-items-center void-px-0.5 void-cursor-pointer ",
        onClick: () => {
          setClickState("clickedMore");
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EllipsisVertical, { className: "void-w-4" })
      }
    )
  ] });
  const moreOptionsHTML = /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        className: " void-flex void-items-center void-px-2 void-py-1.5 void-cursor-pointer ",
        onClick: () => {
          commandService.executeCommand(CORTEXIDE_OPEN_SETTINGS_ACTION_ID);
          setClickState("clickedOption");
        },
        children: "Disable Suggestions?"
      }
    ),
    dividerHTML,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        className: " void-flex void-items-center void-px-0.5 void-cursor-pointer ",
        onClick: () => {
          setClickState("init");
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EllipsisVertical, { className: "void-w-4" })
      }
    )
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: " void-pointer-events-auto void-select-none void-z-[1000] void-rounded-sm void-shadow-md void-flex void-flex-nowrap void-text-nowrap void-border void-border-void-border-3 void-bg-void-bg-2 void-transition-all void-duration-200 ", children: clickState === "init" ? defaultHTML : clickState === "clickedMore" ? moreOptionsHTML : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, {}) });
};

// src2/void-editor-widgets-tsx/index.tsx
var mountVoidCommandBar = mountFnGenerator(VoidCommandBarMain);
var mountVoidSelectionHelper = mountFnGenerator(VoidSelectionHelperMain);

export { mountVoidCommandBar, mountVoidSelectionHelper };
