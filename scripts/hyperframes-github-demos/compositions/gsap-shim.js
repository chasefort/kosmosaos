(function () {
  function parseTargets(targets) {
    if (typeof targets === "string") return Array.from(document.querySelectorAll(targets));
    if (targets instanceof Element) return [targets];
    return Array.from(targets || []);
  }

  function numeric(value, fallback = 0) {
    if (typeof value === "number") return value;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function readState(el) {
    return {
      opacity: numeric(el.style.opacity || getComputedStyle(el).opacity, 1),
      x: Number(el.dataset.timelineX || 0),
      y: Number(el.dataset.timelineY || 0),
      scale: Number(el.dataset.timelineScale || 1),
      width: el.style.width || getComputedStyle(el).width,
      borderColor: el.style.borderColor || getComputedStyle(el).borderColor,
      innerText: numeric(el.innerText, 0),
    };
  }

  function applyState(el, state) {
    if (state.opacity !== undefined) el.style.opacity = state.opacity;
    if (state.width !== undefined) el.style.width = typeof state.width === "number" ? `${state.width}px` : state.width;
    if (state.borderColor !== undefined) el.style.borderColor = state.borderColor;
    if (state.className !== undefined) el.className = state.className;
    if (state.innerText !== undefined) el.innerText = Math.round(state.innerText);

    const x = state.x !== undefined ? state.x : Number(el.dataset.timelineX || 0);
    const y = state.y !== undefined ? state.y : Number(el.dataset.timelineY || 0);
    const scale = state.scale !== undefined ? state.scale : Number(el.dataset.timelineScale || 1);
    el.dataset.timelineX = x;
    el.dataset.timelineY = y;
    el.dataset.timelineScale = scale;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  function interpolate(from, to, p) {
    const state = {};
    for (const key of Object.keys(to)) {
      if (key === "duration" || key === "stagger" || key === "ease" || key === "snap" || key === "repeat" || key === "yoyo") continue;
      if (key === "className") {
        if (p >= 1) state.className = to[key];
        continue;
      }
      if (key === "borderColor") {
        if (p >= 1) state.borderColor = to[key];
        continue;
      }
      if (key === "width") {
        const end = to[key];
        if (typeof end === "string" && end.endsWith("%")) {
          state.width = `${numeric(from[key], 0) + (numeric(end, 0) - numeric(from[key], 0)) * p}%`;
        } else {
          state.width = numeric(from[key], 0) + (numeric(end, 0) - numeric(from[key], 0)) * p;
        }
        continue;
      }
      state[key] = numeric(from[key], 0) + (numeric(to[key], 0) - numeric(from[key], 0)) * p;
    }
    return state;
  }

  function Timeline() {
    this.tweens = [];
  }

  Timeline.prototype._add = function (mode, targets, vars, at) {
    const elements = parseTargets(targets);
    const start = typeof at === "number" ? at : 0;
    const stagger = numeric(vars.stagger, 0);
    for (const [index, el] of elements.entries()) {
      const current = readState(el);
      const fromState = mode === "from" ? { ...current, ...vars } : current;
      const toState = mode === "from" ? current : { ...current, ...vars };
      if (mode === "from") applyState(el, fromState);
      this.tweens.push({
        el,
        from: fromState,
        to: toState,
        start: start + stagger * index,
        duration: numeric(vars.duration, 0.001),
      });
    }
    return this;
  };

  Timeline.prototype.to = function (targets, vars, at) {
    return this._add("to", targets, vars, at);
  };

  Timeline.prototype.from = function (targets, vars, at) {
    return this._add("from", targets, vars, at);
  };

  Timeline.prototype.fromTo = function (targets, fromVars, toVars, at) {
    const elements = parseTargets(targets);
    const start = typeof at === "number" ? at : 0;
    for (const el of elements) {
      const current = readState(el);
      const fromState = { ...current, ...fromVars };
      const toState = { ...current, ...toVars };
      applyState(el, fromState);
      this.tweens.push({ el, from: fromState, to: toState, start, duration: numeric(toVars.duration, 0.001) });
    }
    return this;
  };

  Timeline.prototype.time = function (seconds) {
    for (const tween of this.tweens) {
      if (seconds < tween.start) continue;
      const p = Math.max(0, Math.min(1, (seconds - tween.start) / tween.duration));
      applyState(tween.el, interpolate(tween.from, tween.to, p));
    }
  };

  window.gsap = {
    timeline() {
      return new Timeline();
    },
  };
})();
