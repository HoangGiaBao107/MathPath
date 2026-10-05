# PROJECT_SPEC.md
# Website giải toán THPTQG dành cho học sinh THPT
# Coding specification dành cho Codex

> IMPORTANT:
> - Đọc TOÀN BỘ file này trước khi bắt đầu code.
> - Không tự ý bỏ qua tính năng đã nêu.
> - Không triển khai "mock" những phần được yêu cầu là chức năng thật, trừ khi tôi ghi rõ "placeholder".
> - Không hard-code API key, secret, thông tin thanh toán hoặc thông tin nhạy cảm.
> - Xây theo từng phase, chạy kiểm tra sau mỗi phase và không làm hỏng chức năng cũ.
> - Khi một yêu cầu chưa đủ rõ để triển khai an toàn, tạo một assumption rõ ràng trong code/docs thay vì tự ý suy diễn.
> - Ưu tiên code sạch, dễ bảo trì, typed, responsive, accessible và có cấu trúc dễ mở rộng.
> - Không sao chép logo, tên thương hiệu, hình ảnh hay nội dung độc quyền từ website tham khảo. Ảnh người dùng cung cấp chỉ là reference về visual direction.

---

# 1. TỔNG QUAN DỰ ÁN

Xây dựng một website học toán dành cho học sinh THPT, tập trung vào luyện thi THPTQG và hỗ trợ giải toán bằng AI.

Website có 2 trục chức năng chính:

1. NGÂN HÀNG ĐỀ ÔN LUYỆN
   - Người dùng chọn đề.
   - Làm bài trực tiếp trên website.
   - Nộp bài.
   - Hệ thống tự động chấm điểm dựa trên đáp án chuẩn được quản trị viên nhập sẵn.
   - Hiển thị kết quả, thống kê, đồ thị tiến bộ.
   - Với câu sai: xem lời giải có sẵn hoặc yêu cầu AI tạo câu tương tự để luyện thêm.

2. AI SOLVER / HỎI ĐÁP VỚI AI
   - Người dùng nhập văn bản.
   - Hoặc upload hình ảnh đề toán.
   - AI đọc đề, giải từng bước và trả lời theo phong cách của website.
   - AI có thể tạo bài tương tự cho người học.

Mục tiêu sản phẩm:
- Trải nghiệm như một nền tảng học tập hiện đại, không giống một chatbot đơn giản.
- Giao diện trẻ, mạnh, hiện đại, có animation nhưng không rối.
- Có tiếng Việt và tiếng Anh.
- Hoạt động tốt trên desktop, tablet và mobile.
- Có cơ chế giới hạn lượt AI miễn phí và tài khoản.
- Có thể mở rộng thành mô hình trả phí sau này.

---

# 2. ĐỐI TƯỢNG

Đối tượng chính:
- Học sinh THPT.
- Đặc biệt phù hợp với học sinh đang luyện thi THPTQG.

Tone sản phẩm:
- Hiện đại.
- Trẻ trung.
- Gần gũi.
- Có tính "bắt trend" vừa phải.
- Hơi tinh nghịch.
- Tạo cảm giác học tập vui hơn nhưng vẫn giữ tính học thuật và chính xác.

Không được:
- Dùng slang quá đà.
- Dùng quá nhiều emoji.
- Làm UI giống game đến mức mất tính học tập.
- Dùng câu chữ khiến người dùng bị áp lực hoặc bị hạ thấp khi điểm thấp.

---

# 3. DESIGN DIRECTION — BẮT BUỘC TUÂN THỦ

Ảnh reference do người dùng cung cấp thể hiện đúng visual direction mong muốn.

## 3.1. Tinh thần visual

Hãy xây giao diện:
- White-first.
- Red-accent.
- Clean.
- Premium educational platform.
- Bold typography.
- Nhiều khoảng trắng.
- Các block hình học màu đỏ.
- Các đường chéo / mảng đỏ lớn ở khu vực hero.
- Pattern chấm rất nhẹ trong background.
- Card có border/bo góc tinh tế.
- Shadow nhẹ.
- Hover animation mượt.
- Không sử dụng quá nhiều màu.

## 3.2. Bảng màu đề xuất

Sử dụng CSS variables/design tokens:

--color-primary: #D71920;
--color-primary-dark: #B51219;
--color-primary-light: #FCE8E9;
--color-background: #FFFFFF;
--color-surface: #FFFFFF;
--color-text: #111827;
--color-text-secondary: #6B7280;
--color-muted: #9CA3AF;
--color-border: #E5E7EB;
--color-success: #16A34A;
--color-warning: #F59E0B;
--color-danger: #DC2626;
--color-info: #2563EB;

Quy tắc:
- Đỏ là accent chính, không phủ toàn bộ màn hình.
- Background chính ưu tiên trắng.
- Text chính là đen/xám rất đậm.
- Các vùng nhẹ có thể dùng primary-light.
- Không tự ý thêm một hệ màu cầu kỳ khác nếu không có lý do UX rõ ràng.

## 3.3. Typography

Yêu cầu:
- Font sans-serif hiện đại.
- Có hỗ trợ tốt tiếng Việt và tiếng Anh.
- Heading lớn, đậm.
- Body dễ đọc.
- Các số điểm/metric có thể dùng font weight lớn.
- Bold đúng chỗ, không bôi đậm toàn bộ đoạn văn.

Hierarchy:
- H1: rất nổi bật.
- H2: rõ ràng.
- H3: dùng cho section/card title.
- Body: thoáng, line-height tốt.
- Caption/metadata: nhẹ hơn nhưng vẫn đủ contrast.

Có thể dùng một font hiện đại như Inter hoặc font tương đương có hỗ trợ tiếng Việt; chọn một hệ font nhất quán toàn site.

## 3.4. Hero style

Trang chủ nên có hero lấy cảm hứng từ ảnh reference:
- White background.
- Dotted pattern rất nhẹ.
- Các hình khối đỏ lớn ở mép trái/phải.
- Có thể có đường chéo màu đỏ.
- Motion nhẹ khi load.
- Heading rất lớn, bold.
- Một dòng eyebrow/kicker phía trên heading.
- Có CTA chính nổi bật.
- Không clone bố cục/thương hiệu của website tham khảo.

## 3.5. Animation

Animation phải:
- Smooth.
- 200–500ms cho UI interactions.
- Fade-up khi section xuất hiện.
- Hover card nhẹ.
- Button press nhẹ.
- Progress/chart animate khi render.
- Counter number có thể count-up.
- Chuyển trang/section mượt.

Tránh:
- Animation liên tục.
- Flashing.
- Parallax quá mạnh.
- Animation gây khó chịu trên mobile.

