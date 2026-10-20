// Builds uml-viewer.html from the numbered Markdown files in this folder.
// Usage: node build-viewer.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => /^\d\d-.*\.md$/.test(f)).sort();
const docs = files.map((f) => ({ file: f, md: readFileSync(join(here, f), "utf8") }));
const data = JSON.stringify(docs).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TransitOps UML</title>
<style>
  :root { --bg:#f7f7f5; --fg:#1d1d1b; --muted:#6b6b66; --card:#fff; --line:#e3e2dc; --accent:#2f5bd3; }
  @media (prefers-color-scheme: dark) { :root { --bg:#161615; --fg:#ecebe6; --muted:#a3a29b; --card:#1f1f1d; --line:#33332f; --accent:#7ea0ff; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { position:sticky; top:0; z-index:2; background:var(--bg); border-bottom:1px solid var(--line); padding:12px 16px; display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  header strong { margin-right:8px; }
  header a { color:var(--accent); text-decoration:none; font-size:13px; padding:4px 8px; border:1px solid var(--line); border-radius:6px; }
  main { max-width:1200px; margin:0 auto; padding:16px; }
  section { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:8px 20px 20px; margin:16px 0; }
  h1 { font-size:22px; } h2 { font-size:17px; margin-top:28px; }
  .mermaid { overflow-x:auto; margin:12px 0; text-align:center; }
  table { border-collapse:collapse; font-size:13px; display:block; overflow-x:auto; }
  th, td { border:1px solid var(--line); padding:4px 8px; }
  code { font-size:13px; }
  p, li { color:var(--fg); }
</style>
</head>
<body>
<header><strong>TransitOps UML</strong><span id="nav"></span></header>
<main id="out"></main>
<script src="https://cdn.jsdelivr.net/npm/marked@15.0.6/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<script>
  const docs = ${data};
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "default", securityLevel: "strict" });
  const renderer = new marked.Renderer();
  renderer.code = ({ text, lang }) => lang === "mermaid"
    ? '<pre class="mermaid">' + text.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</pre>"
    : "<pre><code>" + text.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</code></pre>";
  const out = document.getElementById("out"), nav = document.getElementById("nav");
  docs.forEach((d, i) => {
    const s = document.createElement("section");
    s.id = "d" + i;
    s.innerHTML = marked.parse(d.md, { renderer });
    out.appendChild(s);
    const a = document.createElement("a");
    a.href = "#d" + i;
    a.textContent = d.file.replace(/^\\d\\d-|\\.md$/g, "").replace(/-/g, " ");
    nav.appendChild(a);
  });
  mermaid.run({ querySelector: ".mermaid" });
</script>
</body>
</html>`;

writeFileSync(join(here, "uml-viewer.html"), html);
console.log(`uml-viewer.html built from ${files.length} files`);
