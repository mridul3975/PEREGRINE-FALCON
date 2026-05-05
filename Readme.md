# 📖 README.md: The 7-Day Roadmap

## 🚀 Overview
This project is a step-by-step guide to building an AI Job Agent. We start with a simple chat and end with an autonomous recruiter.

### 📅 The Schedule

#### **Phase 1: The Puppet (Days 1-2)**
*   **Day 1:** Set up Bun and a basic React page with two text areas (Resume & Job Description).
*   **Day 2:** Connect the "Analyze" button to OpenAI/Gemini. 
    *   **The Goal:** Send both texts to the AI and display a "Match Score" (e.g., 85%) and "Missing Skills."
    *   **Learning:** How to write a **System Prompt** to make the AI act like a recruiter.

#### **Phase 2: The Tool-User (Days 3-4)**
*   **Day 3:** Intro to **Function Calling**. Write a JS function `get_current_date()` and tell the AI it exists.
*   **Day 4:** Give the AI a `tailor_resume_section()` tool.
    *   **The Goal:** The AI says, "I see the job needs React. I am calling the `tailor_resume_section` function to rewrite your summary."
    *   **Learning:** The AI doesn't *run* your code; it *requests* that you run it.

#### **Phase 3: The Loop (Days 5-7)**
*   **Day 5:** Setup SQLite with Bun to store "Discovered Jobs."
*   **Day 6:** Create the **Autonomous Loop**. Give the AI an array of 5 jobs.
*   **Day 7:** **Human-in-the-Loop.** Build a "Review" dashboard where you see the AI's work and click "Approve."
    *   **The Goal:** The AI looks at all 5 jobs, discards the bad ones, and prepares resumes for the good ones.
    *   **Learning:** Handling multiple AI steps and saving progress.

---

## 🛠️ Installation
1. `bun init`
2. `bun add ai @ai-sdk/openai` (or `@ai-sdk/google`)
3. Create a `.env` file with your `API_KEY`.

---

## 🧠 Why this order?
*   **Phase 1** teaches you how to talk to AI.
*   **Phase 2** is the "Aha!" moment. Once you see the AI trigger a JavaScript function you wrote, you'll realize you can make it do *anything* (send emails, search Google, etc.).
*   **Phase 3** turns the tool into a teammate that works while you're away.

---

**Would you like me to provide the basic React code for this Day 1 UI so you can get started?**