Hỗ trợ `prefers-reduced-motion`.

---

# 4. CẤU TRÚC WEBSITE

Ít nhất có các khu vực/page sau:

1. Home
2. Problem Bank
3. Exam/Quiz
4. Result
5. Progress Dashboard
6. AI Solver
7. Similar Practice
8. Login / Register
9. Account/Profile
10. Usage / AI credits
11. Pricing / Purchase (ban đầu có thể có UI và backend abstraction; gói cụ thể chốt sau)
12. Feedback
13. Settings
14. 404 / Error / Empty states

Navigation desktop:
- Logo/brand của sản phẩm.
- Home
- Ngân hàng đề
- AI Solver
- Tiến độ
- Có thể có Pricing.
- Language switcher.
- Help.
- Account/Login.

Mobile:
- Chuyển thành hamburger / bottom navigation hợp lý.
- Các CTA quan trọng phải dễ bấm bằng ngón tay.

---

# 5. ONBOARDING — HỎI MỤC TIÊU ĐIỂM

Khi người dùng vào website lần đầu, cần có một onboarding nhẹ.

Câu hỏi đầu tiên:
"Bạn đặt mục tiêu bao nhiêu điểm THPTQG?"

Ví dụ:
- 5+
- 6+
- 7+
- 8+
- 9+
- 10

Có thể cho phép nhập số cụ thể 0–10.

UX:
- Hiển thị dưới dạng card/modal/banner đẹp.
- Giải thích ngắn:
  "Chọn mục tiêu để mình giúp bạn theo dõi hành trình."
- Có nút "Bắt đầu".
- Không ép buộc người dùng nếu họ bỏ qua.
- Với guest: lưu mục tiêu bằng local storage/cookie.
- Với account: lưu vào profile/database.

Sau khi hoàn tất:
Hiển thị microcopy cá nhân hóa:
- "Mục tiêu 8+ nhé. Chiến thôi! 🔥"
- "9+ rồi à? Mục tiêu căng nhưng quá được 😎"

Không được làm người dùng cảm thấy thất bại khi chọn mục tiêu thấp.

---

# 6. NGÂN HÀNG ĐỀ ÔN LUYỆN

## 6.1. Danh sách đề

Các card bài/đề nên hiển thị:
- Tên đề.
- Chủ đề.
- Độ khó.
- Số câu.
- Thời gian.
- Trạng thái đã làm/chưa làm.
- Điểm gần nhất.
- Điểm cao nhất (nếu có).

Filter/sort:
- Chủ đề.
- Độ khó.
- Thời gian.
- Đã làm/chưa làm.
- Điểm.

## 6.2. Dữ liệu đề

Mỗi đề phải có:
- id
- title
- description
- language
- duration
- question_count
- difficulty
- topic
- questions
- official_answers
- explanations
- created_at
- updated_at

Mỗi câu:
- id
- stem
- options (nếu trắc nghiệm)
- correct_answer
- explanation
- topic
- difficulty
- tags
- similar_practice_tags

Đáp án chuẩn được nhập sẵn.
Hệ thống chấm phải dùng đáp án chuẩn, không dùng AI để quyết định đúng/sai cho các đề chính thức.

---

# 7. LUỒNG LÀM BÀI

Flow:

Problem Bank
→ Chọn đề
→ Intro / Rules
→ Start Exam
→ Làm bài
→ Submit
→ Scoring
→ Result
→ Review wrong answers
→ Explanation hoặc Similar Practice

Trong lúc làm:
- Hiển thị timer.
- Hiển thị progress: x/n câu.
- Có thể đánh dấu câu cần xem lại.
- Có navigation câu hỏi.
- Giữ lựa chọn của người dùng nếu refresh trong điều kiện an toàn.
- Có confirmation trước khi nộp.
- Không làm mất bài do thao tác nhầm.

---

# 8. CHẤM ĐIỂM

Sau khi nộp:
- Tính số câu đúng.
- Điểm theo cấu hình đề.
- Thời gian làm.
- Tỷ lệ đúng.
- Có thể hiển thị câu đúng/sai/bỏ trống.
- So sánh với mục tiêu cá nhân.

Result page cần có visual mạnh:
- Điểm lớn.
- Progress/ring/bar.
- Tổng câu.
- Đúng.
- Sai.
- Bỏ qua.
- Thời gian.
- Chủ đề mạnh/yếu.

---

# 9. TƯƠNG TÁC THEO ĐIỂM

Trong bài và sau khi nộp, dùng microcopy trẻ trung, tích cực.

Logic đề xuất:

Score >= 9:
"**SIÊU GIỎI! 🔥** Mục tiêu 9+ đang nằm rất gần — phong độ này cứ giữ nhé!"

Score >= 8 và < 9:
"**Quá ổn áp!** Bạn đang có nền tảng rất tốt. Thêm vài câu nữa là lên 9+."

Score >= 6.5 và < 8:
"**Ổn rồi đó!** Giờ mình gỡ từng lỗi một để kéo điểm lên nhé."

Score >= 5 và < 6.5:
"**Đang lên!** Đừng vội nản — mình xem lại những câu sai rồi chiến tiếp."

Score < 5:
"**Không sao cả.** Điểm này chỉ là một checkpoint. Mình cùng xem từng câu sai và kéo nó lên dần nhé."

Các thông điệp chỉ là mẫu. Có thể viết thêm nhiều biến thể để tránh lặp.

Quan trọng:
- Không chế giễu điểm thấp.
- Không so sánh người dùng với người khác.
- Không dùng từ xúc phạm.
- Khen quá mức cũng không nên; lời khen phải gắn với kết quả cụ thể.

---

# 10. REVIEW CÂU SAI

Sau bài làm, từng câu sai có hai CTA chính:

[ Xem lời giải ]
[ Luyện câu tương tự với AI ]

## Xem lời giải
Hiển thị explanation có sẵn từ database.

Ưu tiên:
- Công thức.
- Logic.
- Các bước.
- Kết luận.

## Luyện câu tương tự với AI
Gửi context:
- Câu gốc.
- Chủ đề.
- Độ khó.
- Kiến thức cần dùng.
- Có thể kèm đáp án/giải thích chuẩn nếu hữu ích.

AI tạo một câu mới tương tự:
- Không sao chép nguyên câu.
- Thay đổi số liệu/bối cảnh hợp lý.
- Giữ cùng kỹ năng cần luyện.
- Có answer hidden trước khi người dùng nộp.
- Người dùng làm bài mới trực tiếp trên web.
- Sau khi submit, chấm và giải thích.

---

# 11. AI SOLVER

Trang riêng dành cho hỏi đáp AI.

Input:
1. Text
2. Image upload

