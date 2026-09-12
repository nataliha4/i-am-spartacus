import { localDate } from "../../shared/model";
export default function AddEntryCard({ model }) {
  const {
    currentDate,
    appSettings,
    styles,
    addEntryType,
    setAddEntryType,
    formData,
    setFormData,
    addEntry,
    getCurrentTimeHHMM,
  } = model;
  const isViewingToday =
    currentDate === localDate(Date.now(), appSettings.timezone);
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>➕ Add Entry</div>
      {!addEntryType ? (
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
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
          ].map((opt) => (
            <button
              key={opt.type}
              onClick={() => setAddEntryType(opt.type)}
              style={{
                border: 0,
                padding: 0,
                background: "transparent",
                textAlign: "inherit",
                ...{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "1rem 0.5rem",
                  border: "2px solid #e0e0e0",
                  borderRadius: "8px",
                  cursor: "pointer",
                  minWidth: "80px",
                  flex: "1 1 80px",
                },
              }}
              type="button"
            >
              <div
                style={{
                  fontSize: "28px",
                }}
              >
                {opt.icon}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#333",
                }}
              >
                {opt.label}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          {addEntryType === "symptoms" && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>Symptom</label>
                <input
                  type="text"
                  placeholder="e.g., Headache"
                  value={formData.symptom}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      symptom: e.target.value,
                    })
                  }
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Severity (1-5)</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={formData.symptomLevel}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      symptomLevel: parseInt(e.target.value),
                    })
                  }
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
                  Level: {formData.symptomLevel} / 5
                </div>
              </div>
              {!isViewingToday && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Time</label>
                  <input
                    type="time"
                    value={formData.symptomTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        symptomTime: e.target.value,
                      })
                    }
                    style={styles.input}
                  />
                </div>
              )}
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes (optional)</label>
                <textarea
                  placeholder="e.g., Started after lunch"
                  value={formData.symptomNotes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      symptomNotes: e.target.value,
                    })
                  }
                  style={styles.textarea}
                />
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
                    if (formData.symptom) {
                      if (
                        !(await addEntry("symptoms", {
                          symptom: formData.symptom,
                          level: formData.symptomLevel,
                          notes: formData.symptomNotes,
                          time: formData.symptomTime || getCurrentTimeHHMM(),
                        }))
                      )
                        return false;
                      setAddEntryType(null);
                    }
                  }}
                  style={styles.button}
                >
                  Log Symptom
                </button>
                <button
                  onClick={() => setAddEntryType(null)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
          {addEntryType === "food" && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>What did you eat?</label>
                <textarea
                  placeholder="e.g., Grilled chicken, rice, and broccoli"
                  value={formData.foodNote}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      foodNote: e.target.value,
                    })
                  }
                  style={styles.textarea}
                />
              </div>
              {!isViewingToday && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Time</label>
                  <input
                    type="time"
                    value={formData.foodTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        foodTime: e.target.value,
                      })
                    }
                    style={styles.input}
                  />
                </div>
              )}
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes (optional)</label>
                <textarea
                  placeholder="e.g., Felt bloated after"
                  value={formData.foodNotes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      foodNotes: e.target.value,
                    })
                  }
                  style={styles.textarea}
                />
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
                    if (formData.foodNote) {
                      if (
                        !(await addEntry("food", {
                          note: formData.foodNote,
                          time: formData.foodTime || getCurrentTimeHHMM(),
                          notes: formData.foodNotes,
                        }))
                      )
                        return false;
                      setAddEntryType(null);
                    }
                  }}
                  style={styles.button}
                >
                  Log Food
                </button>
                <button
                  onClick={() => setAddEntryType(null)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
          {addEntryType === "supplements" && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>Supplement name</label>
                <input
                  type="text"
                  placeholder="e.g., Magnesium"
                  value={formData.supplement}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      supplement: e.target.value,
                    })
                  }
                  style={styles.input}
                />
              </div>
              {!isViewingToday && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Time</label>
                  <input
                    type="time"
                    value={formData.supplementTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        supplementTime: e.target.value,
                      })
                    }
                    style={styles.input}
                  />
                </div>
              )}
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes (optional)</label>
                <textarea
                  placeholder="e.g., Taken with food"
                  value={formData.supplementNotes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      supplementNotes: e.target.value,
                    })
                  }
                  style={styles.textarea}
                />
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
                    if (formData.supplement) {
                      if (
                        !(await addEntry("supplements", {
                          name: formData.supplement,
                          time: formData.supplementTime || getCurrentTimeHHMM(),
                          notes: formData.supplementNotes,
                        }))
                      )
                        return false;
                      setAddEntryType(null);
                    }
                  }}
                  style={styles.button}
                >
                  Log Supplement
                </button>
                <button
                  onClick={() => setAddEntryType(null)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
          {addEntryType === "gym" && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>Gym activity</label>
                <input
                  type="text"
                  placeholder="e.g., Planet Fitness — Chest & Triceps"
                  value={formData.gymActivity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      gymActivity: e.target.value,
                    })
                  }
                  style={styles.input}
                />
              </div>
              {!isViewingToday && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Time</label>
                  <input
                    type="time"
                    value={formData.gymTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        gymTime: e.target.value,
                      })
                    }
                    style={styles.input}
                  />
                </div>
              )}
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes (optional)</label>
                <textarea
                  placeholder="e.g., 60 min, felt strong"
                  value={formData.gymNotes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      gymNotes: e.target.value,
                    })
                  }
                  style={styles.textarea}
                />
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
                    if (formData.gymActivity) {
                      if (
                        !(await addEntry("gym", {
                          activity: formData.gymActivity,
                          notes: formData.gymNotes,
                          time: formData.gymTime || getCurrentTimeHHMM(),
                        }))
                      )
                        return false;
                      setAddEntryType(null);
                    }
                  }}
                  style={styles.button}
                >
                  Log Gym Activity
                </button>
                <button
                  onClick={() => setAddEntryType(null)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
          {addEntryType === "medical" && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>Medical event</label>
                <input
                  type="text"
                  placeholder="e.g., Doctor visit, blood test, vaccination"
                  value={formData.medicalEvent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      medicalEvent: e.target.value,
                    })
                  }
                  style={styles.input}
                />
              </div>
              {!isViewingToday && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Time</label>
                  <input
                    type="time"
                    value={formData.medicalTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        medicalTime: e.target.value,
                      })
                    }
                    style={styles.input}
                  />
                </div>
              )}
              <div style={styles.formGroup}>
                <label style={styles.label}>Notes (optional)</label>
                <textarea
                  placeholder="e.g., Results showed..."
                  value={formData.medicalNotes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      medicalNotes: e.target.value,
                    })
                  }
                  style={styles.textarea}
                />
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
                    if (formData.medicalEvent) {
                      if (
                        !(await addEntry("medical", {
                          event: formData.medicalEvent,
                          notes: formData.medicalNotes,
                          time: formData.medicalTime || getCurrentTimeHHMM(),
                        }))
                      )
                        return false;
                      setAddEntryType(null);
                    }
                  }}
                  style={styles.button}
                >
                  Log Medical Event
                </button>
                <button
                  onClick={() => setAddEntryType(null)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
