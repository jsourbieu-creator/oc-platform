export const NAV_ITEMS = [
  { label: "Accueil", view: "home", icon: "🏠", phase: 0 },
  { label: "Vestiaire", view: "vestiaire", icon: "📰", phase: 4 },
  { label: "Convocations", view: "convocations", icon: "📋", phase: 3 },
  { label: "Équipes", view: "equipes", icon: "🛡️", phase: 1 },
  { label: "Membres", view: "membres", icon: "👥", phase: 1 },
  { label: "Messages", view: "messages", icon: "💬", phase: 5 },
  { label: "Votes", view: "votes", icon: "⭐", phase: 2 },
  { label: "Statistiques", view: "statistiques", icon: "📊", phase: 7 },
  { label: "Classements", view: "classements", icon: "🏆", phase: 2 },
  { label: "Trophées", view: "trophees", icon: "🥇", phase: 7 },
  { label: "Documents", view: "documents", icon: "📁", phase: 6 },
  { label: "Médias", view: "medias", icon: "🖼️", phase: 6 },
  { label: "Notifications", view: "notifications", icon: "🔔", phase: 4 },
  { label: "Profil", view: "profil", icon: "👤", phase: 1 },
  { label: "Paramètres", view: "parametres", icon: "⚙️", phase: 1 },
  { label: "Administration", view: "administration", icon: "🛠️", phase: 1 },
];

export const MOBILE_NAV_ITEMS = [
  NAV_ITEMS.find((i) => i.label === "Accueil"),
  NAV_ITEMS.find((i) => i.label === "Vestiaire"),
  NAV_ITEMS.find((i) => i.label === "Votes"),
  NAV_ITEMS.find((i) => i.label === "Messages"),
  { label: "Plus", view: "plus", icon: "⋯", phase: 0 },
];

export const CURRENT_PHASE = 7;

// Toutes les phases planifiées (0 à 7) sont livrées.
export const SKIPPED_PHASES = [];

export const isAvailable = (item) =>
  item.phase <= CURRENT_PHASE && !SKIPPED_PHASES.includes(item.phase);
