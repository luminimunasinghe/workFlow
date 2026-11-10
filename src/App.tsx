import { useEffect, useRef, useState, type ReactNode } from "react";

/* ================= Types ================= */
type Status = "Not Started" | "In Progress" | "Blocked" | "Completed";
type Priority = "High" | "Medium" | "Low";
type Category = "Office Work" | "Learning" | "Personal" | "Other";
interface Task { id: string; title: string; project: string; description: string; status: Status; priority: Priority; category: Category;
  due: string; workToday: string; nextSteps: string; blockers: string; help: string; completedOn?: string }
interface Day { done: string; next: string; blockers: string; learning: string; standup: boolean; learnMin: number; checks: string[] }
interface Blocker { id: string; issue: string; impact: string; tried: string; help: string; identified: string; raised: string;
  status: "Open" | "Raised" | "Resolved"; followup: boolean }
interface Note { id: string; date: string; type: string; v: Record<string, string> }
interface PR { id: string; date: string; title: string; checks: string[]; ai: string; applied: boolean; signed: boolean }
interface DB { tasks: Task[]; days: Record<string, Day>; blockers: Blocker[]; notes: Note[]; prs: PR[]; plan: string[]; ratings: Record<string, number> }
type Upd = (f: (d: DB) => DB) => void;
interface P { db: DB; update: Upd; sel: string }

/* ================= Content taken from the Upskilling & Development Plan ================= */
const STATUSES: Status[] = ["Not Started", "In Progress", "Blocked", "Completed"];
const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
const CATEGORIES: Category[] = ["Office Work", "Learning", "Personal", "Other"];
const DAILY = ["Check today's office tasks", "Review unfinished work from yesterday", "Pick today's priority task", "Update progress on earlier work",
  "Note any blockers (with the date first noticed)", "End of day: update the work completed", "Write down what is needed tomorrow"];
const PLAN: [string, string[]][] = [
  ["Month 1 — Baseline & foundations", ["Agree the core technical areas with the tech lead", "Agree the 3-month learning path (core stack first, then one adjacent area)",
    "Start the structured deep-dive with the technical buddy", "Trace one feature end-to-end (UI → API → data) and document it", "Complete the AI baseline and set up approved tools", "Checkpoint 1 held"]],
  ["Month 2 — Apply & adjust", ["Finish deep-dives on the first core areas", "Apply learning in two tasks/PRs and explain it in the PR description",
    "Take one task slightly outside the usual focus area", "Write the first design note", "Use AI for test generation, pre-PR self-review and documentation drafts", "Mid-point review held"]],
  ["Month 3 — Embed & review", ["Walk the tech lead through how a built feature fits the wider system", "Write a short design note for a small change",
    "Share one AI-assisted workflow with the team", "Month 3 review held and next-quarter goals agreed"]],
  ["Technical & Domain Knowledge", ["Core technical areas checklist agreed", "Structured deep-dive done on each core area",
    "Learning applied visibly in at least 2 PRs (tech lead sign-off)", "One feature traced end-to-end and documented"]],
  ["Independent Learning & Growth", ["Three-month learning path agreed with the lead", "New concept, tool or feedback applied each month, unprompted",
    "Short learning note shared each month", "One relevant training completed", "One task outside the usual focus area delivered (Months 2–3)"]],
  ["Process & Documentation Consistency", ["Lead reviewed recent deliverables against the checklist (baseline)", "Read the SDLC and documentation checklist; unclear points clarified",
    "Checklist used before every PR or handover"]],
  ["What to learn", ["Core frameworks and data layer used on the project", "How a request flows: front end, APIs, services, database", "REST/API design basics and error handling",
    "Database fundamentals: schema, queries, indexing", "Debugging and reading unfamiliar code", "Unit testing basics and what makes a good test"]],
];
const COMP = ["System design & architecture", "Engineering fundamentals & concepts", "Requirement analysis & planning", "Testing & quality",
  "Engineering process (SDLC)", "Technical breadth & learning", "Ownership & communication", "AI-first engineering"];
const PRIORITY_COMP = [COMP[1], COMP[5]];
const LEVELS = ["Programmer level", "Building", "Software Engineer level"];
const PRC = ["Branching and source-control rules followed", "Requirement confirmed", "Unit tests added/updated and full suite passing", "Edge cases considered",
  "Self-review done", "Documentation updated", "PR description complete (including AI-assisted note)", "Release/deployment steps noted"];
const TPL: Record<string, string[]> = {
  "Learning note": ["What I learned", "Where I applied it", "What's next"],
  "AI usage note": ["Tool", "What it was used for", "How I verified the output"],
  "Design note": ["Problem", "Options considered", "Trade-offs", "Decision and why", "Risks", "Test approach"],
  "Requirement confirmation": ["Requirement in my own words", "Acceptance criteria", "Assumptions", "Open questions", "Confirmed by / date"],
  "Escalation note": ["What I was trying to do", "What I tried", "What I found", "Where I'm stuck", "Help I need"],
  "Blocker message": ["Context", "Issue", "Impact", "Ask"],
};
const KEY = "lumiflow-data-v2";

/* ================= Helpers ================= */
const uid = () => Math.random().toString(36).slice(2, 10);
const p2 = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const today = () => fmt(new Date());
const parse = (s: string) => new Date(s + "T00:00");
const shift = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
const weekStart = (s: string) => shift(s, -((parse(s).getDay() + 6) % 7));
const nice = (s: string) => (s ? parse(s).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "No date");
const long = (s: string) => parse(s).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const isDone = (t: Task) => t.status === "Completed";
const isOver = (t: Task, on: string) => !isDone(t) && !!t.due && t.due < on;
const rank: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
const flip = (t: Task, on: string): Task => (isDone(t) ? { ...t, status: "In Progress", completedOn: undefined } : { ...t, status: "Completed", completedOn: on });
const upsert = <T extends { id: string }>(a: T[], x: T) => (a.some((y) => y.id === x.id) ? a.map((y) => (y.id === x.id ? x : y)) : [x, ...a]);
const del = <T extends { id: string }>(a: T[], id: string) => a.filter((y) => y.id !== id);
const emptyDay = (): Day => ({ done: "", next: "", blockers: "", learning: "", standup: false, learnMin: 0, checks: [] });
const blankTask = (due: string): Task => ({ id: uid(), title: "", project: "", description: "", status: "Not Started", priority: "Medium", category: "Office Work",
  due, workToday: "", nextSteps: "", blockers: "", help: "" });
