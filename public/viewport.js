// iOS may pan the visual viewport as well as shrink it for the keyboard.
// Keep the mobile shell inside that visible rectangle, without restricting zoom.
export function trackKeyboardViewport(win = window) {
  const viewport = win.visualViewport;
  if (!viewport) return;
  const root = win.document.documentElement;
  let frame;
  let revealField = false;

  function clear() {
    root.removeAttribute('data-keyboard-viewport');
    root.style.removeProperty('--editing-height');
    root.style.removeProperty('--editing-top');
  }

  function update(reveal = false) {
    revealField ||= reveal;
    win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(() => {
      const shouldReveal = revealField;
      revealField = false;
      const field = win.document.activeElement;
      const editing = field?.matches('input, textarea, select, [contenteditable="true"]');
      const main = editing ? field.closest('.main') : null;
      const top = Math.max(0, viewport.offsetTop);
      const keyboardViewport = viewport.height < root.clientHeight - 1 || top > 1;
      if (!main || !win.matchMedia('(max-width: 899px)').matches ||
          Math.abs(viewport.scale - 1) >= 0.01 || !keyboardViewport) {
        clear();
        return;
      }

      root.style.setProperty('--editing-height', `${viewport.height}px`);
      root.style.setProperty('--editing-top', `${top}px`);
      root.setAttribute('data-keyboard-viewport', '');

      // Focus and keyboard resizing may obscure a field. Viewport panning alone
      // should move the shell, not pull the user back to the focused input.
      if (!shouldReveal) return;
      const bounds = main.getBoundingClientRect();
      const rect = field.getBoundingClientRect();
      const visibleTop = Math.max(bounds.top, top);
      const visibleBottom = Math.min(bounds.bottom, top + viewport.height);
      if (visibleBottom <= visibleTop) return;
      if (rect.bottom > visibleBottom) main.scrollTop += rect.bottom - visibleBottom + 18;
      else if (rect.top < visibleTop) main.scrollTop -= visibleTop - rect.top + 18;
    });
  }

  viewport.addEventListener('resize', () => update(true));
  viewport.addEventListener('scroll', () => update());
  win.document.addEventListener('focusin', () => update(true));
  win.document.addEventListener('focusout', () => update());
}
