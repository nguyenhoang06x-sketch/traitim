/* =========================================================================
   TRÁI TIM HẠT — nền đen
   Toàn bộ JavaScript:
     1) Sinh 65.000 hạt theo đường cong tim, LẤY MẪU ĐỀU THEO ĐỘ DÀI CUNG
        - 28.000 hạt VIỀN SÁNG NGOÀI: nét neon DÀY, lõi sáng ở giữa đường cong
        - 12.000 hạt VIỀN HỒNG ĐẬM TRONG: song song, cách viền ngoài 1.6 đơn vị
        - 25.000 hạt QUẦNG BỤI: bắt đầu từ mép ngoài viền dày rồi tản ra (Gauss)
     2) Shader tự viết: lấp lánh, trôi rung rất nhẹ, tim đập theo CẢM XÚC bài nhạc
        (phân tích Web Audio: bass/energy -> intensity -> BPM, biên độ, độ sáng)
     3) Lắc nhẹ ±20° + kéo xoay giới hạn (±35° Y, ±20° X), thả ra tự về giữa
     4) Nhạc: 1 bài lặp vô hạn, chỉ phát sau lần tương tác đầu tiên
   Chạy: `npx serve .` (nên chạy bằng server — xem music/README.txt)
   ========================================================================= */

/* =========================================================================
   1. CẤU HÌNH
   ========================================================================= */
const CONFIG = {
  /* --- VIỀN SÁNG NGOÀI (viền chính - nét neon dày) --- */
  outlineCount: 28000,      // số hạt viền sáng (cũ 15.000: viền dày hơn nên cần nhiều hạt)
  outlineSigma: 0.25,       // độ lệch Gauss VUÔNG GÓC với đường cong
  outlineMaxOffset: 0.70,   // xa nhất: bề dày nhìn thấy ~ 0.4 .. 0.7 (cũ 0.15 - 0.30)

  /* --- VIỀN HỒNG ĐẬM BÊN TRONG (viền thứ hai) --- */
  innerOutlineCount: 12000, // số hạt viền trong (cũ 6.000)
  innerGap: 1.60,           // ăn mòn vào trong 1.60 đơn vị -> viền trong SONG SONG
                            //   với viền ngoài nên khe hở đều và rõ (không dính nhau)
  innerSigma: 0.18,         // độ lệch Gauss vuông góc của viền trong
  innerMaxOffset: 0.50,     // xa nhất của viền trong (bề dày ~ 0.3 .. 0.5)
  innerArcShare: 0.05,      // tỉ lệ hạt dành cho CUNG BO ở lõm trên (khe lõm hẹp)

  /* --- CỠ HẠT CỦA 2 VIỀN --- */
  strokeSizeScale: 1.20,    // 1.2 = to hơn 20% cho nét "chắc" hơn (1.0 = như cũ)

  /* --- QUẦNG BỤI NGOÀI --- */
  haloCount: 25000,         // giữ nguyên số hạt quầng
  haloStart: 0.70,          // quầng BẮT ĐẦU từ mép ngoài viền dày (= outlineMaxOffset)
  haloTipFan: 0.04,         // tỉ lệ hạt rải thành QUẠT quanh mũi nhọn dưới (tránh lỗ tròn)
  haloNotchZone: 6.0,       // bán kính vùng khe lõm trên: nghiêng hướng đẩy cho khỏi lọt
  haloSigmaMin: 1.5,        // σ khoảng cách đẩy quầng (min)
  haloSigmaMax: 2.5,        // σ khoảng cách đẩy quầng (max)
  haloMax: 9,               // xa nhất của quầng
  zThickness: 0.40,         // độ dày trục Z một bên (±0.4 -> tim phẳng gọn)

  baseSizeWorld: 0.028,     // cỡ hạt -> hiển thị ~1–2px

  swayAngle: 20 * Math.PI / 180,   // lắc nhẹ ±20°
  swaySpeed: 0.55,                 // tốc độ lắc
  dragLimitY: 35 * Math.PI / 180,  // kéo xoay tối đa ±35° quanh Y
  dragLimitX: 20 * Math.PI / 180,  // và ±20° quanh X
  inertia: 0.92,                   // quán tính: nhân 0.92 mỗi frame
  returnEase: 0.94,                // thả ra thì tự về giữa

  heartHeightRatio: 0.60,          // tim chiếm ~60% chiều cao màn hình
  heartWidthLimit: 0.90,           // nhưng không tràn quá 90% bề ngang
};

/* =========================================================================
   1b. HẰNG SỐ "TIM ĐẬP THEO NHẠC" — CHỈNH Ở ĐÂY
   intensity (I) = độ sôi động của bài, 0..1 (0 = trầm lắng, 1 = cao trào)
   ========================================================================= */