UI:
- Text area lớn.
- Drag & drop image.
- Button upload.
- Preview ảnh.
- Remove image.
- Solve button.
- Loading state.
- Error state.

Không yêu cầu login cho lượt miễn phí đầu tiên.

---

# 12. AI SOLVER — RESPONSE RULES

AI phải tuân thủ quy trình:

1. Đọc và xác định dữ kiện.
2. Xác định dạng toán.
3. Nêu phương pháp.
4. Giải từng bước.
5. Không bỏ qua biến đổi quan trọng.
6. Kiểm tra lại kết quả.
7. Cuối cùng đưa ra đáp án.
8. Ngôn ngữ trả lời theo `language setting` của website.

Nếu website là Vietnamese:
→ trả lời tiếng Việt.

Nếu website là English:
→ trả lời tiếng Anh.

## Văn phong

AI phải:
- Trẻ trung.
- Gần gũi.
- Hơi tinh nghịch.
- Có cảm giác vui vẻ.
- Có thể dùng một số cách nói bắt trend vừa phải.
- Vẫn chính xác và rõ ràng.

Ví dụ:
"Đến đây thì định lý Pythagore xuất hiện đúng lúc rồi 😎."

Không được:
- Spam emoji.
- Dùng slang khó hiểu.
- Hy sinh tính chính xác để tạo trò vui.

## Cấu trúc câu trả lời

Khuyến nghị UI render:

### Phân tích đề
...

### Dạng toán
...

### Phương pháp
...

### Lời giải
**Bước 1.** ...
**Bước 2.** ...
**Bước 3.** ...

### Kiểm tra
...

### Đáp án
**...**

Nếu đề không đủ rõ:
→ AI phải nói rõ phần nào không chắc.
→ Không được bịa số liệu/ký hiệu.
→ Có thể yêu cầu người dùng upload ảnh rõ hơn.

---

# 13. AI GIẢI BẰNG HÌNH ẢNH

Pipeline:

Image upload
→ Validate type/size
→ Vision-capable model
→ Parse problem
→ Solve
→ Verify
→ Render solution

Yêu cầu:
- Preview ảnh trước khi gửi.
- Hiển thị trạng thái upload.
- Có progress/loading.
- Xử lý ảnh không đọc được.
- Xử lý ảnh quá lớn.
- Chặn file không hợp lệ.
- Không lưu ảnh lâu hơn cần thiết nếu chưa có consent/storage requirement.

AI phải ưu tiên đọc:
- Công thức.
- Chỉ số.
- Ký hiệu.
- Hình học.
- Dấu âm.
- Phân số.
- Căn.
- Mũ.
- Bảng/biểu đồ.

Nếu mơ hồ:
"Phần hệ số ở dòng thứ 2 hơi khó đọc. Bạn thử chụp gần hơn một chút nhé."

---

# 14. AI USAGE / GIỚI HẠN LƯỢT

Quy tắc mới nhất do chủ sản phẩm xác nhận (thay thế mọi quy tắc cũ về bonus/gói):

Guest:
- 5 lượt AI tổng cộng.

Tài khoản Free:
- 5 lượt AI mỗi ngày theo ngày lịch Việt Nam.
- Không có bonus một lần khi đăng ký.

Gói trả phí theo tháng:
- Plus: 70.000 VND/tháng, 15 lượt AI/ngày.
- Pro: 100.000 VND/tháng, 25 lượt AI/ngày.
- Pro Max: 125.000 VND/tháng, 50 lượt AI/ngày.
- Reset quota mỗi ngày theo `Asia/Ho_Chi_Minh`.

Database cần track:
- user_id
- guest/session identifier nếu dùng
- free_credits
- purchased_credits
- used_credits
- total_requests
- created_at
- updated_at

Quan trọng:
- Không dựa duy nhất vào localStorage để kiểm soát lượt vì có thể dễ bị reset/manipulate.
- Việc kiểm soát lượt thật phải nằm ở server/database.

---

# 15. TÀI KHOẢN

Cần có:
- Register
- Login
- Logout
- Password reset
- Profile
- Language preference
- Target score
- Usage/credits
- History

User profile:
- display_name
- email
- language
- target_score
- created_at

Không lưu plain-text password.
Không log secret/token.

---

# 16. THANH TOÁN

Hệ thống phải có abstraction để sau này tích hợp payment provider.

Provider thanh toán chưa được chốt. Giá/gói mới nhất đã được chốt ở mục 14; lưu cấu hình trong data/database, không hard-code trong UI.

Tạo concept:

Product / Plan
- id
- name
- credits
- price
- currency
- description
- active

Payment
- id
- user_id
- plan_id
- amount
- currency
- status
- provider
- transaction_id
- created_at

Credits chỉ được cộng sau khi server xác minh payment thành công.

Không tin dữ liệu "payment success" từ client.

---

# 17. THEO DÕI TIẾN ĐỘ

Dashboard có:
- Điểm theo từng lần làm đề.
- Điểm cao nhất.
- Điểm trung bình.
- Số đề đã làm.
- Số câu đã làm.
- Tỷ lệ đúng.
- Thời gian làm.
- Chủ đề mạnh.
- Chủ đề cần cải thiện.
- AI questions used.
- Progress toward target score.

Đồ thị:
- Line chart điểm theo thời gian.
- Có goal line theo target score.
- Có thể thêm accuracy chart.
- Responsive.
- Tooltip rõ ràng.

Microcopy:
- "Bạn đang tiến bộ!"
- "Điểm gần nhất đã tăng X điểm."
- "Mốc tiếp theo: 8+."
- "Cố thêm một chút nữa là chạm mục tiêu."

Không tạo leaderboard nếu chưa có yêu cầu.

---

# 18. FEEDBACK / GÓP Ý

Có khu vực "Góp ý".

Form:
- Name (optional)
- Email
- Message
- Category (optional)
- Submit

Mục tiêu:
- Có thể gửi email đến Gmail/email quản trị của chủ project.

Không đặt email/password SMTP trực tiếp trong frontend.

Nên trừu tượng hóa qua server/email provider.

Có:
- Success message.
- Error message.
- Anti-spam cơ bản.
- Rate limit.

Microcopy:
"Web vẫn đang được nâng cấp từng ngày. Có gì chưa ổn cứ nói nhé — góp ý của bạn rất có giá trị."

---

# 19. LANGUAGE — VIETNAMESE / ENGLISH

Website có switch:
VI | EN

Tất cả UI strings phải đi qua translation system.

Không hard-code text UI rải rác trong component.

Translation cần bao gồm:
- Navigation.
- Buttons.
- Form labels.
- Errors.
- Empty states.
- Loading.
- Exam instructions.
- Result text.
- AI UI.
- Feedback.
- Account.
- Pricing.
- Onboarding.
- Microcopy.

