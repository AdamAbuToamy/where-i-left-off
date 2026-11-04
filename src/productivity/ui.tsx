import type { ReactNode } from "react";
export function FeatureStatus({
  error,
  message,
}: {
  error: string;
  message: string;
}) {
  return (
    <>
      {error && (
        <p role="alert" className="pilot-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </>
  );
}
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="pilot-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
