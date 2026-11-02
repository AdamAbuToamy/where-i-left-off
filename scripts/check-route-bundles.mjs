import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";
import ts from "typescript";

// Inspect actual built static imports; dynamic imports remain outside the startup graph.
const root = resolve("dist");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const entry = /<script\b[^>]*\bsrc="(\/assets\/[^"?#]+\.js)"/.exec(html)?.[1];
if (!entry) throw new Error("Built entry script missing");
const visited = new Set();
function visit(file) {
  if (visited.has(file)) return;
  if (!file.startsWith(root + sep) || !existsSync(file))
    throw new Error("Invalid build import");
  visited.add(file);
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.JS,
  );
  for (const statement of source.statements) {
    if (
      !(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
    )
      continue;
    const specifier = statement.moduleSpecifier;
    if (
      specifier &&
      ts.isStringLiteral(specifier) &&
      specifier.text.endsWith(".js") &&
      specifier.text.startsWith(".")
    )
      visit(resolve(dirname(file), specifier.text));
  }
}
const entryPath = resolve(root, entry.slice(1));
visit(entryPath);
const files = [...visited].map((file) => ({
  path: relative(root, file),
  bytes: readFileSync(file).length,
  gzipBytes: gzipSync(readFileSync(file)).length,
}));
const eagerRoutes = files.filter((file) =>
  /(?:AdminDashboard|ProfileSettings|AnalyticsPage|LibraryPage|UniversityPage|NotificationSettings)-/.test(
    file.path,
  ),
);
const result = {
  status: eagerRoutes.length ? "failed" : "passed",
  entryBytes: readFileSync(entryPath).length,
  entryGzipBytes: gzipSync(readFileSync(entryPath)).length,
  startupJavaScriptBytes: files.reduce((n, f) => n + f.bytes, 0),
  startupJavaScriptGzipBytes: files.reduce((n, f) => n + f.gzipBytes, 0),
  files,
  eagerRoutes,
};
console.log(JSON.stringify(result, null, 2));
if (eagerRoutes.length) process.exitCode = 1;