const emptyDB = (): DB => ({ tasks: [], days: {}, blockers: [], notes: [], prs: [], plan: [], ratings: {} });
const isSample = (x: unknown) => !!x && typeof x === "object" && "sample" in x && !!(x as { sample?: boolean }).sample;
function dropSamples(raw: Partial<DB> | null | undefined): DB {
  const base = { ...emptyDB(), ...raw };
  return {
    ...base,
    tasks: (base.tasks ?? []).filter((x) => !isSample(x)),
    blockers: (base.blockers ?? []).filter((x) => !isSample(x)),
    notes: (base.notes ?? []).filter((x) => !isSample(x)),
    prs: (base.prs ?? []).filter((x) => !isSample(x)),
    days: Object.fromEntries(Object.entries(base.days ?? {}).filter(([, v]) => !isSample(v))),
  };
}
function measures(db: DB) {
  const n = (ty: string) => db.notes.filter((x) => x.type === ty).length;
  const pr = db.prs;
  const comp = pr.length ? Math.round(pr.reduce((s, p) => s + (p.checks.length / PRC.length) * 100, 0) / pr.length) : 0;
  return [
    { l: "Monthly learning notes shared", v: n("Learning note"), t: 3, u: "" },
    { l: "Design notes written (from Month 2)", v: n("Design note"), t: 2, u: "" },
    { l: "PRs applying new learning (signed off)", v: pr.filter((p) => p.applied && p.signed).length, t: 2, u: "" },
    { l: "PR checklist compliance", v: comp, t: 100, u: "%" },
    { l: "PRs noting AI use and verification", v: pr.length ? Math.round((pr.filter((p) => p.ai.trim()).length / pr.length) * 100) : 0, t: 80, u: "%" },
    { l: "Training completed", v: db.plan.includes("4-3") ? 1 : 0, t: 1, u: "" },
    { l: "Task outside usual focus delivered", v: db.plan.includes("4-4") ? 1 : 0, t: 1, u: "" },
  ];
}
const planTotal = () => PLAN.reduce((s, g) => s + g[1].length, 0);

/* ================= UI parts ================= */
const inp = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const btn = "rounded-lg px-3.5 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-indigo-300 ";
const primary = btn + "bg-indigo-600 text-white hover:bg-indigo-700";
const ghost = btn + "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) =>
  <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
const H = ({ children, sub }: { children: ReactNode; sub?: string }) =>
  <div className="mb-3"><h2 className="text-base font-bold text-slate-900">{children}</h2>{sub && <p className="text-xs text-slate-500">{sub}</p>}</div>;
const Title = ({ children, sub, action }: { children: ReactNode; sub?: string; action?: ReactNode }) =>
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold text-slate-900">{children}</h1>{sub && <p className="text-sm text-slate-500">{sub}</p>}</div>{action}</div>;
const Bar = ({ value, color = "bg-indigo-500" }: { value: number; color?: string }) =>
  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
