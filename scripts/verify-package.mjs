import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("package.json", root), "utf8"),
);

if (
  !manifest.repository?.url?.endsWith(
    "/vega-plugin-richtext-html.git",
  )
) {
  throw new Error(
    "package repository must point to the independent HTML plugin repository",
  );
}
if (
  manifest.publishConfig?.access !== "public" ||
  manifest.publishConfig?.provenance !== true
) {
  throw new Error("public provenance publishing is required");
}
if (manifest.dependencies?.dompurify !== "3.4.12") {
  throw new Error("DOMPurify must remain pinned to 3.4.12");
}
if (
  manifest.peerDependencies?.["@haneoka/vega-plugin-richtext"] !== "^0.1.0"
) {
  throw new Error("the core rich-text service must remain a peer dependency");
}
if (!manifest.vega?.capabilities?.includes("rich-text")) {
  throw new Error("rich-text capability metadata is required");
}
await Promise.all([
  access(new URL("dist/index.js", root)),
  access(new URL("dist/index.d.ts", root)),
]);

process.stdout.write("HTML rich-text plugin package boundary verified\n");

