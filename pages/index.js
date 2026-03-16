import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import {
  endOfMonth,
  endOfWeek,
  format,
  getDate,
  getDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
} from "date-fns";
import { ko } from "date-fns/locale";
import { getHolidayName } from "../lib/holidays";
import { buildRecurringOccurrences } from "../lib/recurrence";

const YEAR = 2026;
const WEEKDAY_OPTIONS = [
  { value: 0, label: "일요일" },
  { value: 1, label: "월요일" },
  { value: 2, label: "화요일" },
  { value: 3, label: "수요일" },
  { value: 4, label: "목요일" },
  { value: 5, label: "금요일" },
  { value: 6, label: "토요일" },
];
const CATEGORY_OPTIONS = [
  { value: "work", label: "업무", color: "#111111" },
  { value: "lunch", label: "점심", color: "#138a36" },
  { value: "dinner", label: "저녁", color: "#d62828" },
  { value: "personal", label: "개인", color: "#d4ac0d" },
];
const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "매주" },
  { value: "monthly", label: "매월" },
  { value: "quarterly", label: "매분기" },
  { value: "yearly", label: "매년" },
];
const PATTERN_OPTIONS = [
  { value: "weekday", label: "요일 기준" },
  { value: "businessday", label: "영업일 기준" },
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function buildInitialDate() {
  const today = new Date();
  const monthIndex = today.getMonth();
  const monthDate = new Date(YEAR, monthIndex, 1);
  const lastDay = endOfMonth(monthDate).getDate();
  const day = Math.min(today.getDate(), lastDay);

  return {
    monthIndex,
    dateKey: `${YEAR}-${pad(monthIndex + 1)}-${pad(day)}`,
  };
}

function toDateKey(date) {
  return format(date, "yyyy-MM-dd");
}

function toKoreanDateLabel(dateKey) {
  return format(parseISO(dateKey), "yyyy년 M월 d일 (eee)", { locale: ko });
}

function groupEventsByDate(events) {
  return events.reduce((accumulator, event) => {
    const key = event.event_date;
    accumulator[key] = accumulator[key] || [];
    accumulator[key].push(event);
    return accumulator;
  }, {});
}

function sortEvents(events) {
  return [...events].sort((a, b) => {
    if (a.event_date === b.event_date) {
      const aSource = a.source_type || "single";
      const bSource = b.source_type || "single";

      if (aSource === bSource) {
        return String(a.id).localeCompare(String(b.id), undefined, {
          numeric: true,
        });
      }

      return aSource.localeCompare(bSource);
    }

    return a.event_date.localeCompare(b.event_date);
  });
}

function buildMonth(monthIndex) {
  const monthDate = new Date(YEAR, monthIndex, 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  return {
    label: format(monthDate, "yyyy년 M월", { locale: ko }),
    month: monthIndex + 1,
    monthDate,
    days: eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
  };
}

function getCategoryMeta(category) {
  return CATEGORY_OPTIONS.find((option) => option.value === category) || CATEGORY_OPTIONS[0];
}

export default function Home() {
  const initialState = useMemo(() => buildInitialDate(), []);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(initialState.monthIndex);
  const [selectedDate, setSelectedDate] = useState(initialState.dateKey);
  const [events, setEvents] = useState([]);
  const [recurringRules, setRecurringRules] = useState([]);
  const [category, setCategory] = useState("work");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recurringForm, setRecurringForm] = useState({
    category: "work",
    content: "",
    frequency: "monthly",
    patternType: "businessday",
    occurrenceNumber: 1,
    weekday: 1,
  });

  const currentMonth = useMemo(
    () => buildMonth(currentMonthIndex),
    [currentMonthIndex]
  );
  const recurringOccurrences = useMemo(
    () => buildRecurringOccurrences(recurringRules, currentMonth.monthDate),
    [recurringRules, currentMonth.monthDate]
  );
  const mergedEvents = useMemo(
    () => sortEvents([...events, ...recurringOccurrences]),
    [events, recurringOccurrences]
  );
  const eventsByDate = useMemo(() => groupEventsByDate(mergedEvents), [mergedEvents]);
  const selectedEvents = eventsByDate[selectedDate] || [];

  useEffect(() => {
    Promise.all([
      fetch("/api/events?year=2026").then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "일정을 불러오지 못했습니다.");
        }
        return data.events || [];
      }),
      fetch("/api/recurring?year=2026").then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "반복업무를 불러오지 못했습니다.");
        }
        return data.rules || [];
      }),
    ])
      .then(([loadedEvents, loadedRules]) => {
        setEvents(sortEvents(loadedEvents));
        setRecurringRules(loadedRules);
        setStatusMessage(`선택 날짜: ${toKoreanDateLabel(initialState.dateKey)}`);
      })
      .catch((error) =>
        setStatusMessage(error.message || "데이터를 불러오지 못했습니다.")
      );
  }, [initialState.dateKey]);

  function resetForm(nextDate = selectedDate) {
    setEditingId(null);
    setCategory("work");
    setContent("");
    setStatusMessage(`선택 날짜: ${toKoreanDateLabel(nextDate)}`);
  }

  function updateRecurringField(field, value) {
    setRecurringForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!content.trim()) {
      setStatusMessage("일정 내용을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `/api/events/${editingId}` : "/api/events";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventDate: selectedDate,
          category,
          content,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(data.error || "일정 저장 중 오류가 발생했습니다.");
        return;
      }

      if (editingId) {
        setEvents((current) =>
          sortEvents(current.map((item) => (item.id === data.event.id ? data.event : item)))
        );
        setStatusMessage("일정을 수정했습니다.");
      } else {
        setEvents((current) => sortEvents([...current, data.event]));
        setStatusMessage("일정을 추가했습니다.");
      }

      setEditingId(null);
      setCategory("work");
      setContent("");
    } catch (error) {
      setStatusMessage("일정 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRecurringSubmit(event) {
    event.preventDefault();

    if (!recurringForm.content.trim()) {
      setStatusMessage("반복업무 내용을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: selectedDate,
          category: recurringForm.category,
          content: recurringForm.content,
          frequency: recurringForm.frequency,
          patternType: recurringForm.patternType,
          occurrenceNumber: Number(recurringForm.occurrenceNumber),
          weekday:
            recurringForm.patternType === "weekday"
              ? Number(recurringForm.weekday)
              : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(data.error || "반복업무 저장 중 오류가 발생했습니다.");
        return;
      }

      setRecurringRules((current) => [...current, data.rule]);
      setRecurringForm((current) => ({
        ...current,
        content: "",
        occurrenceNumber: 1,
      }));
      setStatusMessage("반복업무를 추가했습니다.");
    } catch (error) {
      setStatusMessage("반복업무 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/events/${id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(data.error || "일정 삭제 중 오류가 발생했습니다.");
        return;
      }

      setEvents((current) => current.filter((item) => item.id !== id));
      setStatusMessage("일정을 삭제했습니다.");

      if (editingId === id) {
        resetForm(selectedDate);
      }
    } catch (error) {
      setStatusMessage("일정 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteRecurring(id) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/recurring/${id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(data.error || "반복업무 삭제 중 오류가 발생했습니다.");
        return;
      }

      setRecurringRules((current) => current.filter((item) => item.id !== id));
      setStatusMessage("반복업무를 삭제했습니다.");
    } catch (error) {
      setStatusMessage("반복업무 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSelectDate(dateKey) {
    setSelectedDate(dateKey);
    resetForm(dateKey);
    setIsModalOpen(true);
  }

  function moveMonth(direction) {
    setCurrentMonthIndex((current) => {
      const nextMonth = current + direction;
      if (nextMonth < 0 || nextMonth > 11) {
        return current;
      }

      const nextDateKey = `${YEAR}-${pad(nextMonth + 1)}-01`;
      setSelectedDate(nextDateKey);
      setIsModalOpen(false);
      resetForm(nextDateKey);
      return nextMonth;
    });
  }

  function beginEdit(schedule) {
    if (schedule.source_type === "recurring") {
      return;
    }

    setSelectedDate(schedule.event_date);
    setEditingId(schedule.id);
    setCategory(schedule.category);
    setContent(schedule.content);
    setStatusMessage(`수정 중: ${toKoreanDateLabel(schedule.event_date)}`);
    setIsModalOpen(false);
    setCurrentMonthIndex(parseISO(schedule.event_date).getMonth());
  }

  return (
    <>
      <Head>
        <title>2026 한국 캘린더</title>
        <meta
          name="description"
          content="2026년 한국 공휴일과 반복업무를 관리할 수 있는 공유 캘린더"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="page-shell">
        <section className="panel calendar-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">South Korea / KST</p>
              <h1>2026 Monthly Calendar</h1>
            </div>
            <div className="legend">
              {CATEGORY_OPTIONS.map((option) => (
                <span
                  key={option.value}
                  className="legend-chip"
                  style={{ "--chip-color": option.color }}
                >
                  {option.label}
                </span>
              ))}
            </div>
          </div>

          <article className="month-card month-card-single">
            <div className="month-header-nav">
              <button
                type="button"
                className="month-nav-button"
                onClick={() => moveMonth(-1)}
                disabled={currentMonthIndex === 0}
              >
                ←
              </button>
              <h2>{currentMonth.label}</h2>
              <button
                type="button"
                className="month-nav-button"
                onClick={() => moveMonth(1)}
                disabled={currentMonthIndex === 11}
              >
                →
              </button>
            </div>

            <div className="weekday-row">
              {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="days-grid">
              {currentMonth.days.map((day) => {
                const dateKey = toDateKey(day);
                const holidayName = getHolidayName(dateKey);
                const isWeekend = [0, 6].includes(getDay(day));
                const isHoliday = Boolean(holidayName);
                const isCurrentMonth = isSameMonth(day, currentMonth.monthDate);
                const dayEvents = eventsByDate[dateKey] || [];
                const selected = selectedDate === dateKey;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    className={`day-cell ${selected ? "selected" : ""} ${
                      !isCurrentMonth ? "muted" : ""
                    }`}
                    onClick={() => handleSelectDate(dateKey)}
                  >
                    <div className="day-top">
                      <div className="day-number-row">
                        <span
                          className={`day-number ${
                            isWeekend || isHoliday ? "holiday-text" : ""
                          }`}
                        >
                          {getDate(day)}
                        </span>
                        {selected ? <span className="day-selected-chip">선택</span> : null}
                      </div>
                      <span className="holiday-name">{holidayName || "\u00A0"}</span>
                    </div>

                    <div className="day-events-list">
                      {dayEvents.slice(0, 3).map((eventItem) => {
                        const option = getCategoryMeta(eventItem.category);

                        return (
                          <span key={eventItem.id} className="day-event-item">
                            <span
                              className="event-dot"
                              style={{ "--dot-color": option.color }}
                            />
                            <span className="day-event-text">{eventItem.content}</span>
                          </span>
                        );
                      })}
                      {dayEvents.length > 3 ? (
                        <span className="event-count">+{dayEvents.length - 3} more</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </article>
        </section>

        <section className="panel composer-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Schedule Tools</p>
              <h2>선택 날짜 기준 일정 관리</h2>
            </div>
            <div className="selected-date-box">
              <span>선택한 날짜</span>
              <strong>{toKoreanDateLabel(selectedDate)}</strong>
            </div>
          </div>

          <div className="composer-grid">
            <article className="composer-card">
              <div className="composer-card-heading">
                <h3>일반 일정</h3>
                <p>하루 일정만 추가하거나 수정합니다.</p>
              </div>

              <form className="composer-form" onSubmit={handleSubmit}>
                <div className="toggle-group" role="tablist" aria-label="일정 종류">
                  {CATEGORY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`toggle-chip ${category === option.value ? "active" : ""}`}
                      style={{ "--chip-color": option.color }}
                      onClick={() => setCategory(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <label className="input-wrap" htmlFor="schedule-input">
                  <span>일정 내용</span>
                  <input
                    id="schedule-input"
                    type="text"
                    value={content}
                    onChange={(inputEvent) => setContent(inputEvent.target.value)}
                    placeholder="예: 업무 - 메일 송부"
                  />
                </label>

                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={isSubmitting}>
                    {editingId ? "수정 저장" : "기입"}
                  </button>
                  {editingId ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => resetForm(selectedDate)}
                      disabled={isSubmitting}
                    >
                      수정 취소
                    </button>
                  ) : null}
                </div>
              </form>
            </article>

            <article className="composer-card">
              <div className="composer-card-heading">
                <h3>반복업무</h3>
                <p>선택 날짜부터 시작하는 반복 규칙을 등록합니다.</p>
              </div>

              <form className="composer-form" onSubmit={handleRecurringSubmit}>
                <div className="toggle-group" role="tablist" aria-label="반복업무 종류">
                  {CATEGORY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`toggle-chip ${
                        recurringForm.category === option.value ? "active" : ""
                      }`}
                      style={{ "--chip-color": option.color }}
                      onClick={() => updateRecurringField("category", option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="field-grid">
                  <label className="input-wrap">
                    <span>반복 주기</span>
                    <select
                      value={recurringForm.frequency}
                      onChange={(event) =>
                        updateRecurringField("frequency", event.target.value)
                      }
                    >
                      {FREQUENCY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="input-wrap">
                    <span>반복 기준</span>
                    <select
                      value={recurringForm.patternType}
                      onChange={(event) =>
                        updateRecurringField("patternType", event.target.value)
                      }
                    >
                      {PATTERN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="field-grid">
                  {(recurringForm.patternType === "businessday" ||
                    recurringForm.frequency !== "weekly") && (
                    <label className="input-wrap">
                      <span>
                        {recurringForm.patternType === "businessday"
                          ? "n번째 영업일"
                          : "n번째 요일"}
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={recurringForm.occurrenceNumber}
                        onChange={(event) =>
                          updateRecurringField(
                            "occurrenceNumber",
                            Number(event.target.value)
                          )
                        }
                      />
                    </label>
                  )}

                  {recurringForm.patternType === "weekday" ? (
                    <label className="input-wrap">
                      <span>요일 선택</span>
                      <select
                        value={recurringForm.weekday}
                        onChange={(event) =>
                          updateRecurringField("weekday", Number(event.target.value))
                        }
                      >
                        {WEEKDAY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="rule-help">
                      <span>영업일 기준 안내</span>
                      <strong>주말과 한국 공휴일을 제외한 순번으로 계산합니다.</strong>
                    </div>
                  )}
                </div>

                <label className="input-wrap" htmlFor="recurring-input">
                  <span>반복업무 내용</span>
                  <input
                    id="recurring-input"
                    type="text"
                    value={recurringForm.content}
                    onChange={(event) =>
                      updateRecurringField("content", event.target.value)
                    }
                    placeholder="예: 업무 - 주간 보고서 작성"
                  />
                </label>

                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={isSubmitting}>
                    반복업무 추가
                  </button>
                </div>
              </form>

              <div className="rule-list">
                {recurringRules.length ? (
                  recurringRules.map((rule) => {
                    const categoryMeta = getCategoryMeta(rule.category);
                    const weekdayLabel =
                      typeof rule.weekday === "number"
                        ? WEEKDAY_OPTIONS.find((option) => option.value === rule.weekday)
                            ?.label
                        : null;

                    return (
                      <article key={rule.id} className="rule-card">
                        <div className="rule-card-main">
                          <span
                            className="agenda-category"
                            style={{ "--agenda-color": categoryMeta.color }}
                          >
                            {categoryMeta.label}
                          </span>
                          <div>
                            <p>{rule.content}</p>
                            <small>
                              {FREQUENCY_OPTIONS.find(
                                (option) => option.value === rule.frequency
                              )?.label || rule.frequency}
                              {" · "}
                              {rule.pattern_type === "businessday"
                                ? `${rule.occurrence_number}영업일`
                                : rule.frequency === "weekly"
                                ? weekdayLabel
                                : `${rule.occurrence_number}번째 ${weekdayLabel}`}
                            </small>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleDeleteRecurring(rule.id)}
                          disabled={isSubmitting}
                        >
                          삭제
                        </button>
                      </article>
                    );
                  })
                ) : (
                  <div className="empty-state compact-empty">
                    <p>등록된 반복업무가 없습니다.</p>
                  </div>
                )}
              </div>
            </article>
          </div>

          <p className="status-text">
            {statusMessage || "캘린더 날짜를 눌러 팝업으로 일정 확인이 가능합니다."}
          </p>
        </section>
      </main>

      {isModalOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => setIsModalOpen(false)}
          role="presentation"
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="선택 날짜 일정"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Daily Agenda</p>
                <h2>{toKoreanDateLabel(selectedDate)}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                ×
              </button>
            </div>

            {getHolidayName(selectedDate) ? (
              <span className="holiday-badge modal-badge">
                {getHolidayName(selectedDate)}
              </span>
            ) : null}

            <div className="modal-agenda-list">
              {selectedEvents.length ? (
                selectedEvents.map((schedule) => {
                  const option = getCategoryMeta(schedule.category);

                  return (
                    <article key={schedule.id} className="agenda-card">
                      <div className="agenda-main">
                        <span
                          className="agenda-category"
                          style={{ "--agenda-color": option.color }}
                        >
                          {option.label}
                        </span>
                        <div>
                          <p>{schedule.content}</p>
                          <small>
                            {schedule.source_type === "recurring" ? "반복업무" : "일반 일정"}
                          </small>
                        </div>
                      </div>
                      <div className="agenda-actions">
                        {schedule.source_type === "recurring" ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteRecurring(schedule.rule_id)}
                          >
                            반복 삭제
                          </button>
                        ) : (
                          <>
                            <button type="button" onClick={() => beginEdit(schedule)}>
                              수정
                            </button>
                            <button type="button" onClick={() => handleDelete(schedule.id)}>
                              삭제
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="empty-state">
                  <p>이 날짜에는 아직 일정이 없습니다.</p>
                  <p>중간 입력 영역에서 바로 추가할 수 있습니다.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
