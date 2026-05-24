// Svelte action: use:cardTilt on white content cards
export function cardTilt(node: HTMLElement) {
  if (window.matchMedia('(hover: none)').matches) return {};
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return {};

  node.style.transformStyle = 'preserve-3d';

  function onMove(e: MouseEvent) {
    const rect = node.getBoundingClientRect();
    const rx = Math.max(-4, Math.min(4, (e.clientY - rect.top)  / rect.height * -8 + 4));
    const ry = Math.max(-4, Math.min(4, (e.clientX - rect.left) / rect.width  *  8 - 4));
    node.style.transition = '';
    node.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    node.style.boxShadow = `0 ${8 + Math.abs(rx)}px ${24 + Math.abs(ry) * 2}px rgba(0,0,0,.10)`;
  }

  function onLeave() {
    node.style.transition = 'transform 300ms ease-out, box-shadow 300ms ease-out';
    node.style.transform = '';
    node.style.boxShadow = '';
  }

  node.addEventListener('mousemove', onMove);
  node.addEventListener('mouseleave', onLeave);

  return {
    destroy() {
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
    }
  };
}
