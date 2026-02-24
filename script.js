const SCENARIO_FACTORS = {
  base: 1,
  conservative: 0.86,
  aggressive: 1.18,
};

const SCENARIO_LABELS = {
  base: "Base case",
  conservative: "Conservative",
  aggressive: "Aggressive",
};

const DEFAULT_KPI_VALUES = [28, 43, 61];
const DEFAULT_SERIES_VALUES = [22, 38, 54, 71, 86];

const elements = {
  designInput: document.querySelector("#designInput"),
  generateBtn: document.querySelector("#generateBtn"),
  sampleBtn: document.querySelector("#sampleBtn"),
  uploadBtn: document.querySelector("#uploadBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  fileInput: document.querySelector("#fileInput"),
  deckTitle: document.querySelector("#deckTitle"),
  deckViewport: document.querySelector("#deckViewport"),
  slideCounter: document.querySelector("#slideCounter"),
  progressBar: document.querySelector("#progressBar"),
  slideNav: document.querySelector("#slideNav"),
  prevBtn: document.querySelector("#prevBtn"),
  playBtn: document.querySelector("#playBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  slideTemplate: document.querySelector("#slideTemplate"),
  scenarioButtons: document.querySelectorAll(".scenario-btn"),
};

const state = {
  deck: null,
  activeSlideIndex: 0,
  scenario: "base",
  autoplayTimer: null,
};

const sampleInput = elements.designInput.value.trim();
elements.designInput.value = sampleInput;

initialize();

function initialize() {
  bindEvents();
  regenerateDeck(elements.designInput.value);
}

function bindEvents() {
  elements.generateBtn.addEventListener("click", () => {
    regenerateDeck(elements.designInput.value);
  });

  elements.sampleBtn.addEventListener("click", () => {
    elements.designInput.value = sampleInput;
    regenerateDeck(sampleInput);
  });

  elements.uploadBtn.addEventListener("click", () => {
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }
    const text = await file.text();
    elements.designInput.value = text.trim();
    regenerateDeck(text);
    event.target.value = "";
  });

  elements.exportBtn.addEventListener("click", () => {
    if (!state.deck) {
      return;
    }
    const payload = JSON.stringify(state.deck, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    triggerDownload(`katalyze-deck-${timestamp}.json`, payload, "application/json");
  });

  elements.prevBtn.addEventListener("click", () => stepSlide(-1));
  elements.nextBtn.addEventListener("click", () => stepSlide(1));
  elements.playBtn.addEventListener("click", toggleAutoplay);

  elements.scenarioButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.scenario === state.scenario) {
        return;
      }
      state.scenario = button.dataset.scenario;
      state.activeSlideIndex = clamp(
        state.activeSlideIndex,
        0,
        Math.max((state.deck?.slides.length || 1) - 1, 0),
      );
      renderDeck();
      syncScenarioButtons();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLElement) {
      if (event.target.tagName === "TEXTAREA" || event.target.tagName === "INPUT") {
        return;
      }
    }

    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      stepSlide(1);
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      stepSlide(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveSlide(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveSlide(Math.max(state.deck.slides.length - 1, 0));
    } else if (event.key === " ") {
      event.preventDefault();
      stepSlide(event.shiftKey ? -1 : 1);
    }
  });
}

function regenerateDeck(rawInput) {
  try {
    const parsedDeck = parseRawDesign(rawInput);
    state.deck = parsedDeck;
    state.activeSlideIndex = 0;
    renderDeck();
  } catch (error) {
    console.error(error);
    window.alert(`Could not parse input. ${error.message}`);
  }
}

