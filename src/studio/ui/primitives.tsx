import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X, ArrowUpRight, Ellipsis } from "lucide-react";
import { useStudio } from "./context";
export function StudioDialog({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    { t } = useStudio();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"studio-dialog" + (wide ? " studio-dialog-wide" : "")}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="st-icon-button"
          type="button"
          onClick={close}
          aria-label={t("close")}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const { t } = useStudio();
  return (
    <div className="st-empty">
      <span className="st-empty-orbit" aria-hidden="true" />
      <h3>{title || t("empty")}</h3>
      <p>{children || t("emptyHint")}</p>
      {action}
    </div>
  );
}
export function MoreMenu({ children }: { children: ReactNode }) {
  const { t } = useStudio();
  return (
    <details className="st-more">
      <summary aria-label={t("more")}>
        <Ellipsis size={20} />
      </summary>
      <div>{children}</div>
    </details>
  );
}
export function ExternalLink({
  url,
  children,
}: {
  url: string;
  children?: ReactNode;
}) {
  const { t } = useStudio();
  let safe: boolean;
  try {
    safe = ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    safe = false;
  }
  return safe ? (
    <a className="st-link" href={url} target="_blank" rel="noopener noreferrer">
      {children || t("openLink")}
      <ArrowUpRight size={14} />
    </a>
  ) : null;
}
export function DueLabel({ value }: { value: string }) {
  const { state, now, t } = useStudio();
  if (!value) return <span className="st-muted">{t("noDate")}</span>;
  const date = new Date(value),
    today = new Date(now),
    tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const label = same(date, today)
    ? t("today")
    : same(date, tomorrow)
      ? t("tomorrow")
      : new Intl.DateTimeFormat(state.settings.language, {
          day: "numeric",
          month: "short",
        }).format(date);
  const time = value.includes("T")
    ? " · " +
      new Intl.DateTimeFormat(state.settings.language, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date)
    : "";
  return (
    <time
      dateTime={value}
      className={
        Date.parse(value) < now && !same(date, today) ? "st-overdue" : ""
      }
      title={date.toLocaleString(state.settings.language)}
    >
      {label}
      {time}
    </time>
  );
}

/** Optimistic control only; the repository remains the source of committed data. */
export function AsyncCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => Promise<boolean>;
  label?: string;
}) {
  const [pending, setPending] = useState<boolean | null>(null);
  return (
    <input
      type="checkbox"
      checked={pending ?? checked}
      disabled={pending !== null}
      aria-label={label}
      onChange={(event) => {
        const value = event.currentTarget.checked;
        setPending(value);
        void onChange(value).finally(() => setPending(null));
      }}
    />
  );
}
