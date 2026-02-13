import type { Comp, GameObj, PosComp, RotateComp, ShaderComp, ShaderData, SpriteComp, Tag, Texture, Uniform } from "kaplay";
import { Asset, Color, KAPLAYCtx, SpriteData, Vec2 } from "kaplay";
import lightingOnly from "./lighting-only.glsl";
import litShaderTemplate from "./lit.glsl";

const frag_i = litShaderTemplate.indexOf("vec4 frag");
const litShaderTemplateBefore = litShaderTemplate.slice(0, frag_i);
const litShaderTemplateAfter = litShaderTemplate.slice(frag_i);

export type UVBounds = {
    min: Vec2,
    max: Vec2,
    tex: Texture,
}

export type GlobalLight = {
    color: Color,
    intensity: number,
}

export type LightType = "point" | "spot" | "directional";

export interface ILight {
    type: LightType;
    /** The intensity of the light. */
    strength: number;
    /** The minimum radius of the light where intensity is 100%. */
    near: number;
    /** The maximum radius of the light where intensity drops to 0%. */
    far: number;
    pos: Vec2;
    /** The color of the light. */
    color: Color;
    /**
     * If not empty, only objects with at least one
     * of these tags will be lit by this light.
     */
    includeTags: Tag[];
    /**
     * If not empty, objects with at least one
     * of these tags will be not lit by this light.
     * (Overrides `includeTags`)
     */
    excludeTags: Tag[];
    direction: number;
    spread: number;
    widthMin: number;
    widthMax: number;
}

export interface LitShaderOpt {
    uniforms?: Uniform | (() => Uniform) | null,
    /**
     * The name of the sprite holding the normal maps for this current sprite.
     * 
     * It must be the same layout (frame 0 is the normal map for frame 0, etc).
     */
    nmSprite?: string;
}

export interface LitShaderComp extends Comp {
    uniforms: Uniform | (() => Uniform),
    nmSprite?: string;
}

export interface LightCompOpt {
    type?: LightType;
    /** The intensity of the light. */
    strength?: number;
    /** The minimum radius of the light where intensity is 100%. */
    near?: number;
    /** The maximum radius of the light where intensity drops to 0%. */
    far?: number;
    /** The color of the light. */
    color?: Color;
    /** The spread of the beam for directional lights, in degrees. */
    spread?: number;
    widthMin?: number;
    widthMax?: number;
    /**
     * If not empty, only objects with at least one
     * of these tags will be lit by this light.
     */
    includeTags?: Tag[];
    /**
     * If not empty, objects with at least one
     * of these tags will not be lit by this light.
     */
    excludeTags?: Tag[];
}

export interface LightComp extends Comp {
    light: ILight;
}

export interface LightStatic {
    new(
        type: LightType,
        strength?: number,
        near?: number,
        far?: number,
        pos?: Vec2,
        color?: Color,
        direction?: number,
        spread?: number,
        widthMin?: number,
        widthMax?: number,
        includeTags?: Tag[],
        excludeTags?: Tag[]
    ): ILight;
    lights: ILight[];
    addLight(light: ILight): void;
    removeLight(light: ILight): void;
    clearLights(): void;
    createLightingUniforms(otherUniforms?: Record<string, any>): Record<string, any>;
}

export interface KAPLAYLightingPlugin {
    Light: LightStatic;
    GLOBAL_LIGHT: GlobalLight;
    loadLitShader(name: string, vert: string | null, litFrag: string | null): Asset<ShaderData>;
    getUVBounds(spriteName: string, frame?: number): UVBounds | null;
    setGlobalLight(options: { color?: Color, intensity?: number }): GlobalLight;
    getGlobalLight(): GlobalLight;
    litShader(shaderName: string, opt?: LitShaderOpt): LitShaderComp;
    lightSource(opt?: LightCompOpt): LightComp;
}


