import { round4 } from "./util.js";

// ----- helpers -----
async function geoSearch(query, count = 8) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=${count}&language=en&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Geocoding failed (${r.status})`);
  return await r.json();
}

function offsetHoursAt(ianaZone, dateISO, timeHM) {
  const iso = `${dateISO}T${timeHM}`;
  const minutes = moment.tz(iso, ianaZone).utcOffset(); // minutes east of UTC
  return Math.round((minutes / 60) * 100) / 100;
}
const fmtOffset = (h) => (h >= 0 ? "+" : "") + h;

// ----- main -----
export function setupGeocoding(form) {
  const input = document.getElementById("location-input");
  const box = document.getElementById("location-suggestions");
  const btn = document.getElementById("btn-lookup");
  const note = document.getElementById("lookup-note"); // may be null (OK)
  const tzLabel = document.getElementById("timezone_label"); // may be null (OK)

  let activeIndex = -1;
  let currentItems = [];
  let debTimer = null;

  function renderSuggestions(items) {
    currentItems = items;
    if (!box) return;
    box.innerHTML = items
      .map((it, idx) => {
        const label = [
          it.name,
          it.admin2,
          it.admin1,
          it.country_code ? it.country_code.toUpperCase() : it.country,
        ]
          .filter(Boolean)
          .join(", ");
        return `<div role="option" aria-selected="${
          idx === activeIndex
        }" data-idx="${idx}" class="suggestion${
          idx === activeIndex ? " active" : ""
        }">${label}</div>`;
      })
      .join("");
    box.classList.toggle("hidden", items.length === 0);
  }

  function clearSuggestions() {
    currentItems = [];
    activeIndex = -1;
    if (box) {
      box.innerHTML = "";
      box.classList.add("hidden");
    }
  }

  async function performLookup(item) {
    const { latitude, longitude, timezone, name, admin1, country } = item;
    const dateStr = form?.date_iso?.value;
    const timeStr = form?.time_hm?.value;
    if (!dateStr || !timeStr) {
      alert("Please enter birth date & time first so we compute correct DST.");
      return;
    }
    const tzOffsetHours = offsetHoursAt(timezone, dateStr, timeStr);

    // fill numeric fields for API
    if (form?.latitude) form.latitude.value = round4(latitude);
    if (form?.longitude) form.longitude.value = round4(longitude);
    if (form?.timezone) form.timezone.value = tzOffsetHours; // hidden numeric

    // human-readable label
    if (tzLabel) tzLabel.value = `${timezone} (UTC${fmtOffset(tzOffsetHours)})`;

    // optional note under form
    if (note)
      note.textContent = `Using: ${name}${
        admin1 ? ", " + admin1 : ""
      }${country ? ", " + country : ""} — TZ ${timezone} (UTC${fmtOffset(
        tzOffsetHours
      )})`;
  }

  // Click on a suggestion
  box?.addEventListener("click", (e) => {
    const el = e.target.closest(".suggestion");
    if (!el) return;
    const idx = Number(el.dataset.idx);
    if (!Number.isFinite(idx)) return;
    performLookup(currentItems[idx]);
    clearSuggestions();
  });

  // Keyboard nav
  input?.addEventListener("keydown", (e) => {
    if (box?.classList.contains("hidden")) return;
    if (e.key === "ArrowDown") {
      activeIndex = Math.min(activeIndex + 1, currentItems.length - 1);
      renderSuggestions(currentItems);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      activeIndex = Math.max(activeIndex - 1, 0);
      renderSuggestions(currentItems);
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && currentItems[activeIndex]) {
        performLookup(currentItems[activeIndex]);
        clearSuggestions();
        e.preventDefault();
      }
    } else if (e.key === "Escape") {
      clearSuggestions();
    }
  });

  // Debounced fetch on input
  input?.addEventListener("input", () => {
    const q = input.value.trim();
    clearTimeout(debTimer);
    if (!q) {
      clearSuggestions();
      return;
    }
    debTimer = setTimeout(async () => {
      try {
        const data = await geoSearch(q, 10);
        renderSuggestions(data?.results ? data.results : []);
      } catch {
        renderSuggestions([]);
      }
    }, 250);
  });

  // Button fallback (use first result)
  btn?.addEventListener("click", async () => {
    const q = input?.value?.trim();
    if (!q) {
      alert("Type a city/state or ZIP first.");
      return;
    }
    try {
      const data = await geoSearch(q, 5);
      if (!data?.results?.length)
        throw new Error("No matches found. Try a more specific query.");
      await performLookup(data.results[0]);
      clearSuggestions();
    } catch (e) {
      alert(e.message || "Lookup error");
    }
  });

  // Click outside to close
  document.addEventListener("click", (e) => {
    if (!box) return;
    if (!box.contains(e.target) && e.target !== input) clearSuggestions();
  });
}
