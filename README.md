# Platypug: Hide and Seek

Live: https://platypuggames.github.io/platypug/

`index.html` is the playable game and is **generated**: don't edit it by hand.
The source lives in `src/` and is stitched together, in `src/manifest.txt` order, by:

    node build.js          # rebuild index.html from src/
    node build.js --check  # confirm index.html matches src/

- `src/page/`   HTML shell (head, screens/HUD markup, closing tags)
- `src/styles/` CSS (base, room features, pool, furniture + sprites, UI screens)
- `src/js/`     game code, in load order (art, world, movement + room features, input,
                yard mechanics, Pug and Seek, Platytag networking / lobby + host / client)

All `src/js` pieces are one script in the built page, so they share the same scope.
