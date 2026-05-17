const BUFFER_STORAGE_KEY = "pikminMushroomBufferMinutes";
const FINISHED_VISIBLE_STORAGE_KEY = "pikminMushroomFinishedVisibleSeconds";
const NAME_TAGS_STORAGE_KEY = "pikminMushroomNameTags";
const DEFAULT_BUFFER_MINUTES = 4;
const DEFAULT_FINISHED_VISIBLE_SECONDS = 15;
const MAX_NAME_TAGS = 10;
const CARD_BACKGROUNDS = [
  "images/card/card01.png",
  "images/card/card02.png",
  "images/card/card03.png",
  "images/card/card04.png",
  "images/card/card05.png",
  "images/card/card06.png"
];

const timerForm = document.querySelector("#timer-form");
const mushroomNameInput = document.querySelector("#mushroom-name");
const minutesInput = document.querySelector("#minutes");
const bufferInput = document.querySelector("#buffer-minutes");
const finishedVisibleInput = document.querySelector("#finished-visible-seconds");
const nameTags = document.querySelector("#name-tags");
const timersList = document.querySelector("#timers-list");
const timerCount = document.querySelector("#timer-count");
const formError = document.querySelector("#form-error");
const timerTemplate = document.querySelector("#timer-card-template");

let timers = [];
let tickerId = null;
let savedNameTags = [];

function createTimerId() {
  // Use crypto when available, then fall back for older or file-based browsers.
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `timer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStoredBufferMinutes() {
  const storedValue = Number(localStorage.getItem(BUFFER_STORAGE_KEY));
  return Number.isFinite(storedValue) && storedValue > 0 ? storedValue : DEFAULT_BUFFER_MINUTES;
}

function saveBufferMinutes(value) {
  localStorage.setItem(BUFFER_STORAGE_KEY, String(value));
}

function getStoredFinishedVisibleSeconds() {
  const storedValue = Number(localStorage.getItem(FINISHED_VISIBLE_STORAGE_KEY));
  return Number.isFinite(storedValue) && storedValue > 0 ? storedValue : DEFAULT_FINISHED_VISIBLE_SECONDS;
}

function saveFinishedVisibleSeconds(value) {
  localStorage.setItem(FINISHED_VISIBLE_STORAGE_KEY, String(value));
}

function getStoredNameTags() {
  try {
    const parsedTags = JSON.parse(localStorage.getItem(NAME_TAGS_STORAGE_KEY));
    if (!Array.isArray(parsedTags)) {
      return [];
    }

    return parsedTags
      .filter((tag) => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, MAX_NAME_TAGS);
  } catch {
    return [];
  }
}

function saveNameTags(tags) {
  localStorage.setItem(NAME_TAGS_STORAGE_KEY, JSON.stringify(tags));
}

function renderNameTags() {
  nameTags.innerHTML = "";

  savedNameTags.forEach((tag) => {
    const tagItem = document.createElement("span");
    const applyButton = document.createElement("button");
    const removeButton = document.createElement("button");

    tagItem.className = "name-tag";
    applyButton.className = "name-tag__label";
    applyButton.type = "button";
    applyButton.textContent = tag;
    applyButton.addEventListener("click", () => {
      mushroomNameInput.value = tag;
      mushroomNameInput.focus();
    });

    removeButton.className = "name-tag__remove";
    removeButton.type = "button";
    removeButton.textContent = "x";
    removeButton.setAttribute("aria-label", `移除 ${tag}`);
    removeButton.addEventListener("click", () => {
      removeNameTag(tag);
    });

    tagItem.append(applyButton, removeButton);
    nameTags.append(tagItem);
  });
}

function removeNameTag(tagToRemove) {
  savedNameTags = savedNameTags.filter((tag) => tag !== tagToRemove);
  saveNameTags(savedNameTags);
  renderNameTags();
}

function rememberNameTag(name) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return;
  }

  savedNameTags = [
    trimmedName,
    ...savedNameTags.filter((tag) => tag !== trimmedName)
  ].slice(0, MAX_NAME_TAGS);

  saveNameTags(savedNameTags);
  renderNameTags();
}

function getFinishedVisibleMs() {
  const seconds = sanitizeNumber(finishedVisibleInput.value, 300, DEFAULT_FINISHED_VISIBLE_SECONDS, 1);
  finishedVisibleInput.value = seconds;
  return seconds * 1000;
}

function getRandomCardBackground() {
  const index = Math.floor(Math.random() * CARD_BACKGROUNDS.length);
  return CARD_BACKGROUNDS[index];
}

function sanitizeNumber(value, max = Infinity, fallback = 0, min = 0) {
  if (value === "") {
    return fallback;
  }

  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(Math.max(number, min), max);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${pad(minutes)}:${pad(seconds)}`;
}