const Field = ({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) =>
  <label className={`block ${wide ? "sm:col-span-2" : ""}`}><span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>{children}</label>;
const Txt = ({ label, value, onChange, rows = 2, wide = true }: { label: string; value: string; onChange: (v: string) => void; rows?: number; wide?: boolean }) =>
  <Field label={label} wide={wide}><textarea rows={rows} className={inp} value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
const Inp = ({ label, value, onChange, type = "text", wide, req }: { label: string; value: string; onChange: (v: string) => void; type?: string; wide?: boolean; req?: boolean }) =>
  <Field label={label} wide={wide}><input required={req} type={type} className={inp} value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
const Sel = ({ label, value, opts, onChange, wide }: { label: string; value: string; opts: string[]; onChange: (v: string) => void; wide?: boolean }) =>
  <Field label={label} wide={wide}><select className={inp} value={value} onChange={(e) => onChange(e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select></Field>;
const Check = ({ label, on, onChange, strike = true }: { label: string; on: boolean; onChange: (v: boolean) => void; strike?: boolean }) =>
  <label className="flex items-start gap-2.5 py-1.5 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600" checked={on} onChange={(e) => onChange(e.target.checked)} />
    <span className={on && strike ? "text-slate-400 line-through" : ""}>{label}</span></label>;
const tone: Record<string, string> = { High: "bg-rose-50 text-rose-700", Medium: "bg-amber-50 text-amber-700", Low: "bg-emerald-50 text-emerald-700",
  "Not Started": "bg-slate-100 text-slate-600", "In Progress": "bg-sky-50 text-sky-700", Blocked: "bg-rose-50 text-rose-700", Completed: "bg-emerald-50 text-emerald-700",
  Open: "bg-rose-50 text-rose-700", Raised: "bg-amber-50 text-amber-700", Resolved: "bg-emerald-50 text-emerald-700" };
const Badge = ({ text, cls }: { text: string; cls?: string }) => <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${cls ?? tone[text] ?? "bg-slate-100 text-slate-600"}`}>{text}</span>;
const Empty = ({ text }: { text: string }) => <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">{text}</p>;
const Actions = ({ onEdit, onDel, what }: { onEdit: () => void; onDel: () => void; what: string }) =>
  <div className="flex shrink-0 gap-1 text-xs"><button className="rounded px-2 py-1 text-indigo-600 hover:bg-indigo-50" onClick={onEdit}>Edit</button>
    <button className="rounded px-2 py-1 text-rose-600 hover:bg-rose-50" onClick={() => confirm(`Delete this ${what}?`) && onDel()}>Delete</button></div>;
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">{title}</h3>
          <button className="text-slate-400 hover:text-slate-700" onClick={onClose} aria-label="Close">✕</button></div>{children}</div>
    </div>
  );
}
function FormModal({ title, onClose, onSubmit, children }: { title: string; onClose: () => void; onSubmit: () => void; children: ReactNode }) {
  return <Modal title={title} onClose={onClose}><form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>{children}
    <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className={ghost} onClick={onClose}>Cancel</button><button className={primary}>Save</button></div></form></Modal>;
}

/* ================= Dashboard ================= */
function Dashboard({ db, update, sel, go }: P & { go: (p: Page) => void }) {
  const open = db.tasks.filter((t) => !isDone(t));
  const over = open.filter((t) => isOver(t, sel));
  const prio = open.filter((t) => t.due <= sel || t.priority === "High").sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 6);
  const week = Array.from({ length: 7 }, (_, i) => { const d = shift(sel, i - 6); return { d, n: db.tasks.filter((t) => t.completedOn === d).length }; });
  const max = Math.max(1, ...week.map((w) => w.n));
  const planPct = Math.round((db.plan.length / planTotal()) * 100);
  const stats = [{ l: "Completed this day", v: db.tasks.filter((t) => t.completedOn === sel).length, c: "text-emerald-600" }, { l: "Pending tasks", v: open.length, c: "text-indigo-600" },
    { l: "Overdue", v: over.length, c: over.length ? "text-rose-600" : "text-slate-400" }, { l: "Development plan", v: planPct + "%", c: "text-amber-600" }];
  return (
    <div className="space-y-5">
      <Title sub={long(sel)}>Dashboard</Title>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{stats.map((s) => <Card key={s.l}><p className="text-xs font-semibold text-slate-500">{s.l}</p><p className={`mt-1 text-3xl font-extrabold ${s.c}`}>{s.v}</p></Card>)}</div>
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3"><H sub="Due by this date, overdue, or high priority">Priorities</H>
          {prio.length === 0 ? <Empty text="Nothing urgent. Add a task or enjoy the calm." /> : <ul className="divide-y divide-slate-100">{prio.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5"><input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={isDone(t)} onChange={() => update((d) => ({ ...d, tasks: upsert(d.tasks, flip(t, sel)) }))} />
              <span className="flex-1 text-sm font-medium">{t.title}{t.project && <span className="ml-2 text-xs text-slate-400">{t.project}</span>}</span>
              {isOver(t, sel) && <Badge text="Overdue" cls="bg-rose-50 text-rose-700" />}<Badge text={t.priority} /></li>))}</ul>}
          <div className="mt-4 flex gap-2"><button className={ghost} onClick={() => go("daily")}>Update this day</button><button className={ghost} onClick={() => go("tasks")}>All tasks</button></div></Card>
        <Card className="lg:col-span-2"><H sub="Tasks completed, 7 days up to the selected date">Weekly progress</H>
          <div className="flex h-32 items-end gap-2">{week.map((w) => (<div key={w.d} className="flex flex-1 flex-col items-center gap-1"><span className="text-xs font-semibold text-slate-500">{w.n || ""}</span>
            <div className={`w-full rounded-md ${w.d === sel ? "bg-amber-400" : "bg-indigo-200"}`} style={{ height: `${Math.max(6, (w.n / max) * 80)}px` }} />
            <span className="text-[10px] text-slate-400">{parse(w.d).toLocaleDateString(undefined, { weekday: "short" })}</span></div>))}</div></Card>
      </div>
      <Card><H sub="Targets come from your plan's success measures">Development plan progress</H>
        <div className="mb-5 flex items-center gap-3"><Bar value={planPct} color="bg-amber-400" /><span className="text-sm font-bold">{planPct}%</span></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{measures(db).map((m) => (
          <div key={m.l}><div className="mb-1 flex justify-between gap-2 text-xs"><span className="font-semibold text-slate-600">{m.l}</span><span className="shrink-0 text-slate-400">{m.v}{m.u} / {m.t}{m.u}</span></div>
            <Bar value={(m.v / m.t) * 100} color={m.v >= m.t ? "bg-emerald-500" : "bg-indigo-500"} /></div>))}</div></Card>
    </div>
  );
}

/* ================= Daily ================= */
function Daily({ db, update, sel }: P) {
  const day = db.days[sel] ?? emptyDay();
  const set = (p: Partial<Day>) => update((d) => ({ ...d, days: { ...d.days, [sel]: { ...(d.days[sel] ?? emptyDay()), ...p } } }));
  const list = db.tasks.filter((t) => t.due === sel || t.completedOn === sel);
  const [q, setQ] = useState(""); const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(`Today's Update (${sel})\nDone: ${day.done}\nNext: ${day.next}\nBlockers: ${day.blockers}\nLearning: ${day.learning}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => undefined); };
  return (
    <div className="space-y-5">
      <Title sub="Pick any date at the top to fill in or fix that day. Everything saves as you type.">{long(sel)}</Title>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <Card><H>Daily checklist</H>{DAILY.map((l, i) => <Check key={i} label={l} on={day.checks.includes(String(i))}
            onChange={(v) => set({ checks: v ? [...day.checks, String(i)] : day.checks.filter((c) => c !== String(i)) })} />)}
            <p className="mt-2 text-xs text-slate-400">{day.checks.length} of {DAILY.length} done</p></Card>
          <Card><H sub="15–20 minutes a day is enough">Habits</H>
            <Check label="I gave my stand-up update without being asked" on={day.standup} onChange={(v) => set({ standup: v })} strike={false} />
            <Field label="Minutes spent learning"><input type="number" min={0} max={600} className={inp + " !w-28"} value={day.learnMin} onChange={(e) => set({ learnMin: Math.max(0, +e.target.value || 0) })} /></Field></Card>
        </div>
        <Card className="lg:col-span-3"><H sub="Done · Next · Blockers · Learning">Written update</H>
          <div className="space-y-3">
            <Txt label="Done: what did I complete?" value={day.done} onChange={(v) => set({ done: v })} rows={3} />
            <Txt label="Next: what will I work on next?" value={day.next} onChange={(v) => set({ next: v })} rows={3} />
            <Txt label="Blockers: what is stopping me? (include the date first noticed)" value={day.blockers} onChange={(v) => set({ blockers: v })} />
            <Txt label="Learning: what did I learn?" value={day.learning} onChange={(v) => set({ learning: v })} /></div>
          <button className={ghost + " mt-4"} onClick={copy}>{copied ? "Copied ✓" : "Copy update to share"}</button></Card>
      </div>
      <Card><H sub="Tasks due on or completed on this date">Tasks for this day</H>
        <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { update((d) => ({ ...d, tasks: [{ ...blankTask(sel), title: q.trim() }, ...d.tasks] })); setQ(""); } }}>
          <input className={inp} placeholder="Add a task for this date and press Enter" value={q} onChange={(e) => setQ(e.target.value)} /><button className={ghost}>Add</button></form>
        {list.length === 0 ? <Empty text="No tasks on this date." /> : <ul className="divide-y divide-slate-100">{list.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2"><input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={isDone(t)} onChange={() => update((d) => ({ ...d, tasks: upsert(d.tasks, flip(t, sel)) }))} />
            <span className={`flex-1 text-sm ${isDone(t) ? "text-slate-400 line-through" : ""}`}>{t.title}</span><Badge text={t.status} /></li>))}</ul>}</Card>
    </div>
  );
}

