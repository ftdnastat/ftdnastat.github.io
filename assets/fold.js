// Search folding for the header search, table filters and the culture picker: "Únětice" → "unetice".
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Fold = factory();
})(this, function () {
  "use strict";
  // letters that NFD does not split into a base letter and a mark; і is the Cyrillic i that Discover puts into Latin names
  var SPECIAL = { "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d", "ð": "d", "þ": "th", "ı": "i", "ħ": "h", "ŋ": "n", "ё": "е", "і": "i", "ї": "i" };
  var SPECIAL_RE = /[ßæœøłđðþıħŋёії]/g;
  function fold(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(SPECIAL_RE, function (c) { return SPECIAL[c]; })
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[’'ʼ`´‘]/g, "")
      .replace(/[\s\-‐‑–—_/]+/g, " ")
      .trim();
  }
  return { fold: fold };
});
