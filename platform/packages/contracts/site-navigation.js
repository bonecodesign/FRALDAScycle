export function bindResponsiveSiteNavigation({ button, navigation, getFocusables, windowObject = window, documentObject = document, onToggle = () => {} }) {
  if (!button || !navigation) return () => {};

  const media = windowObject.matchMedia('(max-width: 991px)');
  let open = false;
  const focusables = () => getFocusables().filter((element) => {
    if (!element || element.disabled || element.getAttribute?.('aria-hidden') === 'true') return false;
    return typeof element.getClientRects !== 'function' || element.getClientRects().length > 0;
  });

  function setOpen(next, { returnFocus = false, focusFirst = false } = {}) {
    open = Boolean(next);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Fechar navegação' : 'Abrir navegação');
    navigation.dataset.open = String(open);
    onToggle(open);
    if (returnFocus) button.focus();
    else if (focusFirst && open) navigation.querySelector('a[href]')?.focus();
  }

  function onButtonClick() {
    setOpen(!open, { focusFirst: !open });
  }

  function onNavigationClick(event) {
    if (event.target.closest('a[href]')) setOpen(false);
  }

  function onKeydown(event) {
    if (!open || !media.matches) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false, { returnFocus: true });
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables();
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && documentObject.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && documentObject.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function onBreakpointChange(event) {
    if (!event.matches && open) setOpen(false);
  }

  button.addEventListener('click', onButtonClick);
  navigation.addEventListener('click', onNavigationClick);
  documentObject.addEventListener('keydown', onKeydown);
  media.addEventListener?.('change', onBreakpointChange);
  setOpen(false);

  return () => {
    button.removeEventListener('click', onButtonClick);
    navigation.removeEventListener('click', onNavigationClick);
    documentObject.removeEventListener('keydown', onKeydown);
    media.removeEventListener?.('change', onBreakpointChange);
  };
}