function renderDeck() {
  if (!state.deck) {
    return;
  }
  const { deckViewport, slideTemplate } = elements;
  deckViewport.innerHTML = "";

  const factor = SCENARIO_FACTORS[state.scenario] || 1;
  const fragment = document.createDocumentFragment();

  state.deck.slides.forEach((slideData, index) => {
    const slideNode = slideTemplate.content.firstElementChild.cloneNode(true);
    slideNode.dataset.slideIndex = String(index);

    const revealNodes = slideNode.querySelectorAll(".reveal");
    revealNodes.forEach((node) => {
      const delay = node.getAttribute("data-delay");
      if (delay) {
        node.style.setProperty("--delay", `${delay}s`);
      }
    });

    const titleEl = slideNode.querySelector(".slide-title");
    const indexEl = slideNode.querySelector(".slide-index");
    const narrativeEl = slideNode.querySelector(".slide-narrative");
    titleEl.textContent = slideData.title;
    indexEl.textContent = `Slide ${index + 1} • ${state.deck.client}`;
    narrativeEl.textContent = slideData.narrative;

    const bulletList = slideNode.querySelector(".bullet-list");
    bulletList.innerHTML = "";
    slideData.bullets.forEach((bullet) => {
      const item = document.createElement("li");
      item.textContent = bullet;
      bulletList.appendChild(item);
    });

    const flowWrap = slideNode.querySelector(".flow-wrapper");
    flowWrap.appendChild(buildFlowSvg(slideData.flow, index));

    const kpiGrid = slideNode.querySelector(".kpi-grid");
    slideData.kpis.forEach((kpi, kpiIndex) => {
      const card = document.createElement("article");
      card.className = "kpi-card";

      const label = document.createElement("p");
      label.className = "kpi-label";
      label.textContent = kpi.label;

      const targetValue = Math.max(1, Math.round(kpi.value * factor));
      const value = document.createElement("p");
      value.className = "kpi-value";
      value.textContent = `0${kpi.suffix}`;
      value.dataset.target = String(targetValue);
      value.dataset.suffix = kpi.suffix;
      value.dataset.delay = String(kpiIndex * 120);

      const subline = document.createElement("p");
      subline.className = "kpi-subline";
      subline.textContent = `${SCENARIO_LABELS[state.scenario]} projection`;

      card.append(label, value, subline);
      kpiGrid.appendChild(card);
    });

    const chartShell = slideNode.querySelector(".chart-shell");
    chartShell.replaceChildren(buildSeriesChart(slideData.series, factor));

    fragment.appendChild(slideNode);
  });

  deckViewport.appendChild(fragment);

  renderSlideNavigation();
  syncScenarioButtons();
  setActiveSlide(clamp(state.activeSlideIndex, 0, state.deck.slides.length - 1));
}

function renderSlideNavigation() {
  elements.slideNav.innerHTML = "";
  state.deck.slides.forEach((slide, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slide-nav-btn";
    button.dataset.slideTarget = String(index);
    button.textContent = slide.title;
    button.addEventListener("click", () => setActiveSlide(index));
    elements.slideNav.appendChild(button);
  });
}

function setActiveSlide(index) {
  if (!state.deck) {
    return;
  }

  const slides = elements.deckViewport.querySelectorAll(".slide");
  if (!slides.length) {
    return;
  }

  const nextIndex = clamp(index, 0, slides.length - 1);
  state.activeSlideIndex = nextIndex;

  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === nextIndex);
  });

  const navButtons = elements.slideNav.querySelectorAll(".slide-nav-btn");
  navButtons.forEach((button, navIndex) => {
    button.classList.toggle("is-active", navIndex === nextIndex);
  });

  const activeSlide = state.deck.slides[nextIndex];
  elements.deckTitle.textContent = `${state.deck.title} • ${activeSlide.title}`;
  elements.slideCounter.textContent = `Slide ${nextIndex + 1} / ${state.deck.slides.length}`;
  elements.progressBar.style.width = `${((nextIndex + 1) / state.deck.slides.length) * 100}%`;

  animateKpis();
}

function stepSlide(direction) {
  if (!state.deck) {
    return;
  }
  const total = state.deck.slides.length;
  const next = (state.activeSlideIndex + direction + total) % total;
  setActiveSlide(next);
}

function toggleAutoplay() {
  if (state.autoplayTimer) {
    stopAutoplay();
    return;
  }
  state.autoplayTimer = window.setInterval(() => {
    stepSlide(1);
  }, 5500);
  elements.playBtn.textContent = "⏸";
  elements.playBtn.classList.add("is-active");
  elements.playBtn.setAttribute("aria-label", "Pause autoplay");
}

function stopAutoplay() {
  if (!state.autoplayTimer) {
    return;
  }
  window.clearInterval(state.autoplayTimer);
  state.autoplayTimer = null;
  elements.playBtn.textContent = "▶";
  elements.playBtn.classList.remove("is-active");
  elements.playBtn.setAttribute("aria-label", "Start autoplay");
}

