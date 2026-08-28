"use client";

import { useRef } from "react";
import PinerPrototypeV23 from "./PinerPrototypeV23";
import { usePrototypePolish } from "./usePrototypePolish";

const EXACT_COPY: Record<string, string> = {
  "MỚI / ĐÁNG CHÚ Ý": "MỚI GẦN ĐÂY",
  "Đăng ký tại cùng một nơi": "Đăng ký tại đây",
  "Xem Khám Phá <> Premium": "So sánh quyền lợi",
  "Premium mở thêm các buổi Khám Phá ngoài Hành trình chính.": "Thêm các buổi chuyên sâu ngoài Hành trình chính.",
  "Tiếp tục chơi": "Tiếp tục luyện",
  "Fresh / meaningful": "Mới gần đây",
  "Premium đang mở thêm quyền lợi": "Premium đang mở thêm các buổi chuyên sâu",
  "Group theo outcome/item. Khám Phá/Premium gating có thể nằm ở từng media bên trong item.": "Mỗi Thành quả có thể chứa nhiều ảnh, bản ghi và cột mốc. Nội dung đã thuộc về con vẫn được giữ lại khi quyền truy cập thay đổi.",
  "Access expires. Achievement does not.": "Quyền truy cập có thể kết thúc. Thành quả vẫn còn.",
  "Đã sở hữu historical media vẫn được giữ; gating chỉ áp vào nội dung chưa có quyền truy cập.": "Ảnh, bản ghi và cột mốc con đã sở hữu vẫn được giữ lại. Chỉ nội dung chưa mở mới phụ thuộc vào quyền truy cập hiện tại.",
  "Open Studio · một outcome, nhiều nội dung": "Open Studio · 3 nội dung đã lưu",
  "PianoHouse recording": "PianoHouse · Bản ghi âm",
  "Character · Roadmap Mark": "Character · Cột mốc hành trình",
  "Đổi hồ sơ là một hard context switch: dữ liệu của các bé không được gộp vào cùng một Hành trình hoặc Thành quả.": "Mỗi bé có Hành trình, Thành quả và quyền truy cập riêng. Khi đổi hồ sơ, PINO chỉ hiển thị dữ liệu của bé đang chọn.",
  "FUTURE PRICING DIRECTION": "SO SÁNH QUYỀN LỢI",
  "Learn · Progress · Create · Belong": "Học sâu · Tiến bộ · Sáng tạo · Gắn bó",
  "Open Studio theo eligibility hiện hành": "Open Studio theo điều kiện tham gia hiện tại",
  "Khám Phá-access media trong Thành quả": "Nội dung Khám Phá được lưu trong Thành quả",
  "Khám phá Path": "Khám phá các chương trình",
  "Persistent Path Hành trình": "Hành trình theo chương trình được duy trì",
  "Premium media / richer Thành quả": "Nội dung Premium phong phú hơn trong Thành quả",
  "Practice / continuation theo Path": "Luyện tập và tiếp tục theo Hành trình",
  "Quyền lợi khác theo policy được duyệt": "Quyền lợi bổ sung theo chính sách hiện hành",
  "Nâng cấp Premium · pricing chưa chốt": "Nâng cấp Premium · sắp mở",
  "Prototype chỉ chốt UX direction kiểu SaaS plan comparison; chưa invent giá, payment hay Premium OS quantity.": "Thông tin quyền lợi sẽ được cập nhật theo gói Premium hiện hành.",
  "Ảnh curated / portfolio": "Ảnh được chọn vào portfolio",
  "Một Thành quả item có thể chứa nhiều representation/media với access khác nhau. Item không bị tách thành Khám Phá/Premium lane.": "Tất cả ảnh và nội dung của cùng một Thành quả được lưu chung tại đây. Nội dung Premium đã sở hữu vẫn được giữ trong lịch sử.",
  "Premium quota còn trống": "Khám Phá đang khả dụng",
  "Paid Premium dùng tối đa 1 active Đăng ký trong tuần; hai session type dùng chung quota.": "Buổi Khám Phá này đang khả dụng với hồ sơ hiện tại. PINO sẽ xác nhận chỗ sau khi bạn đăng ký.",
  "Đăng ký · tạo Đăng ký Đang chờ xác nhận →": "Đăng ký buổi này →",
  "Prototype access": "Bản thử quyền truy cập",
  "Ẩn worksheet": "Ẩn hướng dẫn",
  "Hiện worksheet": "Hiện hướng dẫn",
  "Bản nhạc full width · phiếu hướng dẫn ngay bên dưới từng câu.": "Bản nhạc ở trên · hướng dẫn thế tay ngay bên dưới từng câu.",
  "Bản nhạc + bàn phím hướng dẫn": "Bản nhạc + hướng dẫn thế tay",
  "Founder · published": "Nội dung PINO",
  "Trial Premium": "Trải nghiệm",
  "Dùng thử Premium": "Trải nghiệm",
  "Trial Journey": "Hành trình Trải nghiệm",
  "Trial đã hết hạn": "Trải nghiệm đã kết thúc",
  "Trial đã kết thúc": "Trải nghiệm đã kết thúc",
  "Trial đã hết": "Trải nghiệm đã kết thúc",
  "Gói đã hết hạn": "Gói đã kết thúc",
  "Không hết hạn cùng access": "Được giữ sau khi quyền truy cập kết thúc",
  "Attrition · quyền học mới đã dừng · lịch sử không mất": "Premium đã kết thúc · Hành trình và Thành quả vẫn được giữ",
  "Recording và cột mốc đã đạt vẫn thuộc về Leo dù gói Premium đã kết thúc.": "Bản ghi âm và cột mốc đã đạt vẫn thuộc về Leo dù gói Premium đã kết thúc.",
  "Premium recording": "Bản ghi âm Premium",
  "Achievement retained": "Cột mốc đã được giữ lại",
  "Đã đạt khi Premium còn active": "Đã đạt khi Premium còn hiệu lực",
  "Next Premium milestone": "Cột mốc Premium tiếp theo",
  "Future progression": "Tiến trình sắp tới",
  "Không có gói Premium active": "Không có gói Premium đang hoạt động",
  "Premium dừng, Hành trình không reset": "Premium kết thúc, Hành trình vẫn được giữ",
  "Attrition là trường hợp gia đình đã dùng Premium nhưng không tiếp tục gói mới. Lịch sử L4 vẫn giữ; progression mới tạm dừng.": "Gia đình đã dùng Premium và hiện chưa tiếp tục gói mới. L4 vẫn được giữ; tiến trình mới tạm dừng.",
  "Recording, cột mốc và Artifact đã vested không mất khi Premium kết thúc. Nội dung tương lai chưa sở hữu vẫn khóa.": "Bản ghi âm, cột mốc và tác phẩm đã sở hữu vẫn được giữ khi Premium kết thúc. Nội dung chưa mở vẫn khóa.",
  "Attrition không đồng nghĩa mất quyền Khám phá Miễn phí": "Premium kết thúc không làm mất quyền Khám Phá",
  "Open Studio Miễn phí tiếp tục theo eligibility của Core. Buổi Premium vẫn cần Premium active.": "Open Studio Khám Phá vẫn có thể dùng khi hồ sơ đủ điều kiện. Buổi Premium vẫn cần quyền truy cập phù hợp.",
  "Attrition khác với Trial hết hạn": "Premium đã kết thúc",
  "Leo đã từng là thành viên Premium trả phí và hiện ngưng tiếp tục gói mới. Quyền học mới dừng nhưng learner identity và lịch sử vẫn nguyên.": "Leo từng là thành viên Premium và hiện chưa tiếp tục gói mới. Hành trình, Thành quả và lịch sử của Leo vẫn được giữ.",
  "ATTRITION · PREMIUM ENDED": "PREMIUM ĐÃ KẾT THÚC",
  "Tạo registration": "Đăng ký cho bé này",
  "REGISTRATION · ĐÃ GHI NHẬN": "ĐÃ GHI NHẬN",
  "Current package": "Gói hiện tại",
  "scroll trái / phải": "Vuốt để xem thêm",
  "Current": "Hiện tại",
  "Little Checkpoints · attended counter": "Cột mốc Little Piner",
  "earned": "Đã đạt",
  "next": "Tiếp theo",
  "EVIP close": "Mốc cuối",
  "Sneak peek · kỳ tiếp theo": "Kỳ tiếp theo",
  "Preview để tạo orientation / re-enroll motivation, không unlock resource sớm.": "Xem trước chủ đề sắp tới. Nội dung luyện tập sẽ mở khi đến kỳ.",
  "Campaign, Open Studio và Premium discovery nằm cùng một return-to-PINO surface.": "Các buổi Khám Phá và trải nghiệm Premium đều nằm tại đây để gia đình dễ chọn.",
  "Premium biến những lần ghé PINO thành Journey dài hạn.": "Premium biến những lần ghé PINO thành một hành trình dài hạn.",
  "Pricing/plan comparison có thể phát triển theo hướng SaaS khi pricing và payment policy được chốt.": "Khi chính sách gói được chốt, gia đình có thể so sánh quyền lợi ngay tại đây.",
  "Đăng ký theo cùng một luồng": "Đăng ký tại cùng một nơi",
  "TRIAL · EXPIRED": "TRẢI NGHIỆM · ĐÃ KẾT THÚC",
  "TRIAL PREMIUM · ACTIVE": "TRẢI NGHIỆM · ĐANG HOẠT ĐỘNG",
  "L4 · Cơ bản · active": "L4 · Cơ bản · đang học",
  "Film Âm nhạc Specialty": "Chuyên đề nhạc phim",
  "Theme study · L2": "Chuyên đề · L2",
  "Specialty · L2": "Chuyên đề · L2",
  "Không tách Thành quả thành hai lane làm mất ngữ cảnh của một outcome.": "Mỗi Thành quả được giữ trọn trong cùng một mục để gia đình dễ xem lại.",
  "Premium mở lại progression mới mà không làm mất lịch sử Trải nghiệm.": "Khi Premium được mở lại, tiến trình tiếp tục từ lịch sử hiện có.",
  "Trải nghiệm đã kết thúc · progression mới đang khóa": "Trải nghiệm đã kết thúc · tiến trình mới đang tạm khóa",
  "Progression mới đang khóa": "Tiến trình mới đang tạm khóa",
  "L4 và achievement cũ vẫn giữ. L5+ cần Premium active.": "L4 và các cột mốc đã đạt vẫn được giữ. L5+ mở lại khi Premium hoạt động.",
  "Little Checkpoint vẫn tính qualifying attended sessions ở mốc 4 / 8 / 12.": "Các cột mốc Little Piner được tính theo số buổi tham dự ở mốc 4 / 8 / 12.",
  "Free / expired · Open Studio theo Free eligibility": "Khám Phá · theo điều kiện tham gia hiện tại",
  "Premium Session cần Premium access; Open Studio vẫn theo active-booking + weekly Free rule hiện hành.": "Buổi Premium cần quyền Premium; các buổi Khám Phá vẫn theo điều kiện tham gia hiện tại.",
  "Trial Premium · có thể đăng ký nhiều booking trong tuần": "Trải nghiệm · có thể đăng ký nhiều buổi trong tuần",
  "Open Studio và Premium Session đều có thể tạo Booking; không áp quota 1 booking của paid Premium.": "Trong thời gian Trải nghiệm, gia đình có thể đăng ký cả buổi Khám Phá và Premium trong cùng tuần.",
  "Premium · tối đa 1 booking đang giữ trong tuần": "Premium · tối đa 1 đăng ký đang hoạt động trong tuần",
  "Open Studio + Premium Session dùng chung một quota. PENDING hoặc CONFIRMED đều chiếm slot cho đến khi Booking thành terminal state.": "Khám Phá và Premium dùng chung một lượt đăng ký trong tuần. Lượt này được giữ cho đến khi đăng ký kết thúc.",
  "Trial được phép có nhiều Booking trong cùng tuần. Active Premium sau Trial dùng quota 1 Booking chung cho Open Studio + Premium Session. Free/expired giữ rule Open Studio riêng đã chốt.": "Trong thời gian Trải nghiệm, gia đình có thể đăng ký nhiều buổi. Với Premium đang hoạt động, Khám Phá và Premium dùng chung một lượt đăng ký trong tuần.",
  "Access hết hạn, learner identity vẫn nguyên": "Trải nghiệm đã kết thúc, hành trình vẫn được giữ",
  "Home foreground retained value và route quay lại. Không tạo lại Student, không reset Hành trình, không thu hồi Achievement.": "Hành trình, Thành quả và các cột mốc đã đạt vẫn được giữ. Gia đình có thể quay lại Premium bất cứ khi nào phù hợp.",
  "Lịch sử đã đạt vẫn xem được; progression mới cần Premium active.": "Lịch sử đã đạt vẫn xem được; tiến trình mới sẽ tiếp tục khi Premium được mở lại.",
  "Leo vẫn có thể quay lại bằng Open Studio nếu hiện đủ điều kiện Khám Phá.": "Leo vẫn có thể tham gia các buổi Khám Phá khi đủ điều kiện.",
  "Các cột mốc và recording đã đạt vẫn thuộc về Leo; bước tiến mới cần Premium active.": "Các cột mốc và bản ghi đã đạt vẫn thuộc về Leo; tiến trình mới sẽ tiếp tục khi Premium được mở lại.",
};

