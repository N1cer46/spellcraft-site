export const inkColors = {
  forest: { label: "Лесные", color: "#293e34", level: 1 },
  walnut: { label: "Ореховые", color: "#6b3f26", level: 1 },
  plum: { label: "Сливовые", color: "#65405d", level: 1 },
  midnight: { label: "Полуночные", color: "#293e63", level: 1 },
  cinnabar: { label: "Киноварь", color: "#882e2b", level: 2 },
  lapis: { label: "Лазурит", color: "#244c82", level: 4 },
  brass: { label: "Старая латунь", color: "#6d4d16", level: 6 },
} as const;

export const papers = {
  parchment: { label: "Бумага ателье", light: "#faf6e9", shade: "#e7dec6", level: 1 },
  honey: { label: "Медовый велень", light: "#fff3d8", shade: "#e7cea2", level: 3 },
  sage: { label: "Лист шалфея", light: "#f1f3dc", shade: "#d5ddbb", level: 5 },
  moon: { label: "Лунная бумага", light: "#f1f3ff", shade: "#cdd9e7", level: 7 },
} as const;

export type InkColor = keyof typeof inkColors;
export type Paper = keyof typeof papers;

export type DrawingPreferences = {
  penWidth: number;
  volume: number;
  showGrid: boolean;
  ink: InkColor;
  paper: Paper;
};

export function usableInk(ink: InkColor, level: number): InkColor {
  return inkColors[ink].level <= level ? ink : "forest";
}

export function usablePaper(paper: Paper, level: number): Paper {
  return papers[paper].level <= level ? paper : "parchment";
}

export const masteryRewards = [
  ...Object.values(inkColors).map(ink => ({ level: ink.level, label: `Чернила «${ink.label}»` })),
  ...Object.values(papers).map(paper => ({ level: paper.level, label: paper.label })),
].filter(reward => reward.level > 1).sort((a, b) => a.level - b.level);
