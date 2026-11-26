import { masteryProgress, masteryRanks, type Progress } from "@/lib/learning";
import * as Dialog from "@radix-ui/react-dialog";
import { UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  inkColors,
  papers,
  usableInk,
  usablePaper,
  type DrawingPreferences,
  type InkColor,
  type Paper,
} from "@/lib/mastery-rewards";

type Profile = DrawingPreferences & { name: string };

const storageKey = "spellcraft.profile.v1";
const defaults: Profile = { name: "", penWidth: 3, volume: 0, showGrid: true, ink: "forest", paper: "parchment" };

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value.name !== "string") return null;
    return {
      name: value.name.trim().slice(0, 32),
      penWidth: Number.isInteger(value.penWidth) && value.penWidth >= 1 && value.penWidth <= 7 ? value.penWidth : defaults.penWidth,
      volume: typeof value.volume === "number" && value.volume >= 0 && value.volume <= 1 ? value.volume : defaults.volume,
      ink: Object.hasOwn(inkColors, value.ink) ? value.ink as InkColor : defaults.ink,
      paper: Object.hasOwn(papers, value.paper) ? value.paper as Paper : defaults.paper,
      showGrid: typeof value.showGrid === "boolean" ? value.showGrid : defaults.showGrid,
    };
  } catch {
    return null;
  }
}

type Props = {
  onApply: (preferences: DrawingPreferences) => void;
  progress?: Progress;
};

export default function AtelierProfile({ onApply, progress }: Props) {
  const [profile, setProfile] = useState(loadProfile);
  const [draft, setDraft] = useState(profile ?? defaults);
  const [open, setOpen] = useState(!profile);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [storageError, setStorageError] = useState(false);

  const mastery = progress && masteryProgress(progress);
  const level = mastery?.level ?? 1;

  useEffect(() => {
    if (!profile) return;
    const ink = usableInk(profile.ink, level);
    const paper = usablePaper(profile.paper, level);
    onApply({ ...profile, ink, paper });
  }, [profile, level, onApply]);

  const save = (value: Profile) => {
    const next = {
      ...value,
      name: value.name.trim(),
      ink: usableInk(value.ink, level),
      paper: usablePaper(value.paper, level),
    };
    setProfile(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError(false);
      setOpen(false);
    } catch {
      setStorageError(true);
    }
  };

  const changeOpen = (next: boolean) => {
    if (next) setDraft(profile ?? defaults);
    if (!next && !profile) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(defaults));
      } catch {
        setStorageError(true);
      }
      setProfile(defaults);
    }
    setOpen(next);
  };

  const welcome = !profile;

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger className="atelier-profile-trigger" title={profile?.name || "Профиль"} aria-label={profile?.name ? `Профиль: ${profile.name}` : "Профиль"}>
        <UserRound size={17} aria-hidden="true" />
        <span className="atelier-profile-name-label">{profile?.name || "Профиль"}</span>
        <span className="atelier-profile-compact-label" aria-hidden="true">Профиль</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="atelier-profile-overlay" />
        <Dialog.Content
          className="atelier-profile-dialog"
          onOpenAutoFocus={event => {
            event.preventDefault();
            titleRef.current?.focus();
          }}
        >
          <Dialog.Title ref={titleRef} tabIndex={-1}>{welcome ? "Добро пожаловать в ателье" : "Профиль ателье"}</Dialog.Title>
          <Dialog.Description>
            Укажите имя и настройте лист практики. Профиль хранится в этом браузере.
          </Dialog.Description>
          {!welcome && mastery && progress && (
            <section className="atelier-profile-mastery" aria-labelledby="profile-rank-title">
              <p>Уровень {mastery.level} из {masteryRanks.length}</p>
              <h3 id="profile-rank-title">{mastery.title}</h3>
              <div
                className="mastery-track"
                role="progressbar"
                aria-label="Прогресс до следующего ранга"
                aria-valuenow={Math.round(mastery.percent)}
                aria-valuetext={mastery.next ? `Следующий ранг: ${mastery.next.title}. Осталось символов: ${mastery.remaining}.` : "Высший ранг достигнут"}
              >
                <span style={{ transform: `scaleX(${mastery.percent / 100})` }} />
              </div>
              <p>{mastery.next ? `До ранга «${mastery.next.title}» осталось символов: ${mastery.remaining}.` : "Высший ранг достигнут."}</p>
              <dl>
                <div><dt>Изучено символов</dt><dd>{mastery.learned} / {mastery.total}</dd></div>
                <div><dt>Пройдено уроков</dt><dd>{progress.completed.length}</dd></div>
                <div><dt>Активаций заклинаний</dt><dd>{progress.casts}</dd></div>
              </dl>
            </section>
          )}
          <form onSubmit={event => { event.preventDefault(); save(draft); }}>
            <label className="atelier-profile-name">
              Как к вам обращаться
              <input
                value={draft.name}
                maxLength={32}
                placeholder="Имя или псевдоним"
                onChange={event => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <fieldset>
              <legend>Лист практики</legend>
              <div className="atelier-ink-setting">
                <label htmlFor="atelier-ink-color">Цвет чернил</label>
                <span className="atelier-ink-sample" style={{ backgroundColor: inkColors[usableInk(draft.ink, level)].color }} aria-hidden="true" />
                <select id="atelier-ink-color" value={usableInk(draft.ink, level)} onChange={event => setDraft({ ...draft, ink: event.target.value as InkColor })}>
                  {Object.entries(inkColors).map(([id, ink]) => (
                    <option key={id} value={id} disabled={ink.level > level}>
                      {ink.label}{ink.level > level ? ` · с уровня ${ink.level}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="atelier-ink-setting">
                <label htmlFor="atelier-paper">Бумага</label>
                <span className="atelier-ink-sample atelier-paper-sample" style={{ backgroundColor: papers[usablePaper(draft.paper, level)].shade }} aria-hidden="true" />
                <select id="atelier-paper" value={usablePaper(draft.paper, level)}
                  onChange={event => setDraft({ ...draft, paper: event.target.value as Paper })}>
                  {Object.entries(papers).map(([id, paper]) => (
                    <option key={id} value={id} disabled={paper.level > level}>
                      {paper.label}{paper.level > level ? ` · с уровня ${paper.level}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <label className="atelier-profile-range">
                <span>Толщина пера</span><output>{draft.penWidth}</output>
                <input type="range" min={1} max={7} value={draft.penWidth} onChange={event => setDraft({ ...draft, penWidth: Number(event.target.value) })} />
              </label>
              <label className="atelier-profile-range">
                <span>Громкость звуков</span><output>{Math.round(draft.volume * 100)}%</output>
                <input type="range" min={0} max={1} step={0.05} value={draft.volume} onChange={event => setDraft({ ...draft, volume: Number(event.target.value) })} />
              </label>
              <label className="atelier-profile-check">
                <input type="checkbox" checked={draft.showGrid} onChange={event => setDraft({ ...draft, showGrid: event.target.checked })} />
                Показывать разметку листа
              </label>
            </fieldset>
            {storageError && <p role="alert">Настройки применены, но браузер не смог сохранить профиль для следующего входа.</p>}
            <div className="atelier-profile-actions">
              <Dialog.Close type="button">{welcome ? "Пропустить" : "Закрыть"}</Dialog.Close>
              <button type="submit">{welcome ? "Войти в ателье" : "Сохранить профиль"}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
