import { useState } from "react";
import { Plus, Check, Trash2 } from "lucide-react";
import type { Language } from "../translations";
import type { SessionState } from "./domain";
import type { SessionControlValues } from "./control";
import { sessionWords } from "./words";
type Props = {
  state: SessionState;
  disabled: boolean;
  language: Language;
  view: "notes" | "checklist";
  onAction: (
    verb: SessionControlValues["verb"],
    text?: string,
    id?: string,
  ) => Promise<boolean>;
};
export function SessionManualEditor({
  state,
  disabled,
  language,
  onAction: manual,
  view,
}: Props) {
  const t = sessionWords[language],
    identity = state;
  const [newItem, setNewItem] = useState(""),
    [newNote, setNewNote] = useState(""),
    [editing, setEditing] = useState<{
      id: string;
      text: string;
      target: "items" | "notes";
    } | null>(null);
  return (
    <fieldset disabled={disabled} className="session-manual-controls">
      <legend className="sr-only">
        {view === "notes" ? t.notes : t.checklist}
      </legend>
      {view === "checklist" && (
        <div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void manual("add_item", newItem).then((ok) => {
                if (ok) setNewItem("");
              });
            }}
          >
            <label htmlFor={"session-item-" + identity.id}>{t.item}</label>
            <div className="session-input-row">
              <input
                id={"session-item-" + identity.id}
                maxLength={300}
                value={newItem}
                dir="auto"
                onChange={(event) => setNewItem(event.target.value)}
              />
              <button type="submit" disabled={!newItem.trim()}>
                <Plus size={16} />
                {t.add}
              </button>
            </div>
          </form>
          <ul className="session-checklist">
            {state.items.map((item) => (
              <li key={item.id} data-session-item={item.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(event) =>
                      void manual(
                        event.target.checked ? "complete_item" : "reopen_item",
                        undefined,
                        item.id,
                      )
                    }
                  />
                  <span dir="auto" className={item.done ? "is-done" : ""}>
                    {item.text}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      id: item.id,
                      text: item.text,
                      target: "items",
                    })
                  }
                  aria-label={t.edit + " " + item.text}
                >
                  {t.edit}
                </button>
                <button
                  type="button"
                  onClick={() => void manual("delete_item", undefined, item.id)}
                  aria-label={t.remove + " " + item.text}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {view === "notes" && (
        <div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void manual("add_note", newNote).then((ok) => {
                if (ok) setNewNote("");
              });
            }}
          >
            <label htmlFor={"session-note-" + identity.id}>{t.note}</label>
            <textarea
              id={"session-note-" + identity.id}
              rows={2}
              maxLength={1000}
              dir="auto"
              value={newNote}
              onChange={(event) => setNewNote(event.target.value)}
            />
            <button type="submit" disabled={!newNote.trim()}>
              <Plus size={16} />
              {t.add}
            </button>
          </form>
          <div className="session-notes">
            {state.notes.map((note) => (
              <article key={note.id} data-session-note={note.id}>
                <p dir="auto">{note.text}</p>
                <time dateTime={new Date(note.createdAt).toISOString()}>
                  {new Date(note.createdAt).toLocaleString(language)}
                </time>
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        id: note.id,
                        text: note.text,
                        target: "notes",
                      })
                    }
                  >
                    {t.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void manual("delete_note", undefined, note.id)
                    }
                  >
                    {t.remove}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
      {editing && editing.target === (view === "notes" ? "notes" : "items") && (
        <form
          className="session-inline-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void manual(
              editing.target === "items" ? "edit_item" : "edit_note",
              editing.text,
              editing.id,
            ).then((ok) => {
              if (ok) setEditing(null);
            });
          }}
        >
          <label htmlFor={"session-edit-" + identity.id + "-" + view}>
            {t.edit}
          </label>
          <textarea
            id={"session-edit-" + identity.id + "-" + view}
            value={editing.text}
            maxLength={editing.target === "items" ? 300 : 1000}
            dir="auto"
            onChange={(event) =>
              setEditing({ ...editing, text: event.target.value })
            }
          />
          <button type="submit">
            <Check size={16} />
            {t.save}
          </button>
          <button type="button" onClick={() => setEditing(null)}>
            {t.cancel}
          </button>
        </form>
      )}
    </fieldset>
  );
}
