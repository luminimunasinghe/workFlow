# LumiFlow — personal work & growth tracker

Built from the "Upskilling & Development Plan". One place for daily updates, tasks, blockers, learning notes,
PR checklists and your 3-month development plan.

## Run it
1. Install Node.js LTS (https://nodejs.org)
2. `npm install`
3. `npm run dev`  → open the http://localhost:5173 link

## Where data is saved
- There is no database configured. While `npm run dev` runs, the Vite development server saves data to **data/lumiflow-data.json** (a plain JSON file in this project folder). The browser also keeps a copy in its local storage.
- Use *Backup & data* to export/import JSON. The Daily update page's **Save** button saves immediately; edits are also auto-saved.
- `data/lumiflow-data.json` is included in Git, so collaborators can see the data snapshot after you commit and push it; they will see that snapshot when they pull or clone the repo and run the app.
- This is file sharing through Git, not live shared storage. Each person's edits stay on their machine until they commit and push; others then pull. If multiple people edit at the same time, Git may report a merge conflict. A shared database with access controls is needed for live multi-user updates.
- Anyone with repository access can read committed data. Only commit information you are allowed to share, and remember that deleting it later does not erase it from Git history.

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
