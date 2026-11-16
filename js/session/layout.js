// The Passage on screen and the Cell Layout reported to the service.

import { $ } from "../state.js";
import { textToBraille } from "../reading/passage.js";

export function renderPassage(passage) {
  const box = $("passage");
  box.innerHTML = "";
  box.style.setProperty("--cols", passage.numColumns);
  box.style.setProperty("--rows", passage.numRows);
  box.style.gridTemplateColumns = `repeat(${passage.numColumns}, var(--cell-w))`;
  passage.lines.forEach((line, row) => {
    [...textToBraille(line)].forEach((ch, col) => {
      const cell = document.createElement("span");
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.textContent = ch;
      if (row === 0 && col === 0) cell.classList.add("first");
      box.appendChild(cell);
    });
  });
}

// Every Cell rectangle, normalized 0–1 to the viewport.
export function measureLayout() {
  const W = window.innerWidth, H = window.innerHeight;
  const clamp = (v) => Math.min(Math.max(v, 0.0001), 0.9999);
  const cells = [...document.querySelectorAll("#passage .cell")].map((el) => {
    const r = el.getBoundingClientRect();
    const x = clamp(r.left / W), y = clamp(r.top / H);
    return {
      row: Number(el.dataset.row),
      col: Number(el.dataset.col),
      x, y,
      w: Math.min(r.width / W, 1 - x),
      h: Math.min(r.height / H, 1 - y),
    };
  });
  return { type: "layout", viewport: { width: W, height: H }, cells };
}