const PHRASE_COPY: Array<[RegExp, string]> = [
  [/Open Studio · một outcome, nhiều nội dung · 2 nội dung Khám Phá · 1 nội dung Premium/g, "Open Studio · 3 nội dung đã lưu · 2 Khám Phá · 1 Premium"],
  [/Một outcome duy nhất, nhưng từng representation bên trong có access riêng\. Khám Phá\/Premium không chia Thành quả thành hai lane\./g, "Tác phẩm này có nhiều nội dung đi kèm. Mỗi nội dung giữ quyền truy cập riêng nhưng vẫn nằm trong cùng một Thành quả."],
  [/Một outcome duy nhất, nhưng từng representation bên trong có access riêng\. Free\/Premium không chia Collection thành hai lane\./g, "Tác phẩm này có nhiều nội dung đi kèm. Mỗi nội dung giữ quyền truy cập riêng nhưng vẫn nằm trong cùng một Thành quả."],
  [/Collection chỉ surface learner-facing outcomes đã được chọn; raw Evidence, audit và review queue ở ngoài surface này\./g, "Thành quả chỉ hiển thị những nội dung PINO đã chọn để gia đình xem lại."],
  [/Thành quả chỉ surface learner-facing outcomes đã được chọn; raw Evidence, audit và review queue ở ngoài surface này\./g, "Thành quả chỉ hiển thị những nội dung PINO đã chọn để gia đình xem lại."],
  [/Raw internal review, evidence obligations và audit trail vẫn ở TOS\/Core; Thành quả chỉ render learner-facing durable outcome\./g, "Thành quả chỉ hiển thị nội dung đã được PINO chọn để gia đình lưu giữ và xem lại."],
  [/Piner không surface internal attendance\/session IDs ở đây; chỉ learner\/parent-readable context\./g, "Thông tin buổi học được trình bày ngắn gọn để gia đình dễ theo dõi."],
  [/Trial đã hết hạn|Trial đã kết thúc|Trial đã hết|Trial expired|Trial ended/gi, "Trải nghiệm đã kết thúc"],
  [/Dùng thử Premium/g, "Trải nghiệm"],
  [/Trial Premium/g, "Trải nghiệm"],
  [/Dùng thử/g, "Trải nghiệm"],
  [/Trial/g, "Trải nghiệm"],
  [/Đã hết hạn/g, "Đã kết thúc"],
  [/đã hết hạn/g, "đã kết thúc"],
  [/Miễn phí/g, "Khám Phá"],
];

