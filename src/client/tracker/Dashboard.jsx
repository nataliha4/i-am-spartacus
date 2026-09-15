import { latestWeight } from "../../shared/selectors";
export default function Dashboard({ model }) {
  const {
    styles,
    activeFast,
    editingActiveFastStart,
    editActiveFastTime,
    setEditActiveFastTime,
    setActiveFastDraft,
    saveActiveFastStartTime,
    setEditingActiveFastStart,
    appSettings,
    getFastTargetEnd,
    stopFast,
    getElapsedFastLabel,
    formatTime12h,
    getNextFastPrediction,
    startFast,
    fastingStatus,
    todayData,
    showWeightEntryForm,
    setShowWeightEntryForm,
    formData,
    setFormData,
    addEntry,
    getCurrentTimeHHMM,
    getMostRecentWeight,
    parseLocalDate,
    recurringSupps,
    isSuppScheduledToday,
    recurringGym,
    isRecurringDone,
    isRecurringGymDone,
    isRecurringFailed,
    confirmingSuppId,
    confirmingGymId,
    setConfirmingSuppId,
    setConfirmingGymId,
    confirmTime,
    confirmGymTime,
    setConfirmTime,
    setConfirmGymTime,
    confirmRecurringDone,
    confirmRecurringGymDone,
    confirmNotes,
    setConfirmNotes,
    markRecurringFailed,
    renderAddEntryCard,
    setActiveTab,
  } = model;
  return (
    <div style={styles.content}>
      <div style={styles.card}>
        <div style={styles.cardTitle}>⏳ Fasting</div>
        <div
          style={{
            fontSize: "16px",
            color: "#666",
            lineHeight: "2",
            fontWeight: "500",
          }}
        >
          {activeFast ? (
            editingActiveFastStart ? (
              <div
                style={{
                  padding: "1rem 1.25rem",
                  backgroundColor: "#fff",
                  border: "2px solid #333",
                  borderRadius: "8px",
                }}
              >
                <label
                  style={{
                    fontSize: "13px",
                    color: "#666",
                  }}
                >
                  Actual fast start time
                </label>
                <input
                  type="time"
                  value={editActiveFastTime}
                  onChange={(e) => setEditActiveFastTime(e.target.value)}
                  style={styles.editInput}
                />
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={async () => {
                      if (!(await saveActiveFastStartTime(editActiveFastTime)))
                        return false;
                      setEditingActiveFastStart(false);
                    }}
                    style={styles.saveButton}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingActiveFastStart(false)}
                    style={styles.cancelButton}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              (() => {
                const goalHours = appSettings.fastingGoalHours || 16;
                const target = getFastTargetEnd(
                  activeFast.startTimestampMs,
                  activeFast.timezone,
                );
                const elapsedHoursDecimal = target.elapsedHours;
                const percent = target.percent;
                const percentColor = target.goalMet ? "#27ae60" : "#3498db";
                const isPastGoal = target.goalMet;
                const absRemainMin = target.remainingMinutes;
                const remHoursPart = Math.floor(absRemainMin / 60);
                const remMinutesPart = absRemainMin % 60;
                return (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                        marginBottom: "1rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "19px",
                          fontWeight: "700",
                          color: "#3498db",
                        }}
                      >
                        ⏳ You're Fasting!
                      </span>
                      <button
                        onClick={stopFast}
                        style={{
                          backgroundColor: percentColor,
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "0.75rem 1.5rem",
                          fontSize: "16px",
                          fontWeight: "700",
                          cursor: "pointer",
                        }}
                      >
                        Stop Fast
                      </button>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-around",
                        textAlign: "center",
                        flexWrap: "wrap",
                        gap: "1rem",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "26px",
                            fontWeight: "700",
                            color: "#333",
                          }}
                        >
                          {getElapsedFastLabel()}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            marginTop: "0.2rem",
                          }}
                        >
                          Elapsed
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#999",
                            marginTop: "0.1rem",
                          }}
                        >
                          since {formatTime12h(activeFast.startTime)}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "26px",
                            fontWeight: "700",
                            color: percentColor,
                          }}
                        >
                          {percent}%
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            marginTop: "0.2rem",
                          }}
                        >
                          {target.goalMet ? "Goal met" : "Goal Progress"}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#999",
                            marginTop: "0.1rem",
                          }}
                        >
                          {elapsedHoursDecimal.toFixed(1)}h / {goalHours}h
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "26px",
                            fontWeight: "700",
                            color: "#333",
                          }}
                        >
                          {formatTime12h(target.time)}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            marginTop: "0.2rem",
                          }}
                        >
                          Fast Ends
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#999",
                            marginTop: "0.1rem",
                          }}
                        >
                          {target.dayLabel} ·{" "}
                          {isPastGoal
                            ? `${remHoursPart}h ${remMinutesPart}m over`
                            : `${remHoursPart}h ${remMinutesPart}m left`}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: "center",
                        marginTop: "1rem",
                      }}
                    >
                      <span
                        onClick={() => {
                          setActiveFastDraft({ ...activeFast });
                          setEditActiveFastTime(activeFast.startTime);
                          setEditingActiveFastStart(true);
                        }}
                        style={{
                          color: "#666",
                          fontWeight: "600",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        Edit start time
                      </span>
                    </div>
                  </div>
                );
              })()
            )
          ) : (
            <div>
              {(() => {
                const next = getNextFastPrediction();
                const urgencyColors = {
                  gray: "#999",
                  green: "#27ae60",
                  yellow: "#f39c12",
                  red: "#e74c3c",
                };
                const urgencyColor = urgencyColors[next.urgency];
                return (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "19px",
                        fontWeight: "700",
                        color: "#27ae60",
                      }}
                    >
                      🍽️ You're Eating!
                    </span>
                    <button
                      onClick={startFast}
                      style={{
                        backgroundColor: urgencyColor,
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "0.75rem 1.5rem",
                        fontSize: "16px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      Start Now
                    </button>
                  </div>
                );
              })()}

              {fastingStatus
                ? (() => {
                    const goalHours = appSettings.fastingGoalHours || 16;
                    const percent = fastingStatus.goal.percent;
                    const percentColor = fastingStatus.goal.goalMet
                      ? "#27ae60"
                      : "#f39c12";
                    const next = getNextFastPrediction();
                    const urgencyColors = {
                      gray: "#999",
                      green: "#27ae60",
                      yellow: "#f39c12",
                      red: "#e74c3c",
                    };
                    const nextColor = urgencyColors[next.urgency];
                    const nextBig = next.isOverdue
                      ? "Overdue"
                      : `${next.hoursPart}h ${next.minutesPart}m`;
                    const nextSub = next.isOverdue
                      ? `${next.hoursPart}h ${next.minutesPart}m past ${formatTime12h(next.time)}`
                      : `at ${formatTime12h(next.time)}`;
                    return (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-around",
                          textAlign: "center",
                          flexWrap: "wrap",
                          gap: "1rem",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "26px",
                              fontWeight: "700",
                              color: "#333",
                            }}
                          >
                            {fastingStatus.hours}h
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#666",
                              marginTop: "0.2rem",
                            }}
                          >
                            Last Fast
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#999",
                              marginTop: "0.1rem",
                            }}
                          >
                            {formatTime12h(fastingStatus.start)} –{" "}
                            {formatTime12h(fastingStatus.end)}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "26px",
                              fontWeight: "700",
                              color: percentColor,
                            }}
                          >
                            {percent}%
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#666",
                              marginTop: "0.2rem",
                            }}
                          >
                            {fastingStatus.goal.goalMet
                              ? "Goal met"
                              : "Goal Progress"}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#999",
                              marginTop: "0.1rem",
                            }}
                          >
                            {fastingStatus.hours}h / {goalHours}h
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: "26px",
                              fontWeight: "700",
                              color: nextColor,
                            }}
                          >
                            {nextBig}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#666",
                              marginTop: "0.2rem",
                            }}
                          >
                            Next Fast
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#999",
                              marginTop: "0.1rem",
                            }}
                          >
                            {nextSub}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                : (() => {
                    const next = getNextFastPrediction();
                    const urgencyColors = {
                      gray: "#999",
                      green: "#27ae60",
                      yellow: "#f39c12",
                      red: "#e74c3c",
                    };
                    const nextColor = urgencyColors[next.urgency];
                    const nextBig = next.isOverdue
                      ? "Overdue"
                      : `${next.hoursPart}h ${next.minutesPart}m`;
                    const nextSub = next.isOverdue
                      ? `${next.hoursPart}h ${next.minutesPart}m past ${formatTime12h(next.time)}`
                      : `at ${formatTime12h(next.time)}`;
                    return (
                      <div
                        style={{
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "13px",
                            color: "#999",
                            marginBottom: "0.5rem",
                          }}
                        >
                          No fast logged today yet
                        </div>
                        <div
                          style={{
                            fontSize: "28px",
                            fontWeight: "700",
                            color: nextColor,
                          }}
                        >
                          {nextBig}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            marginTop: "0.2rem",
                          }}
                        >
                          Next Fast
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#999",
                            marginTop: "0.1rem",
                          }}
                        >
                          {nextSub}
                        </div>
                      </div>
                    );
                  })()}
            </div>
          )}
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>⚖️ Weight</div>
        {(() => {
          const target = appSettings.targetWeight
            ? parseFloat(appSettings.targetWeight)
            : null;
          const hasToday = todayData.weight && todayData.weight.length > 0;
          if (hasToday) {
            const latest = latestWeight(todayData.weight);
            const current = parseFloat(latest.weight);
            const diff = target !== null ? current - target : null;
            const deltaColor =
              diff === null
                ? "#666"
                : diff >= 2
                  ? "#e74c3c"
                  : diff > 0
                    ? "#f39c12"
                    : "#27ae60";
            const deltaLabel =
              diff === null
                ? "—"
                : diff > 0
                  ? `+${diff.toFixed(1)}`
                  : diff < 0
                    ? `${diff.toFixed(1)}`
                    : "0";
            return (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-around",
                    textAlign: "center",
                    flexWrap: "wrap",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "26px",
                        fontWeight: "700",
                        color: "#333",
                      }}
                    >
                      {latest.weight} kg
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginTop: "0.2rem",
                      }}
                    >
                      Today's Weight
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "26px",
                        fontWeight: "700",
                        color: "#333",
                      }}
                    >
                      {target !== null ? `${target} kg` : "—"}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginTop: "0.2rem",
                      }}
                    >
                      Target
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "26px",
                        fontWeight: "700",
                        color: deltaColor,
                      }}
                    >
                      {deltaLabel}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginTop: "0.2rem",
                      }}
                    >
                      Delta (kg)
                    </div>
                  </div>
                </div>

                {!showWeightEntryForm ? (
                  <div
                    onClick={() => setShowWeightEntryForm(true)}
                    style={{
                      textAlign: "center",
                      color: "#666",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                  >
                    + Log another entry
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        alignItems: "flex-end",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          minWidth: "140px",
                        }}
                      >
                        <label style={styles.label}>Weight (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g., 75.5"
                          value={formData.weight}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              weight: e.target.value,
                            })
                          }
                          style={styles.input}
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (formData.weight) {
                            if (
                              !(await addEntry("weight", {
                                weight: formData.weight,
                                target: appSettings.targetWeight,
                                time: getCurrentTimeHHMM(),
                              }))
                            )
                              return false;
                            setShowWeightEntryForm(false);
                          }
                        }}
                        style={{
                          ...styles.button,
                          width: "auto",
                          padding: "0.9rem 1.5rem",
                        }}
                      >
                        Log
                      </button>
                    </div>
                    <div
                      onClick={() => setShowWeightEntryForm(false)}
                      style={{
                        textAlign: "center",
                        color: "#666",
                        fontWeight: "600",
                        fontSize: "13px",
                        cursor: "pointer",
                        marginTop: "0.5rem",
                      }}
                    >
                      Cancel
                    </div>
                  </div>
                )}
              </>
            );
          }
          const recent = getMostRecentWeight();
          return (
            <>
              {recent && (
                <div
                  style={{
                    fontSize: "14px",
                    color: "#666",
                    marginBottom: "1rem",
                  }}
                >
                  Last recorded: {recent.entry.weight} kg on{" "}
                  {parseLocalDate(recent.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {target !== null && ` · Target: ${target} kg`}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: "140px",
                  }}
                >
                  <label style={styles.label}>Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 75.5"
                    value={formData.weight}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        weight: e.target.value,
                      })
                    }
                    style={styles.input}
                  />
                </div>
                <button
                  onClick={async () => {
                    if (formData.weight) {
                      if (
                        !(await addEntry("weight", {
                          weight: formData.weight,
                          target: appSettings.targetWeight,
                          time: getCurrentTimeHHMM(),
                        }))
                      )
                        return false;
                    }
                  }}
                  style={{
                    ...styles.button,
                    width: "auto",
                    padding: "0.9rem 1.5rem",
                  }}
                >
                  Log
                </button>
              </div>
              {target !== null && !recent && (
                <div
                  style={{
                    fontSize: "13px",
                    color: "#666",
                    marginTop: "0.75rem",
                  }}
                >
                  Target: {target} kg
                </div>
              )}
            </>
          );
        })()}
      </div>

      {(() => {
        const planItems = [
          ...Object.values(recurringSupps)
            .filter(isSuppScheduledToday)
            .map((s) => ({
              item: s,
              type: "supplement",
            })),
          ...Object.values(recurringGym)
            .filter(isSuppScheduledToday)
            .map((g) => ({
              item: g,
              type: "gym",
            })),
        ];
        if (planItems.length === 0) return null;
        let doneCount = 0;
        let failedCount = 0;
        planItems.forEach(({ item, type }) => {
          const isSupp = type === "supplement";
          const done = isSupp
            ? isRecurringDone(item)
            : isRecurringGymDone(item);
          if (done) {
            doneCount++;
            return;
          }
          const failedKey = isSupp
            ? `recurring-${item.id}`
            : `recurring-gym-${item.id}`;
          if (isRecurringFailed(failedKey)) failedCount++;
        });
        const total = planItems.length;
        const pendingCount = total - doneCount - failedCount;
        const percent = Math.round((doneCount / total) * 100);
        const percentColor =
          percent === 100 ? "#27ae60" : percent >= 50 ? "#f39c12" : "#e74c3c";
        return (
          <div
            onClick={() => setActiveTab("plan")}
            style={{
              ...styles.card,
              cursor: "pointer",
            }}
          >
            <div style={styles.cardTitle}>🎯 Today's Plan Completion</div>
            <div
              style={{
                textAlign: "center",
                fontSize: "36px",
                fontWeight: "700",
                color: percentColor,
              }}
            >
              {percent}%
            </div>
            <div
              style={{
                textAlign: "center",
                fontSize: "13px",
                color: "#666",
                marginTop: "0.2rem",
                marginBottom: "0.75rem",
              }}
            >
              {doneCount} done · {failedCount} failed · {pendingCount} pending
            </div>
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "10px",
                borderRadius: "999px",
                overflow: "hidden",
                backgroundColor: "#f0f0f0",
              }}
            >
              {doneCount > 0 && (
                <div
                  style={{
                    width: `${(doneCount / total) * 100}%`,
                    backgroundColor: "#27ae60",
                  }}
                />
              )}
              {failedCount > 0 && (
                <div
                  style={{
                    width: `${(failedCount / total) * 100}%`,
                    backgroundColor: "#e74c3c",
                  }}
                />
              )}
              {pendingCount > 0 && (
                <div
                  style={{
                    width: `${(pendingCount / total) * 100}%`,
                    backgroundColor: "#ccc",
                  }}
                />
              )}
            </div>
          </div>
        );
      })()}

      {(() => {
        const now = new Date();
        const nowTotalMin = now.getHours() * 60 + now.getMinutes();
        const allPendingItems = [
          ...Object.values(recurringSupps)
            .filter(isSuppScheduledToday)
            .map((s) => ({
              item: s,
              type: "supplement",
            })),
          ...Object.values(recurringGym)
            .filter(isSuppScheduledToday)
            .map((g) => ({
              item: g,
              type: "gym",
            })),
        ]
          .filter(({ item, type }) => {
            const isSupp = type === "supplement";
            const done = isSupp
              ? isRecurringDone(item)
              : isRecurringGymDone(item);
            const failedKey = isSupp
              ? `recurring-${item.id}`
              : `recurring-gym-${item.id}`;
            const failed = isRecurringFailed(failedKey);
            if (done || failed) return false;
            if (!item.time) return false;
            return true;
          })
          .sort((a, b) => (a.item.time || "").localeCompare(b.item.time || ""));
        if (allPendingItems.length === 0) return null;

        // Only show the nearest-scheduled item(s) — once marked done/failed, the next one surfaces automatically
        const nearestTime = allPendingItems[0].item.time;
        const upcomingItems = allPendingItems.filter(
          ({ item }) => item.time === nearestTime,
        );
        return (
          <div style={styles.card}>
            <div style={styles.cardTitle}>🔔 Upcoming</div>
            {upcomingItems.map(({ item, type }) => {
              const isSupp = type === "supplement";
              const typeIcon = isSupp ? "💊" : "🏋️‍♀️";
              const failedKey = isSupp
                ? `recurring-${item.id}`
                : `recurring-gym-${item.id}`;
              const confirmingId = isSupp ? confirmingSuppId : confirmingGymId;
              const setConfirmingId = isSupp
                ? setConfirmingSuppId
                : setConfirmingGymId;
              const confirmTimeVal = isSupp ? confirmTime : confirmGymTime;
              const setConfirmTimeVal = isSupp
                ? setConfirmTime
                : setConfirmGymTime;
              const onConfirmDone = isSupp
                ? confirmRecurringDone
                : confirmRecurringGymDone;
              const isConfirming = confirmingId === item.id;
              const [h, m] = item.time.split(":").map(Number);
              const scheduledMin = h * 60 + m;
              const diffMin = scheduledMin - nowTotalMin;
              let urgencyColor, urgencyBg;
              if (diffMin > 60) {
                urgencyColor = "#999";
                urgencyBg = "#f5f5f5";
              } else if (diffMin > 0) {
                urgencyColor = "#27ae60";
                urgencyBg = "#eafaf1";
              } else if (diffMin > -60) {
                urgencyColor = "#856404";
                urgencyBg = "#fff3cd";
              } else {
                urgencyColor = "#c0392b";
                urgencyBg = "#fdecea";
              }
              if (isConfirming) {
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: "1rem 1.25rem",
                      backgroundColor: "#fff",
                      border: "2px solid #333",
                      borderRadius: "8px",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "600",
                        fontSize: "17px",
                        marginBottom: "0.75rem",
                      }}
                    >
                      {typeIcon} {item.name}
                    </div>
                    <label
                      style={{
                        fontSize: "13px",
                        color: "#666",
                      }}
                    >
                      Time
                    </label>
                    <input
                      type="time"
                      value={confirmTimeVal}
                      onChange={(e) => setConfirmTimeVal(e.target.value)}
                      style={styles.editInput}
                    />
                    <label
                      style={{
                        fontSize: "13px",
                        color: "#666",
                      }}
                    >
                      Notes (optional)
                    </label>
                    <textarea
                      placeholder="e.g., dosage, duration..."
                      value={confirmNotes}
                      onChange={(e) => setConfirmNotes(e.target.value)}
                      style={{
                        ...styles.editInput,
                        minHeight: "60px",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        marginTop: "0.5rem",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={async () => {
                          if (
                            !(await onConfirmDone(
                              item,
                              confirmTimeVal,
                              confirmNotes,
                            ))
                          )
                            return false;
                          setConfirmingId(null);
                          setConfirmNotes("");
                        }}
                        style={styles.saveButton}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => {
                          setConfirmingId(null);
                          setConfirmNotes("");
                        }}
                        style={styles.cancelButton}
                      >
                        Cancel
                      </button>
                      <span
                        onClick={async () => {
                          if (!(await markRecurringFailed(failedKey)))
                            return false;
                          setConfirmingId(null);
                          setConfirmNotes("");
                        }}
                        style={{
                          color: "#e74c3c",
                          fontWeight: "700",
                          fontSize: "15px",
                          cursor: "pointer",
                          marginLeft: "auto",
                        }}
                      >
                        Mark as Failed
                      </span>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setConfirmingId(item.id);
                    setConfirmTimeVal(getCurrentTimeHHMM());
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "1rem 1.25rem",
                    backgroundColor: urgencyBg,
                    border: `2px solid ${urgencyColor}`,
                    borderRadius: "8px",
                    marginBottom: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      fontSize: "18px",
                    }}
                  >
                    {typeIcon}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: "600",
                        fontSize: "17px",
                        color: "#333",
                      }}
                    >
                      {item.name}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      color: urgencyColor,
                      fontWeight: "600",
                    }}
                  >
                    {diffMin <= -60
                      ? `Overdue · ${formatTime12h(item.time)}`
                      : diffMin <= 0
                        ? `Due now · ${formatTime12h(item.time)}`
                        : formatTime12h(item.time)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {renderAddEntryCard()}
    </div>
  );
}
