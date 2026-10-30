/** Typed shorthand for document.getElementById on elements that are always present in index.html. */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const lastText = new WeakMap<HTMLElement, string>();
const lastStyle = new WeakMap<HTMLElement, Record<string, string>>();

/** Sets textContent only when it changed, so per-frame HUD updates don't dirty layout. */
export function setText(el: HTMLElement, text: string): void {
  if (lastText.get(el) === text) return;
  lastText.set(el, text);
  el.textContent = text;
}

/** Sets one inline style property only when it changed. */
export function setStyle(el: HTMLElement, prop: string, value: string): void {
  let cache = lastStyle.get(el);
  if (!cache) lastStyle.set(el, (cache = {}));
  if (cache[prop] === value) return;
  cache[prop] = value;
  el.style.setProperty(prop, value);
}
