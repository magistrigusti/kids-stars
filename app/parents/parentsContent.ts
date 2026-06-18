export type ParentsLocale = 'ru' | 'en';

export type LocalizedText = Record<ParentsLocale, string>;

export type ParentsZoneTabId = 'advice' | 'meditation' | 'anima' | 'health';

export interface ParentsZoneTab {
  id: ParentsZoneTabId;
  title: LocalizedText;
  text: LocalizedText;
  ariaLabel: LocalizedText;
}

export interface ParentsMeditationTrack {
  id: string;
  title: LocalizedText;
  fileName: string;
  duration: string;
  source: string;
}

export const PARENTS_LOCALE: ParentsLocale = 'ru';

export const parentsPageText = {
  titleStart: {
    ru: 'Зона для',
    en: 'Zone for',
  },
  titleAccent: {
    ru: 'родителей',
    en: 'parents',
  },
  subtitle: {
    ru: 'Советы, медитации, Anima и здоровье взрослых в одном спокойном пространстве.',
    en: 'Advice, meditations, Anima, and adult health in one calm space.',
  },
  adviceTitle: {
    ru: 'Советы для родителей',
    en: 'Advice for parents',
  },
  adviceSubtitle: {
    ru: 'Текущие рекомендации остаются первой вкладкой и открываются по умолчанию.',
    en: 'Current recommendations stay in the first tab and open by default.',
  },
  meditationTitle: {
    ru: 'Медитации',
    en: 'Meditations',
  },
  meditationSubtitle: {
    ru: 'Плейлист трансов и мягких практик, собранный как удобный список аудио.',
    en: 'A playlist of trance tracks and gentle practices collected as an audio list.',
  },
  animaTitle: {
    ru: 'Психолог и коуч',
    en: 'Psychologist and Coach',
  },
  animaSubtitle: {
    ru: 'Anima помогает бережно разложить чувства и найти маленький следующий шаг.',
    en: 'Anima gently helps sort feelings and find one small next step.',
  },
  healthTitle: {
    ru: 'Здоровье',
    en: 'Health',
  },
  healthSubtitle: {
    ru: 'Здесь подготовим упражнения для тела, тазового дна и восстановления сил.',
    en: 'Here we will prepare body, pelvic floor, and recovery exercises.',
  },
  healthNotice: {
    ru: 'Раздел готовим аккуратно: сначала архитектура, потом упражнения и прогресс.',
    en: 'This section is being prepared carefully: architecture first, then exercises and progress.',
  },
} as const;

export const parentsZoneTabs = [
  {
    id: 'advice',
    title: {
      ru: 'Советы',
      en: 'Advice',
    },
    text: {
      ru: 'педагогика и семья',
      en: 'parenting and family',
    },
    ariaLabel: {
      ru: 'Открыть советы для родителей',
      en: 'Open advice for parents',
    },
  },
  {
    id: 'meditation',
    title: {
      ru: 'Медитации',
      en: 'Meditations',
    },
    text: {
      ru: 'трансы и отдых',
      en: 'trance and rest',
    },
    ariaLabel: {
      ru: 'Открыть медитации для родителей',
      en: 'Open meditations for parents',
    },
  },
  {
    id: 'anima',
    title: {
      ru: 'Психолог',
      en: 'Psychologist',
    },
    text: {
      ru: 'коуч Anima',
      en: 'Anima coach',
    },
    ariaLabel: {
      ru: 'Открыть психолога и коуча Anima',
      en: 'Open Anima psychologist and coach',
    },
  },
  {
    id: 'health',
    title: {
      ru: 'Здоровье',
      en: 'Health',
    },
    text: {
      ru: 'тело и энергия',
      en: 'body and energy',
    },
    ariaLabel: {
      ru: 'Открыть раздел здоровья для родителей',
      en: 'Open parent health section',
    },
  },
] as const satisfies readonly ParentsZoneTab[];

export const PARENTS_MEDITATION_TRACKS = [
  {
    id: 'day',
    title: {
      ru: 'День',
      en: 'Day',
    },
    fileName: 'day.mp3',
    duration: '35:33',
    source: '/audio/meditations/day.mp3',
  },
  {
    id: 'good-sleep',
    title: {
      ru: 'Транс: добрый сон',
      en: 'Trance: Good Sleep',
    },
    fileName: 'good-sleep.mp3',
    duration: '21:36',
    source: '/audio/meditations/good-sleep.mp3',
  },
  {
    id: 'inner-child',
    title: {
      ru: 'Встреча с внутренним ребёнком',
      en: 'Meeting the Inner Child',
    },
    fileName: 'inner-child.mp3',
    duration: '31:29',
    source: '/audio/meditations/inner-child.mp3',
  },
  {
    id: 'evening',
    title: {
      ru: 'Вечер',
      en: 'Evening',
    },
    fileName: 'evening.mp3',
    duration: '22:16',
    source: '/audio/meditations/evening.mp3',
  },
  {
    id: 'morning',
    title: {
      ru: 'Утро',
      en: 'Morning',
    },
    fileName: 'morning.mp3',
    duration: '19:58',
    source: '/audio/meditations/morning.mp3',
  },
] as const satisfies readonly ParentsMeditationTrack[];
