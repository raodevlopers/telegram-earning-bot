import { Router } from "express";
import type { AppServices } from "../types/app-services.js";
import { asyncHandler } from "../middlewares/async-handler.js";

export function createPublicRouter(services: AppServices) {
  const router = Router();

  router.get(
    "/task-session/:token",
    asyncHandler(async (req, res) => {
      const token = String(req.params.token);
      const session = await services.taskService.getSessionView(token);
      res.type("html").send(renderTaskSessionHtml(session.token));
    })
  );

  router.get(
    "/api/public/task-session/:token",
    asyncHandler(async (req, res) => {
      const token = String(req.params.token);
      res.json(await services.taskService.getSessionView(token));
    })
  );

  router.post(
    "/api/public/task-session/:token/start",
    asyncHandler(async (req, res) => {
      const token = String(req.params.token);
      res.json(await services.taskService.startSessionTimer(token));
    })
  );

  router.post(
    "/api/public/task-session/:token/finish",
    asyncHandler(async (req, res) => {
      const token = String(req.params.token);
      res.json(await services.taskService.finishSessionTimer(token));
    })
  );

  return router;
}

function renderTaskSessionHtml(token: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Income Hub Task Timer</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #fff8ef;
        --card: rgba(255, 255, 255, 0.82);
        --text: #1f2430;
        --muted: #6a7285;
        --accent: #ff6a3d;
        --accent-dark: #e24d1f;
        --line: rgba(31, 36, 48, 0.08);
        --ok: #0f9d58;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(255, 196, 116, 0.55), transparent 34%),
          radial-gradient(circle at right, rgba(255, 106, 61, 0.22), transparent 28%),
          linear-gradient(160deg, #fff8ef 0%, #fff1e2 45%, #ffe6d1 100%);
        min-height: 100vh;
      }
      main {
        max-width: 760px;
        margin: 0 auto;
        padding: 24px 16px 48px;
      }
      .shell {
        backdrop-filter: blur(18px);
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: 0 24px 80px rgba(255, 106, 61, 0.12);
        overflow: hidden;
      }
      .hero {
        padding: 24px;
        background: linear-gradient(135deg, rgba(255, 106, 61, 0.14), rgba(255, 214, 170, 0.3));
        border-bottom: 1px solid var(--line);
      }
      .eyebrow {
        margin: 0 0 8px;
        font-size: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--accent-dark);
      }
      h1 {
        margin: 0 0 8px;
        font-size: clamp(30px, 5vw, 46px);
        line-height: 1.04;
      }
      p { margin: 0; line-height: 1.6; }
      .body {
        padding: 24px;
        display: grid;
        gap: 18px;
      }
      .card {
        padding: 18px;
        border-radius: 22px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.72);
      }
      .timer {
        font-size: clamp(42px, 8vw, 72px);
        font-weight: 700;
        line-height: 1;
        margin-top: 8px;
      }
      .muted { color: var(--muted); }
      .warning {
        color: #9a4100;
        background: rgba(255, 214, 170, 0.45);
      }
      .success {
        color: #0f6e3c;
        background: rgba(15, 157, 88, 0.1);
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      button, a.action {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 14px 20px;
        font: inherit;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
        color: white;
        background: linear-gradient(135deg, var(--accent), #ff875f);
        box-shadow: 0 12px 28px rgba(255, 106, 61, 0.18);
      }
      button.secondary, a.secondary {
        color: var(--text);
        background: rgba(31, 36, 48, 0.06);
        box-shadow: none;
      }
      .gallery {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
      }
      .gallery img {
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        border-radius: 18px;
        border: 1px solid var(--line);
      }
      pre {
        white-space: pre-wrap;
        margin: 0;
        padding: 16px;
        border-radius: 18px;
        background: rgba(31, 36, 48, 0.04);
        border: 1px solid var(--line);
      }
      @media (max-width: 640px) {
        .hero, .body { padding: 18px; }
        button, a.action { width: 100%; text-align: center; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="shell">
        <div class="hero">
          <p class="eyebrow">Income Hub</p>
          <h1 id="title">Loading task...</h1>
          <p id="subtitle" class="muted">Preparing your browser-safe timer flow.</p>
        </div>
        <div class="body">
          <div id="browserNotice" class="card warning" hidden>
            Telegram in-app browser detect hua lag raha hai. Best result ke liye top-right menu se <b>Open in Browser</b> ya <b>Chrome</b> choose karo.
          </div>

          <div class="card">
            <p class="eyebrow">Task Steps</p>
            <p id="description"></p>
          </div>

          <div id="captionCard" class="card" hidden>
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:12px;">
              <p class="eyebrow" style="margin:0;">Caption</p>
              <button id="copyCaption" class="secondary" type="button">Copy caption</button>
            </div>
            <pre id="captionText"></pre>
          </div>

          <div id="galleryCard" class="card" hidden>
            <p class="eyebrow">Reference Images</p>
            <div id="gallery" class="gallery"></div>
          </div>

          <div class="card">
            <p class="eyebrow">Countdown</p>
            <div id="timer" class="timer">00:30</div>
            <p id="timerStatus" class="muted" style="margin-top:10px;">Start button press karte hi timer begin hoga.</p>
          </div>

          <div id="statusCard" class="card warning">
            <p id="statusText">Task page ko Chrome ya Google browser me complete karo, phir yahan return aao.</p>
          </div>

          <div class="actions">
            <button id="startButton" type="button">Start timer</button>
            <button id="visitButton" type="button" hidden>Open task in browser</button>
            <button id="finishButton" type="button" class="secondary">I am back, check task</button>
            <a id="returnButton" class="action secondary" href="#" hidden>Return to Telegram</a>
          </div>
        </div>
      </section>
    </main>

    <script>
      const token = ${JSON.stringify(token)};
      const stateEls = {
        title: document.getElementById("title"),
        subtitle: document.getElementById("subtitle"),
        description: document.getElementById("description"),
        captionCard: document.getElementById("captionCard"),
        captionText: document.getElementById("captionText"),
        copyCaption: document.getElementById("copyCaption"),
        galleryCard: document.getElementById("galleryCard"),
        gallery: document.getElementById("gallery"),
        timer: document.getElementById("timer"),
        timerStatus: document.getElementById("timerStatus"),
        statusCard: document.getElementById("statusCard"),
        statusText: document.getElementById("statusText"),
        startButton: document.getElementById("startButton"),
        visitButton: document.getElementById("visitButton"),
        finishButton: document.getElementById("finishButton"),
        returnButton: document.getElementById("returnButton"),
        browserNotice: document.getElementById("browserNotice")
      };

      let sessionState = null;
      let intervalId = null;

      function formatCountdown(totalSeconds) {
        const safe = Math.max(0, Number(totalSeconds) || 0);
        const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
        const seconds = String(safe % 60).padStart(2, "0");
        return minutes + ":" + seconds;
      }

      function setStatus(message, tone) {
        stateEls.statusText.textContent = message;
        stateEls.statusCard.className = "card " + (tone || "warning");
      }

      function renderTimer(seconds) {
        stateEls.timer.textContent = formatCountdown(seconds);
      }

      function startLocalTicker() {
        window.clearInterval(intervalId);
        intervalId = window.setInterval(() => {
          if (!sessionState || !sessionState.timerStartedAt || sessionState.timerQualifiedAt) {
            return;
          }

          const endsAt = new Date(sessionState.timerStartedAt).getTime() + sessionState.timerSeconds * 1000;
          const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
          renderTimer(remaining);
          stateEls.timerStatus.textContent = remaining > 0 ? "Return after the timer completes." : "Timer complete. You can check task status now.";
        }, 500);
      }

      function renderState() {
        if (!sessionState) {
          return;
        }

        stateEls.title.textContent = sessionState.taskTitle;
        stateEls.subtitle.textContent = sessionState.taskType === "maps_review"
          ? "Post review, upload screenshot proof, then finish the 30 second timer."
          : "Open the task in Chrome, stay there for 30 seconds, then come back here.";
        stateEls.description.textContent = sessionState.description;
        stateEls.returnButton.href = sessionState.returnToBotUrl;
        stateEls.browserNotice.hidden = !/Telegram/i.test(navigator.userAgent);

        if (sessionState.caption) {
          stateEls.captionCard.hidden = false;
          stateEls.captionText.textContent = sessionState.caption;
        } else {
          stateEls.captionCard.hidden = true;
        }

        if (sessionState.galleryImages && sessionState.galleryImages.length) {
          stateEls.galleryCard.hidden = false;
          stateEls.gallery.innerHTML = "";
          sessionState.galleryImages.forEach((image) => {
            const wrapper = document.createElement("a");
            wrapper.href = image.url;
            wrapper.target = "_blank";
            wrapper.rel = "noreferrer";
            const img = document.createElement("img");
            img.src = image.url;
            img.alt = sessionState.taskTitle + " reference";
            wrapper.appendChild(img);
            stateEls.gallery.appendChild(wrapper);
          });
        } else {
          stateEls.galleryCard.hidden = true;
        }

        renderTimer(sessionState.timerQualifiedAt ? 0 : sessionState.secondsRemaining ?? sessionState.timerSeconds);
        startLocalTicker();

        if (sessionState.taskType === "maps_review") {
          stateEls.visitButton.hidden = true;
          stateEls.startButton.hidden = !sessionState.proofUploaded || Boolean(sessionState.timerStartedAt) || Boolean(sessionState.timerQualifiedAt);
          if (!sessionState.proofUploaded) {
            setStatus("Telegram me screenshot proof upload karo. Proof ke baad yahan timer start hoga.", "warning");
          } else if (sessionState.timerQualifiedAt) {
            setStatus("Timer complete. Ab Telegram me reward claim karo.", "success");
          } else if (sessionState.timerStartedAt) {
            setStatus("Timer chal raha hai. 30 second complete hone ke baad finish button dabao.", "warning");
          } else {
            setStatus("Proof mil gaya. Ab 30 second timer start karo.", "warning");
          }
        } else {
          stateEls.startButton.hidden = true;
          stateEls.visitButton.hidden = false;
          if (sessionState.timerQualifiedAt) {
            setStatus("Browser visit qualify ho gaya. Screenshot proof bhej kar Telegram me reward claim karo.", "success");
          } else if (sessionState.timerStartedAt) {
            setStatus("Task browser me open ho chuka hai. 30 second ke baad yahan wapas aao.", "warning");
          } else {
            setStatus("Open task in browser दबाओ, 30 second wait karo, phir yahan return aao.", "warning");
          }
        }

        stateEls.returnButton.hidden = !sessionState.timerQualifiedAt;
      }

      async function loadState() {
        const response = await fetch("/api/public/task-session/" + encodeURIComponent(token));
        sessionState = await response.json();
        renderState();
      }

      async function postJson(path) {
        const response = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        return response.json();
      }

      stateEls.copyCaption.addEventListener("click", async () => {
        if (!sessionState || !sessionState.caption) {
          return;
        }

        try {
          await navigator.clipboard.writeText(sessionState.caption);
          setStatus("Caption copied. Ab ise review me paste kar sakte ho.", "success");
        } catch {
          setStatus("Clipboard blocked ho gaya. Caption manually copy kar lo.", "warning");
        }
      });

      stateEls.startButton.addEventListener("click", async () => {
        const result = await postJson("/api/public/task-session/" + encodeURIComponent(token) + "/start");
        sessionState.timerStartedAt = new Date().toISOString();
        sessionState.timerQualifiedAt = result.status === "qualified" ? new Date().toISOString() : null;
        sessionState.secondsRemaining = result.secondsRemaining;
        renderState();
      });

      stateEls.visitButton.addEventListener("click", async () => {
        const result = await postJson("/api/public/task-session/" + encodeURIComponent(token) + "/start");
        sessionState.timerStartedAt = new Date().toISOString();
        sessionState.secondsRemaining = result.secondsRemaining;
        window.open(sessionState.link, "_blank", "noopener,noreferrer");
        setStatus("Task browser me open ho gaya. 30 second ke baad yahan return karke check karo.", "warning");
        renderState();
      });

      stateEls.finishButton.addEventListener("click", async () => {
        const result = await postJson("/api/public/task-session/" + encodeURIComponent(token) + "/finish");
        if (result.status === "qualified") {
          sessionState.timerQualifiedAt = new Date().toISOString();
          sessionState.secondsRemaining = 0;
          setStatus("Timer complete. Ab Telegram me reward claim karo.", "success");
        } else {
          sessionState.secondsRemaining = result.secondsRemaining;
          setStatus("Abhi thoda aur time pending hai. Timer complete hone do.", "warning");
        }
        renderState();
      });

      void loadState();
    </script>
  </body>
</html>`;
}
