export type WorkspaceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type ProgressData = Record<string, string>;
const progressKeys = new Set([
  "tcf_favorite_topics", "tcf_user_target_goal_v1", "ecriture_personal_notes",
  "tcf_saved_mistakes_v1", "tcf_reviewed_corrections", "tcf_mistake_lifecycle_v1",
]);
interface ProgressCache {
  base: ProgressData;
  data: ProgressData;
}

export function workspaceStorage(owner: string | null) {
  const prefix = "ecriture:v1:" + (owner ? "user:" + encodeURIComponent(owner) : "guest") + ":";
  const progressKey = prefix + "progress";
  // Store the last cloud snapshot once, plus only the fields edited offline.
  function read(): ProgressCache {
    const raw = localStorage.getItem(progressKey);
    const { base, edits } = raw ? JSON.parse(raw) : { base: {}, edits: {} };
    const data: ProgressData = { ...base };
    for (const [key, value] of Object.entries(edits)) {
      if (typeof value === "string") data[key] = value;
      else delete data[key];
    }
    return { base, data };
  }
  function save({ base, data }: ProgressCache) {
    const edits: Record<string, string | null> = {};
    for (const key of progressKeys) {
      if (base[key] !== data[key]) edits[key] = data[key] ?? null;
    }
    localStorage.setItem(progressKey, JSON.stringify({ base, edits }));
  }
  const listeners = new Set<() => void>();
  function write(key: string, value: string | null) {
    if (!progressKeys.has(key)) {
      if (value === null) localStorage.removeItem(prefix + key);
      else localStorage.setItem(prefix + key, value);
      return;
    }
    const cache = read();
    if ((cache.data[key] ?? null) === value) return;
    if (value === null) delete cache.data[key];
    else cache.data[key] = value;
    save(cache);
    for (const listener of listeners) listener();
  }
  return {
    owner, progressKey, read, save,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getItem(key: string) {
      return progressKeys.has(key) ? read().data[key] ?? null : localStorage.getItem(prefix + key);
    },
    setItem: (key: string, value: string) => write(key, value),
    removeItem: (key: string) => write(key, null),
  };
}

type Entry = string | { id: string };
const entryId = (item: Entry) => typeof item === "string" ? item : item.id;

// Apply only this browser's edits since its last acknowledged cloud snapshot.
function mergeList(base: Entry[], local: Entry[], remote: Entry[]): Entry[] {
  const before = new Map(base.map(item => [entryId(item), item]));
  const after = new Map(local.map(item => [entryId(item), item]));
  const merged = new Map(remote.map(item => [entryId(item), item]));
  for (const id of before.keys()) if (!after.has(id)) merged.delete(id);
  for (const [id, item] of after)
    if (JSON.stringify(before.get(id)) !== JSON.stringify(item)) merged.set(id, item);
  return [...merged.values()];
}

export function mergeProgress(base: ProgressData, local: ProgressData, remote: ProgressData): ProgressData {
  const merged = { ...remote };
  for (const key of progressKeys) {
    if (base[key] === local[key]) continue;
    if (local[key] === undefined) { delete merged[key]; continue; }
    if (remote[key] === base[key] || key === "ecriture_personal_notes" || key === "tcf_user_target_goal_v1") {
      merged[key] = local[key];
      continue;
    }
    if (key === "tcf_mistake_lifecycle_v1") {
      const old = JSON.parse(base[key] || "{}");
      const current = JSON.parse(local[key]);
      const cloud = JSON.parse(remote[key] || "{}");
      const dates = { ...cloud.reviewedAt };
      for (const id of Object.keys(old.reviewedAt || {})) if (!current.reviewedAt?.[id]) delete dates[id];
      for (const [id, time] of Object.entries(current.reviewedAt || {}))
        if (old.reviewedAt?.[id] !== time) dates[id] = time;
      merged[key] = JSON.stringify({
        ...cloud,
        deleted: [...new Set([...(cloud.deleted || []), ...(current.deleted || [])])],
        reviewedAt: dates,
        askAfterDays: old.askAfterDays !== current.askAfterDays ? current.askAfterDays : cloud.askAfterDays,
        remindAfter: old.remindAfter !== current.remindAfter ? current.remindAfter : cloud.remindAfter,
      });
    } else {
      merged[key] = JSON.stringify(mergeList(JSON.parse(base[key] || "[]"), JSON.parse(local[key]), JSON.parse(remote[key] || "[]")));
    }
  }
  return merged;
}