const REACT = {
  /* --- Phân tích âm thanh --- */
  fftSize: 1024,            // kích thước FFT (số bin = fftSize/2)
  smoothing: 0.8,           // smoothingTimeConstant của AnalyserNode
  bassLowHz: 20,            // dải BASS: từ 20 Hz
  bassHighHz: 150,          //          đến 150 Hz
  intensitySmooth: 0.02,    // EMA của intensity mỗi frame (nhỏ = đổi chậm ~2–4 giây)
  normWindow: 20,           // số giây theo dõi min/max để chuẩn hoá thích nghi
  normMinRange: 0.06,       // khoảng min/max nhỏ nhất (tránh khuếch đại tạp âm)

  /* --- Nhịp đập theo cảm xúc (I) --- */
  bpmMin: 50,               // BPM giả lập ở khúc trầm lắng (I = 0)
  bpmMax: 120,              // BPM ở cao trào (I = 1)
  ampMin: 0.03,             // biên độ phồng nhẹ nhàng (3%)
  ampMax: 0.12,             // biên độ phồng ở cao trào (12%)
  glowMin: 0.8,             // uGlow khi trầm lắng
  glowMax: 1.6,             // uGlow khi cao trào
  spreadMin: 8.0,           // biên độ tản quầng ngoài khi trầm lắng
  spreadMax: 16.0,          // biên độ tản quầng ngoài khi cao trào
  jitterMin: 1.0,           // độ rung hạt nhẹ (hệ số nhân)
  jitterMax: 2.2,           // độ rung hạt khi cao trào ("sôi" hơn)

  /* --- Hình dạng nhịp "thình thịch" (2 nhịp/chu kỳ) --- */
  secondBeatOffset: 0.3,    // nhịp 2 lệch 0.3 chu kỳ
  secondBeatRatio: 0.6,     // nhịp 2 yếu hơn nhịp 1
  thumpPower: 6,            // số mũ tạo xung nhọn (càng lớn càng nhọn)

  /* --- Phát hiện tiếng trống (kick) --- */
  kickThreshold: 1.3,       // bass > 1.3 × trung bình trượt thì tính là kick
  kickMinMs: 250,           // hai kick phải cách nhau ≥ 250 ms
  kickAvgTau: 0.8,          // hằng số thời gian của trung bình bass (giây)
  kickDecay: 0.9,           // mỗi frame nhân 0.9 (xung tắt dần)
  kickScale: 0.05,          // kick cộng ~3–6% vào scale (nhân với I)
  kickGlow: 0.35,           // kick cộng thêm độ sáng (nhân với I)

  /* --- Làm mượt giá trị đưa vào shader (giây, tau của hàm mũ) --- */
  smoothIntensity: 0.50,
  smoothBpm: 0.60,
  smoothAmp: 0.30,
  smoothGlow: 0.25,
  smoothSpread: 0.40,
  smoothJitter: 0.40,

  /* --- Khi KHÔNG có nhạc (chưa phát / pause / Web Audio lỗi) --- */
  idleIntensity: 0.25,      // I trôi về mức này
  idleBpm: 60,              // nhịp mặc định 60 BPM
  idleAmp: 0.05,            // biên độ mặc định 5%
  idleGlow: 0.9,
};

/* =========================================================================
   2. ĐƯỜNG CONG TIM + BẢNG ĐỘ DÀI CUNG
   x = 16·sin³t ;  y = 13·cos t − 5·cos 2t − 2·cos 3t − cos 4t
   Lấy mẫu đều theo CUNG (không theo t) để hạt không dồn thành vệt
   ở chỗ lõm trên và mũi nhọn dưới (tại đó vận tốc đường cong = 0).
   ========================================================================= */

const CURVE_STEPS = 4000;                       // độ mịn của bảng tra
const arcX = new Float32Array(CURVE_STEPS + 1);
const arcY = new Float32Array(CURVE_STEPS + 1);
const arcS = new Float32Array(CURVE_STEPS + 1); // độ dài cung luỹ tiến

/* Kích thước bao của trái tim (được điền ngay bên dưới) */
const HEART_SIZE = { xMin: 0, xMax: 0, yMin: 0, yMax: 0, cx: 0, cy: 0, w: 32, h: 28.9 };

/* Vừa dựng bảng, vừa lấy kích thước bao của trái tim */
const ARC_TOTAL = (function buildArcTable() {
  let total = 0, px = 0, py = 0;
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;

  for (let i = 0; i <= CURVE_STEPS; i++) {
    const t = (i / CURVE_STEPS) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);

    arcX[i] = x;
    arcY[i] = y;
    if (i > 0) total += Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
    arcS[i] = total;

    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;

    px = x; py = y;
  }

  /* Lưu kích thước bao để căn giữa và khớp khung nhìn */
  HEART_SIZE.xMin = xMin; HEART_SIZE.xMax = xMax;
  HEART_SIZE.yMin = yMin; HEART_SIZE.yMax = yMax;
  HEART_SIZE.cx = (xMin + xMax) / 2;
  HEART_SIZE.cy = (yMin + yMax) / 2;
  HEART_SIZE.w = xMax - xMin;
  HEART_SIZE.h = yMax - yMin;

  return total;
})();

/* Toạ độ điểm trên đường cong tại độ dài cung s (tìm nhị phân) */
function positionAtArc(s, out) {
  if (s <= 0) { out.x = arcX[0]; out.y = arcY[0]; return out; }
  if (s >= ARC_TOTAL) { out.x = arcX[CURVE_STEPS]; out.y = arcY[CURVE_STEPS]; return out; }

  let lo = 0, hi = CURVE_STEPS;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arcS[mid] <= s) lo = mid; else hi = mid;
  }

  const segLen = arcS[hi] - arcS[lo] || 1e-6;
  const k = (s - arcS[lo]) / segLen;
  out.x = arcX[lo] + (arcX[hi] - arcX[lo]) * k;
  out.y = arcY[lo] + (arcY[hi] - arcY[lo]) * k;
  return out;
}

const _pA = { x: 0, y: 0 };
const _pB = { x: 0, y: 0 };
/* Điểm + pháp tuyến trả về của sampleAtArc (tách khỏi _pA/_pB để không bị ghi đè) */
const _pOut = { x: 0, y: 0, nx: 0, ny: 0 };

/* Lấy điểm + pháp tuyến (hướng RA NGOÀI) tại độ dài cung s.
   Tiếp tuyến tính trên một cửa sổ nhỏ (±0.03) nên ở hai mũi nhọn
   (nơi vận tốc đường cong triệt tiêu) pháp tuyến vẫn mượt, không bị loé. */
function sampleAtArc(s, out) {
  positionAtArc(s, out);

  const d = 0.03;
  positionAtArc(Math.max(0, s - d), _pA);
  positionAtArc(Math.min(ARC_TOTAL, s + d), _pB);

  let tx = _pB.x - _pA.x;
  let ty = _pB.y - _pA.y;
  const len = Math.sqrt(tx * tx + ty * ty) || 1;
  tx /= len; ty /= len;

  out.nx = -ty;      // đường cong đi theo chiều kim đồng hồ -> pháp tuyến ra ngoài
  out.ny = tx;
  return out;
}

/* Số ngẫu nhiên Gauss (tổng 4 số đều, chuẩn hoá) */
function gauss() {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 0.577;
}

