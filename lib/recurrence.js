import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  getDay,
  isBefore,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { getHolidayName } from "./holidays";

function isHoliday(date) {
  return Boolean(getHolidayName(format(date, "yyyy-MM-dd")));
}

function isBusinessDay(date) {
  const day = getDay(date);
  return day !== 0 && day !== 6 && !isHoliday(date);
}

function countMatchingDays(start, target, matcher) {
  let count = 0;
  let cursor = start;

  while (!isBefore(target, cursor)) {
    if (matcher(cursor)) {
      count += 1;
    }

    if (isSameDay(cursor, target)) {
      break;
    }

    cursor = addDays(cursor, 1);
  }

  return count;
}

function matchesWeekdayRule(rule, date) {
  if (rule.frequency === "weekly") {
    return getDay(date) === rule.weekday;
  }

  const periodStart =
    rule.frequency === "monthly"
      ? startOfMonth(date)
      : rule.frequency === "quarterly"
      ? startOfQuarter(date)
      : startOfYear(date);

  return (
    getDay(date) === rule.weekday &&
    countMatchingDays(periodStart, date, (cursor) => getDay(cursor) === rule.weekday) ===
      rule.occurrence_number
  );
}

function matchesBusinessDayRule(rule, date) {
  const periodStart =
    rule.frequency === "weekly"
      ? startOfWeek(date, { weekStartsOn: 1 })
      : rule.frequency === "monthly"
      ? startOfMonth(date)
      : rule.frequency === "quarterly"
      ? startOfQuarter(date)
      : startOfYear(date);
  const periodEnd =
    rule.frequency === "weekly"
      ? endOfWeek(date, { weekStartsOn: 1 })
      : rule.frequency === "monthly"
      ? endOfMonth(date)
      : rule.frequency === "quarterly"
      ? endOfQuarter(date)
      : endOfYear(date);

  if (!isBusinessDay(date) || isBefore(periodEnd, date)) {
    return false;
  }

  return (
    countMatchingDays(periodStart, date, (cursor) => isBusinessDay(cursor)) ===
    rule.occurrence_number
  );
}

function matchesRule(rule, date) {
  const startDate = parseISO(rule.start_date);

  if (isBefore(date, startDate)) {
    return false;
  }

  if (rule.pattern_type === "weekday") {
    return matchesWeekdayRule(rule, date);
  }

  return matchesBusinessDayRule(rule, date);
}

export function buildRecurringOccurrences(rules, monthDate) {
  const visibleStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 });
  const visibleEnd = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 });
  const visibleDays = eachDayOfInterval({ start: visibleStart, end: visibleEnd });
  const occurrences = [];

  visibleDays.forEach((day) => {
    rules.forEach((rule) => {
      if (!matchesRule(rule, day)) {
        return;
      }

      const dateKey = format(day, "yyyy-MM-dd");

      occurrences.push({
        id: `recurring-${rule.id}-${dateKey}`,
        rule_id: rule.id,
        source_type: "recurring",
        event_date: dateKey,
        category: rule.category,
        content: rule.content,
      });
    });
  });

  return occurrences;
}
