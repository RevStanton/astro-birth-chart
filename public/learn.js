// public/learn.js

// --- Mini knowledge base ----------------------------------------------------

const PLANETS = [
  {
    key: "sun",
    title: "Sun",
    tl: "Core identity, vitality, purpose.",
    bullets: ["How you shine", "Where you lead", "What energizes you"],
    more:
      "The Sun describes your central organizing force—how you express will, seek recognition, and steer life direction."
  },
  {
    key: "moon",
    title: "Moon",
    tl: "Needs, moods, instinctive self.",
    bullets: ["Emotional baseline", "What feels safe", "Habit patterns"],
    more:
      "The Moon shows how you self-soothe, attach, and respond to closeness. It’s the rhythm of your inner weather."
  },
  {
    key: "mercury",
    title: "Mercury",
    tl: "Mind, messages, learning.",
    bullets: ["Thinking style", "Communication", "Curiosity"],
    more:
      "Mercury colors how you gather, structure, and share information—speech tempo, humor, and cognitive preferences."
  },
  {
    key: "venus",
    title: "Venus",
    tl: "Aesthetics, affection, values.",
    bullets: ["Attraction patterns", "Taste", "Social ease"],
    more:
      "Venus reveals how you harmonize, receive, and savor—love languages, money values, style and diplomacy."
  },
  {
    key: "mars",
    title: "Mars",
    tl: "Drive, desire, boundaries.",
    bullets: ["How you act", "Anger & courage", "Initiation"],
    more:
      "Mars indicates how you pursue goals, assert needs, and handle conflict—your “go” energy."
  },
  {
    key: "jupiter",
    title: "Jupiter",
    tl: "Growth, faith, opportunity.",
    bullets: ["Luck vectors", "Confidence", "Generosity"],
    more:
      "Jupiter expands where it touches—belief systems, teachers, travel, wisdom, and goodwill."
  },
  {
    key: "saturn",
    title: "Saturn",
    tl: "Discipline, time, mastery.",
    bullets: ["Structure", "Limits", "Long-range goals"],
    more:
      "Saturn is the exam and the diploma. It asks for patience, accountability, and builds real competence."
  },
  {
    key: "uranus",
    title: "Uranus",
    tl: "Freedom, innovation, disruption.",
    bullets: ["Sudden change", "Authenticity", "Breakthroughs"],
    more:
      "Uranus awakens—electric shifts, rebellion, and the courage to be uncategorizable."
  },
  {
    key: "neptune",
    title: "Neptune",
    tl: "Dreams, intuition, imagination.",
    bullets: ["Mysticism", "Ideals", "Dissolving ego"],
    more:
      "Neptune blurs and spiritualizes—art, compassion, and the longing for the beyond."
  },
  {
    key: "pluto",
    title: "Pluto",
    tl: "Power, shadow, regeneration.",
    bullets: ["Intensity", "Control dynamics", "Deep change"],
    more:
      "Pluto transforms through depth work—exposing what’s hidden to reclaim potency and truth."
  }
];

const SIGNS = [
  { key: "aries",       title: "Aries ♈",        tl: "Cardinal Fire — direct, pioneering.",      bullets: ["Initiation","Courage","Competition"], more: "Leads by doing; thrives on honest, quick action. Watch impulsivity; channel heat with intention." },
  { key: "taurus",      title: "Taurus ♉",       tl: "Fixed Earth — steady, sensual.",           bullets: ["Stability","Resources","Comfort"],     more: "Builds slowly but surely. Values beauty and consistency; guard against stubborn ruts." },
  { key: "gemini",      title: "Gemini ♊",       tl: "Mutable Air — curious, witty.",            bullets: ["Words","Learning","Variety"],          more: "Collects and shares information; keep focus by batching tasks and finishing cycles." },
  { key: "cancer",      title: "Cancer ♋",       tl: "Cardinal Water — protective, feeling.",     bullets: ["Home","Memory","Care"],               more: "Moves by intuition; nurture and boundaries must co-exist." },
  { key: "leo",         title: "Leo ♌",          tl: "Fixed Fire — expressive, generous.",        bullets: ["Creativity","Play","Heart"],          more: "Leads with warmth; applause is fuel—create, don’t just seek approval." },
  { key: "virgo",       title: "Virgo ♍",        tl: "Mutable Earth — precise, helpful.",         bullets: ["Service","Refinement","Health"],      more: "Improves systems and craft; soften perfectionism with self-kindness." },
  { key: "libra",       title: "Libra ♎",        tl: "Cardinal Air — relational, aesthetic.",     bullets: ["Balance","Design","Diplomacy"],       more: "Seeks harmony and fairness; avoid over-people-pleasing by naming needs." },
  { key: "scorpio",     title: "Scorpio ♏",      tl: "Fixed Water — intense, perceptive.",        bullets: ["Merging","Truth","Phoenix"],          more: "Power in honesty and depth; transform rather than control." },
  { key: "sagittarius", title: "Sagittarius ♐",  tl: "Mutable Fire — candid, expansive.",         bullets: ["Belief","Travel","Humor"],            more: "Big-picture explorer—anchor optimism with practical steps." },
  { key: "capricorn",   title: "Capricorn ♑",    tl: "Cardinal Earth — strategic, durable.",      bullets: ["Structure","Status","Legacy"],        more: "Climbs with patience; define success on your own terms." },
  { key: "aquarius",    title: "Aquarius ♒",     tl: "Fixed Air — original, humanistic.",         bullets: ["Futures","Networks","Reform"],        more: "Invents better systems; belong by being yourself." },
  { key: "pisces",      title: "Pisces ♓",       tl: "Mutable Water — empathetic, imaginal.",     bullets: ["Compassion","Art","Release"],         more: "Porous and inspired; boundaries make your care sustainable." }
];

