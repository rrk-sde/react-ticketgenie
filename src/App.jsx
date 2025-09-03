import { useEffect, useState } from "react";

const eventIds = [232, 233, 234];
const API_BASE = "/api";
const TG_BOT_TOKEN = "8337634191:AAE1kltvBz64c7rI-qB8u3DtoDt1jOcqdAA";
const TG_CHAT_ID = "314307608";

async function sendToTelegram(message, image) {
  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text: message,
      parse_mode: "Markdown",
    }),
  });

  if (image) {
    const photoUrl = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendPhoto`;
    await fetch(photoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        photo: image,
        caption: message,
      }),
    });
  }
}

export default function App() {
  const [events, setEvents] = useState({});
  const prevStatus = useState({})[0];

  useEffect(() => {
    const checkEvents = async () => {
      for (let id of eventIds) {
        try {
          const res = await fetch(`${API_BASE}/Event/id/${id}`);
          if (!res.ok) {
            setEvents((prev) => ({ ...prev, [id]: `Error (${res.status})` }));
            continue;
          }

          let data = null;
          try {
            data = await res.json();
          } catch {
            setEvents((prev) => ({ ...prev, [id]: "Invalid response" }));
            continue;
          }

          const btn = data?.result?.button_text || "N/A";
          setEvents((prev) => ({ ...prev, [id]: btn }));

          if (
            btn !== "COMING SOON" &&
            btn !== "SOLD OUT" &&
            btn !== prevStatus[id]
          ) {
            const msg = `⚡ *Ticket Alert*: Event ${id}\nStatus: *${btn}*`;
            await sendToTelegram(msg, data?.result?.banner_url);
          }

          prevStatus[id] = btn;
        } catch (err) {
          console.error("Error fetching event", id, err);
          setEvents((prev) => ({ ...prev, [id]: "Fetch error" }));
        }
      }
    };

    checkEvents();
    const interval = setInterval(checkEvents, 10 * 1000);
    return () => clearInterval(interval);
  }, [prevStatus]);

  return (
    <div className="p-6 font-sans">
      <h1 className="text-2xl font-bold mb-4">
        🎟 Hero Asia Cup Ticket Monitor
      </h1>
      <p>Monitoring events: {eventIds.join(", ")}</p>
      <ul className="mt-4 space-y-2">
        {Object.entries(events).map(([id, status]) => (
          <li key={id} className="border p-2 rounded">
            <strong>Event {id}:</strong> {status}
          </li>
        ))}
      </ul>
    </div>
  );
}
