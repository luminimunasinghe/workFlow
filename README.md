# LumiFlow — personal work & growth tracker

Built from the "Upskilling & Development Plan". One place for daily updates, tasks, blockers, learning notes,
PR checklists and your 3-month development plan.

## Run it
1. Install Node.js LTS (https://nodejs.org)
2. `npm install`
3. `npm run dev`  → open the http://localhost:5173 link

## Where data is saved
- While `npm run dev` runs, everything is saved to **data/lumiflow-data.json** (one plain JSON file).
- It is also kept in the browser as a backup. Use *Backup & data* to export/import JSON.
- `data/lumiflow-data.json` is in `.gitignore` (it holds personal performance info). Remove that line to commit it to a PRIVATE repo.

## Upload to Git
```
git init
git add .
git commit -m "LumiFlow"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```
# workFlow
