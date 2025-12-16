(function () {

  /* ============================
     INSTALL GUARD
     ============================ */
  if (window.__itafInstalled) return;
  window.__itafInstalled = true;

  /* ============================
     GLOBAL STATE
     ============================ */
  window.__itafCaptureEnabled = false;
  window.__lastCapturedElement = null;
  window.__itafElementUpdated = false;

  let lastHighlighted = null;
  let listenersAttached = false;

  /* ============================
     HELPER FUNCTIONS
     ============================ */

  function isMultiline(value) {
    return value && /[\r\n]/.test(value);
  }

  function isLongText(value, maxLength = 50) {
    return value && value.length > maxLength;
  }

  function normalizeText(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function xpathLiteral(value) {
    if (value.indexOf("'") === -1) return "'" + value + "'";
    if (value.indexOf('"') === -1) return '"' + value + '"';

    const parts = value.split("'");
    return "concat(" +
      parts.map((p, i) =>
        "'" + p + "'" + (i < parts.length - 1 ? ", \"'\", " : "")
      ).join("") +
      ")";
  }

  /* ============================
     CSS SELECTOR BUILDER
     ============================ */
  function buildCssSelector(el) {

    if (el.id) {
      return "#" + CSS.escape(el.id);
    }

    // Prefer stable data-* attributes
    for (let attr of el.attributes) {
      if (!attr.name.startsWith("data-")) continue;
      if (isMultiline(attr.value) || isLongText(attr.value)) continue;

      return `${el.tagName.toLowerCase()}[${attr.name}="${CSS.escape(attr.value)}"]`;
    }

    // Fallback: path-based CSS
    let path = [];
    let current = el;

    while (current && current.nodeType === 1 && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      const siblings = Array.from(current.parentNode.children)
        .filter(e => e.tagName === current.tagName);

      if (siblings.length > 1) {
        selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }

      path.unshift(selector);
      current = current.parentNode;
    }

    return path.join(" > ");
  }

  /* ============================
     EVENT HANDLERS
     ============================ */

  window.__itafMouseOver = function (e) {
    if (!window.__itafCaptureEnabled) return;

    if (lastHighlighted) lastHighlighted.style.outline = "";
    lastHighlighted = e.target;
    e.target.style.outline = "2px solid red";
  };

  window.__itafMouseOut = function (e) {
    if (!window.__itafCaptureEnabled) return;
    if (e.target === lastHighlighted) {
      e.target.style.outline = "";
      lastHighlighted = null;
    }
  };

  window.__itafClickHandler = function (e) {
    if (!window.__itafCaptureEnabled) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const el = e.target;

    /* ============================
       BASIC LOCATORS
       ============================ */
    const tag = el.tagName.toLowerCase();

    const id = el.id || null;
    const name = el.getAttribute("name") || null;

    /* ============================
       CLASS NAME
       ============================ */
    let className = null;
    if (el.className && typeof el.className === "string") {
      const classes = el.className.trim().split(/\s+/);
      if (classes.length === 1) {
        className = classes[0];
      }
    }

    /* ============================
       DATA-* ATTRIBUTES
       ============================ */
    const dataAttributes = {};
    for (let a of el.attributes) {
      if (!a.name.startsWith("data-")) continue;
      if (isMultiline(a.value) || isLongText(a.value)) continue;
      dataAttributes[a.name] = a.value;
    }

    /* ============================
       LINK TEXT LOCATORS
       ============================ */
    let linkText = null;
    let partialLinkText = null;

    if (tag === "a") {
      const text = normalizeText(el.innerText || "");
      if (text && !isLongText(text)) {
        linkText = text;
        partialLinkText = text.length > 15
          ? text.substring(0, 15)
          : text;
      }
    }

    /* ============================
       STRUCTURAL XPATH
       ============================ */
    function getXPath(node) {
      if (node.id) {
        return `//*[@id=${xpathLiteral(node.id)}]`;
      }
      if (node === document.body) return "/html/body";

      let ix = 0;
      const siblings = node.parentNode.childNodes;
      for (let i = 0; i < siblings.length; i++) {
        const sib = siblings[i];
        if (sib === node) {
          return getXPath(node.parentNode) + "/" +
            node.tagName.toLowerCase() + "[" + (ix + 1) + "]";
        }
        if (sib.nodeType === 1 && sib.tagName === node.tagName) ix++;
      }
    }

    const xpath = getXPath(el);

    /* ============================
       FINAL PAYLOAD
       ============================ */
    window.__lastCapturedElement = {
      tag,

      id,
      name,
      className,

      dataAttributes,

      cssSelector: buildCssSelector(el),
      xpath,

      linkText,
      partialLinkText
    };

    window.__itafElementUpdated = true;
  };

  /* ============================
     LISTENER MANAGEMENT
     ============================ */
  function attachListeners() {
    if (listenersAttached) return;

    document.addEventListener("mouseover", window.__itafMouseOver, true);
    document.addEventListener("mouseout", window.__itafMouseOut, true);
    document.addEventListener("click", window.__itafClickHandler, true);

    listenersAttached = true;
  }

  function detachListeners() {
    if (!listenersAttached) return;

    document.removeEventListener("mouseover", window.__itafMouseOver, true);
    document.removeEventListener("mouseout", window.__itafMouseOut, true);
    document.removeEventListener("click", window.__itafClickHandler, true);

    listenersAttached = false;
  }

  /* ============================
     ENABLE / DISABLE API
     ============================ */
  window.__itafEnableCapture = function () {
    window.__itafCaptureEnabled = true;
    attachListeners();
  };

  window.__itafDisableCapture = function () {
    window.__itafCaptureEnabled = false;
    detachListeners();

    if (lastHighlighted) {
      lastHighlighted.style.outline = "";
      lastHighlighted = null;
    }
  };

})();
