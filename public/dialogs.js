// Keep focus and assistive technology inside a dialog, including across renders.
export function createDialogManager(app) {
  const doc = app.ownerDocument;
  let opener = null;
  let openerSelector = null;
  let openerRoute = null;
  let active = false;
  let lastTrigger = null;
  let focusedAction = null;
  const focusableSelector = 'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]';
  const dialog = () => app.querySelector('[role="dialog"]');
  const focusable = (root) => [...root.querySelectorAll(focusableSelector)].filter((el) => !el.hidden && !el.closest('[hidden], [inert]'));

  app.addEventListener('click', (event) => {
    if (!dialog()) lastTrigger = event.target.closest('button, a, input, textarea');
  }, true);

  function beforeRender() {
    if (!active) {
      opener = lastTrigger?.isConnected ? lastTrigger : doc.activeElement;
      openerRoute = doc.defaultView.location.pathname;
      const attr = ['data-action', 'data-nav', 'id'].find((name) => opener?.hasAttribute?.(name));
      const exercise = opener?.closest?.('[data-exercise-id]');
      const escape = (value) => doc.defaultView.CSS.escape(value);
      openerSelector = attr ? `[${attr}="${escape(opener.getAttribute(attr))}"]` : null;
      if (exercise && openerSelector) openerSelector = `[data-exercise-id="${escape(exercise.dataset.exerciseId)}"] ${openerSelector}`;
    }
    focusedAction = doc.activeElement?.dataset?.modalAction || null;
  }

  function afterRender() {
    const current = dialog();
    const shell = app.querySelector('.app-shell') || app;
    for (const child of shell.children) child.inert = Boolean(current && child !== current);
    if (current) {
      current.tabIndex = -1;
      const preferred = focusedAction && [...current.querySelectorAll('[data-modal-action]')].find((el) => el.dataset.modalAction === focusedAction && !el.disabled);
      const target = preferred || current.querySelector('[data-modal-action="cancel"]:not(:disabled)') || focusable(current)[0] || current;
      target.focus({ preventScroll: true });
    } else if (active) {
      const sameRoute = openerRoute === doc.defaultView.location.pathname;
      const target = sameRoute && (opener?.isConnected ? opener : openerSelector && app.querySelector(openerSelector));
      if (target && !target.disabled) target.focus({ preventScroll: true });
      opener = null;
      lastTrigger = null;
    }
    active = Boolean(current);
  }

  app.addEventListener('keydown', (event) => {
    const current = dialog();
    if (!current) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      current.querySelector('[data-modal-action="cancel"]:not(:disabled)')?.click();
    } else if (event.key === 'Tab') {
      const items = focusable(current);
      const first = items[0] || current;
      const last = items.at(-1) || current;
      if (!current.contains(doc.activeElement) || doc.activeElement === current || (event.shiftKey ? doc.activeElement === first : doc.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
  });
  return { beforeRender, afterRender };
}
