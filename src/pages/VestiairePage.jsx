import { Pin, MessageCircle, Flame } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const ROLE_LABELS = {
  super_admin: "Super admin", admin: "Administrateur", coach: "Entraîneur",
  board_member: "Bureau", player: "Joueur",
};
const canPublish = (role) => ["super_admin", "admin", "coach", "board_member"].includes(role);
const canModerate = (role) => ["super_admin", "admin"].includes(role);

function fmtDateTime(s) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T"));
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " " +
         d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function VestiairePage() {
  const { token, activeClubId, activeRole } = useAuth();
  const publish = canPublish(activeRole);

  const [posts, setPosts] = useState(null);
  const [myMemberId, setMyMemberId] = useState(null);
  const [form, setForm] = useState(null); // null | {title, content, post_id?}
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("posts.php", "list", { club_id: activeClubId }, token)
      .then((d) => { setPosts(d.posts); setMyMemberId(d.my_member_id); })
      .catch((e) => setError(e.message));
  }, [activeClubId, token]);

  useEffect(load, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (form.post_id) {
        await api("posts.php", "update", { club_id: activeClubId, post_id: form.post_id, title: form.title, content: form.content }, token);
      } else {
        await api("posts.php", "create", { club_id: activeClubId, title: form.title, content: form.content }, token);
      }
      setForm(null);
      load();
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  const remove = async (postId) => {
    if (!confirm("Supprimer cette annonce et ses commentaires ?")) return;
    setError("");
    try {
      await api("posts.php", "delete", { club_id: activeClubId, post_id: postId }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  const pin = async (postId, pinned) => {
    setError("");
    try {
      await api("posts.php", "pin", { club_id: activeClubId, post_id: postId, pinned }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  const react = async (postId, emoji) => {
    setError("");
    try {
      await api("posts.php", "reaction_toggle", { club_id: activeClubId, post_id: postId, emoji }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="page-title">Vestiaire</h1>
        {publish && (
          <button className="btn btn-secondary btn-sm" onClick={() => setForm(form ? null : { title: "", content: "" })}>
            {form ? "Annuler" : "+ Nouvelle annonce"}
          </button>
        )}
      </div>
      {error && <div className="error-box">{error}</div>}

      {form && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">{form.post_id ? "Modifier l'annonce" : "Nouvelle annonce"}</div>
          <form onSubmit={submit}>
            <div className="field"><label>Titre</label><input type="text" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="field">
              <label>Contenu</label>
              <textarea
                required rows={5} value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "11px 13px", borderRadius: "var(--radius-sm)", fontFamily: "inherit", fontSize: "0.95rem", outline: "none", resize: "vertical" }}
              />
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Publication…" : form.post_id ? "Enregistrer" : "Publier"}</button>
          </form>
        </div>
      )}

      {posts === null && <div className="spinner" />}
      {posts?.length === 0 && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucune annonce pour le moment{publish ? " — publie la première !" : "."}</p></div>
      )}

      {posts?.map((p) => (
        <PostCard
          key={p.id} post={p} myMemberId={myMemberId} activeRole={activeRole}
          onEdit={() => setForm({ post_id: p.id, title: p.title, content: p.content })}
          onDelete={() => remove(p.id)}
          onPin={() => pin(p.id, Number(p.pinned) ? 0 : 1)}
          onReact={(emoji) => react(p.id, emoji)}
          canPublish={publish}
        />
      ))}
    </div>
  );
}

function PostCard({ post: p, myMemberId, activeRole, onEdit, onDelete, onPin, onReact, canPublish: publish }) {
  const isMine = p.author_member_id === myMemberId;
  const moderate = canModerate(activeRole);
  const [showComments, setShowComments] = useState(false);
  const REACTIONS = ["👍", "❤️", "😂", "🔥", "👏"];
  const counts = p.reactions ?? {};

  return (
    <div className="card" style={{ marginBottom: 12, borderColor: Number(p.pinned) ? "var(--oc-blue-600)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {Number(p.pinned) === 1 && <span title="Épinglé" style={{ display: "inline-flex", color: "var(--oc-blue-deep)" }}><Pin size={15} /></span>}
            <strong style={{ fontSize: "1.05rem" }}>{p.title}</strong>
          </div>
          <div className="subtle">
            {p.author_first_name ? `${p.author_first_name} ${p.author_last_name}` : "Ancien membre"}
            {p.author_role ? ` (${ROLE_LABELS[p.author_role]})` : ""} — {fmtDateTime(p.created_at)}
          </div>
        </div>
        {(isMine || moderate) && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            {publish && <button className="btn btn-ghost btn-sm" onClick={onPin}>{Number(p.pinned) ? "Désépingler" : "Épingler"}</button>}
            <button className="btn btn-ghost btn-sm" onClick={onEdit}>Modifier</button>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger-600)" }} onClick={onDelete}>Suppr.</button>
          </div>
        )}
      </div>

      <p style={{ whiteSpace: "pre-wrap", fontSize: "0.93rem", margin: "10px 0" }}>{p.content}</p>

      <div className="reaction-bar">
        {REACTIONS.map((emoji) => counts[emoji] || p.my_reaction === emoji ? (
          <span key={emoji} className={`reaction-pill ${p.my_reaction === emoji ? "mine" : ""}`} onClick={() => onReact(emoji)}>
            {emoji} {counts[emoji] ?? 0}
          </span>
        ) : null)}
        {REACTIONS.filter((e) => !counts[e] && p.my_reaction !== e).map((emoji) => (
          <span key={emoji} className="reaction-pill" style={{ opacity: 0.45 }} onClick={() => onReact(emoji)}>{emoji}</span>
        ))}
      </div>

      <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setShowComments((v) => !v)}>
        <MessageCircle size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />{p.comment_count} commentaire{p.comment_count > 1 ? "s" : ""}
      </button>

      {showComments && <Comments postId={p.id} myMemberId={myMemberId} moderate={moderate} />}
    </div>
  );
}

function Comments({ postId, myMemberId, moderate }) {
  const { token, activeClubId } = useAuth();
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api("posts.php", "comment_list", { club_id: activeClubId, post_id: postId }, token)
      .then((d) => setComments(d.comments)).catch((e) => setError(e.message));
  }, [activeClubId, postId, token]);

  useEffect(load, [load]);

  const add = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await api("posts.php", "comment_add", { club_id: activeClubId, post_id: postId, content: text }, token);
      setText(""); load();
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  const remove = async (commentId) => {
    setError("");
    try {
      await api("posts.php", "comment_delete", { club_id: activeClubId, comment_id: commentId }, token);
      load();
    } catch (e2) { setError(e2.message); }
  };

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
      {error && <div className="error-box">{error}</div>}
      {comments === null && <div className="spinner" />}
      {comments?.map((c) => (
        <div key={c.id} className="list-row" style={{ padding: "7px 0", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: "0.85rem" }}>{c.first_name ? `${c.first_name} ${c.last_name}` : "Ancien membre"}</strong>
            <span className="subtle" style={{ marginLeft: 8 }}>{fmtDateTime(c.created_at)}</span>
            <div style={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{c.content}</div>
          </div>
          {(c.author_member_id === myMemberId || moderate) && (
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger-600)", flexShrink: 0 }} onClick={() => remove(c.id)}>Suppr.</button>
          )}
        </div>
      ))}
      <form onSubmit={add} style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input type="text" placeholder="Ajouter un commentaire…" value={text} onChange={(e) => setText(e.target.value)} required style={{ flex: 1 }} />
        <button className="btn btn-secondary btn-sm" disabled={busy || !text.trim()}>Envoyer</button>
      </form>
    </div>
  );
}
