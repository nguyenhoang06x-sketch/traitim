/* =========================================================================
   TRÁI TIM HẠT — nền đêm ấm + mưa trái tim
   Toàn bộ JavaScript:
     1) Sinh hạt theo đường cong tim, LẤY MẪU ĐỀU THEO ĐỘ DÀI CUNG
        - 12.000 hạt VIỀN NGOÀI: khung neon MẢNH, trắng hồng nhạt (vai phụ)
        - 33.000 hạt TIM BÊN TRONG: dải magenta ĐẬM chia 3–4 LỚP theo Z
          (nhân vật chính: dày vừa phải, có chiều sâu thị sai khi xoay)
        -  8.000 hạt LỚP MẶT TRƯỚC: hạt nhỏ mờ phủ mặt trước cho cảm giác phồng
        - 25.000 hạt QUẦNG BỤI: bắt đầu từ mép ngoài viền rồi tản ra (Gauss)
     2) Shader tự viết: lấp lánh, trôi rung rất nhẹ, tim đập theo CẢM XÚC bài nhạc
        (phân tích Web Audio: bass/energy -> intensity -> BPM, biên độ, độ sáng)
     3) Tim tự XOAY 360° quanh trục Y (chậm, đều) + kéo xoay tự do (quán tính),
        kéo dọc nghiêng tối đa ±25° rồi tự về 0
     4) Nhạc: 1 bài lặp vô hạn, TỰ PHÁT ở lần chạm/click/phím ĐẦU TIÊN (không nút)
     5) Nền gradient đêm ấm + quầng sáng hồng "thở" theo nhịp (đều bằng CSS/JS)
     6) MƯA TRÁI TIM NHỎ rơi (sprite texture vẽ bằng canvas 2D, chuyển động
        tính hoàn toàn trong vertex shader, gắn với intensity + nhịp đập)
   Chạy: `npx serve .` (nên chạy bằng server — xem music/README.txt)
   ========================================================================= */

/* =========================================================================
   1. CẤU HÌNH — CHỈNH Ở ĐÂY
   ========================================================================= */