export default function kaplayLighting(k: KAPLAYCtx): KAPLAYLightingPlugin {
    /*
     * PLUGIN OPTIONS
     */

    /** Whether or not to load default shaders. */
    const LOAD_DEFAULT_SHADERS = true;
    /** The maximum amount of lights. */
    const MAX_LIGHTS = 64;

    /*
     * PLUGIN OPTIONS END
     */

    /** The game's Global Light. */
    let GLOBAL_LIGHT: GlobalLight = {
        color: new k.Color(255, 255, 255),
        intensity: 0.0,
    }

    /**
     * Creates a light that passes its information onto any 'litShader'.
     */
    class Light implements ILight {
        /** The stored Light objects. */
        static lights: Light[] = [];


        constructor(
            public type: LightType = "point",
            public strength = .5,
            public near = 0,
            public far = 100,
            public pos = k.vec2(0),
            public color = k.WHITE,
            public direction = 0,
            public spread = 30,
            public widthMin = 0,
            public widthMax = 10,
            public includeTags: Tag[] = [],
            public excludeTags: Tag[] = [],
        ) {

            Light.addLight(this);
        }

        /**
         * Add back a light to the lights array.
         */
        static addLight(light: Light) {
            Light.lights.push(light);
        }

        /**
         * Remove a light from the lights array.
         */
        static removeLight(light: Light) {
            const index = Light.lights.indexOf(light);
            if (index !== -1) {
                Light.lights.splice(index, 1);
            }
        }

        /**
         * Removes all lights from the lights array.
         */
        static clearLights() {
            Light.lights = [];
        }
    }

    /**
     * Loads a 'litShader' using the lighting module.
     * 
     * @param name The name of the 'litShader'.
     * @param vert The vertex shader of the 'litShader'.
     * @param litFrag The fragment shader of the 'litShader'.
     */
    function loadLitShader(name: string, vert: string | null, litFrag: string | null) {
        return k.loadShader(name, vert, `\n#define MAX_LIGHTS ${MAX_LIGHTS}\n${litShaderTemplateBefore}${litFrag}${litShaderTemplateAfter}`);
    }

    /**
     * Gets the UV coordinates of the given sprite and frame for shader usage.
     * 
     * @param spriteName The given sprite.
     * @param frame The frame of the sprite.
     * 
     * @returns A {min, max} for the UV bounds.
     */
    function getUVBounds(spriteName: string, frame: number = 0): UVBounds | null {
        let sprite: Asset<SpriteData> | null = k.getSprite(spriteName);
        const q = sprite?.data?.frames[frame]!;
        if (!q) return null;
        return {
            min: k.vec2(q.x, q.y),
            max: k.vec2(q.x + q.w, q.y + q.h),
            tex: sprite.data!.tex,
        }
    }

    /**
     * Sets the global light of the game.
     */
    function setGlobalLight({
        color = GLOBAL_LIGHT.color,
        intensity = GLOBAL_LIGHT.intensity
    }) {
        GLOBAL_LIGHT = {
            color: color,
            intensity: intensity
        }
        return GLOBAL_LIGHT;
    }

    /**
     * Gets the global light of the game.
     */
    function getGlobalLight() {
        return GLOBAL_LIGHT;
    }

    /**
     * Custom Lit Shader.
     */
    function litShader(shaderName: string, opt: LitShaderOpt = {}): LitShaderComp {
        const lightType: (0 | 1 | 2)[] = [];
        const lightStrength: number[] = [];
        const lightNear: number[] = [];
        const lightFar: number[] = [];
        const lightPos: Vec2[] = [];
        const lightColor: Color[] = [];
        const lightDirection: number[] = [];
        const lightSpread: number[] = [];
        const lightWidthMin: number[] = [];
        const lightWidthMax: number[] = [];

        const selfTransform: [number, number, number, number] = [0, 0, 0, 0];
        return {
            id: "litShader",
            require: [],

            uniforms: opt.uniforms ?? {},
            nmSprite: opt.nmSprite,
            add(this: GameObj<LitShaderComp | ShaderComp>) {
                this.use(k.shader(shaderName, {}));
            },

            update(this: GameObj<ShaderComp | LitShaderComp | RotateComp | SpriteComp>) {
                const { color: globalColor, intensity: globalIntensity } = getGlobalLight();
                const lights = Light.lights;

                let j = 0;
                for (let i = 0; i < lights.length; i++) {
                    const {
                        type,
                        strength,
                        near,
                        far,
                        pos,
                        color,
                        includeTags,
                        excludeTags,
                        direction,
                        spread,
                        widthMin,
                        widthMax,
                    } = lights[i]!;
                    if (includeTags.length > 0 && !this.is(includeTags, "or")) continue;
                    if (excludeTags.length > 0 && this.is(excludeTags, "or")) continue;
                    lightType[j] = type === "spot" ? 1 : type === "directional" ? 2 : 0;
                    lightStrength[j] = strength;
                    lightNear[j] = near;
                    lightFar[j] = far;
                    lightPos[j] = pos;
                    lightColor[j] = color;
                    lightDirection[j] = k.deg2rad(direction);
                    lightSpread[j] = k.deg2rad(spread);
                    lightWidthMin[j] = widthMin;
                    lightWidthMax[j++] = widthMax;
                }
                lightType.length =
                    lightStrength.length =
                    lightNear.length =
                    lightFar.length =
                    lightPos.length =
                    lightColor.length =
                    lightDirection.length =
                    lightSpread.length =
                    lightWidthMin.length =
                    lightWidthMax.length = j;

                const t = this.transform;
                selfTransform[0] = t.a;
                selfTransform[1] = t.b;
                selfTransform[2] = t.c;
                selfTransform[3] = t.d;

                // attach these uniforms to the custom uniforms given by `litShader()` component

                const u = this.uniform!;

                u.u_time = k.time();
                u.u_globalLightColor = globalColor;
                u.u_globalLightIntensity = globalIntensity;
                u.u_lightStrength = lightStrength;
                u.u_lightNearRadius = lightNear;
                u.u_lightFarRadius = lightFar;
                u.u_lightPos = lightPos;
                u.u_lightColor = lightColor;
                u.u_lightType = lightType;
                u.u_lightSpread = lightSpread;
                u.u_widthMin = lightWidthMin;
                u.u_widthMax = lightWidthMax;
                u.u_direction = lightDirection;
                u.u_lights = lights.length;
                u.u_selfTransform = selfTransform;
                Object.assign(u, typeof this.uniforms === "function" ? this.uniforms() : this.uniforms);

                if (this.has("sprite") && this.nmSprite) {
                    const tex = getUVBounds(this.sprite, this.frame)!;
                    const nm = getUVBounds(this.nmSprite, this.frame)!;
                    u.u_nm_min = nm.min;
                    u.u_nm_max = nm.max;
                    u.u_tex_min = tex.min;
                    u.u_tex_max = tex.max;
                    // @ts-expect-error
                    // texture uniform was added but not to the type lmao
                    u.u_nm_tex = nm.tex;
                    u.u_useNormalMap = 1;
                } else {
                    u.u_useNormalMap = 0;
                }
            }
        }
    }

    /**
     * Makes your object contain a light.
     */
    function lightSource(opt: LightCompOpt = {}): LightComp {
        return {
            id: "light",
            require: ["pos"],
            light: null as any, // will be set below once we have pos and angle
            add(this: GameObj<PosComp | LightComp | RotateComp>) {
                this.light = new Light(
                    opt.type,
                    opt.strength,
                    opt.near,
                    opt.far,
                    this.pos,
                    opt.color,
                    this.angle ?? 0,
                    opt.spread,
                    opt.widthMin,
                    opt.widthMax,
                    opt.includeTags,
                    opt.excludeTags,
                );
            },
            draw(this: GameObj<PosComp | LightComp>) {
                const t = this.transform, l = this.light;
                l.pos = t.getTranslation();
                l.direction = t.getRotation();
            },
            destroy(this: GameObj<PosComp | LightComp>) {
                Light.removeLight(this.light);
            },
            inspect(this: GameObj<PosComp | LightComp>) {
                return "light: " + String(this.light);
            }
        }
    }

    // LOAD DEFAULTS
    if (LOAD_DEFAULT_SHADERS)
        initializeDefaults();

    /**
     * Loads the basic shader samples.
     */
    function initializeDefaults() {
        loadLitShader("litSprite", null, lightingOnly);
    }

    return {
        Light: Light as unknown as LightStatic,
        GLOBAL_LIGHT,
        loadLitShader,
        getUVBounds,
        setGlobalLight,
        getGlobalLight,
        litShader,
        lightSource,
    }
}