# Fish Evolution Game

A touch-friendly fish-eating game for browsers, including iPad. Swim around, eat smaller fish, avoid larger predators, and evolve through the stages.

## Play

After the Pages deployment finishes, visit: https://datazoe.github.io/fish-evolution-game/

The site is public on the internet. This workflow publishes the static game from the repository's `main` branch whenever a commit is pushed, and can also be run manually from the Actions tab.

## Run locally

Open `index.html` in a browser, or start a static server in this folder:

```sh
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Controls and goal

- Drag or touch the game area to steer on phones and iPad.
- Use WASD or the arrow keys on a keyboard.
- Eat smaller fish to gain energy and score; avoid bigger predators.
- Grow through the Fry, Fin Hopper, Hunter, Armored, and Apex stages.

## Art reference

The uploaded reference image is stored in the repository as [`Image (19).jpg`](./Image%20(19).jpg). The repository currently contains one reference image; to accurately match each evolution to separate pictures, add the individual stage images or identify which regions of a combined sheet correspond to each stage.
