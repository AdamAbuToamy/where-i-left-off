import { createPortal } from "react-dom";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { Language } from "../translations";
import { useExperience } from "./context";
import { label } from "./helpers";
import type { ComponentType } from "react";
const modules = import.meta.glob<{
  default: ComponentType<{
    user: User;
    language: Language;
    selected?: string;
    inHub?: boolean;
  }>;
}>("./*Panel.tsx");
const definitions = [
  ["inbox", "InboxPanel", "الوارد", "Inbox"],
  ["today", "ResumePanel", "اليوم", "Today"],
  ["relations", "RelationsPanel", "العلاقات", "Relationships"],
  ["time", "SchedulePanel", "وقت العمل", "Work time"],
  ["review", "ReviewPanel", "المراجعة", "Review"],
  ["study", "StudyPanel", "الجامعة", "University"],
  ["assistant", "AssistantPanel", "المساعد", "Assistant"],
  ["history", "HistoryPanel", "السجل", "History"],
  ["templates", "TemplatesPanel", "قوالب وتكرار", "Templates & repeat"],
  ["boards", "BoardsPanel", "ألواحي", "My boards"],
];
const panels = definitions.flatMap(([id, file, ar, en]) => {
  const load = modules["./" + file + ".tsx"];
  return load ? [{ id, ar, en, Component: lazy(load) }] : [];
});
export default function WorkHub({
  user,
  language,
  close,
  initialTab = "inbox",
  selected = "",
}: {
  user: User;
  language: Language;
  close: () => void;
  initialTab?: string;
  selected?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    context = useExperience()!,
    [tab, setTab] = useState(initialTab),
    t = (a: string, e: string) => label(language, a, e);
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  const selectedPanel = panels.find((panel) => panel.id === tab) || panels[0],
    Component = selectedPanel.Component;

  return createPortal(
    <dialog
      ref={dialog}
      className="pilot-dialog"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('a[href^="#/"]')) close();
      }}
      dir={language === "en" ? "ltr" : "rtl"}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-label={t("مركز العمل", "Work hub")}
    >
      <header>
        <strong>{t("مركز العمل", "Work hub")}</strong>
        <small role="status">
          {context.view.pending || !!context.cards?.queued
            ? t(
                "محفوظ محليًا · بانتظار المزامنة",
                "Saved locally · sync pending",
              )
            : context.view.ready
              ? t("محفوظ في حسابك", "Saved to account")
              : t("نسخة محلية", "Local copy")}
        </small>
        <button
          aria-label={t("إغلاق مركز العمل", "Close work hub")}
          onClick={close}
        >
          ×
        </button>
      </header>
      {context.view.error && (
        <p role="alert">
          {t(
            "يوجد عائق في الحفظ. احتفظ بنسختك المحلية.",
            "Saving needs attention. Keep your local copy.",
          )}
          <button onClick={() => context.repository.retry()}>
            {t("إعادة المحاولة", "Retry")}
          </button>
        </p>
      )}
      {context.view.conflict && (
        <section role="alert">
          <p>
            {t(
              "تغيّر مركز العمل على جهاز آخر. اختر النسخة المطلوبة.",
              "The hub changed on another device. Choose a version.",
            )}
          </p>
          <button onClick={() => context.repository.resolve("local")}>
            {t("نسختي", "Keep mine")}
          </button>
          <button onClick={() => context.repository.resolve("remote")}>
            {t("نسخة الحساب", "Use account version")}
          </button>
        </section>
      )}
      <nav
        className="pilot-tabs"
        role="tablist"
        aria-label={t("أدوات العمل", "Work tools")}
      >
        {panels.map(({ id, ar, en }) => (
          <button
            key={id}
            role="tab"
            aria-selected={selectedPanel.id === id}
            onClick={() => setTab(id)}
          >
            {t(ar, en)}
          </button>
        ))}
      </nav>
      <Suspense fallback={<p role="status">…</p>}>
        <Component user={user} language={language} selected={selected} inHub />
      </Suspense>
    </dialog>,
    document.body,
  );
}
