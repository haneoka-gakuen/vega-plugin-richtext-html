# Security

## Supported versions

Security fixes are provided for the latest release.

## Reporting

Report vulnerabilities privately through GitHub Security Advisories for
`haneoka-gakuen/vega-plugin-richtext-html`. Do not open a public issue for an
unpatched vulnerability.

Include the input, rendered result, execution environment, impact, and a
minimal reproduction. Avoid including private story content.

## Security boundary

All HTML source is untrusted. The supported boundary is the exported strict
DOMPurify policy. It deliberately excludes scripts, styles, embeds, forms,
media, SVG/MathML, event attributes, active URL schemes and DOM-clobbering
names. Do not weaken that policy to support application-specific markup; add a
separate renderer with an explicit threat model instead.
