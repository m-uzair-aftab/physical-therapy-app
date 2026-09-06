// iOS can resize only the visual viewport when its keyboard opens.
// Size the shell to that viewport while editing, without restricting pinch zoom.
export function trackKeyboardViewport(win = window) {
  const viewport = win.visualViewport;
  if (!viewport) return;
  const root = win.document.documentElement;
  let frame;
  function update() {
    win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(() => {
      const field = win.document.activeElement;
      const editing = field?.matches('input, textarea, select, [contenteditable="true"]');
      if (editing && Math.abs(viewport.scale - 1) < 0.01) {
        root.style.setProperty('--editing-height', `${viewport.height}px`);
        const main = field.closest('.main');
        if (main) {
          const bounds = main.getBoundingClientRect();
          const rect = field.getBoundingClientRect();
          if (rect.bottom > bounds.bottom) main.scrollTop += rect.bottom - bounds.bottom + 18;
          else if (rect.top < bounds.top) main.scrollTop -= bounds.top - rect.top + 18;
        }
      } else {
        root.style.removeProperty('--editing-height');
      }
    });
  }
  viewport.addEventListener('resize', update);
  win.document.addEventListener('focusin', update);
  win.document.addEventListener('focusout', update);
}
