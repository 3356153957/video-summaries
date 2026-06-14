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
  Bilibili: "linear-gradient(135deg, #fb7299, #fc9bb8)",
  Douyin: "linear-gradient(135deg, #161823, #25f4ee)",
  YouTube: "linear-gradient(135deg, #ff0000, #ff5c5c)",
};

const platformSvgs = {
  Bilibili: `<svg class="logo-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 2c.4 0 .8.2 1 .5l2.7 3.5c.3.5.2 1.1-.3 1.4-.2.1-.4.2-.6.2H3.4c-.6 0-1-.4-1-1 0-.2.1-.4.2-.6L5.3 2.5c.2-.3.6-.5 1-.5h11.5zM3 9h18c.6 0 1 .4 1 1v9.5c0 1.9-1.6 3.5-3.5 3.5H5.5C3.6 23 2 21.4 2 19.5V10c0-.6.4-1 1-1zm3 4.5c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5zm12 0c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5z"/></svg>`,
  Douyin: `<svg class="logo-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 0v15.3c-.6-.4-1.3-.7-2.1-.7-2.4 0-4.4 2-4.4 4.4s2 4.4 4.4 4.4c2.3 0 4.2-1.8 4.4-4.1V7.1c1.8 1.3 4 2.1 6.4 2.2v-4c-3 0-5.4-1.9-5.9-4.6h-2.8z"/></svg>`,
  YouTube: `<svg class="logo-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11C4.483 20.455 12 20.455 12 20.455s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
};

window.handleImageError = function(img) {
  const thumb = img.closest(".thumb");
  if (thumb) {
    const template = thumb.querySelector("template");
    if (template) {
      img.replaceWith(template.content.cloneNode(true));
    }
  }
};

function getCoverUrl(cover) {
  if (!cover) return "";
  if (cover.startsWith("./covers/") && window.location.hostname.includes("github.io")) {
    return cover.replace("./covers/", "https://raw.githubusercontent.com/3356153957/video-summaries/master/dashboard/covers/");
  }
  return cover;
}

function getPlatformIcon(platform) {
  if (platform === "Bilibili") {
    return `<svg class="platform-icon" viewBox="0 0 24 24" style="color:#fb7299"><path d="M17.8 2c.4 0 .8.2 1 .5l2.7 3.5c.3.5.2 1.1-.3 1.4-.2.1-.4.2-.6.2H3.4c-.6 0-1-.4-1-1 0-.2.1-.4.2-.6L5.3 2.5c.2-.3.6-.5 1-.5h11.5zM3 9h18c.6 0 1 .4 1 1v9.5c0 1.9-1.6 3.5-3.5 3.5H5.5C3.6 23 2 21.4 2 19.5V10c0-.6.4-1 1-1zm3 4.5c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5zm12 0c-.8 0-1.5.7-1.5 1.5s.7 1.5 1.5 1.5 1.5-.7 1.5-1.5-.7-1.5-1.5-1.5z"/></svg>`;
  }
  if (platform === "Douyin") {
    return `<svg class="platform-icon" viewBox="0 0 24 24" style="color:var(--text-pure)"><path d="M11.5 0v15.3c-.6-.4-1.3-.7-2.1-.7-2.4 0-4.4 2-4.4 4.4s2 4.4 4.4 4.4c2.3 0 4.2-1.8 4.4-4.1V7.1c1.8 1.3 4 2.1 6.4 2.2v-4c-3 0-5.4-1.9-5.9-4.6h-2.8z"/></svg>`;
  }
  if (platform === "YouTube") {
    return `<svg class="platform-icon" viewBox="0 0 24 24" style="color:#ff0000"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11C4.483 20.455 12 20.455 12 20.455s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;
  }
  return "";
}
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
  platform: document.querySelector("#detailPlatform"),
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
  const svg = platformSvgs[video.platform] || "";
  return `<div class="${className}" style="background:${gradient}">${svg}</div>`;
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

    const isPlatform = container.id === "platformFilters";
    const iconMarkup = isPlatform ? getPlatformIcon(value) : "";
    const labelMarkup = iconMarkup 
      ? `<span class="filter-label">${iconMarkup}<span>${value}</span></span>`
      : `<span>${value}</span>`;

    button.innerHTML = `${labelMarkup}<span>${count}</span>`;
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
    const coverUrl = getCoverUrl(video.cover);
    const thumb = coverUrl
      ? `<img src="${coverUrl}" alt="" loading="lazy" onerror="window.handleImageError(this)" /><template>${fallbackCoverMarkup(video)}</template>`
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
          <span>${getPlatformIcon(video.platform)}${video.platform}</span>
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
    els.cover.src = getCoverUrl(video.cover);
    els.cover.alt = video.title;
  } else {
    els.cover.removeAttribute("src");
    els.cover.alt = "";
    els.cover.style.display = "none";
  }
  els.valueBadge.textContent = `${video.value}价值`;
  els.platform.innerHTML = `${getPlatformIcon(video.platform)}${video.platform}`;
  els.category.textContent = video.category;
  els.duration.textContent = formatDuration(video.duration);
  els.title.textContent = video.title;
  const authorPrefix = video.platform === "Bilibili" ? "UP主" : (video.platform === "YouTube" ? "Youtuber" : "作者");
  els.author.innerHTML = `${authorPrefix}：${video.author || '未知'} &middot; ${compactNumber(video.views)} 播放 &middot; ${compactNumber(video.favorites)} 收藏`;
  if (video.url) {
    els.link.href = video.url;
    els.link.classList.remove("disabled");
    els.link.textContent = "打开原视频";
  } else {
    els.link.removeAttribute("href");
    els.link.classList.add("disabled");
    els.link.textContent = "暂无原视频链接";
  }
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