function rewriteVisibleCopy(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  nodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, aside, [data-v15-audit-mount='true']")) return;
    const raw = node.nodeValue ?? "";
    const leading = raw.match(/^\s*/)?.[0] ?? "";
    const trailing = raw.match(/\s*$/)?.[0] ?? "";
    const core = raw.trim();
    if (!core) return;

    let next = EXACT_COPY[core] ?? core;
    PHRASE_COPY.forEach(([pattern, replacement]) => {
      next = next.replace(pattern, replacement);
    });

    if (next !== core) node.nodeValue = `${leading}${next}${trailing}`;
  });
}

function polishPracticeGlyphs(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-v21-practice-card='true']").forEach((card) => {
    const primaryAction = card.querySelector<HTMLElement>("[data-v21-practice-arrow='true']");
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);

    nodes.forEach((node) => {
      const value = node.nodeValue?.trim();
      if (value !== "→" && value !== "🔒") return;
      const parent = node.parentElement;
      if (!parent || parent === primaryAction || primaryAction?.contains(parent)) return;
      if (parent.closest("[data-v21-resource-tags='true']")) return;
      parent.dataset.freezeDuplicatePracticeGlyph = "true";
    });
  });
}

function polishExploreSessionModal(root: HTMLElement) {
  const sections = Array.from(root.querySelectorAll<HTMLElement>("section"));
  sections.forEach((section) => {
    const header = section.querySelector<HTMLElement>(":scope > header");
    const typeLabel = header?.querySelector<HTMLElement>(":scope > div > span");
    const title = header?.querySelector<HTMLElement>(":scope > div > strong");
    const label = typeLabel?.textContent?.trim() ?? "";
    if (!header || !title || !(label === "OPEN STUDIO" || label === "KHÁM PHÁ" || label === "PREMIUM" || label === "PREMIUM SESSION")) return;

    section.dataset.freezeSessionModal = "true";
    if (label === "OPEN STUDIO") typeLabel!.textContent = "KHÁM PHÁ";
    if (label === "PREMIUM SESSION") typeLabel!.textContent = "PREMIUM";

    const hero = section.querySelector<HTMLElement>("[data-v22-touchpoint-sheet='true']")
      ?? section.querySelector<HTMLElement>("[data-v21-session-hero='true']");
    if (hero) hero.dataset.freezeSessionHero = "true";

    section.querySelectorAll<HTMLElement>("[data-v23-touchpoint-description='true']").forEach((block) => {
      block.dataset.freezeWrongTouchpointDescription = "true";
    });

    const sessionType = hero?.querySelector<HTMLElement>("small");
    if (sessionType?.textContent?.includes("OPEN STUDIO")) {
      sessionType.textContent = sessionType.textContent.replace("OPEN STUDIO", "KHÁM PHÁ");
    }
    if (sessionType?.textContent?.includes("PREMIUM SESSION")) {
      sessionType.textContent = sessionType.textContent.replace("PREMIUM SESSION", "PREMIUM");
    }
  });
}

