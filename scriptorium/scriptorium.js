// Tiny shared glue: header search → search.html on Enter,
// ⌘K / Ctrl-K focuses the header search.
(function () {
  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      var input = document.querySelector(".app-header .search input")
                || document.querySelector(".hero-search input")
                || document.querySelector(".qbar-input input");
      if (input) { input.focus(); input.select(); }
    }
  });

  document.querySelectorAll(".app-header .search input, .hero-search input").forEach(function (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var q = encodeURIComponent(input.value || "");
        window.location.href = "search.html" + (q ? "?q=" + q : "");
      }
    });
  });
})();
