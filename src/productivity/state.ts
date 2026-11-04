import * as s from "./schema";
export type InboxItem = {
  id: string;
  text: string;
  url: string;
  createdAt: number;
  cardId: string;
};
export type Relation = {
  id: string;
  source: string;
  target: string;
  kind: "related" | "part" | "depends";
};
export type TimeBlock = {
  id: string;
  card: string;
  start: string;
  minutes: number;
};
export type ReviewItem = { id: string; until: string; reviewedAt: number };
export type Grade = {
  id: string;
  title: string;
  score: number;
  maximum: number;
  weight: number;
};
export type StudyResource = {
  id: string;
  topic: string;
  title: string;
  url: string;
};
export type CoursePlan = {
  id: string;
  checkpoint: string;
  nextStep: string;
  examDate: string;
  topics: string;
  resources: StudyResource[];
  grades: Grade[];
  showGrades: boolean;
};
export type CardTemplate = {
  id: string;
  title: string;
  name: string;
  nextStep: string;
  checklist: string;
  description: string;
};
export type RepeatRule = {
  id: string;
  card: string;
  frequency: "daily" | "weekly" | "monthly";
  next: string;
  anchor: number;
  lastOccurrence: string;
  enabled: boolean;
  automatic: boolean;
};
export type NamedBoard = {
  id: string;
  name: string;
  scope: string;
  archived: boolean;
};
export type ExperienceState = {
  version: 1;
  inbox: InboxItem[];
  today: { day: string; cards: string[] };
  relations: Relation[];
  blocks: TimeBlock[];
  estimates: { id: string; minutes: number }[];
  reviews: ReviewItem[];
  courses: CoursePlan[];
  taskEffort: { id: string; minutes: number }[];
  templates: CardTemplate[];
  repeat: RepeatRule[];
  boards: NamedBoard[];
};
export const emptyExperience = (): ExperienceState => ({
  version: 1,
  inbox: [],
  today: { day: "", cards: [] },
  relations: [],
  blocks: [],
  estimates: [],
  reviews: [],
  courses: [],
  taskEffort: [],
  templates: [],
  repeat: [],
  boards: [],
});
const boolean = (v: unknown) => (typeof v === "boolean" ? v : s.invalid());
export function parseExperience(value: unknown): ExperienceState {
  const o = s.object(value, Object.keys(emptyExperience())),
    today = s.object(o.today, ["day", "cards"]);
  if (o.version !== 1) return s.invalid();
  const minute = (v: unknown) => {
    const n = s.number(v, 5, 1440);
    if (!Number.isInteger(n)) return s.invalid();
    return n;
  };
  const durations = (v: unknown) => {
    const p = s.object(v, ["id", "minutes"]);
    return { id: s.id(p.id), minutes: minute(p.minutes) };
  };
  const state: ExperienceState = {
    version: 1,
    inbox: s.unique(
      s.list(
        o.inbox,
        (v) => {
          const p = s.object(v, ["id", "text", "url", "createdAt", "cardId"]);
          return {
            id: s.id(p.id),
            text: s.text(p.text, 1000),
            url: s.url(p.url),
            createdAt: s.number(p.createdAt),
            cardId: s.text(p.cardId, 100),
          };
        },
        500,
      ),
    ),
    today: { day: s.day(today.day), cards: s.list(today.cards, s.id, 3) },
    relations: s.unique(
      s.list(
        o.relations,
        (v) => {
          const p = s.object(v, ["id", "source", "target", "kind"]);
          return {
            id: s.id(p.id),
            source: s.id(p.source),
            target: s.id(p.target),
            kind: s.choice(p.kind, ["related", "part", "depends"]),
          };
        },
        400,
      ),
    ),
    blocks: s.unique(
      s.list(
        o.blocks,
        (v) => {
          const p = s.object(v, ["id", "card", "start", "minutes"]);
          const start = s.text(p.start, 35);
          if (
            !/^\d{4}-\d{2}-\d{2}T/.test(start) ||
            !Number.isFinite(Date.parse(start))
          )
            return s.invalid();
          return {
            id: s.id(p.id),
            card: s.id(p.card),
            start,
            minutes: minute(p.minutes),
          };
        },
        300,
      ),
    ),
    estimates: s.unique(s.list(o.estimates, durations, 500)),
    reviews: s.unique(
      s.list(
        o.reviews,
        (v) => {
          const p = s.object(v, ["id", "until", "reviewedAt"]);
          return {
            id: s.id(p.id),
            until: s.day(p.until),
            reviewedAt: s.number(p.reviewedAt),
          };
        },
        500,
      ),
    ),
    courses: s.unique(
      s.list(
        o.courses,
        (v) => {
          const p = s.object(v, [
            "id",
            "checkpoint",
            "nextStep",
            "examDate",
            "topics",
            "resources",
            "grades",
            "showGrades",
          ]);
          return {
            id: s.id(p.id),
            checkpoint: s.text(p.checkpoint),
            nextStep: s.text(p.nextStep),
            examDate: s.day(p.examDate),
            topics: s.text(p.topics, 6000),
            showGrades: boolean(p.showGrades),
            resources: s.unique(
              s.list(
                p.resources,
                (v) => {
                  const q = s.object(v, ["id", "topic", "title", "url"]);
                  return {
                    id: s.id(q.id),
                    topic: s.text(q.topic, 100),
                    title: s.text(q.title, 200),
                    url: s.url(q.url),
                  };
                },
                100,
              ),
            ),
            grades: s.unique(
              s.list(
                p.grades,
                (v) => {
                  const q = s.object(v, [
                    "id",
                    "title",
                    "score",
                    "maximum",
                    "weight",
                  ]);
                  const maximum = s.number(q.maximum, 0.01, 1000000);
                  return {
                    id: s.id(q.id),
                    title: s.text(q.title, 100),
                    score: s.number(q.score, 0, maximum),
                    maximum,
                    weight: s.number(q.weight, 0, 100),
                  };
                },
                50,
              ),
            ),
          };
        },
        100,
      ),
    ),
    taskEffort: s.unique(s.list(o.taskEffort, durations, 500)),
    templates: s.unique(
      s.list(
        o.templates,
        (v) => {
          const p = s.object(v, [
            "id",
            "title",
            "name",
            "nextStep",
            "checklist",
            "description",
          ]);
          return {
            id: s.id(p.id),
            title: s.text(p.title, 100),
            name: s.text(p.name, 100),
            nextStep: s.text(p.nextStep),
            checklist: s.text(p.checklist, 3000),
            description: s.text(p.description),
          };
        },
        50,
      ),
    ),
    repeat: s.unique(
      s.list(
        o.repeat,
        (v) => {
          const p = s.object(v, [
            "id",
            "card",
            "frequency",
            "next",
            "anchor",
            "lastOccurrence",
            "enabled",
            "automatic",
          ]);
          const next = s.day(p.next);
          if (!next) return s.invalid();
          return {
            id: s.id(p.id),
            card: s.id(p.card),
            frequency: s.choice(p.frequency, ["daily", "weekly", "monthly"]),
            next,
            anchor: s.number(p.anchor, 1, 31),
            lastOccurrence: s.day(p.lastOccurrence),
            enabled: boolean(p.enabled),
            automatic: boolean(p.automatic),
          };
        },
        100,
      ),
    ),
    boards: s.unique(
      s.list(
        o.boards,
        (v) => {
          const p = s.object(v, ["id", "name", "scope", "archived"]);
          const scope = s.text(p.scope, 20);
          if (scope && !/^[A-Za-z0-9]{20}$/.test(scope)) return s.invalid();
          return {
            id: s.id(p.id),
            name: s.text(p.name, 80),
            scope,
            archived: boolean(p.archived),
          };
        },
        20,
      ),
    ),
  };
  if (
    new Set(state.today.cards).size !== state.today.cards.length ||
    state.relations.some((r) => r.source === r.target) ||
    new Set(
      state.relations.map((r) =>
        r.kind === "related"
          ? [r.source, r.target].sort().join("|") + "related"
          : r.source + "|" + r.target + "|" + r.kind,
      ),
    ).size !== state.relations.length
  )
    return s.invalid();
  const walk = (key: string, path: Set<string>, done: Set<string>) => {
    if (path.has(key)) throw new s.FeatureError("experience-cycle");
    if (done.has(key)) return;
    const next = new Set(path).add(key);
    state.relations
      .filter((r) => r.kind !== "related" && r.source === key)
      .forEach((r) => walk(r.target, next, done));
    done.add(key);
  };
  const done = new Set<string>();
  state.relations.forEach((r) => walk(r.source, new Set(), done));
  if (
    state.courses.some(
      (c) => c.grades.reduce((n, g) => n + g.weight, 0) > 100.000001,
    ) ||
    JSON.stringify(state).length > 250000
  )
    return s.invalid();
  return state;
}
export const cardKey = (id: string, groupId?: string) =>
  `${groupId || "personal"}/${id}`;
