"use client";

import { useEffect, useRef } from "react";
import PinerPrototypeV23 from "./PinerPrototypeV23";

const EXACT_COPY: Record<string, string> = {
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
  const sections = Array.from(root.querySelectorAll<HTMLElement>("section"));
  sections.forEach((section) => {
    const text = section.textContent ?? "";
    if (!text.includes("Ảnh tác phẩm") || !text.includes("Ảnh con cùng tác phẩm")) return;
    section.dataset.freezeCollectionDetail = "true";
    const cards = Array.from(section.querySelectorAll<HTMLElement>("article"));
    const grid = cards[0]?.parentElement;
    if (grid && cards.length >= 3) grid.dataset.freezeCollectionMediaGrid = "true";
    cards.forEach((card) => card.dataset.freezeCollectionMediaCard = "true");
  });
}

function markPrimarySurfaces(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[class*='collectionCard']").forEach((node) => node.dataset.freezeCollectionCard = "true");
  root.querySelectorAll<HTMLElement>("[class*='glanceCard']").forEach((node) => node.dataset.freezeGlanceCard = "true");
  root.querySelectorAll<HTMLElement>("[class*='freshCard']").forEach((node) => node.dataset.freezeFreshCard = "true");
  root.querySelectorAll<HTMLElement>("[class*='studentButton']").forEach((node) => node.dataset.freezeStudentButton = "true");
  root.querySelectorAll<HTMLElement>("[class*='filterRow'] button").forEach((node) => node.dataset.freezeFilterButton = "true");
}

function polish(root: HTMLElement) {
  rewriteVisibleCopy(root);
  polishPracticeGlyphs(root);
  polishExploreSessionModal(root);
  polishRegistrationCopy(root);
  polishPremiumExperienceCards(root);
  markCollectionDetail(root);
  markPrimarySurfaces(root);
}

export default function PinerPrototypeFreezePolish() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let frame = 0;
    let scheduled = false;
    const observer = new MutationObserver(() => schedule());

    const run = () => {
      scheduled = false;
      observer.disconnect();
      try {
        polish(root);
      } finally {
        observer.observe(root, { childList: true, subtree: true, characterData: true });
      }
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(run);
    };

    run();
    const interval = window.setInterval(run, 300);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef}>
      <PinerPrototypeV23 />
    </div>
  );
}