AI trả lời theo language setting.

Nếu user đổi ngôn ngữ:
- UI đổi.
- Prompt AI đổi.
- Không làm mất state bài đang làm.

---

# 20. HOME PAGE

Home nên có các section:

Hero:
- Eyebrow text.
- Main heading.
- Short description.
- Primary CTA: "Làm đề ngay"
- Secondary CTA: "Hỏi AI"
- Visual elements đỏ/trắng.

Features:
- Ngân hàng đề.
- Chấm điểm.
- Theo dõi tiến độ.
- AI giải toán.
- Giải bằng hình ảnh.

AI section:
- Giới thiệu AI Solver.
- Demo text input/image upload.

Practice section:
- Một số đề nổi bật.

Progress section:
- Minh họa dashboard/chart.

Final CTA:
- "Sẵn sàng chinh phục mục tiêu điểm?"

Footer:
- Navigation.
- Language.
- Feedback.
- Copyright.
- Privacy / Terms nếu triển khai thật.

---

# 21. UI MICROCOPY

Ưu tiên những câu ngắn, có nhịp và tự nhiên.

Ví dụ:

Welcome:
"Chào mừng bạn quay lại! Hôm nay chiến mấy câu?"

Start:
"Chiến thôi 🚀"

AI:
"Đưa đề đây, mình cùng gỡ."

Upload:
"Thả ảnh đề vào đây nhé."

Loading:
"AI đang đọc đề... khoan nóng 😎"

Longer loading:
"Đang suy luận từng bước... não AI cũng cần vài giây nhé."

Correct:
"Chuẩn bài! 🔥"

Wrong:
"Úi, câu này trượt một chút. Mình xem lại nhé."

After explanation:
"Hiểu chỗ này rồi thì bài tương tự cũng không làm khó được bạn đâu."

Similar problem:
"Thử một câu cùng dạng xem kiến thức đã vào form chưa?"

High score:
"**Quá cháy!**"

Near goal:
"**Sắp chạm mục tiêu rồi!**"

Goal reached:
"**Mục tiêu đạt rồi! 🔥**"

Goal exceeded:
"**Vượt mục tiêu luôn! Quá xịn.**"

---

# 22. ACCESSIBILITY

Bắt buộc:
- Semantic HTML.
- Keyboard navigation.
- Focus states.
- Sufficient contrast.
- Alt text.
- Labels rõ ràng.
- Buttons có accessible name.
- Không phụ thuộc chỉ vào màu để báo đúng/sai.
- Error message dễ đọc bằng screen reader.

---

# 23. RESPONSIVE DESIGN

Desktop:
- Tận dụng không gian lớn.
- Layout nhiều cột khi hợp lý.

Tablet:
- Collapse grid hợp lý.

Mobile:
- Không horizontal overflow.
- Text không quá nhỏ.
- Touch target đủ lớn.
- Sticky exam controls hợp lý.
- Charts không tràn màn hình.
- Upload image dễ thao tác.
- AI response đọc tốt trên màn hình hẹp.

Phải test tối thiểu:
- 360px
- 390px
- 768px
- 1024px
- 1440px+

---

# 24. PERFORMANCE

Yêu cầu:
- Lazy load image.
- Optimize image.
- Code splitting khi cần.
- Không load animation nặng nếu không cần.
- Debounce search.
- Pagination hoặc virtualization cho problem bank lớn.
- API timeout.
- Retry có kiểm soát.
- Cache dữ liệu đọc nhiều.
- Không gửi request AI trùng do double click.

Button Solve cần disable trong lúc request đang chạy.

---

# 25. SECURITY

Bắt buộc:
- API keys chỉ ở server.
- Environment variables.
- Server-side validation.
- File upload validation.
- Rate limiting.
- Input sanitization.
- Không trust client-side credits.
- Không trust client-side payment status.
- Auth/session an toàn.
- Không trả stack trace nhạy cảm cho user.
- Không log prompt/image chứa dữ liệu nhạy cảm một cách vô hạn.

---

# 26. ERROR STATES

Phải có UI tử tế cho:
- AI timeout.
- AI unavailable.
- Image parse failed.
- Invalid image.
- Too large image.
- Rate limited.
- No credits.
- Login failure.
- Payment failure.
- Network failure.
- Empty problem bank.
- Problem not found.
- 404.

Không hiển thị raw technical errors kiểu:
"500 INTERNAL SERVER ERROR"

Thay bằng:
"Có vẻ hệ thống đang gặp chút trục trặc. Thử lại sau vài giây nhé."

Có nút Retry.

---

# 27. TECH STACK

Khuyến nghị:

Frontend:
- Next.js
- React
- TypeScript
- Tailwind CSS

Backend:
- Next.js server/API routes hoặc FastAPI.
- Chọn một hướng rõ ràng, tránh tạo kiến trúc hai backend không cần thiết.

Database:
- PostgreSQL / Supabase.

AI:
- OpenAI API.
- Anthropic API có thể được thêm sau.
- Tạo AI provider abstraction để đổi provider dễ.

Charts:
- Một thư viện chart nhẹ, responsive.

Auth:
- Một solution phổ biến, an toàn, typed.

Email:
- Server-side email provider abstraction.

Deployment:
- Vercel cho frontend/Next.js nếu phù hợp.
- Database cloud.
- Backend cùng nền tảng hoặc service phù hợp.

---

# 28. AI PROVIDER ABSTRACTION

Không viết logic ứng dụng trực tiếp phụ thuộc sâu vào một provider.

Thiết kế kiểu:

AIProvider
- solveText()
- solveImage()
- generateSimilarProblem()

Implementations:
- OpenAIProvider
- AnthropicProvider

Có thể config:

AI_PROVIDER=openai

Sau này đổi provider mà không phải sửa toàn bộ application.

---

# 29. PROMPT ARCHITECTURE

Tách prompt ra khỏi code component.

Ví dụ:

prompts/
- math-solver.vi.ts
- math-solver.en.ts
- similar-problem.vi.ts
- similar-problem.en.ts

AI system rules phải quy định:
- Role.
- Academic level.
- Solution workflow.
- Tone.
- Output structure.
- Uncertainty handling.
- Language.
- Safety against hallucinating missing data.

---

# 30. AI STRUCTURED OUTPUT

Ưu tiên yêu cầu AI trả dữ liệu có cấu trúc thay vì một plain-text blob.

Ví dụ schema logic:

{
  "problem_summary": "...",
  "problem_type": "...",
  "method": "...",
  "steps": [
    {
      "title": "Bước 1",
      "content": "..."
    }
  ],
  "verification": "...",
  "final_answer": "...",
  "confidence_note": null
}

