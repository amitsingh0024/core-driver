/** Typed shorthand for document.getElementById on elements that are always present in index.html. */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}
