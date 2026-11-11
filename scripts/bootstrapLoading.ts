import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Plugin } from "vite";
import LoadingScreenView from "../src/components/loadingScreenView.ts";
import { cloudText } from "../src/cloudTranslations.ts";
export function bootstrapLoading(): Plugin {
  const read = (path: string) =>
    readFileSync(fileURLToPath(new URL("../" + path, import.meta.url)), "utf8");
  return {
    name: "wilo-shared-loading",
    transformIndexHtml(html) {
      const palettes =
        read("src/Themes.css").match(/:root\s*\{[^}]+\}/)?.[0] || "";
      const main = read("src/App.css").match(/^main\s*\{[^}]+\}/m)?.[0] || "";
      const css =
        palettes +
        read("src/components/LoadingScreen.css") +
        read("src/DarkMode.css") +
        read("src/Backgrounds.css") +
        main +
        `
   :root{font-family:"Segoe UI",Tahoma,Arial,sans-serif}*{box-sizing:border-box}body{margin:0}
   #wilo-bootstrap [data-loading-locale]{display:none}
   html[lang=en] #wilo-bootstrap [data-loading-locale=en],html[lang=ar] #wilo-bootstrap [data-loading-locale=ar],html[lang=he] #wilo-bootstrap [data-loading-locale=he]{display:block}
   #wilo-bootstrap .boot-retry{position:fixed;inset:auto 12px max(16px,env(safe-area-inset-bottom));z-index:21;text-align:center;visibility:hidden;animation:boot-help 0s 15s forwards}#wilo-bootstrap .boot-retry a{color:var(--site-primary)}
   @keyframes boot-help{to{visibility:visible}}
   @media(min-width:761px){#wilo-bootstrap .workspace{padding-inline:clamp(62px,6vw,100px)}}
   @media(max-width:600px){#wilo-bootstrap main{padding:28px 18px 48px}}
   .wilo-no-script{max-width:560px;margin:15vh auto;font:18px/1.7 system-ui,sans-serif}
  `;
      const markup = (["en", "ar", "he"] as const)
        .map(
          (language) =>
            `<div data-loading-locale="${language}"><main class="workspace language-${language}">${renderToStaticMarkup(createElement(LoadingScreenView, { language, status: cloudText[language].loading }))}</main></div>`,
        )
        .join("");
      return html
        .replace("<!-- WILO_LOADING_STYLES -->", `<style>${css}</style>`)
        .replace("<!-- WILO_LOADING_VIEW -->", markup);
    },
  };
}