Frontend tự render các section.

Không cho AI tự kiểm soát HTML tùy ý.

---

# 31. MATHEMATICAL VERIFICATION

Nếu có thể:
- Dùng thư viện toán / symbolic checker để kiểm tra kết quả.
- Đặc biệt với phương trình, đại số và các biểu thức có thể kiểm chứng.

AI không phải nguồn duy nhất quyết định tính đúng đắn nếu có thể kiểm chứng bằng máy.

Nếu không thể xác minh tự động:
- Hiển thị lời giải theo cách rõ ràng.
- Có thể thêm note nội bộ về giới hạn kiểm chứng.

---

# 32. DATA MODEL TỐI THIỂU

Entities:

User
- id
- email
- password_hash/auth_provider
- display_name
- language
- target_score
- created_at
- updated_at

ProblemSet
- id
- title
- description
- language
- duration
- difficulty
- topic
- active

Problem
- id
- problem_set_id
- order_index
- stem
- options
- correct_answer
- explanation
- topic
- difficulty

Attempt
- id
- user_id
- problem_set_id
- score
- correct_count
- wrong_count
- blank_count
- duration
- created_at

Answer
- id
- attempt_id
- problem_id
- selected_answer
- is_correct

AIUsage
- id
- user_id/session_id
- request_type
- input_type
- provider
- model
- created_at
- token usage nếu provider trả về

CreditBalance
- user_id
- free_credits
- purchased_credits
- used_credits
- updated_at

Payment
- id
- user_id
- plan_id
- amount
- currency
- status
- provider
- transaction_id
- created_at

Feedback
- id
- user_id nullable
- email
- category
- message
- created_at

---

# 33. FOLDER STRUCTURE THAM KHẢO

app/
  (public)/
  home/
  problems/
  exams/
  results/
  progress/
  ai/
  auth/
  account/
  pricing/
  feedback/

components/
  ui/
  layout/
  home/
  problems/
  exam/
  results/
  progress/
  ai/

lib/
  ai/
    provider.ts
    openai.ts
    anthropic.ts
  auth/
  db/
  scoring/
  credits/
  payments/
  email/
  i18n/
  validation/

prompts/
  math-solver.vi.ts
  math-solver.en.ts
  similar-problem.vi.ts
  similar-problem.en.ts

types/
schemas/
tests/

---

# 34. PHASED DEVELOPMENT — RẤT QUAN TRỌNG

KHÔNG xây tất cả trong một lần.

## Phase 0 — Planning
- Confirm requirements.
- Create architecture.
- Create design tokens.
- Create route map.
- Create data model.
- Create env example.
- Create README.

## Phase 1 — Visual foundation
- Next.js setup.
- Fonts.
- Colors.
- Global styles.
- Header.
- Footer.
- Buttons.
- Cards.
- Modal.
- Responsive system.
- Animation primitives.

Goal:
→ Có shell đẹp và đúng design direction.

## Phase 2 — Home page
- Hero.
- Feature sections.
- CTA.
- AI intro.
- Practice preview.
- Progress preview.

## Phase 3 — Problem Bank
- Problem list.
- Filters.
- Problem detail.
- Exam start.

## Phase 4 — Exam engine
- Question navigation.
- Timer.
- Answer selection.
- Review marker.
- Submit.
- Scoring.
- Result.

## Phase 5 — Explanations
- Wrong answer review.
- Built-in explanation.

## Phase 6 — Progress dashboard
- History.
- Charts.
- Target score.
- Topic analysis.

## Phase 7 — AI Solver text
- AI endpoint.
- Prompt system.
- Structured output.
- Response rendering.
- Credits.

## Phase 8 — AI Solver image
- Upload.
- Validation.
- Vision pipeline.
- Error handling.

## Phase 9 — Similar Practice
- Generate similar problem.
- Solve.
- Grade.
- Explanation.

## Phase 10 — Authentication
- Register/login.
- Profile.
- Target score.
- Persistent credits/history.

## Phase 11 — Usage & payments abstraction
- Guest: 5 lượt tổng cộng; tài khoản Free: 5 lượt/ngày.
- Plus, Pro, Pro Max allowance và giá theo mục 14.
- Purchase-ready data model.
- Payment status flow.
- Pricing page placeholder.

## Phase 12 — Feedback/email
- Form.
- Server submission.
- Email delivery.

## Phase 13 — i18n
- Full VI/EN UI.
- Prompt language.
- Language persistence.

## Phase 14 — QA
- Tests.
- Mobile testing.
- Error states.
- Security review.
- Performance review.
- Accessibility review.

## Phase 15 — Production
- Environment variables.
- Deploy.
- Domain.
- Monitoring/logging.
- Final smoke test.

---

# 35. CODING RULES FOR CODEX

1. TypeScript strict mode.
2. Không dùng `any` nếu có thể tránh.
3. Reusable components.
4. Không lặp UI code vô lý.
5. Tách business logic khỏi presentation.
6. Tách provider AI.
7. Tách scoring engine.
8. Tách credit logic.
9. Server-side secrets.
10. Validate cả client và server.
11. Không hard-code credentials.
12. Không hard-code pricing.
13. Không hard-code UI translation.
14. Không hard-code AI prompt vào component.
15. Comment chỉ ở phần logic khó.
16. Ưu tiên accessibility.
17. Ưu tiên responsive.
18. Không phá functionality đang chạy.
19. Sau mỗi phase:
   - run lint
   - run typecheck
   - run tests nếu có
   - run build
   - sửa lỗi
20. Trước khi kết thúc task:
   - kiểm tra toàn bộ affected routes.
   - kiểm tra console errors.
   - kiểm tra mobile layout.
   - báo rõ phần nào đã hoàn thành.

---

# 36. CÁCH CODEX PHẢI LÀM VIỆC

Trước mỗi thay đổi lớn:
1. Đọc code hiện tại.
2. Xác định dependency.
3. Lập plan ngắn.
4. Implement.
5. Test.
6. Fix.
7. Tóm tắt thay đổi.

Không:
- Rewrite toàn bộ project chỉ để sửa một bug nhỏ.
- Xóa feature cũ nếu không được yêu cầu.
- Thay framework giữa chừng.
- Thêm thư viện nặng nếu native solution đủ.
- Tạo code không cần thiết.

---

# 37. ACCEPTANCE CRITERIA MVP

MVP được xem là hoàn thành khi:

