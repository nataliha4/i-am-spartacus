export default function Plan({ model }) {
  const {
    styles,
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
    confirmingUncheckSuppId,
    confirmingUncheckGymId,
    setConfirmingUncheckSuppId,
    setConfirmingUncheckGymId,
    confirmRecurringDone,
    confirmRecurringGymDone,
    uncheckRecurring,
    uncheckRecurringGym,
    confirmNotes,
    setConfirmNotes,
    markRecurringFailed,
    clearRecurringFailed,
    getCurrentTimeHHMM,
    formatTime12h,
  } = model;
  return (
    <div style={styles.content}>
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
        ].sort((a, b) => (a.item.time || "").localeCompare(b.item.time || ""));
        if (planItems.length === 0) return null;
        return (
          <div style={styles.card}>
            <div style={styles.cardTitle}>🎯 Plan for Today</div>
            <div>
              {planItems.map(({ item, type }) => {
                const isSupp = type === "supplement";
                const typeIcon = isSupp ? "💊" : "🏋️‍♀️";
                const done = isSupp
                  ? isRecurringDone(item)
                  : isRecurringGymDone(item);
                const failedKey = isSupp
                  ? `recurring-${item.id}`
                  : `recurring-gym-${item.id}`;
                const failed = isRecurringFailed(failedKey);
                const confirmingId = isSupp
                  ? confirmingSuppId
                  : confirmingGymId;
                const setConfirmingId = isSupp
                  ? setConfirmingSuppId
                  : setConfirmingGymId;
                const confirmTimeVal = isSupp ? confirmTime : confirmGymTime;
                const setConfirmTimeVal = isSupp
                  ? setConfirmTime
                  : setConfirmGymTime;
                const confirmingUncheckId = isSupp
                  ? confirmingUncheckSuppId
                  : confirmingUncheckGymId;
                const setConfirmingUncheckId = isSupp
                  ? setConfirmingUncheckSuppId
                  : setConfirmingUncheckGymId;
                const onConfirmDone = isSupp
                  ? confirmRecurringDone
                  : confirmRecurringGymDone;
                const onUncheck = isSupp
                  ? uncheckRecurring
                  : uncheckRecurringGym;
                const isConfirming = confirmingId === item.id;
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
                if (confirmingUncheckId === item.id) {
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: "1rem 1.25rem",
                        backgroundColor: "#fff",
                        border: "2px solid #e74c3c",
                        borderRadius: "8px",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: "600",
                          fontSize: "17px",
                          marginBottom: "0.5rem",
                        }}
                      >
                        Unmark {typeIcon} {item.name}?
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#666",
                          marginBottom: "0.75rem",
                        }}
                      >
                        This won't remove it from your Day Timeline log — you
                        can delete that entry separately if needed.
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={async () => {
                            if (!(await onUncheck(item))) return false;
                            setConfirmingUncheckId(null);
                          }}
                          style={styles.deleteButton}
                        >
                          Yes, Unmark
                        </button>
                        <button
                          onClick={() => setConfirmingUncheckId(null)}
                          style={styles.cancelButton}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                }
                if (failed) {
                  return (
                    <div
                      key={item.id}
                      onClick={async () =>
                        await clearRecurringFailed(failedKey)
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "1rem 1.25rem",
                        backgroundColor: "#fdecea",
                        border: "2px solid #e74c3c",
                        borderRadius: "8px",
                        marginBottom: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          minWidth: "28px",
                          borderRadius: "50%",
                          border: "2px solid #e74c3c",
                          backgroundColor: "#e74c3c",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: "16px",
                          fontWeight: "700",
                        }}
                      >
                        ✕
                      </div>
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
                            color: "#c0392b",
                            textDecoration: "line-through",
                          }}
                        >
                          {item.name}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: "15px",
                          color: "#c0392b",
                          fontWeight: "600",
                          flexShrink: 0,
                        }}
                      >
                        Failed
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (done) {
                        setConfirmingUncheckId(item.id);
                      } else {
                        setConfirmingId(item.id);
                        setConfirmTimeVal(getCurrentTimeHHMM());
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      padding: "1rem 1.25rem",
                      backgroundColor: done ? "#eafaf1" : "#fff",
                      border: `2px solid ${done ? "#27ae60" : "#e0e0e0"}`,
                      borderRadius: "8px",
                      marginBottom: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        minWidth: "28px",
                        borderRadius: "50%",
                        border: `2px solid ${done ? "#27ae60" : "#ccc"}`,
                        backgroundColor: done ? "#27ae60" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: "16px",
                        fontWeight: "700",
                      }}
                    >
                      {done ? "✓" : ""}
                    </div>
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
                          color: done ? "#7a9e8c" : "#333",
                          textDecoration: done ? "line-through" : "none",
                        }}
                      >
                        {item.name}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        color: "#666",
                        fontWeight: "600",
                        flexShrink: 0,
                      }}
                    >
                      {formatTime12h(item.time)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
