import { fetchSubmissionsFromSupabase, saveSubmissionToSupabase, updateSubmissionAiFeedback } from "../lib/supabase";
import { mergeSubmissions, submissionStorage } from "../utils/storage";
import { feedbackWithContext } from "../utils/reviewState";
import type { workspaceStorage } from "../utils/workspaceStorage";

export async function syncAccountHistory(store: ReturnType<typeof workspaceStorage>) {
  const owner = store.owner;
  if (!owner) return;
  const { getStoredSubmissions, updateStoredSubmission, syncStoredSubmissions } = submissionStorage(store);
  const response = await fetchSubmissionsFromSupabase(owner);
  if (response.error) throw response.error;
  // Retry only writes created in this account. Imports and guest work are explicit transfers.
  for (const local of getStoredSubmissions()) {
    if (!local.pendingAccountSave || !local.id) continue;
    const remote = response.submissions.find(s => s.id === (local.cloudId || local.id));
    let cloudId = remote?.id;
    if (!cloudId) {
      const saved = await saveSubmissionToSupabase(owner, local);
      if (saved.error) throw saved.error;
      cloudId = saved.data?.id;
    }
    const latest = getStoredSubmissions().find(s => s.id === local.id);
    if (cloudId && latest) {
      if (latest.aiEvaluation && (!remote?.aiEvaluation || (remote.aiEvaluation.id !== latest.aiEvaluation.id &&
          Date.parse(latest.aiEvaluation.created_at) >= Date.parse(remote.aiEvaluation.created_at)))) {
        const feedback = await updateSubmissionAiFeedback(cloudId, owner, feedbackWithContext(latest));
        if (feedback.error) throw feedback.error;
      }
      const current = getStoredSubmissions().find(s => s.id === local.id);
      if (current) updateStoredSubmission({ ...current, cloudId, pendingAccountSave: current.aiEvaluation?.id !== latest.aiEvaluation?.id });
    }
  }
  syncStoredSubmissions(mergeSubmissions(response.submissions, getStoredSubmissions()));
}