/* Độ dày trục Z rất mỏng, dạng chuông trong ±0.4 */
function thinDepth(k) {
  const z = gauss() * 0.16 * (k || 1);
  return Math.max(-CONFIG.zThickness, Math.min(CONFIG.zThickness, z));
}

/* =========================================================================
   2b. ĐƯỜNG CONG TRONG (dùng cho VIỀN HỒNG ĐẬM BÊN TRONG)
   Đường cong trong = đường cong ngoài DỊCH VÀO TRONG `innerGap` đơn vị theo
   pháp tuyến. Nhờ vậy khe hở giữa hai viền đều nhau; nếu chỉ thu nhỏ theo tâm
   thì ở lõm trên và mũi dưới hai viền sẽ chồng lên nhau.

   Hai mũi nhọn phải xử lý riêng vì độ dài cung ở đó gần như bằng 0:
     - LÕM TRÊN (0, 5)  : khe lõm rất hẹp nên đường ăn mòn bị HỞ -> nối bằng
                          CUNG TRÒN bán kính `innerGap` quanh đỉnh lõm.
     - MŨI DƯỚI (0,-17) : mũi hẹp hơn 2*innerGap -> bỏ đoạn sát mũi, hai nhánh
                          ăn mòn gặp nhau thành chữ V nhọn (đúng dạng thật).
   ========================================================================= */

const S_TIP      = arcS[CURVE_STEPS >> 1];                        // độ dài cung tới mũi nhọn dưới
const CUSP_NOTCH = { x: arcX[0], y: arcY[0] };                    // lõm trên  = (0, 5)
const CUSP_TIP   = { x: arcX[CURVE_STEPS >> 1], y: arcY[CURVE_STEPS >> 1] };  // mũi dưới = (0,-17)
const TIP_SKIP   = 3.2;                                           // bỏ ±3.2 đơn vị cung quanh mũi dưới

/* Góc của 2 đầu cung bo ở lõm trên (lấy đúng điểm ăn mòn sát hai bên lõm) */
const INNER_ARC = (function () {
  const q = { x: 0, y: 0, nx: 0, ny: 0 };
  const ang = (s) => {
    sampleAtArc(s, q);
    return Math.atan2(q.y - q.ny * CONFIG.innerGap - CUSP_NOTCH.y,
                      q.x - q.nx * CONFIG.innerGap - CUSP_NOTCH.x);
  };
  return { a0: ang(0.05), a1: ang(ARC_TOTAL - 0.05) };
})();

/* Lấy 1 điểm trên ĐƯỜNG CONG TRONG + pháp tuyến của nó */
function innerSample(out) {
  const gap = CONFIG.innerGap;

  /* (a) một phần hạt rải trên CUNG BO quanh lõm trên */
  if (Math.random() < CONFIG.innerArcShare) {
    const a = INNER_ARC.a0 + (INNER_ARC.a1 - INNER_ARC.a0) * Math.random();
    out.nx = Math.cos(a); out.ny = Math.sin(a);
    out.x = CUSP_NOTCH.x + out.nx * gap;
    out.y = CUSP_NOTCH.y + out.ny * gap;
    return out;
  }

  /* (b) phần còn lại: dịch đường cong vào trong `gap` (bỏ đoạn sát mũi dưới) */
  let s;
  do { s = Math.random() * ARC_TOTAL; } while (Math.abs(s - S_TIP) < TIP_SKIP);
  sampleAtArc(s, out);
  out.x -= out.nx * gap;
  out.y -= out.ny * gap;
  return out;
}

/* =========================================================================
   3. SINH HẠT
   Mỗi hạt: vị trí, màu, cỡ, pha (aSeed), hướng tản (aDir), mức hiệu ứng (aHalo)
   ========================================================================= */

function createParticleGeometry(count, fill) {
  const pos  = new Float32Array(count * 3);
  const col  = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const seed = new Float32Array(count);
  const dir  = new Float32Array(count * 2);
  const halo = new Float32Array(count);

  for (let i = 0; i < count; i++) fill(i, pos, col, size, seed, dir, halo);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aColor",   new THREE.BufferAttribute(col, 3));
  g.setAttribute("aSize",    new THREE.BufferAttribute(size, 1));
  g.setAttribute("aSeed",    new THREE.BufferAttribute(seed, 1));
  g.setAttribute("aDir",     new THREE.BufferAttribute(dir, 2));
  g.setAttribute("aHalo",    new THREE.BufferAttribute(halo, 1));
  return g;
}

/* --- 3.1 VIỀN SÁNG NGOÀI (~28.000 hạt): nét neon DÀY, lõi sáng ở giữa --- */
function buildOutlineGeometry() {
  return createParticleGeometry(CONFIG.outlineCount, (i, pos, col, size, seed, dir, halo) => {
    const p = sampleAtArc(Math.random() * ARC_TOTAL, _pOut);

    /* Lệch VUÔNG GÓC theo phân bố GAUSS: hạt dày đặc đúng trên đường cong rồi
       thưa dần ra hai mép -> giống nét neon phát sáng mềm (bề dày ~ 0.4 .. 0.7) */
    let off = gauss() * CONFIG.outlineSigma;
    if (off >  CONFIG.outlineMaxOffset) off =  CONFIG.outlineMaxOffset;
    if (off < -CONFIG.outlineMaxOffset) off = -CONFIG.outlineMaxOffset;

    pos[i * 3]     = p.x + p.nx * off - HEART_SIZE.cx;
    pos[i * 3 + 1] = p.y + p.ny * off - HEART_SIZE.cy;
    pos[i * 3 + 2] = thinDepth();

    const tint = 0.80 + Math.random() * 0.35;          // hồng sáng (1.0, 0.4, 0.7)
    col[i * 3]     = 1.00 * tint;
    col[i * 3 + 1] = 0.40 * tint;
    col[i * 3 + 2] = 0.70 * tint;

    size[i] = (1.00 + Math.random() * 0.45) * CONFIG.strokeSizeScale;  // to hơn 20%
    seed[i] = Math.random();
    dir[i * 2]     = p.nx;
    dir[i * 2 + 1] = p.ny;
    halo[i] = 0.25;                                     // đập thì nở nhẹ
  });
}