function syncScenarioButtons() {
  elements.scenarioButtons.forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.scenario === state.scenario);
  });
}

function animateKpis() {
  const activeSlide = elements.deckViewport.querySelector(".slide.is-active");
  if (!activeSlide) {
    return;
  }

  const values = activeSlide.querySelectorAll(".kpi-value");
  values.forEach((valueNode) => {
    const target = Number(valueNode.dataset.target);
    const suffix = valueNode.dataset.suffix || "";
    const delay = Number(valueNode.dataset.delay) || 0;
    animateNumber(valueNode, target, suffix, delay);
  });
}

function animateNumber(element, target, suffix, delay) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.textContent = `${target}${suffix}`;
    return;
  }

  const duration = 820;
  const startTime = performance.now() + delay;

  function tick(now) {
    if (now < startTime) {
      requestAnimationFrame(tick);
      return;
    }
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = `${Math.round(target * eased)}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

function buildSeriesChart(series, factor) {
  const values = series.map((point) => Math.max(1, Math.round(point.value * factor)));
  const maxValue = Math.max(...values, 10);
  const stage = document.createElement("div");
  stage.className = "chart-stage";

  const grid = document.createElement("div");
  grid.className = "chart-grid";
  grid.innerHTML = "<span></span><span></span><span></span><span></span>";
  stage.appendChild(grid);

  const barRow = document.createElement("div");
  barRow.className = "bar-row";
  barRow.style.gridTemplateColumns = `repeat(${values.length}, minmax(0, 1fr))`;

  values.forEach((value) => {
    const barItem = document.createElement("div");
    barItem.className = "bar-item";

    const valueTag = document.createElement("p");
    valueTag.className = "bar-value";
    valueTag.textContent = String(value);

    const rail = document.createElement("div");
    rail.className = "bar-rail";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.setProperty("--bar-height", `${(value / maxValue) * 100}%`);

    rail.appendChild(fill);
    barItem.append(valueTag, rail);
    barRow.appendChild(barItem);
  });

  stage.appendChild(barRow);

  const lineSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  lineSvg.setAttribute("viewBox", "0 0 100 100");
  lineSvg.setAttribute("preserveAspectRatio", "none");
  lineSvg.classList.add("chart-line-svg");

  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
      const y = 98 - (value / maxValue) * 88;
      return { x, y };
    })
    .filter(Boolean);

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.classList.add("trend-line");
  polyline.setAttribute(
    "points",
    points.map((point) => `${point.x},${point.y}`).join(" "),
  );
  lineSvg.appendChild(polyline);

  points.forEach((point, index) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.classList.add("trend-dot");
    circle.setAttribute("cx", String(point.x));
    circle.setAttribute("cy", String(point.y));
    circle.setAttribute("r", "1.8");
    circle.style.animationDelay = `${0.58 + index * 0.07}s`;
    lineSvg.appendChild(circle);
  });

  stage.appendChild(lineSvg);

  const labels = document.createElement("ul");
  labels.className = "chart-label-row";
  labels.style.gridTemplateColumns = `repeat(${series.length}, minmax(0, 1fr))`;
  series.forEach((point) => {
    const item = document.createElement("li");
    item.textContent = point.label;
    labels.appendChild(item);
  });

  const wrapper = document.createDocumentFragment();
  wrapper.append(stage, labels);
  return wrapper;
}

function buildFlowSvg(flowEdges, indexSeed) {
  const edges = normalizeFlowEdges(flowEdges);
  const nodeNames = [...new Set(edges.flatMap((edge) => [edge.from, edge.to]))];

  const width = 900;
  const height = 240;
  const nodeWidth = 170;
  const nodeHeight = 44;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "flow-map");
  svg.setAttribute("aria-label", "Operational flow diagram");

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", `arrow-${indexSeed}`);
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "8");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "4");
  marker.setAttribute("orient", "auto-start-reverse");
  const markerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  markerPath.setAttribute("d", "M0,0 L8,4 L0,8 Z");
  markerPath.setAttribute("fill", "#a78bff");
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const nodePositions = {};
  nodeNames.forEach((name, index) => {
    const x = ((index + 1) / (nodeNames.length + 1)) * width;
    const y = index % 2 === 0 ? 80 : 150;
    nodePositions[name] = { x, y };
  });

  edges.forEach((edge) => {
    const from = nodePositions[edge.from];
    const to = nodePositions[edge.to];
    if (!from || !to) {
      return;
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const controlX = (from.x + to.x) / 2;
    const pathData = `M ${from.x} ${from.y} C ${controlX} ${from.y}, ${controlX} ${to.y}, ${to.x} ${to.y}`;
    path.setAttribute("d", pathData);
    path.setAttribute("class", "flow-edge");
    path.setAttribute("marker-end", `url(#arrow-${indexSeed})`);
    svg.appendChild(path);
  });

  nodeNames.forEach((name) => {
    const { x, y } = nodePositions[name];
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(x - nodeWidth / 2));
    rect.setAttribute("y", String(y - nodeHeight / 2));
    rect.setAttribute("width", String(nodeWidth));
    rect.setAttribute("height", String(nodeHeight));
    rect.setAttribute("class", "flow-node");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y));
    text.setAttribute("class", "flow-node-label");
    text.textContent = shortenLabel(name, 18);

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = name;
    group.append(rect, text, title);
    svg.appendChild(group);
  });

  return svg;
}

