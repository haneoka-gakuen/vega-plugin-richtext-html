import createDOMPurify, { type Config } from "dompurify";
import { defineVegaPlugin, type VegaPlugin, type VegaPluginContext } from "@haneoka/vega/plugin";
import {
  VEGA_RICH_TEXT_SERVICE,
  type VegaRichTextHandle,
  type VegaRichTextRenderRequest,
  type VegaRichTextRenderer,
} from "@haneoka/vega-plugin-richtext";

export const VEGA_HTML_ALLOWED_TAGS = Object.freeze([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "blockquote",
  "br",
  "cite",
  "code",
  "dd",
  "del",
  "details",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "q",
  "rb",
  "rp",
  "rt",
  "rtc",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
  "var",
] as const);

export const VEGA_HTML_ALLOWED_ATTRIBUTES = Object.freeze([
  "abbr",
  "colspan",
  "dir",
  "href",
  "lang",
  "open",
  "reversed",
  "rowspan",
  "scope",
  "start",
  "title",
  "type",
] as const);

const SAFE_URI = /^(?:(?:https?|mailto|tel):[^\s\\]*|(?:\/(?!\/)|[?#])[^:\s\\]*|[^:/?#\s\\]+(?:[/?#][^:\s\\]*)?)$/iu;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

const isSafeUri = (value: string): boolean => {
  const normalized = value.trim();
  return normalized.length > 0 && !CONTROL_CHARACTERS.test(normalized) && SAFE_URI.test(normalized);
};

const STRICT_HTML_CONFIG: Config & { RETURN_DOM_FRAGMENT: true } = {
  ALLOWED_ATTR: [...VEGA_HTML_ALLOWED_ATTRIBUTES],
  ALLOWED_TAGS: [...VEGA_HTML_ALLOWED_TAGS],
  ALLOWED_URI_REGEXP: SAFE_URI,
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORBID_ATTR: ["autofocus", "contenteditable", "nonce", "srcdoc", "style"],
  FORBID_TAGS: [
    "audio",
    "base",
    "button",
    "canvas",
    "embed",
    "form",
    "iframe",
    "img",
    "input",
    "link",
    "math",
    "meta",
    "object",
    "picture",
    "script",
    "select",
    "source",
    "style",
    "svg",
    "template",
    "textarea",
    "video",
  ],
  KEEP_CONTENT: true,
  PARSER_MEDIA_TYPE: "text/html",
  RETURN_DOM_FRAGMENT: true,
  RETURN_TRUSTED_TYPE: false,
  SANITIZE_DOM: true,
  SANITIZE_NAMED_PROPS: true,
};

Object.freeze(STRICT_HTML_CONFIG);

type Purifier = ReturnType<typeof createDOMPurify>;

const purifiers = new WeakMap<object, Purifier>();
const allowedTags = new Set<string>(VEGA_HTML_ALLOWED_TAGS);
const allowedAttributes = new Set<string>(VEGA_HTML_ALLOWED_ATTRIBUTES);
const contentDroppingTags = new Set<string>(STRICT_HTML_CONFIG.FORBID_TAGS ?? []);
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

const removeUnsafeNodesAndAttributes = (fragment: DocumentFragment): DocumentFragment => {
  const removeNode = (node: Node): void => {
    node.parentNode?.removeChild(node);
  };
  const clean = (node: Node): void => {
    if (node.nodeType === 8) {
      removeNode(node);
      return;
    }
    if (node.nodeType !== 1) {
      if (node.nodeType !== 3) removeNode(node);
      return;
    }

    const element = node as Element;
    const tag = element.localName.toLowerCase();
    if (element.namespaceURI !== HTML_NAMESPACE || !allowedTags.has(tag)) {
      if (element.namespaceURI !== HTML_NAMESPACE || contentDroppingTags.has(tag)) {
        element.remove();
        return;
      }
      for (const child of [...element.childNodes]) clean(child);
      element.replaceWith(...element.childNodes);
      return;
    }

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (!allowedAttributes.has(name) || (name === "href" && !isSafeUri(attribute.value))) {
        element.removeAttribute(attribute.name);
      }
    }
    for (const child of [...element.childNodes]) clean(child);
  };

  for (const child of [...fragment.childNodes]) clean(child);
  return fragment;
};

const purifierFor = (document: Document): Purifier => {
  const view = document.defaultView;
  if (!view) {
    throw new TypeError("Vega HTML rich text requires a document attached to a Window");
  }
  const key = view as unknown as object;
  const cached = purifiers.get(key);
  if (cached) return cached;
  const purifier = createDOMPurify(view);
  purifiers.set(key, purifier);
  return purifier;
};

const TAG_NAME_START = /[A-Za-z]/u;

const startsTagToken = (source: string, index: number): boolean => {
  const next = source[index + 1];
  if (!next) return false;
  if (TAG_NAME_START.test(next) || next === "!" || next === "?") {
    return true;
  }
  return next === "/" && TAG_NAME_START.test(source[index + 2] ?? "");
};

const findIncompleteTagTokenStart = (source: string): number | undefined => {
  let searchFrom = 0;
  while (searchFrom < source.length) {
    const start = source.indexOf("<", searchFrom);
    if (start < 0) return undefined;
    if (!startsTagToken(source, start)) {
      searchFrom = start + 1;
      continue;
    }

    if (source.startsWith("<!--", start)) {
      const commentEnd = source.indexOf("-->", start + 4);
      if (commentEnd < 0) return start;
      searchFrom = commentEnd + 3;
      continue;
    }

    let quote: "'" | '"' | undefined;
    let closed = false;
    for (let index = start + 1; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (character === quote) quote = undefined;
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      if (character === ">") {
        searchFrom = index + 1;
        closed = true;
        break;
      }
    }
    if (!closed) return start;
  }
  return undefined;
};

const sanitizeCompleteHtml = (document: Document, input: string): DocumentFragment => {
  const sanitized = purifierFor(document).sanitize(`<div>${input}</div>`, STRICT_HTML_CONFIG);
  if (sanitized.nodeType !== 11) {
    throw new TypeError("DOMPurify did not return a DocumentFragment");
  }
  const owned = sanitized.ownerDocument === document ? sanitized : document.importNode(sanitized, true);
  return removeUnsafeNodesAndAttributes(owned);
};

/**
 * Sanitize untrusted HTML into an inert fragment owned by `document`.
 *
 * The default policy intentionally excludes active, embedded, form, media,
 * SVG/MathML and styling surfaces. Consumers needing a broader policy should
 * provide another renderer rather than weakening this shared safe default.
 */
export const sanitizeHtmlToFragment = (document: Document, source: string): DocumentFragment => {
  const input = String(source);
  const incompleteAt = findIncompleteTagTokenStart(input);
  if (incompleteAt === undefined) {
    return sanitizeCompleteHtml(document, input);
  }
  const recovered = sanitizeCompleteHtml(document, input.slice(0, incompleteAt));
  recovered.append(document.createTextNode(input.slice(incompleteAt)));
  return recovered;
};

export const vegaHtmlRichTextRenderer: VegaRichTextRenderer = Object.freeze({
  id: "vega-html",
  formats: ["html"],
  render({ document, signal, source }: VegaRichTextRenderRequest) {
    if (signal.aborted) return document.createDocumentFragment();
    return sanitizeHtmlToFragment(document, source);
  },
});

const registerRenderer = (context: VegaPluginContext, renderer: VegaRichTextRenderer): VegaRichTextHandle => {
  const service = context.service(VEGA_RICH_TEXT_SERVICE);
  if (!service) {
    throw new ReferenceError("Vega HTML rich text requires haneoka.vega-richtext");
  }
  return service.register(renderer);
};

export const createVegaHtmlRichTextPlugin = (): VegaPlugin =>
  defineVegaPlugin({
    manifest: {
      id: "haneoka.vega-richtext-html",
      name: "Vega Rich Text HTML",
      version: "0.1.0",
      apiVersion: 1,
      description: "Strictly sanitized semantic HTML renderer for Vega",
      capabilities: ["rich-text"],
      dependencies: {
        "haneoka.vega-richtext": "^0.1.0",
      },
    },
    setup(context) {
      const registration = registerRenderer(context, vegaHtmlRichTextRenderer);
      return { dispose: () => registration.dispose() };
    },
  });

export const vegaHtmlRichTextPlugin = createVegaHtmlRichTextPlugin();

export default vegaHtmlRichTextPlugin;
