# houseinventory

A simple, offline house inventory app that runs entirely in your browser. You don't need to install anything, run a server or create an account.

## Features

- Add, edit and delete items with name, room, category, quantity, value, brand/model, serial number, purchase date, warranty end date, notes and a photo
- Search across names, notes, brands and serial numbers
- Filter by room or category, and sort by name, room, value, purchase date or last update
- Summary of total items, quantity, value and rooms, plus value per room (click a room chip to filter)
- Warranty badges for items whose warranty ends within 30 days or has already expired
- Export to JSON (a full backup that includes photos) or CSV (to open in a spreadsheet)
- Import a JSON backup, either replacing or merging with your current inventory
- Light and dark mode, and a layout that works on phones

## Usage

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

You can also enable GitHub Pages on this repository to use the app from any device.

## Data storage

Your data is saved in the browser's `localStorage`, so it stays on the device and browser where you entered it. Photos are scaled down to save space, but browser storage is still limited (usually around 5 MB). Use **Export JSON** regularly as a backup and to move your inventory to another device.
