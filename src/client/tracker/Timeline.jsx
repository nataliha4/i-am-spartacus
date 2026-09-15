export default function Timeline({ model }) {
  const {
    styles,
    dayTimeline,
    editingActiveFastStart,
    editActiveFastTime,
    setEditActiveFastTime,
    setActiveFastDraft,
    saveActiveFastStartTime,
    setEditingActiveFastStart,
    timelineEditingKey,
    editData,
    setEditData,
    saveEdit,
    setTimelineEditingKey,
    cancelEdit,
    deleteEntry,
    activeFast,
    startEdit,
    formatTime12h,
    renderAddEntryCard,
  } = model;
  return (
    <div style={styles.content}>
      {dayTimeline.length > 0 && (
        <div id="day-timeline-card" style={styles.card}>
          <div style={styles.cardTitle}>🧾 Day Timeline</div>
          <div>
            {dayTimeline.map((item) => {
              if (item.id === "fast-active-start" && editingActiveFastStart) {
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
                          if (
                            !(await saveActiveFastStartTime(editActiveFastTime))
                          )
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
                );
              }
              const editingThis = timelineEditingKey === item.id;
              if (editingThis) {
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
                    {item.category === "supplements" && (
                      <>
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Name
                        </label>
                        <input
                          type="text"
                          value={editData.name}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              name: e.target.value,
                            })
                          }
                          style={styles.editInput}
                        />
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
                          value={editData.time}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              time: e.target.value,
                            })
                          }
                          style={styles.editInput}
                        />
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Notes
                        </label>
                        <textarea
                          value={editData.notes || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              notes: e.target.value,
                            })
                          }
                          style={{
                            ...styles.editInput,
                            minHeight: "60px",
                          }}
                        />
                      </>
                    )}
                    {item.category === "symptoms" && (
                      <>
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Symptom
                        </label>
                        <input
                          type="text"
                          value={editData.symptom}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              symptom: e.target.value,
                            })
                          }
                          style={styles.editInput}
                        />
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Severity (1-5)
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={editData.level}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              level: parseInt(e.target.value),
                            })
                          }
                          style={{
                            width: "100%",
                            marginBottom: "0.5rem",
                          }}
                        />
                        <div
                          style={{
                            textAlign: "center",
                            fontSize: "13px",
                            color: "#666",
                            marginBottom: "0.5rem",
                          }}
                        >
                          Level: {editData.level} / 5
                        </div>
                        <div style={styles.twoColumnForm}>
                          <div>
                            <label
                              style={{
                                fontSize: "13px",
                                color: "#666",
                              }}
                            >
                              Date
                            </label>
                            <input
                              type="date"
                              value={model.editDate}
                              onChange={(e) =>
                                model.setEditDate(e.target.value)
                              }
                              style={styles.editInput}
                            />
                          </div>
                          <div>
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
                              value={editData.time}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  time: e.target.value,
                                })
                              }
                              style={styles.editInput}
                            />
                          </div>
                        </div>
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Notes
                        </label>
                        <textarea
                          value={editData.notes || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              notes: e.target.value,
                            })
                          }
                          style={{
                            ...styles.editInput,
                            minHeight: "60px",
                          }}
                        />
                      </>
                    )}
                    {item.category === "food" && (
                      <>
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          What did you eat?
                        </label>
                        <textarea
                          value={editData.note}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              note: e.target.value,
                            })
                          }
                          style={{
                            ...styles.editInput,
                            minHeight: "60px",
                          }}
                        />
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
                          value={editData.time}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              time: e.target.value,
                            })
                          }
                          style={styles.editInput}
                        />
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Notes
                        </label>
                        <textarea
                          value={editData.notes || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              notes: e.target.value,
                            })
                          }
                          style={{
                            ...styles.editInput,
                            minHeight: "60px",
                          }}
                        />
                      </>
                    )}
                    {item.category === "gym" && (
                      <>
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Gym activity
                        </label>
                        <input
                          type="text"
                          value={editData.activity}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              activity: e.target.value,
                            })
                          }
                          style={styles.editInput}
                        />
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
                          value={editData.time || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              time: e.target.value,
                            })
                          }
                          style={styles.editInput}
                        />
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Notes
                        </label>
                        <textarea
                          value={editData.notes || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              notes: e.target.value,
                            })
                          }
                          style={{
                            ...styles.editInput,
                            minHeight: "60px",
                          }}
                        />
                      </>
                    )}
                    {item.category === "fasting" &&
                      (item.id.startsWith("fast-end") ? (
                        <>
                          <label
                            style={{
                              fontSize: "13px",
                              color: "#666",
                            }}
                          >
                            End
                          </label>
                          <input
                            type="time"
                            value={editData.end}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                end: e.target.value,
                              })
                            }
                            style={styles.editInput}
                          />
                        </>
                      ) : (
                        <>
                          <label
                            style={{
                              fontSize: "13px",
                              color: "#666",
                            }}
                          >
                            Start
                          </label>
                          <input
                            type="time"
                            value={editData.start}
                            onChange={(e) =>
                              setEditData({
                                ...editData,
                                start: e.target.value,
                              })
                            }
                            style={styles.editInput}
                          />
                        </>
                      ))}
                    {item.category === "medical" && (
                      <>
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Medical event
                        </label>
                        <input
                          type="text"
                          value={editData.event}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              event: e.target.value,
                            })
                          }
                          style={styles.editInput}
                        />
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
                          value={editData.time || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              time: e.target.value,
                            })
                          }
                          style={styles.editInput}
                        />
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Notes
                        </label>
                        <textarea
                          value={editData.notes || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              notes: e.target.value,
                            })
                          }
                          style={{
                            ...styles.editInput,
                            minHeight: "60px",
                          }}
                        />
                      </>
                    )}
                    {item.category === "weight" && (
                      <>
                        <div style={styles.twoColumnForm}>
                          <div>
                            <label
                              style={{
                                fontSize: "13px",
                                color: "#666",
                              }}
                            >
                              Weight (kg)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={editData.weight}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  weight: e.target.value,
                                })
                              }
                              style={styles.editInput}
                            />
                          </div>
                          <div>
                            <label
                              style={{
                                fontSize: "13px",
                                color: "#666",
                              }}
                            >
                              Target (kg)
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              value={editData.target || ""}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  target: e.target.value,
                                })
                              }
                              style={styles.editInput}
                            />
                          </div>
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
                          value={editData.time || ""}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              time: e.target.value,
                            })
                          }
                          style={styles.editInput}
                        />
                      </>
                    )}
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
                          if (!(await saveEdit(item.category))) return false;
                          setTimelineEditingKey(null);
                        }}
                        style={styles.saveButton}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          cancelEdit();
                          setTimelineEditingKey(null);
                        }}
                        style={styles.cancelButton}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (
                            !(await deleteEntry(
                              item.category,
                              item.entry.id,
                              editData._revision,
                            ))
                          )
                            return false;
                          cancelEdit();
                          setTimelineEditingKey(null);
                        }}
                        style={styles.deleteButton}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={item.id}
                  style={{
                    ...styles.entry,
                    cursor:
                      (item.category && item.entry) ||
                      item.id === "fast-active-start"
                        ? "pointer"
                        : "default",
                    ...(item.milestone
                      ? {
                          backgroundColor: "#eafaf1",
                          border: "2px solid #27ae60",
                        }
                      : {}),
                  }}
                  onClick={() => {
                    if (item.id === "fast-active-start") {
                      setActiveFastDraft({ ...activeFast });
                      setEditActiveFastTime(activeFast.startTime);
                      setEditingActiveFastStart(true);
                      return;
                    }
                    if (!item.category || !item.entry) return;
                    startEdit(item.category, item.entry, item.sourceDate);
                    setTimelineEditingKey(item.id);
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "20px",
                        minWidth: "28px",
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
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "0.75rem",
                        }}
                      >
                        <strong
                          style={{
                            flex: 1,
                            minWidth: 0,
                            color: item.milestone ? "#1e7e4f" : "inherit",
                          }}
                        >
                          {item.label}
                        </strong>
                        <span
                          style={{
                            color: item.milestone ? "#1e7e4f" : "#666",
                            fontWeight: "600",
                            fontSize: "16px",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          {formatTime12h(item.time)}
                        </span>
                      </div>
                      {item.detail && (
                        <div
                          style={{
                            marginTop: "0.3rem",
                            fontSize: "14px",
                            color: "#666",
                          }}
                        >
                          {item.detail}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {dayTimeline.length === 0 && (
        <div style={styles.card}>
          <div style={styles.emptyState}>No entries yet. Start tracking!</div>
        </div>
      )}
      {renderAddEntryCard()}
    </div>
  );
}
