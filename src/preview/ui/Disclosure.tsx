import { useId, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
export default function Disclosure({
  title,
  children,
  initial = false,
  className = "",
  keepMounted = false,
}: {
  title: ReactNode;
  children: ReactNode;
  initial?: boolean;
  className?: string;
  keepMounted?: boolean;
}) {
  const [open, setOpen] = useState(initial),
    id = useId();
  return (
    <section className={"preview-disclosure " + className}>
      <button
        className="secondary-button preview-disclosure-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {title}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={open ? "is-open" : ""}
        />
      </button>
      <AnimatePresence initial={false}>
        {(open || keepMounted) && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="preview-disclosure-panel"
            inert={!open}
            aria-hidden={!open}
          >
            <div>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
