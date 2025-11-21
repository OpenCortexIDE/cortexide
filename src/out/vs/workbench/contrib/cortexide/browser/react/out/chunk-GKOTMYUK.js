import { ChevronRight, CircleEllipsis, Check, X, File, TriangleAlert, Ban, Dot, Pencil, CirclePlus, Info, Folder, Text, FileText, ChevronLeft, FileSymlink, Copy, Play, Square, Image as Image$1, Plus, Asterisk, CircleAlert, ChevronUp, ChevronDown, RefreshCw, RotateCcw, LoaderCircle, MessageCircleQuestion, Trash2 } from './chunk-PT4A2IRQ.js';
import { offset, flip, shift, size, isElement, autoUpdate, computePosition } from './chunk-SWVXQVDT.js';
import { require_react, require_jsx_runtime, require_react_dom, useAccessor, useChatThreadsState, useChatThreadsStreamState, useSettingsState, useFullChatThreadsStreamState, useActiveURI, useCommandBarURIListener, useIsDark, useIsOptedOut, useCommandBarState, useMCPServiceState, useRefreshModelState, useRefreshModelListener } from './chunk-RJP66NWB.js';
import { __toESM } from './chunk-JSBRDJBE.js';
import { isFeatureNameDisabled, providerNames, displayInfoOfProviderName, isProviderNameDisabled, customSettingNamesOfProvider, subTextMdOfProviderName, localProviderNames, nonlocalProviderNames, displayInfoOfFeatureName, displayInfoOfSettingName, refreshableProviderNames } from 'vs/workbench/contrib/cortexide/common/cortexideSettingsTypes.js';
import { ScrollType } from 'vs/editor/common/editorCommon.js';
import { convertToVscodeLang, detectLanguage } from 'vs/workbench/contrib/cortexide/common/helpers/languageHelpers.js';
import { URI } from 'vs/base/common/uri.js';
import { isAbsolute } from 'vs/base/common/path.js';
import { separateOutFirstLine } from 'vs/workbench/contrib/cortexide/common/helpers/util.js';
import 'vs/base/browser/ui/inputbox/inputBox.js';
import 'vs/platform/theme/browser/defaultStyles.js';
import 'vs/base/browser/ui/selectBox/selectBox.js';
import 'vs/base/browser/ui/toggle/toggle.js';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditor/codeEditorWidget.js';
import { asCssVariable } from 'vs/platform/theme/common/colorUtils.js';
import { inputForeground, inputBackground } from 'vs/platform/theme/common/colorRegistry.js';
import { DiffEditorWidget } from 'vs/editor/browser/widget/diffEditor/diffEditorWidget.js';
import { extractSearchReplaceBlocks } from 'vs/workbench/contrib/cortexide/common/helpers/extractCodeFromResult.js';
import { errorDetails } from 'vs/workbench/contrib/cortexide/common/sendLLMMessageTypes.js';
import { toErrorMessage } from 'vs/base/common/errorMessage.js';
import { isFeatureNameDisabled as isFeatureNameDisabled$1, isValidProviderModelSelection, modelSelectionsEqual } from 'vs/workbench/contrib/cortexide/common/cortexideSettingsTypes.js';
import { CORTEXIDE_OPEN_SETTINGS_ACTION_ID, CORTEXIDE_CTRL_L_ACTION_ID } from 'vs/workbench/contrib/cortexide/browser/actionIDs.js';
import { modelFilterOfFeatureName } from 'vs/workbench/contrib/cortexide/common/cortexideSettingsService.js';
import { getModelCapabilities, getIsReasoningEnabledState, getReservedOutputTokenSpace, modelOverrideKeys } from 'vs/workbench/contrib/cortexide/common/modelCapabilities.js';
import { approvalTypeOfBuiltinToolName, toolApprovalTypes } from 'vs/workbench/contrib/cortexide/common/toolsServiceTypes.js';
import { isABuiltinToolName, builtinToolNames, MAX_FILE_CHARS_PAGE } from 'vs/workbench/contrib/cortexide/common/prompt/prompts.js';
import { persistentTerminalNameOfId } from 'vs/workbench/contrib/cortexide/browser/terminalToolService.js';
import { removeMCPToolNamePrefix } from 'vs/workbench/contrib/cortexide/common/mcpServiceTypes.js';
import { getPDFService } from 'vs/workbench/contrib/cortexide/common/pdfService.js';
import { os } from 'vs/workbench/contrib/cortexide/common/helpers/systemInfo.js';
import Severity from 'vs/base/common/severity.js';
import { OPT_OUT_KEY } from 'vs/workbench/contrib/cortexide/common/storageKeys.js';
import { StorageScope, StorageTarget } from 'vs/platform/storage/common/storage.js';

// src2/void-settings-tsx/Settings.tsx
var import_react21 = __toESM(require_react(), 1);

// src2/sidebar-tsx/ErrorBoundary.tsx
var import_react20 = __toESM(require_react(), 1);

// src2/sidebar-tsx/SidebarChat.tsx
var import_react19 = __toESM(require_react(), 1);

// src2/markdown/ChatMarkdownRender.tsx
var import_react7 = __toESM(require_react(), 1);

// ../../../../../../../node_modules/marked/lib/marked.esm.js
function _getDefaults() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null
  };
}
var _defaults = _getDefaults();
function changeDefaults(newDefaults) {
  _defaults = newDefaults;
}
var noopTest = { exec: () => null };
function edit(regex, opt = "") {
  let source = typeof regex === "string" ? regex : regex.source;
  const obj = {
    replace: (name, val) => {
      let valSource = typeof val === "string" ? val : val.source;
      valSource = valSource.replace(other.caret, "$1");
      source = source.replace(name, valSource);
      return obj;
    },
    getRegex: () => {
      return new RegExp(source, opt);
    }
  };
  return obj;
}
var other = {
  codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  listReplaceTabs: /^\t+/,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\] /,
  listReplaceTask: /^\[[ xX]\] +/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: (bull) => new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`),
  nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),
  hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
  fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
  headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
  htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i")
};
var newline = /^(?:[ \t]*(?:\n|$))+/;
var blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var bullet = /(?:[*+-]|\d{1,9}[.)])/;
var lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var lheading = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var blockText = /^[^\n]+/;
var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
var def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var html = edit(
  "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))",
  "i"
).replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
var blockNormal = {
  blockquote,
  code: blockCode,
  def,
  fences,
  heading,
  hr,
  html,
  lheading,
  list,
  newline,
  paragraph,
  table: noopTest,
  text: blockText
};
var gfmTable = edit(
  "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)"
).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockGfm = {
  ...blockNormal,
  lheading: lheadingGfm,
  table: gfmTable,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
};
var blockPedantic = {
  ...blockNormal,
  html: edit(
    `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`
  ).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: noopTest,
  // fences not supported
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
};
var escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var br = /^( {2,}|\\)\n(?!\s*$)/;
var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var _punctuation = /[\p{P}\p{S}]/u;
var _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
var punctuation = edit(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, _punctuationOrSpace).getRegex();
var _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
var _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;
var blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
var emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
var emStrongLDelim = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuation).getRegex();
var emStrongLDelimGfm = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimAstCore = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var emStrongRDelimAst = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimUnd = edit(
  "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
  "gu"
).replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var anyPunctuation = edit(/\\(punct)/, "gu").replace(/punct/g, _punctuation).getRegex();
var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
var tag = edit(
  "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>"
).replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
var link = edit(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
var inlineNormal = {
  _backpedal: noopTest,
  // only used for GFM url
  anyPunctuation,
  autolink,
  blockSkip,
  br,
  code: inlineCode,
  del: noopTest,
  emStrongLDelim,
  emStrongRDelimAst,
  emStrongRDelimUnd,
  escape,
  link,
  nolink,
  punctuation,
  reflink,
  reflinkSearch,
  tag,
  text: inlineText,
  url: noopTest
};
var inlinePedantic = {
  ...inlineNormal,
  link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
};
var inlineGfm = {
  ...inlineNormal,
  emStrongRDelimAst: emStrongRDelimAstGfm,
  emStrongLDelim: emStrongLDelimGfm,
  url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
};
var inlineBreaks = {
  ...inlineGfm,
  br: edit(br).replace("{2,}", "*").getRegex(),
  text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
};
var block = {
  normal: blockNormal,
  gfm: blockGfm,
  pedantic: blockPedantic
};
var inline = {
  normal: inlineNormal,
  gfm: inlineGfm,
  breaks: inlineBreaks,
  pedantic: inlinePedantic
};
var escapeReplacements = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
var getEscapeReplacement = (ch) => escapeReplacements[ch];
function escape2(html2, encode) {
  if (encode) {
    if (other.escapeTest.test(html2)) {
      return html2.replace(other.escapeReplace, getEscapeReplacement);
    }
  } else {
    if (other.escapeTestNoEncode.test(html2)) {
      return html2.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
    }
  }
  return html2;
}
function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(other.percentDecode, "%");
  } catch {
    return null;
  }
  return href;
}
function splitCells(tableRow, count2) {
  const row = tableRow.replace(other.findPipe, (match, offset3, str) => {
    let escaped = false;
    let curr = offset3;
    while (--curr >= 0 && str[curr] === "\\") escaped = !escaped;
    if (escaped) {
      return "|";
    } else {
      return " |";
    }
  }), cells = row.split(other.splitPipe);
  let i = 0;
  if (!cells[0].trim()) {
    cells.shift();
  }
  if (cells.length > 0 && !cells.at(-1)?.trim()) {
    cells.pop();
  }
  if (count2) {
    if (cells.length > count2) {
      cells.splice(count2);
    } else {
      while (cells.length < count2) cells.push("");
    }
  }
  for (; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(other.slashPipe, "|");
  }
  return cells;
}
function rtrim(str, c, invert) {
  const l = str.length;
  if (l === 0) {
    return "";
  }
  let suffLen = 0;
  while (suffLen < l) {
    const currChar = str.charAt(l - suffLen - 1);
    if (currChar === c && true) {
      suffLen++;
    } else {
      break;
    }
  }
  return str.slice(0, l - suffLen);
}
function findClosingBracket(str, b) {
  if (str.indexOf(b[1]) === -1) {
    return -1;
  }
  let level = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\\") {
      i++;
    } else if (str[i] === b[0]) {
      level++;
    } else if (str[i] === b[1]) {
      level--;
      if (level < 0) {
        return i;
      }
    }
  }
  if (level > 0) {
    return -2;
  }
  return -1;
}
function outputLink(cap, link2, raw, lexer2, rules) {
  const href = link2.href;
  const title = link2.title || null;
  const text = cap[1].replace(rules.other.outputLinkReplace, "$1");
  lexer2.state.inLink = true;
  const token = {
    type: cap[0].charAt(0) === "!" ? "image" : "link",
    raw,
    href,
    title,
    text,
    tokens: lexer2.inlineTokens(text)
  };
  lexer2.state.inLink = false;
  return token;
}
function indentCodeCompensation(raw, text, rules) {
  const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
  if (matchIndentToCode === null) {
    return text;
  }
  const indentToCode = matchIndentToCode[1];
  return text.split("\n").map((node) => {
    const matchIndentInNode = node.match(rules.other.beginningSpace);
    if (matchIndentInNode === null) {
      return node;
    }
    const [indentInNode] = matchIndentInNode;
    if (indentInNode.length >= indentToCode.length) {
      return node.slice(indentToCode.length);
    }
    return node;
  }).join("\n");
}
var _Tokenizer = class {
  options;
  rules;
  // set by the lexer
  lexer;
  // set by the lexer
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(src) {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) {
      return {
        type: "space",
        raw: cap[0]
      };
    }
  }
  code(src) {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const text = cap[0].replace(this.rules.other.codeRemoveIndent, "");
      return {
        type: "code",
        raw: cap[0],
        codeBlockStyle: "indented",
        text: !this.options.pedantic ? rtrim(text, "\n") : text
      };
    }
  }
  fences(src) {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = indentCodeCompensation(raw, cap[3] || "", this.rules);
      return {
        type: "code",
        raw,
        lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
        text
      };
    }
  }
  heading(src) {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (this.rules.other.endingHash.test(text)) {
        const trimmed = rtrim(text, "#");
        if (this.options.pedantic) {
          text = trimmed.trim();
        } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
          text = trimmed.trim();
        }
      }
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[1].length,
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  hr(src) {
    const cap = this.rules.block.hr.exec(src);
    if (cap) {
      return {
        type: "hr",
        raw: rtrim(cap[0], "\n")
      };
    }
  }
  blockquote(src) {
    const cap = this.rules.block.blockquote.exec(src);
    if (cap) {
      let lines = rtrim(cap[0], "\n").split("\n");
      let raw = "";
      let text = "";
      const tokens = [];
      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];
        let i;
        for (i = 0; i < lines.length; i++) {
          if (this.rules.other.blockquoteStart.test(lines[i])) {
            currentLines.push(lines[i]);
            inBlockquote = true;
          } else if (!inBlockquote) {
            currentLines.push(lines[i]);
          } else {
            break;
          }
        }
        lines = lines.slice(i);
        const currentRaw = currentLines.join("\n");
        const currentText = currentRaw.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
        raw = raw ? `${raw}
${currentRaw}` : currentRaw;
        text = text ? `${text}
${currentText}` : currentText;
        const top = this.lexer.state.top;
        this.lexer.state.top = true;
        this.lexer.blockTokens(currentText, tokens, true);
        this.lexer.state.top = top;
        if (lines.length === 0) {
          break;
        }
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "code") {
          break;
        } else if (lastToken?.type === "blockquote") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.blockquote(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.text.length) + newToken.text;
          break;
        } else if (lastToken?.type === "list") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.list(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.raw.length) + newToken.raw;
          lines = newText.substring(tokens.at(-1).raw.length).split("\n");
          continue;
        }
      }
      return {
        type: "blockquote",
        raw,
        tokens,
        text
      };
    }
  }
  list(src) {
    let cap = this.rules.block.list.exec(src);
    if (cap) {
      let bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list2 = {
        type: "list",
        raw: "",
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : "",
        loose: false,
        items: []
      };
      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
      if (this.options.pedantic) {
        bull = isordered ? bull : "[*+-]";
      }
      const itemRegex = this.rules.other.listItemRegex(bull);
      let endsWithBlankLine = false;
      while (src) {
        let endEarly = false;
        let raw = "";
        let itemContents = "";
        if (!(cap = itemRegex.exec(src))) {
          break;
        }
        if (this.rules.block.hr.test(src)) {
          break;
        }
        raw = cap[0];
        src = src.substring(raw.length);
        let line = cap[2].split("\n", 1)[0].replace(this.rules.other.listReplaceTabs, (t) => " ".repeat(3 * t.length));
        let nextLine = src.split("\n", 1)[0];
        let blankLine = !line.trim();
        let indent = 0;
        if (this.options.pedantic) {
          indent = 2;
          itemContents = line.trimStart();
        } else if (blankLine) {
          indent = cap[1].length + 1;
        } else {
          indent = cap[2].search(this.rules.other.nonSpaceChar);
          indent = indent > 4 ? 1 : indent;
          itemContents = line.slice(indent);
          indent += cap[1].length;
        }
        if (blankLine && this.rules.other.blankLine.test(nextLine)) {
          raw += nextLine + "\n";
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        if (!endEarly) {
          const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
          const hrRegex = this.rules.other.hrRegex(indent);
          const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
          const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
          const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
          while (src) {
            const rawLine = src.split("\n", 1)[0];
            let nextLineWithoutTabs;
            nextLine = rawLine;
            if (this.options.pedantic) {
              nextLine = nextLine.replace(this.rules.other.listReplaceNesting, "  ");
              nextLineWithoutTabs = nextLine;
            } else {
              nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, "    ");
            }
            if (fencesBeginRegex.test(nextLine)) {
              break;
            }
            if (headingBeginRegex.test(nextLine)) {
              break;
            }
            if (htmlBeginRegex.test(nextLine)) {
              break;
            }
            if (nextBulletRegex.test(nextLine)) {
              break;
            }
            if (hrRegex.test(nextLine)) {
              break;
            }
            if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
              itemContents += "\n" + nextLineWithoutTabs.slice(indent);
            } else {
              if (blankLine) {
                break;
              }
              if (line.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4) {
                break;
              }
              if (fencesBeginRegex.test(line)) {
                break;
              }
              if (headingBeginRegex.test(line)) {
                break;
              }
              if (hrRegex.test(line)) {
                break;
              }
              itemContents += "\n" + nextLine;
            }
            if (!blankLine && !nextLine.trim()) {
              blankLine = true;
            }
            raw += rawLine + "\n";
            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }
        if (!list2.loose) {
          if (endsWithBlankLine) {
            list2.loose = true;
          } else if (this.rules.other.doubleBlankLine.test(raw)) {
            endsWithBlankLine = true;
          }
        }
        let istask = null;
        let ischecked;
        if (this.options.gfm) {
          istask = this.rules.other.listIsTask.exec(itemContents);
          if (istask) {
            ischecked = istask[0] !== "[ ] ";
            itemContents = itemContents.replace(this.rules.other.listReplaceTask, "");
          }
        }
        list2.items.push({
          type: "list_item",
          raw,
          task: !!istask,
          checked: ischecked,
          loose: false,
          text: itemContents,
          tokens: []
        });
        list2.raw += raw;
      }
      const lastItem = list2.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        return;
      }
      list2.raw = list2.raw.trimEnd();
      for (let i = 0; i < list2.items.length; i++) {
        this.lexer.state.top = false;
        list2.items[i].tokens = this.lexer.blockTokens(list2.items[i].text, []);
        if (!list2.loose) {
          const spacers = list2.items[i].tokens.filter((t) => t.type === "space");
          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => this.rules.other.anyLine.test(t.raw));
          list2.loose = hasMultipleLineBreaks;
        }
      }
      if (list2.loose) {
        for (let i = 0; i < list2.items.length; i++) {
          list2.items[i].loose = true;
        }
      }
      return list2;
    }
  }
  html(src) {
    const cap = this.rules.block.html.exec(src);
    if (cap) {
      const token = {
        type: "html",
        block: true,
        raw: cap[0],
        pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
        text: cap[0]
      };
      return token;
    }
  }
  def(src) {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      const tag2 = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
      const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
      return {
        type: "def",
        tag: tag2,
        raw: cap[0],
        href,
        title
      };
    }
  }
  table(src) {
    const cap = this.rules.block.table.exec(src);
    if (!cap) {
      return;
    }
    if (!this.rules.other.tableDelimiter.test(cap[2])) {
      return;
    }
    const headers = splitCells(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
    const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [];
    const item = {
      type: "table",
      raw: cap[0],
      header: [],
      align: [],
      rows: []
    };
    if (headers.length !== aligns.length) {
      return;
    }
    for (const align of aligns) {
      if (this.rules.other.tableAlignRight.test(align)) {
        item.align.push("right");
      } else if (this.rules.other.tableAlignCenter.test(align)) {
        item.align.push("center");
      } else if (this.rules.other.tableAlignLeft.test(align)) {
        item.align.push("left");
      } else {
        item.align.push(null);
      }
    }
    for (let i = 0; i < headers.length; i++) {
      item.header.push({
        text: headers[i],
        tokens: this.lexer.inline(headers[i]),
        header: true,
        align: item.align[i]
      });
    }
    for (const row of rows) {
      item.rows.push(splitCells(row, item.header.length).map((cell, i) => {
        return {
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: item.align[i]
        };
      }));
    }
    return item;
  }
  lheading(src) {
    const cap = this.rules.block.lheading.exec(src);
    if (cap) {
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[2].charAt(0) === "=" ? 1 : 2,
        text: cap[1],
        tokens: this.lexer.inline(cap[1])
      };
    }
  }
  paragraph(src) {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
      return {
        type: "paragraph",
        raw: cap[0],
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  text(src) {
    const cap = this.rules.block.text.exec(src);
    if (cap) {
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        tokens: this.lexer.inline(cap[0])
      };
    }
  }
  escape(src) {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) {
      return {
        type: "escape",
        raw: cap[0],
        text: cap[1]
      };
    }
  }
  tag(src) {
    const cap = this.rules.inline.tag.exec(src);
    if (cap) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
        this.lexer.state.inLink = true;
      } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
        this.lexer.state.inLink = false;
      }
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = true;
      } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = false;
      }
      return {
        type: "html",
        raw: cap[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: false,
        text: cap[0]
      };
    }
  }
  link(src) {
    const cap = this.rules.inline.link.exec(src);
    if (cap) {
      const trimmedUrl = cap[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
        if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
          return;
        }
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return;
        }
      } else {
        const lastParenIndex = findClosingBracket(cap[2], "()");
        if (lastParenIndex === -2) {
          return;
        }
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf("!") === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = "";
        }
      }
      let href = cap[2];
      let title = "";
      if (this.options.pedantic) {
        const link2 = this.rules.other.pedanticHrefTitle.exec(href);
        if (link2) {
          href = link2[1];
          title = link2[3];
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : "";
      }
      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
          href = href.slice(1);
        } else {
          href = href.slice(1, -1);
        }
      }
      return outputLink(cap, {
        href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
        title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
      }, cap[0], this.lexer, this.rules);
    }
  }
  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
      const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
      const link2 = links[linkString.toLowerCase()];
      if (!link2) {
        const text = cap[0].charAt(0);
        return {
          type: "text",
          raw: text,
          text
        };
      }
      return outputLink(cap, link2, cap[0], this.lexer, this.rules);
    }
  }
  emStrong(src, maskedSrc, prevChar = "") {
    let match = this.rules.inline.emStrongLDelim.exec(src);
    if (!match) return;
    if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
    const nextChar = match[1] || match[2] || "";
    if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const lLength = [...match[0]].length - 1;
      let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
      const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      endReg.lastIndex = 0;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      while ((match = endReg.exec(maskedSrc)) != null) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = [...rDelim].length;
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6]) {
          if (lLength % 3 && !((lLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue;
          }
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue;
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        if (Math.min(lLength, rLength) % 2) {
          const text2 = raw.slice(1, -1);
          return {
            type: "em",
            raw,
            text: text2,
            tokens: this.lexer.inlineTokens(text2)
          };
        }
        const text = raw.slice(2, -2);
        return {
          type: "strong",
          raw,
          text,
          tokens: this.lexer.inlineTokens(text)
        };
      }
    }
  }
  codespan(src) {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
      const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1);
      }
      return {
        type: "codespan",
        raw: cap[0],
        text
      };
    }
  }
  br(src) {
    const cap = this.rules.inline.br.exec(src);
    if (cap) {
      return {
        type: "br",
        raw: cap[0]
      };
    }
  }
  del(src) {
    const cap = this.rules.inline.del.exec(src);
    if (cap) {
      return {
        type: "del",
        raw: cap[0],
        text: cap[2],
        tokens: this.lexer.inlineTokens(cap[2])
      };
    }
  }
  autolink(src) {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[1];
        href = "mailto:" + text;
      } else {
        text = cap[1];
        href = text;
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  url(src) {
    let cap;
    if (cap = this.rules.inline.url.exec(src)) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[0];
        href = "mailto:" + text;
      } else {
        let prevCapZero;
        do {
          prevCapZero = cap[0];
          cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
        } while (prevCapZero !== cap[0]);
        text = cap[0];
        if (cap[1] === "www.") {
          href = "http://" + cap[0];
        } else {
          href = cap[0];
        }
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  inlineText(src) {
    const cap = this.rules.inline.text.exec(src);
    if (cap) {
      const escaped = this.lexer.state.inRawBlock;
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        escaped
      };
    }
  }
};
var _Lexer = class __Lexer {
  tokens;
  options;
  state;
  tokenizer;
  inlineQueue;
  constructor(options2) {
    this.tokens = [];
    this.tokens.links = /* @__PURE__ */ Object.create(null);
    this.options = options2 || _defaults;
    this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer = this;
    this.inlineQueue = [];
    this.state = {
      inLink: false,
      inRawBlock: false,
      top: true
    };
    const rules = {
      other,
      block: block.normal,
      inline: inline.normal
    };
    if (this.options.pedantic) {
      rules.block = block.pedantic;
      rules.inline = inline.pedantic;
    } else if (this.options.gfm) {
      rules.block = block.gfm;
      if (this.options.breaks) {
        rules.inline = inline.breaks;
      } else {
        rules.inline = inline.gfm;
      }
    }
    this.tokenizer.rules = rules;
  }
  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block,
      inline
    };
  }
  /**
   * Static Lex Method
   */
  static lex(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.lex(src);
  }
  /**
   * Static Lex Inline Method
   */
  static lexInline(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.inlineTokens(src);
  }
  /**
   * Preprocessing
   */
  lex(src) {
    src = src.replace(other.carriageReturn, "\n");
    this.blockTokens(src, this.tokens);
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const next = this.inlineQueue[i];
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }
  blockTokens(src, tokens = [], lastParagraphClipped = false) {
    if (this.options.pedantic) {
      src = src.replace(other.tabCharGlobal, "    ").replace(other.spaceLine, "");
    }
    while (src) {
      let token;
      if (this.options.extensions?.block?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.space(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.raw.length === 1 && lastToken !== void 0) {
          lastToken.raw += "\n";
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.code(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.fences(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.heading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.hr(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.blockquote(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.list(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.html(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.def(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.raw;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else if (!this.tokens.links[token.tag]) {
          this.tokens.links[token.tag] = {
            href: token.href,
            title: token.title
          };
        }
        continue;
      }
      if (token = this.tokenizer.table(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.lheading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startBlock) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startBlock.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
        const lastToken = tokens.at(-1);
        if (lastParagraphClipped && lastToken?.type === "paragraph") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        lastParagraphClipped = cutSrc.length !== src.length;
        src = src.substring(token.raw.length);
        continue;
      }
      if (token = this.tokenizer.text(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    this.state.top = true;
    return tokens;
  }
  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }
  /**
   * Lexing/Compiling
   */
  inlineTokens(src, tokens = []) {
    let maskedSrc = src;
    let match = null;
    if (this.tokens.links) {
      const links = Object.keys(this.tokens.links);
      if (links.length > 0) {
        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
          if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
            maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
          }
        }
      }
    }
    while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    }
    while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    }
    let keepPrevChar = false;
    let prevChar = "";
    while (src) {
      if (!keepPrevChar) {
        prevChar = "";
      }
      keepPrevChar = false;
      let token;
      if (this.options.extensions?.inline?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.escape(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.tag(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.link(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.reflink(src, this.tokens.links)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.type === "text" && lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.codespan(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.br(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.del(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.autolink(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (!this.state.inLink && (token = this.tokenizer.url(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startInline) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startInline.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (token = this.tokenizer.inlineText(cutSrc)) {
        src = src.substring(token.raw.length);
        if (token.raw.slice(-1) !== "_") {
          prevChar = token.raw.slice(-1);
        }
        keepPrevChar = true;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    return tokens;
  }
};
var _Renderer = class {
  options;
  parser;
  // set by the parser
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(token) {
    return "";
  }
  code({ text, lang, escaped }) {
    const langString = (lang || "").match(other.notSpaceStart)?.[0];
    const code = text.replace(other.endingNewline, "") + "\n";
    if (!langString) {
      return "<pre><code>" + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
    }
    return '<pre><code class="language-' + escape2(langString) + '">' + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
  }
  blockquote({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote>
${body}</blockquote>
`;
  }
  html({ text }) {
    return text;
  }
  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
  }
  hr(token) {
    return "<hr>\n";
  }
  list(token) {
    const ordered = token.ordered;
    const start = token.start;
    let body = "";
    for (let j = 0; j < token.items.length; j++) {
      const item = token.items[j];
      body += this.listitem(item);
    }
    const type = ordered ? "ol" : "ul";
    const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
    return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
  }
  listitem(item) {
    let itemBody = "";
    if (item.task) {
      const checkbox = this.checkbox({ checked: !!item.checked });
      if (item.loose) {
        if (item.tokens[0]?.type === "paragraph") {
          item.tokens[0].text = checkbox + " " + item.tokens[0].text;
          if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
            item.tokens[0].tokens[0].text = checkbox + " " + escape2(item.tokens[0].tokens[0].text);
            item.tokens[0].tokens[0].escaped = true;
          }
        } else {
          item.tokens.unshift({
            type: "text",
            raw: checkbox + " ",
            text: checkbox + " ",
            escaped: true
          });
        }
      } else {
        itemBody += checkbox + " ";
      }
    }
    itemBody += this.parser.parse(item.tokens, !!item.loose);
    return `<li>${itemBody}</li>
`;
  }
  checkbox({ checked }) {
    return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
  }
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>
`;
  }
  table(token) {
    let header = "";
    let cell = "";
    for (let j = 0; j < token.header.length; j++) {
      cell += this.tablecell(token.header[j]);
    }
    header += this.tablerow({ text: cell });
    let body = "";
    for (let j = 0; j < token.rows.length; j++) {
      const row = token.rows[j];
      cell = "";
      for (let k = 0; k < row.length; k++) {
        cell += this.tablecell(row[k]);
      }
      body += this.tablerow({ text: cell });
    }
    if (body) body = `<tbody>${body}</tbody>`;
    return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
  }
  tablerow({ text }) {
    return `<tr>
${text}</tr>
`;
  }
  tablecell(token) {
    const content = this.parser.parseInline(token.tokens);
    const type = token.header ? "th" : "td";
    const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
    return tag2 + content + `</${type}>
`;
  }
  /**
   * span level renderer
   */
  strong({ tokens }) {
    return `<strong>${this.parser.parseInline(tokens)}</strong>`;
  }
  em({ tokens }) {
    return `<em>${this.parser.parseInline(tokens)}</em>`;
  }
  codespan({ text }) {
    return `<code>${escape2(text, true)}</code>`;
  }
  br(token) {
    return "<br>";
  }
  del({ tokens }) {
    return `<del>${this.parser.parseInline(tokens)}</del>`;
  }
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return text;
    }
    href = cleanHref;
    let out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + escape2(title) + '"';
    }
    out += ">" + text + "</a>";
    return out;
  }
  image({ href, title, text, tokens }) {
    if (tokens) {
      text = this.parser.parseInline(tokens, this.parser.textRenderer);
    }
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return escape2(text);
    }
    href = cleanHref;
    let out = `<img src="${href}" alt="${text}"`;
    if (title) {
      out += ` title="${escape2(title)}"`;
    }
    out += ">";
    return out;
  }
  text(token) {
    return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : "escaped" in token && token.escaped ? token.text : escape2(token.text);
  }
};
var _TextRenderer = class {
  // no need for block level renderers
  strong({ text }) {
    return text;
  }
  em({ text }) {
    return text;
  }
  codespan({ text }) {
    return text;
  }
  del({ text }) {
    return text;
  }
  html({ text }) {
    return text;
  }
  text({ text }) {
    return text;
  }
  link({ text }) {
    return "" + text;
  }
  image({ text }) {
    return "" + text;
  }
  br() {
    return "";
  }
};
var _Parser = class __Parser {
  options;
  renderer;
  textRenderer;
  constructor(options2) {
    this.options = options2 || _defaults;
    this.options.renderer = this.options.renderer || new _Renderer();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser = this;
    this.textRenderer = new _TextRenderer();
  }
  /**
   * Static Parse Method
   */
  static parse(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parse(tokens);
  }
  /**
   * Static Parse Inline Method
   */
  static parseInline(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parseInline(tokens);
  }
  /**
   * Parse Loop
   */
  parse(tokens, top = true) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const genericToken = anyToken;
        const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
        if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "space": {
          out += this.renderer.space(token);
          continue;
        }
        case "hr": {
          out += this.renderer.hr(token);
          continue;
        }
        case "heading": {
          out += this.renderer.heading(token);
          continue;
        }
        case "code": {
          out += this.renderer.code(token);
          continue;
        }
        case "table": {
          out += this.renderer.table(token);
          continue;
        }
        case "blockquote": {
          out += this.renderer.blockquote(token);
          continue;
        }
        case "list": {
          out += this.renderer.list(token);
          continue;
        }
        case "html": {
          out += this.renderer.html(token);
          continue;
        }
        case "paragraph": {
          out += this.renderer.paragraph(token);
          continue;
        }
        case "text": {
          let textToken = token;
          let body = this.renderer.text(textToken);
          while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
            textToken = tokens[++i];
            body += "\n" + this.renderer.text(textToken);
          }
          if (top) {
            out += this.renderer.paragraph({
              type: "paragraph",
              raw: body,
              text: body,
              tokens: [{ type: "text", raw: body, text: body, escaped: true }]
            });
          } else {
            out += body;
          }
          continue;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
  /**
   * Parse Inline Tokens
   */
  parseInline(tokens, renderer = this.renderer) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
        if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "escape": {
          out += renderer.text(token);
          break;
        }
        case "html": {
          out += renderer.html(token);
          break;
        }
        case "link": {
          out += renderer.link(token);
          break;
        }
        case "image": {
          out += renderer.image(token);
          break;
        }
        case "strong": {
          out += renderer.strong(token);
          break;
        }
        case "em": {
          out += renderer.em(token);
          break;
        }
        case "codespan": {
          out += renderer.codespan(token);
          break;
        }
        case "br": {
          out += renderer.br(token);
          break;
        }
        case "del": {
          out += renderer.del(token);
          break;
        }
        case "text": {
          out += renderer.text(token);
          break;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
};
var _Hooks = class {
  options;
  block;
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  static passThroughHooks = /* @__PURE__ */ new Set([
    "preprocess",
    "postprocess",
    "processAllTokens"
  ]);
  /**
   * Process markdown before marked
   */
  preprocess(markdown) {
    return markdown;
  }
  /**
   * Process HTML after marked is finished
   */
  postprocess(html2) {
    return html2;
  }
  /**
   * Process all tokens before walk tokens
   */
  processAllTokens(tokens) {
    return tokens;
  }
  /**
   * Provide function to tokenize markdown
   */
  provideLexer() {
    return this.block ? _Lexer.lex : _Lexer.lexInline;
  }
  /**
   * Provide function to parse tokens
   */
  provideParser() {
    return this.block ? _Parser.parse : _Parser.parseInline;
  }
};
var Marked = class {
  defaults = _getDefaults();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = _Parser;
  Renderer = _Renderer;
  TextRenderer = _TextRenderer;
  Lexer = _Lexer;
  Tokenizer = _Tokenizer;
  Hooks = _Hooks;
  constructor(...args) {
    this.use(...args);
  }
  /**
   * Run callback for every token
   */
  walkTokens(tokens, callback) {
    let values = [];
    for (const token of tokens) {
      values = values.concat(callback.call(this, token));
      switch (token.type) {
        case "table": {
          const tableToken = token;
          for (const cell of tableToken.header) {
            values = values.concat(this.walkTokens(cell.tokens, callback));
          }
          for (const row of tableToken.rows) {
            for (const cell of row) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
          }
          break;
        }
        case "list": {
          const listToken = token;
          values = values.concat(this.walkTokens(listToken.items, callback));
          break;
        }
        default: {
          const genericToken = token;
          if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
            this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
              const tokens2 = genericToken[childTokens].flat(Infinity);
              values = values.concat(this.walkTokens(tokens2, callback));
            });
          } else if (genericToken.tokens) {
            values = values.concat(this.walkTokens(genericToken.tokens, callback));
          }
        }
      }
    }
    return values;
  }
  use(...args) {
    const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
    args.forEach((pack) => {
      const opts = { ...pack };
      opts.async = this.defaults.async || opts.async || false;
      if (pack.extensions) {
        pack.extensions.forEach((ext) => {
          if (!ext.name) {
            throw new Error("extension name required");
          }
          if ("renderer" in ext) {
            const prevRenderer = extensions.renderers[ext.name];
            if (prevRenderer) {
              extensions.renderers[ext.name] = function(...args2) {
                let ret = ext.renderer.apply(this, args2);
                if (ret === false) {
                  ret = prevRenderer.apply(this, args2);
                }
                return ret;
              };
            } else {
              extensions.renderers[ext.name] = ext.renderer;
            }
          }
          if ("tokenizer" in ext) {
            if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
              throw new Error("extension level must be 'block' or 'inline'");
            }
            const extLevel = extensions[ext.level];
            if (extLevel) {
              extLevel.unshift(ext.tokenizer);
            } else {
              extensions[ext.level] = [ext.tokenizer];
            }
            if (ext.start) {
              if (ext.level === "block") {
                if (extensions.startBlock) {
                  extensions.startBlock.push(ext.start);
                } else {
                  extensions.startBlock = [ext.start];
                }
              } else if (ext.level === "inline") {
                if (extensions.startInline) {
                  extensions.startInline.push(ext.start);
                } else {
                  extensions.startInline = [ext.start];
                }
              }
            }
          }
          if ("childTokens" in ext && ext.childTokens) {
            extensions.childTokens[ext.name] = ext.childTokens;
          }
        });
        opts.extensions = extensions;
      }
      if (pack.renderer) {
        const renderer = this.defaults.renderer || new _Renderer(this.defaults);
        for (const prop in pack.renderer) {
          if (!(prop in renderer)) {
            throw new Error(`renderer '${prop}' does not exist`);
          }
          if (["options", "parser"].includes(prop)) {
            continue;
          }
          const rendererProp = prop;
          const rendererFunc = pack.renderer[rendererProp];
          const prevRenderer = renderer[rendererProp];
          renderer[rendererProp] = (...args2) => {
            let ret = rendererFunc.apply(renderer, args2);
            if (ret === false) {
              ret = prevRenderer.apply(renderer, args2);
            }
            return ret || "";
          };
        }
        opts.renderer = renderer;
      }
      if (pack.tokenizer) {
        const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
        for (const prop in pack.tokenizer) {
          if (!(prop in tokenizer)) {
            throw new Error(`tokenizer '${prop}' does not exist`);
          }
          if (["options", "rules", "lexer"].includes(prop)) {
            continue;
          }
          const tokenizerProp = prop;
          const tokenizerFunc = pack.tokenizer[tokenizerProp];
          const prevTokenizer = tokenizer[tokenizerProp];
          tokenizer[tokenizerProp] = (...args2) => {
            let ret = tokenizerFunc.apply(tokenizer, args2);
            if (ret === false) {
              ret = prevTokenizer.apply(tokenizer, args2);
            }
            return ret;
          };
        }
        opts.tokenizer = tokenizer;
      }
      if (pack.hooks) {
        const hooks = this.defaults.hooks || new _Hooks();
        for (const prop in pack.hooks) {
          if (!(prop in hooks)) {
            throw new Error(`hook '${prop}' does not exist`);
          }
          if (["options", "block"].includes(prop)) {
            continue;
          }
          const hooksProp = prop;
          const hooksFunc = pack.hooks[hooksProp];
          const prevHook = hooks[hooksProp];
          if (_Hooks.passThroughHooks.has(prop)) {
            hooks[hooksProp] = (arg) => {
              if (this.defaults.async) {
                return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                  return prevHook.call(hooks, ret2);
                });
              }
              const ret = hooksFunc.call(hooks, arg);
              return prevHook.call(hooks, ret);
            };
          } else {
            hooks[hooksProp] = (...args2) => {
              let ret = hooksFunc.apply(hooks, args2);
              if (ret === false) {
                ret = prevHook.apply(hooks, args2);
              }
              return ret;
            };
          }
        }
        opts.hooks = hooks;
      }
      if (pack.walkTokens) {
        const walkTokens2 = this.defaults.walkTokens;
        const packWalktokens = pack.walkTokens;
        opts.walkTokens = function(token) {
          let values = [];
          values.push(packWalktokens.call(this, token));
          if (walkTokens2) {
            values = values.concat(walkTokens2.call(this, token));
          }
          return values;
        };
      }
      this.defaults = { ...this.defaults, ...opts };
    });
    return this;
  }
  setOptions(opt) {
    this.defaults = { ...this.defaults, ...opt };
    return this;
  }
  lexer(src, options2) {
    return _Lexer.lex(src, options2 ?? this.defaults);
  }
  parser(tokens, options2) {
    return _Parser.parse(tokens, options2 ?? this.defaults);
  }
  parseMarkdown(blockType) {
    const parse2 = (src, options2) => {
      const origOpt = { ...options2 };
      const opt = { ...this.defaults, ...origOpt };
      const throwError = this.onError(!!opt.silent, !!opt.async);
      if (this.defaults.async === true && origOpt.async === false) {
        return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      }
      if (typeof src === "undefined" || src === null) {
        return throwError(new Error("marked(): input parameter is undefined or null"));
      }
      if (typeof src !== "string") {
        return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
      }
      if (opt.hooks) {
        opt.hooks.options = opt;
        opt.hooks.block = blockType;
      }
      const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
      const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
      if (opt.async) {
        return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html2) => opt.hooks ? opt.hooks.postprocess(html2) : html2).catch(throwError);
      }
      try {
        if (opt.hooks) {
          src = opt.hooks.preprocess(src);
        }
        let tokens = lexer2(src, opt);
        if (opt.hooks) {
          tokens = opt.hooks.processAllTokens(tokens);
        }
        if (opt.walkTokens) {
          this.walkTokens(tokens, opt.walkTokens);
        }
        let html2 = parser2(tokens, opt);
        if (opt.hooks) {
          html2 = opt.hooks.postprocess(html2);
        }
        return html2;
      } catch (e) {
        return throwError(e);
      }
    };
    return parse2;
  }
  onError(silent, async) {
    return (e) => {
      e.message += "\nPlease report this to https://github.com/markedjs/marked.";
      if (silent) {
        const msg = "<p>An error occurred:</p><pre>" + escape2(e.message + "", true) + "</pre>";
        if (async) {
          return Promise.resolve(msg);
        }
        return msg;
      }
      if (async) {
        return Promise.reject(e);
      }
      throw e;
    };
  }
};
var markedInstance = new Marked();
function marked(src, opt) {
  return markedInstance.parse(src, opt);
}
marked.options = marked.setOptions = function(options2) {
  markedInstance.setOptions(options2);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.getDefaults = _getDefaults;
marked.defaults = _defaults;
marked.use = function(...args) {
  markedInstance.use(...args);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.walkTokens = function(tokens, callback) {
  return markedInstance.walkTokens(tokens, callback);
};
marked.parseInline = markedInstance.parseInline;
marked.Parser = _Parser;
marked.parser = _Parser.parse;
marked.Renderer = _Renderer;
marked.TextRenderer = _TextRenderer;
marked.Lexer = _Lexer;
marked.lexer = _Lexer.lex;
marked.Tokenizer = _Tokenizer;
marked.Hooks = _Hooks;
marked.parse = marked;
marked.options;
marked.setOptions;
marked.use;
marked.walkTokens;
marked.parseInline;
_Parser.parse;
_Lexer.lex;

// src2/markdown/ApplyBlockHoverButtons.tsx
var import_react2 = __toESM(require_react(), 1);

// src2/util/helpers.tsx
var import_react = __toESM(require_react(), 1);
var useRefState = (initVal) => {
  const [_s, _setState] = (0, import_react.useState)(0);
  const ref = (0, import_react.useRef)(initVal);
  const setState = (0, import_react.useCallback)((newVal) => {
    _setState((n) => n + 1);
    ref.current = newVal;
  }, []);
  return [ref, setState];
};
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var IconShell1 = ({ onClick, Icon: Icon2, disabled, className, ...props }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      disabled,
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(e);
      },
      className: ` void-size-[18px] void-p-[2px] void-flex void-items-center void-justify-center void-text-sm void-text-void-fg-3 hover:void-brightness-110 disabled:void-opacity-50 disabled:void-cursor-not-allowed ${className} `,
      ...props,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon2, {})
    }
  );
};
var COPY_FEEDBACK_TIMEOUT = 1500;
var CopyButton = ({ codeStr, toolTipName }) => {
  const accessor = useAccessor();
  const metricsService = accessor.get("IMetricsService");
  const clipboardService = accessor.get("IClipboardService");
  const [copyButtonText, setCopyButtonText] = (0, import_react2.useState)("Copy" /* Idle */);
  (0, import_react2.useEffect)(() => {
    if (copyButtonText === "Copy" /* Idle */) return;
    setTimeout(() => {
      setCopyButtonText("Copy" /* Idle */);
    }, COPY_FEEDBACK_TIMEOUT);
  }, [copyButtonText]);
  const onCopy = (0, import_react2.useCallback)(async () => {
    clipboardService.writeText(typeof codeStr === "string" ? codeStr : await codeStr()).then(() => {
      setCopyButtonText("Copied!" /* Copied */);
    }).catch(() => {
      setCopyButtonText("Could not copy" /* Error */);
    });
    metricsService.capture("Copy Code", { length: codeStr.length });
  }, [metricsService, clipboardService, codeStr, setCopyButtonText]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    IconShell1,
    {
      Icon: copyButtonText === "Copied!" /* Copied */ ? Check : copyButtonText === "Could not copy" /* Error */ ? X : Copy,
      onClick: onCopy,
      ...tooltipPropsForApplyBlock({ tooltipName: toolTipName })
    }
  );
};
var JumpToFileButton = ({ uri, ...props }) => {
  const accessor = useAccessor();
  accessor.get("ICommandService");
  const jumpToFileButton = uri !== "current" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    IconShell1,
    {
      Icon: FileSymlink,
      onClick: () => {
        voidOpenFileFn(uri, accessor);
      },
      ...tooltipPropsForApplyBlock({ tooltipName: "Go to file" }),
      ...props
    }
  );
  return jumpToFileButton;
};
var _applyingURIOfApplyBoxIdRef = { current: {} };
var getUriBeingApplied = (applyBoxId) => {
  return _applyingURIOfApplyBoxIdRef.current[applyBoxId] ?? null;
};
var useApplyStreamState = ({ applyBoxId }) => {
  const accessor = useAccessor();
  const cortexideCommandBarService = accessor.get("ICortexideCommandBarService");
  const getStreamState = (0, import_react2.useCallback)(() => {
    const uri = getUriBeingApplied(applyBoxId);
    if (!uri) return "idle-no-changes";
    return cortexideCommandBarService.getStreamState(uri);
  }, [cortexideCommandBarService, applyBoxId]);
  const [currStreamStateRef, setStreamState] = useRefState(getStreamState());
  const setApplying = (0, import_react2.useCallback)((uri) => {
    _applyingURIOfApplyBoxIdRef.current[applyBoxId] = uri ?? void 0;
    setStreamState(getStreamState());
  }, [setStreamState, getStreamState, applyBoxId]);
  useCommandBarURIListener((0, import_react2.useCallback)((uri_) => {
    const uri = getUriBeingApplied(applyBoxId);
    if (uri?.fsPath === uri_.fsPath) {
      setStreamState(getStreamState());
    }
  }, [setStreamState, applyBoxId, getStreamState]));
  return { currStreamStateRef, setApplying };
};
var StatusIndicator = ({ indicatorColor, title, className, ...props }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `void-flex void-flex-row void-text-void-fg-3 void-text-xs void-items-center void-gap-1.5 ${className}`, ...props, children: [
    title && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "void-opacity-80", children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        className: ` void-size-1.5 void-rounded-full void-border ${indicatorColor === "dark" ? "void-bg-[rgba(0,0,0,0)] void-border-void-border-1" : indicatorColor === "orange" ? "void-bg-orange-500 void-border-orange-500 void-shadow-[0_0_4px_0px_rgba(234,88,12,0.6)]" : indicatorColor === "green" ? "void-bg-green-500 void-border-green-500 void-shadow-[0_0_4px_0px_rgba(22,163,74,0.6)]" : indicatorColor === "yellow" ? "void-bg-yellow-500 void-border-yellow-500 void-shadow-[0_0_4px_0px_rgba(22,163,74,0.6)]" : "void-bg-void-border-1 void-border-void-border-1"} `
      }
    )
  ] });
};
var tooltipPropsForApplyBlock = ({ tooltipName, color = void 0, position = "top", offset: offset3 = void 0 }) => ({
  "data-tooltip-id": color === "orange" ? `void-tooltip-orange` : color === "green" ? "void-tooltip-green" : "void-tooltip",
  "data-tooltip-place": position,
  "data-tooltip-content": `${tooltipName}`,
  "data-tooltip-offset": offset3
});
var useEditToolStreamState = ({ applyBoxId, uri }) => {
  const accessor = useAccessor();
  const cortexideCommandBarService = accessor.get("ICortexideCommandBarService");
  const [streamState, setStreamState] = (0, import_react2.useState)(cortexideCommandBarService.getStreamState(uri));
  useCommandBarURIListener((0, import_react2.useCallback)((uri_) => {
    const shouldUpdate = uri.fsPath === uri_.fsPath;
    if (shouldUpdate) {
      setStreamState(cortexideCommandBarService.getStreamState(uri));
    }
  }, [cortexideCommandBarService, applyBoxId, uri]));
  return { streamState };
};
var StatusIndicatorForApplyButton = ({ applyBoxId, uri }) => {
  const { currStreamStateRef } = useApplyStreamState({ applyBoxId });
  const currStreamState = currStreamStateRef.current;
  const color = currStreamState === "idle-no-changes" ? "dark" : currStreamState === "streaming" ? "orange" : currStreamState === "idle-has-changes" ? "green" : null;
  const tooltipName = currStreamState === "idle-no-changes" ? "Done" : currStreamState === "streaming" ? "Applying" : currStreamState === "idle-has-changes" ? "Done" : (
    // also 'Done'? 'Applied' looked bad
    ""
  );
  const statusIndicatorHTML = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    StatusIndicator,
    {
      className: "void-mx-2",
      indicatorColor: color,
      ...tooltipPropsForApplyBlock({ tooltipName, color, position: "top", offset: 12 })
    },
    currStreamState
  );
  return statusIndicatorHTML;
};
var terminalLanguages = /* @__PURE__ */ new Set(
  [
    "bash",
    "shellscript",
    "shell",
    "powershell",
    "bat",
    "zsh",
    "sh",
    "fish",
    "nushell",
    "ksh",
    "xonsh",
    "elvish"
  ]
);
var ApplyButtonsForTerminal = ({
  codeStr,
  applyBoxId,
  uri,
  language
}) => {
  const accessor = useAccessor();
  const metricsService = accessor.get("IMetricsService");
  const terminalToolService = accessor.get("ITerminalToolService");
  useSettingsState();
  const [isShellRunning, setIsShellRunning] = (0, import_react2.useState)(false);
  const interruptToolRef = (0, import_react2.useRef)(null);
  const isDisabled = isShellRunning;
  const onClickSubmit = (0, import_react2.useCallback)(async () => {
    if (isShellRunning) return;
    try {
      setIsShellRunning(true);
      const terminalId = await terminalToolService.createPersistentTerminal({ cwd: null });
      const { interrupt } = await terminalToolService.runCommand(
        codeStr,
        { type: "persistent", persistentTerminalId: terminalId }
      );
      interruptToolRef.current = interrupt;
      metricsService.capture("Execute Shell", { length: codeStr.length });
    } catch (e) {
      setIsShellRunning(false);
      console.error("Failed to execute in terminal:", e);
    }
  }, [codeStr, uri, applyBoxId, metricsService, terminalToolService, isShellRunning]);
  if (isShellRunning) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      IconShell1,
      {
        Icon: X,
        onClick: () => {
          interruptToolRef.current?.();
          setIsShellRunning(false);
        },
        ...tooltipPropsForApplyBlock({ tooltipName: "Stop" })
      }
    );
  }
  if (isDisabled) {
    return null;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    IconShell1,
    {
      Icon: Play,
      onClick: onClickSubmit,
      ...tooltipPropsForApplyBlock({ tooltipName: "Apply" })
    }
  );
};
var ApplyButtonsForEdit = ({
  codeStr,
  applyBoxId,
  uri,
  language
}) => {
  const accessor = useAccessor();
  const editCodeService = accessor.get("IEditCodeService");
  const metricsService = accessor.get("IMetricsService");
  const notificationService2 = accessor.get("INotificationService");
  const settingsState = useSettingsState();
  const isDisabled = !!isFeatureNameDisabled("Apply", settingsState) || !applyBoxId;
  const { currStreamStateRef, setApplying } = useApplyStreamState({ applyBoxId });
  const onClickSubmit = (0, import_react2.useCallback)(async () => {
    if (currStreamStateRef.current === "streaming") return;
    await editCodeService.callBeforeApplyOrEdit(uri);
    const [newApplyingUri, applyDonePromise] = editCodeService.startApplying({
      from: "ClickApply",
      applyStr: codeStr,
      uri,
      startBehavior: "reject-conflicts"
    }) ?? [];
    setApplying(newApplyingUri);
    if (!applyDonePromise) {
      notificationService2.info(`CortexIDE Error: We couldn't run Apply here. ${uri === "current" ? "This Apply block wants to run on the current file, but you might not have a file open." : `This Apply block wants to run on ${uri.fsPath}, but it might not exist.`}`);
    }
    applyDonePromise?.catch((e) => {
      const uri2 = getUriBeingApplied(applyBoxId);
      if (uri2) editCodeService.interruptURIStreaming({ uri: uri2 });
      notificationService2.info(`CortexIDE Error: There was a problem running Apply: ${e}.`);
    });
    metricsService.capture("Apply Code", { length: codeStr.length });
  }, [setApplying, currStreamStateRef, editCodeService, codeStr, uri, applyBoxId, metricsService, notificationService2]);
  const onClickStop = (0, import_react2.useCallback)(() => {
    if (currStreamStateRef.current !== "streaming") return;
    const uri2 = getUriBeingApplied(applyBoxId);
    if (!uri2) return;
    editCodeService.interruptURIStreaming({ uri: uri2 });
    metricsService.capture("Stop Apply", {});
  }, [currStreamStateRef, applyBoxId, editCodeService, metricsService]);
  const onAccept = (0, import_react2.useCallback)(() => {
    const uri2 = getUriBeingApplied(applyBoxId);
    if (uri2) editCodeService.acceptOrRejectAllDiffAreas({ uri: uri2, behavior: "accept", removeCtrlKs: false });
  }, [uri, applyBoxId, editCodeService]);
  const onReject = (0, import_react2.useCallback)(() => {
    const uri2 = getUriBeingApplied(applyBoxId);
    if (uri2) editCodeService.acceptOrRejectAllDiffAreas({ uri: uri2, behavior: "reject", removeCtrlKs: false });
  }, [uri, applyBoxId, editCodeService]);
  const currStreamState = currStreamStateRef.current;
  if (currStreamState === "streaming") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      IconShell1,
      {
        Icon: Square,
        onClick: onClickStop,
        ...tooltipPropsForApplyBlock({ tooltipName: "Stop" })
      }
    );
  }
  if (isDisabled) {
    return null;
  }
  if (currStreamState === "idle-no-changes") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      IconShell1,
      {
        Icon: Play,
        onClick: onClickSubmit,
        ...tooltipPropsForApplyBlock({ tooltipName: "Apply" })
      }
    );
  }
  if (currStreamState === "idle-has-changes") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        IconShell1,
        {
          Icon: X,
          onClick: onReject,
          ...tooltipPropsForApplyBlock({ tooltipName: "Remove" })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        IconShell1,
        {
          Icon: Check,
          onClick: onAccept,
          ...tooltipPropsForApplyBlock({ tooltipName: "Keep" })
        }
      )
    ] });
  }
};
var ApplyButtonsHTML = (params) => {
  const { language } = params;
  const isShellLanguage = !!language && terminalLanguages.has(language);
  if (isShellLanguage) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApplyButtonsForTerminal, { ...params });
  } else {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApplyButtonsForEdit, { ...params });
  }
};
var EditToolAcceptRejectButtonsHTML = ({
  codeStr,
  applyBoxId,
  uri,
  type,
  threadId
}) => {
  const accessor = useAccessor();
  const editCodeService = accessor.get("IEditCodeService");
  accessor.get("IMetricsService");
  const { streamState } = useEditToolStreamState({ applyBoxId, uri });
  const settingsState = useSettingsState();
  const chatThreadsStreamState = useChatThreadsStreamState(threadId);
  const isRunning = chatThreadsStreamState?.isRunning;
  const isDisabled = !!isFeatureNameDisabled("Chat", settingsState) || !applyBoxId;
  const onAccept = (0, import_react2.useCallback)(() => {
    editCodeService.acceptOrRejectAllDiffAreas({ uri, behavior: "accept", removeCtrlKs: false });
  }, [uri, applyBoxId, editCodeService]);
  const onReject = (0, import_react2.useCallback)(() => {
    editCodeService.acceptOrRejectAllDiffAreas({ uri, behavior: "reject", removeCtrlKs: false });
  }, [uri, applyBoxId, editCodeService]);
  if (isDisabled) return null;
  if (streamState === "idle-no-changes") {
    return null;
  }
  if (streamState === "idle-has-changes") {
    if (isRunning === "LLM" || isRunning === "tool") return null;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        IconShell1,
        {
          Icon: X,
          onClick: onReject,
          ...tooltipPropsForApplyBlock({ tooltipName: "Remove" })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        IconShell1,
        {
          Icon: Check,
          onClick: onAccept,
          ...tooltipPropsForApplyBlock({ tooltipName: "Keep" })
        }
      )
    ] });
  }
};
var BlockCodeApplyWrapper = ({
  children,
  codeStr,
  applyBoxId,
  language,
  canApply,
  uri
}) => {
  const accessor = useAccessor();
  accessor.get("ICommandService");
  const { currStreamStateRef } = useApplyStreamState({ applyBoxId });
  const currStreamState = currStreamStateRef.current;
  const name = uri !== "current" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    ListableToolItem,
    {
      name: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "void-not-italic", children: getBasename(uri.fsPath) }),
      isSmall: true,
      showDot: false,
      onClick: () => {
        voidOpenFileFn(uri, accessor);
      }
    }
  ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: language });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-border void-border-void-border-3 void-rounded void-overflow-hidden void-bg-void-bg-3 void-my-1", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: " void-select-none void-flex void-justify-between void-items-center void-py-1 void-px-2 void-border-b void-border-void-border-3 void-cursor-default", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "void-flex void-items-center", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusIndicatorForApplyButton, { uri, applyBoxId }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "void-text-[13px] void-font-light void-text-void-fg-3", children: name })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: `${canApply ? "" : "void-hidden"} void-flex void-items-center void-gap-1`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JumpToFileButton, { uri }),
        currStreamState === "idle-no-changes" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CopyButton, { codeStr, toolTipName: "Copy" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApplyButtonsHTML, { uri, applyBoxId, codeStr, language })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToolChildrenWrapper, { children })
  ] });
};

// src2/util/inputs.tsx
var import_react5 = __toESM(require_react(), 1);

// ../../../../../../../node_modules/@floating-ui/react/dist/floating-ui.react.mjs
var React3 = __toESM(require_react(), 1);

// ../../../../../../../node_modules/@floating-ui/react/dist/floating-ui.react.utils.mjs
var React = __toESM(require_react(), 1);
var import_react3 = __toESM(require_react(), 1);
var isClient = typeof document !== "undefined";
var noop = function noop2() {
};
var index = isClient ? import_react3.useLayoutEffect : noop;
var SafeReact = {
  ...React
};
var useInsertionEffect = SafeReact.useInsertionEffect;
var useSafeInsertionEffect = useInsertionEffect || ((fn) => fn());
function useEffectEvent(callback) {
  const ref = React.useRef(() => {
    {
      throw new Error("Cannot call an event handler while rendering.");
    }
  });
  useSafeInsertionEffect(() => {
    ref.current = callback;
  });
  return React.useCallback(function() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    return ref.current == null ? void 0 : ref.current(...args);
  }, []);
}

// ../../../../../../../node_modules/@floating-ui/react/dist/floating-ui.react.mjs
__toESM(require_jsx_runtime(), 1);
__toESM(require_react_dom(), 1);

// ../../../../../../../node_modules/@floating-ui/react-dom/dist/floating-ui.react-dom.mjs
var React2 = __toESM(require_react(), 1);
var import_react4 = __toESM(require_react(), 1);
var ReactDOM = __toESM(require_react_dom(), 1);
var isClient2 = typeof document !== "undefined";
var noop3 = function noop4() {
};
var index2 = isClient2 ? import_react4.useLayoutEffect : noop3;
function deepEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a === "function" && a.toString() === b.toString()) {
    return true;
  }
  let length;
  let i;
  let keys;
  if (a && b && typeof a === "object") {
    if (Array.isArray(a)) {
      length = a.length;
      if (length !== b.length) return false;
      for (i = length; i-- !== 0; ) {
        if (!deepEqual(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }
    keys = Object.keys(a);
    length = keys.length;
    if (length !== Object.keys(b).length) {
      return false;
    }
    for (i = length; i-- !== 0; ) {
      if (!{}.hasOwnProperty.call(b, keys[i])) {
        return false;
      }
    }
    for (i = length; i-- !== 0; ) {
      const key = keys[i];
      if (key === "_owner" && a.$$typeof) {
        continue;
      }
      if (!deepEqual(a[key], b[key])) {
        return false;
      }
    }
    return true;
  }
  return a !== a && b !== b;
}
function getDPR(element) {
  if (typeof window === "undefined") {
    return 1;
  }
  const win = element.ownerDocument.defaultView || window;
  return win.devicePixelRatio || 1;
}
function roundByDPR(element, value) {
  const dpr = getDPR(element);
  return Math.round(value * dpr) / dpr;
}
function useLatestRef(value) {
  const ref = React2.useRef(value);
  index2(() => {
    ref.current = value;
  });
  return ref;
}
function useFloating(options2) {
  if (options2 === void 0) {
    options2 = {};
  }
  const {
    placement = "bottom",
    strategy = "absolute",
    middleware = [],
    platform: platform2,
    elements: {
      reference: externalReference,
      floating: externalFloating
    } = {},
    transform = true,
    whileElementsMounted,
    open
  } = options2;
  const [data, setData] = React2.useState({
    x: 0,
    y: 0,
    strategy,
    placement,
    middlewareData: {},
    isPositioned: false
  });
  const [latestMiddleware, setLatestMiddleware] = React2.useState(middleware);
  if (!deepEqual(latestMiddleware, middleware)) {
    setLatestMiddleware(middleware);
  }
  const [_reference, _setReference] = React2.useState(null);
  const [_floating, _setFloating] = React2.useState(null);
  const setReference = React2.useCallback((node) => {
    if (node !== referenceRef.current) {
      referenceRef.current = node;
      _setReference(node);
    }
  }, []);
  const setFloating = React2.useCallback((node) => {
    if (node !== floatingRef.current) {
      floatingRef.current = node;
      _setFloating(node);
    }
  }, []);
  const referenceEl = externalReference || _reference;
  const floatingEl = externalFloating || _floating;
  const referenceRef = React2.useRef(null);
  const floatingRef = React2.useRef(null);
  const dataRef = React2.useRef(data);
  const hasWhileElementsMounted = whileElementsMounted != null;
  const whileElementsMountedRef = useLatestRef(whileElementsMounted);
  const platformRef = useLatestRef(platform2);
  const openRef = useLatestRef(open);
  const update = React2.useCallback(() => {
    if (!referenceRef.current || !floatingRef.current) {
      return;
    }
    const config = {
      placement,
      strategy,
      middleware: latestMiddleware
    };
    if (platformRef.current) {
      config.platform = platformRef.current;
    }
    computePosition(referenceRef.current, floatingRef.current, config).then((data2) => {
      const fullData = {
        ...data2,
        // The floating element's position may be recomputed while it's closed
        // but still mounted (such as when transitioning out). To ensure
        // `isPositioned` will be `false` initially on the next open, avoid
        // setting it to `true` when `open === false` (must be specified).
        isPositioned: openRef.current !== false
      };
      if (isMountedRef.current && !deepEqual(dataRef.current, fullData)) {
        dataRef.current = fullData;
        ReactDOM.flushSync(() => {
          setData(fullData);
        });
      }
    });
  }, [latestMiddleware, placement, strategy, platformRef, openRef]);
  index2(() => {
    if (open === false && dataRef.current.isPositioned) {
      dataRef.current.isPositioned = false;
      setData((data2) => ({
        ...data2,
        isPositioned: false
      }));
    }
  }, [open]);
  const isMountedRef = React2.useRef(false);
  index2(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  index2(() => {
    if (referenceEl) referenceRef.current = referenceEl;
    if (floatingEl) floatingRef.current = floatingEl;
    if (referenceEl && floatingEl) {
      if (whileElementsMountedRef.current) {
        return whileElementsMountedRef.current(referenceEl, floatingEl, update);
      }
      update();
    }
  }, [referenceEl, floatingEl, update, whileElementsMountedRef, hasWhileElementsMounted]);
  const refs = React2.useMemo(() => ({
    reference: referenceRef,
    floating: floatingRef,
    setReference,
    setFloating
  }), [setReference, setFloating]);
  const elements = React2.useMemo(() => ({
    reference: referenceEl,
    floating: floatingEl
  }), [referenceEl, floatingEl]);
  const floatingStyles = React2.useMemo(() => {
    const initialStyles = {
      position: strategy,
      left: 0,
      top: 0
    };
    if (!elements.floating) {
      return initialStyles;
    }
    const x = roundByDPR(elements.floating, data.x);
    const y = roundByDPR(elements.floating, data.y);
    if (transform) {
      return {
        ...initialStyles,
        transform: "translate(" + x + "px, " + y + "px)",
        ...getDPR(elements.floating) >= 1.5 && {
          willChange: "transform"
        }
      };
    }
    return {
      position: strategy,
      left: x,
      top: y
    };
  }, [strategy, transform, elements.floating, data.x, data.y]);
  return React2.useMemo(() => ({
    ...data,
    update,
    refs,
    elements,
    floatingStyles
  }), [data, update, refs, elements, floatingStyles]);
}
var offset2 = (options2, deps) => ({
  ...offset(options2),
  options: [options2, deps]
});
var shift2 = (options2, deps) => ({
  ...shift(options2),
  options: [options2, deps]
});
var flip2 = (options2, deps) => ({
  ...flip(options2),
  options: [options2, deps]
});
var size2 = (options2, deps) => ({
  ...size(options2),
  options: [options2, deps]
});
var SafeReact2 = {
  ...React3
};
var serverHandoffComplete = false;
var count = 0;
var genId = () => (
  // Ensure the id is unique with multiple independent versions of Floating UI
  // on <React 18
  "floating-ui-" + Math.random().toString(36).slice(2, 6) + count++
);
function useFloatingId() {
  const [id, setId] = React3.useState(() => serverHandoffComplete ? genId() : void 0);
  index(() => {
    if (id == null) {
      setId(genId());
    }
  }, []);
  React3.useEffect(() => {
    serverHandoffComplete = true;
  }, []);
  return id;
}
var useReactId = SafeReact2.useId;
var useId = useReactId || useFloatingId;
var devMessageSet;
{
  devMessageSet = /* @__PURE__ */ new Set();
}
function error() {
  var _devMessageSet3;
  for (var _len2 = arguments.length, messages = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    messages[_key2] = arguments[_key2];
  }
  const message = "Floating UI: " + messages.join(" ");
  if (!((_devMessageSet3 = devMessageSet) != null && _devMessageSet3.has(message))) {
    var _devMessageSet4;
    (_devMessageSet4 = devMessageSet) == null || _devMessageSet4.add(message);
    console.error(message);
  }
}
function createEventEmitter() {
  const map = /* @__PURE__ */ new Map();
  return {
    emit(event, data) {
      var _map$get;
      (_map$get = map.get(event)) == null || _map$get.forEach((listener) => listener(data));
    },
    on(event, listener) {
      if (!map.has(event)) {
        map.set(event, /* @__PURE__ */ new Set());
      }
      map.get(event).add(listener);
    },
    off(event, listener) {
      var _map$get2;
      (_map$get2 = map.get(event)) == null || _map$get2.delete(listener);
    }
  };
}
var FloatingNodeContext = /* @__PURE__ */ React3.createContext(null);
var FloatingTreeContext = /* @__PURE__ */ React3.createContext(null);
var useFloatingParentNodeId = () => {
  var _React$useContext;
  return ((_React$useContext = React3.useContext(FloatingNodeContext)) == null ? void 0 : _React$useContext.id) || null;
};
var useFloatingTree = () => React3.useContext(FloatingTreeContext);
function useFloatingRootContext(options2) {
  const {
    open = false,
    onOpenChange: onOpenChangeProp,
    elements: elementsProp
  } = options2;
  const floatingId = useId();
  const dataRef = React3.useRef({});
  const [events] = React3.useState(() => createEventEmitter());
  const nested = useFloatingParentNodeId() != null;
  {
    const optionDomReference = elementsProp.reference;
    if (optionDomReference && !isElement(optionDomReference)) {
      error("Cannot pass a virtual element to the `elements.reference` option,", "as it must be a real DOM element. Use `refs.setPositionReference()`", "instead.");
    }
  }
  const [positionReference, setPositionReference] = React3.useState(elementsProp.reference);
  const onOpenChange = useEffectEvent((open2, event, reason) => {
    dataRef.current.openEvent = open2 ? event : void 0;
    events.emit("openchange", {
      open: open2,
      event,
      reason,
      nested
    });
    onOpenChangeProp == null || onOpenChangeProp(open2, event, reason);
  });
  const refs = React3.useMemo(() => ({
    setPositionReference
  }), []);
  const elements = React3.useMemo(() => ({
    reference: positionReference || elementsProp.reference || null,
    floating: elementsProp.floating || null,
    domReference: elementsProp.reference
  }), [positionReference, elementsProp.reference, elementsProp.floating]);
  return React3.useMemo(() => ({
    dataRef,
    open,
    onOpenChange,
    elements,
    events,
    floatingId,
    refs
  }), [open, onOpenChange, elements, events, floatingId, refs]);
}
function useFloating2(options2) {
  if (options2 === void 0) {
    options2 = {};
  }
  const {
    nodeId
  } = options2;
  const internalRootContext = useFloatingRootContext({
    ...options2,
    elements: {
      reference: null,
      floating: null,
      ...options2.elements
    }
  });
  const rootContext = options2.rootContext || internalRootContext;
  const computedElements = rootContext.elements;
  const [_domReference, setDomReference] = React3.useState(null);
  const [positionReference, _setPositionReference] = React3.useState(null);
  const optionDomReference = computedElements == null ? void 0 : computedElements.domReference;
  const domReference = optionDomReference || _domReference;
  const domReferenceRef = React3.useRef(null);
  const tree = useFloatingTree();
  index(() => {
    if (domReference) {
      domReferenceRef.current = domReference;
    }
  }, [domReference]);
  const position = useFloating({
    ...options2,
    elements: {
      ...computedElements,
      ...positionReference && {
        reference: positionReference
      }
    }
  });
  const setPositionReference = React3.useCallback((node) => {
    const computedPositionReference = isElement(node) ? {
      getBoundingClientRect: () => node.getBoundingClientRect(),
      getClientRects: () => node.getClientRects(),
      contextElement: node
    } : node;
    _setPositionReference(computedPositionReference);
    position.refs.setReference(computedPositionReference);
  }, [position.refs]);
  const setReference = React3.useCallback((node) => {
    if (isElement(node) || node === null) {
      domReferenceRef.current = node;
      setDomReference(node);
    }
    if (isElement(position.refs.reference.current) || position.refs.reference.current === null || // Don't allow setting virtual elements using the old technique back to
    // `null` to support `positionReference` + an unstable `reference`
    // callback ref.
    node !== null && !isElement(node)) {
      position.refs.setReference(node);
    }
  }, [position.refs]);
  const refs = React3.useMemo(() => ({
    ...position.refs,
    setReference,
    setPositionReference,
    domReference: domReferenceRef
  }), [position.refs, setReference, setPositionReference]);
  const elements = React3.useMemo(() => ({
    ...position.elements,
    domReference
  }), [position.elements, domReference]);
  const context = React3.useMemo(() => ({
    ...position,
    ...rootContext,
    refs,
    elements,
    nodeId
  }), [position, refs, elements, nodeId, rootContext]);
  index(() => {
    rootContext.dataRef.current.floatingContext = context;
    const node = tree == null ? void 0 : tree.nodesRef.current.find((node2) => node2.id === nodeId);
    if (node) {
      node.context = context;
    }
  });
  return React3.useMemo(() => ({
    ...position,
    context,
    refs,
    elements
  }), [position, refs, elements, context]);
}
var import_jsx_runtime3 = __toESM(require_jsx_runtime(), 1);
var isConstructor = (f) => {
  return !!f.prototype && f.prototype.constructor === f;
};
var WidgetComponent = ({
  ctor,
  propsFn,
  dispose,
  onCreateInstance,
  children,
  className
}) => {
  const containerRef = (0, import_react5.useRef)(null);
  (0, import_react5.useEffect)(() => {
    const instance = isConstructor(ctor) ? new ctor(...propsFn(containerRef.current)) : ctor(containerRef.current);
    const disposables = onCreateInstance(instance);
    return () => {
      disposables.forEach((d) => d.dispose());
      dispose(instance);
    };
  }, [ctor, propsFn, dispose, onCreateInstance, containerRef]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { ref: containerRef, className: className === void 0 ? `void-w-full` : className, children });
};
var isSubsequence = (text, pattern) => {
  text = text.toLowerCase();
  pattern = pattern.toLowerCase();
  if (pattern === "") return true;
  if (text === "") return false;
  if (pattern.length > text.length) return false;
  const seq = Array(pattern.length + 1).fill(null).map(() => Array(text.length + 1).fill(false));
  for (let j = 0; j <= text.length; j++) {
    seq[0][j] = true;
  }
  for (let i = 1; i <= pattern.length; i++) {
    for (let j = 1; j <= text.length; j++) {
      if (pattern[i - 1] === text[j - 1]) {
        seq[i][j] = seq[i - 1][j - 1];
      } else {
        seq[i][j] = seq[i][j - 1];
      }
    }
  }
  return seq[pattern.length][text.length];
};
var scoreSubsequence = (text, pattern) => {
  if (pattern === "") return 0;
  text = text.toLowerCase();
  pattern = pattern.toLowerCase();
  const n = text.length;
  const m = pattern.length;
  let maxConsecutive = 0;
  for (let i = 0; i < n; i++) {
    let consecutiveCount = 0;
    for (let j = 0; j < m; j++) {
      if (i + j < n && text[i + j] === pattern[j]) {
        consecutiveCount++;
      } else {
        break;
      }
    }
    maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
  }
  return maxConsecutive;
};
function getRelativeWorkspacePath(accessor, uri) {
  const workspaceService = accessor.get("IWorkspaceContextService");
  const workspaceFolders = workspaceService.getWorkspace().folders;
  if (!workspaceFolders.length) {
    return uri.fsPath;
  }
  const sortedFolders = [...workspaceFolders].sort(
    (a, b) => b.uri.fsPath.length - a.uri.fsPath.length
  );
  const uriPath = uri.fsPath.endsWith("/") ? uri.fsPath : uri.fsPath + "/";
  for (const folder of sortedFolders) {
    const folderPath = folder.uri.fsPath.endsWith("/") ? folder.uri.fsPath : folder.uri.fsPath + "/";
    if (uriPath.startsWith(folderPath)) {
      let relativePath = uri.fsPath.slice(folder.uri.fsPath.length);
      if (relativePath.startsWith("/")) {
        relativePath = relativePath.slice(1);
      }
      return relativePath;
    }
  }
  return uri.fsPath;
}
var numOptionsToShow = 100;
var getAbbreviatedName = (relativePath) => {
  return getBasename(relativePath, 1);
};
var getOptionsAtPath = async (accessor, path, optionText) => {
  const toolsService = accessor.get("IToolsService");
  const searchForFilesOrFolders = async (t, searchFor) => {
    try {
      const searchResults = (await (await toolsService.callTool.search_pathnames_only({
        query: t,
        includePattern: null,
        pageNumber: 1
      })).result).uris;
      if (searchFor === "files") {
        const res = searchResults.map((uri) => {
          const relativePath = getRelativeWorkspacePath(accessor, uri);
          return {
            leafNodeType: "File",
            uri,
            iconInMenu: File,
            fullName: relativePath,
            abbreviatedName: getAbbreviatedName(relativePath)
          };
        });
        return res;
      } else if (searchFor === "folders") {
        const directoryMap = /* @__PURE__ */ new Map();
        for (const uri of searchResults) {
          if (!uri) continue;
          const relativePath = getRelativeWorkspacePath(accessor, uri);
          const pathParts = relativePath.split("/");
          const workspaceService = accessor.get("IWorkspaceContextService");
          const workspaceFolders = workspaceService.getWorkspace().folders;
          let workspaceFolderUri;
          if (workspaceFolders.length) {
            const sortedFolders = [...workspaceFolders].sort(
              (a, b) => b.uri.fsPath.length - a.uri.fsPath.length
            );
            for (const folder of sortedFolders) {
              const folderPath = folder.uri.fsPath.endsWith("/") ? folder.uri.fsPath : folder.uri.fsPath + "/";
              const uriPath = uri.fsPath.endsWith("/") ? uri.fsPath : uri.fsPath + "/";
              if (uriPath.startsWith(folderPath)) {
                workspaceFolderUri = folder.uri;
                break;
              }
            }
          }
          if (workspaceFolderUri) {
            let currentPath = "";
            for (let i = 0; i < pathParts.length - 1; i++) {
              currentPath = i === 0 ? `/${pathParts[i]}` : `${currentPath}/${pathParts[i]}`;
              const directoryUri = URI.joinPath(
                workspaceFolderUri,
                currentPath.startsWith("/") ? currentPath.substring(1) : currentPath
              );
              directoryMap.set(currentPath, directoryUri);
            }
          }
        }
        return Array.from(directoryMap.entries()).map(([relativePath, uri]) => ({
          leafNodeType: "Folder",
          uri,
          iconInMenu: Folder,
          // Folder
          fullName: relativePath,
          abbreviatedName: getAbbreviatedName(relativePath)
        }));
      }
    } catch (error2) {
      console.error("Error fetching directories:", error2);
      return [];
    }
  };
  const allOptions = [
    {
      fullName: "selection",
      abbreviatedName: "selection",
      iconInMenu: File,
      generateNextOptions: async (_t) => {
        try {
          const editorService = accessor.get("IEditorService");
          const languageService = accessor.get("ILanguageService");
          const active = editorService.activeTextEditorControl;
          const activeResource = editorService.activeEditor?.resource;
          const sel = active?.getSelection?.();
          if (activeResource && sel && !sel.isEmpty()) {
            const basename = getAbbreviatedName(getRelativeWorkspacePath(accessor, activeResource));
            const label = `${basename}:${sel.startLineNumber}-${sel.endLineNumber}`;
            return [{
              leafNodeType: "File",
              uri: activeResource,
              range: sel,
              iconInMenu: File,
              fullName: label,
              abbreviatedName: "selection"
            }];
          }
        } catch {
        }
        return [];
      }
    },
    {
      fullName: "recent",
      abbreviatedName: "recent",
      iconInMenu: File,
      generateNextOptions: async (t) => {
        try {
          const historyService = accessor.get("IHistoryService");
          const items = historyService.getHistory().filter((h) => h.resource).map((h) => h.resource);
          const options2 = items.map((uri) => {
            const relativePath = getRelativeWorkspacePath(accessor, uri);
            return {
              leafNodeType: "File",
              uri,
              iconInMenu: File,
              fullName: relativePath,
              abbreviatedName: getAbbreviatedName(relativePath)
            };
          });
          return options2.filter((o) => isSubsequence(o.fullName, t));
        } catch {
          return [];
        }
      }
    },
    {
      fullName: "workspace",
      abbreviatedName: "workspace",
      iconInMenu: Folder,
      generateNextOptions: async (_t) => {
        try {
          const workspaceService = accessor.get("IWorkspaceContextService");
          return workspaceService.getWorkspace().folders.map((f) => ({
            leafNodeType: "Folder",
            uri: f.uri,
            iconInMenu: Folder,
            fullName: getRelativeWorkspacePath(accessor, f.uri) || "/",
            abbreviatedName: getFolderName(getRelativeWorkspacePath(accessor, f.uri) || "/")
          }));
        } catch {
          return [];
        }
      }
    },
    {
      fullName: "files",
      abbreviatedName: "files",
      iconInMenu: File,
      generateNextOptions: async (t) => await searchForFilesOrFolders(t, "files") || []
    },
    {
      fullName: "folders",
      abbreviatedName: "folders",
      iconInMenu: Folder,
      generateNextOptions: async (t) => await searchForFilesOrFolders(t, "folders") || []
    }
  ];
  let nextOptionsAtPath = allOptions;
  let generateNextOptionsAtPath = void 0;
  for (const pn of path) {
    const selectedOption = nextOptionsAtPath.find((o) => o.fullName.toLowerCase() === pn.toLowerCase());
    if (!selectedOption) return [];
    nextOptionsAtPath = selectedOption.nextOptions;
    generateNextOptionsAtPath = selectedOption.generateNextOptions;
  }
  if (generateNextOptionsAtPath) {
    nextOptionsAtPath = await generateNextOptionsAtPath(optionText);
  } else if (path.length === 0 && optionText.trim().length > 0) {
    const filesResults = await searchForFilesOrFolders(optionText, "files") || [];
    const foldersResults = await searchForFilesOrFolders(optionText, "folders") || [];
    nextOptionsAtPath = [...foldersResults, ...filesResults];
  }
  const optionsAtPath = nextOptionsAtPath.filter((o) => isSubsequence(o.fullName, optionText)).sort((a, b) => {
    const scoreA = scoreSubsequence(a.fullName, optionText);
    const scoreB = scoreSubsequence(b.fullName, optionText);
    return scoreB - scoreA;
  }).slice(0, numOptionsToShow);
  return optionsAtPath;
};
var VoidInputBox2 = (0, import_react5.forwardRef)(function X2({ initValue, placeholder, multiline, enableAtToMention, fnsRef, className = "", appearance = "default", style, onKeyDown, onFocus, onBlur, onChangeText }, ref) {
  const accessor = useAccessor();
  const chatThreadService = accessor.get("IChatThreadService");
  const languageService = accessor.get("ILanguageService");
  const textAreaRef = (0, import_react5.useRef)(null);
  const selectedOptionRef = (0, import_react5.useRef)(null);
  const [isMenuOpen, _setIsMenuOpen] = (0, import_react5.useState)(false);
  const setIsMenuOpen = (value) => {
    if (!enableAtToMention) {
      return;
    }
    _setIsMenuOpen(value);
  };
  const [optionPath, setOptionPath] = (0, import_react5.useState)([]);
  const [optionIdx, setOptionIdx] = (0, import_react5.useState)(0);
  const [options2, setOptions2] = (0, import_react5.useState)([]);
  const [optionText, setOptionText] = (0, import_react5.useState)("");
  const [didLoadInitialOptions, setDidLoadInitialOptions] = (0, import_react5.useState)(false);
  const currentPathRef = (0, import_react5.useRef)(JSON.stringify([]));
  const isBreadcrumbsShowing = optionPath.length === 0 && !optionText ? false : true;
  const insertTextAtCursor = (text) => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    textarea.focus();
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const textBeforeCursor = textarea.value.substring(0, startPos - 1);
    const textAfterCursor = textarea.value.substring(endPos);
    textarea.value = textBeforeCursor + textAfterCursor;
    const newCursorPos = textBeforeCursor.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    if (onChangeText) {
      onChangeText(textarea.value);
    }
    adjustHeight();
  };
  const onSelectOption = async () => {
    if (!options2.length) {
      return;
    }
    const option = options2[optionIdx];
    const newPath = [...optionPath, option.fullName];
    const isLastOption = !option.generateNextOptions && !option.nextOptions;
    setDidLoadInitialOptions(false);
    if (isLastOption) {
      setIsMenuOpen(false);
      insertTextAtCursor(option.abbreviatedName);
      let newSelection;
      if (option.leafNodeType === "File") newSelection = {
        type: "File",
        uri: option.uri,
        language: languageService.guessLanguageIdByFilepathOrFirstLine(option.uri) || "",
        state: { wasAddedAsCurrentFile: false }
      };
      else if (option.leafNodeType === "Folder") newSelection = {
        type: "Folder",
        uri: option.uri,
        language: void 0,
        state: void 0
      };
      else
        throw new Error(`Unexpected leafNodeType ${option.leafNodeType}`);
      chatThreadService.addNewStagingSelection(newSelection);
    } else {
      currentPathRef.current = JSON.stringify(newPath);
      const newOpts = await getOptionsAtPath(accessor, newPath, "") || [];
      if (currentPathRef.current !== JSON.stringify(newPath)) {
        return;
      }
      setOptionPath(newPath);
      setOptionText("");
      setOptionIdx(0);
      setOptions2(newOpts);
      setDidLoadInitialOptions(true);
    }
  };
  const onRemoveOption = async () => {
    const newPath = [...optionPath.slice(0, optionPath.length - 1)];
    currentPathRef.current = JSON.stringify(newPath);
    const newOpts = await getOptionsAtPath(accessor, newPath, "") || [];
    if (currentPathRef.current !== JSON.stringify(newPath)) {
      return;
    }
    setOptionPath(newPath);
    setOptionText("");
    setOptionIdx(0);
    setOptions2(newOpts);
  };
  const onOpenOptionMenu = async () => {
    const newPath = [];
    currentPathRef.current = JSON.stringify([]);
    const newOpts = await getOptionsAtPath(accessor, [], "") || [];
    if (currentPathRef.current !== JSON.stringify([])) {
      return;
    }
    setOptionPath(newPath);
    setOptionText("");
    setIsMenuOpen(true);
    setOptionIdx(0);
    setOptions2(newOpts);
  };
  const onCloseOptionMenu = () => {
    setIsMenuOpen(false);
  };
  const onNavigateUp = (step = 1, periodic = true) => {
    if (options2.length === 0) return;
    setOptionIdx((prevIdx) => {
      const newIdx = prevIdx - step;
      return periodic ? (newIdx + options2.length) % options2.length : Math.max(0, newIdx);
    });
  };
  const onNavigateDown = (step = 1, periodic = true) => {
    if (options2.length === 0) return;
    setOptionIdx((prevIdx) => {
      const newIdx = prevIdx + step;
      return periodic ? newIdx % options2.length : Math.min(options2.length - 1, newIdx);
    });
  };
  const onNavigateToTop = () => {
    if (options2.length === 0) return;
    setOptionIdx(0);
  };
  const onNavigateToBottom = () => {
    if (options2.length === 0) return;
    setOptionIdx(options2.length - 1);
  };
  const debounceTimerRef = (0, import_react5.useRef)(null);
  (0, import_react5.useEffect)(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);
  const onPathTextChange = (0, import_react5.useCallback)((newStr) => {
    setOptionText(newStr);
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    currentPathRef.current = JSON.stringify(optionPath);
    const fetchOptions = async () => {
      const newOpts = await getOptionsAtPath(accessor, optionPath, newStr) || [];
      if (currentPathRef.current !== JSON.stringify(optionPath)) {
        return;
      }
      setOptions2(newOpts);
      setOptionIdx(0);
      debounceTimerRef.current = null;
    };
    if (newStr.trim() === "") {
      fetchOptions();
    } else {
      debounceTimerRef.current = window.setTimeout(fetchOptions, 300);
    }
  }, [optionPath, accessor]);
  const onMenuKeyDown = (e) => {
    const isCommandKeyPressed = e.altKey || e.ctrlKey || e.metaKey;
    if (e.key === "ArrowUp") {
      if (isCommandKeyPressed) {
        onNavigateToTop();
      } else {
        if (e.altKey) {
          onNavigateUp(10, false);
        } else {
          onNavigateUp();
        }
      }
    } else if (e.key === "ArrowDown") {
      if (isCommandKeyPressed) {
        onNavigateToBottom();
      } else {
        if (e.altKey) {
          onNavigateDown(10, false);
        } else {
          onNavigateDown();
        }
      }
    } else if (e.key === "ArrowLeft") {
      onRemoveOption();
    } else if (e.key === "ArrowRight") {
      onSelectOption();
    } else if (e.key === "Enter") {
      onSelectOption();
    } else if (e.key === "Escape") {
      onCloseOptionMenu();
    } else if (e.key === "Backspace") {
      if (!optionText) {
        if (optionPath.length === 0) {
          onCloseOptionMenu();
          return;
        } else {
          onRemoveOption();
        }
      } else if (isCommandKeyPressed) {
        onPathTextChange("");
      } else {
        onPathTextChange(optionText.slice(0, -1));
      }
    } else if (e.key.length === 1) {
      if (isCommandKeyPressed) ; else {
        {
          onPathTextChange(optionText + e.key);
        }
      }
    }
    e.preventDefault();
    e.stopPropagation();
  };
  (0, import_react5.useEffect)(() => {
    if (isMenuOpen && selectedOptionRef.current) {
      selectedOptionRef.current.scrollIntoView({
        behavior: "instant",
        block: "nearest",
        inline: "nearest"
      });
    }
  }, [optionIdx, isMenuOpen, optionText, selectedOptionRef]);
  const measureRef = (0, import_react5.useRef)(null);
  const gapPx = 2;
  const offsetPx = 2;
  const {
    x,
    y,
    strategy,
    refs,
    middlewareData,
    update
  } = useFloating2({
    open: isMenuOpen,
    onOpenChange: setIsMenuOpen,
    placement: "bottom",
    middleware: [
      offset2({ mainAxis: gapPx, crossAxis: offsetPx }),
      flip2({
        boundary: document.body,
        padding: 8
      }),
      shift2({
        boundary: document.body,
        padding: 8
      }),
      size2({
        apply({ elements, rects }) {
          Object.assign(elements.floating.style, {
            width: `${Math.max(
              rects.reference.width,
              measureRef.current?.offsetWidth ?? 0
            )}px`
          });
        },
        padding: 8,
        // Use viewport as boundary instead of any parent element
        boundary: document.body
      })
    ],
    whileElementsMounted: autoUpdate,
    strategy: "fixed"
  });
  (0, import_react5.useEffect)(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event) => {
      const target = event.target;
      const floating = refs.floating.current;
      const reference = refs.reference.current;
      const isReferenceHTMLElement = reference && "contains" in reference;
      if (floating && (!isReferenceHTMLElement || !reference.contains(target)) && !floating.contains(target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen, refs.floating, refs.reference]);
  const [isEnabled, setEnabled] = (0, import_react5.useState)(true);
  const adjustHeight = (0, import_react5.useCallback)(() => {
    const r = textAreaRef.current;
    if (!r) return;
    r.style.height = "auto";
    if (r.scrollHeight === 0) return requestAnimationFrame(adjustHeight);
    const h = r.scrollHeight;
    const newHeight = Math.min(h + 1, 500);
    r.style.height = `${newHeight}px`;
  }, []);
  const fns = (0, import_react5.useMemo)(() => ({
    setValue: (val) => {
      const r = textAreaRef.current;
      if (!r) return;
      r.value = val;
      onChangeText?.(r.value);
      adjustHeight();
    },
    enable: () => {
      setEnabled(true);
    },
    disable: () => {
      setEnabled(false);
    }
  }), [onChangeText, adjustHeight]);
  (0, import_react5.useEffect)(() => {
    if (initValue)
      fns.setValue(initValue);
  }, [initValue]);
  const isChatDark = appearance === "chatDark";
  const appearanceClasses = isChatDark ? "text-white placeholder:text-white/40" : "text-void-fg-1 placeholder:text-void-fg-3";
  const baseStyle = isChatDark ? {
    background: "transparent",
    color: "#fff",
    border: "none",
    boxShadow: "none"
  } : {
    background: asCssVariable(inputBackground),
    color: asCssVariable(inputForeground)
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "textarea",
      {
        autoFocus: false,
        ref: (0, import_react5.useCallback)((r) => {
          if (fnsRef)
            fnsRef.current = fns;
          refs.setReference(r);
          textAreaRef.current = r;
          if (typeof ref === "function") ref(r);
          else if (ref) ref.current = r;
          adjustHeight();
        }, [fnsRef, fns, setEnabled, adjustHeight, ref, refs]),
        onFocus,
        onBlur,
        disabled: !isEnabled,
        className: `void-w-full void-resize-none void-max-h-[500px] void-overflow-y-auto ${appearanceClasses} ${className}`,
        style: { ...baseStyle, ...style },
        onInput: (0, import_react5.useCallback)((event) => {
          const latestChange = event.nativeEvent.data;
          if (latestChange === "@") {
            onOpenOptionMenu();
          }
        }, [onOpenOptionMenu, accessor]),
        onChange: (0, import_react5.useCallback)((e) => {
          const r = textAreaRef.current;
          if (!r) return;
          onChangeText?.(r.value);
          adjustHeight();
        }, [onChangeText, adjustHeight]),
        onKeyDown: (0, import_react5.useCallback)((e) => {
          if (isMenuOpen) {
            onMenuKeyDown(e);
            return;
          }
          if (e.key === "Backspace") {
            if (!e.currentTarget.value || e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
              if (e.metaKey || e.ctrlKey) {
                chatThreadService.popStagingSelections(Number.MAX_SAFE_INTEGER);
              } else {
                chatThreadService.popStagingSelections(1);
              }
              return;
            }
          }
          if (e.key === "Enter") {
            const shouldAddNewline = e.shiftKey && multiline;
            if (!shouldAddNewline) e.preventDefault();
          }
          onKeyDown?.(e);
        }, [onKeyDown, onMenuKeyDown, multiline]),
        rows: 1,
        placeholder
      }
    ),
    isMenuOpen && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        ref: refs.setFloating,
        className: "void-z-[100] void-border-void-border-3 void-bg-void-bg-2-alt void-border void-rounded void-shadow-lg void-flex void-flex-col void-overflow-hidden",
        style: {
          position: strategy,
          top: y ?? 0,
          left: x ?? 0,
          width: refs.reference.current instanceof HTMLElement ? refs.reference.current.offsetWidth : 0
        },
        onWheel: (e) => e.stopPropagation(),
        children: [
          isBreadcrumbsShowing && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "void-px-2 void-py-1 void-text-void-fg-1 void-bg-void-bg-2-alt void-border-b void-border-void-border-3 void-sticky void-top-0 void-bg-void-bg-1 void-z-10 void-select-none void-pointer-events-none", children: optionText ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "void-flex void-items-center", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: optionText }) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "void-opacity-50", children: "Enter text to filter..." }) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "void-max-h-[400px] void-w-full void-max-w-full void-overflow-y-auto void-overflow-x-auto", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "void-w-max void-min-w-full void-flex void-flex-col void-gap-0 void-text-nowrap void-flex-nowrap", children: options2.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "void-text-void-fg-3 void-px-3 void-py-0.5", children: "No results found" }) : options2.map((o, oIdx) => {
            return (
              // Option
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                "div",
                {
                  ref: oIdx === optionIdx ? selectedOptionRef : null,
                  className: ` void-flex void-items-center void-gap-2 void-px-3 void-py-1 void-cursor-pointer ${oIdx === optionIdx ? "void-bg-blue-500 void-text-white/80" : "void-bg-void-bg-2-alt void-text-void-fg-1"} `,
                  onClick: () => {
                    onSelectOption();
                  },
                  onMouseMove: () => {
                    setOptionIdx(oIdx);
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(o.iconInMenu, { size: 12 }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: o.abbreviatedName }),
                    o.fullName && o.fullName !== o.abbreviatedName && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "void-opacity-60 void-text-sm", children: o.fullName }),
                    o.nextOptions || o.generateNextOptions ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ChevronRight, { size: 12 }) : null
                  ]
                },
                o.fullName
              )
            );
          }) }) })
        ]
      }
    )
  ] });
});
var VoidSimpleInputBox = ({
  value,
  onChangeValue,
  placeholder,
  className,
  disabled,
  passwordBlur,
  compact,
  ...inputProps
}) => {
  const inputRef = (0, import_react5.useRef)(null);
  const selectionRef = (0, import_react5.useRef)({
    start: null,
    end: null
  });
  (0, import_react5.useEffect)(() => {
    const input = inputRef.current;
    if (input && input.value !== value) {
      selectionRef.current.start = input.selectionStart;
      selectionRef.current.end = input.selectionEnd;
      input.value = value;
      if (selectionRef.current.start !== null && selectionRef.current.end !== null) {
        input.setSelectionRange(selectionRef.current.start, selectionRef.current.end);
      }
    }
  }, [value]);
  const handleChange = (0, import_react5.useCallback)((e) => {
    onChangeValue(e.target.value);
  }, [onChangeValue]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "input",
    {
      ref: inputRef,
      defaultValue: value,
      onChange: handleChange,
      placeholder,
      disabled,
      className: `void-w-full void-resize-none void-bg-void-bg-1 void-text-void-fg-1 placeholder:void-text-void-fg-3 void-border void-border-void-border-2 focus:void-border-void-border-1 ${compact ? "void-py-1 void-px-2" : "void-py-2 void-px-4 "} void-rounded ${disabled ? "void-opacity-50 void-cursor-not-allowed" : ""} ${className}`,
      style: {
        ...passwordBlur && { WebkitTextSecurity: "disc" },
        background: asCssVariable(inputBackground),
        color: asCssVariable(inputForeground)
      },
      ...inputProps,
      type: void 0
    }
  );
};
var VoidSlider = ({
  value,
  onChange,
  size: size3 = "md",
  disabled = false,
  min = 0,
  max = 7,
  step = 1,
  className = "",
  width = 200
}) => {
  const percentage = (value - min) / (max - min) * 100;
  const handleTrackClick = (e) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const trackWidth = rect.width;
    const newPercentage = Math.max(0, Math.min(1, clickPosition / trackWidth));
    const rawValue = min + newPercentage * (max - min);
    if (rawValue >= max - step / 2) {
      onChange(max);
      return;
    }
    const steppedValue = Math.round((rawValue - min) / step) * step + min;
    const clampedValue = Math.max(min, Math.min(max, steppedValue));
    onChange(clampedValue);
  };
  const handleThumbDrag = (moveEvent, track) => {
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const movePosition = moveEvent.clientX - rect.left;
    const trackWidth = rect.width;
    const newPercentage = Math.max(0, Math.min(1, movePosition / trackWidth));
    const rawValue = min + newPercentage * (max - min);
    if (rawValue >= max - step / 2) {
      onChange(max);
      return;
    }
    const steppedValue = Math.round((rawValue - min) / step) * step + min;
    const clampedValue = Math.max(min, Math.min(max, steppedValue));
    onChange(clampedValue);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: `void-inline-flex void-items-center void-flex-shrink-0 ${className}`, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      className: `void-relative void-flex-shrink-0 ${disabled ? "void-opacity-25" : ""}`,
      style: {
        width
        // Add horizontal padding equal to half the thumb width
        // paddingLeft: thumbSizePx / 2,
        // paddingRight: thumbSizePx / 2
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "void-relative void-w-full", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            className: "void-absolute void-w-full void-cursor-pointer",
            style: {
              height: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 1
            },
            onClick: handleTrackClick
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            className: `void-relative ${size3 === "xxs" ? "void-h-0.5" : size3 === "xs" ? "void-h-1" : size3 === "sm" ? "void-h-1.5" : size3 === "sm+" ? "void-h-2" : "void-h-2.5"} void-bg-void-bg-2 void-rounded-full void-cursor-pointer`,
            onClick: handleTrackClick,
            children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "div",
              {
                className: `void-absolute void-left-0 ${size3 === "xxs" ? "void-h-0.5" : size3 === "xs" ? "void-h-1" : size3 === "sm" ? "void-h-1.5" : size3 === "sm+" ? "void-h-2" : "void-h-2.5"} void-bg-void-fg-1 void-rounded-full`,
                style: { width: `${percentage}%` }
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            className: `void-absolute void-top-1/2 void-transform -void-translate-x-1/2 -void-translate-y-1/2 ${size3 === "xxs" ? "void-h-2 void-w-2" : size3 === "xs" ? "void-h-2.5 void-w-2.5" : size3 === "sm" ? "void-h-3 void-w-3" : size3 === "sm+" ? "void-h-3.5 void-w-3.5" : "void-h-4 void-w-4"} void-bg-void-fg-1 void-rounded-full void-shadow-md ${disabled ? "void-cursor-not-allowed" : "void-cursor-grab active:void-cursor-grabbing"} void-border void-border-void-fg-1`,
            style: { left: `${percentage}%`, zIndex: 2 },
            onMouseDown: (e) => {
              if (disabled) return;
              const track = e.currentTarget.previousElementSibling;
              const handleMouseMove = (moveEvent) => {
                handleThumbDrag(moveEvent, track);
              };
              const handleMouseUp = () => {
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
              };
              document.body.style.userSelect = "none";
              document.body.style.cursor = "grabbing";
              document.addEventListener("mousemove", handleMouseMove);
              document.addEventListener("mouseup", handleMouseUp);
              e.preventDefault();
            }
          }
        )
      ] })
    }
  ) });
};
var VoidSwitch = ({
  value,
  onChange,
  size: size3 = "md",
  disabled = false,
  ...props
}) => {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "void-inline-flex void-items-center", ...props, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      onClick: () => !disabled && onChange(!value),
      className: ` void-cursor-pointer void-relative void-inline-flex void-items-center void-rounded-full void-transition-colors void-duration-200 void-ease-in-out ${value ? "void-bg-zinc-900 dark:void-bg-white" : "void-bg-white dark:void-bg-zinc-600"} ${disabled ? "void-opacity-25" : ""} ${size3 === "xxs" ? "void-h-3 void-w-5" : ""} ${size3 === "xs" ? "void-h-4 void-w-7" : ""} ${size3 === "sm" ? "void-h-5 void-w-9" : ""} ${size3 === "sm+" ? "void-h-5 void-w-10" : ""} ${size3 === "md" ? "void-h-6 void-w-11" : ""} `,
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "span",
        {
          className: ` void-inline-block void-transform void-rounded-full void-bg-white dark:void-bg-zinc-900 void-shadow void-transition-transform void-duration-200 void-ease-in-out ${size3 === "xxs" ? "void-h-2 void-w-2" : ""} ${size3 === "xs" ? "void-h-2.5 void-w-2.5" : ""} ${size3 === "sm" ? "void-h-3 void-w-3" : ""} ${size3 === "sm+" ? "void-h-3.5 void-w-3.5" : ""} ${size3 === "md" ? "void-h-4 void-w-4" : ""} ${size3 === "xxs" ? value ? "void-translate-x-2.5" : "void-translate-x-0.5" : ""} ${size3 === "xs" ? value ? "void-translate-x-3.5" : "void-translate-x-0.5" : ""} ${size3 === "sm" ? value ? "void-translate-x-5" : "void-translate-x-1" : ""} ${size3 === "sm+" ? value ? "void-translate-x-6" : "void-translate-x-1" : ""} ${size3 === "md" ? value ? "void-translate-x-6" : "void-translate-x-1" : ""} `
        }
      )
    }
  ) });
};
var VoidCustomDropdownBox = ({
  options: options2,
  selectedOption,
  onChangeOption,
  getOptionDropdownName,
  getOptionDropdownDetail,
  getOptionDisplayName,
  getOptionsEqual,
  className,
  arrowTouchesText = true,
  matchInputWidth = false,
  gapPx = 0,
  offsetPx = -6
}) => {
  const [isOpen, setIsOpen] = (0, import_react5.useState)(false);
  const measureRef = (0, import_react5.useRef)(null);
  const {
    x,
    y,
    strategy,
    refs,
    middlewareData,
    update
  } = useFloating2({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    middleware: [
      offset2({ mainAxis: gapPx, crossAxis: offsetPx }),
      flip2({
        boundary: document.body,
        padding: 8
      }),
      shift2({
        boundary: document.body,
        padding: 8
      }),
      size2({
        apply({ availableHeight, elements, rects }) {
          const maxHeight = Math.min(availableHeight);
          Object.assign(elements.floating.style, {
            maxHeight: `${maxHeight}px`,
            overflowY: "auto",
            // Ensure the width isn't constrained by the parent
            width: `${Math.max(
              rects.reference.width,
              measureRef.current?.offsetWidth ?? 0
            )}px`
          });
        },
        padding: 8,
        // Use viewport as boundary instead of any parent element
        boundary: document.body
      })
    ],
    whileElementsMounted: autoUpdate,
    strategy: "fixed"
  });
  (0, import_react5.useEffect)(() => {
    if (options2.length === 0) return;
    if (selectedOption !== void 0) return;
    onChangeOption(options2[0]);
  }, [selectedOption, onChangeOption, options2]);
  (0, import_react5.useEffect)(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      const target = event.target;
      const floating = refs.floating.current;
      const reference = refs.reference.current;
      const isReferenceHTMLElement = reference && "contains" in reference;
      if (floating && (!isReferenceHTMLElement || !reference.contains(target)) && !floating.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, refs.floating, refs.reference]);
  if (selectedOption === void 0)
    return null;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: `void-inline-block void-relative ${className}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        ref: measureRef,
        className: "void-opacity-0 void-pointer-events-none void-absolute -void-left-[999999px] -void-top-[999999px] void-flex void-flex-col",
        "aria-hidden": "true",
        children: options2.map((option) => {
          const optionName = getOptionDropdownName(option);
          const optionDetail = getOptionDropdownDetail?.(option) || "";
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "void-flex void-items-center void-whitespace-nowrap", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "void-w-4" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "void-flex void-justify-between void-w-full", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: optionName }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: optionDetail }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: "______" })
            ] })
          ] }, optionName + optionDetail);
        })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "button",
      {
        type: "button",
        ref: refs.setReference,
        className: "void-flex void-items-center void-h-4 void-bg-transparent void-whitespace-nowrap hover:void-brightness-90 void-w-full",
        onClick: () => setIsOpen(!isOpen),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: `void-truncate ${arrowTouchesText ? "void-mr-1" : ""}`, children: getOptionDisplayName(selectedOption) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "svg",
            {
              className: `void-size-3 void-flex-shrink-0 ${arrowTouchesText ? "" : "void-ml-auto"}`,
              viewBox: "0 0 12 12",
              fill: "none",
              children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "path",
                {
                  d: "M2.5 4.5L6 8L9.5 4.5",
                  stroke: "currentColor",
                  strokeWidth: "1.5",
                  strokeLinecap: "round",
                  strokeLinejoin: "round"
                }
              )
            }
          )
        ]
      }
    ),
    isOpen && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "div",
      {
        ref: refs.setFloating,
        className: "void-z-[100] void-bg-void-bg-1 void-border-void-border-3 void-border void-rounded void-shadow-lg",
        style: {
          position: strategy,
          top: y ?? 0,
          left: x ?? 0,
          width: matchInputWidth ? refs.reference.current instanceof HTMLElement ? refs.reference.current.offsetWidth : 0 : Math.max(
            refs.reference.current instanceof HTMLElement ? refs.reference.current.offsetWidth : 0,
            measureRef.current instanceof HTMLElement ? measureRef.current.offsetWidth : 0
          )
        },
        onWheel: (e) => e.stopPropagation(),
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "void-overflow-auto void-max-h-80", children: options2.map((option) => {
          const thisOptionIsSelected = getOptionsEqual(option, selectedOption);
          const optionName = getOptionDropdownName(option);
          const optionDetail = getOptionDropdownDetail?.(option) || "";
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "div",
            {
              className: `void-flex void-items-center void-px-2 void-py-1 void-pr-4 void-cursor-pointer void-whitespace-nowrap void-transition-all void-duration-100 ${thisOptionIsSelected ? "void-bg-blue-500 void-text-white/80" : "hover:void-bg-blue-500 hover:void-text-white/80"} `,
              onClick: () => {
                onChangeOption(option);
                setIsOpen(false);
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "void-w-4 void-flex void-justify-center void-flex-shrink-0", children: thisOptionIsSelected && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { className: "void-size-3", viewBox: "0 0 12 12", fill: "none", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  "path",
                  {
                    d: "M10 3L4.5 8.5L2 6",
                    stroke: "currentColor",
                    strokeWidth: "1.5",
                    strokeLinecap: "round",
                    strokeLinejoin: "round"
                  }
                ) }) }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "void-flex void-justify-between void-items-center void-w-full void-gap-x-1", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: optionName }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "void-opacity-60", children: optionDetail })
                ] })
              ]
            },
            optionName
          );
        }) })
      }
    )
  ] });
};
var normalizeIndentation = (code) => {
  const lines = code.split("\n");
  let minLeadingSpaces = Infinity;
  for (const line of lines) {
    if (line.trim() === "") continue;
    let leadingSpaces = 0;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === "	" || char === " ") {
        leadingSpaces += 1;
      } else {
        break;
      }
    }
    minLeadingSpaces = Math.min(minLeadingSpaces, leadingSpaces);
  }
  return lines.map((line) => {
    if (line.trim() === "") return line;
    let spacesToRemove = minLeadingSpaces;
    let i = 0;
    while (spacesToRemove > 0 && i < line.length) {
      const char = line[i];
      if (char === "	" || char === " ") {
        spacesToRemove -= 1;
        i++;
      } else {
        break;
      }
    }
    return line.slice(i);
  }).join("\n");
};
var modelOfEditorId = {};
var BlockCode = ({ initValue, language, maxHeight, showScrollbars }) => {
  initValue = normalizeIndentation(initValue);
  const MAX_HEIGHT = maxHeight ?? Infinity;
  const SHOW_SCROLLBARS = showScrollbars ?? false;
  const divRef = (0, import_react5.useRef)(null);
  const accessor = useAccessor();
  const instantiationService = accessor.get("IInstantiationService");
  const modelService = accessor.get("IModelService");
  const id = (0, import_react5.useId)();
  const initValueRef = (0, import_react5.useRef)(initValue);
  const languageRef = (0, import_react5.useRef)(language);
  const modelRef = (0, import_react5.useRef)(null);
  (0, import_react5.useEffect)(() => {
    initValueRef.current = initValue;
    modelRef.current?.setValue(initValue);
  }, [initValue]);
  (0, import_react5.useEffect)(() => {
    languageRef.current = language;
    if (language) modelRef.current?.setLanguage(language);
  }, [language]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { ref: divRef, className: "void-relative void-z-0 void-px-2 void-py-1 void-bg-void-bg-3", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    WidgetComponent,
    {
      className: "bg-editor-style-override",
      ctor: (0, import_react5.useCallback)((container) => {
        return instantiationService.createInstance(
          CodeEditorWidget,
          container,
          {
            automaticLayout: true,
            wordWrap: "off",
            scrollbar: {
              alwaysConsumeMouseWheel: false,
              ...SHOW_SCROLLBARS ? {
                vertical: "auto",
                verticalScrollbarSize: 8,
                horizontal: "auto",
                horizontalScrollbarSize: 8
              } : {
                vertical: "hidden",
                verticalScrollbarSize: 0,
                horizontal: "auto",
                horizontalScrollbarSize: 8,
                ignoreHorizontalScrollbarInContentHeight: true
              }
            },
            scrollBeyondLastLine: false,
            lineNumbers: "off",
            readOnly: true,
            domReadOnly: true,
            readOnlyMessage: { value: "" },
            minimap: {
              enabled: false
              // maxColumn: 0,
            },
            hover: { enabled: false },
            selectionHighlight: false,
            // highlights whole words
            renderLineHighlight: "none",
            folding: false,
            lineDecorationsWidth: 0,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            glyphMargin: false,
            stickyScroll: {
              enabled: false
            }
          },
          {
            isSimpleWidget: true
          }
        );
      }, [instantiationService]),
      onCreateInstance: (0, import_react5.useCallback)((editor) => {
        const languageId = languageRef.current ? languageRef.current : "plaintext";
        const model = modelOfEditorId[id] ?? modelService.createModel(
          initValueRef.current,
          {
            languageId,
            onDidChange: (e) => {
              return { dispose: () => {
              } };
            }
            // no idea why they'd require this
          }
        );
        modelRef.current = model;
        editor.setModel(model);
        const container = editor.getDomNode();
        const parentNode = container?.parentElement;
        const resize = () => {
          const height = editor.getScrollHeight() + 1;
          if (parentNode) {
            parentNode.style.height = `${height}px`;
            parentNode.style.maxHeight = `${MAX_HEIGHT}px`;
            editor.layout();
          }
        };
        resize();
        const disposable = editor.onDidContentSizeChange(() => {
          resize();
        });
        return [disposable, model];
      }, [modelService]),
      dispose: (0, import_react5.useCallback)((editor) => {
        editor.dispose();
      }, [modelService]),
      propsFn: (0, import_react5.useCallback)(() => {
        return [];
      }, [])
    }
  ) });
};
var VoidButtonBgDarken = ({ children, disabled, onClick, className }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "button",
    {
      disabled,
      className: `void-px-3 void-py-1 void-bg-black/10 dark:void-bg-white/10 void-rounded-sm void-overflow-hidden void-whitespace-nowrap void-flex void-items-center void-justify-center ${className || ""}`,
      onClick,
      children
    }
  );
};
var SingleDiffEditor = ({ block: block2, lang }) => {
  const accessor = useAccessor();
  const modelService = accessor.get("IModelService");
  const instantiationService = accessor.get("IInstantiationService");
  const languageService = accessor.get("ILanguageService");
  const languageSelection = (0, import_react5.useMemo)(() => languageService.createById(lang), [lang, languageService]);
  const originalModel = (0, import_react5.useMemo)(
    () => modelService.createModel(block2.orig, languageSelection),
    [block2.orig, languageSelection, modelService]
  );
  const modifiedModel = (0, import_react5.useMemo)(
    () => modelService.createModel(block2.final, languageSelection),
    [block2.final, languageSelection, modelService]
  );
  (0, import_react5.useEffect)(() => {
    return () => {
      originalModel.dispose();
      modifiedModel.dispose();
    };
  }, [originalModel, modifiedModel]);
  const divRef = (0, import_react5.useRef)(null);
  const editorRef = (0, import_react5.useRef)(null);
  (0, import_react5.useEffect)(() => {
    if (!divRef.current) return;
    const editor = instantiationService.createInstance(
      DiffEditorWidget,
      divRef.current,
      {
        automaticLayout: true,
        readOnly: true,
        renderSideBySide: true,
        minimap: { enabled: false },
        lineNumbers: "off",
        scrollbar: {
          vertical: "hidden",
          horizontal: "auto",
          verticalScrollbarSize: 0,
          horizontalScrollbarSize: 8,
          alwaysConsumeMouseWheel: false,
          ignoreHorizontalScrollbarInContentHeight: true
        },
        hover: { enabled: false },
        folding: false,
        selectionHighlight: false,
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        glyphMargin: false,
        stickyScroll: { enabled: false },
        scrollBeyondLastLine: false,
        renderGutterMenu: false,
        renderIndicators: false
      },
      { originalEditor: { isSimpleWidget: true }, modifiedEditor: { isSimpleWidget: true } }
    );
    editor.setModel({ original: originalModel, modified: modifiedModel });
    const updateHeight = () => {
      const contentHeight = Math.max(
        originalModel.getLineCount() * 19,
        // approximate line height
        modifiedModel.getLineCount() * 19
      ) + 19 * 2 + 1;
      const height = Math.min(Math.max(contentHeight, 100), 300);
      if (divRef.current) {
        divRef.current.style.height = `${height}px`;
        editor.layout();
      }
    };
    updateHeight();
    editorRef.current = editor;
    const disposable1 = originalModel.onDidChangeContent(() => updateHeight());
    const disposable2 = modifiedModel.onDidChangeContent(() => updateHeight());
    return () => {
      disposable1.dispose();
      disposable2.dispose();
      editor.dispose();
      editorRef.current = null;
    };
  }, [originalModel, modifiedModel, instantiationService]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "void-w-full void-bg-void-bg-3 bg-editor-style-override", ref: divRef });
};
var VoidDiffEditor = ({ uri, searchReplaceBlocks, language }) => {
  const accessor = useAccessor();
  const languageService = accessor.get("ILanguageService");
  const blocks = extractSearchReplaceBlocks(searchReplaceBlocks);
  let lang = language;
  if (!lang && blocks.length > 0) {
    lang = detectLanguage(languageService, { uri: uri ?? null, fileContents: blocks[0].orig });
  }
  if (blocks.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "void-w-full void-p-4 void-text-void-fg-4 void-text-sm", children: "No changes found" });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "void-w-full void-flex void-flex-col void-gap-2", children: blocks.map(
    (block2, index3) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "void-w-full", children: [
      blocks.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "void-text-void-fg-4 void-text-xs void-mb-1 void-px-1 void-void-diff-block-header", children: [
        "Change ",
        index3 + 1,
        " of ",
        blocks.length
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(SingleDiffEditor, { block: block2, lang })
    ] }, index3)
  ) });
};

// src2/markdown/ChatMarkdownRender.tsx
var import_jsx_runtime4 = __toESM(require_jsx_runtime(), 1);
var getApplyBoxId = ({ threadId, messageIdx, tokenIdx }) => {
  return `${threadId}-${messageIdx}-${tokenIdx}`;
};
function isValidUri(s) {
  return s.length > 5 && isAbsolute(s) && !s.includes("//") && !s.includes("/*");
}
var LatexRender = ({ latex }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "void-katex-error void-text-red-500", children: latex });
};
var Codespan = ({ text, className, onClick, tooltip }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "code",
    {
      className: `void-font-mono void-font-medium void-rounded-sm void-bg-void-bg-1 void-px-1 ${className}`,
      onClick,
      ...tooltip ? {
        "data-tooltip-id": "void-tooltip",
        "data-tooltip-content": tooltip,
        "data-tooltip-place": "top"
      } : {},
      children: text
    }
  );
};
var CodespanWithLink = ({ text, rawText, chatMessageLocation }) => {
  const accessor = useAccessor();
  const chatThreadService = accessor.get("IChatThreadService");
  accessor.get("ICommandService");
  accessor.get("ICodeEditorService");
  const { messageIdx, threadId } = chatMessageLocation;
  const [didComputeCodespanLink, setDidComputeCodespanLink] = (0, import_react7.useState)(false);
  let link2 = void 0;
  let tooltip = void 0;
  let displayText = text;
  if (rawText.endsWith("`")) {
    link2 = chatThreadService.getCodespanLink({ codespanStr: text, messageIdx, threadId });
    if (link2 === void 0) {
      chatThreadService.generateCodespanLink({ codespanStr: text, threadId }).then((link3) => {
        chatThreadService.addCodespanLink({ newLinkText: text, newLinkLocation: link3, messageIdx, threadId });
        setDidComputeCodespanLink(true);
      });
    }
    if (link2?.displayText) {
      displayText = link2.displayText;
    }
    if (isValidUri(displayText)) {
      tooltip = getRelative(URI.file(displayText), accessor);
      displayText = getBasename(displayText);
    }
  }
  const onClick = () => {
    if (!link2) return;
    if (link2.selection)
      voidOpenFileFn(link2.uri, accessor, [link2.selection.startLineNumber, link2.selection.endLineNumber]);
    else
      voidOpenFileFn(link2.uri, accessor);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    Codespan,
    {
      text: displayText,
      onClick,
      className: link2 ? "void-underline hover:void-brightness-90 void-transition-all void-duration-200 void-cursor-pointer" : "",
      tooltip: tooltip || void 0
    }
  );
};
var paragraphToLatexSegments = (paragraphText) => {
  const segments = [];
  if (paragraphText && !(paragraphText.includes("#") || paragraphText.includes("`")) && !/^[\w\s.()[\]{}]+$/.test(paragraphText)) {
    const rawText = paragraphText;
    const displayMathRegex = /\$\$(.*?)\$\$/g;
    const inlineMathRegex = /\$((?!\$).*?)\$/g;
    if (displayMathRegex.test(rawText) || inlineMathRegex.test(rawText)) {
      displayMathRegex.lastIndex = 0;
      inlineMathRegex.lastIndex = 0;
      let lastIndex = 0;
      let segmentId = 0;
      let match;
      displayMathRegex.lastIndex = 0;
      while ((match = displayMathRegex.exec(rawText)) !== null) {
        const [fullMatch, formula] = match;
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
          const textBefore = rawText.substring(lastIndex, matchIndex);
          segments.push(
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: textBefore }, `text-${segmentId++}`)
          );
        }
        segments.push(
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(LatexRender, { latex: fullMatch }, `latex-${segmentId++}`)
        );
        lastIndex = matchIndex + fullMatch.length;
      }
      if (lastIndex < rawText.length) {
        const remainingText = rawText.substring(lastIndex);
        lastIndex = 0;
        inlineMathRegex.lastIndex = 0;
        const inlineSegments = [];
        while ((match = inlineMathRegex.exec(remainingText)) !== null) {
          const [fullMatch] = match;
          const matchIndex = match.index;
          if (matchIndex > lastIndex) {
            const textBefore = remainingText.substring(lastIndex, matchIndex);
            inlineSegments.push(
              /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: textBefore }, `inline-text-${segmentId++}`)
            );
          }
          inlineSegments.push(
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(LatexRender, { latex: fullMatch }, `inline-latex-${segmentId++}`)
          );
          lastIndex = matchIndex + fullMatch.length;
        }
        if (lastIndex < remainingText.length) {
          inlineSegments.push(
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: remainingText.substring(lastIndex) }, `inline-final-${segmentId++}`)
          );
        }
        segments.push(...inlineSegments);
      }
    }
  }
  return segments;
};
var RenderToken = ({ token, inPTag, codeURI, chatMessageLocation, tokenIdx, ...options2 }) => {
  const accessor = useAccessor();
  const languageService = accessor.get("ILanguageService");
  const t = token;
  if (t.raw.trim() === "") {
    return null;
  }
  if (t.type === "space") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t.raw });
  }
  if (t.type === "code") {
    const [firstLine, remainingContents] = separateOutFirstLine(t.text);
    const firstLineIsURI = isValidUri(firstLine) && !codeURI;
    let contents = firstLineIsURI ? remainingContents?.trimStart() || "" : t.text;
    if (!contents) return null;
    const secretDetectionService = accessor.get("ISecretDetectionService");
    const config = secretDetectionService.getConfig();
    if (config.enabled) {
      const detection = secretDetectionService.detectSecrets(contents);
      contents = detection.redactedText;
    }
    let uri;
    let language;
    if (codeURI) {
      uri = codeURI;
    } else if (firstLineIsURI) {
      uri = URI.file(firstLine);
    } else {
      uri = null;
    }
    if (t.lang) {
      language = convertToVscodeLang(languageService, t.lang);
    } else {
      language = detectLanguage(languageService, { uri, fileContents: contents });
    }
    if (options2.isApplyEnabled && chatMessageLocation) {
      const isCodeblockClosed = t.raw.trimEnd().endsWith("```");
      const applyBoxId = getApplyBoxId({
        threadId: chatMessageLocation.threadId,
        messageIdx: chatMessageLocation.messageIdx,
        tokenIdx
      });
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        BlockCodeApplyWrapper,
        {
          canApply: isCodeblockClosed,
          applyBoxId,
          codeStr: contents,
          language,
          uri: uri || "current",
          children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            BlockCode,
            {
              initValue: contents.trimEnd(),
              language
            }
          )
        }
      );
    }
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      BlockCode,
      {
        initValue: contents,
        language
      }
    );
  }
  if (t.type === "heading") {
    const HeadingTag = `h${t.depth}`;
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(HeadingTag, { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ChatMarkdownRender, { chatMessageLocation, string: t.text, inPTag: true, codeURI, ...options2 }) });
  }
  if (t.type === "table") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("table", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("tr", { children: t.header.map(
        (h, hIdx) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: h.text }, hIdx)
      ) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("tbody", { children: t.rows.map(
        (row, rowIdx) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("tr", { children: row.map(
          (r, rIdx) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: r.text }, rIdx)
        ) }, rowIdx)
      ) })
    ] }) });
  }
  if (t.type === "hr") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("hr", {});
  }
  if (t.type === "blockquote") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("blockquote", { children: t.text });
  }
  if (t.type === "list_item") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("li", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { type: "checkbox", checked: t.checked, readOnly: true }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ChatMarkdownRender, { chatMessageLocation, string: t.text, inPTag: true, codeURI, ...options2 }) })
    ] });
  }
  if (t.type === "list") {
    const ListTag = t.ordered ? "ol" : "ul";
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ListTag, { start: t.start ? t.start : void 0, children: t.items.map(
      (item, index3) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("li", { children: [
        item.task && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("input", { type: "checkbox", checked: item.checked, readOnly: true }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ChatMarkdownRender, { chatMessageLocation, string: item.text, inPTag: true, ...options2 }) })
      ] }, index3)
    ) });
  }
  if (t.type === "paragraph") {
    const latexSegments = paragraphToLatexSegments(t.raw);
    if (latexSegments.length !== 0) {
      if (inPTag) {
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "void-block", children: latexSegments });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: latexSegments });
    }
    const contents = /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: t.tokens.map(
      (token2, index3) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        RenderToken,
        {
          token: token2,
          tokenIdx: `${tokenIdx ? `${tokenIdx}-` : ""}${index3}`,
          chatMessageLocation,
          inPTag: true,
          ...options2
        },
        index3
      )
    ) });
    if (inPTag) return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "void-block", children: contents });
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { children: contents });
  }
  if (t.type === "text" || t.type === "escape" || t.type === "html") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t.raw });
  }
  if (t.type === "def") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, {});
  }
  if (t.type === "link") {
    const secretDetectionService = accessor.get("ISecretDetectionService");
    const config = secretDetectionService.getConfig();
    let href = t.href;
    let text = t.text;
    if (config.enabled) {
      const hrefDetection = secretDetectionService.detectSecrets(href);
      href = hrefDetection.redactedText;
      const textDetection = secretDetectionService.detectSecrets(text);
      text = textDetection.redactedText;
    }
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "a",
      {
        onClick: () => {
          window.open(href);
        },
        href,
        title: t.title ?? void 0,
        className: "void-underline void-cursor-pointer hover:void-brightness-90 void-transition-all void-duration-200 void-text-void-fg-2",
        children: text
      }
    );
  }
  if (t.type === "image") {
    const secretDetectionService = accessor.get("ISecretDetectionService");
    const config = secretDetectionService.getConfig();
    let src = t.href;
    let alt = t.text;
    if (config.enabled) {
      const srcDetection = secretDetectionService.detectSecrets(src);
      src = srcDetection.redactedText;
      const altDetection = secretDetectionService.detectSecrets(alt);
      alt = altDetection.redactedText;
    }
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "img",
      {
        src,
        alt,
        title: t.title ?? void 0
      }
    );
  }
  if (t.type === "strong") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: t.text });
  }
  if (t.type === "em") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("em", { children: t.text });
  }
  if (t.type === "codespan") {
    const secretDetectionService = accessor.get("ISecretDetectionService");
    const config = secretDetectionService.getConfig();
    let text = t.text;
    if (config.enabled) {
      const detection = secretDetectionService.detectSecrets(text);
      text = detection.redactedText;
    }
    if (options2.isLinkDetectionEnabled && chatMessageLocation) {
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        CodespanWithLink,
        {
          text,
          rawText: t.raw,
          chatMessageLocation
        }
      );
    }
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Codespan, { text });
  }
  if (t.type === "br") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("br", {});
  }
  if (t.type === "del") {
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("del", { children: t.text });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "void-bg-orange-50 void-rounded-sm void-overflow-hidden void-p-2", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "void-text-sm void-text-orange-500", children: "Unknown token rendered..." }) });
};
var ChatMarkdownRender = ({ string, inPTag = false, chatMessageLocation, ...options2 }) => {
  const accessor = useAccessor();
  const secretDetectionService = accessor.get("ISecretDetectionService");
  const redactedString = (0, import_react7.useMemo)(() => {
    const config = secretDetectionService.getConfig();
    if (!config.enabled) {
      return string.replaceAll("\n\u2022", "\n\n\u2022");
    }
    const detection = secretDetectionService.detectSecrets(string);
    return detection.redactedText.replaceAll("\n\u2022", "\n\n\u2022");
  }, [string, secretDetectionService]);
  const [debouncedString, setDebouncedString] = (0, import_react7.useState)(redactedString);
  const rafRef = (0, import_react7.useRef)();
  const lastUpdateRef = (0, import_react7.useRef)(redactedString);
  (0, import_react7.useEffect)(() => {
    lastUpdateRef.current = redactedString;
    if (redactedString.length < 500) {
      setDebouncedString(redactedString);
      return;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      setDebouncedString(lastUpdateRef.current);
      rafRef.current = void 0;
    });
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [redactedString]);
  const tokens = (0, import_react7.useMemo)(() => {
    if (debouncedString.length > 1e4) {
      try {
        return marked.lexer(debouncedString, { async: false });
      } catch (e) {
        return [];
      }
    }
    return marked.lexer(debouncedString);
  }, [debouncedString]);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_jsx_runtime4.Fragment, { children: tokens.map(
    (token, index3) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(RenderToken, { token, inPTag, chatMessageLocation, tokenIdx: index3 + "", ...options2 }, index3)
  ) });
};

// src2/sidebar-tsx/ErrorDisplay.tsx
var import_react8 = __toESM(require_react(), 1);
var import_jsx_runtime5 = __toESM(require_jsx_runtime(), 1);
var ErrorDisplay = ({
  message: message_,
  fullError,
  onDismiss,
  showDismiss,
  onRetry,
  onRollback,
  onOpenLogs
}) => {
  const [isExpanded, setIsExpanded] = (0, import_react8.useState)(false);
  const normalizedMessage = fullError ? toErrorMessage(fullError, false) : message_;
  const details = isExpanded && fullError ? errorDetails(fullError) : null;
  const isExpandable = !!fullError && (fullError.stack || fullError.message !== normalizedMessage);
  const message = normalizedMessage + "";
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: `void-rounded-lg void-border void-border-red-200 void-bg-red-50 void-p-4 void-overflow-auto`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "void-flex void-items-start void-justify-between", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "void-flex void-gap-3", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CircleAlert, { className: "void-h-5 void-w-5 void-text-red-600 void-mt-0.5" }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "void-flex-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h3", { className: "void-font-semibold void-text-red-800", children: "Error" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "void-text-red-700 void-mt-1", children: message })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "void-flex void-gap-2", children: [
        isExpandable && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "button",
          {
            className: "void-text-red-600 hover:void-text-red-800 void-p-1 void-rounded",
            onClick: () => setIsExpanded(!isExpanded),
            children: isExpanded ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ChevronUp, { className: "void-h-5 void-w-5" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ChevronDown, { className: "void-h-5 void-w-5" })
          }
        ),
        showDismiss && onDismiss && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "button",
          {
            className: "void-text-red-600 hover:void-text-red-800 void-p-1 void-rounded",
            onClick: onDismiss,
            children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(X, { className: "void-h-5 void-w-5" })
          }
        )
      ] })
    ] }),
    (onRetry || onRollback || onOpenLogs) && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "void-mt-3 void-flex void-gap-2 void-flex-wrap", children: [
      onRetry && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "button",
        {
          className: "void-flex void-items-center void-gap-1 void-px-3 void-py-1.5 void-text-sm void-bg-red-600 void-text-white void-rounded hover:void-bg-red-700 void-transition-colors",
          onClick: onRetry,
          "aria-label": "Retry operation",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(RefreshCw, { className: "void-h-4 void-w-4" }),
            "Retry"
          ]
        }
      ),
      onRollback && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "button",
        {
          className: "void-flex void-items-center void-gap-1 void-px-3 void-py-1.5 void-text-sm void-bg-red-500 void-text-white void-rounded hover:void-bg-red-600 void-transition-colors",
          onClick: onRollback,
          "aria-label": "Rollback changes",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(RotateCcw, { className: "void-h-4 void-w-4" }),
            "Rollback"
          ]
        }
      ),
      onOpenLogs && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "button",
        {
          className: "void-flex void-items-center void-gap-1 void-px-3 void-py-1.5 void-text-sm void-border void-border-red-300 void-text-red-700 void-rounded hover:void-bg-red-50 void-transition-colors",
          onClick: onOpenLogs,
          "aria-label": "Open logs",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(FileText, { className: "void-h-4 void-w-4" }),
            "Open Logs"
          ]
        }
      )
    ] }),
    isExpanded && details && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "void-mt-4 void-space-y-3 void-border-t void-border-red-200 void-pt-3 void-overflow-auto", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "void-font-semibold void-text-red-800", children: "Technical Details: " }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("pre", { className: "void-text-red-700 void-text-xs", children: details })
    ] }) })
  ] });
};

// src2/void-settings-tsx/ModelDropdown.tsx
var import_react9 = __toESM(require_react(), 1);
var import_jsx_runtime6 = __toESM(require_jsx_runtime(), 1);
var optionsEqual = (m1, m2) => {
  if (m1.length !== m2.length) return false;
  for (let i = 0; i < m1.length; i++) {
    if (!modelSelectionsEqual(m1[i].selection, m2[i].selection)) return false;
  }
  return true;
};
var ModelSelectBox = ({ options: options2, featureName, className }) => {
  const accessor = useAccessor();
  const cortexideSettingsService = accessor.get("ICortexideSettingsService");
  const selection = cortexideSettingsService.state.modelSelectionOfFeature[featureName];
  const selectedOption = selection ? cortexideSettingsService.state._modelOptions.find((v) => modelSelectionsEqual(v.selection, selection)) : options2[0];
  const onChangeOption = (0, import_react9.useCallback)((newOption) => {
    cortexideSettingsService.setModelSelectionOfFeature(featureName, newOption.selection);
  }, [cortexideSettingsService, featureName]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    VoidCustomDropdownBox,
    {
      options: options2,
      selectedOption,
      onChangeOption,
      getOptionDisplayName: (option) => {
        if (option.selection.providerName === "auto" && option.selection.modelName === "auto") {
          return "Auto";
        }
        return option.selection.modelName;
      },
      getOptionDropdownName: (option) => {
        if (option.selection.providerName === "auto" && option.selection.modelName === "auto") {
          return "Auto";
        }
        return option.selection.modelName;
      },
      getOptionDropdownDetail: (option) => {
        if (option.selection.providerName === "auto" && option.selection.modelName === "auto") {
          return "Automatic model selection";
        }
        return option.selection.providerName;
      },
      getOptionsEqual: (a, b) => optionsEqual([a], [b]),
      className,
      matchInputWidth: false
    }
  );
};
var MemoizedModelDropdown = ({ featureName, className }) => {
  const settingsState = useSettingsState();
  const oldOptionsRef = (0, import_react9.useRef)([]);
  const [memoizedOptions, setMemoizedOptions] = (0, import_react9.useState)(oldOptionsRef.current);
  const { filter, emptyMessage } = modelFilterOfFeatureName[featureName];
  (0, import_react9.useEffect)(() => {
    const oldOptions = oldOptionsRef.current;
    const allOptions = featureName === "Chat" ? settingsState._modelOptions : settingsState._modelOptions.filter((o) => !(o.selection.providerName === "auto" && o.selection.modelName === "auto"));
    const newOptions = allOptions.filter((o) => filter(o.selection, { chatMode: settingsState.globalSettings.chatMode, overridesOfModel: settingsState.overridesOfModel }));
    if (!optionsEqual(oldOptions, newOptions)) {
      setMemoizedOptions(newOptions);
    }
    oldOptionsRef.current = newOptions;
  }, [settingsState._modelOptions, filter, featureName]);
  if (memoizedOptions.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(WarningBox, { text: emptyMessage?.message || "No models available" });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ModelSelectBox, { featureName, options: memoizedOptions, className });
};
var ModelDropdown = ({ featureName, className }) => {
  const settingsState = useSettingsState();
  const accessor = useAccessor();
  const commandService = accessor.get("ICommandService");
  const openSettings = () => {
    commandService.executeCommand(CORTEXIDE_OPEN_SETTINGS_ACTION_ID);
  };
  const { emptyMessage } = modelFilterOfFeatureName[featureName];
  const isDisabled = isFeatureNameDisabled$1(featureName, settingsState);
  if (isDisabled)
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(WarningBox, { onClick: openSettings, text: emptyMessage && emptyMessage.priority === "always" ? emptyMessage.message : isDisabled === "needToEnableModel" ? "Enable a model" : isDisabled === "addModel" ? "Add a model" : isDisabled === "addProvider" || isDisabled === "notFilledIn" || isDisabled === "providerNotAutoDetected" ? "Provider required" : "Provider required" });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(MemoizedModelDropdown, { featureName, className }) });
};

// src2/sidebar-tsx/SidebarThreadSelector.tsx
var import_react10 = __toESM(require_react(), 1);
var import_jsx_runtime7 = __toESM(require_jsx_runtime(), 1);
var numInitialThreads = 3;
var PastThreadsList = ({ className = "" }) => {
  const [showAll, setShowAll] = (0, import_react10.useState)(false);
  const [hoveredIdx, setHoveredIdx] = (0, import_react10.useState)(null);
  const threadsState = useChatThreadsState();
  const { allThreads } = threadsState;
  const streamState = useFullChatThreadsStreamState();
  const runningThreadIds = (0, import_react10.useMemo)(() => {
    const result = {};
    for (const threadId in streamState) {
      const isRunning = streamState[threadId]?.isRunning;
      if (isRunning) {
        result[threadId] = isRunning;
      }
    }
    return result;
  }, [streamState]);
  if (!allThreads) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "void-p-1", children: `Error accessing chat history.` }, "error");
  }
  const sortedThreadIds = (0, import_react10.useMemo)(() => {
    return Object.keys(allThreads ?? {}).sort((threadId1, threadId2) => (allThreads[threadId1]?.lastModified ?? 0) > (allThreads[threadId2]?.lastModified ?? 0) ? -1 : 1).filter((threadId) => (allThreads[threadId]?.messages.length ?? 0) !== 0);
  }, [allThreads]);
  const hasMoreThreads = sortedThreadIds.length > numInitialThreads;
  const displayThreads = showAll ? sortedThreadIds : sortedThreadIds.slice(0, numInitialThreads);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: `void-flex void-flex-col void-mb-2 void-gap-2 void-w-full void-text-nowrap void-text-void-fg-2 void-select-none void-relative ${className}`, children: [
    displayThreads.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_jsx_runtime7.Fragment, {}) : displayThreads.map((threadId, i) => {
      const pastThread = allThreads[threadId];
      if (!pastThread) {
        return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "void-p-1", children: `Error accessing chat history.` }, i);
      }
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        PastThreadElement,
        {
          pastThread,
          idx: i,
          hoveredIdx,
          setHoveredIdx,
          isRunning: runningThreadIds[pastThread.id]
        },
        pastThread.id
      );
    }),
    hasMoreThreads && !showAll && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
      "div",
      {
        className: "void-text-void-fg-3 void-opacity-80 hover:void-opacity-100 hover:void-brightness-115 void-cursor-pointer void-p-1 void-text-xs",
        onClick: () => setShowAll(true),
        children: [
          "Show ",
          sortedThreadIds.length - numInitialThreads,
          " more..."
        ]
      }
    ),
    hasMoreThreads && showAll && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "div",
      {
        className: "void-text-void-fg-3 void-opacity-80 hover:void-opacity-100 hover:void-brightness-115 void-cursor-pointer void-p-1 void-text-xs",
        onClick: () => setShowAll(false),
        children: "Show less"
      }
    )
  ] });
};
var formatDate = (date) => {
  const now = /* @__PURE__ */ new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date >= today) {
    return "Today";
  } else if (date >= yesterday) {
    return "Yesterday";
  } else {
    return `${date.toLocaleString("default", { month: "short" })} ${date.getDate()}`;
  }
};
var DuplicateButton = ({ threadId }) => {
  const accessor = useAccessor();
  const chatThreadsService = accessor.get("IChatThreadService");
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    IconShell1,
    {
      Icon: Copy,
      className: "void-size-[11px]",
      onClick: () => {
        chatThreadsService.duplicateThread(threadId);
      },
      "data-tooltip-id": "void-tooltip",
      "data-tooltip-place": "top",
      "data-tooltip-content": "Duplicate thread"
    }
  );
};
var TrashButton = ({ threadId }) => {
  const accessor = useAccessor();
  const chatThreadsService = accessor.get("IChatThreadService");
  const [isTrashPressed, setIsTrashPressed] = (0, import_react10.useState)(false);
  return isTrashPressed ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "void-flex void-flex-nowrap void-text-nowrap void-gap-1", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      IconShell1,
      {
        Icon: X,
        className: "void-size-[11px]",
        onClick: () => {
          setIsTrashPressed(false);
        },
        "data-tooltip-id": "void-tooltip",
        "data-tooltip-place": "top",
        "data-tooltip-content": "Cancel"
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      IconShell1,
      {
        Icon: Check,
        className: "void-size-[11px]",
        onClick: () => {
          chatThreadsService.deleteThread(threadId);
          setIsTrashPressed(false);
        },
        "data-tooltip-id": "void-tooltip",
        "data-tooltip-place": "top",
        "data-tooltip-content": "Confirm"
      }
    )
  ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    IconShell1,
    {
      Icon: Trash2,
      className: "void-size-[11px]",
      onClick: () => {
        setIsTrashPressed(true);
      },
      "data-tooltip-id": "void-tooltip",
      "data-tooltip-place": "top",
      "data-tooltip-content": "Delete thread"
    }
  );
};
var PastThreadElement = ({
  pastThread,
  idx,
  hoveredIdx,
  setHoveredIdx,
  isRunning
}) => {
  const accessor = useAccessor();
  const chatThreadsService = accessor.get("IChatThreadService");
  let firstMsg = null;
  const firstUserMsgIdx = pastThread.messages.findIndex((msg) => msg.role === "user");
  if (firstUserMsgIdx !== -1) {
    const firsUsertMsgObj = pastThread.messages[firstUserMsgIdx];
    firstMsg = firsUsertMsgObj.role === "user" && firsUsertMsgObj.displayContent || "";
  } else {
    firstMsg = '""';
  }
  const numMessages = pastThread.messages.filter((msg) => msg.role === "assistant" || msg.role === "user").length;
  const detailsHTML = /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "void-inline-flex void-items-center void-gap-1 void-px-2 void-py-0.5 void-rounded-full void-bg-void-bg-2 void-text-[10px] void-tracking-wide void-uppercase void-text-void-fg-3", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { children: [
      numMessages,
      " msg"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: "void-opacity-80", children: formatDate(new Date(pastThread.lastModified)) })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    "div",
    {
      className: ` void-group void-px-3 void-py-2 void-rounded-xl void-border void-border-void-border-3/70 void-bg-void-bg-1/40 hover:void-bg-void-bg-2/70 void-cursor-pointer void-text-sm void-text-void-fg-1 void-transition-all void-duration-150 void-ease-out void-shadow-[0_8px_20px_rgba(0,0,0,0.35)] hover:-void-translate-y-0.5 `,
      onClick: () => {
        chatThreadsService.openTab(pastThread.id);
      },
      onMouseEnter: () => setHoveredIdx(idx),
      onMouseLeave: () => setHoveredIdx(null),
      children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "void-flex void-items-center void-justify-between void-gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: "void-flex void-items-center void-gap-2 void-min-w-0 void-overflow-hidden void-text-void-fg-2", children: [
          isRunning === "LLM" || isRunning === "tool" || isRunning === "preparing" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(LoaderCircle, { className: "void-animate-spin void-text-void-fg-1 void-flex-shrink-0 void-flex-grow-0", size: 14 }) : isRunning === "awaiting_user" ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MessageCircleQuestion, { className: "void-text-void-fg-1 void-flex-shrink-0 void-flex-grow-0", size: 14 }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
            "span",
            {
              className: "void-truncate void-overflow-hidden void-text-ellipsis void-text-void-fg-1",
              "data-tooltip-id": "void-tooltip",
              "data-tooltip-content": numMessages + " messages",
              "data-tooltip-place": "top",
              children: firstMsg
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "void-flex void-items-center void-gap-x-1 void-opacity-80 void-text-void-fg-3", children: idx === hoveredIdx ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(DuplicateButton, { threadId: pastThread.id }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TrashButton, { threadId: pastThread.id })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_jsx_runtime7.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "void-opacity-90", children: detailsHTML }) }) })
      ] })
    },
    pastThread.id
  );
};

// src2/sidebar-tsx/ChatTabsBar.tsx
var import_react11 = __toESM(require_react(), 1);
var import_jsx_runtime8 = __toESM(require_jsx_runtime(), 1);
var getThreadTitle = (thread) => {
  if (!thread) return "New Chat";
  const firstUserMsgIdx = thread.messages.findIndex((msg) => msg.role === "user");
  if (firstUserMsgIdx !== -1) {
    const firstUserMsg = thread.messages[firstUserMsgIdx];
    if (firstUserMsg.role === "user" && firstUserMsg.displayContent) {
      const title = firstUserMsg.displayContent;
      return title.length > 30 ? title.substring(0, 30) + "..." : title;
    }
  }
  return "New Chat";
};
var ChatTab = ({ threadId, isActive, onClick, onClose, isRunning }) => {
  const threadsState = useChatThreadsState();
  const thread = threadsState.allThreads[threadId];
  const title = getThreadTitle(thread);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "div",
    {
      className: ` void-group void-flex void-items-center void-gap-1.5 void-px-3 void-py-1.5 void-rounded-t-lg void-border-b-2 void-transition-all void-duration-150 void-cursor-pointer ${isActive ? "void-bg-void-bg-2 void-border-void-fg-1 void-text-void-fg-1" : "void-bg-void-bg-1/40 void-border-transparent void-text-void-fg-2 hover:void-bg-void-bg-1/60 hover:void-text-void-fg-1"} `,
      onClick,
      children: [
        isRunning === "LLM" || isRunning === "tool" || isRunning === "preparing" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(LoaderCircle, { className: "void-animate-spin void-text-void-fg-1 void-flex-shrink-0", size: 12 }) : isRunning === "awaiting_user" ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(MessageCircleQuestion, { className: "void-text-void-fg-1 void-flex-shrink-0", size: 12 }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: "void-text-xs void-truncate void-max-w-[120px]", title, children: title }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          IconShell1,
          {
            Icon: X,
            className: "void-size-[11px] void-opacity-0 group-hover:void-opacity-100 void-transition-opacity void-flex-shrink-0",
            onClick: (e) => {
              e.stopPropagation();
              onClose(e);
            },
            "data-tooltip-id": "void-tooltip",
            "data-tooltip-place": "top",
            "data-tooltip-content": "Close tab"
          }
        )
      ]
    }
  );
};
var ChatTabsBar = () => {
  const accessor = useAccessor();
  const chatThreadsService = accessor.get("IChatThreadService");
  const threadsState = useChatThreadsState();
  const streamState = useFullChatThreadsStreamState();
  const { openTabs, currentThreadId } = threadsState;
  const runningThreadIds = (0, import_react11.useMemo)(() => {
    const result = {};
    for (const threadId in streamState) {
      const isRunning = streamState[threadId]?.isRunning;
      if (isRunning) {
        result[threadId] = isRunning;
      }
    }
    return result;
  }, [streamState]);
  const validTabs = (0, import_react11.useMemo)(() => {
    return openTabs.filter((threadId) => threadsState.allThreads[threadId] !== void 0);
  }, [openTabs, threadsState.allThreads]);
  if (validTabs.length === 0) {
    return null;
  }
  const handleTabClick = (threadId) => {
    chatThreadsService.switchToTab(threadId);
  };
  const handleTabClose = (threadId) => {
    chatThreadsService.closeTab(threadId);
  };
  const handleNewTab = () => {
    chatThreadsService.openNewThread();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("div", { className: "void-flex void-items-end void-gap-1 void-px-2 void-pt-2 void-border-b void-border-void-border-3 void-bg-void-bg-1/30", children: [
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: "void-flex void-items-end void-gap-1 void-overflow-x-auto void-flex-1 void-min-w-0", children: validTabs.map(
      (threadId) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        ChatTab,
        {
          threadId,
          isActive: threadId === currentThreadId,
          onClick: () => handleTabClick(threadId),
          onClose: () => handleTabClose(threadId),
          isRunning: runningThreadIds[threadId]
        },
        threadId
      )
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
      "button",
      {
        className: "void-px-2 void-py-1.5 void-rounded-t-lg void-bg-void-bg-1/40 hover:void-bg-void-bg-1/60 void-text-void-fg-2 hover:void-text-void-fg-1 void-transition-all void-duration-150 void-text-xs void-border-b-2 void-border-transparent hover:void-border-void-border-3 void-flex-shrink-0",
        onClick: handleNewTab,
        "data-tooltip-id": "void-tooltip",
        "data-tooltip-place": "top",
        "data-tooltip-content": "New chat tab",
        children: "+"
      }
    )
  ] });
};

// src2/util/useImageAttachments.ts
var import_react12 = __toESM(require_react(), 1);

// src2/util/imageUtils.ts
var ALLOWED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];
var MAX_DIMENSION = 2048;
function toArrayBuffer(data) {
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
}
function formatFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
function validateImageFile(file) {
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
    return {
      type: "mime_type",
      message: `Unsupported image type: ${file.type}. Supported: PNG, JPEG, WebP, GIF, SVG.`
    };
  }
  if (file.size > 30 * 1024 * 1024) {
    return {
      type: "size",
      message: `Image is too large: ${formatFileSize(file.size)}. Maximum: 30 MB.`
    };
  }
  return null;
}
async function processImage(file, onProgress) {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError.message);
  }
  onProgress?.(0.1);
  const mimeType = file.type;
  if (mimeType === "image/svg+xml") {
    onProgress?.(0.3);
    return await processSvgImage(file, onProgress);
  }
  onProgress?.(0.2);
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  onProgress?.(0.4);
  const img = await loadImageWithOrientation(uint8Array, onProgress);
  let targetWidth = img.width;
  let targetHeight = img.height;
  const needsResize = img.width > MAX_DIMENSION || img.height > MAX_DIMENSION;
  if (needsResize) {
    const scaleFactor = MAX_DIMENSION / Math.max(img.width, img.height);
    targetWidth = Math.round(img.width * scaleFactor);
    targetHeight = Math.round(img.height * scaleFactor);
  }
  onProgress?.(0.6);
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }
  if (img.orientation && img.orientation !== 1) {
    applyOrientation(ctx, img.orientation, targetWidth, targetHeight);
  }
  onProgress?.(0.7);
  ctx.drawImage(img.image, 0, 0, targetWidth, targetHeight);
  const outputMimeType = mimeType === "image/png" ? "image/png" : "image/jpeg";
  const quality = determineQuality(mimeType, targetWidth, targetHeight);
  onProgress?.(0.8);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create blob from canvas"));
          return;
        }
        onProgress?.(0.9);
        const reader = new FileReader();
        reader.onload = () => {
          const data = new Uint8Array(reader.result);
          onProgress?.(1);
          resolve({
            data,
            mimeType: outputMimeType,
            width: targetWidth,
            height: targetHeight,
            filename: sanitizeFilename(file.name),
            size: data.length,
            originalSize: file.size
          });
        };
        reader.onerror = () => reject(new Error("Failed to read blob"));
        reader.readAsArrayBuffer(blob);
      },
      outputMimeType,
      quality
    );
  });
}
function parseExifOrientation(data) {
  if (data.length < 4 || data[0] !== 255 || data[1] !== 216) {
    return 1;
  }
  let offset3 = 2;
  while (offset3 < data.length - 1) {
    if (data[offset3] === 255 && data[offset3 + 1] === 225) {
      if (offset3 + 6 < data.length) {
        const exifMarker = String.fromCharCode(
          data[offset3 + 4],
          data[offset3 + 5],
          data[offset3 + 6],
          data[offset3 + 7]
        );
        if (exifMarker === "Exif") {
          const tiffOffset = offset3 + 10;
          if (tiffOffset + 8 < data.length) {
            const isIntel = data[tiffOffset] === 73 && data[tiffOffset + 1] === 73;
            if (isIntel || data[tiffOffset] === 77 && data[tiffOffset + 1] === 77) {
              let ifdOffsetValue = 0;
              if (tiffOffset + 8 < data.length) {
                if (isIntel) {
                  ifdOffsetValue = data[tiffOffset + 4] | data[tiffOffset + 5] << 8 | data[tiffOffset + 6] << 16 | data[tiffOffset + 7] << 24;
                } else {
                  ifdOffsetValue = data[tiffOffset + 4] << 24 | data[tiffOffset + 5] << 16 | data[tiffOffset + 6] << 8 | data[tiffOffset + 7];
                }
                if (ifdOffsetValue >= 0) {
                  const ifdOffset = tiffOffset + ifdOffsetValue;
                  if (ifdOffset < data.length && ifdOffset + 2 < data.length) {
                    let numEntries = 0;
                    if (isIntel) {
                      numEntries = data[ifdOffset] | data[ifdOffset + 1] << 8;
                    } else {
                      numEntries = data[ifdOffset] << 8 | data[ifdOffset + 1];
                    }
                    let entryOffset = ifdOffset + 2;
                    for (let i = 0; i < numEntries && entryOffset + 12 < data.length; i++, entryOffset += 12) {
                      let tag2 = 0;
                      if (isIntel) {
                        tag2 = data[entryOffset] | data[entryOffset + 1] << 8;
                      } else {
                        tag2 = data[entryOffset] << 8 | data[entryOffset + 1];
                      }
                      if (tag2 === 274) {
                        let orientation = 0;
                        if (isIntel) {
                          orientation = data[entryOffset + 8] | data[entryOffset + 9] << 8;
                        } else {
                          orientation = data[entryOffset + 8] << 8 | data[entryOffset + 9];
                        }
                        if (orientation >= 1 && orientation <= 8) {
                          return orientation;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    if (offset3 + 2 < data.length) {
      const segmentLength = data[offset3 + 2] << 8 | data[offset3 + 3];
      offset3 += 2 + segmentLength;
    } else {
      break;
    }
  }
  return 1;
}
async function loadImageWithOrientation(data, onProgress) {
  return new Promise((resolve, reject) => {
    onProgress?.(0.5);
    const blob = new Blob([toArrayBuffer(data)]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      onProgress?.(0.6);
      const orientation = parseExifOrientation(data);
      resolve({
        image: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        orientation
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}
async function processSvgImage(file, onProgress) {
  onProgress?.(0.3);
  const svgText = await file.text();
  let sanitized = svgText.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, (match) => {
    if (/expression\s*\(|javascript:|@import|url\s*\(/i.test(match)) {
      return "";
    }
    return match;
  }).replace(/on\w+\s*=\s*["'][^"']*["']/gi, "").replace(/javascript:/gi, "").replace(/<use[^>]*href\s*=\s*["'][^"']*["'][^>]*>/gi, "").replace(/<image[^>]*href\s*=\s*["'][^"']*["'][^>]*>/gi, "").replace(/<image[^>]*xlink:href\s*=\s*["'][^"']*["'][^>]*>/gi, "").replace(/url\s*\(\s*["']?data:/gi, "url(#blocked)").replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "").replace(/<iframe[\s\S]*?<\/iframe>/gi, "").replace(/<embed[^>]*>/gi, "").replace(/<\?xml-stylesheet[^>]*\?>/gi, "").replace(/<link[^>]*>/gi, "");
  const originalLength = svgText.length;
  const sanitizedLength = sanitized.length;
  const removalRatio = (originalLength - sanitizedLength) / originalLength;
  if (removalRatio > 0.3) {
    console.warn("SVG sanitization removed >30% of content, using raster fallback for safety");
  }
  onProgress?.(0.5);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([sanitized], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const loadTimeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG loading timeout - file may be corrupted or malicious"));
    }, 1e4);
    img.onload = () => {
      clearTimeout(loadTimeout);
      URL.revokeObjectURL(url);
      onProgress?.(0.7);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 600;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context for SVG"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      onProgress?.(0.8);
      canvas.toBlob((blob2) => {
        if (!blob2) {
          reject(new Error("Failed to rasterize SVG"));
          return;
        }
        onProgress?.(0.9);
        const reader = new FileReader();
        reader.onload = () => {
          const data = new Uint8Array(reader.result);
          onProgress?.(1);
          resolve({
            data,
            mimeType: "image/png",
            width: canvas.width,
            height: canvas.height,
            filename: sanitizeFilename(file.name.replace(/\.svg$/i, ".png")),
            size: data.length,
            originalSize: file.size
          });
        };
        reader.onerror = () => reject(new Error("Failed to read rasterized SVG"));
        reader.readAsArrayBuffer(blob2);
      }, "image/png", 0.95);
    };
    img.onerror = () => {
      clearTimeout(loadTimeout);
      URL.revokeObjectURL(url);
      onProgress?.(0.7);
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#666";
        ctx.font = "16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SVG preview unavailable", canvas.width / 2, canvas.height / 2);
        canvas.toBlob((blob2) => {
          if (blob2) {
            const reader = new FileReader();
            reader.onload = () => {
              const data = new Uint8Array(reader.result);
              resolve({
                data,
                mimeType: "image/png",
                width: canvas.width,
                height: canvas.height,
                filename: sanitizeFilename(file.name.replace(/\.svg$/i, ".png")),
                size: data.length,
                originalSize: file.size
              });
            };
            reader.readAsArrayBuffer(blob2);
          } else {
            reject(new Error("Failed to load SVG and create fallback"));
          }
        }, "image/png");
      } else {
        reject(new Error("Failed to load SVG"));
      }
    };
    img.src = url;
  });
}
function applyOrientation(ctx, orientation, width, height) {
  ctx.save();
  switch (orientation) {
    case 2:
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      break;
    case 3:
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
      break;
    case 4:
      ctx.translate(0, height);
      ctx.scale(1, -1);
      break;
    case 5:
      ctx.translate(height, 0);
      ctx.rotate(Math.PI / 2);
      ctx.scale(-1, 1);
      break;
    case 6:
      ctx.translate(height, 0);
      ctx.rotate(Math.PI / 2);
      break;
    case 7:
      ctx.translate(0, width);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(-1, 1);
      break;
    case 8:
      ctx.translate(0, width);
      ctx.rotate(-Math.PI / 2);
      break;
  }
  ctx.restore();
}
function determineQuality(mimeType, width, height) {
  if (mimeType === "image/png") {
    return 1;
  }
  const pixels = width * height;
  if (pixels > 2e6) {
    return 0.85;
  } else if (pixels > 1e6) {
    return 0.9;
  } else {
    return 0.92;
  }
}
function sanitizeFilename(filename) {
  return filename.replace(/^.*[\/\\]/, "").replace(/\0/g, "").replace(/[<>:"|?*\x00-\x1f]/g, "_").substring(0, 255);
}
function createImageDataUrl(data, mimeType) {
  const blob = new Blob([toArrayBuffer(data)], { type: mimeType });
  return URL.createObjectURL(blob);
}
function revokeImageDataUrl(url) {
  URL.revokeObjectURL(url);
}

// src2/util/useImageAttachments.ts
function useImageAttachments() {
  const [attachments, setAttachments] = (0, import_react12.useState)([]);
  const [focusedIndex, setFocusedIndex] = (0, import_react12.useState)(null);
  const [validationError, setValidationError] = (0, import_react12.useState)(null);
  const processingRef = (0, import_react12.useRef)(/* @__PURE__ */ new Set());
  const cancelRef = (0, import_react12.useRef)(/* @__PURE__ */ new Map());
  const originalFilesRef = (0, import_react12.useRef)(/* @__PURE__ */ new Map());
  const addImages = (0, import_react12.useCallback)(async (files) => {
    setValidationError(null);
    const validationErrors = [];
    for (const file of files) {
      const error2 = validateImageFile(file);
      if (error2) {
        if (error2.type === "size") {
          validationErrors.push({
            ...error2,
            message: `${file.name}: ${error2.message}`
          });
        } else {
          validationErrors.push({
            ...error2,
            message: `${file.name}: ${error2.message}`
          });
        }
      }
    }
    if (validationErrors.length > 0) {
      setValidationError(validationErrors[0]);
      return;
    }
    if (attachments.length + files.length > 10) {
      setValidationError({
        type: "count",
        message: `Too many images: ${attachments.length + files.length}. Maximum: 10 images per message.`
      });
      return;
    }
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      originalFilesRef.current.set(id, file);
      const placeholder = {
        id,
        data: new Uint8Array(0),
        mimeType: file.type,
        filename: file.name,
        width: 0,
        height: 0,
        size: 0,
        uploadStatus: "pending"
      };
      setAttachments((prev) => [...prev, placeholder]);
      processingRef.current.add(id);
      let cancelled = false;
      const cancelFn = () => {
        cancelled = true;
        processingRef.current.delete(id);
        cancelRef.current.delete(id);
        originalFilesRef.current.delete(id);
        setAttachments((prev) => prev.filter((att) => att.id !== id));
      };
      cancelRef.current.set(id, cancelFn);
      const updateProgress = (progress) => {
        if (cancelled) return;
        setAttachments((prev) => prev.map(
          (att) => att.id === id ? { ...att, uploadStatus: "uploading", uploadProgress: progress } : att
        ));
      };
      try {
        updateProgress(0.1);
        const processed = await processImage(file, (stageProgress) => {
          const progress = 0.1 + stageProgress * 0.8;
          updateProgress(progress);
        });
        if (cancelled) return;
        setAttachments((prev) => prev.map(
          (att) => att.id === id ? {
            ...att,
            data: processed.data,
            mimeType: processed.mimeType,
            filename: processed.filename,
            width: processed.width,
            height: processed.height,
            size: processed.size,
            uploadStatus: "success",
            uploadProgress: 1
          } : att
        ));
        setAttachments((prev) => {
          const successful = prev.filter((a) => a.uploadStatus === "success");
          const totalSize = successful.reduce((sum, img) => sum + img.size, 0);
          const maxTotalSize = 20 * 1024 * 1024;
          if (successful.length > 10) {
            const error2 = {
              type: "count",
              message: `Too many images: ${successful.length}. Maximum: 10.`
            };
            setValidationError(error2);
            return prev.map(
              (att) => att.id === id ? { ...att, uploadStatus: "failed", error: error2.message, uploadProgress: void 0 } : att
            );
          }
          if (totalSize > maxTotalSize) {
            const error2 = {
              type: "size",
              message: `Total image size too large: ${formatFileSize(totalSize)}. Maximum: ${formatFileSize(maxTotalSize)}.`
            };
            setValidationError(error2);
            return prev.map(
              (att) => att.id === id ? { ...att, uploadStatus: "failed", error: error2.message, uploadProgress: void 0 } : att
            );
          }
          return prev;
        });
        cancelRef.current.delete(id);
      } catch (error2) {
        if (cancelled) return;
        const errorMessage = error2 instanceof Error ? error2.message : "Failed to process image";
        setAttachments((prev) => prev.map(
          (att) => att.id === id ? {
            ...att,
            uploadStatus: "failed",
            error: errorMessage,
            uploadProgress: void 0
          } : att
        ));
        setValidationError({
          type: "corrupt",
          message: errorMessage
        });
      } finally {
        if (!cancelled) {
          processingRef.current.delete(id);
          cancelRef.current.delete(id);
        }
      }
    }
  }, [attachments.length]);
  const removeImage = (0, import_react12.useCallback)((id) => {
    const cancelFn = cancelRef.current.get(id);
    if (cancelFn) {
      cancelFn();
      return;
    }
    setAttachments((prev) => prev.filter((att) => att.id !== id));
    originalFilesRef.current.delete(id);
    setValidationError(null);
    if (focusedIndex !== null && focusedIndex >= attachments.length - 1) {
      setFocusedIndex(Math.max(0, attachments.length - 2));
    }
  }, [attachments.length, focusedIndex]);
  const cancelImage = (0, import_react12.useCallback)((id) => {
    const cancelFn = cancelRef.current.get(id);
    if (cancelFn) {
      cancelFn();
    }
  }, []);
  const retryImage = (0, import_react12.useCallback)(async (id) => {
    const attachment = attachments.find((att) => att.id === id);
    if (!attachment) return;
    const originalFile = originalFilesRef.current.get(id);
    if (!originalFile) {
      setAttachments((prev) => prev.map(
        (att) => att.id === id ? {
          ...att,
          uploadStatus: "failed",
          error: "Cannot retry: original file not available"
        } : att
      ));
      return;
    }
    setAttachments((prev) => prev.map(
      (att) => att.id === id ? { ...att, uploadStatus: "pending", error: void 0, uploadProgress: void 0 } : att
    ));
    processingRef.current.add(id);
    let cancelled = false;
    const cancelFn = () => {
      cancelled = true;
      processingRef.current.delete(id);
      cancelRef.current.delete(id);
    };
    cancelRef.current.set(id, cancelFn);
    const updateProgress = (progress) => {
      if (cancelled) return;
      setAttachments((prev) => prev.map(
        (att) => att.id === id ? { ...att, uploadStatus: "uploading", uploadProgress: progress } : att
      ));
    };
    try {
      updateProgress(0.1);
      const processed = await processImage(originalFile, (stageProgress) => {
        const progress = 0.1 + stageProgress * 0.8;
        updateProgress(progress);
      });
      if (cancelled) return;
      setAttachments((prev) => prev.map(
        (att) => att.id === id ? {
          ...att,
          data: processed.data,
          mimeType: processed.mimeType,
          filename: processed.filename,
          width: processed.width,
          height: processed.height,
          size: processed.size,
          uploadStatus: "success",
          uploadProgress: 1
        } : att
      ));
    } catch (error2) {
      if (cancelled) return;
      const errorMessage = error2 instanceof Error ? error2.message : "Failed to process image";
      setAttachments((prev) => prev.map(
        (att) => att.id === id ? {
          ...att,
          uploadStatus: "failed",
          error: errorMessage,
          uploadProgress: void 0
        } : att
      ));
    } finally {
      if (!cancelled) {
        processingRef.current.delete(id);
        cancelRef.current.delete(id);
      }
    }
  }, [attachments]);
  const clearAll = (0, import_react12.useCallback)(() => {
    cancelRef.current.forEach((cancelFn) => cancelFn());
    cancelRef.current.clear();
    processingRef.current.clear();
    originalFilesRef.current.clear();
    setAttachments([]);
    setValidationError(null);
    setFocusedIndex(null);
  }, []);
  return {
    attachments,
    addImages,
    removeImage,
    retryImage,
    cancelImage,
    clearAll,
    focusedIndex,
    setFocusedIndex,
    validationError
  };
}

// src2/util/usePDFAttachments.ts
var import_react13 = __toESM(require_react(), 1);
var MAX_PDF_SIZE = 50 * 1024 * 1024;
var MAX_PDFS = 5;
function usePDFAttachments() {
  const [attachments, setAttachments] = (0, import_react13.useState)([]);
  const [focusedIndex, setFocusedIndex] = (0, import_react13.useState)(null);
  const [validationError, setValidationError] = (0, import_react13.useState)(null);
  const processingRef = (0, import_react13.useRef)(/* @__PURE__ */ new Set());
  const cancelRef = (0, import_react13.useRef)(/* @__PURE__ */ new Map());
  const originalFilesRef = (0, import_react13.useRef)(/* @__PURE__ */ new Map());
  const pdfServiceRef = (0, import_react13.useRef)(null);
  const getPDFServiceInstance = (0, import_react13.useCallback)(async () => {
    if (!pdfServiceRef.current) {
      pdfServiceRef.current = getPDFService();
    }
    return pdfServiceRef.current;
  }, []);
  const addPDFs = (0, import_react13.useCallback)(async (files) => {
    setValidationError(null);
    for (const file of files) {
      if (file.type !== "application/pdf") {
        setValidationError(`${file.name} is not a PDF file.`);
        return;
      }
      if (file.size > MAX_PDF_SIZE) {
        setValidationError(`${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum: ${MAX_PDF_SIZE / 1024 / 1024}MB.`);
        return;
      }
    }
    if (attachments.length + files.length > MAX_PDFS) {
      setValidationError(`Too many PDFs: ${attachments.length + files.length}. Maximum: ${MAX_PDFS} PDFs per message.`);
      return;
    }
    const fileIds = files.map(() => `${Date.now()}-${Math.random().toString(36).substring(7)}`);
    const placeholders = files.map((file, index3) => ({
      id: fileIds[index3],
      data: new Uint8Array(0),
      filename: file.name,
      size: file.size,
      uploadStatus: "pending"
    }));
    setAttachments((prev) => [...prev, ...placeholders]);
    files.forEach((file, index3) => {
      const id = fileIds[index3];
      originalFilesRef.current.set(id, file);
      processingRef.current.add(id);
      const cancelFn = () => {
        processingRef.current.delete(id);
        cancelRef.current.delete(id);
        originalFilesRef.current.delete(id);
        setAttachments((prev) => prev.filter((att) => att.id !== id));
      };
      cancelRef.current.set(id, cancelFn);
    });
    const pdfService = await getPDFServiceInstance();
    const processingPromises = files.map(async (file, index3) => {
      const id = fileIds[index3];
      let cancelled = false;
      const checkCancelled = () => {
        if (!processingRef.current.has(id)) {
          cancelled = true;
        }
        return cancelled;
      };
      const updateProgress = (progress, status = "uploading") => {
        if (checkCancelled()) return;
        setAttachments((prev) => prev.map(
          (att) => att.id === id ? { ...att, uploadStatus: status, uploadProgress: progress } : att
        ));
      };
      try {
        updateProgress(0.1, "uploading");
        const arrayBuffer = await file.arrayBuffer();
        if (checkCancelled()) return;
        updateProgress(0.3, "uploading");
        const data = new Uint8Array(arrayBuffer);
        if (checkCancelled()) return;
        updateProgress(0.5, "processing");
        const previewPageCount = 3;
        const previewPageNumbers = Array.from({ length: previewPageCount }, (_, i) => i + 1);
        const pdfDocWithPreviews = await pdfService.extractPDFWithPreviews(data, {
          extractImages: false,
          extractMetadata: true,
          previewPages: previewPageNumbers,
          // Only generate previews for first 3 pages
          previewMaxWidth: 200,
          previewMaxHeight: 300
        });
        if (checkCancelled()) return;
        updateProgress(0.9, "processing");
        const selectedPages = Array.from({ length: pdfDocWithPreviews.pageCount }, (_, i) => i + 1);
        const extractedText = pdfDocWithPreviews.pages.map((p) => `[Page ${p.pageNumber}]
${p.text}`).join("\n\n");
        if (checkCancelled()) return;
        setAttachments((prev) => prev.map(
          (att) => att.id === id ? {
            ...att,
            data,
            pageCount: pdfDocWithPreviews.pageCount,
            selectedPages,
            extractedText,
            pagePreviews: pdfDocWithPreviews.pagePreviews || [],
            uploadStatus: "success",
            uploadProgress: 1
          } : att
        ));
        processingRef.current.delete(id);
        cancelRef.current.delete(id);
      } catch (error2) {
        if (checkCancelled()) return;
        console.error("Error processing PDF:", error2);
        setAttachments((prev) => prev.map(
          (att) => att.id === id ? {
            ...att,
            uploadStatus: "failed",
            error: error2.message || "Failed to process PDF"
          } : att
        ));
        processingRef.current.delete(id);
        cancelRef.current.delete(id);
      }
    });
    await Promise.allSettled(processingPromises);
  }, [attachments.length, getPDFServiceInstance]);
  const removePDF = (0, import_react13.useCallback)((id) => {
    cancelRef.current.get(id)?.();
    setAttachments((prev) => prev.filter((att) => att.id !== id));
    originalFilesRef.current.delete(id);
  }, []);
  const retryPDF = (0, import_react13.useCallback)(async (id) => {
    const originalFile = originalFilesRef.current.get(id);
    if (!originalFile) return;
    removePDF(id);
    await addPDFs([originalFile]);
  }, [addPDFs, removePDF]);
  const cancelPDF = (0, import_react13.useCallback)((id) => {
    cancelRef.current.get(id)?.();
  }, []);
  const clearAll = (0, import_react13.useCallback)(() => {
    attachments.forEach((att) => cancelRef.current.get(att.id)?.());
    setAttachments([]);
    processingRef.current.clear();
    cancelRef.current.clear();
    originalFilesRef.current.clear();
    setValidationError(null);
  }, [attachments]);
  const updateSelectedPages = (0, import_react13.useCallback)((id, pages) => {
    setAttachments((prev) => prev.map(
      (att) => att.id === id ? { ...att, selectedPages: pages } : att
    ));
  }, []);
  return {
    attachments,
    addPDFs,
    removePDF,
    retryPDF,
    cancelPDF,
    clearAll,
    updateSelectedPages,
    focusedIndex,
    setFocusedIndex,
    validationError
  };
}

// src2/util/PDFAttachmentList.tsx
var import_react14 = __toESM(require_react(), 1);
var import_jsx_runtime9 = __toESM(require_jsx_runtime(), 1);
var formatFileSize2 = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
var PDFAttachmentList = ({
  attachments,
  onRemove,
  onRetry,
  onCancel,
  focusedIndex,
  onFocusChange
}) => {
  const handleKeyDown = (0, import_react14.useCallback)((e, index3) => {
    if (e.key === "ArrowLeft" && index3 > 0) {
      e.preventDefault();
      onFocusChange(index3 - 1);
    } else if (e.key === "ArrowRight" && index3 < attachments.length - 1) {
      e.preventDefault();
      onFocusChange(index3 + 1);
    }
  }, [attachments.length, onFocusChange]);
  if (attachments.length === 0) {
    return null;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    "div",
    {
      className: "void-flex void-flex-wrap void-gap-2 void-p-2 void-max-h-[300px] void-overflow-y-auto",
      role: "list",
      "aria-label": `${attachments.length} PDF attachment${attachments.length !== 1 ? "s" : ""}`,
      children: attachments.map((attachment, index3) => {
        const isUploading = attachment.uploadStatus === "uploading" || attachment.uploadStatus === "processing";
        const isFailed = attachment.uploadStatus === "failed";
        attachment.uploadStatus === "success" || !attachment.uploadStatus;
        const focused = focusedIndex === index3;
        return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
          "div",
          {
            role: "listitem",
            tabIndex: 0,
            onKeyDown: (e) => {
              handleKeyDown(e, index3);
              if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault();
                onRemove(attachment.id);
              } else if (e.key === "Enter" && isFailed && onRetry) {
                e.preventDefault();
                onRetry(attachment.id);
              }
            },
            onFocus: () => onFocusChange(index3),
            className: ` void-relative void-group void-flex void-flex-col void-w-[200px] void-min-h-[120px] void-rounded-md void-border void-border-void-border-3 void-bg-void-bg-2-alt void-overflow-hidden void-cursor-pointer void-transition-all void-duration-200 ${focused ? "void-ring-2 void-ring-blue-500 void-border-blue-500" : "hover:void-border-void-border-1"} ${isFailed ? "void-border-red-500" : ""} `,
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "void-relative void-flex-1 void-w-full void-overflow-hidden void-bg-void-bg-1 void-flex void-items-center void-justify-center", children: [
                attachment.pagePreviews && attachment.pagePreviews.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                  "img",
                  {
                    src: attachment.pagePreviews[0],
                    alt: `Page 1 of ${attachment.filename}`,
                    className: "void-w-full void-h-full void-object-contain",
                    loading: "lazy"
                  }
                ) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(FileText, { className: "void-w-12 void-h-12 void-text-void-fg-3" }),
                isUploading && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "void-absolute void-inset-0 void-bg-black/50 void-flex void-items-center void-justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "void-flex void-flex-col void-items-center void-gap-2", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(LoaderCircle, { className: "void-w-5 void-h-5 void-text-white void-animate-spin" }),
                  attachment.uploadProgress !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "void-text-xs void-text-white", children: [
                    Math.round(attachment.uploadProgress * 100),
                    "%"
                  ] }) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "void-text-xs void-text-white", children: "Processing..." }),
                  onCancel && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "button",
                    {
                      type: "button",
                      onClick: (e) => {
                        e.stopPropagation();
                        onCancel(attachment.id);
                      },
                      className: "void-text-xs void-text-white/80 hover:void-text-white void-underline void-mt-1",
                      "aria-label": "Cancel processing",
                      children: "Cancel"
                    }
                  )
                ] }) }),
                isFailed && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "void-absolute void-inset-0 void-bg-red-500/20 void-flex void-items-center void-justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(CircleAlert, { className: "void-w-5 void-h-5 void-text-red-500" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: (e) => {
                      e.stopPropagation();
                      onRemove(attachment.id);
                    },
                    "aria-label": `Remove ${attachment.filename}`,
                    className: "void-absolute void-top-1 void-right-1 void-p-1 void-rounded-md void-bg-black/60 hover:void-bg-black/80 void-text-white void-transition-opacity void-z-10 void-opacity-0 group-hover:void-opacity-100",
                    children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(X, { size: 14 })
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "void-px-2 void-py-1.5 void-bg-void-bg-2-alt void-border-t void-border-void-border-3", children: [
                /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "void-text-xs void-font-medium void-text-void-fg-1 void-truncate", title: attachment.filename, children: attachment.filename }),
                /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "void-flex void-items-center void-justify-between void-mt-0.5", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "void-text-[10px] void-text-void-fg-3", children: attachment.pageCount ? `${attachment.pageCount} page${attachment.pageCount !== 1 ? "s" : ""}` : formatFileSize2(attachment.size) }),
                  isFailed && attachment.error && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: "void-text-[10px] void-text-red-500 void-truncate void-max-w-[120px]", title: attachment.error, children: attachment.error })
                ] })
              ] })
            ]
          },
          attachment.id
        );
      })
    }
  );
};

// src2/util/ImageAttachmentList.tsx
var import_react16 = __toESM(require_react(), 1);

// src2/util/ImageAttachmentChip.tsx
var import_react15 = __toESM(require_react(), 1);
var import_jsx_runtime10 = __toESM(require_jsx_runtime(), 1);
var ImageAttachmentChip = ({
  attachment,
  onRemove,
  onRetry,
  onCancel,
  index: index3,
  focused,
  onFocus
}) => {
  const [previewUrl, setPreviewUrl] = (0, import_react15.useState)(null);
  const chipRef = (0, import_react15.useRef)(null);
  (0, import_react15.useEffect)(() => {
    const url = createImageDataUrl(attachment.data, attachment.mimeType);
    setPreviewUrl(url);
    return () => {
      if (url) {
        revokeImageDataUrl(url);
      }
    };
  }, [attachment.data, attachment.mimeType]);
  (0, import_react15.useEffect)(() => {
    if (focused && chipRef.current) {
      chipRef.current.focus();
    }
  }, [focused]);
  const handleKeyDown = (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onRemove();
    } else if (e.key === "Enter" && attachment.uploadStatus === "failed" && onRetry) {
      e.preventDefault();
      onRetry();
    }
  };
  const isUploading = attachment.uploadStatus === "uploading";
  const isFailed = attachment.uploadStatus === "failed";
  attachment.uploadStatus === "success" || !attachment.uploadStatus;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
    "div",
    {
      ref: chipRef,
      role: "button",
      tabIndex: 0,
      "aria-label": `Image attachment: ${attachment.filename}, ${formatFileSize(attachment.size)}. ${isUploading ? "Uploading" : isFailed ? "Failed" : "Ready"}`,
      onFocus,
      onKeyDown: handleKeyDown,
      className: ` void-relative void-group void-flex void-flex-col void-w-[160px] void-h-[120px] void-rounded-md void-border void-border-void-border-3 void-bg-void-bg-2-alt void-overflow-hidden void-cursor-pointer void-transition-all void-duration-200 ${focused ? "void-ring-2 void-ring-blue-500 void-border-blue-500" : "hover:void-border-void-border-1"} ${isFailed ? "void-border-red-500" : ""} `,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "void-relative void-flex-1 void-w-full void-overflow-hidden void-bg-void-bg-1", children: [
          previewUrl ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "img",
            {
              src: previewUrl,
              alt: attachment.filename,
              className: "void-w-full void-h-full void-object-cover",
              loading: "lazy"
            }
          ) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "void-w-full void-h-full void-flex void-items-center void-justify-center void-text-void-fg-3", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(LoaderCircle, { className: "void-w-6 void-h-6 void-animate-spin" }) }),
          isUploading && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "void-absolute void-inset-0 void-bg-black/50 void-flex void-items-center void-justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "void-flex void-flex-col void-items-center void-gap-2", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(LoaderCircle, { className: "void-w-5 void-h-5 void-text-white void-animate-spin" }),
            attachment.uploadProgress !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "void-text-xs void-text-white", children: [
              Math.round(attachment.uploadProgress * 100),
              "%"
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "void-text-xs void-text-white", children: "Processing..." }),
            onCancel && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
              "button",
              {
                type: "button",
                onClick: (e) => {
                  e.stopPropagation();
                  onCancel();
                },
                className: "void-text-xs void-text-white/80 hover:void-text-white void-underline void-mt-1",
                "aria-label": "Cancel upload",
                children: "Cancel"
              }
            )
          ] }) }),
          isFailed && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "void-absolute void-inset-0 void-bg-red-500/20 void-flex void-items-center void-justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(CircleAlert, { className: "void-w-5 void-h-5 void-text-red-500" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "button",
            {
              type: "button",
              onClick: (e) => {
                e.stopPropagation();
                onRemove();
              },
              "aria-label": `Remove ${attachment.filename}`,
              className: "void-absolute void-top-1 void-right-1 void-p-1 void-rounded-md void-bg-black/60 hover:void-bg-black/80 void-text-white void-transition-opacity void-z-10",
              onMouseEnter: (e) => {
                e.currentTarget.style.opacity = "1";
              },
              onMouseLeave: (e) => {
                if (!isFailed && !isUploading) {
                  e.currentTarget.style.opacity = "0.7";
                }
              },
              style: { opacity: isFailed || isUploading ? 1 : 0.7 },
              children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(X, { size: 14 })
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "void-px-2 void-py-1 void-bg-void-bg-2-alt void-border-t void-border-void-border-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "void-text-xs void-text-void-fg-1 void-truncate", title: attachment.filename, children: attachment.filename }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "void-text-xs void-text-void-fg-3", children: formatFileSize(attachment.size) })
        ] }),
        isFailed && attachment.error && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "void-px-2 void-py-1 void-bg-red-500/10 void-border-t void-border-red-500", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "void-text-xs void-text-red-500 void-truncate", title: attachment.error, children: attachment.error }),
          onRetry && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "button",
            {
              type: "button",
              onClick: (e) => {
                e.stopPropagation();
                onRetry();
              },
              className: "void-text-xs void-text-blue-500 hover:void-text-blue-400 void-mt-1",
              children: "Retry"
            }
          )
        ] }),
        isUploading && attachment.uploadProgress !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "void-absolute void-bottom-0 void-left-0 void-right-0 void-h-1 void-bg-void-bg-1", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "div",
          {
            className: "void-h-full void-bg-blue-500 void-transition-all void-duration-300",
            style: { width: `${attachment.uploadProgress * 100}%` }
          }
        ) })
      ]
    }
  );
};

// src2/util/ImageAttachmentList.tsx
var import_jsx_runtime11 = __toESM(require_jsx_runtime(), 1);
var ImageAttachmentList = ({
  attachments,
  onRemove,
  onRetry,
  onCancel,
  focusedIndex,
  onFocusChange
}) => {
  const handleKeyDown = (0, import_react16.useCallback)((e, index3) => {
    if (e.key === "ArrowLeft" && index3 > 0) {
      e.preventDefault();
      onFocusChange(index3 - 1);
    } else if (e.key === "ArrowRight" && index3 < attachments.length - 1) {
      e.preventDefault();
      onFocusChange(index3 + 1);
    }
  }, [attachments.length, onFocusChange]);
  if (attachments.length === 0) {
    return null;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "div",
    {
      className: "void-flex void-flex-wrap void-gap-2 void-p-2 void-max-h-[300px] void-overflow-y-auto",
      role: "list",
      "aria-label": `${attachments.length} image attachment${attachments.length !== 1 ? "s" : ""}`,
      children: attachments.map(
        (attachment, index3) => /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "div",
          {
            role: "listitem",
            onKeyDown: (e) => handleKeyDown(e, index3),
            children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              ImageAttachmentChip,
              {
                attachment,
                onRemove: () => onRemove(attachment.id),
                onRetry: onRetry ? () => onRetry(attachment.id) : void 0,
                onCancel: onCancel ? () => onCancel(attachment.id) : void 0,
                index: index3,
                focused: focusedIndex === index3,
                onFocus: () => onFocusChange(index3)
              }
            )
          },
          attachment.id
        )
      )
    }
  );
};

// src2/util/ImageMessageRenderer.tsx
var import_react18 = __toESM(require_react(), 1);

// src2/util/ImageLightbox.tsx
var import_react17 = __toESM(require_react(), 1);
var import_jsx_runtime12 = __toESM(require_jsx_runtime(), 1);
var ImageLightbox = ({
  images,
  initialIndex,
  previewUrls,
  onClose,
  onNavigate
}) => {
  const [currentIndex, setCurrentIndex] = (0, import_react17.useState)(initialIndex);
  const [scale, setScale] = (0, import_react17.useState)(1);
  const [position, setPosition] = (0, import_react17.useState)({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = (0, import_react17.useState)(false);
  const [dragStart, setDragStart] = (0, import_react17.useState)({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = (0, import_react17.useState)(null);
  const [lastTouchCenter, setLastTouchCenter] = (0, import_react17.useState)(null);
  const imageRef = (0, import_react17.useRef)(null);
  const containerRef = (0, import_react17.useRef)(null);
  const previousFocusRef = (0, import_react17.useRef)(null);
  const currentImage = images[currentIndex];
  const currentUrl = currentImage ? previewUrls.get(currentImage.id) : null;
  (0, import_react17.useEffect)(() => {
    setCurrentIndex(initialIndex);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [initialIndex]);
  (0, import_react17.useEffect)(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onNavigate("prev");
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNavigate("next");
        setCurrentIndex((prev) => Math.min(images.length - 1, prev + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [images.length, onClose, onNavigate]);
  (0, import_react17.useEffect)(() => {
    if (containerRef.current) {
      previousFocusRef.current = document.activeElement;
      containerRef.current.focus();
    }
    return () => {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, []);
  const handleWheel = (0, import_react17.useCallback)((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev) => Math.max(0.5, Math.min(5, prev * delta)));
    }
  }, []);
  const handleMouseDown = (0, import_react17.useCallback)((e) => {
    if (e.button === 0 && scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [scale, position]);
  const handleMouseMove = (0, import_react17.useCallback)((e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart]);
  const handleMouseUp = (0, import_react17.useCallback)(() => {
    setIsDragging(false);
  }, []);
  const handleDoubleClick = (0, import_react17.useCallback)(() => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  }, [scale]);
  const handlePrev = (0, import_react17.useCallback)(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [currentIndex]);
  const handleNext = (0, import_react17.useCallback)(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [currentIndex, images.length]);
  const handleTouchStart = (0, import_react17.useCallback)((e) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setLastTouchDistance(distance);
      setLastTouchCenter({
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      });
    } else if (e.touches.length === 1 && scale > 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  }, [scale, position]);
  const handleTouchMove = (0, import_react17.useCallback)((e) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastTouchDistance !== null && lastTouchCenter) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const scaleFactor = distance / lastTouchDistance;
      setScale((prev) => Math.max(0.5, Math.min(5, prev * scaleFactor)));
      setLastTouchDistance(distance);
      const newCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
      const centerDelta = {
        x: newCenter.x - lastTouchCenter.x,
        y: newCenter.y - lastTouchCenter.y
      };
      setPosition((prev) => ({
        x: prev.x + centerDelta.x,
        y: prev.y + centerDelta.y
      }));
      setLastTouchCenter(newCenter);
    } else if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  }, [lastTouchDistance, lastTouchCenter, isDragging, dragStart]);
  const handleTouchEnd = (0, import_react17.useCallback)(() => {
    setLastTouchDistance(null);
    setLastTouchCenter(null);
    setIsDragging(false);
  }, []);
  if (!currentImage || !currentUrl) {
    return null;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
    "div",
    {
      ref: containerRef,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": `Image ${currentIndex + 1} of ${images.length}: ${currentImage.filename}`,
      tabIndex: -1,
      className: "void-fixed void-inset-0 void-z-[9999] void-bg-black/90 void-flex void-items-center void-justify-center",
      onClick: (e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      },
      onKeyDown: (e) => {
        if (e.key === "Escape") {
          onClose();
        }
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "button",
          {
            type: "button",
            onClick: onClose,
            className: "void-absolute void-top-4 void-right-4 void-z-10 void-p-2 void-rounded-full void-bg-black/60 hover:void-bg-black/80 void-text-white void-transition-colors",
            "aria-label": "Close lightbox",
            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(X, { size: 24 })
          }
        ),
        currentIndex > 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "button",
          {
            type: "button",
            onClick: handlePrev,
            className: "void-absolute void-left-4 void-top-1/2 -void-translate-y-1/2 void-z-10 void-p-2 void-rounded-full void-bg-black/60 hover:void-bg-black/80 void-text-white void-transition-colors",
            "aria-label": "Previous image",
            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ChevronLeft, { size: 24 })
          }
        ),
        currentIndex < images.length - 1 && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "button",
          {
            type: "button",
            onClick: handleNext,
            className: "void-absolute void-right-4 void-top-1/2 -void-translate-y-1/2 void-z-10 void-p-2 void-rounded-full void-bg-black/60 hover:void-bg-black/80 void-text-white void-transition-colors",
            "aria-label": "Next image",
            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ChevronRight, { size: 24 })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
          "div",
          {
            className: "void-relative void-w-full void-h-full void-flex void-items-center void-justify-center void-overflow-hidden void-touch-none",
            onWheel: handleWheel,
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseUp,
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
            children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
              "img",
              {
                ref: imageRef,
                src: currentUrl,
                alt: currentImage.filename || `Image ${currentIndex + 1}`,
                onDoubleClick: handleDoubleClick,
                className: "void-max-w-full void-max-h-full void-object-contain void-transition-transform void-duration-200",
                style: {
                  transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
                  cursor: scale > 1 ? isDragging ? "grabbing" : "grab" : "zoom-in"
                },
                draggable: false
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "void-absolute void-bottom-4 void-left-1/2 -void-translate-x-1/2 void-bg-black/60 void-text-white void-px-4 void-py-2 void-rounded-md void-text-sm", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "void-font-medium", children: currentImage.filename }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: "void-text-xs void-opacity-75", children: [
            currentImage.width,
            " \xD7 ",
            currentImage.height,
            " \u2022 ",
            formatFileSize(currentImage.size),
            images.length > 1 && ` \u2022 ${currentIndex + 1} of ${images.length}`
          ] })
        ] }),
        images.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "void-absolute void-bottom-16 void-left-1/2 -void-translate-x-1/2 void-flex void-gap-2", children: images.map(
          (_, index3) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
            "button",
            {
              type: "button",
              onClick: () => {
                setCurrentIndex(index3);
                setScale(1);
                setPosition({ x: 0, y: 0 });
              },
              className: ` void-w-2 void-h-2 void-rounded-full void-transition-all ${index3 === currentIndex ? "void-bg-white" : "void-bg-white/40"} hover:void-bg-white/60 `,
              "aria-label": `Go to image ${index3 + 1}`
            },
            index3
          )
        ) })
      ]
    }
  );
};

// src2/util/ImageMessageRenderer.tsx
var import_jsx_runtime13 = __toESM(require_jsx_runtime(), 1);
var ImageMessageRenderer = ({
  images,
  caption
}) => {
  const [previewUrls, setPreviewUrls] = (0, import_react18.useState)(/* @__PURE__ */ new Map());
  const [lightboxImageIndex, setLightboxImageIndex] = (0, import_react18.useState)(null);
  (0, import_react18.useEffect)(() => {
    const urls = /* @__PURE__ */ new Map();
    images.forEach((img) => {
      const url = createImageDataUrl(img.data, img.mimeType);
      urls.set(img.id, url);
    });
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => revokeImageDataUrl(url));
    };
  }, [images]);
  const handleImageClick = (0, import_react18.useCallback)((index3) => {
    setLightboxImageIndex(index3);
  }, []);
  const handleCloseLightbox = (0, import_react18.useCallback)(() => {
    setLightboxImageIndex(null);
  }, []);
  const handleNavigate = (0, import_react18.useCallback)((direction) => {
    if (lightboxImageIndex === null) return;
    if (direction === "prev") {
      setLightboxImageIndex(Math.max(0, lightboxImageIndex - 1));
    } else {
      setLightboxImageIndex(Math.min(images.length - 1, lightboxImageIndex + 1));
    }
  }, [lightboxImageIndex, images.length]);
  if (images.length === 0) {
    return null;
  }
  const gridCols = images.length === 1 ? 1 : images.length <= 4 ? 2 : 3;
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "void-flex void-flex-col void-gap-2", children: [
      caption && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "void-text-void-fg-1 void-whitespace-pre-wrap void-break-words", children: caption }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
        "div",
        {
          className: ` void-grid void-gap-2 ${gridCols === 1 ? "void-grid-cols-1" : ""} ${gridCols === 2 ? "void-grid-cols-2" : ""} ${gridCols === 3 ? "void-grid-cols-3" : ""} `,
          role: "group",
          "aria-label": `${images.length} image${images.length !== 1 ? "s" : ""}`,
          children: images.map((img, index3) => {
            const previewUrl = previewUrls.get(img.id);
            if (!previewUrl) {
              return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
                "div",
                {
                  className: "void-aspect-square void-bg-void-bg-2-alt void-rounded-md void-flex void-items-center void-justify-center",
                  children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "void-text-void-fg-3 void-text-sm", children: "Loading..." })
                },
                img.id
              );
            }
            return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(
              "div",
              {
                className: "void-relative void-group void-cursor-pointer",
                role: "button",
                tabIndex: 0,
                onClick: () => handleImageClick(index3),
                onKeyDown: (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleImageClick(index3);
                  }
                },
                "aria-label": `Image: ${img.filename}. Click to zoom.`,
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
                    "img",
                    {
                      src: previewUrl,
                      alt: img.filename ? `${img.filename} (${img.width}\xD7${img.height})` : `Image ${index3 + 1}`,
                      className: ` void-w-full void-rounded-md void-object-cover void-transition-transform void-duration-200 group-hover:void-scale-[1.02] ${gridCols === 1 ? "void-max-h-[320px] md:void-max-h-[400px]" : "void-aspect-square void-max-h-[240px] md:void-max-h-[300px]"} `,
                      loading: "lazy"
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "void-absolute void-bottom-0 void-left-0 void-right-0 void-bg-black/60 void-text-white void-text-xs void-px-2 void-py-1 void-rounded-b-md void-opacity-0 group-hover:void-opacity-100 void-transition-opacity", children: [
                    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "void-truncate", children: img.filename }),
                    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "void-text-xs void-opacity-75", children: formatFileSize(img.size) })
                  ] })
                ]
              },
              img.id
            );
          })
        }
      )
    ] }),
    lightboxImageIndex !== null && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      ImageLightbox,
      {
        images,
        initialIndex: lightboxImageIndex,
        previewUrls,
        onClose: handleCloseLightbox,
        onNavigate: handleNavigate
      }
    )
  ] });
};

// src2/util/PDFMessageRenderer.tsx
var import_jsx_runtime14 = __toESM(require_jsx_runtime(), 1);
var formatFileSize3 = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
var PDFMessageRenderer = ({
  pdfs,
  caption
}) => {
  if (pdfs.length === 0) {
    return null;
  }
  const gridCols = pdfs.length === 1 ? 1 : pdfs.length <= 4 ? 2 : 3;
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "void-flex void-flex-col void-gap-2", children: [
    caption && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "void-text-void-fg-1 void-whitespace-pre-wrap void-break-words", children: caption }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      "div",
      {
        className: ` void-grid void-gap-2 ${gridCols === 1 ? "void-grid-cols-1" : ""} ${gridCols === 2 ? "void-grid-cols-2" : ""} ${gridCols === 3 ? "void-grid-cols-3" : ""} `,
        role: "group",
        "aria-label": `${pdfs.length} PDF${pdfs.length !== 1 ? "s" : ""}`,
        children: pdfs.map((pdf, index3) => {
          const hasPreview = pdf.pagePreviews && pdf.pagePreviews.length > 0;
          return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
            "div",
            {
              className: "void-relative void-group",
              role: "button",
              tabIndex: 0,
              "aria-label": `PDF: ${pdf.filename}`,
              children: /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
                "div",
                {
                  className: ` void-relative void-bg-void-bg-2-alt void-border void-border-void-border-3 void-rounded-md void-overflow-hidden void-transition-all void-duration-200 group-hover:void-border-void-border-1 ${gridCols === 1 ? "void-max-h-[320px] md:void-max-h-[400px]" : "void-aspect-[3/4] void-max-h-[240px] md:void-max-h-[300px]"} `,
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "void-w-full void-h-full void-flex void-items-center void-justify-center void-bg-void-bg-1", children: hasPreview ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
                      "img",
                      {
                        src: pdf.pagePreviews[0],
                        alt: `Page 1 of ${pdf.filename}`,
                        className: "void-w-full void-h-full void-object-contain",
                        loading: "lazy"
                      }
                    ) : /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(FileText, { className: "void-w-12 void-h-12 void-text-void-fg-3" }) }),
                    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "void-absolute void-bottom-0 void-left-0 void-right-0 void-bg-black/60 void-text-white void-text-xs void-px-2 void-py-1.5 void-rounded-b-md void-opacity-0 group-hover:void-opacity-100 void-transition-opacity", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "void-truncate void-font-medium", children: pdf.filename }),
                      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "void-flex void-items-center void-justify-between void-mt-0.5", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: "void-text-[10px] void-opacity-75", children: pdf.pageCount ? `${pdf.pageCount} page${pdf.pageCount !== 1 ? "s" : ""}` : formatFileSize3(pdf.size) }),
                        hasPreview && pdf.pagePreviews.length > 1 && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "void-text-[10px] void-opacity-75", children: [
                          "+",
                          pdf.pagePreviews.length - 1,
                          " more"
                        ] })
                      ] })
                    ] })
                  ]
                }
              )
            },
            pdf.id
          );
        })
      }
    )
  ] });
};

// src2/sidebar-tsx/SidebarChat.tsx
var import_jsx_runtime15 = __toESM(require_jsx_runtime(), 1);
var IconX = ({ size: size3, className = "", ...props }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: size3,
      height: size3,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      className,
      ...props,
      children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        "path",
        {
          strokeLinecap: "round",
          strokeLinejoin: "round",
          d: "M6 18 18 6M6 6l12 12"
        }
      )
    }
  );
};
var IconArrowUp = ({ size: size3, className = "" }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    "svg",
    {
      width: size3,
      height: size3,
      className,
      viewBox: "0 0 20 20",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        "path",
        {
          fill: "black",
          fillRule: "evenodd",
          clipRule: "evenodd",
          d: "M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
        }
      )
    }
  );
};
var IconSquare = ({ size: size3, className = "" }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    "svg",
    {
      className,
      stroke: "black",
      fill: "black",
      strokeWidth: "0",
      viewBox: "0 0 24 24",
      width: size3,
      height: size3,
      xmlns: "http://www.w3.org/2000/svg",
      children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("rect", { x: "2", y: "2", width: "20", height: "20", rx: "4", ry: "4" })
    }
  );
};
var IconWarning = ({ size: size3, className = "" }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    "svg",
    {
      className,
      stroke: "currentColor",
      fill: "currentColor",
      strokeWidth: "0",
      viewBox: "0 0 16 16",
      width: size3,
      height: size3,
      xmlns: "http://www.w3.org/2000/svg",
      children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        "path",
        {
          fillRule: "evenodd",
          clipRule: "evenodd",
          d: "M7.56 1h.88l6.54 12.26-.44.74H1.44L1 13.26 7.56 1zM8 2.28L2.28 13H13.7L8 2.28zM8.625 12v-1h-1.25v1h1.25zm-1.25-2V6h1.25v4h-1.25z"
        }
      )
    }
  );
};
var IconLoading = ({ className = "", showTokenCount }) => {
  const [dots, setDots] = (0, import_react19.useState)(1);
  (0, import_react19.useEffect)(() => {
    let frameId;
    let lastUpdate = Date.now();
    const animate = () => {
      const now = Date.now();
      if (now - lastUpdate >= 400) {
        setDots((prev) => prev >= 3 ? 1 : prev + 1);
        lastUpdate = now;
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);
  const dotsText = ".".repeat(dots);
  const tokenText = showTokenCount !== void 0 ? ` (${showTokenCount} tokens)` : "";
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: `${className}`, children: [
    dotsText,
    tokenText
  ] });
};
var ReasoningOptionSlider = ({ featureName }) => {
  const accessor = useAccessor();
  const cortexideSettingsService = accessor.get("ICortexideSettingsService");
  const voidSettingsState = useSettingsState();
  const modelSelection = voidSettingsState.modelSelectionOfFeature[featureName];
  const overridesOfModel = voidSettingsState.overridesOfModel;
  if (!modelSelection) return null;
  if (!isValidProviderModelSelection(modelSelection)) {
    return null;
  }
  const { modelName, providerName } = modelSelection;
  const { reasoningCapabilities } = getModelCapabilities(providerName, modelName, overridesOfModel);
  const { canTurnOffReasoning, reasoningSlider: reasoningBudgetSlider } = reasoningCapabilities || {};
  const modelSelectionOptions = voidSettingsState.optionsOfModelSelection[featureName][providerName]?.[modelName];
  const isReasoningEnabled = getIsReasoningEnabledState(featureName, providerName, modelName, modelSelectionOptions, overridesOfModel);
  if (canTurnOffReasoning && !reasoningBudgetSlider) {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none void-inline-block void-w-10 void-pr-1", children: "Thinking" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        VoidSwitch,
        {
          size: "xxs",
          value: isReasoningEnabled,
          onChange: (newVal) => {
            const isOff = canTurnOffReasoning && !newVal;
            cortexideSettingsService.setOptionsOfModelSelection(featureName, modelSelection.providerName, modelSelection.modelName, { reasoningEnabled: !isOff });
          }
        }
      )
    ] });
  }
  if (reasoningBudgetSlider?.type === "budget_slider") {
    const { min: min_, max, default: defaultVal } = reasoningBudgetSlider;
    const nSteps = 8;
    const stepSize = Math.round((max - min_) / nSteps);
    const valueIfOff = min_ - stepSize;
    const min = canTurnOffReasoning ? valueIfOff : min_;
    const value = isReasoningEnabled ? voidSettingsState.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]?.reasoningBudget ?? defaultVal : valueIfOff;
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none void-inline-block void-w-10 void-pr-1", children: "Thinking" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        VoidSlider,
        {
          width: 50,
          size: "xs",
          min,
          max,
          step: stepSize,
          value,
          onChange: (newVal) => {
            if (modelSelection.providerName === "auto" && modelSelection.modelName === "auto") return;
            const isOff = canTurnOffReasoning && newVal === valueIfOff;
            cortexideSettingsService.setOptionsOfModelSelection(featureName, modelSelection.providerName, modelSelection.modelName, { reasoningEnabled: !isOff, reasoningBudget: newVal });
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none", children: isReasoningEnabled ? `${value} tokens` : "Thinking disabled" })
    ] });
  }
  if (reasoningBudgetSlider?.type === "effort_slider") {
    const { values, default: defaultVal } = reasoningBudgetSlider;
    const min = canTurnOffReasoning ? -1 : 0;
    const max = values.length - 1;
    const currentEffort = voidSettingsState.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName]?.reasoningEffort ?? defaultVal;
    const valueIfOff = -1;
    const value = isReasoningEnabled && currentEffort ? values.indexOf(currentEffort) : valueIfOff;
    const currentEffortCapitalized = currentEffort.charAt(0).toUpperCase() + currentEffort.slice(1, Infinity);
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none void-inline-block void-w-10 void-pr-1", children: "Thinking" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        VoidSlider,
        {
          width: 30,
          size: "xs",
          min,
          max,
          step: 1,
          value,
          onChange: (newVal) => {
            if (modelSelection.providerName === "auto" && modelSelection.modelName === "auto") return;
            const isOff = canTurnOffReasoning && newVal === valueIfOff;
            cortexideSettingsService.setOptionsOfModelSelection(featureName, modelSelection.providerName, modelSelection.modelName, { reasoningEnabled: !isOff, reasoningEffort: values[newVal] ?? void 0 });
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none", children: isReasoningEnabled ? `${currentEffortCapitalized}` : "Thinking disabled" })
    ] });
  }
  return null;
};
var nameOfChatMode = {
  "normal": "Chat",
  "gather": "Gather",
  "agent": "Agent"
};
var detailOfChatMode = {
  "normal": "Normal chat",
  "gather": "Reads files, but can't edit",
  "agent": "Edits files and uses tools"
};
var ChatModeDropdown = ({ className }) => {
  const accessor = useAccessor();
  const cortexideSettingsService = accessor.get("ICortexideSettingsService");
  const settingsState = useSettingsState();
  const options2 = (0, import_react19.useMemo)(() => ["normal", "gather", "agent"], []);
  const onChangeOption = (0, import_react19.useCallback)((newVal) => {
    cortexideSettingsService.setGlobalSetting("chatMode", newVal);
  }, [cortexideSettingsService]);
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    VoidCustomDropdownBox,
    {
      className,
      options: options2,
      selectedOption: settingsState.globalSettings.chatMode,
      onChangeOption,
      getOptionDisplayName: (val) => nameOfChatMode[val],
      getOptionDropdownName: (val) => nameOfChatMode[val],
      getOptionDropdownDetail: (val) => detailOfChatMode[val],
      getOptionsEqual: (a, b) => a === b
    }
  );
};
var VoidChatArea = ({
  children,
  onSubmit,
  onAbort,
  onClose,
  onClickAnywhere,
  divRef,
  isStreaming = false,
  isDisabled = false,
  className = "",
  showModelDropdown = true,
  showSelections = false,
  showProspectiveSelections = false,
  selections,
  setSelections,
  imageAttachments,
  onImagePaste,
  onImageDrop,
  onImageUpload,
  onPDFDrop,
  pdfAttachments,
  featureName,
  loadingIcon
}) => {
  const [isDragOver, setIsDragOver] = import_react19.default.useState(false);
  const imageInputRef = import_react19.default.useRef(null);
  const pdfInputRef = import_react19.default.useRef(null);
  const containerRef = import_react19.default.useRef(null);
  import_react19.default.useEffect(() => {
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageFiles = [];
      const pdfFiles = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        } else if (item.type === "application/pdf") {
          const file = item.getAsFile();
          if (file) {
            pdfFiles.push(file);
          }
        }
      }
      if (imageFiles.length > 0 && onImagePaste) {
        e.preventDefault();
        onImagePaste(imageFiles);
      }
      if (pdfFiles.length > 0 && onPDFDrop) {
        e.preventDefault();
        onPDFDrop(pdfFiles);
      }
    };
    const container = containerRef.current || divRef?.current;
    if (container) {
      container.addEventListener("paste", handlePaste);
      return () => {
        container.removeEventListener("paste", handlePaste);
      };
    }
  }, [divRef, onImagePaste]);
  const lastDragOverTimeRef = import_react19.default.useRef(0);
  const DRAG_THROTTLE_MS = 50;
  const handleDragOver = import_react19.default.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastDragOverTimeRef.current < DRAG_THROTTLE_MS) {
      return;
    }
    lastDragOverTimeRef.current = now;
    const hasFiles = Array.from(e.dataTransfer.items).some(
      (item) => item.type.startsWith("image/") || item.type === "application/pdf"
    );
    if (hasFiles) {
      setIsDragOver(true);
    }
  }, []);
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const imageFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type.startsWith("image/")
    );
    const pdfFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === "application/pdf"
    );
    if (imageFiles.length > 0 && onImageDrop) {
      onImageDrop(imageFiles);
    }
    if (pdfFiles.length > 0 && onPDFDrop) {
      onPDFDrop(pdfFiles);
    }
  };
  const handleImageUploadClick = () => {
    imageInputRef.current?.click();
  };
  const handlePDFUploadClick = () => {
    pdfInputRef.current?.click();
  };
  const handleImageInputChange = (e) => {
    const files = Array.from(e.target.files || []).filter(
      (file) => file.type.startsWith("image/")
    );
    if (files.length > 0 && onImageDrop) {
      onImageDrop(files);
    }
    e.target.value = "";
  };
  const handlePDFInputChange = (e) => {
    const files = Array.from(e.target.files || []).filter(
      (file) => file.type === "application/pdf"
    );
    if (files.length > 0 && onPDFDrop) {
      onPDFDrop(files);
    }
    e.target.value = "";
  };
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
    "div",
    {
      ref: (node) => {
        if (divRef) {
          if (typeof divRef === "function") {
            divRef(node);
          } else {
            divRef.current = node;
          }
        }
        containerRef.current = node;
      },
      className: ` void-gap-x-1 void-flex void-flex-col void-p-2.5 void-relative void-input void-text-left void-shrink-0 void-rounded-2xl void-bg-[#030304] void-transition-all void-duration-200 void-border void-border-[rgba(255,255,255,0.08)] focus-within:void-border-[rgba(255,255,255,0.12)] hover:void-border-[rgba(255,255,255,0.12)] ${isDragOver ? "void-border-blue-500 void-bg-blue-500/10" : ""} void-max-h-[80vh] void-overflow-y-auto ${className} `,
      onClick: (e) => {
        onClickAnywhere?.();
      },
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "input",
          {
            ref: imageInputRef,
            type: "file",
            accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml",
            multiple: true,
            className: "void-hidden",
            onChange: handleImageInputChange
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "input",
          {
            ref: pdfInputRef,
            type: "file",
            accept: "application/pdf",
            multiple: true,
            className: "void-hidden",
            onChange: handlePDFInputChange
          }
        ),
        imageAttachments,
        pdfAttachments,
        showSelections && selections && setSelections && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          SelectedFiles,
          {
            type: "staging",
            selections,
            setSelections,
            showProspectiveSelections
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-relative void-w-full void-flex void-items-end void-gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-flex-1 void-min-w-0", children }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-1 void-flex-shrink-0 void-pb-0.5", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
              "button",
              {
                type: "button",
                onClick: handleImageUploadClick,
                className: "void-flex-shrink-0 void-p-1.5 void-rounded hover:void-bg-void-bg-2-alt void-text-void-fg-4 hover:void-text-void-fg-2 void-transition-colors disabled:void-opacity-40 disabled:void-cursor-not-allowed",
                "aria-label": "Upload images",
                title: "Upload images (or paste/drag & drop)",
                children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Image$1, { size: 16 })
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
              "button",
              {
                type: "button",
                onClick: handlePDFUploadClick,
                className: "void-flex-shrink-0 void-p-1.5 void-rounded hover:void-bg-void-bg-2-alt void-text-void-fg-4 hover:void-text-void-fg-2 void-transition-colors disabled:void-opacity-40 disabled:void-cursor-not-allowed",
                "aria-label": "Upload PDFs",
                title: "Upload PDFs (or paste/drag & drop)",
                children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(FileText, { size: 16 })
              }
            ),
            isStreaming ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ButtonStop, { onClick: onAbort }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
              ButtonSubmit,
              {
                onClick: onSubmit,
                disabled: isDisabled
              }
            )
          ] }),
          onClose && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-absolute -void-top-1 -void-right-1 void-cursor-pointer void-z-1", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            IconX,
            {
              size: 12,
              className: "void-stroke-[2] void-opacity-80 void-text-void-fg-3 hover:void-brightness-95",
              onClick: onClose
            }
          ) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-flex-row void-justify-between void-items-center void-gap-2 void-mt-1 void-pt-1 void-border-t void-border-void-border-3/50", children: [
          showModelDropdown && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-flex-wrap void-gap-x-2 void-gap-y-1 void-text-nowrap void-flex-1 void-min-w-0", children: [
            featureName === "Chat" && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ChatModeDropdown, { className: "void-text-xs void-text-void-fg-3 void-bg-void-bg-1 void-border void-border-void-border-2 void-rounded void-py-0.5 void-px-1.5" }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ModelDropdown, { featureName, className: "void-text-xs void-text-void-fg-3 void-bg-void-bg-1 void-rounded" }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ReasoningOptionSlider, { featureName })
          ] }),
          isStreaming && loadingIcon && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-flex void-items-center", children: loadingIcon })
        ] })
      ]
    }
  );
};
var DEFAULT_BUTTON_SIZE = 22;
var ButtonSubmit = ({ className, disabled, ...props }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    "button",
    {
      type: "button",
      className: `void-rounded-full void-flex-shrink-0 void-flex-grow-0 void-flex void-items-center void-justify-center ${disabled ? "void-bg-vscode-disabled-fg void-cursor-default" : "void-bg-white void-cursor-pointer"} ${className} `,
      ...props,
      children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconArrowUp, { size: DEFAULT_BUTTON_SIZE, className: "void-stroke-[2] void-p-[2px]" })
    }
  );
};
var ButtonStop = ({ className, ...props }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    "button",
    {
      className: `void-rounded-full void-flex-shrink-0 void-flex-grow-0 void-cursor-pointer void-flex void-items-center void-justify-center void-bg-white ${className} `,
      type: "button",
      ...props,
      children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconSquare, { size: DEFAULT_BUTTON_SIZE, className: "void-stroke-[3] void-p-[7px]" })
    }
  );
};
var scrollToBottom = (divRef) => {
  if (divRef.current) {
    divRef.current.scrollTop = divRef.current.scrollHeight;
  }
};
var ScrollToBottomContainer = ({ children, className, style, scrollContainerRef }) => {
  const [isAtBottom, setIsAtBottom] = (0, import_react19.useState)(true);
  const divRef = scrollContainerRef;
  const onScroll = () => {
    const div = divRef.current;
    if (!div) return;
    const isBottom = Math.abs(
      div.scrollHeight - div.clientHeight - div.scrollTop
    ) < 4;
    setIsAtBottom(isBottom);
  };
  (0, import_react19.useEffect)(() => {
    if (isAtBottom) {
      scrollToBottom(divRef);
    }
  }, [children, isAtBottom]);
  (0, import_react19.useEffect)(() => {
    scrollToBottom(divRef);
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    "div",
    {
      ref: divRef,
      onScroll,
      className,
      style,
      children
    }
  );
};
var getRelative = (uri, accessor) => {
  const workspaceContextService = accessor.get("IWorkspaceContextService");
  let path;
  const isInside = workspaceContextService.isInsideWorkspace(uri);
  if (isInside) {
    const f = workspaceContextService.getWorkspace().folders.find((f2) => uri.fsPath?.startsWith(f2.uri.fsPath));
    if (f) {
      path = uri.fsPath.replace(f.uri.fsPath, "");
    } else {
      path = uri.fsPath;
    }
  } else {
    path = uri.fsPath;
  }
  return path || void 0;
};
var getFolderName = (pathStr) => {
  pathStr = pathStr.replace(/[/\\]+/g, "/");
  const parts = pathStr.split("/");
  const nonEmptyParts = parts.filter((part) => part.length > 0);
  if (nonEmptyParts.length === 0) return "/";
  if (nonEmptyParts.length === 1) return nonEmptyParts[0] + "/";
  const lastTwo = nonEmptyParts.slice(-2);
  return lastTwo.join("/") + "/";
};
var getBasename = (pathStr, parts = 1) => {
  pathStr = pathStr.replace(/[/\\]+/g, "/");
  const allParts = pathStr.split("/");
  if (allParts.length === 0) return pathStr;
  return allParts.slice(-parts).join("/");
};
var voidOpenFileFn = (uri, accessor, range) => {
  const commandService = accessor.get("ICommandService");
  const editorService = accessor.get("ICodeEditorService");
  let editorSelection = void 0;
  if (range) {
    editorSelection = {
      startLineNumber: range[0],
      startColumn: 1,
      endLineNumber: range[1],
      endColumn: Number.MAX_SAFE_INTEGER
    };
  }
  commandService.executeCommand("vscode.open", uri).then(() => {
    setTimeout(() => {
      if (!editorSelection) return;
      const editor = editorService.getActiveCodeEditor();
      if (!editor) return;
      editor.setSelection(editorSelection);
      editor.revealRange(editorSelection, ScrollType.Immediate);
    }, 50);
  });
};
var SelectedFiles = ({
  type,
  selections,
  setSelections,
  showProspectiveSelections,
  messageIdx
}) => {
  const accessor = useAccessor();
  accessor.get("ICommandService");
  const modelReferenceService = accessor.get("ICortexideModelService");
  const { uri: currentURI } = useActiveURI();
  const [recentUris, setRecentUris] = (0, import_react19.useState)([]);
  const maxRecentUris = 10;
  const maxProspectiveFiles = 3;
  (0, import_react19.useEffect)(() => {
    if (!currentURI) return;
    setRecentUris((prev) => {
      const withoutCurrent = prev.filter((uri) => uri.fsPath !== currentURI.fsPath);
      const withCurrent = [currentURI, ...withoutCurrent];
      return withCurrent.slice(0, maxRecentUris);
    });
  }, [currentURI]);
  const [prospectiveSelections, setProspectiveSelections] = (0, import_react19.useState)([]);
  (0, import_react19.useEffect)(() => {
    const computeRecents = async () => {
      const prospectiveURIs = recentUris.filter((uri) => !selections.find((s) => s.type === "File" && s.uri.fsPath === uri.fsPath)).slice(0, maxProspectiveFiles);
      const answer = [];
      for (const uri of prospectiveURIs) {
        answer.push({
          type: "File",
          uri,
          language: (await modelReferenceService.getModelSafe(uri)).model?.getLanguageId() || "plaintext",
          state: { wasAddedAsCurrentFile: false }
        });
      }
      return answer;
    };
    if (type === "staging" && showProspectiveSelections) {
      computeRecents().then((a) => setProspectiveSelections(a));
    } else {
      setProspectiveSelections([]);
    }
  }, [recentUris, selections, type, showProspectiveSelections]);
  const allSelections = [...selections, ...prospectiveSelections];
  if (allSelections.length === 0) {
    return null;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-flex void-items-center void-flex-wrap void-text-left void-relative void-gap-x-0.5 void-gap-y-1 void-pb-0.5", children: allSelections.map((selection, i) => {
    const isThisSelectionProspective = i > selections.length - 1;
    const thisKey = selection.type === "CodeSelection" ? selection.type + selection.language + selection.range + selection.state.wasAddedAsCurrentFile + selection.uri.fsPath : selection.type === "File" ? selection.type + selection.language + selection.state.wasAddedAsCurrentFile + selection.uri.fsPath : selection.type === "Folder" ? selection.type + selection.language + selection.state + selection.uri.fsPath : i;
    const SelectionIcon = selection.type === "File" ? File : selection.type === "Folder" ? Folder : selection.type === "CodeSelection" ? Text : void 0;
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "div",
      {
        className: `void-flex void-flex-col void-space-y-[1px]`,
        children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "span",
          {
            className: "void-truncate void-overflow-hidden void-text-ellipsis",
            "data-tooltip-id": "void-tooltip",
            "data-tooltip-content": getRelative(selection.uri, accessor),
            "data-tooltip-place": "top",
            "data-tooltip-delay-show": 3e3,
            children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
              "div",
              {
                className: ` void-flex void-items-center void-gap-1 void-relative void-px-1 void-w-fit void-h-fit void-select-none void-text-xs void-text-nowrap void-border void-rounded-sm ${isThisSelectionProspective ? "void-bg-void-bg-1 void-text-void-fg-3 void-opacity-80" : "void-bg-void-bg-1 hover:void-brightness-95 void-text-void-fg-1"} ${isThisSelectionProspective ? "void-border-void-border-2" : "void-border-void-border-1"} hover:void-border-void-border-1 void-transition-all void-duration-150 `,
                onClick: () => {
                  if (type !== "staging") return;
                  if (isThisSelectionProspective) {
                    setSelections([...selections, selection]);
                  } else if (selection.type === "File") {
                    voidOpenFileFn(selection.uri, accessor);
                    const wasAddedAsCurrentFile = selection.state.wasAddedAsCurrentFile;
                    if (wasAddedAsCurrentFile) {
                      const newSelection = { ...selection, state: { ...selection.state, wasAddedAsCurrentFile: false } };
                      setSelections(
                        [
                          ...selections.slice(0, i),
                          newSelection,
                          ...selections.slice(i + 1)
                        ]
                      );
                    }
                  } else if (selection.type === "CodeSelection") {
                    voidOpenFileFn(selection.uri, accessor, selection.range);
                  } else if (selection.type === "Folder") ;
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(SelectionIcon, { size: 10 }),
                  // file name and range
                  getBasename(selection.uri.fsPath) + (selection.type === "CodeSelection" ? ` (${selection.range[0]}-${selection.range[1]})` : ""),
                  selection.type === "File" && selection.state.wasAddedAsCurrentFile && messageIdx === void 0 && currentURI?.fsPath === selection.uri.fsPath ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: `void-text-[8px] void-'void-opacity-60 void-text-void-fg-4`, children: `(Current File)` }) : null,
                  type === "staging" && !isThisSelectionProspective ? (
                    // X button
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                      "div",
                      {
                        className: "void-cursor-pointer void-z-1 void-self-stretch void-flex void-items-center void-justify-center",
                        onClick: (e) => {
                          e.stopPropagation();
                          if (type !== "staging") return;
                          setSelections([...selections.slice(0, i), ...selections.slice(i + 1)]);
                        },
                        children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                          IconX,
                          {
                            className: "void-stroke-[2]",
                            size: 10
                          }
                        )
                      }
                    )
                  ) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_jsx_runtime15.Fragment, {})
                ]
              }
            )
          }
        )
      },
      thisKey
    );
  }) });
};
var ToolHeaderWrapper = ({
  icon,
  title,
  desc1,
  desc1OnClick,
  desc1Info,
  desc2,
  numResults,
  hasNextPage,
  children,
  info,
  bottomChildren,
  isError,
  onClick,
  desc2OnClick,
  isOpen,
  isRejected,
  className
  // applies to the main content
}) => {
  const [isOpen_, setIsOpen] = (0, import_react19.useState)(false);
  const isExpanded = isOpen !== void 0 ? isOpen : isOpen_;
  const isDropdown = children !== void 0;
  const isClickable = !!(isDropdown || onClick);
  const isDesc1Clickable = !!desc1OnClick;
  const desc1HTML = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    "span",
    {
      className: `void-text-void-fg-4 void-text-xs void-italic void-truncate void-ml-2 ${isDesc1Clickable ? "void-cursor-pointer hover:void-brightness-125 void-transition-all void-duration-150" : ""} `,
      onClick: desc1OnClick,
      ...desc1Info ? {
        "data-tooltip-id": "void-tooltip",
        "data-tooltip-content": desc1Info,
        "data-tooltip-place": "top",
        "data-tooltip-delay-show": 1e3
      } : {},
      children: desc1
    }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "", children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: `void-w-full void-border void-border-void-border-3 void-rounded void-px-2 void-py-1 void-bg-void-bg-3 void-overflow-hidden ${className}`, children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `void-select-none void-flex void-items-center void-min-h-[24px]`, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: `void-flex void-items-center void-w-full void-gap-x-2 void-overflow-hidden void-justify-between ${isRejected ? "void-line-through" : ""}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
          "div",
          {
            className: "void-ml-1 void-flex void-items-center void-overflow-hidden",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                "div",
                {
                  className: ` void-flex void-items-center void-min-w-0 void-overflow-hidden void-grow ${isClickable ? "void-cursor-pointer hover:void-brightness-125 void-transition-all void-duration-150" : ""} `,
                  onClick: () => {
                    if (isDropdown) {
                      setIsOpen((v) => !v);
                    }
                    if (onClick) {
                      onClick();
                    }
                  },
                  children: [
                    isDropdown && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                      ChevronRight,
                      {
                        className: ` void-text-void-fg-3 void-mr-0.5 void-h-4 void-w-4 void-flex-shrink-0 void-transition-transform void-duration-100 void-ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? "void-rotate-90" : ""} `
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-3 void-flex-shrink-0", children: title }),
                    !isDesc1Clickable && desc1HTML
                  ]
                }
              ),
              isDesc1Clickable && desc1HTML
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2 void-flex-shrink-0", children: [
          info && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            CircleEllipsis,
            {
              className: "void-ml-2 void-text-void-fg-4 void-opacity-60 void-flex-shrink-0",
              size: 14,
              "data-tooltip-id": "void-tooltip",
              "data-tooltip-content": info,
              "data-tooltip-place": "top-end"
            }
          ),
          isError && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            TriangleAlert,
            {
              className: "void-text-void-warning void-opacity-90 void-flex-shrink-0",
              size: 14,
              "data-tooltip-id": "void-tooltip",
              "data-tooltip-content": "Error running tool",
              "data-tooltip-place": "top"
            }
          ),
          isRejected && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            Ban,
            {
              className: "void-text-void-fg-4 void-opacity-90 void-flex-shrink-0",
              size: 14,
              "data-tooltip-id": "void-tooltip",
              "data-tooltip-content": "Canceled",
              "data-tooltip-place": "top"
            }
          ),
          desc2 && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-4 void-text-xs", onClick: desc2OnClick, children: desc2 }),
          numResults !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-4 void-text-xs void-ml-auto void-mr-1", children: `${numResults}${hasNextPage ? "+" : ""} result${numResults !== 1 ? "s" : ""}` })
        ] })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        "div",
        {
          className: `void-overflow-hidden void-transition-all void-duration-200 void-ease-in-out ${isExpanded ? "void-opacity-100 void-py-1" : "void-max-h-0 void-opacity-0"} void-text-void-fg-4 void-rounded-sm void-overflow-x-auto `,
          children
        }
      )
    ] }),
    bottomChildren
  ] });
};
var EditTool = ({ toolMessage, threadId, messageIdx, content }) => {
  const accessor = useAccessor();
  const isError = false;
  const isRejected = toolMessage.type === "rejected";
  const title = getTitle(toolMessage);
  const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
  const icon = null;
  const { rawParams, params, name } = toolMessage;
  const desc1OnClick = () => voidOpenFileFn(params.uri, accessor);
  const componentParams = { title, desc1, desc1OnClick, desc1Info, isError, icon, isRejected };
  const editToolType = toolMessage.name === "edit_file" ? "diff" : "rewrite";
  if (toolMessage.type === "running_now" || toolMessage.type === "tool_request") {
    componentParams.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { className: "void-bg-void-bg-3", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      EditToolChildren,
      {
        uri: params.uri,
        code: content,
        type: editToolType
      }
    ) });
  } else if (toolMessage.type === "success" || toolMessage.type === "rejected" || toolMessage.type === "tool_error") {
    const applyBoxId = getApplyBoxId({
      threadId,
      messageIdx,
      tokenIdx: "N/A"
    });
    componentParams.desc2 = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      EditToolHeaderButtons,
      {
        applyBoxId,
        uri: params.uri,
        codeStr: content,
        toolName: name,
        threadId
      }
    );
    componentParams.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { className: "void-bg-void-bg-3", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      EditToolChildren,
      {
        uri: params.uri,
        code: content,
        type: editToolType
      }
    ) });
    if (toolMessage.type === "success" || toolMessage.type === "rejected") {
      const { result } = toolMessage;
      componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Lint errors", children: result?.lintErrors?.map(
        (error2, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-whitespace-nowrap", children: [
          "Lines ",
          error2.startLineNumber,
          "-",
          error2.endLineNumber,
          ": ",
          error2.message
        ] }, i)
      ) });
    } else if (toolMessage.type === "tool_error") {
      const { result } = toolMessage;
      componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
};
var UserMessageComponent = ({ chatMessage, messageIdx, isCheckpointGhost, currCheckpointIdx, _scrollToBottom }) => {
  const accessor = useAccessor();
  const chatThreadsService = accessor.get("IChatThreadService");
  const chatThreadsState = useChatThreadsState();
  const currentThreadId = chatThreadsState.currentThreadId;
  let isBeingEdited = false;
  let stagingSelections = [];
  let setIsBeingEdited = (_) => {
  };
  let setStagingSelections = (_) => {
  };
  if (messageIdx !== void 0) {
    const _state = chatThreadsService.getCurrentMessageState(messageIdx);
    isBeingEdited = _state.isBeingEdited;
    stagingSelections = _state.stagingSelections;
    setIsBeingEdited = (v) => chatThreadsService.setCurrentMessageState(messageIdx, { isBeingEdited: v });
    setStagingSelections = (s) => chatThreadsService.setCurrentMessageState(messageIdx, { stagingSelections: s });
  }
  const mode = isBeingEdited ? "edit" : "display";
  const [isFocused, setIsFocused] = (0, import_react19.useState)(false);
  const [isHovered, setIsHovered] = (0, import_react19.useState)(false);
  const [isDisabled, setIsDisabled] = (0, import_react19.useState)(false);
  const [textAreaRefState, setTextAreaRef] = (0, import_react19.useState)(null);
  const textAreaFnsRef = (0, import_react19.useRef)(null);
  const _mustInitialize = (0, import_react19.useRef)(true);
  const _justEnabledEdit = (0, import_react19.useRef)(false);
  (0, import_react19.useEffect)(() => {
    const canInitialize = mode === "edit" && textAreaRefState;
    const shouldInitialize = _justEnabledEdit.current || _mustInitialize.current;
    if (canInitialize && shouldInitialize) {
      setStagingSelections(
        (chatMessage.selections || []).map((s) => {
          if (s.type === "File") return { ...s, state: { ...s.state, wasAddedAsCurrentFile: false } };
          else
            return s;
        })
      );
      if (textAreaFnsRef.current)
        textAreaFnsRef.current.setValue(chatMessage.displayContent || "");
      textAreaRefState.focus();
      _justEnabledEdit.current = false;
      _mustInitialize.current = false;
    }
  }, [chatMessage, mode, textAreaRefState, setStagingSelections]);
  const onOpenEdit = () => {
    setIsBeingEdited(true);
    chatThreadsService.setCurrentlyFocusedMessageIdx(messageIdx);
    _justEnabledEdit.current = true;
  };
  const onCloseEdit = () => {
    setIsFocused(false);
    setIsHovered(false);
    setIsBeingEdited(false);
    chatThreadsService.setCurrentlyFocusedMessageIdx(void 0);
  };
  const EditSymbol = mode === "display" ? Pencil : X;
  let chatbubbleContents;
  if (mode === "display") {
    const hasImages = chatMessage.images && chatMessage.images.length > 0;
    const hasPDFs = chatMessage.pdfs && chatMessage.pdfs.length > 0;
    chatbubbleContents = /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(SelectedFiles, { type: "past", messageIdx, selections: chatMessage.selections || [] }),
      hasImages && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-px-0.5 void-py-2", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        ImageMessageRenderer,
        {
          images: chatMessage.images
        }
      ) }),
      hasPDFs && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-px-0.5 void-py-2", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        PDFMessageRenderer,
        {
          pdfs: chatMessage.pdfs
        }
      ) }),
      chatMessage.displayContent && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-px-0.5", children: chatMessage.displayContent })
    ] });
  } else if (mode === "edit") {
    const onSubmit = async () => {
      if (isDisabled) return;
      if (!textAreaRefState) return;
      if (messageIdx === void 0) return;
      const threadId = currentThreadId;
      const thread = chatThreadsState.allThreads[threadId];
      if (!thread || !thread.messages || thread.messages[messageIdx]?.role !== "user") {
        console.error("Error while editing message: Message is not a user message or no longer exists");
        setIsBeingEdited(false);
        chatThreadsService.setCurrentlyFocusedMessageIdx(void 0);
        return;
      }
      await chatThreadsService.abortRunning(threadId);
      setIsBeingEdited(false);
      chatThreadsService.setCurrentlyFocusedMessageIdx(void 0);
      const userMessage = textAreaRefState.value;
      try {
        await chatThreadsService.editUserMessageAndStreamResponse({ userMessage, messageIdx, threadId });
      } catch (e) {
        console.error("Error while editing message:", e);
      }
      await chatThreadsService.focusCurrentChat();
      requestAnimationFrame(() => _scrollToBottom?.());
    };
    const onAbort = async () => {
      const threadId = currentThreadId;
      await chatThreadsService.abortRunning(threadId);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onCloseEdit();
      }
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        onSubmit();
      }
    };
    if (!chatMessage.content) {
      return null;
    }
    chatbubbleContents = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      VoidChatArea,
      {
        featureName: "Chat",
        onSubmit,
        onAbort,
        isStreaming: false,
        isDisabled,
        showSelections: true,
        showProspectiveSelections: false,
        selections: stagingSelections,
        setSelections: setStagingSelections,
        children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          VoidInputBox2,
          {
            enableAtToMention: true,
            appearance: "chatDark",
            ref: setTextAreaRef,
            className: "void-min-h-[60px] void-px-3 void-py-3 void-rounded-2xl",
            placeholder: "Plan, @ for context, / for commands",
            onChangeText: (text) => setIsDisabled(!text),
            onFocus: () => {
              setIsFocused(true);
              chatThreadsService.setCurrentlyFocusedMessageIdx(messageIdx);
            },
            onBlur: () => {
              setIsFocused(false);
            },
            onKeyDown,
            fnsRef: textAreaFnsRef,
            multiline: true
          }
        )
      }
    );
  }
  const isMsgAfterCheckpoint = currCheckpointIdx !== void 0 && currCheckpointIdx === messageIdx - 1;
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
    "div",
    {
      className: ` void-relative void-ml-auto ${mode === "edit" ? "void-w-full void-max-w-full" : mode === "display" ? `void-self-end void-w-fit void-max-w-full void-whitespace-pre-wrap` : ""} ${isCheckpointGhost && !isMsgAfterCheckpoint ? "void-opacity-50 void-pointer-events-none" : ""} `,
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "div",
          {
            className: ` void-text-left void-rounded-lg void-max-w-full ${mode === "edit" ? "" : mode === "display" ? "void-p-2 void-flex void-flex-col void-bg-void-bg-1 void-text-void-fg-1 void-overflow-x-auto void-cursor-pointer" : ""} `,
            onClick: () => {
              if (mode === "display") {
                onOpenEdit();
              }
            },
            children: chatbubbleContents
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "div",
          {
            className: "void-absolute -void-top-1 -void-right-1 void-translate-x-0 -void-translate-y-0 void-z-1",
            children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
              EditSymbol,
              {
                size: 18,
                className: ` void-cursor-pointer void-p-[2px] void-bg-void-bg-1 void-border void-border-void-border-1 void-rounded-md void-transition-opacity void-duration-200 void-ease-in-out ${isHovered || isFocused && mode === "edit" ? "void-opacity-100" : "void-opacity-0"} `,
                onClick: () => {
                  if (mode === "display") {
                    onOpenEdit();
                  } else if (mode === "edit") {
                    onCloseEdit();
                  }
                }
              }
            )
          }
        )
      ]
    }
  );
};
var SmallProseWrapper = ({ children }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: " void-text-void-fg-4 void-prose void-prose-sm void-break-words void-max-w-none void-leading-snug void-text-[13px] [&>:first-child]:!void-mt-0 [&>:last-child]:!void-mb-0 prose-h1:void-text-[14px] prose-h1:void-my-4 prose-h2:void-text-[13px] prose-h2:void-my-4 prose-h3:void-text-[13px] prose-h3:void-my-3 prose-h4:void-text-[13px] prose-h4:void-my-2 prose-p:void-my-2 prose-p:void-leading-snug prose-hr:void-my-2 prose-ul:void-my-2 prose-ul:void-pl-4 prose-ul:void-list-outside prose-ul:void-list-disc prose-ul:void-leading-snug prose-ol:void-my-2 prose-ol:void-pl-4 prose-ol:void-list-outside prose-ol:void-list-decimal prose-ol:void-leading-snug marker:void-text-inherit prose-blockquote:void-pl-2 prose-blockquote:void-my-2 prose-code:void-text-void-fg-3 prose-code:void-text-[12px] prose-code:before:void-content-none prose-code:after:void-content-none prose-pre:void-text-[12px] prose-pre:void-p-2 prose-pre:void-my-2 prose-table:void-text-[13px] ", children });
};
var ProseWrapper = ({ children }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: " void-text-void-fg-2 void-prose void-prose-sm void-break-words prose-p:void-block prose-hr:void-my-4 prose-pre:void-my-2 marker:void-text-inherit prose-ol:void-list-outside prose-ol:void-list-decimal prose-ul:void-list-outside prose-ul:void-list-disc prose-li:void-my-0 prose-code:before:void-content-none prose-code:after:void-content-none prose-headings:void-prose-sm prose-headings:void-font-bold prose-p:void-leading-normal prose-ol:void-leading-normal prose-ul:void-leading-normal void-max-w-none ", children });
};
var AssistantMessageComponent = import_react19.default.memo(({ chatMessage, isCheckpointGhost, isCommitted, messageIdx }) => {
  const accessor = useAccessor();
  const chatThreadsService = accessor.get("IChatThreadService");
  const reasoningStr = chatMessage.reasoning?.trim() || null;
  const hasReasoning = !!reasoningStr;
  const isDoneReasoning = !!chatMessage.displayContent;
  const thread = chatThreadsService.getCurrentThread();
  const chatMessageLocation = (0, import_react19.useMemo)(() => ({
    threadId: thread.id,
    messageIdx
  }), [thread.id, messageIdx]);
  const isEmpty = !chatMessage.displayContent && !chatMessage.reasoning;
  if (isEmpty) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
    hasReasoning && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${isCheckpointGhost ? "void-opacity-50" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ReasoningWrapper, { isDoneReasoning, isStreaming: !isCommitted, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(SmallProseWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      ChatMarkdownRender,
      {
        string: reasoningStr,
        chatMessageLocation,
        isApplyEnabled: false,
        isLinkDetectionEnabled: true
      }
    ) }) }) }),
    chatMessage.displayContent && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${isCheckpointGhost ? "void-opacity-50" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ProseWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      ChatMarkdownRender,
      {
        string: chatMessage.displayContent || "",
        chatMessageLocation,
        isApplyEnabled: true,
        isLinkDetectionEnabled: true
      }
    ) }) })
  ] });
}, (prev, next) => {
  return prev.chatMessage.displayContent === next.chatMessage.displayContent && prev.chatMessage.reasoning === next.chatMessage.reasoning && prev.isCheckpointGhost === next.isCheckpointGhost && prev.isCommitted === next.isCommitted && prev.messageIdx === next.messageIdx;
});
var ReasoningWrapper = ({ isDoneReasoning, isStreaming, children }) => {
  const isDone = isDoneReasoning || !isStreaming;
  const isWriting = !isDone;
  const [isOpen, setIsOpen] = (0, import_react19.useState)(isWriting);
  (0, import_react19.useEffect)(() => {
    if (!isWriting) setIsOpen(false);
  }, [isWriting]);
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { title: "Reasoning", desc1: isWriting ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconLoading, {}) : "", isOpen, onClick: () => setIsOpen((v) => !v), children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "!void-select-text void-cursor-auto", children }) }) });
};
var loadingTitleWrapper = (item) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "void-flex void-items-center void-flex-nowrap", children: [
    item,
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconLoading, { className: "void-w-3 void-text-sm" })
  ] });
};
var titleOfBuiltinToolName = {
  "read_file": { done: "Read file", proposed: "Read file", running: loadingTitleWrapper("Reading file") },
  "ls_dir": { done: "Inspected folder", proposed: "Inspect folder", running: loadingTitleWrapper("Inspecting folder") },
  "get_dir_tree": { done: "Inspected folder tree", proposed: "Inspect folder tree", running: loadingTitleWrapper("Inspecting folder tree") },
  "search_pathnames_only": { done: "Searched by file name", proposed: "Search by file name", running: loadingTitleWrapper("Searching by file name") },
  "search_for_files": { done: "Searched", proposed: "Search", running: loadingTitleWrapper("Searching") },
  "create_file_or_folder": { done: `Created`, proposed: `Create`, running: loadingTitleWrapper(`Creating`) },
  "delete_file_or_folder": { done: `Deleted`, proposed: `Delete`, running: loadingTitleWrapper(`Deleting`) },
  "edit_file": { done: `Edited file`, proposed: "Edit file", running: loadingTitleWrapper("Editing file") },
  "rewrite_file": { done: `Wrote file`, proposed: "Write file", running: loadingTitleWrapper("Writing file") },
  "run_command": { done: `Ran terminal`, proposed: "Run terminal", running: loadingTitleWrapper("Running terminal") },
  "run_persistent_command": { done: `Ran terminal`, proposed: "Run terminal", running: loadingTitleWrapper("Running terminal") },
  "open_persistent_terminal": { done: `Opened terminal`, proposed: "Open terminal", running: loadingTitleWrapper("Opening terminal") },
  "kill_persistent_terminal": { done: `Killed terminal`, proposed: "Kill terminal", running: loadingTitleWrapper("Killing terminal") },
  "read_lint_errors": { done: `Read lint errors`, proposed: "Read lint errors", running: loadingTitleWrapper("Reading lint errors") },
  "search_in_file": { done: "Searched in file", proposed: "Search in file", running: loadingTitleWrapper("Searching in file") },
  "web_search": { done: "Searched the web", proposed: "Search the web", running: loadingTitleWrapper("Searching the web") },
  "browse_url": { done: "Fetched web page", proposed: "Fetch web page", running: loadingTitleWrapper("Fetching web page") }
};
var getTitle = (toolMessage) => {
  const t = toolMessage;
  if (!builtinToolNames.includes(t.name)) {
    const descriptor = t.type === "success" ? "Called" : t.type === "running_now" ? "Calling" : t.type === "tool_request" ? "Call" : t.type === "rejected" ? "Call" : t.type === "invalid_params" ? "Call" : t.type === "tool_error" ? "Call" : "Call";
    const title = `${descriptor} ${toolMessage.mcpServerName || "MCP"}`;
    if (t.type === "running_now" || t.type === "tool_request")
      return loadingTitleWrapper(title);
    return title;
  } else {
    const toolName = t.name;
    if (t.type === "success") return titleOfBuiltinToolName[toolName].done;
    if (t.type === "running_now") return titleOfBuiltinToolName[toolName].running;
    return titleOfBuiltinToolName[toolName].proposed;
  }
};
var toolNameToDesc = (toolName, _toolParams, accessor) => {
  if (!_toolParams) {
    return { desc1: "" };
  }
  const x = {
    "read_file": () => {
      const toolParams = _toolParams;
      return {
        desc1: getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    "ls_dir": () => {
      const toolParams = _toolParams;
      return {
        desc1: getFolderName(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    "search_pathnames_only": () => {
      const toolParams = _toolParams;
      return {
        desc1: `"${toolParams.query}"`
      };
    },
    "search_for_files": () => {
      const toolParams = _toolParams;
      return {
        desc1: `"${toolParams.query}"`
      };
    },
    "search_in_file": () => {
      const toolParams = _toolParams;
      return {
        desc1: `"${toolParams.query}"`,
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    "create_file_or_folder": () => {
      const toolParams = _toolParams;
      return {
        desc1: toolParams.isFolder ? getFolderName(toolParams.uri.fsPath) ?? "/" : getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    "delete_file_or_folder": () => {
      const toolParams = _toolParams;
      return {
        desc1: toolParams.isFolder ? getFolderName(toolParams.uri.fsPath) ?? "/" : getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    "rewrite_file": () => {
      const toolParams = _toolParams;
      return {
        desc1: getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    "edit_file": () => {
      const toolParams = _toolParams;
      return {
        desc1: getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    "run_command": () => {
      const toolParams = _toolParams;
      return {
        desc1: `"${toolParams.command}"`
      };
    },
    "run_persistent_command": () => {
      const toolParams = _toolParams;
      return {
        desc1: `"${toolParams.command}"`
      };
    },
    "open_persistent_terminal": () => {
      return { desc1: "" };
    },
    "kill_persistent_terminal": () => {
      const toolParams = _toolParams;
      return { desc1: toolParams.persistentTerminalId };
    },
    "get_dir_tree": () => {
      const toolParams = _toolParams;
      return {
        desc1: getFolderName(toolParams.uri.fsPath) ?? "/",
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    "read_lint_errors": () => {
      const toolParams = _toolParams;
      return {
        desc1: getBasename(toolParams.uri.fsPath),
        desc1Info: getRelative(toolParams.uri, accessor)
      };
    },
    "web_search": () => {
      const toolParams = _toolParams;
      return {
        desc1: `"${toolParams.query}"`
      };
    },
    "browse_url": () => {
      const toolParams = _toolParams;
      return {
        desc1: toolParams.url,
        desc1Info: new URL(toolParams.url).hostname
      };
    }
  };
  try {
    return x[toolName]?.() || { desc1: "" };
  } catch {
    return { desc1: "" };
  }
};
var ToolRequestAcceptRejectButtons = ({ toolName }) => {
  const accessor = useAccessor();
  const chatThreadsService = accessor.get("IChatThreadService");
  const metricsService = accessor.get("IMetricsService");
  accessor.get("ICortexideSettingsService");
  useSettingsState();
  const chatThreadsState = useChatThreadsState();
  const currentThreadId = chatThreadsState.currentThreadId;
  const onAccept = (0, import_react19.useCallback)(() => {
    try {
      chatThreadsService.approveLatestToolRequest(currentThreadId);
      metricsService.capture("Tool Request Accepted", {});
    } catch (e) {
      console.error("Error while approving message in chat:", e);
    }
  }, [chatThreadsService, metricsService, currentThreadId]);
  const onReject = (0, import_react19.useCallback)(() => {
    try {
      chatThreadsService.rejectLatestToolRequest(currentThreadId);
    } catch (e) {
      console.error("Error while approving message in chat:", e);
    }
    metricsService.capture("Tool Request Rejected", {});
  }, [chatThreadsService, metricsService, currentThreadId]);
  const approveButton = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    "button",
    {
      onClick: onAccept,
      className: ` void-px-2 void-py-1 void-bg-[var(--vscode-button-background)] void-text-[var(--vscode-button-foreground)] hover:void-bg-[var(--vscode-button-hoverBackground)] void-rounded void-text-sm void-font-medium `,
      children: "Approve"
    }
  );
  const cancelButton = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    "button",
    {
      onClick: onReject,
      className: ` void-px-2 void-py-1 void-bg-[var(--vscode-button-secondaryBackground)] void-text-[var(--vscode-button-secondaryForeground)] hover:void-bg-[var(--vscode-button-secondaryHoverBackground)] void-rounded void-text-sm void-font-medium `,
      children: "Cancel"
    }
  );
  const approvalType = isABuiltinToolName(toolName) ? approvalTypeOfBuiltinToolName[toolName] : "MCP tools";
  const approvalToggle = approvalType ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-flex void-items-center void-ml-2 void-gap-x-1", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolApprovalTypeSwitch, { size: "xs", approvalType, desc: `Auto-approve ${approvalType}` }) }, approvalType) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-gap-2 void-mx-0.5 void-items-center", children: [
    approveButton,
    cancelButton,
    approvalToggle
  ] });
};
var ToolChildrenWrapper = ({ children, className }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${className ? className : ""} void-cursor-default void-select-none`, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-px-2 void-min-w-full void-overflow-hidden", children }) });
};
var CodeChildren = ({ children, className }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${className ?? ""} void-p-1 void-rounded-sm void-overflow-auto void-text-sm`, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "!void-select-text void-cursor-auto", children }) });
};
var ListableToolItem = ({ name, onClick, isSmall, className, showDot }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
    "div",
    {
      className: ` ${onClick ? "hover:void-brightness-125 hover:void-cursor-pointer void-transition-all void-duration-200 " : ""} void-flex void-items-center void-flex-nowrap void-whitespace-nowrap ${className ? className : ""} `,
      onClick,
      children: [
        showDot === false ? null : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-flex-shrink-0", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("svg", { className: "void-w-1 void-h-1 void-opacity-60 void-mr-1.5 void-fill-current", viewBox: "0 0 100 40", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("rect", { x: "0", y: "15", width: "100", height: "10" }) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${isSmall ? "void-italic void-text-void-fg-4 void-flex void-items-center" : ""}`, children: name })
      ]
    }
  );
};
var EditToolChildren = ({ uri, code, type }) => {
  const content = type === "diff" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(VoidDiffEditor, { uri, searchReplaceBlocks: code }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ChatMarkdownRender, { string: `\`\`\`
${code}
\`\`\``, codeURI: uri, chatMessageLocation: void 0 });
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "!void-select-text void-cursor-auto", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(SmallProseWrapper, { children: content }) });
};
var LintErrorChildren = ({ lintErrors }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-text-xs void-text-void-fg-4 void-opacity-80 void-border-l-2 void-border-void-warning void-px-2 void-py-0.5 void-flex void-flex-col void-gap-0.5 void-overflow-x-auto void-whitespace-nowrap", children: lintErrors.map(
    (error2, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
      "Lines ",
      error2.startLineNumber,
      "-",
      error2.endLineNumber,
      ": ",
      error2.message
    ] }, i)
  ) });
};
var BottomChildren = ({ children, title }) => {
  const [isOpen, setIsOpen] = (0, import_react19.useState)(false);
  if (!children) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-w-full void-px-2 void-mt-0.5", children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
      "div",
      {
        className: `void-flex void-items-center void-cursor-pointer void-select-none void-transition-colors void-duration-150 void-pl-0 void-py-0.5 void-rounded void-group`,
        onClick: () => setIsOpen((o) => !o),
        style: { background: "none" },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            ChevronRight,
            {
              className: `void-mr-1 void-h-3 void-w-3 void-flex-shrink-0 void-transition-transform void-duration-100 void-text-void-fg-4 group-hover:void-text-void-fg-3 ${isOpen ? "void-rotate-90" : ""}`
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-font-medium void-text-void-fg-4 group-hover:void-text-void-fg-3 void-text-xs", children: title })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "div",
      {
        className: `void-overflow-hidden void-transition-all void-duration-200 void-ease-in-out ${isOpen ? "void-opacity-100" : "void-max-h-0 void-opacity-0"} void-text-xs void-pl-4`,
        children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-overflow-x-auto void-text-void-fg-4 void-opacity-90 void-border-l-2 void-border-void-warning void-px-2 void-py-0.5", children })
      }
    )
  ] });
};
var EditToolHeaderButtons = ({ applyBoxId, uri, codeStr, toolName, threadId }) => {
  const { streamState } = useEditToolStreamState({ applyBoxId, uri });
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-1", children: [
    streamState === "idle-no-changes" && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CopyButton, { codeStr, toolTipName: "Copy" }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(EditToolAcceptRejectButtonsHTML, { type: toolName, codeStr, applyBoxId, uri, threadId })
  ] });
};
var InvalidTool = ({ toolName, message, mcpServerName }) => {
  useAccessor();
  const title = getTitle({ name: toolName, type: "invalid_params", mcpServerName });
  const desc1 = "Invalid parameters";
  const icon = null;
  const isError = true;
  const componentParams = { title, desc1, isError, icon };
  componentParams.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { className: "void-bg-void-bg-3", children: message }) });
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
};
var CanceledTool = ({ toolName, mcpServerName }) => {
  useAccessor();
  const title = getTitle({ name: toolName, type: "rejected", mcpServerName });
  const desc1 = "";
  const icon = null;
  const isRejected = true;
  const componentParams = { title, desc1, icon, isRejected };
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
};
var CommandTool = ({
  toolMessage,
  type,
  threadId
}) => {
  const accessor = useAccessor();
  accessor.get("ICommandService");
  const terminalToolsService = accessor.get("ITerminalToolService");
  const toolsService = accessor.get("IToolsService");
  const isError = false;
  const title = getTitle(toolMessage);
  const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
  const icon = null;
  const streamState = useChatThreadsStreamState(threadId);
  const divRef = (0, import_react19.useRef)(null);
  const isRejected = toolMessage.type === "rejected";
  const { rawParams, params } = toolMessage;
  const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
  const effect = async () => {
    if (streamState?.isRunning !== "tool") return;
    if (type !== "run_command" || toolMessage.type !== "running_now") return;
    await streamState?.interrupt;
    const container = divRef.current;
    if (!container) return;
    const terminal = terminalToolsService.getTemporaryTerminal(toolMessage.params.terminalId);
    if (!terminal) return;
    try {
      terminal.attachToElement(container);
      terminal.setVisible(true);
    } catch {
    }
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      let width;
      let height;
      if (entries[0].borderBoxSize && entries[0].borderBoxSize.length > 0) {
        width = entries[0].borderBoxSize[0].inlineSize;
        height = entries[0].borderBoxSize[0].blockSize;
      } else if (entries[0].contentRect) {
        width = entries[0].contentRect.width;
        height = entries[0].contentRect.height;
      } else {
        const target = entries[0].target;
        width = target.clientWidth;
        height = target.clientHeight;
      }
      if (width > 0 && height > 0 && typeof terminal.layout === "function") {
        terminal.layout({ width, height });
      }
    });
    resizeObserver.observe(container);
    return () => {
      terminal.detachFromElement();
      resizeObserver?.disconnect();
    };
  };
  (0, import_react19.useEffect)(() => {
    effect();
  }, [terminalToolsService, toolMessage, toolMessage.type, type]);
  if (toolMessage.type === "success") {
    const { result } = toolMessage;
    let msg;
    if (type === "run_command") msg = toolsService.stringOfResult["run_command"](toolMessage.params, result);
    else
      msg = toolsService.stringOfResult["run_persistent_command"](toolMessage.params, result);
    if (type === "run_persistent_command") {
      componentParams.info = persistentTerminalNameOfId(toolMessage.params.persistentTerminalId);
    }
    componentParams.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { className: "void-whitespace-pre void-text-nowrap void-overflow-auto void-text-sm", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "!void-select-text void-cursor-auto", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BlockCode, { initValue: `${msg.trim()}`, language: "shellscript" }) }) });
  } else if (toolMessage.type === "tool_error") {
    const { result } = toolMessage;
    componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
  } else if (toolMessage.type === "running_now") {
    if (type === "run_command")
      componentParams.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { ref: divRef, className: "void-relative void-h-[300px] void-text-sm" });
  } else if (toolMessage.type === "rejected" || toolMessage.type === "tool_request") ;
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_jsx_runtime15.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams, isOpen: type === "run_command" && toolMessage.type === "running_now" ? true : void 0 }) });
};
var MCPToolWrapper = ({ toolMessage }) => {
  const accessor = useAccessor();
  const mcpService = accessor.get("IMCPService");
  const title = getTitle(toolMessage);
  const desc1 = removeMCPToolNamePrefix(toolMessage.name);
  const icon = null;
  if (toolMessage.type === "running_now") return null;
  const isError = false;
  const isRejected = toolMessage.type === "rejected";
  const { rawParams, params } = toolMessage;
  const redactParams = (value) => {
    const SENSITIVE_KEYS = /* @__PURE__ */ new Set(["token", "apiKey", "apikey", "password", "authorization", "auth", "secret", "clientSecret", "accessToken", "bearer"]);
    const redactValue = (v) => typeof v === "string" ? v.length > 6 ? v.slice(0, 3) + "***" + v.slice(-2) : "***" : v;
    if (Array.isArray(value)) return value.map(redactParams);
    if (value && typeof value === "object") {
      const out = Array.isArray(value) ? [] : {};
      for (const k of Object.keys(value)) {
        if (SENSITIVE_KEYS.has(k.toLowerCase())) out[k] = redactValue(value[k]);
        else
          out[k] = redactParams(value[k]);
      }
      return out;
    }
    return value;
  };
  const componentParams = { title, desc1, isError, icon, isRejected };
  const redactedParams = redactParams(params);
  const paramsStr = JSON.stringify(redactedParams, null, 2);
  componentParams.desc2 = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CopyButton, { codeStr: paramsStr, toolTipName: `Copy inputs (redacted): ${paramsStr}` });
  componentParams.info = !toolMessage.mcpServerName ? "MCP tool not found" : void 0;
  if (toolMessage.type === "success" || toolMessage.type === "tool_request") {
    const { result } = toolMessage;
    const resultStr = result ? mcpService.stringifyResult(result) : "null";
    componentParams.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(SmallProseWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      ChatMarkdownRender,
      {
        string: `\`\`\`json
${resultStr}
\`\`\``,
        chatMessageLocation: void 0,
        isApplyEnabled: false,
        isLinkDetectionEnabled: true
      }
    ) }) });
  } else if (toolMessage.type === "tool_error") {
    const { result } = toolMessage;
    componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
};
var builtinToolNameToComponent = {
  "read_file": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      accessor.get("ICommandService");
      const title = getTitle(toolMessage);
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const icon = null;
      if (toolMessage.type === "tool_request") return null;
      if (toolMessage.type === "running_now") return null;
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      let range = void 0;
      if (toolMessage.params.startLine !== null || toolMessage.params.endLine !== null) {
        const start = toolMessage.params.startLine === null ? `1` : `${toolMessage.params.startLine}`;
        const end = toolMessage.params.endLine === null ? `` : `${toolMessage.params.endLine}`;
        const addStr = `(${start}-${end})`;
        componentParams.desc1 += ` ${addStr}`;
        range = [params.startLine || 1, params.endLine || 1];
      }
      if (toolMessage.type === "success") {
        const { result } = toolMessage;
        componentParams.onClick = () => {
          voidOpenFileFn(params.uri, accessor, range);
        };
        if (result.hasNextPage && params.pageNumber === 1)
          componentParams.desc2 = `(truncated after ${Math.round(MAX_FILE_CHARS_PAGE) / 1e3}k)`;
        else if (params.pageNumber > 1)
          componentParams.desc2 = `(part ${params.pageNumber})`;
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  },
  "get_dir_tree": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      accessor.get("ICommandService");
      const title = getTitle(toolMessage);
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const icon = null;
      if (toolMessage.type === "tool_request") return null;
      if (toolMessage.type === "running_now") return null;
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      if (params.uri) {
        const rel = getRelative(params.uri, accessor);
        if (rel) componentParams.info = `Only search in ${rel}`;
      }
      if (toolMessage.type === "success") {
        const { result } = toolMessage;
        componentParams.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(SmallProseWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          ChatMarkdownRender,
          {
            string: `\`\`\`
${result.str}
\`\`\``,
            chatMessageLocation: void 0,
            isApplyEnabled: false,
            isLinkDetectionEnabled: true
          }
        ) }) });
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  },
  "ls_dir": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      accessor.get("ICommandService");
      accessor.get("IExplorerService");
      const title = getTitle(toolMessage);
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const icon = null;
      if (toolMessage.type === "tool_request") return null;
      if (toolMessage.type === "running_now") return null;
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      if (params.uri) {
        const rel = getRelative(params.uri, accessor);
        if (rel) componentParams.info = `Only search in ${rel}`;
      }
      if (toolMessage.type === "success") {
        const { result } = toolMessage;
        componentParams.numResults = result.children?.length;
        componentParams.hasNextPage = result.hasNextPage;
        componentParams.children = !result.children || (result.children.length ?? 0) === 0 ? void 0 : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(ToolChildrenWrapper, { children: [
          result.children.map(
            (child, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
              ListableToolItem,
              {
                name: `${child.name}${child.isDirectory ? "/" : ""}`,
                className: "void-w-full void-overflow-auto",
                onClick: () => {
                  voidOpenFileFn(child.uri, accessor);
                }
              },
              i
            )
          ),
          result.hasNextPage && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ListableToolItem, { name: `Results truncated (${result.itemsRemaining} remaining).`, isSmall: true, className: "void-w-full void-overflow-auto" })
        ] });
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  },
  "search_pathnames_only": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      accessor.get("ICommandService");
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const title = getTitle(toolMessage);
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const icon = null;
      if (toolMessage.type === "tool_request") return null;
      if (toolMessage.type === "running_now") return null;
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      if (params.includePattern) {
        componentParams.info = `Only search in ${params.includePattern}`;
      }
      if (toolMessage.type === "success") {
        const { result, rawParams: rawParams2 } = toolMessage;
        componentParams.numResults = result.uris.length;
        componentParams.hasNextPage = result.hasNextPage;
        componentParams.children = result.uris.length === 0 ? void 0 : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(ToolChildrenWrapper, { children: [
          result.uris.map(
            (uri, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
              ListableToolItem,
              {
                name: getBasename(uri.fsPath),
                className: "void-w-full void-overflow-auto",
                onClick: () => {
                  voidOpenFileFn(uri, accessor);
                }
              },
              i
            )
          ),
          result.hasNextPage && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ListableToolItem, { name: "Results truncated.", isSmall: true, className: "void-w-full void-overflow-auto" })
        ] });
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  },
  "search_for_files": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      accessor.get("ICommandService");
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const title = getTitle(toolMessage);
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const icon = null;
      if (toolMessage.type === "tool_request") return null;
      if (toolMessage.type === "running_now") return null;
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      if (params.searchInFolder || params.isRegex) {
        let info = [];
        if (params.searchInFolder) {
          const rel = getRelative(params.searchInFolder, accessor);
          if (rel) info.push(`Only search in ${rel}`);
        }
        if (params.isRegex) {
          info.push(`Uses regex search`);
        }
        componentParams.info = info.join("; ");
      }
      if (toolMessage.type === "success") {
        const { result, rawParams: rawParams2 } = toolMessage;
        componentParams.numResults = result.uris.length;
        componentParams.hasNextPage = result.hasNextPage;
        componentParams.children = result.uris.length === 0 ? void 0 : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(ToolChildrenWrapper, { children: [
          result.uris.map(
            (uri, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
              ListableToolItem,
              {
                name: getBasename(uri.fsPath),
                className: "void-w-full void-overflow-auto",
                onClick: () => {
                  voidOpenFileFn(uri, accessor);
                }
              },
              i
            )
          ),
          result.hasNextPage && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ListableToolItem, { name: `Results truncated.`, isSmall: true, className: "void-w-full void-overflow-auto" })
        ] });
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  },
  "search_in_file": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      const toolsService = accessor.get("IToolsService");
      const title = getTitle(toolMessage);
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const icon = null;
      if (toolMessage.type === "tool_request") return null;
      if (toolMessage.type === "running_now") return null;
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      const infoarr = [];
      const uriStr = getRelative(params.uri, accessor);
      if (uriStr) infoarr.push(uriStr);
      if (params.isRegex) infoarr.push("Uses regex search");
      componentParams.info = infoarr.join("; ");
      if (toolMessage.type === "success") {
        const { result } = toolMessage;
        componentParams.numResults = result.lines.length;
        componentParams.children = result.lines.length === 0 ? void 0 : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { className: "void-bg-void-bg-3", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("pre", { className: "void-font-mono void-whitespace-pre", children: toolsService.stringOfResult["search_in_file"](params, result) }) }) });
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  },
  "read_lint_errors": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      accessor.get("ICommandService");
      const title = getTitle(toolMessage);
      const { uri } = toolMessage.params ?? {};
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const icon = null;
      if (toolMessage.type === "tool_request") return null;
      if (toolMessage.type === "running_now") return null;
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      componentParams.info = getRelative(uri, accessor);
      if (toolMessage.type === "success") {
        const { result } = toolMessage;
        componentParams.onClick = () => {
          voidOpenFileFn(params.uri, accessor);
        };
        if (result.lintErrors)
          componentParams.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(LintErrorChildren, { lintErrors: result.lintErrors });
        else
          componentParams.children = `No lint errors found.`;
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  },
  // ---
  "create_file_or_folder": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      accessor.get("ICommandService");
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const title = getTitle(toolMessage);
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const icon = null;
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      componentParams.info = getRelative(params.uri, accessor);
      if (toolMessage.type === "success") {
        const { result } = toolMessage;
        componentParams.onClick = () => {
          voidOpenFileFn(params.uri, accessor);
        };
      } else if (toolMessage.type === "rejected") {
        componentParams.onClick = () => {
          voidOpenFileFn(params.uri, accessor);
        };
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        if (params) {
          componentParams.onClick = () => {
            voidOpenFileFn(params.uri, accessor);
          };
        }
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      } else if (toolMessage.type === "running_now") ; else if (toolMessage.type === "tool_request") ;
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  },
  "delete_file_or_folder": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      accessor.get("ICommandService");
      toolMessage.params?.isFolder ?? false;
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const title = getTitle(toolMessage);
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const icon = null;
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      componentParams.info = getRelative(params.uri, accessor);
      if (toolMessage.type === "success") {
        const { result } = toolMessage;
        componentParams.onClick = () => {
          voidOpenFileFn(params.uri, accessor);
        };
      } else if (toolMessage.type === "rejected") {
        componentParams.onClick = () => {
          voidOpenFileFn(params.uri, accessor);
        };
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        if (params) {
          componentParams.onClick = () => {
            voidOpenFileFn(params.uri, accessor);
          };
        }
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      } else if (toolMessage.type === "running_now") {
        const { result } = toolMessage;
        componentParams.onClick = () => {
          voidOpenFileFn(params.uri, accessor);
        };
      } else if (toolMessage.type === "tool_request") {
        const { result } = toolMessage;
        componentParams.onClick = () => {
          voidOpenFileFn(params.uri, accessor);
        };
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  },
  "rewrite_file": {
    resultWrapper: (params) => {
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(EditTool, { ...params, content: params.toolMessage.params.newContent });
    }
  },
  "edit_file": {
    resultWrapper: (params) => {
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(EditTool, { ...params, content: params.toolMessage.params.searchReplaceBlocks });
    }
  },
  // ---
  "run_command": {
    resultWrapper: (params) => {
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CommandTool, { ...params, type: "run_command" });
    }
  },
  "run_persistent_command": {
    resultWrapper: (params) => {
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CommandTool, { ...params, type: "run_persistent_command" });
    }
  },
  "open_persistent_terminal": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      const terminalToolsService = accessor.get("ITerminalToolService");
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const title = getTitle(toolMessage);
      const icon = null;
      if (toolMessage.type === "tool_request") return null;
      if (toolMessage.type === "running_now") return null;
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      const relativePath = params.cwd ? getRelative(URI.file(params.cwd), accessor) : "";
      componentParams.info = relativePath ? `Running in ${relativePath}` : void 0;
      if (toolMessage.type === "success") {
        const { result } = toolMessage;
        const { persistentTerminalId } = result;
        componentParams.desc1 = persistentTerminalNameOfId(persistentTerminalId);
        componentParams.onClick = () => terminalToolsService.focusPersistentTerminal(persistentTerminalId);
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  },
  "kill_persistent_terminal": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      accessor.get("ICommandService");
      const terminalToolsService = accessor.get("ITerminalToolService");
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const title = getTitle(toolMessage);
      const icon = null;
      if (toolMessage.type === "tool_request") return null;
      if (toolMessage.type === "running_now") return null;
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      if (toolMessage.type === "success") {
        const { persistentTerminalId } = params;
        componentParams.desc1 = persistentTerminalNameOfId(persistentTerminalId);
        componentParams.onClick = () => terminalToolsService.focusPersistentTerminal(persistentTerminalId);
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  },
  "web_search": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      accessor.get("IToolsService");
      const title = getTitle(toolMessage);
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const icon = null;
      if (toolMessage.type === "tool_request") return null;
      if (toolMessage.type === "running_now") {
        const componentParams2 = { title, desc1, desc1Info, isError: false, icon, isRejected: false };
        componentParams2.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-2 void-text-sm void-text-void-fg-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconLoading, {}),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Searching the web..." })
        ] }) });
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams2 });
      }
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      if (toolMessage.type === "success") {
        const { result } = toolMessage;
        componentParams.numResults = result.results?.length || 0;
        if (result.results && result.results.length > 0) {
          componentParams.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-space-y-3", children: result.results.map(
            (r, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-border void-border-void-border-2 void-bg-void-bg-2 void-rounded void-p-3 hover:void-bg-void-bg-3 void-transition-colors", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
              "a",
              {
                href: r.url,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "void-block void-group",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-text-sm void-font-semibold void-text-blue-400 group-hover:void-text-blue-300 void-mb-1 void-line-clamp-2", children: r.title }),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-text-xs void-text-void-fg-4 void-mb-2 void-truncate", children: r.url }),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-text-sm void-text-void-fg-2 void-line-clamp-3", children: r.snippet })
                ]
              }
            ) }, i)
          ) }) });
        } else {
          componentParams.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-text-sm void-text-void-fg-3", children: "No search results found." }) });
        }
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  },
  "browse_url": {
    resultWrapper: ({ toolMessage }) => {
      const accessor = useAccessor();
      accessor.get("IToolsService");
      const title = getTitle(toolMessage);
      const { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor);
      const icon = null;
      if (toolMessage.type === "tool_request") return null;
      if (toolMessage.type === "running_now") {
        const componentParams2 = { title, desc1, desc1Info, isError: false, icon, isRejected: false };
        componentParams2.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-2 void-text-sm void-text-void-fg-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconLoading, {}),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Fetching content from URL..." })
        ] }) });
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams2 });
      }
      const isError = false;
      const isRejected = toolMessage.type === "rejected";
      const { rawParams, params } = toolMessage;
      const componentParams = { title, desc1, desc1Info, isError, icon, isRejected };
      if (toolMessage.type === "success") {
        const { result } = toolMessage;
        const urlStr = result.url || params.url;
        componentParams.onClick = () => {
          if (urlStr) {
            window.open(urlStr, "_blank", "noopener,noreferrer");
          }
        };
        componentParams.info = urlStr ? `Source: ${new URL(urlStr).hostname}` : void 0;
        if (result.content) {
          const contentPreview = result.content.length > 2e3 ? result.content.substring(0, 2e3) + "\n\n... (content truncated)" : result.content;
          componentParams.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-space-y-3", children: [
            result.title && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-text-lg void-font-semibold void-text-void-fg-1", children: result.title }),
            result.metadata?.publishedDate && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-text-xs void-text-void-fg-4", children: [
              "Published: ",
              result.metadata.publishedDate
            ] }),
            urlStr && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
              "a",
              {
                href: urlStr,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "void-text-sm void-text-blue-400 hover:void-text-blue-300 void-block void-truncate",
                children: urlStr
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-text-sm void-text-void-fg-2 void-whitespace-pre-wrap void-max-h-96 void-overflow-y-auto void-border void-border-void-border-2 void-bg-void-bg-3 void-rounded void-p-3", children: contentPreview })
          ] }) });
        } else {
          componentParams.children = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolChildrenWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-text-sm void-text-void-fg-3", children: "No content extracted from URL." }) });
        }
      } else if (toolMessage.type === "tool_error") {
        const { result } = toolMessage;
        componentParams.bottomChildren = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(BottomChildren, { title: "Error", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CodeChildren, { children: result }) });
      }
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolHeaderWrapper, { ...componentParams });
    }
  }
};
var Checkpoint = ({ message, threadId, messageIdx, isCheckpointGhost, threadIsRunning }) => {
  const accessor = useAccessor();
  const chatThreadService = accessor.get("IChatThreadService");
  const streamState = useFullChatThreadsStreamState();
  const chatThreadsState = useChatThreadsState();
  const isRunning = useChatThreadsStreamState(threadId)?.isRunning;
  const isDisabled = (0, import_react19.useMemo)(() => {
    if (isRunning) return true;
    return Object.values(streamState).some((threadState) => threadState?.isRunning);
  }, [isRunning, streamState]);
  const threadMessagesLength = chatThreadsState.allThreads[threadId]?.messages.length ?? 0;
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    "div",
    {
      className: `void-flex void-items-center void-justify-center void-px-2 `,
      children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        "div",
        {
          className: ` void-text-xs void-text-void-fg-3 void-select-none ${isCheckpointGhost ? "void-opacity-50" : "void-opacity-100"} ${isDisabled ? "void-cursor-default" : "void-cursor-pointer"} `,
          style: { position: "relative", display: "inline-block" },
          onClick: () => {
            if (threadIsRunning) return;
            if (isDisabled) return;
            chatThreadService.jumpToCheckpointBeforeMessageIdx({
              threadId,
              messageIdx,
              jumpToUserModified: messageIdx === threadMessagesLength - 1
            });
          },
          ...isDisabled ? {
            "data-tooltip-id": "void-tooltip",
            "data-tooltip-content": `Disabled ${isRunning ? "when running" : "because another thread is running"}`,
            "data-tooltip-place": "top"
          } : {},
          children: "Checkpoint"
        }
      )
    }
  );
};
var PlanComponent = import_react19.default.memo(({ message, isCheckpointGhost, threadId, messageIdx }) => {
  const accessor = useAccessor();
  const chatThreadService = accessor.get("IChatThreadService");
  const [expandedSteps, setExpandedSteps] = (0, import_react19.useState)(/* @__PURE__ */ new Set());
  const [isCollapsed, setIsCollapsed] = (0, import_react19.useState)(false);
  const chatThreadsState = useChatThreadsState();
  const approvalState = message.approvalState || "pending";
  const isRunning = useChatThreadsStreamState(threadId)?.isRunning;
  const isBusy = isRunning === "LLM" || isRunning === "tool" || isRunning === "preparing";
  const isIdleLike = isRunning === void 0 || isRunning === "idle";
  const thread = chatThreadsState.allThreads[threadId];
  const threadMessages = thread?.messages ?? [];
  const toolMessagesMap = (0, import_react19.useMemo)(() => {
    const map = /* @__PURE__ */ new Map();
    for (const msg of threadMessages) {
      if (msg.role === "tool") {
        const toolMsg = msg;
        map.set(toolMsg.id, toolMsg);
      }
    }
    return map;
  }, [threadMessages]);
  const totalSteps = message.steps.length;
  const completedSteps = (0, import_react19.useMemo)(
    () => message.steps.filter((s) => s.status === "succeeded" || s.status === "skipped").length,
    [message.steps]
  );
  const progressText = (0, import_react19.useMemo)(
    () => `${completedSteps} of ${totalSteps} ${totalSteps === 1 ? "Step" : "Steps"} Completed`,
    [completedSteps, totalSteps]
  );
  const hasPausedSteps = (0, import_react19.useMemo)(
    () => message.steps.some((s) => s.status === "paused"),
    [message.steps]
  );
  const getCheckmarkIcon = (status, isDisabled) => {
    if (isDisabled) {
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-w-5 void-h-5 void-rounded-full void-border-2 void-border-void-fg-4 void-flex void-items-center void-justify-center void-opacity-40" });
    }
    switch (status) {
      case "succeeded":
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-w-5 void-h-5 void-rounded-full void-border-2 void-border-green-500 void-bg-green-500/20 void-flex void-items-center void-justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Check, { size: 12, className: "void-text-green-400", strokeWidth: 3 }) });
      case "failed":
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-w-5 void-h-5 void-rounded-full void-border-2 void-border-red-500 void-bg-red-500/20 void-flex void-items-center void-justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(X, { size: 12, className: "void-text-red-400", strokeWidth: 3 }) });
      case "running":
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-w-5 void-h-5 void-rounded-full void-border-2 void-border-yellow-500 void-bg-yellow-500/20 void-flex void-items-center void-justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CircleEllipsis, { size: 12, className: "void-text-yellow-400 void-animate-spin" }) });
      case "paused":
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-w-5 void-h-5 void-rounded-full void-border-2 void-border-orange-500 void-bg-orange-500/20 void-flex void-items-center void-justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Dot, { size: 12, className: "void-text-orange-400" }) });
      case "skipped":
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-w-5 void-h-5 void-rounded-full void-border-2 void-border-gray-500 void-bg-gray-500/20 void-flex void-items-center void-justify-center void-opacity-60", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Ban, { size: 12, className: "void-text-gray-400" }) });
      default:
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-w-5 void-h-5 void-rounded-full void-border-2 void-border-void-fg-3 void-flex void-items-center void-justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-w-1.5 void-h-1.5 void-rounded-full void-bg-void-fg-3 void-opacity-60" }) });
    }
  };
  const toggleStepExpanded = (stepNumber) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };
  const handleApprove = () => {
    if (isCheckpointGhost || isBusy) return;
    chatThreadService.approvePlan({ threadId, messageIdx });
  };
  const handleReject = () => {
    if (isCheckpointGhost || isBusy) return;
    chatThreadService.rejectPlan({ threadId, messageIdx });
  };
  const handleToggleStep = (stepNumber) => {
    if (isCheckpointGhost || isBusy) return;
    chatThreadService.toggleStepDisabled({ threadId, messageIdx, stepNumber });
  };
  const getStatusBadge = (status) => {
    switch (status) {
      case "running":
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-px-1.5 void-py-0.5 void-text-xs void-rounded void-bg-yellow-500/20 void-text-yellow-400 void-border void-border-yellow-500/30", children: "Running" });
      case "failed":
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-px-1.5 void-py-0.5 void-text-xs void-rounded void-bg-red-500/20 void-text-red-400 void-border void-border-red-500/30", children: "Failed" });
      case "paused":
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-px-1.5 void-py-0.5 void-text-xs void-rounded void-bg-orange-500/20 void-text-orange-400 void-border void-border-orange-500/30", children: "Paused" });
      case "skipped":
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-px-1.5 void-py-0.5 void-text-xs void-rounded void-bg-gray-500/20 void-text-gray-400 void-border void-border-gray-500/30", children: "Skipped" });
      default:
        return null;
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${isCheckpointGhost ? "void-opacity-50 void-pointer-events-none" : ""} void-my-3`, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-bg-void-bg-1 void-border void-border-void-border-1 void-rounded-lg void-overflow-hidden", children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-px-4 void-py-3 void-border-b void-border-void-border-1 void-bg-void-bg-2/30", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-justify-between", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-2 void-flex-1 void-min-w-0", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "button",
          {
            onClick: () => setIsCollapsed(!isCollapsed),
            className: "void-flex-shrink-0 void-p-1 hover:void-bg-void-bg-2 void-rounded void-transition-colors",
            disabled: isCheckpointGhost,
            children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
              ChevronRight,
              {
                size: 16,
                className: `void-text-void-fg-3 void-transition-transform ${isCollapsed ? "" : "void-rotate-90"}`
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-2 void-flex-1 void-min-w-0", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("h3", { className: "void-text-void-fg-1 void-font-medium void-text-sm void-truncate", children: message.summary }),
          approvalState === "pending" && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-px-2 void-py-0.5 void-text-xs void-rounded void-bg-blue-500/20 void-text-blue-400 void-border void-border-blue-500/30 void-flex-shrink-0", children: "Pending Approval" }),
          approvalState === "executing" && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "void-px-2 void-py-0.5 void-text-xs void-rounded void-bg-yellow-500/20 void-text-yellow-400 void-border void-border-yellow-500/30 void-flex void-items-center void-gap-1 void-flex-shrink-0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CircleEllipsis, { size: 12, className: "void-animate-spin" }),
            "Executing"
          ] }),
          approvalState === "completed" && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "void-px-2 void-py-0.5 void-text-xs void-rounded void-bg-green-500/20 void-text-green-400 void-border void-border-green-500/30 void-flex void-items-center void-gap-1 void-flex-shrink-0", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Check, { size: 12 }),
            "Completed"
          ] })
        ] })
      ] }),
      !isCollapsed && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-3 void-flex-shrink-0", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-3 void-text-xs", "aria-live": "polite", children: progressText }),
        approvalState === "pending" && isIdleLike && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            "button",
            {
              title: "Reject plan",
              "aria-label": "Reject plan",
              onClick: handleReject,
              className: "void-px-3 void-py-1.5 void-text-xs void-rounded void-bg-red-500/10 void-text-red-400 void-border void-border-red-500/20 hover:void-bg-red-500/20 void-transition-colors focus:void-outline-none focus:void-ring-2 focus:void-ring-red-500/40",
              children: "Reject"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            "button",
            {
              title: "Approve and execute",
              "aria-label": "Approve and execute plan",
              onClick: handleApprove,
              className: "void-px-3 void-py-1.5 void-text-xs void-rounded void-bg-green-500/10 void-text-green-400 void-border void-border-green-500/20 hover:void-bg-green-500/20 void-transition-colors focus:void-outline-none focus:void-ring-2 focus:void-ring-green-500/40",
              children: "Approve & Execute"
            }
          )
        ] }),
        approvalState === "executing" && isBusy && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "button",
          {
            "aria-label": "Pause plan execution",
            onClick: () => chatThreadService.pauseAgentExecution({ threadId }),
            className: "void-px-3 void-py-1.5 void-text-xs void-rounded void-bg-orange-500/10 void-text-orange-400 void-border void-border-orange-500/20 hover:void-bg-orange-500/20 void-transition-colors focus:void-outline-none focus:void-ring-2 focus:void-ring-orange-500/40",
            children: "Pause"
          }
        ),
        hasPausedSteps && !isBusy && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "button",
          {
            "aria-label": "Resume plan execution",
            onClick: () => chatThreadService.resumeAgentExecution({ threadId }),
            className: "void-px-3 void-py-1.5 void-text-xs void-rounded void-bg-green-500/10 void-text-green-400 void-border void-border-green-500/20 hover:void-bg-green-500/20 void-transition-colors focus:void-outline-none focus:void-ring-2 focus:void-ring-green-500/40",
            children: "Resume"
          }
        )
      ] })
    ] }) }),
    !isCollapsed && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-py-2", children: message.steps.map((step, idx) => {
      const isExpanded = expandedSteps.has(step.stepNumber);
      const isDisabled = step.disabled;
      const status = step.status || "queued";
      const hasDetails = step.tools || step.files || step.error || step.toolCalls;
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
        "div",
        {
          className: `void-flex void-items-start void-gap-3 void-px-4 void-py-2.5 hover:void-bg-void-bg-2/30 void-transition-colors ${isDisabled ? "void-opacity-50" : ""} ${status === "failed" ? "void-bg-red-500/5" : ""}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-flex-shrink-0 void-mt-0.5", children: getCheckmarkIcon(status, isDisabled) }),
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex-1 void-min-w-0", children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-start void-justify-between void-gap-3", children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: `void-text-void-fg-1 void-text-sm void-flex-1 void-leading-relaxed ${isDisabled ? "void-line-through void-text-void-fg-3" : ""} ${status === "succeeded" ? "void-text-void-fg-2" : ""}`, children: step.description }),
                getStatusBadge(status)
              ] }),
              (approvalState === "pending" || approvalState === "executing" && status === "failed") && !isCheckpointGhost && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-2 void-mt-2", children: [
                approvalState === "pending" && !isRunning && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                  "button",
                  {
                    "aria-label": `${isDisabled ? "Enable" : "Disable"} step ${step.stepNumber}`,
                    onClick: () => handleToggleStep(step.stepNumber),
                    className: "void-px-2 void-py-0.5 void-text-xs void-rounded void-bg-void-bg-2 void-text-void-fg-2 hover:void-bg-void-bg-2/80 void-border void-border-void-border-1 void-transition-colors",
                    children: isDisabled ? "Enable" : "Disable"
                  }
                ),
                approvalState === "executing" && status === "failed" && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                    "button",
                    {
                      "aria-label": `Retry step ${step.stepNumber}`,
                      onClick: () => chatThreadService.retryStep({ threadId, messageIdx, stepNumber: step.stepNumber }),
                      className: "void-px-2 void-py-0.5 void-text-xs void-rounded void-bg-green-500/10 void-text-green-400 hover:void-bg-green-500/20 void-border void-border-green-500/20 void-transition-colors",
                      children: "Retry"
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                    "button",
                    {
                      "aria-label": `Skip step ${step.stepNumber}`,
                      onClick: () => chatThreadService.skipStep({ threadId, messageIdx, stepNumber: step.stepNumber }),
                      className: "void-px-2 void-py-0.5 void-text-xs void-rounded void-bg-gray-500/10 void-text-gray-400 hover:void-bg-gray-500/20 void-border void-border-gray-500/20 void-transition-colors",
                      children: "Skip"
                    }
                  ),
                  step.checkpointIdx !== void 0 && step.checkpointIdx !== null && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                    "button",
                    {
                      "aria-label": `Rollback step ${step.stepNumber}`,
                      onClick: () => {
                        if (confirm("Rollback to the checkpoint before this step?")) chatThreadService.rollbackToStep({ threadId, messageIdx, stepNumber: step.stepNumber });
                      },
                      className: "void-px-2 void-py-0.5 void-text-xs void-rounded void-bg-orange-500/10 void-text-orange-400 hover:void-bg-orange-500/20 void-border void-border-orange-500/20 void-transition-colors",
                      children: "Rollback"
                    }
                  )
                ] })
              ] }),
              hasDetails && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                "button",
                {
                  onClick: () => toggleStepExpanded(step.stepNumber),
                  className: "void-mt-2 void-flex void-items-center void-gap-1 void-text-void-fg-3 hover:void-text-void-fg-2 void-text-xs void-transition-colors",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                      ChevronRight,
                      {
                        size: 12,
                        className: `void-transition-transform ${isExpanded ? "void-rotate-90" : ""}`
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { children: [
                      isExpanded ? "Hide" : "Show",
                      " details"
                    ] })
                  ]
                }
              ),
              isExpanded && hasDetails && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-mt-3 void-space-y-3 void-pt-3 void-border-t void-border-void-border-1", children: [
                step.tools && step.tools.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-text-void-fg-3 void-text-xs void-mb-2 void-font-medium", children: "Expected Tools:" }),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-flex void-flex-wrap void-gap-1.5", children: step.tools.map(
                    (tool, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-px-2 void-py-0.5 void-bg-blue-500/10 void-text-blue-400 void-text-xs void-rounded void-border void-border-blue-500/20", children: tool }, `${step.stepNumber}-tool-${tool}-${i}`)
                  ) })
                ] }),
                step.toolCalls && step.toolCalls.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-text-void-fg-3 void-text-xs void-mb-2 void-font-medium void-flex void-items-center void-gap-2", children: [
                    "Tool Calls Executed ",
                    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-inline-flex void-items-center void-justify-center void-rounded-full void-bg-void-bg-2 void-text-void-fg-3 void-text-[10px] void-px-1.5 void-py-0.5 void-border void-border-void-border-1", children: step.toolCalls.length })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-space-y-1.5", children: step.toolCalls.map((toolId, i) => {
                    const toolMsg = toolMessagesMap.get(toolId);
                    if (!toolMsg) return null;
                    const isSuccess = toolMsg.type === "success";
                    const isError = toolMsg.type === "tool_error";
                    return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: `void-p-2 void-rounded void-border void-text-xs ${isSuccess ? "void-bg-green-500/10 void-border-green-500/20" : isError ? "void-bg-red-500/10 void-border-red-500/20" : "void-bg-blue-500/10 void-border-blue-500/20"}`, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-justify-between void-mb-1", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-font-medium void-text-void-fg-1", children: toolMsg.name }),
                        isSuccess && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Check, { size: 12, className: "void-text-green-400" }),
                        isError && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(X, { size: 12, className: "void-text-red-400" })
                      ] }),
                      isError && toolMsg.result && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-mt-1 void-text-red-400 void-text-xs", children: toolMsg.result }),
                      isSuccess && toolMsg.result && typeof toolMsg.result === "object" && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("details", { className: "void-mt-1", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("summary", { className: "void-text-void-fg-3 void-cursor-pointer void-text-xs hover:void-text-void-fg-2", children: "View result" }),
                        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("pre", { className: "void-mt-1 void-p-2 void-bg-void-bg-2 void-rounded void-text-xs void-overflow-auto void-max-h-32 void-border void-border-void-border-1", children: JSON.stringify(toolMsg.result, null, 2) })
                      ] }),
                      isError && toolMsg.params && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("details", { className: "void-mt-1", children: [
                        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("summary", { className: "void-text-void-fg-3 void-cursor-pointer void-text-xs hover:void-text-void-fg-2", children: "View params" }),
                        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("pre", { className: "void-mt-1 void-p-2 void-bg-void-bg-2 void-rounded void-text-xs void-overflow-auto void-max-h-32 void-border void-border-void-border-1", children: JSON.stringify(toolMsg.params, null, 2) })
                      ] })
                    ] }, toolId);
                  }) })
                ] }),
                step.files && step.files.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-text-void-fg-3 void-text-xs void-mb-2 void-font-medium", children: "Files Affected:" }),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-flex void-flex-wrap void-gap-1.5", children: step.files.map(
                    (file, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "void-px-2 void-py-0.5 void-bg-purple-500/10 void-text-purple-400 void-text-xs void-rounded void-border void-border-purple-500/20 void-flex void-items-center void-gap-1", children: [
                      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(File, { size: 12 }),
                      file.split("/").pop()
                    ] }, i)
                  ) })
                ] }),
                step.error && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-p-2 void-bg-red-500/10 void-border void-border-red-500/20 void-rounded void-text-red-400 void-text-xs void-flex void-items-start void-gap-2", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(TriangleAlert, { size: 14, className: "void-flex-shrink-0 void-mt-0.5" }),
                  /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: step.error })
                ] }),
                step.startTime && step.endTime && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-text-void-fg-3 void-text-xs", children: [
                  "Duration: ",
                  ((step.endTime - step.startTime) / 1e3).toFixed(1),
                  "s"
                ] }),
                step.checkpointIdx !== void 0 && step.checkpointIdx !== null && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-text-void-fg-3 void-text-xs", children: [
                  "Checkpoint: #",
                  step.checkpointIdx
                ] })
              ] })
            ] })
          ]
        },
        step.stepNumber
      );
    }) })
  ] }) });
}, (prev, next) => {
  return prev.message === next.message && prev.isCheckpointGhost === next.isCheckpointGhost && prev.threadId === next.threadId && prev.messageIdx === next.messageIdx;
});
var ReviewComponent = ({ message, isCheckpointGhost }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${isCheckpointGhost ? "void-opacity-50" : ""} void-my-2`, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: `void-border void-rounded-lg void-p-4 ${message.completed ? "void-bg-green-500/10 void-border-green-500/30" : "void-bg-amber-500/10 void-border-amber-500/30"}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-justify-between void-mb-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-2", children: [
        message.completed ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Check, { className: "void-text-green-400", size: 18 }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(TriangleAlert, { className: "void-text-amber-400", size: 18 }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("h3", { className: `void-font-semibold void-text-sm ${message.completed ? "void-text-green-300" : "void-text-amber-300"}`, children: message.completed ? "Review Complete" : "Review: Issues Found" })
      ] }),
      (message.executionTime || message.stepsCompleted !== void 0) && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-text-xs void-text-void-fg-3", children: [
        message.executionTime && `${(message.executionTime / 1e3).toFixed(1)}s`,
        message.stepsCompleted !== void 0 && message.stepsTotal !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "void-ml-2", children: [
          message.stepsCompleted,
          "/",
          message.stepsTotal,
          " steps"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "void-text-void-fg-2 void-text-sm void-mb-3", children: message.summary }),
    message.filesChanged && message.filesChanged.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-mb-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("h4", { className: "void-text-void-fg-2 void-text-xs void-font-semibold void-mb-2", children: "Files Changed:" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-space-y-1", children: message.filesChanged.map(
        (file, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-2 void-text-xs", children: [
          file.changeType === "created" && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CirclePlus, { className: "void-text-green-400", size: 12 }),
          file.changeType === "modified" && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Pencil, { className: "void-text-blue-400", size: 12 }),
          file.changeType === "deleted" && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(X, { className: "void-text-red-400", size: 12 }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-2", children: file.path })
        ] }, i)
      ) })
    ] }),
    message.issues && message.issues.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-space-y-2 void-mb-3", children: message.issues.map(
      (issue, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: `void-flex void-gap-2 void-text-sm void-p-2 void-rounded ${issue.severity === "error" ? "void-bg-red-500/10 void-border void-border-red-500/20" : issue.severity === "warning" ? "void-bg-amber-500/10 void-border void-border-amber-500/20" : "void-bg-blue-500/10 void-border void-border-blue-500/20"}`, children: [
        issue.severity === "error" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(X, { className: "void-text-red-400 void-flex-shrink-0 void-mt-0.5", size: 16 }) : issue.severity === "warning" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(TriangleAlert, { className: "void-text-amber-400 void-flex-shrink-0 void-mt-0.5", size: 16 }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Info, { className: "void-text-blue-400 void-flex-shrink-0 void-mt-0.5", size: 16 }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: `${issue.severity === "error" ? "void-text-red-300" : issue.severity === "warning" ? "void-text-amber-300" : "void-text-blue-300"}`, children: issue.message }),
          issue.file && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("p", { className: "void-text-void-fg-3 void-text-xs void-mt-1 void-flex void-items-center void-gap-1", children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(File, { size: 12 }),
            issue.file
          ] })
        ] })
      ] }, i)
    ) }),
    message.nextSteps && message.nextSteps.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-mt-3 void-pt-3 void-border-t void-border-void-border-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("p", { className: "void-text-void-fg-3 void-text-xs void-mb-2 void-font-medium", children: "Recommended Next Steps:" }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("ul", { className: "void-space-y-1", children: message.nextSteps.map(
        (step, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("li", { className: "void-text-void-fg-2 void-text-xs void-flex void-items-start void-gap-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-4 void-mt-1", children: "\u2022" }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: step })
        ] }, i)
      ) })
    ] })
  ] }) });
};
var ChatBubble = import_react19.default.memo((props) => {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(_ChatBubble, { ...props }) });
}, (prev, next) => {
  return prev.chatMessage === next.chatMessage && prev.messageIdx === next.messageIdx && prev.isCommitted === next.isCommitted && prev.chatIsRunning === next.chatIsRunning && prev.currCheckpointIdx === next.currCheckpointIdx && prev.threadId === next.threadId && prev._scrollToBottom === next._scrollToBottom;
});
var _ChatBubble = import_react19.default.memo(({ threadId, chatMessage, currCheckpointIdx, isCommitted, messageIdx, chatIsRunning, _scrollToBottom }) => {
  const role = chatMessage.role;
  const isCheckpointGhost = messageIdx > (currCheckpointIdx ?? Infinity) && !chatIsRunning;
  if (role === "user") {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      UserMessageComponent,
      {
        chatMessage,
        isCheckpointGhost,
        currCheckpointIdx,
        messageIdx,
        _scrollToBottom
      }
    );
  } else if (role === "assistant") {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      AssistantMessageComponent,
      {
        chatMessage,
        isCheckpointGhost,
        messageIdx,
        isCommitted
      }
    );
  } else if (role === "tool") {
    if (chatMessage.type === "invalid_params") {
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${isCheckpointGhost ? "void-opacity-50" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(InvalidTool, { toolName: chatMessage.name, message: chatMessage.content, mcpServerName: chatMessage.mcpServerName }) });
    }
    const toolName = chatMessage.name;
    const isBuiltInTool = isABuiltinToolName(toolName);
    const ToolResultWrapper = isBuiltInTool ? builtinToolNameToComponent[toolName]?.resultWrapper : MCPToolWrapper;
    if (ToolResultWrapper)
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${isCheckpointGhost ? "void-opacity-50" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          ToolResultWrapper,
          {
            toolMessage: chatMessage,
            messageIdx,
            threadId
          }
        ) }),
        chatMessage.type === "tool_request" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${isCheckpointGhost ? "void-opacity-50 void-pointer-events-none" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ToolRequestAcceptRejectButtons, { toolName: chatMessage.name }) }) : null
      ] });
    return null;
  } else if (role === "interrupted_streaming_tool") {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `${isCheckpointGhost ? "void-opacity-50" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CanceledTool, { toolName: chatMessage.name, mcpServerName: chatMessage.mcpServerName }) });
  } else if (role === "checkpoint") {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      Checkpoint,
      {
        threadId,
        message: chatMessage,
        messageIdx,
        isCheckpointGhost,
        threadIsRunning: !!chatIsRunning
      }
    );
  } else if (role === "plan") {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      PlanComponent,
      {
        message: chatMessage,
        isCheckpointGhost,
        threadId,
        messageIdx
      }
    );
  } else if (role === "review") {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      ReviewComponent,
      {
        message: chatMessage,
        isCheckpointGhost
      }
    );
  }
}, (prev, next) => {
  return prev.chatMessage === next.chatMessage && prev.messageIdx === next.messageIdx && prev.isCommitted === next.isCommitted && prev.chatIsRunning === next.chatIsRunning && prev.currCheckpointIdx === next.currCheckpointIdx && prev.threadId === next.threadId && prev._scrollToBottom === next._scrollToBottom;
});
var CommandBarInChat = () => {
  const { stateOfURI: commandBarStateOfURI, sortedURIs: sortedCommandBarURIs } = useCommandBarState();
  const numFilesChanged = sortedCommandBarURIs.length;
  const accessor = useAccessor();
  const editCodeService = accessor.get("IEditCodeService");
  accessor.get("ICommandService");
  const chatThreadsState = useChatThreadsState();
  const commandBarState = useCommandBarState();
  const chatThreadsStreamState = useChatThreadsStreamState(chatThreadsState.currentThreadId);
  const [fileDetailsOpenedState, setFileDetailsOpenedState] = (0, import_react19.useState)("auto-closed");
  const isFileDetailsOpened = fileDetailsOpenedState === "auto-opened" || fileDetailsOpenedState === "user-opened";
  (0, import_react19.useEffect)(() => {
    if (numFilesChanged === 0) {
      setFileDetailsOpenedState("auto-closed");
    }
    if (numFilesChanged > 0 && fileDetailsOpenedState !== "user-closed") {
      setFileDetailsOpenedState("auto-opened");
    }
  }, [fileDetailsOpenedState, setFileDetailsOpenedState, numFilesChanged]);
  const isFinishedMakingThreadChanges = (
    // there are changed files
    commandBarState.sortedURIs.length !== 0 && commandBarState.sortedURIs.every((uri) => !commandBarState.stateOfURI[uri.fsPath]?.isStreaming)
  );
  const threadStatus = chatThreadsStreamState?.isRunning === "awaiting_user" ? { title: "Needs Approval", color: "yellow" } : chatThreadsStreamState?.isRunning === "LLM" || chatThreadsStreamState?.isRunning === "tool" || chatThreadsStreamState?.isRunning === "preparing" ? { title: chatThreadsStreamState?.isRunning === "preparing" ? "Preparing" : "Running", color: "orange" } : { title: "Done", color: "dark" };
  const threadStatusHTML = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(StatusIndicator, { className: "void-mx-1", indicatorColor: threadStatus.color, title: threadStatus.title });
  const numFilesChangedStr = numFilesChanged === 0 ? "No files with changes" : `${sortedCommandBarURIs.length} file${numFilesChanged === 1 ? "" : "s"} with changes`;
  const acceptRejectAllButtons = /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
    "div",
    {
      className: `void-flex void-items-center void-gap-0.5 ${isFinishedMakingThreadChanges ? "" : "void-opacity-0 void-pointer-events-none"}`,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          IconShell1,
          {
            Icon: X,
            onClick: () => {
              sortedCommandBarURIs.forEach((uri) => {
                editCodeService.acceptOrRejectAllDiffAreas({
                  uri,
                  removeCtrlKs: true,
                  behavior: "reject",
                  _addToHistory: true
                });
              });
            },
            "data-tooltip-id": "void-tooltip",
            "data-tooltip-place": "top",
            "data-tooltip-content": "Reject all"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          IconShell1,
          {
            Icon: Check,
            onClick: () => {
              sortedCommandBarURIs.forEach((uri) => {
                editCodeService.acceptOrRejectAllDiffAreas({
                  uri,
                  removeCtrlKs: true,
                  behavior: "accept",
                  _addToHistory: true
                });
              });
            },
            "data-tooltip-id": "void-tooltip",
            "data-tooltip-place": "top",
            "data-tooltip-content": "Accept all"
          }
        )
      ]
    }
  );
  const fileDetailsContent = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-px-2 void-gap-1 void-w-full void-overflow-y-auto", children: sortedCommandBarURIs.map((uri, i) => {
    const basename = getBasename(uri.fsPath);
    const { sortedDiffIds, isStreaming } = commandBarStateOfURI[uri.fsPath] ?? {};
    const isFinishedMakingFileChanges = !isStreaming;
    const numDiffs = sortedDiffIds?.length || 0;
    const fileStatus = isFinishedMakingFileChanges ? { title: "Done", color: "dark" } : { title: "Running", color: "orange" };
    const fileNameHTML = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "div",
      {
        className: "void-flex void-items-center void-gap-1.5 void-text-void-fg-3 hover:void-brightness-125 void-transition-all void-duration-200 void-cursor-pointer",
        onClick: () => voidOpenFileFn(uri, accessor),
        children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-3", children: basename })
      }
    );
    const detailsContent = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-flex void-px-4", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "void-text-void-fg-3 void-opacity-80", children: [
      numDiffs,
      " diff",
      numDiffs !== 1 ? "s" : ""
    ] }) });
    const acceptRejectButtons = /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
      "div",
      {
        className: `void-flex void-items-center void-gap-0.5 ${isFinishedMakingFileChanges ? "" : "void-opacity-0 void-pointer-events-none"} `,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            IconShell1,
            {
              Icon: X,
              onClick: () => {
                editCodeService.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: true, behavior: "reject", _addToHistory: true });
              },
              "data-tooltip-id": "void-tooltip",
              "data-tooltip-place": "top",
              "data-tooltip-content": "Reject file"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            IconShell1,
            {
              Icon: Check,
              onClick: () => {
                editCodeService.acceptOrRejectAllDiffAreas({ uri, removeCtrlKs: true, behavior: "accept", _addToHistory: true });
              },
              "data-tooltip-id": "void-tooltip",
              "data-tooltip-place": "top",
              "data-tooltip-content": "Accept file"
            }
          )
        ]
      }
    );
    const fileStatusHTML = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(StatusIndicator, { className: "void-mx-1", indicatorColor: fileStatus.color, title: fileStatus.title });
    return (
      // name, details
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-justify-between void-items-center", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center", children: [
          fileNameHTML,
          detailsContent
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-items-center void-gap-2", children: [
          acceptRejectButtons,
          fileStatusHTML
        ] })
      ] }, i)
    );
  }) });
  const fileDetailsButton = /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
    "button",
    {
      className: `void-flex void-items-center void-gap-1 void-rounded ${numFilesChanged === 0 ? "void-cursor-pointer" : "void-cursor-pointer hover:void-brightness-125 void-transition-all void-duration-200"}`,
      onClick: () => isFileDetailsOpened ? setFileDetailsOpenedState("user-closed") : setFileDetailsOpenedState("user-opened"),
      type: "button",
      disabled: numFilesChanged === 0,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "svg",
          {
            className: "void-transition-transform void-duration-200 void-size-3.5",
            style: {
              transform: isFileDetailsOpened ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)"
            },
            xmlns: "http://www.w3.org/2000/svg",
            width: "16",
            height: "16",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("polyline", { points: "18 15 12 9 6 15" })
          }
        ),
        numFilesChangedStr
      ]
    }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-px-2", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "div",
      {
        className: ` void-select-none void-flex void-w-full void-rounded-t-lg void-bg-void-bg-3 void-text-void-fg-3 void-text-xs void-text-nowrap void-overflow-hidden void-transition-all void-duration-200 void-ease-in-out ${isFileDetailsOpened ? "void-max-h-24" : "void-max-h-0"} `,
        children: fileDetailsContent
      }
    ) }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
      "div",
      {
        className: ` void-select-none void-flex void-w-full void-rounded-t-lg void-bg-void-bg-3 void-text-void-fg-3 void-text-xs void-text-nowrap void-border-t void-border-l void-border-r void-border-zinc-300/10 void-px-2 void-py-1 void-justify-between `,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-flex void-gap-2 void-items-center", children: fileDetailsButton }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-flex void-gap-2 void-items-center", children: [
            acceptRejectAllButtons,
            threadStatusHTML
          ] })
        ]
      }
    )
  ] });
};
var EditToolSoFar = ({ toolCallSoFar }) => {
  if (!isABuiltinToolName(toolCallSoFar.name)) return null;
  const accessor = useAccessor();
  const uri = toolCallSoFar.rawParams.uri ? URI.file(toolCallSoFar.rawParams.uri) : void 0;
  const title = titleOfBuiltinToolName[toolCallSoFar.name].proposed;
  const uriDone = toolCallSoFar.doneParams.includes("uri");
  const desc1 = /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "void-flex void-items-center", children: [
    uriDone ? getBasename(toolCallSoFar.rawParams["uri"] ?? "unknown") : `Generating`,
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconLoading, {})
  ] });
  const desc1OnClick = () => {
    uri && voidOpenFileFn(uri, accessor);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
    ToolHeaderWrapper,
    {
      title,
      desc1,
      desc1OnClick,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          EditToolChildren,
          {
            uri,
            code: toolCallSoFar.rawParams.search_replace_blocks ?? toolCallSoFar.rawParams.new_content ?? "",
            type: "rewrite"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(IconLoading, {})
      ]
    }
  );
};
var SidebarChat = () => {
  const textAreaRef = (0, import_react19.useRef)(null);
  const textAreaFnsRef = (0, import_react19.useRef)(null);
  const accessor = useAccessor();
  const commandService = accessor.get("ICommandService");
  const chatThreadsService = accessor.get("IChatThreadService");
  const settingsState = useSettingsState();
  const chatThreadsState = useChatThreadsState();
  const currentThread = chatThreadsService.getCurrentThread();
  const previousMessages = currentThread?.messages ?? [];
  const selections = currentThread.state.stagingSelections;
  const setSelections = (s) => {
    chatThreadsService.setCurrentThreadState({ stagingSelections: s });
  };
  const currThreadStreamState = useChatThreadsStreamState(chatThreadsState.currentThreadId);
  const isRunning = currThreadStreamState?.isRunning;
  const latestError = currThreadStreamState?.error;
  const { displayContentSoFar, toolCallSoFar, reasoningSoFar } = currThreadStreamState?.llmInfo ?? {};
  const toolIsGenerating = toolCallSoFar && !toolCallSoFar.isDone;
  const [instructionsAreEmpty, setInstructionsAreEmpty] = (0, import_react19.useState)(true);
  const {
    attachments: imageAttachments,
    addImages: addImagesRaw,
    removeImage,
    retryImage,
    cancelImage,
    clearAll: clearImages,
    focusedIndex: focusedImageIndex,
    setFocusedIndex: setFocusedImageIndex,
    validationError: imageValidationError
  } = useImageAttachments();
  const {
    attachments: pdfAttachments,
    addPDFs: addPDFsRaw,
    removePDF,
    retryPDF,
    cancelPDF,
    clearAll: clearPDFs,
    focusedIndex: focusedPDFIndex,
    setFocusedIndex: setFocusedPDFIndex,
    validationError: pdfValidationError
  } = usePDFAttachments();
  const addPDFs = (0, import_react19.useCallback)(async (files) => {
    const currentModelSel = settingsState.modelSelectionOfFeature["Chat"];
    if (currentModelSel?.providerName === "auto" && currentModelSel?.modelName === "auto") {
      await addPDFsRaw(files);
      return;
    }
    await addPDFsRaw(files);
  }, [addPDFsRaw, settingsState]);
  const addImages = (0, import_react19.useCallback)(async (files) => {
    const currentModelSel = settingsState.modelSelectionOfFeature["Chat"];
    if (currentModelSel?.providerName === "auto" && currentModelSel?.modelName === "auto") {
      await addImagesRaw(files);
      return;
    }
    const { isSelectedModelVisionCapable, checkOllamaModelVisionCapable, hasVisionCapableApiKey, hasOllamaVisionModel, isOllamaAccessible } = await import('./visionModelHelper-N2YMBODM.js');
    let selectedIsVision = isSelectedModelVisionCapable(currentModelSel, settingsState.settingsOfProvider);
    if (!selectedIsVision && currentModelSel?.providerName === "ollama") {
      const ollamaAccessible2 = await isOllamaAccessible();
      if (ollamaAccessible2) {
        selectedIsVision = await checkOllamaModelVisionCapable(currentModelSel.modelName);
      }
    }
    if (selectedIsVision) {
      await addImagesRaw(files);
      return;
    }
    const hasApiKey = hasVisionCapableApiKey(settingsState.settingsOfProvider, currentModelSel);
    const ollamaAccessible = await isOllamaAccessible();
    const hasOllamaVision = ollamaAccessible && await hasOllamaVisionModel();
    if (!hasApiKey && !hasOllamaVision) {
      const notificationService2 = accessor.get("INotificationService");
      const commandService2 = accessor.get("ICommandService");
      notificationService2.notify({
        severity: 2,
        // Severity.Warning
        message: "No vision-capable models available. Please set up an API key (Anthropic, OpenAI, or Gemini) or install an Ollama vision model (e.g., llava, bakllava).",
        actions: {
          primary: [{
            id: "void.vision.setup",
            label: "Setup Ollama Vision Models",
            tooltip: "",
            class: void 0,
            enabled: true,
            run: () => commandService2.executeCommand(CORTEXIDE_OPEN_SETTINGS_ACTION_ID)
          }]
        }
      });
      return;
    }
    await addImagesRaw(files);
  }, [addImagesRaw, settingsState, accessor]);
  const isDisabled = instructionsAreEmpty && imageAttachments.length === 0 && pdfAttachments.length === 0 || !!isFeatureNameDisabled$1("Chat", settingsState);
  const sidebarRef = (0, import_react19.useRef)(null);
  const scrollContainerRef = (0, import_react19.useRef)(null);
  const scrollToBottomCallback = (0, import_react19.useCallback)(() => {
    scrollToBottom(scrollContainerRef);
  }, [scrollContainerRef]);
  const onSubmit = (0, import_react19.useCallback)(async (_forceSubmit) => {
    if (isDisabled && !_forceSubmit) return;
    if (isRunning) return;
    const threadId2 = currentThread.id;
    const userMessage = _forceSubmit || textAreaRef.current?.value || "";
    try {
      const toolsService = accessor.get("IToolsService");
      const workspaceService = accessor.get("IWorkspaceContextService");
      const editorService = accessor.get("IEditorService");
      const languageService = accessor.get("ILanguageService");
      const historyService = accessor.get("IHistoryService");
      const notificationService2 = accessor.get("INotificationService");
      let outlineService = void 0;
      try {
        outlineService = accessor.get("IOutlineModelService");
      } catch {
      }
      const existing = /* @__PURE__ */ new Set();
      const existingSelections = chatThreadsState.allThreads[currentThread.id]?.state?.stagingSelections || [];
      for (const s of existingSelections) existing.add(s.uri?.fsPath || "");
      const addFileSelection = async (uri) => {
        if (!uri) return;
        const key = uri.fsPath || uri.path || "";
        if (key && existing.has(key)) return;
        existing.add(key);
        const newSel = {
          type: "File",
          uri,
          language: languageService.guessLanguageIdByFilepathOrFirstLine(uri) || "",
          state: { wasAddedAsCurrentFile: false }
        };
        await chatThreadsService.addNewStagingSelection(newSel);
      };
      const addFolderSelection = async (uri) => {
        if (!uri) return;
        const key = uri.fsPath || uri.path || "";
        if (key && existing.has(key)) return;
        existing.add(key);
        const newSel = {
          type: "Folder",
          uri,
          language: void 0,
          state: void 0
        };
        await chatThreadsService.addNewStagingSelection(newSel);
      };
      const tokens = [];
      {
        const quoted = [...userMessage.matchAll(/@"([^"]+)"/g)].map((m) => m[1]);
        tokens.push(...quoted);
        for (const m of userMessage.matchAll(/@([\w\.\-_/]+(?::\d+(?:-\d+)?)?)/g)) {
          const t = m[1];
          if (t) tokens.push(t);
        }
      }
      const special = /* @__PURE__ */ new Set(["selection", "workspace", "recent", "folder"]);
      const unresolvedRefs = [];
      for (const raw of tokens) {
        if (raw === "selection") {
          const active = editorService.activeTextEditorControl;
          const activeResource = editorService.activeEditor?.resource;
          const sel = active?.getSelection?.();
          if (activeResource && sel && !sel.isEmpty()) {
            const newSel = {
              type: "File",
              uri: activeResource,
              language: languageService.guessLanguageIdByFilepathOrFirstLine(activeResource) || "",
              state: { wasAddedAsCurrentFile: false },
              range: sel
            };
            const key = activeResource.fsPath || "";
            if (!existing.has(key)) {
              existing.add(key);
              await chatThreadsService.addNewStagingSelection(newSel);
            }
          } else {
            unresolvedRefs.push("@selection (no active selection)");
          }
          continue;
        }
        if (raw === "workspace") {
          for (const folder of workspaceService.getWorkspace().folders) {
            await addFolderSelection(folder.uri);
          }
          continue;
        }
        if (raw === "recent") {
          for (const h of historyService.getHistory()) {
            if (h.resource) await addFileSelection(h.resource);
          }
          continue;
        }
        if (raw.startsWith("sym:") || raw.startsWith("symbol:")) {
          const symName = raw.replace(/^symbol?:/, "");
          let symbolFound = false;
          if (outlineService && typeof outlineService.getCachedModels === "function") {
            try {
              const models = outlineService.getCachedModels();
              for (const om of models) {
                const list2 = typeof om.asListOfDocumentSymbols === "function" ? om.asListOfDocumentSymbols() : [];
                for (const s of list2) {
                  if ((s?.name || "").toLowerCase() === symName.toLowerCase()) {
                    symbolFound = true;
                    const uri = om.uri;
                    const range = s.range;
                    const key = uri?.fsPath || "";
                    if (!existing.has(key)) {
                      existing.add(key);
                      await chatThreadsService.addNewStagingSelection({
                        type: "File",
                        uri,
                        language: languageService.guessLanguageIdByFilepathOrFirstLine(uri) || "",
                        state: { wasAddedAsCurrentFile: false },
                        range
                      });
                    }
                  }
                }
              }
            } catch (err) {
              console.warn("Error resolving symbol:", err);
            }
          }
          if (!symbolFound) {
            unresolvedRefs.push(`@${raw} (symbol not found)`);
          }
          continue;
        }
        let query = raw;
        let isFolderHint = false;
        if (raw.startsWith("folder:")) {
          isFolderHint = true;
          query = raw.slice("folder:".length);
        }
        let resolved = false;
        try {
          const res = await (await toolsService.callTool.search_pathnames_only({ query, includePattern: null, pageNumber: 1 })).result;
          const [first] = res.uris || [];
          if (first) {
            resolved = true;
            if (isFolderHint) await addFolderSelection(first);
            else
              await addFileSelection(first);
          }
        } catch (err) {
          console.warn("Error resolving reference:", err);
        }
        if (!resolved) {
          unresolvedRefs.push(`@${raw}`);
        }
      }
      if (unresolvedRefs.length > 0) {
        const refList = unresolvedRefs.slice(0, 3).join(", ");
        const moreText = unresolvedRefs.length > 3 ? ` and ${unresolvedRefs.length - 3} more` : "";
        notificationService2.warn(`Could not resolve reference${unresolvedRefs.length > 1 ? "s" : ""}: ${refList}${moreText}. Please check the file path or symbol name.`);
      }
    } catch (err) {
      console.warn("Error resolving @references:", err);
    }
    const images = imageAttachments.filter((att) => att.uploadStatus === "success" || !att.uploadStatus).map((att) => ({
      id: att.id,
      data: att.data,
      mimeType: att.mimeType,
      filename: att.filename,
      width: att.width,
      height: att.height,
      size: att.size
    }));
    const processingPDFs = pdfAttachments.filter(
      (att) => att.uploadStatus === "uploading" || att.uploadStatus === "processing"
    );
    if (processingPDFs.length > 0) {
      const processingNames = processingPDFs.map((p) => p.filename).join(", ");
      notificationService.warn(`Some PDFs are still processing: ${processingNames}. They will be sent but may not have extracted text available yet.`);
    }
    const pdfs = pdfAttachments.filter((att) => att.uploadStatus !== "failed").map((att) => ({
      id: att.id,
      data: att.data,
      filename: att.filename,
      size: att.size,
      pageCount: att.pageCount,
      selectedPages: att.selectedPages,
      extractedText: att.extractedText,
      pagePreviews: att.pagePreviews
    }));
    const currentModelSel = settingsState.modelSelectionOfFeature["Chat"];
    if ((images.length > 0 || pdfs.length > 0) && currentModelSel) {
      const { isSelectedModelVisionCapable, checkOllamaModelVisionCapable, hasVisionCapableApiKey, hasOllamaVisionModel, isOllamaAccessible } = await import('./visionModelHelper-N2YMBODM.js');
      if (currentModelSel.providerName === "auto" && currentModelSel.modelName === "auto") {
        if (images.length > 0) {
          const hasApiKey = hasVisionCapableApiKey(settingsState.settingsOfProvider, currentModelSel);
          const ollamaAccessible = await isOllamaAccessible();
          const hasOllamaVision = ollamaAccessible && await hasOllamaVisionModel();
          if (!hasApiKey && !hasOllamaVision) {
            notificationService.error("No vision-capable models available. Please set up an API key (Anthropic, OpenAI, or Gemini) or install an Ollama vision model (e.g., llava, bakllava) to use images.");
            return;
          }
        }
      } else {
        let isVisionCapable = isSelectedModelVisionCapable(currentModelSel, settingsState.settingsOfProvider);
        if (!isVisionCapable && currentModelSel.providerName === "ollama") {
          const ollamaAccessible = await isOllamaAccessible();
          if (ollamaAccessible) {
            isVisionCapable = await checkOllamaModelVisionCapable(currentModelSel.modelName);
          }
        }
        if (!isVisionCapable) {
          const hasApiKey = hasVisionCapableApiKey(settingsState.settingsOfProvider, currentModelSel);
          const ollamaAccessible = await isOllamaAccessible();
          const hasOllamaVision = ollamaAccessible && await hasOllamaVisionModel();
          if (!hasApiKey && !hasOllamaVision) {
            notificationService.error("The selected model does not support images or PDFs. Please select a vision-capable model (e.g., Claude, GPT-4, Gemini, or an Ollama vision model like llava).");
            return;
          } else {
            notificationService.warn("The selected model may not support images or PDFs. Consider switching to a vision-capable model for better results.");
          }
        }
      }
    }
    const stagingSelections = chatThreadsState.allThreads[currentThread.id]?.state?.stagingSelections || [];
    setSelections([]);
    if (textAreaFnsRef.current) {
      textAreaFnsRef.current.setValue("");
    }
    clearImages();
    clearPDFs();
    textAreaRef.current?.focus();
    try {
      await chatThreadsService.addUserMessageAndStreamResponse({ userMessage, threadId: threadId2, images, pdfs, _chatSelections: stagingSelections });
    } catch (e) {
      console.error("Error while sending message in chat:", e);
    }
  }, [chatThreadsService, isDisabled, isRunning, textAreaRef, textAreaFnsRef, setSelections, settingsState, imageAttachments, pdfAttachments, clearImages, clearPDFs, currentThread.id]);
  const onAbort = async () => {
    const threadId2 = currentThread.id;
    await chatThreadsService.abortRunning(threadId2);
  };
  accessor.get("IKeybindingService").lookupKeybinding(CORTEXIDE_CTRL_L_ACTION_ID)?.getLabel();
  const threadId = currentThread.id;
  const currCheckpointIdx = chatThreadsState.allThreads[threadId]?.state?.currCheckpointIdx ?? void 0;
  const mountedInfo = chatThreadsState.allThreads[threadId]?.state.mountedInfo;
  const isResolved = mountedInfo?.mountedIsResolvedRef.current;
  (0, import_react19.useEffect)(() => {
    if (isResolved) return;
    mountedInfo?._whenMountedResolver?.({
      textAreaRef,
      scrollToBottom: scrollToBottomCallback
    });
  }, [threadId, textAreaRef, scrollContainerRef, isResolved, mountedInfo, scrollToBottomCallback]);
  const previousMessagesHTML = (0, import_react19.useMemo)(() => {
    return previousMessages.map((message, i) => {
      const messageKey = message.id || `msg-${i}`;
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        ChatBubble,
        {
          currCheckpointIdx,
          chatMessage: message,
          messageIdx: i,
          isCommitted: true,
          chatIsRunning: isRunning,
          threadId,
          _scrollToBottom: scrollToBottomCallback
        },
        messageKey
      );
    });
  }, [previousMessages, threadId, currCheckpointIdx, isRunning, scrollToBottomCallback]);
  const streamingChatIdx = previousMessagesHTML.length;
  const streamingChatMessage = (0, import_react19.useMemo)(() => ({
    role: "assistant",
    displayContent: displayContentSoFar ?? "",
    reasoning: reasoningSoFar ?? "",
    anthropicReasoning: null
  }), [displayContentSoFar, reasoningSoFar]);
  const isActivelyStreaming = isRunning === "LLM" || isRunning === "preparing";
  const currStreamingMessageHTML = isActivelyStreaming && (reasoningSoFar || displayContentSoFar) ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    ChatBubble,
    {
      currCheckpointIdx,
      chatMessage: streamingChatMessage,
      messageIdx: streamingChatIdx,
      isCommitted: false,
      chatIsRunning: isRunning,
      threadId,
      _scrollToBottom: null
    },
    "curr-streaming-msg"
  ) : null;
  const generatingTool = toolIsGenerating ? toolCallSoFar.name === "edit_file" || toolCallSoFar.name === "rewrite_file" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    EditToolSoFar,
    {
      toolCallSoFar
    },
    "curr-streaming-tool"
  ) : null : null;
  const messagesHTML = /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
    ScrollToBottomContainer,
    {
      scrollContainerRef,
      className: ` void-flex void-flex-col void-px-3 void-py-3 void-space-y-3 void-w-full void-h-full void-overflow-x-hidden void-overflow-y-auto ${previousMessagesHTML.length === 0 && !displayContentSoFar ? "void-hidden" : ""} `,
      children: [
        previousMessagesHTML,
        currStreamingMessageHTML,
        generatingTool,
        isRunning === "LLM" || isRunning === "preparing" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ProseWrapper, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          IconLoading,
          {
            className: "void-opacity-50 void-text-sm",
            showTokenCount: (
              // Only show token count when actively streaming (LLM)
              // When isRunning is 'idle' or undefined, the message is complete and token count should stop
              displayContentSoFar && isRunning === "LLM" ? Math.ceil(displayContentSoFar.length / 4) : void 0
            )
          }
        ) }) : null,
        latestError === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-px-2 void-my-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            ErrorDisplay,
            {
              message: latestError.message,
              fullError: latestError.fullError,
              onDismiss: () => {
                chatThreadsService.dismissStreamError(currentThread.id);
              },
              showDismiss: true
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(WarningBox, { className: "void-text-sm void-my-1 void-mx-3", onClick: () => {
            commandService.executeCommand(CORTEXIDE_OPEN_SETTINGS_ACTION_ID);
          }, text: "Open settings" })
        ] })
      ]
    },
    "messages" + chatThreadsState.currentThreadId
  );
  const onChangeText = (0, import_react19.useCallback)((newStr) => {
    setInstructionsAreEmpty(!newStr);
  }, [setInstructionsAreEmpty]);
  const onKeyDown = (0, import_react19.useCallback)((e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      onSubmit();
    } else if (e.key === "Escape" && isRunning) {
      onAbort();
    }
  }, [onSubmit, onAbort, isRunning]);
  const [ctxWarned, setCtxWarned] = (0, import_react19.useState)(false);
  const estimateTokens = (0, import_react19.useCallback)((s) => Math.ceil((s || "").length / 4), []);
  const modelSel = settingsState.modelSelectionOfFeature["Chat"];
  const { contextBudget, messagesTokens } = (0, import_react19.useMemo)(() => {
    let budget = 0;
    let tokens = 0;
    if (modelSel && isValidProviderModelSelection(modelSel)) {
      const { providerName, modelName } = modelSel;
      const caps = getModelCapabilities(providerName, modelName, settingsState.overridesOfModel);
      const contextWindow = caps.contextWindow;
      const msOpts = settingsState.optionsOfModelSelection["Chat"][providerName]?.[modelName];
      const isReasoningEnabled2 = getIsReasoningEnabledState("Chat", providerName, modelName, msOpts, settingsState.overridesOfModel);
      const rot = getReservedOutputTokenSpace(providerName, modelName, { isReasoningEnabled: isReasoningEnabled2, overridesOfModel: settingsState.overridesOfModel }) || 0;
      budget = Math.max(256, Math.floor(contextWindow * 0.8) - rot);
      tokens = previousMessages.reduce((acc, m) => {
        if (m.role === "user") return acc + estimateTokens(m.content || "");
        if (m.role === "assistant") return acc + estimateTokens(m.displayContent || m.content || "" || "");
        return acc;
      }, 0);
    }
    return { contextBudget: budget, messagesTokens: tokens };
  }, [modelSel, previousMessages, settingsState.overridesOfModel, estimateTokens]);
  const draftTokens = estimateTokens(textAreaRef.current?.value || "");
  const contextTotal = messagesTokens + draftTokens;
  const contextPct = contextBudget > 0 ? contextTotal / contextBudget : 0;
  (0, import_react19.useEffect)(() => {
    if (contextPct > 0.8 && contextPct < 1 && !ctxWarned) {
      try {
        accessor.get("INotificationService").info(`Context nearing limit: ~${contextTotal} / ${contextBudget} tokens. Older messages may be summarized.`);
      } catch {
      }
      setCtxWarned(true);
    }
    if (contextPct < 0.6 && ctxWarned) setCtxWarned(false);
  }, [contextPct, ctxWarned, contextTotal, contextBudget, accessor]);
  const inputChatArea = /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
    VoidChatArea,
    {
      featureName: "Chat",
      onSubmit: () => onSubmit(),
      onAbort,
      isStreaming: !!isRunning,
      isDisabled,
      showSelections: true,
      selections,
      setSelections,
      onClickAnywhere: () => {
        textAreaRef.current?.focus();
      },
      imageAttachments: imageAttachments.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          ImageAttachmentList,
          {
            attachments: imageAttachments,
            onRemove: removeImage,
            onRetry: retryImage,
            onCancel: cancelImage,
            focusedIndex: focusedImageIndex,
            onFocusChange: setFocusedImageIndex
          }
        ),
        imageValidationError && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-px-2 void-py-1 void-text-xs void-text-red-500 void-bg-red-500/10 void-border void-border-red-500/20 void-rounded-md void-mx-2", children: imageValidationError.message })
      ] }) : null,
      onImagePaste: addImages,
      onImageDrop: addImages,
      onPDFDrop: addPDFs,
      pdfAttachments: pdfAttachments.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          PDFAttachmentList,
          {
            attachments: pdfAttachments,
            onRemove: removePDF,
            onRetry: retryPDF,
            onCancel: cancelPDF,
            focusedIndex: focusedPDFIndex,
            onFocusChange: setFocusedPDFIndex
          }
        ),
        pdfValidationError && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-px-2 void-py-1 void-text-xs void-text-red-500 void-bg-red-500/10 void-border void-border-red-500/20 void-rounded-md void-mx-2", children: pdfValidationError })
      ] }) : null,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          VoidInputBox2,
          {
            enableAtToMention: true,
            appearance: "chatDark",
            className: `void-min-h-[60px] void-px-3 void-py-3 void-rounded-2xl`,
            placeholder: "Plan, @ for context",
            onChangeText,
            onKeyDown,
            onFocus: () => {
              chatThreadsService.setCurrentlyFocusedMessageIdx(void 0);
            },
            ref: textAreaRef,
            fnsRef: textAreaFnsRef,
            multiline: true
          }
        ),
        selections.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-mt-1 void-flex void-flex-wrap void-gap-1 void-px-1", children: selections.map((sel, idx) => {
          const name = sel.type === "Folder" ? sel.uri?.path?.split("/").filter(Boolean).pop() || "folder" : sel.uri?.path?.split("/").pop() || "file";
          const fullPath = sel.uri?.fsPath || sel.uri?.path || name;
          const rangeLabel = sel.range ? ` \u2022 ${sel.range.startLineNumber}-${sel.range.endLineNumber}` : "";
          const tooltipText = sel.range ? `${fullPath} (lines ${sel.range.startLineNumber}-${sel.range.endLineNumber})` : fullPath;
          return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
            "span",
            {
              className: "void-inline-flex void-items-center void-gap-1 void-px-2 void-py-0.5 void-rounded void-border void-border-void-border-3 void-bg-void-bg-1 void-text-void-fg-2 void-text-[11px]",
              title: tooltipText,
              "aria-label": tooltipText,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-opacity-80", children: sel.type === "Folder" ? "Folder" : "File" }),
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-1", children: name }),
                rangeLabel && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-opacity-70", children: rangeLabel }),
                /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
                  "button",
                  {
                    className: "void-ml-1 void-text-void-fg-3 hover:void-text-void-fg-1",
                    onClick: () => {
                      chatThreadsService.popStagingSelections(1);
                    },
                    "aria-label": `Remove ${name}`,
                    children: "\xD7"
                  }
                )
              ]
            },
            idx
          );
        }) })
      ]
    }
  );
  const isLandingPage = previousMessages.length === 0;
  const initiallySuggestedPromptsHTML = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-flex void-flex-col void-gap-2 void-w-full void-text-nowrap void-text-void-fg-3 void-select-none", children: [
    "Summarize my codebase",
    "How do types work in Rust?",
    "Create a .voidrules file for me"
  ].map(
    (text, index3) => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "div",
      {
        className: "void-py-1 void-px-2 void-rounded void-text-sm void-bg-zinc-700/5 hover:void-bg-zinc-700/10 dark:void-bg-zinc-300/5 dark:hover:void-bg-zinc-300/10 void-cursor-pointer void-opacity-80 hover:void-opacity-100",
        onClick: () => onSubmit(text),
        children: text
      },
      index3
    )
  ) });
  const threadPageInput = /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-px-4", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(CommandBarInChat, {}) }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-px-2 void-pb-2", children: [
      inputChatArea,
      modelSel ? (() => {
        const pctNum = Math.max(0, Math.min(100, Math.round(contextPct * 100)));
        const color = contextPct >= 1 ? "text-red-500" : contextPct > 0.8 ? "text-amber-500" : "text-void-fg-3";
        const barColor = contextPct >= 1 ? "bg-red-500" : contextPct > 0.8 ? "bg-amber-500" : "bg-void-fg-3/60";
        return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-mt-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: `void-text-[10px] ${color}`, children: [
            "Context ~",
            contextTotal,
            " / ",
            contextBudget,
            " tokens (",
            pctNum,
            "%)"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-h-[3px] void-w-full void-bg-void-border-3 void-rounded void-mt-0.5", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `void-h-[3px] ${barColor} void-rounded`, style: { width: `${pctNum}%` }, "aria-label": `Context usage ${pctNum}%` }) })
        ] });
      })() : null
    ] })
  ] }, "input" + chatThreadsState.currentThreadId);
  const landingPageInput = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-pt-8", children: [
    inputChatArea,
    modelSel ? (() => {
      const pctNum = Math.max(0, Math.min(100, Math.round(contextPct * 100)));
      const color = contextPct >= 1 ? "text-red-500" : contextPct > 0.8 ? "text-amber-500" : "text-void-fg-3";
      const barColor = contextPct >= 1 ? "bg-red-500" : contextPct > 0.8 ? "bg-amber-500" : "bg-void-fg-3/60";
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-mt-1 void-px-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: `void-text-[10px] ${color}`, children: [
          "Context ~",
          contextTotal,
          " / ",
          contextBudget,
          " tokens (",
          pctNum,
          "%)"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-h-[3px] void-w-full void-bg-void-border-3 void-rounded void-mt-0.5", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: `void-h-[3px] ${barColor} void-rounded`, style: { width: `${pctNum}%` }, "aria-label": `Context usage ${pctNum}%` }) })
      ] });
    })() : null
  ] }) });
  const keybindingService = accessor.get("IKeybindingService");
  const quickActions = [
    { id: "void.explainCode", label: "Explain" },
    { id: "void.refactorCode", label: "Refactor" },
    { id: "void.addTests", label: "Add Tests" },
    { id: "void.fixTests", label: "Fix Tests" },
    { id: "void.writeDocstring", label: "Docstring" },
    { id: "void.optimizeCode", label: "Optimize" },
    { id: "void.debugCode", label: "Debug" }
  ];
  const QuickActionsBar = () => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-w-full void-flex void-items-center void-justify-center void-gap-2 void-flex-wrap void-mt-3 void-select-none void-px-1", children: quickActions.map(({ id, label }) => {
    const kb = keybindingService.lookupKeybinding(id)?.getLabel();
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
      "button",
      {
        className: "void-px-3 void-py-1.5 void-rounded-full void-bg-gradient-to-br void-from-[var(--cortex-surface-2)] void-via-[var(--cortex-surface-3)] void-to-[var(--cortex-surface-4)] void-border void-border-void-border-3 void-text-xs void-text-void-fg-1 void-shadow-[0_3px_12px_rgba(0,0,0,0.45)] hover:-void-translate-y-0.5 void-transition-all void-duration-150 void-ease-out void-void-focus-ring",
        onClick: () => commandService.executeCommand(id),
        title: kb ? `${label} (${kb})` : label,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: label }),
          kb && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-ml-1 void-px-1 void-rounded void-bg-[var(--vscode-keybindingLabel-background)] void-text-[var(--vscode-keybindingLabel-foreground)] void-border void-border-[var(--vscode-keybindingLabel-border)]", children: kb })
        ]
      },
      id
    );
  }) });
  const ContextChipsBar = () => {
    const editorService = accessor.get("IEditorService");
    const activeEditor = editorService?.activeEditor;
    const activeResource = activeEditor?.resource;
    const activeFileLabel = activeResource ? activeResource.path?.split("/").pop() : void 0;
    const modelSel2 = settingsState.modelSelectionOfFeature["Chat"];
    const modelLabel = modelSel2 ? `${modelSel2.providerName}:${modelSel2.modelName}` : void 0;
    if (!activeFileLabel && !modelLabel) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-w-full void-flex void-items-center void-gap-2 void-flex-wrap void-mt-2 void-mb-1 void-px-1", children: [
      activeFileLabel && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "void-inline-flex void-items-center void-gap-1 void-px-2 void-py-0.5 void-rounded void-border void-border-void-border-3 void-bg-void-bg-1 void-text-void-fg-2 void-text-[11px]", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "File" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-1", children: activeFileLabel })
      ] }),
      modelLabel && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: "void-inline-flex void-items-center void-gap-1 void-px-2 void-py-0.5 void-rounded void-border void-border-void-border-3 void-bg-void-bg-1 void-text-void-fg-2 void-text-[11px]", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children: "Model" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: "void-text-void-fg-1", children: modelLabel })
      ] })
    ] });
  };
  const landingPageContent = /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
    "div",
    {
      ref: sidebarRef,
      className: "void-w-full void-h-full void-max-h-full void-flex void-flex-col void-overflow-auto",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ChatTabsBar, {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: "void-px-3", children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ErrorBoundary_default, { children: landingPageInput }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ContextChipsBar, {}) }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(QuickActionsBar, {}) }),
          Object.keys(chatThreadsState.allThreads).length > 1 ? (
            // show if there are threads
            /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(ErrorBoundary_default, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-pt-6 void-mb-2 void-text-void-fg-3 void-text-root void-select-none void-pointer-events-none", children: "Previous Threads" }),
              /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(PastThreadsList, {})
            ] })
          ) : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(ErrorBoundary_default, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: "void-pt-6 void-mb-2 void-text-void-fg-3 void-text-root void-select-none void-pointer-events-none", children: "Suggestions" }),
            initiallySuggestedPromptsHTML
          ] })
        ] })
      ]
    }
  );
  const threadPageContent = /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
    "div",
    {
      ref: sidebarRef,
      className: "void-w-full void-h-full void-flex void-flex-col void-overflow-hidden",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ChatTabsBar, {}) }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ErrorBoundary_default, { children: messagesHTML }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(ErrorBoundary_default, { children: threadPageInput })
      ]
    }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    import_react19.Fragment,
    {
      children: isLandingPage ? landingPageContent : threadPageContent
    },
    threadId
  );
};

// src2/void-settings-tsx/WarningBox.tsx
var import_jsx_runtime16 = __toESM(require_jsx_runtime(), 1);
var WarningBox = ({ text, onClick, className }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(
    "div",
    {
      className: ` void-text-void-warning void-brightness-90 void-opacity-90 void-w-fit void-text-xs void-text-ellipsis ${onClick ? `hover:void-brightness-75 void-transition-all void-duration-200 void-cursor-pointer` : ""} void-flex void-items-center void-flex-nowrap ${className} `,
      onClick,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
          IconWarning,
          {
            size: 14,
            className: "void-mr-1 void-flex-shrink-0"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: text })
      ]
    }
  );
};

// src2/sidebar-tsx/ErrorBoundary.tsx
var import_jsx_runtime17 = __toESM(require_jsx_runtime(), 1);
var ErrorBoundary = class extends import_react20.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }
  static getDerivedStateFromError(error2) {
    return {
      hasError: true,
      error: error2
    };
  }
  componentDidCatch(error2, errorInfo) {
    this.setState({
      error: error2,
      errorInfo
    });
  }
  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(WarningBox, { text: this.state.error + "" });
    }
    return this.props.children;
  }
};
var ErrorBoundary_default = ErrorBoundary;
var import_jsx_runtime18 = __toESM(require_jsx_runtime(), 1);
var ButtonLeftTextRightOption = ({ text, leftButton }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-text-void-fg-3 void-px-3 void-py-0.5 void-rounded-sm void-overflow-hidden void-gap-2", children: [
    leftButton ? leftButton : null,
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { children: text })
  ] });
};
var RefreshModelButton = ({ providerName }) => {
  const refreshModelState = useRefreshModelState();
  const accessor = useAccessor();
  const refreshModelService = accessor.get("IRefreshModelService");
  const metricsService = accessor.get("IMetricsService");
  const [justFinished, setJustFinished] = (0, import_react21.useState)(null);
  useRefreshModelListener(
    (0, import_react21.useCallback)((providerName2, refreshModelState2) => {
      if (providerName2 !== providerName) return;
      const { state: state2 } = refreshModelState2[providerName];
      if (!(state2 === "finished" || state2 === "error")) return;
      setJustFinished(state2);
      const tid = setTimeout(() => {
        setJustFinished(null);
      }, 2e3);
      return () => clearTimeout(tid);
    }, [providerName])
  );
  const { state } = refreshModelState[providerName];
  const { title: providerTitle } = displayInfoOfProviderName(providerName);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
    ButtonLeftTextRightOption,
    {
      leftButton: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        "button",
        {
          className: "void-flex void-items-center",
          disabled: state === "refreshing" || justFinished !== null,
          onClick: () => {
            refreshModelService.startRefreshingModels(providerName, { enableProviderOnSuccess: false, doNotFire: false });
            metricsService.capture("Click", { providerName, action: "Refresh Models" });
          },
          children: justFinished === "finished" ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Check, { className: "void-stroke-green-500 void-size-3" }) : justFinished === "error" ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(X, { className: "void-stroke-red-500 void-size-3" }) : state === "refreshing" ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(LoaderCircle, { className: "void-size-3 void-animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(RefreshCw, { className: "void-size-3" })
        }
      ),
      text: justFinished === "finished" ? `${providerTitle} Models are up-to-date!` : justFinished === "error" ? `${providerTitle} not found!` : `Manually refresh ${providerTitle} models.`
    }
  );
};
var RefreshableModels = () => {
  const settingsState = useSettingsState();
  const buttons = refreshableProviderNames.map((providerName) => {
    if (!settingsState.settingsOfProvider[providerName]._didFillInProviderSettings) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(RefreshModelButton, { providerName }, providerName);
  });
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_jsx_runtime18.Fragment, { children: buttons });
};
var RefreshRemoteCatalogButton = ({ providerName }) => {
  const accessor = useAccessor();
  const refreshModelService = accessor.get("IRefreshModelService");
  const metricsService = accessor.get("IMetricsService");
  const [isRefreshing, setIsRefreshing] = (0, import_react21.useState)(false);
  const [justFinished, setJustFinished] = (0, import_react21.useState)(null);
  const { title: providerTitle } = displayInfoOfProviderName(providerName);
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setJustFinished(null);
    try {
      await refreshModelService.refreshRemoteCatalog(providerName, true);
      setJustFinished("finished");
      metricsService.capture("Click", { providerName, action: "Refresh Remote Catalog" });
    } catch (error2) {
      console.error("Failed to refresh remote catalog:", error2);
      setJustFinished("error");
    } finally {
      setIsRefreshing(false);
      const tid = setTimeout(() => {
        setJustFinished(null);
      }, 2e3);
      return () => clearTimeout(tid);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
    ButtonLeftTextRightOption,
    {
      leftButton: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        "button",
        {
          className: "void-flex void-items-center",
          disabled: isRefreshing || justFinished !== null,
          onClick: handleRefresh,
          children: justFinished === "finished" ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Check, { className: "void-stroke-green-500 void-size-3" }) : justFinished === "error" ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(X, { className: "void-stroke-red-500 void-size-3" }) : isRefreshing ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(LoaderCircle, { className: "void-size-3 void-animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(RefreshCw, { className: "void-size-3" })
        }
      ),
      text: justFinished === "finished" ? `${providerTitle} catalog refreshed!` : justFinished === "error" ? `Failed to refresh ${providerTitle} catalog` : `Refresh ${providerTitle} model catalog`
    }
  );
};
var RefreshableRemoteCatalogs = () => {
  const settingsState = useSettingsState();
  const buttons = nonlocalProviderNames.map((providerName) => {
    if (!settingsState.settingsOfProvider[providerName]._didFillInProviderSettings) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(RefreshRemoteCatalogButton, { providerName }, providerName);
  });
  const validButtons = buttons.filter(Boolean);
  if (validButtons.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_jsx_runtime18.Fragment, { children: validButtons });
};
var AnimatedCheckmarkButton = ({ text, className }) => {
  const [dashOffset, setDashOffset] = (0, import_react21.useState)(40);
  (0, import_react21.useEffect)(() => {
    const startTime = performance.now();
    const duration = 500;
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const newOffset = 40 - progress * 40;
      setDashOffset(newOffset);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
    "div",
    {
      className: `void-flex void-items-center void-gap-1.5 void-w-fit ${className ? className : `void-px-2 void-py-0.5 void-text-xs void-text-zinc-900 void-bg-zinc-100 void-rounded-sm`} `,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("svg", { className: "void-size-4", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          "path",
          {
            d: "M5 13l4 4L19 7",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            style: {
              strokeDasharray: 40,
              strokeDashoffset: dashOffset
            }
          }
        ) }),
        text
      ]
    }
  );
};
var AddButton = ({ disabled, text = "Add", ...props }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
    "button",
    {
      disabled,
      className: `void-bg-[#0e70c0] void-px-3 void-py-1 void-text-white void-rounded-sm ${!disabled ? "hover:void-bg-[#1177cb] void-cursor-pointer" : "void-opacity-50 void-cursor-not-allowed void-bg-opacity-70"}`,
      ...props,
      children: text
    }
  );
};
var ConfirmButton = ({ children, onConfirm, className }) => {
  const [confirm2, setConfirm] = (0, import_react21.useState)(false);
  const ref = (0, import_react21.useRef)(null);
  (0, import_react21.useEffect)(() => {
    if (!confirm2) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setConfirm(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [confirm2]);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { ref, className: `void-inline-block`, children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidButtonBgDarken, { className, onClick: () => {
    if (!confirm2) {
      setConfirm(true);
    } else {
      onConfirm();
      setConfirm(false);
    }
  }, children: confirm2 ? `Confirm Reset` : children }) });
};
var SimpleModelSettingsDialog = ({
  isOpen,
  onClose,
  modelInfo
}) => {
  if (!isOpen || !modelInfo) return null;
  const { modelName, providerName, type } = modelInfo;
  const accessor = useAccessor();
  const settingsState = useSettingsState();
  const mouseDownInsideModal = (0, import_react21.useRef)(false);
  const settingsStateService = accessor.get("ICortexideSettingsService");
  const defaultModelCapabilities = getModelCapabilities(providerName, modelName, void 0);
  const currentOverrides = settingsState.overridesOfModel?.[providerName]?.[modelName] ?? void 0;
  const { recognizedModelName, isUnrecognizedModel } = defaultModelCapabilities;
  const partialDefaults = {};
  for (const k of modelOverrideKeys) {
    if (defaultModelCapabilities[k]) partialDefaults[k] = defaultModelCapabilities[k];
  }
  const placeholder = JSON.stringify(partialDefaults, null, 2);
  const [overrideEnabled, setOverrideEnabled] = (0, import_react21.useState)(() => !!currentOverrides);
  const [errorMsg, setErrorMsg] = (0, import_react21.useState)(null);
  const textAreaRef = (0, import_react21.useRef)(null);
  (0, import_react21.useEffect)(() => {
    if (!isOpen) return;
    const cur = settingsState.overridesOfModel?.[providerName]?.[modelName];
    setOverrideEnabled(!!cur);
    setErrorMsg(null);
  }, [isOpen, providerName, modelName, settingsState.overridesOfModel, placeholder]);
  const onSave = async () => {
    if (!overrideEnabled) {
      await settingsStateService.setOverridesOfModel(providerName, modelName, void 0);
      onClose();
      return;
    }
    let parsedInput;
    if (textAreaRef.current?.value) {
      try {
        parsedInput = JSON.parse(textAreaRef.current.value);
      } catch (e) {
        setErrorMsg("Invalid JSON");
        return;
      }
    } else {
      setErrorMsg("Invalid JSON");
      return;
    }
    const cleaned = {};
    for (const k of modelOverrideKeys) {
      if (!(k in parsedInput)) continue;
      const isEmpty = parsedInput[k] === "" || parsedInput[k] === null || parsedInput[k] === void 0;
      if (!isEmpty) {
        cleaned[k] = parsedInput[k];
      }
    }
    await settingsStateService.setOverridesOfModel(providerName, modelName, cleaned);
    onClose();
  };
  const sourcecodeOverridesLink = `https://github.com/opencortexide/cortexide/blob/main/src/vs/workbench/contrib/cortexide/common/modelCapabilities.ts#L146-L172`;
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
    "div",
    {
      className: "void-fixed void-inset-0 void-bg-black/50 void-flex void-items-center void-justify-center void-z-[9999999]",
      onMouseDown: () => {
        mouseDownInsideModal.current = false;
      },
      onMouseUp: () => {
        if (!mouseDownInsideModal.current) {
          onClose();
        }
        mouseDownInsideModal.current = false;
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
        "div",
        {
          className: "void-bg-void-bg-1 void-rounded-md void-p-4 void-max-w-xl void-w-full void-shadow-xl void-overflow-y-auto void-max-h-[90vh]",
          onClick: (e) => e.stopPropagation(),
          onMouseDown: (e) => {
            mouseDownInsideModal.current = true;
            e.stopPropagation();
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-justify-between void-items-center void-mb-4", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("h3", { className: "void-text-lg void-font-medium", children: [
                "Change Defaults for ",
                modelName,
                " (",
                displayInfoOfProviderName(providerName).title,
                ")"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                "button",
                {
                  onClick: onClose,
                  className: "void-text-void-fg-3 hover:void-text-void-fg-1",
                  children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(X, { className: "void-size-5" })
                }
              )
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-sm void-text-void-fg-3 void-mb-4", children: type === "default" ? `${modelName} comes packaged with CortexIDE, so you shouldn't need to change these settings.` : isUnrecognizedModel ? `Model not recognized by CortexIDE.` : `CortexIDE recognizes ${modelName} ("${recognizedModelName}").` }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-2 void-mb-4", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidSwitch, { size: "xs", value: overrideEnabled, onChange: setOverrideEnabled }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-sm", children: "Override model defaults" })
            ] }),
            overrideEnabled && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-sm void-text-void-fg-3 void-mb-4", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ChatMarkdownRender, { string: `See the [sourcecode](${sourcecodeOverridesLink}) for a reference on how to set this JSON (advanced).`, chatMessageLocation: void 0 }) }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
              "textarea",
              {
                ref: textAreaRef,
                className: `void-w-full void-min-h-[200px] void-p-2 void-rounded-sm void-border void-border-void-border-2 void-bg-void-bg-2 void-resize-none void-font-mono void-text-sm ${!overrideEnabled ? "void-text-void-fg-3" : ""}`,
                defaultValue: overrideEnabled && currentOverrides ? JSON.stringify(currentOverrides, null, 2) : placeholder,
                placeholder,
                readOnly: !overrideEnabled
              },
              overrideEnabled + ""
            ),
            errorMsg && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-red-500 void-mt-2 void-text-sm", children: errorMsg }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-justify-end void-gap-2 void-mt-4", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidButtonBgDarken, { onClick: onClose, className: "void-px-3 void-py-1", children: "Cancel" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                VoidButtonBgDarken,
                {
                  onClick: onSave,
                  className: "void-px-3 void-py-1 void-bg-[#0e70c0] void-text-white",
                  children: "Save"
                }
              )
            ] })
          ]
        }
      )
    }
  );
};
var ModelDump = ({ filteredProviders }) => {
  const accessor = useAccessor();
  const settingsStateService = accessor.get("ICortexideSettingsService");
  const settingsState = useSettingsState();
  const [openSettingsModel, setOpenSettingsModel] = (0, import_react21.useState)(null);
  const [isAddModelOpen, setIsAddModelOpen] = (0, import_react21.useState)(false);
  const [showCheckmark, setShowCheckmark] = (0, import_react21.useState)(false);
  const [userChosenProviderName, setUserChosenProviderName] = (0, import_react21.useState)(null);
  const [modelName, setModelName] = (0, import_react21.useState)("");
  const [errorString, setErrorString] = (0, import_react21.useState)("");
  const modelDump = [];
  const providersToShow = filteredProviders || providerNames;
  for (let providerName of providersToShow) {
    const providerSettings = settingsState.settingsOfProvider[providerName];
    modelDump.push(...providerSettings.models.map((model) => ({ ...model, providerName, providerEnabled: !!providerSettings._didFillInProviderSettings })));
  }
  modelDump.sort((a, b) => {
    return Number(b.providerEnabled) - Number(a.providerEnabled);
  });
  const handleAddModel = () => {
    if (!userChosenProviderName) {
      setErrorString("Please select a provider.");
      return;
    }
    if (!modelName) {
      setErrorString("Please enter a model name.");
      return;
    }
    if (settingsState.settingsOfProvider[userChosenProviderName].models.find((m) => m.modelName === modelName)) {
      setErrorString(`This model already exists.`);
      return;
    }
    settingsStateService.addModel(userChosenProviderName, modelName);
    setShowCheckmark(true);
    setTimeout(() => {
      setShowCheckmark(false);
      setIsAddModelOpen(false);
      setUserChosenProviderName(null);
      setModelName("");
    }, 1500);
    setErrorString("");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "", children: [
    modelDump.map((m, i) => {
      const { isHidden, type, modelName: modelName2, providerName, providerEnabled } = m;
      const isNewProviderName = (i > 0 ? modelDump[i - 1] : void 0)?.providerName !== providerName;
      const providerTitle = displayInfoOfProviderName(providerName).title;
      const disabled = !providerEnabled;
      const value = disabled ? false : !isHidden;
      const tooltipName = disabled ? `Add ${providerTitle} to enable` : value === true ? "Show in Dropdown" : "Hide from Dropdown";
      const detailAboutModel = type === "autodetected" ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Asterisk, { size: 14, className: "void-inline-block void-align-text-top void-brightness-115 void-stroke-[2] void-text-[#0e70c0]", "data-tooltip-id": "void-tooltip", "data-tooltip-place": "right", "data-tooltip-content": "Detected locally" }) : type === "custom" ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Asterisk, { size: 14, className: "void-inline-block void-align-text-top void-brightness-115 void-stroke-[2] void-text-[#0e70c0]", "data-tooltip-id": "void-tooltip", "data-tooltip-place": "right", "data-tooltip-content": "Custom model" }) : void 0;
      const hasOverrides = !!settingsState.overridesOfModel?.[providerName]?.[modelName2];
      return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
        "div",
        {
          className: `void-flex void-items-center void-justify-between void-gap-4 hover:void-bg-black/10 dark:hover:void-bg-gray-300/10 void-py-1 void-px-3 void-rounded-sm void-overflow-hidden void-cursor-default void-truncate void-group `,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: `void-flex void-flex-grow void-items-center void-gap-4`, children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-w-full void-max-w-32", children: isNewProviderName ? providerTitle : "" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-w-fit void-max-w-[400px] void-truncate", children: modelName2 })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-2 void-w-fit", children: [
              disabled ? null : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-w-5 void-flex void-items-center void-justify-center", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                "button",
                {
                  onClick: () => {
                    setOpenSettingsModel({ modelName: modelName2, providerName, type });
                  },
                  "data-tooltip-id": "void-tooltip",
                  "data-tooltip-place": "right",
                  "data-tooltip-content": "Advanced Settings",
                  className: `${hasOverrides ? "" : "void-opacity-0 group-hover:void-opacity-100"} void-transition-opacity`,
                  children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Plus, { size: 12, className: "void-text-void-fg-3 void-opacity-50" })
                }
              ) }),
              detailAboutModel,
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                VoidSwitch,
                {
                  value,
                  onChange: () => {
                    settingsStateService.toggleModelHidden(providerName, modelName2);
                  },
                  disabled,
                  size: "sm",
                  "data-tooltip-id": "void-tooltip",
                  "data-tooltip-place": "right",
                  "data-tooltip-content": tooltipName
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: `void-w-5 void-flex void-items-center void-justify-center`, children: type === "default" || type === "autodetected" ? null : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                "button",
                {
                  onClick: () => {
                    settingsStateService.deleteModel(providerName, modelName2);
                  },
                  "data-tooltip-id": "void-tooltip",
                  "data-tooltip-place": "right",
                  "data-tooltip-content": "Delete",
                  className: `${hasOverrides ? "" : "void-opacity-0 group-hover:void-opacity-100"} void-transition-opacity`,
                  children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(X, { size: 12, className: "void-text-void-fg-3 void-opacity-50" })
                }
              ) })
            ] })
          ]
        },
        `${modelName2}${providerName}`
      );
    }),
    showCheckmark ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-mt-4", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(AnimatedCheckmarkButton, { text: "Added", className: "void-bg-[#0e70c0] void-text-white void-px-3 void-py-1 void-rounded-sm" }) }) : isAddModelOpen ? /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-mt-4", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("form", { className: "void-flex void-items-center void-gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          VoidCustomDropdownBox,
          {
            options: providersToShow,
            selectedOption: userChosenProviderName,
            onChangeOption: (pn) => setUserChosenProviderName(pn),
            getOptionDisplayName: (pn) => pn ? displayInfoOfProviderName(pn).title : "Provider Name",
            getOptionDropdownName: (pn) => pn ? displayInfoOfProviderName(pn).title : "Provider Name",
            getOptionsEqual: (a, b) => a === b,
            className: "void-max-w-32 void-mx-2 void-w-full void-resize-none void-bg-void-bg-1 void-text-void-fg-1 placeholder:void-text-void-fg-3 void-border void-border-void-border-2 focus:void-border-void-border-1 void-py-1 void-px-2 void-rounded",
            arrowTouchesText: false
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          VoidSimpleInputBox,
          {
            value: modelName,
            compact: true,
            onChangeValue: setModelName,
            placeholder: "Model Name",
            className: "void-max-w-32"
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          AddButton,
          {
            type: "button",
            disabled: !modelName || !userChosenProviderName,
            onClick: handleAddModel
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          "button",
          {
            type: "button",
            onClick: () => {
              setIsAddModelOpen(false);
              setErrorString("");
              setModelName("");
              setUserChosenProviderName(null);
            },
            className: "void-text-void-fg-4",
            children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(X, { className: "void-size-4" })
          }
        )
      ] }),
      errorString && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-red-500 void-truncate void-whitespace-nowrap void-mt-1", children: errorString })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
      "div",
      {
        className: "void-text-void-fg-4 void-flex void-flex-nowrap void-text-nowrap void-items-center hover:void-brightness-110 void-cursor-pointer void-mt-4",
        onClick: () => setIsAddModelOpen(true),
        children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Plus, { size: 16 }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { children: "Add a model" })
        ] })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
      SimpleModelSettingsDialog,
      {
        isOpen: openSettingsModel !== null,
        onClose: () => setOpenSettingsModel(null),
        modelInfo: openSettingsModel
      }
    )
  ] });
};
var ProviderSetting = ({ providerName, settingName, subTextMd }) => {
  const { title: settingTitle, placeholder, isPasswordField } = displayInfoOfSettingName(providerName, settingName);
  const accessor = useAccessor();
  const cortexideSettingsService = accessor.get("ICortexideSettingsService");
  const settingsState = useSettingsState();
  const settingValue = settingsState.settingsOfProvider[providerName][settingName];
  if (typeof settingValue !== "string") {
    console.log("Error: Provider setting had a non-string value.");
    return;
  }
  const handleChangeValue = (0, import_react21.useCallback)((newVal) => {
    cortexideSettingsService.setSettingOfProvider(providerName, settingName, newVal);
  }, [cortexideSettingsService, providerName, settingName]);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-my-1", children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
      VoidSimpleInputBox,
      {
        value: settingValue,
        onChangeValue: handleChangeValue,
        placeholder: `${settingTitle} (${placeholder})`,
        passwordBlur: isPasswordField,
        compact: true
      }
    ),
    !subTextMd ? null : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-py-1 void-px-3 void-opacity-50 void-text-sm", children: subTextMd })
  ] }) });
};
var SettingsForProvider = ({ providerName, showProviderTitle, showProviderSuggestions }) => {
  const voidSettingsState = useSettingsState();
  const needsModel = isProviderNameDisabled(providerName, voidSettingsState) === "addModel";
  const settingNames = customSettingNamesOfProvider(providerName);
  const { title: providerTitle } = displayInfoOfProviderName(providerName);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-flex void-items-center void-w-full void-gap-4", children: showProviderTitle && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h3", { className: "void-text-xl void-truncate", children: providerTitle }) }),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-px-0", children: [
      settingNames.map((settingName, i) => {
        return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          ProviderSetting,
          {
            providerName,
            settingName,
            subTextMd: i !== settingNames.length - 1 ? null : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ChatMarkdownRender, { string: subTextMdOfProviderName(providerName), chatMessageLocation: void 0 })
          },
          settingName
        );
      }),
      showProviderSuggestions && needsModel ? providerName === "ollama" ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(WarningBox, { className: "void-pl-2 void-mb-4", text: `Please install an Ollama model. We'll auto-detect it.` }) : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(WarningBox, { className: "void-pl-2 void-mb-4", text: `Please add a model for ${providerTitle} (Models section).` }) : null
    ] })
  ] });
};
var VoidProviderSettings = ({ providerNames: providerNames3 }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_jsx_runtime18.Fragment, { children: providerNames3.map(
    (providerName) => /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(SettingsForProvider, { providerName, showProviderTitle: true, showProviderSuggestions: true }, providerName)
  ) });
};
var AutoDetectLocalModelsToggle = () => {
  const settingName = "autoRefreshModels";
  const accessor = useAccessor();
  const cortexideSettingsService = accessor.get("ICortexideSettingsService");
  const metricsService = accessor.get("IMetricsService");
  const voidSettingsState = useSettingsState();
  const enabled = voidSettingsState.globalSettings[settingName];
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
    ButtonLeftTextRightOption,
    {
      leftButton: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        VoidSwitch,
        {
          size: "xxs",
          value: enabled,
          onChange: (newVal) => {
            cortexideSettingsService.setGlobalSetting(settingName, newVal);
            metricsService.capture("Click", { action: "Autorefresh Toggle", settingName, enabled: newVal });
          }
        }
      ),
      text: `Automatically detect local providers and models (${refreshableProviderNames.map((providerName) => displayInfoOfProviderName(providerName).title).join(", ")}).`
    }
  );
};
var AIInstructionsBox = () => {
  const accessor = useAccessor();
  const cortexideSettingsService = accessor.get("ICortexideSettingsService");
  const voidSettingsState = useSettingsState();
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
    VoidInputBox2,
    {
      className: "void-min-h-[81px] void-p-3 void-rounded-sm",
      initValue: voidSettingsState.globalSettings.aiInstructions,
      placeholder: `Do not change my indentation or delete my comments. When writing TS or JS, do not add ;'s. Write new code using Rust if possible. `,
      multiline: true,
      onChangeText: (newText) => {
        cortexideSettingsService.setGlobalSetting("aiInstructions", newText);
      }
    }
  );
};
var FastApplyMethodDropdown = () => {
  const accessor = useAccessor();
  const cortexideSettingsService = accessor.get("ICortexideSettingsService");
  const options2 = (0, import_react21.useMemo)(() => [true, false], []);
  const onChangeOption = (0, import_react21.useCallback)((newVal) => {
    cortexideSettingsService.setGlobalSetting("enableFastApply", newVal);
  }, [cortexideSettingsService]);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
    VoidCustomDropdownBox,
    {
      className: "void-text-xs void-text-void-fg-3 void-bg-void-bg-1 void-border void-border-void-border-1 void-rounded void-p-0.5 void-px-1",
      options: options2,
      selectedOption: cortexideSettingsService.state.globalSettings.enableFastApply,
      onChangeOption,
      getOptionDisplayName: (val) => val ? "Fast Apply" : "Slow Apply",
      getOptionDropdownName: (val) => val ? "Fast Apply" : "Slow Apply",
      getOptionDropdownDetail: (val) => val ? "Output Search/Replace blocks" : "Rewrite whole files",
      getOptionsEqual: (a, b) => a === b
    }
  );
};
var OllamaSetupInstructions = ({ sayWeAutoDetect }) => {
  const accessor = useAccessor();
  const terminalToolService = accessor.get("ITerminalToolService");
  const nativeHostService = accessor.get("INativeHostService");
  const notificationService2 = accessor.get("INotificationService");
  const refreshModelService = accessor.get("IRefreshModelService");
  const repoIndexerService = accessor.get("IRepoIndexerService");
  const cortexideSettingsService = accessor.get("ICortexideSettingsService");
  const [status, setStatus] = (0, import_react21.useState)("idle");
  const [statusText, setStatusText] = (0, import_react21.useState)("");
  const [method, setMethod] = (0, import_react21.useState)("auto");
  const [currentTerminalId, setCurrentTerminalId] = (0, import_react21.useState)(null);
  const [terminalOutput, setTerminalOutput] = (0, import_react21.useState)("");
  const [modelTag, setModelTag] = (0, import_react21.useState)("llava");
  const [isHealthy, setIsHealthy] = (0, import_react21.useState)(null);
  (0, import_react21.useEffect)(() => {
    (async () => {
      try {
        const osProps = await nativeHostService.getOSProperties();
        const t = (osProps.type + "").toLowerCase();
        if (t.includes("windows")) setMethod("winget");
        else if (t.includes("darwin") || t.includes("mac")) setMethod("brew");
        else
          setMethod("curl");
      } catch {
      }
    })();
  }, [nativeHostService]);
  const onInstall = (0, import_react21.useCallback)(async () => {
    try {
      const osProps = await nativeHostService.getOSProperties();
      const isWindows = (osProps.type + "").toLowerCase().includes("windows");
      setStatus("running");
      setStatusText("Starting Ollama installation and opening the terminal...");
      const persistentTerminalId = await terminalToolService.createPersistentTerminal({ cwd: null });
      setCurrentTerminalId(persistentTerminalId);
      try {
        const commandService = accessor.get("ICommandService");
        await commandService.executeCommand("workbench.action.terminal.focus");
      } catch {
      }
      await terminalToolService.focusPersistentTerminal(persistentTerminalId);
      let installCmd = "";
      if (isWindows) {
        const m = method === "choco" ? "choco install ollama -y" : method === "winget" || method === "auto" ? "winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements" : "winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements";
        installCmd = `powershell -ExecutionPolicy Bypass -Command "${m}; Start-Sleep -Seconds 2; Start-Process -WindowStyle Hidden ollama serve"`;
      } else {
        const osName = (osProps.type + "").toLowerCase();
        if (osName.includes("darwin") || osName.includes("mac")) {
          installCmd = 'bash -lc "set -e;                       if [ -d /Applications/Ollama.app ]; then \\\n+                        echo [CortexIDE] Found /Applications/Ollama.app; open -a Ollama; \\\n+                      else \\\n+                        if [ -x /opt/homebrew/bin/brew ] || [ -x /usr/local/bin/brew ]; then \\\n+                          eval "$([ -x /opt/homebrew/bin/brew ] && /opt/homebrew/bin/brew shellenv || /usr/local/bin/brew shellenv)"; \\\n+                        else \\\n+                          echo [CortexIDE] Bootstrapping Homebrew...; /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; \\\n+                          eval "$([ -x /opt/homebrew/bin/brew ] && /opt/homebrew/bin/brew shellenv || /usr/local/bin/brew shellenv)"; \\\n+                        fi; \\\n+                        echo [CortexIDE] Installing Ollama via Homebrew Cask...; brew install --cask ollama || true; open -a Ollama; \\\n+                      fi; \\\n+                      echo [CortexIDE] Health check...; sleep 2; curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && echo [CortexIDE] Ollama running || echo [CortexIDE] Ollama not reachable yet;                     "';
        } else {
          installCmd = 'bash -lc "set -e; echo [CortexIDE] Installing Ollama (Linux); curl -fsSL https://ollama.com/install.sh | sh; (ollama serve >/dev/null 2>&1 &) || true; sleep 2; echo [CortexIDE] Health check; curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && echo [CortexIDE] Ollama running || echo [CortexIDE] Ollama not reachable yet;"';
        }
      }
      setStatusText("Running installer in terminal...");
      const { resPromise } = await terminalToolService.runCommand(installCmd, { type: "persistent", persistentTerminalId });
      resPromise.catch(() => {
      });
      cortexideSettingsService.setSettingOfProvider("ollama", "endpoint", "http://127.0.0.1:11434");
      refreshModelService.startRefreshingModels("ollama", { enableProviderOnSuccess: true, doNotFire: false });
      setStatus("running");
      setStatusText("Installer launched. Detecting models...");
      notificationService2.info("Ollama install started in the integrated terminal. Models will appear when ready.");
    } catch (e) {
      notificationService2.error("Failed to start Ollama install. Please try again or install manually.");
      setStatus("error");
      setStatusText("Failed to start install. See terminal or try manual install.");
    }
  }, [terminalToolService, nativeHostService, notificationService2, refreshModelService, cortexideSettingsService, method]);
  (0, import_react21.useCallback)(async () => {
    if (currentTerminalId) {
      await terminalToolService.focusPersistentTerminal(currentTerminalId);
    } else {
      try {
        const commandService = accessor.get("ICommandService");
        await commandService.executeCommand("workbench.action.terminal.focus");
      } catch {
      }
    }
  }, [currentTerminalId, terminalToolService]);
  (0, import_react21.useEffect)(() => {
    let tid;
    const poll = async () => {
      if (!currentTerminalId) return;
      try {
        const output = await terminalToolService.readTerminal(currentTerminalId);
        setTerminalOutput(output);
      } catch {
      }
    };
    if (currentTerminalId) {
      poll();
      tid = setInterval(poll, 1500);
    }
    return () => {
      if (tid) clearInterval(tid);
    };
  }, [currentTerminalId, terminalToolService]);
  (0, import_react21.useEffect)(() => {
    let tid;
    const ping = async () => {
      try {
        const res = await fetch("http://127.0.0.1:11434/api/tags", { method: "GET" });
        setIsHealthy(res.ok);
        if (res.ok && status === "running") {
          setStatus("done");
          setStatusText("Ollama is running. Models will appear shortly.");
        }
      } catch {
        setIsHealthy(false);
      }
    };
    if (status === "running" || status === "done") {
      ping();
      tid = setInterval(ping, 3e3);
    }
    return () => {
      if (tid) clearInterval(tid);
    };
  }, [status]);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "prose-p:void-my-0 prose-ol:void-list-decimal prose-p:void-py-0 prose-ol:void-my-0 prose-ol:void-py-0 prose-span:void-my-0 prose-span:void-py-0 void-text-void-fg-3 void-text-sm void-list-decimal void-select-text", children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ChatMarkdownRender, { string: `Ollama Setup (rev 2025-10-30-1)`, chatMessageLocation: void 0 }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
        "select",
        {
          className: "void-text-xs void-bg-void-bg-1 void-text-void-fg-1 void-border void-border-void-border-1 void-rounded void-px-1 void-py-0.5",
          value: method,
          onChange: (e) => setMethod(e.target.value),
          title: "Install method",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "auto", children: "Auto" }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "brew", children: "Homebrew (macOS)" }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "curl", children: "Curl Script (macOS/Linux)" }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "winget", children: "Winget (Windows)" }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "choco", children: "Chocolatey (Windows)" })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        "button",
        {
          className: "void-px-2 void-py-1 void-bg-void-bg-2 void-text-void-fg-1 void-border void-border-void-border-1 void-rounded hover:void-brightness-110 disabled:void-opacity-60",
          onClick: onInstall,
          disabled: status === "running",
          children: status === "running" ? "Installing\u2026" : "Install Ollama"
        }
      ),
      status === "error" && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        "button",
        {
          className: "void-px-2 void-py-1 void-bg-void-bg-1 void-text-void-fg-3 void-border void-border-void-border-2 void-rounded hover:void-brightness-110",
          onClick: () => {
            setStatus("idle");
            setStatusText("");
            setTerminalOutput("");
            setIsHealthy(null);
          },
          children: "Retry"
        }
      ),
      isHealthy !== null && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: `void-text-xs void-px-2 void-py-0.5 void-rounded void-border ${isHealthy ? "void-border-green-500 void-text-green-500" : "void-border-void-border-2 void-text-void-fg-3"}`, children: isHealthy ? "Healthy" : "Waiting" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: " void-pl-6 void-mt-2 void-flex void-items-center void-gap-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          VoidSwitch,
          {
            size: "xxs",
            value: !!cortexideSettingsService.state.globalSettings.enableAutoTuneOnPull,
            onChange: (v) => cortexideSettingsService.setGlobalSetting("enableAutoTuneOnPull", !!v)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs", children: "Auto-tune after pull" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-2 void-ml-4", children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          VoidSwitch,
          {
            size: "xxs",
            value: !!cortexideSettingsService.state.globalSettings.enableRepoIndexer,
            onChange: (v) => cortexideSettingsService.setGlobalSetting("enableRepoIndexer", !!v)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs", children: "Enable repo indexer" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: " void-pl-6 void-mt-2 void-flex void-items-center void-gap-2", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        VoidSwitch,
        {
          size: "xxs",
          value: cortexideSettingsService.state.globalSettings.useHeadlessBrowsing !== false,
          onChange: (v) => cortexideSettingsService.setGlobalSetting("useHeadlessBrowsing", v)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs", children: "Use headless browsing" }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-4 void-text-xs", title: "Use headless BrowserWindow for better content extraction from complex pages. Disable to use direct HTTP fetch instead.", children: "(\u2139\uFE0F)" })
    ] }) }),
    status !== "idle" && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: " void-pl-6 void-text-void-fg-3", children: statusText }),
    !!terminalOutput && /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: " void-pl-6 void-mt-2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-2 void-mb-1", children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          "button",
          {
            className: "void-px-2 void-py-0.5 void-bg-void-bg-1 void-text-void-fg-3 void-border void-border-void-border-2 void-rounded hover:void-brightness-110",
            onClick: async () => {
              try {
                await navigator.clipboard.writeText(terminalOutput);
              } catch {
              }
            },
            children: "Copy log"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
          "button",
          {
            className: "void-px-2 void-py-0.5 void-bg-void-bg-1 void-text-void-fg-3 void-border void-border-void-border-2 void-rounded hover:void-brightness-110",
            onClick: () => setTerminalOutput(""),
            children: "Clear"
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-border void-border-void-border-2 void-bg-void-bg-1 void-rounded void-p-2 void-max-h-48 void-overflow-auto void-text-xs void-whitespace-pre-wrap", children: terminalOutput })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: " void-pl-6 void-mt-2 void-flex void-items-center void-gap-2 void-whitespace-nowrap", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs", children: "Pull model:" }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
        "select",
        {
          className: "void-text-xs void-bg-void-bg-1 void-text-void-fg-1 void-border void-border-void-border-1 void-rounded void-px-1 void-py-0.5 void-shrink-0",
          value: modelTag,
          onChange: (e) => setModelTag(e.target.value),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("optgroup", { label: "Code Models", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "llama3.1", children: "llama3.1" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "llama3.2", children: "llama3.2" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "qwen2.5-coder", children: "qwen2.5-coder" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "deepseek-coder", children: "deepseek-coder" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("optgroup", { label: "Vision Models (Image Analysis)", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "llava", children: "llava (Vision)" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "bakllava", children: "bakllava (Vision)" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "llava:13b", children: "llava:13b (Vision, Better Quality)" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "llava:7b", children: "llava:7b (Vision, Faster)" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "bakllava:7b", children: "bakllava:7b (Vision)" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("optgroup", { label: "General Purpose", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "llama3", children: "llama3" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "mistral", children: "mistral" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "mixtral", children: "mixtral" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("option", { value: "qwen", children: "qwen" })
            ] })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        "button",
        {
          className: "void-px-2 void-py-1 void-bg-void-bg-2 void-text-void-fg-1 void-border void-border-void-border-1 void-rounded hover:void-brightness-110 void-shrink-0 disabled:void-opacity-50 disabled:void-cursor-not-allowed",
          disabled: !modelTag || status === "running",
          onClick: async () => {
            if (!modelTag) {
              notificationService2.warn("Please select a model to pull.");
              return;
            }
            try {
              setStatus("running");
              setStatusText(`Pulling ${modelTag}...`);
              let terminalId = currentTerminalId;
              if (!terminalId || !terminalToolService.persistentTerminalExists(terminalId)) {
                terminalId = await terminalToolService.createPersistentTerminal({ cwd: null });
                setCurrentTerminalId(terminalId);
              }
              await terminalToolService.focusPersistentTerminal(terminalId);
              const { resPromise } = await terminalToolService.runCommand(`ollama pull ${modelTag}`, { type: "persistent", persistentTerminalId: terminalId });
              resPromise.then(async ({ result, resolveReason }) => {
                if (resolveReason.type === "done") {
                  if (resolveReason.exitCode === 0) {
                    const resultText = result || "";
                    if (resultText.toLowerCase().includes("error") || resultText.toLowerCase().includes("failed")) {
                      setStatus("error");
                      setStatusText(`Failed to pull ${modelTag}. Check terminal for details.`);
                      notificationService2.error(`Failed to pull model "${modelTag}". See terminal for details.`);
                      return;
                    }
                    setStatus("done");
                    setStatusText(`Successfully pulled ${modelTag}`);
                    notificationService2.info(`Model "${modelTag}" pulled successfully.`);
                    setTimeout(() => {
                      refreshModelService.startRefreshingModels("ollama", { enableProviderOnSuccess: true, doNotFire: false });
                      try {
                        if (cortexideSettingsService.state.globalSettings.enableAutoTuneOnPull) {
                          const mt = (modelTag || "").toLowerCase();
                          const looksFIM = mt.includes("coder") || mt.includes("starcoder") || mt.includes("code");
                          cortexideSettingsService.setOverridesOfModel("ollama", modelTag, {
                            supportsFIM: looksFIM,
                            contextWindow: looksFIM ? 128e3 : 64e3,
                            reservedOutputTokenSpace: 8192,
                            supportsSystemMessage: "system-role"
                          });
                          if (looksFIM) {
                            cortexideSettingsService.setGlobalSetting("enableAutocomplete", true);
                            cortexideSettingsService.setModelSelectionOfFeature("Autocomplete", { providerName: "ollama", modelName: modelTag });
                            cortexideSettingsService.setModelSelectionOfFeature("Apply", { providerName: "ollama", modelName: modelTag });
                          } else {
                            cortexideSettingsService.setModelSelectionOfFeature("Chat", { providerName: "ollama", modelName: modelTag });
                          }
                        }
                      } catch (e) {
                        console.error("Auto-tune error:", e);
                      }
                      try {
                        if (cortexideSettingsService.state.globalSettings.enableRepoIndexer) {
                          notificationService2.info("Warming project index...");
                          repoIndexerService.warmIndex(void 0).then(() => {
                            notificationService2.info("Project index warmed.");
                          }).catch(() => {
                          });
                        }
                      } catch {
                      }
                    }, 3e3);
                  } else {
                    const resultText = result || "Unknown error";
                    setStatus("error");
                    setStatusText(`Failed to pull ${modelTag} (exit code ${resolveReason.exitCode}). Check terminal for details.`);
                    notificationService2.error(`Failed to pull model "${modelTag}": ${resultText}. See terminal for details.`);
                  }
                } else if (resolveReason.type === "timeout") {
                  setStatus("done");
                  setStatusText(`Pulling ${modelTag}... (may take time for large models)`);
                  notificationService2.info(`Started pulling "${modelTag}". This may take a while for large models. Check terminal for progress.`);
                  setTimeout(() => {
                    refreshModelService.startRefreshingModels("ollama", { enableProviderOnSuccess: true, doNotFire: false });
                  }, 5e3);
                }
              }).catch((error2) => {
                setStatus("error");
                const errorMsg = error2?.message || String(error2) || "Unknown error";
                setStatusText(`Error pulling ${modelTag}: ${errorMsg}`);
                notificationService2.error(`Failed to pull model "${modelTag}": ${errorMsg}`);
                console.error("Pull error:", error2);
              });
            } catch (error2) {
              setStatus("error");
              const errorMsg = error2?.message || String(error2) || "Unknown error";
              setStatusText(`Failed to start pull: ${errorMsg}`);
              notificationService2.error(`Failed to start pulling model "${modelTag}": ${errorMsg}`);
              console.error("Pull setup error:", error2);
            }
          },
          children: "Pull"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        "button",
        {
          className: "void-px-2 void-py-1 void-bg-red-600/80 void-text-white void-border void-border-red-500/80 void-rounded hover:void-brightness-110 void-shrink-0 disabled:void-opacity-50 disabled:void-cursor-not-allowed",
          disabled: !modelTag || status === "running",
          onClick: async () => {
            if (!modelTag) {
              notificationService2.warn("Please select a model to delete.");
              return;
            }
            const ok = window.confirm(`Delete model "${modelTag}" from Ollama?`);
            if (!ok) return;
            try {
              setStatus("running");
              setStatusText(`Deleting ${modelTag}...`);
              let terminalId = currentTerminalId;
              if (!terminalId || !terminalToolService.persistentTerminalExists(terminalId)) {
                terminalId = await terminalToolService.createPersistentTerminal({ cwd: null });
                setCurrentTerminalId(terminalId);
              }
              await terminalToolService.focusPersistentTerminal(terminalId);
              const { resPromise } = await terminalToolService.runCommand(`ollama rm ${modelTag}`, { type: "persistent", persistentTerminalId: terminalId });
              resPromise.then(async ({ result, resolveReason }) => {
                if (resolveReason.type === "done") {
                  if (resolveReason.exitCode === 0) {
                    setStatus("done");
                    setStatusText(`Successfully deleted ${modelTag}`);
                    notificationService2.info(`Model "${modelTag}" deleted successfully.`);
                    setTimeout(() => {
                      refreshModelService.startRefreshingModels("ollama", { enableProviderOnSuccess: true, doNotFire: false });
                    }, 2e3);
                  } else {
                    const resultText = result || "Unknown error";
                    setStatus("error");
                    setStatusText(`Failed to delete ${modelTag} (exit code ${resolveReason.exitCode}). Check terminal for details.`);
                    notificationService2.error(`Failed to delete model "${modelTag}": ${resultText}. See terminal for details.`);
                  }
                } else if (resolveReason.type === "timeout") {
                  setStatus("error");
                  setStatusText(`Delete command timed out for ${modelTag}. The command may still be running.`);
                  notificationService2.warn(`Delete command for "${modelTag}" timed out. Check terminal to see if it completed.`);
                  setTimeout(() => {
                    refreshModelService.startRefreshingModels("ollama", { enableProviderOnSuccess: true, doNotFire: false });
                  }, 2e3);
                }
              }).catch((error2) => {
                setStatus("error");
                const errorMsg = error2?.message || String(error2) || "Unknown error";
                setStatusText(`Error deleting ${modelTag}: ${errorMsg}`);
                notificationService2.error(`Failed to delete model "${modelTag}": ${errorMsg}`);
                console.error("Delete error:", error2);
              });
            } catch (error2) {
              setStatus("error");
              const errorMsg = error2?.message || String(error2) || "Unknown error";
              setStatusText(`Failed to start delete: ${errorMsg}`);
              notificationService2.error(`Failed to start deleting model "${modelTag}": ${errorMsg}`);
              console.error("Delete setup error:", error2);
            }
          },
          children: "Delete"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: " void-pl-6", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ChatMarkdownRender, { string: `1. If the install does not start, download Ollama manually from [ollama.com/download](https://ollama.com/download).`, chatMessageLocation: void 0 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: " void-pl-6", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ChatMarkdownRender, { string: `2. Optionally, run \`ollama pull llama3.1\` to install a starter model.`, chatMessageLocation: void 0 }) }),
    sayWeAutoDetect && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: " void-pl-6", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ChatMarkdownRender, { string: `CortexIDE automatically detects locally running models and enables them.`, chatMessageLocation: void 0 }) })
  ] });
};
var RedoOnboardingButton = ({ className }) => {
  const accessor = useAccessor();
  const cortexideSettingsService = accessor.get("ICortexideSettingsService");
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
    "div",
    {
      className: `void-text-void-fg-4 void-flex void-flex-nowrap void-text-nowrap void-items-center hover:void-brightness-110 void-cursor-pointer ${className}`,
      onClick: () => {
        cortexideSettingsService.setGlobalSetting("isOnboardingComplete", false);
      },
      children: "See onboarding screen?"
    }
  );
};
var ToolApprovalTypeSwitch = ({ approvalType, size: size3, desc }) => {
  const accessor = useAccessor();
  const cortexideSettingsService = accessor.get("ICortexideSettingsService");
  const voidSettingsState = useSettingsState();
  const metricsService = accessor.get("IMetricsService");
  const onToggleAutoApprove = (0, import_react21.useCallback)((approvalType2, newValue) => {
    cortexideSettingsService.setGlobalSetting("autoApprove", {
      ...cortexideSettingsService.state.globalSettings.autoApprove,
      [approvalType2]: newValue
    });
    metricsService.capture("Tool Auto-Accept Toggle", { enabled: newValue });
  }, [cortexideSettingsService, metricsService]);
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_jsx_runtime18.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
      VoidSwitch,
      {
        size: size3,
        value: voidSettingsState.globalSettings.autoApprove[approvalType] ?? false,
        onChange: (newVal) => onToggleAutoApprove(approvalType, newVal)
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs", children: desc })
  ] });
};
var OneClickSwitchButton = ({ fromEditor = "VS Code", className = "" }) => {
  const accessor = useAccessor();
  const extensionTransferService = accessor.get("IExtensionTransferService");
  const [transferState, setTransferState] = (0, import_react21.useState)({ type: "done" });
  const onClick = async () => {
    if (transferState.type !== "done") return;
    setTransferState({ type: "loading" });
    const errAcc = await extensionTransferService.transferExtensions(os, fromEditor);
    const hadError = !!errAcc;
    if (hadError) {
      setTransferState({ type: "done", error: errAcc });
    } else {
      setTransferState({ type: "justfinished" });
      setTimeout(() => {
        setTransferState({ type: "done" });
      }, 3e3);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_jsx_runtime18.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidButtonBgDarken, { className: `void-max-w-48 void-p-4 ${className}`, disabled: transferState.type !== "done", onClick, children: transferState.type === "done" ? `Transfer from ${fromEditor}` : transferState.type === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("span", { className: "void-text-nowrap void-flex void-flex-nowrap", children: [
      "Transferring",
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(IconLoading, {})
    ] }) : transferState.type === "justfinished" ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(AnimatedCheckmarkButton, { text: "Settings Transferred", className: "void-bg-none" }) : null }),
    transferState.type === "done" && transferState.error ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(WarningBox, { text: transferState.error }) : null
  ] });
};
var MCPServerComponent = ({ name, server }) => {
  const accessor = useAccessor();
  const mcpService = accessor.get("IMCPService");
  const voidSettings = useSettingsState();
  const isOn = voidSettings.mcpUserStateOfName[name]?.isOn;
  const removeUniquePrefix = (name2) => name2.split("_").slice(1).join("_");
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-border void-border-void-border-2 void-bg-void-bg-1 void-py-3 void-px-4 void-rounded-sm void-my-2", children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-justify-between", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: `void-w-2 void-h-2 void-rounded-full ${server.status === "success" ? "void-bg-green-500" : server.status === "error" ? "void-bg-red-500" : server.status === "loading" ? "void-bg-yellow-500" : server.status === "offline" ? "void-bg-void-fg-3" : ""} ` }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-sm void-font-medium void-text-void-fg-1", children: name })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        VoidSwitch,
        {
          value: isOn ?? false,
          size: "xs",
          disabled: server.status === "error",
          onChange: () => mcpService.toggleServerIsOn(name, !isOn)
        }
      )
    ] }),
    isOn && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-mt-3", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-flex void-flex-wrap void-gap-2 void-max-h-32 void-overflow-y-auto", children: (server.tools ?? []).length > 0 ? (server.tools ?? []).map(
      (tool) => /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        "span",
        {
          className: "void-px-2 void-py-0.5 void-bg-void-bg-2 void-text-void-fg-3 void-rounded-sm void-text-xs",
          "data-tooltip-id": "void-tooltip",
          "data-tooltip-content": tool.description || "",
          "data-tooltip-class-name": "void-max-w-[300px]",
          children: removeUniquePrefix(tool.name)
        },
        tool.name
      )
    ) : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-xs void-text-void-fg-3", children: "No tools available" }) }) }),
    isOn && server.command && /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-mt-3", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-xs void-text-void-fg-3 void-mb-1", children: "Command:" }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-px-2 void-py-1 void-bg-void-bg-2 void-text-xs void-font-mono void-overflow-x-auto void-whitespace-nowrap void-text-void-fg-2 void-rounded-sm", children: server.command })
    ] }),
    server.error && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-mt-3", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(WarningBox, { text: server.error }) })
  ] });
};
var MCPServersList = () => {
  const mcpServiceState = useMCPServiceState();
  let content;
  if (mcpServiceState.error) {
    content = /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-void-fg-3 void-text-sm void-mt-2", children: mcpServiceState.error });
  } else {
    const entries = Object.entries(mcpServiceState.mcpServerOfName);
    if (entries.length === 0) {
      content = /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-void-fg-3 void-text-sm void-mt-2", children: "No servers found" });
    } else {
      content = entries.map(
        ([name, server]) => /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MCPServerComponent, { name, server }, name)
      );
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-my-2", children: content });
};
var Settings = () => {
  const isDark = useIsDark();
  const [selectedSection, setSelectedSection] = (0, import_react21.useState)("models");
  const navItems = [
    { tab: "models", label: "Models" },
    { tab: "localProviders", label: "Local Providers" },
    { tab: "providers", label: "Main Providers" },
    { tab: "featureOptions", label: "Feature Options" },
    { tab: "general", label: "General" },
    { tab: "mcp", label: "MCP" },
    { tab: "all", label: "All Settings" }
  ];
  const shouldShowTab = (tab) => selectedSection === "all" || selectedSection === tab;
  const accessor = useAccessor();
  const commandService = accessor.get("ICommandService");
  const environmentService = accessor.get("IEnvironmentService");
  const nativeHostService = accessor.get("INativeHostService");
  const settingsState = useSettingsState();
  const cortexideSettingsService = accessor.get("ICortexideSettingsService");
  const chatThreadsService = accessor.get("IChatThreadService");
  const notificationService2 = accessor.get("INotificationService");
  const mcpService = accessor.get("IMCPService");
  const storageService = accessor.get("IStorageService");
  const metricsService = accessor.get("IMetricsService");
  const isOptedOut = useIsOptedOut();
  const onDownload = (t) => {
    let dataStr;
    let downloadName;
    if (t === "Chats") {
      dataStr = JSON.stringify(chatThreadsService.state, null, 2);
      downloadName = "void-chats.json";
    } else if (t === "Settings") {
      dataStr = JSON.stringify(cortexideSettingsService.state, null, 2);
      downloadName = "void-settings.json";
    } else {
      dataStr = "";
      downloadName = "";
    }
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName;
    a.click();
    URL.revokeObjectURL(url);
  };
  const fileInputSettingsRef = (0, import_react21.useRef)(null);
  const fileInputChatsRef = (0, import_react21.useRef)(null);
  const [s, ss] = (0, import_react21.useState)(0);
  const handleUpload = (t) => (e) => {
    const files = e.target.files;
    if (!files) return;
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        if (t === "Chats") {
          chatThreadsService.dangerousSetState(json);
        } else if (t === "Settings") {
          cortexideSettingsService.dangerousSetState(json);
        }
        notificationService2.info(`${t} imported successfully!`);
      } catch (err) {
        notificationService2.notify({ message: `Failed to import ${t}`, source: err + "", severity: Severity.Error });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
    ss((s2) => s2 + 1);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: `void-scope ${isDark ? "void-dark" : ""}`, style: { height: "100%", width: "100%", overflow: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-flex-col md:void-flex-row void-w-full void-gap-6 void-max-w-[900px] void-mx-auto void-mb-32", style: { minHeight: "80vh" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("aside", { className: "md:void-w-1/4 void-w-full void-p-6 void-shrink-0", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-flex void-flex-col void-gap-2 void-mt-12", children: navItems.map(
      ({ tab, label }) => /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
        "button",
        {
          onClick: () => {
            if (tab === "all") {
              setSelectedSection("all");
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              setSelectedSection(tab);
            }
          },
          className: ` void-py-2 void-px-4 void-rounded-md void-text-left void-transition-all void-duration-200 ${selectedSection === tab ? "void-bg-[#0e70c0]/80 void-text-white void-font-medium void-shadow-sm" : "void-bg-void-bg-2 hover:void-bg-void-bg-2/80 void-text-void-fg-1"} `,
          children: label
        },
        tab
      )
    ) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("main", { className: "void-flex-1 void-p-6 void-select-none", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-max-w-3xl", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h1", { className: "void-text-2xl void-w-full", children: `CortexIDE Settings` }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-w-full void-h-[1px] void-my-2" }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(RedoOnboardingButton, {}) }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-w-full void-h-[1px] void-my-4" }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-flex-col void-gap-12", children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: shouldShowTab("models") ? `` : "void-hidden", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(ErrorBoundary_default, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h2", { className: `void-text-3xl void-mb-2`, children: "Models" }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ModelDump, {}),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-w-full void-h-[1px] void-my-4" }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(AutoDetectLocalModelsToggle, {}),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(RefreshableModels, {})
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: shouldShowTab("localProviders") ? `` : "void-hidden", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(ErrorBoundary_default, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h2", { className: `void-text-3xl void-mb-2`, children: "Local Providers" }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h3", { className: `void-text-void-fg-3 void-mb-2`, children: `CortexIDE can access any model that you host locally. We automatically detect your local models by default.` }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-opacity-80 void-mb-4", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(OllamaSetupInstructions, { sayWeAutoDetect: true }) }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidProviderSettings, { providerNames: localProviderNames })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: shouldShowTab("providers") ? `` : "void-hidden", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(ErrorBoundary_default, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h2", { className: `void-text-3xl void-mb-2`, children: "Main Providers" }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h3", { className: `void-text-void-fg-3 void-mb-2`, children: `CortexIDE can access models from Anthropic, OpenAI, OpenRouter, and more.` }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidProviderSettings, { providerNames: nonlocalProviderNames }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-w-full void-h-[1px] void-my-4" }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(RefreshableRemoteCatalogs, {})
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: shouldShowTab("featureOptions") ? `` : "void-hidden", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(ErrorBoundary_default, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h2", { className: `void-text-3xl void-mb-2`, children: "Feature Options" }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-flex-col void-gap-y-8 void-my-4", children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h4", { className: `void-text-base`, children: displayInfoOfFeatureName("Autocomplete") }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-text-sm void-text-void-fg-3 void-mt-1", children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("span", { children: [
                  "Experimental.",
                  " "
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                  "span",
                  {
                    className: "hover:void-brightness-110",
                    "data-tooltip-id": "void-tooltip",
                    "data-tooltip-content": "We recommend using the largest qwen2.5-coder model you can with Ollama (try qwen2.5-coder:3b).",
                    "data-tooltip-class-name": "void-max-w-[20px]",
                    children: "Only works with FIM models.*"
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-my-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2 void-my-2", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                    VoidSwitch,
                    {
                      size: "xs",
                      value: settingsState.globalSettings.enableAutocomplete,
                      onChange: (newVal) => cortexideSettingsService.setGlobalSetting("enableAutocomplete", newVal)
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none", children: settingsState.globalSettings.enableAutocomplete ? "Enabled" : "Disabled" })
                ] }) }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: `void-my-2 ${!settingsState.globalSettings.enableAutocomplete ? "void-hidden" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ModelDropdown, { featureName: "Autocomplete", className: "void-text-xs void-text-void-fg-3 void-bg-void-bg-1 void-border void-border-void-border-1 void-rounded void-p-0.5 void-px-1" }) }) })
              ] })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-w-full", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h4", { className: `void-text-base`, children: displayInfoOfFeatureName("Apply") }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-sm void-text-void-fg-3 void-mt-1", children: "Settings that control the behavior of the Apply button." }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-my-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2 void-my-2", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                    VoidSwitch,
                    {
                      size: "xs",
                      value: settingsState.globalSettings.syncApplyToChat,
                      onChange: (newVal) => cortexideSettingsService.setGlobalSetting("syncApplyToChat", newVal)
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none", children: settingsState.globalSettings.syncApplyToChat ? "Same as Chat model" : "Different model" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: `void-my-2 ${settingsState.globalSettings.syncApplyToChat ? "void-hidden" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ModelDropdown, { featureName: "Apply", className: "void-text-xs void-text-void-fg-3 void-bg-void-bg-1 void-border void-border-void-border-1 void-rounded void-p-0.5 void-px-1" }) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-my-2", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-flex void-items-center void-gap-x-2 void-my-2", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(FastApplyMethodDropdown, {}) }) })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h4", { className: `void-text-base`, children: "Tools" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-sm void-text-void-fg-3 void-mt-1", children: `Tools are functions that LLMs can call. Some tools require user approval.` }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-my-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: [...toolApprovalTypes].map((approvalType) => {
                  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-flex void-items-center void-gap-x-2 void-my-2", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ToolApprovalTypeSwitch, { size: "xs", approvalType, desc: `Auto-approve ${approvalType}` }) }, approvalType);
                }) }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2 void-my-2", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                    VoidSwitch,
                    {
                      size: "xs",
                      value: settingsState.globalSettings.includeToolLintErrors,
                      onChange: (newVal) => cortexideSettingsService.setGlobalSetting("includeToolLintErrors", newVal)
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none", children: settingsState.globalSettings.includeToolLintErrors ? "Fix lint errors" : `Fix lint errors` })
                ] }) }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2 void-my-2", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                    VoidSwitch,
                    {
                      size: "xs",
                      value: settingsState.globalSettings.autoAcceptLLMChanges,
                      onChange: (newVal) => cortexideSettingsService.setGlobalSetting("autoAcceptLLMChanges", newVal)
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none", children: "Auto-accept LLM changes" })
                ] }) })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h4", { className: `void-text-base`, children: "YOLO Mode" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-sm void-text-void-fg-3 void-mt-1", children: "Automatically apply low-risk edits without approval. High-risk edits always require approval." }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-my-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2 void-my-2", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                    VoidSwitch,
                    {
                      size: "xs",
                      value: settingsState.globalSettings.enableYOLOMode ?? false,
                      onChange: (newVal) => cortexideSettingsService.setGlobalSetting("enableYOLOMode", newVal)
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none", children: settingsState.globalSettings.enableYOLOMode ? "Enabled" : "Disabled" })
                ] }) }),
                settingsState.globalSettings.enableYOLOMode && /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-my-4 void-space-y-3", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("label", { className: "void-text-sm void-text-void-fg-2 void-mb-1 void-block", children: [
                      "Risk Threshold: ",
                      (settingsState.globalSettings.yoloRiskThreshold ?? 0.2).toFixed(2)
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-xs void-text-void-fg-3 void-mb-2", children: "Edits with risk below this threshold will auto-apply (0.0 = safe, 1.0 = dangerous)" }),
                    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                      "input",
                      {
                        type: "range",
                        min: "0",
                        max: "1",
                        step: "0.05",
                        value: settingsState.globalSettings.yoloRiskThreshold ?? 0.2,
                        onChange: (e) => cortexideSettingsService.setGlobalSetting("yoloRiskThreshold", parseFloat(e.target.value)),
                        className: "void-w-full"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { children: [
                    /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("label", { className: "void-text-sm void-text-void-fg-2 void-mb-1 void-block", children: [
                      "Confidence Threshold: ",
                      (settingsState.globalSettings.yoloConfidenceThreshold ?? 0.7).toFixed(2)
                    ] }),
                    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-xs void-text-void-fg-3 void-mb-2", children: "Edits with confidence above this threshold will auto-apply (0.0 = uncertain, 1.0 = confident)" }),
                    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                      "input",
                      {
                        type: "range",
                        min: "0",
                        max: "1",
                        step: "0.05",
                        value: settingsState.globalSettings.yoloConfidenceThreshold ?? 0.7,
                        onChange: (e) => cortexideSettingsService.setGlobalSetting("yoloConfidenceThreshold", parseFloat(e.target.value)),
                        className: "void-w-full"
                      }
                    )
                  ] })
                ] })
              ] })
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-w-full", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h4", { className: `void-text-base`, children: "Editor" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-sm void-text-void-fg-3 void-mt-1", children: `Settings that control the visibility of CortexIDE suggestions in the code editor.` }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-my-2", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2 void-my-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                  VoidSwitch,
                  {
                    size: "xs",
                    value: settingsState.globalSettings.showInlineSuggestions,
                    onChange: (newVal) => cortexideSettingsService.setGlobalSetting("showInlineSuggestions", newVal)
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none", children: settingsState.globalSettings.showInlineSuggestions ? "Show suggestions on select" : "Show suggestions on select" })
              ] }) }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-w-full", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h4", { className: `void-text-base`, children: displayInfoOfFeatureName("SCM") }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-sm void-text-void-fg-3 void-mt-1", children: "Settings that control the behavior of the commit message generator." }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-my-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2 void-my-2", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                    VoidSwitch,
                    {
                      size: "xs",
                      value: settingsState.globalSettings.syncSCMToChat,
                      onChange: (newVal) => cortexideSettingsService.setGlobalSetting("syncSCMToChat", newVal)
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none", children: settingsState.globalSettings.syncSCMToChat ? "Same as Chat model" : "Different model" })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: `void-my-2 ${settingsState.globalSettings.syncSCMToChat ? "void-hidden" : ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ModelDropdown, { featureName: "SCM", className: "void-text-xs void-text-void-fg-3 void-bg-void-bg-1 void-border void-border-void-border-1 void-rounded void-p-0.5 void-px-1" }) })
              ] })
            ] }) })
          ] })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: `${shouldShowTab("general") ? `` : "void-hidden"} void-flex void-flex-col void-gap-12`, children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(ErrorBoundary_default, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h2", { className: "void-text-3xl void-mb-2", children: "One-Click Switch" }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h4", { className: "void-text-void-fg-3 void-mb-4", children: `Transfer your editor settings into CortexIDE.` }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-flex-col void-gap-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(OneClickSwitchButton, { className: "void-w-48", fromEditor: "VS Code" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(OneClickSwitchButton, { className: "void-w-48", fromEditor: "Cursor" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(OneClickSwitchButton, { className: "void-w-48", fromEditor: "Windsurf" })
            ] })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h2", { className: "void-text-3xl void-mb-2", children: "Import/Export" }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h4", { className: "void-text-void-fg-3 void-mb-4", children: `Transfer CortexIDE's settings and chats in and out of CortexIDE.` }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-flex-col void-gap-8", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-flex-col void-gap-2 void-max-w-48 void-w-full", children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("input", { ref: fileInputSettingsRef, type: "file", accept: ".json", className: "void-hidden", onChange: handleUpload("Settings") }, 2 * s),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidButtonBgDarken, { className: "void-px-4 void-py-1 void-w-full", onClick: () => {
                  fileInputSettingsRef.current?.click();
                }, children: "Import Settings" }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidButtonBgDarken, { className: "void-px-4 void-py-1 void-w-full", onClick: () => onDownload("Settings"), children: "Export Settings" }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ConfirmButton, { className: "void-px-4 void-py-1 void-w-full", onConfirm: () => {
                  cortexideSettingsService.resetState();
                }, children: "Reset Settings" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-flex-col void-gap-2 void-max-w-48 void-w-full", children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("input", { ref: fileInputChatsRef, type: "file", accept: ".json", className: "void-hidden", onChange: handleUpload("Chats") }, 2 * s + 1),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidButtonBgDarken, { className: "void-px-4 void-py-1 void-w-full", onClick: () => {
                  fileInputChatsRef.current?.click();
                }, children: "Import Chats" }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidButtonBgDarken, { className: "void-px-4 void-py-1 void-w-full", onClick: () => onDownload("Chats"), children: "Export Chats" }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ConfirmButton, { className: "void-px-4 void-py-1 void-w-full", onConfirm: () => {
                  chatThreadsService.resetState();
                }, children: "Reset Chats" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h2", { className: `void-text-3xl void-mb-2`, children: "Built-in Settings" }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h4", { className: `void-text-void-fg-3 void-mb-4`, children: `IDE settings, keyboard settings, and theme customization.` }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-flex-col void-gap-2 void-justify-center void-max-w-48 void-w-full", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidButtonBgDarken, { className: "void-px-4 void-py-1", onClick: () => {
                commandService.executeCommand("workbench.action.openSettings");
              }, children: "General Settings" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidButtonBgDarken, { className: "void-px-4 void-py-1", onClick: () => {
                commandService.executeCommand("workbench.action.openGlobalKeybindings");
              }, children: "Keyboard Settings" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidButtonBgDarken, { className: "void-px-4 void-py-1", onClick: () => {
                commandService.executeCommand("workbench.action.selectTheme");
              }, children: "Theme Settings" }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidButtonBgDarken, { className: "void-px-4 void-py-1", onClick: () => {
                nativeHostService.showItemInFolder(environmentService.logsHome.fsPath);
              }, children: "Open Logs" })
            ] }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-max-w-[600px]", children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h2", { className: `void-text-3xl void-mb-2`, children: "Metrics" }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h4", { className: `void-text-void-fg-3 void-mb-4`, children: "Very basic anonymous usage tracking helps us keep CortexIDE running smoothly. You may opt out below. Regardless of this setting, CortexIDE never sees your code, messages, or API keys." }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-my-2", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2 void-my-2", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                VoidSwitch,
                {
                  size: "xs",
                  value: isOptedOut,
                  onChange: (newVal) => {
                    storageService.store(OPT_OUT_KEY, newVal, StorageScope.APPLICATION, StorageTarget.MACHINE);
                    metricsService.capture(`Set metrics opt-out to ${newVal}`, {});
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none", children: "Opt-out (requires restart)" })
            ] }) }) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-max-w-[600px]", children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h2", { className: `void-text-3xl void-mb-2`, children: "AI Instructions" }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h4", { className: `void-text-void-fg-3 void-mb-4`, children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ChatMarkdownRender, { inPTag: true, string: `
System instructions to include with all AI requests.
Alternatively, place a \`.voidrules\` file in the root of your workspace.
								`, chatMessageLocation: void 0 }) }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(AIInstructionsBox, {}) }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-my-4", children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: "void-flex void-items-center void-gap-x-2", children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(
                  VoidSwitch,
                  {
                    size: "xs",
                    value: !!settingsState.globalSettings.disableSystemMessage,
                    onChange: (newValue) => {
                      cortexideSettingsService.setGlobalSetting("disableSystemMessage", newValue);
                    }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: "void-text-void-fg-3 void-text-xs void-pointer-events-none", children: "Disable system message" })
              ] }) }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-text-void-fg-3 void-text-xs void-mt-1", children: `When disabled, CortexIDE will not include anything in the system message except for content you specified above.` })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: shouldShowTab("mcp") ? `` : "void-hidden", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(ErrorBoundary_default, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h2", { className: "void-text-3xl void-mb-2", children: "MCP" }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("h4", { className: `void-text-void-fg-3 void-mb-4`, children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ChatMarkdownRender, { inPTag: true, string: `
Use Model Context Protocol to provide Agent mode with more tools.
							`, chatMessageLocation: void 0 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: "void-my-2", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(VoidButtonBgDarken, { className: "void-px-4 void-py-1 void-w-full void-max-w-48", onClick: async () => {
            await mcpService.revealMCPConfigFile();
          }, children: "Add MCP Server" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(ErrorBoundary_default, { children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(MCPServersList, {}) })
        ] }) })
      ] })
    ] }) })
  ] }) });
};

export { ErrorBoundary_default, ModelDump, OllamaSetupInstructions, OneClickSwitchButton, Settings, SettingsForProvider, SidebarChat, VoidChatArea, VoidInputBox2, useRefState };
