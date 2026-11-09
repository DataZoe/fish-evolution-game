# Fish Evolution Game

A touch-friendly fish-eating game for web browsers, including iPad. Eat smaller fish, avoid predators, evolve through five stages, and watch for occasional boss fish.

## Play

Once the GitHub Pages deployment succeeds, visit https://datazoe.github.io/fish-evolution-game/ . The published site is public on the internet.

## Controls

- Touch and drag on the game area to steer on iPad and other touchscreens.
- Use WASD or the arrow keys on a keyboard.
- Eat smaller fish to gain energy and score; the Eaten counter shows your total for the current run.
- A boss fish occasionally appears, with a three-hit health bar and a bonus reward when defeated.
- Press **Rebirth** to confirm and restart the run.

## Display sizing fix

The full responsive stylesheet ensures the canvas fills the browser viewport on desktop and iPad. If an older page still looks small, refresh after the Pages deployment completes (a hard refresh may clear cached CSS).

## Run locally

Open `index.html` in a browser, or start a static server with `python3 -m http.server 8000`, then visit http://localhost:8000.
