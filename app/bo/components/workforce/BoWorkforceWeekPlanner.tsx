"use client";
import { useRef, useState, type ReactNode } from "react";
import type { BoWorkforceWeeklyPlanning } from "@/lib/bo-model";
import {
  assignmentRoleSummary,
  hasOwnerTeacherLinkGap,
} from "@/lib/workforce-planning-role-summary";
import { assignmentTimeSummary } from "@/lib/workforce-planning-time-basis";
import styles from "@/app/bo/bo.module.css";
type Props = {
  data: BoWorkforceWeeklyPlanning;
  centerName: string;
  selection: { staffMemberId: string; workDate: string } | null;
  onSelect: (staffId: string, date: string) => void;
  onRefresh: () => void;
  children: ReactNode;
};
const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const weekday = (date: string) =>
  dayNames[new Date(date + "T00:00:00Z").getUTCDay()];
const displayDate = (date: string) => date.split("-").reverse().join("/");
/** Real Center/week projection. Business commands remain with WorkforcePlanningView. */
export function BoWorkforceWeekPlanner({
  data,
  centerName,
  selection,
  onSelect,
  onRefresh,
  children,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [dayIndex, setDayIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const dates: string[] = [];
  for (
    const date = new Date(data.startDate + "T00:00:00Z");
    date <= new Date(data.endDate + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + 1)
  )
    dates.push(date.toISOString().slice(0, 10));
  const active = data.assignments.filter((item) => item.status === "ACTIVE");
  const assignedStaff = new Set(active.map((item) => item.staffMemberId));
  const submitted = data.availability.filter(
    (item) => item.status === "SUBMITTED",
  );
  const submittedStaff = new Set(submitted.map((item) => item.staffMemberId));
  const waiting = [...submittedStaff].filter(
    (id) => !assignedStaff.has(id),
  ).length;
  const rows = data.staff.filter((staff) => {
    if (
      !staff.displayLabel
        .toLocaleLowerCase("vi")
        .includes(search.trim().toLocaleLowerCase("vi"))
    )
      return false;
    return (
      filter === "ALL" ||
      (filter === "ASSIGNED" && assignedStaff.has(staff.id)) ||
      (filter === "SUBMITTED" && submittedStaff.has(staff.id)) ||
      (filter === "EMPTY" && !assignedStaff.has(staff.id))
    );
  });
  function jump(index: number) {
    setDayIndex(index);
    const nav = navRef.current,
      button = nav?.children[index];
    if (nav && button)
      nav.scrollTo({
        left: Math.max(
          0,
          nav.scrollLeft +
            button.getBoundingClientRect().left -
            nav.getBoundingClientRect().left,
        ),
        behavior: "smooth",
      });
    const scroller = scrollRef.current;
    const header = scroller?.querySelector<HTMLElement>(
        `[data-day="${dates[index]}"]`,
      ),
      staff = scroller?.querySelector<HTMLElement>("thead th:first-child");
    if (scroller && header && staff) {
      // Same-scrollport geometry: offsetLeft can be relative to an unrelated ancestor.
      const left =
        index === 0
          ? 0
          : scroller.scrollLeft +
            header.getBoundingClientRect().left -
            scroller.getBoundingClientRect().left -
            staff.getBoundingClientRect().width -
            scroller.clientLeft;
      scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  }
  return (
    <section className={styles.weekPlannerRoot} aria-label="Lịch phân ca tuần">
      <div className={styles.weekPlannerHeading}>
        <div>
          <h3>Lịch phân ca tuần</h3>
          <p>
            {displayDate(data.startDate)} – {displayDate(data.endDate)} ·{" "}
            {centerName}
          </p>
        </div>
        <div className={styles.weekPlannerHeadingActions}>
          <span className={styles.weekPlannerState}>
            {data.windows?.planning.state === "LOCKED"
              ? "Đã khóa lịch"
              : data.windows
                ? "Đang lập lịch"
                : "Chưa có trạng thái lịch"}
          </span>
          <button
            type="button"
            className={styles.weekPlannerRefresh}
            onClick={onRefresh}
            aria-label="Làm mới lịch tuần"
          >
            ↻
          </button>
        </div>
      </div>
      <div className={styles.weekPlannerKpis} aria-label="Thống kê lịch tuần">
        <div>
          <small>Nhân sự</small>
          <strong>{data.staff.length}</strong>
        </div>
        <div>
          <small>Ca đã phân công</small>
          <strong>{active.length}</strong>
        </div>
        <div>
          <small>Staff đã đăng ký</small>
          <strong>{submittedStaff.size}</strong>
        </div>
        <div>
          <small>Đăng ký ca</small>
          <span
            className={styles.weekPlannerRegistration}
            data-open={
              data.windows?.availability.availabilityRegistrationOpen ?? false
            }
          >
            {data.windows
              ? data.windows.availability.availabilityRegistrationOpen
                ? "Đang mở"
                : "Đã đóng"
              : "Chưa có trạng thái"}
          </span>
        </div>
      </div>
      <div className={styles.weekPlannerLegend} aria-label="Chú giải trạng thái">
        <span>
          <i className={styles.weekPlannerAssignedDot} />
          Đã phân công
        </span>
        <span>
          <i className={styles.weekPlannerAvailableDot} />
          Đã đăng ký, chờ xếp
        </span>
        <span>
          <i />
          Chưa có ca
        </span>
        <small>{waiting} Staff đã đăng ký chưa có lịch</small>
      </div>
      <div className={styles.weekPlannerLayout}>
        <div className={styles.weekPlannerCalendar}>
          <div className={styles.weekPlannerFilters}>
            <input
              type="search"
              aria-label="Tìm nhân sự trong lịch tuần"
              placeholder="Tìm nhân sự…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <label>
              Hiển thị{" "}
              <select
                aria-label="Hiển thị"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="ALL">Tất cả Staff</option>
                <option value="ASSIGNED">Đã có lịch</option>
                <option value="SUBMITTED">Đã gửi đăng ký</option>
                <option value="EMPTY">Chưa có lịch</option>
              </select>
            </label>
            <small role="status">
              {rows.length} / {data.staff.length} nhân sự
            </small>
          </div>
          <nav className={styles.weekPlannerDayNav} aria-label="Chuyển ngày trong lịch">
            <button
              type="button"
              aria-label="Ngày trước"
              disabled={dayIndex === 0}
              onClick={() => jump(dayIndex - 1)}
            >
              ‹
            </button>
            <div ref={navRef} className={styles.weekPlannerDayScroll}>
              {dates.map((date, index) => (
                <button
                  type="button"
                  key={date}
                  aria-pressed={dayIndex === index}
                  onClick={() => jump(index)}
                >
                  <strong>{weekday(date)}</strong>
                  <small>{displayDate(date).slice(0, 5)}</small>
                  {active.some((item) => item.workDate === date) ? <i /> : null}
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Ngày sau"
              disabled={dayIndex === dates.length - 1}
              onClick={() => jump(dayIndex + 1)}
            >
              ›
            </button>
          </nav>
          <div
            ref={scrollRef}
            className={styles.weekPlannerTableScroll}
            role="region"
            aria-label="Lịch theo nhân sự, cuộn ngang để xem bảy ngày"
            tabIndex={0}
          >
            <table aria-label="Weekly Workforce planning matrix">
              <thead>
                <tr>
                  <th scope="col">Nhân sự</th>
                  {dates.map((date) => (
                    <th scope="col" key={date} data-day={date}>
                      <span>{weekday(date)}</span>
                      <small>{displayDate(date)}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((staff) => (
                  <tr key={staff.id}>
                    <th scope="row">
                      <strong>{staff.displayLabel}</strong>
                      <small>
                        {assignedStaff.has(staff.id)
                          ? "Đã có lịch"
                          : submittedStaff.has(staff.id)
                            ? "Chờ phân công"
                            : "Chưa có lịch"}
                      </small>
                    </th>
                    {dates.map((date, index) => {
                      const assigned = active.filter(
                          (item) =>
                            item.staffMemberId === staff.id &&
                            item.workDate === date,
                        ),
                        registered = submitted
                          .filter((item) => item.staffMemberId === staff.id)
                          .flatMap((item) =>
                            item.items.filter(
                              (entry) => entry.workDate === date,
                            ),
                          );
                      const gap = hasOwnerTeacherLinkGap(data, staff.id, date),
                        selected =
                          selection?.staffMemberId === staff.id &&
                          selection.workDate === date;
                      return (
                        <td key={date}>
                          <button
                            type="button"
                            className={styles.weekPlannerCell}
                            aria-pressed={selected}
                            aria-controls="workforce-planner-detail"
                            aria-label={`${staff.displayLabel} · ${weekday(date)} ${displayDate(date)} · ${assigned.length ? "Đã xếp" : gap ? "Owner chưa link TE" : registered.length ? "Đã đăng ký" : "Chưa có ca"}`}
                            onClick={() => {
                              onSelect(staff.id, date);
                              jump(index);
                            }}
                          >
                            {assigned.length ? (
                              assigned.map((item) => {
                                const template = data.templates.find(
                                  (template) =>
                                    template.id === item.shiftTemplateId,
                                );
                                return (
                                  <span className={styles.weekPlannerShift} key={item.id}>
                                    <strong>
                                      {template?.displayLabel ?? "Đã phân công"}
                                    </strong>
                                    <small>
                                      {template
                                        ? `${template.startLocalTime}–${template.endLocalTime}`
                                        : assignmentTimeSummary(item)}
                                    </small>
                                    <small>
                                      {assignmentRoleSummary(data, item)} ·{" "}
                                      {assignmentTimeSummary(item)}
                                    </small>
                                  </span>
                                );
                              })
                            ) : registered.length ? (
                              <>
                                <strong className={styles.weekPlannerAvailable}>
                                  Đã đăng ký
                                </strong>
                                <small>{registered.length} ca đang chờ</small>
                              </>
                            ) : (
                              <>
                                <span className={styles.weekPlannerAdd} aria-hidden="true">
                                  ＋
                                </span>
                                <small>Chưa có ca</small>
                              </>
                            )}
                            {gap ? (
                              <small>
                                ⚠{" "}
                                {assigned.length
                                  ? "Owner chưa link TE"
                                  : "Chưa có TE/ca tương ứng"}
                              </small>
                            ) : null}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length ? (
            <p className={styles.weekPlannerEmpty} role="status">
              Không có nhân sự phù hợp.
            </p>
          ) : null}
          <p className={styles.weekPlannerHint}>
            ← Chọn ngày phía trên hoặc cuộn ngang để xem đủ 7 ngày →
          </p>
        </div>
        <aside
          id="workforce-planner-detail"
          className={styles.weekPlannerSide}
          aria-label="Công cụ phân công ca"
          aria-live="polite"
        >
          <div className={styles.weekPlannerSideHeading}>
            <h3>Phân công ca</h3>
            <small>Staff × ngày</small>
          </div>
          {children}
        </aside>
      </div>
    </section>
  );
}
