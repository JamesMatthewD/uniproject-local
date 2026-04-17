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
 * - The first line must be the same to validate
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
};`;

export default function AgentsPage() {
  const [agentCode, setAgentCode] = useState("");
  const [agentName, setAgentName] = useState("");
  const [validationError, setValidationError] = useState("");
  const [uploadedAgents, setUploadedAgents] = useState([]);
  const [previewAgent, setPreviewAgent] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  
  // Test results state
  const [testingAgent, setTestingAgent] = useState(null);
  const [testingOpponent, setTestingOpponent] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState("");
  
  // Multi-way testing state
  const [multiWayTestingAgent, setMultiWayTestingAgent] = useState(null);
  const [multiWayResults, setMultiWayResults] = useState({});
  const [isMultiWayTesting, setIsMultiWayTesting] = useState(false);
  const [multiWayTestError, setMultiWayTestError] = useState("");
  const [testMode, setTestMode] = useState("1v1"); // "1v1" or "multi-way"

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
    
    // Load test results
    const savedResults = localStorage.getItem("agentTestResults");
    if (savedResults) {
      try {
        setTestResults(JSON.parse(savedResults));
      } catch (err) {
        console.error("Failed to load test results:", err);
      }
    }
  }, []);

  // Save agents to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("uploadedAgents", JSON.stringify(uploadedAgents));
  }, [uploadedAgents]);
  
  // Save test results whenever they change
  useEffect(() => {
    localStorage.setItem("agentTestResults", JSON.stringify(testResults));
  }, [testResults]);

  // Save multi-way results whenever they change
  useEffect(() => {
    localStorage.setItem("agentMultiWayResults", JSON.stringify(multiWayResults));
  }, [multiWayResults]);

  // Load multi-way results on mount
  useEffect(() => {
    const saved = localStorage.getItem("agentMultiWayResults");
    if (saved) {
      try {
        setMultiWayResults(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to load multi-way results:", err);
      }
    }
  }, []);

  // Auto-start test when opponent is selected
  useEffect(() => {
    if (testingAgent && testingOpponent && !isTesting) {
      testAgentWinRate(testingAgent, testingOpponent);
    }
  }, [testingOpponent]);

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
      // Trim the code
      let trimmedCode = code.trim();

      // Check if code is empty
      if (!trimmedCode) {
        return { valid: false, error: "Agent code cannot be empty" };
      }

      // Check if code contains exampleOpponent
      if (!trimmedCode.includes("exampleOpponent")) {
        return { valid: false, error: "Agent must export 'exampleOpponent' object. Example: export const exampleOpponent = { ... }" };
      }

      // Check for required functions with more robust pattern
      const hasCall = /call\s*:\s*\(|\.call\s*=|call\s*\(/m.test(trimmedCode);
      const hasFold = /fold\s*:\s*\(|\.fold\s*=|fold\s*\(/m.test(trimmedCode);
      const hasRaise = /raise\s*:\s*\(|\.raise\s*=|raise\s*\(/m.test(trimmedCode);

      if (!hasCall) {
        return { valid: false, error: "Agent must have a call() method that returns a boolean" };
      }
      if (!hasFold) {
        return { valid: false, error: "Agent must have a fold() method that returns a boolean" };
      }
      if (!hasRaise) {
        return { valid: false, error: "Agent must have a raise() method that returns { shouldRaise: boolean, amount: number }" };
      }

      // Remove export keyword to make it compatible with new Function()
      const codeWithoutExport = trimmedCode
        .replace(/^\s*export\s+default\s+/m, "")
        .replace(/^\s*export\s+(const|let|var|function)\s+/m, "$1 ");

      // Try to evaluate the code in a safe sandbox
      try {
        // First, try to extract and execute the code
        let agent;
        try {
          const extractCode = `
            ${codeWithoutExport}
            return exampleOpponent;
          `;
          agent = new Function(extractCode)();
        } catch (parseError) {
          throw new Error(`Code parsing error: ${parseError.message}`);
        }

        if (!agent) {
          throw new Error("Agent code did not create exampleOpponent");
        }

        if (typeof agent !== "object") {
          throw new Error("exampleOpponent must be an object");
        }

        // Test each function exists and has correct return type
        if (typeof agent.call !== "function") {
          throw new Error("call must be a function");
        }

        if (typeof agent.fold !== "function") {
          throw new Error("fold must be a function");
        }

        if (typeof agent.raise !== "function") {
          throw new Error("raise must be a function");
        }

        // Build game info for testing
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

        // Test function return types
        try {
          const callResult = agent.call(gameInfo);
          if (typeof callResult !== "boolean") {
            throw new Error(`call() returned ${typeof callResult}, expected boolean`);
          }
        } catch (e) {
          throw new Error(`call() error: ${e.message}`);
        }

        try {
          const foldResult = agent.fold(gameInfo);
          if (typeof foldResult !== "boolean") {
            throw new Error(`fold() returned ${typeof foldResult}, expected boolean`);
          }
        } catch (e) {
          throw new Error(`fold() error: ${e.message}`);
        }

        try {
          const raiseResult = agent.raise(gameInfo);
          if (typeof raiseResult !== "object") {
            throw new Error(`raise() returned ${typeof raiseResult}, expected object`);
          }
          if (typeof raiseResult.shouldRaise !== "boolean") {
            throw new Error(`raise().shouldRaise must be boolean, got ${typeof raiseResult.shouldRaise}`);
          }
          if (typeof raiseResult.amount !== "number") {
            throw new Error(`raise().amount must be number, got ${typeof raiseResult.amount}`);
          }
        } catch (e) {
          throw new Error(`raise() error: ${e.message}`);
        }

        return { valid: true, error: null };
      } catch (err) {
        return { valid: false, error: err.message };
      }
    } catch (err) {
      return { valid: false, error: err.message || "Unknown validation error" };
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

  const testAgentWinRate = async (agent, opponent) => {
    setIsTesting(true);
    setTestError("");
    
    try {
      const response = await fetch("/api/agents/test-matchup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent1Code: agent.code,
          agent2Code: opponent.code,
          matchCount: 20
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setTestError(data.error || "Test failed");
        setIsTesting(false);
        return;
      }

      // Store results with key combining both agent IDs
      const resultKey = `${agent.id}_vs_${opponent.id}`;
      const newResults = {
        ...testResults,
        [resultKey]: {
          agent1Name: agent.name,
          agent2Name: opponent.name,
          agent1Id: agent.id,
          agent2Id: opponent.id,
          agent1Code: agent.code,
          agent2Code: opponent.code,
          agent1Wins: data.agent1Wins,
          agent2Wins: data.agent2Wins,
          winRate1: data.winRate1,
          winRate2: data.winRate2,
          matchCount: data.matchCount,
          timestamp: data.timestamp
        }
      };
      
      setTestResults(newResults);
      setTestingAgent(agent);
      setTestingOpponent(opponent);
      setIsTesting(false);
    } catch (err) {
      setTestError("Network error: " + err.message);
      setIsTesting(false);
    }
  };

  const testAgentMultiWay = async (agent) => {
    // Get available opponents (other agents)
    const availableOpponents = uploadedAgents.filter(a => a.id !== agent.id);
    
    if (availableOpponents.length === 0) {
      setMultiWayTestError("Upload at least 2 agents to run multi-way tests");
      return;
    }

    setIsMultiWayTesting(true);
    setMultiWayTestError("");

    try {
      // Randomly select up to 3 opponents
      const selectedOpponents = [];
      const opponentCount = Math.min(3, availableOpponents.length);
      
      for (let i = 0; i < opponentCount; i++) {
        const randomIdx = Math.floor(Math.random() * availableOpponents.length);
        selectedOpponents.push(availableOpponents[randomIdx]);
      }

      const opponentCodes = selectedOpponents.map(opp => opp.code);
      const opponentNames = selectedOpponents.map(opp => opp.name).join(", ");

      const response = await fetch("/api/agents/test-multi-way", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentCode: agent.code,
          opponentCodes: opponentCodes,
          matchCount: 20
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMultiWayTestError(data.error || "Multi-way test failed");
        setIsMultiWayTesting(false);
        return;
      }

      // Store results
      const resultKey = `${agent.id}_multi_${Date.now()}`;
      const newResults = {
        ...multiWayResults,
        [resultKey]: {
          agentName: agent.name,
          agentId: agent.id,
          opponentNames: opponentNames,
          opponentCount: selectedOpponents.length,
          wins: data.wins,
          matchCount: data.matchCount,
          winRate: data.winRate,
          timestamp: data.timestamp
        }
      };

      setMultiWayResults(newResults);
      setMultiWayTestingAgent(agent);
      setIsMultiWayTesting(false);
    } catch (err) {
      setMultiWayTestError("Network error: " + err.message);
      setIsMultiWayTesting(false);
    }
  };

  const watchMatch = (agent1, agent2) => {
    // Store spectator agents in localStorage
    localStorage.setItem("spectatorAgents", JSON.stringify({
      agent1Id: agent1.id,
      agent1Name: agent1.name,
      agent1Code: agent1.code,
      agent2Id: agent2.id,
      agent2Name: agent2.name,
      agent2Code: agent2.code
    }));
    
    // Navigate to toy-poker page
    window.location.href = "/toy-poker?mode=spectate-custom-agents";
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
            {agentCode && !validationError && (
              <div className="hint-text">
                <small>✓ Code looks good so far</small>
              </div>
            )}
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
            {uploadedAgents.map((agent) => {
              // Calculate win rate stats for this agent
              const agentTestResults = Object.entries(testResults)
                .filter(([key]) => key.startsWith(agent.id))
                .map(([, result]) => result);

              const totalWins = agentTestResults.reduce((sum, r) => sum + (r.agent1Wins || 0), 0);
              const totalMatches = agentTestResults.reduce((sum, r) => sum + r.matchCount, 0);
              const avgWinRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : null;

              return (
                <div key={agent.id} className="agent-card-wrapper">
                  <div className="agent-card">
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
                        onClick={() => {
                          setTestingAgent(agent);
                          setTestingOpponent(null);
                          setTestMode("1v1");
                        }}
                        className="action-button test"
                        title="Test win rate against other agents (1v1)"
                      >
                        🎯 Test (1v1)
                      </button>
                      <button
                        onClick={() => testAgentMultiWay(agent)}
                        className="action-button test-multi"
                        title="Test against randomly selected agents (4-player)"
                      >
                        ⚔️ Test (4-Player)
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

                  {/* Win Rate Stats Card */}
                  {agentTestResults.length > 0 && (
                    <div className="win-rate-card">
                      <h4>Win Rate Stats</h4>
                      <div className="stats-display">
                        <div className="stat-item">
                          <span className="stat-label">Overall:</span>
                          <span className={`stat-value ${avgWinRate >= 50 ? 'winning' : 'losing'}`}>
                            {avgWinRate}%
                          </span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Matches:</span>
                          <span className="stat-value">{totalMatches}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Wins:</span>
                          <span className="stat-value">{totalWins}</span>
                        </div>
                      </div>
                      <div className="recent-tests">
                        <p className="tests-header">Recent Tests:</p>
                        {agentTestResults.slice(-3).map((result, idx) => (
                          <div key={idx} className="test-result-item">
                            <span className="opponent-name">{result.agent2Name}</span>
                            <span className={`vs-result ${result.winRate1 > 50 ? 'win' : 'loss'}`}>
                              {result.winRate1}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* Win Rate Testing Section */}
      {testingAgent && (
        <section className="test-section">
          <div className="test-header">
            <h2>🎯 Test: {testingAgent.name}</h2>
            <button
              onClick={() => {
                setTestingAgent(null);
                setTestingOpponent(null);
                setTestError("");
              }}
              className="close-button"
            >
              ✕
            </button>
          </div>

          {!testingOpponent ? (
            <div className="test-opponent-select">
              <p>Select an opponent to test against:</p>
              <div className="opponent-list">
                {uploadedAgents.filter(a => a.id !== testingAgent.id).length > 0 ? (
                  uploadedAgents.map((agent) => {
                    if (agent.id === testingAgent.id) return null;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => setTestingOpponent(agent)}
                        className="opponent-button"
                      >
                        <span className="opponent-name">{agent.name}</span>
                        <span className="opponent-arrow">→</span>
                      </button>
                    );
                  })
                ) : (
                  <p className="no-opponents">Upload another agent to test</p>
                )}
              </div>
            </div>
          ) : (
            <div className="test-matchup">
              {isTesting ? (
                <div className="test-progress">
                  <p>Testing {testingAgent.name} vs {testingOpponent.name}...</p>
                  <p className="progress-text">Running 20 matches...</p>
                  <div className="progress-bar">
                    <div className="progress-bar-fill"></div>
                  </div>
                </div>
              ) : testError ? (
                <div className="test-error">
                  <p>❌ {testError}</p>
                  <button
                    onClick={() => {
                      setTestError("");
                      setTestingOpponent(null);
                    }}
                    className="retry-button"
                  >
                    Back to select opponent
                  </button>
                </div>
              ) : (
                <div className="test-results">
                  {(() => {
                    const resultKey = `${testingAgent.id}_vs_${testingOpponent.id}`;
                    const result = testResults[resultKey];
                    if (!result) {
                      return <p className="loading-result">Initializing test...</p>;
                    }

                    const isWinner = result.winRate1 > 50;
                    return (
                      <div className="results-content">
                        <div className="matchup-header">
                          <h3>{testingAgent.name} vs {testingOpponent.name}</h3>
                          <p className="match-info">{result.matchCount} matches played</p>
                        </div>

                        <div className="results-grid">
                          <div className={`result-card ${isWinner ? "winner" : ""}`}>
                            <p className="agent-name">{testingAgent.name}</p>
                            <p className="win-rate">{result.winRate1}%</p>
                            <p className="win-count">{result.agent1Wins} wins</p>
                          </div>

                          <div className="vs-text">vs</div>

                          <div className={`result-card ${!isWinner ? "winner" : ""}`}>
                            <p className="agent-name">{testingOpponent.name}</p>
                            <p className="win-rate">{result.winRate2}%</p>
                            <p className="win-count">{result.agent2Wins} wins</p>
                          </div>
                        </div>

                        <p className="test-timestamp">Tested: {new Date(result.timestamp).toLocaleString()}</p>

                        <div className="test-actions">
                          <button
                            onClick={() => testAgentWinRate(testingAgent, testingOpponent)}
                            className="action-button run"
                            disabled={isTesting}
                          >
                            🔄 Run Again
                          </button>
                          <button
                            onClick={() => watchMatch(testingAgent, testingOpponent)}
                            className="action-button watch"
                          >
                            👁 Watch Match
                          </button>
                          <button
                            onClick={() => setTestingOpponent(null)}
                            className="action-button select"
                          >
                            📊 Different Opponent
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Multi-way Testing Section */}
      {multiWayTestingAgent && (
        <section className="test-section multi-way-section">
          <div className="test-header">
            <h2>⚔️ Multi-Way Test (4-Player): {multiWayTestingAgent.name}</h2>
            <button
              onClick={() => {
                setMultiWayTestingAgent(null);
                setMultiWayTestError("");
              }}
              className="close-button"
            >
              ✕
            </button>
          </div>

          {isMultiWayTesting ? (
            <div className="test-progress">
              <p>Testing {multiWayTestingAgent.name} against random opponents...</p>
              <p className="progress-text">Running 20 matches in 4-player games...</p>
              <div className="progress-bar">
                <div className="progress-bar-fill"></div>
              </div>
            </div>
          ) : multiWayTestError ? (
            <div className="test-error">
              <p>❌ {multiWayTestError}</p>
              <button
                onClick={() => {
                  setMultiWayTestError("");
                  testAgentMultiWay(multiWayTestingAgent);
                }}
                className="retry-button"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="test-results multi-way-results">
              {(() => {
                const agentResults = Object.entries(multiWayResults)
                  .filter(([, result]) => result.agentId === multiWayTestingAgent.id)
                  .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));

                if (agentResults.length === 0) {
                  return <p className="loading-result">Running first test...</p>;
                }

                const [, latestResult] = agentResults[0];

                return (
                  <div className="results-content">
                    <div className="matchup-header">
                      <h3>4-Player Tournament Results</h3>
                      <p className="match-info">Latest: {latestResult.matchCount} matches against {latestResult.opponentCount} random opponents</p>
                    </div>

                    <div className="multi-way-stats">
                      <div className="main-stat">
                        <p className="agent-name">{latestResult.agentName}</p>
                        <p className="win-rate-large">{latestResult.winRate}%</p>
                        <p className="win-count-large">{latestResult.wins} wins out of {latestResult.matchCount}</p>
                      </div>

                      <div className="stat-details">
                        <p>
                          <span className="label">Opponents:</span>
                          <span className="value">{latestResult.opponentNames}</span>
                        </p>
                        <p>
                          <span className="label">Tested:</span>
                          <span className="value">{new Date(latestResult.timestamp).toLocaleString()}</span>
                        </p>
                      </div>
                    </div>

                    {agentResults.length > 1 && (
                      <div className="test-history">
                        <h4>Recent Tests:</h4>
                        <div className="history-items">
                          {agentResults.slice(0, 5).map(([key, result], idx) => (
                            <div key={idx} className="history-item">
                              <span className="history-opponents">{result.opponentNames}</span>
                              <span className={`history-result ${result.winRate >= 50 ? 'winning' : 'losing'}`}>
                                {result.winRate}% ({result.wins}/{result.matchCount})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="test-actions">
                      <button
                        onClick={() => testAgentMultiWay(multiWayTestingAgent)}
                        className="action-button run"
                        disabled={isMultiWayTesting}
                      >
                        🔄 Run Again
                      </button>
                      <button
                        onClick={() => {
                          setTestingAgent(multiWayTestingAgent);
                          setTestingOpponent(null);
                          setTestMode("1v1");
                          setMultiWayTestingAgent(null);
                        }}
                        className="action-button select"
                      >
                        🎯 Switch to 1v1 Test
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
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

        .hint-text {
          font-size: 0.85rem;
          color: #10b981;
          margin-top: 0.5rem;
          padding: 0.5rem;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 4px;
          border-left: 3px solid #10b981;
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
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .agent-card-wrapper {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          align-items: start;
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

        .win-rate-card {
          background: #1e293b;
          padding: 1rem;
          border-radius: 8px;
          border: 2px solid #10b981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.15);
        }

        .win-rate-card h4 {
          margin: 0 0 1rem 0;
          font-size: 1rem;
          color: #10b981;
          text-align: center;
        }

        .stats-display {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: #111827;
          padding: 0.75rem;
          border-radius: 4px;
          border: 1px solid #334155;
        }

        .stat-label {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-bottom: 0.25rem;
        }

        .stat-value {
          font-size: 1.1rem;
          font-weight: bold;
          color: #e5e7eb;
        }

        .stat-value.winning {
          color: #10b981;
        }

        .stat-value.losing {
          color: #ef4444;
        }

        .recent-tests {
          border-top: 1px solid #334155;
          padding-top: 0.75rem;
        }

        .tests-header {
          margin: 0 0 0.5rem 0;
          font-size: 0.8rem;
          font-weight: bold;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .test-result-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.35rem 0;
          font-size: 0.8rem;
          color: #d1d5db;
        }

        .opponent-name {
          color: #9ca3af;
          text-truncate: ellipsis;
          white-space: nowrap;
          overflow: hidden;
          max-width: 70%;
        }

        .vs-result {
          font-weight: bold;
          padding: 0.2rem 0.5rem;
          border-radius: 3px;
          font-size: 0.75rem;
          white-space: nowrap;
        }

        .vs-result.win {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .vs-result.loss {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .upload-time {
          font-size: 0.8rem;
          color: #9ca3af;
          margin: 0.25rem 0 1rem 0;
        }

        .agent-actions {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
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

        .test {
          background: #f59e0b;
        }

        .test-multi {
          background: #8b5cf6;
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

        .test-section {
          background: #1e293b;
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid #334155;
          margin-top: 2rem;
        }

        .test-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .test-header h2 {
          margin: 0;
        }

        .test-opponent-select {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .test-opponent-select > p {
          margin: 0;
          font-weight: bold;
          color: #e5e7eb;
        }

        .opponent-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
        }

        .opponent-button {
          background: #111827;
          border: 2px solid #334155;
          border-radius: 6px;
          padding: 1rem;
          color: #e5e7eb;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: bold;
        }

        .opponent-button:hover {
          border-color: #60a5fa;
          background: #1f2937;
          transform: translateX(4px);
        }

        .opponent-arrow {
          color: #60a5fa;
          font-size: 1.2rem;
        }

        .no-opponents {
          color: #9ca3af;
          font-style: italic;
          margin: 0;
          text-align: center;
          padding: 2rem;
        }

        .test-matchup {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .test-progress {
          text-align: center;
          padding: 2rem;
        }

        .test-progress p {
          margin: 0.5rem 0;
          color: #e5e7eb;
        }

        .progress-text {
          font-size: 0.9rem;
          color: #9ca3af;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: #334155;
          border-radius: 2px;
          margin-top: 1rem;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          width: 100%;
          background: linear-gradient(90deg, #3b82f6, #60a5fa);
          animation: progress 1.5s ease-in-out infinite;
        }

        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }

        .loading-result {
          text-align: center;
          color: #9ca3af;
          padding: 2rem;
          margin: 0;
        }

        .test-error {
          background: #7f1d1d;
          color: #fecaca;
          padding: 1rem;
          border-radius: 6px;
          border: 1px solid #dc2626;
          text-align: center;
        }

        .test-error p {
          margin: 0 0 1rem 0;
        }

        .retry-button {
          background: #dc2626;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .retry-button:hover {
          background: #b91c1c;
        }

        .test-results {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .results-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .matchup-header {
          text-align: center;
        }

        .matchup-header h3 {
          margin: 0;
          font-size: 1.3rem;
          color: #60a5fa;
        }

        .match-info {
          margin: 0.5rem 0 0 0;
          font-size: 0.9rem;
          color: #9ca3af;
        }

        .results-grid {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 1rem;
          align-items: center;
        }

        .result-card {
          background: #111827;
          border: 2px solid #334155;
          border-radius: 6px;
          padding: 1.5rem;
          text-align: center;
          transition: all 0.15s ease;
        }

        .result-card.winner {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.1);
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.2);
        }

        .result-card .agent-name {
          margin: 0;
          font-size: 1rem;
          font-weight: bold;
          color: #e5e7eb;
        }

        .result-card .win-rate {
          margin: 0.5rem 0 0 0;
          font-size: 2rem;
          font-weight: bold;
          color: #60a5fa;
        }

        .result-card .win-count {
          margin: 0.5rem 0 0 0;
          font-size: 0.85rem;
          color: #9ca3af;
        }

        .vs-text {
          text-align: center;
          font-weight: bold;
          color: #6b7280;
          font-size: 1.2rem;
        }

        .test-timestamp {
          text-align: center;
          font-size: 0.85rem;
          color: #6b7280;
          margin: 0;
        }

        .test-actions {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1rem;
        }

        .action-button.run {
          background: #3b82f6;
        }

        .action-button.run:hover {
          background: #2563eb;
        }

        .action-button.watch {
          background: #8b5cf6;
        }

        .action-button.watch:hover {
          background: #7c3aed;
        }

        .action-button.select {
          background: #10b981;
        }

        .action-button.select:hover {
          background: #059669;
        }

        /* Multi-way test styles */
        .multi-way-section {
          border-left: 4px solid #8b5cf6;
        }

        .multi-way-results {
          background: #1e293b;
        }

        .multi-way-stats {
          background: #111827;
          padding: 1.5rem;
          border-radius: 8px;
          text-align: center;
          margin-bottom: 1.5rem;
          border: 2px solid #8b5cf6;
        }

        .main-stat {
          margin-bottom: 1rem;
        }

        .win-rate-large {
          font-size: 3rem;
          font-weight: bold;
          color: #8b5cf6;
          margin: 0.5rem 0;
        }

        .win-count-large {
          font-size: 1rem;
          color: #9ca3af;
          margin: 0;
        }

        .stat-details {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #334155;
          text-align: left;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .stat-details p {
          margin: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .stat-details .label {
          font-weight: bold;
          color: #9ca3af;
        }

        .stat-details .value {
          color: #f3f4f6;
          text-align: right;
        }

        .test-history {
          background: #111827;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .test-history h4 {
          margin: 0 0 1rem 0;
          color: #f3f4f6;
        }

        .history-items {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .history-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #0f172a;
          border-radius: 4px;
          border-left: 3px solid #334155;
        }

        .history-opponents {
          color: #9ca3af;
          font-size: 0.9rem;
          flex: 1;
        }

        .history-result {
          font-weight: bold;
          padding: 0.25rem 0.5rem;
          border-radius: 3px;
          font-size: 0.85rem;
          white-space: nowrap;
        }

        .history-result.winning {
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
        }

        .history-result.losing {
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
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

          .agent-card-wrapper {
            grid-template-columns: 1fr;
          }

          .agent-card,
          .win-rate-card {
            width: 100%;
          }

          .results-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .vs-text {
            order: 5;
            margin-top: 1rem;
          }

          .test-actions {
            grid-template-columns: 1fr;
          }

          .opponent-list {
            grid-template-columns: 1fr;
          }

          .stats-display {
            grid-template-columns: 1fr;
          }

          .agent-actions {
            grid-template-columns: 1fr 1fr;
          }

          .stat-details {
            grid-template-columns: 1fr;
            gap: 0.5rem;
          }

          .stat-details p {
            flex-direction: column;
            align-items: flex-start;
          }

          .stat-details .value {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}
