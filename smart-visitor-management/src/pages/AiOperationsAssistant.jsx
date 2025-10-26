import AiAssistant from "../components/AiAssistant";

export default function AiOperationsAssistant() {
  return (
    <div style={{padding:24}}>
      <h1 style={{marginBottom:12}}>AI Operations Assistant</h1>
      <p style={{marginTop:0, opacity:0.8}}>
        Get a concise summary of today's visitors and AI suggestions for approvals.
      </p>
      <AiAssistant />
    </div>
  );
}
