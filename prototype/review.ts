import { mountRibbonCarousel, type CarouselItem } from './carousel';

const titles = ['Hero Sections', 'Nav Menus', 'Sliders', 'Footers', 'Creative Sections', 'WebGL Effects', 'Buttons', 'Transitions', 'Loaders', '3D Effects', 'Hover Animations', 'Creative Coding'];
function items(count: number): CarouselItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `card-${index + 1}`,
    title: titles[index % titles.length],
    previewSrc: `/previews/img${index % 12 + 1}_.webp`,
    src: `/images/img${index % 12 + 1}_.webp`,
  }));
}
const host = document.querySelector<HTMLElement>('#host')!;
const carousel = mountRibbonCarousel(host, { items: items(12), title: 'Beautiful Designs\nAdvanced Interactions', fabric: { color: '/previews/linen/color.jpg', normal: '/previews/linen/normal.jpg' } });
let disposed = false;
// Load debugging UI after mounting the experience; production imports only carousel.ts.
const controls = import('./playground-controls').then(({ mountPlaygroundControls }) => {
  if (disposed) return;
  const ui = mountPlaygroundControls(document.querySelector<HTMLElement>('#tuning')!, carousel, items, state => {
    document.querySelectorAll<HTMLElement>('[data-count]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.count) === state.count)));
    document.querySelector('#motion')!.setAttribute('aria-pressed', String(state.autoRotate));
    const gap = document.querySelector<HTMLSelectElement>('#gap')!;
    gap.querySelector('[data-custom]')?.remove();
    if (![...gap.options].some(option => Number(option.value) === state.gap)) {
      const option = new Option(`${state.gap.toFixed(2)}° gap`, String(state.gap));
      option.dataset.custom = ''; gap.add(option);
    }
    gap.value = String(state.gap);
  });
  Object.assign(window, { ribbonTuning: ui });
  return ui;
});
document.querySelector<HTMLButtonElement>('#replay')!.onclick = () => carousel.replayIntro();
document.querySelector<HTMLSelectElement>('#gap')!.onchange = event => {
  const gap = Number((event.target as HTMLSelectElement).value);
  void controls.then(ui => ui?.setGap(gap));
};
document.querySelectorAll<HTMLButtonElement>('[data-count]').forEach(button => {
  button.onclick = () => {
    void controls.then(ui => ui?.setCount(Number(button.dataset.count)));
  };
});
document.querySelector<HTMLSelectElement>('#size')!.onchange = event => {
  host.style.width = (event.target as HTMLSelectElement).value;
  host.style.maxWidth = '100%';
};
const motion = document.querySelector<HTMLButtonElement>('#motion')!;
motion.onclick = () => {
  const enabled = motion.getAttribute('aria-pressed') !== 'true';
  void controls.then(ui => ui?.setAutoRotate(enabled));
};
document.querySelector<HTMLButtonElement>('#toggle-tuning')!.onclick = event => {
  const enabled = document.body.classList.toggle('tuning-open');
  (event.currentTarget as HTMLButtonElement).setAttribute('aria-expanded', String(enabled));
};
// Review-only handle for repeatable browser verification; not part of the library.
Object.assign(window, { ribbonReview: { carousel, items, mountRibbonCarousel } });
if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; void controls.then(ui => ui?.dispose()); carousel.destroy(); });
