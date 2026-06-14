const state = {
  query: "",
  platform: "全部",
  category: "全部",
  value: "全部",
  date: "全部",
  sort: "priority",
  selected: null,
};

const videos = window.VIDEO_DASHBOARD_DATA || [];
const fallbackCovers = {
  Bilibili: "linear-gradient(135deg, #173247, #28c7df)",
  Douyin: "linear-gradient(135deg, #151c24, #fe2c55 52%, #25f4ee)",
  YouTube: "linear-gradient(135deg, #2a1517, #ff0033)",
};
const els = {
  search: document.querySelector("#searchInput"),
  platforms: document.querySelector("#platformFilters"),
  categories: document.querySelector("#categoryFilters"),
  values: document.querySelector("#valueFilters"),
  dates: document.querySelector("#dateFilters"),
  list: document.querySelector("#videoList"),
  statCount: document.querySelector("#statCount"),
  statHours: document.querySelector("#statHours"),
  statHigh: document.querySelector("#statHigh"),
  statTranscript: document.querySelector("#statTranscript"),
  sortPriority: document.querySelector("#sortPriority"),
  sortViews: document.querySelector("#sortViews"),
  sortDuration: document.querySelector("#sortDuration"),
  themeToggle: document.querySelector("#themeToggle"),
  themeText: document.querySelector("#themeText"),
  cover: document.querySelector("#detailCover"),
  valueBadge: document.querySelector("#detailValue"),
  category: document.querySelector("#detailCategory"),
  duration: document.querySelector("#detailDuration"),
  title: document.querySelector("#detailTitle"),
  author: document.querySelector("#detailAuthor"),
  link: document.querySelector("#detailLink"),
  summary: document.querySelector("#detailSummary"),
  keyPoints: document.querySelector("#detailKeyPoints"),
  namedItemsSection: document.querySelector("#namedItemsSection"),
  namedItems: document.querySelector("#detailNamedItems"),
  tools: document.querySelector("#detailTools"),
  actions: document.querySelector("#detailActions"),
  risks: document.querySelector("#detailRisks"),
  transcript: document.querySelector("#transcriptPreview"),
  copy: document.querySelector("#copySummary"),
  closeDetail: document.querySelector("#closeDetail"),
  detail: document.querySelector(".detail"),
};

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem("videoDashboardTheme", theme);
  els.themeText.textContent = theme === "dark" ? "暗色" : "亮色";
  els.themeToggle.querySelector(".theme-icon").textContent = theme === "dark" ? "☾" : "☼";
}

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function compactNumber(value) {
  const number = Number(value || 0);
  if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万`;
  return String(number);
}

function valueClass(value) {
  if (value === "高") return "high";
  if (value === "中") return "mid";
  return "low";
}

function coverFallbackLabel(video) {
  if (video.platform === "Bilibili") return "B站";
  if (video.platform === "Douyin") return "抖音";
  if (video.platform === "YouTube") return "YT";
  return video.platform || "视频";
}

function fallbackCoverMarkup(video, className = "thumb-placeholder") {
  const gradient = fallbackCovers[video.platform] || "linear-gradient(135deg, #203340, #485968)";
  return `<div class="${className}" style="background:${gradient}"><span>${coverFallbackLabel(video)}</span></div>`;
}

function getFilteredVideos() {
  const query = state.query.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  return videos
    .filter((video) => state.category === "全部" || video.category === state.category)
    .filter((video) => state.platform === "全部" || video.platform === state.platform)
    .filter((video) => state.value === "全部" || video.value === state.value)
    .filter((video) => {
      if (state.date === "今日更新") {
        return video.date_added === today;
      }
      return true;
    })
    .filter((video) => {
      if (!query) return true;
      return [
        video.title,
        video.author,
        video.summary,
        video.category,
        video.platform,
        ...(video.tools || []),
        ...(video.keyPoints || []),
      ].join(" ").toLowerCase().includes(query);
    })
    .sort((a, b) => {
      if (state.sort === "views") return Number(b.views || 0) - Number(a.views || 0);
      if (state.sort === "duration") return Number(b.duration || 0) - Number(a.duration || 0);
      return Number(a.priority || 99) - Number(b.priority || 99);
    });
}

function renderFilterButtons(container, values, current, onClick) {
  container.innerHTML = "";
  const today = new Date().toISOString().slice(0, 10);
  values.forEach((value) => {
    const count = value === "全部" ? videos.length : videos.filter((video) => {
      if (value === "今日更新") return video.date_added === today;
      return video.category === value || video.value === value || video.platform === value;
    }).length;
    const button = document.createElement("button");
    button.className = `filter-button${current === value ? " active" : ""}`;
    button.type = "button";
    button.innerHTML = `<span>${value}</span><span>${count}</span>`;
    button.addEventListener("click", () => onClick(value));
    container.appendChild(button);
  });
}

function renderFilters() {
  const platforms = ["全部", ...new Set(videos.map((video) => video.platform))];
  const categories = ["全部", ...new Set(videos.map((video) => video.category))];
  const values = ["全部", "高", "中", "低"];
  const dates = ["全部", "今日更新"];
  renderFilterButtons(els.platforms, platforms, state.platform, (value) => {
    state.platform = value;
    render();
  });
  renderFilterButtons(els.categories, categories, state.category, (value) => {
    state.category = value;
    render();
  });
  renderFilterButtons(els.values, values, state.value, (value) => {
    state.value = value;
    render();
  });
  renderFilterButtons(els.dates, dates, state.date, (value) => {
    state.date = value;
    render();
  });
}

function renderStats(filtered) {
  const duration = filtered.reduce((sum, video) => sum + Number(video.duration || 0), 0);
  els.statCount.textContent = filtered.length;
  els.statHours.textContent = `${(duration / 3600).toFixed(1)}h`;
  els.statHigh.textContent = filtered.filter((video) => video.value === "高").length;
  els.statTranscript.textContent = filtered.filter((video) => video.transcript).length;
}

function renderList(filtered) {
  els.list.innerHTML = "";
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "没有匹配的视频";
    els.list.appendChild(empty);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  filtered.forEach((video) => {
    const card = document.createElement("article");
    card.className = `video-card${state.selected?.bvid === video.bvid ? " active" : ""}`;
    card.tabIndex = 0;
    const isNew = video.date_added === today;
    const newBadge = isNew ? `<span class="badge-new">NEW</span> ` : "";
    const thumb = video.cover
      ? `<img src="${video.cover}" alt="" loading="lazy" onerror="this.replaceWith(this.closest('.thumb').querySelector('template').content.cloneNode(true))" /><template>${fallbackCoverMarkup(video)}</template>`
      : fallbackCoverMarkup(video);
    card.innerHTML = `
      <div class="thumb">
        ${thumb}
        <span class="duration">${formatDuration(video.duration)}</span>
      </div>
      <div class="card-main">
        <h3 class="card-title">${newBadge}${video.title}</h3>
        <div class="card-meta">
          <span>${video.author}</span>
          <span>${video.platform}</span>
          <span>${compactNumber(video.views)} 播放</span>
          <span>${compactNumber(video.favorites)} 收藏</span>
        </div>
        <p class="card-summary">${video.summary}</p>
        <div class="chips">
          <span class="chip">${video.category}</span>
          <span class="chip ${valueClass(video.value)}">${video.value}价值</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => selectVideo(video));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") selectVideo(video);
    });
    els.list.appendChild(card);
  });
}

