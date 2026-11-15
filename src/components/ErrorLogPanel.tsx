import React, { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useLanguage } from "../context/LanguageContext";
import type { StoredErrorLog } from "../types/errorLog";

const pageSize = 50;
export function ErrorLogPanel() {
  const { language } = useLanguage();
  const en = language === "en";
  const [rows, setRows] = useState<StoredErrorLog[]>([]);
  const [page, setPage] = useState(0);
  const [source, setSource] = useState("");
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const sequence = useRef(0);
  const load = async (nextPage = 0) => {
    const current = ++sequence.current;
    setBusy(true);
    setError("");
    setStorageWarning("");
    try {
      try {
        const response = await fetch("/api/error-logs", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        const status = await response.json();
        if (sequence.current !== current) return;
        const warnings: Record<string, string> = {
          missing_database_url: en
            ? "Error logging is disabled: set SUPABASE_URL or VITE_SUPABASE_URL in Vercel, then redeploy."
            : "Journal désactivé : configurez SUPABASE_URL ou VITE_SUPABASE_URL dans Vercel, puis redéployez.",
          missing_server_key: en
            ? "Errors cannot be saved: SUPABASE_SERVICE_ROLE_KEY is missing on the Vercel server. Add it to the deployment environment and redeploy."
            : "Les erreurs ne peuvent pas être enregistrées : SUPABASE_SERVICE_ROLE_KEY manque sur le serveur Vercel. Ajoutez-la à l’environnement du déploiement, puis redéployez.",
          database_access_denied: en
            ? "The server cannot access the error table. Check that its Supabase service-role key belongs to the configured project."
            : "Le serveur ne peut pas accéder au journal. Vérifiez que sa clé Supabase service-role appartient au projet configuré.",
          missing_table: en
            ? "The server cannot find the error table. Apply supabase/error-logs.sql to the server’s Supabase project."
            : "Le serveur ne trouve pas le journal. Appliquez supabase/error-logs.sql au projet Supabase du serveur.",
        };
        if (!response.ok || status.storage !== "ready")
          setStorageWarning(warnings[status.storage] || (en
            ? "The server’s error storage is unavailable. Check Supabase connectivity and Vercel logs."
            : "Le stockage des erreurs est indisponible. Vérifiez la connexion Supabase et les journaux Vercel."));
      } catch {
        if (sequence.current === current)
          setStorageWarning(en
            ? "The server’s error storage could not be checked."
            : "Impossible de vérifier le stockage des erreurs du serveur.");
      }
      if (!supabase) throw new Error("not_configured");
      const id = requestId.trim();
      if (
        id &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        )
      )
        throw new Error("invalid_reference");
      let query = supabase
        .from("error_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (source) query = query.eq("source", source);
      if (id) query = query.eq("request_id", id);
      const result = await query.range(
        nextPage * pageSize,
        (nextPage + 1) * pageSize,
      );
      if (result.error) throw result.error;
      if (sequence.current !== current) return;
      setHasNext((result.data || []).length > pageSize);
      setRows((result.data || []).slice(0, pageSize) as StoredErrorLog[]);
      setPage(nextPage);
      setLoaded(true);
    } catch (e) {
      if (sequence.current !== current) return;
      const code = (e as { code?: string })?.code;
      setError(
        e instanceof Error && e.message === "invalid_reference"
          ? en
            ? "Enter a full request reference (UUID)."
            : "Saisissez une référence complète (UUID)."
          : code === "42P01" || code === "PGRST205"
            ? en
              ? "The error log table is not installed yet. Apply supabase/error-logs.sql to your project."
              : "La table des erreurs n’est pas encore installée. Appliquez supabase/error-logs.sql à votre projet."
            : en
              ? "Logs could not be loaded. Check the Supabase connection and your admin role, then try again."
              : "Impossible de charger les erreurs. Vérifiez la connexion Supabase et votre rôle administrateur, puis réessayez.",
      );
      setRows([]);
      setHasNext(false);
    } finally {
      if (sequence.current === current) setBusy(false);
    }
  };
  return (
    <section
      className="panel settings-section error-log-panel"
      aria-labelledby="error-log-title"
    >
      <div className="section-head">
        <h2 id="error-log-title">
          {en ? "Error logs" : "Journal des erreurs"}
        </h2>
        <span className="badge neutral">
          {en ? "Admin only" : "Administrateurs"}
        </span>
      </div>
      <p>
        {en
          ? "Review connection failures and model fallback attempts. Search the reference shown with an error to follow the same request. Times use your local timezone."
          : "Consultez les échecs de connexion et les tentatives de secours. Recherchez la référence affichée avec une erreur pour suivre la même demande. Les heures sont locales."}
      </p>
      <form
        className="error-log-filters"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label className="field-label">
          {en ? "Source" : "Origine"}
          <select
            value={source}
            disabled={busy}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">{en ? "All" : "Toutes"}</option>
            <option value="server">{en ? "Server" : "Serveur"}</option>
            <option value="client">{en ? "Browser" : "Navigateur"}</option>
          </select>
        </label>
        <label className="field-label">
          {en ? "Request reference" : "Référence de la demande"}
          <input
            value={requestId}
            disabled={busy}
            onChange={(e) => setRequestId(e.target.value)}
            placeholder={en ? "All requests" : "Toutes les demandes"}
          />
        </label>
        <button className="button secondary" disabled={busy} type="submit">
          <RefreshCw size={16} />
          {busy
            ? en
              ? "Loading…"
              : "Chargement…"
            : en
              ? "Load logs"
              : "Charger le journal"}
        </button>
      </form>
      {error && (
        <p className="notice warning" role="alert">
          {error}
        </p>
      )}
      {storageWarning && (
        <p className="notice warning" role="alert">{storageWarning}</p>
      )}
      {!loaded && !error && (
        <p className="muted text-small">
          {en
            ? "Load logs to see the latest 50 entries."
            : "Chargez le journal pour voir les 50 dernières entrées."}
        </p>
      )}
      {loaded && !error && (
        <>
          <p role="status" className="muted text-small">
            {rows.length
              ? en
                ? `Page ${page + 1} · ${rows.length} entries`
                : `Page ${page + 1} · ${rows.length} entrées`
              : en
                ? "No errors match these filters."
                : "Aucune erreur ne correspond à ces filtres."}
          </p>
          {!!rows.length && (
            <div
              className="error-log-scroll"
              tabIndex={0}
              role="region"
              aria-label={en ? "Error log entries" : "Entrées du journal"}
            >
              <table className="error-log-table">
                <thead>
                  <tr>
                    {(en
                      ? [
                          "Time",
                          "Failure",
                          "Model / key",
                          "HTTP",
                          "Duration",
                          "Details",
                        ]
                      : [
                          "Heure",
                          "Échec",
                          "Modèle / clé",
                          "HTTP",
                          "Durée",
                          "Détails",
                        ]
                    ).map((title) => (
                      <th scope="col" key={title}>
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <time dateTime={row.created_at}>
                          {new Date(row.created_at).toLocaleString(
                            en ? "en-CA" : "fr-CA",
                          )}
                        </time>
                        <small>{row.source}</small>
                      </td>
                      <td>
                        <strong>{row.code}</strong>
                        <small>{row.stage}</small>
                      </td>
                      <td>
                        {row.model || "—"}
                        <small>
                          {row.key_source || "—"}
                          {row.attempt ? ` · #${row.attempt}` : ""}
                        </small>
                      </td>
                      <td>{row.http_status || "—"}</td>
                      <td>{(row.duration_ms / 1000).toFixed(1)} s</td>
                      <td>
                        <details>
                          <summary>{en ? "Inspect" : "Consulter"}</summary>
                          <dl>
                            <dt>{en ? "Reference" : "Référence"}</dt>
                            <dd>
                              <code>{row.request_id}</code>
                            </dd>
                            <dt>{en ? "Provider code" : "Code fournisseur"}</dt>
                            <dd>{row.provider_code || "—"}</dd>
                            <dt>{en ? "Error type" : "Type d’erreur"}</dt>
                            <dd>{row.error_type || "—"}</dd>
                            <dt>{en ? "Retry after" : "Délai de reprise"}</dt>
                            <dd>
                              {row.retry_after_seconds === null
                                ? "—"
                                : `${row.retry_after_seconds} s`}
                            </dd>
                            <dt>
                              {en
                                ? "Deployment / region"
                                : "Déploiement / région"}
                            </dt>
                            <dd>
                              {row.deployment || "—"} / {row.region || "—"}
                            </dd>
                            <dt>
                              {en
                                ? "Browser context"
                                : "Contexte du navigateur"}
                            </dt>
                            <dd>
                              {row.client_context
                                ? `${row.client_context.browser} / ${row.client_context.platform} · ${row.client_context.viewport_width}×${row.client_context.viewport_height} · ${row.client_context.online ? "online" : "offline"}`
                                : "—"}
                            </dd>
                          </dl>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="row between">
            <button
              className="text-button"
              disabled={busy || page === 0}
              onClick={() => void load(page - 1)}
            >
              {en ? "Previous" : "Précédent"}
            </button>
            <button
              className="text-button"
              disabled={busy || !hasNext}
              onClick={() => void load(page + 1)}
            >
              {en ? "Next" : "Suivant"}
            </button>
          </div>
        </>
      )}
      <p className="footnote">
        {en
          ? "Logs contain technical diagnostics, with no API keys, writing, prompts or raw provider messages."
          : "Le journal contient des diagnostics techniques, sans clés API, rédactions, consignes ou messages bruts du fournisseur."}
      </p>
    </section>
  );
}
