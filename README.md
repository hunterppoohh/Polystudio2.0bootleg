# Polytoria 3D Builder — Studio

A browser-based 3D + GUI level editor built with Three.js and TypeScript.

---

## 🚀 How to Run

### Prerequisites
- **Node.js 18+** — download from https://nodejs.org

### Steps

```bash
# 1. Install dependencies (only needed once)
npm install

# 2. Start the dev server
npm run dev
```

Then open **http://localhost:5173** in your browser.

### Other commands
```bash
npm run build    # Production build → dist/
npm run preview  # Preview the production build
```

---

## ✍️ Script Editor

1. In the **Add** dropdown, select **Script** or **LocalScript** and click **Add**
2. Click the object in the Explorer (left panel) to select it
3. In the **Properties** panel (right), click **Open Script Editor**
   — or **double-click** the script in the Explorer tree
4. Write Lua code in the inline editor
5. **Open in Editor** — downloads the script as a `.lua` file and opens it in your **default text editor** (VS Code, Notepad++, Sublime Text, etc.)
6. **Import .lua** — re-imports a `.lua` file back into the script after editing externally
7. Scripts are saved inside `.poly` files when you click **Save**

---

## 🎮 Controls

| Action | Input |
|--------|-------|
| Fly camera | WASD + Q/E |
| Slow fly | Hold Shift |
| Look around | Right-click drag |
| Select object | Left-click |
| Box select | Tool 5, then drag |
| Move tool | 1 |
| Rotate tool | 2 |
| Scale tool | 3 |
| Paint tool | 4 |
| Delete selected | Delete / Backspace |
| Copy | Ctrl+C |
| Paste | Ctrl+V |
| Duplicate | Ctrl+D |

---

## 📁 File Format

Files use the `.poly` XML format. Scripts are stored as `<Source>` nodes inside `<Item class="Script">` elements.