function normalizeFlowEdges(flowEdges) {
  const edges = (flowEdges || [])
    .map((entry) => {
      if (typeof entry === "string") {
        return parseFlowEntry(entry);
      }
      if (entry && typeof entry === "object" && entry.from && entry.to) {
        return {
          from: String(entry.from).trim(),
          to: String(entry.to).trim(),
        };
      }
      return null;
    })
    .filter(Boolean);

  if (edges.length) {
    return edges;
  }

  return [
    { from: "Signals", to: "AI Core" },
    { from: "AI Core", to: "Decision Hub" },
    { from: "Decision Hub", to: "Execution Loop" },
  ];
}

function parseRawDesign(input) {
  const content = String(input || "").trim();
  if (!content) {
    throw new Error("Input is empty.");
  }

  if (looksLikeJson(content)) {
    try {
      const parsed = JSON.parse(content);
      return normalizeDeckFromJson(parsed);
    } catch (error) {
      throw new Error(`Invalid JSON format. ${error.message}`);
    }
  }

  return normalizeDeckFromDsl(content);
}

function looksLikeJson(content) {
  return content.startsWith("{") || content.startsWith("[");
}

function normalizeDeckFromJson(raw) {
  const asObject =
    Array.isArray(raw)
      ? {
          title: "Katalyze AI Presentation",
          subtitle: "Converted from JSON",
          client: "Katalyze AI",
          slides: raw,
        }
      : raw;

  const deck = {
    title: asObject.title || "Katalyze AI Presentation",
    subtitle: asObject.subtitle || "Executive intelligence narrative",
    client: asObject.client || "Katalyze AI",
    slides: [],
  };

  const incomingSlides = Array.isArray(asObject.slides) ? asObject.slides : [];
  deck.slides = incomingSlides.map((slide, index) => {
    const normalized = {
      title: String(slide.title || slide.heading || `Slide ${index + 1}`),
      narrative: String(slide.narrative || slide.summary || ""),
      bullets: normalizeBullets(slide.bullets || slide.points),
      kpis: normalizeKpis(slide.kpis || slide.metrics),
      series: normalizeSeries(slide.series || slide.chart || slide.trajectory),
      flow: normalizeFlowFromUnknown(slide.flow || slide.connections),
    };
    return finalizeSlide(normalized, index);
  });

  if (!deck.slides.length) {
    deck.slides = [finalizeSlide({}, 0)];
  }

  return deck;
}