/* ================= Tasks ================= */
function Tasks({ db, update, sel }: P) {
  const [edit, setEdit] = useState<Task | null>(null);
  const [f, setF] = useState({ status: "Open", priority: "All", category: "All" });
  const save = (t: Task) => { update((d) => ({ ...d, tasks: upsert(d.tasks, { ...t, title: t.title.trim(), completedOn: t.status === "Completed" ? t.completedOn ?? sel : undefined }) })); setEdit(null); };
  const list = db.tasks.filter((t) => (f.status === "All" || (f.status === "Open" ? !isDone(t) : f.status === "Overdue" ? isOver(t, sel) : t.status === f.status))
    && (f.priority === "All" || t.priority === f.priority) && (f.category === "All" || t.category === f.category))
    .sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || (a.due || "9").localeCompare(b.due || "9") || rank[a.priority] - rank[b.priority]);
  const fs = (k: keyof typeof f, o: string[]) => <select aria-label={k} className={inp + " !w-auto"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>{o.map((x) => <option key={x}>{x}</option>)}</select>;
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setEdit((x) => (x ? { ...x, [k]: v } : x));
  return (
    <div className="space-y-5">
      <Title sub="Unfinished tasks stay on this one list and show as overdue, so nothing is duplicated." action={<button className={primary} onClick={() => setEdit(blankTask(sel))}>+ New task</button>}>Tasks & project work</Title>
      <div className="flex flex-wrap gap-2">{fs("status", ["Open", "All", "Overdue", ...STATUSES])}{fs("priority", ["All", ...PRIORITIES])}{fs("category", ["All", ...CATEGORIES])}</div>
      {list.length === 0 ? <Empty text="No tasks match these filters." /> : <div className="space-y-2">{list.map((t) => (
        <Card key={t.id} className="!p-4"><div className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-indigo-600" checked={isDone(t)} onChange={() => save(flip(t, sel))} aria-label="Complete" />
          <div className="min-w-0 flex-1"><p className={`text-sm font-semibold ${isDone(t) ? "text-slate-400 line-through" : ""}`}>{t.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><Badge text={t.status} /><Badge text={t.priority} /><Badge text={t.category} />
              {t.project && <Badge text={t.project} cls="bg-indigo-50 text-indigo-700" />}
              <span className={`text-xs ${isOver(t, sel) ? "font-semibold text-rose-600" : "text-slate-400"}`}>{isOver(t, sel) ? "Overdue · " : "Due "}{nice(t.due)}</span></div>
            {(t.workToday || t.nextSteps || t.blockers || t.help) && <div className="mt-2 space-y-0.5 text-xs text-slate-500">
              {t.workToday && <p><b>Done:</b> {t.workToday}</p>}{t.nextSteps && <p><b>Next:</b> {t.nextSteps}</p>}{t.blockers && <p><b>Blocker:</b> {t.blockers}</p>}{t.help && <p><b>Help:</b> {t.help}</p>}</div>}</div>
          <Actions what="task" onEdit={() => setEdit(t)} onDel={() => update((d) => ({ ...d, tasks: del(d.tasks, t.id) }))} /></div></Card>))}</div>}
      {edit && <FormModal title={db.tasks.some((x) => x.id === edit.id) ? "Edit task" : "New task"} onClose={() => setEdit(null)} onSubmit={() => edit.title.trim() && save(edit)}>
        <Inp label="Task title *" req wide value={edit.title} onChange={(v) => set("title", v)} />
        <Inp label="Project" value={edit.project} onChange={(v) => set("project", v)} /><Sel label="Category" value={edit.category} opts={CATEGORIES} onChange={(v) => set("category", v as Category)} />
        <Sel label="Priority" value={edit.priority} opts={PRIORITIES} onChange={(v) => set("priority", v as Priority)} /><Sel label="Status" value={edit.status} opts={STATUSES} onChange={(v) => set("status", v as Status)} />
        <Inp label="Due date" type="date" value={edit.due} onChange={(v) => set("due", v)} /><div />
        <Txt label="Description" value={edit.description} onChange={(v) => set("description", v)} />
        <Txt label="Work completed today" wide={false} value={edit.workToday} onChange={(v) => set("workToday", v)} /><Txt label="Next steps" wide={false} value={edit.nextSteps} onChange={(v) => set("nextSteps", v)} />
        <Txt label="Blockers" wide={false} value={edit.blockers} onChange={(v) => set("blockers", v)} /><Txt label="Help required" wide={false} value={edit.help} onChange={(v) => set("help", v)} /></FormModal>}
    </div>
  );
}

/* ================= Blockers ================= */
function Blockers({ db, update, sel }: P) {
  const [edit, setEdit] = useState<Blocker | null>(null);
  const blank = (): Blocker => ({ id: uid(), issue: "", impact: "", tried: "", help: "", identified: sel, raised: "", status: "Open", followup: false });
  const set = <K extends keyof Blocker>(k: K, v: Blocker[K]) => setEdit((x) => (x ? { ...x, [k]: v } : x));
  const list = [...db.blockers].sort((a, b) => Number(a.status === "Resolved") - Number(b.status === "Resolved") || b.identified.localeCompare(a.identified));
  const lag = (b: Blocker) => (b.raised ? Math.round((parse(b.raised).getTime() - parse(b.identified).getTime()) / 864e5) : null);
  return (
    <div className="space-y-5">
      <Title sub="Raise blockers early and in writing: Context – Issue – Impact – Ask." action={<button className={primary} onClick={() => setEdit(blank())}>+ New blocker</button>}>Blocker tracker</Title>
      {list.length === 0 ? <Empty text="No blockers recorded. Good news, or time to log one." /> : <div className="space-y-2">{list.map((b) => (
        <Card key={b.id} className="!p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{b.issue}</p><Badge text={b.status} />{b.followup && <Badge text="Needed a follow-up" cls="bg-amber-50 text-amber-700" />}</div>
          <p className="mt-1 text-xs text-slate-400">Identified {nice(b.identified)}{lag(b) !== null && ` · raised ${lag(b)} day(s) later`}</p>
          <div className="mt-2 space-y-0.5 text-xs text-slate-500">{b.impact && <p><b>Impact:</b> {b.impact}</p>}{b.tried && <p><b>Tried:</b> {b.tried}</p>}{b.help && <p><b>Help needed:</b> {b.help}</p>}</div></div>
          <Actions what="blocker" onEdit={() => setEdit(b)} onDel={() => update((d) => ({ ...d, blockers: del(d.blockers, b.id) }))} /></div></Card>))}</div>}
      {edit && <FormModal title="Blocker" onClose={() => setEdit(null)} onSubmit={() => { update((d) => ({ ...d, blockers: upsert(d.blockers, edit) })); setEdit(null); }}>
        <Inp label="The issue *" req wide value={edit.issue} onChange={(v) => set("issue", v)} /><Txt label="Impact" value={edit.impact} onChange={(v) => set("impact", v)} />
        <Txt label="What I already tried" value={edit.tried} onChange={(v) => set("tried", v)} /><Txt label="Help needed" value={edit.help} onChange={(v) => set("help", v)} />
        <Inp label="Date identified" type="date" value={edit.identified} onChange={(v) => set("identified", v)} /><Inp label="Date raised with the team" type="date" value={edit.raised} onChange={(v) => set("raised", v)} />
        <Sel label="Status" value={edit.status} opts={["Open", "Raised", "Resolved"]} onChange={(v) => set("status", v as Blocker["status"])} />
        <div className="self-end"><Check label="Raised only after a follow-up" on={edit.followup} onChange={(v) => set("followup", v)} strike={false} /></div></FormModal>}
    </div>
  );
}

/* ================= Notes & templates ================= */
function Notes({ db, update, sel }: P) {
  const [edit, setEdit] = useState<Note | null>(null); const [ty, setTy] = useState("All");
  const types = Object.keys(TPL);
  const list = db.notes.filter((n) => ty === "All" || n.type === ty).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-5">
      <Title sub="Short templates from the plan: learning, AI usage, design, requirement, escalation and blocker messages." action={<button className={primary} onClick={() => setEdit({ id: uid(), date: sel, type: ty === "All" ? types[0] : ty, v: {} })}>+ New note</button>}>Notes & templates</Title>
      <div className="flex flex-wrap gap-2">{["All", ...types].map((t) => <button key={t} onClick={() => setTy(t)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${ty === t ? "bg-indigo-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{t}</button>)}</div>
      {list.length === 0 ? <Empty text="No notes yet. A few lines each month is enough." /> : <div className="grid gap-3 lg:grid-cols-2">{list.map((n) => (
        <Card key={n.id} className="!p-4"><div className="flex items-start justify-between gap-2"><div><Badge text={n.type} cls="bg-indigo-50 text-indigo-700" /><span className="ml-2 text-xs text-slate-400">{nice(n.date)}</span></div>
          <Actions what="note" onEdit={() => setEdit(n)} onDel={() => update((d) => ({ ...d, notes: del(d.notes, n.id) }))} /></div>
          <div className="mt-2 space-y-1 text-sm">{TPL[n.type]?.map((f) => n.v[f] ? <p key={f}><b className="text-slate-500">{f}:</b> <span className="whitespace-pre-wrap">{n.v[f]}</span></p> : null)}</div></Card>))}</div>}
      {edit && <FormModal title="Note" onClose={() => setEdit(null)} onSubmit={() => { update((d) => ({ ...d, notes: upsert(d.notes, edit) })); setEdit(null); }}>
        <Sel label="Template" value={edit.type} opts={types} onChange={(v) => setEdit({ ...edit, type: v })} /><Inp label="Date" type="date" value={edit.date} onChange={(v) => setEdit({ ...edit, date: v })} />
        {TPL[edit.type].map((f) => <Txt key={f} label={f} value={edit.v[f] ?? ""} onChange={(v) => setEdit({ ...edit, v: { ...edit.v, [f]: v } })} />)}</FormModal>}
    </div>
  );
}

/* ================= PR checklist ================= */
function PRs({ db, update, sel }: P) {
  const [edit, setEdit] = useState<PR | null>(null);
  const m = measures(db);
  return (
    <div className="space-y-5">
      <Title sub="Run the checklist before every PR or handover. Note how AI was used and how you verified it." action={<button className={primary} onClick={() => setEdit({ id: uid(), date: sel, title: "", checks: [], ai: "", applied: false, signed: false })}>+ Log a PR</button>}>PR & handover checklist</Title>
      <div className="grid gap-4 sm:grid-cols-3">{[m[3], m[4], m[2]].map((x) => <Card key={x.l}><p className="text-xs font-semibold text-slate-500">{x.l}</p><p className="mt-1 text-2xl font-extrabold text-indigo-600">{x.v}{x.u}<span className="text-sm font-medium text-slate-400"> / {x.t}{x.u}</span></p></Card>)}</div>
      {db.prs.length === 0 ? <Empty text="No PRs logged yet." /> : <div className="space-y-2">{[...db.prs].sort((a, b) => b.date.localeCompare(a.date)).map((p) => (
        <Card key={p.id} className="!p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{p.title}</p><Badge text={`${Math.round((p.checks.length / PRC.length) * 100)}% checklist`} cls={p.checks.length === PRC.length ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"} />
            {p.applied && <Badge text="Applies new learning" cls="bg-indigo-50 text-indigo-700" />}{p.signed && <Badge text="Signed off" cls="bg-emerald-50 text-emerald-700" />}</div>
          <p className="mt-1 text-xs text-slate-400">{nice(p.date)}</p>{p.ai && <p className="mt-1 text-xs text-slate-500"><b>AI:</b> {p.ai}</p>}</div>
          <Actions what="PR" onEdit={() => setEdit(p)} onDel={() => update((d) => ({ ...d, prs: del(d.prs, p.id) }))} /></div></Card>))}</div>}
      {edit && <FormModal title="PR / handover" onClose={() => setEdit(null)} onSubmit={() => { update((d) => ({ ...d, prs: upsert(d.prs, { ...edit, title: edit.title.trim() }) })); setEdit(null); }}>
        <Inp label="PR title *" req value={edit.title} onChange={(v) => setEdit({ ...edit, title: v })} /><Inp label="Date" type="date" value={edit.date} onChange={(v) => setEdit({ ...edit, date: v })} />
        <div className="sm:col-span-2">{PRC.map((l, i) => <Check key={i} label={l} strike={false} on={edit.checks.includes(String(i))} onChange={(v) => setEdit({ ...edit, checks: v ? [...edit.checks, String(i)] : edit.checks.filter((c) => c !== String(i)) })} />)}</div>
        <Txt label="AI-assisted: what, and how verified (leave blank if not used)" value={edit.ai} onChange={(v) => setEdit({ ...edit, ai: v })} />
        <Check label="Applies something new I learned" on={edit.applied} strike={false} onChange={(v) => setEdit({ ...edit, applied: v })} /><Check label="Tech lead signed off" on={edit.signed} strike={false} onChange={(v) => setEdit({ ...edit, signed: v })} /></FormModal>}
    </div>
  );
}

/* ================= Development plan ================= */
function Plan({ db, update }: P) {
  const toggle = (id: string, v: boolean) => update((d) => ({ ...d, plan: v ? [...d.plan, id] : d.plan.filter((x) => x !== id) }));
  return (
    <div className="space-y-5">
      <Title sub="Tick items as you complete them. Learning and PR measures fill in on their own from your notes and PR log.">Three-month development plan</Title>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">{PLAN.map(([title, items], gi) => {
          const n = items.filter((_, i) => db.plan.includes(`${gi}-${i}`)).length;
          return <Card key={title}><div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-base font-bold text-slate-900">{title}</h2><span className="text-xs font-semibold text-slate-400">{n}/{items.length}</span></div>
            <Bar value={(n / items.length) * 100} color="bg-amber-400" /><div className="mt-2">{items.map((l, i) => <Check key={i} label={l} on={db.plan.includes(`${gi}-${i}`)} onChange={(v) => toggle(`${gi}-${i}`, v)} />)}</div></Card>;
        })}</div>
        <div className="space-y-5">
          <Card><H sub="Auto-calculated from your notes and PRs">Success measures</H><div className="space-y-3">{measures(db).map((m) => (
            <div key={m.l}><div className="mb-1 flex justify-between gap-2 text-xs"><span className="font-semibold text-slate-600">{m.l}</span><span className="shrink-0 text-slate-400">{m.v}{m.u} / {m.t}{m.u}</span></div>
              <Bar value={(m.v / m.t) * 100} color={m.v >= m.t ? "bg-emerald-500" : "bg-indigo-500"} /></div>))}</div></Card>
          <Card><H sub="⭐ marks your two priority competencies">Programmer → Software Engineer</H><div className="space-y-3">{COMP.map((c) => (
            <div key={c}><p className="mb-1 text-xs font-semibold text-slate-600">{PRIORITY_COMP.includes(c) && "⭐ "}{c}</p>
              <select className={inp} value={db.ratings[c] ?? 0} onChange={(e) => update((d) => ({ ...d, ratings: { ...d.ratings, [c]: +e.target.value } }))}>{LEVELS.map((l, i) => <option key={l} value={i}>{l}</option>)}</select></div>))}</div></Card>
        </div>
      </div>
    </div>
  );
}