/* --- 3.2 VIỀN HỒNG ĐẬM BÊN TRONG (~12.000 hạt): song song, cách 1.6 đơn vị --- */
function buildInnerOutlineGeometry() {
  return createParticleGeometry(CONFIG.innerOutlineCount, (i, pos, col, size, seed, dir, halo) => {
    const p = innerSample(_pOut);

    /* Lệch Gauss quanh đường cong trong -> nét mềm, bề dày ~ 0.3 .. 0.5 */
    let off = gauss() * CONFIG.innerSigma;
    if (off >  CONFIG.innerMaxOffset) off =  CONFIG.innerMaxOffset;
    if (off < -CONFIG.innerMaxOffset) off = -CONFIG.innerMaxOffset;

    pos[i * 3]     = p.x + p.nx * off - HEART_SIZE.cx;
    pos[i * 3 + 1] = p.y + p.ny * off - HEART_SIZE.cy;
    pos[i * 3 + 2] = thinDepth();

    const tint = 0.70 + Math.random() * 0.30;          // hồng đậm nhưng rõ hơn trước
    col[i * 3]     = 0.95 * tint;
    col[i * 3 + 1] = 0.20 * tint;
    col[i * 3 + 2] = 0.50 * tint;

    size[i] = (0.75 + Math.random() * 0.35) * CONFIG.strokeSizeScale;  // to hơn 20%
    seed[i] = Math.random();
    dir[i * 2]     = p.nx;
    dir[i * 2 + 1] = p.ny;
    halo[i] = 0.15;
  });
}

/* --- 3.3 QUẦNG BỤI NGOÀI (~25.000 hạt): đẩy ra NGOÀI, bắt đầu từ mép viền --- */
function buildHaloGeometry() {
  return createParticleGeometry(CONFIG.haloCount, (i, pos, col, size, seed, dir, halo) => {
    let bx, by, nx, ny;                                 // gốc + hướng đẩy ra ngoài

    if (Math.random() < CONFIG.haloTipFan) {
      /* MŨI NHỌN DƯỚI: mũi quá bé nên pháp tuyến ở đó quay gần 180° trong một
         đoạn cung cực ngắn -> hạt sinh theo cung sẽ rất thưa, quầng bị "lỗ tròn"
         ngay dưới mũi. Vì vậy rải hẳn một phần hạt theo GÓC quanh mũi nhọn. */
      const a = Math.PI + Math.random() * Math.PI;      // nửa dưới: 180° -> 360°
      nx = Math.cos(a); ny = Math.sin(a);
      bx = CUSP_TIP.x + (Math.random() - 0.5) * 0.4;
      by = CUSP_TIP.y + (Math.random() - 0.5) * 0.2;
    } else {
      const p = sampleAtArc(Math.random() * ARC_TOTAL, _pOut);
      bx = p.x; by = p.y; nx = p.nx; ny = p.ny;

      /* Sát LÕM TRÊN, pháp tuyến gần như nằm ngang -> đẩy ngang sẽ xuyên qua khe
         lõm sang thuỳ bên kia (hạt lọt vào trong tim). Khe lõm rất hẹp nên hướng
         ra ngoài ĐÚNG phải dọc theo khe -> nghiêng dần về phương thẳng đứng. */
      const dn = Math.hypot(bx - CUSP_NOTCH.x, by - CUSP_NOTCH.y);
      if (dn < CONFIG.haloNotchZone) {
        const mix = 0.85 * (1 - dn / CONFIG.haloNotchZone);
        nx *= (1 - mix);
        ny = ny * (1 - mix) + mix;
        const L = Math.hypot(nx, ny) || 1;
        nx /= L; ny /= L;
      }
    }

    /* Khoảng cách: bắt đầu từ MÉP NGOÀI của viền dày mới rồi tản theo Gauss */
    const sigma = CONFIG.haloSigmaMin + Math.random() * (CONFIG.haloSigmaMax - CONFIG.haloSigmaMin);
    let d = CONFIG.haloStart + Math.abs(gauss()) * sigma;
    if (d > CONFIG.haloMax) d = CONFIG.haloMax;

    // chút xê dịch theo phương tiếp tuyến cho quầng tự nhiên, không bị "xếp hàng"
    const tj = gauss() * 0.30 * (0.4 + d * 0.4);
    const tx = ny, ty = -nx;

    pos[i * 3]     = bx + nx * d + tx * tj - HEART_SIZE.cx;
    pos[i * 3 + 1] = by + ny * d + ty * tj - HEART_SIZE.cy;
    pos[i * 3 + 2] = thinDepth(1.1);

    // gần viền: hồng nhạt (1.0, 0.55, 0.8) -> xa: hồng sẫm (0.72, 0.12, 0.38)
    const k = Math.min(1, (d - CONFIG.haloStart) / (CONFIG.haloMax - CONFIG.haloStart));
    const r = 1.00 + (0.72 - 1.00) * k;
    const g = 0.55 + (0.12 - 0.55) * k;
    const b = 0.80 + (0.38 - 0.80) * k;
    const fade = 1 - k * 0.72;                          // càng xa càng mờ

    col[i * 3]     = r * fade;
    col[i * 3 + 1] = g * fade;
    col[i * 3 + 2] = b * fade;

    size[i] = (0.95 - k * 0.50) * (0.75 + Math.random() * 0.50);
    seed[i] = Math.random();
    dir[i * 2]     = nx;
    dir[i * 2 + 1] = ny;
    halo[i] = 1.0;                                      // đập thì tản ra mạnh nhất
  });
}

/* =========================================================================
   4. SHADER HẠT
   ========================================================================= */

