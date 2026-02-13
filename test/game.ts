import kaplay, { Color, GameObj, RotateComp, Tag, Vec2 } from "kaplay";
import kaplayLighting, { LightComp } from "../src/plugin";

const k = kaplay({
    plugins: [kaplayLighting],
    pixelDensity: Math.min(2, devicePixelRatio),
});

// load sprites
k.loadSprite("steel", "test/steel.png");
k.loadSprite("steel-nm", "test/steel-nm.png");
k.loadSprite("sb", "test/stone-brick-top.png");
k.loadSprite("sb-nm", "test/stone-brick-top-nm.png");

k.loadSpriteAtlas("test/tilemap.png", {
    "sb-tl": {
        x: 0,
        y: 0,
        width: 16,
        height: 16,
    },
    "sb-tp": {
        x: 16,
        y: 0,
        width: 16,
        height: 16,
    },
    "sb-tr": {
        x: 32,
        y: 0,
        width: 16,
        height: 16,
    },
});

k.loadSpriteAtlas("test/tilemap-nm.png", {
    "sb-tl-nm": {
        x: 0,
        y: 0,
        width: 16,
        height: 16,
    },
    "sb-tp-nm": {
        x: 16,
        y: 0,
        width: 16,
        height: 16,
    },
    "sb-tr-nm": {
        x: 32,
        y: 0,
        width: 16,
        height: 16,
    },
});

k.loadSpriteAtlas("test/torch.png", {
    "torch": {
        x: 0,
        y: 0,
        width: 16,
        height: 32,
    }
})

k.loadSpriteAtlas("test/torch.png", {
    "torch-nm": {
        x: 0,
        y: 0,
        width: 16,
        height: 32,
    }
})

// load shader
k.loadLitShader("test", null, `
    vec4 lit_frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
        vec4 d = def_frag();
        pos /= vec2(1920., 1080.);
        return vec4(d.x + pos.x, d.y + pos.y, d.z, d.a);
    }
`);

k.onLoad(() => {
    k.go("main");
})