const HOUSES = [
  { num: 1,  title: "1st House — Self & Arrival",       tl: "How you meet the world.",               bullets: ["Persona","Beginnings","Body"],      more: "The tone of your approach; pairs with the Ascendant." },
  { num: 2,  title: "2nd House — Value & Resources",    tl: "What you have and develop.",            bullets: ["Money","Talents","Security"],       more: "Capacity to earn, keep, and respect what you value." },
  { num: 3,  title: "3rd House — Mind & Local Life",    tl: "How you think and relate nearby.",      bullets: ["Siblings","Neighbors","Skills"],    more: "Short trips, learning loops, daily communications." },
  { num: 4,  title: "4th House — Roots & Home",         tl: "Where you come from; inner base.",      bullets: ["Family","Ancestry","Sanctuary"],    more: "Emotional foundations; the private you." },
  { num: 5,  title: "5th House — Play & Creation",      tl: "Joy you generate.",                     bullets: ["Romance","Art","Children"],         more: "Self-expression, risks worth taking, heart energy." },
  { num: 6,  title: "6th House — Work & Wellbeing",     tl: "Routines and maintenance.",             bullets: ["Service","Habits","Health"],        more: "Daily systems that keep life running." },
  { num: 7,  title: "7th House — Partners & Mirrors",   tl: "One-to-one bonds.",                     bullets: ["Marriage","Allies","Contracts"],    more: "How you collaborate, compromise, and commit." },
  { num: 8,  title: "8th House — Merging & Depth",      tl: "Shared resources; metamorphosis.",      bullets: ["Intimacy","Debts","Shadow"],        more: "Power dynamics and the will to transform." },
  { num: 9,  title: "9th House — Meaning & Horizons",   tl: "Growth through belief/expansion.",      bullets: ["Travel","Philosophy","Higher ed"],  more: "Quest for coherence; teachers and truth." },
  { num:10,  title: "10th House — Career & Calling",    tl: "Public role and impact.",               bullets: ["Reputation","Achievement","Authority"], more: "Your mountain to climb; the MC angle." },
  { num:11,  title: "11th House — Community & Future",  tl: "Networks and hopes.",                   bullets: ["Friends","Movements","Goals"],      more: "Belonging at scale; the long game." },
  { num:12,  title: "12th House — Rest & Release",      tl: "Unseen layers; recuperation.",          bullets: ["Solitude","Dreams","Closure"],      more: "Letting go to renew; spiritual housekeeping." }
];

const ASPECTS = [
  { name: "Conjunction (0°)",  tl: "Amplifies & fuses.",          bullets: ["Merged focus","Potent start","Neutral until flavored"], more: "Two functions co-locate—can be brilliant or blinding. Awareness brings choice." },
  { name: "Opposition (180°)", tl: "Polarity seeking balance.",   bullets: ["Tug-of-war","Projection","Integration"],                more: "See the other side in people/events; collaboration beats either/or." },
  { name: "Square (90°)",      tl: "Friction that sharpens.",     bullets: ["Action forcing","Growth edges","Tension"],              more: "Motivates change; plan outlets, don’t stay stuck." },
  { name: "Trine (120°)",      tl: "Ease and flow.",              bullets: ["Natural talent","Low resistance","Good timing"],        more: "Use it proactively; gifts grow when exercised." },
  { name: "Sextile (60°)",     tl: "Opportunity with effort.",    bullets: ["Supportive link","Light activation","Learning"],        more: "Say yes and follow through; small moves matter." }
];

const DATA = { planets: PLANETS, signs: SIGNS, houses: HOUSES, aspects: ASPECTS };

// --- Rendering --------------------------------------------------------------

const grid   = document.getElementById("learn-grid");
const tabs   = document.getElementById("tabs");
const search = document.getElementById("search");

let currentTab = "planets";
let query = "";

function cardMarkup(item){
  const title   = item.title || item.name || `House ${item.num}`;
  const tl      = item.tl || "";
  const bullets = (item.bullets || []).map(b => `<li>${b}</li>`).join("");
  const more    = item.more || "";

  return `
    <article class="learn-card card">
      <div class="learn-card-body">
        <h3>${title}</h3>
        ${tl ? `<p class="tl">${tl}</p>` : ""}
        ${bullets ? `<ul class="mini-list">${bullets}</ul>` : ""}
        ${more ? `<details><summary>More</summary><div class="more">${more}</div></details>` : ""}
      </div>
    </article>
  `;
}

function render(){
  const list = DATA[currentTab] || [];
  const q = query.trim().toLowerCase();
  const filtered = q ? list.filter(it => JSON.stringify(it).toLowerCase().includes(q)) : list;
  grid.innerHTML = filtered.map(cardMarkup).join("") || `<div class="empty">No matches. Try another keyword.</div>`;
}

tabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  tabs.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  currentTab = btn.dataset.tab;
  render();
});

search.addEventListener("input", () => {
  query = search.value;
  render();
});

// Init
render();
