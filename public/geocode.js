// public/geocode.js
// Autocomplete with Open-Meteo; fill lat/lon and DST-aware timezone (hours).
// Exports: setupGeocoding(form).

const round4 = (n) => Math.round(n * 10000) / 10000;

async function geoSearch(query, count = 8) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=${count}&language=en&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Geocoding failed (${r.status})`);
  return await r.json();
}

// Get UTC offset HOURS for the *birth local time* in the found IANA zone.
function offsetHoursAt(ianaZone, dateISO, timeHM) {
  try {
    const { DateTime } = window.luxon || {};
    if (!DateTime) {
      console.warn("[geocode] Luxon missing; cannot compute DST-aware offset");
      return null;
    }
    const dt = DateTime.fromISO(`${dateISO}T${timeHM}`, { zone: ianaZone });
    if (!dt.isValid) {
      console.warn("[geocode] invalid DateTime for offset", { ianaZone, dateISO, timeHM });
      return null;
    }
    // dt.offset is minutes; convert to hours with 2 decimals
    return Math.round((dt.offset / 60) * 100) / 100;
  } catch (e) {
    console.warn("[geocode] offset calc failed", e);
    return null;
  }
}

const fmtOffset = (h) => (h >= 0 ? "+" : "") + h;

export function setupGeocoding(form) {
  const input    = document.getElementById("location-input");
  const box      = document.getElementById("location-suggestions");
  const btn      = document.getElementById("btn-lookup");
  const tzLabel  = document.getElementById("timezone_label"); // pretty, readonly text
  const tzField  = document.getElementById("timezone");       // hidden numeric (hours)

  if (!input || !box) {
    console.warn("[geocode] missing #location-input or #location-suggestions");
    return;
  }

  let activeIndex = -1;
  let current = [];
  let debTimer = null;

  function render(items) {
    current = items || [];
    if (!items || !items.length) {
      box.innerHTML = `<div class="suggestion muted">No matches</div>`;
      box.classList.remove("hidden");
      return;
    }
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
        return `<div class="suggestion${idx === activeIndex ? " active" : ""}" role="option" data-idx="${idx}">${label}</div>`;
      })
      .join("");
    box.classList.remove("hidden");
  }

  function hide() {
    activeIndex = -1;
    current = [];
    box.innerHTML = "";
    box.classList.add("hidden");
  }

  async function choose(item) {
    if (!item) return;
    const { latitude, longitude, timezone, name, admin1, country } = item;

    // Build birth-local ISO/time for DST-aware offset
    const f = form?.elements || {};
    const dateISO =
      f.date_iso?.value ||
      `${f.year?.value}-${String(f.month?.value).padStart(2, "0")}-${String(f.date?.value).padStart(2, "0")}`;
    const hh = String(f.hours?.value || "0").padStart(2, "0");
    const mm = String(f.minutes?.value || "0").padStart(2, "0");
    const timeHM = f.time_hm?.value || `${hh}:${mm}`;

    const offset = offsetHoursAt(timezone, dateISO, timeHM);

    // Fill required numeric fields (what FormData reads)
    if (f.latitude)  f.latitude.value  = String(round4(latitude));
    if (f.longitude) f.longitude.value = String(round4(longitude));
    if (tzField && offset !== null) tzField.value = String(offset);

    // Pretty label for humans
    if (tzLabel && offset !== null) {
      tzLabel.value = `${timezone} (UTC${fmtOffset(offset)})`;
    }

    // Optional note under form
    const note = document.getElementById("lookup-note");
    if (note) {
      note.textContent = `Using: ${name}${admin1 ? ", " + admin1 : ""}${
        country ? ", " + country : ""
      } — TZ ${timezone} (UTC${fmtOffset(offset ?? 0)})`;
    }

    console.log("[geocode] filled", {
      lat: round4(latitude),
      lon: round4(longitude),
      tz: timezone,
      hoursOffset: offset,
      dateISO,
      timeHM,
    });
  }

  // Click suggestion
  box.addEventListener("click", (e) => {
    const el = e.target.closest(".suggestion");
    if (!el) return;
    const idx = Number(el.dataset.idx);
    if (Number.isFinite(idx) && current[idx]) choose(current[idx]);
    hide();
  });

  // Keyboard nav
  input.addEventListener("keydown", (e) => {
    if (box.classList.contains("hidden")) return;
    if (e.key === "ArrowDown") {
      activeIndex = Math.min(activeIndex + 1, current.length - 1);
      render(current);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      activeIndex = Math.max(activeIndex - 1, 0);
      render(current);
      e.preventDefault();
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && current[activeIndex]) choose(current[activeIndex]);
      hide();
      e.preventDefault();
    } else if (e.key === "Escape") {
      hide();
    }
  });

  // Debounced input search
  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearTimeout(debTimer);
    if (q.length < 2) {
      hide();
      return;
    }
    debTimer = setTimeout(async () => {
      try {
        const data = await geoSearch(q, 10);
        render(data?.results || []);
      } catch (err) {
        console.error("[geocode] search error", err);
        render([]);
      }
    }, 250);
  });

  // Button lookup (first result)
  btn?.addEventListener("click", async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    try {
      const data = await geoSearch(q, 5);
      if (data?.results?.length) await choose(data.results[0]);
      else render([]);
      hide();
    } catch (err) {
      console.error("[geocode] button error", err);
    }
  });

  // Click outside to close
  document.addEventListener("click", (e) => {
    if (!box.contains(e.target) && e.target !== input) hide();
  });
}
