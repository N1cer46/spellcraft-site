/**
 * Design system: «Обсерватория линий» — contents are written as a concise field guide.
 * Every user-provided sigil and mark is present as a first-class symbol definition.
 */
import { symbolAssetPath } from "./assets";

export type SymbolKind = "sigil" | "mark";

export type SymbolDefinition = {
  id: string;
  kind: SymbolKind;
  name: string;
  assetKey: string;
  group: string;
  description: string;
};

export type SpellRecipe = {
  custom?: boolean;
  effect?: import("../lib/spell-composer").ComposedEffect;
  id: string;
  name: string;
  sigilId: string;
  requiredMarkIds: string[];
  optionalMarkIds?: string[];
  description: string;
};

const sigil = (id: string, name: string, assetKey: string, group: string, description: string): SymbolDefinition => ({ id, kind: "sigil", name, assetKey, group, description });
const mark = (id: string, name: string, assetKey: string, group: string, description: string): SymbolDefinition => ({ id, kind: "mark", name, assetKey, group, description });

export const sigils: SymbolDefinition[] = [
  sigil("sigil_fire", "Огонь", "Fire", "Стихии", "Жар, горение и свет-тепло."),
  sigil("sigil_water", "Вода", "Water", "Стихии", "Жидкость, текучесть и влага."),
  sigil("sigil_earth", "Земля", "Earth", "Стихии", "Твёрдость, опора, минералы и почва."),
  sigil("sigil_light", "Свет", "Light", "Стихии", "Сияние, иллюминация и видимый свет."),
  sigil("sigil_wind", "Ветер", "Wind", "Стихии", "Воздушный поток и направленное движение воздуха."),
  sigil("sigil_wind_clean", "Ветер — чистый", "Wind (Clean)", "Стихии", "Минимальный чистый вариант ветрового глифа."),
  sigil("sigil_wind_underfoot", "Ветер под ногами", "Wind Underfoot", "Стихии", "Вихрь у земли: опора, шаг или подъём."),
  sigil("sigil_aeriforms", "Воздухообразное", "Aeriforms", "Стихии", "Пар, дым, дух и иные эфемерные субстанции."),
  sigil("sigil_whorling_winds", "Кружащие ветра", "Whorling Winds", "Стихии", "Усложнённый закручивающийся поток, подобный торнадо."),
  sigil("sigil_bird_a", "Птица A", "Bird A", "Существа", "Крылатый фамильяр или птичья иллюзия с собранными крыльями."),
  sigil("sigil_bird_b", "Птица B", "Bird B", "Существа", "Ветвистая птица — вариант птичьего фамильяра."),
  sigil("sigil_fish_a", "Рыба A", "Fish A", "Существа", "Водное существо, отмеченное стрелой и плавниками."),
  sigil("sigil_fish_b", "Рыба B", "Fish B", "Существа", "Упрощённый водный силуэт с глазом."),
  sigil("sigil_liongoat", "Лев-козёл", "Liongoat", "Существа", "Гибридный животный охранник с завитками-рогами."),
  sigil("sigil_scalewolf", "Чешуйчатый волк", "Scalewolf", "Существа", "Хищник с чешуйчатой шкурой."),
  sigil("sigil_torchstag", "Огне-олень", "Torchstag", "Существа", "Олень с рогами-факелами."),
  sigil("sigil_valance_leech", "Валансовая пиявка", "Valance Leech", "Существа", "Сегментированное ползучее существо."),
  sigil("sigil_frillram", "Фриллрам", "Frillram", "Существа", "Существо с оборчатой или складчатой шкурой."),
  sigil("sigil_flower", "Цветок", "Flower", "Растения и предметы", "Цветение, рост и органика."),
  sigil("sigil_sword", "Меч", "Sword", "Растения и предметы", "Оружие и режущая грань."),
  sigil("sigil_guidance", "Наставление", "Guidance", "Растения и предметы", "Указание пути, компас и направляющий свет."),
  sigil("sigil_stop", "Остановка", "Stop", "Растения и предметы", "Барьер, блокировка или стена."),
  sigil("sigil_repetition", "Повторение", "Repetition", "Растения и предметы", "Рекурсия и циклическое повторение эффекта."),
];