function polishRegistrationCopy(root: HTMLElement) {
  const sections = Array.from(root.querySelectorAll<HTMLElement>("section"));
  sections.forEach((section) => {
    const text = section.textContent ?? "";
    const body = section.querySelector<HTMLElement>("[class*='modalBody']");
    if (!body) return;

    const paragraph = body.querySelector<HTMLParagraphElement>(":scope > p");
    const eyebrow = body.querySelector<HTMLElement>(":scope > span");
    const primary = body.querySelector<HTMLButtonElement>("button[type='submit'], button[class*='primaryAction']");

    if (text.includes("Buổi Premium đang khóa")) {
      if (paragraph) paragraph.textContent = "Buổi Premium chỉ mở trong thời gian Trải nghiệm. Các buổi Khám Phá vẫn có thể đăng ký khi hồ sơ hiện tại đủ điều kiện.";
      return;
    }

    if (text.includes("KIỂM TRA ĐỘ TUỔI") && text.includes("Buổi này khác nhóm tuổi")) {
      if (paragraph) paragraph.textContent = "Buổi Khám Phá này được thiết kế cho nhóm tuổi khác với hồ sơ đang xem. Trong thời gian Trải nghiệm, gia đình vẫn có thể tiếp tục sau khi xác nhận cảnh báo độ tuổi.";
      return;
    }

    if (text.includes("ĐĂNG KÝ CHO BÉ KHÁC")) {
      if (paragraph) paragraph.textContent = "Buổi này dành cho nhóm tuổi khác với hồ sơ đang xem. Bạn có thể đăng ký cho anh/chị/em khác bằng thông tin bên dưới; Hành trình của bé đang xem sẽ không bị thay đổi.";
      if (primary) primary.textContent = "Đăng ký cho bé này";
      return;
    }

    if (text.includes("REGISTRATION · ĐÃ GHI NHẬN") || text.includes("Booking của")) {
      if (eyebrow) eyebrow.textContent = "ĐÃ GHI NHẬN";
      if (paragraph) paragraph.textContent = "Đăng ký cho bé khác đã được ghi nhận. Hồ sơ của bé đang xem không bị thay đổi.";
    }
  });
}

