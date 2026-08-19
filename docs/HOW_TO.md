# How-To Guides

Actionable, step-by-step recipes for accomplishing specific tasks in **AetherMind**.

---

## 1. How to Switch and Build Custom Themes

### Switching Preset Themes
1. Click **Settings (⚙️)** in the top right dock.
2. Select the **Appearance** tab.
3. Click any theme card:
   - **Dark Space**: Classic deep indigo space.
   - **Light Clean**: High-contrast modern light interface.
   - **Sepia Warm**: Editorial warm parchment style.
   - **Midnight**: Pitch black OLED aesthetic with neon ruby accents.
   - **Ocean Tide**: Deep marine blue with cyan linkages.

### Creating a Custom Theme
1. Under the **Appearance** tab, click **Custom**.
2. Customize your palette:
   - **Background Color**: Sets canvas workspace and page backdrop.
   - **Sidebar Background**: Sets glass panels and navigation tabs.
   - **Text Color**: Sets headings, editor body, and primary icons.
   - **Accent Color**: Sets primary buttons and glow auras.
   - **Lines & Borders**: Sets synapse connection line colors.
   - **Font Style**: Choose from *Plus Jakarta Sans*, *Inter*, *Outfit*, *Playfair Display*, *Lora*, *Merriweather*, *Cinzel*, or developer monospaces (*JetBrains Mono*, *Fira Code*).
3. The dynamic luminance engine automatically sets light or dark color-scheme contrast!

---

## 2. How to Ingest PDF / Word Documents (Local RAG)

1. Click the **Upload Document (📄↑)** icon in the header dock.
2. Select any `.pdf`, `.docx`, `.txt`, or `.md` file from your device.
3. AetherMind's client-side parser will chunk, tokenize, and ingest the document into your local vector database.
4. Open **Ask AI (✨)** and ask questions referencing your uploaded document — answers are synthesized with zero cloud storage!

---

## 3. How to Save and Restore Graph Snapshots (Time Travel)

1. Open **Settings (⚙️)** → **Data & Graph**.
2. Click **Save Snapshot Now** to capture the exact layout, nodes, links, and positions.
3. To view past versions, drag the **Timeline Slider** scrubber at the bottom of the canvas.
4. Click **Restore from History** to revert your live graph to any historical snapshot point.

---

## 4. How to Export and Backup Your Workspace

### Full JSON Backup
1. Go to **Settings (⚙️)** → **Data & Graph**.
2. Click **Export Full Backup (JSON)**.
3. To restore on another computer or browser, click **Import Full Backup (JSON)**.

### Standalone Interactive HTML Export
1. Go to **Settings (⚙️)** → **Data & Graph**.
2. Click **Export to HTML**.
3. A single, self-contained HTML file containing your entire knowledge graph, force simulation, and themes will download. Open it offline in any web browser!
