"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState } from "react";

const SUGGESTED_QUERIES = [
  "Discover FHIR server capabilities",
  "Show me all patients across both FHIR servers",
  "Which patients have diabetes but no recent A1c test?",
  "Review medications and allergies for patient cs-001",
  "Find all high-risk patients who need attention",
  "What medications is patient mt-004 on? Any interaction concerns?",
];

export default function HealthcareAgentDemo() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const [serverStatus, setServerStatus] = useState<Record<string, { status: string }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setServerStatus(data))
      .catch(() => setServerStatus({ carestack: { status: "error" }, meditab: { status: "error" } }));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  }

  function handleSuggestion(query: string) {
    setInput(query);
    inputRef.current?.focus();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0f1a",
        color: "#e2e8f0",
        fontFamily: "'Courier New', Courier, monospace",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid #1e293b",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          background: "#0d1321",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #00A1DF, #0070c9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            fontWeight: "bold",
            color: "#fff",
          }}
        >
          M
        </div>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
              color: "#f1f5f9",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            Clinical Intelligence Agent
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "#64748b",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            Powered by MuleSoft + SMART on FHIR R4 &bull; Flagship Hospital + Community Clinic
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <StatusBadge label="Flagship Hospital" serverStatus={serverStatus.carestack?.status} />
          <StatusBadge label="Community Clinic" serverStatus={serverStatus.meditab?.status} />
        </div>
      </header>

      {/* Messages */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px",
          maxWidth: "900px",
          width: "100%",
          margin: "0 auto",
        }}
      >
        {messages.length === 0 && (
          <EmptyState onSuggestion={handleSuggestion} />
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role} parts={msg.parts} />
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div style={{ padding: "16px 0", color: "#64748b", fontSize: "14px" }}>
            Querying EHR systems via MuleSoft...
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer
        style={{
          borderTop: "1px solid #1e293b",
          padding: "16px 24px",
          background: "#0d1321",
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            display: "flex",
            gap: "12px",
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about patients, care gaps, lab results..."
            rows={1}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "12px",
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#e2e8f0",
              fontSize: "14px",
              fontFamily: "system-ui, -apple-system, sans-serif",
              resize: "none",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              border: "none",
              background:
                isLoading || !input.trim()
                  ? "#334155"
                  : "linear-gradient(135deg, #00A1DF, #0070c9)",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {isLoading ? "Thinking..." : "Send"}
          </button>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function StatusBadge({ label, serverStatus }: { label: string; serverStatus?: string }) {
  const colorMap: Record<string, { bg: string; color: string; border: string; text: string }> = {
    connected: { bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e", border: "rgba(34, 197, 94, 0.3)", text: "FHIR R4" },
    mock: { bg: "rgba(234, 179, 8, 0.15)", color: "#eab308", border: "rgba(234, 179, 8, 0.3)", text: "Mock" },
    unreachable: { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "rgba(239, 68, 68, 0.3)", text: "Offline" },
    error: { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444", border: "rgba(239, 68, 68, 0.3)", text: "Error" },
  };
  const s = colorMap[serverStatus || ""] || { bg: "rgba(100, 116, 139, 0.15)", color: "#64748b", border: "rgba(100, 116, 139, 0.3)", text: "..." };

  return (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {label} {s.text}
    </span>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (q: string) => void }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "20px",
          background: "linear-gradient(135deg, #00A1DF22, #0070c922)",
          border: "1px solid #00A1DF44",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
          fontSize: "36px",
        }}
      >
        +
      </div>
      <h2
        style={{
          margin: "0 0 8px",
          fontSize: "22px",
          color: "#f1f5f9",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        Unified Clinical Intelligence
      </h2>
      <p
        style={{
          margin: "0 0 32px",
          color: "#64748b",
          fontSize: "14px",
          maxWidth: "500px",
          marginLeft: "auto",
          marginRight: "auto",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        Query real FHIR R4 patient data across Flagship Hospital and Community Clinic via SMART on FHIR.
        MuleSoft discovers, authenticates, and federates data from both EHR systems — the same
        pattern works with any FHIR R4-compliant EHR (Epic, Cerner, MEDITECH, and more).
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          justifyContent: "center",
        }}
      >
        {SUGGESTED_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => onSuggestion(q)}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#94a3b8",
              fontSize: "13px",
              cursor: "pointer",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── v6 parts-based message rendering ──────────────────────────────

interface ToolPart {
  type: string;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
}

function MessageBubble({
  role,
  parts,
}: {
  role: string;
  parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
}) {
  const isUser = role === "user";

  return (
    <div
      style={{
        marginBottom: "16px",
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: isUser ? "#64748b" : "#00A1DF",
          marginBottom: "4px",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {isUser ? "You" : "Clinical Agent"}
      </span>

      {parts?.map((part, i) => {
        // Text parts
        if (part.type === "text" && part.text?.trim()) {
          return (
            <div
              key={i}
              style={{
                padding: "12px 16px",
                borderRadius: "12px",
                background: isUser ? "#1e40af" : "#1e293b",
                border: isUser ? "none" : "1px solid #334155",
                maxWidth: "85%",
                fontSize: "14px",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}
            >
              {part.text}
            </div>
          );
        }

        // Tool parts — v6 uses "tool-<toolName>" pattern
        if (part.type.startsWith("tool-")) {
          const toolPart = part as unknown as ToolPart;
          const toolName = part.type.replace("tool-", "");
          return (
            <ToolCallIndicator
              key={i}
              toolName={toolName}
              state={toolPart.state}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

function ToolCallIndicator({ toolName, state }: { toolName: string; state: string }) {
  const toolLabels: Record<string, string> = {
    listAllPatients: "Querying FHIR patient registry",
    getPatientConditions: "Fetching FHIR conditions",
    searchConditions: "Searching conditions across EHRs",
    getPatientLabs: "Retrieving FHIR lab results",
    searchLabResults: "Searching FHIR lab data",
    getPatientMedications: "Fetching FHIR medication requests",
    getPatientAllergies: "Checking FHIR allergy records",
    identifyCareGaps: "Analyzing care gaps across EHRs",
    discoverFhirServer: "Discovering FHIR server capabilities",
  };

  const isComplete = state === "output-available";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderRadius: "8px",
        background: isComplete ? "rgba(34, 197, 94, 0.1)" : "rgba(0, 161, 223, 0.1)",
        border: `1px solid ${isComplete ? "rgba(34, 197, 94, 0.3)" : "rgba(0, 161, 223, 0.3)"}`,
        fontSize: "12px",
        color: isComplete ? "#22c55e" : "#00A1DF",
        marginRight: "8px",
        marginBottom: "4px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <span>{isComplete ? "OK" : "..."}</span>
      <span style={{ fontWeight: 500 }}>
        MuleSoft API: {toolLabels[toolName] || toolName}
      </span>
    </div>
  );
}
