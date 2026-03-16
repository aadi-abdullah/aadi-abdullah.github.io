/* ============================================================
   scene.js  —  Three.js WebGL Shader Neural Network
   • Custom GLSL shaders → 1 draw call for all ~130 nodes
   • Scroll-driven rotation  •  Mouse parallax
   • Card-hover glow boost   •  Easter egg amber pulse
   • Dynamic quality (fewer nodes on mobile)
   Exposes: window.sceneHighlight(bool), window.sceneEasterEgg()
   ============================================================ */

(function () {

  var canvas = document.getElementById('heroCanvas');
  if (!canvas || !window.THREE) return;
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  /* ── renderer ── */
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  /* ── scene / camera ── */
  var scene  = new THREE.Scene();
  scene.fog  = new THREE.FogExp2(0x030309, 0.016);
  var camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.z = 30;

  var group = new THREE.Group();
  scene.add(group);

  /* ── quality tier ── */
  var isMob = window.innerWidth < 768;
  var COUNT = isMob ? 60 : 130;
  var CDIST = isMob ? 7.5 : 9.2;

  /* ── node attribute arrays ── */
  var positions = new Float32Array(COUNT * 3);
  var nodeTypes = new Float32Array(COUNT);   /* 0=dim  1=cyan  2=green */
  var phases    = new Float32Array(COUNT);
  var speeds    = new Float32Array(COUNT);

  for (var i = 0; i < COUNT; i++) {
    var phi   = Math.acos(1 - 2 * Math.random());
    var theta = Math.random() * Math.PI * 2;
    var r     = 9 + Math.random() * 13 + Math.pow(Math.random(), 2) * 5;
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    positions[i * 3 + 2] = r * Math.cos(phi);
    var roll   = Math.random();
    nodeTypes[i] = roll > 0.76 ? 2 : (roll > 0.52 ? 1 : 0);
    phases[i]    = Math.random() * Math.PI * 2;
    speeds[i]    = 0.5 + Math.random() * 0.9;
  }

  /* ── GLSL vertex shader ── */
  var vertSrc = [
    'attribute float nodeType;',
    'attribute float phase;',
    'attribute float speed;',
    'uniform float uTime;',
    'uniform float uHover;',
    'uniform float uEaster;',
    'varying float vType;',
    'varying float vPulse;',
    'void main(){',
    '  vType = nodeType;',
    '  float boost = nodeType > 0.5 ? (1.0 + uHover * 0.55) : 1.0;',
    '  float pulse = 1.0 + sin(uTime * speed + phase) * 0.22 * boost;',
    '  if(uEaster > 0.01 && nodeType > 1.5) pulse *= 1.0 + uEaster * 0.45;',
    '  vPulse = pulse;',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '  float base = nodeType > 1.5 ? 9.0 : (nodeType > 0.5 ? 6.0 : 2.8);',
    '  gl_PointSize = base * pulse * (280.0 / -mv.z);',
    '}'
  ].join('\n');

  /* ── GLSL fragment shader ── */
  var fragSrc = [
    'uniform float uEaster;',
    'varying float vType;',
    'varying float vPulse;',
    'void main(){',
    '  vec2 uv = gl_PointCoord - 0.5;',
    '  float d  = length(uv);',
    '  if(d > 0.5) discard;',
    '  float core  = smoothstep(0.5, 0.0, d);',
    '  float glow  = exp(-d * 5.5) * 0.7 * vPulse;',
    '  float alpha = (core * 0.9 + glow) * vPulse;',
    '  vec3 green = vec3(0.0,  1.0,   0.533);',
    '  vec3 cyan  = vec3(0.13, 0.827, 0.933);',
    '  vec3 amber = vec3(0.96, 0.62,  0.043);',
    '  vec3 dim   = vec3(0.08, 0.12,  0.196);',
    '  vec3 col;',
    '  if(vType > 1.5){',
    '    col = mix(green, amber, uEaster * 0.85);',
    '  } else if(vType > 0.5){',
    '    col = cyan;',
    '  } else {',
    '    col = dim; alpha *= 0.5;',
    '  }',
    '  float ring = smoothstep(0.5,0.3,d) * (1.0 - smoothstep(0.3,0.0,d));',
    '  col += (vType>1.5 ? mix(green,amber,uEaster) : cyan) * ring * 0.35;',
    '  gl_FragColor = vec4(col, alpha * alpha);',
    '}'
  ].join('\n');

  /* ── Points geometry ── */
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('nodeType', new THREE.BufferAttribute(nodeTypes, 1));
  geo.setAttribute('phase',    new THREE.BufferAttribute(phases,    1));
  geo.setAttribute('speed',    new THREE.BufferAttribute(speeds,    1));

  var uniforms = {
    uTime:   { value: 0 },
    uHover:  { value: 0 },
    uEaster: { value: 0 }
  };

  var mat = new THREE.ShaderMaterial({
    vertexShader:   vertSrc,
    fragmentShader: fragSrc,
    uniforms:       uniforms,
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.AdditiveBlending
  });

  group.add(new THREE.Points(geo, mat));

  /* ── Edge geometry ── */
  var ePos = [], cPos = [];
  for (var a = 0; a < COUNT; a++) {
    for (var b = a + 1; b < COUNT; b++) {
      var dx = positions[a*3]   - positions[b*3];
      var dy = positions[a*3+1] - positions[b*3+1];
      var dz = positions[a*3+2] - positions[b*3+2];
      var d  = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (d < CDIST) {
        ePos.push(positions[a*3],positions[a*3+1],positions[a*3+2],
                  positions[b*3],positions[b*3+1],positions[b*3+2]);
      }
      if (d < CDIST * 0.75 && (nodeTypes[a] === 1 || nodeTypes[b] === 1)) {
        cPos.push(positions[a*3],positions[a*3+1],positions[a*3+2],
                  positions[b*3],positions[b*3+1],positions[b*3+2]);
      }
    }
  }

  function addEdges(arr, color, opacity) {
    if (!arr.length) return;
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: opacity,
      blending: THREE.AdditiveBlending, depthWrite: false
    })));
  }
  addEdges(ePos, 0x00ff88, 0.038);
  if (cPos.length) addEdges(cPos, 0x22d3ee, 0.055);

  /* ── runtime state ── */
  var tRotX = 0, tRotY = 0;   /* target parallax */
  var cRotX = 0, cRotY = 0;   /* current parallax */
  var baseY = 0;
  var scrollY = 0;
  var tHover  = 0;
  var eTimer  = 0;

  /* ── input listeners ── */
  window.addEventListener('mousemove', function (e) {
    tRotY =  ((e.clientX / window.innerWidth)  - 0.5) * 0.52;
    tRotX = -((e.clientY / window.innerHeight) - 0.5) * 0.30;
  }, { passive: true });

  window.addEventListener('scroll', function () {
    scrollY = window.scrollY;
  }, { passive: true });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, { passive: true });

  /* ── public API ── */
  window.sceneHighlight = function (on) { tHover = on ? 1 : 0; };
  window.sceneEasterEgg = function ()   { eTimer = 120; };

  canvas.addEventListener('click', function () {
    eTimer = 120;
    var msg = document.getElementById('easterMsg');
    if (msg) {
      msg.classList.add('show');
      setTimeout(function () { msg.classList.remove('show'); }, 3200);
    }
  });

  /* ── render loop ── */
  var clock   = new THREE.Clock();
  var prevT   = 0;

  (function loop() {
    requestAnimationFrame(loop);
    var t   = clock.getElapsedTime();
    var dt  = Math.min(t - prevT, 0.05);
    prevT   = t;

    baseY  += dt * 0.042;
    cRotX  += (tRotX - cRotX) * 0.045;
    cRotY  += (tRotY - cRotY) * 0.045;

    group.rotation.y = baseY + cRotY + scrollY * 0.00016;
    group.rotation.x = cRotX;

    uniforms.uHover.value  += (tHover - uniforms.uHover.value) * 0.08;
    uniforms.uTime.value    = t;

    if (eTimer > 0) {
      eTimer--;
      uniforms.uEaster.value = Math.sin((eTimer / 120) * Math.PI);
    } else {
      uniforms.uEaster.value *= 0.92;
    }

    renderer.render(scene, camera);
  }());

}());
