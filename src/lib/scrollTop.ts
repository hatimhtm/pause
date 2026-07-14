/**
 * Tap-the-active-tab-scrolls-to-top. Only the focused Screen registers its scroller,
 * so the tab bar just invokes whatever is active — no route bookkeeping.
 */
let active: (() => void) | null = null;

export function setActiveScroller(fn: (() => void) | null) {
  active = fn;
}

export function scrollActiveToTop() {
  active?.();
}
