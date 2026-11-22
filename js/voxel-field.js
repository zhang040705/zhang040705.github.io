// =========================================================================
// voxel-field.js · 全屏 3D 像素方块矩阵海（方案 B：舒适高质感纯白 3D 方块 + IDEA 联动彩色磁吸 + 边缘波浪变色切页）
// =========================================================================
window.VoxelField = (() => {
  let canvas = null;
  let gl = null;
  let prog = null;
  let extInst = null;

  let instanceCount = 0;
  let cols = 0;
  let rows = 0;

  // a_inst: [gridX, gridY, phase, currentZ]
  // a_meta: [darkBlend, 0, 0, 0]
  let instPos = null;
  let instMeta = null;
  let instPosBuf = null;
  let instMetaBuf = null;
  let cubeVbo = null;
  let cubeIbo = null;

  let uniforms = {};
  let mouseX = -9999;
  let mouseY = -9999;
  let smoothMouseX = 0;
  let smoothMouseY = 0;
  let mouseActive = false;

  // Dark-mode neon accent
  let accentRgb = [0.30, 0.79, 0.94];
  let targetAccentRgb = [0.30, 0.79, 0.94];

  // Light-mode hover highlight color (default subtle cool silver-blue; switches to vibrant I/D/E/A color when hovering letters)
  let lightHoverRgb = [0.76, 0.84, 0.97];
  let targetLightHoverRgb = [0.76, 0.84, 0.97];
  let lightHoverStrength = 0.48;
  let targetLightHoverStrength = 0.48;

  let pulseWave = 0;

  // Theme Wave Transition State ("light" = Personal IP Home, "dark" = AI Client Test)
  let currentMode = "light";
  let waveActive = false;
  let waveProgress = -0.3;
  let waveDirection = 1;
  let waveCallback = null;
  let waveCallbackFired = false;

  function hexToRgb(hex) {
    const clean = (hex || "#4cc9f0").replace("#", "");
    const num = parseInt(clean, 16);
    return [
      ((num >> 16) & 255) / 255,
      ((num >> 8) & 255) / 255,
      (num & 255) / 255
    ];
  }

  function createCubeGeometry() {
    const p = 0.468; // Softer, thinner seams between white cubes to avoid busy grid look
    const h = 2.2;
    const verts = new Float32Array([
      // Top face (z = 0)
      -p, -p,  0,  0,  0,  1,
       p, -p,  0,  0,  0,  1,
       p,  p,  0,  0,  0,  1,
      -p,  p,  0,  0,  0,  1,
      // Bottom-Y face
      -p, -p, -h,  0, -1,  0,
       p, -p, -h,  0, -1,  0,
       p, -p,  0,  0, -1,  0,
      -p, -p,  0,  0, -1,  0,
      // Top-Y face
      -p,  p,  0,  0,  1,  0,
       p,  p,  0,  0,  1,  0,
       p,  p, -h,  0,  1,  0,
      -p,  p, -h,  0,  1,  0,
      // Left face
      -p, -p, -h, -1,  0,  0,
      -p, -p,  0, -1,  0,  0,
      -p,  p,  0, -1,  0,  0,
      -p,  p, -h, -1,  0,  0,
      // Right face
       p, -p,  0,  1,  0,  0,
       p, -p, -h,  1,  0,  0,
       p,  p, -h,  1,  0,  0,
       p,  p,  0,  1,  0,  0
    ]);

    const indices = new Uint16Array([
      0, 1, 2,   0, 2, 3,
      4, 5, 6,   4, 6, 7,
      8, 9, 10,  8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19
    ]);
    return { verts, indices };
  }

  function buildGrid() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / Math.max(h, 1);

    // Finer, denser 3D pixel cube matrix with extra horizontal & vertical overdraw so edges never gap
    if (aspect >= 1.0) {
      cols = 64;
      rows = Math.max(36, Math.ceil((cols - 6) / aspect) + 6);
    } else {
      cols = 32;
      rows = Math.max(48, Math.ceil((cols - 4) / aspect) + 6);
    }

    instanceCount = cols * rows;
    instPos = new Float32Array(instanceCount * 4);
    instMeta = new Float32Array(instanceCount * 4);

    const initDark = currentMode === "dark" ? 1.0 : 0.0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const p4 = i * 4;
        instPos[p4] = c - (cols - 1) * 0.5;
        instPos[p4 + 1] = r - (rows - 1) * 0.5;
        instPos[p4 + 2] = Math.random() * Math.PI * 2;
        instPos[p4 + 3] = 0.0;

        // instMeta: [darkBlend, pastelIdx (0..3), breathStrength (0..1), 0]
        instMeta[p4] = initDark;
        // Organic non-repeating spatial color region so no straight lines or checkerboard seams appear
        const colorWave = Math.sin(c * 0.37 + r * 0.23) + Math.cos(c * 0.19 - r * 0.41);
        instMeta[p4 + 1] = Math.floor(((colorWave + 2.0) * 0.25) * 4.0) % 4;
        instMeta[p4 + 2] = 0.0;
        instMeta[p4 + 3] = 0.0;
      }
    }

    if (gl && instPosBuf && instMetaBuf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, instPosBuf);
      gl.bufferData(gl.ARRAY_BUFFER, instPos, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, instMetaBuf);
      gl.bufferData(gl.ARRAY_BUFFER, instMeta, gl.DYNAMIC_DRAW);
    }
  }

  function init() {
    canvas = document.getElementById("voxelFieldCanvas");
    if (!canvas) return;
    gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) return;

    extInst = gl.getExtension("ANGLE_instanced_arrays");
    if (!extInst) return;

    const vsSource = `
      attribute vec3 a_pos;
      attribute vec3 a_norm;
      attribute vec4 a_inst; // x: gridX, y: gridY, z: phase, w: currentZ
      attribute vec4 a_meta; // x: darkBlend, y: pastelIdx, z: breathTint

      uniform mat4 u_proj;
      uniform float u_camZ;

      varying vec3 v_norm;
      varying float v_lift;
      varying float v_dist;
      varying vec3 v_meta;

      void main() {
        float lift = a_inst.w;
        vec3 worldPos = vec3(a_inst.x + a_pos.x, a_inst.y + a_pos.y, lift + a_pos.z);
        worldPos.z -= u_camZ;
        gl_Position = u_proj * vec4(worldPos, 1.0);

        v_norm = a_norm;
        v_lift = lift;
        v_dist = length(a_inst.xy);
        v_meta = a_meta.xyz;
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform vec3 u_accent;
      uniform vec3 u_lightHover;
      uniform float u_lightHoverStrength;

      varying vec3 v_norm;
      varying float v_lift;
      varying float v_dist;
      varying vec3 v_meta;

      // Soft, low-saturation Morandi/Macaron pastel palette for Light Mode breathing & magnetic hover
      vec3 getPastelTint(float idx) {
        if (idx < 0.5) return vec3(0.81, 0.89, 0.98); // Mist Sky Blue
        if (idx < 1.5) return vec3(0.82, 0.94, 0.89); // Sage Mint
        if (idx < 2.5) return vec3(0.98, 0.90, 0.82); // Warm Apricot Cream
        return vec3(0.90, 0.86, 0.97);                // Soft Lavender Mist
      }

      // Brighter 16-bit arcade pixel palette for Dark Mode (AI Client Test) breathing
      vec3 getArcadeBreathColor(float idx) {
        if (idx < 0.5) return vec3(0.28, 0.78, 0.95); // Arcade Cyan
        if (idx < 1.5) return vec3(0.10, 0.84, 0.64); // Pixel Emerald
        if (idx < 2.5) return vec3(0.70, 0.50, 0.98); // Cyber Violet
        return vec3(0.98, 0.78, 0.34);                // Retro Gold
      }

      void main() {
        vec3 lightDir = normalize(vec3(-0.35, 0.48, 0.80));
        float diff = max(dot(normalize(v_norm), lightDir), 0.0);
        float isTop = step(0.5, v_norm.z);

        float darkBlend = v_meta.x;
        float pastelIdx = v_meta.y;
        float breathTint = v_meta.z;

        // 1. LIGHT MODE: Clean White Cubes with Soft Low-Contrast Sides + Noticeable Pastel Breath & Magnetic Pastel Hover
        vec3 whiteTop = vec3(0.978, 0.981, 0.990);
        vec3 whiteSide = vec3(0.900, 0.914, 0.940);
        vec3 lightCol = mix(whiteSide, whiteTop, isTop) * (0.90 + diff * 0.11);

        vec3 pastel = getPastelTint(pastelIdx);
        vec3 pastelShaded = mix(pastel * 0.92, pastel, isTop);

        if (breathTint > 0.01) {
          lightCol = mix(lightCol, pastelShaded, breathTint * 0.85);
        }

        // Mouse magnetic lift on Light Mode also reveals low-saturation pastel tint per cube
        float lightLift = clamp((v_lift - 0.32) * 0.44, 0.0, 1.0);
        vec3 hoverPastel = mix(pastelShaded, mix(u_lightHover * 0.93, u_lightHover, isTop), 0.35);
        lightCol = mix(lightCol, hoverPastel, lightLift * 0.88);

        // 2. DARK MODE: Deep Silicon Indigo Cubes + Brighter 16-Bit Pixel Breathing Color + Neon Magnetic Accent
        vec3 darkTop = vec3(0.088, 0.105, 0.200);
        vec3 darkSide = vec3(0.042, 0.052, 0.118);
        vec3 darkBase = mix(darkSide, darkTop, isTop);
        vec3 darkCol = darkBase * (0.56 + diff * 0.72);

        // Brighter arcade pixel glow synced with breathing crests
        if (breathTint > 0.01) {
          vec3 arcadeCol = getArcadeBreathColor(pastelIdx);
          vec3 arcadeShaded = mix(arcadeCol * 0.38, arcadeCol * 0.72, isTop) * (0.65 + diff * 0.55);
          darkCol = mix(darkCol, arcadeShaded, breathTint * 0.62);
        }

        float darkLift = clamp((v_lift - 0.28) * 0.42, 0.0, 1.0);
        darkCol = mix(darkCol, u_accent * (0.46 + diff * 0.65), darkLift * (isTop > 0.5 ? 0.84 : 0.50));
        if (isTop < 0.5 && darkLift > 0.05) {
          darkCol += u_accent * darkLift * 0.22;
        }
        float darkVig = clamp(1.0 - v_dist * 0.016, 0.52, 1.0);
        darkCol *= darkVig;

        // 3. WAVE TRANSITION MIX
        vec3 finalCol = mix(lightCol, darkCol, darkBlend);
        gl_FragColor = vec4(finalCol, 1.0);
      }
    `;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const geom = createCubeGeometry();
    cubeVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVbo);
    gl.bufferData(gl.ARRAY_BUFFER, geom.verts, gl.STATIC_DRAW);

    cubeIbo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geom.indices, gl.STATIC_DRAW);

    instPosBuf = gl.createBuffer();
    instMetaBuf = gl.createBuffer();

    uniforms = {
      proj: gl.getUniformLocation(prog, "u_proj"),
      camZ: gl.getUniformLocation(prog, "u_camZ"),
      accent: gl.getUniformLocation(prog, "u_accent"),
      lightHover: gl.getUniformLocation(prog, "u_lightHover"),
      lightHoverStrength: gl.getUniformLocation(prog, "u_lightHoverStrength")
    };

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      buildGrid();
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    const updatePointer = (cx, cy) => {
      mouseX = (cx / window.innerWidth) * 2 - 1;
      mouseY = -((cy / window.innerHeight) * 2 - 1);
      mouseActive = true;
    };

    window.addEventListener("pointermove", (e) => updatePointer(e.clientX, e.clientY));
    window.addEventListener("pointerdown", (e) => {
      updatePointer(e.clientX, e.clientY);
      pulseWave = 0.85;
    });
    window.addEventListener("pointerleave", () => {
      mouseActive = false;
    });
  }

  function makePerspective(fovRad, aspect, near, far) {
    const f = 1.0 / Math.tan(fovRad / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  function setTheme(hexColor) {
    targetAccentRgb = hexToRgb(hexColor);
    pulseWave = 0.75;
  }

  // Called when hovering individual I/D/E/A letters on the light Personal IP Home page
  function setLightHoverTint(hexColor) {
    if (hexColor) {
      targetLightHoverRgb = hexToRgb(hexColor);
      targetLightHoverStrength = 0.88;
      pulseWave = 0.55;
    } else {
      targetLightHoverRgb = [0.76, 0.84, 0.97];
      targetLightHoverStrength = 0.45;
    }
  }

  function transitionMode(targetMode, onMidpoint) {
    if (targetMode === currentMode && !waveActive) {
      if (onMidpoint) onMidpoint();
      return;
    }
    currentMode = targetMode;
    waveDirection = targetMode === "dark" ? 1 : -1;
    waveActive = true;
    waveProgress = -0.22;
    waveCallback = onMidpoint || null;
    waveCallbackFired = false;
  }

  function getMode() {
    return currentMode;
  }

  function render(nowSec) {
    if (!gl || !prog || !extInst || !instPos || !instMeta) return;

    for (let i = 0; i < 3; i++) {
      accentRgb[i] += (targetAccentRgb[i] - accentRgb[i]) * 0.07;
      lightHoverRgb[i] += (targetLightHoverRgb[i] - lightHoverRgb[i]) * 0.14;
    }
    lightHoverStrength += (targetLightHoverStrength - lightHoverStrength) * 0.14;
    pulseWave *= 0.93;

    if (waveActive) {
      waveProgress += 0.025;
      if (!waveCallbackFired && waveProgress >= 0.78) {
        waveCallbackFired = true;
        if (waveCallback) waveCallback();
      }
      if (waveProgress >= 1.38) {
        waveActive = false;
      }
    }

    const w = canvas.width;
    const h = canvas.height;
    const aspect = w / Math.max(h, 1);

    const fov = 42 * Math.PI / 180;
    const tanHalfFov = Math.tan(fov / 2);
    // Fit camera distance to the tighter of height & width so both left/right and top/bottom edges are always overscanned
    const maxCamZByH = ((rows - 4.0) * 0.5) / tanHalfFov;
    const maxCamZByW = ((cols - 4.0) * 0.5) / (tanHalfFov * aspect);
    const camZ = Math.min(maxCamZByH, maxCamZByW);

    const worldHalfH = tanHalfFov * camZ;
    const worldHalfW = worldHalfH * aspect;

    const targetMX = mouseActive ? mouseX * worldHalfW : 999;
    const targetMY = mouseActive ? mouseY * worldHalfH : 999;

    if (mouseActive) {
      smoothMouseX += (targetMX - smoothMouseX) * 0.22;
      smoothMouseY += (targetMY - smoothMouseY) * 0.22;
    }

    const attractRadius = Math.max(cols, rows) * 0.145;
    const r2Max = attractRadius * attractRadius;

    for (let r = 0; r < rows; r++) {
      const ny = r / Math.max(rows - 1, 1);
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const p4 = i * 4;
        const gx = instPos[p4];
        const gy = instPos[p4 + 1];
        const phase = instPos[p4 + 2];
        const curZ = instPos[p4 + 3];
        let darkBlend = instMeta[p4];

    // Moderate, expressive breathing wave tuned for denser grid
        const slowWave =
          Math.sin(nowSec * 0.68 + gx * 0.14 + gy * 0.10 + phase * 0.22) * 0.5 +
          Math.cos(nowSec * 0.48 - gx * 0.09 + gy * 0.13) * 0.5;
        const crest = Math.max(0.0, (slowWave + 0.05) / 1.05);
        const breathFactor = Math.pow(crest, 1.5);
        const wave = currentMode === "light" ? (breathFactor * 0.92) : (breathFactor * 1.05 - 0.16);

        let pull = 0;
        if (mouseActive) {
          const dx = gx - smoothMouseX;
          const dy = gy - smoothMouseY;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2Max) {
            const norm = 1.0 - Math.sqrt(d2) / attractRadius;
            pull = norm * norm * (2.85 + pulseWave * 0.75);
          }
        }

        let transitionCrest = 0;
        if (waveActive) {
          const nx = c / Math.max(cols - 1, 1);
          const diag = waveDirection === 1 ? (nx * 0.65 + ny * 0.35) : ((1.0 - nx) * 0.65 + (1.0 - ny) * 0.35);
          const distToFront = waveProgress - diag;
          transitionCrest = Math.exp(-distToFront * distToFront * 42.0) * 4.5;
          const stepT = Math.max(0.0, Math.min(1.0, (distToFront + 0.08) / 0.16));
          darkBlend = waveDirection === 1 ? stepT : (1.0 - stepT);
        } else {
          darkBlend = currentMode === "dark" ? 1.0 : 0.0;
        }

        const targetZ = wave + pull + transitionCrest;
        instPos[p4 + 3] = curZ + (targetZ - curZ) * 0.15;
        instMeta[p4] = darkBlend;
        instMeta[p4 + 2] = breathFactor;
      }
    }

    const isLightClear = currentMode === "light" && !waveActive;
    if (isLightClear) {
      // Match soft cube side tone so thin seams look seamless with no white crosshairs at screen center
      gl.clearColor(0.900, 0.914, 0.940, 1.0);
    } else {
      gl.clearColor(0.027, 0.035, 0.078, 1.0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(prog);

    const proj = makePerspective(fov, aspect, 0.5, 240.0);
    gl.uniformMatrix4fv(uniforms.proj, false, proj);
    gl.uniform1f(uniforms.camZ, camZ);
    gl.uniform3fv(uniforms.accent, accentRgb);
    gl.uniform3fv(uniforms.lightHover, lightHoverRgb);
    gl.uniform1f(uniforms.lightHoverStrength, lightHoverStrength);

    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVbo);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    const aNorm = gl.getAttribLocation(prog, "a_norm");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
    extInst.vertexAttribDivisorANGLE(aPos, 0);

    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 24, 12);
    extInst.vertexAttribDivisorANGLE(aNorm, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, instPosBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instPos);
    const aInst = gl.getAttribLocation(prog, "a_inst");
    gl.enableVertexAttribArray(aInst);
    gl.vertexAttribPointer(aInst, 4, gl.FLOAT, false, 16, 0);
    extInst.vertexAttribDivisorANGLE(aInst, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, instMetaBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instMeta);
    const aMeta = gl.getAttribLocation(prog, "a_meta");
    gl.enableVertexAttribArray(aMeta);
    gl.vertexAttribPointer(aMeta, 4, gl.FLOAT, false, 16, 0);
    extInst.vertexAttribDivisorANGLE(aMeta, 1);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIbo);
    extInst.drawElementsInstancedANGLE(gl.TRIANGLES, 30, gl.UNSIGNED_SHORT, 0, instanceCount);
  }

  return { init, setTheme, setLightHoverTint, transitionMode, getMode, render };
})();