function polishExplorePolicyCopy(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[class*='policyBand']").forEach((band) => {
    const strong = band.querySelector<HTMLElement>("strong");
    const detail = band.querySelector<HTMLElement>("span");
    const text = strong?.textContent ?? band.textContent ?? "";
    if (/Trải nghiệm|Trial/i.test(text)) { if (strong) strong.textContent = "Trải nghiệm · linh hoạt trong tuần"; if (detail) detail.textContent = "Có thể đăng ký nhiều buổi Khám Phá và Premium."; return; }
    if (/Premium/i.test(text) && !/Free|đã kết thúc/i.test(text) && !text.includes("Khám Phá /")) { if (strong) strong.textContent = "Premium · 1 đăng ký mỗi tuần"; if (detail) detail.textContent = "Lượt đăng ký dùng chung cho Khám Phá và Premium."; return; }
    if (strong) strong.textContent = "Khám Phá · theo điều kiện tham gia hiện tại";
    if (detail) detail.textContent = "Buổi Premium cần quyền Premium; các buổi Khám Phá vẫn theo điều kiện tham gia hiện tại.";
  });
  root.querySelectorAll<HTMLElement>("[class*='quotaNote']").forEach((node) => { node.textContent = "Trong thời gian Trải nghiệm có thể đăng ký nhiều buổi. Với Premium đang hoạt động, Khám Phá và Premium dùng chung một lượt đăng ký trong tuần."; });
}

