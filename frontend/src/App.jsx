import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastIntent, setLastIntent] = useState(""); // only store platform intent like "youtube"|"google"|"wikipedia"
  const chatEndRef = useRef(null);

  const addMessage = (msg) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), time: new Date(), ...msg },
    ]);
  };

  const scrollToBottom = () =>
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const callAPI = async (text) => {
    return axios.post(
      "http://127.0.0.1:8000/api/chat/",
      { message: text },
      { timeout: 15000 }
    );
  };

  /**
   * sendMessage now accepts optional overrides so we don't rely on immediate state updates.
   * textOverride: string (suggestion label or custom)
   * opts: { intentOverride: "google"|"youtube"|"wikipedia", queryOverride: "sach", persistIntent: boolean }
   */
  const sendMessage = async (textOverride, opts = {}) => {
    const { intentOverride, queryOverride, persistIntent = false } = opts;

    // start from what user/suggestion provided
    let content = (textOverride ?? input).trim();

    // effectiveIntent prefers explicit override, then saved lastIntent
    const effectiveIntent = intentOverride ?? lastIntent;

    // If content does NOT already start with "search" and we have an effectiveIntent,
    // build a normalized search query using the explicit queryOverride if provided,
    // otherwise use the user's typed content as the query part.
    if (!/^search\b/i.test(content) && effectiveIntent) {
      const queryPart = queryOverride
        ? queryOverride.trim()
        : content.length
        ? content
        : "";

      content = queryPart ? `search on ${effectiveIntent} ${queryPart}` : `search on ${effectiveIntent}`;
      // we DO NOT clear lastIntent here — keep persistence unless user explicitly types a search
      // but if caller asked to persist intent, update the state:
      if (persistIntent && effectiveIntent) {
        setLastIntent(effectiveIntent);
      }
    }

    // If user explicitly typed "search ..." (fresh context), clear saved intent
    if (/^search\b/i.test(content)) {
      setLastIntent("");
    }

    if (!content || loading) return;

    addMessage({ sender: "user", text: content });
    setLoading(true);
    setInput("");

    try {
      const res = await callAPI(content);
      const data = res?.data || {};
      addMessage({
        sender: "bot",
        text:
          typeof data.response === "string"
            ? data.response
            : "I couldn't parse the server response.",
        url: typeof data.url === "string" ? data.url : undefined,
        lang: data.lang,
        intent: data.intent,
        confidence: data.confidence,
        suggestions: Array.isArray(data.suggestions)
          ? data.suggestions
          : [],
      });
    } catch (e) {
      addMessage({
        sender: "bot",
        text: "Network/CORS error: Could not connect to server.",
      });
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={styles.pg}>
      <div style={styles.card}>
        <header style={styles.header}>
          <div style={styles.ttlRow}>
            <div style={styles.brandCircle}>✨</div>
            <h1 style={styles.headertxt}>Sarvagya's AI Chatbot</h1>
          </div>
          <p style={styles.subheader}>English :: हिन्दी :: Hinglish</p>
        </header>

        <div style={styles.chatBox}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                ...styles.row,
                justifyContent:
                  m.sender === "user" ? "flex-end" : "flex-start",
                animation: "fade 0.4s ease",
              }}
            >
              {m.sender !== "user" && <div style={styles.botavatar}>🤖</div>}
              <div
                style={{
                  ...(m.sender === "user" ? styles.userBubble : styles.bubbleBot),
                }}
              >
                <div style={styles.text}>{m.text}</div>

                {m.url && (
                  <div style={{ marginTop: 6 }}>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.link}
                    >
                      🔗 Open Link
                    </a>
                  </div>
                )}

                {m.intent && (
                  <div style={styles.meta}>
                    {m.intent} • {m.lang || "lang"} • {(m.confidence ?? 0).toFixed(2)}
                  </div>
                )}

                {Array.isArray(m.suggestions) && m.suggestions.length > 0 && (
                  <div style={styles.suggestions}>
                    {m.suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        style={styles.chip}
                        onClick={() => {
                          // extract the query part from the bot text if it's in quotes like 'sach'
                          const match = m.text && m.text.match(/'(.*?)'/);
                          const extractedQuery = match ? match[1] : "";

                          // determine platform intent from the suggestion label (do NOT set state here)
                          let detectedIntent = "";
                          if (/google/i.test(s)) detectedIntent = "google";
                          else if (/wikipedia/i.test(s)) detectedIntent = "wikipedia";
                          else if (/youtube/i.test(s)) detectedIntent = "youtube";

                          // Call sendMessage with explicit overrides — avoids stale state issues
                          // persistIntent=true keeps this platform for subsequent typed queries
                          sendMessage(s, {
                            intentOverride: detectedIntent || undefined,
                            queryOverride: extractedQuery || undefined,
                            persistIntent: !!detectedIntent,
                          });
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {m.sender === "user" && <div style={styles.userAvatar}>🧑</div>}
            </div>
          ))}

          {loading && (
            <div style={{ ...styles.row, justifyContent: "flex-start" }}>
              <div style={styles.botavatar}>🤖</div>
              <div style={styles.bubbletyping}>
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div style={styles.inputBar}>
          <input
            type="text"
            placeholder="Type your message here…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            style={styles.input}
          />
          <button onClick={() => sendMessage()} disabled={loading} style={styles.sendbutton}>
            {loading ? "⏳" : "SEND"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  pg: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #fbed86ff, #fc943fff, #f12b09ff)",
    animation: "bckground 5s ease infinite",
    backgroundSize: "400% 400%",
    padding: 20,
  },
  card: {
    width: "min(780px, 95vw)",
    background: "rgba(255, 255, 255, 0.4)",
    backdropFilter: "blur(30px)",
    borderRadius: 22,
    boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    background: "linear-gradient(135deg, #6a11cb, #2575fc)",
    padding: "20px",
    color: "white",
    textAlign: "center",
  },
  ttlRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  brandCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: "#ffffff33",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 18,
  },
  headertxt: { margin: 0, fontSize: 22 },
  subheader: { margin: "6px 0 0 0", opacity: 0.9, fontSize: 13 },
  chatBox: {
    height: 480,
    overflowY: "auto",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: "linear-gradient(180deg, #f9fcff, #eaf4ff)",
  },
  row: { display: "flex", gap: 8, alignItems: "flex-end" },
  botavatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: "#fcaa25ff",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: "#09a6fbff",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
  },
  bubbleBot: {
    background: "white",
    color: "#222",
    padding: "12px 14px",
    borderRadius: "14px 14px 14px 4px",
    maxWidth: "75%",
    boxShadow: "0 3px 6px rgba(0,0,0,0.1)",
    transition: "transform 0.2s",
    animation: "poppingIn 0.3s ease",
  },
  userBubble: {
    background: "#d8f0ff",
    color: "#111",
    padding: "12px 14px",
    borderRadius: "14px 14px 4px 14px",
    maxWidth: "75%",
    boxShadow: "0 3px 6px rgba(0,0,0,0.1)",
    transition: "transform 0.2s",
    animation: "poppingIn 0.3s ease",
  },
  text: { whiteSpace: "pre-wrap", wordBreak: "break-word" },
  link: { color: "#0b66ef", textDecoration: "none", fontWeight: 600 },
  meta: { marginTop: 6, fontSize: 11, color: "#666" },
  suggestions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 },
  chip: {
    background: "#11f7f762",
    border: "1px solid #d6e1ff",
    padding: "6px 12px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
    color: "#f80404ff",
    transition: "all 0.3s",
  },
  bubbletyping: {
    background: "white",
    padding: "10px 14px",
    borderRadius: 5,
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    display: "flex",
    gap: 4,
  },
  inputBar: {
    display: "flex",
    gap: 8,
    padding: 12,
    background: "#fff",
    borderTop: "1px solid #eef2f7",
  },
  input: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #d7dcea",
    outline: "none",
    fontSize: 15,
    transition: "0.3s",
  },
  sendbutton: {
    background: "linear-gradient(135deg, #6a11cb, #2575fc)",
    color: "#fff",
    border: "none",
    padding: "10px 16px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600,
    transition: "all 0.3s ease",
  },
};

export default App;
