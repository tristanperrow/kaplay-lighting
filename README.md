# KAPLAY Lighting Plugin

A lighting plugin for your KAPLAY games!

## Features

- Basic Light Types:
    - Global light (lights the whole scene evenly)
    - Point light (like a candle)
    - Spot light (like a flashlight or laser)
    - Directional light (like the Sun)
- Normal Map Support
- Lit Shaders that apply custom shader code combined with the lighting effect.

## Usage

1. Install kaplay-lighting with `npm i kaplay-lighting`
2. Import kaplay-lighting into your project with `import LightingPlugin from "kaplay-lighting"`
3. Add `LightingPlugin` as a plugin to kaplay.

```js
import kaplay from "kaplay";
import LightingPlugin from "kaplay-lighting";

// Initialize KAPLAY with the Lighting plugin
const k = kaplay({
    plugins: [LightingPlugin]
});

// Your game code here
```
