import { useState } from "react";

async function fetchJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0,200)}`);
  return res.json();
}

export default function AiAssistant() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestText, setSuggestText] = useState("");

  async function getSummary() {
    setLoading(true); setError(""); setSummary("");
    try {
      const data = await fetchJSON("/api/ai/summary");
      setSummary(data.summary);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function suggest() {
    // Minimal demo: ask a suggestion for a fake visitor the UI is currently viewing.
    const visitor = {
      reasonForVisit: "Meeting with HOD about schedule",
      label: "MEETING",
      email: "guest@example.com",
    };
    setSuggestLoading(true); setError(""); setSuggestText("");
    try {
      const data = await fetchJSON("/api/ai/suggest-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor })
      });
      const s = data?.suggestion;
      setSuggestText(`Decision: ${s.decision} (confidence ${Math.round((s.confidence||0)*100)}%). Reason: ${s.reason}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSuggestLoading(false);
    }
  }

  return (
    <div style={{display:"grid", gap:16}}>
      <div style={{display:"flex", gap:12, alignItems:"center"}}>
        <button onClick={getSummary} disabled={loading}>
          {loading ? "Summarizing..." : "Summarize Today's Activity"}
        </button>
        <button onClick={suggest} disabled={suggestLoading}>
          {suggestLoading ? "Analyzing..." : "AI Suggest Approval (demo)"}
        </button>
      </div>

      {summary && (
        <div className="card" style={{padding:12, background:"#fff8", borderRadius:12}}>
          <strong>AI Summary</strong>
          <p style={{marginTop:8, whiteSpace:"pre-wrap"}}>{summary}</p>
        </div>
      )}

      {suggestText && (
        <div className="card" style={{padding:12, background:"#fff8", borderRadius:12}}>
          <strong>AI Decision</strong>
          <p style={{marginTop:8}}>{suggestText}</p>
        </div>
      )}

      {error && <p style={{color:"crimson"}}>{error}</p>}
    </div>
  );
}
