(() => {
  "use strict";

  const dvd = new Image();
  dvd.src = "assets/dot.png";

  let x = 0;
  let y = 0;
  let vx = 500;
  let vy = 360;
  let lastTime = performance.now();

  const MAX_STEP = 1 / 120;
  const EPSILON = 0.5;

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const activeCollisions = new Set();

  const invertedElements = new WeakSet();

  const originalFilters = new WeakMap();

  document.body.style.margin = "0";

  dvd.style.position = "fixed";
  dvd.style.left = "0px";
  dvd.style.top = "0px";
  dvd.style.display = "block";
  dvd.style.margin = "0";
  dvd.style.padding = "0";
  dvd.style.pointerEvents = "auto";
  dvd.style.mixBlendMode = "difference";
  dvd.style.cursor = "grab";
  dvd.style.userSelect = "none";

  document.body.appendChild(dvd);

  function dvdRect() {
    return {
      left: x,
      right: x + dvd.naturalWidth,
      top: y,
      bottom: y + dvd.naturalHeight
    };
  }

  function overlaps(a, b) {
    return (
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top
    );
  }

  function toggleInvert(element) {
    if (!element || element === dvd) {
      return;
    }

    if (
      element === document.documentElement ||
      element === document.body
    ) {
      return;
    }

    if (!originalFilters.has(element)) {
      originalFilters.set(
        element,
        getComputedStyle(element).filter
      );
    }

    if (invertedElements.has(element)) {
      element.style.filter =
        originalFilters.get(element);

      invertedElements.delete(element);
    } else {
      const original =
        originalFilters.get(element);

      if (original && original !== "none") {
        element.style.filter =
          `invert(1) ${original}`;
      } else {
        element.style.filter = "invert(1)";
      }

      invertedElements.add(element);
    }
  }

  function getTextRects(root) {
    const result = [];

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT
    );

    let node;

    while ((node = walker.nextNode())) {
      const text = node.nodeValue;

      if (!text || !text.trim()) {
        continue;
      }

      for (let i = 0; i < text.length; i++) {
        if (/\s/.test(text[i])) {
          continue;
        }

        const range = document.createRange();

        try {
          range.setStart(node, i);
          range.setEnd(node, i + 1);

          const rects = range.getClientRects();

          for (const rect of rects) {
            if (rect.width > 0 && rect.height > 0) {
              result.push({
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom
              });
            }
          }
        } catch {}

        range.detach?.();
      }
    }

    return result;
  }

  function collectColliders() {
    const colliders = [];
    const elements = document.body.querySelectorAll("*");

    for (const element of elements) {
      if (element === dvd) {
        continue;
      }

      const tag = element.tagName.toLowerCase();
      const style = getComputedStyle(element);

      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.pointerEvents === "none"
      ) {
        continue;
      }

      if (
        tag === "script" ||
        tag === "style" ||
        tag === "noscript"
      ) {
        continue;
      }

      if (element instanceof HTMLImageElement) {
        const rect = element.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
          colliders.push({
            element,
            rect
          });
        }

        continue;
      }

      const background = style.backgroundColor;

      const border =
        style.borderTopStyle !== "none" ||
        style.borderRightStyle !== "none" ||
        style.borderBottomStyle !== "none" ||
        style.borderLeftStyle !== "none";

      const hasBackground =
        background &&
        background !== "transparent" &&
        !background.endsWith(", 0)");

      const solidElement =
        border ||
        hasBackground ||
        tag === "button" ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        tag === "video" ||
        tag === "canvas" ||
        tag === "iframe";

      if (solidElement) {
        const rect = element.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
          colliders.push({
            element,
            rect
          });
        }
      }

      if (
        element.childNodes.length > 0 &&
        element.textContent &&
        element.textContent.trim()
      ) {
        const textRects = getTextRects(element);

        for (const rect of textRects) {
          colliders.push({
            element,
            rect
          });
        }
      }
    }

    return colliders;
  }

  function collideWith(rect) {
    const box = dvdRect();

    if (!overlaps(box, rect)) {
      return false;
    }

    const penetrationLeft =
      box.right - rect.left;

    const penetrationRight =
      rect.right - box.left;

    const penetrationTop =
      box.bottom - rect.top;

    const penetrationBottom =
      rect.bottom - box.top;

    const horizontal =
      Math.min(
        penetrationLeft,
        penetrationRight
      );

    const vertical =
      Math.min(
        penetrationTop,
        penetrationBottom
      );

    if (horizontal < vertical && vx !== 0) {
      if (box.left < rect.left) {
        x =
          rect.left -
          dvd.naturalWidth -
          EPSILON;

        vx = -Math.abs(vx);
      } else {
        x =
          rect.right +
          EPSILON;

        vx = Math.abs(vx);
      }

      return true;
    }

    if (box.top < rect.top) {
      y =
        rect.top -
        dvd.naturalHeight -
        EPSILON;

      vy = -Math.abs(vy);
    } else {
      y =
        rect.bottom +
        EPSILON;

      vy = Math.abs(vy);
    }

    return true;
  }

  function collideWithViewport() {
    const width = dvd.naturalWidth;
    const height = dvd.naturalHeight;

    if (x <= 0) {
      x = 0;
      vx = Math.abs(vx);
    }

    if (x + width >= window.innerWidth) {
      x = window.innerWidth - width;
      vx = -Math.abs(vx);
    }

    if (y <= 0) {
      y = 0;
      vy = Math.abs(vy);
    }

    if (y + height >= window.innerHeight) {
      y = window.innerHeight - height;
      vy = -Math.abs(vy);
    }
  }

  function physicsStep(dt) {
    if (isDragging) {
      return;
    }

    x += vx * dt;
    y += vy * dt;

    collideWithViewport();

    const colliders = collectColliders();

    const touchedThisStep = new Set();

    for (const collider of colliders) {
      if (collideWith(collider.rect)) {
        touchedThisStep.add(collider.element);
      }
    }
    for (const element of touchedThisStep) {
      if (!activeCollisions.has(element)) {
        toggleInvert(element);
      }
    }

    for (const element of activeCollisions) {
      if (!touchedThisStep.has(element)) {
        activeCollisions.delete(element);
      }
    }

    for (const element of touchedThisStep) {
      activeCollisions.add(element);
    }

    collideWithViewport();
  }

  function update(now) {
    const elapsed =
      Math.min(
        (now - lastTime) / 1000,
        0.05
      );

    lastTime = now;

    if (!isDragging) {
      let remaining = elapsed;

      while (remaining > 0) {
        const step =
          Math.min(
            remaining,
            MAX_STEP
          );

        physicsStep(step);
        remaining -= step;
      }
    }

    dvd.style.left = `${x}px`;
    dvd.style.top = `${y}px`;

    requestAnimationFrame(update);
  }

  dvd.addEventListener("pointerdown", (event) => {
    event.preventDefault();

    isDragging = true;

    dvd.style.cursor = "grabbing";

    dragOffsetX = event.clientX - x;
    dragOffsetY = event.clientY - y;

    activeCollisions.clear();

    dvd.setPointerCapture(event.pointerId);
  });

  dvd.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    event.preventDefault();

    x = event.clientX - dragOffsetX;
    y = event.clientY - dragOffsetY;

    const width = dvd.naturalWidth;
    const height = dvd.naturalHeight;

    x = Math.max(
      0,
      Math.min(
        x,
        window.innerWidth - width
      )
    );

    y = Math.max(
      0,
      Math.min(
        y,
        window.innerHeight - height
      )
    );

    dvd.style.left = `${x}px`;
    dvd.style.top = `${y}px`;
  });

  function stopDragging(event) {
    if (!isDragging) {
      return;
    }

    isDragging = false;

    dvd.style.cursor = "grab";

    if (
      event &&
      dvd.hasPointerCapture(event.pointerId)
    ) {
      dvd.releasePointerCapture(event.pointerId);
    }

    activeCollisions.clear();

    lastTime = performance.now();
  }

  dvd.addEventListener(
    "pointerup",
    stopDragging
  );

  dvd.addEventListener(
    "pointercancel",
    stopDragging
  );


  dvd.addEventListener("load", () => {
    x =
      Math.max(
        0,
        (window.innerWidth - dvd.naturalWidth) / 2
      );

    y =
      Math.max(
        0,
        (window.innerHeight - dvd.naturalHeight) / 2
      );

    lastTime = performance.now();

    requestAnimationFrame(update);
  });

  window.addEventListener("resize", () => {
    const width = dvd.naturalWidth;
    const height = dvd.naturalHeight;

    x = Math.max(
      0,
      Math.min(
        x,
        window.innerWidth - width
      )
    );

    y = Math.max(
      0,
      Math.min(
        y,
        window.innerHeight - height
      )
    );
  });
})();