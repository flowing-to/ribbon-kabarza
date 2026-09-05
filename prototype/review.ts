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
document.querySelector<HTMLButtonElement>('#replay')!.onclick = () => carousel.replayIntro();
document.querySelectorAll<HTMLButtonElement>('[data-count]').forEach(button => {
  button.onclick = () => {
    carousel.update({ items: items(Number(button.dataset.count)) });
    document.querySelectorAll('[data-count]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  };
});
document.querySelector<HTMLSelectElement>('#size')!.onchange = event => {
  host.style.width = (event.target as HTMLSelectElement).value;
  host.style.maxWidth = '100%';
};
const motion = document.querySelector<HTMLButtonElement>('#motion')!;
motion.onclick = () => {
  const enabled = motion.getAttribute('aria-pressed') !== 'true';
  motion.setAttribute('aria-pressed', String(enabled));
  carousel.update({ autoRotate: enabled });
};
// Review-only handle for repeatable browser verification; not part of the library.
Object.assign(window, { ribbonReview: { carousel, items, mountRibbonCarousel } });
if (import.meta.hot) import.meta.hot.dispose(() => carousel.destroy());
