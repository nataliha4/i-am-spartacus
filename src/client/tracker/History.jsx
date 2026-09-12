import { localDate } from "../../shared/model";
export default function History({ model }) {
  const {
    styles,
    setHistoryView,
    historyView,
    historyTypeFilters,
    setHistoryTypeFilters,
    historyDateFrom,
    setHistoryDateFrom,
    historyDateTo,
    setHistoryDateTo,
    appSettings,
    formatDateLocal,
    entries,
    buildDayItemsForHistory,
    parseLocalDate,
    setCurrentDate,
    setActiveTab,
    formatTime12h,
    weightChartRef,
    fastingChartRef,
    correlationWindowHours,
    setCorrelationWindowHours,
    minSeverityFilter,
    setMinSeverityFilter,
    getSymptomFoodContext,
  } = model;
  return (
    <div style={styles.content}>
      <div
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#333",
          marginBottom: "1.25rem",
        }}
      >
        📈 Stats and History
      </div>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <button
          onClick={() => setHistoryView("list")}
          style={{
            border: 0,
            padding: 0,
            background: "transparent",
            textAlign: "inherit",
            ...{
              flex: 1,
              textAlign: "center",
              padding: "0.9rem",
              borderRadius: "8px",
              fontWeight: "700",
              fontSize: "16px",
              cursor: "pointer",
              backgroundColor: historyView === "list" ? "#333" : "#fff",
              color: historyView === "list" ? "#fff" : "#333",
              border: `2px solid ${historyView === "list" ? "#333" : "#e0e0e0"}`,
            },
          }}
          type="button"
        >
          📃 List
        </button>
        <button
          onClick={() => setHistoryView("charts")}
          style={{
            border: 0,
            padding: 0,
            background: "transparent",
            textAlign: "inherit",
            ...{
              flex: 1,
              textAlign: "center",
              padding: "0.9rem",
              borderRadius: "8px",
              fontWeight: "700",
              fontSize: "16px",
              cursor: "pointer",
              backgroundColor: historyView === "charts" ? "#333" : "#fff",
              color: historyView === "charts" ? "#fff" : "#333",
              border: `2px solid ${historyView === "charts" ? "#333" : "#e0e0e0"}`,
            },
          }}
          type="button"
        >
          📊 Charts
        </button>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>🔍 Filters</div>
        {historyView === "list" && (
          <div style={styles.formGroup}>
            <label style={styles.label}>Type</label>
            <div
              style={{
                display: "flex",
                gap: "0.6rem",
                flexWrap: "wrap",
              }}
            >
              {[
                {
                  type: "symptoms",
                  icon: "🤒",
                  label: "Symptom",
                },
                {
                  type: "food",
                  icon: "🍎",
                  label: "Food",
                },
                {
                  type: "supplements",
                  icon: "💊",
                  label: "Supplement",
                },
                {
                  type: "gym",
                  icon: "🏋️‍♀️",
                  label: "Gym",
                },
                {
                  type: "medical",
                  icon: "⛑️",
                  label: "Medical",
                },
                {
                  type: "weight",
                  icon: "⚖️",
                  label: "Weight",
                },
                {
                  type: "fasting",
                  icon: "⏳",
                  label: "Fasting",
                },
              ].map((opt) => {
                const selected = historyTypeFilters.includes(opt.type);
                return (
                  <button
                    key={opt.type}
                    onClick={() => {
                      setHistoryTypeFilters((prev) =>
                        selected
                          ? prev.filter((t) => t !== opt.type)
                          : [...prev, opt.type],
                      );
                    }}
                    style={{
                      border: 0,
                      padding: 0,
                      background: "transparent",
                      textAlign: "inherit",
                      ...{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.3rem",
                        padding: "0.75rem 0.4rem",
                        border: selected
                          ? "2px solid #333"
                          : "2px solid #e0e0e0",
                        backgroundColor: selected ? "#333" : "#fff",
                        borderRadius: "8px",
                        cursor: "pointer",
                        minWidth: "68px",
                        flex: "1 1 68px",
                      },
                    }}
                    type="button"
                  >
                    <div
                      style={{
                        fontSize: "22px",
                      }}
                    >
                      {opt.icon}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: selected ? "#fff" : "#333",
                      }}
                    >
                      {opt.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div style={styles.twoColumnForm}>
          <div style={styles.formGroup}>
            <label style={styles.label}>From</label>
            <input
              type="date"
              value={historyDateFrom}
              onChange={(e) => setHistoryDateFrom(e.target.value)}
              style={{
                ...styles.input,
                fontSize: "15px",
                padding: "0.75rem 0.5rem",
              }}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>To</label>
            <input
              type="date"
              value={historyDateTo}
              onChange={(e) => setHistoryDateTo(e.target.value)}
              style={{
                ...styles.input,
                fontSize: "15px",
                padding: "0.75rem 0.5rem",
              }}
            />
          </div>
        </div>
        {(() => {
          const today = localDate(Date.now(), appSettings.timezone);
          const sevenDaysAgoDate = new Date();
          sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
          const sevenDaysAgo = formatDateLocal(sevenDaysAgoDate);
          const isDefault =
            historyTypeFilters.length === 0 &&
            historyDateFrom === sevenDaysAgo &&
            historyDateTo === today;
          if (isDefault) return null;
          return (
            <div
              onClick={() => {
                setHistoryTypeFilters([]);
                setHistoryDateFrom(sevenDaysAgo);
                setHistoryDateTo(today);
              }}
              style={{
                textAlign: "center",
                color: "#666",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Reset filters
            </div>
          );
        })()}
      </div>

      {historyView === "list" &&
        (() => {
          const dates = Object.keys(entries)
            .filter(
              (d) =>
                (!historyDateFrom || d >= historyDateFrom) &&
                (!historyDateTo || d <= historyDateTo),
            )
            .sort()
            .reverse();
          const dayGroups = dates
            .map((d) => ({
              date: d,
              items: buildDayItemsForHistory(
                entries[d] || {},
                historyTypeFilters,
              ),
            }))
            .filter((g) => g.items.length > 0);
          if (dayGroups.length === 0) {
            return (
              <div style={styles.card}>
                <div style={styles.emptyState}>
                  No entries match these filters.
                </div>
              </div>
            );
          }
          return (
            <div style={styles.card}>
              {dayGroups.map((group) => (
                <div key={group.date}>
                  <div
                    style={{
                      fontWeight: "700",
                      fontSize: "15px",
                      color: "#333",
                      marginTop: "1.25rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {parseLocalDate(group.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                  {group.items.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setCurrentDate(group.date);
                        setActiveTab("timeline");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.6rem",
                        padding: "0.6rem 0",
                        borderBottom: "1px solid #eee",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "16px",
                          minWidth: "22px",
                        }}
                      >
                        {item.icon}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "15px",
                            fontWeight: "600",
                            color: "#333",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.label}
                        </div>
                        {item.detail && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#999",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.detail}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#666",
                          fontWeight: "600",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {formatTime12h(item.time)}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}

      {historyView === "charts" && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>⚖️ Weight Trend</div>
          {(() => {
            const hasData = Object.keys(entries).some((d) => {
              if (historyDateFrom && d < historyDateFrom) return false;
              if (historyDateTo && d > historyDateTo) return false;
              const w = entries[d] && entries[d].weight;
              return w && w.length > 0;
            });
            if (!hasData) {
              return (
                <div style={styles.emptyState}>
                  No weight entries in this date range yet.
                </div>
              );
            }
            return (
              <div
                style={{
                  position: "relative",
                  height: "280px",
                }}
              >
                <canvas ref={weightChartRef}></canvas>
              </div>
            );
          })()}
        </div>
      )}

      {historyView === "charts" && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>⏳ Fasting Duration</div>
          {(() => {
            const hasData = Object.keys(entries).some((d) => {
              if (historyDateFrom && d < historyDateFrom) return false;
              if (historyDateTo && d > historyDateTo) return false;
              const f = entries[d] && entries[d].fasting;
              return f && f.length > 0;
            });
            if (!hasData) {
              return (
                <div style={styles.emptyState}>
                  No fasting entries in this date range yet.
                </div>
              );
            }
            return (
              <div
                style={{
                  position: "relative",
                  height: "280px",
                }}
              >
                <canvas ref={fastingChartRef}></canvas>
              </div>
            );
          })()}
        </div>
      )}

      {historyView === "charts" && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>🔗 Food–Symptom Patterns</div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Look back window</label>
            <select
              value={correlationWindowHours}
              onChange={(e) =>
                setCorrelationWindowHours(parseFloat(e.target.value))
              }
              style={styles.select}
            >
              <option value={2}>Within 2 hours</option>
              <option value={4}>Within 4 hours</option>
              <option value={6}>Within 6 hours</option>
              <option value={12}>Within 12 hours</option>
              <option value={24}>Any time that day</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Minimum severity</label>
            <input
              type="range"
              min="1"
              max="5"
              value={minSeverityFilter}
              onChange={(e) => setMinSeverityFilter(parseInt(e.target.value))}
              style={{
                width: "100%",
              }}
            />
            <div
              style={{
                textAlign: "center",
                fontSize: "13px",
                color: "#666",
                marginTop: "0.3rem",
              }}
            >
              Level: {minSeverityFilter}+ / 5
            </div>
          </div>
          {(() => {
            const dayGroups = getSymptomFoodContext(
              historyDateFrom,
              historyDateTo,
              correlationWindowHours,
              minSeverityFilter,
            );
            if (dayGroups.length === 0) {
              return (
                <div style={styles.emptyState}>
                  No symptoms with a time logged in this range yet.
                </div>
              );
            }
            const formatDuration = (diffMin) => {
              const h = Math.floor(diffMin / 60);
              const m = diffMin % 60;
              if (h === 0) return `${m}m before`;
              if (m === 0) return `${h}h before`;
              return `${h}h ${m}m before`;
            };
            return (
              <div>
                {dayGroups.map((group) => (
                  <div key={group.date}>
                    <div
                      style={{
                        fontWeight: "700",
                        fontSize: "15px",
                        color: "#333",
                        marginTop: "1.25rem",
                        marginBottom: "0.25rem",
                      }}
                    >
                      {parseLocalDate(group.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                    {group.symptomRows.map(({ symptom, precedingFoods }) => (
                      <div
                        key={symptom.id}
                        style={{
                          padding: "0.75rem 0",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "0.75rem",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "16px",
                              fontWeight: "600",
                              color: "#333",
                            }}
                          >
                            🤒 {symptom.symptom} — Level {symptom.level}/5
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#666",
                              fontWeight: "600",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatTime12h(symptom.time)}
                          </div>
                        </div>
                        {precedingFoods.length === 0 ? (
                          <div
                            style={{
                              fontSize: "13px",
                              color: "#999",
                              marginTop: "0.4rem",
                              marginLeft: "1.5rem",
                            }}
                          >
                            No food logged in this window.
                          </div>
                        ) : (
                          <div
                            style={{
                              marginTop: "0.4rem",
                              marginLeft: "1.5rem",
                            }}
                          >
                            {precedingFoods.map((c, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: "0.75rem",
                                  fontSize: "13px",
                                  color: "#666",
                                  marginBottom: "0.2rem",
                                }}
                              >
                                <span>🍎 {c.food.note}</span>
                                <span
                                  style={{
                                    whiteSpace: "nowrap",
                                    color: "#999",
                                  }}
                                >
                                  {formatDuration(c.diffMin)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