async function loadTranscript(video) {
  els.transcript.textContent = "加载中...";
  if (!video.transcript) {
    els.transcript.textContent = "暂无转写稿";
    return;
  }
  try {
    const response = await fetch(video.transcript);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    els.transcript.textContent = text.slice(0, 2400).trim() || "暂无转写内容";
  } catch (error) {
    els.transcript.textContent = `转写稿读取失败：${error.message}`;
  }
}

function renderListItems(container, items) {
  container.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    container.appendChild(li);
  });
}

function renderChips(container, items) {
  container.innerHTML = "";
  items.forEach((item) => {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = item;
    container.appendChild(span);
  });
}

function renderNamedItems(video) {
  const items = video.namedItems || [];
  els.namedItemsSection.style.display = items.length ? "" : "none";
  els.namedItems.innerHTML = "";
  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "named-item";
    div.innerHTML = `
      <strong>${item.name}</strong>
      <p>${item.role || ""}</p>
      <small>置信度：${item.confidence || "medium"}${item.note ? ` · ${item.note}` : ""}</small>
    `;
    els.namedItems.appendChild(div);
  });
}

function selectVideo(video) {
  state.selected = video;
  if (video.cover) {
    els.cover.style.display = "";
    els.cover.src = video.cover;
    els.cover.alt = video.title;
  } else {
    els.cover.removeAttribute("src");
    els.cover.alt = "";
    els.cover.style.display = "none";
  }
  els.valueBadge.textContent = `${video.value}价值`;
  els.category.textContent = video.category;
  els.duration.textContent = formatDuration(video.duration);
  els.title.textContent = video.title;
  els.author.textContent = `UP：${video.author} · ${compactNumber(video.views)} 播放 · ${compactNumber(video.favorites)} 收藏`;
  els.link.href = video.url;
  els.summary.textContent = video.summary;
  els.risks.textContent = Array.isArray(video.risks) ? video.risks.join("；") : (video.risks || "");
  renderListItems(els.keyPoints, video.keyPoints || []);
  renderListItems(els.actions, video.actions || []);
  renderNamedItems(video);
  renderChips(els.tools, video.tools || []);
  loadTranscript(video);
  els.detail.classList.add("active");
  renderList(getFilteredVideos());
}

function setSort(sort) {
  state.sort = sort;
  [els.sortPriority, els.sortViews, els.sortDuration].forEach((button) => button.classList.remove("active"));
  if (sort === "priority") els.sortPriority.classList.add("active");
  if (sort === "views") els.sortViews.classList.add("active");
  if (sort === "duration") els.sortDuration.classList.add("active");
  render();
}

function render() {
  const filtered = getFilteredVideos();
  renderFilters();
  renderStats(filtered);
  renderList(filtered);
  if (!state.selected || !filtered.some((video) => video.bvid === state.selected?.bvid)) {
    selectVideo(filtered[0] || videos[0]);
  }
}

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

els.sortPriority.addEventListener("click", () => setSort("priority"));
els.sortViews.addEventListener("click", () => setSort("views"));
els.sortDuration.addEventListener("click", () => setSort("duration"));
els.themeToggle.addEventListener("click", () => {
  applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
});
els.copy.addEventListener("click", async () => {
  if (!state.selected) return;
  const text = `${state.selected.title}\n\n${state.selected.summary}\n\n${(state.selected.keyPoints || []).map((item) => `- ${item}`).join("\n")}`;
  await navigator.clipboard.writeText(text);
  els.copy.textContent = "已复制";
  window.setTimeout(() => {
    els.copy.textContent = "复制摘要";
  }, 1200);
});

els.closeDetail.addEventListener("click", () => {
  els.detail.classList.remove("active");
});

applyTheme(localStorage.getItem("videoDashboardTheme") || "dark");
const initialSelect = new URLSearchParams(window.location.search).get("select");
const initialVideo = initialSelect ? videos.find((video) => video.bvid === initialSelect) || null : null;
state.selected = null;
render();
if (initialVideo) selectVideo(initialVideo);
