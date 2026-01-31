
/**
 * Helper to create DOM elements with attributes and children in a declarative way.
 * @param tag The HTML tag name (e.g., 'div', 'span', 'table').
 * @param attributes Optional object containing properties to set on the element.
 *                   - style: an object of style properties.
 *                   - dataset: an object of data attributes.
 *                   - events (or properties starting with 'on'): event listeners.
 *                   - className: set the class attribute.
 *                   - other properties are set directly on the element or via setAttribute.
 * @param children Optional array of strings or Nodes to append as children.
 * @returns The created HTML element.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes?: Record<string, any>,
  children?: (string | Node | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key === 'dataset' && typeof value === 'object') {
        Object.assign(element.dataset, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        // Event listener via property (e.g. onclick) or addEventListener
        // For simplicity and better typing, we can treat them as properties if they exist,
        // or addEventListener if it's a custom convention.
        // Standard practice: element.onclick = ...
        (element as any)[key] = value;
      } else if (key === 'className') {
        element.className = value;
      } else {
        // Fallback for other attributes/properties
        if (key in element) {
            (element as any)[key] = value;
        } else {
            element.setAttribute(key, String(value));
        }
      }
    }
  }

  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
      // Ignore null/undefined children
    }
  }

  return element;
}
