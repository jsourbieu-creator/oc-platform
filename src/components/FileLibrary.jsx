import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const KIND_PERMISSION_LABEL = {
  document: "Gérer les documents",
  media: "Gérer la médiathèque",
};

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fmtDateShort(s) {
  const d = new Date(s.replace(" ", "T"));
  return d.toLocaleDateString("fr-FR");
}

export function FileLibrary({ kind, title, canManage }) {
  const { token, activeClubId } = useAuth();
  const [files, setFiles] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    if (!activeClubId) return;
    api("files.php", "list", { club_id: activeClubId, kind }, token)
      .then((d) => setFiles(d.files)).catch((e) => setError(e.message));
  }, [activeClubId, kind, token]);

  useEffect(load, [load]);

  const upload = async (e) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || !uploadTitle.trim()) { setError("Titre et fichier requis."); return; }

    setUploading(true); setError(""); setNotice("");
    try {
      const fd = new FormData();
      fd.append("club_id", activeClubId);
      fd.append("kind", kind);
      fd.append("title", uploadTitle.trim());
      fd.append("file", file);
      const res = await fetch(`api/files.php?action=upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      setUploadTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice("Fichier envoyé.");
      load();
    } catch (e2) { setError(e2.message); } finally { setUploading(false); }
  };

  const download = async (f) => {
    setError("");
    try {
      const res = await fetch(`api/files.php?action=download&club_id=${activeClubId}&file_id=${f.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = f.original_filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  };

  const remove = async (f) => {
    setError(""); setNotice("");
    try {
      await api("files.php", "delete", { club_id: activeClubId, file_id: f.id }, token);
      load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.9rem", marginBottom: 16 }}>{title}</h1>
      {error && <div className="error-box">{error}</div>}
      {notice && <div className="info-box">{notice}</div>}

      {canManage && (
        <form onSubmit={upload} className="card" style={{ marginBottom: 16 }}>
          <div className="label-title">{KIND_PERMISSION_LABEL[kind]}</div>
          <div className="field">
            <label>Titre</label>
            <input type="text" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Ex. Feuille de match type" />
          </div>
          <div className="field">
            <label>Fichier (20 Mo max — PDF, Word, Excel, image ou courte vidéo)</label>
            <input type="file" ref={fileInputRef} />
          </div>
          <button className="btn btn-primary" disabled={uploading}>{uploading ? "Envoi…" : "Envoyer"}</button>
        </form>
      )}

      {files === null && <div className="spinner" />}
      {files !== null && files.length === 0 && (
        <div className="card"><p className="subtle" style={{ margin: 0 }}>Aucun fichier pour le moment.</p></div>
      )}
      {files !== null && files.length > 0 && (
        <div className="card">
          {files.map((f) => (
            <div key={f.id} className="list-row" style={{ flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <strong>{f.title}</strong>
                <div className="subtle">{f.original_filename} — {fmtSize(f.size_bytes)} — {fmtDateShort(f.created_at)}{f.first_name ? ` — ${f.first_name} ${f.last_name}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => download(f)}>Télécharger</button>
                {canManage && <button className="btn btn-sm btn-danger" onClick={() => remove(f)}>Supprimer</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
