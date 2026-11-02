// GSAP setup: page transitions and headline reveals. Never used during answering.
import { gsap, SplitText, DrawSVGPlugin } from '../vendor/gsap.js';
import { reducedMotion, $$ } from './ui.js';

gsap.registerPlugin(SplitText, DrawSVGPlugin);
export { gsap };

const splits = new WeakMap();

/** Big entrance for content views: headline lines rise in, then .reveal blocks. */
export function enterView(view) {
  gsap.killTweensOf(view);
  if (reducedMotion()) { gsap.set(view, { opacity: 1, y: 0 }); return; }
  const tl = gsap.timeline();
  tl.fromTo(view, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
  for (const h of $$('.split', view)) {
    let st = splits.get(h);
    if (st) st.revert();
    st = SplitText.create(h, { type: 'lines,words', linesClass: 'line' });
    splits.set(h, st);
    tl.from(st.words, { yPercent: 110, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.045 }, 0.05);
  }
  const blocks = $$('.reveal', view).filter((el) => !el.hidden);
  if (blocks.length) tl.from(blocks, { y: 26, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.06, clearProps: 'transform,opacity' }, 0.15);
  return tl;
}

export function leaveView(view) {
  if (reducedMotion()) return Promise.resolve();
  return new Promise((res) => gsap.to(view, { opacity: 0, y: -8, duration: 0.18, ease: 'power2.in', onComplete: () => { gsap.set(view, { y: 0 }); res(); } }));
}

/** Draw an SVG path in (DrawSVG). */
export function drawIn(paths, { duration = 1.4, delay = 0.2 } = {}) {
  if (!paths.length) return;
  if (reducedMotion()) return;
  gsap.fromTo(paths, { drawSVG: '0%' }, { drawSVG: '100%', duration, delay, ease: 'power2.inOut', stagger: 0.1 });
}
export function fadeIn(els, { delay = 0.6, stagger = 0.01 } = {}) {
  if (!els.length || reducedMotion()) return;
  gsap.from(els, { opacity: 0, duration: 0.5, delay, stagger, ease: 'power1.out' });
}
export function growBars(els, { delay = 0.3 } = {}) {
  if (!els.length || reducedMotion()) return;
  gsap.from(els, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.7, delay, ease: 'expo.out', stagger: { amount: 0.5 } });
}
