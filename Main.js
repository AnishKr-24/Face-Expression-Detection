class FaceMoodDetection {
  constructor() {
    this.video = document.getElementById("video");
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d");

    this.isModelLoaded = false;
    this.isCameraOn = false;
    this.isDetecting = false;
    this.stream = null;
    this.detectionInterval = null;
    this.faceDetected = false;

    this.emotionHistory = [];
    this.currentEmotion = null;

    this.lastSpokenEmotion = null; // 👈 new state

    this.emotionConfig = {
      happy: { color: "#10B981", emoji: "😊" },
      sad: { color: "#6B7280", emoji: "😢" },
      angry: { color: "#EF4444", emoji: "😠" },
      surprised: { color: "#F59E0B", emoji: "😲" },
      neutral: { color: "#8B5CF6", emoji: "😐" },
      fearful: { color: "#EC4899", emoji: "😨" },
      disgusted: { color: "#84CC16", emoji: "🤢" },
    };

    this.init();
    this.initBalaEffect(); // Bala Effect
    this.initFooter(); // 👈 Footer Add
    this.initThemeToggle(); // 👈 Theme Toggle Add
  }

  async init() {
    try {
      await this.loadModels();
      this.setupEventListeners();
      this.showMainApp();
    } catch (error) {
      this.showError(error.message);
    }
  }

  /* ---------------- Ey Bala Effect ---------------- */
  initBalaEffect() {
    document.addEventListener("mousemove", (e) => {
      const bala = document.createElement("div");
      bala.className = "bala-effect";
      bala.style.left = `${e.pageX}px`;
      bala.style.top = `${e.pageY}px`;
      document.body.appendChild(bala);

      setTimeout(() => bala.remove(), 800);
    });
  }
  /* ------------------------------------------------ */

  /* ---------------- Footer ---------------- */
  initFooter() {
    const footer = document.createElement("footer");
    footer.className = "app-footer";
    footer.innerHTML = `
      <p>© ${new Date().getFullYear()} Face Mood Detection | Made with ❤️</p>
    `;
    document.body.appendChild(footer);
  }
  /* ---------------------------------------- */

  /* ---------------- Theme Toggle ---------------- */
  initThemeToggle() {
    const toggleBtn = document.createElement("button");
    toggleBtn.id = "theme-toggle";
    toggleBtn.innerHTML = "🌙";
    toggleBtn.style.position = "fixed";
    toggleBtn.style.top = "10px";
    toggleBtn.style.right = "10px";
    toggleBtn.style.padding = "8px 12px";
    toggleBtn.style.border = "none";
    toggleBtn.style.borderRadius = "8px";
    toggleBtn.style.cursor = "pointer";
    toggleBtn.style.zIndex = "1000";
    toggleBtn.style.background = "#333";
    toggleBtn.style.color = "#fff";
    toggleBtn.style.fontSize = "18px";

    document.body.appendChild(toggleBtn);

    // Default Light Mode
    document.body.classList.add("light-theme");

    toggleBtn.addEventListener("click", () => {
      if (document.body.classList.contains("light-theme")) {
        document.body.classList.remove("light-theme");
        document.body.classList.add("dark-theme");
        toggleBtn.innerHTML = "☀️";
        toggleBtn.style.background = "#fff";
        toggleBtn.style.color = "#000";
      } else {
        document.body.classList.remove("dark-theme");
        document.body.classList.add("light-theme");
        toggleBtn.innerHTML = "🌙";
        toggleBtn.style.background = "#333";
        toggleBtn.style.color = "#fff";
      }
    });
  }
  /* ---------------------------------------- */

  async loadModels() {
    try {
      const MODEL_URL =
        "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);

      console.log("All models loaded successfully");
      this.isModelLoaded = true;
      this.updateAIStatus("ready", "Ready");
      this.enableCameraButton();
    } catch (error) {
      console.error("Error loading models:", error);
      throw new Error("Failed to load AI models. Please refresh the page.");
    }
  }

  setupEventListeners() {
    const cameraBtn = document.getElementById("camera-btn");
    cameraBtn.addEventListener("click", () => {
      if (this.isCameraOn) {
        this.stopCamera();
      } else {
        this.startCamera();
      }
    });

    this.video.addEventListener("loadedmetadata", () => {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
      this.startDetection();
    });
  }

  showMainApp() {
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("main-app").classList.remove("hidden");
  }

  showError(message) {
    document.getElementById("loading-screen").classList.add("hidden");
    document.getElementById("error-message").textContent = message;
    document.getElementById("error-screen").classList.remove("hidden");
  }

  updateAIStatus(status, text) {
    const statusDot = document.getElementById("ai-status");
    const statusText = document.getElementById("ai-status-text");

    statusDot.className = `status-dot ${status}`;
    statusText.textContent = text;
  }

  updateDetectionStatus(status, text) {
    const statusDot = document.getElementById("detection-status");
    const statusText = document.getElementById("detection-status-text");

    statusDot.className = `status-dot ${status}`;
    statusText.textContent = text;
  }

  enableCameraButton() {
    const cameraBtn = document.getElementById("camera-btn");
    cameraBtn.disabled = false;
    document.getElementById("placeholder-text").textContent = "Camera is off";
  }

  async startCamera() {
    try {
      this.hideError();

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      this.video.srcObject = this.stream;
      this.isCameraOn = true;

      this.updateCameraUI();
      this.updateDetectionStatus("active", "Active");
    } catch (error) {
      console.error("Error accessing camera:", error);
      this.showCameraError(
        "Camera access denied. Please allow camera permissions."
      );
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    this.isCameraOn = false;
    this.isDetecting = false;
    this.faceDetected = false;
    this.currentEmotion = null;

    this.updateCameraUI();
    this.updateDetectionStatus("inactive", "Inactive");
    this.updateCurrentEmotion(null);
    this.hideFaceStatus();
    this.hideError();

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  updateCameraUI() {
    const cameraBtn = document.getElementById("camera-btn");
    const btnIcon = cameraBtn.querySelector(".btn-icon");
    const btnText = cameraBtn.querySelector(".btn-text");
    const video = document.getElementById("video");
    const placeholder = document.getElementById("camera-placeholder");

    if (this.isCameraOn) {
      cameraBtn.classList.add("stop");
      btnIcon.textContent = "📷";
      btnText.textContent = "Stop Camera";
      video.classList.add("active");
      placeholder.style.display = "none";
    } else {
      cameraBtn.classList.remove("stop");
      btnIcon.textContent = "📷";
      btnText.textContent = "Start Camera";
      video.classList.remove("active");
      placeholder.style.display = "flex";
    }
  }

  startDetection() {
    if (this.isDetecting) return;

    this.isDetecting = true;
    this.detectionInterval = setInterval(() => {
      this.detectEmotion();
    }, 200);
  }

  async detectEmotion() {
    if (!this.video || !this.canvas || !this.isCameraOn || !this.isModelLoaded)
      return;

    if (this.video.readyState !== 4) return;

    try {
      const displaySize = {
        width: this.video.videoWidth,
        height: this.video.videoHeight,
      };
      faceapi.matchDimensions(this.canvas, displaySize);

      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.3,
      });

      const detection = await faceapi
        .detectSingleFace(this.video, detectionOptions)
        .withFaceLandmarks()
        .withFaceExpressions();

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      if (detection) {
        this.faceDetected = true;
        this.showFaceStatus();

        const resizedDetection = faceapi.resizeResults(detection, displaySize);

        this.ctx.strokeStyle = "#10B981";
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(
          resizedDetection.detection.box.x,
          resizedDetection.detection.box.y,
          resizedDetection.detection.box.width,
          resizedDetection.detection.box.height
        );

        const landmarks = resizedDetection.landmarks;
        this.ctx.fillStyle = "#10B981";
        landmarks.positions.forEach((point) => {
          this.ctx.beginPath();
          this.ctx.arc(point.x, point.y, 1, 0, 2 * Math.PI);
          this.ctx.fill();
        });

        const expressions = detection.expressions;
        const sortedExpressions = Object.entries(expressions).sort(
          ([, a], [, b]) => b - a
        );

        const [maxExpression, confidence] = sortedExpressions[0];

        if (confidence > 0.1) {
          const emotionData = {
            emotion: maxExpression,
            confidence: confidence,
            timestamp: Date.now(),
          };

          this.currentEmotion = emotionData;
          this.updateCurrentEmotion(emotionData);
          this.addToHistory(emotionData);

          this.speakEmotion(emotionData.emotion); // 👈 Voice Feature
        }
      } else {
        this.faceDetected = false;
        this.hideFaceStatus();

        setTimeout(() => {
          if (!this.faceDetected) {
            this.updateCurrentEmotion(null);
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Detection error:", error);
    }
  }

  /* ---------------- Voice Feedback Feature ---------------- */
  speakEmotion(emotion) {
    if (this.lastSpokenEmotion === emotion) return; // avoid repetition
    this.lastSpokenEmotion = emotion;

    const msg = new SpeechSynthesisUtterance(`You look ${emotion}`);
    msg.lang = "en-US";
    msg.rate = 1; // speed
    msg.pitch = 1; // tone
    window.speechSynthesis.speak(msg);
  }
  /* -------------------------------------------------------- */

  updateCurrentEmotion(emotionData) {
    const emotionIcon = document.querySelector(".emotion-icon");
    const emotionName = document.querySelector(".emotion-name");
    const confidenceFill = document.querySelector(".confidence-fill");
    const confidenceText = document.querySelector(".confidence-text");

    if (emotionData) {
      const config = this.emotionConfig[emotionData.emotion];
      const confidence = (emotionData.confidence * 100).toFixed(1);

      emotionIcon.style.backgroundColor = config.color + "20";
      emotionIcon.style.borderColor = config.color;
      emotionIcon.style.boxShadow = `0 0 20px ${config.color}40`;
      emotionIcon.textContent = config.emoji;

      emotionName.textContent = emotionData.emotion;
      emotionName.style.color = "white";

      confidenceFill.style.backgroundColor = config.color;
      confidenceFill.style.width = `${confidence}%`;

      confidenceText.textContent = `${confidence}% confidence`;

      document.getElementById(
        "current-accuracy"
      ).textContent = `${confidence}%`;
    } else {
      emotionIcon.style.backgroundColor = "rgba(139, 92, 246, 0.2)";
      emotionIcon.style.borderColor = "#8b5cf6";
      emotionIcon.style.boxShadow = "none";
      emotionIcon.textContent = "🤖";

      emotionName.textContent = this.faceDetected
        ? "Analyzing..."
        : "No face detected";
      emotionName.style.color = "#9ca3af";

      confidenceFill.style.width = "0%";
      confidenceText.textContent = "0% confidence";

      document.getElementById("current-accuracy").textContent = "0%";
    }
  }

  addToHistory(emotionData) {
    this.emotionHistory.push(emotionData);

    if (this.emotionHistory.length > 20) {
      this.emotionHistory = this.emotionHistory.slice(-20);
    }

    this.updateHistoryUI();
    this.updateStats();
  }

  updateHistoryUI() {
    const historyContainer = document.getElementById("emotion-history");

    if (this.emotionHistory.length === 0) {
      historyContainer.innerHTML =
        '<p class="no-data">No emotions detected yet</p>';
      return;
    }

    const recentEmotions = this.emotionHistory.slice(-6).reverse();

    historyContainer.innerHTML = recentEmotions
      .map((emotion) => {
        const config = this.emotionConfig[emotion.emotion];
        const confidence = (emotion.confidence * 100).toFixed(0);

        return `
                <div class="emotion-item">
                    <div class="emotion-info">
                        <span class="emotion-emoji">${config.emoji}</span>
                        <span class="emotion-label">${emotion.emotion}</span>
                    </div>
                    <span class="emotion-confidence">${confidence}%</span>
                </div>
            `;
      })
      .join("");
  }

  updateStats() {
    document.getElementById("total-detections").textContent =
      this.emotionHistory.length;

    if (this.emotionHistory.length > 0) {
      const recentEmotions = this.emotionHistory.slice(-10);
      const emotionCounts = recentEmotions.reduce((acc, emotion) => {
        acc[emotion.emotion] = (acc[emotion.emotion] || 0) + 1;
        return acc;
      }, {});

      const mostFrequent = Object.entries(emotionCounts).sort(
        ([, a], [, b]) => b - a
      )[0];

      if (mostFrequent) {
        document.getElementById("frequent-emotion-name").textContent =
          mostFrequent[0];
        document.getElementById("most-frequent").classList.remove("hidden");
      }
    }
  }

  showFaceStatus() {
    document.getElementById("face-status").classList.remove("hidden");
  }

  hideFaceStatus() {
    document.getElementById("face-status").classList.add("hidden");
  }

  showCameraError(message) {
    document.getElementById("camera-error-text").textContent = message;
    document.getElementById("camera-error").classList.remove("hidden");
    document.getElementById("camera-placeholder").style.display = "none";
  }

  hideError() {
    document.getElementById("camera-error").classList.add("hidden");
    if (!this.isCameraOn) {
      document.getElementById("camera-placeholder").style.display = "flex";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new FaceMoodDetection();
});
