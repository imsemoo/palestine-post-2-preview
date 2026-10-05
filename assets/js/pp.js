/* Palestine Post 2.0 — progressive enhancement only.
   Every feature checks for its markup; the pages read fine without this file. */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const TZ = "Asia/Jerusalem";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
  };
  const session = {
    get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch { /* private mode */ } },
  };

  const announce = (text) => {
    const el = $("[data-announcer]");
    if (el) { el.textContent = ""; setTimeout(() => { el.textContent = text; }, 30); }
  };

  const toast = (text) => {
    $(".toast")?.remove();
    const el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>';
    el.append(text);
    document.body.append(el);
    setTimeout(() => el.remove(), 2600);
  };

  /* ---- Clock and dates (Jerusalem time, Gregorian + Hijri) ------------- */
  function initClock() {
    const clock = $("[data-clock]");
    const greg = $("[data-date-greg]");
    const hijri = $("[data-date-hijri]");
    if (!clock) return;
    const fmtTime = new Intl.DateTimeFormat("ar-PS-u-nu-latn", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
    const fmtGreg = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
    const fmtHijri = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
    const tick = () => {
      const now = new Date();
      clock.textContent = fmtTime.format(now);
      if (greg) greg.textContent = fmtGreg.format(now).replace("،", "");
      if (hijri) hijri.textContent = fmtHijri.format(now);
    };
    tick();
    setInterval(tick, 30_000);
  }

  /* ---- Masthead: stuck shadow + rail tucks away while reading down ----- */
  function initMasthead() {
    const head = $("[data-masthead]");
    if (!head) return;
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      head.classList.toggle("is-stuck", y > 40);
      if (y > 320 && y > lastY + 4) head.classList.add("is-condensed");
      else if (y < lastY - 4 || y < 320) head.classList.remove("is-condensed");
      lastY = y;
      ticking = false;
    };
    window.addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
    head.addEventListener("focusin", () => head.classList.remove("is-condensed"));
  }

  /* ---- Disclosures: tools in the strip, the "more" menu ---------------- */
  function initDisclosures() {
    const groups = $$("[data-tool], [data-more]");
    const closeAll = (except) => groups.forEach((g) => {
      if (g === except) return;
      const btn = $("button[aria-expanded]", g);
      const panel = btn && document.getElementById(btn.getAttribute("aria-controls"));
      if (btn && panel) { btn.setAttribute("aria-expanded", "false"); panel.hidden = true; }
    });
    groups.forEach((g) => {
      const btn = $("button[aria-expanded]", g);
      const panel = btn && document.getElementById(btn.getAttribute("aria-controls"));
      if (!btn || !panel) return;
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") !== "true";
        closeAll(g);
        btn.setAttribute("aria-expanded", String(open));
        panel.hidden = !open;
        if (open) g.dispatchEvent(new CustomEvent("pp:open"));
      });
    });
    document.addEventListener("click", (e) => { if (!e.target.closest("[data-tool], [data-more]")) closeAll(); });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const open = groups.find((g) => $("button[aria-expanded='true']", g));
      if (open) { closeAll(); $("button[aria-expanded]", open).focus(); }
    });
  }

  /* ---- Weather (Open-Meteo, no key) — loaded only when asked ----------- */
  const WX_CODES = [
    [0, "صحو"], [1, "صحو غالبًا"], [2, "غائم جزئيًا"], [3, "غائم"], [45, "ضباب"], [48, "ضباب"],
    [51, "رذاذ خفيف"], [53, "رذاذ"], [55, "رذاذ كثيف"], [61, "أمطار خفيفة"], [63, "أمطار"], [65, "أمطار غزيرة"],
    [80, "زخات مطر"], [81, "زخات مطر"], [82, "زخات غزيرة"], [95, "عواصف رعدية"],
  ];
  const wxText = (code) => (WX_CODES.find(([c]) => c === code) || [0, "—"])[1];
  const CITIES = [
    { name: "غزة", lat: 31.5017, lon: 34.4668 },
    { name: "القدس", lat: 31.7683, lon: 35.2137 },
  ];
  let wxPromise;
  function loadWeather() {
    if (wxPromise) return wxPromise;
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + CITIES.map((c) => c.lat).join(",") +
      "&longitude=" + CITIES.map((c) => c.lon).join(",") +
      "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=5&timezone=Asia%2FJerusalem";
    wxPromise = fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((data) => (Array.isArray(data) ? data : [data]))
      .catch((err) => { wxPromise = null; throw err; });
    return wxPromise;
  }
  function initWeather() {
    const tool = $("[data-tool='weather']");
    const body = $("[data-weather-body]");
    const mini = $("[data-weather-mini]");
    const dayFmt = new Intl.DateTimeFormat("ar-PS", { weekday: "short", timeZone: TZ });
    const render = (list) => {
      if (mini) mini.textContent = list.map((d) => Math.round(d.current.temperature_2m) + "°").join(" · ");
      if (!body) return;
      body.innerHTML = list.map((d, i) => `
        <div class="wx-city${i ? " seam-top" : ""}">
          <div class="wx-city__head"><span class="wx-city__name">${CITIES[i].name}</span><span class="wx-city__desc">${wxText(d.current.weather_code)}</span></div>
          <p class="wx-city__now num">${Math.round(d.current.temperature_2m)}°</p>
          <div class="wx-days">${d.daily.time.map((t, k) => `
            <span class="wx-day"><span>${k ? dayFmt.format(new Date(t + "T12:00")) : "اليوم"}</span><b class="num">${Math.round(d.daily.temperature_2m_max[k])}°</b><span class="num">${Math.round(d.daily.temperature_2m_min[k])}°</span></span>`).join("")}
          </div>
        </div>`).join("");
    };
    const fail = () => { if (body) body.innerHTML = '<p class="tool__state">تعذّر تحميل الطقس الآن. أعد المحاولة بعد قليل.</p>'; };
    tool?.addEventListener("pp:open", () => {
      if (body && !body.dataset.loaded) body.innerHTML = loaderMarkup("نحضر الطقس…");
      loadWeather().then((l) => { render(l); if (body) body.dataset.loaded = "1"; }).catch(fail);
    });
    $("#menu-sheet")?.addEventListener("pp:open", () => loadWeather().then(render).catch(() => {}));
  }

  /* ---- Currencies (open.er-api.com, no key) ----------------------------- */
  let fxPromise;
  function loadFx() {
    fxPromise ||= fetch("https://open.er-api.com/v6/latest/USD").then((r) => r.json())
      .then((d) => { if (d.result !== "success") throw new Error("fx"); return { usd: d.rates.ILS, eur: d.rates.ILS / d.rates.EUR, jod: d.rates.ILS / d.rates.JOD, at: d.time_last_update_unix }; })
      .catch((e) => { fxPromise = null; throw e; });
    return fxPromise;
  }
  function initFx() {
    const tool = $("[data-tool='fx']");
    const body = $("[data-fx-body]");
    const mini = $("[data-fx-mini]");
    const fmt = (n) => n.toLocaleString("ar-PS-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const render = (fx) => {
      if (mini) mini.textContent = fmt(fx.usd) + " · " + fmt(fx.eur);
      if (!body) return;
      const when = new Intl.DateTimeFormat("ar-PS-u-nu-latn", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(fx.at * 1000));
      body.innerHTML = `
        <div class="fx-row"><span class="fx-row__name">الدولار الأمريكي</span><span><span class="fx-row__val num">${fmt(fx.usd)}</span><span class="fx-row__unit">شيكل</span></span></div>
        <div class="fx-row"><span class="fx-row__name">اليورو</span><span><span class="fx-row__val num">${fmt(fx.eur)}</span><span class="fx-row__unit">شيكل</span></span></div>
        <div class="fx-row"><span class="fx-row__name">الدينار الأردني</span><span><span class="fx-row__val num">${fmt(fx.jod)}</span><span class="fx-row__unit">شيكل</span></span></div>
        <p class="tool__state">آخر تحديث: ${when}</p>`;
    };
    const fail = () => { if (body) body.innerHTML = '<p class="tool__state">تعذّر تحميل الأسعار الآن.</p>'; };
    tool?.addEventListener("pp:open", () => {
      if (body && !body.dataset.loaded) body.innerHTML = loaderMarkup("نحضر الأسعار…");
      loadFx().then((fx) => { render(fx); if (body) body.dataset.loaded = "1"; }).catch(fail);
    });
    $("#menu-sheet")?.addEventListener("pp:open", () => loadFx().then(render).catch(() => {}));
  }

  /* ---- The loader: the logo's ط-stem stitched north to south ------------ */
  const STEM_ROWS = ["......x", ".....xx", "....xxx", "....xxx", "...xxxx", "...xxxx", "...xxxx", "...xxxx", "...xxxx", "..xxxxx", "..xxxxx", "..xxxxx", ".xxxxxx", ".xxxxxx", "xxxxxxx"];
  function stemSvg() {
    const rows = STEM_ROWS.map((row, r) => {
      let d = "";
      [...row].forEach((ch, c) => {
        if (ch !== "x") return;
        const x = c * 10 + 5, y = r * 10 + 5;
        d += `M${x - 3} ${y - 3}L${x + 3} ${y + 3}M${x + 3} ${y - 3}L${x - 3} ${y + 3}`;
      });
      return `<path d="${d}"/>`;
    }).join("");
    return `<svg viewBox="0 0 70 150" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true">${rows}</svg>`;
  }
  function loaderMarkup(text) { return `<p class="stitch-loader" role="status">${stemSvg()}<span>${text}</span></p>`; }
  window.ppLoader = loaderMarkup;

  /* ---- Since your last visit: the knot + notifications ------------------ */
  // DEMO: the prototype's stories are frozen at 5 Oct 17:00. When the stored visit is
  // missing or later than the newest story, the knot is placed at 14:30 so it can be seen.
  const DEMO_LAST_VISIT = "2026-10-05T14:30";
  function initSinceLastVisit() {
    const items = $$(".thread__item[data-t]");
    if (!items.length) return;
    const newest = items[0].dataset.t;
    const stored = store.get("pp:lastSeen");
    const last = stored && stored < newest ? stored : DEMO_LAST_VISIT;
    const fresh = items.filter((li) => li.dataset.t > last && !li.classList.contains("is-archive"));
    fresh.forEach((li) => li.classList.add("is-new"));
    const boundary = items.find((li) => li.dataset.t <= last);
    if (fresh.length && boundary) {
      const knot = document.createElement("li");
      knot.className = "thread__knot";
      knot.setAttribute("role", "separator");
      knot.innerHTML = `هنا توقفت في زيارتك السابقة · <time>${last.slice(11, 16)}</time><span></span>`;
      boundary.before(knot);
    }
    $$("[data-notif-count]").forEach((b) => { b.textContent = String(fresh.length); b.hidden = !fresh.length; });
    const since = $("[data-notif-since]");
    if (since) since.textContent = fresh.length ? `${fresh.length} منذ زيارتك` : "لا جديد منذ زيارتك";
    const list = $("[data-notif-list]");
    if (list) {
      list.innerHTML = items.slice(0, 6).map((li) => {
        const a = $(".thread__link", li);
        const place = $(".thread__place", li)?.textContent || "";
        const title = a.textContent.replace(place, "").trim();
        return `<li class="${li.classList.contains("is-new") ? "is-new" : ""}"><a href="${a.getAttribute("href")}"><span>${title}</span><span class="t-meta">${place} · ${$(".thread__time", li).textContent}</span></a></li>`;
      }).join("");
    }
    window.addEventListener("pagehide", () => store.set("pp:lastSeen", newest));
    // the bell on small screens opens the same list inside the menu sheet's place
    $("[data-notif-mobile]")?.addEventListener("click", () => {
      const panel = $("#panel-notif");
      if (!panel) return;
      const sheet = $("#menu-sheet");
      if (!sheet) return;
      let slot = $("[data-notif-slot]", sheet);
      if (!slot) {
        slot = document.createElement("div");
        slot.className = "sheet__group";
        slot.dataset.notifSlot = "";
        slot.innerHTML = `<p class="sheet__label">آخر الأخبار منذ زيارتك</p>`;
        slot.append(list.cloneNode(true));
        $(".sheet__body", sheet).prepend(slot);
      }
      openSheet(sheet);
    });
  }

  /* ---- Weave <-> thread: the same story lights up in both --------------- */
  function initWeaveLinks() {
    const weave = $("[data-weave]");
    if (!weave) return;
    const light = (id, on) => $$(`[data-story="${id}"]`).forEach((el) => el.classList.toggle("is-hot", on));
    $$(".stitch", weave).forEach((s) => {
      const id = s.dataset.story;
      ["mouseenter", "focus"].forEach((ev) => s.addEventListener(ev, () => light(id, true)));
      ["mouseleave", "blur"].forEach((ev) => s.addEventListener(ev, () => light(id, false)));
    });
    $$(".thread__link[data-story]").forEach((a) => {
      const id = a.dataset.story;
      a.addEventListener("mouseenter", () => light(id, true));
      a.addEventListener("mouseleave", () => light(id, false));
    });
  }

  /* ---- Strip values: weather and currencies at a glance (after idle) ----- */
  function initStripValues() {
    const wx = $("[data-weather-inline]");
    const fx = $("[data-fx-inline]");
    if (!wx && !fx) return;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
    idle(() => {
      if (wx) loadWeather().then((list) => {
        wx.innerHTML = list.map((d, i) => `${CITIES[i].name} <b>${Math.round(d.current.temperature_2m)}°</b>`).join(" <small>·</small> ");
        wx.hidden = false;
        wx.previousElementSibling.hidden = true;
        wx.closest("button").setAttribute("aria-label", "الطقس: " + list.map((d, i) => `${CITIES[i].name} ${Math.round(d.current.temperature_2m)} درجة`).join("، "));
      }).catch(() => {});
      if (fx) loadFx().then((r) => {
        const f = (n) => n.toLocaleString("ar-PS-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        fx.innerHTML = `$ <b>${f(r.usd)}</b> <small>·</small> € <b>${f(r.eur)}</b> <small>شيكل</small>`;
        fx.hidden = false;
        fx.previousElementSibling.hidden = true;
        fx.closest("button").setAttribute("aria-label", `العملات: الدولار ${f(r.usd)} شيكل، اليورو ${f(r.eur)} شيكل`);
      }).catch(() => {});
    });
  }

  /* ---- Thread: on small screens the rest of the day opens on request ----- */
  function initThreadExpand() {
    $$("[data-thread-expand]").forEach((btn) => btn.addEventListener("click", () => {
      const thread = btn.closest(".thread");
      thread.classList.add("is-expanded");
      btn.setAttribute("aria-expanded", "true");
      $("[data-extra] a", thread)?.focus();
    }));
  }

  /* ---- Breaking: dismissible for this session --------------------------- */
  function initBreaking() {
    const band = $("[data-breaking]");
    if (!band) return;
    const key = "pp:breaking:" + ($("a", band)?.getAttribute("href") || "");
    if (session.get(key)) { band.hidden = true; return; }
    $("[data-breaking-close]", band)?.addEventListener("click", () => {
      band.hidden = true;
      session.set(key, "1");
      announce("أُخفي الخبر العاجل");
    });
  }

  /* ---- Sheets: menu drawer and search ------------------------------------ */
  function openSheet(sheet) {
    if (!sheet || sheet.open) return;
    sheet.showModal();
    sheet.dispatchEvent(new CustomEvent("pp:open"));
  }
  function initSheets() {
    const menu = $("#menu-sheet");
    const search = $("#search-sheet");
    $$("[data-menu-open]").forEach((b) => b.addEventListener("click", () => openSheet(menu)));
    $$("[data-search-open]").forEach((b) => b.addEventListener("click", () => { openSheet(search); $("input", search)?.focus(); }));
    $$("dialog.sheet").forEach((d) => {
      $$("[data-sheet-close]", d).forEach((b) => b.addEventListener("click", () => d.close()));
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !e.target.closest("input, textarea, [contenteditable]")) { e.preventDefault(); openSheet(search); $("input", search)?.focus(); }
    });
  }

  /* ---- Audio: Plyr, loaded only when a player comes near the viewport ------ */
  const PLYR_VERSION = "3.7.8";
  const PLYR_AR = {
    restart: "من البداية", rewind: "رجوع {seektime} ثانية", play: "تشغيل", pause: "إيقاف مؤقت",
    fastForward: "تقديم {seektime} ثانية", seek: "انتقال", seekLabel: "{currentTime} من {duration}",
    played: "تم تشغيله", buffered: "تم تحميله", currentTime: "الوقت الحالي", duration: "المدة",
    volume: "الصوت", mute: "كتم الصوت", unmute: "تشغيل الصوت", download: "تنزيل",
    settings: "الإعدادات", menuBack: "رجوع", speed: "السرعة", normal: "عادية", loop: "تكرار",
    start: "البداية", end: "النهاية", all: "الكل", reset: "إعادة", disabled: "معطّل", enabled: "مفعّل",
  };
  let plyrPromise;
  function loadPlyr() {
    if (window.Plyr) return Promise.resolve();
    plyrPromise ||= new Promise((resolve, reject) => {
      const base = `https://cdnjs.cloudflare.com/ajax/libs/plyr/${PLYR_VERSION}/`;
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = base + "plyr.min.css";
      document.head.append(css);
      const js = document.createElement("script");
      js.src = base + "plyr.min.js";
      js.onload = resolve;
      js.onerror = () => { plyrPromise = null; reject(new Error("plyr")); };
      document.head.append(js);
    });
    return plyrPromise;
  }
  const players = [];
  function setupPlayer(host) {
    const audio = $("audio", host);
    if (!audio || host.dataset.ready) return;
    host.dataset.ready = "1";
    const player = new window.Plyr(audio, {
      controls: ["rewind", "play", "fast-forward", "progress", "current-time", "duration", "mute", "volume", "settings"],
      settings: ["speed"],
      speed: { selected: 1, options: [0.75, 1, 1.25, 1.5, 2] },
      seekTime: 15,
      duration: Number(host.dataset.duration) || undefined,
      invertTime: false,
      i18n: PLYR_AR,
      tooltips: { controls: true, seek: true },
      keyboard: { focused: true, global: false },
    });
    players.push(player);
    player.on("play", () => players.forEach((p) => { if (p !== player) p.pause(); }));

    // other episodes load into this player
    const scope = host.closest("[data-player-host]");
    const list = scope?.parentElement;
    $$(".ep-row[data-src]", list || document).forEach((row) => {
      $(".ep-row__play", row)?.addEventListener("click", () => {
        player.source = { type: "audio", title: row.dataset.title, sources: [{ src: row.dataset.src, type: "audio/mpeg" }] };
        if (scope) {
          $(".episode__title", scope).textContent = row.dataset.title;
          const no = $(".episode__no", scope);
          if (no) no.textContent = row.dataset.no || "";
          $(".episode__meta", scope).textContent = row.dataset.meta || "";
          const img = $(".episode__cover img", scope);
          if (img && row.dataset.img) img.src = row.dataset.img;
        }
        $$(".ep-row", list).forEach((r) => r.classList.toggle("is-current", r === row));
        player.once("canplay", () => player.play());
        announce("تشغيل: " + row.dataset.title);
      });
    });
  }
  function initPlayers() {
    const hosts = $$("[data-pod-player]");
    if (!hosts.length) return;
    const start = () => loadPlyr().then(() => hosts.forEach(setupPlayer)).catch(() => { /* native controls stay */ });
    if (!("IntersectionObserver" in window)) { start(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: "600px 0px" });
    hosts.forEach((h) => io.observe(h));
    // an episode row tapped before the library arrives still works
    $$(".ep-row__play").forEach((b) => b.addEventListener("click", start, { once: true }));
  }

  /* ---- Video: poster first, the embed only on request ------------------- */
  function initVideo() {
    $$("[data-video]").forEach((box) => {
      const stage = $("[data-video-stage]", box);
      const title = $("[data-video-title]", box);
      const embed = (id) => {
        stage.innerHTML = `<iframe class="video__frame" src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="${title?.textContent || "فيديو"}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
      };
      stage.addEventListener("click", (e) => { const b = e.target.closest("[data-video-play]"); if (b) embed(b.dataset.yt); });
      $$(".video__item", box).forEach((item) => item.addEventListener("click", () => {
        $$(".video__item", box).forEach((i) => i.removeAttribute("aria-current"));
        item.setAttribute("aria-current", "true");
        if (title) title.textContent = $(".video__item-title", item).textContent;
        embed(item.dataset.yt);
      }));
    });
  }

  /* ---- Share: the phone's own sheet, otherwise the link is copied ------- */
  function initShare() {
    $$("[data-share-url]").forEach((b) => b.addEventListener("click", async () => {
      const url = new URL(b.dataset.shareUrl, location.href).href;
      if (navigator.share) {
        try { await navigator.share({ title: b.dataset.shareTitle || document.title, url }); } catch { /* sheet dismissed */ }
        return;
      }
      try { await navigator.clipboard.writeText(url); toast("نُسخ الرابط"); }
      catch { toast("انسخ الرابط من شريط العنوان"); }
    }));
  }

  /* ---- Article tools: type size, share, progress ------------------------ */
  function initArticle() {
    const body = $("[data-article-body]");
    if (!body) return;
    const sizes = ["s", "m", "l", "xl"];
    let size = store.get("pp:type") || "m";
    const apply = () => {
      document.documentElement.dataset.type = size;
      $$("[data-type]").forEach((b) => b.toggleAttribute("disabled", (b.dataset.type === "down" && size === sizes[0]) || (b.dataset.type === "up" && size === sizes.at(-1))));
    };
    apply();
    $$("[data-type]").forEach((b) => b.addEventListener("click", () => {
      const i = sizes.indexOf(size) + (b.dataset.type === "up" ? 1 : -1);
      size = sizes[Math.min(sizes.length - 1, Math.max(0, i))];
      store.set("pp:type", size);
      apply();
      announce(b.dataset.type === "up" ? "تكبير الخط" : "تصغير الخط");
    }));

    $$("[data-copy-link]").forEach((b) => b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(b.dataset.copyLink || location.href); toast("نُسخ الرابط"); }
      catch { toast("انسخ الرابط من شريط العنوان"); }
    }));
    $$("[data-share-native]").forEach((b) => {
      if (!navigator.share) { b.hidden = true; return; }
      b.addEventListener("click", () => navigator.share({ title: document.title, url: location.href }).catch(() => {}));
    });

    const bar = $("[data-progress]");
    if (bar) {
      let ticking = false;
      const update = () => {
        const r = body.getBoundingClientRect();
        const total = r.height - window.innerHeight * 0.6;
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
        bar.style.setProperty("--p", p.toFixed(4));
        ticking = false;
      };
      window.addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(update); ticking = true; } }, { passive: true });
      update();
    }
  }

  /* ---- Lists: load more without leaving the page ------------------------- */
  function initLoadMore() {
    $$("[data-load-more]").forEach((btn) => {
      const target = document.getElementById(btn.getAttribute("aria-controls"));
      if (!target) return;
      btn.addEventListener("click", () => {
        const hidden = $$("[data-more-item][hidden]", target);
        btn.disabled = true;
        const label = btn.innerHTML;
        btn.innerHTML = loaderMarkup("نحضر المزيد…");
        setTimeout(() => {
          hidden.slice(0, 6).forEach((el) => { el.hidden = false; });
          btn.disabled = false;
          btn.innerHTML = label;
          const left = $$("[data-more-item][hidden]", target).length;
          if (!left) btn.hidden = true;
          announce("أُضيفت أخبار جديدة إلى القائمة");
          $(".is-revealed-first", target)?.classList.remove("is-revealed-first");
          hidden[0]?.querySelector("a")?.focus({ preventScroll: reduceMotion });
        }, reduceMotion ? 0 : 450);
      });
    });
  }

  /* ---- Filters on listing pages (chips toggle visually; server applies) -- */
  function initChips() {
    $$("[data-chip-group]").forEach((group) => {
      const single = group.dataset.chipGroup === "single";
      $$(".chip[aria-pressed]", group).forEach((chip) => chip.addEventListener("click", () => {
        if (single) $$(".chip[aria-pressed]", group).forEach((c) => c.setAttribute("aria-pressed", "false"));
        chip.setAttribute("aria-pressed", single ? "true" : String(chip.getAttribute("aria-pressed") !== "true"));
      }));
    });
    $$("[data-view-toggle]").forEach((group) => {
      const list = document.getElementById(group.dataset.viewToggle);
      $$("button[data-view]", group).forEach((b) => b.addEventListener("click", () => {
        $$("button[data-view]", group).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        list?.setAttribute("data-view", b.dataset.view);
        store.set("pp:view", b.dataset.view);
      }));
      const saved = store.get("pp:view");
      if (saved) $(`button[data-view="${saved}"]`, group)?.click();
    });
  }

  /* ---- Back to top -------------------------------------------------------- */
  function initToTop() {
    const btn = $("[data-to-top]");
    if (!btn) return;
    const io = new IntersectionObserver(([e]) => btn.classList.toggle("is-visible", !e.isIntersecting), { rootMargin: "800px 0px 0px 0px" });
    const sentinel = document.createElement("span");
    sentinel.style.cssText = "position:absolute;top:0;inline-size:1px;block-size:1px";
    document.body.prepend(sentinel);
    io.observe(sentinel);
    btn.addEventListener("click", () => { window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }); $("#main")?.focus?.({ preventScroll: true }); });
  }

  function init() {
    initClock();
    initMasthead();
    initDisclosures();
    initWeather();
    initFx();
    initStripValues();
    initThreadExpand();
    initSinceLastVisit();
    initWeaveLinks();
    initBreaking();
    initSheets();
    initPlayers();
    initVideo();
    initShare();
    initArticle();
    initLoadMore();
    initChips();
    initToTop();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