/* ================= Weekly review ================= */
function Review({ db, sel }: P) {
  const ws = weekStart(sel), we = shift(ws, 6), nx = shift(ws, 7), nxe = shift(ws, 13);
  const inW = (d: string) => d >= ws && d <= we;
  const doneW = db.tasks.filter((t) => t.completedOn && inW(t.completedOn));
  const carried = db.tasks.filter((t) => !isDone(t) && t.due && t.due <= we);
  const bl = db.blockers.filter((b) => b.status !== "Resolved" || inW(b.identified));
  const notes = db.notes.filter((n) => inW(n.date));
  const days = Array.from({ length: 7 }, (_, i) => shift(ws, i)).map((d) => db.days[d]).filter(Boolean) as Day[];
  const mins = days.reduce((s, d) => s + d.learnMin, 0);
  const next = db.tasks.filter((t) => !isDone(t) && ((t.due >= nx && t.due <= nxe) || t.priority === "High")).sort((a, b) => rank[a.priority] - rank[b.priority] || a.due.localeCompare(b.due)).slice(0, 8);
  const L = ({ items, empty }: { items: string[]; empty: string }) => items.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-sm text-slate-400">{empty}</p>;
  return (
    <div className="space-y-5">
      <Title sub={`${nice(ws)} – ${nice(we)} · change the date at the top to review another week`}>Weekly review</Title>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[["Tasks completed", doneW.length], ["Carried forward", carried.length], ["Days logged", days.filter((d) => d.done || d.next).length], ["Learning minutes", mins]].map(([l, v]) =>
        <Card key={l}><p className="text-xs font-semibold text-slate-500">{l}</p><p className="mt-1 text-3xl font-extrabold text-indigo-600">{v}</p></Card>)}</div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card><H>Completed this week</H><L items={doneW.map((t) => t.title)} empty="Nothing completed yet." /></Card>
        <Card><H sub="Unfinished and due on or before this week's end">Carried forward</H><L items={carried.map((t) => `${t.title} (due ${nice(t.due)})`)} empty="Nothing carried over." /></Card>
        <Card><H>Important blockers</H><L items={bl.map((b) => `${b.issue} — ${b.status}`)} empty="No blockers." /></Card>
        <Card><H>Learning progress</H><L items={[...notes.map((n) => `${n.type}: ${Object.values(n.v)[0] ?? ""}`), ...days.filter((d) => d.learning).map((d) => d.learning)]} empty="No learning recorded this week." /></Card>
      </div>
      <Card><H sub="Open high-priority tasks and anything due next week">Priorities for next week</H><L items={next.map((t) => `${t.title} (${t.priority}, due ${nice(t.due)})`)} empty="Nothing planned yet." /></Card>
    </div>
  );
}

