This is the perfect way to learn. By breaking it into these three phases, you aren't just "using AI"—you are learning how to **architect** it. You start with a simple request and end with a system that thinks for itself.

---

# Product Requirements Document (PRD): The Agentic Path

## 1. Objectives
*   **Educational Goal:** Transition from a standard Web Dev (Frontend/Backend) to an AI Engineer by mastering the **Request-Response**, **Function Calling**, and **Reasoning Loop** patterns.
*   **Functional Goal:** Build an "AgentHire" system that progressively automates the job search and tailoring process.

## 2. Phase Breakdown & Tech Stack

### Phase 1: The Puppet (Basic Integration)
*   **Core Task:** A React UI where the user inputs a Resume and a Job Description. On click, the AI returns a % match score and a list of missing keywords.
*   **What you learn:** API authentication, streaming responses, and basic prompt engineering.
*   **Tech:** React (State management), Bun (API routes), OpenAI/Claude API.

### Phase 2: The Tool-User (Function Calling)
*   **Core Task:** The AI is given a "Tool" (a JavaScript function) that it can choose to run. For example, a tool that fetches the current date or calculates a specific salary conversion.
*   **What you learn:** The **Function Calling** lifecycle (AI asks to run a tool -> You run it in JS -> You send the result back to AI).
*   **Tech:** Vercel AI SDK (Tools/Function calling module).


### Phase 3: The Loop (Autonomous Reasoning)
*   **Core Task:** The user provides a list of 5 job summaries. The AI must iterate through them, decide which ones are a "Good Match," and generate a custom application note for only the "Good" ones.
*   **What you learn:** Handling tokens, managing conversation history, and autonomous decision-making logic.
*   **Tech:** SQLite (to save the results of the loop), recursive API calls.

## 3. Directory Structure
```text
src/
├── phases/
│   ├── phase1_puppet.ts    # Simple Chat Completion
│   ├── phase2_tools.ts     # Definition of JS Tools for AI
│   └── phase3_loop.ts      # The logic for iterating over jobs
├── db/
│   └── connection.ts       # Bun SQLite for Phase 3 persistence
└── frontend/
    └── AgentDashboard.tsx  # The main React interface
```

---

