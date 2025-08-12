// public/report.js
// Build a downloadable PDF report from the current chart.
// Requires jsPDF (UMD) + jsPDF-AutoTable loaded before this file.
// Expects window.__ASTRO_STATE = { planets, houses, aspects, birth }

(function () {
  // ---------- Copy library ----------
  const PLANET_BLURB = {
    Sun: "Core identity, vitality, purpose.",
    Moon: "Needs, moods, instinctive self.",
    Mercury: "Mind, messages, learning.",
    Venus: "Aesthetics, affection, values.",
    Mars: "Drive, desire, boundaries.",
    Jupiter: "Growth, faith, opportunity.",
    Saturn: "Discipline, time, mastery.",
    Uranus: "Freedom, innovation, disruption.",
    Neptune: "Dreams, intuition, imagination.",
    Pluto: "Power, shadow, regeneration.",
    Ascendant: "Your arrival style; first impression."
  };

  const SIGN_BLURB = {
    Aries: "Cardinal Fire — direct, pioneering.",
    Taurus: "Fixed Earth — steady, sensual.",
    Gemini: "Mutable Air — curious, witty.",
    Cancer: "Cardinal Water — protective, feeling.",
    Leo: "Fixed Fire — expressive, generous.",
    Virgo: "Mutable Earth — precise, helpful.",
    Libra: "Cardinal Air — relational, aesthetic.",
    Scorpio: "Fixed Water — intense, perceptive.",
    Sagittarius: "Mutable Fire — candid, expansive.",
    Capricorn: "Cardinal Earth — strategic, durable.",
    Aquarius: "Fixed Air — original, humanistic.",
    Pisces: "Mutable Water — empathetic, imaginal."
  };

  const HOUSE_BRIEF = {
    1: "Self & arrival; persona and beginnings.",
    2: "Value & resources; money and talents.",
    3: "Mind & local life; skills and siblings.",
    4: "Roots & home; family and foundations.",
    5: "Play & creation; romance and joy.",
    6: "Work & wellbeing; daily systems.",
    7: "Partners & mirrors; one-to-one bonds.",
    8: "Merging & depth; shared resources, shadow.",
    9: "Meaning & horizons; travel and belief.",
    10: "Career & calling; public impact.",
    11: "Community & future; networks and hopes.",
    12: "Rest & release; solitude and renewal."
  };

  const ASPECT_BLURB = {
    Conjunction: "Amplifies & fuses.",
    Opposition: "Polarity seeking balance.",
    Square: "Friction that sharpens.",
    Trine: "Ease and flow.",
    Sextile: "Opportunity with effort."
  };

  // ---------- Layout helpers ----------
  const MARGIN = 48;
  const HEADER_H = 36;

  const majorsSet = new Set(["Conjunction","Opposition","Square","Trine","Sextile"]);

  function pageH(doc){ return doc.internal.pageSize.getHeight(); }
  function pageW(doc){ return doc.internal.pageSize.getWidth(); }
  function usableBottom(doc){ return pageH(doc) - MARGIN; }
  function topY(){ return HEADER_H + 28; } // space below the top bar

  function addTopBar(doc, title) {
    doc.setFillColor(20, 25, 54);
    doc.rect(0, 0, pageW(doc), HEADER_H, "F");
    doc.setTextColor(233, 236, 255);
    doc.setFontSize(12);
    doc.text(title, MARGIN, 22);
    doc.setTextColor(0, 0, 0);
  }

  // Add a page if we don't have 'needed' pts left; return (possibly reset) y
  function ensureSpace(doc, y, needed) {
    const bottom = usableBottom(doc);
    if (y + needed > bottom) {
      doc.addPage();
      addTopBar(doc, "Astro — Natal Report (cont.)");
      return topY();
    }
    return y;
  }

  // Text helper that also guards space automatically
  function textBlock(doc, x, y, text, maxWidth) {
    const lines = doc.splitTextToSize(text, maxWidth);
    const lineH = 14; // comfortable line spacing in pts
    const needed = lines.length * lineH + 2;
    y = ensureSpace(doc, y, needed);
    doc.text(lines, x, y);
    return y + needed;
  }

  // White labels on transparent canvas disappear on white PDF;
  // composite the canvas on a dark background first.
  function canvasToPngWithBG(canvas, bg = "#0b0f2b") {
    if (!canvas) return null;
    const w = canvas.width, h = canvas.height;
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const ctx = off.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(canvas, 0, 0, w, h);
    return off.toDataURL("image/png");
  }

  function briefSignOf(p) {
    const name = p?.planet?.en || "";
    const sign = p?.zodiac_sign?.name?.en || "";
    const retro = String(p?.isRetro).toLowerCase() === "true" ? " (R)" : "";
    return `${name}${retro} in ${sign}`;
  }

  function majorAspectsOnly(aspects) {
    return (aspects || []).filter(a => majorsSet.has(a?.aspect?.en));
  }

  // ---------- PDF sections ----------
  function addChartImage(doc) {
    const canvas = document.getElementById("wheel");
    if (!canvas) return topY();

    const imgData = canvasToPngWithBG(canvas, "#0b0f2b");
    if (!imgData) return topY();

    const maxW = pageW(doc) - MARGIN * 2;
    const aspect = canvas.height / canvas.width;
    const imgW = Math.min(maxW, 516);
    const imgH = imgW * aspect;
    let y = topY();
    const x = (pageW(doc) - imgW) / 2;

    // If the image itself would overflow, add a new page first (rare)
    y = ensureSpace(doc, y, imgH + 24);

    doc.addImage(imgData, "PNG", x, y, imgW, imgH, undefined, "FAST");

    // Caption
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text("Natal Wheel (as generated on page)", pageW(doc) / 2, y + imgH + 14, { align: "center" });
    doc.setTextColor(0, 0, 0);

    return y + imgH + 28;
  }

  function buildNarrative(doc, planets, houses, aspects, birth, startY) {
    let y = startY || topY();

    // Title
    y = ensureSpace(doc, y, 26);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Your Natal Chart — Reading", MARGIN, y);
    y += 10;

    // Birth details
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const locLine = birth?.cityState
      ? `Location: ${birth.cityState}`
      : `Location: ${birth?.latitude}, ${birth?.longitude}`;
    const tz = birth?.timezone;
    const tzStr = typeof tz === "number" ? `UTC${tz >= 0 ? "+" : ""}${tz}` : "UTC";
    const dtLine = `Date & Time: ${birth?.dateISO} ${birth?.timeHM} (${tzStr})`;
    y = textBlock(doc, MARGIN, y + 16, `${dtLine}\n${locLine}`, 516);

    // Snapshot
    const findP = n => planets.find(p => p?.planet?.en === n);
    const sun = findP("Sun"), moon = findP("Moon"), asc = findP("Ascendant");
    const snapLines = [
      sun  ? `• ${briefSignOf(sun)} — ${PLANET_BLURB.Sun}  ${SIGN_BLURB[sun?.zodiac_sign?.name?.en] || ""}` : null,
      moon ? `• ${briefSignOf(moon)} — ${PLANET_BLURB.Moon}  ${SIGN_BLURB[moon?.zodiac_sign?.name?.en] || ""}` : null,
      asc  ? `• Rising ${asc?.zodiac_sign?.name?.en} — ${PLANET_BLURB.Ascendant}  ${SIGN_BLURB[asc?.zodiac_sign?.name?.en] || ""}` : null
    ].filter(Boolean).join("\n");
    if (snapLines) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      y = textBlock(doc, MARGIN, y + 14, "Snapshot", 516);
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      y = textBlock(doc, MARGIN, y + 4, snapLines, 516);
    }

    // Planets in Signs
    const core = new Set(["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"]);
    const planetLines = planets
      .filter(p => core.has(p?.planet?.en))
      .map(p => {
        const name = p?.planet?.en;
        const sign = p?.zodiac_sign?.name?.en;
        const pB = PLANET_BLURB[name] || "";
        const sB = SIGN_BLURB[sign] || "";
        return `• ${name} in ${sign}: ${pB} ${sB}`;
      }).join("\n");
    if (planetLines) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      y = textBlock(doc, MARGIN, y + 14, "Planets in Signs", 516);
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      y = textBlock(doc, MARGIN, y + 4, planetLines, 516);
    }

    // Houses
    const houseLines = (houses || [])
      .map(h => `• ${h?.House} — ${h?.zodiac_sign?.name?.en}: ${HOUSE_BRIEF[h?.House] || ""}`)
      .join("\n");
    if (houseLines) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      y = textBlock(doc, MARGIN, y + 14, "Houses (Whole Sign)", 516);
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      y = textBlock(doc, MARGIN, y + 4, houseLines, 516);
    }

    // Major Aspects
    const major = majorAspectsOnly(aspects);
    const aspLines = major.map(a => {
      const A = a?.planet_1?.en, B = a?.planet_2?.en, asp = a?.aspect?.en;
      return `• ${A} ${asp} ${B}: ${ASPECT_BLURB[asp] || ""}`;
    }).join("\n");
    if (aspLines) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      y = textBlock(doc, MARGIN, y + 14, "Major Aspects", 516);
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      y = textBlock(doc, MARGIN, y + 4, aspLines, 516);
    }

    // Footer note (natural placement; no fixed y)
    doc.setFont("helvetica", "italic"); doc.setFontSize(10);
    y = textBlock(doc, MARGIN, y + 12, "Take what resonates. Astrology is a reflective tool, not a rulebook.", 516);
  }

  function buildTables(doc, planets, houses, aspects) {
    // Planets table
    const pRows = (planets || []).map(p => [
      p?.planet?.en ?? "",
      p?.zodiac_sign?.name?.en ?? "",
      (p?.fullDegree ?? 0).toFixed(2),
      String(p?.isRetro).toLowerCase() === "true" ? "Yes" : ""
    ]);
    doc.autoTable({
      head: [["Planet","Sign","Longitude°","Retro"]],
      body: pRows,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [26, 33, 72], textColor: [255, 255, 255] },
      startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 16 : topY()
    });

    // Houses table
    const hRows = (houses || []).map(h => [
      h?.House ?? "",
      h?.zodiac_sign?.name?.en ?? "",
      (h?.degree ?? 0).toFixed(2)
    ]);
    doc.autoTable({
      head: [["House","# Sign","Cuspal°"]],
      body: hRows,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [26, 33, 72], textColor: [255, 255, 255] },
      startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 16 : undefined
    });

    // Aspects table (majors only)
    const aRows = majorAspectsOnly(aspects).map(a => [
      a?.planet_1?.en ?? "",
      a?.aspect?.en ?? "",
      a?.planet_2?.en ?? ""
    ]);
    doc.autoTable({
      head: [["Body A","Aspect","Body B"]],
      body: aRows,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [26, 33, 72], textColor: [255, 255, 255] },
      startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 16 : undefined
    });
  }

  function buildPDF(state) {
    const { planets = [], houses = [], aspects = [], birth = {} } = state || {};
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) {
      alert("PDF library not loaded. Check jsPDF script tag.");
      return;
    }

    const doc = new jsPDF({ unit: "pt", format: "letter" });

    // Page 1
    addTopBar(doc, "Astro — Natal Report");
    const afterImgY = addChartImage(doc);
    buildNarrative(doc, planets, houses, aspects, birth, afterImgY + 4);

    // Page 2 (Details)
    doc.addPage();
    addTopBar(doc, "Details");
    buildTables(doc, planets, houses, aspects);

    const namePart = (birth?.cityState || "natal").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    doc.save(`${namePart}-chart-report.pdf`);
  }

  // ---------- button wiring ----------
  function enableReportButton() {
    const btn = document.getElementById("btn-report");
    if (!btn) return;
    const ready = !!(window.__ASTRO_STATE && window.__ASTRO_STATE.planets && window.__ASTRO_STATE.planets.length);
    btn.disabled = !ready;
  }

  function wireButton() {
    const btn = document.getElementById("btn-report");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const state = window.__ASTRO_STATE;
      if (!state || !state.planets || !state.planets.length) {
        alert("Generate your chart first.");
        return;
      }
      try {
        buildPDF(state);
      } catch (err) {
        console.error("PDF error:", err);
        alert("Could not build the PDF. Check the console for details.");
      }
    });
  }

  // Expose a hook app.js can call after chart generation
  window.__ASTRO_REPORT_READY = enableReportButton;

  // Init after DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    wireButton();
    enableReportButton();
    // Fallback: brief poll in case state arrives after this script
    let tries = 0;
    const iv = setInterval(() => {
      enableReportButton();
      if (++tries > 20 || (window.__ASTRO_STATE && window.__ASTRO_STATE.planets && window.__ASTRO_STATE.planets.length)) {
        clearInterval(iv);
      }
    }, 300);
  });
})();