const VERTEX_SHADER = `
  attribute vec3  aColor;
  attribute float aSize;
  attribute float aSeed;
  attribute vec2  aDir;
  attribute float aHalo;

  uniform float uTime;
  uniform float uBeat;        // biên độ đập hiện tại (nhịp nền + xung kick)
  uniform float uGlow;        // độ rực (theo cảm xúc I + kick)
  uniform float uSpread;      // biên độ tản quầng ngoài (tăng theo I)
  uniform float uJitter;      // độ rung của hạt (tăng nhẹ theo I)
  uniform float uSizeFactor;  // quy đổi cỡ hạt ra pixel

  varying vec3 vColor;

  void main() {
    float phase = aSeed * 6.2831853;

    /* 1) Trôi rung RẤT nhẹ (biên độ nhỏ, không tạo vệt/đuôi).
          Khúc cao trào (uJitter lớn) thì hạt "sôi" hơn một chút. */
    vec3 p = position;
    p.x += sin(uTime * 0.80 + phase)       * 0.022 * uJitter;
    p.y += cos(uTime * 0.70 + phase * 1.7) * 0.022 * uJitter;
    p.z += sin(uTime * 0.60 + phase * 2.3) * 0.018 * uJitter;

    /* 2) Tim đập: hạt quầng ngoài tản ra rồi thu về.
          uSpread tăng theo cảm xúc -> cao trào thì quầng tản xa hơn */
    p.xy += aDir * (uBeat * aHalo * uSpread);

    /* 3) Cả trái tim phồng lên khi đập (~6%) */
    p *= (1.0 + uBeat);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    /* 4) Lấp lánh theo pha riêng từng hạt + sáng lên khi đập / có bass */
    float flick = 0.65 + 0.35 * sin(uTime * 2.2 + aSeed * 40.0);
    vColor = aColor * flick * (0.85 + uGlow * 0.5 + uBeat * 3.0);

    gl_PointSize = max(uSizeFactor * aSize / max(-mv.z, 0.001), 1.0);
  }
`;

const FRAGMENT_SHADER = `
  varying vec3 vColor;

  void main() {
    /* Hạt tròn mềm: cắt góc vuông, mờ dần ra mép */
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = dot(c, c);
    if (d > 0.25) discard;
    float a = smoothstep(0.25, 0.02, d);
    gl_FragColor = vec4(vColor, a);
  }
`;

/* =========================================================================
   5. BIẾN TOÀN CỤC
   ========================================================================= */

let scene, camera, renderer, clock;
let heartGroup, heartMaterial, uniforms;

const spin = { rotX: 0, rotY: 0, velX: 0, velY: 0, dragging: false, lastX: 0, lastY: 0 };

/* Nhạc */
let audioEl = null, elToggle = null, elHint = null, elMsg = null;
let hasInteracted = false;     // đã có tương tác đầu tiên chưa
let audioLoadFailed = false;   // thẻ audio báo lỗi (thiếu/không đọc được file)

/* Web Audio (chỉ tạo SAU tương tác đầu tiên, đúng 1 lần) */
const wa = { tried: false, ready: false, ctx: null, analyser: null, source: null, data: null };

/* =========================================================================
   6. KHỞI TẠO CẢNH
   ========================================================================= */

function initScene() {
  const canvas = document.getElementById("scene");
  const w = window.innerWidth;
  const h = window.innerHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 300);
  camera.position.set(0, 0, 17);          // nhìn chính diện
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));   // tối đa 2
  renderer.setSize(w, h);

  clock = new THREE.Clock();

  uniforms = {
    uTime:       { value: 0 },
    uBeat:       { value: 0 },
    uGlow:       { value: REACT.idleGlow },
    uSpread:     { value: REACT.spreadMin },
    uJitter:     { value: REACT.jitterMin },
    uSizeFactor: { value: 120 },
  };

  heartMaterial = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    transparent: true,
  });

  heartGroup = new THREE.Group();
  heartGroup.add(makePoints(buildOutlineGeometry()));
  heartGroup.add(makePoints(buildInnerOutlineGeometry()));
  heartGroup.add(makePoints(buildHaloGeometry()));
  scene.add(heartGroup);

  fitView();
  setupPointer();
}

function makePoints(geometry) {
  const points = new THREE.Points(geometry, heartMaterial);
  points.frustumCulled = false;      // hạt còn bị đẩy trong shader
  return points;
}

/* =========================================================================
   7. KHỚP KHUNG NHÌN: tim ~60% chiều cao, không bị cắt ở mép
   ========================================================================= */

function fitView() {
  if (!camera) return;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;

  camera.aspect = aspect;
  camera.position.set(0, 0, 17);
  camera.updateProjectionMatrix();

  const halfFov = (camera.fov * Math.PI / 180) / 2;
  const viewH = 2 * 17 * Math.tan(halfFov);
  const viewW = viewH * aspect;

  let scale = Math.min(
    (CONFIG.heartHeightRatio * viewH) / HEART_SIZE.h,
    (CONFIG.heartWidthLimit * viewW) / HEART_SIZE.w
  );
  heartGroup.scale.setScalar(scale);

  /* Cỡ hạt tính theo pixel -> giữ đúng 1–2px trên mọi màn hình */
  const pr = renderer.getPixelRatio();
  uniforms.uSizeFactor.value = (h * pr) / (2 * Math.tan(halfFov)) * CONFIG.baseSizeWorld;
}

function onResize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  fitView();
}

/* =========================================================================
   8. KÉO XOAY (giới hạn, thả ra tự về giữa) + LẮC NHẸ
   ========================================================================= */

function setupPointer() {
  const canvas = renderer.domElement;

  canvas.addEventListener("pointerdown", (e) => {
    spin.dragging = true;
    spin.lastX = e.clientX;
    spin.lastY = e.clientY;
    spin.velX = 0;
    spin.velY = 0;
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!spin.dragging) return;

    const dx = e.clientX - spin.lastX;
    const dy = e.clientY - spin.lastY;
    spin.lastX = e.clientX;
    spin.lastY = e.clientY;

    const k = 0.005;
    spin.rotY += dx * k;
    spin.rotX += dy * k;

    clampRotation();

    spin.velY = dx * k;      // quán tính khi nhả tay
    spin.velX = dy * k;
  });

  const endDrag = () => { spin.dragging = false; };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", endDrag);
}

