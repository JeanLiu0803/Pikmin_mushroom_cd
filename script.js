const STORAGE_KEY = "pikminMushroomBufferMinutes";
const DEFAULT_BUFFER_MINUTES = 4;
const FINISHED_VISIBLE_MS = 15000;

const timerForm = document.querySelector("#timer-form");
const mushroomNameInput = document.querySelector("#mushroom-name");
const minutesInput = document.querySelector("#minutes");
const bufferInput = document.querySelector("#buffer-minutes");
const timersList = document.querySelector("#timers-list");
const timerCount = document.querySelector("#timer-count");
const formError = document.querySelector("#form-error");
const timerTemplate = document.querySelector("#timer-card-template");

let timers = [];
let tickerId = null;

function createTimerId() {
  // Use crypto when available, then fall back for older or file-based browsers.
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `timer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStoredBufferMinutes() {
  const storedValue = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(storedValue) && storedValue >= 0 ? storedValue : DEFAULT_BUFFER_MINUTES;
}

function saveBufferMinutes(value) {
  localStorage.setItem(STORAGE_KEY, String(value));
}

function sanitizeNumber(value, max = Infinity) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(number, max);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}分 ${pad(seconds)}秒`;
}

function getInputSeconds() {
  const minutes = sanitizeNumber(minutesInput.value, 999);
  minutesInput.value = minutes;

  return minutes * 60;
}

function getBufferSeconds() {
  const bufferMinutes = sanitizeNumber(bufferInput.value, 120);
  bufferInput.value = bufferMinutes;
  return bufferMinutes * 60;
}

function updateTimerCount() {
  const runningCount = timers.filter((timer) => !timer.finishedAt).length;
  const finishedCount = timers.length - runningCount;

  if (timers.length === 0) {
    timerCount.textContent = "目前沒有倒數計時。";
    return;
  }

  timerCount.textContent = `進行中 ${runningCount} 個，完成待移除 ${finishedCount} 個。`;
}

function createTimerCard(timer) {
  const card = timerTemplate.content.firstElementChild.cloneNode(true);

  card.dataset.timerId = timer.id;
  card.querySelector(".timer-card__name").textContent = timer.name;

  card.querySelector(".delete-button").addEventListener("click", () => {
    removeTimer(timer.id);
  });

  timersList.append(card);
}

function renderEmptyState() {
  if (timers.length > 0 || timersList.querySelector(".empty-state")) {
    return;
  }

  const emptyState = document.createElement("div");
  emptyState.className = "empty-state";
  emptyState.textContent = "還沒有派出的 Pikmin 小隊，新增一個蘑菇倒數吧。";
  timersList.append(emptyState);
}

function removeEmptyState() {
  timersList.querySelector(".empty-state")?.remove();
}

function removeTimer(timerId) {
  timers = timers.filter((timer) => timer.id !== timerId);
  timersList.querySelector(`[data-timer-id="${timerId}"]`)?.remove();
  updateTimerCount();
  renderEmptyState();
  manageTicker();
}

function updateCard(timer, now) {
  const card = timersList.querySelector(`[data-timer-id="${timer.id}"]`);
  if (!card) {
    return;
  }

  const remainingSeconds = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
  card.querySelector(".countdown-time").textContent = formatDuration(remainingSeconds);

  if (remainingSeconds === 0) {
    if (!timer.finishedAt) {
      timer.finishedAt = now;
      window.setTimeout(() => removeTimer(timer.id), FINISHED_VISIBLE_MS);
    }

    card.classList.add("is-finished");
    card.querySelector(".timer-card__status").textContent = "finished";
  } else {
    card.querySelector(".timer-card__status").textContent = "running";
  }
}

function tick() {
  const now = Date.now();
  timers.forEach((timer) => updateCard(timer, now));
  updateTimerCount();
  manageTicker();
}

function manageTicker() {
  const hasActiveTimers = timers.some((timer) => !timer.finishedAt);

  if (hasActiveTimers && tickerId === null) {
    tickerId = window.setInterval(tick, 1000);
  }

  if (!hasActiveTimers && tickerId !== null) {
    window.clearInterval(tickerId);
    tickerId = null;
  }
}

function addTimer(event) {
  event.preventDefault();
  formError.textContent = "";

  const name = mushroomNameInput.value.trim() || "蘑菇";
  const originalSeconds = getInputSeconds();
  const bufferSeconds = getBufferSeconds();

  if (originalSeconds <= 0) {
    formError.textContent = "剩餘分鐘至少要大於 0。";
    minutesInput.focus();
    return;
  }

  const timer = {
    id: createTimerId(),
    name,
    originalSeconds,
    bufferSeconds,
    endsAt: Date.now() + (originalSeconds + bufferSeconds) * 1000,
    finishedAt: null
  };

  removeEmptyState();
  timers.push(timer);
  createTimerCard(timer);
  updateCard(timer, Date.now());
  updateTimerCount();
  manageTicker();

  timerForm.reset();
  minutesInput.value = 10;
  mushroomNameInput.focus();
}

function initializeSettings() {
  bufferInput.value = getStoredBufferMinutes();

  bufferInput.addEventListener("change", () => {
    const bufferMinutes = sanitizeNumber(bufferInput.value, 120);
    bufferInput.value = bufferMinutes;
    saveBufferMinutes(bufferMinutes);
  });
}

initializeSettings();
timerForm.addEventListener("submit", addTimer);
renderEmptyState();
updateTimerCount();