function polishPremiumExperienceCards(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-v21-session-premium='true']").forEach((card) => {
    const locked = card.dataset.v23PremiumLocked === "true";
    const accessLock = card.querySelector<HTMLElement>("[data-v23-access-lock='true']");
    const action = card.querySelector<HTMLButtonElement>(":scope > button:last-child");
    const actionLabel = action?.querySelector<HTMLElement>(":scope > span");

    if (locked && accessLock) accessLock.textContent = "Chỉ trong Trải nghiệm";
    if (!locked) accessLock?.remove();

    if (action) {
      const label = locked ? "Xem điều kiện" : "Đăng ký";
      action.setAttribute("aria-label", label);
      if (actionLabel) actionLabel.textContent = label;
    }
  });
}

function markCollectionDetail(root: HTMLElement) {
  const cards = Array.from(root.querySelectorAll<HTMLElement>("[class*='mediaTile']"));
  if (!cards.length) return;
  const grid = cards[0]?.parentElement;
  if (grid) grid.dataset.freezeCollectionMediaGrid = "true";
  cards.forEach((card) => card.dataset.freezeCollectionMediaCard = "true");
  const detail = grid?.closest<HTMLElement>("[class*='sheetContent']");
  if (detail) detail.dataset.freezeCollectionDetail = "true";
}

function markPrimarySurfaces(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[class*='collectionCard'], [class*='storyCard']").forEach((node) => node.dataset.freezeCollectionCard = "true");
  root.querySelectorAll<HTMLElement>("[class*='glanceCard']").forEach((node) => node.dataset.freezeGlanceCard = "true");
  root.querySelectorAll<HTMLElement>("[class*='freshCard']").forEach((node) => node.dataset.freezeFreshCard = "true");
  root.querySelectorAll<HTMLElement>("[class*='studentButton']").forEach((node) => node.dataset.freezeStudentButton = "true");
  root.querySelectorAll<HTMLElement>("[class*='filterRow'] button").forEach((node) => {
    node.dataset.freezeFilterButton = "true";
    node.style.setProperty("font-size", "12px", "important");
  });
  root.querySelectorAll<HTMLElement>("[class*='noticeCard']").forEach((node) => {
    const text = node.textContent ?? "";
    if (text.includes("Trải nghiệm đã kết thúc") && text.includes("Tiến trình")) node.dataset.freezeExpiredDuplicate = "true";
  });
}

const ICON_BASE = "https://assets.pinohouse.art/site/shared/piner-space-icon-";

function iconUrl(name: string) {
  return `${ICON_BASE}${name}.svg`;
}

function setIcon(target: HTMLElement | null, name: string, label = "") {
  if (!target) return;
  if (target instanceof HTMLImageElement) {
    target.src = iconUrl(name);
    target.alt = label;
    target.dataset.hardIcon = "true";
    target.dataset.hardIconHost = name;
    target.setAttribute("aria-hidden", label ? "false" : "true");
    return;
  }
  let img = target.querySelector<HTMLImageElement>(":scope > img[data-hard-icon='true']");
  if (!img) {
    target.replaceChildren();
    img = document.createElement("img");
    img.dataset.hardIcon = "true";
    target.appendChild(img);
  }
  img.src = iconUrl(name);
  img.alt = label;
  img.setAttribute("aria-hidden", label ? "false" : "true");
  target.dataset.hardIconHost = name;
}

function programIcon(text: string) {
  if (/Little Piner Art/i.test(text)) return "path-little-piner-art";
  if (/Little Piner Piano/i.test(text) || (/Little Piner/i.test(text) && /piano|giai điệu|abc song/i.test(text))) return "path-little-piner-piano";
  if (/Little Piner/i.test(text)) return "path-little-piner-art";
  if (/ArtChitect/i.test(text)) return "path-artchitect";
  return "path-pianohouse";
}
function contentIcon(text: string) {
  if (/record|ghi âm|audio|bản ghi/i.test(text)) return "media-audio";
  if (/video|film/i.test(text)) return "media-video";
  if (/milestone|cột mốc|checkpoint/i.test(text)) return "media-milestone";
  if (/moment|khoảnh khắc/i.test(text)) return "media-moment";
  if (/ảnh|photo/i.test(text)) return "media-photo";
  return "media-artwork";
}

