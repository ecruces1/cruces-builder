# Interactive Resume Editor & Builder (PDF & Illustrator)

A modern, client-side web application designed to bridge the gap between pixel-perfect Adobe Illustrator design templates and ATS-friendly (Applicant Tracking System) professional resumes. 

The editor provides a live, dual-pane WYSIWYG workspace where users can fine-tune formatting, tailor multiple resume profiles, manage revisions, and export to print-ready PDF, ATS plain text, or portable JSON.

---

## ✨ Key Features

### 🖥️ Dual-Pane WYSIWYG Workspace
- **Structured Sidebar Form**: Clean tabbed inputs for Header & Contact Info, Professional Summary, 3-Column Skills Grid, Work Experience, Education, Certifications, and Achievements.
- **Physical Sheet Simulation**: Real-time rendering on standard **8.5" × 11"** letter-size sheets with automatic content flow, pagination detection, and split-page overflow management.
- **Drag & Resize**: Interactive spacing controls and drag handles to adjust section layout and padding without manual CSS tweaks.

### 🎯 Multi-Profile & Variant Management
- Create and switch between multiple resume variants (e.g., *Frontend Engineer*, *Product Designer*, *Operations Lead*) without losing previous edits.
- Duplicate existing resumes or branch into new variants tailored for specific job listings.

### 📄 Document Import & File Compatibility
- **PDF Ingestion**: Ingest and parse existing resumes client-side using integrated PDF.js.
- **Adobe Illustrator (.ai) Templates**: Built to match Adobe Illustrator stock resume aesthetics while maintaining web accessibility.
- **JSON Import/Export**: Save and restore full resume data structures for local backups.

### ⏱️ Revision History & Non-Destructive Inspection
- **Undo / Redo**: Keyboard shortcut support (`Ctrl+Z` / `Ctrl+Y`).
- **Named Snapshots**: Save custom restore points with `Ctrl+S` alongside automatic background saves.
- **Split-View Revision Inspector**: Preview any past snapshot side-by-side with your current document, search past revisions by keywords, or star important milestones.

### 🎨 Themes & Typography
- **Preset Color Palettes**:
  - *Illustrator Navy & Teal* (Default)
  - *Printer-Friendly Black & White* (Monochrome)
  - *Executive Charcoal & Blue*
  - *Tech Emerald*
  - *Classic Burgundy*
  - *Modern Indigo*
- **Curated Font Pairings**: Seamless switching between Poppins, Inter, Roboto, Montserrat, and Open Sans.

### 🚀 Export Formats
- **Print & PDF Export**: Optimized browser print styles formatted strictly for US Letter dimensions.
- **ATS Plain-Text Generator**: One-click extraction of a cleanly formatted plain-text document ready for online application portals.
- **JSON State**: Complete schema backup and transferability.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 (Modern Flexbox/Grid, CSS Variables, Print Media Queries)
- **Document Parsing**: [PDF.js](https://mozilla.github.io/pdf.js/) (v3.11)
- **Icons**: Inline SVG icons for zero external asset lag
- **Storage**: Browser `localStorage` for automatic state persistence and versioning
- **Dependencies**: Zero backend or Node.js server dependencies required; runs entirely in any modern web browser.

---

## 🚀 Getting Started

### Option 1: Direct Browser Launch
Since this is a client-side project with zero build dependencies, you can open it immediately:
1. Clone or download the repository:
   ```bash
   git clone https://github.com/ecruces1/cruces-builder.git
   ```
2. Open [`index.html`](index.html) directly in your web browser (Chrome, Edge, Firefox, Safari).

### Option 2: Local HTTP Server (Recommended)
To prevent browser CORS restrictions when loading local assets or external fonts:

**Using Python:**
```bash
# Python 3
python -m http.server 8000
```

**Using Node.js (via `npx serve`):**
```bash
npx serve .
```

Then visit `http://localhost:8000` (or the port specified) in your browser.

---

## 📂 Project Structure

```text
├── index.html            # Main application layout, sidebar tabs, and modals
├── styles.css            # Stylesheets for editor UI, theme palettes, and print sheets
├── app.js                # Core state management, PDF parsing, history, and rendering logic
├── template_data.js      # Default starter template structure and sample resume content
├── package.json          # Web app metadata & scripts for hosting / deployment
├── reference-images/     # UI snapshots, verification captures, and dev reference images
└── README.md             # Project documentation
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + S` / `Cmd + S` | Save a named snapshot / state |
| `Ctrl + Z` / `Cmd + Z` | Undo last change |
| `Ctrl + Y` / `Cmd + Shift + Z` | Redo undone change |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to open an issue or submit a pull request.

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).