/* Kẹp góc kéo trong giới hạn cho phép */
function clampRotation() {
  spin.rotY = Math.max(-CONFIG.dragLimitY, Math.min(CONFIG.dragLimitY, spin.rotY));
  spin.rotX = Math.max(-CONFIG.dragLimitX, Math.min(CONFIG.dragLimitX, spin.rotX));
}

/* Ghi chú: trước đây có hiệu ứng "con trỏ tới gần thì hạt tản ra", nhưng chính nó
   tạo ra một VÙNG TRÒN ĐEN (khuyết hạt) ngay tại vị trí con trỏ, nằm ngay cạnh
   viền ngoài. Đã bỏ để quầng hạt phân bố đều. Kéo xoay vẫn hoạt động bình thường. */

/* Cập nhật xoay mỗi frame: lắc nhẹ ±20° + kéo (có quán tính) + tự về giữa */
function updateRotation(dt, time) {
  const damp = Math.pow(CONFIG.inertia, dt * 60);

  if (!spin.dragging) {
    // quán tính giảm dần
    spin.velY *= damp;
    spin.velX *= damp;
    spin.rotY += spin.velY;
    spin.rotX += spin.velX;

    // thả ra thì tự về giữa
    const back = Math.pow(CONFIG.returnEase, dt * 60);
    spin.rotY *= back;
    spin.rotX *= back;

    if (Math.abs(spin.rotY) < 0.0005) spin.rotY = 0;
    if (Math.abs(spin.rotX) < 0.0005) spin.rotX = 0;
  }

  clampRotation();

  // lắc nhẹ trái phải quanh trục Y (không xoay tròn 360°)
  const sway = Math.sin(time * CONFIG.swaySpeed) * CONFIG.swayAngle;

  heartGroup.rotation.y = sway + spin.rotY;
  heartGroup.rotation.x = spin.rotX;
}

/* =========================================================================
   9. NHỊP ĐẬP THEO CẢM XÚC CỦA BÀI NHẠC
   - bass     : năng lượng dải trầm (20–150 Hz)            -> bắt tiếng trống
   - energy   : năng lượng toàn dải (RMS)                  -> độ sôi động tức thời
   - intensity: trung bình trượt CHẬM của energy           -> "cảm xúc" của bài
   - I        : intensity đã chuẩn hoá thích nghi 0..1      -> 0 = trầm lắng, 1 = cao trào
   Mọi giá trị đưa vào shader đều được làm mượt bằng hàm mũ qua từng frame.
   ========================================================================= */

const TAU_FULL = Math.PI * 2;

/* Trạng thái sống của phần "đập theo nhạc" */
const react = {
  bass: 0, energy: 0, intensity: 0,
  I: 0,                                        // 0..1 sau khi chuẩn hoá thích nghi
  normMin: 0, normMax: 0.1, normInit: false,   // biên độ min/max thích nghi
  bpm: REACT.idleBpm, phase: 0,                // bộ cộng pha (không dùng sin(t*bpm))
  amp: REACT.idleAmp, glow: REACT.idleGlow,
  spread: REACT.spreadMin, jitter: REACT.jitterMin,
  kickPulse: 0, bassAvg: 0.05, lastKickMs: -1e9, nowMs: 0,
  bassFrom: 1, bassTo: 3,                      // khoảng bin của dải bass
};

/* Làm mượt theo hàm mũ: cur -> target, hằng số thời gian tau (giây) */
function lerpTo(cur, target, dt, tau) {
  const k = 1 - Math.exp(-dt / Math.max(0.0001, tau));
  return cur + (target - cur) * k;
}

/* Đọc AnalyserNode mỗi frame -> cập nhật bass / energy / intensity / kick.
   Trả về các GIÁ TRỊ MỤC TIÊU cho nhịp đập. */
function analyzeMusic(dt) {
  react.nowMs += dt * 1000;

  /* Không có nhạc (chưa phát / pause) hoặc Web Audio không dùng được:
     trả về nhịp MẶC ĐỊNH, tim vẫn đập chậm rãi. */
  if (!isMusicPlaying() || !wa.ready) {
    react.kickPulse *= REACT.kickDecay;
    return {
      iTarget: REACT.idleIntensity,
      bpmTarget: REACT.idleBpm,
      ampTarget: REACT.idleAmp,
      glowTarget: REACT.idleGlow,
    };
  }

  const data = wa.data;                     // Uint8Array tái sử dụng, không tạo mảng mới
  wa.analyser.getByteFrequencyData(data);

  /* a) BASS: trung bình các bin tần số thấp (~20–150 Hz) */
  let sumBass = 0, nBass = 0;
  for (let i = react.bassFrom; i <= react.bassTo; i++) { sumBass += data[i]; nBass++; }
  const bass = nBass ? (sumBass / nBass) / 255 : 0;         // chuẩn hoá 0..1

  /* b) ENERGY: RMS toàn dải */
  let sumSq = 0;
  for (let i = 0; i < data.length; i++) { const v = data[i]; sumSq += v * v; }
  const energy = Math.sqrt(sumSq / data.length) / 255;      // chuẩn hoá 0..1

  react.bass = bass;
  react.energy = energy;

  /* intensity: trung bình trượt CHẬM (khoảng 2–4 giây mới đổi trạng thái) */
  react.intensity += (energy - react.intensity) * REACT.intensitySmooth;

  /* Chuẩn hoá thích nghi: bám min/max của intensity trong ~20 giây,
     min/max tự suy giảm dần về giữa nên bài nào cũng có đoạn nhẹ/đoạn mạnh rõ. */
  if (!react.normInit) {
    react.normInit = true;
    react.normMin = react.intensity;
    react.normMax = react.intensity + 0.02;
  }
  const kN = Math.min(1, dt / REACT.normWindow);            // tốc độ suy giảm về giữa
  if (react.intensity > react.normMax) react.normMax = react.intensity;   // bám đỉnh
  else react.normMax += (react.intensity - react.normMax) * kN;
  if (react.intensity < react.normMin) react.normMin = react.intensity;   // bám đáy
  else react.normMin += (react.intensity - react.normMin) * kN;

  const range = Math.max(REACT.normMinRange, react.normMax - react.normMin);
  const iTarget = Math.max(0, Math.min(1, (react.intensity - react.normMin) / range));

  /* PHÁT HIỆN KICK: bass vượt ~1.3 lần trung bình trượt của chính nó,
     và cách cú kick trước ít nhất 250 ms */
  if (bass > react.bassAvg * REACT.kickThreshold &&
      (react.nowMs - react.lastKickMs) > REACT.kickMinMs) {
    react.lastKickMs = react.nowMs;
    react.kickPulse = 1;                                    // xung kick, tắt dần mỗi frame
  }
  react.bassAvg += (bass - react.bassAvg) * Math.min(1, dt / REACT.kickAvgTau);

  return {
    iTarget: iTarget,
    bpmTarget: REACT.bpmMin + (REACT.bpmMax - REACT.bpmMin) * iTarget,
    ampTarget: REACT.ampMin + (REACT.ampMax - REACT.ampMin) * iTarget,
    glowTarget: REACT.glowMin + (REACT.glowMax - REACT.glowMin) * iTarget,
  };
}