[ ] Home responsive và đúng red/white design direction.
[ ] Có animation cơ bản.
[ ] Có VI/EN.
[ ] First visit hỏi target score.
[ ] Có Problem Bank.
[ ] Người dùng làm đề trực tiếp.
[ ] Có timer.
[ ] Có submit.
[ ] Có chấm điểm.
[ ] Có review câu sai.
[ ] Có explanation có sẵn.
[ ] Có progress dashboard.
[ ] Có chart.
[ ] Có AI Solver.
[ ] AI nhận text.
[ ] AI nhận image.
[ ] AI giải theo 7 bước.
[ ] AI trả lời theo language setting.
[ ] AI có youthful/trendy tone vừa phải.
[ ] Có similar practice.
[ ] Có 5 lượt guest free.
[ ] Tài khoản Free nhận 5 lượt/ngày; không có signup bonus.
[ ] Plus = 70.000 VND/tháng, 15 lượt/ngày.
[ ] Pro = 100.000 VND/tháng, 25 lượt/ngày.
[ ] Pro Max = 125.000 VND/tháng, 50 lượt/ngày.
[ ] Credit tracking nằm phía server.
[ ] Có login/register.
[ ] Có feedback form.
[ ] Payment architecture sẵn sàng để thêm sau.
[ ] API keys không lộ frontend.
[ ] Không có horizontal overflow trên mobile.
[ ] Build pass.
[ ] Không có lỗi runtime nghiêm trọng.

---

# 38. CHECKLIST UI TRƯỚC KHI KẾT THÚC

Kiểm tra:
- Đúng màu đỏ/trắng.
- Hero có geometric red elements.
- Background pattern nhẹ.
- Heading bold.
- Buttons rõ ràng.
- Cards sạch.
- Shadow vừa phải.
- Animation mượt.
- Không quá nhiều màu.
- Không copy logo/branding của reference.
- Mobile đẹp.
- Desktop đẹp.
- Language switch hoạt động.
- Bold text dùng đúng chỗ.
- Microcopy nhất quán.
- Error states đẹp.
- Loading states đẹp.
- Empty states đẹp.

---

# 39. PRODUCT PRINCIPLES

Website phải truyền tải cảm giác:

"Bạn vào đây để luyện tập, không phải để bị chấm điểm."

Mỗi kết quả phải giúp người dùng biết:
- Mình đang ở đâu.
- Mình sai chỗ nào.
- Cần luyện gì.
- Bước tiếp theo là gì.

AI phải đóng vai trò:
- Tutor.
- Giải thích.
- Gợi ý.
- Tạo bài luyện thêm.

Không chỉ:
- Trả lời đáp án.

---

# 40. GHI CHÚ VỀ FINE-TUNING / "HUẤN LUYỆN GPT"

Không thiết kế kiến trúc dự án phụ thuộc bắt buộc vào fine-tuning.

Ưu tiên:
1. System prompt.
2. Structured output.
3. Few-shot examples.
4. Problem Bank / reference data.
5. Verification.
6. Provider abstraction.

Mục tiêu là khiến AI trả lời nhất quán theo phong cách của sản phẩm mà không phải retrain model cho từng thay đổi nhỏ.

---

# 41. FINAL INSTRUCTION TO CODEX

Hãy coi file này là product specification chính.

Khi bắt đầu:
1. Đọc toàn bộ.
2. Không tự ý thay đổi mục tiêu sản phẩm.
3. Bắt đầu từ Phase 0.
4. Không nhảy thẳng tới payment nếu core exam/AI chưa ổn.
5. Sau mỗi phase, kiểm tra code.
6. Ưu tiên UX và độ ổn định.
7. Khi có điểm chưa rõ, chọn giải pháp dễ mở rộng và ghi assumption.
8. Tạo code production-minded nhưng MVP-first.
9. Không bỏ sót responsive, bilingual, accessibility, security và error handling.
10. Không dùng fake success/payment/AI responses trong production flow.
11. Dùng mock data chỉ trong giai đoạn UI prototype; sau khi backend feature được triển khai thì chuyển sang dữ liệu thật.
12. Không hoàn thành task chỉ bằng cách tạo UI; các nút chính phải có logic tương ứng.
---

# 42. PRODUCT NAME / BRANDING — FINAL

- Product name: **MathPath**
- Repository name: **mathpath**
- Logo/brand name: **MathPath**
- Working domain and metadata should use **MathPath** unless the owner specifies otherwise.

Use MathPath as the sole product name across the application, metadata, and brand assets. Preserve the existing red-and-white visual direction while creating original MathPath branding.

---

# 43. LOGO / BRAND ASSET

Create an original MathPath logo concept combining:
- Mathematics.
- A parabola / graph curve.
- Statistics/data bars or points.
- Upward progress.
- A subtle achievement/spark motif.

Visual rules:
- Red + dark charcoal.
- Clean geometric/vector-like appearance.
- Recognizable at small sizes.
- Avoid excessive detail.

Use:
- /public/branding/logo.svg
- /public/branding/logo-mark.svg
- /public/branding/favicon.svg

Do not use the reference site's logo, name, photos, or branding.

The generated logo concept provided during planning is only a visual starting point. If the final SVG is manually recreated, preserve the concept but redraw it as an original vector asset rather than embedding a raster screenshot.

---

# 44. LOCKED VISUAL DIRECTION

The uploaded screenshot is a reference for visual direction only.

Target feel:
- Modern educational platform.
- White-first background.
- Strong red accents.
- Large bold typography.
- Light dotted/grid pattern.
- Red geometric blocks and diagonal forms.
- Premium but approachable.
- Smooth motion.
- Clean spacing.
- Original branding.

Use the visual principles, not an exact copy of the reference.

---

# 45. INTERACTIONS / MICRO-INTERACTIONS

The website needs noticeably richer interaction than a static template.

Every major interactive element should support:
- idle
- hover
- active
- focus
- disabled
- loading
- success
- error

Hover examples:
- Card lift 2–6px.
- Slight shadow increase.
- Slight border/accent emphasis.
- Optional scale around 1.01.

Buttons:
- Hover: subtle lift/brightness change.
- Press: scale around 0.98.
- Loading: spinner/animated state and disabled duplicate submissions.

Optional cursor-aware polish:
- Very subtle hero decoration movement.
- Card highlight following cursor.
- Disable/simplify on touch devices.

Respect `prefers-reduced-motion`.

---

# 46. TEXT / NUMBER ANIMATIONS

Use tasteful:
- Typing effect for non-critical hero/microcopy.
- Fade/slide text reveal.
- Number count-up for statistics.
- Animated score result.
- Animated progress indicators.

Never delay essential instructions only for animation.

---

# 47. THPTQG 2027 COUNTDOWN

Target:
**11/06/2027**

Display:
- Days
- Hours
- Minutes
- Seconds

