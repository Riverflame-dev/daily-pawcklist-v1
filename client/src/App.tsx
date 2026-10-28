import {
useEffect,
useLayoutEffect,
useRef,
useState,
type FormEvent,
type ReactNode,
type RefObject,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";
import blackCat from "./assets/black-cat.png";
import reminderNote from "./assets/reminder-note.png";
import pencilCat from "./assets/pencil-cat.png";
import hangingFish from "./assets/hanging-fish.png";
import closeX from "./assets/close-x.png";
import peekCatFace from "./assets/peek-cat-face.png";

const EMPTY_TAGS: string[] = [];

type DayData = ApiResponse<typeof api, "getDay">;
type Task = DayData["tasks"][number];
type Template = DayData["templates"][number];
type Habit = DayData["habits"][number];

const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const WEEKDAY_PLURAL = [
  "Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DOW_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayKey(): string {
  return toKey(new Date());
}
function parseKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}
function shiftKey(key: string, days: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}
function weekStartKey(key: string): string {
  const d = parseKey(key);
  d.setDate(d.getDate() - d.getDay());
  return toKey(d);
}
function heroDateLabel(key: string): string {
  const d = parseKey(key);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function weekdayName(key: string): string {
  return WEEKDAY_NAMES[parseKey(key).getDay()] ?? "";
}
function shortWhen(t: Template): string {
  let base: string;
  if (t.kind === "once") {
    base = t.specificDate ? heroDateLabel(t.specificDate) : "One-time";
  } else {
    switch (t.schedule) {
      case "daily": base = "Every day"; break;
      case "weekdays": base = "Weekdays"; break;
      case "weekends": base = "Sat & Sun"; break;
      case "weekly": base = WEEKDAY_PLURAL[t.weekday ?? 1] ?? "Weekly"; break;
      default: base = t.schedule;
    }
  }
  return t.notifySlot ? `${base} · ${t.notifySlot}` : base;
}

/* ---------- shared svg shapes ---------- */
function Sprites() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="paw" viewBox="0 0 24 24">
          <ellipse cx="6.4" cy="9.6" rx="1.8" ry="2.5" transform="rotate(-20 6.4 9.6)" />
          <ellipse cx="10.2" cy="6.4" rx="1.95" ry="2.7" transform="rotate(-6 10.2 6.4)" />
          <ellipse cx="14.4" cy="6.4" rx="1.95" ry="2.7" transform="rotate(6 14.4 6.4)" />
          <ellipse cx="18" cy="9.6" rx="1.8" ry="2.5" transform="rotate(20 18 9.6)" />
          <path d="M12.2 11.4c3.1 0 6 2.6 6 5.1 0 1.7-1.3 2.8-3 2.8-1.1 0-1.9-.5-3-.5s-1.9.5-3 .5c-1.7 0-3-1.1-3-2.8 0-2.5 2.9-5.1 6-5.1Z" />
        </symbol>
        <symbol id="star5" viewBox="0 0 24 24">
          <path d="M12 1.6l3.1 6.9 7.5.7-5.6 5 1.6 7.4L12 17.9l-6.6 3.7L7 14.2l-5.6-5 7.5-.7L12 1.6Z" />
        </symbol>
        <symbol id="cathead" viewBox="0 0 331 302">
          <path d="M 53.0 1.0 C 57.0 0.5, 62.0 4.5, 66.3 6.8 C 70.7 9.1, 74.9 12.1, 79.1 15.0 C 83.3 17.9, 87.4 20.9, 91.4 24.1 C 95.5 27.3, 99.4 30.8, 103.4 34.1 C 107.5 37.4, 111.2 42.1, 115.6 43.7 C 120.0 45.4, 125.1 44.4, 130.0 44.0 C 134.9 43.6, 139.8 41.8, 144.9 41.2 C 150.0 40.5, 155.3 40.1, 160.6 40.0 C 165.9 39.9, 171.3 40.0, 176.6 40.4 C 181.8 40.8, 186.9 41.4, 191.9 42.3 C 197.0 43.1, 202.0 46.0, 206.7 45.5 C 211.3 44.9, 215.5 41.7, 219.7 38.8 C 223.9 36.0, 227.6 31.9, 231.6 28.6 C 235.6 25.4, 239.8 22.4, 243.9 19.3 C 248.0 16.2, 252.0 12.9, 256.2 10.1 C 260.5 7.4, 265.0 3.9, 269.4 2.9 C 273.8 1.8, 279.1 1.6, 282.6 3.9 C 286.0 6.2, 288.2 12.3, 290.3 16.8 C 292.4 21.3, 293.7 26.1, 295.1 30.9 C 296.5 35.7, 297.5 40.7, 298.6 45.6 C 299.7 50.5, 300.8 55.5, 301.7 60.5 C 302.5 65.5, 303.0 70.7, 303.7 75.8 C 304.3 80.9, 305.3 85.9, 305.7 91.1 C 306.1 96.3, 305.3 102.0, 306.0 107.1 C 306.7 112.2, 308.2 117.0, 310.0 121.6 C 311.8 126.3, 314.7 130.4, 316.7 134.9 C 318.8 139.5, 320.5 144.2, 322.0 148.9 C 323.6 153.6, 324.7 158.6, 326.0 163.4 C 327.2 168.3, 329.0 173.0, 329.5 178.1 C 330.1 183.1, 330.0 188.7, 329.4 193.8 C 328.8 198.8, 327.1 203.6, 325.8 208.4 C 324.5 213.3, 323.5 218.2, 321.8 222.9 C 320.1 227.6, 318.0 232.1, 315.7 236.5 C 313.3 240.9, 310.6 245.2, 307.6 249.3 C 304.6 253.5, 301.3 257.7, 297.7 261.3 C 294.0 265.0, 289.8 268.4, 285.7 271.3 C 281.5 274.3, 277.2 276.9, 272.8 279.3 C 268.4 281.6, 263.8 283.4, 259.2 285.3 C 254.6 287.2, 250.0 289.2, 245.3 290.7 C 240.5 292.2, 235.5 293.0, 230.5 294.1 C 225.6 295.2, 220.8 296.5, 215.7 297.4 C 210.7 298.2, 205.5 298.6, 200.3 299.1 C 195.1 299.5, 189.9 299.8, 184.6 300.0 C 179.3 300.2, 173.8 300.1, 168.5 300.2 C 163.2 300.4, 158.0 301.0, 152.7 301.0 C 147.4 301.0, 142.1 300.6, 136.9 300.1 C 131.7 299.7, 126.6 299.1, 121.5 298.4 C 116.4 297.7, 111.4 296.8, 106.4 295.9 C 101.4 295.0, 96.4 294.0, 91.5 292.8 C 86.7 291.5, 81.9 290.0, 77.2 288.4 C 72.5 286.8, 67.8 285.1, 63.3 283.0 C 58.8 281.0, 54.3 278.8, 50.0 276.1 C 45.7 273.5, 41.5 270.5, 37.6 267.2 C 33.6 263.8, 29.6 259.9, 26.1 256.0 C 22.7 252.1, 19.4 248.0, 16.7 243.7 C 14.1 239.5, 11.9 235.0, 10.0 230.4 C 8.0 225.8, 6.4 221.1, 4.9 216.4 C 3.5 211.6, 1.9 206.9, 1.1 201.8 C 0.2 196.8, 0.0 191.4, 0.0 186.1 C -0.0 180.9, 0.2 175.4, 1.0 170.4 C 1.7 165.3, 3.1 160.5, 4.5 155.7 C 5.8 150.9, 7.5 146.2, 9.3 141.5 C 11.0 136.9, 13.0 132.3, 15.1 127.8 C 17.2 123.3, 20.6 119.3, 21.9 114.5 C 23.2 109.6, 22.7 104.1, 23.0 98.8 C 23.3 93.6, 23.3 88.2, 23.8 83.0 C 24.3 77.8, 25.0 72.7, 25.8 67.7 C 26.5 62.6, 27.4 57.6, 28.4 52.6 C 29.4 47.7, 30.5 42.7, 31.8 37.9 C 33.1 33.0, 34.5 28.2, 36.2 23.6 C 37.9 18.9, 39.2 13.6, 42.0 9.8 C 44.8 6.1, 48.9 1.5, 53.0 1.0 Z" />
        </symbol>
      </defs>
    </svg>
  );
}

