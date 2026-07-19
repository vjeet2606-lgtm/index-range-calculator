import type { KeyboardEvent } from "react";

/**
 * Moves focus between focusable buttons inside a grid container using arrow keys.
 * Right/Down move to the next item, Left/Up move to the previous item — a simple,
 * linear approximation that's still genuinely useful for small card grids.
 */
export function handleGridArrowNav(event: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;

  const container = event.currentTarget;
  const focusable = Array.from(container.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
  const currentIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
  if (currentIndex === -1) return;

  event.preventDefault();

  const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
  const delta = forward ? 1 : -1;
  const nextIndex = (currentIndex + delta + focusable.length) % focusable.length;
  focusable[nextIndex]?.focus();
}