function polishNavigationIcons(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-v16-nav-button='true']").forEach((button) => {
    const label = button.querySelector("small")?.textContent?.trim() ?? "";
    const icon = button.querySelector<HTMLElement>("[data-v21-nav-icon='true']");
    const name = label.includes("Hành trình") ? "nav-journey"
      : label.includes("Thành quả") ? "nav-outcomes"
      : label.includes("Khám phá") ? "nav-explore"
      : "nav-home";
    setIcon(icon, name);
  });

  root.querySelectorAll<HTMLElement>("[data-freeze-student-button='true']").forEach((button) => {
    const chevron = button.querySelector<HTMLElement>("[class*='chevron']");
    setIcon(chevron, "chevron-down");
  });
}
function polishSurfaceIcons(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-v21-music-avatar]").forEach((node) => setIcon(node, "path-pianohouse"));
  root.querySelectorAll<HTMLElement>("[data-v21-syllabus-avatar='true']").forEach((node) => setIcon(node, "path-little-piner-art"));
  root.querySelectorAll<HTMLElement>("[class*='noticeIcon']").forEach((node) => { if ((node.textContent ?? "").includes("🔒")) setIcon(node, "lock"); });
  root.querySelectorAll<HTMLElement>("[class*='checkpointRow'] > div").forEach((item, index) => setIcon(item.querySelector<HTMLElement>(":scope > span"), index === 0 ? "check" : index === 1 ? "current" : "pending"));
  root.querySelectorAll<HTMLElement>("[data-freeze-glance-card='true']").forEach((card) => {
    const text = card.textContent ?? "";
    setIcon(card.querySelector<HTMLElement>("[class*='pathMark']"), programIcon(text));
    setIcon(card.querySelector<HTMLElement>("[class*='arrow']"), "arrow-right");
  });

  root.querySelectorAll<HTMLElement>("[data-freeze-fresh-card='true']").forEach((card) => {
    const children = Array.from(card.children) as HTMLElement[];
    const visual = children[0] ?? null;
    const arrow = children.at(-1) ?? null;
    setIcon(visual, contentIcon(card.textContent ?? ""));
    if (arrow && arrow !== visual) setIcon(arrow, "arrow-right");
  });

  root.querySelectorAll<HTMLElement>("[data-v21-touchpoint-card='true']").forEach((card) => {
    if (card.matches("[class*='deviceStage']")) return;
    const text = card.textContent ?? "";
    const visual = card.querySelector<HTMLElement>("[data-v21-touchpoint-avatar='true']");
    if (visual) setIcon(visual, programIcon(text));
    const action = card.querySelector<HTMLElement>("button[class*='circleButton']");
    if (action) setIcon(action, "arrow-right");
  });
}
function polishPracticeIcons(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-v21-practice-card='true']").forEach((card) => {
    const text = card.textContent ?? "";
    setIcon(card.querySelector<HTMLElement>("[data-v21-practice-avatar='true']"), "practice-sheet");
    setIcon(card.querySelector<HTMLElement>("[data-v21-practice-arrow='true']"), "arrow-right");
    const assets = card.querySelector<HTMLElement>("[data-v21-generic-assets='true']");
    const chips = assets ? Array.from(assets.querySelectorAll<HTMLElement>("small")) : [];
    chips.forEach((chip) => {
      const raw = chip.textContent ?? "";
      const name = /tay/i.test(raw) ? "practice-hand" : /nghe|audio/i.test(raw) ? "practice-listen" : "practice-sheet";
      chip.dataset.hardAssetChip = name;
      if (!chip.querySelector("img[data-hard-icon='true']")) {
        const label = name === "practice-listen" ? "Nghe mẫu" : name === "practice-hand" ? (raw.includes("thế tay") ? "Hướng dẫn thế tay" : "Hướng dẫn tay") : "Bản nhạc";
        const image = document.createElement("img");
        image.src = iconUrl(name);
        image.alt = "";
        image.dataset.hardIcon = "true";
        image.setAttribute("aria-hidden", "true");
        const copy = document.createElement("span");
        copy.textContent = label;
        chip.replaceChildren(image, copy);
      }
    });
    const tags = card.querySelector<HTMLElement>("[data-v21-resource-tags='true']");
    if (tags && !tags.querySelector("small") && ["→", "🔒"].includes(tags.textContent?.trim() ?? "")) tags.dataset.freezeDuplicatePracticeGlyph = "true";
    card.dataset.hardPracticeProgram = programIcon(text);
  });
}

