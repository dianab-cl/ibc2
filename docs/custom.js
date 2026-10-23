/* Nav highlight accent, one per section.

   Each tab gets its own Cosmos brand hue (Brand Refresh Aug 2026), so the
   highlight colour tells you which part of the site you are in. The ink
   colour paired with each is the one that wins on contrast against it,
   computed from WCAG relative luminance rather than picked by eye:

     Learn          blue     #40B3FF  on #0E0E0E   8.37:1
     IBC CLI        green    #22E2A8  on #0E0E0E  11.50:1
     IBC-Solidity   purple   #7522B5  on #FFFFFF   7.92:1
     IBC-Go         indigo   #4B47CA  on #FFFFFF   6.88:1
     Specification  orange   #EF5628  on #0E0E0E   5.54:1

   Magenta #E644F8 is the sixth family, left spare for a future section.

   Order matters: the list is matched top-down and /ibc/spec/ and
   /ibc/05-ibc-cli/ both sit under /ibc/, so the specific prefixes have to be
   tested before the Learn catch-all. */
(function () {
  var SECTIONS = [
    ["/ibc-go/",                  "#4b47ca", "#ffffff"], // IBC-Go
    ["/ibc/spec/",                "#ef5628", "#0e0e0e"], // Specification
    ["/ibc/05-ibc-cli/",             "#22e2a8", "#0e0e0e"], // IBC CLI
    ["/ibc/06-ibc-solidity-contracts/", "#7522b5", "#ffffff"], // IBC-Solidity
  ];
  var LEARN = ["#40b3ff", "#0e0e0e"]; // Learn, and the landing page

  function pick(path) {
    for (var i = 0; i < SECTIONS.length; i++) {
      if (path.indexOf(SECTIONS[i][0]) === 0) {
        return [SECTIONS[i][1], SECTIONS[i][2]];
      }
    }
    return LEARN;
  }

  function apply() {
    var p = pick(location.pathname);
    var root = document.documentElement;
    root.style.setProperty("--nav-accent", p[0]);
    root.style.setProperty("--nav-accent-ink", p[1]);
  }

  apply();

  // Mintlify routes client-side, so re-apply when the path changes.
  var last = location.pathname;
  ["pushState", "replaceState"].forEach(function (m) {
    var orig = history[m];
    history[m] = function () {
      orig.apply(this, arguments);
      if (location.pathname !== last) { last = location.pathname; apply(); }
    };
  });
  window.addEventListener("popstate", function () {
    if (location.pathname !== last) { last = location.pathname; apply(); }
  });
})();