function PawUse({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <use href="#paw" />
    </svg>
  );
}
function StarUse({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <use href="#star5" />
    </svg>
  );
}
function RepeatIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 3v4h-4" />
    </svg>
  );
}
function SentIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 3L10.2 13.8M21 3l-6.8 18-3.9-7.1L3 9.9 21 3Z" />
    </svg>
  );
}
// One-time reminders get a clearly different icon from the repeating
// circular arrow: a calendar with a single marked day.
function OneTimeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <circle cx="12" cy="15.5" r="1.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ---------- task ⋮ pop-up icons ---------- */
// The ⋮ pop-up is a horizontal icon bar (calendar / pencil / trash),
// drawn in this app's own stroke style like the icons above.
function CalendarNextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <circle cx="8.8" cy="15.3" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15.2" cy="15.3" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
function PencilEditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
      <path d="M15 5l4 4" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 6h17M8 6V4.2A1.2 1.2 0 0 1 9.2 3h5.6A1.2 1.2 0 0 1 16 4.2V6M19 6l-0.9 13.1A2 2 0 0 1 16.1 21H7.9a2 2 0 0 1-2-1.9L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}


/* ---------- centered pop-up that springs from its trigger ---------- */
function Popup({
  open,
  onClose,
  triggerRef,
  label,
  id,
  children,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  label: string;
  id?: string;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      setClosing(true);
      const t = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 225);
      return () => clearTimeout(t);
    }
  }, [open ]);

  useLayoutEffect(() => {
    if (!mounted || !sheetRef.current) return;
    const sheet = sheetRef.current;
    const trig = triggerRef.current;
    let origin = "50% 50%";
    if (trig) {
      const sr = sheet.getBoundingClientRect();
      const tr = trig.getBoundingClientRect();
      if (sr.width && sr.height) {
        const ox = Math.min(Math.max(tr.left + tr.width / 2 - sr.left, 0), sr.width);
        const oy = Math.min(Math.max(tr.top + tr.height / 2 - sr.top, 0), sr.height);
        origin = `${ox}px ${oy}px`;
      }
    }
    sheet.style.transformOrigin = origin;
  }, [mounted, closing, triggerRef]);

  useEffect(() => {
    if (!mounted) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;
  return (
    <div className={`sheet-wrap${closing ? " closing" : ""}`} id={id}>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <section
        ref={sheetRef}
        className={`sheet ${closing ? "pop-out" : "pop-in"}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </section>
    </div>
  );
}

/* ---------- task row ---------- */
function TaskRow({
  task,
  nextDay = false,
  onToggle,
  onEdit,
  onDelete,
  onMoveToNextDay,
  registerTrigger,
}: {
  task: Task;
  // True for the historical copy on the day the task was added, once the
  // task has moved on — rolled over to a later day, manually moved to a
  // later day, or checked off on a later day: it is greyed out and shows
  // a rollover note after the task instead of a tag — "Didn't get done,
  // rolled over to next day" while still open, changing to "Completed
  // later" once it has been finished on a future date. This copy is NOT
  // checkable: once a task was left unchecked for that day it cannot be
  // checked off from that day later — it can only be checked off on the
  // later day it lives on. The ⋮ menu is its only interactive element,
  // and it offers edit / delete only. The live copy — on today (or
  // whichever later day it is viewed on) — never gets this flag, so it
  // looks exactly like any other task, with no note.
  nextDay?: boolean;
  onToggle: (task: Task) => void;
  onEdit: (task: Task, el: HTMLElement | null) => void;
  onDelete: (task: Task) => void;
  onMoveToNextDay: (task: Task) => void;
  registerTrigger: (el: HTMLElement | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function closeMenu() {
    if (!menuOpen || menuClosing) return;
    setMenuClosing(true);
    closeTimer.current = setTimeout(() => {
      setMenuOpen(false);
      setMenuClosing(false);
      setConfirmingDelete(false);
    }, 160);
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && rowRef.current && !rowRef.current.contains(target)) {
        closeMenu();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, menuClosing]);

  const hasMetaRow = Boolean(task.tags.length > 0 || task.timeHint);
  // A next-day (rolled-over) copy is never checkable from its added
  // day — not while it is still open, and not after it was completed
  // on a later day. Its paw button and body stay inert; only the ⋮
  // menu (edit / delete) is interactive on that copy.
  const toggleLocked = nextDay;
  const rolloverNote = nextDay
    ? task.done
      ? "Completed later"
      : "Didn't get done, rolled over to next day"
    : null;

  return (
    <article
      ref={rowRef}
      className={`task${task.done ? " done" : ""}${nextDay ? " next-day" : ""}`}
      aria-disabled={toggleLocked || undefined}
    >
      <button
        type="button"
        className="paw-btn"
        role="checkbox"
        aria-checked={task.done}
        aria-label={`Mark "${task.title}" as ${task.done ? "not done" : "done"}`}
        disabled={toggleLocked}
        onClick={() => {
          if (!toggleLocked) onToggle(task);
        }}
      >
        <PawUse />
      </button>
      <button
        type="button"
        className="task-body"
        aria-label={`Toggle "${task.title}"`}
        disabled={toggleLocked}
        onClick={() => {
          if (!toggleLocked) onToggle(task);
        }}
      >
        <span className="task-text" style={{ display: "block" }}>{task.title}</span>
        {hasMetaRow && (
          <span className="task-note-row">
            {task.tags.map((tag) => (
              <span key={tag} className="task-tag">{tag}</span>
            ))}
            {task.timeHint && <span className="task-time">{task.timeHint}</span>}
          </span>
        )}
        {rolloverNote && <span className="rollover-note">{rolloverNote}</span>}
      </button>
      <button
        ref={menuBtnRef}
        type="button"
        className="task-menu"
        aria-label={`More actions for "${task.title}"`}
        aria-expanded={menuOpen}
        onClick={() => {
          if (menuOpen) {
            closeMenu();
          } else {
            registerTrigger(menuBtnRef.current);
            setConfirmingDelete(false);
            setMenuOpen(true);
          }
        }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.9" />
          <circle cx="12" cy="12" r="1.9" />
          <circle cx="12" cy="19" r="1.9" />
        </svg>
      </button>
      {menuOpen && (
        <div className={`task-pop${menuClosing ? " out" : ""}`} role="menu" aria-label={`Actions for "${task.title}"`}>
          {!nextDay && (
          <button
            type="button"
            className="pop-ic"
            aria-label="Move to next day"
            title="Move to next day"
            onClick={() => {
              closeMenu();
              onMoveToNextDay(task);
            }}
          >
            <CalendarNextIcon />
          </button>
          )}
          <button
            type="button"
            className="pop-ic"
            aria-label="Edit"
            title="Edit"
            onClick={() => {
              const el = menuBtnRef.current;
              closeMenu();
              onEdit(task, el);
            }}
          >
            <PencilEditIcon />
          </button>
          {confirmingDelete ? (
            <button
              type="button"
              className="pop-ic danger confirming"
              aria-label="Tap again to delete"
              title="Tap again to delete"
              onClick={() => {
                closeMenu();
                onDelete(task);
              }}
            >
              <TrashIcon />
              <span>Delete?</span>
            </button>
          ) : (
            <button
              type="button"
              className="pop-ic danger"
              aria-label="Delete"
              title="Delete"
              onClick={() => setConfirmingDelete(true)}
            >
              <TrashIcon />
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/* ---------- logs (in-place manage) ---------- */
function LogsSection({
  habits,
  isToday,
  onToggle,
  onAdd,
  onDelete,
  adding,
  onAddTask,
  addTaskRef,
}: {
  habits: Habit[];
  isToday: boolean;
  onToggle: (habit: Habit) => void;
  onAdd: (label: string) => void;
  onDelete: (habit: Habit) => void;
  adding: boolean;
  onAddTask: () => void;
  addTaskRef: RefObject<HTMLButtonElement | null>;
}) {
  const [managing, setManaging] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  function submitAdd(e: FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    onAdd(newLabel.trim());
    setNewLabel("");
  }

  return (
    <section aria-label="Logs">
      <div className="section-head">
        <span className="section-title">LOGS</span>
        <span className="head-actions">
          <button
            ref={addTaskRef}
            type="button"
            className="icon-btn"
            aria-label="Add task"
            title="Add a task"
            onClick={onAddTask}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            className={`icon-btn${managing ? " editing" : ""}`}
            aria-expanded={managing}
            aria-label={managing ? "Done managing log buttons" : "Manage log buttons"}
            title={managing ? "Done managing" : "Manage log buttons"}
            onClick={() => {
              setManaging((v) => !v);
              setConfirmDeleteId(null);
            }}
          >
            {managing ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
                <circle cx="15" cy="7" r="2.2" />
                <circle cx="9" cy="17" r="2.2" />
              </svg>
            )}
          </button>
        </span>
      </div>

      {habits.length === 0 && !managing ? (
        <p style={{ fontSize: 13.5, color: "var(--dim)", fontWeight: 600 }}>
          No buttons yet — tap the manage icon above to add one.
        </p>
      ) : (
        <div className={`logs${managing ? " editing" : ""}`}>
          {habits.map((h) =>
            managing ? (
              <span
                key={h.id}
                className={`log-pill${confirmDeleteId === h.id ? " confirming" : ""}`}
              >
                {h.label}
                <button
                  type="button"
                  className="log-remove"
                  style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}
                  aria-label={
                    confirmDeleteId === h.id
                      ? `Confirm removing "${h.label}" button`
                      : `Remove "${h.label}" button`
                  }
                  onClick={() => {
                    if (confirmDeleteId === h.id) {
                      setConfirmDeleteId(null);
                      onDelete(h);
                    } else {
                      setConfirmDeleteId(h.id);
                    }
                  }}
                >
                  {confirmDeleteId === h.id ? (
                    <span style={{ fontSize: 13, fontWeight: 900 }}>?</span>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  )}
                </button>
              </span>
            ) : (
              <button
                key={h.id}
                type="button"
                className={`log-pill${h.done ? " on" : ""}`}
                aria-pressed={h.done}
                aria-label={`Mark "${h.label}" as ${h.done ? "not done" : "done"} ${isToday ? "today" : "this day"}`}
                onClick={() => onToggle(h)}
              >
                <PawUse className="paw-ic" />
                {h.label}
              </button>
            ),
          )}
        </div>
      )}
      {managing && confirmDeleteId !== null && (
        <p style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: "var(--danger)" }}>
          Tap ? again to remove that button. Past days stay in your history.
        </p>
      )}
      {managing && (
        <form onSubmit={submitAdd} className="logs-add">
          <input
            className="logs-add-field"
            aria-label="Name for a new log button"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Add one, e.g. Read"
            maxLength={60}
          />
          <button type="submit" className="logs-add-btn" disabled={adding || !newLabel.trim()}>
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
      )}
    </section>
  );
}

/* ---------- add / edit task pop-up ---------- */
// A task is a title plus tags — there is no note field any more.
// Tags are separated by the Enter key only: typing in the field and
// pressing Enter turns what was typed into a tag chip.
function splitTags(raw: string): string[] {
  const tag = raw.trim();
  return tag === "" ? [] : [tag];
}

function mergeTags(existing: string[], incoming: string[]): string[] {
  const out = [...existing];
  const seen = new Set(existing.map((t) => t.toLowerCase()));
  for (const tag of incoming) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

function TaskFormPopup({
  open,
  onClose,
  triggerRef,
  title,
  initialTitle,
  initialTags,
  saving,
  saveLabel,
  submitLabel,
  isEdit,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  title: string;
  initialTitle: string;
  initialTags: string[];
  saving: boolean;
  saveLabel: string;
  submitLabel: string;
  isEdit: boolean;
  onSave: (values: { title: string; tags: string[] }) => void;
}) {
  const [text, setText] = useState(initialTitle);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (open) {
      setText(initialTitle);
      setTags(initialTags);
      setTagInput("");
    }
  }, [open, initialTitle, initialTags]);

  // Enter is the only separator: it finishes the tag in the field.
  function commitTagInput(): string[] {
    const finalTags = mergeTags(tags, splitTags(tagInput));
    setTags(finalTags);
    setTagInput("");
    return finalTags;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSave({ title: text.trim(), tags: mergeTags(tags, splitTags(tagInput)) });
  }

  return (
    <Popup open={open} onClose={onClose} triggerRef={triggerRef} label={title} id="sheetTaskForm">
      <form onSubmit={submit}>
        <div className="sheet-head">
          <span className="sheet-title">
            {!isEdit && <img className="new-task-art" src={pencilCat} alt="" />}
            {title}
          </span>
          <span className="sheet-actions">
            <button type="button" className="x-btn" onClick={onClose} aria-label="Cancel">
              <img src={closeX} alt="" />
            </button>
          </span>
        </div>
        <input
          className="field"
          aria-label="Task title"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Task…"
          autoFocus={open}
        />
        <div className="task-tags-row">
          <input
            className="field tags-field"
            aria-label="Tags — press Enter after each tag"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Enter separates tags; it does not submit the form.
                e.preventDefault();
                commitTagInput();
              } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
                setTags((prev) => prev.slice(0, -1));
              }
            }}
            placeholder="Add a tag, then press Enter"
          />
          <button
            type="submit"
            className="send-btn"
            disabled={saving || !text.trim()}
            aria-label={saveLabel}
          >
            {isEdit ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4.5 12.5l5 5L19.5 7" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
            <span>{saving ? (isEdit ? "Saving…" : "Adding…") : submitLabel}</span>
          </button>
        </div>
        {tags.length > 0 && (
          <div className="tag-chips">
            {tags.map((tag) => (
              <span key={tag} className="task-tag tag-chip">
                {tag}
                <button
                  type="button"
                  className="tag-chip-x"
                  aria-label={`Remove tag "${tag}"`}
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </form>
    </Popup>
  );
}

/* ---------- reminders manager pop-up ---------- */
function RemindersPopup({
  open,
  onClose,
  triggerRef,
  templates,
  selectedDate,
  onToggleActive,
  onDelete,
  onAdd,
  adding,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  templates: Template[];
  selectedDate: string;
  onToggleActive: (t: Template) => void;
  onDelete: (t: Template) => void;
  onAdd: (values: {
    title: string;
    schedule?: "daily" | "weekdays" | "weekends" | "weekly";
    weekday?: number;
    kind: "repeat" | "once";
    specificDate?: string;
    notifySlot: "AM" | "PM";
  }) => Promise<void>;
  adding: boolean;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"repeat" | "once">("repeat");
  const [notifySlot, setNotifySlot] = useState<"AM" | "PM">("AM");
  const [schedule, setSchedule] = useState<"daily" | "weekdays" | "weekends" | "weekly">("daily");
  const [weekday, setWeekday] = useState(1);
  const [specificDate, setSpecificDate] = useState(selectedDate);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [justSent, setJustSent] = useState(false);
  const sentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) setSpecificDate(selectedDate);
  }, [open, selectedDate]);

  useEffect(() => {
    return () => {
      if (sentTimer.current) clearTimeout(sentTimer.current);
    };
  }, []);

  // One-time reminders are deliberately NOT listed here: they are sent
  // once and simply show in that day's REMINDERS card, so there is no
  // entry to manage and the editing page stays free of them.
  const repeating = templates.filter((t) => t.kind !== "once");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (kind === "once" && !specificDate) return;
    const isOnce = kind === "once";
    try {
      await onAdd({
        title: title.trim(),
        kind,
        notifySlot,
        schedule: isOnce ? undefined : schedule,
        weekday: !isOnce && schedule === "weekly" ? weekday : undefined,
        specificDate: isOnce ? specificDate : undefined,
      });
    } catch {
      return;
    }
    setTitle("");
    if (isOnce) {
      setNotifySlot("AM");
      setSpecificDate(selectedDate);
      setJustSent(true);
      if (sentTimer.current) clearTimeout(sentTimer.current);
      sentTimer.current = setTimeout(() => setJustSent(false), 1400);
    }
  }

  return (
    <Popup open={open} onClose={onClose} triggerRef={triggerRef} label="Manage reminders" id="sheetReminders">
      <div className="sheet-head">
        <span className="sheet-title">
          <img className="sheet-fish" src={hangingFish} alt="" />
          REMINDERS
        </span>
        <span className="sheet-actions">
          <button type="button" className="x-btn" onClick={onClose} aria-label="Close reminders">
            <img src={closeX} alt="" />
          </button>
        </span>
      </div>

      {repeating.length > 0 && (
        <div className="rep-list">
          {repeating.map((t) => (
            <div key={t.id} className="rep-item">
              <RepeatIcon className="rep-ic" />
              <span className={`rep-text${t.active ? "" : " off"}`}>{t.title}</span>
              <span className="rep-when">{shortWhen(t)}</span>
              <button
                type="button"
                className={`switch${t.active ? " on" : ""}`}
                role="switch"
                aria-checked={t.active}
                aria-label={`${t.title} repeats: ${t.active ? "on" : "off"}`}
                onClick={() => onToggleActive(t)}
              />
              <button
                type="button"
                className={`rep-del${confirmDeleteId === t.id ? " confirming" : ""}`}
                aria-label={
                  confirmDeleteId === t.id
                    ? `Confirm deleting reminder "${t.title}"`
                    : `Delete reminder "${t.title}"`
                }
                onClick={() => {
                  if (confirmDeleteId === t.id) {
                    setConfirmDeleteId(null);
                    onDelete(t);
                  } else {
                    setConfirmDeleteId(t.id);
                  }
                }}
              >
                {confirmDeleteId === t.id ? (
                  "Delete?"
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit}>
        <div className="sheet-divider">ADD A REMINDER</div>
        <input
          className="field"
          aria-label="New reminder"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Reminder…"
        />
        <div className="form-row">
          <span className="seg" role="group" aria-label="Reminder type">
            <button
              type="button"
              className={kind === "repeat" ? "on" : ""}
              aria-pressed={kind === "repeat"}
              aria-label="Repeating reminder"
              onClick={() => setKind("repeat")}
            >
              Repeated
            </button>
            <button
              type="button"
              className={kind === "once" ? "on" : ""}
              aria-pressed={kind === "once"}
              aria-label="One-time reminder"
              onClick={() => setKind("once")}
            >
              One-time
            </button>
          </span>
          {kind === "repeat" ? (
            <>
              <select
                className="field grow"
                aria-label="Repeats"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value as typeof schedule)}
              >
                <option value="daily">Every day</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekends">Weekends</option>
                <option value="weekly">Weekly</option>
              </select>
              {schedule === "weekly" && (
                <select
                  className="field grow"
                  aria-label="On weekday"
                  value={weekday}
                  onChange={(e) => setWeekday(Number(e.target.value))}
                >
                  {WEEKDAY_NAMES.map((name, i) => (
                    <option key={name} value={i}>
                      {name.slice(0, 3)}
                    </option>
                  ))}
                </select>
              )}
            </>
          ) : (
            <input
              type="date"
              className="field grow"
              aria-label="Date for the one-time reminder"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
            />
          )}
        </div>
        <div className="form-row">
          <span className="seg butter" role="group" aria-label="Notify time — AM is 9:00 AM, PM is 4:30 PM">
            <button
              type="button"
              className={notifySlot === "AM" ? "on" : ""}
              aria-pressed={notifySlot === "AM"}
              aria-label="AM — notify at 9:00 AM"
              onClick={() => setNotifySlot("AM")}
            >
              AM · 9:00
            </button>
            <button
              type="button"
              className={notifySlot === "PM" ? "on" : ""}
              aria-pressed={notifySlot === "PM"}
              aria-label="PM — notify at 4:30 PM"
              onClick={() => setNotifySlot("PM")}
            >
              PM · 4:30
            </button>
          </span>
        </div>
        <div className="sheet-foot">
          <button
            type="submit"
            className={`send-btn${justSent ? " sent" : ""}`}
            disabled={adding || !title.trim() || (kind === "once" && !specificDate)}
            aria-label={kind === "once" ? "Send one-time reminder to Meowse" : "Add reminder"}
          >
            <span className={`sent-pop${justSent ? " play" : ""}`} aria-hidden="true">
              <PawUse />
              Sent
            </span>
            {kind === "once" ? <SentIcon /> : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
            <span>{adding ? (kind === "once" ? "Sending…" : "Adding…") : kind === "once" ? "Send" : "Add"}</span>
          </button>
          <img className="peek-face" src={peekCatFace} alt="" />
        </div>
        {justSent && (
          <span role="status" aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
            Sent to Meowse
          </span>
        )}
      </form>
    </Popup>
  );
}

/* ---------- main app ---------- */
export function App() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(() => todayKey());
  const [editing, setEditing] = useState<Task | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showReminders, setShowReminders] = useState(false);

  const addTaskBtnRef = useRef<HTMLButtonElement | null>(null);
  const remindersBtnRef = useRef<HTMLButtonElement | null>(null);
  const popupTriggerRef = useRef<HTMLElement | null>(null);
  const setTrigger = (el: HTMLElement | null) => {
    popupTriggerRef.current = el;
  };

  const today = todayKey();
  const isToday = selectedDate === today;

  const day = useQuery({
    queryKey: ["day", selectedDate],
    queryFn: () => api.getDay({ date: selectedDate }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["day"] });

  const toggleMut = useMutation({
    mutationFn: (task: Task) =>
      api.toggleTask({ id: task.id, done: !task.done, viewDate: selectedDate }),
    onSuccess: invalidate,
  });
  const addMut = useMutation({
    mutationFn: (values: { title: string; tags: string[] }) =>
      api.addTask({ date: selectedDate, title: values.title, tags: values.tags }),
    onSuccess: () => {
      setShowAddTask(false);
      invalidate();
    },
  });
  const editMut = useMutation({
    mutationFn: (values: { id: number; title: string; tags: string[] }) =>
      api.editTask(values),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });
  const deleteMut = useMutation({
    mutationFn: (task: Task) => api.deleteTask({ id: task.id }),
    onSuccess: invalidate,
  });
  const moveNextMut = useMutation({
    mutationFn: (task: Task) => api.moveTaskToDay({ id: task.id, date: shiftKey(selectedDate, 1) }),
    onSuccess: invalidate,
  });
  const tplActiveMut = useMutation({
    mutationFn: (t: Template) => api.setTemplateActive({ id: t.id, active: !t.active }),
    onSuccess: invalidate,
  });
  const tplDeleteMut = useMutation({
    mutationFn: (t: Template) => api.deleteTemplate({ id: t.id }),
    onSuccess: invalidate,
  });
  const tplAddMut = useMutation({
    mutationFn: (values: {
      title: string;
      schedule?: "daily" | "weekdays" | "weekends" | "weekly";
      weekday?: number;
      kind: "repeat" | "once";
      specificDate?: string;
      notifySlot: "AM" | "PM";
    }) => api.addTemplate(values),
    onSuccess: invalidate,
  });
  const habitToggleMut = useMutation({
    mutationFn: (habit: Habit) =>
      api.toggleHabit({ habitId: habit.id, date: selectedDate, done: !habit.done }),
    onSuccess: invalidate,
  });
  const habitAddMut = useMutation({
    mutationFn: (label: string) => api.addHabit({ label }),
    onSuccess: invalidate,
  });
  const habitDeleteMut = useMutation({
    mutationFn: (habit: Habit) => api.deleteHabit({ id: habit.id }),
    onSuccess: invalidate,
  });

  const tasks = day.data?.tasks ?? [];
  const carried = day.data?.carried ?? [];
  const recurringToday = day.data?.recurringToday ?? [];
  // Carried-over tasks appear with the todos in one list, first. On the
  // day they are carried to, they look exactly like any other task — no
  // note, and when one is checked off there it stays on that page,
  // crossed off like any other completed task. The rollover note
  // belongs only to the copy on the day the task was added (its origin
  // day, which a manual "move to next day" never changes): that copy
  // has moved on when its day has passed, when it was manually moved to
  // a later day, or when it was checked off on a later day. It shows
  // greyed out with a note after the task — "Didn't get done, rolled
  // over to next day" while still open, "Completed later" once checked
  // off on a future date. It is NOT checkable from the origin page at
  // all; the ⋮ menu (edit / delete only) is its only interactive
  // element (see TaskRow).
  const isNextDayCopy = (t: Task): boolean => {
    if (selectedDate !== t.originDay) return false;
    // Finished on the very day it was added — it never moved on.
    if (t.done && t.doneDay === t.originDay) return false;
    return (
      // Manually moved to a later day.
      t.day > t.originDay ||
      // Its day has passed and it rolled over to later days.
      t.originDay < today ||
      // Checked off on a later day than the one it was added on.
      (t.done && t.doneDay !== null && t.doneDay > t.originDay)
    );
  };
  const allTasks = [...carried, ...tasks];
  // Moved-on copies no longer belong to their added day, so they don't
  // count toward that day's progress (they can never be checked there).
  const activeTasks = allTasks.filter((t) => !isNextDayCopy(t));
  const doneCount = activeTasks.filter((t) => t.done).length;
  const totalCount = activeTasks.length;
  const progressPct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);
  const allDone = totalCount > 0 && doneCount === totalCount;

  const dayName = weekdayName(selectedDate);
  // Shrink long weekday names (e.g. Wednesday) so they always fit the hero.
  const dayFontSize = dayName.length > 8 ? 33 : dayName.length > 7 ? 38 : 44;

  const weekStart = weekStartKey(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftKey(weekStart, i));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      <Sprites />
      <div className="bg-decor" aria-hidden="true">
        <StarUse className="s1" />
        <StarUse className="s2" />
        <PawUse className="p1" />
        <PawUse className="p2" />
      </div>

      <main className="page-wrap">
        {/* hero */}
        <section className="hero">
          <StarUse className="star-deco a" />
          <StarUse className="star-deco b" />
          <StarUse className="star-deco c" />
          <img className="hero-cat" src={blackCat} alt="" />
          <div className="hero-main">
            <div className="hero-date">{heroDateLabel(selectedDate)}</div>
            <div className="hero-day" style={{ fontSize: dayFontSize }}>{dayName}</div>
            <div className={`progress-zone${allDone ? " all-done" : ""}`}>
              <div className="progress-meta">
                <span className="progress-pct">{progressPct}%</span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${doneCount} of ${totalCount} done`}
              >
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                <div className="bar-cat" aria-hidden="true">
                  <svg viewBox="0 0 200 116">
                    <path fill="#0b0d0a" d="M15 84h14v23.5c0 3.8-3 6.5-7 6.5s-7-2.7-7-6.5Z" />
                    <path fill="#0b0d0a" d="M14 84C8.5 61 12 39.5 26.5 27.5 39 17.5 56.5 15.8 70.5 22 84.5 28.2 98 34.8 108.5 38 109.3 27.5 112.8 15.8 120 6.8c1.9-2.4 4.7-2.3 6.7.2 3.3 4.2 6.1 8.6 8.1 12.6 4-1 8.2-1.2 12.4-.4 2-4 4.8-8.4 8.1-12.6 2-2.5 4.8-2.6 6.7-.2 7.4 9.3 10.9 21.5 11.4 32.2.3 6.6-1.9 11.6-6.2 15C180 58 186 66 184 74c-1.5 7-8 10-18 10H14Z" />
                    <g>
                      <ellipse cx="133" cy="40" rx="8.2" ry="10.2" fill="#fff8e6" />
                      <ellipse cx="134" cy="40.5" rx="5.4" ry="7.4" fill="#f0be4f" />
                      <ellipse cx="135.2" cy="41" rx="3.1" ry="5" fill="#0b0d0a" />
                    </g>
                    <g>
                      <ellipse cx="159" cy="40" rx="8.2" ry="10.2" fill="#fff8e6" />
                      <ellipse cx="160" cy="40.5" rx="5.4" ry="7.4" fill="#f0be4f" />
                      <ellipse cx="161.2" cy="41" rx="3.1" ry="5" fill="#0b0d0a" />
                    </g>
                  </svg>
                  <StarUse className="sleep-star" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* week strip */}
        <nav className="daystrip" aria-label="Week">
          <button
            type="button"
            className="week-arrow prev"
            aria-label="Previous day"
            onClick={() => setSelectedDate((d) => shiftKey(d, -1))}
          >
            <svg viewBox="0 0 13 18" aria-hidden="true">
              <path d="M12 1.5v15c0 1-1.1 1.7-2 1.2L1.2 10.1c-.8-.5-.8-1.7 0-2.2L10 .3c.9-.5 2 .2 2 1.2Z" />
            </svg>
          </button>
          <div className="week-days">
            {weekDays.map((key, i) => {
              const d = parseKey(key);
              const selected = key === selectedDate;
              const isTodayCell = key === today;
              return (
                <button
                  key={key}
                  type="button"
                  className={`day-cell${selected ? " selected" : ""}${isTodayCell ? " today" : ""}`}
                  aria-label={`${WEEKDAY_NAMES[d.getDay()]} ${heroDateLabel(key)}${isTodayCell ? " (today)" : ""}`}
                  aria-pressed={selected}
                  onClick={() => setSelectedDate(key)}
                >
                  <span className="dow">{DOW_LETTERS[i]}</span>
                  <span className="bubble">
                    <svg className="cathead" viewBox="0 0 331 302" aria-hidden="true">
                      <use href="#cathead" />
                    </svg>
                    <span className="num">{d.getDate()}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="week-arrow next"
            aria-label="Next day"
            onClick={() => setSelectedDate((d) => shiftKey(d, 1))}
          >
            <svg viewBox="0 0 13 18" aria-hidden="true">
              <path d="M1 1.5v15c0 1 1.1 1.7 2 1.2l8.8-7.6c.8-.5.8-1.7 0-2.2L3 .3c-.9-.5-2 .2-2 1.2Z" />
            </svg>
          </button>
        </nav>
        {!isToday && (
          <button type="button" className="back-today" onClick={() => setSelectedDate(today)}>
            {selectedDate < today ? "Back to today >>" : "<< Back to today"}
          </button>
        )}

        {day.isPending && <p className="status-msg">Loading your list…</p>}
        {day.error && (
          <div className="status-msg">
            <p>Couldn't load your list.</p>
            <button type="button" onClick={() => day.refetch()}>
              Try again
            </button>
          </div>
        )}

        {day.data && (
          <>
            <LogsSection
              habits={day.data.habits}
              isToday={isToday}
              onToggle={(h) => habitToggleMut.mutate(h)}
              onAdd={(label) => habitAddMut.mutate(label)}
              onDelete={(h) => habitDeleteMut.mutate(h)}
              adding={habitAddMut.isPending}
              onAddTask={() => {
                setTrigger(addTaskBtnRef.current);
                setShowAddTask(true);
              }}
              addTaskRef={addTaskBtnRef}
            />

            <section aria-label="Tasks for this day" style={{ marginTop: 14 }}>
              {allTasks.length === 0 ? (
                <div className="empty-card">
                  <p>Nothing on this day yet</p>
                  <p>Tap the + next to the settings icon above to add your first task.</p>
                </div>
              ) : (
                allTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    nextDay={isNextDayCopy(task)}
                    onToggle={(t) => toggleMut.mutate(t)}
                    onEdit={(t, el) => {
                      setTrigger(el);
                      setEditing(t);
                    }}
                    onDelete={(t) => deleteMut.mutate(t)}
                    onMoveToNextDay={(t) => moveNextMut.mutate(t)}
                    registerTrigger={setTrigger}
                  />
                ))
              )}
              {activeTasks.length > 0 && activeTasks.every((t) => t.done) && (
                <p style={{ marginTop: 10, textAlign: "center", fontSize: 14, fontWeight: 700, color: "var(--sage)" }}>
                  Everything on this day is checked off.
                </p>
              )}
            </section>

            {/* reminders — display only at the bottom */}
            <section className="reminders" aria-label="Reminders">
              <StarUse className="corner-star" />
              <div className="reminders-head">
                <span className="reminders-title">REMINDERS</span>
                <button
                  ref={remindersBtnRef}
                  type="button"
                  className="icon-btn reminder-art-btn"
                  aria-label="Manage reminders"
                  title="Manage reminders"
                  onClick={() => {
                    setTrigger(remindersBtnRef.current);
                    setShowReminders(true);
                  }}
                >
                  <img src={reminderNote} alt="" />
                </button>
              </div>
              {recurringToday.length === 0 ? (
                <p className="reminders-empty">Nothing here for this day.</p>
              ) : (
                recurringToday.map((t) => {
                  const isOnce = t.kind === "once";
                  return (
                    <div key={t.id} className="reminder-item">
                      <span className={`reminder-ic${isOnce ? " once" : ""}`} aria-hidden="true">
                        {isOnce ? <OneTimeIcon /> : <RepeatIcon />}
                      </span>
                      <span className="reminder-text">{t.title}</span>
                      {isOnce && t.timeHint && <span className="reminder-sent">{t.timeHint}</span>}
                    </div>
                  );
                })
              )}
            </section>
          </>
        )}
      </main>

      <TaskFormPopup
        open={showAddTask}
        onClose={() => setShowAddTask(false)}
        triggerRef={popupTriggerRef}
        title="NEW TASK"
        initialTitle=""
        initialTags={EMPTY_TAGS}
        saving={addMut.isPending}
        saveLabel="Add task"
        submitLabel="Add"
        isEdit={false}
        onSave={(values) => addMut.mutate(values)}
      />
      <TaskFormPopup
        open={editing !== null}
        onClose={() => setEditing(null)}
        triggerRef={popupTriggerRef}
        title="EDIT TASK"
        initialTitle={editing?.title ?? ""}
        initialTags={editing?.tags ?? EMPTY_TAGS}
        saving={editMut.isPending}
        saveLabel="Save task"
        submitLabel="Save"
        isEdit
        onSave={(values) => {
          if (editing) editMut.mutate({ id: editing.id, ...values });
        }}
      />
      {day.data && (
        <RemindersPopup
          open={showReminders}
          onClose={() => setShowReminders(false)}
          triggerRef={popupTriggerRef}
          templates={day.data.templates}
          selectedDate={selectedDate}
          onToggleActive={(t) => tplActiveMut.mutate(t)}
          onDelete={(t) => tplDeleteMut.mutate(t)}
          onAdd={async (v) => {
            await tplAddMut.mutateAsync(v);
          }}
          adding={tplAddMut.isPending}
        />
      )}
    </div>
  );
}