function polishSessionIcons(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-freeze-session-hero='true']").forEach((hero) => {
    const visual = hero.querySelector<HTMLElement>("[data-v22-touchpoint-hero='true']");
    if (visual) setIcon(visual, programIcon(hero.closest("section")?.textContent ?? hero.textContent ?? ""));
  });
  root.querySelectorAll<HTMLElement>("[data-v21-session-card='true']").forEach((card) => {
    const text = card.textContent ?? "";
    const visual = card.querySelector<HTMLElement>("[data-v21-session-visual='true']");
    if (visual) {
      setIcon(visual, programIcon(text));
      visual.querySelectorAll("[data-v21-unicode-avatar='true'], em").forEach((node) => node.remove());
    }
    if (card.dataset.v21SessionPremium === "true") card.dataset.hardPremiumCard = "true";
  });
}
function polishCollectionAndStateIcons(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-freeze-collection-card='true'], [class*='collectionCard']").forEach((card) => {
    const text = card.textContent ?? "";
    const candidates = Array.from(card.children) as HTMLElement[];
    const visual = candidates.find((node) => /visual|icon|thumb/i.test(node.className || "")) ?? candidates[0] ?? null;
    if (visual && !visual.querySelector("img[data-hard-icon='true']")) setIcon(visual, contentIcon(text));
  });

  root.querySelectorAll<HTMLElement>("[class*='mediaTile']").forEach((tile) => {
    const label = tile.querySelector<HTMLElement>("strong")?.textContent ?? tile.textContent ?? "";
    const visual = tile.querySelector<HTMLElement>(":scope > span");
    const name = /con cùng|ảnh con|photo/i.test(label) ? "media-photo" : /âm thanh|audio|ghi âm/i.test(label) ? "media-audio" : /video/i.test(label) ? "media-video" : /cột mốc|milestone/i.test(label) ? "media-milestone" : /khoảnh khắc|moment/i.test(label) ? "media-moment" : "media-artwork";
    setIcon(visual, name);
  });

  root.querySelectorAll<HTMLElement>("[class*='lifecycleMark']").forEach((mark) => {
    const section = mark.closest<HTMLElement>("section");
    const text = section?.textContent ?? "";
    const name = /kết thúc|retained|giữ/i.test(text) ? "retained" : /Premium|Trải nghiệm/i.test(text) ? "premium" : "current";
    setIcon(mark, name);
  });

  root.querySelectorAll<HTMLElement>("[data-v23-access-lock='true']").forEach((node) => {
    node.dataset.hardStateIcon = "lock";
  });
}

function polishActionIcons(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[class*='accessCheck'] > span").forEach((node) => setIcon(node, "check"));
  root.querySelectorAll<HTMLButtonElement>("button").forEach((button) => { if ((button.textContent ?? "").includes("Mô phỏng") && button.closest("[class*='lifecycleBanner']")) button.dataset.freezePrototypeControl = "true"; });
  root.querySelectorAll<HTMLElement>("[data-v16-package-chevron='true']").forEach((node) => { const button = node.closest<HTMLButtonElement>("button"); setIcon(node, button?.getAttribute("aria-expanded") === "true" ? "chevron-up" : "chevron-down"); });
  root.querySelectorAll<HTMLElement>("button[class*='primaryButton'] > span").forEach((node) => setIcon(node, "arrow-right"));
  root.querySelectorAll<HTMLElement>("button[class*='circleButton']").forEach((node) => setIcon(node, "arrow-right"));
  root.querySelectorAll<HTMLElement>("[class*='modalClose'], [class*='sheetHeader'] > button, [class*='sheetTitleRow'] > button, [class*='viewerHeader'] > button, [data-freeze-session-modal='true'] > header button").forEach((node) => {
    if ((node.textContent ?? "").trim().length <= 2) setIcon(node, "close");
  });
}

function hardPolishIconography(root: HTMLElement) {
  polishNavigationIcons(root);
  polishSurfaceIcons(root);
  polishPracticeIcons(root);
  polishSessionIcons(root);
  polishCollectionAndStateIcons(root);
  polishActionIcons(root);
}

function polish(root: HTMLElement) {
  rewriteVisibleCopy(root);
  polishPracticeGlyphs(root);
  polishExploreSessionModal(root);
  polishRegistrationCopy(root);
  polishExplorePolicyCopy(root);
  polishPremiumExperienceCards(root);
  markCollectionDetail(root);
  markPrimarySurfaces(root);
  hardPolishIconography(root);
}

export default function PinerPrototypeFreezePolish() {
  const rootRef = useRef<HTMLDivElement>(null);

  usePrototypePolish(rootRef, polish, { listenToChange: true, settleFrames: 8 });

  return (
    <div ref={rootRef}>
      <PinerPrototypeV23 />
    </div>
  );
}