Timezone:
**Asia/Ho_Chi_Minh**

Must:
- Update every second.
- Avoid Next.js hydration mismatch.
- Stop at target timestamp.
- Show a final state after the deadline.
- Localize VI/EN.
- Store the date in one shared configuration constant.

Example:
VI: `Đếm ngược đến THPTQG 2027`
EN: `Countdown to THPTQG 2027`

---

# 48. PERSONALIZED TARGET SCORE ONBOARDING

On first visit:
1. Ask: `Bạn đặt mục tiêu bao nhiêu điểm THPTQG?`
2. Options: 5+, 6+, 7+, 8+, 9+, 10 or custom 0–10.
3. Save for guest in local storage/cookie.
4. Save for signed-in users in the database.
5. Use it in dashboard, charts, recommendations and microcopy.

Examples:
- `Mục tiêu 8+ đã chốt. Chiến thôi!`
- `9+ mode activated 🔥`

Never shame a user for choosing or missing a target.

---

# 49. CONTEXTUAL STUDENT MICROCOPY

Create a centralized microcopy dictionary.

Examples:

Before exam:
- `Sẵn sàng chưa? Mình bắt đầu nhé.`
- `20 câu trước mắt. Tập trung nào! 🎯`

During exam:
- `Đang vào form rồi đấy!`
- `Còn 5 câu nữa — giữ nhịp nhé.`
- `Câu này hơi gắt? Đánh dấu lại rồi quay lại sau.`

Correct:
- `Chuẩn bài!`
- `Nice! Câu này xử đẹp.`

Wrong:
- `Úi, câu này chưa đúng. Mình bóc lỗi nhé.`
- `Không sao, sai ở đâu sửa ở đó.`

After improvement:
- `Điểm đang đi lên rồi — cứ giữ nhịp này!`

Near goal:
- `Còn thiếu một chút nữa thôi!`

Goal reached:
- `Mục tiêu đạt rồi! 🔥`

Low score:
- `Không sao cả. Đây chỉ là một checkpoint. Mình xem lại từng lỗi rồi kéo điểm lên.`

Rules:
- Youthful.
- Slightly playful.
- Trend-aware.
- Respectful.
- No insults.
- No excessive slang.
- No emoji spam.
- Never shame low scores.

---

# 50. AUTHENTICATION — FINAL SCOPE

Required:
1. Email/password.
2. Google OAuth.
3. Phone number + SMS OTP.

Use managed authentication (Supabase Auth) rather than homemade auth.

Required UX:
- Google sign-in.
- Phone OTP screen.
- OTP resend countdown.
- Error handling.
- Logout.
- Password recovery.
- Persistent sessions.
- Account/profile.

Phone OTP requires an SMS provider/configuration.

---

# 51. AI CREDIT SYSTEM — FINAL BUSINESS RULES

Guest:
- 5 free AI requests.

After guest uses all 5:
- Require account registration.

Registered Free account:
- **5 AI requests per Vietnam calendar day**.
- **No one-time signup bonus**.

Paid plans:
- **Plus: 70,000 VND/month, 15 AI requests/day**.
- **Pro: 100,000 VND/month, 25 AI requests/day**.
- **Pro Max: 125,000 VND/month, 50 AI requests/day**.
- Daily reset uses `Asia/Ho_Chi_Minh`; server/database controls the reset.

Suggested data:
- free_credits
- purchased_credits
- used_credits
- vip_active
- vip_started_at
- vip_expires_at
- daily_ai_limit
- daily_ai_used
- daily_ai_reset_date

Do not trust client-side credit counts.

---

# 52. PAYMENT — QR TRANSFER + TRANSACTION CODE

Initial payment model:
**Bank transfer via QR.**

High-level flow:

1. User selects a configured paid plan.
2. Server creates a unique order.
3. Server creates a unique payment code, e.g. `MP26000123`.
4. Website displays:
   - The selected plan's configured VND amount
   - bank name/account
   - payment code
   - QR code
5. User scans QR in a banking app.
6. Bank transfer arrives.
7. Payment integration provider detects transaction.
8. Provider sends webhook to backend.
9. Backend verifies webhook authenticity.
10. Backend matches payment code + amount + order.
11. Mark order paid.
12. Activate VIP.
13. Frontend receives success state.

A service such as SePay documents this QR + webhook workflow and supports payment-code prefixes plus HMAC-SHA256 webhook verification. Keep the project provider-agnostic by implementing:

PaymentProvider
- createPaymentOrder()
- createQrPayload()
- verifyWebhook()
- parseTransaction()
- reconcilePayment()

Initial concrete provider may be a bank-transfer/QR provider such as SePay, subject to the owner's later provider choice.

Payment data:
- order_id
- user_id
- plan_id
- amount
- currency
- payment_code
- status
- provider
- provider_transaction_id
- created_at
- expires_at
- paid_at

Statuses:
- pending
- paid
- expired
- failed
- refunded
- manual_review

Production requirements:
- HTTPS webhook endpoint.
- HMAC/signature verification where supported.
- Idempotent webhook processing.
- Amount validation.
- Transaction ID deduplication.
- Never activate VIP twice.
- Server-side payment state.
- Reconciliation fallback if a webhook is delayed/missed.

Payment page:
- QR card.
- Copy payment code.
- Copy bank account.
- Countdown.
- `Đang chờ thanh toán...`
- Success.
- Expired/failed states.
- Auto-refresh/push status without requiring a page refresh.

---

# 53. AI REQUEST TRANSACTION RULE

For every AI request:

1. Determine guest/account identity on the server.
2. Check available credit server-side.
3. Reserve/decrement credit atomically.
4. Call AI provider.
5. If the AI request fails before a usable answer, restore the credit according to a deterministic rule.
6. Save usage metadata.
7. Return structured result.

Protect against concurrent double requests.

---

# 54. GOOGLE SEARCH / SEO

"Đưa web lên Google" means public deployment plus search indexing readiness.

Required:
- Public custom domain.
- Good title/description metadata.
- Canonical URLs.
- sitemap.xml.
- robots.txt.
- Public pages crawlable.
- Search Console verification.
- Sitemap submission.
- URL inspection for key pages.
- Structured data where appropriate.

Do not index:
- Account.
- Payment.
- Personal history.
- Private progress.
- Other private user data pages.

Do not promise a search ranking position.
Search indexing can take time after publication.

---

# 55. PRODUCTION / MULTI-USER ARCHITECTURE

Use:

Browser
  ↓
Vercel
  ↓
Next.js
  ├── Public pages
  ├── Auth
  ├── Exam engine
  ├── AI API
  ├── Payment API
  └── Feedback API
       │
       ├── Supabase Auth
       ├── Supabase PostgreSQL
       ├── Optional storage
       ├── OpenAI API
       └── Payment provider/webhook

