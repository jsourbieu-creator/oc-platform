import {
  Calendar3, Megaphone, Shield, People, ChatDots, Star,
  BarChartFill, Trophy, Award, Folder2Open, Images, Bell, PersonCircle,
  Gear, Wrench,
} from "react-bootstrap-icons";

export const NAV_ITEMS = [
  { label: "Calendrier", view: "home", icon: Calendar3, phase: 0 },
  { label: "Annonces", view: "vestiaire", icon: Megaphone, phase: 4 },
  { label: "Équipes", view: "equipes", icon: Shield, phase: 1 },
  { label: "Membres", view: "membres", icon: People, phase: 1 },
  { label: "Messages", view: "messages", icon: ChatDots, phase: 5 },
  { label: "Votes", view: "votes", icon: Star, phase: 2 },
  { label: "Statistiques", view: "statistiques", icon: BarChartFill, phase: 7 },
  { label: "Classements", view: "classements", icon: Trophy, phase: 2 },
  { label: "Trophées", view: "trophees", icon: Award, phase: 7 },
  { label: "Documents", view: "documents", icon: Folder2Open, phase: 6 },
  { label: "Médias", view: "medias", icon: Images, phase: 6 },
  { label: "Notifications", view: "notifications", icon: Bell, phase: 4 },
  { label: "Profil", view: "profil", icon: PersonCircle, phase: 1 },
  { label: "Paramètres", view: "parametres", icon: Gear, phase: 1 },
  { label: "Administration", view: "administration", icon: Wrench, phase: 1 },
];

export const MOBILE_NAV_ITEMS = [
  NAV_ITEMS.find((i) => i.label === "Calendrier"),
  NAV_ITEMS.find((i) => i.label === "Annonces"),
  NAV_ITEMS.find((i) => i.label === "Votes"),
  NAV_ITEMS.find((i) => i.label === "Profil"),
  NAV_ITEMS.find((i) => i.label === "Paramètres"),
];

export const CURRENT_PHASE = 7;

// Toutes les phases planifiées (0 à 7) sont livrées.
export const SKIPPED_PHASES = [];

export const isAvailable = (item) =>
  item.phase <= CURRENT_PHASE && !SKIPPED_PHASES.includes(item.phase);
