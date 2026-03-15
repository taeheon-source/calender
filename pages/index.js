import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ko } from "date-fns/locale";
import { getHolidayName } from "../lib/holidays";

const YEAR = 2026;
const CATEGORY_OPTIONS = [
  { value: "work", label: "업무", color: "#111111" },
  { value: "lunch", label: "점심", color: "#767676" },
  { value: "dinner", label: "저녁", color: "#bcbcbc" },
  { value: "personal", label: "개인", color: "#575757" },
];

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
      return Number(a.id) - Number(b.id);
    }

    return a.event_date.localeCompare(b.event_date);
  });
}

function buildMonths() {
  return Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(YEAR, index, 1);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return {
      label: format(monthDate, "M월", { locale: ko }),
      month: index + 1,
      days: eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    };
  });
}

export default function Home() {
  const months = useMemo(() => buildMonths(), []);
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState("2026-01-01");
  const [category, setCategory] = useState("work");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);
  const selectedEvents = eventsByDate[selectedDate] || [];

  useEffect(() => {
    fetch("/api/events?year=2026")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "일정을 불러오지 못했습니다.");
        }
        return data;
      })
      .then((data) => setEvents(sortEvents(data.events || [])))
      .catch(() => setStatusMessage("일정을 불러오지 못했습니다."));
  }, []);

  function resetForm(nextDate = selectedDate) {
    setEditingId(null);
    setCategory("work");
    setContent("");
    setStatusMessage(`선택 날짜: ${toKoreanDateLabel(nextDate)}`);
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
        setIsSubmitting(false);
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

  async function handleDelete(id) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/events/${id}`, { method: "DELETE" });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(data.error || "일정 삭제 중 오류가 발생했습니다.");
        setIsSubmitting(false);
        return;
      }

      setEvents((current) => current.filter((item) => item.id !== id));
      setStatusMessage("일정을 삭제했습니다.");

      if (editingId === id) {
        resetForm();
      }
    } catch (error) {
      setStatusMessage("일정 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSelectDate(dateKey) {
    setSelectedDate(dateKey);
    resetForm(dateKey);
  }

  function beginEdit(schedule) {
    setSelectedDate(schedule.event_date);
    setEditingId(schedule.id);
    setCategory(schedule.category);
    setContent(schedule.content);
    setStatusMessage(`수정 중: ${toKoreanDateLabel(schedule.event_date)}`);
  }

  return (
    <>
      <Head>
        <title>2026 한국 캘린더</title>
        <meta
          name="description"
          content="2026년 한국 공휴일과 일정을 관리할 수 있는 공유 캘린더"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="page-shell">
        <section className="panel calendar-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">South Korea / KST</p>
              <h1>2026 Annual Calendar</h1>
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

          <div className="month-grid">
            {months.map((month) => (
              <article key={month.month} className="month-card">
                <div className="month-header">
                  <h2>{month.label}</h2>
                  <div className="weekday-row">
                    {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                </div>
                <div className="days-grid">
                  {month.days.map((day) => {
                    const dateKey = toDateKey(day);
                    const holidayName = getHolidayName(dateKey);
                    const isWeekend = [0, 6].includes(getDay(day));
                    const isHoliday = Boolean(holidayName);
                    const isCurrentMonth = isSameMonth(day, new Date(YEAR, month.month - 1, 1));
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
                        <span
                          className={`day-number ${
                            isWeekend || isHoliday ? "holiday-text" : ""
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                        <span className="holiday-name">{holidayName || "\u00A0"}</span>
                        <div className="event-dots">
                          {dayEvents.slice(0, 3).map((eventItem) => {
                            const option = CATEGORY_OPTIONS.find(
                              (categoryItem) => categoryItem.value === eventItem.category
                            );

                            return (
                              <span
                                key={eventItem.id}
                                className="event-dot"
                                style={{ "--dot-color": option?.color || "#111111" }}
                              />
                            );
                          })}
                          {dayEvents.length > 3 ? (
                            <span className="event-count">+{dayEvents.length - 3}</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel composer-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Schedule Input</p>
              <h2>선택 날짜에 일정 추가</h2>
            </div>
            <div className="selected-date-box">
              <span>선택한 날짜</span>
              <strong>{toKoreanDateLabel(selectedDate)}</strong>
            </div>
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
                  onClick={() => resetForm()}
                  disabled={isSubmitting}
                >
                  수정 취소
                </button>
              ) : null}
            </div>
          </form>

          <p className="status-text">{statusMessage || "캘린더에서 날짜를 눌러 일정 입력을 시작하세요."}</p>
        </section>

        <section className="panel detail-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Daily Agenda</p>
              <h2>{toKoreanDateLabel(selectedDate)}</h2>
            </div>
            {getHolidayName(selectedDate) ? (
              <span className="holiday-badge">{getHolidayName(selectedDate)}</span>
            ) : null}
          </div>

          <div className="agenda-list">
            {selectedEvents.length ? (
              selectedEvents.map((schedule) => {
                const option = CATEGORY_OPTIONS.find(
                  (categoryItem) => categoryItem.value === schedule.category
                );

                return (
                  <article key={schedule.id} className="agenda-card">
                    <div className="agenda-main">
                      <span
                        className="agenda-category"
                        style={{ "--agenda-color": option?.color || "#111111" }}
                      >
                        {option?.label || schedule.category}
                      </span>
                      <p>{schedule.content}</p>
                    </div>
                    <div className="agenda-actions">
                      <button type="button" onClick={() => beginEdit(schedule)}>
                        수정
                      </button>
                      <button type="button" onClick={() => handleDelete(schedule.id)}>
                        삭제
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-state">
                <p>이 날짜에는 아직 일정이 없습니다.</p>
                <p>위 입력창에서 바로 추가해보세요.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