export const marks: SymbolDefinition[] = [
  mark("mark_enlarge", "Увеличить", "Enlarge", "Масштаб и форма", "Увеличивает эффект."),
  mark("mark_enlarge_inverted", "Уменьшить", "Enlarge (Inverted)", "Масштаб и форма", "Уменьшает эффект."),
  mark("mark_diamond", "Ромб", "Diamond", "Масштаб и форма", "Придаёт кристаллическую гранёную форму-контейнер."),
  mark("mark_column", "Колонна", "Column", "Масштаб и форма", "Вытягивает проявление в вертикальный столб."),
  mark("mark_orb", "Сфера", "Orb", "Масштаб и форма", "Заключает эффект в сферическую форму."),
  mark("mark_stretch", "Растянуть", "Stretch", "Масштаб и форма", "Удлиняет форму эффекта."),
  mark("mark_pull", "Притянуть", "Pull", "Направление и движение", "Притягивает эффект к заклинателю."),
  mark("mark_project", "Направить", "Project", "Направление и движение", "Направляет или выбрасывает эффект от себя."),
  mark("mark_gather", "Собрать", "Gather", "Направление и движение", "Стягивает несколько объектов в одну точку."),
  mark("mark_float", "Парение", "Float", "Направление и движение", "Создаёт плавное парение или отменяет гравитацию."),
  mark("mark_levitation", "Левитация", "Levitation", "Направление и движение", "Поднимает объект через направленный подъём."),
  mark("mark_convergence", "Схождение", "Convergence", "Направление и движение", "Фокусирует силу в точке схождения."),
  mark("mark_dispersion", "Рассеивание", "Dispersion", "Направление и движение", "Распространяет действие наружу из точки."),
  mark("mark_bind", "Связать", "Bind", "Связывание и структура", "Скрепляет или связывает элементы."),
  mark("mark_envelop", "Обернуть", "Envelop", "Связывание и структура", "Заключает объект внутрь действия."),
  mark("mark_link", "Соединить", "Link", "Связывание и структура", "Связывает несколько точек между собой."),
  mark("mark_entwine", "Переплести", "Entwine", "Связывание и структура", "Свивает линии, нити или лозы."),
  mark("mark_coil", "Скрутить", "Coil", "Связывание и структура", "Закручивает проявление в спиральную связку."),
  mark("mark_puppet", "Марионетка", "Puppet", "Связывание и структура", "Управляет несколькими объектами как марионетками."),
  mark("mark_solidify", "Отвердить", "Solidify", "Связывание и структура", "Фиксирует и отверждает связь."),
  mark("mark_region", "Область", "Region", "Область и повтор", "Обозначает зону действия."),
  mark("mark_radial", "Радиальный", "Radial", "Область и повтор", "Распространяет действие радиально."),
  mark("mark_repetition", "Повторить", "Repetition", "Область и повтор", "Зацикливает действие."),
  mark("mark_collection", "Коллекция", "Collection", "Область и повтор", "Собирает множество объектов воедино."),
  mark("mark_rain", "Дождь", "Rain", "Область и повтор", "Создаёт множество точек эффекта, падающих наружу."),
  mark("mark_rain_inverted", "Дождь внутрь", "Rain (Inverted)", "Область и повтор", "Стягивает множество точек внутрь области."),
  mark("mark_eye", "Глаз", "Eye", "Восприятие", "Наблюдение и обнаружение."),
  mark("mark_vision", "Видение", "Vision", "Восприятие", "Усиливает или расширяет зрение."),
  mark("mark_window", "Окно", "Window", "Восприятие", "Создаёт портал-окно обзора."),
  mark("mark_crosshair", "Прицел", "Crosshair", "Восприятие", "Обеспечивает точное прицеливание."),
  mark("mark_conceal", "Сокрытие", "Conceal", "Восприятие", "Скрывает или маскирует от восприятия."),
  mark("mark_empower", "Усилить", "Empower", "Интенсивность и состояние", "Усиливает мощность заклинания."),
  mark("mark_focus", "Фокус", "Focus", "Интенсивность и состояние", "Концентрирует силу в одной точке."),
  mark("mark_stability", "Стабильность", "Stability", "Интенсивность и состояние", "Стабилизирует и успокаивает эффект."),
  mark("mark_stillness", "Неподвижность", "Stillness", "Интенсивность и состояние", "Обездвиживает или замораживает движение."),
  mark("mark_purify", "Очищение", "Purify", "Интенсивность и состояние", "Очищает эффект от примесей."),
  mark("mark_cool", "Охладить", "Cool", "Интенсивность и состояние", "Снижает интенсивность или охлаждает."),
  mark("mark_bolt", "Импульс", "Bolt", "Удар и разрушение", "Создаёт резкий импульс или разряд."),
  mark("mark_crush", "Сжать", "Crush", "Удар и разрушение", "Сжимает или раздавливает."),
  mark("mark_reflect", "Отразить", "Reflect", "Удар и разрушение", "Отражает или зеркалирует по оси."),
  mark("mark_glaives", "Клинки", "Glaives", "Удар и разрушение", "Придаёт форму лезвий."),
  mark("mark_billow", "Вспучить", "Billow", "Удар и разрушение", "Вздувает или вспучивает волной."),
  mark("mark_aeriforms_defined", "Уточнить воздух", "Aeriforms Defined", "Разное", "Детализирует газообразную субстанцию."),
  mark("mark_sign_of_wind", "Указатель ветра", "Sign of Wind", "Разное", "Добавляет малый акцент-порыв ветра."),
];

