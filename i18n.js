// ===== Переклади інтерфейсу. Щоб додати мову, скопіюйте блок "en" і додайте кнопку в index.html (data-lang) =====
const I18N = {
  uk: {
    'tab.fx': 'Ефекти', 'tab.color': 'Кольори', 'tab.saved': 'Збережені', 'tab.sun': 'Світанок', 'tab.set': 'Опції',
    'title.fx': 'Ефекти', 'title.color': 'Кольори', 'title.saved': 'Збережені', 'title.sun': 'Світанок', 'title.set': 'Налаштування',
    'common.back': 'Назад', 'now.off': 'Вимкнено',
    'fx.speed': 'Швидкість', 'fx.search': 'Пошук ефекту', 'fx.all': 'Усі', 'fx.own': 'Свої кольори', 'fx.auto': 'Власна палітра', 'fx.empty': 'Нічого не знайдено',
    'tag.auto': 'авто', 'tag.1': '1 колір', 'tag.n': '{n} кольори',
    'col.none': 'Цей ефект має власну палітру кольорів. Оберіть ефект із вашими кольорами в розділі «Ефекти» або перейдіть на суцільний колір.',
    'col.mono': 'Суцільний колір', 'col.rand': 'Випадкова палітра', 'col.hue': 'Відтінок', 'col.sat': 'Насиченість', 'col.val': 'Яскравість кольору',
    'col.std': 'Стандартні кольори', 'col.sets': 'Набори кольорів', 'col.n': 'Колір {n}',
    'pal.0': 'Захід', 'pal.1': 'Океан', 'pal.2': 'Неон', 'pal.3': 'Ліс', 'pal.4': 'Полум’я', 'pal.5': 'Льодовик',
    'saved.cur': 'Поточні налаштування', 'saved.name': 'Назва', 'saved.add': 'Зберегти як нове', 'saved.upd': 'Оновити активне', 'saved.list': 'Збережені',
    'saved.hint': 'Свайп вліво чи вправо по лампі перемикає збережені налаштування.',
    'toast.saved': 'Збережено', 'toast.upd': 'Оновлено', 'toast.reset': 'Скинуто', 'toast.sunrise': 'Світанок',
    'sun.alarm': 'Будильник', 'sun.dur': 'Тривалість', 'sun.min': 'хв', 'sun.test': 'Показати світанок (12 с)',
    'sun.hint': 'Лампа поступово розгорається теплим світлом і сягає повної яскравості до вказаного часу. Зараз це працює, поки сторінка відкрита; на справжній лампі розклад виконуватиме прошивка.',
    'set.lamp': 'Лампа', 'set.lang': 'Мова', 'set.bri': 'Яскравість', 'set.sim': 'Симуляція', 'set.look': 'Вигляд', 'set.conn': 'Підключення', 'set.data': 'Дані', 'set.about': 'Про застосунок',
    'lamp.name': 'Назва лампи', 'lamp.id': 'ID лампи', 'lamp.rand': 'Випадковий',
    'lamp.hint': 'Ефекти рахуються від часу й цього ID: однакові ID дають однакову картинку на різних лампах.',
    'bri.soft': 'М’яка', 'bri.lin': 'Лінійна', 'bri.prec': 'Точна', 'bri.hint': 'З яким характером повзунок яскравості змінює світло.',
    'sim.fps': 'Ліміт FPS', 'sim.max': 'Макс', 'sim.q': 'Якість рендера', 'q.low': 'Низька', 'q.mid': 'Серед.', 'q.high': 'Висока',
    'sim.glow': 'Свічення фону', 'sim.glow.d': 'Світло за лампою', 'sim.tilt': 'Нахил лампи', 'sim.tilt.d': 'Кут огляду зверху на головному екрані',
    'sim.smooth': 'Плавна анімація', 'sim.smooth.d': 'Згладжує кроки ефекту', 'sim.auto': 'Авто-якість', 'sim.auto.d': 'Знижує роздільність при гальмуванні', 'sim.fpsshow': 'Показувати FPS',
    'look.style': 'Стиль', 'look.accent': 'Колір акценту', 'st.minimal': 'Мінімалізм', 'st.gradient': 'Градієнт', 'st.midnight': 'Північ', 'st.sunset': 'Захід',
    'conn.addr': 'Адреса лампи', 'conn.check': 'Перевірити', 'conn.none': 'Не підключено (симулятор)', 'conn.checking': 'Перевірка…', 'conn.ok': 'Лампа відповіла',
    'conn.fail': 'Немає відповіді. З HTTPS-сторінки браузер може блокувати запити до лампи: відкрийте сторінку з самої лампи.',
    'conn.hint': 'Підключення до справжньої лампи з’явиться разом із прошивкою.',
    'data.export': 'Експорт налаштувань', 'data.import': 'Імпорт налаштувань', 'data.resetp': 'Скинути збережені', 'data.resetall': 'Скинути все',
    'data.hint': 'Налаштування зберігаються лише в цьому браузері.',
    'about.foot': 'Smart Lamp v{v} · ID: {id}', 'sim.size': 'Розмір лампи', 'sim.size.d': 'Розмір на головному екрані', 'gest.bri': 'Яскравість свайпом', 'gest.bri.d': 'Провести вгору чи вниз по екрану', 'look.apply': 'Застосувати', 'toast.applied': 'Застосовано',
  },
  en: {
    'tab.fx': 'Effects', 'tab.color': 'Colors', 'tab.saved': 'Saved', 'tab.sun': 'Sunrise', 'tab.set': 'Options',
    'title.fx': 'Effects', 'title.color': 'Colors', 'title.saved': 'Saved', 'title.sun': 'Sunrise', 'title.set': 'Settings',
    'common.back': 'Back', 'now.off': 'Off',
    'fx.speed': 'Speed', 'fx.search': 'Search effects', 'fx.all': 'All', 'fx.own': 'Own colors', 'fx.auto': 'Built-in palette', 'fx.empty': 'Nothing found',
    'tag.auto': 'auto', 'tag.1': '1 color', 'tag.n': '{n} colors',
    'col.none': 'This effect uses its own palette. Pick an effect with custom colors in Effects, or switch to a solid color.',
    'col.mono': 'Solid color', 'col.rand': 'Random palette', 'col.hue': 'Hue', 'col.sat': 'Saturation', 'col.val': 'Color brightness',
    'col.std': 'Standard colors', 'col.sets': 'Color sets', 'col.n': 'Color {n}',
    'pal.0': 'Sunset', 'pal.1': 'Ocean', 'pal.2': 'Neon', 'pal.3': 'Forest', 'pal.4': 'Flame', 'pal.5': 'Glacier',
    'saved.cur': 'Current settings', 'saved.name': 'Name', 'saved.add': 'Save as new', 'saved.upd': 'Update active', 'saved.list': 'Saved',
    'saved.hint': 'Swipe left or right on the lamp to switch between saved settings.',
    'toast.saved': 'Saved', 'toast.upd': 'Updated', 'toast.reset': 'Reset', 'toast.sunrise': 'Sunrise',
    'sun.alarm': 'Alarm', 'sun.dur': 'Duration', 'sun.min': 'min', 'sun.test': 'Preview sunrise (12 s)',
    'sun.hint': 'The lamp gradually brightens with warm light and reaches full brightness at the set time. For now this works while the page is open; on a real lamp the firmware will run the schedule.',
    'set.lamp': 'Lamp', 'set.lang': 'Language', 'set.bri': 'Brightness', 'set.sim': 'Simulation', 'set.look': 'Appearance', 'set.conn': 'Connection', 'set.data': 'Data', 'set.about': 'About',
    'lamp.name': 'Lamp name', 'lamp.id': 'Lamp ID', 'lamp.rand': 'Random',
    'lamp.hint': 'Effects are computed from time and this ID: lamps with the same ID show the same picture.',
    'bri.soft': 'Soft', 'bri.lin': 'Linear', 'bri.prec': 'Precise', 'bri.hint': 'How the brightness slider maps to the light.',
    'sim.fps': 'FPS limit', 'sim.max': 'Max', 'sim.q': 'Render quality', 'q.low': 'Low', 'q.mid': 'Mid', 'q.high': 'High',
    'sim.glow': 'Background glow', 'sim.glow.d': 'Light behind the lamp', 'sim.tilt': 'Lamp tilt', 'sim.tilt.d': 'View angle from above on the home screen',
    'sim.smooth': 'Smooth animation', 'sim.smooth.d': 'Smooths effect steps', 'sim.auto': 'Auto quality', 'sim.auto.d': 'Lowers resolution when slow', 'sim.fpsshow': 'Show FPS',
    'look.style': 'Style', 'look.accent': 'Accent color', 'st.minimal': 'Minimal', 'st.gradient': 'Gradient', 'st.midnight': 'Midnight', 'st.sunset': 'Sunset',
    'conn.addr': 'Lamp address', 'conn.check': 'Check', 'conn.none': 'Not connected (simulator)', 'conn.checking': 'Checking…', 'conn.ok': 'Lamp responded',
    'conn.fail': 'No response. A browser may block requests to the lamp from an HTTPS page: open the page from the lamp itself.',
    'conn.hint': 'Connecting to a real lamp will arrive together with the firmware.',
    'data.export': 'Export settings', 'data.import': 'Import settings', 'data.resetp': 'Reset saved', 'data.resetall': 'Reset everything',
    'data.hint': 'Settings are stored in this browser only.',
    'about.foot': 'Smart Lamp v{v} · ID: {id}', 'sim.size': 'Lamp size', 'sim.size.d': 'Size on the home screen', 'gest.bri': 'Brightness by swipe', 'gest.bri.d': 'Swipe up or down on the screen', 'look.apply': 'Apply', 'toast.applied': 'Applied',
  },
};
// Назви, описи й підписи кольорів ефектів англійською (за id ефекту)
const FX_EN = {
  fire: ['Fire', 'Flames rising from the bottom'], mono: ['Color', 'One solid color', ['Color']],
  gradient: ['Gradient', 'Three colors flow around the lamp', ['Color 1', 'Color 2', 'Color 3']],
  fireflies: ['Fireflies', 'Glowing dots drift over a background', ['Background', 'Fireflies']],
  rainbow: ['Rainbow', 'The full spectrum rotates around'], aurora: ['Aurora', 'Green and violet northern lights'], ocean: ['Ocean', 'Waves of sea water'],
  waves: ['Waves', 'Two colors flow in waves', ['Color 1', 'Color 2']], sunset: ['Sunset', 'From a red horizon to a violet sky'],
  breathe: ['Breathing', 'The color slowly fades in and out', ['Color']], sparkle: ['Sparkles', 'Bright flashes over a background', ['Background', 'Sparks']],
  lava: ['Lava lamp', 'Slow glowing blobs rise and sink', ['Background', 'Lava']], police: ['Police', 'Red and blue emergency flashers', ['Color 1', 'Color 2']], sun: ['Sun', 'A warm sun slowly sways in front of the lamp'],
  sunrise: ['Sunrise', 'Alarm'],
};
let LANG = 'uk';
const t = (k, v) => { let s = (I18N[LANG] && I18N[LANG][k]) ?? I18N.uk[k] ?? k; if (v) for (const x in v) s = s.replace(`{${x}}`, v[x]); return s; };
const fxName = (e) => (LANG === 'uk' ? e.name : (FX_EN[e.id] || [e.name])[0]);
const fxDesc = (e) => (LANG === 'uk' ? e.desc : (FX_EN[e.id] || [0, e.desc])[1]);
const fxLabel = (e, i) => (LANG === 'uk' ? (e.labels || [])[i] : (FX_EN[e.id] || [])[2] && FX_EN[e.id][2][i]) || t('col.n', { n: i + 1 });
const detectLang = () => ((navigator.language || 'en').toLowerCase().startsWith('uk') ? 'uk' : 'en');
function applyI18n() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-label]').forEach((el) => { const s = t(el.dataset.i18nLabel); el.title = s; el.setAttribute('aria-label', s); });
}
