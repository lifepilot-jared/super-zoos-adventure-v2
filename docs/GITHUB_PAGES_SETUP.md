# GitHub Pages setup

This repository is configured to publish the Super Zoos Dash static Vite app using GitHub Actions.

Required repository setting:

- Settings → Pages → Build and deployment → Source: GitHub Actions

Current deployment target:

- https://lifepilot-jared.github.io/super-zoos-dash/

Notes:

- `npm run build` must pass before deployment.
- The GitHub Pages workflow uploads the `dist` folder.
- Real Super Zoos image/audio assets should only be uploaded when we are comfortable with the repo visibility.
