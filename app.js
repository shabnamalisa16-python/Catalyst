// --- STATE ---
let extractedResumeText = "";
let currentGaps = [];
let chatHistory = [];
let finalPlan = null;
let currentQuestionIndex = 0;
let timerInterval = null;
let timeLeft = 180; // 3 minutes in seconds
let isVoiceActive = false;
let performanceData = {}; // Track skill performance: { "Skill Name": score_out_of_100 }
let initialMatchScore = 0;



// Speech Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
const synth = window.speechSynthesis;

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM ELEMENTS ---
    const jdInput = document.getElementById("job-description");
    const resumeUploadArea = document.getElementById("resume-upload-area");
    const resumeFileInput = document.getElementById("candidate-resume-file");
    const resumeTextInput = document.getElementById("candidate-resume-text");
    const uploadText = document.getElementById("upload-text");
    const startBtn = document.getElementById("start-assessment-btn");

    const stageSetup = document.getElementById("stage-setup");
    const stageAssessment = document.getElementById("stage-assessment");
    const stagePlan = document.getElementById("stage-plan");

    const chatMessages = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-msg-btn");
    const finishBtn = document.getElementById("finish-assessment-btn");
    const progressFill = document.getElementById("chat-progress-fill");
    const timerDisplay = document.getElementById("response-timer");
    const voiceBtn = document.getElementById("voice-input-btn");

    // --- TIMER LOGIC ---
    function startTimer() {
        clearInterval(timerInterval);
        timeLeft = 180;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                terminateAssessmentGracefully("Time has expired for this response. To respect your time, I'll conclude the assessment here and generate your personalized learning plan based on the information we've gathered so far.");
            }
        }, 1000);
    }

    function terminateAssessmentGracefully(reason) {
        stopTimer();
        addMessage(reason, "agent");
        chatHistory.push({ role: "assistant", content: reason });
        speak(reason);
        
        document.querySelector(".chat-input-area").style.display = "none";
        finishBtn.classList.remove("hidden");
        timerDisplay.style.display = "none";
        progressFill.style.width = "100%";
    }


    function stopTimer() {
        clearInterval(timerInterval);
    }

    function updateTimerDisplay() {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        timerDisplay.querySelector('span').textContent = timeStr;
        
        if (timeLeft < 30) {
            timerDisplay.classList.add("timer-low");
        } else {
            timerDisplay.classList.remove("timer-low");
        }
    }

    // --- VOICE LOGIC ---
    if (recognition) {
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            chatInput.value = transcript;
            voiceBtn.classList.remove("active-mic");
            handleUserMessage();
        };

        recognition.onerror = () => voiceBtn.classList.remove("active-mic");
        recognition.onend = () => voiceBtn.classList.remove("active-mic");
    }

    voiceBtn.addEventListener("click", () => {
        if (!recognition) return alert("Speech recognition not supported in this browser.");
        voiceBtn.classList.add("active-mic");
        recognition.start();
    });

    function speak(text, callback) {
        if (!synth) {
            if (callback) callback();
            return;
        }
        synth.cancel(); // Stop any current speech
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1;
        utter.pitch = 1;
        if (callback) {
            utter.onend = () => callback();
        }
        synth.speak(utter);
    }

    // --- EVENT LISTENERS ---



    // File Upload Handling
    resumeUploadArea.addEventListener("click", () => resumeFileInput.click());
    resumeUploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        resumeUploadArea.style.borderColor = "var(--primary)";
    });
    resumeUploadArea.addEventListener("dragleave", () => {
        resumeUploadArea.style.borderColor = "var(--border)";
    });
    resumeUploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        resumeUploadArea.style.borderColor = "var(--border)";
        if (e.dataTransfer.files.length > 0) {
            resumeFileInput.files = e.dataTransfer.files;
            handleFileSelect(resumeFileInput.files[0]);
        }
    });
    resumeFileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    async function handleFileSelect(file) {
        if (file.type !== "application/pdf") {
            alert("Please upload a valid PDF file.");
            return;
        }
        uploadText.textContent = `Selected: ${file.name} (Extracting...)`;
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const typedarray = new Uint8Array(arrayBuffer);
            const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
            let text = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(item => item.str).join(" ") + "\n";
            }
            extractedResumeText = text;
            uploadText.textContent = `Successfully extracted ${pdf.numPages} page(s).`;
            resumeUploadArea.style.borderColor = "var(--success)";
        } catch (err) {
            console.error("PDF Extraction Error:", err);
            uploadText.textContent = `Error extracting PDF: ${err.message || 'Unknown error'}`;
            resumeUploadArea.style.borderColor = "var(--warning)";
        }
    }

    // Sample Loaders
    document.getElementById("load-sample-jd").addEventListener("click", () => {
        jdInput.value = `Senior Frontend Engineer (React/Next.js)
Required Skills:
- Advanced proficiency in React.js and modern hooks
- Experience with Next.js and Server-Side Rendering (SSR)
- Strong understanding of TypeScript
- State management (Redux, Zustand)
- Experience with CI/CD pipelines (GitHub Actions)
- Testing (Jest, Cypress, or Playwright)`;
    });
    
    document.getElementById("load-sample-resume").addEventListener("click", () => {
        resumeUploadArea.style.display = "none";
        resumeTextInput.style.display = "block";
        resumeTextInput.value = `Arjun Sharma
Senior Frontend Developer
Bangalore, India

Experience:
- Frontend Developer at TechNova (3 years)
  Lead the development of scalable web applications using React and Redux. Optimized performance for large-scale e-commerce platforms.
- Web Developer at DigiScale (2 years)
  Created responsive UI components and maintained legacy JavaScript applications.

Skills: React, JavaScript, HTML, CSS, Redux, Git, Tailwind CSS.`;
        extractedResumeText = resumeTextInput.value;
    });

    // --- LLM API INTEGRATION ---
    async function callLLM(systemPrompt, userPrompt) {
        const provider = "mock";
        const apiKey = "";
        
        if (provider === "mock") {
            return new Promise(resolve => {
                setTimeout(() => {
                    if (systemPrompt.includes("missing skills")) {
                        resolve("Next.js/SSR, TypeScript, CI/CD");
                    } else if (systemPrompt.includes("learning plan")) {
                        // Extract performance data from userPrompt if present
                        let scores = { "Next.js / SSR": 20, "TypeScript": 30, "CI/CD": 10 };
                        try {
                            const perfMatch = userPrompt.match(/Interview Performance Data: ({.*?})/);
                            if (perfMatch) {
                                const perf = JSON.parse(perfMatch[1]);
                                // Map interviewer topics to plan skill names
                                if (perf["Next.js"]) scores["Next.js / SSR"] = perf["Next.js"];
                                if (perf["Testing"]) scores["TypeScript"] = perf["Testing"]; // Mock assumes testing maps to TS for this demo
                                if (perf["CI/CD"]) scores["CI/CD"] = perf["CI/CD"];
                            }
                        } catch (e) { console.error("Mock parse error", e); }

                        resolve(JSON.stringify({
                            gaps: [
                                { skill: "Next.js / SSR", current: scores["Next.js / SSR"], target: 80, isGap: true },
                                { skill: "TypeScript", current: scores["TypeScript"], target: 90, isGap: true },
                                { skill: "CI/CD", current: scores["CI/CD"], target: 60, isGap: true }
                            ],

                            adjacent: [
                                { name: "Next.js", from: "React.js", reason: "Natural progression" },
                                { name: "TypeScript", from: "JavaScript", reason: "Adds static typing" }
                            ],
                            roadmap: [
                                {
                                    title: "Phase 1: TypeScript Fundamentals",
                                    time: "1 Week",
                                    type: "Core",
                                    desc: "Mastering static typing, interfaces, and generics.",
                                    links: []
                                },
                                {
                                    title: "Phase 2: Next.js & SSR Architecture",
                                    time: "2 Weeks",
                                    type: "Framework",
                                    desc: "Server-Side Rendering, Static Site Generation, and App Router.",
                                    links: []
                                },
                                {
                                    title: "Phase 3: Automated Testing & CI/CD",
                                    time: "1 Week",
                                    type: "DevOps",
                                    desc: "Unit testing and automated deployments.",
                                    links: []
                                }
                            ]
                        }));
                    } else {
                        resolve("That's an interesting approach. Can you elaborate more on how you would handle state in that scenario?");
                    }
                }, 800);
            });
        }

        if (!apiKey) {
            throw new Error("Please enter your API Key.");
        }
        
        // Default to OpenAI-compatible format
        const url = provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
        const model = provider === "groq" ? "llama-3.1-8b-instant" : "gpt-4o-mini";

        const payload = {
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7
        };

        if (provider === "anthropic") {
            throw new Error("Anthropic direct browser calls may fail due to CORS. Please use Groq or OpenAI compatible endpoint for this prototype.");
        }

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    // --- CORE APP FLOW ---
    startBtn.addEventListener("click", async () => {
        const jdText = jdInput.value.trim();
        const resumeText = extractedResumeText || resumeTextInput.value.trim();

        if (!jdText || !resumeText) {
            alert("Please provide both a Job Description and a Resume.");
            return;
        }
        
        startBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> Analyzing Gaps...';
        startBtn.disabled = true;
        lucide.createIcons();
        
        try {
            const systemPrompt = "You are an expert technical recruiter. Analyze the provided Job Description and Resume. Identify the missing skills or weak areas where the candidate falls short. Return a short comma-separated list of 3-4 key missing skills or areas that need probing. Do not explain, just list them.";
            const userPrompt = `Job Description:\n${jdText}\n\nResume:\n${resumeText}`;
            
            const gapAnalysis = await callLLM(systemPrompt, userPrompt);
            currentGaps = gapAnalysis.split(",").map(s => s.trim());
            console.log("Identified Gaps:", currentGaps);

            // Initial Match Score Calculation (Mock Heuristic)
            initialMatchScore = Math.max(40, 100 - (currentGaps.length * 12)); 
            document.getElementById("initial-score-display").textContent = `${initialMatchScore}%`;

            chatHistory = [

                { role: "system", content: `You are AssessPal, a technical proficiency assessor. The candidate's resume shows they lack or are weak in the following skills required by the job: ${currentGaps.join(", ")}. Conduct a short interview (max 3 questions) to assess their real proficiency on these specific gaps. Ask one question at a time. Be conversational but technically rigorous. If they answer well, acknowledge it. If not, note it. Start by welcoming them and asking the first question.` }
            ];

            switchStage("assessment");
            await initiateChat();

        } catch (error) {
            alert("Error during analysis: " + error.message);
            startBtn.innerHTML = 'Start AI Assessment <i data-lucide="arrow-right"></i>';
            startBtn.disabled = false;
        }
    });

    sendBtn.addEventListener("click", handleUserMessage);
    chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleUserMessage();
        }
    });

    finishBtn.addEventListener("click", async () => {
        finishBtn.innerHTML = '<i data-lucide="loader-2" class="lucide-spin"></i> Generating Plan...';
        finishBtn.disabled = true;
        lucide.createIcons();
        
        try {
            const systemPrompt = `You are a career development expert. Based on the following interview transcript, generate a personalized learning plan in JSON format.
The JSON must have this structure:
{
  "gaps": [ { "skill": "Skill Name", "current": 20, "target": 80, "isGap": true } ],
  "adjacent": [ { "name": "Target Skill", "from": "Existing Skill", "reason": "Why it's a good pivot" } ],
  "roadmap": [ { "title": "Phase 1: X", "time": "2 Weeks", "type": "Core", "desc": "Description", "links": [ {"text": "Link Name", "url": "#"} ] } ]
}
Respond ONLY with valid JSON.`;

            const transcript = chatHistory.filter(m => m.role !== 'system').map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
            const performanceStr = JSON.stringify(performanceData);
            
            let jsonString = await callLLM(systemPrompt, `Interview Performance Data: ${performanceStr}\n\nTranscript:\n${transcript}`);

            jsonString = jsonString.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
            finalPlan = JSON.parse(jsonString);

            switchStage("plan");
            renderDashboard(finalPlan);
        } catch (error) {
            alert("Error generating plan: " + error.message);
            finishBtn.innerHTML = 'Generate Learning Plan';
            finishBtn.disabled = false;
        }
    });

    // --- HELPER FUNCTIONS ---
    function switchStage(stageName) {
        stageSetup.classList.add("hidden");
        stageSetup.classList.remove("active");
        stageAssessment.classList.add("hidden");
        stageAssessment.classList.remove("active");
        stagePlan.classList.add("hidden");
        stagePlan.classList.remove("active");

        document.getElementById("nav-setup").classList.remove("active");
        document.getElementById("nav-assessment").classList.remove("active");
        document.getElementById("nav-plan").classList.remove("active");

        if (stageName === "assessment") {
            stageAssessment.classList.remove("hidden");
            stageAssessment.classList.add("active");
            document.getElementById("nav-assessment").classList.add("active");
            document.getElementById("nav-assessment").classList.remove("disabled");
        } else if (stageName === "plan") {
            stagePlan.classList.remove("hidden");
            stagePlan.classList.add("active");
            document.getElementById("nav-plan").classList.add("active");
            document.getElementById("nav-plan").classList.remove("disabled");
        }
    }

    function addMessage(text, sender) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `message ${sender}`;
        let parsedText = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
        msgDiv.innerHTML = parsedText;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function initiateChat() {
        chatMessages.innerHTML = '';
        currentQuestionIndex = 0;
        progressFill.style.width = "10%";
        
        try {
            if (true) { // Default to mock for demo
                const intro = "Hello! I am AssessPal, your AI technical proficiency assessor. I've analyzed your resume and the job requirements. Today, I'll be verifying the core skills listed on your resume and probing into some of the identified gaps. We'll spend about 3 minutes on each question. Let's start: Can you explain your experience with Next.js and how you handle Server-Side Rendering?";
                chatHistory.push({ role: "assistant", content: intro });
                addMessage(intro, "agent");
                speak(intro, () => startTimer());
                return;
            }
        } catch (e) {
            addMessage("Failed to start chat: " + e.message, "agent");
        }
    }

    async function handleUserMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        addMessage(text, "user");
        chatInput.value = '';
        chatHistory.push({ role: "user", content: text });
        stopTimer();

        currentQuestionIndex++;
        const progress = Math.min((currentQuestionIndex / 3) * 100, 100);
        progressFill.style.width = `${progress}%`;

        chatInput.disabled = true;
        sendBtn.disabled = true;

        try {
            if (currentQuestionIndex >= 3) {
                chatHistory.push({ role: "system", content: "The interview is over. Give a brief, encouraging final thought and tell the user you are generating their plan." });
            }

            if (true) { // Default to mock for demo
                setTimeout(() => {
                    const replies = [
                        {
                            keywords: ["ssr", "server", "render", "static", "next", "seo", "hydration", "hydrate", "pre-render"],
                            good: "Excellent explanation of hydration and SSR. I'd rate that a **9/10** on technical depth. Now, how would you handle testing React components?",
                            bad: "That answer is too vague or lacks relevant technical terms. I'd rate that a **0/10**. Let's try another: How would you handle testing React components?"
                        },
                        {
                            keywords: ["test", "jest", "cypress", "unit", "integration", "coverage", "rtl", "enzyme", "playwright"],
                            good: "Great understanding of the testing pyramid! That's a solid **88%** match for our required proficiency. What about CI/CD pipelines?",
                            bad: "You haven't demonstrated the required depth for testing. Rating: **0%**. Let's move on: What do you know about CI/CD pipelines?"
                        },
                        {
                            keywords: ["ci", "cd", "pipeline", "github", "action", "jenkins", "deploy", "automation", "workflow"],
                            good: "Impressive! Your overall assessment rating is **A (95%)**. You've demonstrated strong proficiency in both resume skills and identified gaps.",
                            bad: "Your overall assessment rating is **F (0%)**. The responses provided were too vague to verify technical competency."
                        }
                    ];

                    const currentMock = replies[currentQuestionIndex - 1] || replies[2];
                    const userText = text.toLowerCase();
                    
                    // Nuanced Scoring Heuristic
                    const matchedKeywords = currentMock.keywords.filter(k => userText.includes(k));
                    const keywordCount = matchedKeywords.length;
                    const negatives = ["don't", "dont", "not sure", "no idea", "haven't", "havent", "can't", "cant"];
                    const hasNegative = negatives.some(n => userText.includes(n));
                    
                    let reply = "";
                    let numericalScore = 0;
                    const topic = currentQuestionIndex === 1 ? "Next.js" : currentQuestionIndex === 2 ? "Testing" : "CI/CD";

                    if (hasNegative || (keywordCount === 0 && text.length < 50)) {
                        reply = currentMock.bad;
                        numericalScore = 10; // Minimum baseline
                    } else if (keywordCount >= 1 && text.length > 40) {
                        reply = currentMock.good;
                        numericalScore = 85 + (keywordCount * 2); // High score
                    } else {
                        // Partial Match
                        numericalScore = 40 + (keywordCount * 10);
                        reply = `That's a fair start, but I'd like to see more technical depth. I'd rate this a **${Math.floor(numericalScore/10)}/10**. Let's move on.`;
                        if (currentQuestionIndex === 1) reply += " How would you handle testing React components?";
                        if (currentQuestionIndex === 2) reply += " What do you know about CI/CD pipelines?";
                        if (currentQuestionIndex === 3) reply = `Your overall assessment rating is **B (${Math.min(numericalScore, 100)}%)**. You have shown good technical awareness.`;
                    }
                    
                    performanceData[topic] = Math.min(numericalScore, 100);

                    
                    chatHistory.push({ role: "assistant", content: reply });
                    addMessage(reply, "agent");
                    const speakText = reply.replace(/\*\*(.*?)\*\*/g, "$1");
                    
                    if (currentQuestionIndex >= 3) {
                        speak(speakText);
                        document.querySelector(".chat-input-area").style.display = "none";
                        finishBtn.classList.remove("hidden");
                        timerDisplay.style.display = "none";
                    } else {
                        speak(speakText, () => startTimer());
                    }
                    
                    chatInput.disabled = false;
                    sendBtn.disabled = false;
                    if(currentQuestionIndex < 3) chatInput.focus();
                }, 800);
                return; 
            }
        } catch (e) {
            addMessage("Error processing response: " + e.message, "agent");
            chatInput.disabled = false;
            sendBtn.disabled = false;
        }
    }

    function renderDashboard(plan) {
        // Update Score Pills
        const scores = Object.values(performanceData);
        const avgVerified = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        
        document.getElementById("final-initial-score").textContent = `${initialMatchScore}%`;
        document.getElementById("final-verified-score").textContent = `${avgVerified}%`;

        const gapContainer = document.getElementById("gap-analysis-list");

        gapContainer.innerHTML = '';
        
        (plan.gaps || []).forEach(g => {
            const el = document.createElement("div");
            el.className = "skill-item";
            el.innerHTML = `
                <div class="skill-header">
                    <span>${g.skill} ${g.isGap ? '<span class="gap-label">(Gap Identified)</span>' : ''}</span>
                    <span>${g.current}% / ${g.target}%</span>
                </div>
                <div class="skill-bar-bg">
                    <div class="skill-bar-fill" style="width: ${g.current}%; background: ${g.isGap ? 'var(--warning)' : 'var(--success)'}"></div>
                    <div class="skill-bar-target" style="left: ${g.target}%"></div>
                </div>
            `;
            gapContainer.appendChild(el);
        });

        const adjContainer = document.getElementById("adjacent-skills-list");
        adjContainer.innerHTML = '';
        
        (plan.adjacent || []).forEach(a => {
            const li = document.createElement("li");
            li.innerHTML = `<i data-lucide="corner-down-right"></i> <strong>${a.from} ➔ ${a.name}</strong>: ${a.reason}`;
            adjContainer.appendChild(li);
        });

        const roadContainer = document.getElementById("learning-roadmap");
        roadContainer.innerHTML = '';

        (plan.roadmap || []).forEach((r, idx) => {
            const step = document.createElement("div");
            step.className = "roadmap-step";
            
            const linksHtml = (r.links || []).map(l => `<a href="${l.url}" target="_blank">${l.text}</a>`).join('');

            step.innerHTML = `
                <div class="step-marker">${idx + 1}</div>
                <div class="step-content">
                    <h4>${r.title}</h4>
                    <div class="step-meta">
                        <span><i data-lucide="clock"></i> ${r.time}</span>
                        <span><i data-lucide="tag"></i> ${r.type}</span>
                    </div>
                    <p class="text-sm">${r.desc}</p>
                    <div class="step-resources">
                        ${linksHtml}
                    </div>
                </div>
            `;
            roadContainer.appendChild(step);
        });

        lucide.createIcons();
    }
});
