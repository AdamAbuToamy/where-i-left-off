import { useState, useSyncExternalStore } from "react";
import type { Language } from "../translations";
import { createClientId } from "../lib/clientId";
import { useExperience } from "./context";
import { addNamedBoard } from "./boards";
import { Panel, FeatureStatus } from "./ui";
import { label, useFeatureAction } from "./helpers";
const query = "(min-width:1024px) and (pointer:fine)";
const subscribe = (cb: () => void) => {
  const m = matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
export default function BoardsPanel({ language }: { language: Language }) {
  const context = useExperience()!,
    desktop = useSyncExternalStore(
      subscribe,
      () => matchMedia(query).matches,
      () => false,
    ),
    [name, setName] = useState(""),
    action = useFeatureAction(language),
    t = (a: string, e: string) => label(language, a, e);
  if (!desktop)
    return (
      <Panel title={t("ألواحي", "My boards")}>
        <p>
          {t(
            "لوح التخطيط متاح للحاسوب فقط.",
            "Planning boards are desktop-only.",
          )}
        </p>
      </Panel>
    );
  return (
    <Panel title={t("ألواحي", "My boards")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(() => {
            context.change((state) =>
              addNamedBoard(state, createClientId(), name),
            );
            setName("");
          });
        }}
      >
        <label>
          {t("اسم اللوح", "Board name")}
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="primary-button" disabled={!name.trim()}>
          {t("إنشاء لوح", "Create board")}
        </button>
      </form>
      <FeatureStatus {...action} />
      <p>
        <a href="#/personal?board=default">
          {t("فتح لوح الخطة الأصلي", "Open the original planning board")} ↗
        </a>
      </p>
      <div className="pilot-list">
        {context.view.state.boards
          .filter((b) => !b.archived)
          .map((board) => (
            <article key={board.id}>
              <a
                href={
                  board.scope
                    ? "#/groups/" + board.scope + "?board=" + board.id
                    : "#/personal?board=" + board.id
                }
              >
                {board.name} ↗
              </a>
              <button
                onClick={() =>
                  void action.run(() =>
                    context.change((state) => ({
                      ...state,
                      boards: state.boards.map((b) =>
                        b.id === board.id ? { ...b, archived: true } : b,
                      ),
                    })),
                  )
                }
              >
                {t("إخفاء اللوح", "Hide board")}
              </button>
            </article>
          ))}
      </div>
      <details>
        <summary>
          {t(
            "ألواح مخفية — دون حذف محتواها",
            "Hidden boards — content retained",
          )}
        </summary>
        {context.view.state.boards
          .filter((b) => b.archived)
          .map((board) => (
            <p key={board.id}>
              {board.name}{" "}
              <button
                onClick={() =>
                  void action.run(() =>
                    context.change((state) => ({
                      ...state,
                      boards: state.boards.map((b) =>
                        b.id === board.id ? { ...b, archived: false } : b,
                      ),
                    })),
                  )
                }
              >
                {t("إظهار", "Restore")}
              </button>
            </p>
          ))}
      </details>
      <p className="pilot-muted">
        {t(
          "من داخل اللوح تستطيع التصدير كصورة PNG أو PDF وتحويل النوتة إلى بطاقة.",
          "Inside a board you can export PNG/PDF and convert a sticky note into a card.",
        )}
      </p>
    </Panel>
  );
}