k.scene("main", () => {
    let bg = k.add([
        k.pos(),
        k.rect(k.width() * 100, k.height() * 100),
        k.anchor("center"),
        k.color(20, 20, 20),
        k.litShader("litSprite"),
        "torchLit"
    ])

    for (let i = 0; i < k.width() / 32; i++) {
        k.add([
            k.pos(i * 32, k.height()),
            k.sprite("sb"),
            k.scale(2),
            k.anchor("botleft"),
            k.litShader("litSprite", { nmSprite: "sb-nm" }),
        ])
    }

    let level = k.addLevel([
        "[---]",
    ], {
        tileHeight: 32,
        tileWidth: 32,
        tiles: {
            "[": () => [
                k.pos(),
                k.sprite("sb-tl"),
                k.area(),
                k.body({ isStatic: true }),
                k.scale(2),
                k.litShader("litSprite", { nmSprite: "sb-tl-nm" }),
            ],
            "-": () => [
                k.pos(),
                k.sprite("sb-tp"),
                k.area(),
                k.body({ isStatic: true }),
                k.scale(2),
                k.litShader("litSprite", { nmSprite: "sb-tp-nm" }),
            ],
            "]": () => [
                k.pos(),
                k.sprite("sb-tr"),
                k.area(),
                k.body({ isStatic: true }),
                k.scale(2),
                k.litShader("litSprite", { nmSprite: "sb-tr-nm" }),
            ]
        }
    })

    level.pos = k.vec2(k.width() / 2 - 80, k.height() - 64);

    function addTorch(pos: Vec2, color = k.WHITE, tags: Tag[] = []) {
        const torch = k.add([
            k.pos(pos),
            k.sprite("torch"),
            k.anchor("bot"),
            k.litShader("litSprite", { nmSprite: "torch-nm" }),
        ])

        const torchlight = torch.add([
            k.pos(0, -32),
            k.lightSource({ far: 0.2, color, includeTags: tags }),
            {
                update(this: GameObj<LightComp>) {
                    this.light!.strength = k.wave(0.5, 2, k.time() * 2 + k.wave(-2, 2, k.time() * 7));
                    this.light!.far = k.wave(100, 200, k.time() * 3 + k.wave(-.2, .2, k.time() * 8));
                }
            },
        ])

        console.log(torchlight)

        return torch;
    }

    addTorch(k.vec2(k.width() / 2, k.height() - 56), k.rgb(255, 140, 0));


    // test unlit background
    let bgLit = true;
    k.onKeyPress("t", () => {
        if (bgLit) {
            bg.unuse("litShader");
            bg.unuse("shader");
        } else {
            bg.use(k.litShader("litSprite"));
        }
        bgLit = !bgLit;
    })

    k.add([
        k.pos(k.width() / 2, 64),
        k.anchor("center"),
        k.text("Press 'T' to toggle background being lit.", {
            align: "center",
        })
    ])

    function title(obj: GameObj, text: string) {
        obj.add([
            k.pos(0, -32),
            k.anchor("bot"),
            k.text(text, {
                align: "center",
                size: 20
            })
        ])
    }

    // test custom shader
    const csBlock = k.add([
        k.pos(4 * k.width() / 5, k.height() / 2),
        k.sprite("steel"),
        k.anchor("center"),
        k.litShader("test"),
    ]);

    title(csBlock, "Custom Shader");

    // test normal maps
    const nmBlock = k.add([
        k.pos(3 * k.width() / 5, k.height() / 2),
        k.sprite("steel"),
        k.anchor("center"),
        k.litShader("litSprite", { nmSprite: "steel-nm" }),
        k.skew(0, 0),
    ])

    title(nmBlock, "Normal Map");

    // test both
    const bothBlock = k.add([
        k.pos(2 * k.width() / 5, k.height() / 2),
        k.sprite("steel"),
        k.anchor("center"),
        k.litShader("test", { nmSprite: "steel-nm" }),
    ])

    title(bothBlock, "Shader\n&\nNormal Map")

    // test tags & spinning
    const tagsBlock = k.add([
        k.pos(1 * k.width() / 5, k.height() / 2),
        k.sprite("steel"),
        k.anchor("center"),
        k.rotate(),
        k.litShader("litSprite", { nmSprite: "steel-nm" }),
        "torchLit"
    ])

    tagsBlock.onUpdate(() => {
        tagsBlock.angle += 200 * k.dt();
    })

    nmBlock.onUpdate(() => {
        nmBlock.skew = k.vec2(k.wave(-20, 20, k.time() * 3), 0);
    })

    title(tagsBlock, "Tags");

    const SPEED = 500;
    k.onKeyDown("left", () => {
        csBlock.move(-SPEED, 0);
        nmBlock.move(-SPEED, 0);
        bothBlock.move(-SPEED, 0);
        tagsBlock.move(-SPEED, 0);
    })

    k.onKeyDown("right", () => {
        csBlock.move(SPEED, 0);
        nmBlock.move(SPEED, 0);
        bothBlock.move(SPEED, 0);
        tagsBlock.move(SPEED, 0);
    })

    k.onKeyDown("up", () => {
        csBlock.move(0, -SPEED);
        nmBlock.move(0, -SPEED);
        bothBlock.move(0, -SPEED);
        tagsBlock.move(0, -SPEED);
    })

    k.onKeyDown("down", () => {
        csBlock.move(0, SPEED);
        nmBlock.move(0, SPEED);
        bothBlock.move(0, SPEED);
        tagsBlock.move(0, SPEED);
    })


    addTorch(k.vec2(k.width() / 4, k.height() - 24), k.rgb(0, 149, 255), ["torchLit"]);

    const torch1 = addTorch(k.vec2(3 * k.width() / 4 + 20, 2 * k.height() / 3));
    const torch2 = addTorch(k.vec2(3 * k.width() / 4, 2 * k.height() / 3));

    torch2.use(k.rotate(0));
    torch2.anchor = "center";
    torch1.children[0].destroy()
    torch2.children[0].destroy()
    torch2.use({
        update(this: GameObj<RotateComp>) {
            this.angle += 200 * k.dt();
        }
    });
    torch2.use(k.area())

    // test alpha 16
    k.onKeyDown("w", () => {
        k.setCamPos(k.getCamPos().add(0, -SPEED * k.dt()));
    })

    k.onKeyDown("s", () => {
        k.setCamPos(k.getCamPos().add(0, SPEED * k.dt()));
    })

    k.onKeyDown("a", () => {
        k.setCamPos(k.getCamPos().add(-SPEED * k.dt(), 0));
    })

    k.onKeyDown("d", () => {
        k.setCamPos(k.getCamPos().add(SPEED * k.dt(), 0));
    })

    const max = 30;
    const min = 3;
    k.onScroll((d) => {
        k.setCamScale(k.vec2(k.clamp(k.getCamScale().y - d.y / 1000, 1 / max, min)));
    })

    const mouseLight = new k.Light("point", 1.0, 50, 200, k.center());

    const spotLight = new k.Light("spot", 2, 50, 500, k.center(), k.WHITE, 0, undefined, 0, 20);

    k.setGlobalLight({
        intensity: 0.5,
    })

    k.onUpdate(() => {
        const d = spotLight.pos.sub(mouseLight.pos = k.toWorld(k.mousePos()));
        spotLight.direction = d.angle() + 180;
        spotLight.spread = k.rad2deg(Math.atan2(100, d.len()));
        // spotLight.color = k.Color.fromHSL((k.time() / 3) % 1, 1, .5);
    })
})