export const allSymbols = [...sigils, ...marks];
export const symbolImage = (symbol: SymbolDefinition) => symbolAssetPath(symbol.assetKey, symbol.kind);
export const byId = (id: string | null | undefined) => allSymbols.find((symbol) => symbol.id === id);

export const spellRecipes: SpellRecipe[] = [
  { id: "fire-lance", name: "Пламенный снаряд", sigilId: "sigil_fire", requiredMarkIds: ["mark_project", "mark_focus", "mark_empower", "mark_stability"], optionalMarkIds: [], description: "Сфокусированное пламя, направленное от заклинателя." },
  { id: "fire-column", name: "Огненная колонна", sigilId: "sigil_fire", requiredMarkIds: ["mark_column", "mark_empower", "mark_enlarge", "mark_stability"], optionalMarkIds: [], description: "Вертикальный столб усиленного огня." },
  { id: "water-orb", name: "Водяная сфера", sigilId: "sigil_water", requiredMarkIds: ["mark_orb", "mark_stability", "mark_purify", "mark_float"], optionalMarkIds: [], description: "Устойчивая сферическая форма текучей воды." },
  { id: "rainfield", name: "Поле дождя", sigilId: "sigil_water", requiredMarkIds: ["mark_rain", "mark_region", "mark_radial", "mark_dispersion"], optionalMarkIds: [], description: "Осадки, ограниченные заданной областью." },
  { id: "crystal-spire", name: "Кристаллический шип", sigilId: "sigil_earth", requiredMarkIds: ["mark_diamond", "mark_convergence", "mark_column", "mark_solidify"], optionalMarkIds: [], description: "Собранная в гранёную точку минеральная опора." },
  { id: "light-window", name: "Окно света", sigilId: "sigil_light", requiredMarkIds: ["mark_window", "mark_vision", "mark_focus", "mark_stability"], optionalMarkIds: [], description: "Позволяет видеть скрытые в темноте предметы и путь сквозь световое окно. За его пределами сохраняется темнота." },
  { id: "wind-step", name: "Шаг ветра", sigilId: "sigil_wind_underfoot", requiredMarkIds: ["mark_levitation", "mark_sign_of_wind", "mark_stability", "mark_float"], optionalMarkIds: [], description: "Короткий подъём и устойчивый шаг на воздушном вихре." },
  { id: "cyclone", name: "Спираль ветров", sigilId: "sigil_whorling_winds", requiredMarkIds: ["mark_coil", "mark_dispersion", "mark_enlarge", "mark_radial"], optionalMarkIds: [], description: "Расходящийся закрученный поток воздуха." },
  { id: "winged-choir", name: "Хор крыльев", sigilId: "sigil_bird_a", requiredMarkIds: ["mark_bind", "mark_puppet", "mark_collection", "mark_float"], optionalMarkIds: [], description: "Связанные крылатые проявления, движущиеся как единое целое." },
  { id: "guiding-thread", name: "Нить наставления", sigilId: "sigil_guidance", requiredMarkIds: ["mark_eye", "mark_focus", "mark_project", "mark_stability"], optionalMarkIds: ["mark_link"], description: "Точная световая линия, указывающая путь." },
  { id: "sealed-barrier", name: "Замкнутый щит", sigilId: "sigil_stop", requiredMarkIds: ["mark_region", "mark_solidify", "mark_reflect", "mark_envelop"], optionalMarkIds: [], description: "Закреплённый барьер вокруг заданной области." },
  { id: "bloom", name: "Расцветание", sigilId: "sigil_flower", requiredMarkIds: ["mark_enlarge", "mark_radial", "mark_collection", "mark_stability"], optionalMarkIds: ["mark_entwine"], description: "Органический рост, раскрывающийся радиально." },
  { id: "wind-channel", name: "Воздушный коридор", sigilId: "sigil_wind", requiredMarkIds: ["mark_stretch", "mark_project", "mark_focus", "mark_aeriforms_defined"], optionalMarkIds: [], description: "Узкий вытянутый поток воздуха, направленный вдоль одной оси." },
  { id: "clear-breeze", name: "Прохладный бриз", sigilId: "sigil_wind_clean", requiredMarkIds: ["mark_purify", "mark_cool", "mark_dispersion", "mark_sign_of_wind"], optionalMarkIds: [], description: "Мягкие прохладные струи чистого воздуха, расходящиеся над печатью." },
  { id: "ice-glaives", name: "Ледяные клинки", sigilId: "sigil_water", requiredMarkIds: ["mark_glaives", "mark_cool", "mark_solidify", "mark_project"], optionalMarkIds: [], description: "Охлаждённая вода принимает форму твёрдых гранёных лезвий и устремляется вперёд." },
  { id: "tidal-gather", name: "Водоворот сбора", sigilId: "sigil_water", requiredMarkIds: ["mark_gather", "mark_coil", "mark_focus", "mark_cool"], optionalMarkIds: [], description: "Спокойная водяная спираль стягивает капли к узкому центру." },
  { id: "stone-heart", name: "Каменное сердце", sigilId: "sigil_earth", requiredMarkIds: ["mark_orb", "mark_crush", "mark_solidify", "mark_stability"], optionalMarkIds: [], description: "Сжатая минеральная масса удерживается в плотной устойчивой сфере." },
  { id: "light-beacon", name: "Сигнальный маяк", sigilId: "sigil_light", requiredMarkIds: ["mark_column", "mark_bolt", "mark_empower", "mark_region"], optionalMarkIds: [], description: "В заданной области поднимается яркий световой столб с повторяющимися импульсами." },
  { id: "petal-vortex", name: "Хоровод лепестков", sigilId: "sigil_flower", requiredMarkIds: ["mark_coil", "mark_float", "mark_collection", "mark_dispersion"], optionalMarkIds: [], description: "Несколько спиралей парящих лепестков раскрываются вокруг центра печати." },
  { id: "prism-mirror", name: "Зеркальная призма", sigilId: "sigil_light", requiredMarkIds: ["mark_diamond", "mark_reflect", "mark_purify", "mark_stability"], optionalMarkIds: [], description: "Чистый свет складывается в устойчивую гранёную форму с зеркально расположенными следами." },

];
