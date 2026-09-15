import { useEffect, useState } from "react";

export default function Settings({ model }) {
  const {
    styles,
    appSettings: savedSettings,
    setAppSettings: persistSettings,
    recurringSupps,
    editingRecurringId,
    editRecurringData,
    setEditRecurringData,
    dayNames,
    saveEditRecurring,
    cancelEditRecurring,
    deleteRecurring,
    startEditRecurring,
    formatTime12h,
    showAddRecurringSupp,
    setShowAddRecurringSupp,
    formData,
    setFormData,
    setRecurringSupps,
    recurringGym,
    editingGymRecurringId,
    editGymRecurringData,
    setEditGymRecurringData,
    saveEditRecurringGym,
    cancelEditRecurringGym,
    deleteRecurringGym,
    startEditRecurringGym,
    showAddRecurringGym,
    setShowAddRecurringGym,
    setRecurringGym,
    getTodayDateKey,
  } = model;
  const [appSettings, setDraftSettings] = useState(savedSettings);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setDraftSettings(savedSettings);
  }, [savedSettings, dirty]);
  const [settingsSavedFlash, setSettingsSavedFlash] = useState(null);
  const setAppSettings = async (value) => {
    setDraftSettings(value);
    setDirty(true);
    setSettingsSavedFlash(null);
    return true;
  };
  return (
    <div style={styles.content}>
      <div style={styles.card}>
        <div style={styles.cardTitle}>⚖️ Target Weight</div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Target weight (kg)</label>
          <input
            type="number"
            step="0.1"
            placeholder="e.g., 70"
            value={appSettings.targetWeight}
            onChange={async (e) => {
              if (
                !(await setAppSettings({
                  ...appSettings,
                  targetWeight: e.target.value,
                }))
              )
                return false;
            }}
            style={styles.input}
          />
          {settingsSavedFlash === "targetWeight" && (
            <div
              style={{
                fontSize: "13px",
                color: "#27ae60",
                fontWeight: "600",
                marginTop: "0.4rem",
              }}
            >
              ✓ Saved
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "#666",
          }}
        >
          Used automatically when you log your weight, and shown on the
          Dashboard.
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>⏳ Fasting Goal</div>
        <div style={styles.twoColumnForm}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Goal hours</label>
            <input
              type="number"
              step="0.5"
              value={appSettings.fastingGoalHours}
              onChange={async (e) => {
                if (
                  !(await setAppSettings({
                    ...appSettings,
                    fastingGoalHours: parseFloat(e.target.value) || 0,
                  }))
                )
                  return false;
              }}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Daily start time</label>
            <input
              type="time"
              value={appSettings.fastingStartTime}
              onChange={async (e) => {
                if (
                  !(await setAppSettings({
                    ...appSettings,
                    fastingStartTime: e.target.value,
                  }))
                )
                  return false;
              }}
              style={styles.input}
            />
          </div>
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "#666",
          }}
        >
          Goal hours sets when "✅ Goal met" shows. Daily start time drives the
          "Next fast starts at..." prediction on the Dashboard.
        </div>
      </div>

      <button
        style={styles.button}
        onClick={async () => {
          if (await persistSettings(appSettings)) {
            setDirty(false);
            setSettingsSavedFlash("targetWeight");
          }
        }}
      >
        Save weight and fasting settings
      </button>
      {Object.keys(recurringSupps).length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>🔁 Recurring Supplements</div>
          {Object.values(recurringSupps)
            .slice()
            .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
            .map((supp) => {
              const isEditingThis = editingRecurringId === supp.id;
              if (isEditingThis) {
                return (
                  <div
                    key={supp.id}
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
                      Supplement name
                    </label>
                    <input
                      type="text"
                      value={editRecurringData.name}
                      onChange={(e) =>
                        setEditRecurringData({
                          ...editRecurringData,
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
                      Frequency
                    </label>
                    <select
                      value={editRecurringData.frequency || "daily"}
                      onChange={(e) =>
                        setEditRecurringData({
                          ...editRecurringData,
                          frequency: e.target.value,
                        })
                      }
                      style={styles.editInput}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    {editRecurringData.frequency === "weekly" && (
                      <>
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Day of week
                        </label>
                        <select
                          value={editRecurringData.dayOfWeek ?? "1"}
                          onChange={(e) =>
                            setEditRecurringData({
                              ...editRecurringData,
                              dayOfWeek: e.target.value,
                            })
                          }
                          style={styles.editInput}
                        >
                          {dayNames.map((day, idx) => (
                            <option key={idx} value={idx}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    <label
                      style={{
                        fontSize: "13px",
                        color: "#666",
                      }}
                    >
                      Time to remind me
                    </label>
                    <input
                      type="time"
                      value={editRecurringData.time}
                      onChange={(e) =>
                        setEditRecurringData({
                          ...editRecurringData,
                          time: e.target.value,
                        })
                      }
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
                        onClick={saveEditRecurring}
                        style={styles.saveButton}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditRecurring}
                        style={styles.cancelButton}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () =>
                          await deleteRecurring(supp.id, supp._revision)
                        }
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
                  key={supp.id}
                  onClick={() => startEditRecurring(supp)}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "1rem 1.25rem",
                    backgroundColor: "#fff",
                    border: "2px solid #e0e0e0",
                    borderRadius: "8px",
                    marginBottom: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      flex: "1 1 10rem",
                      minWidth: 0,
                      fontWeight: "600",
                      fontSize: "17px",
                      color: "#333",
                    }}
                  >
                    {supp.name}
                  </div>
                  <div
                    style={{
                      fontSize: "15px",
                      color: "#666",
                      fontWeight: "600",
                      flexShrink: 1,
                    }}
                  >
                    {supp.frequency === "weekly"
                      ? `Weekly (${dayNames[parseInt(supp.dayOfWeek, 10)]}) at ${formatTime12h(supp.time)}`
                      : `Daily at ${formatTime12h(supp.time)}`}
                  </div>
                </div>
              );
            })}
          {!showAddRecurringSupp && (
            <div
              onClick={() => setShowAddRecurringSupp(true)}
              style={{
                textAlign: "center",
                color: "#666",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
                marginTop: "0.5rem",
              }}
            >
              + Add Recurring Supplement
            </div>
          )}
        </div>
      )}

      {(showAddRecurringSupp || Object.keys(recurringSupps).length === 0) && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>🔁 Add Recurring Supplement</div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Supplement name</label>
            <input
              type="text"
              placeholder="e.g., Magnesium"
              value={formData.recurringName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  recurringName: e.target.value,
                })
              }
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Frequency</label>
            <select
              value={formData.recurringFrequency}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  recurringFrequency: e.target.value,
                })
              }
              style={styles.select}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          {formData.recurringFrequency === "weekly" && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Day of week</label>
              <select
                value={formData.recurringDayOfWeek}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    recurringDayOfWeek: e.target.value,
                  })
                }
                style={styles.select}
              >
                {dayNames.map((day, idx) => (
                  <option key={idx} value={idx}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={styles.formGroup}>
            <label style={styles.label}>Time to remind me</label>
            <input
              type="time"
              value={formData.recurringTime}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  recurringTime: e.target.value,
                })
              }
              style={styles.input}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={async () => {
                if (formData.recurringName && formData.recurringTime) {
                  if (
                    !(await setRecurringSupps((prev) => {
                      const id = crypto.randomUUID();
                      return {
                        ...prev,
                        [id]: {
                          id,
                          name: formData.recurringName,
                          time: formData.recurringTime,
                          frequency: formData.recurringFrequency,
                          dayOfWeek:
                            formData.recurringFrequency === "weekly"
                              ? formData.recurringDayOfWeek
                              : undefined,
                          createdDate: getTodayDateKey(),
                        },
                      };
                    }))
                  )
                    return false;
                  setFormData({
                    ...formData,
                    recurringName: "",
                    recurringTime: "",
                    recurringFrequency: "daily",
                    recurringDayOfWeek: "1",
                  });
                  setShowAddRecurringSupp(false);
                }
              }}
              style={styles.button}
            >
              Add Recurring Supplement
            </button>
            {Object.keys(recurringSupps).length > 0 && (
              <button
                onClick={() => setShowAddRecurringSupp(false)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {Object.keys(recurringGym).length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>🔁 Recurring Gym Activities</div>
          {Object.values(recurringGym)
            .slice()
            .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
            .map((item) => {
              const isEditingThis = editingGymRecurringId === item.id;
              if (isEditingThis) {
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
                      Activity name
                    </label>
                    <input
                      type="text"
                      value={editGymRecurringData.name}
                      onChange={(e) =>
                        setEditGymRecurringData({
                          ...editGymRecurringData,
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
                      Frequency
                    </label>
                    <select
                      value={editGymRecurringData.frequency || "daily"}
                      onChange={(e) =>
                        setEditGymRecurringData({
                          ...editGymRecurringData,
                          frequency: e.target.value,
                        })
                      }
                      style={styles.editInput}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    {editGymRecurringData.frequency === "weekly" && (
                      <>
                        <label
                          style={{
                            fontSize: "13px",
                            color: "#666",
                          }}
                        >
                          Day of week
                        </label>
                        <select
                          value={editGymRecurringData.dayOfWeek ?? "1"}
                          onChange={(e) =>
                            setEditGymRecurringData({
                              ...editGymRecurringData,
                              dayOfWeek: e.target.value,
                            })
                          }
                          style={styles.editInput}
                        >
                          {dayNames.map((day, idx) => (
                            <option key={idx} value={idx}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                    <label
                      style={{
                        fontSize: "13px",
                        color: "#666",
                      }}
                    >
                      Time to remind me
                    </label>
                    <input
                      type="time"
                      value={editGymRecurringData.time}
                      onChange={(e) =>
                        setEditGymRecurringData({
                          ...editGymRecurringData,
                          time: e.target.value,
                        })
                      }
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
                        onClick={saveEditRecurringGym}
                        style={styles.saveButton}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEditRecurringGym}
                        style={styles.cancelButton}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () =>
                          await deleteRecurringGym(item.id, item._revision)
                        }
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
                  onClick={() => startEditRecurringGym(item)}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "1rem 1.25rem",
                    backgroundColor: "#fff",
                    border: "2px solid #e0e0e0",
                    borderRadius: "8px",
                    marginBottom: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      flex: "1 1 10rem",
                      minWidth: 0,
                      fontWeight: "600",
                      fontSize: "17px",
                      color: "#333",
                    }}
                  >
                    {item.name}
                  </div>
                  <div
                    style={{
                      fontSize: "15px",
                      color: "#666",
                      fontWeight: "600",
                      flexShrink: 1,
                    }}
                  >
                    {item.frequency === "weekly"
                      ? `Weekly (${dayNames[parseInt(item.dayOfWeek, 10)]}) at ${formatTime12h(item.time)}`
                      : `Daily at ${formatTime12h(item.time)}`}
                  </div>
                </div>
              );
            })}
          {!showAddRecurringGym && (
            <div
              onClick={() => setShowAddRecurringGym(true)}
              style={{
                textAlign: "center",
                color: "#666",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
                marginTop: "0.5rem",
              }}
            >
              + Add Recurring Gym Activity
            </div>
          )}
        </div>
      )}

      {(showAddRecurringGym || Object.keys(recurringGym).length === 0) && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>🔁 Add Recurring Gym Activity</div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Activity name</label>
            <input
              type="text"
              placeholder="e.g., Planet Fitness — Leg Day"
              value={formData.recurringGymName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  recurringGymName: e.target.value,
                })
              }
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Frequency</label>
            <select
              value={formData.recurringGymFrequency}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  recurringGymFrequency: e.target.value,
                })
              }
              style={styles.select}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          {formData.recurringGymFrequency === "weekly" && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Day of week</label>
              <select
                value={formData.recurringGymDayOfWeek}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    recurringGymDayOfWeek: e.target.value,
                  })
                }
                style={styles.select}
              >
                {dayNames.map((day, idx) => (
                  <option key={idx} value={idx}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={styles.formGroup}>
            <label style={styles.label}>Time to remind me</label>
            <input
              type="time"
              value={formData.recurringGymTime}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  recurringGymTime: e.target.value,
                })
              }
              style={styles.input}
            />
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={async () => {
                if (formData.recurringGymName && formData.recurringGymTime) {
                  if (
                    !(await setRecurringGym((prev) => {
                      const id = crypto.randomUUID();
                      return {
                        ...prev,
                        [id]: {
                          id,
                          name: formData.recurringGymName,
                          time: formData.recurringGymTime,
                          frequency: formData.recurringGymFrequency,
                          dayOfWeek:
                            formData.recurringGymFrequency === "weekly"
                              ? formData.recurringGymDayOfWeek
                              : undefined,
                          createdDate: getTodayDateKey(),
                        },
                      };
                    }))
                  )
                    return false;
                  setFormData({
                    ...formData,
                    recurringGymName: "",
                    recurringGymTime: "",
                    recurringGymFrequency: "daily",
                    recurringGymDayOfWeek: "1",
                  });
                  setShowAddRecurringGym(false);
                }
              }}
              style={styles.button}
            >
              Add Recurring Gym Activity
            </button>
            {Object.keys(recurringGym).length > 0 && (
              <button
                onClick={() => setShowAddRecurringGym(false)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
