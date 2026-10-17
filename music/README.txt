==========================================================
  THƯ MỤC NHẠC — TRÁI TIM HẠT
==========================================================

CHỈ CẦN 1 FILE NHẠC DUY NHẤT
  File nhạc của bạn phải nằm đúng ở đây và đúng tên:

        heart-web/music/song.mp3

    heart-web/
    ├── index.html
    ├── style.css
    ├── script.js
    └── music/
        ├── song.mp3     <-- file nhạc (BẮT BUỘC đúng tên này)
        └── README.txt   <-- file này

  - Bài nhạc được phát LẶP VÔ HẠN (thẻ <audio ... loop>).
  - Không có playlist, không nút bài trước/sau, không thanh tiến độ.
  - Muốn đổi tên file: sửa thuộc tính src trong index.html:
        <audio id="player" src="music/song.mp3" loop preload="auto" hidden></audio>

==========================================================
  >>> NÊN CHẠY BẰNG SERVER TĨNH (QUAN TRỌNG) <<<
==========================================================

  Mở terminal tại thư mục heart-web và chạy MỘT trong hai lệnh:

        npx serve .
        python -m http.server 8080

  Rồi mở địa chỉ nó in ra:
        http://localhost:3000        (với npx serve)
        http://localhost:8080        (với python)

  VÌ SAO NÊN CHẠY BẰNG SERVER?
    - Trang dùng Web Audio API (AnalyserNode) để phân tích nhạc, nhờ đó
      trái tim đập theo CẢM XÚC của bài (xem mục dưới).
    - Khi mở trực tiếp file index.html (địa chỉ dạng file:///...),
      Chrome/Edge coi file mp3 là "khác nguồn" (cross-origin) nên khi
      nối qua Web Audio thì NHẠC SẼ BỊ CÂM. Script đã tự bảo vệ: ở chế độ
      file:// nó KHÔNG bật Web Audio, nhạc vẫn kêu bình thường nhưng tim
      chỉ đập theo nhịp MẶC ĐỊNH (60 BPM, biên độ 5%), không theo cảm xúc.
    - Chạy qua server thì không bị vấn đề đó và mọi thứ hoạt động đầy đủ.

==========================================================
  TIM ĐẬP THEO CẢM XÚC CỦA BÀI NHẠC
==========================================================
  Mỗi frame script đọc AnalyserNode (fftSize 1024, smoothing 0.8) và tính:
     bass   = năng lượng dải trầm 20–150 Hz   -> bắt tiếng trống (kick)
     energy = năng lượng toàn dải (RMS)       -> độ sôi động tức thời
     intensity = trung bình trượt CHẬM của energy (khoảng 2–4 giây)
     I      = intensity đã CHUẨN HOÁ THÍCH NGHI về 0..1
              (theo dõi min/max trong ~20 giây gần nhất, nên bài nào to nhỏ
               khác nhau vẫn có đoạn nhẹ và đoạn cao trào rõ rệt)

  Từ I suy ra (tất cả đều được làm mượt qua từng frame, không giật):
     - BPM giả lập : 50 (khúc nhẹ)  ->  120 (cao trào)
       dùng bộ CỘNG PHA (phase += dt*bpm/60) nên đổi tốc độ không bị nhảy
     - Biên độ đập : 3% -> 12%
     - Độ sáng hạt : uGlow 0.8 -> 1.6
     - Quầng ngoài tản xa hơn : 8 -> 16
     - Độ rung hạt : 1.0 -> 2.2 (cao trào trông "sôi" hơn)

  Nhịp "thình thịch" gồm 2 nhịp/chu kỳ: nhịp 1 mạnh, nhịp 2 yếu hơn lệch
  0.3 chu kỳ. Ngoài ra mỗi cú KICK (bass vượt ~1.3 lần trung bình trượt
  của chính nó, cách nhau ≥ 250 ms) cộng thêm một xung phồng + loé sáng;
  khúc nhạc nhẹ (I thấp) thì hiệu ứng kick gần như tắt hẳn.

  KHI KHÔNG CÓ NHẠC (chưa phát / pause / Web Audio không dùng được):
     I trôi dần về 0.25, tim đập 60 BPM với biên độ 5%.

  XEM SỐ LIỆU ĐỂ CHỈNH: mở trang kèm ?debug, ví dụ
        http://localhost:3000/?debug
     -> góc trên bên trái hiện I, bpm, bass, energy, intens, kick, amp.

  MUỐN CHỈNH NHỊP ĐẬP: mở script.js, sửa khối hằng số REACT ở gần đầu file
  (có chú thích tiếng Việt từng dòng). Các hằng số đáng chú ý:
     bpmMin / bpmMax          tốc độ nhịp ở khúc nhẹ / cao trào
     ampMin / ampMax          biên độ phồng nhẹ / mạnh
     glowMin / glowMax        độ sáng hạt nhẹ / mạnh
     spreadMin / spreadMax    biên độ tản quầng ngoài
     jitterMin / jitterMax    độ rung hạt
     intensitySmooth          càng nhỏ càng đổi trạng thái chậm
     normWindow               số giây theo dõi min/max (chuẩn hoá thích nghi)
     kickThreshold            bass phải vượt bao nhiêu lần trung bình -> kick
     kickMinMs                khoảng cách tối thiểu giữa 2 kick (ms)
     kickScale / kickGlow     kick cộng thêm vào scale / độ sáng
     smooth*                  độ mượt khi đưa giá trị vào shader (giây)

==========================================================
  ĐỘ DÀY VIỀN & QUẦNG HẠT (cũng ở đầu script.js)
==========================================================
  Viền sáng ngoài và viền hồng đậm bên trong được vẽ theo kiểu "nét neon":
  hạt dày nhất ĐÚNG TRÊN đường cong rồi thưa dần ra hai mép (phân bố Gauss).
  Muốn chỉnh, sửa các hằng số CONFIG ở đầu script.js:

     outlineCount / outlineSigma / outlineMaxOffset
         số hạt, độ tản và độ dày tối đa của VIỀN SÁNG NGOÀI
         (muốn viền dày hơn: tăng outlineSigma, ví dụ 0.25 -> 0.35)

     innerOutlineCount / innerSigma / innerMaxOffset
         số hạt, độ tản và độ dày tối đa của VIỀN HỒNG ĐẬM BÊN TRONG

     innerGap
         khoảng cách giữa hai đường tâm viền (mặc định 1.60).
         Viền trong là đường SONG SONG với viền ngoài nên khe hở đều nhau;
         tăng innerGap nếu muốn khe hở rộng hơn nữa.

     strokeSizeScale
         cỡ hạt của cả hai viền (1.2 = to hơn 20%)

     haloCount / haloStart / haloSigmaMin / haloSigmaMax / haloMax
         số hạt quầng, khoảng bắt đầu tản (từ mép ngoài viền dày),
         độ tản Gauss và giới hạn xa nhất của quầng

     haloTipFan / haloNotchZone
         hai tham số chống "lỗ tròn" ở quầng: tỉ lệ hạt rải thành quạt
         quanh mũi nhọn dưới, và bán kính vùng khe lõm trên (nơi hướng
         tản được nghiêng dọc theo khe để hạt không lọt vào trong tim)

  Ghi chú: hiệu ứng "con trỏ tới gần thì hạt tản ra" đã được BỎ vì chính nó
  tạo ra một vùng tròn bị khuyết hạt ngay tại con trỏ. Kéo xoay vẫn như cũ.

==========================================================
  CÁCH DÙNG
==========================================================
  - Nhạc KHÔNG tự phát khi mới vào trang (trình duyệt chặn tự phát nhạc).
    Màn hình hiện dòng gợi ý mờ "Chạm để phát nhạc" ở góc dưới bên phải.
  - Chạm/bấm BẤT KỲ ĐÂU trên màn hình (hoặc bấm phím bất kỳ) ở lần đầu
    -> nhạc bắt đầu phát, gợi ý biến mất.
  - Nút ♪ ở góc dưới bên phải -> bật / tắt nhạc.
      đang phát: icon ⏸ và nút nhấp nháy nhẹ
      đang tắt : icon ♪ kèm gạch chéo, nút mờ hơn
  - Phím Space (máy tính) -> bật / tắt nhạc.
  - Kéo chuột hoặc vuốt trên màn hình -> xoay trái tim (giới hạn ±35°
    ngang, ±20° dọc), thả ra tim tự trở về chính diện.

  Nếu file nhạc thiếu hoặc không đọc được, một dòng thông báo nhỏ sẽ hiện
  ở góc dưới bên phải: "Không tải được nhạc — kiểm tra file music/song.mp3."

  ĐỊNH DẠNG NÊN DÙNG: .mp3 (tương thích rộng nhất trên mọi trình duyệt).