function updateBeat(dt) {
  const target = analyzeMusic(dt);

  /* --- Làm mượt mọi giá trị đưa vào shader (không gán trực tiếp) --- */
  react.I      = lerpTo(react.I, target.iTarget, dt, REACT.smoothIntensity);
  react.bpm    = lerpTo(react.bpm, target.bpmTarget, dt, REACT.smoothBpm);
  react.amp    = lerpTo(react.amp, target.ampTarget, dt, REACT.smoothAmp);
  react.glow   = lerpTo(react.glow, target.glowTarget, dt, REACT.smoothGlow);
  react.spread = lerpTo(react.spread,
    REACT.spreadMin + (REACT.spreadMax - REACT.spreadMin) * react.I, dt, REACT.smoothSpread);
  react.jitter = lerpTo(react.jitter,
    REACT.jitterMin + (REACT.jitterMax - REACT.jitterMin) * react.I, dt, REACT.smoothJitter);

  /* --- BỘ CỘNG PHA: phase += dt * (bpm/60)
         Nhờ cộng pha nên khi đổi tốc độ nhịp KHÔNG bị nhảy giật --- */
  react.phase += dt * (react.bpm / 60);
  const s = react.phase - Math.floor(react.phase);          // vị trí trong chu kỳ, 0..1

  /* Nhịp 1 mạnh ở đầu chu kỳ; nhịp 2 yếu hơn, lệch 0.3 chu kỳ.
     Mỗi nhịp là một xung nhọn: pow(max(0, cos), 6) */
  const p1 = Math.pow(Math.max(0, Math.cos(s * TAU_FULL)), REACT.thumpPower);
  const s2 = s - REACT.secondBeatOffset;
  const p2 = Math.pow(Math.max(0, Math.cos(s2 * TAU_FULL)), REACT.thumpPower) * REACT.secondBeatRatio;

  /* Độ đập = nhịp nền theo cảm xúc + xung tiếng trống (kick, nhân với I
     nên khúc nhẹ gần như tắt hẳn hiệu ứng kick) */
  const kickScale = react.kickPulse * REACT.kickScale * react.I;

  /* uBeat là XUNG nhịp nên gán trực tiếp để giữ độ nhọn;
     biên độ (amp) và cảm xúc (I) đã được làm mượt ở trên rồi. */
  uniforms.uBeat.value   = (p1 + p2) * react.amp + kickScale;
  uniforms.uGlow.value   = react.glow + react.kickPulse * REACT.kickGlow * react.I;
  uniforms.uSpread.value = react.spread;
  uniforms.uJitter.value = react.jitter;

  react.kickPulse *= REACT.kickDecay;      // xung kick giảm dần mỗi frame
  updateDebugHud();
}

/* =========================================================================
   10. NHẠC — 1 bài lặp vô hạn, chỉ phát sau tương tác đầu tiên
   ========================================================================= */

function initMusic() {
  audioEl  = document.getElementById("player");
  elToggle = document.getElementById("musicToggle");
  elHint   = document.getElementById("tapHint");
  elMsg    = document.getElementById("msg");

  audioEl.loop = true;
  audioEl.volume = 0.85;

  /* Nút ♪: bật / tắt nhạc */
  elToggle.addEventListener("click", () => {
    hasInteracted = true;
    if (audioEl.paused) playMusic(); else audioEl.pause();
  });

  /* Icon tự cập nhật đúng khi nhạc bị dừng từ bên ngoài */
  audioEl.addEventListener("play", () => { hideHint(); updateToggleState(); });
  audioEl.addEventListener("pause", updateToggleState);
  audioEl.addEventListener("error", () => {
    audioLoadFailed = true;
    if (hasInteracted) showMsg("Không tải được nhạc — kiểm tra file music/song.mp3.", true);
  });

  /* Lắng nghe LẦN TƯƠNG TÁC ĐẦU TIÊN (một lần) */
  bindFirstInteraction();

  updateToggleState();   // trạng thái ban đầu: chưa phát
}

/* Gắn listener once cho pointerdown / touchstart / keydown */
function bindFirstInteraction() {
  const events = ["pointerdown", "touchstart", "keydown"];

  const onFirstInteraction = (e) => {
    // Phím Space đã có xử lý riêng ở dưới -> không xử lý trùng
    if (e.type === "keydown" && e.code === "Space") return;

    events.forEach((ev) => window.removeEventListener(ev, onFirstInteraction));

    const onButton = e.target && e.target.closest && e.target.closest("#musicToggle");
    if (onButton) return;          // bấm nút ♪ thì để nút tự xử lý

    hasInteracted = true;
    hideHint();
    playMusic();                   // resume AudioContext rồi play
  };

  events.forEach((ev) => window.addEventListener(ev, onFirstInteraction, { passive: true }));

  /* Phím Space: bật/tắt nhạc (lần đầu bấm cũng chính là tương tác đầu tiên) */
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    e.preventDefault();
    hasInteracted = true;
    if (audioEl.paused) playMusic(); else audioEl.pause();
  });
}