const CONFIG = {
  /* ---------------------------------------------------------------
     TỈ LỆ / KHE HỞ GIỮA 2 VIỀN
     --------------------------------------------------------------- */
  innerGap: 1.15,           // Ăn mòn đường cong trong vào trong (đơn vị).
                            //   NHỎ = tim trong TO hơn. 1.15 -> ~93% tim ngoài.
                            //   Muốn tim trong to hơn nữa: GIẢM (vd 0.95 -> ~94%).

  /* ---------------------------------------------------------------
     VIỀN NGOÀI — khung neon MẢNH, trắng hồng nhạt (vai phụ)
     --------------------------------------------------------------- */
  outlineCount: 12000,      // số hạt viền ngoài (mỏng nên ít hạt)
  outlineSigma: 0.32,       // độ lệch Gauss VUÔNG GÓC (0.25–0.4 = mỏng)
  outlineMaxOffset: 0.80,   // xa nhất của viền ngoài
  outerColor: [0.95, 0.62, 0.82],  // [R,G,B] = trắng hồng nhạt (0..1)
  outerBrightness: 0.65,    // hệ số sáng — THẤP hơn hẳn tim trong
  outerSizeScale: 0.95,     // cỡ hạt viền ngoài
  outerZDepth: 3.4,         // nửa độ dày Z của viền ngoài (±3.4 -> khối 3D, hết "mỏng như tờ giấy")

  /* ---------------------------------------------------------------
     TIM BÊN TRONG — nhân vật chính: dày vừa, ĐẬM, khối 3D
     --------------------------------------------------------------- */
  innerCount: 33000,        // số hạt thân tim trong (giảm ~34% cho thấy hạt li ti)
  innerSigma: 0.72,         // độ lệch Gauss vuông góc (~62% so với cũ -> bớt DÀY)
  innerMaxOffset: 1.45,     // dày tối đa ăn vào trong (đơn vị)
  innerOuterFuzz: 0.18,     // hạt nhô nhẹ ra ngoài -> giữ khe hở với viền ngoài
  innerArcShare: 0.05,      // tỉ lệ hạt trên cung bo ở lõm trên
  innerSizeScale: 1.32,     // cỡ hạt tim trong (giảm ~15% so với cũ)
  innerBrightness: 0.80,    // nhân độ sáng chung (giảm ~20% -> hạt tách rõ, vẫn đậm)

  /* 3–4 LỚP HẠT XẾP THEO TRỤC Z (tạo khối nổi + thị sai/parallax) */
  innerZDepth: 3.6,         // nửa độ dày Z: ±3.6 (3–4). CÀNG LỚN CÀNG DÀY KHỐI.
  innerLayers: 4,           // số lớp Z (3–4)
  innerLayerColors: [       // màu từng lớp: SAU (tối) -> TRƯỚC (sáng)
    [0.48, 0.04, 0.25],     //   lớp sau cùng (tối)
    [0.75, 0.09, 0.42],     //   lớp giữa 1
    [1.00, 0.18, 0.58],     //   lớp giữa 2 (magenta gốc)
    [1.15, 0.32, 0.70],     //   lớp trước cùng (sáng nhất, vẫn ĐẬM)
  ],

  /* LỚP MẶT TRƯỚC — hạt nhỏ, mờ, phủ mặt trước cho cảm giác PHỒNG */
  innerFaceCount: 8000,     // số hạt lớp mặt trước
  innerFaceZ: [2.2, 3.6],   // dải Z phía trước (gần mắt nhất)
  innerFaceColor: [1.00, 0.45, 0.78],
  innerFaceBrightness: 0.5, // mờ -> ruột vẫn tối, không tô đặc kín
  innerFaceSizeScale: 0.6,  // hạt nhỏ

  /* ---------------------------------------------------------------
     QUẦNG BỤI NGOÀI (giữ nguyên; giảm haloCount nếu máy yếu)
     --------------------------------------------------------------- */
  haloCount: 25000,         // số hạt quầng
  haloStart: 0.80,          // quầng BẮT ĐẦU từ mép ngoài viền (= outlineMaxOffset)
  haloTipFan: 0.04,         // tỉ lệ hạt rải thành QUẠT quanh mũi nhọn dưới
  haloNotchZone: 6.0,       // bán kính vùng khe lõm trên
  haloSigmaMin: 1.5,        // σ khoảng cách đẩy quầng (min)
  haloSigmaMax: 2.5,        // σ khoảng cách đẩy quầng (max)
  haloMax: 9,               // xa nhất của quầng
  haloNearColor: [1.00, 0.42, 0.72],  // gần viền: hồng (pha hồng đậm hơn)
  haloFarColor:  [0.80, 0.10, 0.34],  // xa: hồng sẫm
  haloZDepth: 3.0,          // nửa độ dày Z của quầng bụi (±3 -> khối 3D)

  baseSizeWorld: 0.028,     // cỡ hạt -> hiển thị ~1–2px
  pointSizeMin: 0.9,        // chặn dưới cỡ hạt (px) khi xoay 360°
  pointSizeMax: 3.6,        // chặn trên -> hạt ở gần không phình quá to
  overallBrightness: 0.95,  // nhân độ sáng TOÀN BỘ hạt tim (giảm nếu bị chói trên nền mới)

  /* ---------------------------------------------------------------
     XOAY 360° QUANH TRỤC Y
     --------------------------------------------------------------- */
  autoSpinSpeed: 0.25,             // rad/giây: tốc độ TỰ XOAY đều, chậm (360° ~ 25s)
  dragSpeed: 0.005,                // rad/pixel khi kéo ngang (Y) và kéo dọc (X)
  dragLimitX: 25 * Math.PI / 180,  // nghiêng DỌC tối đa ±25° (trục X)
  inertia: 0.92,                   // quán tính ngang: nhân 0.92 mỗi frame
  returnEase: 0.94,                // thả ra thì trục X tự về 0 (mượt)

  /* ---------------------------------------------------------------
     KHUNG NHÌN: tính theo CẢ CỤM HẠT (tim + quầng) để xoay không bị cắt
     --------------------------------------------------------------- */
  heartHeightRatio: 0.84,          // cả cụm chiếm ~84% chiều cao màn hình
  heartWidthLimit: 0.92,           // và không tràn quá 92% bề ngang
  cameraDistance: 17,              // khoảng cách camera (dùng chung cho canh khung & mưa tim)
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
   1c. MƯA TRÁI TIM NHỎ — CHỈNH Ở ĐÂY
   ========================================================================= */
const RAIN = {
  count: 200,               // tổng số trái tim rơi (máy tính)
  mobileCount: 120,         // số lượng trên ĐIỆN THOẠI
  mobileBreakpoint: 600,    // cạnh ngắn ≤ giá trị này coi là điện thoại
  mobileSizeScale: 0.70,    // trên điện thoại: thu nhỏ còn 70%

  sizeMinPx: 6,             // cỡ nhỏ nhất (px) — phía XA
  sizeMaxPx: 22,            // cỡ lớn nhất (px) — phía GẦN
  minPx: 3,                 // chặn cứng dưới (px)
  maxPx: 26,                // chặn cứng trên (px)

  fallMin: 0.035,           // vòng/giây phía XA (chậm)
  fallMax: 0.075,           // vòng/giây phía GẦN (nhanh)
  speedJitter: 0.20,        // ±% tốc độ ngẫu nhiên cho mỗi trái tim
  intensityGain: 0.40,      // cao trào rơi nhanh hơn ~40% (hệ số 1.0 -> 1.4)

  swayAmp: 0.05,            // biên độ lắc NGANG (tỉ lệ nửa bề rộng màn hình)
  swayFreqMin: 0.30,        // tần số lắc (Hz) min
  swayFreqMax: 0.90,        //                    max

  rotAmpDeg: 25,            // nghiêng qua lại ±25° quanh trục Z
  rotFreqMin: 0.40,         // tần số nghiêng (Hz) min
  rotFreqMax: 1.20,         //                    max

  zMin: -15,                // chiều sâu: phía SAU tim chính
  zMax: 10,                 //             phía TRƯỚC tim chính
  farFade: 0.55,            // phía xa mờ hơn (bokeh): nhân alpha tối thiểu

  alphaMin: 0.40,           // độ trong suốt nhỏ nhất
  alphaMax: 0.90,           //                 lớn nhất
  flashGain: 1.0,           // tim đập mạnh -> trái tim sáng thoáng qua

  /* Dải màu HỒNG (RGB 0..1) + trọng số chọn */
  colors: [
    [1.00, 0.62, 0.80],     // hồng nhạt
    [1.00, 0.37, 0.63],     // hồng sen
    [1.00, 0.15, 0.45],     // hồng đậm
    [1.00, 0.86, 0.92],     // trắng hồng
  ],
  colorWeights: [0.30, 0.35, 0.25, 0.10],

  textureSize: 64,          // cạnh canvas vẽ texture trái tim (px)
};

/* =========================================================================
   1d. QUẦNG SÁNG HỒNG sau tim (DOM) — "thở" theo nhịp đập
   ========================================================================= */
const GLOW = {
  base: 0.08,               // độ sáng nền (lúc lặng nhất)
  beat: 1.0,                // cộng thêm theo xung nhịp uBeat
  bass: 0.12,               // cộng thêm theo bass tức thời
  max: 0.45,                // chặn trên cho khỏi chói
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

/* Độ sâu trục Z trong khoảng ±half (dùng cho viền ngoài & quầng -> khối 3D) */
function blockDepth(half) {
  return (Math.random() * 2 - 1) * half;
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
   2c. KIỂM TRA "NẰM TRONG TRÁI TIM"
   Dùng cho LỚP MẶT TRƯỚC: rải hạt đều BÊN TRONG đường viền tim.
   Lấy đa giác thô từ bảng cung (mỗi 10 bước 1 điểm) rồi ray-casting.
   ========================================================================= */
const HEART_POLY = (function () {
  const step = 10, pts = [];
  for (let i = 0; i <= CURVE_STEPS; i += step) { pts.push(arcX[i], arcY[i]); }
  return pts;                                        // mảng phẳng [x0,y0, x1,y1, ...]
})();

function pointInHeart(x, y) {
  const p = HEART_POLY;
  const n = p.length / 2;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2], yi = p[i * 2 + 1];
    const xj = p[j * 2], yj = p[j * 2 + 1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
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

/* --- 3.1 VIỀN NGOÀI (~12.000 hạt): khung neon MẢNH, trắng hồng nhạt (vai phụ) --- */
function buildOutlineGeometry() {
  return createParticleGeometry(CONFIG.outlineCount, (i, pos, col, size, seed, dir, halo) => {
    const p = sampleAtArc(Math.random() * ARC_TOTAL, _pOut);

    /* Lệch VUÔNG GÓC theo phân bố GAUSS, bề dày mỏng (0.25 .. 0.8) */
    let off = gauss() * CONFIG.outlineSigma;
    if (off >  CONFIG.outlineMaxOffset) off =  CONFIG.outlineMaxOffset;
    if (off < -CONFIG.outlineMaxOffset) off = -CONFIG.outlineMaxOffset;

    pos[i * 3]     = p.x + p.nx * off - HEART_SIZE.cx;
    pos[i * 3 + 1] = p.y + p.ny * off - HEART_SIZE.cy;
    pos[i * 3 + 2] = blockDepth(CONFIG.outerZDepth);   // khối 3D theo trục Z

    /* Trắng hồng nhạt + hệ số sáng THẤP -> chỉ là khung, không lấn tim trong */
    const tint = 0.85 + Math.random() * 0.25;
    const c = CONFIG.outerColor, B = CONFIG.outerBrightness;
    col[i * 3]     = c[0] * tint * B;
    col[i * 3 + 1] = c[1] * tint * B;
    col[i * 3 + 2] = c[2] * tint * B;

    size[i] = (1.00 + Math.random() * 0.45) * CONFIG.outerSizeScale;
    seed[i] = Math.random();
    dir[i * 2]     = p.nx;
    dir[i * 2 + 1] = p.ny;
    halo[i] = 0.25;                                     // đập thì nở nhẹ
  });
}

/* --- 3.2 TIM BÊN TRONG (~33.000 hạt): ĐẬM, chia 4 LỚP theo trục Z ---
   Nhân vật chính. Hạt lệch Gauss VUÔNG GÓC nhưng ăn vào TRONG tim
   (đặc ở lõi sát viền, mờ dần vào ruột) nên ruột vẫn tối.
   Mỗi hạt được xếp vào 1 trong 4 LỚP Z, màu theo lớp: trước sáng, sau tối. */
function buildInnerBodyGeometry() {
  const layers = CONFIG.innerLayers;
  const colors = CONFIG.innerLayerColors;
  const bandH = (2 * CONFIG.innerZDepth) / layers;    // chiều dày mỗi lớp Z

  return createParticleGeometry(CONFIG.innerCount, (i, pos, col, size, seed, dir, halo) => {
    const p = innerSample(_pOut);

    /* Độ sâu ăn vào trong: nửa-Gauss (đặc ở lõi) + chút nhô ra ngoài */
    let depth = Math.abs(gauss()) * CONFIG.innerSigma;
    if (depth > CONFIG.innerMaxOffset) depth = CONFIG.innerMaxOffset;
    const fuzz = (Math.random() - 0.5) * 2 * CONFIG.innerOuterFuzz;
    const off = fuzz - depth;                          // âm = đi vào trong

    /* Mép TRONG (phía ruột rỗng) mờ dần mềm mại: hệ số giảm dần theo độ sâu,
       tới mép thì = 0 nên không bị cắt gắt (nhờ hạt cộng màu additive). */
    const t = depth / CONFIG.innerMaxOffset;           // 0 = sát viền -> 1 = mép trong
    const edgeFade = 1 - t * t;

    /* Chọn LỚP Z: mỗi lớp là một dải z, màu khác nhau -> khối 3D + thị sai */
    const li = Math.min(layers - 1, Math.floor(Math.random() * layers));
    const z = -CONFIG.innerZDepth + (li + Math.random()) * bandH;

    pos[i * 3]     = p.x + p.nx * off - HEART_SIZE.cx;
    pos[i * 3 + 1] = p.y + p.ny * off - HEART_SIZE.cy;
    pos[i * 3 + 2] = z;

    const c = colors[Math.min(colors.length - 1, li)];
    const tint = (0.88 + Math.random() * 0.24) * edgeFade;
    const B = CONFIG.innerBrightness;
    col[i * 3]     = c[0] * tint * B;
    col[i * 3 + 1] = c[1] * tint * B;
    col[i * 3 + 2] = c[2] * tint * B;

    size[i] = (0.85 + Math.random() * 0.45) * CONFIG.innerSizeScale;   // hạt lớn hơn
    seed[i] = Math.random();
    dir[i * 2]     = p.nx;
    dir[i * 2 + 1] = p.ny;
    halo[i] = 0.10;
  });
}

/* --- 3.2b LỚP MẶT TRƯỚC (~8.000 hạt): rải đều BÊN TRONG viền tim,
   nằm sát phía trước (Z dương), hạt nhỏ & mờ -> khối phồng, ruột vẫn tối. --- */
function buildInnerFaceGeometry() {
  const zA = CONFIG.innerFaceZ[0], zB = CONFIG.innerFaceZ[1];
  const c = CONFIG.innerFaceColor, B = CONFIG.innerFaceBrightness;

  return createParticleGeometry(CONFIG.innerFaceCount, (i, pos, col, size, seed, dir, halo) => {
    /* Rejection sampling: gieo trong hộp bao, giữ lại điểm NẰM TRONG tim */
    let x = HEART_SIZE.cx, y = HEART_SIZE.cy;
    for (let t = 0; t < 40; t++) {
      x = HEART_SIZE.xMin + Math.random() * HEART_SIZE.w;
      y = HEART_SIZE.yMin + Math.random() * HEART_SIZE.h;
      if (pointInHeart(x, y)) break;
    }

    pos[i * 3]     = x - HEART_SIZE.cx;
    pos[i * 3 + 1] = y - HEART_SIZE.cy;
    pos[i * 3 + 2] = zA + Math.random() * (zB - zA);

    const tint = 0.80 + Math.random() * 0.40;
    col[i * 3]     = c[0] * tint * B;
    col[i * 3 + 1] = c[1] * tint * B;
    col[i * 3 + 2] = c[2] * tint * B;

    size[i] = (0.70 + Math.random() * 0.60) * CONFIG.innerFaceSizeScale;
    seed[i] = Math.random();

    /* Hướng tản: đẩy nhẹ ra từ tâm tim (dùng cho hiệu ứng đập) */
    const dx = x - HEART_SIZE.cx, dy = y - HEART_SIZE.cy;
    const d = Math.hypot(dx, dy) || 1;
    dir[i * 2]     = dx / d;
    dir[i * 2 + 1] = dy / d;
    halo[i] = 0.05;
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
    pos[i * 3 + 2] = blockDepth(CONFIG.haloZDepth);      // quầng cũng có chiều sâu Z

    // gần viền: hồng -> xa: hồng sẫm (pha nhiều hồng ĐẬM hơn cho ăn với tim trong)
    const k = Math.min(1, (d - CONFIG.haloStart) / (CONFIG.haloMax - CONFIG.haloStart));
    const cN = CONFIG.haloNearColor, cF = CONFIG.haloFarColor;
    const r = cN[0] + (cF[0] - cN[0]) * k;
    const g = cN[1] + (cF[1] - cN[1]) * k;
    const b = cN[2] + (cF[2] - cN[2]) * k;
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
  uniform float uMinPoint;    // chặn dưới cỡ hạt (px)
  uniform float uMaxPoint;    // chặn trên cỡ hạt (px)
  uniform float uBright;      // hệ số sáng toàn cục (giảm nhẹ nếu nền làm chói)

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
    vColor = aColor * flick * (0.85 + uGlow * 0.5 + uBeat * 3.0) * uBright;

    /* Cỡ hạt: phóng theo phối cảnh nhưng có chặn trên/dưới để khi xoay 360°
       (hạt lúc gần lúc xa) kích thước vẫn tương đối đồng đều. */
    gl_PointSize = clamp(uSizeFactor * aSize / max(-mv.z, 0.001), uMinPoint, uMaxPoint);
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
   4b. SHADER MƯA TRÁI TIM
   Chuyển động tính HOÀN TOÀN trong vertex shader (không cập nhật từng hạt JS).
   - position = (screenX, startV, z):  screenX -1..1 (bề ngang), startV 0..1
     (vị trí rơi ban đầu), z = chiều sâu (-15..+10).
   - Rơi theo fract(...) -> ra khỏi đáy thì quay lại trên, KHÔNG giật.
   - Lắc ngang sin + nghiêng Z theo pha riêng từng trái tim.
   ========================================================================= */
const RAIN_VERTEX_SHADER = `
  attribute float aSpeed;     // tốc độ rơi (vòng/giây)
  attribute float aSize;      // cỡ (px ở khoảng cách mốc)
  attribute float aAlpha;     // độ trong suốt 0..1
  attribute float aPhase;     // pha riêng
  attribute float aRot;       // góc nghiêng cơ sở (rad)
  attribute float aSwayFreq;  // tần số lắc ngang
  attribute float aRotFreq;   // tần số nghiêng
  attribute vec3  aColor;     // màu hồng

  uniform float uTime;
  uniform float uCamDist;     // khoảng cách camera
  uniform float uTanHalfFov;  // tan(fov/2)
  uniform float uAspect;      // w/h
  uniform float uRefDist;     // khoảng cách mốc để suy cỡ hạt
  uniform float uMinPx;
  uniform float uMaxPx;
  uniform float uSpeedGain;   // theo intensity nhạc (1.0 -> 1.4)
  uniform float uSwayAmp;     // biên độ lắc ngang (phần nửa bề rộng)
  uniform float uRotAmp;      // biên độ nghiêng Z (rad)
  uniform float uFlash;       // 0..1: tim đập mạnh -> sáng thoáng qua
  uniform float uPixelRatio;

  varying vec3  vColor;
  varying float vAlpha;
  varying float vAngle;

  void main() {
    float z = position.z;
    float d = max(uCamDist - z, 0.5);        // khoảng cách tới camera
    float halfH = uTanHalfFov * d;           // nửa chiều cao thế giới ở chiều sâu đó
    float halfW = halfH * uAspect;

    /* Rơi: 1 = trên, -1 = dưới; quấn vòng bằng fract */
    float v = fract(position.y + uTime * aSpeed * uSpeedGain);
    float sy = 1.0 - 2.0 * v;

    /* Lắc ngang nhẹ theo pha riêng */
    float sx = position.x + sin(uTime * aSwayFreq + aPhase) * uSwayAmp;

    vec3 p = vec3(sx * halfW, sy * halfH, z);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    /* Cỡ theo phối cảnh: gần TO, xa NHỎ, có chặn trên/dưới */
    float px = aSize * (uRefDist / d) * uPixelRatio;
    gl_PointSize = clamp(px, uMinPx * uPixelRatio, uMaxPx * uPixelRatio);

    /* Nghiêng qua lại quanh trục Z */
    vAngle = aRot + sin(uTime * aRotFreq + aPhase) * uRotAmp;

    vColor = aColor;
    vAlpha = clamp(aAlpha * (1.0 + uFlash), 0.0, 1.0);
  }
`;

const RAIN_FRAGMENT_SHADER = `
  uniform sampler2D uMap;

  varying vec3  vColor;
  varying float vAlpha;
  varying float vAngle;

  void main() {
    /* Xoay toạ độ texture theo góc nghiêng của từng trái tim */
    vec2 c = gl_PointCoord - vec2(0.5);
    float ca = cos(vAngle), sa = sin(vAngle);
    vec2 r = vec2(c.x * ca - c.y * sa, c.x * sa + c.y * ca);
    vec2 uv = r + vec2(0.5);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;

    vec4 tex = texture2D(uMap, uv);
    float a = tex.a * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * tex.rgb, a);
  }
`;

/* =========================================================================
   5. BIẾN TOÀN CỤC
   ========================================================================= */

let scene, camera, renderer, clock;
let heartGroup, heartMaterial, uniforms;

/* Mưa trái tim nhỏ (không xoay theo tim) */
let rainMaterial, rainUniforms, rainBehind, rainFront;

/* Quầng sáng hồng sau tim (phần tử DOM) */
let glowEl = null;

/* Nửa bề ngang / nửa chiều cao THỰC của CẢ CỤM hạt (gồm quầng) — dùng canh khung nhìn */
let cloudHalfW = 0, cloudHalfH = 0;

const spin = { rotX: 0, rotY: 0, velX: 0, velY: 0, dragging: false, lastX: 0, lastY: 0 };

/* Nhạc */
let audioEl = null;
let hasInteracted = false;     // đã có tương tác đầu tiên chưa
let musicStarted = false;      // nhạc đã được bắt đầu phát ít nhất 1 lần
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

  scene = new THREE.Scene();               // KHÔNG tô nền -> thấy gradient CSS xuyên qua

  camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 300);
  camera.position.set(0, 0, CONFIG.cameraDistance);   // nhìn chính diện
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);                 // nền trong suốt
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
    uMinPoint:   { value: CONFIG.pointSizeMin },
    uMaxPoint:   { value: CONFIG.pointSizeMax },
    uBright:     { value: CONFIG.overallBrightness },
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
  const geoms = [
    buildOutlineGeometry(),      // viền ngoài (khung mảnh)
    buildInnerBodyGeometry(),    // TIM BÊN TRONG (4 lớp Z)
    buildInnerFaceGeometry(),    // lớp mặt trước (phồng)
    buildHaloGeometry(),         // quầng bụi ngoài
  ];
  geoms.forEach((g) => {
    const pts = makePoints(g);
    pts.renderOrder = 1;         // tim chính vẽ GIỮA mưa sau và mưa trước
    heartGroup.add(pts);
  });
  computeCloudBounds(geoms);     // đo kích thước CẢ CỤM để canh khung nhìn
  scene.add(heartGroup);

  buildRain();                   // mưa trái tim (sau + trước tim chính)
  glowEl = document.getElementById("glow");

  fitView();
  setupPointer();
}

/* ---------- Khởi tạo MƯA TRÁI TIM ---------- */

function buildRain() {
  const halfFov = (camera.fov * Math.PI / 180) / 2;
  const tex = makeHeartTexture();

  rainUniforms = {
    uTime:       { value: 0 },
    uMap:        { value: tex },
    uCamDist:    { value: CONFIG.cameraDistance },
    uTanHalfFov: { value: Math.tan(halfFov) },
    uAspect:     { value: window.innerWidth / window.innerHeight },
    uRefDist:    { value: CONFIG.cameraDistance },
    uMinPx:      { value: RAIN.minPx },
    uMaxPx:      { value: RAIN.maxPx },
    uSpeedGain:  { value: 1.0 },
    uSwayAmp:    { value: RAIN.swayAmp },
    uRotAmp:     { value: RAIN.rotAmpDeg * Math.PI / 180 },
    uFlash:      { value: 0.0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
  };

  rainMaterial = new THREE.ShaderMaterial({
    uniforms: rainUniforms,
    vertexShader: RAIN_VERTEX_SHADER,
    fragmentShader: RAIN_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,             // không ghi depth -> không che hạt tim bất thường
    depthTest: true,
    blending: THREE.NormalBlending,
  });

  const split = createRainGeometries();

  rainBehind = new THREE.Points(split.behind, rainMaterial);
  rainBehind.frustumCulled = false;
  rainBehind.renderOrder = 0;      // vẽ TRƯỚC tim chính (nằm sau)

  rainFront = new THREE.Points(split.front, rainMaterial);
  rainFront.frustumCulled = false;
  rainFront.renderOrder = 2;       // vẽ SAU tim chính (nằm trước, che nhẹ lên tim)

  scene.add(rainBehind);
  scene.add(rainFront);
}

/* Vẽ texture trái tim 64x64 bằng canvas 2D: đường cong tham số + gradient hồng + viền sáng mềm */
function makeHeartTexture() {
  const S = RAIN.textureSize;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, S, S);

  const sc = S * 0.027;             // hệ số phóng: tim vừa trong khung 64
  const yc = -2.5;                  // tâm dọc của đường cong tim (để căn giữa)
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.scale(sc, -sc);               // lật y: đỉnh tim hướng lên trên

  /* Đường cong tim tham số, dùng lại công thức của tim chính */
  const N = 120;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const yy = y - yc;
    if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.closePath();

  /* Gradient hồng (hồng nhạt trên -> hồng đậm dưới) */
  const g = ctx.createLinearGradient(0, 14.5, 0, -14.5);
  g.addColorStop(0.0, "#ffffff");   // trên: trắng hồng
  g.addColorStop(0.5, "#ffd9e6");   // giữa: hồng nhạt
  g.addColorStop(1.0, "#ff9fc6");   // dưới: hồng
  ctx.fillStyle = g;

  /* Viền sáng mềm (glow) rồi tô lấp */
  ctx.shadowColor = "rgba(255, 120, 180, 0.95)";
  ctx.shadowBlur = S * 0.16;
  ctx.fill();
  ctx.fill();                       // tô 2 lần cho viền rõ hơn
  ctx.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

/* Chọn màu trong dải hồng theo trọng số */
function pickRainColor() {
  const w = RAIN.colorWeights;
  let r = Math.random(), acc = 0;
  for (let i = 0; i < RAIN.colors.length; i++) {
    acc += w[i];
    if (r <= acc) return RAIN.colors[i];
  }
  return RAIN.colors[RAIN.colors.length - 1];
}

/* Sinh tham số cho mỗi trái tim rồi tách thành 2 nhóm: SAU tim (z<0) và TRƯỚC tim (z>=0) */
function createRainGeometries() {
  const short = Math.min(window.innerWidth, window.innerHeight);
  const isMobile = short <= RAIN.mobileBreakpoint;
  const total = isMobile ? RAIN.mobileCount : RAIN.count;
  const sizeScale = isMobile ? RAIN.mobileSizeScale : 1;

  const behind = [], front = [];

  for (let i = 0; i < total; i++) {
    const z = RAIN.zMin + Math.random() * (RAIN.zMax - RAIN.zMin);
    const depthT = (z - RAIN.zMin) / (RAIN.zMax - RAIN.zMin);   // 0 = xa -> 1 = gần

    /* Gần thì nhanh & to, xa thì chậm & nhỏ */
    const fall = RAIN.fallMin + (RAIN.fallMax - RAIN.fallMin) * depthT;
    const speed = fall * (1 + (Math.random() * 2 - 1) * RAIN.speedJitter);
    const size = (RAIN.sizeMinPx + (RAIN.sizeMaxPx - RAIN.sizeMinPx) * depthT)
               * (0.85 + Math.random() * 0.30) * sizeScale;

    /* Độ trong suốt; phía xa mờ hơn (bokeh) */
    let alpha = RAIN.alphaMin + Math.random() * (RAIN.alphaMax - RAIN.alphaMin);
    alpha *= RAIN.farFade + (1 - RAIN.farFade) * depthT;

    const item = {
      sx: (Math.random() * 2 - 1) * 1.06,   // hơi tràn mép cho tự nhiên
      sv: Math.random(),
      z: z,
      speed: speed,
      size: size,
      alpha: alpha,
      phase: Math.random() * Math.PI * 2,
      rot: (Math.random() * 2 - 1) * RAIN.rotAmpDeg * Math.PI / 180,
      swayFreq: RAIN.swayFreqMin + Math.random() * (RAIN.swayFreqMax - RAIN.swayFreqMin),
      rotFreq: RAIN.rotFreqMin + Math.random() * (RAIN.rotFreqMax - RAIN.rotFreqMin),
      color: pickRainColor(),
    };
    if (z < 0) behind.push(item); else front.push(item);
  }

  return { behind: createRainGeometry(behind), front: createRainGeometry(front) };
}

function createRainGeometry(items) {
  const n = items.length;
  const pos    = new Float32Array(n * 3);       // (screenX, startV, z)
  const speed  = new Float32Array(n);
  const size   = new Float32Array(n);
  const alpha  = new Float32Array(n);
  const phase  = new Float32Array(n);
  const rot    = new Float32Array(n);
  const swayF  = new Float32Array(n);
  const rotF   = new Float32Array(n);
  const color  = new Float32Array(n * 3);

  items.forEach((p, i) => {
    pos[i * 3] = p.sx; pos[i * 3 + 1] = p.sv; pos[i * 3 + 2] = p.z;
    speed[i] = p.speed; size[i] = p.size; alpha[i] = p.alpha;
    phase[i] = p.phase; rot[i] = p.rot; swayF[i] = p.swayFreq; rotF[i] = p.rotFreq;
    color[i * 3] = p.color[0]; color[i * 3 + 1] = p.color[1]; color[i * 3 + 2] = p.color[2];
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute("position",   new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aSpeed",     new THREE.BufferAttribute(speed, 1));
  g.setAttribute("aSize",      new THREE.BufferAttribute(size, 1));
  g.setAttribute("aAlpha",     new THREE.BufferAttribute(alpha, 1));
  g.setAttribute("aPhase",     new THREE.BufferAttribute(phase, 1));
  g.setAttribute("aRot",       new THREE.BufferAttribute(rot, 1));
  g.setAttribute("aSwayFreq",  new THREE.BufferAttribute(swayF, 1));
  g.setAttribute("aRotFreq",   new THREE.BufferAttribute(rotF, 1));
  g.setAttribute("aColor",     new THREE.BufferAttribute(color, 3));
  return g;
}

function makePoints(geometry) {
  const points = new THREE.Points(geometry, heartMaterial);
  points.frustumCulled = false;      // hạt còn bị đẩy trong shader
  return points;
}

/* =========================================================================
   7. KHỚP KHUNG NHÌN: tính theo CẢ CỤM HẠT (tim + QUẦNG) nên khi xoay 360°
   ở mọi góc (kể cả màn dọc điện thoại) không bị cắt ở mép.
   ========================================================================= */

/* Đo nửa bề ngang/cao lớn nhất của tất cả lưới hạt (toạ độ gốc, đã căn giữa) */
function computeCloudBounds(geoms) {
  let hw = 0, hh = 0;
  for (const g of geoms) {
    const a = g.getAttribute("position").array;
    for (let i = 0; i < a.length; i += 3) {
      const x = Math.abs(a[i]), y = Math.abs(a[i + 1]);
      if (x > hw) hw = x;
      if (y > hh) hh = y;
    }
  }
  cloudHalfW = hw;
  cloudHalfH = hh;
}

function fitView() {
  if (!camera) return;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;

  camera.aspect = aspect;
  camera.position.set(0, 0, CONFIG.cameraDistance);
  camera.updateProjectionMatrix();

  const halfFov = (camera.fov * Math.PI / 180) / 2;
  const viewH = 2 * CONFIG.cameraDistance * Math.tan(halfFov);
  const viewW = viewH * aspect;

  /* Dùng bán kính ngang/cao thực của cả cụm (gồm quầng); chưa đo thì lấy tim */
  const halfW = cloudHalfW || HEART_SIZE.w / 2;
  const halfH = cloudHalfH || HEART_SIZE.h / 2;

  let scale = Math.min(
    (CONFIG.heartHeightRatio * viewH) / (2 * halfH),
    (CONFIG.heartWidthLimit * viewW) / (2 * halfW)
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

  /* Mưa trái tim tính vị trí theo TỈ LỆ màn hình -> cập nhật tỉ lệ khung */
  if (rainUniforms) {
    rainUniforms.uAspect.value = window.innerWidth / window.innerHeight;
    rainUniforms.uPixelRatio.value = renderer.getPixelRatio();
  }
}

/* =========================================================================
   8. XOAY: TỰ XOAY 360° QUANH TRỤC Y + KÉO XOAY TỰ DO (có quán tính)
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

    const k = CONFIG.dragSpeed;
    spin.rotY += dx * k;     // NGANG: xoay tự do, KHÔNG giới hạn góc
    spin.rotX += dy * k;     // DỌC: nghiêng

    clampTilt();             // chỉ kẹp nghiêng dọc ±25°

    spin.velY = dx * k;      // quán tính khi nhả tay
    spin.velX = dy * k;
  });

  const endDrag = () => { spin.dragging = false; };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", endDrag);
}

/* Kẹp NGHIÊNG DỌC (trục X) trong ±dragLimitX; trục Y xoay tự do 360° */
function clampTilt() {
  spin.rotX = Math.max(-CONFIG.dragLimitX, Math.min(CONFIG.dragLimitX, spin.rotX));
}

/* Ghi chú: trước đây có hiệu ứng "con trỏ tới gần thì hạt tản ra", nhưng chính nó
   tạo ra một VÙNG TRÒN ĐEN (khuyết hạt) ngay tại vị trí con trỏ, nằm ngay cạnh
   viền ngoài. Đã bỏ để quầng hạt phân bố đều. Kéo xoay vẫn hoạt động bình thường. */

/* Cập nhật xoay mỗi frame:
   - Trục Y: TỰ XOAY đều 360° (autoSpinSpeed) + quán tính khi kéo thả.
             Kéo ngang đổi góc tự do, thả ra TIẾP TỤC tự xoay từ góc hiện tại
             (không giật về vị trí cũ).
   - Trục X: nghiêng dọc tối đa ±dragLimitX rồi tự về 0 mượt. */
function updateRotation(dt) {
  const damp = Math.pow(CONFIG.inertia, dt * 60);

  if (spin.dragging) {
    /* Đang kéo: pointermove đã lo phần xoay; chỉ giữ nghiêng trong giới hạn */
    clampTilt();
  } else {
    /* Quán tính ngang (không giới hạn góc) */
    spin.velY *= damp;
    spin.rotY += spin.velY;

    /* Tự xoay chậm, đều, liên tục 360° */
    spin.rotY += CONFIG.autoSpinSpeed * dt;

    /* Trục X: quán tính rồi tự về 0 */
    spin.velX *= damp;
    spin.rotX += spin.velX;
    const back = Math.pow(CONFIG.returnEase, dt * 60);
    spin.rotX *= back;
    if (Math.abs(spin.rotX) < 0.0005) spin.rotX = 0;
    clampTilt();
  }

  /* Giữ rotY gọn (tránh số phình to sau nhiều giờ) mà KHÔNG đổi hình dạng */
  if (spin.rotY > Math.PI * 2 || spin.rotY < -Math.PI * 2) {
    spin.rotY %= Math.PI * 2;
  }

  heartGroup.rotation.y = spin.rotY;
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

  /* --- Mưa trái tim: tốc độ theo intensity, sáng thoáng qua khi kick --- */
  if (rainUniforms) {
    rainUniforms.uSpeedGain.value = 1 + react.I * RAIN.intensityGain;
    rainUniforms.uFlash.value = Math.min(1, react.kickPulse) * RAIN.flashGain;
  }

  react.kickPulse *= REACT.kickDecay;      // xung kick giảm dần mỗi frame
  updateDebugHud();
}

/* =========================================================================
   10. NHẠC — 1 bài lặp vô hạn, TỰ PHÁT ở lần tương tác ĐẦU TIÊN
   KHÔNG còn nút bật/tắt và không còn UI nhạc trên màn hình.
   Lần chạm/click/gõ phím đầu tiên (ở bất kỳ đâu) sẽ:
     resume AudioContext -> tạo Analyser (đúng 1 lần) -> audio.play()
   ========================================================================= */

function initMusic() {
  audioEl = document.getElementById("player");

  audioEl.loop = true;         // phát liên tục, lặp vô hạn
  audioEl.volume = 0.85;

  /* Đánh dấu đã bắt đầu phát -> khi quay lại tab sẽ tự phát tiếp */
  audioEl.addEventListener("play", () => { musicStarted = true; });

  /* Lỗi tải file: chỉ ghi log, KHÔNG hiện thông báo trên màn hình */
  audioEl.addEventListener("error", () => {
    audioLoadFailed = true;
    console.warn("[nhạc] Không tải được file music/song.mp3");
  });

  /* Tab bị ẩn -> pause; quay lại -> phát tiếp nếu nhạc đã bắt đầu trước đó */
  document.addEventListener("visibilitychange", () => {
    if (!audioEl) return;
    if (document.hidden) {
      if (!audioEl.paused) audioEl.pause();
    } else if (musicStarted) {
      playMusic();
    }
  });

  /* Lắng nghe LẦN TƯƠNG TÁC ĐẦU TIÊN (một lần) */
  bindFirstInteraction();
}

/* Gắn listener { once: true } cho pointerdown / touchstart / keydown.
   Lần chạm/click/phím ĐẦU TIÊN ở bất kỳ đâu -> phát nhạc. */
function bindFirstInteraction() {
  const events = ["pointerdown", "touchstart", "keydown"];

  const onFirstInteraction = () => {
    /* Chỉ chạy đúng 1 lần: gỡ hết các listener còn lại */
    events.forEach((ev) => window.removeEventListener(ev, onFirstInteraction));

    hasInteracted = true;
    playMusic();                   // resume AudioContext rồi play
  };

  events.forEach((ev) =>
    window.addEventListener(ev, onFirstInteraction, { once: true, passive: true }));
}

/* Phát nhạc.
   Nếu play() bị từ chối (hiếm): gắn lại listener để lần chạm sau thử lại.
   KHÔNG hiện thông báo lỗi trên màn hình — chỉ console.warn. */
function playMusic() {
  ensureWebAudio();                // tạo AudioContext + Analyser (đúng 1 lần)
  resumeAudioContext();            // nếu AudioContext đang suspended thì resume

  const promise = audioEl.play();
  if (promise && typeof promise.catch === "function") {
    promise.catch((err) => {
      console.warn("[nhạc] play() bị từ chối:", (err && err.name) ? err.name : err);
      bindFirstInteraction();      // thử lại ở lần chạm kế tiếp
    });
  }
}

function isMusicPlaying() {
  return !!audioEl && !audioEl.paused && !audioEl.ended;
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
  if (rainUniforms) rainUniforms.uTime.value = time;

  updateRotation(dt);
  updateBeat(dt);

  /* Quầng sáng hồng sau tim "thở" theo nhịp đập + bass (DOM, chỉ đổi opacity) */
  if (glowEl) {
    const g = GLOW.base + GLOW.beat * uniforms.uBeat.value + GLOW.bass * react.bass;
    glowEl.style.opacity = Math.max(0, Math.min(GLOW.max, g)).toFixed(3);
  }

  renderer.render(scene, camera);
}

/* =========================================================================
   12. TIỆN ÍCH + KHỞI ĐỘNG
   ========================================================================= */

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
