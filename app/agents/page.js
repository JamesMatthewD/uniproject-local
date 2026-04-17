"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const EXAMPLE_CODE = `/** 
 * Each function receives gameInfo with:
 * - myCards: [card1, card2] (e.g., ["A-H", "K-D"])
 * - Cards are formatted as "Rank-Suit"
 * - myChips: number (remaining chips)
 * - boardCards: [card1, card2, ...] (0-5 cards depending on street)
 * - potSize: number
 * - currentBet: number (amount needed to call)
 * - street: string ("pre-flop", "flop", "turn", "river")
 * - myPosition: number (0 = small blind, 1 = big blind)
 * - opponentChips: number (opponent's remaining chips)
 */

export const exampleOpponent = {
  /**
   * Determine whether to call the current bet
   * @param {Object} gameInfo - Game state information
   * @returns {boolean} - true to call, false to not call
   */
  call: (gameInfo) => {
    // Example: Call if the current bet is small relative to pot
    const betToCallRatio = gameInfo.currentBet / (gameInfo.potSize + gameInfo.currentBet);
    
    // Your custom logic here
    return false;
  },

  /**
   * Determine whether to fold
   * @param {Object} gameInfo - Game state information
   * @returns {boolean} - true to fold, false to not fold
   */
  fold: (gameInfo) => {
    // Example: Fold if staring at a large bet
    const isFacingLargeBet = gameInfo.currentBet > gameInfo.myChips * 0.3;
    
    // Your custom logic here
    return false;
  },

  /**
   * Determine whether to raise and by how much
   * @param {Object} gameInfo - Game state information
   * @returns {Object} - { shouldRaise: boolean, amount: number }
   *                     amount is ignored if shouldRaise is false
   */
  raise: (gameInfo) => {
    // Example: Raise 20% of pot if we have good cards
    const potPercent = Math.round((gameInfo.potSize * 0.2) / gameInfo.potSize * 100);
    
    // Your custom logic here
    return {
      shouldRaise: false,
      amount: 0
    };
  }
};
`;

export default function AgentsPage() {
  const [agentCode, setAgentCode] = useState("");
  const [agentName, setAgentName] = useState("");
  const [validationError, setValidationError] = useState("");
  const [uploadedAgents, setUploadedAgents] = useState([]);
  const [previewAgent, setPreviewAgent] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  // Load agents from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("uploadedAgents");
    if (saved) {
      try {
        setUploadedAgents(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to load saved agents:", err);
      }
    }
  }, []);

  // Save agents to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("uploadedAgents", JSON.stringify(uploadedAgents));
  }, [uploadedAgents]);

  const downloadExample = () => {
    const element = document.createElement("a");
    const file = new Blob([EXAMPLE_CODE], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "example.js";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const validateAgent = (code) => {
    try {
      // Check if code contains exampleOpponent export
      if (!code.includes("exampleOpponent")) {
        return { valid: false, error: "Agent must export 'exampleOpponent' object" };
      }

      // Check for required functions
      if (!code.includes(".call") || !code.includes(".fold") || !code.includes(".raise")) {
        return { valid: false, error: "Agent must have call(), fold(), and raise() functions" };
      }

      // Try to evaluate the code in a safe way
      const testCode = `
        const validAgent = (function() {
          ${code}
          return exampleOpponent;
        })();
        
        const gameInfo = {
          myCards: ["A-H", "K-D"],
          myChips: 100,
          boardCards: [],
          potSize: 50,
          currentBet: 10,
          street: "pre-flop",
          myPosition: 0,
          opponentChips: 100
        };
        
        // Test that functions exist and return correct types
        const callResult = validAgent.call(gameInfo);
        const foldResult = validAgent.fold(gameInfo);
        const raiseResult = validAgent.raise(gameInfo);
        
        if (typeof callResult !== "boolean") throw new Error("call() must return boolean");
        if (typeof foldResult !== "boolean") throw new Error("fold() must return boolean");
        if (typeof raiseResult !== "object" || typeof raiseResult.shouldRaise !== "boolean") {
          throw new Error("raise() must return { shouldRaise: boolean, amount: number }");
        }
      `;

      new Function(testCode)();
      return { valid: true, error: null };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  };

  const handleUpload = async () => {
    if (!agentName.trim()) {
      setValidationError("Please enter an agent name");
      return;
    }

    if (!agentCode.trim()) {
      setValidationError("Please paste agent code");
      return;
    }

    const validation = validateAgent(agentCode);
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }

    setUploading(true);
    setValidationError("");
    setSuccessMessage("");

    try {
      // Save to D1 database
      const response = await fetch("/api/agents/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: agentName,
          code: agentCode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setValidationError(data.error || "Failed to save agent");
        setUploading(false);
        return;
      }

      // Create agent object with D1 ID
      const newAgent = {
        id: data.agentId,
        d1Id: data.agentId,
        name: agentName,
        code: agentCode,
        uploadedAt: new Date().toLocaleString()
      };

      setUploadedAgents([...uploadedAgents, newAgent]);
      setPreviewAgent(newAgent);
      setSuccessMessage(data.agentId);
      setAgentCode("");
      setAgentName("");
      setUploading(false);
    } catch (err) {
      setValidationError("Network error: " + err.message);
      setUploading(false);
    }
  };

  const copyAgentId = (agentId) => {
    navigator.clipboard.writeText(agentId);
    setCopiedId(agentId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadAgent = (agent) => {
    const element = document.createElement("a");
    const file = new Blob([agent.code], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${agent.name}.js`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const deleteAgent = (agentId) => {
    setUploadedAgents(uploadedAgents.filter(a => a.id !== agentId));
    if (previewAgent?.id === agentId) {
      setPreviewAgent(null);
    }
  };

  return (
    <main className="agents-page">
      <Link href="/" className="back-link">
        ← Back to Home
      </Link>

      <h1>Upload Custom AI Agents</h1>
      <p>Create and upload your own AI opponent logic to use in games.</p>

      <div className="agents-container">
        {/* Download Example Section */}
        <section className="card">
          <h2>Get Started</h2>
          <p>Download the example.js template to see the structure and create your own AI.</p>
          <button onClick={downloadExample} className="primary-button download-button">
            ⬇ Download example.js
          </button>
        </section>

        {/* Upload Form */}
        <section className="card">
          <h2>Upload Agent</h2>
          
          <div className="form-group">
            <label htmlFor="agent-name">Agent Name:</label>
            <input
              id="agent-name"
              type="text"
              placeholder="e.g., AggressiveBot"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="agent-code">Agent Code:</label>
            <textarea
              id="agent-code"
              placeholder="Paste your exampleOpponent code here..."
              value={agentCode}
              onChange={(e) => {
                setAgentCode(e.target.value);
                setValidationError("");
              }}
              className="form-textarea"
              rows="12"
            />
          </div>

          {validationError && (
            <div className="error-message">
              ❌ {validationError}
            </div>
          )}

          {successMessage && (
            <div className="success-message">
              <div className="success-content">
                <p>✅ Agent uploaded successfully!</p>
                <p className="agent-id-label">Your Agent ID (use this in other sessions):</p>
                <div className="agent-id-box">
                  <code>{successMessage}</code>
                  <button
                    onClick={() => copyAgentId(successMessage)}
                    className="copy-button"
                    title="Copy to clipboard"
                  >
                    {copiedId === successMessage ? "✓ Copied!" : "📋 Copy"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <button onClick={handleUpload} className="primary-button" disabled={uploading}>
            {uploading ? "Uploading..." : "Validate & Upload Agent"}
          </button>
        </section>
      </div>

      {/* Uploaded Agents List */}
      {uploadedAgents.length > 0 && (
        <section className="agents-list">
          <h2>Your Uploaded Agents</h2>
          <div className="agents-grid">
            {uploadedAgents.map((agent) => (
              <div key={agent.id} className="agent-card">
                <h3>{agent.name}</h3>
                <p className="upload-time">Uploaded: {agent.uploadedAt}</p>
                <div className="agent-id-display">
                  <p className="id-label">ID:</p>
                  <code>{agent.id}</code>
                  <button
                    onClick={() => copyAgentId(agent.id)}
                    className="copy-button-small"
                    title="Copy ID to clipboard"
                  >
                    {copiedId === agent.id ? "✓" : "📋"}
                  </button>
                </div>
                <div className="agent-actions">
                  <button
                    onClick={() => setPreviewAgent(agent)}
                    className="action-button preview"
                  >
                    👁 Preview
                  </button>
                  <button
                    onClick={() => downloadAgent(agent)}
                    className="action-button download"
                  >
                    ⬇ Download
                  </button>
                  <button
                    onClick={() => deleteAgent(agent.id)}
                    className="action-button delete"
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Preview Section */}
      {previewAgent && (
        <section className="preview-section">
          <div className="preview-header">
            <h2>Preview: {previewAgent.name}</h2>
            <button
              onClick={() => setPreviewAgent(null)}
              className="close-button"
            >
              ✕
            </button>
          </div>
          <pre className="code-preview">
            <code>{previewAgent.code}</code>
          </pre>
        </section>
      )}

      <style jsx>{`
        .agents-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          background: #0f172a;
          color: #e5e7eb;
          min-height: 100vh;
        }

        .back-link {
          color: #60a5fa;
          text-decoration: none;
          display: inline-block;
          margin-bottom: 1rem;
        }

        .back-link:hover {
          color: #93c5fd;
        }

        h1 {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
        }

        h2 {
          font-size: 1.5rem;
          margin-top: 0;
        }

        .agents-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin: 2rem 0;
        }

        .card {
          background: #1e293b;
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid #334155;
        }

        .card p {
          margin-bottom: 1rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: bold;
          font-size: 0.9rem;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          padding: 0.75rem;
          background: #111827;
          border: 1px solid #334155;
          border-radius: 4px;
          color: #e5e7eb;
          font-family: monospace;
          font-size: 0.9rem;
        }

        .form-textarea {
          resize: vertical;
          font-family: "Courier New", monospace;
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .error-message {
          background: #7f1d1d;
          color: #fecaca;
          padding: 0.75rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          border: 1px solid #dc2626;
        }

        .success-message {
          background: #064e3b;
          color: #a7f3d0;
          padding: 1rem;
          border-radius: 4px;
          margin-bottom: 1rem;
          border: 1px solid #10b981;
        }

        .success-content {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .success-content p {
          margin: 0;
        }

        .agent-id-label {
          font-size: 0.9rem;
          font-weight: bold;
          color: #6ee7b7;
        }

        .agent-id-box {
          background: #0f172a;
          padding: 0.75rem;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid #059669;
        }

        .agent-id-box code {
          font-family: monospace;
          flex: 1;
          word-break: break-all;
          color: #fbbf24;
        }

        .copy-button {
          background: #10b981;
          color: white;
          border: none;
          padding: 0.5rem 0.75rem;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.85rem;
          white-space: nowrap;
          transition: background-color 0.15s ease;
        }

        .copy-button:hover {
          background: #059669;
        }

        .agent-id-display {
          background: #111827;
          padding: 0.5rem;
          border-radius: 4px;
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid #334155;
        }

        .agent-id-display .id-label {
          font-size: 0.8rem;
          font-weight: bold;
          color: #9ca3af;
          margin: 0;
        }

        .agent-id-display code {
          font-family: monospace;
          font-size: 0.8rem;
          color: #fbbf24;
          flex: 1;
          word-break: break-all;
        }

        .copy-button-small {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 0.25rem 0.5rem;
          border-radius: 3px;
          cursor: pointer;
          font-size: 0.75rem;
          transition: background-color 0.15s ease;
        }

        .copy-button-small:hover {
          background: #2563eb;
        }

        .primary-button {
          width: 100%;
          padding: 0.75rem 1rem;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          color: white;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .primary-button:hover {
          background: #2563eb;
        }

        .primary-button:disabled {
          background: #6b7280;
          cursor: not-allowed;
        }

        .download-button {
          background: #10b981;
          font-size: 1rem;
        }

        .download-button:hover {
          background: #059669;
        }

        .agents-list {
          margin-top: 3rem;
        }

        .agents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .agent-card {
          background: #1e293b;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid #334155;
        }

        .agent-card h3 {
          margin: 0 0 0.5rem 0;
          color: #60a5fa;
        }

        .upload-time {
          font-size: 0.8rem;
          color: #9ca3af;
          margin: 0.25rem 0 1rem 0;
        }

        .agent-actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.5rem;
        }

        .action-button {
          padding: 0.5rem;
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          font-size: 0.9rem;
          transition: opacity 0.15s ease;
        }

        .action-button:hover {
          opacity: 0.8;
        }

        .preview {
          background: #3b82f6;
        }

        .download {
          background: #10b981;
        }

        .delete {
          background: #ef4444;
        }

        .preview-section {
          background: #1e293b;
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid #334155;
          margin-top: 2rem;
        }

        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .preview-header h2 {
          margin: 0;
        }

        .close-button {
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 4px;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s ease;
        }

        .close-button:hover {
          background: #dc2626;
        }

        .code-preview {
          background: #111827;
          padding: 1rem;
          border-radius: 4px;
          overflow-x: auto;
          border: 1px solid #334155;
          margin: 0;
        }

        .code-preview code {
          font-family: "Courier New", monospace;
          font-size: 0.85rem;
          color: #d1d5db;
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .agents-container {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 1.8rem;
          }

          .agents-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
