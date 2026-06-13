import { TUTORIAL_SECTIONS_EN, type TutorialSection } from './tutorialContent.en';
import { TUTORIAL_SECTIONS_AR } from './tutorialContent.ar';

export type TutorialLanguage = 'en' | 'ar';

export interface TutorialUIStrings {
  title: string;
  sectionsLabel: string;
  previous: string;
  next: string;
  done: string;
  exampleLabel: string; // fallback if a section doesn't provide its own
  pageOf: (current: number, total: number) => string;
}

const UI_STRINGS: Record<TutorialLanguage, TutorialUIStrings> = {
  en: {
    title: 'How To Play',
    sectionsLabel: 'Sections',
    previous: 'Previous',
    next: 'Next',
    done: 'Done',
    exampleLabel: 'Example',
    pageOf: (current, total) => `${current} / ${total}`,
  },
  ar: {
    title: 'كيفية اللعب',
    sectionsLabel: 'الأقسام',
    previous: 'السابق',
    next: 'التالي',
    done: 'تم',
    exampleLabel: 'مثال',
    pageOf: (current, total) => `${current} / ${total}`,
  },
};

const SECTIONS: Record<TutorialLanguage, TutorialSection[]> = {
  en: TUTORIAL_SECTIONS_EN,
  ar: TUTORIAL_SECTIONS_AR,
};

const DIRECTION: Record<TutorialLanguage, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

export function getTutorialSections(lang: TutorialLanguage): TutorialSection[] {
  return SECTIONS[lang];
}

export function getTutorialUIStrings(lang: TutorialLanguage): TutorialUIStrings {
  return UI_STRINGS[lang];
}

export function getTutorialDirection(lang: TutorialLanguage): 'ltr' | 'rtl' {
  return DIRECTION[lang];
}

export type { TutorialSection };
