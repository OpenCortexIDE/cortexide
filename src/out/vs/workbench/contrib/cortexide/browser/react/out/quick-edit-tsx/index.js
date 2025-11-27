import { ErrorBoundary_default, useRefState, VoidChatArea, VoidInputBox2 } from '../chunk-RM77YOHK.js';
import '../chunk-PT4A2IRQ.js';
import '../chunk-SWVXQVDT.js';
import { require_react, require_jsx_runtime, mountFnGenerator, useIsDark, useAccessor, useSettingsState, useCtrlKZoneStreamingState } from '../chunk-RJP66NWB.js';
import { __toESM } from '../chunk-JSBRDJBE.js';
import { CORTEXIDE_CTRL_K_ACTION_ID } from 'vs/workbench/contrib/cortexide/browser/actionIDs.js';
import { isFeatureNameDisabled } from 'vs/workbench/contrib/cortexide/common/cortexideSettingsTypes.js';

// src2/quick-edit-tsx/QuickEditChat.tsx
var import_react = __toESM(require_react(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var QuickEditChat = ({
  diffareaid,
  onChangeHeight,
  onChangeText: onChangeText_,
  textAreaRef: textAreaRef_,
  initText
}) => {
  const accessor = useAccessor();
  const editCodeService = accessor.get("IEditCodeService");
  const sizerRef = (0, import_react.useRef)(null);
  const textAreaRef = (0, import_react.useRef)(null);
  const textAreaFnsRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    const inputContainer = sizerRef.current;
    if (!inputContainer) return;
    let resizeObserver;
    resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      let height;
      if (entries[0].borderBoxSize && entries[0].borderBoxSize.length > 0) {
        height = entries[0].borderBoxSize[0].blockSize;
      } else if (entries[0].contentRect) {
        height = entries[0].contentRect.height;
      } else {
        const target = entries[0].target;
        height = target.clientHeight;
      }
      onChangeHeight(height);
    });
    resizeObserver.observe(inputContainer);
    return () => {
      resizeObserver?.disconnect();
    };
  }, [onChangeHeight]);
  const settingsState = useSettingsState();
  const [instructionsAreEmpty, setInstructionsAreEmpty] = (0, import_react.useState)(!(initText ?? ""));
  const isDisabled = instructionsAreEmpty || !!isFeatureNameDisabled("Ctrl+K", settingsState);
  const [isStreamingRef, setIsStreamingRef] = useRefState(editCodeService.isCtrlKZoneStreaming({ diffareaid }));
  useCtrlKZoneStreamingState((0, import_react.useCallback)((diffareaid2, isStreaming) => {
    if (diffareaid !== diffareaid2) return;
    setIsStreamingRef(isStreaming);
  }, [diffareaid, setIsStreamingRef]));
  const loadingIcon = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      className: "codicon codicon-loading codicon-modifier-spin codicon-no-default-spin void-text-void-fg-3"
    }
  );
  const onSubmit = (0, import_react.useCallback)(async () => {
    if (isDisabled) return;
    if (isStreamingRef.current) return;
    textAreaFnsRef.current?.disable();
    const opts = {
      from: "QuickEdit",
      diffareaid,
      startBehavior: "keep-conflicts"
    };
    await editCodeService.callBeforeApplyOrEdit(opts);
    const [newApplyingUri, applyDonePromise] = editCodeService.startApplying(opts) ?? [];
    applyDonePromise?.catch((e) => {
      if (newApplyingUri) editCodeService.interruptCtrlKStreaming({ diffareaid });
    });
  }, [isStreamingRef, isDisabled, editCodeService, diffareaid]);
  const onInterrupt = (0, import_react.useCallback)(() => {
    if (!isStreamingRef.current) return;
    editCodeService.interruptCtrlKStreaming({ diffareaid });
    textAreaFnsRef.current?.enable();
  }, [isStreamingRef, editCodeService]);
  const onX = (0, import_react.useCallback)(() => {
    onInterrupt();
    editCodeService.removeCtrlKZone({ diffareaid });
  }, [editCodeService, diffareaid]);
  accessor.get("IKeybindingService").lookupKeybinding(CORTEXIDE_CTRL_K_ACTION_ID)?.getLabel();
  const chatAreaRef = (0, import_react.useRef)(null);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { ref: sizerRef, style: { maxWidth: 450 }, className: `void-py-2 void-w-full`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    VoidChatArea,
    {
      featureName: "Ctrl+K",
      divRef: chatAreaRef,
      onSubmit,
      onAbort: onInterrupt,
      onClose: onX,
      isStreaming: isStreamingRef.current,
      loadingIcon,
      isDisabled,
      onClickAnywhere: () => {
        textAreaRef.current?.focus();
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        VoidInputBox2,
        {
          className: "void-px-1",
          initValue: initText,
          ref: (0, import_react.useCallback)((r) => {
            textAreaRef.current = r;
            textAreaRef_(r);
            r?.addEventListener("keydown", (e) => {
              if (e.key === "Escape")
                onX();
            });
          }, [textAreaRef_, onX]),
          fnsRef: textAreaFnsRef,
          placeholder: "Enter instructions...",
          onChangeText: (0, import_react.useCallback)((newStr) => {
            setInstructionsAreEmpty(!newStr);
            onChangeText_(newStr);
          }, [onChangeText_]),
          onKeyDown: (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              onSubmit();
              return;
            }
          },
          multiline: true
        }
      )
    }
  ) });
};

// src2/quick-edit-tsx/QuickEdit.tsx
var import_jsx_runtime2 = __toESM(require_jsx_runtime(), 1);
var QuickEdit = (props) => {
  const isDark = useIsDark();
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: `void-scope ${isDark ? "void-dark" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(QuickEditChat, { ...props }) }) });
};

// src2/quick-edit-tsx/index.tsx
var mountCtrlK = mountFnGenerator(QuickEdit);

export { mountCtrlK };
