import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Avatar } from "@/components/ui";
import { Paperclip, FileEarmarkText, Download, ThreeDotsVertical, XLg } from "react-bootstrap-icons";

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fmtDateTime(s) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T"));
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function convTitle(c, myMemberId) {
  if (c.title) return c.title;
  const others = (c.participants ?? []).filter((p) => p.club_member_id !== myMemberId);
  return others.map((p) => `${p.first_name} ${p.last_name}`).join(", ") || "Conversation";
}

export function MessagesPage({ pendingConversation, onConsumePending } = {}) {
  const { token, activeClubId } = useAuth();
  const [conversations, setConversations] = useState(null);
  const [myMemberId, setMyMemberId] = useState(null);
  const [openConv, setOpenConv] = useState(null); // objet conversation
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const loadConversations = useCallback(() => {
    if (!activeClubId) return;
    api("messages.php", "conversations_list", { club_id: activeClubId }, token)
      .then((d) => { setConversations(d.conversations); setMyMemberId(d.my_member_id); })
      .catch((e) => setError(e.message));
  }, [activeClubId, token]);

  useEffect(loadConversations, [loadConversations]);

  useEffect(() => {
    if (!pendingConversation) return;
    setOpenConv({ id: pendingConversation.id, title: pendingConversation.title, participants: [] });
    onConsumePending?.();
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConversation]);

  // Poll léger de la liste (30 s) quand aucun fil n'est ouvert
  useEffect(() => {
    if (openConv) return;
    const id = setInterval(loadConversations, 30000);
    return () => clearInterval(id);
  }, [openConv, loadConversations]);

  if (openConv) {
    return (
      <Thread
        conversation={openConv}
        myMemberId={myMemberId}
        back={() => { setOpenConv(null); loadConversations(); }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="page-title">Messages</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => setCreating((v) => !v)}>
          {creating ? "Annuler" : "+ Nouvelle conversation"}
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}

      {creating && (
        <NewConversation
          myMemberId={myMemberId}
          onCreated={(conv) => { setCreating(false); loadConversations(); setOpenConv(conv); }}
        />
      )}

      {conversations === null && <div className="spinner" />}
      {conversations?.length === 0 && !creating && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucune conversation. Lance la première !</p></div>
      )}

      {conversations?.length > 0 && (
        <div>
          {conversations.map((c, i) => {
            const unread = Number(c.unread) > 0;
            return (
              <div
                key={c.id}
                onClick={() => setOpenConv(c)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", cursor: "pointer",
                  borderBottom: i < conversations.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <strong style={{ fontSize: "0.98rem", fontWeight: unread ? 800 : 700 }}>{convTitle(c, myMemberId)}</strong>
                    <span className="subtle" style={{ fontSize: "0.72rem", flexShrink: 0 }}>{fmtDateTime(c.last_message_at)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <span
                      className={unread ? undefined : "subtle"}
                      style={{
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0,
                        fontSize: "0.86rem", color: unread ? "var(--text)" : undefined, fontWeight: unread ? 600 : 400,
                      }}
                    >
                      {c.last_message ?? "Aucun message"}
                    </span>
                    {unread && (
                      <span style={{
                        flexShrink: 0, background: "var(--hero-sky)", color: "var(--hero-ink)",
                        borderRadius: "999px", fontSize: "0.7rem", fontWeight: 800, minWidth: 20, height: 20,
                        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px",
                      }}>{c.unread}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewConversation({ myMemberId, onCreated }) {
  const { token, activeClubId } = useAuth();
  const [members, setMembers] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("members.php", "list", { club_id: activeClubId }, token)
      .then((d) => setMembers(d.members.filter((m) => m.status === "active" && m.id !== myMemberId)))
      .catch((e) => setError(e.message));
  }, [activeClubId, token, myMemberId]);

  const toggle = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const create = async () => {
    setError(""); setBusy(true);
    try {
      const d = await api("messages.php", "conversation_create", {
        club_id: activeClubId, member_ids: [...selected], title,
      }, token);
      onCreated({ id: d.id, title: title || null, participants: [] });
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="label-title">Nouvelle conversation</div>
      {error && <div className="error-box">{error}</div>}
      {members === null && <div className="spinner" />}
      {members?.map((m) => (
        <label key={m.id} className="list-row" style={{ padding: "6px 0", cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: "0.9rem", fontWeight: 400, color: "var(--text)", display: "flex" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} style={{ width: "auto" }} />
            {m.first_name} {m.last_name}
          </span>
        </label>
      ))}
      {selected.size > 1 && (
        <div className="field" style={{ marginTop: 10 }}>
          <label>Titre du groupe</label>
          <input type="text" required placeholder="Seniors A, Bureau…" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      )}
      <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={busy || selected.size === 0 || (selected.size > 1 && !title.trim())} onClick={create}>
        {busy ? "Création…" : "Démarrer la conversation"}
      </button>
    </div>
  );
}

function AttachmentView({ attachment, activeClubId, token }) {
  const { attachment_id: id, attachment_name: name, attachment_mime: mime, attachment_size: size } = attachment;
  const [objectUrl, setObjectUrl] = useState(null);
  const isImage = mime?.startsWith("image/");
  const isVideo = mime?.startsWith("video/");

  useEffect(() => {
    if (!id || !(isImage || isVideo)) return;
    let alive = true;
    let url;
    fetch(`api/files.php?action=download&club_id=${activeClubId}&file_id=${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => { if (alive) { url = URL.createObjectURL(blob); setObjectUrl(url); } })
      .catch(() => {});
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [id, isImage, isVideo, activeClubId, token]);

  const downloadFile = async () => {
    try {
      const res = await fetch(`api/files.php?action=download&club_id=${activeClubId}&file_id=${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (_) {}
  };

  if (isImage) {
    return objectUrl
      ? <img src={objectUrl} alt={name} onClick={downloadFile} style={{ maxWidth: 220, maxHeight: 220, borderRadius: "var(--radius-md)", display: "block", cursor: "pointer" }} />
      : <div className="spinner" style={{ width: 24, height: 24 }} />;
  }
  if (isVideo) {
    return objectUrl
      ? <video src={objectUrl} controls style={{ maxWidth: 240, maxHeight: 240, borderRadius: "var(--radius-md)", display: "block" }} />
      : <div className="spinner" style={{ width: 24, height: 24 }} />;
  }
  return (
    <div onClick={downloadFile} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "6px 2px" }}>
      <FileEarmarkText size={20} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>{name}</div>
        <div style={{ fontSize: "0.7rem", opacity: 0.75 }}>{fmtSize(size)}</div>
      </div>
      <Download size={14} />
    </div>
  );
}

function Thread({ conversation, myMemberId, back }) {
  const { token, activeClubId } = useAuth();
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [attachFile, setAttachFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const lastIdRef = useRef(0);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const load = useCallback(async (incremental) => {
    try {
      const d = await api("messages.php", "messages_list", {
        club_id: activeClubId,
        conversation_id: conversation.id,
        after_id: incremental ? lastIdRef.current : 0,
      }, token);
      if (d.messages.length) {
        lastIdRef.current = d.messages[d.messages.length - 1].id;
        setMessages((prev) => incremental && prev ? [...prev, ...d.messages] : d.messages);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: incremental ? "smooth" : "auto" }), 50);
      } else if (!incremental) {
        setMessages([]);
      }
    } catch (e2) { setError(e2.message); }
  }, [activeClubId, conversation.id, token]);

  useEffect(() => {
    lastIdRef.current = 0;
    setMessages(null);
    load(false);
    const id = setInterval(() => load(true), 8000);
    return () => clearInterval(id);
  }, [load]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() && !attachFile) return;
    setError(""); setBusy(true);
    try {
      let attachmentFileId = null;
      if (attachFile) {
        const fd = new FormData();
        fd.append("club_id", activeClubId);
        fd.append("kind", "message");
        fd.append("file", attachFile);
        const res = await fetch(`api/files.php?action=upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
        attachmentFileId = data.id;
      }
      await api("messages.php", "message_send", { club_id: activeClubId, conversation_id: conversation.id, content: text, attachment_file_id: attachmentFileId }, token);
      setText(""); setAttachFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load(true);
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  const startEdit = (m) => { setMenuFor(null); setEditingId(m.id); setEditText(m.content); };

  const saveEdit = async (id) => {
    setError("");
    try {
      await api("messages.php", "message_edit", { club_id: activeClubId, message_id: id, content: editText }, token);
      setEditingId(null);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: editText, edited_at: new Date().toISOString() } : m)));
    } catch (e2) { setError(e2.message); }
  };

  const deleteMessage = async (id) => {
    setMenuFor(null);
    if (!confirm("Supprimer ce message ?")) return;
    setError("");
    try {
      await api("messages.php", "message_delete", { club_id: activeClubId, message_id: id }, token);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, deleted_at: new Date().toISOString(), content: "", attachment_id: null } : m)));
    } catch (e2) { setError(e2.message); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" style={{ width: "auto", flexShrink: 0, whiteSpace: "nowrap" }} onClick={back}>← Retour</button>
        <h1 style={{
          fontSize: "1.15rem", minWidth: 0, flex: 1, lineHeight: 1.25,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>{convTitle(conversation, myMemberId)}</h1>
      </div>
      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 120 }}>
        {messages === null && <div className="spinner" />}
        {messages?.length === 0 && <div className="subtle">Aucun message — écris le premier !</div>}
        {messages?.map((m) => {
          const mine = m.author_member_id === myMemberId;
          const authorName = m.first_name ? `${m.first_name} ${m.last_name}` : "Ancien membre";
          const deleted = !!m.deleted_at;
          const editing = editingId === m.id;
          return (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start", alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              {!mine && <div className="subtle" style={{ fontSize: "0.72rem", marginBottom: 2, marginLeft: 36 }}>{authorName}</div>}

              <div style={{ display: "flex", flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-end", gap: 8, minWidth: 0 }}>
                {!mine && <Avatar name={authorName} userId={m.user_id} avatarUrl={m.avatar_url} size={28} />}

                {editing ? (
                  <div style={{ display: "flex", gap: 6, width: 220 }}>
                    <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)} style={{ flex: 1 }} autoFocus />
                    <button className="btn btn-primary btn-sm" style={{ width: "auto" }} onClick={() => saveEdit(m.id)}>OK</button>
                    <button className="btn btn-ghost btn-sm" style={{ width: "auto" }} onClick={() => setEditingId(null)}>✕</button>
                  </div>
                ) : (
                  <div style={{ position: "relative", minWidth: 0 }}>
                    <div style={{
                      background: deleted ? "transparent" : (mine ? "var(--oc-gradient)" : "var(--surface-alt)"),
                      backgroundSize: mine ? "200% 100%" : undefined,
                      color: deleted ? "var(--text-dim)" : (mine ? "#fff" : "var(--text)"),
                      padding: deleted ? "4px 2px" : "9px 13px",
                      border: deleted ? "none" : undefined,
                      fontStyle: deleted ? "italic" : "normal",
                      borderRadius: mine ? "var(--radius-lg) var(--radius-lg) 4px var(--radius-lg)" : "var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px",
                      boxShadow: deleted ? "none" : "var(--shadow-sm)",
                      fontSize: "0.92rem", whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>
                      {deleted ? (
                        "Message supprimé"
                      ) : (
                        <>
                          {m.attachment_id && <AttachmentView attachment={m} activeClubId={activeClubId} token={token} />}
                          {m.content}
                        </>
                      )}
                    </div>
                    {mine && !deleted && (
                      <span
                        onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                        style={{ position: "absolute", top: "50%", right: "100%", transform: "translateY(-50%)", marginRight: 4, cursor: "pointer", color: "var(--text-dim)", padding: 4, flexShrink: 0 }}
                      ><ThreeDotsVertical size={14} /></span>
                    )}
                    {menuFor === m.id && (
                      <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "var(--surface)", boxShadow: "var(--shadow-md)", borderRadius: "var(--radius-sm)", overflow: "hidden", zIndex: 5, minWidth: 110 }}>
                        <div onClick={() => startEdit(m)} style={{ padding: "8px 12px", fontSize: "0.82rem", cursor: "pointer" }}>Modifier</div>
                        <div onClick={() => deleteMessage(m.id)} style={{ padding: "8px 12px", fontSize: "0.82rem", cursor: "pointer", color: "var(--oc-red-700)" }}>Supprimer</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="subtle" style={{ fontSize: "0.68rem", marginTop: 3, marginLeft: mine ? 0 : 36, marginRight: mine ? 0 : 0 }}>
                {!deleted && fmtDateTime(m.created_at)}{!deleted && m.edited_at ? " · modifié" : ""}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="thread-composer">
        {attachFile && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", marginBottom: 8, fontSize: "0.8rem" }}>
            <FileEarmarkText size={15} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attachFile.name}</span>
            <span onClick={() => { setAttachFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} style={{ cursor: "pointer" }}><XLg size={13} /></span>
          </div>
        )}
        <form onSubmit={send} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="file" ref={fileInputRef} accept="image/*,video/mp4,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: "none" }} onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)} />
          <button type="button" className="btn btn-ghost btn-sm" style={{ width: 40, padding: 0, flexShrink: 0 }} onClick={() => fileInputRef.current?.click()} title="Joindre un fichier">
            <Paperclip size={17} />
          </button>
          <input type="text" placeholder="Écrire un message…" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
          <button className="btn btn-primary btn-sm" style={{ padding: "11px 18px", width: "auto", flexShrink: 0 }} disabled={busy || (!text.trim() && !attachFile)}>Envoyer</button>
        </form>
      </div>
    </div>
  );
}
