import useTrackerModel from "./useTrackerModel";
import { styles } from "./styles";
import AddEntryCard from "./AddEntryCard";
import Dashboard from "./Dashboard";
import Plan from "./Plan";
import Timeline from "./Timeline";
import Settings from "./Settings";
import History from "./History";
import { localDate } from "../../shared/model";
export default function Tracker() {
  const model = useTrackerModel();
  model.renderAddEntryCard = () => <AddEntryCard model={model} />;
  const {
    setActiveTab,
    parseLocalDate,
    currentDate,
    setCurrentDate,
    formatDateLocal,
    appSettings,
    activeTab,
  } = model;
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div
          onClick={() => setActiveTab("dashboard")}
          style={{
            cursor: "pointer",
          }}
        >
          <h1 style={styles.title}>💪 I AM SPARTACUS 💪</h1>
          <p style={styles.subtitle}>
            My Daily Tracker for Health and Activity
          </p>
        </div>
      </div>

      {/* Date Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => {
            const d = parseLocalDate(currentDate);
            d.setDate(d.getDate() - 1);
            setCurrentDate(formatDateLocal(d));
          }}
          style={{
            border: 0,
            padding: 0,
            background: "transparent",
            textAlign: "inherit",
            ...{
              fontSize: "20px",
              fontWeight: "700",
              color: "#666",
              cursor: "pointer",
              padding: "0.4rem 0.6rem",
              userSelect: "none",
            },
          }}
          aria-label="Previous day"
          type="button"
        >
          ‹
        </button>
        <input
          type="date"
          value={currentDate}
          onChange={(e) => setCurrentDate(e.target.value)}
          style={{
            padding: "0.6rem 1rem",
            fontSize: "16px",
            border: "2px solid #e0e0e0",
            borderRadius: "8px",
            cursor: "pointer",
            textAlign: "center",
            fontWeight: "600",
            color: "#333",
          }}
        />
        <button
          onClick={() => {
            const d = parseLocalDate(currentDate);
            d.setDate(d.getDate() + 1);
            setCurrentDate(formatDateLocal(d));
          }}
          style={{
            border: 0,
            padding: 0,
            background: "transparent",
            textAlign: "inherit",
            ...{
              fontSize: "20px",
              fontWeight: "700",
              color: "#666",
              cursor: "pointer",
              padding: "0.4rem 0.6rem",
              userSelect: "none",
            },
          }}
          aria-label="Next day"
          type="button"
        >
          ›
        </button>
        {currentDate !== localDate(Date.now(), appSettings.timezone) && (
          <button
            onClick={() =>
              setCurrentDate(localDate(Date.now(), appSettings.timezone))
            }
            style={{
              border: 0,
              padding: 0,
              background: "transparent",
              textAlign: "inherit",
              ...{
                fontSize: "14px",
                fontWeight: "600",
                color: "#333",
                cursor: "pointer",
                textDecoration: "underline",
                padding: "0.4rem 0.2rem",
              },
            }}
            type="button"
          >
            Today
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          {
            key: "dashboard",
            icon: "📊",
            name: "Dashboard",
          },
          {
            key: "timeline",
            icon: "🧾",
            name: "Day Timeline",
          },
          {
            key: "history",
            icon: "📈",
            name: "Stats and History",
          },
          {
            key: "plan",
            icon: "🎯",
            name: "Plan for Today",
          },
          {
            key: "settings",
            icon: "🛠️",
            name: "Settings",
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              border: 0,
              padding: 0,
              background: "transparent",
              textAlign: "inherit",
              ...{
                ...styles.tab,
                ...(activeTab === tab.key ? styles.tabActive : {}),
                WebkitTapHighlightColor: "transparent",
                userSelect: "none",
              },
            }}
            title={tab.name}
            aria-label={tab.name}
            type="button"
          >
            {tab.icon}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === "dashboard" && <Dashboard model={model} />}

      {/* Plan for Today Tab */}
      {activeTab === "plan" && <Plan model={model} />}

      {/* Day Timeline Tab */}
      {activeTab === "timeline" && <Timeline model={model} />}

      {/* Settings Tab */}
      {activeTab === "settings" && <Settings model={model} />}

      {/* History Tab */}
      {activeTab === "history" && <History model={model} />}
    </div>
  );
}
