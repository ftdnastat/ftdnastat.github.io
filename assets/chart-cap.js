// Captions of the static findings charts: hovering, tapping or focusing an item shows its text under the chart.
(function () {
  "use strict";
  for (const fig of document.querySelectorAll(".fchart")) {
    const cap = fig.querySelector(".cmap-cap");
    if (!cap) continue;
    let on = null;
    const pick = (g) => {
      if (!g || g === on) return;
      if (on) on.classList.remove("on");
      on = g;
      g.classList.add("on");
      cap.textContent = g.dataset.cap;
    };
    const itemAt = (ev) => ev.target.closest && ev.target.closest(".fc-item");
    fig.addEventListener("mouseover", (ev) => pick(itemAt(ev)));
    fig.addEventListener("click", (ev) => pick(itemAt(ev)));
    fig.addEventListener("focusin", (ev) => pick(itemAt(ev)));
  }
})();
