// these two kaplay gives on its own
uniform highp float width;
uniform highp float height;

// global light
uniform vec3 u_globalLightColor;
uniform float u_globalLightIntensity;

// lighting
uniform float u_lightStrength[MAX_LIGHTS];
uniform float u_lightNearRadius[MAX_LIGHTS];
uniform float u_lightFarRadius[MAX_LIGHTS];
uniform vec2 u_lightPos[MAX_LIGHTS];
uniform vec3 u_lightColor[MAX_LIGHTS];
uniform float u_direction[MAX_LIGHTS]; // beam direction angle in radians (for spot and directional lights)
uniform float u_lightType[MAX_LIGHTS]; // 1 = spot light, 0 = point light, 2 = directional light
uniform float u_lightSpread[MAX_LIGHTS]; // beam spread angle for spot lights
uniform float u_widthMin[MAX_LIGHTS]; // width of margin for spot lights
uniform float u_widthMax[MAX_LIGHTS];
uniform float u_lights;

// normal maps
uniform vec2 u_nm_min;
uniform vec2 u_nm_max;
uniform vec2 u_tex_min;
uniform vec2 u_tex_max;
uniform sampler2D u_nm_tex;
uniform float u_useNormalMap;
uniform float u_selfTransform[4]; // Use 4 floats and convert the mat2 to a mat4 in the shader

vec2 normalizeCoords(vec2 pos) {
    pos.x *= width / height;
    return pos;
}

vec2 map(vec2 n, vec2 min1, vec2 max1, vec2 min2, vec2 max2) {
    return ((n - min1) / (max1 - min1)) * (max2 - min2) + min2;
}

mat2 rotation(float angle) {
    float c = cos(angle), s = sin(angle);
    return mat2(c, -s, s, c);
}

mat2 transform4() {
    float a = u_selfTransform[0], b = u_selfTransform[1], c = u_selfTransform[2], d = u_selfTransform[3];
    return mat2(a, b, c, d);
}

// lighting shader
vec3 calculateLighting(vec2 pos, vec2 uv, sampler2D _) {
    vec3 totalLight = u_globalLightColor * u_globalLightIntensity / 255.;
    bool hasNMap = u_useNormalMap > 0.;
    vec3 normal = hasNMap ? texture2D(u_nm_tex, map(uv, u_tex_min, u_tex_max, u_nm_min, u_nm_max)).rgb * 2. - 1. : vec3(0., 0., 1.);
    if(hasNMap)
        normal = normalize(vec3(transform4() * normal.xy, normal.z));
    for(int i = 0; i < MAX_LIGHTS; i++) {
        if(i >= int(u_lights))
            break;

        float lightStrength = u_lightStrength[i];
        float near = u_lightNearRadius[i] / height;
        float far = u_lightFarRadius[i] / height;
        vec2 lightPos = u_lightPos[i] / vec2(width, height);
        vec3 lightColor = u_lightColor[i] / 255.;

        if(u_lightType[i] > 1.) {
            // Directional light
            float diffuse = hasNMap ? max((rotation(u_direction[i]) * normal.xy).x, 0.) : 1.;
            totalLight += lightColor * diffuse * lightStrength;
        } else {
            lightPos.x *= (width / height);
            vec2 nPos = normalizeCoords(pos) / vec2(width, height);
            float dist = distance(lightPos, nPos);
            float distanceFalloff = near == far ? (dist > far ? 0. : 1.) : 1. - smoothstep(near, far, dist);
            if(distanceFalloff <= 0.)
                continue;

            vec2 pixelVector = lightPos - nPos;
            float diffuse = hasNMap ? max(dot(normal, normalize(vec3(pixelVector, 0.))), 0.) : 1.;

            if(u_lightType[i] > 0.) {
                // Spot light (flashlight beam)
                float dir = u_direction[i], wm = u_widthMin[i] / height / 2., wx = u_widthMax[i] / height / 2., sh = u_lightSpread[i] / 2., beamFalloff = 1.;

                vec2 rPV = rotation(dir) * pixelVector;
                float localAngle = atan(rPV.y, rPV.x);

                if(abs(localAngle) >= sh) {
                    vec2 d = rotation(localAngle < 0. ? -sh : sh) * rPV;
                    float b = d.x < 0. ? length(d) : abs(d.y);
                    beamFalloff = wm == wx ? (b > wx ? 0. : 1.) : 1. - smoothstep(wm, wx, b);
                }

                totalLight += lightColor * beamFalloff * distanceFalloff * diffuse * lightStrength;
            } else {
                // Point light

                totalLight += lightColor * distanceFalloff * diffuse * lightStrength;
            }
        }
    }
    totalLight = max(totalLight, vec3(0.));
    return totalLight;
}

// lit_frag() will be inserted immediately before frag()

// to implement custom litShader code
vec4 frag(vec2 pos, vec2 uv, vec4 color, sampler2D tex) {
    return lit_frag(pos, uv, color, tex) * vec4(calculateLighting(pos, uv, tex), 1.);
}
