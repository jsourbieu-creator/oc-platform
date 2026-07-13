import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

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

export function MessagesPage() {
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
        <div className="card">
          {conversations.map((c) => (
            <div key={c.id} className="list-row" style={{ cursor: "pointer" }} onClick={() => setOpenConv(c)}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontWeight: Number(c.unread) > 0 ? 800 : 600 }}>{convTitle(c, myMemberId)}</strong>
                <div className="subtle" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 420 }}>
                  {c.last_message ?? "Aucun message"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {Number(c.unread) > 0 && <span className="badge badge-info">{c.unread}</span>}
                <span className="subtle">{fmtDateTime(c.last_message_at)}</span>
              </div>
            </div>
          ))}
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

function Thread({ conversation, myMemberId, back }) {
  const { token, activeClubId } = useAuth();
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lastIdRef = useRef(0);
  const bottomRef = useRef(null);

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
    if (!text.trim()) return;
    setError(""); setBusy(true);
    try {
      await api("messages.php", "message_send", { club_id: activeClubId, conversation_id: conversation.id, content: text }, token);
      setText("");
      await load(true);
    } catch (e2) { setError(e2.message); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={back}>← Retour</button>
        <h1 style={{ fontSize: "1.3rem" }}>{convTitle(conversation, myMemberId)}</h1>
      </div>
      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages === null && <div className="spinner" />}
        {messages?.length === 0 && <div className="subtle">Aucun message — écris le premier !</div>}
        {messages?.map((m) => {
          const mine = m.author_member_id === myMemberId;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
              {!mine && <div className="subtle" style={{ fontSize: "0.72rem", marginBottom: 2 }}>{m.first_name ? `${m.first_name} ${m.last_name}` : "Ancien membre"}</div>}
              <div style={{
                background: mine ? "var(--oc-gradient)" : "var(--surface-alt)",
                backgroundSize: mine ? "200% 100%" : undefined,
                color: mine ? "#fff" : "var(--text)",
                padding: "9px 13px",
                borderRadius: mine ? "var(--radius-lg) var(--radius-lg) 4px var(--radius-lg)" : "var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px",
                boxShadow: "var(--shadow-sm)",
                fontSize: "0.92rem", whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>{m.content}</div>
              <div className="subtle" style={{ fontSize: "0.68rem", textAlign: mine ? "right" : "left", marginTop: 2 }}>{fmtDateTime(m.created_at)}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input type="text" placeholder="Écrire un message…" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" style={{ padding: "11px 18px" }} disabled={busy || !text.trim()}>Envoyer</button>
      </form>
    </div>
  );
}