function getInputSeconds() {
  const minutes = sanitizeNumber(minutesInput.value, 999);
  minutesInput.value = minutes;

  return minutes * 60;
}

function getBufferSeconds() {
  const bufferMinutes = sanitizeNumber(bufferInput.value, 120, DEFAULT_BUFFER_MINUTES, 1);
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

function getSortedTimers() {
  return [...timers].sort((firstTimer, secondTimer) => {
    const firstFinished = Boolean(firstTimer.finishedAt);
    const secondFinished = Boolean(secondTimer.finishedAt);

    if (firstFinished !== secondFinished) {
      return firstFinished ? 1 : -1;
    }

    if (firstFinished && secondFinished) {
      return firstTimer.finishedAt - secondTimer.finishedAt;
    }

    return firstTimer.endsAt - secondTimer.endsAt;
  });
}

function sortTimerCards() {
  getSortedTimers().forEach((timer) => {
    const card = timersList.querySelector(`[data-timer-id="${timer.id}"]`);
    if (card) {
      timersList.append(card);
    }
  });
}

function createTimerCard(timer) {
  const card = timerTemplate.content.firstElementChild.cloneNode(true);

  card.dataset.timerId = timer.id;
  card.style.setProperty("--card-bg", `url("${timer.cardBackground}")`);
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
  emptyState.textContent = "新增一個正在覬覦的蘑菇倒數吧嘿嘿！";
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
  card.classList.toggle("is-ending-soon", remainingSeconds > 0 && remainingSeconds <= 60);

  if (remainingSeconds === 0) {
    if (!timer.finishedAt) {
      timer.finishedAt = now;
      window.setTimeout(() => removeTimer(timer.id), getFinishedVisibleMs());
      sortTimerCards();
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
  sortTimerCards();
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

  const name = mushroomNameInput.value.trim() || "蘑菇 🍄";
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
    cardBackground: getRandomCardBackground(),
    endsAt: Date.now() + (originalSeconds + bufferSeconds) * 1000,
    finishedAt: null
  };

  removeEmptyState();
  rememberNameTag(name);
  timers.push(timer);
  createTimerCard(timer);
  updateCard(timer, Date.now());
  sortTimerCards();
  updateTimerCount();
  manageTicker();

  timerForm.reset();
  minutesInput.value = 10;
  bufferInput.value = sanitizeNumber(bufferInput.value, 120, DEFAULT_BUFFER_MINUTES, 1);
  finishedVisibleInput.value = sanitizeNumber(finishedVisibleInput.value, 300, DEFAULT_FINISHED_VISIBLE_SECONDS, 1);
  mushroomNameInput.focus();
}

function initializeSettings() {
  bufferInput.value = getStoredBufferMinutes();
  finishedVisibleInput.value = getStoredFinishedVisibleSeconds();
  savedNameTags = getStoredNameTags();
  renderNameTags();

  bufferInput.addEventListener("change", () => {
    const bufferMinutes = sanitizeNumber(bufferInput.value, 120, DEFAULT_BUFFER_MINUTES, 1);
    bufferInput.value = bufferMinutes;
    saveBufferMinutes(bufferMinutes);
  });

  finishedVisibleInput.addEventListener("change", () => {
    const visibleSeconds = sanitizeNumber(finishedVisibleInput.value, 300, DEFAULT_FINISHED_VISIBLE_SECONDS, 1);
    finishedVisibleInput.value = visibleSeconds;
    saveFinishedVisibleSeconds(visibleSeconds);
  });
}

initializeSettings();
timerForm.addEventListener("submit", addTimer);
renderEmptyState();
updateTimerCount();
