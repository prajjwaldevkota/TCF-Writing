import { supabase } from "../lib/supabase";
import { mergeProgress, type ProgressData, type workspaceStorage } from "../utils/workspaceStorage";

export async function syncLearningProgress(store: ReturnType<typeof workspaceStorage>): Promise<boolean> {
  if (!supabase || !store.owner) return false;
  const db = supabase;
  const owner = store.owner;
  const sync = async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: row, error } = await db.from("learning_progress").select("revision, data").eq("user_id", owner).maybeSingle();
      if (error) throw error;
      const remote: ProgressData = row?.data ?? {};
      const cache = store.read();
      const next = mergeProgress(cache.base, cache.data, remote);
      if (JSON.stringify(next) !== JSON.stringify(remote)) {
        const write = row
          ? db.from("learning_progress").update({ data: next, revision: row.revision + 1 }).eq("user_id", owner).eq("revision", row.revision)
          : db.from("learning_progress").insert({ user_id: owner, data: next });
        const saved = await write.select("revision").maybeSingle();
        if (saved.error?.code === "23505") continue;
        if (saved.error) throw saved.error;
        if (!saved.data) continue;
      }
      const latest = store.read();
      const data = mergeProgress(cache.data, latest.data, next);
      if (JSON.stringify(latest.base) !== JSON.stringify(next) || JSON.stringify(latest.data) !== JSON.stringify(data))
        store.save({ base: next, data });
      return JSON.stringify(data) !== JSON.stringify(latest.data);
    }
    throw new Error("Learning progress changed during sync. Retry.");
  };
  return navigator.locks ? navigator.locks.request(store.progressKey, sync) : sync();
}
