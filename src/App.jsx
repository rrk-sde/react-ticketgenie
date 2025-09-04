import { useEffect, useRef, useState } from "react";

// ================== CONFIG ==================
const eventIds = [232, 233, 234];
const API_BASE = "/api";
const TG_BOT_TOKEN = "8337634191:AAE1kltvBz64c7rI-qB8u3DtoDt1jOcqdAA";
const TG_CHAT_ID = "314307608";
const IGNORED_STATUSES = ["SOLD OUT"];

// ================== TELEGRAM ==================
async function sendToTelegram(message, image) {
  const baseUrl = `https://api.telegram.org/bot${TG_BOT_TOKEN}`;
  const endpoint = image ? "sendPhoto" : "sendMessage";
  const payload = image
    ? { chat_id: TG_CHAT_ID, photo: image, caption: message, parse_mode: "Markdown" }
    : { chat_id: TG_CHAT_ID, text: message, parse_mode: "Markdown" };

  await fetch(`${baseUrl}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ================== HELPERS ==================
function timeAgo(date) {
  if (!date) return "No time available";
  const now = new Date();
  const diff = new Date(date) - now;
  if (isNaN(diff)) return "Invalid time";
  if (diff <= 0) return "Started already";

  const mins = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `Starts in ${days}d ${hours % 24}h`;
  if (hours > 0) return `Starts in ${hours}h ${mins % 60}m`;
  return `Starts in ${mins}m`;
}

function playSound() {
  const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
  audio.play().catch(() => {});
}

function notifyBrowser(title, body, image) {
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: image });
  }
}

// ================== APP ==================
export default function App() {
  const [events, setEvents] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(10); // seconds
  const [isPaused, setIsPaused] = useState(false);
  const [nextRefresh, setNextRefresh] = useState(refreshInterval);
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const prevStatus = useRef({});
  const history = useRef({});

  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

async function fetchEvent(id) {
  try {
    const res = await fetch(`${API_BASE}/Event/id/${id}`);
    if (!res.ok) return { id, status: `Error (${res.status})` };

    const data = await res.json().catch(() => null);
    if (!data) return { id, status: "Invalid response" };

    const btn = data?.result?.button_text || "N/A";
    const prev = prevStatus.current[id];

    const eventName = data?.result?.name || `Event ${id}`;

    // ✅ Venue with fallback
    const eventVenue =
      data?.result?.venue_name ||
      data?.result?.venue ||
      data?.result?.location ||
      data?.result?.stadium ||
      "Venue not available";

    const eventAddress = data?.result?.venue_address || "";

    // ✅ Use display_date + display_time directly
    const eventTime =
      (data?.result?.display_date || "") +
      (data?.result?.display_time ? ` ${data.result.display_time}` : "");

    if (!IGNORED_STATUSES.includes(btn) && btn !== prev) {
      const msg = `⚡ *Ticket Alert*
Event: ${eventName}
Status: *${btn}*
Venue: ${eventVenue}${eventAddress ? `, ${eventAddress}` : ""}
Time: ${eventTime || "Time not available"}`;

      await sendToTelegram(msg, data?.result?.banner_url);

      if (btn === "BOOK NOW") {
        playSound();
        notifyBrowser(
          "Ticket Alert",
          `${eventName} is now BOOK NOW`,
          data?.result?.banner_url
        );
      }
    }

    prevStatus.current[id] = btn;

    // Track history
    if (!history.current[id]) history.current[id] = [];
    if (btn !== prev) {
      history.current[id].push({
        time: new Date().toLocaleTimeString(),
        status: btn,
      });
    }

    return {
      id,
      name: eventName,
      status: btn,
      time: eventTime || "Time not available",
      venue: eventVenue,
      address: eventAddress,
      banner: data?.result?.banner_url,
      highlight: btn !== prev,
    };
  } catch (err) {
    console.error("Error fetching event", id, err);
    return { id, status: "Fetch error" };
  }
}



  async function checkEvents() {
    const results = await Promise.all(eventIds.map(fetchEvent));
    const mapped = results.reduce((acc, r) => {
      if (r) acc[r.id] = r;
      return acc;
    }, {});
    setEvents(mapped);
    setLastUpdated(new Date());
    setNextRefresh(refreshInterval);
  }

  // Auto refresh logic
  useEffect(() => {
    if (isPaused) return;
    checkEvents();
    const interval = setInterval(checkEvents, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [refreshInterval, isPaused]);

  // Countdown for next refresh
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setNextRefresh((t) => (t > 0 ? t - 1 : refreshInterval));
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshInterval, isPaused]);

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 28, fontWeight: "bold", textAlign: "center", color: "#4f46e5" }}>
        🎟 Hero Asia Cup Ticket Monitor
      </h1>
      <p style={{ textAlign: "center", color: "#555" }}>
        Monitoring events: {eventIds.join(", ")}
      </p>

      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10, margin: "20px 0" }}>
        <button onClick={() => setIsPaused(!isPaused)} style={{ padding: "6px 12px" }}>
          {isPaused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button onClick={checkEvents} style={{ padding: "6px 12px" }}>🔄 Check Now</button>
        <button
          onClick={() => {
            playSound();
            notifyBrowser("Test Alert", "This is a test notification sound 🔔");
          }}
          style={{ padding: "6px 12px", background: "#facc15" }}
        >
          🔔 Test Notification
        </button>
        <label>
          Refresh:{" "}
          <input
            type="number"
            min="5"
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            style={{ width: 60 }}
          />{" "}
          sec
        </label>
        <button onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
          {viewMode === "grid" ? "📋 List View" : "🔲 Grid View"}
        </button>
      </div>

      <p style={{ textAlign: "center", color: "#666", fontSize: 14 }}>
        Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"} | Next refresh in {nextRefresh}s
      </p>

      {/* Events */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: viewMode === "grid" ? "repeat(auto-fill, minmax(280px, 1fr))" : "1fr",
          gap: 16,
          marginTop: 20,
        }}
      >
        {Object.values(events).map((event) => (
          <div
            key={event.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              background: "#fff",
              overflow: "hidden",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              animation: event.highlight ? "flash 2s" : "none",
            }}
          >
            {event.banner && (
              <img src={event.banner} alt={event.name} style={{ width: "100%", height: 100, objectFit: "cover" }} />
            )}
            <div style={{ padding: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{event.name}</h2>

              {/* Status Badge */}
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: "bold",
                  color:
                    event.status === "BOOK NOW"
                      ? "#065f46"
                      : event.status === "SOLD OUT"
                      ? "#991b1b"
                      : "#374151",
                  background:
                    event.status === "BOOK NOW"
                      ? "#bbf7d0"
                      : event.status === "SOLD OUT"
                      ? "#fecaca"
                      : "#e5e7eb",
                }}
              >
                {event.status}
              </span>

              {/* Time */}
            <p style={{ fontSize: 13, color: "#555", marginTop: 8 }}>
  ⏰ {event.time || "Time not available"}
</p>

              {/* Venue + Address */}
              <p style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
                📍 {event.venue || "Venue not available"}
                {event.address ? `, ${event.address}` : ""}
              </p>

              {/* History */}
              {history.current[event.id] && history.current[event.id].length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 13, cursor: "pointer", color: "#2563eb" }}>
                    View History
                  </summary>
                  <ul style={{ fontSize: 12, color: "#444", marginTop: 4, paddingLeft: 16 }}>
                    {history.current[event.id].map((h, i) => (
                      <li key={i}>
                        [{h.time}] → {h.status}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Flash animation */}
      <style>
        {`
          @keyframes flash {
            from { background-color: #fef9c3; }
            to { background-color: white; }
          }
        `}
      </style>
    </div>
  );
}
