import {
  Calendar, Newspaper, Shield, Users, ChatCircle, Star,
  ChartBar, Trophy, Medal, FolderOpen, Images, Bell, UserCircle,
  Gear, Wrench,
} from "@phosphor-icons/react";

export const NAV_ITEMS = [
  { label: "Calendrier", view: "home", icon: Calendar, phase: 0 },
  { label: "Vestiaire", view: "vestiaire", icon: Newspaper, phase: 4 },
  { label: "Équipes", view: "equipes", icon: Shield, phase: 1 },
  { label: "Membres", view: "membres", icon: Users, phase: 1 },
  { label: "Messages", view: "messages", icon: ChatCircle, phase: 5 },
  { label: "Votes", view: "votes", icon: Star, phase: 2 },
  { label: "Statistiques", view: "statistiques", icon: ChartBar, phase: 7 },
  { label: "Classements", view: "classements", icon: Trophy, phase: 2 },
  { label: "Trophées", view: "trophees", icon: Medal, phase: 7 },
  { label: "Documents", view: "documents", icon: FolderOpen, phase: 6 },
  { label: "Médias", view: "medias", icon: Images, phase: 6 },
  { label: "Notifications", view: "notifications", icon: Bell, phase: 4 },
  { label: "Profil", view: "profil", icon: UserCircle, phase: 1 },
  { label: "Paramètres", view: "parametres", icon: Gear, phase: 1 },
  { label: "Administration", view: "administration", icon: Wrench, phase: 1 },
];

export const MOBILE_NAV_ITEMS = [
  NAV_ITEMS.find((i) => i.label === "Calendrier"),
  NAV_ITEMS.find((i) => i.label === "Vestiaire"),
  NAV_ITEMS.find((i) => i.label === "Votes"),
  NAV_ITEMS.find((i) => i.label === "Profil"),
  NAV_ITEMS.find((i) => i.label === "Paramètres"),
];

export const CURRENT_PHASE = 7;

// Toutes les phases planifiées (0 à 7) sont livrées.
export const SKIPPED_PHASES = [];

export const isAvailable = (item) =>
  item.phase <= CURRENT_PHASE && !SKIPPED_PHASES.includes(item.phase);
