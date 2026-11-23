// =========================================================================
// voxel-field.js · 全屏 2.5D 等轴测 3D 像素方块海
// 标准等轴测视角（俯角 35.26°，旋转 45°），与 2.5D 像素浮岛群透视完全统一
// 支持精确射线-平面求交鼠标磁吸水波 + 低饱和淡彩呼吸 + 边缘 3D 巨浪变色切页
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
  // a_meta: [darkBlend, pastelIdx, breathFactor, 0]
  let instPos = null;
  let instMeta = null;
  let instPosBuf = null;
  let instMetaBuf = null;
  let cubeVbo = null;
  let cubeIbo = null;

  let uniforms = {};
  let mouseNdcX = -999;
  let mouseNdcY = -999;
  let smoothWorldX = 999;
  let smoothWorldY = 999;
  let mouseActive = false;

  let accentRgb = [0.30, 0.79, 0.94];
  let targetAccentRgb = [0.30, 0.79, 0.94];
  let lightHoverRgb = [0.76, 0.86, 0.98];
  let targetLightHoverRgb = [0.76, 0.86, 0.98];
  let pulseWave = 0;

  // Theme Wave Transition State ("light" = Miles' World Archipelago, "dark" = AI Client Test)
  let currentMode = "light";
  let waveActive = false;
  let waveProgress = -0.3;
  let waveDirection = 1;
  let waveCallback = null;
  let waveCallbackFired = false;

  // Isometric camera angles (exact 2:1 isometric projection: pitch ~54.735° from Z-axis, yaw 45°)
  const ISO_PITCH = 54.7356 * Math.PI / 180;
  const ISO_YAW = 45.0 * Math.PI / 180;
  const COS_P = Math.cos(ISO_PITCH);
  const SIN_P = Math.sin(ISO_PITCH);
  const COS_Y = Math.cos(ISO_YAW);
  const SIN_Y = Math.sin(ISO_YAW);

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
    const p = 0.472;
    const h = 2.6;
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
    const isLandscape = w >= h;

    // Square diamond grid rotated 45deg: overscanned generously so all 4 screen corners are filled cleanly
    const side = isLandscape ? 58 : 42;
    cols = side;
    rows = side;

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

        instMeta[p4] = initDark;
        const colorWave = Math.sin(c * 0.31 + r * 0.27) + Math.cos(c * 0.21 - r * 0.35);
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

  // Exact orthographic isometric projection matrix (matches 2:1 pixel art islands with zero perspective distortion)
  function makeIsoOrthoMatrix(aspect, orthoHalfH) {
    const halfW = orthoHalfH * aspect;
    const near = -120.0;
    const far = 120.0;

    // 1. Rotate world around Z by +45deg (yaw), then around X by -54.7356deg (pitch)
    // Screen X = (x*cosY - y*sinY)
    // Screen Y = (x*sinY + y*cosY)*cosP + z*sinP
    // Depth  Z = -(x*sinY + y*cosY)*sinP + z*cosP
    const sx = 1.0 / halfW;
    const sy = 1.0 / orthoHalfH;
    const sz = -2.0 / (far - near);

    // Column-major 4x4 matrix
    return new Float32Array([
      COS_Y * sx,           SIN_Y * COS_P * sy,  -SIN_Y * SIN_P * sz, 0,
     -SIN_Y * sx,           COS_Y * COS_P * sy,  -COS_Y * SIN_P * sz, 0,
      0,                    SIN_P * sy,           COS_P * sz,         0,
      0,                    0,                   -(far + near) / (far - near), 1
    ]);
  }

  // Inverse orthographic isometric projection: map screen NDC (nx, ny) directly onto Z = 0 ocean plane (wx, wy)
  function screenNdcToOceanPlane(nx, ny, aspect, orthoHalfH) {
    const halfW = orthoHalfH * aspect;
    const u = nx * halfW;                // x*cosY - y*sinY
    const v = (ny * orthoHalfH) / COS_P; // x*sinY + y*cosY (at z=0)
    return {
      wx: u * COS_Y + v * SIN_Y,
      wy: -u * SIN_Y + v * COS_Y
    };
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

      uniform mat4 u_mvp;

      varying vec3 v_norm;
      varying float v_lift;
      varying float v_dist;
      varying vec3 v_meta;

      void main() {
        float lift = a_inst.w;
        vec3 worldPos = vec3(a_inst.x + a_pos.x, a_inst.y + a_pos.y, lift + a_pos.z);
        gl_Position = u_mvp * vec4(worldPos, 1.0);

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

      varying vec3 v_norm;
      varying float v_lift;
      varying float v_dist;
      varying vec3 v_meta;

      vec3 getPastelTint(float idx) {
        if (idx < 0.5) return vec3(0.82, 0.90, 0.98); // Mist Sky Blue
        if (idx < 1.5) return vec3(0.83, 0.95, 0.90); // Sage Mint
        if (idx < 2.5) return vec3(0.98, 0.91, 0.83); // Warm Apricot Cream
        return vec3(0.91, 0.87, 0.97);                // Soft Lavender Mist
      }

      vec3 getArcadeBreathColor(float idx) {
        if (idx < 0.5) return vec3(0.28, 0.78, 0.95);
        if (idx < 1.5) return vec3(0.10, 0.84, 0.64);
        if (idx < 2.5) return vec3(0.70, 0.50, 0.98);
        return vec3(0.98, 0.78, 0.34);
      }

      void main() {
        // Distinct 3-face isometric shading: bright top, medium left-front, slightly cooler right-front
        float isTop = step(0.5, v_norm.z);
        float isLeftFace = step(0.5, -v_norm.y) + step(0.5, -v_norm.x);
        float faceShade = isTop > 0.5 ? 1.0 : (v_norm.x > 0.5 || v_norm.y < -0.5 ? 0.915 : 0.875);

        float darkBlend = v_meta.x;
        float pastelIdx = v_meta.y;
        float breathTint = v_meta.z;

        // 1. LIGHT MODE: Calm Architectural Isometric White Ocean
        vec3 whiteBase = vec3(0.976, 0.980, 0.990);
        vec3 lightCol = whiteBase * faceShade;

        vec3 pastel = getPastelTint(pastelIdx) * (isTop > 0.5 ? 1.0 : 0.92);
        if (breathTint > 0.01) {
          lightCol = mix(lightCol, pastel, breathTint * 0.78);
        }

        float lightLift = clamp((v_lift - 0.36) * 0.42, 0.0, 1.0);
        vec3 hoverPastel = mix(pastel, u_lightHover * (isTop > 0.5 ? 1.0 : 0.92), 0.35);
        lightCol = mix(lightCol, hoverPastel, lightLift * 0.85);

        // 2. DARK MODE: Deep Cyber Indigo Isometric Ocean + Arcade Breathing Glow
        vec3 darkTop = vec3(0.095, 0.115, 0.215);
        vec3 darkSideA = vec3(0.056, 0.068, 0.145);
        vec3 darkSideB = vec3(0.038, 0.048, 0.108);
        vec3 darkCol = isTop > 0.5 ? darkTop : (v_norm.x > 0.5 || v_norm.y < -0.5 ? darkSideA : darkSideB);

        if (breathTint > 0.01) {
          vec3 arcadeCol = getArcadeBreathColor(pastelIdx);
          vec3 arcadeShaded = arcadeCol * (isTop > 0.5 ? 0.64 : 0.36);
          darkCol = mix(darkCol, arcadeShaded, breathTint * 0.58);
        }

        float darkLift = clamp((v_lift - 0.30) * 0.40, 0.0, 1.0);
        darkCol = mix(darkCol, u_accent * (isTop > 0.5 ? 0.82 : 0.46), darkLift * 0.82);

        float darkVig = clamp(1.0 - v_dist * 0.014, 0.52, 1.0);
        darkCol *= darkVig;

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
      mvp: gl.getUniformLocation(prog, "u_mvp"),
      accent: gl.getUniformLocation(prog, "u_accent"),
      lightHover: gl.getUniformLocation(prog, "u_lightHover")
    };

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    let lockedW = 0;
    let lockedH = 0;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width || window.innerWidth));
      const h = Math.max(1, Math.round(rect.height || window.innerHeight));

      const orientationChanged = (lockedW >= lockedH) !== (w >= h);
      const widthChanged = Math.abs(w - lockedW) > 40;
      const majorHeightChanged = Math.abs(h - lockedH) > 180;

      if (lockedW === 0 || orientationChanged || widthChanged || majorHeightChanged) {
        lockedW = w;
        lockedH = h;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
        buildGrid();
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    window.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      mouseNdcX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNdcY = -((e.clientY / window.innerHeight) * 2 - 1);
      mouseActive = true;
    });
    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") return;
      mouseNdcX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNdcY = -((e.clientY / window.innerHeight) * 2 - 1);
      mouseActive = true;
      pulseWave = 0.85;
    });
    window.addEventListener("pointerleave", () => {
      mouseActive = false;
    });
  }

  function setTheme(hexColor) {
    targetAccentRgb = hexToRgb(hexColor);
    pulseWave = 0.72;
  }

  function setLightHoverTint(hexColor) {
    if (hexColor) {
      targetLightHoverRgb = hexToRgb(hexColor);
    } else {
      targetLightHoverRgb = [0.76, 0.86, 0.98];
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
      lightHoverRgb[i] += (targetLightHoverRgb[i] - lightHoverRgb[i]) * 0.12;
    }
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

    // Choose ortho half-height so the 45-degree rotated grid always covers all 4 screen corners with margin
    const maxWorldRadius = (cols - 4) * 0.5;
    const orthoHalfH = Math.min(
      (maxWorldRadius * 0.7071) / Math.max(aspect, 1.0),
      maxWorldRadius * 0.7071 * COS_P
    ) * 0.96;

    if (mouseActive) {
      const hit = screenNdcToOceanPlane(mouseNdcX, mouseNdcY, aspect, orthoHalfH);
      smoothWorldX += (hit.wx - smoothWorldX) * 0.22;
      smoothWorldY += (hit.wy - smoothWorldY) * 0.22;
    }

    const attractRadius = 4.6;
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

        // Gentle isometric ocean swell
        const slowWave =
          Math.sin(nowSec * 0.65 + gx * 0.22 + gy * 0.18 + phase * 0.18) * 0.5 +
          Math.cos(nowSec * 0.46 - gx * 0.16 + gy * 0.20) * 0.5;
        const crest = Math.max(0.0, (slowWave + 0.06) / 1.06);
        const breathFactor = Math.pow(crest, 1.5);
        const wave = currentMode === "light" ? (breathFactor * 0.85) : (breathFactor * 0.95 - 0.14);

        let pull = 0;
        if (mouseActive) {
          const dx = gx - smoothWorldX;
          const dy = gy - smoothWorldY;
          const d2 = dx * dx + dy * dy;
          if (d2 < r2Max) {
            const norm = 1.0 - Math.sqrt(d2) / attractRadius;
            pull = norm * norm * (2.3 + pulseWave * 0.7);
          }
        }

        let transitionCrest = 0;
        if (waveActive) {
          const nx = c / Math.max(cols - 1, 1);
          const diag = waveDirection === 1 ? (nx * 0.55 + ny * 0.45) : ((1.0 - nx) * 0.55 + (1.0 - ny) * 0.45);
          const distToFront = waveProgress - diag;
          transitionCrest = Math.exp(-distToFront * distToFront * 36.0) * 4.2;
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
      gl.clearColor(0.895, 0.910, 0.938, 1.0);
    } else {
      gl.clearColor(0.027, 0.035, 0.078, 1.0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(prog);

    const mvp = makeIsoOrthoMatrix(aspect, orthoHalfH);
    gl.uniformMatrix4fv(uniforms.mvp, false, mvp);
    gl.uniform3fv(uniforms.accent, accentRgb);
    gl.uniform3fv(uniforms.lightHover, lightHoverRgb);

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
