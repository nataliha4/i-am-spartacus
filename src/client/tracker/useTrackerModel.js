import { completeChecklist } from "../../shared/checklist";
import {
  historyItems,
  symptomFoodContext,
  latestWeight,
} from "../../shared/selectors";
import { fastGoal, fastReminder } from "../../shared/goals";
import { useState, useEffect, useRef } from "react";

import { useTracker } from "../TrackerProvider";
import { styles } from "./styles";
import {
  instant,
  localDate,
  localTime,
  fastHours,
  scheduledOn,
  dateSchema,
} from "../../shared/model";
export default () => {
  const {
    state: { entries, recurringSupps, recurringGym, appSettings, activeFast },
    setEntries,
    setRecurringSupps,
    setRecurringGym,
    setAppSettings,
    setActiveFast,
    startFastRemote,
    stopFastRemote,
    removeEntity,
  } = useTracker();
  const [activeFastDraft, setActiveFastDraft] = useState(null);
  const [nowTick, setNowTick] = useState(0);
  const [currentDate, updateCurrentDate] = useState(() =>
    localDate(Date.now(), appSettings.timezone),
  );
  const setCurrentDate = (date) => {
    if (dateSchema.safeParse(date).success) updateCurrentDate(date);
  };
  const [activeTab, setActiveTab] = useState("dashboard");
  const [formData, setFormData] = useState({
    fastingStart: "",
    fastingEnd: "",
    supplement: "",
    supplementTime: "",
    supplementNotes: "",
    symptom: "",
    symptomLevel: 3,
    symptomNotes: "",
    symptomDate: "",
    symptomTime: "",
    weight: "",
    targetWeight: "",
    foodNote: "",
    foodTime: "",
    foodNotes: "",
    medicalEvent: "",
    medicalNotes: "",
    medicalTime: "",
    gymActivity: "",
    gymNotes: "",
    gymTime: "",
    recurringName: "",
    recurringTime: "",
    recurringFrequency: "daily",
    recurringDayOfWeek: "1",
    recurringGymName: "",
    recurringGymTime: "",
    recurringGymFrequency: "daily",
    recurringGymDayOfWeek: "1",
  });

  // Tick every 30s so the live elapsed-fasting display stays current
  useEffect(() => {
    const interval = setInterval(() => setNowTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);
  const dateKey = currentDate;

  // Parse a 'YYYY-MM-DD' string as a LOCAL date (avoids the classic JS bug where
  // new Date('YYYY-MM-DD') is parsed as UTC midnight and can display as the previous day)
  const parseLocalDate = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  // Format a Date object as 'YYYY-MM-DD' using LOCAL date parts (avoids toISOString(),
  // which converts to UTC first and can shift the date near midnight in some timezones)
  const formatDateLocal = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const getCurrentTimeHHMM = () => localTime(Date.now(), appSettings.timezone);
  const startFast = startFastRemote;
  const stopFast = stopFastRemote;
  const saveActiveFastStartTime = async (newTime) => {
    if (!activeFastDraft || !newTime) return false;
    return await setActiveFast({
      ...activeFastDraft,
      startTime: newTime,
      startTimestampMs: instant(
        activeFastDraft.startDateKey,
        newTime,
        activeFastDraft.timezone,
      ),
    });
  };
  const getElapsedFastLabel = () => {
    if (!activeFast) return "";
    const elapsedMs = Date.now() - activeFast.startTimestampMs;
    const totalMinutes = Math.max(0, Math.floor(elapsedMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };
  const getNextFastPrediction = () =>
    fastReminder(
      appSettings.fastingStartTime,
      appSettings.timezone,
      Date.now(),
    );
  const getFastTargetEnd = (
    startTimestampMs,
    timezone = appSettings.timezone,
    now = Date.now(),
  ) => fastGoal(startTimestampMs, appSettings.fastingGoalHours, timezone, now);
  const formatTime12h = (time24) => {
    if (!time24 || time24 === "No time set") return time24 || "No time set";
    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const suffix = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${mStr} ${suffix}`;
  };
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const selectedDayOfWeek = parseLocalDate(currentDate).getDay();
  const isSuppScheduledToday = (supp) => scheduledOn(supp, currentDate);
  const getTodayEntries = () => {
    return entries[dateKey] || {};
  };
  const getMostRecentWeight = () => {
    const dates = Object.keys(entries).sort().reverse();
    for (const d of dates) {
      const dayWeights = entries[d] && entries[d].weight;
      if (dayWeights && dayWeights.length > 0) {
        return {
          entry: latestWeight(dayWeights),
          date: d,
        };
      }
    }
    return null;
  };
  const buildDayItemsForHistory = historyItems;
  const getSymptomFoodContext = (from, to, hours, severity) =>
    symptomFoodContext(
      entries,
      from,
      to,
      hours,
      severity,
      appSettings.timezone,
    );
  const addEntry = async (category, data) => {
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    if (
      !(await setEntries((prev) => ({
        ...prev,
        [dateKey]: {
          ...prev[dateKey],
          [category]: Array.isArray(prev[dateKey]?.[category])
            ? [
                ...prev[dateKey][category],
                {
                  ...data,
                  timestamp,
                  id: crypto.randomUUID(),
                },
              ]
            : [
                {
                  ...data,
                  timestamp,
                  id: crypto.randomUUID(),
                },
              ],
        },
      })))
    )
      return false; // Reset form
    setFormData({
      fastingStart: "",
      fastingEnd: "",
      supplement: "",
      supplementTime: "",
      supplementNotes: "",
      symptom: "",
      symptomLevel: 3,
      symptomNotes: "",
      symptomDate: "",
      symptomTime: "",
      weight: "",
      targetWeight: "",
      foodNote: "",
      foodTime: "",
      foodNotes: "",
      medicalEvent: "",
      medicalNotes: "",
      medicalTime: "",
      gymActivity: "",
      gymNotes: "",
      gymTime: "",
      recurringName: "",
      recurringTime: "",
      recurringFrequency: "daily",
      recurringDayOfWeek: "1",
      recurringGymName: "",
      recurringGymTime: "",
      recurringGymFrequency: "daily",
      recurringGymDayOfWeek: "1",
    });
    setActiveTab("timeline");
    return true;
  };
  const deleteEntry = async (category, id, revision) => {
    if (
      !(await removeEntity(
        category === "fasting" ? "fast" : "entry",
        id,
        revision,
      ))
    )
      return false;
    setActiveTab("timeline");
    return true;
  };
  const [editingId, setEditingId] = useState(null);
  const [timelineEditingKey, setTimelineEditingKey] = useState(null);
  const [addEntryType, setAddEntryType] = useState(null);
  const [editingActiveFastStart, setEditingActiveFastStart] = useState(false);
  const [showWeightEntryForm, setShowWeightEntryForm] = useState(false);
  const [showAddRecurringSupp, setShowAddRecurringSupp] = useState(false);
  const [showAddRecurringGym, setShowAddRecurringGym] = useState(false);
  const [historyTypeFilters, setHistoryTypeFilters] = useState([]);
  const [historyDateFrom, setHistoryDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDateLocal(d);
  });
  const [historyDateTo, setHistoryDateTo] = useState(() =>
    localDate(Date.now(), appSettings.timezone),
  );
  const [historyView, setHistoryView] = useState("list");
  const [correlationWindowHours, setCorrelationWindowHours] = useState(6);
  const [minSeverityFilter, setMinSeverityFilter] = useState(1);
  const [Chart, setChart] = useState(null);
  useEffect(() => {
    if (activeTab === "history" && historyView === "charts" && !Chart) {
      let cancelled = false;
      import("chart.js/auto").then((module) => {
        if (!cancelled) setChart(() => module.default);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [activeTab, historyView, Chart]);
  const weightChartRef = useRef(null);
  const weightChartInstanceRef = useRef(null);
  const fastingChartRef = useRef(null);
  const fastingChartInstanceRef = useRef(null);
  useEffect(() => {
    if (!Chart || activeTab !== "history" || historyView !== "charts") return;
    if (!weightChartRef.current) return;
    const dates = Object.keys(entries)
      .filter(
        (d) =>
          (!historyDateFrom || d >= historyDateFrom) &&
          (!historyDateTo || d <= historyDateTo),
      )
      .sort();
    const labels = [];
    const dataPoints = [];
    dates.forEach((d) => {
      const dayWeights = entries[d] && entries[d].weight;
      if (dayWeights && dayWeights.length > 0) {
        const latest = latestWeight(dayWeights);
        labels.push(
          parseLocalDate(d).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        );
        dataPoints.push(parseFloat(latest.weight));
      }
    });
    if (weightChartInstanceRef.current) {
      weightChartInstanceRef.current.destroy();
      weightChartInstanceRef.current = null;
    }
    if (dataPoints.length === 0) return;
    const target = appSettings.targetWeight
      ? parseFloat(appSettings.targetWeight)
      : null;
    const datasets = [
      {
        label: "Weight (kg)",
        data: dataPoints,
        borderColor: "#333",
        backgroundColor: "rgba(51, 51, 51, 0.1)",
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: "#333",
        fill: true,
      },
    ];
    if (target !== null) {
      datasets.push({
        label: "Target",
        data: labels.map(() => target),
        borderColor: "#27ae60",
        borderDash: [6, 6],
        pointRadius: 0,
        fill: false,
      });
    }
    weightChartInstanceRef.current = new Chart(weightChartRef.current, {
      type: "line",
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: target !== null,
            position: "bottom",
          },
        },
        scales: {
          y: {
            ticks: {
              callback: (v) => `${v} kg`,
            },
          },
          x: {
            ticks: {
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 45,
              minRotation: 0,
            },
          },
        },
      },
    });
    return () => {
      if (weightChartInstanceRef.current) {
        weightChartInstanceRef.current.destroy();
        weightChartInstanceRef.current = null;
      }
    };
  }, [
    Chart,
    activeTab,
    historyView,
    entries,
    historyDateFrom,
    historyDateTo,
    appSettings.targetWeight,
  ]);
  useEffect(() => {
    if (!Chart || activeTab !== "history" || historyView !== "charts") return;
    if (!fastingChartRef.current) return;
    const dates = Object.keys(entries)
      .filter(
        (d) =>
          (!historyDateFrom || d >= historyDateFrom) &&
          (!historyDateTo || d <= historyDateTo),
      )
      .sort();
    const goalHours = appSettings.fastingGoalHours || 16;
    const labels = [];
    const dataPoints = [];
    dates.forEach((d) => {
      const dayFasts = entries[d] && entries[d].fasting;
      if (dayFasts && dayFasts.length > 0) {
        let totalHours = 0;
        dayFasts.forEach((f) => {
          if (!f.start || !f.end) return;
          totalHours += fastHours(f.startTimestampMs, f.endTimestampMs);
        });
        labels.push(
          parseLocalDate(d).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
        );
        dataPoints.push(totalHours);
      }
    });
    if (fastingChartInstanceRef.current) {
      fastingChartInstanceRef.current.destroy();
      fastingChartInstanceRef.current = null;
    }
    if (dataPoints.length === 0) return;
    const barColors = dataPoints.map((h) =>
      h >= goalHours ? "#27ae60" : "#f39c12",
    );
    fastingChartInstanceRef.current = new Chart(fastingChartRef.current, {
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Hours Fasted",
            data: dataPoints,
            backgroundColor: barColors,
          },
          {
            type: "line",
            label: `Goal (${goalHours}h)`,
            data: labels.map(() => goalHours),
            borderColor: "#333",
            borderDash: [6, 6],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
          },
        },
        scales: {
          y: {
            ticks: {
              callback: (v) => `${v}h`,
            },
          },
          x: {
            ticks: {
              autoSkip: true,
              maxTicksLimit: 10,
              maxRotation: 45,
              minRotation: 0,
            },
          },
        },
      },
    });
    return () => {
      if (fastingChartInstanceRef.current) {
        fastingChartInstanceRef.current.destroy();
        fastingChartInstanceRef.current = null;
      }
    };
  }, [
    Chart,
    activeTab,
    historyView,
    entries,
    historyDateFrom,
    historyDateTo,
    appSettings.fastingGoalHours,
  ]);
  const [editActiveFastTime, setEditActiveFastTime] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [editData, setEditData] = useState({});
  const [editDate, setEditDate] = useState("");
  const [editSourceDate, setEditSourceDate] = useState("");
  const startEdit = (category, entry) => {
    setEditingCategory(category);
    setEditingId(entry.id);
    setEditDate(dateKey);
    setEditSourceDate(dateKey);
    setEditData({
      ...entry,
    });
  };
  const cancelEdit = () => {
    setEditingCategory(null);
    setEditingId(null);
    setEditData({});
  };
  const saveEdit = async (category) => {
    const targetDate = category === "symptoms" ? editDate : editSourceDate;
    if (
      !(await setEntries((prev) => {
        const source = prev[editSourceDate] ?? {};
        const items = source[category] ?? [];
        const entry = items.find((item) => item.id === editingId);
        if (!entry)
          throw new Error(
            "This entry is no longer available. Reload your tracker.",
          );
        const updated = { ...entry, ...editData };
        if (targetDate === editSourceDate)
          return {
            ...prev,
            [editSourceDate]: {
              ...source,
              [category]: items.map((item) =>
                item.id === editingId ? updated : item,
              ),
            },
          };
        // Dates belong to the day/row, never to the entry's data payload.
        return {
          ...prev,
          [editSourceDate]: {
            ...source,
            [category]: items.filter((item) => item.id !== editingId),
          },
          [targetDate]: {
            ...prev[targetDate],
            [category]: [...(prev[targetDate]?.[category] ?? []), updated],
          },
        };
      }))
    )
      return false;
    cancelEdit();
    setCurrentDate(targetDate);
    setActiveTab("timeline");
    return true;
  };
  const isEditing = (category, id) =>
    editingCategory === category && editingId === id;
  const todayData = getTodayEntries();

  // Calculate fasting status
  const getFastingStatus = () => {
    const fast = todayData.fasting
      ?.slice()
      .sort((a, b) => b.endTimestampMs - a.endTimestampMs)[0];
    if (!fast) return null;
    const hours = fastHours(fast.startTimestampMs, fast.endTimestampMs);
    return {
      hours: Math.round(hours * 10) / 10,
      goal: getFastTargetEnd(
        fast.startTimestampMs,
        fast.timezone,
        fast.endTimestampMs,
      ),
      start: fast.start,
      end: fast.end,
    };
  };
  const isRecurringFailed = (key) => {
    const failed = todayData.failedRecurring || [];
    return failed.includes(key);
  };
  const markRecurringFailed = async (key) => {
    if (
      !(await setEntries((prev) => {
        const prevDay = prev[dateKey] || {};
        return {
          ...prev,
          [dateKey]: {
            ...prevDay,
            failedRecurring: [...(prevDay.failedRecurring || []), key],
          },
        };
      }))
    )
      return false;
    return true;
  };
  const clearRecurringFailed = async (key) => {
    if (
      !(await setEntries((prev) => {
        const prevDay = prev[dateKey] || {};
        return {
          ...prev,
          [dateKey]: {
            ...prevDay,
            failedRecurring: (prevDay.failedRecurring || []).filter(
              (k) => k !== key,
            ),
          },
        };
      }))
    )
      return false;
    return true;
  };
  const isRecurringDone = (supp) => {
    const dismissed = todayData.dueDismissed || [];
    return dismissed.includes(`recurring-${supp.id}`);
  };
  const uncheckRecurring = async (supp) => {
    const key = `recurring-${supp.id}`;
    if (
      !(await setEntries((prev) => {
        const prevDay = prev[dateKey] || {};
        return {
          ...prev,
          [dateKey]: {
            ...prevDay,
            dueDismissed: (prevDay.dueDismissed || []).filter((k) => k !== key),
          },
        };
      }))
    )
      return false;
    return true;
  };
  const confirmRecurringDone = (supp, time, notes) =>
    setEntries((prev) =>
      completeChecklist(prev, dateKey, supp, "supplements", time, notes),
    );
  const [confirmingSuppId, setConfirmingSuppId] = useState(null);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [confirmTime, setConfirmTime] = useState("");
  const [confirmingUncheckSuppId, setConfirmingUncheckSuppId] = useState(null);
  const [confirmingUncheckGymId, setConfirmingUncheckGymId] = useState(null);
  const [editingRecurringId, setEditingRecurringId] = useState(null);
  const [editRecurringData, setEditRecurringData] = useState({});
  const startEditRecurring = (supp) => {
    setEditingRecurringId(supp.id);
    setEditRecurringData({
      ...supp,
    });
  };
  const cancelEditRecurring = () => {
    setEditingRecurringId(null);
    setEditRecurringData({});
  };
  const saveEditRecurring = async () => {
    if (
      !(await setRecurringSupps((prev) => ({
        ...prev,
        [editingRecurringId]: {
          ...prev[editingRecurringId],
          _revision: editRecurringData._revision,
          name: editRecurringData.name,
          time: editRecurringData.time,
          frequency: editRecurringData.frequency || "daily",
          dayOfWeek:
            editRecurringData.frequency === "weekly"
              ? editRecurringData.dayOfWeek
              : undefined,
        },
      })))
    )
      return false;
    cancelEditRecurring();
    return true;
  };
  const deleteRecurring = async (id, revision) => {
    if (!(await removeEntity("schedule", id, revision))) return false;
    if (editingRecurringId === id) cancelEditRecurring();
    return true;
  };
  const isRecurringGymDone = (item) => {
    const dismissed = todayData.dueDismissed || [];
    return dismissed.includes(`recurring-gym-${item.id}`);
  };
  const uncheckRecurringGym = async (item) => {
    const key = `recurring-gym-${item.id}`;
    if (
      !(await setEntries((prev) => {
        const prevDay = prev[dateKey] || {};
        return {
          ...prev,
          [dateKey]: {
            ...prevDay,
            dueDismissed: (prevDay.dueDismissed || []).filter((k) => k !== key),
          },
        };
      }))
    )
      return false;
    return true;
  };
  const confirmRecurringGymDone = (item, time, notes) =>
    setEntries((prev) =>
      completeChecklist(prev, dateKey, item, "gym", time, notes),
    );
  const [confirmingGymId, setConfirmingGymId] = useState(null);
  const [confirmGymTime, setConfirmGymTime] = useState("");
  const [editingGymRecurringId, setEditingGymRecurringId] = useState(null);
  const [editGymRecurringData, setEditGymRecurringData] = useState({});
  const startEditRecurringGym = (item) => {
    setEditingGymRecurringId(item.id);
    setEditGymRecurringData({
      ...item,
    });
  };
  const cancelEditRecurringGym = () => {
    setEditingGymRecurringId(null);
    setEditGymRecurringData({});
  };
  const saveEditRecurringGym = async () => {
    if (
      !(await setRecurringGym((prev) => ({
        ...prev,
        [editingGymRecurringId]: {
          ...prev[editingGymRecurringId],
          _revision: editGymRecurringData._revision,
          name: editGymRecurringData.name,
          time: editGymRecurringData.time,
          frequency: editGymRecurringData.frequency || "daily",
          dayOfWeek:
            editGymRecurringData.frequency === "weekly"
              ? editGymRecurringData.dayOfWeek
              : undefined,
        },
      })))
    )
      return false;
    cancelEditRecurringGym();
    return true;
  };
  const deleteRecurringGym = async (id, revision) => {
    if (!(await removeEntity("schedule", id, revision))) return false;
    if (editingGymRecurringId === id) cancelEditRecurringGym();
    return true;
  };
  const fastingStatus = getFastingStatus();
  const getDayTimeline = () => {
    const items = [];
    (todayData.supplements || []).forEach((entry) => {
      items.push({
        id: "supp-" + entry.id,
        time: entry.time && entry.time !== "No time set" ? entry.time : null,
        icon: "💊",
        label: entry.name,
        detail: entry.notes || "",
        category: "supplements",
        entry: entry,
      });
    });
    (todayData.medical || []).forEach((entry) => {
      items.push({
        id: "medical-" + entry.id,
        time: entry.time && entry.time !== "No time set" ? entry.time : null,
        icon: "⛑️",
        label: entry.event,
        detail: entry.notes || "",
        category: "medical",
        entry: entry,
      });
    });
    (todayData.weight || []).forEach((entry) => {
      items.push({
        id: "weight-" + entry.id,
        time: entry.time && entry.time !== "No time set" ? entry.time : null,
        icon: "🎯",
        label: `Weight: ${entry.weight} kg`,
        detail: entry.target ? `Target: ${entry.target} kg` : "",
        category: "weight",
        entry: entry,
      });
    });
    (todayData.symptoms || []).forEach((entry) => {
      items.push({
        id: "symp-" + entry.id,
        time: entry.time && entry.time !== "No time set" ? entry.time : null,
        icon: "🤒",
        label: `${entry.symptom} — Level ${entry.level}/5`,
        detail: entry.notes || "",
        category: "symptoms",
        entry: entry,
      });
    });
    (todayData.food || []).forEach((entry) => {
      items.push({
        id: "food-" + entry.id,
        time: entry.time && entry.time !== "No time set" ? entry.time : null,
        icon: "🍎",
        label: entry.note,
        detail: entry.notes || "",
        category: "food",
        entry: entry,
      });
    });
    (todayData.gym || []).forEach((entry) => {
      items.push({
        id: "gym-" + entry.id,
        time: entry.time && entry.time !== "No time set" ? entry.time : null,
        icon: "🏋️‍♀️",
        label: entry.activity,
        detail: entry.notes || "",
        category: "gym",
        entry: entry,
      });
    });
    (todayData.fasting || []).forEach((entry) => {
      let crossesMidnight = false;
      let durationLabel = "";
      if (entry.start && entry.end) {
        crossesMidnight =
          localDate(entry.startTimestampMs, entry.timezone) !==
          localDate(entry.endTimestampMs, entry.timezone);
        const diffH = fastHours(entry.startTimestampMs, entry.endTimestampMs);
        durationLabel = ` · ${diffH.toFixed(1)}h total`;
      }
      if (crossesMidnight) {
        // Started the previous day — only "Fast ended" belongs on this day's timeline.
        // The start info is folded into this entry's detail, and also shown as a
        // read-only preview on the previous day (see the "peek at tomorrow" block below).
        items.push({
          id: "fast-end-" + entry.id,
          time: entry.end || null,
          icon: "⏳",
          label: "✅ Fast ended",
          detail: entry.start
            ? `Started ${formatTime12h(entry.start)}${durationLabel}`
            : "",
          category: "fasting",
          entry: entry,
        });
      } else {
        // Same-day fast — both started and ended genuinely happened today, so show both, editable.
        // No green highlight here — that's reserved for a fast that's currently active.
        const target = entry.start
          ? getFastTargetEnd(entry.startTimestampMs, entry.timezone)
          : null;
        items.push({
          id: "fast-start-" + entry.id,
          time: entry.start || null,
          icon: "⏳",
          label: "✅ Fast started",
          detail: target
            ? `until ${formatTime12h(target.time)} ${target.dayLabel}`
            : "",
          category: "fasting",
          entry: entry,
        });
        items.push({
          id: "fast-end-" + entry.id,
          time: entry.end || null,
          icon: "⏳",
          label: "✅ Fast ended",
          detail: durationLabel ? durationLabel.replace(" · ", "") : "",
          category: "fasting",
          entry: entry,
        });
      }
    });

    // A completed fast may have begun several days before its end date.
    Object.entries(entries).forEach(([endDate, day]) => {
      if (endDate === dateKey) return;
      (day.fasting || []).forEach((entry) => {
        if (localDate(entry.startTimestampMs, entry.timezone) !== dateKey)
          return;
        items.push({
          id: "fast-start-preview-" + entry.id,
          time: entry.start,
          icon: "⏳",
          label: "✅ Fast started",
          detail: `Ended ${endDate} · ${fastHours(entry.startTimestampMs, entry.endTimestampMs).toFixed(1)}h total`,
          category: null,
          entry: null,
        });
      });
    });

    // Show "Fast started" for a fast that's currently in progress (not yet stopped) —
    // always shown on the day it actually began.
    if (activeFast && activeFast.startDateKey === dateKey) {
      const target = activeFast.startTime
        ? getFastTargetEnd(activeFast.startTimestampMs, activeFast.timezone)
        : null;
      items.push({
        id: "fast-active-start",
        time: activeFast.startTime || null,
        icon: "⏳",
        label: "✅ Fast started",
        detail: target
          ? `until ${formatTime12h(target.time)} ${target.dayLabel}`
          : "",
        category: null,
        entry: null,
        milestone: true,
      });
    }

    // Sort by time (entries without a time go to the end)
    items.sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
    return items;
  };
  const dayTimeline = getDayTimeline();
  return {
    setEntries,
    setRecurringSupps,
    setRecurringGym,
    setAppSettings,
    setActiveFast,
    startFastRemote,
    stopFastRemote,
    entries,
    recurringSupps,
    recurringGym,
    appSettings,
    activeFast,
    nowTick,
    setNowTick,
    currentDate,
    setCurrentDate,
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    dateKey,
    parseLocalDate,
    formatDateLocal,
    getCurrentTimeHHMM,
    startFast,
    stopFast,
    saveActiveFastStartTime,
    getElapsedFastLabel,
    getNextFastPrediction,
    getFastTargetEnd,
    formatTime12h,
    dayNames,
    selectedDayOfWeek,
    isSuppScheduledToday,
    getTodayEntries,
    getMostRecentWeight,
    buildDayItemsForHistory,
    getSymptomFoodContext,
    addEntry,
    deleteEntry,
    editingId,
    setEditingId,
    timelineEditingKey,
    setTimelineEditingKey,
    addEntryType,
    setAddEntryType,
    editingActiveFastStart,
    setEditingActiveFastStart,
    showWeightEntryForm,
    setShowWeightEntryForm,
    showAddRecurringSupp,
    setShowAddRecurringSupp,
    showAddRecurringGym,
    setShowAddRecurringGym,
    historyTypeFilters,
    setHistoryTypeFilters,
    historyDateFrom,
    setHistoryDateFrom,
    historyDateTo,
    setHistoryDateTo,
    historyView,
    setHistoryView,
    correlationWindowHours,
    setCorrelationWindowHours,
    minSeverityFilter,
    setMinSeverityFilter,
    weightChartRef,
    weightChartInstanceRef,
    fastingChartRef,
    fastingChartInstanceRef,
    editActiveFastTime,
    setEditActiveFastTime,
    setActiveFastDraft,
    editingCategory,
    setEditingCategory,
    editData,
    setEditData,
    startEdit,
    cancelEdit,
    saveEdit,
    editDate,
    setEditDate,
    isEditing,
    todayData,
    getFastingStatus,
    isRecurringFailed,
    markRecurringFailed,
    clearRecurringFailed,
    isRecurringDone,
    uncheckRecurring,
    confirmRecurringDone,
    confirmingSuppId,
    setConfirmingSuppId,
    confirmNotes,
    setConfirmNotes,
    confirmTime,
    setConfirmTime,
    confirmingUncheckSuppId,
    setConfirmingUncheckSuppId,
    confirmingUncheckGymId,
    setConfirmingUncheckGymId,
    editingRecurringId,
    setEditingRecurringId,
    editRecurringData,
    setEditRecurringData,
    startEditRecurring,
    cancelEditRecurring,
    saveEditRecurring,
    deleteRecurring,
    isRecurringGymDone,
    uncheckRecurringGym,
    confirmRecurringGymDone,
    confirmingGymId,
    setConfirmingGymId,
    confirmGymTime,
    setConfirmGymTime,
    editingGymRecurringId,
    setEditingGymRecurringId,
    editGymRecurringData,
    setEditGymRecurringData,
    startEditRecurringGym,
    cancelEditRecurringGym,
    saveEditRecurringGym,
    deleteRecurringGym,
    fastingStatus,
    getDayTimeline,
    dayTimeline,
    styles,
  };
};