function normalizeDeckFromDsl(content) {
  const deck = {
    title: "Katalyze AI Presentation",
    subtitle: "From raw design to web narrative",
    client: "Katalyze AI",
    slides: [],
  };

  const lines = content.split(/\r?\n/);
  let currentSlide = null;
  let activeSection = null;

  function ensureSlide() {
    if (!currentSlide) {
      currentSlide = {
        title: `Slide ${deck.slides.length + 1}`,
        narrative: "",
        bullets: [],
        kpis: [],
        series: [],
        flow: [],
      };
    }
  }

  function pushSlide() {
    if (!currentSlide) {
      return;
    }
    deck.slides.push(finalizeSlide(currentSlide, deck.slides.length));
    currentSlide = null;
    activeSection = null;
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    if (line === "---") {
      pushSlide();
      return;
    }

    const keyMatch = line.match(/^([A-Z_]+)\s*:\s*(.*)$/);
    if (keyMatch) {
      const key = keyMatch[1].toUpperCase();
      const value = keyMatch[2].trim();

      if (key === "TITLE") {
        deck.title = value || deck.title;
        return;
      }
      if (key === "SUBTITLE") {
        deck.subtitle = value || deck.subtitle;
        return;
      }
      if (key === "CLIENT") {
        deck.client = value || deck.client;
        return;
      }

      if (key === "SLIDE") {
        pushSlide();
        ensureSlide();
        currentSlide.title = value || currentSlide.title;
        return;
      }

      if (key === "NARRATIVE") {
        ensureSlide();
        currentSlide.narrative = value;
        activeSection = null;
        return;
      }

      if (key === "BULLETS" || key === "KPIS" || key === "SERIES" || key === "FLOW") {
        ensureSlide();
        activeSection = key;
        if (!value) {
          return;
        }
        appendSectionValue(currentSlide, activeSection, value);
        return;
      }
    }

    if (line.startsWith("-")) {
      ensureSlide();
      const item = line.replace(/^-+\s*/, "");
      if (!activeSection) {
        currentSlide.bullets.push(item);
      } else {
        appendSectionValue(currentSlide, activeSection, item);
      }
      return;
    }

    ensureSlide();
    if (!currentSlide.narrative) {
      currentSlide.narrative = line;
    } else {
      currentSlide.bullets.push(line);
    }
  });

  pushSlide();

  if (!deck.slides.length) {
    deck.slides = [finalizeSlide({}, 0)];
  }

  return deck;
}

function appendSectionValue(slide, section, value) {
  if (section === "BULLETS") {
    slide.bullets.push(value);
    return;
  }
  if (section === "KPIS") {
    const parsed = parseKpiEntry(value);
    if (parsed) {
      slide.kpis.push(parsed);
    }
    return;
  }
  if (section === "SERIES") {
    const parsed = parseSeriesEntry(value);
    if (parsed) {
      slide.series.push(parsed);
    }
    return;
  }
  if (section === "FLOW") {
    const parsed = parseFlowEntry(value);
    if (parsed) {
      slide.flow.push(parsed);
    }
  }
}

function parseKpiEntry(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const split = text.split("|");
  const label = (split[0] || "Priority KPI").trim();
  const valueToken = split[1] || split[0];
  const parsed = parseNumericToken(valueToken);
  if (!parsed) {
    return null;
  }

  return {
    label,
    value: parsed.value,
    suffix: parsed.suffix || "%",
  };
}

function parseSeriesEntry(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  const split = text.split("|");
  const label = (split[0] || "Period").trim();
  const valueToken = split[1] || split[0];
  const parsed = parseNumericToken(valueToken);
  if (!parsed) {
    return null;
  }
  return {
    label,
    value: parsed.value,
  };
}

function parseFlowEntry(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  const [from, to] = text.split("->").map((part) => (part || "").trim());
  if (!from || !to) {
    return null;
  }
  return { from, to };
}

function parseNumericToken(token) {
  const text = String(token || "").trim();
  const numericMatch = text.match(/-?\d+(\.\d+)?/);
  if (!numericMatch) {
    return null;
  }
  const value = Number.parseFloat(numericMatch[0]);
  if (!Number.isFinite(value)) {
    return null;
  }

  let suffix = "%";
  if (text.includes("$")) {
    suffix = "M";
  } else if (/x/i.test(text)) {
    suffix = "x";
  } else if (!text.includes("%")) {
    suffix = "%";
  }

  return { value, suffix };
}

