# Vega Rich Text HTML

Strict HTML rendering for Vega's format-neutral rich-text service.

```sh
pnpm add @haneoka/vega-plugin-richtext \
  @haneoka/vega-plugin-richtext-html
```

```ts
import { createVegaRichTextPlugin } from "@haneoka/vega-plugin-richtext";
import { vegaHtmlRichTextPlugin } from "@haneoka/vega-plugin-richtext-html";

await host.install(createVegaRichTextPlugin());
await host.install(vegaHtmlRichTextPlugin);
```

The `html` renderer uses DOMPurify 3.4.12 and always returns a
`DocumentFragment`. Its default allowlist keeps semantic text, ruby, lists and
tables while removing scripts, event handlers, inline styles, embeds, forms,
media, SVG/MathML, active URL protocols, arbitrary classes and IDs.

`sanitizeHtmlToFragment(document, source)` exposes the same safe transformation
for other renderer plugins.

MPL-2.0.
