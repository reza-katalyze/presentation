# Katalyze AI Design-to-Presentation Studio

This project turns raw design notes into a web-based executive presentation with:

- Very dark purple Katalyze AI visual language
- Palantir-inspired layout and motion style
- Interactive scenario toggles (base, conservative, aggressive)
- Animated KPI cards
- Flowchart rendering from `A->B` relationships
- Consulting-style trajectory chart (bar + trendline)

## Run locally

This is a static web app. You can open `index.html` directly, or run a local server:

```bash
python -m http.server 8080
```

Then open: `http://localhost:8080`

## Input format

Paste raw input into the left panel and click **Generate deck**.

Supported formats:

1. **Structured plain text (recommended)**
2. **JSON** (with `title`, `subtitle`, `client`, and `slides`)

### Plain-text template

```txt
TITLE: Katalyze AI Strategic Control Tower
SUBTITLE: Turning fragmented raw designs into board-ready stories
CLIENT: Katalyze AI
---
SLIDE: Why change now
NARRATIVE: ...
BULLETS:
- ...
- ...
KPIS:
- Decision cycle reduction|42
- Insight adoption increase|68
SERIES:
- Q1|28
- Q2|42
FLOW:
- Data Sources->Intelligence Fabric
- Intelligence Fabric->Decision Cockpit
```

## Controls

- **Arrow keys / Space**: move slides
- **Home / End**: jump first/last slide
- **Prev / Next / Play** buttons in header
- **Scenario toggle** to recalculate KPIs + charts
- **Import .txt/.json** to load deck input
- **Export deck JSON** to download normalized presentation data