function normalizeBullets(bullets) {
  if (!Array.isArray(bullets)) {
    return [];
  }
  return bullets
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeKpis(rawKpis) {
  if (!rawKpis) {
    return [];
  }

  if (Array.isArray(rawKpis)) {
    return rawKpis
      .map((entry) => {
        if (typeof entry === "string") {
          return parseKpiEntry(entry);
        }
        if (entry && typeof entry === "object") {
          const label = String(entry.label || entry.name || "Priority KPI").trim();
          const parsed = parseNumericToken(entry.value);
          if (!parsed) {
            return null;
          }
          return {
            label,
            value: parsed.value,
            suffix: entry.suffix || parsed.suffix || "%",
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  if (typeof rawKpis === "object") {
    return Object.entries(rawKpis)
      .map(([label, value]) => parseKpiEntry(`${label}|${value}`))
      .filter(Boolean);
  }

  return [];
}

function normalizeSeries(rawSeries) {
  if (!rawSeries) {
    return [];
  }

  if (Array.isArray(rawSeries)) {
    return rawSeries
      .map((entry, index) => {
        if (typeof entry === "number") {
          return { label: `P${index + 1}`, value: entry };
        }
        if (typeof entry === "string") {
          return parseSeriesEntry(entry);
        }
        if (entry && typeof entry === "object") {
          const label = String(entry.label || entry.period || `P${index + 1}`).trim();
          const parsed = parseNumericToken(entry.value);
          if (!parsed) {
            return null;
          }
          return { label, value: parsed.value };
        }
        return null;
      })
      .filter(Boolean);
  }

  return [];
}

function normalizeFlowFromUnknown(rawFlow) {
  if (!rawFlow) {
    return [];
  }
  if (Array.isArray(rawFlow)) {
    return rawFlow
      .map((entry) => {
        if (typeof entry === "string") {
          return parseFlowEntry(entry);
        }
        if (entry && typeof entry === "object") {
          if (entry.from && entry.to) {
            return {
              from: String(entry.from).trim(),
              to: String(entry.to).trim(),
            };
          }
        }
        return null;
      })
      .filter(Boolean);
  }
  return [];
}

function finalizeSlide(slide, index) {
  const normalized = {
    title: String(slide.title || `Slide ${index + 1}`).trim(),
    narrative: String(slide.narrative || "").trim(),
    bullets: Array.isArray(slide.bullets) ? slide.bullets.map((entry) => String(entry).trim()) : [],
    kpis: Array.isArray(slide.kpis) ? slide.kpis : [],
    series: Array.isArray(slide.series) ? slide.series : [],
    flow: Array.isArray(slide.flow) ? slide.flow : [],
  };

  if (!normalized.narrative) {
    normalized.narrative =
      "Translate strategy into a high-conviction operating plan with measurable outcomes and clear accountability loops.";
  }

  normalized.bullets = normalized.bullets.filter(Boolean).slice(0, 6);
  if (!normalized.bullets.length) {
    normalized.bullets = [
      "Unify fragmented signals into one trusted decision layer.",
      "Improve execution rhythm with transparent AI recommendations.",
      "Create measurable outcome tracking across strategic initiatives.",
    ];
  }

  normalized.kpis = normalized.kpis
    .map((kpi, kpiIndex) => {
      if (!kpi || typeof kpi !== "object") {
        return null;
      }
      const label = String(kpi.label || `KPI ${kpiIndex + 1}`).trim();
      const value = Number(kpi.value);
      if (!Number.isFinite(value)) {
        return null;
      }
      return {
        label,
        value: Math.max(1, value),
        suffix: String(kpi.suffix || "%"),
      };
    })
    .filter(Boolean)
    .slice(0, 4);

  while (normalized.kpis.length < 3) {
    const fallbackIndex = normalized.kpis.length;
    normalized.kpis.push({
      label: ["Decision speed", "Execution quality", "Value confidence"][fallbackIndex],
      value: DEFAULT_KPI_VALUES[fallbackIndex],
      suffix: "%",
    });
  }

  normalized.series = normalized.series
    .map((point, pointIndex) => {
      if (!point || typeof point !== "object") {
        return null;
      }
      const label = String(point.label || `P${pointIndex + 1}`).trim();
      const value = Number(point.value);
      if (!Number.isFinite(value)) {
        return null;
      }
      return { label, value: Math.max(1, value) };
    })
    .filter(Boolean)
    .slice(0, 8);

  if (!normalized.series.length) {
    normalized.series = DEFAULT_SERIES_VALUES.map((value, valueIndex) => ({
      label: `P${valueIndex + 1}`,
      value,
    }));
  }

  normalized.flow = normalizeFlowEdges(normalized.flow);

  return normalized;
}

function shortenLabel(text, maxLength) {
  const value = String(text || "").trim();
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function triggerDownload(fileName, data, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
