import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useUIStore } from '@/store/uiStore';
import {
  getTutorialSections,
  getTutorialUIStrings,
  getTutorialDirection,
  type TutorialLanguage,
} from '@/lib/tutorialContent';

interface TutorialScreenProps {
  language: TutorialLanguage;
}

/**
 * "How To Play" / "كيفية اللعب" — a series of mobile-friendly cards
 * explaining every implemented mechanic, with concrete examples.
 * Renders in either English (LTR) or Arabic (RTL) depending on the
 * `language` prop, set by which Home screen button was tapped.
 */
export function TutorialScreen({ language }: TutorialScreenProps) {
  const setScreen = useUIStore((s) => s.setScreen);
  const [index, setIndex] = useState(0);
  const [showList, setShowList] = useState(false);

  const sections = getTutorialSections(language);
  const ui = getTutorialUIStrings(language);
  const dir = getTutorialDirection(language);
  const isRTL = dir === 'rtl';

  const section = sections[index];
  const isFirst = index === 0;
  const isLast = index === sections.length - 1;

  // In RTL mode, "Next" should still move forward through the content
  // (toward higher indices) — only the visual slide direction and the
  // left/right button order flip. We keep index semantics identical
  // across languages so content order matches between EN/AR.
  function goNext() {
    if (!isLast) setIndex((i) => i + 1);
  }
  function goPrev() {
    if (!isFirst) setIndex((i) => i - 1);
  }

  const slideInX = isRTL ? -24 : 24;
  const slideOutX = isRTL ? 24 : -24;

  return (
    <div className="flex h-full flex-col" dir={dir}>
      <ScreenHeader
        title={ui.title}
        onBack={() => setScreen('home')}
        right={
          <button
            onClick={() => setShowList((v) => !v)}
            className="tap-target flex items-center justify-center rounded-full text-xl text-white/70 active:scale-90"
            aria-label={ui.sectionsLabel}
          >
            ☰
          </button>
        }
      />

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 px-4 pb-2">
        {sections.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-6 bg-signal' : 'w-1.5 bg-white/15'
            }`}
            aria-label={s.title}
          />
        ))}
      </div>

      {/* Card */}
      <div className="relative flex-1 overflow-hidden px-4 pb-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={section.id}
            initial={{ opacity: 0, x: slideInX }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideOutX }}
            transition={{ duration: 0.18 }}
            className="flex h-full flex-col overflow-y-auto rounded-xl2 bg-ink-800 p-5 no-scrollbar"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="text-3xl">{section.emoji}</span>
              <h2 className="font-display text-lg font-semibold text-white">
                {section.title}
              </h2>
            </div>

            {section.chips && (
              <div className="mb-3 flex flex-wrap gap-2">
                {section.chips.map((chip, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-ink-700 px-3 py-1.5 text-xs font-medium text-white/80"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 text-sm leading-relaxed text-white/80">
              {section.body.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>

            {section.example && (
              <div className="mt-4 rounded-xl2 border border-signal/20 bg-signal/5 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-signal">
                  {section.example.label || ui.exampleLabel}
                </p>
                <p className="text-sm leading-relaxed text-white/70">
                  {section.example.text}
                </p>
              </div>
            )}

            <div className="mt-auto pt-4 text-center text-xs text-white/30">
              {ui.pageOf(index + 1, sections.length)}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 px-4 pb-4">
        <button
          onClick={goPrev}
          disabled={isFirst}
          className="tap-target flex-1 rounded-xl2 border border-white/10 font-display text-sm font-medium text-white/70 active:scale-95 disabled:opacity-30"
        >
          {ui.previous}
        </button>
        {isLast ? (
          <button
            onClick={() => setScreen('home')}
            className="tap-target flex-1 rounded-xl2 bg-signal font-display text-sm font-semibold text-ink-950 active:scale-95"
          >
            {ui.done}
          </button>
        ) : (
          <button
            onClick={goNext}
            className="tap-target flex-1 rounded-xl2 bg-signal font-display text-sm font-semibold text-ink-950 active:scale-95"
          >
            {ui.next}
          </button>
        )}
      </div>

      {/* Section list overlay */}
      <AnimatePresence>
        {showList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col bg-ink-950/95 safe-area-screen"
            dir={dir}
          >
            <ScreenHeader title={ui.sectionsLabel} onBack={() => setShowList(false)} />
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {sections.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setIndex(i);
                    setShowList(false);
                  }}
                  className="tap-target flex w-full items-center gap-3 border-b border-white/5 py-3 text-left active:bg-white/5"
                >
                  <span className="text-xl">{s.emoji}</span>
                  <span className="text-sm font-medium text-white">{s.title}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