Persistence must live in database/storage, not process memory or local JSON files.

Architecture must be safe for multiple simultaneous users.

---

# 56. ADMIN-READY DATA DESIGN

Even if the admin dashboard is deferred, the schema must allow future management of:
- problem sets
- questions
- explanations
- answers
- users
- attempts
- payments
- plans
- feedback
- AI usage

---

# 57. PROBLEM BANK IMAGES PROVIDED LATER

The owner will provide problem-bank images later.

When received:
1. Inspect every image.
2. Transcribe accurately.
3. Preserve ordering.
4. Identify options/answers.
5. Determine/verify correct answer.
6. Write a short explanation.
7. Tag topic and difficulty.
8. Add similar-practice skill metadata.
9. Flag unclear images instead of guessing.
10. Produce import-ready structured data for the database.

Official scoring must use the stored answer key, not AI judgment.

---

# 58. AI SIMILAR-PROBLEM GENERATION

When the student clicks `Luyện câu tương tự với AI`, send:
- original question
- topic
- difficulty
- skill/tag
- known common mistake, if available
- official explanation when useful

AI must:
- create a genuinely new question
- preserve the underlying skill
- maintain suitable difficulty
- provide a correct answer
- provide a concise explanation
- avoid copying the source question verbatim

Verify generated mathematics where practical.

---

# 59. UX QUALITY BAR

The site is not finished just because the functions work.

Before release, review:
- typography
- spacing
- alignment
- color consistency
- animations
- loading states
- empty states
- error states
- hover states
- mobile interaction
- AI answer rendering
- countdown
- result page
- dashboard charts
- microcopy
- accessibility

---

# 60. UPDATED DEVELOPMENT PHASES

Phase 0:
Planning + architecture + data model + design tokens.

Phase 1:
Visual system + original logo + header/footer + responsive layout + motion primitives.

Phase 2:
Home + target-score onboarding + THPTQG 2027 countdown.

Phase 3:
Problem Bank + database/import format.

Phase 4:
Exam engine + timer + scoring.

Phase 5:
Result + explanations + contextual microcopy.

Phase 6:
Progress dashboard + charts.

Phase 7:
Email/password + Google authentication.

Phase 8:
Phone OTP authentication.

Phase 9:
AI text solver + server-side credit system.

Phase 10:
AI image solver.

Phase 11:
AI similar-practice.

Phase 12:
Paid plan configuration: Plus (70,000 VND/month, 15/day), Pro (100,000 VND/month, 25/day), Pro Max (125,000 VND/month, 50/day).

Phase 13:
QR payment + unique transaction code + webhook + idempotency.

Phase 14:
Feedback/email.

Phase 15:
SEO + sitemap + robots + Search Console readiness.

Phase 16:
QA + security + accessibility + performance.

Phase 17:
Production deployment + custom domain + monitoring.

---

# 61. UPDATED ACCEPTANCE CHECKLIST

[ ] Original MathPath branding.
[ ] Logo/mark/favicon assets.
[ ] Red/white modern design direction.
[ ] Geometric red accents.
[ ] Dotted/grid background.
[ ] Rich hover/press/focus interactions.
[ ] Tasteful typing/text animations.
[ ] First visit target-score question.
[ ] Live 11/06/2027 countdown.
[ ] VI/EN UI.
[ ] AI follows selected language.
[ ] Guest = 5 free AI requests.
[ ] Registered Free = 5 AI requests/day, no signup bonus.
[ ] Plus = 70,000 VND/month, 15 AI requests/day.
[ ] Pro = 100,000 VND/month, 25 AI requests/day.
[ ] Pro Max = 125,000 VND/month, 50 AI requests/day.
[ ] Vietnam timezone daily reset.
[ ] Email/password auth.
[ ] Google auth.
[ ] Phone OTP auth.
[ ] Problem Bank.
[ ] Official answer-key scoring.
[ ] Built-in explanation.
[ ] Similar-practice AI.
[ ] Text AI solver.
[ ] Image AI solver.
[ ] Progress charts.
[ ] Feedback/email.
[ ] QR payment architecture.
[ ] Unique payment code.
[ ] Secure webhook verification.
[ ] Idempotent VIP activation.
[ ] GitHub-ready.
[ ] Vercel-ready.
[ ] Supabase-ready.
[ ] SEO-ready.
[ ] sitemap.xml.
[ ] robots.txt.
[ ] Search Console ready.
[ ] Mobile 360px+ supported.
[ ] No client-side secrets.
[ ] No client-side credit trust.
[ ] No fake production payment success.
[ ] Build/typecheck/lint pass.

---

# 62. DO NOT MAKE THESE MISTAKES

Do NOT:
- expose OpenAI/Claude API keys in frontend.
- expose Supabase service-role key in browser.
- trust client-side credits.
- trust client-side payment status.
- reset VIP with browser-only time.
- use local JSON as production database.
- grant VIP from an unverified payment request.
- process the same webhook twice.
- use AI to determine official test scoring.
- guess unreadable image math.
- hard-code UI text outside i18n.
- hard-code VIP pricing in components.
- let users bypass the 5 guest-total or daily account/plan limits by refreshing.
- make private pages indexable.
- build desktop-only UI.
- overuse animations.
- make every sentence bold.
- put emoji in every sentence.
- shame low scores.
- copy the reference brand.

---

# 63. FUTURE CONTENT INGESTION WORKFLOW

When the owner sends new problem images:
- Treat them as source material.
- Transcribe and verify.
- Generate short explanations.
- Tag metadata.
- Produce seed/import records.
- Report ambiguity before inserting uncertain data.

---

# 64. FINAL PRODUCT SUMMARY

MathPath is a bilingual, responsive, red-and-white learning platform for Vietnamese high-school students preparing for THPTQG Mathematics.

Core journey:
**Set target → practice → submit → score → review mistakes → see explanation → practice a similar problem with AI → track progress → ask AI directly → upgrade to VIP when needed.**

Core AI behavior:
**Read data → identify problem type → state method → solve step by step → verify → final answer**, in the website's selected language, with a youthful, playful but rigorous tone.

Core monetization:
**5 guest-total AI requests → Free account at 5 requests/day → Plus (70,000 VND/month, 15/day), Pro (100,000 VND/month, 25/day), or Pro Max (125,000 VND/month, 50/day) → QR bank transfer → server-verified transaction code/webhook.**

Core production architecture:
**GitHub → Vercel → Supabase → OpenAI → payment provider → custom domain → Google Search Console.**

This document is the source of truth unless the owner explicitly supersedes a requirement.
