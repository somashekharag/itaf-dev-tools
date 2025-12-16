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

  /**
   * Builds XPath-safe string literal.
   * Handles:
   *  - single quote
   *  - double quote
   *  - both (via concat)
   */
  function xpathLiteral(value) {
    if (value.indexOf("'") === -1) {
      return "'" + value + "'";
    }

    if (value.indexOf('"') === -1) {
      return '"' + value + '"';
    }

    // Contains both ' and "
    const parts = value.split("'");
    return "concat(" +
      parts.map((part, i) =>
        "'" + part + "'" + (i < parts.length - 1 ? ", \"'\", " : "")
      ).join("") +
      ")";
  }

  /* ============================
     EVENT HANDLERS
     ============================ */

  window.__itafMouseOver = function (e) {
    if (!window.__itafCaptureEnabled) return;

    if (lastHighlighted) {
      lastHighlighted.style.outline = "";
    }

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

    // Block click ONLY when capture is enabled
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const el = e.target;

    /* ============================
       XPATH GENERATION (STRUCTURAL)
       ============================ */
    function getXPath(el) {
      if (el.id) {
        return `//*[@id=${xpathLiteral(el.id)}]`;
      }

      if (el === document.body) {
        return "/html/body";
      }

      let ix = 0;
      const siblings = el.parentNode.childNodes;

      for (let i = 0; i < siblings.length; i++) {
        const sib = siblings[i];
        if (sib === el) {
          return getXPath(el.parentNode) + "/" +
                 el.tagName.toLowerCase() + "[" + (ix + 1) + "]";
        }
        if (sib.nodeType === 1 && sib.tagName === el.tagName) {
          ix++;
        }
      }
    }

    /* ============================
       ATTRIBUTE CAPTURE (FILTERED)
       ============================ */
    const attrs = {};

    for (let a of el.attributes) {
      const value = a.value;

      // ❌ Skip multiline attributes
      if (isMultiline(value)) continue;

      // ❌ Skip long / unstable values
      if (isLongText(value)) continue;

      attrs[a.name] = value;
    }

    /* ============================
       TEXT-BASED XPATH (SAFE ONLY)
       ============================ */
    const rawText = el.innerText || "";
    let textBasedXPath = null;
    let safeText = null;

    if (!isMultiline(rawText) && !isLongText(rawText)) {
      safeText = normalizeText(rawText);
      if (safeText) {
        textBasedXPath =
          `//*[normalize-space(.)=${xpathLiteral(safeText)}]`;
      }
    }

    /* ============================
       FINAL PAYLOAD
       ============================ */
    window.__lastCapturedElement = {
      tag: el.tagName.toLowerCase(),
      text: safeText,                  // null if unsafe
      attributes: attrs,               // filtered
      structuralXpath: getXPath(el),   // always present
      textXpath: textBasedXPath        // null if unsafe
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
