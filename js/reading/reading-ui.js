// Live reading feedback: the fixated Cell, progress and fixation count.

import { $, state } from "../state.js";

export function onFixation(row, col) {
  state.fixations++;
  $("read-fixations").textContent = state.fixations;
  $("read-cell").textContent = `Row ${row + 1}, cell ${col + 1}`;
  const p = state.passage;
  const done = row * p.numColumns + col + 1, total = p.numRows * p.numColumns;
  const pct = Math.round((done / total) * 100);
  $("read-progress-bar").style.width = `${pct}%`;
  $("read-progress").setAttribute("aria-valuenow", pct);
  $("read-progress-label").textContent = `Cell ${done} of ${total}`;

  state.activeCell?.classList.remove("active");
  state.activeCell?.classList.add("read");
  const el = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  el?.classList.add("active");
  state.activeCell = el;
}
