# Localized animation scenes

These seven code-native SVG scenes interpret themes in the current sourced story pack. They use no external images, fonts or animation services. They are labelled as interpretive illustrations in visible text and accessible SVG descriptions.

```js
import { mountLocalizedAnimation } from "/animations/localized-scenes.js";

const animation = mountLocalizedAnimation("#story-art", "beaufort-west", {
  durationSeconds: 10,
  controls: true
});

animation.pause();
animation.play();
animation.restart();
animation.destroy();
```

`createLocalizedAnimation(hubId, options)` returns the same controller without mounting it. `listLocalizedScenes()` supplies picker metadata. Hub IDs accept spaces or underscores and are normalized to hyphens.

The module honours `prefers-reduced-motion` by showing a complete static composition. Set `reducedMotion: true` to force that state. Every animated scene has a pause/play control unless `controls: false` is supplied.

Metadata and the editorial basis are in `scenes.v1.json`. These scenes are visual interpretations, not archival reproductions, architectural plans, exact rail diagrams, mine geometry, fossil identification or testimony from residents.