/* Phát nhạc. Chỉ báo lỗi khi play() bị từ chối thật sự */
function playMusic() {
  hideHint();

  ensureWebAudio();                // tạo AudioContext + Analyser (1 lần duy nhất)
  resumeAudioContext();            // nếu AudioContext đang suspended thì resume

  const promise = audioEl.play();
  if (promise && typeof promise.catch === "function") {
    promise.catch((err) => {
      const name = err && err.name;
      if (name === "NotAllowedError") {
        showMsg("Trình duyệt chặn phát nhạc — hãy chạm vào màn hình.", true);
      } else if (audioLoadFailed || name === "NotSupportedError") {
        showMsg("Không tải được nhạc — kiểm tra file music/song.mp3.", true);
      }
      updateToggleState();
    });
  }
}

function isMusicPlaying() {
  return !!audioEl && !audioEl.paused && !audioEl.ended;
}

/* Icon ♪ / ⏸ + nhấp nháy + gạch chéo khi tắt */
function updateToggleState() {
  if (!elToggle || !audioEl) return;
  const playing = isMusicPlaying();

  elToggle.innerHTML = playing ? "&#10074;&#10074;" : "&#9834;";
  elToggle.classList.toggle("is-playing", playing);
  elToggle.classList.toggle("is-off", !playing);
  elToggle.setAttribute("aria-pressed", playing ? "true" : "false");
  elToggle.setAttribute("aria-label", playing ? "Tắt nhạc" : "Bật nhạc");
}

/* ---------- Web Audio: chỉ tạo SAU tương tác đầu tiên, đúng 1 lần ----------
   Bọc try/catch: lỗi thì bỏ qua phần bass, nhạc vẫn phát bình thường.
   Không bật khi mở bằng file:// vì một số trình duyệt sẽ làm nhạc bị câm
   (xem hướng dẫn chạy server trong music/README.txt).                      */
function ensureWebAudio() {
  if (wa.tried) return wa.ready;

  if (!hasInteracted || !audioEl) return false;   // chỉ sau tương tác đầu tiên
  wa.tried = true;

  const protocol = location.protocol;
  if (protocol !== "http:" && protocol !== "https:") return false;

  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;

  try {
    wa.ctx = new Ctx();
    wa.source = wa.ctx.createMediaElementSource(audioEl);
    wa.analyser = wa.ctx.createAnalyser();
    wa.analyser.fftSize = REACT.fftSize;
    wa.analyser.smoothingTimeConstant = REACT.smoothing;
    wa.data = new Uint8Array(wa.analyser.frequencyBinCount);   // tạo 1 lần, dùng lại mãi
    wa.source.connect(wa.analyser);
    wa.analyser.connect(wa.ctx.destination);
    wa.ready = true;

    /* Tính khoảng bin tương ứng dải bass (20–150 Hz) theo sampleRate thật */
    const binHz = wa.ctx.sampleRate / 2 / wa.analyser.frequencyBinCount;
    react.bassFrom = Math.max(1, Math.round(REACT.bassLowHz / binHz));
    react.bassTo = Math.min(
      wa.analyser.frequencyBinCount - 1,
      Math.max(react.bassFrom, Math.round(REACT.bassHighHz / binHz))
    );
  } catch (err) {
    wa.ready = false;              // bỏ qua phân tích bass
  }
  return wa.ready;
}

function resumeAudioContext() {
  if (wa.ctx && wa.ctx.state === "suspended") {
    const r = wa.ctx.resume();
    if (r && r.catch) r.catch(() => {});
  }
}

/* =========================================================================
   11. VÒNG LẶP RENDER
   ========================================================================= */

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  uniforms.uTime.value = time;

  updateRotation(dt, time);
  updateBeat(dt);

  renderer.render(scene, camera);
}

/* =========================================================================
   12. TIỆN ÍCH + KHỞI ĐỘNG
   ========================================================================= */

function hideHint() {
  if (elHint) elHint.classList.add("is-hidden");
}

function showMsg(text, isError) {
  if (!elMsg) return;
  elMsg.textContent = text;
  elMsg.style.color = isError ? "#ff9fbe" : "#ffd9e6";
}

/* ---------- HUD debug: chỉ hiện khi URL có ?debug ---------- */
let debugEl = null, debugTick = 0;

function initDebugHud() {
  if (!/[?&]debug\b/.test(String(location.search || ""))) return;
  if (!document.body) return;

  debugEl = document.createElement("div");
  debugEl.style.cssText =
    "position:fixed;top:8px;left:8px;z-index:30;font:11px/1.45 ui-monospace,monospace;" +
    "color:#ffd9e6;background:rgba(0,0,0,.5);padding:6px 9px;border-radius:7px;" +
    "border:1px solid rgba(255,95,162,.3);pointer-events:none;white-space:pre";
  document.body.appendChild(debugEl);
}

/* Cập nhật HUD ~5 lần/giây: I, bpm, bass... để dễ chỉnh hằng số */
function updateDebugHud() {
  if (!debugEl) return;
  debugTick++;
  if (debugTick % 12 !== 0) return;

  debugEl.textContent =
    "I      " + react.I.toFixed(3) + "\n" +
    "bpm    " + react.bpm.toFixed(1) + "\n" +
    "bass   " + react.bass.toFixed(3) + "\n" +
    "energy " + react.energy.toFixed(3) + "\n" +
    "intens " + react.intensity.toFixed(3) + "\n" +
    "kick   " + react.kickPulse.toFixed(2) + "\n" +
    "amp    " + react.amp.toFixed(3);
}

function main() {
  if (typeof THREE === "undefined") {
    const box = document.getElementById("msg");
    if (box) box.textContent = "Không tải được Three.js từ CDN. Kiểm tra mạng rồi tải lại trang.";
    return;
  }

  initScene();
  initMusic();
  initDebugHud();
  animate();

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", () => setTimeout(onResize, 250));
}

main();