/* ================= Calendar (view only) ================= */
function recordsOn(db: DB, date: string) {
  const day = db.days[date];
  const tasks = db.tasks.filter((t) => t.due === date || t.completedOn === date);
  const blockers = db.blockers.filter((b) => b.identified === date || b.raised === date);
  const notes = db.notes.filter((n) => n.date === date);
  const prs = db.prs.filter((p) => p.date === date);
  const written = !!(day && (day.done.trim() || day.next.trim() || day.blockers.trim() || day.learning.trim() || day.checks.length || day.standup || day.learnMin));
  return { day, tasks, blockers, notes, prs, count: (written ? 1 : 0) + tasks.length + blockers.length + notes.length + prs.length };
}
function monthCells(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const pad = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: pad }, () => null);
  for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) cells.push(`${y}-${p2(m)}-${p2(d)}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
const Line = ({ k, v }: { k: string; v?: string }) => (v?.trim() ? <p className="text-sm"><b className="text-slate-500">{k}:</b> <span className="whitespace-pre-wrap">{v}</span></p> : null);
function CalendarView({ db, sel, setSel }: { db: DB; sel: string; setSel: (s: string) => void }) {
  const [ym, setYm] = useState(sel.slice(0, 7));
  useEffect(() => setYm(sel.slice(0, 7)), [sel]);
  const shiftMonth = (n: number) => {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setYm(`${d.getFullYear()}-${p2(d.getMonth() + 1)}`);
  };
  const cells = monthCells(ym);
  const monthDates = cells.filter((d): d is string => !!d);
  const logged = monthDates.filter((d) => recordsOn(db, d).count > 0).length;
  const complete = monthDates.filter((d) => { const day = db.days[d]; return !!(day?.done.trim() && day.next.trim()); }).length;
  const rec = recordsOn(db, sel);
  const day = rec.day ?? emptyDay();
  const reqs: [string, boolean][] = [
    ["Work completed is written", !!day.done.trim()],
    ["Next steps are written", !!day.next.trim()],
    ["Blockers are noted", !!(day.blockers.trim() || rec.blockers.length)],
    ["Learning is noted", !!(day.learning.trim() || rec.notes.some((n) => n.type === "Learning note"))],
    ["Stand-up update given", day.standup],
    ["At least 15 minutes of learning logged", day.learnMin >= 15],
    ["Daily checklist complete", day.checks.length >= DAILY.length],
  ];
  const met = reqs.filter(([, ok]) => ok).length;
  return (
    <div className="space-y-5">
      <Title sub="View only. Colored dates already have saved records. Click a date to open everything entered that day.">Calendar</Title>
      <div className="grid grid-cols-3 gap-4">
        {[["Days with records", logged], ["Days with a full update", complete], ["Requirements on this date", `${met}/${reqs.length}`]].map(([l, v]) =>
          <Card key={l}><p className="text-xs font-semibold text-slate-500">{l}</p><p className="mt-1 text-2xl font-extrabold text-indigo-600">{v}</p></Card>)}
      </div>
      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <button className={ghost} onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
          <h2 className="text-base font-bold text-slate-900">{parse(ym + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
          <button className={ghost} onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const r = recordsOn(db, d);
            const full = !!(r.day?.done.trim() && r.day.next.trim());
            const bg = !r.count ? "bg-white text-slate-700 hover:bg-slate-50" : full ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200" : "bg-amber-100 text-amber-900 hover:bg-amber-200";
            return (
              <button key={d} onClick={() => setSel(d)} className={`flex min-h-14 flex-col items-center rounded-xl border px-1 py-1.5 text-sm transition ${bg} ${d === sel ? "border-indigo-500 ring-2 ring-indigo-400" : "border-transparent"} ${d === today() ? "font-extrabold" : ""}`}>
                {parse(d).getDate()}
                <span className="mt-1 flex h-1.5 gap-0.5">
                  {r.tasks.length > 0 && <i className="h-1.5 w-1.5 rounded-full bg-sky-500" />}
                  {r.notes.length > 0 && <i className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
                  {r.blockers.length > 0 && <i className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                  {r.prs.length > 0 && <i className="h-1.5 w-1.5 rounded-full bg-violet-500" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-emerald-200" /> Full daily update</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-amber-200" /> Some records</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Task</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Note</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Blocker</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-violet-500" /> PR</span>
        </div>
      </Card>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="text-lg font-extrabold text-slate-900">{long(sel)}</h2><p className="text-xs text-slate-500">Saved records for this date. Nothing here can be edited.</p></div>
        <Badge text={met === reqs.length ? "All requirements met" : `${met} of ${reqs.length} requirements met`} cls={met === reqs.length ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><H sub="From the daily routine in your development plan">Requirements</H>
          <Bar value={(met / reqs.length) * 100} color={met === reqs.length ? "bg-emerald-500" : "bg-amber-400"} />
          <div className="mt-3">{reqs.map(([l, ok]) => <p key={l} className="flex items-start gap-2 py-1 text-sm"><span className={ok ? "text-emerald-600" : "text-slate-300"}>{ok ? "✓" : "○"}</span><span className={ok ? "" : "text-slate-500"}>{l}</span></p>)}</div></Card>
        <Card><H>Written update</H>
          {day.done || day.next || day.blockers || day.learning ? <div className="space-y-1.5">
            <Line k="Done" v={day.done} /><Line k="Next" v={day.next} /><Line k="Blockers" v={day.blockers} /><Line k="Learning" v={day.learning} />
            <p className="text-sm text-slate-500">Learning time: <b className="text-slate-700">{day.learnMin} min</b> · Stand-up: <b className="text-slate-700">{day.standup ? "Given" : "Not marked"}</b></p>
          </div> : <Empty text="No written update on this date." />}</Card>
        <Card><H sub={`${day.checks.length} of ${DAILY.length}`}>Daily checklist</H>
          {DAILY.map((l, i) => <p key={l} className="flex items-start gap-2 py-1 text-sm"><span className={day.checks.includes(String(i)) ? "text-emerald-600" : "text-slate-300"}>{day.checks.includes(String(i)) ? "✓" : "○"}</span><span className={day.checks.includes(String(i)) ? "" : "text-slate-500"}>{l}</span></p>)}</Card>
        <Card><H>Tasks</H>
          {rec.tasks.length === 0 ? <Empty text="No tasks due or completed on this date." /> : <div className="space-y-3">{rec.tasks.map((t) => (
            <div key={t.id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex flex-wrap items-center gap-1.5"><p className="font-semibold">{t.title}</p><Badge text={t.status} /><Badge text={t.priority} />{t.project && <Badge text={t.project} cls="bg-indigo-50 text-indigo-700" />}</div>
              <div className="mt-1.5 space-y-0.5 text-slate-600"><Line k="Description" v={t.description} /><Line k="Done" v={t.workToday} /><Line k="Next" v={t.nextSteps} /><Line k="Blocker" v={t.blockers} /><Line k="Help" v={t.help} /></div></div>))}</div>}</Card>
        <Card className="lg:col-span-2"><H>Notes & templates</H>
          {rec.notes.length === 0 ? <Empty text="No notes on this date." /> : <div className="grid gap-3 sm:grid-cols-2">{rec.notes.map((n) => (
            <div key={n.id} className="rounded-xl bg-slate-50 p-3"><Badge text={n.type} cls="bg-indigo-50 text-indigo-700" />
              <div className="mt-2 space-y-1">{(TPL[n.type] ?? Object.keys(n.v)).map((f) => <Line key={f} k={f} v={n.v[f]} />)}</div></div>))}</div>}</Card>
        <Card><H>Blockers</H>
          {rec.blockers.length === 0 ? <Empty text="No blockers on this date." /> : <div className="space-y-3">{rec.blockers.map((b) => (
            <div key={b.id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex flex-wrap items-center gap-1.5"><p className="font-semibold">{b.issue}</p><Badge text={b.status} /></div>
              <div className="mt-1.5 space-y-0.5"><Line k="Impact" v={b.impact} /><Line k="Tried" v={b.tried} /><Line k="Help" v={b.help} />
                <p className="text-xs text-slate-400">Identified {nice(b.identified)}{b.raised ? ` · raised ${nice(b.raised)}` : ""}</p></div></div>))}</div>}</Card>
        <Card><H>PR & handover</H>
          {rec.prs.length === 0 ? <Empty text="No PRs on this date." /> : <div className="space-y-3">{rec.prs.map((p) => (
            <div key={p.id} className="rounded-xl bg-slate-50 p-3 text-sm"><div className="flex flex-wrap items-center gap-1.5"><p className="font-semibold">{p.title}</p>
              <Badge text={`${p.checks.length}/${PRC.length} checklist`} cls={p.checks.length === PRC.length ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"} /></div>
              <ul className="mt-2 space-y-0.5">{PRC.map((l, i) => <li key={l} className="text-xs"><span className={p.checks.includes(String(i)) ? "text-emerald-600" : "text-slate-300"}>{p.checks.includes(String(i)) ? "✓" : "○"}</span> <span className={p.checks.includes(String(i)) ? "" : "text-slate-500"}>{l}</span></li>)}</ul>
              {p.ai && <p className="mt-1.5 text-xs text-slate-600"><b>AI:</b> {p.ai}</p>}</div>))}</div>}</Card>
      </div>
    </div>
  );
}

/* ================= Data ================= */
function Data({ db, setDb, mode }: { db: DB; setDb: (d: DB) => void; mode: string }) {
  const file = useRef<HTMLInputElement>(null); const [msg, setMsg] = useState("");
  const exportJson = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: "application/json" })); a.download = `lumiflow-backup-${today()}.json`; a.click(); setMsg("Backup downloaded."); };
  const importJson = async (f?: File) => {
    if (!f) return;
    try { const d = JSON.parse(await f.text()); if (!Array.isArray(d.tasks)) throw new Error(); if (confirm("Replace your current data with this file?")) { setDb(dropSamples(d)); setMsg("Data imported."); } }
    catch { setMsg("That file isn't a valid LumiFlow backup."); }
    if (file.current) file.current.value = "";
  };
  return (
    <div className="space-y-5"><Title>Your data</Title>
      <Card><H sub={mode === "file" ? "Auto-saved to data/lumiflow-data.json in the project folder." : "Auto-saved in this browser. Run npm run dev to also save to a JSON file."}>Where your data lives</H>
        <div className="flex flex-wrap gap-2"><button className={primary} onClick={exportJson}>Export JSON</button><button className={ghost} onClick={() => file.current?.click()}>Import JSON</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0])} /></div>{msg && <p className="mt-3 text-sm text-emerald-700">{msg}</p>}</Card>
      <Card><H sub="Permanently clears everything. Export a backup first.">Reset</H>
        <button className={btn + "bg-rose-600 text-white hover:bg-rose-700"} onClick={() => confirm("Delete ALL data?") && setDb(emptyDB())}>Delete all data</button></Card>
    </div>
  );
}

/* ================= App shell ================= */
type Page = "dashboard" | "daily" | "calendar" | "tasks" | "blockers" | "notes" | "prs" | "plan" | "review" | "data";
const NAV: [Page, string, string][] = [["dashboard", "Dashboard", "🏠"], ["daily", "Daily update", "📓"], ["calendar", "Calendar", "📅"], ["tasks", "Tasks & projects", "✅"], ["blockers", "Blockers", "🚧"],
  ["notes", "Notes & templates", "📝"], ["prs", "PR checklist", "🔀"], ["plan", "Development plan", "🌱"], ["review", "Weekly review", "📊"], ["data", "Backup & data", "💾"]];

export default function App() {
  const [db, setDb] = useState<DB | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [sel, setSel] = useState(today());
  const [menu, setMenu] = useState(false);
  const [mode, setMode] = useState("browser");
  useEffect(() => {
    (async () => {
      let d: DB | null = null;
      try { const j = await (await fetch("/api/data")).json(); if (j && Array.isArray(j.tasks)) { d = j; setMode("file"); } } catch { /* no file server */ }
      if (!d) { try { const raw = localStorage.getItem(KEY); if (raw) d = JSON.parse(raw); } catch { /* ignore */ } }
      setDb(dropSamples(d));
    })();
  }, []);
  useEffect(() => {
    if (!db) return;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full */ }
    const t = setTimeout(() => { fetch("/api/data", { method: "POST", body: JSON.stringify(db, null, 2) }).then((r) => setMode(r.ok ? "file" : "browser"), () => setMode("browser")); }, 400);
    return () => clearTimeout(t);
  }, [db]);
  if (!db) return <div className="grid min-h-screen place-items-center text-slate-400">Loading LumiFlow…</div>;
  const update: Upd = (f) => setDb((d) => (d ? f(d) : d));
  const go = (p: Page) => { setPage(p); setMenu(false); };
  const common = { db, update, sel };
  return (
    <div className="min-h-screen lg:flex">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-[#171a33] p-5 text-slate-300 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-8 flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400 text-lg shadow-[0_0_18px_rgba(251,191,36,.55)]">✨</span>
          <div><p className="text-lg font-extrabold leading-none text-white">LumiFlow</p><p className="text-[11px] text-slate-400">Work & growth tracker</p></div></div>
        <nav className="space-y-1">{NAV.map(([p, l, i]) => <button key={p} onClick={() => go(p)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${page === p ? "bg-white/10 text-white" : "hover:bg-white/5"}`}><span>{i}</span>{l}</button>)}</nav>
        <p className="absolute bottom-5 left-5 right-5 text-[11px] text-slate-500">{mode === "file" ? "● Saved to data/lumiflow-data.json" : "● Saved in this browser"}</p>
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setMenu(false)} />}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
          <button onClick={() => setMenu(true)} className="mr-1 text-xl lg:hidden" aria-label="Menu">☰</button>
          <button className={ghost} onClick={() => setSel(shift(sel, -1))} aria-label="Previous day">‹</button>
          <input type="date" aria-label="Selected date" className={inp + " !w-auto"} value={sel} onChange={(e) => e.target.value && setSel(e.target.value)} />
          <button className={ghost} onClick={() => setSel(shift(sel, 1))} aria-label="Next day">›</button>
          {sel !== today() && <button className={primary} onClick={() => setSel(today())}>Back to today</button>}
          {sel !== today() && <span className="text-xs font-medium text-amber-600">Viewing {sel < today() ? "a past" : "a future"} date</span>}
        </header>
        <div className="mx-auto max-w-6xl p-4 sm:p-8">
          {page === "dashboard" && <Dashboard {...common} go={go} />}{page === "daily" && <Daily {...common} />}{page === "calendar" && <CalendarView db={db} sel={sel} setSel={setSel} />}{page === "tasks" && <Tasks {...common} />}
          {page === "blockers" && <Blockers {...common} />}{page === "notes" && <Notes {...common} />}{page === "prs" && <PRs {...common} />}
          {page === "plan" && <Plan {...common} />}{page === "review" && <Review {...common} />}{page === "data" && <Data db={db} setDb={setDb} mode={mode} />}
        </div>
      </main>
    </div>
  );
}
