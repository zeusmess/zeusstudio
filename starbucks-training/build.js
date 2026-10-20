// Starbucks Shift Supervisor Leadership Program — bilingual (EN / AR) training deck
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const fa = require("react-icons/fa");
const { applyTheme } = require("/root/.claude/skills/synced/1874196a-ca1b-4aca-ab48-0599de3a3bb9_21342a25-fbd6-41a1-94d6-b40bc35d3e8b/pptx/scripts/apply_theme.js");

const OUT = process.argv[2] || "Starbucks_Shift_Supervisor_Program.pptx";

// ---------- Palette (Starbucks greens + white, gold accent) ----------
const HEX = {
  house: "1E3932",   // House Green (dark)
  sbux: "00704A",    // Starbucks Green
  accent: "006241",  // Accent Green
  light: "D4E9E2",   // Light Green
  tint: "F1F8F5",    // very light green tint (card fill)
  gold: "CBA258",    // Starbucks gold
  white: "FFFFFF",
  ink: "1E3932",
  muted: "5C6F68",
};
const THEME = {
  name: "Starbucks Green",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: HEX.house, lt1: HEX.white, dk2: HEX.sbux, lt2: HEX.tint,
    accent1: HEX.sbux, accent2: HEX.house, accent3: HEX.gold, accent4: HEX.light,
    accent5: HEX.accent, accent6: HEX.muted, hlink: HEX.sbux, folHlink: HEX.accent,
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Shift Supervisor Leadership Program";
pres.subject = "Transition Effectively, Communicate Effectively, Effective Time Management";
pres.author = "Shift Supervisor Development";
const C = pres.SchemeColor;
// scheme aliases
const S = {
  house: C.text1, white: C.background1, sbux: C.text2, tint: C.background2,
  green: C.accent1, gold: C.accent3, light: C.accent4, accent: C.accent5, muted: C.accent6,
};

const W = 13.333, H = 7.5, MX = 0.6;
const AR = { rtlMode: true, lang: "ar-EG", align: "right" };

// ---------- Assets ----------
async function svgToPng(svg, size) {
  return "image/png;base64," + (await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()).toString("base64");
}
async function icon(Comp, color = "#FFFFFF", size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color, size: String(size) }));
  return svgToPng(svg, size);
}
const logoSvgRaw = fs.readFileSync(path.join(__dirname, "../logo/package/icons/starbucks.svg"), "utf8");
function logoSvg(fill) {
  return logoSvgRaw.replace("<svg ", `<svg width="1024" height="1024" fill="#${fill}" `);
}

// ---------- Layouts ----------
let LOGO_GREEN, LOGO_WHITE;
function defineLayouts() {
  pres.defineSlideMaster({
    title: "Content",
    background: { color: S.white },
    margin: [0.5, 0.6, 0.6, 0.6],
    objects: [
      { image: { data: LOGO_GREEN, x: W - MX - 0.62, y: 0.38, w: 0.62, h: 0.62 } },
      { placeholder: { options: { name: "title", type: "title", x: MX, y: 0.32, w: 11.2, h: 0.62, fontSize: 28, bold: true, color: S.house, align: "left", valign: "middle", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "artitle", type: "body", x: MX, y: 0.98, w: W - 2 * MX, h: 0.5, fontSize: 20, bold: true, color: S.sbux, align: "right", valign: "middle", margin: 0 }, text: "" } },
      { text: { text: "Starbucks  |  Shift Supervisor Development  |  تطوير مشرفي الشفت", options: { x: MX, y: 7.0, w: 8, h: 0.3, fontSize: 10, color: S.muted, margin: 0, valign: "middle" } } },
    ],
    slideNumber: { x: W - MX - 0.6, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: S.muted, align: "right", margin: 0 },
  });
  pres.defineSlideMaster({
    title: "Section",
    background: { color: S.house },
    objects: [
      { placeholder: { options: { name: "num", type: "body", x: MX + 0.1, y: 1.35, w: 3.5, h: 1.5, fontSize: 96, bold: true, color: S.gold, align: "left", valign: "middle", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "title", type: "title", x: MX + 0.1, y: 3.0, w: 7.6, h: 1.5, fontSize: 40, bold: true, color: S.white, align: "left", valign: "top", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "artitle", type: "body", x: MX + 0.1, y: 4.55, w: 7.6, h: 0.8, fontSize: 28, bold: true, color: S.light, align: "right", valign: "top", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "sub", type: "body", x: MX + 0.1, y: 5.55, w: 7.6, h: 0.9, fontSize: 15, color: S.light, align: "left", valign: "top", margin: 0 }, text: "" } },
    ],
    slideNumber: { x: W - MX - 0.6, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: S.light, align: "right", margin: 0 },
  });
  pres.defineSlideMaster({
    title: "Cover",
    background: { color: S.house },
    objects: [],
  });
}

// ---------- Helpers ----------
let N = 0;
const nm = (p) => `${p}-${++N}`;

function header(s, en, ar) {
  s.addText(en, { placeholder: "title" });
  s.addText(ar, { placeholder: "artitle", ...AR });
}
function shadow() {
  return { type: "outer", color: "1E3932", opacity: 0.12, blur: 8, offset: 2, angle: 90 };
}
function cardBox(s, x, y, w, h, fill = S.tint) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill, width: 0 }, shadow: shadow(), objectName: nm("card") });
}
function iconCircle(s, img, x, y, d = 0.62, fill = S.green) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: nm("icon-bg") });
  const p = d * 0.56;
  s.addImage({ data: img, x: x + (d - p) / 2, y: y + (d - p) / 2, w: p, h: p, objectName: nm("icon") });
}
// bilingual paragraphs: [{en, ar, enSize, arSize, bold, color}]
function biText(enHead, enBody, arHead, arBody, o = {}) {
  const runs = [];
  const hs = o.headSize || 16, bs = o.bodySize || 14;
  const hc = o.headColor || S.house, bc = o.bodyColor || S.house, ac = o.arColor || S.sbux;
  if (enHead) runs.push({ text: enHead, options: { bold: true, fontSize: hs, color: hc, align: "left", breakLine: true, paraSpaceAfter: 2 } });
  if (enBody) runs.push({ text: enBody, options: { fontSize: bs, color: bc, align: "left", breakLine: true, paraSpaceAfter: 6 } });
  if (arHead) runs.push({ text: arHead, options: { bold: true, fontSize: hs, color: ac, ...AR, breakLine: true, paraSpaceAfter: 2 } });
  if (arBody) runs.push({ text: arBody, options: { fontSize: bs, color: o.arBodyColor || bc, ...AR } });
  if (runs.length) delete runs[runs.length - 1].options.breakLine;
  return runs;
}
function tb(s, runs, x, y, w, h, extra = {}) {
  s.addText(runs, { x, y, w, h, isTextBox: true, margin: 0, valign: "top", objectName: nm("text"), ...extra });
}

// ---------- Build ----------
(async () => {
  LOGO_GREEN = await svgToPng(logoSvg(HEX.sbux), 512);
  LOGO_WHITE = await svgToPng(logoSvg(HEX.white), 512);
  const I = {};
  const iconList = {
    user: fa.FaUserTie, comments: fa.FaComments, clock: fa.FaClock, route: fa.FaRoute, users: fa.FaUsers,
    tools: fa.FaToolbox, bolt: fa.FaBolt, heart: fa.FaHeart, star: fa.FaStar, check: fa.FaCheck,
    clipboard: fa.FaClipboardList, bullhorn: fa.FaBullhorn, ear: fa.FaHeadphones, hands: fa.FaHandshake,
    coffee: fa.FaCoffee, leaf: fa.FaLeaf, shield: fa.FaShieldAlt, phone: fa.FaPhoneAlt, chart: fa.FaChartLine,
    calendar: fa.FaCalendarCheck, store: fa.FaStore, broom: fa.FaBroom, tasks: fa.FaTasks, sync: fa.FaSyncAlt,
    seedling: fa.FaSeedling, compass: fa.FaCompass, question: fa.FaQuestion, smile: fa.FaSmile, eye: fa.FaEye,
    lightbulb: fa.FaLightbulb, flag: fa.FaFlag, walk: fa.FaWalking, hourglass: fa.FaHourglassHalf,
    arrow: fa.FaArrowRight, mug: fa.FaMugHot, ban: fa.FaBan, sitemap: fa.FaSitemap, book: fa.FaBookOpen,
    exclaim: fa.FaExclamationTriangle, thumbs: fa.FaThumbsUp, search: fa.FaSearch, signout: fa.FaSignOutAlt,
    signin: fa.FaSignInAlt, play: fa.FaPlay, balance: fa.FaBalanceScale,
  };
  for (const [k, v] of Object.entries(iconList)) I[k] = await icon(v);
  const IG = {}; // green icons for use on white
  for (const k of ["arrow", "check", "star", "coffee", "quote"]) if (iconList[k]) IG[k] = await icon(iconList[k], "#00704A");
  IG.quote = await icon(fa.FaQuoteLeft, "#CBA258");

  defineLayouts();

  // ============ 1. COVER ============
  pres.addSection({ title: "Opening" });
  let s = pres.addSlide({ masterName: "Cover", sectionTitle: "Opening" });
  s.addShape(pres.shapes.OVAL, { x: 7.3, y: 0.95, w: 5.6, h: 5.6, fill: { color: S.green }, line: { color: S.green, width: 0 }, objectName: "cover-circle" });
  s.addShape(pres.shapes.OVAL, { x: 11.75, y: 5.45, w: 1.1, h: 1.1, fill: { color: S.gold }, line: { color: S.gold, width: 0 }, objectName: "cover-dot" });
  s.addImage({ data: LOGO_WHITE, x: 8.3, y: 1.95, w: 3.6, h: 3.6, objectName: "cover-logo" });
  tb(s, [{ text: "STARBUCKS  ·  PARTNER DEVELOPMENT", options: { fontSize: 14, bold: true, color: S.gold, charSpacing: 3 } }], MX + 0.1, 0.9, 7, 0.4);
  tb(s, [{ text: "Shift Supervisor Leadership Program", options: { fontSize: 44, bold: true, color: S.white } }], MX + 0.1, 1.5, 6.4, 1.7);
  tb(s, [{ text: "برنامج قيادة مشرفي الشفت", options: { fontSize: 32, bold: true, color: S.light, ...AR } }], MX + 0.1, 3.25, 6.3, 0.75);
  const chips = [["Transition Effectively", "الانتقال الفعّال"], ["Communicate Effectively", "التواصل الفعّال"], ["Effective Time Management", "إدارة الوقت بفعالية"]];
  chips.forEach(([en, ar], i) => {
    const y = 4.35 + i * 0.68;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX + 0.1, y, w: 6.3, h: 0.56, rectRadius: 0.28, fill: { color: S.accent }, line: { color: S.accent, width: 0 }, objectName: nm("chip") });
    tb(s, [{ text: `0${i + 1}   ${en}`, options: { fontSize: 15, bold: true, color: S.white } }], MX + 0.35, y, 4.2, 0.56, { valign: "middle" });
    tb(s, [{ text: ar, options: { fontSize: 15, bold: true, color: S.light, ...AR } }], MX + 3.7, y, 2.5, 0.56, { valign: "middle" });
  });
  s.addNotes("Welcome partners. This program brings together three sessions that every new Shift Supervisor goes through: Transition Effectively to be a Supervisor, Communicate Effectively, and Effective Time Management.\n\nمرحباً بكم. هذا البرنامج يجمع ثلاث جلسات أساسية لكل مشرف شفت جديد: الانتقال الفعّال لدور المشرف، التواصل الفعّال، وإدارة الوقت بفعالية.");

  // ============ 2. ROADMAP ============
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Opening" });
  header(s, "Program Roadmap", "خريطة البرنامج");
  const road = [
    [I.route, "01", "Transition Effectively to be a Supervisor", "From barista to shift leader: the role, the mindset, the shift pattern and the ACT model", "الانتقال الفعّال لدور المشرف", "من باريستا إلى قائد شفت: الدور والعقلية ونمط الشفت ونموذج ACT"],
    [I.comments, "02", "Communicate Effectively", "Huddles, active listening, LATTE, coaching, feedback and difficult moments", "التواصل الفعّال", "الاجتماع السريع والإنصات ونموذج LATTE والتوجيه والمواقف الصعبة"],
    [I.clock, "03", "Effective Time Management", "Plan the shift, prioritise, deploy the team and protect peak for the customer", "إدارة الوقت بفعالية", "خطّط للشفت ورتّب الأولويات ووزّع الفريق واحمِ وقت الذروة"],
  ];
  road.forEach(([ic, n, en, enb, ar, arb], i) => {
    const x = MX + i * 4.12, y = 1.85, w = 3.82, h = 4.85;
    cardBox(s, x, y, w, h);
    iconCircle(s, ic, x + 0.3, y + 0.32, 0.8);
    tb(s, [{ text: n, options: { fontSize: 40, bold: true, color: S.gold, align: "right" } }], x + w - 1.6, y + 0.28, 1.3, 0.85);
    tb(s, biText(en, enb, ar, arb, { headSize: 20, bodySize: 16 }), x + 0.3, y + 1.4, w - 0.6, h - 1.6);
  });
  s.addNotes("Three sessions, one journey. Session 1 builds the leadership identity; Session 2 gives the communication tools to lead people; Session 3 gives the planning tools to lead the shift. Each session ends with practical tools you can use on your next shift.");

  // ============ 3. MISSION & VALUES ============
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Opening" });
  header(s, "Our Foundation: Mission & Values", "أساسنا: الرسالة والقيم");
  cardBox(s, MX, 1.85, 4.6, 4.85, S.house);
  s.addImage({ data: IG.quote, x: MX + 0.35, y: 2.1, w: 0.55, h: 0.55, objectName: "quote-mark" });
  tb(s, [
    { text: "With every cup, with every conversation, with every community – we nurture the limitless possibilities of human connection.", options: { fontSize: 18, italic: true, color: S.white, breakLine: true, paraSpaceAfter: 14 } },
    { text: "مع كل كوب، ومع كل حوار، وفي كل مجتمع – نرعى الإمكانات اللامحدودة للتواصل الإنساني.", options: { fontSize: 17, bold: true, color: S.light, ...AR, breakLine: true, paraSpaceAfter: 10 } },
    { text: "Starbucks Mission", options: { fontSize: 12, bold: true, color: S.gold } },
  ], MX + 0.35, 2.85, 3.9, 3.6);
  const vals = [
    [I.heart, "Warmth & belonging", "Create a culture where everyone is welcome", "الدفء والانتماء", "ثقافة يُرحَّب فيها بالجميع"],
    [I.bolt, "Act with courage", "Challenge the status quo, find new ways to grow", "التصرف بشجاعة", "نتحدى المألوف ونبحث عن طرق جديدة للنمو"],
    [I.eye, "Be present", "Connect with transparency, dignity and respect", "الحضور الحقيقي", "نتواصل بشفافية وكرامة واحترام"],
    [I.star, "Deliver our very best", "Hold ourselves accountable for results", "تقديم أفضل ما لدينا", "نتحمّل مسؤولية النتائج"],
  ];
  vals.forEach(([ic, en, enb, ar, arb], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 5.6 + col * 3.6, y = 1.85 + row * 2.5, w = 3.3, h = 2.3;
    cardBox(s, x, y, w, h);
    iconCircle(s, ic, x + 0.25, y + 0.25, 0.58);
    tb(s, biText(en, enb, ar, arb, { headSize: 15, bodySize: 13 }), x + 0.25, y + 0.95, w - 0.5, h - 1.05);
  });
  s.addNotes("Everything a Shift Supervisor does connects back to the mission and the four values. The official self-reflection for shift supervisors is built on these same values: 'I create a culture of warmth and belonging', 'I act with courage and challenge the status quo', 'I deliver my very best every day and achieve results'.\n\nكل ما يفعله مشرف الشفت يرتبط بالرسالة والقيم الأربع.");

  // ============ SECTION 1 ============
  pres.addSection({ title: "01 Transition Effectively" });
  s = pres.addSlide({ masterName: "Section", sectionTitle: "01 Transition Effectively" });
  s.addText("01", { placeholder: "num" });
  s.addText("Transition Effectively to be a Supervisor", { placeholder: "title" });
  s.addText("الانتقال الفعّال لدور المشرف", { placeholder: "artitle", ...AR });
  s.addText("From doing the work to leading the shift", { placeholder: "sub" });
  s.addShape(pres.shapes.OVAL, { x: 9.0, y: 1.6, w: 3.9, h: 3.9, fill: { color: S.green }, line: { color: S.green, width: 0 }, objectName: "sec-circle" });
  s.addImage({ data: I.route, x: 10.1, y: 2.7, w: 1.7, h: 1.7, objectName: "sec-icon" });
  s.addImage({ data: LOGO_WHITE, x: W - MX - 0.62, y: 0.4, w: 0.62, h: 0.62, objectName: "sec-logo" });
  s.addNotes("Session 1. Goal: understand what changes when you move from barista to Shift Supervisor, and learn the official Starbucks tools for running a shift: the Shift Pattern (Prepare > Lead > Transition) and the ACT Decision Making Model.");

  // 5. Mindset shift
  s = pres.addSlide({ masterName: "Content", sectionTitle: "01 Transition Effectively" });
  header(s, "From Barista to Supervisor: The Mindset Shift", "من باريستا إلى مشرف: تحوّل العقلية");
  const shifts = [
    ["Doing the tasks", "Leading the play", "تنفيذ المهام", "قيادة خطة الشفت"],
    ["Being a peer", "Being the role model", "زميل بين الزملاء", "قدوة للفريق"],
    ["My station", "The whole store", "محطتي فقط", "المتجر بالكامل"],
    ["Reacting to problems", "Anticipating them", "رد الفعل", "الاستباق والتوقّع"],
    ["Following the plan", "Owning the results", "اتباع الخطة", "امتلاك النتائج"],
  ];
  tb(s, [{ text: "FROM  ·  من", options: { fontSize: 12, bold: true, color: S.muted, charSpacing: 2 } }], MX + 0.2, 1.72, 3, 0.3);
  tb(s, [{ text: "TO  ·  إلى", options: { fontSize: 12, bold: true, color: S.sbux, charSpacing: 2 } }], MX + 4.35, 1.72, 3, 0.3);
  shifts.forEach(([f, t, fa_, ta], i) => {
    const y = 2.1 + i * 0.93, h = 0.8;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y, w: 3.65, h, rectRadius: 0.1, fill: { color: S.tint }, line: { color: S.tint, width: 0 }, objectName: nm("from") });
    tb(s, [{ text: f, options: { fontSize: 14, color: S.house, align: "left", breakLine: true } }, { text: fa_, options: { fontSize: 13, color: S.muted, ...AR } }], MX + 0.2, y + 0.06, 3.25, h - 0.12, { valign: "middle" });
    s.addImage({ data: IG.arrow, x: MX + 3.8, y: y + 0.25, w: 0.3, h: 0.3, objectName: nm("arrow") });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX + 4.25, y, w: 3.65, h, rectRadius: 0.1, fill: { color: S.green }, line: { color: S.green, width: 0 }, objectName: nm("to") });
    tb(s, [{ text: t, options: { fontSize: 14, bold: true, color: S.white, align: "left", breakLine: true } }, { text: ta, options: { fontSize: 13, bold: true, color: S.light, ...AR } }], MX + 4.45, y + 0.06, 3.25, h - 0.12, { valign: "middle" });
  });
  cardBox(s, 8.9, 1.85, W - MX - 8.9, 4.85, S.house);
  tb(s, [
    { text: "The role, in Starbucks' words", options: { fontSize: 13, bold: true, color: S.gold, breakLine: true, paraSpaceAfter: 8 } },
    { text: "“Shift supervisors model making every moment right for our customers, ensure the delivery of high-quality products in a clean, safe and welcoming store, and confidently run shifts that create the Starbucks Experience for customers and partners.”", options: { fontSize: 14, italic: true, color: S.white, breakLine: true, paraSpaceAfter: 10 } },
    { text: "المشرف قدوة في جعل كل لحظة مثالية للعميل، ويضمن منتجاً عالي الجودة في متجر نظيف وآمن ومرحِّب، ويدير الشفت بثقة.", options: { fontSize: 13, color: S.light, ...AR } },
  ], 9.2, 2.1, W - MX - 9.5, 4.4);
  s.addNotes("Source: Starbucks Excellence in Operations Standards – Shift Supervisor Approach.\n\nThe biggest change is identity: you are no longer measured only by what you produce on bar, but by what the whole team delivers on your shift. Discuss: which of these five shifts feels hardest for you?\n\nأكبر تغيير هو الهوية: لم تعد تُقاس بما تنتجه أنت، بل بما يقدمه الفريق كله خلال شفتك.");

  // 6. Three core activities
  s = pres.addSlide({ masterName: "Content", sectionTitle: "01 Transition Effectively" });
  header(s, "The Shift Supervisor Approach: 3 Core Activities", "نهج مشرف الشفت: ثلاثة أنشطة أساسية");
  const acts = [
    [I.mug, "OPERATIONS", "Running Shifts with Customers at Our Core", "Understand today's plan; use the Daily Coverage Report, store plays and Play Caller Cards; stay where you can read customer cues.", "إدارة الشفت والعميل في المركز", "افهم خطة اليوم، واستخدم تقرير التغطية اليومي وخطط المتجر، وكن حيث ترى احتياج العميل."],
    [I.lightbulb, "OPERATIONS", "Solving Problems in the Moment", "Stay composed, use the ACT model, flex the play when needed and turn mistakes into teachable moments.", "حل المشكلات في اللحظة", "حافظ على هدوئك، استخدم نموذج ACT، عدّل الخطة عند الحاجة وحوّل الأخطاء لفرص تعلّم."],
    [I.users, "LEADERSHIP", "Creating the Environment", "Set the tone, build rapport, recognise partners, celebrate wins and share coffee knowledge every shift.", "صناعة بيئة العمل", "حدّد الروح العامة، وابنِ العلاقات، وقدّر الفريق، واحتفل بالنجاحات، وشارك المعرفة بالقهوة."],
  ];
  acts.forEach(([ic, tag, en, enb, ar, arb], i) => {
    const x = MX + i * 4.12, y = 1.85, w = 3.82, h = 4.85;
    cardBox(s, x, y, w, h);
    iconCircle(s, ic, x + 0.3, y + 0.3, 0.75, i === 2 ? S.gold : S.green);
    tb(s, [{ text: tag, options: { fontSize: 11, bold: true, color: i === 2 ? S.gold : S.sbux, charSpacing: 2, align: "right" } }], x + 1.4, y + 0.45, w - 1.7, 0.4, { valign: "middle" });
    tb(s, biText(en, enb, ar, arb, { headSize: 16, bodySize: 14 }), x + 0.3, y + 1.3, w - 0.6, h - 1.45);
  });
  s.addNotes("These three activities come straight from the Starbucks Shift Supervisor Approach (Excellence in Operations Standards). Observable behaviours of a supervisor in the 'owning' stage include: using the Prepare > Lead > Transition pattern on each shift; using Partner Hub, the Daily Plan and the Store Walk to prioritise; using the Quick Connect so partners have what they need; documenting key information for smooth shift-to-shift transitions; and creating moments every shift to share craft and coffee knowledge.");

  // 7. Shift pattern
  s = pres.addSlide({ masterName: "Content", sectionTitle: "01 Transition Effectively" });
  header(s, "The Shift Pattern: Prepare › Lead › Transition", "نمط الشفت: استعد › قُد › سلِّم");
  const pat = [
    [I.signin, "PREPARE", "استعد", "Check in with…", [
      ["Yourself", "Ask: “How will I lead today?”", "نفسك: كيف سأقود اليوم؟"],
      ["Your store", "Daily Coverage Report, Daily Plan, Operations Station", "المتجر: تقرير التغطية والخطة اليومية"],
      ["Communications", "Partner Hub & weekly readiness updates", "الاتصالات: Partner Hub والتحديثات"],
    ]],
    [I.play, "LEAD", "قُد", "On the floor…", [
      ["Quick Connect", "Share the plan and today's focus", "اجتماع سريع: شارك الخطة والتركيز"],
      ["Read the floor", "Position yourself to see customer cues", "اقرأ الأرضية: كن حيث ترى العميل"],
      ["Flex & coach", "Adjust the play; coach in the moment", "عدّل الخطة ووجّه في اللحظة"],
    ]],
    [I.signout, "TRANSITION", "سلِّم", "Check out with…", [
      ["Your store", "Log key info for the next shift on the Daily Plan", "المتجر: سجّل المعلومات للشفت التالي"],
      ["Your team", "Thank and recognise partners!", "الفريق: اشكر وقدّر الشركاء"],
      ["Yourself", "“How did I lead? What will I change?”", "نفسك: كيف قدت؟ وماذا سأغيّر؟"],
    ]],
  ];
  pat.forEach(([ic, en, ar, lead, items], i) => {
    const x = MX + i * 4.12, y = 1.85, w = 3.72, h = 4.85;
    const dark = i === 1;
    cardBox(s, x, y, w, h, dark ? S.green : S.tint);
    iconCircle(s, ic, x + 0.28, y + 0.28, 0.66, dark ? S.house : S.green);
    tb(s, [{ text: en, options: { fontSize: 20, bold: true, color: dark ? S.white : S.house, breakLine: true } }, { text: ar, options: { fontSize: 18, bold: true, color: dark ? S.light : S.sbux, ...AR } }], x + 1.1, y + 0.22, w - 1.38, 0.85);
    const runs = [];
    items.forEach(([h1, b1, a1], j) => {
      runs.push({ text: h1, options: { bold: true, fontSize: 14, color: dark ? S.white : S.house, breakLine: true } });
      runs.push({ text: b1, options: { fontSize: 13, color: dark ? S.white : S.house, breakLine: true } });
      runs.push({ text: a1, options: { fontSize: 13, color: dark ? S.light : S.sbux, ...AR, breakLine: j < items.length - 1, paraSpaceAfter: 10 } });
    });
    tb(s, runs, x + 0.28, y + 1.2, w - 0.56, h - 1.35);
    if (i < 2) s.addImage({ data: IG.arrow, x: x + w + 0.06, y: y + h / 2 - 0.14, w: 0.28, h: 0.28, objectName: nm("flow-arrow") });
  });
  s.addNotes("The Shift Pattern is 'the consistent way to prepare, lead and transition your shift so that teamwork can thrive' (Starbucks Shift Supervisor Approach).\n\nPREPARE – check in with yourself, your store (Daily Coverage Report, Daily Plan, Operations Station) and communications (Partner Hub, Weekly Readiness Chart).\nLEAD – run the play, Quick Connect with partners as they check in, read customer cues, flex the play and coach.\nTRANSITION – check out with your store (share useful information for the next shift or your manager on the Daily Plan), your team (thank and recognise partners) and yourself ('How did I lead today?' and 'What will I do differently on my next shift?').");

  // 8. ACT model
  s = pres.addSlide({ masterName: "Content", sectionTitle: "01 Transition Effectively" });
  header(s, "ACT Decision Making Model", "نموذج ACT لاتخاذ القرار");
  const actL = [
    ["A", "Assess", "What is happening? How serious is it?", "قيِّم: ماذا يحدث؟ وما مدى خطورته؟"],
    ["C", "Consider", "If I don't act, how will it impact the customer & partner experience?", "فكِّر: لو لم أتصرف، كيف سيتأثر العميل والفريق؟"],
    ["T", "Take Action", "Coach  ·  Flex the play  ·  Contact your resources", "تصرَّف: وجّه · عدّل الخطة · اطلب الدعم"],
  ];
  actL.forEach(([L, en, enb, arb], i) => {
    const y = 1.85 + i * 1.65;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y, w: 1.25, h: 1.45, rectRadius: 0.12, fill: { color: S.green }, line: { color: S.green, width: 0 }, objectName: nm("act-letter") });
    tb(s, [{ text: L, options: { fontSize: 54, bold: true, color: S.white, align: "center" } }], MX, y, 1.25, 1.45, { valign: "middle" });
    tb(s, biText(en, enb, null, arb, { headSize: 18, bodySize: 14 }), MX + 1.45, y + 0.05, 4.1, 1.4);
  });
  const lvls = [
    ["1", "I can make it better with my own resources", "Long queue, standard not met → coach, flex the play", "أستطيع التحسين بمواردي: طابور طويل ← وجّه وعدّل الخطة", S.light, S.house],
    ["2", "I need support from outside my store", "Equipment/POS down, call-out, delivery or product outage", "أحتاج دعماً من خارج المتجر: عطل، غياب، نقص منتج", S.light, S.house],
    ["3", "Relatively safe, but disrupts the Third Place", "Disruptive behaviour → use the Interaction Guidelines", "آمن لكنه يُربك المكان: اتبع إرشادات التعامل", S.gold, S.house],
    ["4", "Potential or immediate danger", "Follow Store Safety Procedures; call emergency services", "خطر محتمل أو فوري: إجراءات السلامة واتصل بالطوارئ", S.house, S.white],
  ];
  tb(s, [{ text: "Escalation levels  ·  مستويات التصعيد", options: { fontSize: 13, bold: true, color: S.muted } }], 6.4, 1.72, 6.3, 0.3);
  lvls.forEach(([n, en, enb, arb, fill, col], i) => {
    const y = 2.1 + i * 1.16, h = 1.04;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.4, y, w: W - MX - 6.4, h, rectRadius: 0.1, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: nm("level") });
    tb(s, [{ text: n, options: { fontSize: 26, bold: true, color: col, align: "center" } }], 6.5, y, 0.6, h, { valign: "middle" });
    tb(s, [
      { text: en, options: { fontSize: 14, bold: true, color: col, breakLine: true } },
      { text: enb, options: { fontSize: 12, color: col, breakLine: true } },
      { text: arb, options: { fontSize: 12, color: col, ...AR } },
    ], 7.2, y + 0.05, W - MX - 7.4, h - 0.1, { valign: "middle" });
  });
  s.addNotes("The ACT Decision Making Model 'helps those leading the shift understand how to keep the store safe, welcoming and meeting customer and partner needs' (Starbucks Shift Supervisor Approach).\n\nAssess → Consider ('If you don't take action, how will it impact the customer and partner experience?') → Take Action (Coach, Flex the Play, Contact Your Resources).\n\nLevel examples from the guide: (1) long customer or product queue, not achieving standard; (2) facilities or equipment issue, POS down, partner/customer injury, delivery issue, call out/no show, product outage; (3) disruptive behaviour, personal hygiene, smoking or alcohol, solicitation; (4) potential danger → follow Store Safety Procedures; immediate danger (fire, robbery, medical emergency) → call emergency services.\n\nActivity: give each table a scenario card and ask them to place it on the right level.");

  // 9. Peer-to-leader challenges
  s = pres.addSlide({ masterName: "Content", sectionTitle: "01 Transition Effectively" });
  header(s, "Navigating the Peer-to-Leader Challenge", "التعامل مع تحدي الانتقال من زميل إلى قائد");
  const ch = [
    [I.users, "Leading former peers", "Reset expectations early, be fair and consistent with everyone – no favourites.", "قيادة زملاء الأمس", "وضّح التوقعات مبكراً وكن عادلاً وثابتاً مع الجميع بلا محاباة."],
    [I.tasks, "Trying to do it all yourself", "Deploy and delegate; your job is to make the whole team successful.", "محاولة فعل كل شيء بنفسك", "وزّع وفوّض؛ مهمتك نجاح الفريق كله."],
    [I.bolt, "Avoiding hard conversations", "Act with courage: address the behaviour, not the person, and do it promptly.", "تجنّب المحادثات الصعبة", "تصرّف بشجاعة: ناقش السلوك لا الشخص، وبسرعة."],
    [I.shield, "Building credibility", "Model every standard first and follow through on what you promise.", "بناء المصداقية", "كن أول من يطبّق المعايير، والتزم بما تعد به."],
  ];
  ch.forEach(([ic, en, enb, ar, arb], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MX + col * 6.13, y = 1.85 + row * 2.5, w = 5.93, h = 2.3;
    cardBox(s, x, y, w, h);
    iconCircle(s, ic, x + 0.3, y + 0.3, 0.75);
    tb(s, biText(en, enb, ar, arb, { headSize: 16, bodySize: 14 }), x + 1.3, y + 0.25, w - 1.6, h - 0.45);
  });
  s.addNotes("The Starbucks Career Development Guide describes the developmental shift toward leadership as 'Acting Courageously': moving from a focus on maintaining peer relationships to balancing positional and personal influence to solve problems, and being willing to make the hard calls when necessary.\n\nDiscussion: share a moment when leading a friend felt uncomfortable. What did you do?");

  // 10. Development path & 90 days
  s = pres.addSlide({ masterName: "Content", sectionTitle: "01 Transition Effectively" });
  header(s, "Your First 90 Days: Learn › Own › Advise", "أول 90 يوماً: تعلَّم › امتلك › وجِّه");
  const ninety = [
    ["Days 1–30", "LEARNING", "تعلَّم", ["Shadow your SM and experienced supervisors", "Master the Daily Coverage Report, cash & safety routines", "Learn every partner's name and strengths"], ["رافق مديرك والمشرفين ذوي الخبرة", "أتقن تقرير التغطية وإجراءات النقدية والسلامة", "اعرف أسماء ونقاط قوة كل شريك"]],
    ["Days 31–60", "OWNING", "امتلك", ["Run full shifts using Prepare › Lead › Transition", "Lead the Quick Connect on every shift", "Solve problems with ACT; document on the Daily Plan"], ["أدِر شفتات كاملة بنمط استعد › قُد › سلِّم", "قُد الاجتماع السريع في كل شفت", "استخدم ACT ووثّق في الخطة اليومية"]],
    ["Days 61–90", "ADVISING", "وجِّه", ["Coach baristas and support a new peer", "Spot trends in Store Walk notes; propose fixes", "Review results and next goals with your SM"], ["درّب الباريستا وادعم زميلاً جديداً", "اكتشف الأنماط في ملاحظات جولة المتجر", "راجع النتائج والأهداف مع مديرك"]],
  ];
  ninety.forEach(([d, st, ar, en, arl], i) => {
    const x = MX + i * 4.12, y = 1.85, w = 3.82, h = 4.85;
    cardBox(s, x, y, w, h, i === 2 ? S.house : S.tint);
    const dark = i === 2;
    tb(s, [{ text: d, options: { fontSize: 13, bold: true, color: dark ? S.gold : S.sbux, breakLine: true } }, { text: st, options: { fontSize: 24, bold: true, color: dark ? S.white : S.house } }], x + 0.3, y + 0.25, 2.4, 0.95);
    tb(s, [{ text: ar, options: { fontSize: 24, bold: true, color: dark ? S.light : S.sbux, ...AR } }], x + 2.4, y + 0.55, 1.1, 0.6);
    const runs = [];
    en.forEach((t, j) => {
      runs.push({ text: t, options: { fontSize: 13, color: dark ? S.white : S.house, bullet: { indent: 14 }, breakLine: true } });
      runs.push({ text: arl[j], options: { fontSize: 13, color: dark ? S.light : S.sbux, ...AR, breakLine: j < en.length - 1, paraSpaceAfter: 9 } });
    });
    tb(s, runs, x + 0.3, y + 1.4, w - 0.6, h - 1.55);
  });
  s.addNotes("Starbucks describes development in three stages: Learning, Owning and Advising (L-O-A). The official reflection asks supervisors to rate themselves L, O or A on statements such as 'Consistently, I transition my shift by checking out with the store, the team and myself.'\n\nThe 30-60-90 plan here is a recommended structure to agree with your Store Manager; adapt it to your store.");

  // ============ SECTION 2 ============
  pres.addSection({ title: "02 Communicate Effectively" });
  s = pres.addSlide({ masterName: "Section", sectionTitle: "02 Communicate Effectively" });
  s.addText("02", { placeholder: "num" });
  s.addText("Communicate Effectively", { placeholder: "title" });
  s.addText("التواصل الفعّال", { placeholder: "artitle", ...AR });
  s.addText("The right message, to the right partner, at the right moment", { placeholder: "sub" });
  s.addShape(pres.shapes.OVAL, { x: 9.0, y: 1.6, w: 3.9, h: 3.9, fill: { color: S.green }, line: { color: S.green, width: 0 }, objectName: "sec-circle" });
  s.addImage({ data: I.comments, x: 10.1, y: 2.7, w: 1.7, h: 1.7, objectName: "sec-icon" });
  s.addImage({ data: LOGO_WHITE, x: W - MX - 0.62, y: 0.4, w: 0.62, h: 0.62, objectName: "sec-logo" });
  s.addNotes("Session 2. A supervisor communicates in four directions: with the team on shift, with customers, with the Store Manager, and with the next shift. This session gives tools for each.");

  // 12. Touchpoints timeline
  s = pres.addSlide({ masterName: "Content", sectionTitle: "02 Communicate Effectively" });
  header(s, "Communication Touchpoints Across Every Shift", "نقاط التواصل خلال كل شفت");
  const tps = [
    [I.book, "Before", "Read Partner Hub, weekly update & Now Brewing", "قبل الشفت", "اقرأ Partner Hub والتحديث الأسبوعي"],
    [I.bullhorn, "Check-in", "Quick Connect with each partner as they arrive", "عند الحضور", "اجتماع سريع مع كل شريك عند وصوله"],
    [I.sync, "During", "Call positions, give real-time coaching & praise", "أثناء الشفت", "وزّع المواقع ووجّه وامدح لحظياً"],
    [I.clipboard, "Hand-off", "Write key info on the Daily Plan for the next shift", "التسليم", "دوّن المهم في الخطة اليومية للشفت التالي"],
    [I.thumbs, "Check-out", "Thank partners; update your Store Manager", "الانصراف", "اشكر الفريق وأبلغ مدير المتجر"],
  ];
  const tw = (W - 2 * MX) / 5;
  s.addShape(pres.shapes.LINE, { x: MX + tw / 2, y: 2.62, w: tw * 4, h: 0, line: { color: S.light, width: 3 }, objectName: "timeline" });
  tps.forEach(([ic, en, enb, ar, arb], i) => {
    const cx = MX + i * tw + tw / 2;
    iconCircle(s, ic, cx - 0.5, 2.12, 1.0, i % 2 ? S.house : S.green);
    cardBox(s, MX + i * tw + 0.1, 3.45, tw - 0.2, 3.25);
    tb(s, biText(en, enb, ar, arb, { headSize: 17, bodySize: 14 }), MX + i * tw + 0.28, 3.65, tw - 0.56, 2.95);
  });
  s.addNotes("From the Shift Supervisor Approach: supervisors 'use communication tracking tools, Weekly Update and Now Brewing to ensure they are prepared to share information with baristas as they check in', 'use the Quick Connect to ensure partners on shift have the information they need to delight customers', and 'document and share key information to uphold Starbucks standards and ensure smooth transitions from shift to shift'.");

  // 13. Quick Connect
  s = pres.addSlide({ masterName: "Content", sectionTitle: "02 Communicate Effectively" });
  header(s, "Running a Great Quick Connect (2–3 minutes)", "كيف تدير اجتماعاً سريعاً ناجحاً (٢–٣ دقائق)");
  const qc = [
    ["1", "Connect", "Greet by name, check how they are, set a positive tone", "تواصَل", "رحّب بالاسم واطمئن عليه وابدأ بطاقة إيجابية"],
    ["2", "Inform", "Today's plan, position, break time, promotions & launches", "أخبِر", "خطة اليوم والموقع ووقت الاستراحة والعروض"],
    ["3", "Focus", "One priority for the shift – e.g. connection at hand-off", "ركِّز", "أولوية واحدة للشفت – مثل التواصل عند التسليم"],
    ["4", "Energise", "Recognise a recent win; share a coffee or craft moment", "حفِّز", "قدّر إنجازاً حديثاً وشارك معلومة عن القهوة"],
  ];
  qc.forEach(([n, en, enb, ar, arb], i) => {
    const y = 1.85 + i * 1.22, h = 1.08;
    cardBox(s, MX, y, 7.6, h);
    s.addShape(pres.shapes.OVAL, { x: MX + 0.22, y: y + 0.19, w: 0.7, h: 0.7, fill: { color: S.green }, line: { color: S.green, width: 0 }, objectName: nm("step") });
    tb(s, [{ text: n, options: { fontSize: 22, bold: true, color: S.white, align: "center" } }], MX + 0.22, y + 0.19, 0.7, 0.7, { valign: "middle" });
    tb(s, [{ text: en, options: { fontSize: 16, bold: true, color: S.house, breakLine: true } }, { text: enb, options: { fontSize: 13, color: S.house } }], MX + 1.15, y + 0.1, 3.75, h - 0.2, { valign: "middle" });
    tb(s, [{ text: ar, options: { fontSize: 16, bold: true, color: S.sbux, ...AR, breakLine: true } }, { text: arb, options: { fontSize: 13, color: S.house, ...AR } }], MX + 4.95, y + 0.1, 2.45, h - 0.2, { valign: "middle" });
  });
  cardBox(s, 8.6, 1.85, W - MX - 8.6, 4.75, S.house);
  iconCircle(s, I.lightbulb, 8.9, 2.15, 0.7, S.gold);
  tb(s, [
    { text: "Tips that make it stick", options: { fontSize: 16, bold: true, color: S.white, breakLine: true, paraSpaceAfter: 8 } },
    { text: "Keep it short and standing", options: { fontSize: 13, color: S.white, bullet: { indent: 14 }, breakLine: true } },
    { text: "One message, not ten", options: { fontSize: 13, color: S.white, bullet: { indent: 14 }, breakLine: true } },
    { text: "Ask: “What do you need from me?”", options: { fontSize: 13, color: S.white, bullet: { indent: 14 }, breakLine: true, paraSpaceAfter: 10 } },
    { text: "اجعله قصيراً ووقوفاً · رسالة واحدة لا عشر · اسأل: ماذا تحتاج مني؟", options: { fontSize: 13, color: S.light, ...AR } },
  ], 8.9, 3.05, W - MX - 9.2, 3.4);
  s.addNotes("'Quick Connect' is the Starbucks term for the brief connection a supervisor has with partners on shift (Shift Supervisor Approach). The 4-step structure Connect › Inform › Focus › Energise is a recommended way to run it consistently.\n\nPractice: pair up and run a 2-minute Quick Connect for tomorrow's morning shift.");

  // 14. Active listening
  s = pres.addSlide({ masterName: "Content", sectionTitle: "02 Communicate Effectively" });
  header(s, "Listen to Understand: Active Listening", "أنصت لتفهم: الإنصات الفعّال");
  const al = [
    [I.eye, "Give full attention", "Pause the task, face the person, make eye contact", "انتباه كامل", "أوقف المهمة وانظر للشخص"],
    [I.sync, "Paraphrase", "“So what you're saying is…”", "أعِد الصياغة", "«إذن ما تقصده هو…»"],
    [I.question, "Ask open questions", "“What happened?” “How can I help?”", "اسأل أسئلة مفتوحة", "«ماذا حدث؟» «كيف أساعدك؟»"],
    [I.heart, "Acknowledge feelings", "“I can see this is frustrating.”", "تفهَّم المشاعر", "«أرى أن هذا مزعج لك»"],
    [I.check, "Confirm next step", "Agree what happens next, then follow up", "أكِّد الخطوة التالية", "اتفقا على ما سيحدث وتابِع"],
  ];
  al.forEach(([ic, en, enb, ar, arb], i) => {
    const x = MX + i * ((W - 2 * MX) / 5), w = (W - 2 * MX) / 5 - 0.2;
    cardBox(s, x, 1.85, w, 3.55);
    iconCircle(s, ic, x + 0.25, 2.1, 0.7);
    tb(s, biText(en, enb, ar, arb, { headSize: 15, bodySize: 14 }), x + 0.25, 3.0, w - 0.5, 2.3);
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 5.6, w: W - 2 * MX, h: 1.1, rectRadius: 0.12, fill: { color: S.light }, line: { color: S.light, width: 0 }, objectName: "barriers" });
  iconCircle(s, I.ban, MX + 0.25, 5.8, 0.7, S.house);
  tb(s, [{ text: "Common barriers on shift: noise, peak rush, multitasking, assumptions, interrupting.", options: { fontSize: 14, bold: true, color: S.house } }], MX + 1.2, 5.68, 5.0, 0.95, { valign: "middle" });
  tb(s, [{ text: "عوائق شائعة: الضوضاء، الزحام، تعدد المهام، الافتراضات، المقاطعة.", options: { fontSize: 14, bold: true, color: S.house, ...AR } }], 7.0, 5.68, W - MX - 7.25, 0.95, { valign: "middle" });
  s.addNotes("Active listening underpins every other tool in this session – LATTE starts with Listen, and the Interaction Guidelines say 'listen actively, use a calm tone and clearly state what you need'. In peak, if you can't listen fully, say so and set a time: 'I want to hear this properly – can we talk at 10:30 on your break?'");

  // 15. LATTE
  s = pres.addSlide({ masterName: "Content", sectionTitle: "02 Communicate Effectively" });
  header(s, "LATTE: Recovering the Customer Experience", "نموذج LATTE: استعادة تجربة العميل");
  const latte = [
    ["L", "Listen", "Let the customer speak fully", "أنصِت", "دع العميل يتحدث كاملاً"],
    ["A", "Acknowledge", "Recognise the problem & feeling", "اعترِف", "أقرّ بالمشكلة وبشعوره"],
    ["T", "Take action", "Solve it – remake, replace, fix", "تصرَّف", "حُلّ المشكلة فوراً"],
    ["T", "Thank", "Thank them for telling you", "اشكُر", "اشكره لأنه أخبرك"],
    ["E", "Explain", "Explain why it happened & what changes", "اشرَح", "وضّح السبب وما سيتغير"],
  ];
  latte.forEach(([L, en, enb, ar, arb], i) => {
    const x = MX + i * ((W - 2 * MX) / 5), w = (W - 2 * MX) / 5 - 0.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.85, w, h: 1.5, rectRadius: 0.12, fill: { color: i % 2 ? S.house : S.green }, line: { color: S.green, width: 0 }, objectName: nm("latte-letter") });
    tb(s, [{ text: L, options: { fontSize: 66, bold: true, color: S.white, align: "center" } }], x, 1.85, w, 1.5, { valign: "middle" });
    cardBox(s, x, 3.5, w, 1.95);
    tb(s, biText(en, enb, ar, arb, { headSize: 16, bodySize: 14 }), x + 0.2, 3.65, w - 0.4, 1.75);
  });
  cardBox(s, MX, 5.62, W - 2 * MX, 1.08, S.house);
  s.addImage({ data: IG.quote, x: MX + 0.3, y: 5.84, w: 0.5, h: 0.5, objectName: "latte-quote" });
  tb(s, [{ text: "Thanking isn't agreeing – it recognises the customer's willingness to tell us.", options: { fontSize: 15, italic: true, bold: true, color: S.white } }], MX + 1.0, 5.65, 5.6, 1.0, { valign: "middle" });
  tb(s, [{ text: "الشكر لا يعني الموافقة، بل تقدير لرغبة العميل في إخبارنا.", options: { fontSize: 15, bold: true, color: S.light, ...AR } }], 7.0, 5.65, W - MX - 7.3, 1.0, { valign: "middle" });
  s.addNotes("LATTE was created by Starbucks after internal studies found most service lapses happened in high-stress moments – a rush of orders or an upset customer. A rehearsed routine means partners don't have to rely on willpower in those moments (Charles Duhigg, The Power of Habit).\n\nThe supervisor's role: model LATTE, coach partners to use it, and step in when a situation escalates. Role-play: 'My drink is wrong and I've been waiting 10 minutes.'");

  // 16. Green Apron behaviours
  s = pres.addSlide({ masterName: "Content", sectionTitle: "02 Communicate Effectively" });
  header(s, "Connecting with Customers: Green Apron Behaviours", "التواصل مع العملاء: سلوكيات المريلة الخضراء");
  const ga = [
    [I.smile, "Be Welcoming", "A sense of belonging for all", "كن مرحِّباً", "إحساس بالانتماء للجميع"],
    [I.heart, "Be Genuine", "Connect, discover, respond", "كن صادقاً", "تواصَل، اكتشف، استجب"],
    [I.book, "Be Knowledgeable", "Love and share your craft", "كن ملمّاً", "أحبّ حرفتك وشاركها"],
    [I.hands, "Be Considerate", "Care for self, team, planet", "كن مراعياً", "اهتم بنفسك وفريقك والبيئة"],
    [I.leaf, "Be Involved", "In your store and community", "كن مشاركاً", "في متجرك ومجتمعك"],
  ];
  ga.forEach(([ic, en, enb, ar, arb], i) => {
    const x = MX + i * ((W - 2 * MX) / 5), w = (W - 2 * MX) / 5 - 0.2;
    cardBox(s, x, 1.85, w, 2.85);
    iconCircle(s, ic, x + 0.25, 2.08, 0.66);
    tb(s, biText(en, enb, ar, arb, { headSize: 15, bodySize: 13 }), x + 0.25, 2.9, w - 0.5, 1.75);
  });
  cardBox(s, MX, 4.9, W - 2 * MX, 1.8, S.green);
  tb(s, [
    { text: "Green Apron Service (2025)", options: { fontSize: 16, bold: true, color: S.white, breakLine: true, paraSpaceAfter: 4 } },
    { text: "Warm greeting  ·  a message on the cup  ·  real connection at hand-off  ·  a welcoming, clean café  ·  goal of ≤ 4 minutes", options: { fontSize: 14, color: S.white } },
  ], MX + 0.35, 5.05, 6.4, 1.5, { valign: "middle" });
  tb(s, [
    { text: "خدمة المريلة الخضراء (٢٠٢٥)", options: { fontSize: 16, bold: true, color: S.light, ...AR, breakLine: true, paraSpaceAfter: 4 } },
    { text: "ترحيب دافئ · رسالة على الكوب · تواصل حقيقي عند التسليم · مقهى نظيف ومرحِّب · هدف ٤ دقائق أو أقل", options: { fontSize: 14, color: S.white, ...AR } },
  ], 7.1, 5.05, W - MX - 7.45, 1.5, { valign: "middle" });
  s.addNotes("The five 'Ways of Being' come from The Green Apron Book given to every partner: Be Welcoming, Be Genuine (Connect, Discover, Respond), Be Knowledgeable, Be Considerate, Be Involved.\n\nIn 2025 Starbucks rolled out the 'Green Apron Service' model across North America as part of 'Back to Starbucks': warm greetings, offering a mug for 'for here' orders, handwritten messages on cups, connection at hand-off, clean welcoming cafés, supported by an evolved staffing/deployment model and a goal of serving in four minutes or less. Check with your Store Manager for how it applies in your market.");

  // 17. Feedback SBI
  s = pres.addSlide({ masterName: "Content", sectionTitle: "02 Communicate Effectively" });
  header(s, "Coaching & Feedback That Lands", "توجيه وتغذية راجعة تُحدث فرقاً");
  const sbi = [
    ["S", "Situation", "When & where", "الموقف: متى وأين"],
    ["B", "Behaviour", "What you saw – facts only", "السلوك: ما رأيته فقط"],
    ["I", "Impact", "Effect on customer / team", "الأثر: على العميل والفريق"],
    ["N", "Next step", "Agree what happens next", "الخطوة التالية: اتفاق واضح"],
  ];
  sbi.forEach(([L, en, enb, arb], i) => {
    const y = 1.85 + i * 1.22;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y, w: 1.05, h: 1.05, rectRadius: 0.12, fill: { color: i === 3 ? S.gold : S.green }, line: { color: S.green, width: 0 }, objectName: nm("sbi") });
    tb(s, [{ text: L, options: { fontSize: 36, bold: true, color: S.white, align: "center" } }], MX, y, 1.05, 1.05, { valign: "middle" });
    tb(s, [
      { text: `${en}  –  ${enb}`, options: { fontSize: 15, bold: true, color: S.house, breakLine: true } },
      { text: arb, options: { fontSize: 14, color: S.sbux, ...AR } },
    ], MX + 1.25, y + 0.05, 4.6, 0.95, { valign: "middle" });
  });
  cardBox(s, 6.75, 1.85, W - MX - 6.75, 2.75);
  tb(s, [
    { text: "Example  ·  مثال", options: { fontSize: 13, bold: true, color: S.sbux, breakLine: true, paraSpaceAfter: 6 } },
    { text: "“During the 8 am rush (S), you greeted every customer by name at hand-off (B). Two regulars told me it made their morning (I). Can you show Sara how you do it tomorrow? (N)”", options: { fontSize: 14, italic: true, color: S.house, breakLine: true, paraSpaceAfter: 8 } },
    { text: "«في زحمة الثامنة صباحاً، ناديت كل عميل باسمه عند التسليم، واثنان من العملاء الدائمين قالا إن ذلك أسعدهما. هل يمكنك أن تُري سارة كيف تفعل ذلك غداً؟»", options: { fontSize: 13, color: S.house, ...AR } },
  ], 7.05, 2.05, W - MX - 7.35, 2.45);
  cardBox(s, 6.75, 4.8, W - MX - 6.75, 1.9, S.house);
  tb(s, [
    { text: "Praise in public, redirect in private  ·  Coach in the moment  ·  Recognise more than you correct", options: { fontSize: 14, bold: true, color: S.white, breakLine: true, paraSpaceAfter: 8 } },
    { text: "امدح علناً ووجّه على انفراد · وجّه في اللحظة · قدّر أكثر مما تصحح", options: { fontSize: 14, color: S.light, ...AR } },
  ], 7.05, 4.95, W - MX - 7.35, 1.6, { valign: "middle" });
  s.addNotes("The Shift Supervisor Approach asks supervisors to 'identify teachable moments and provide redirection and coaching, as appropriate' and to 'encourage teamwork and motivate partners through recognition and celebrating team wins'.\n\nSBI (Situation-Behaviour-Impact, developed by the Center for Creative Leadership) plus an agreed Next step is a simple, fair structure for both praise and redirection. Practice writing one SBI-N for a partner on your last shift.");

  // 18. Interaction guidelines
  s = pres.addSlide({ masterName: "Content", sectionTitle: "02 Communicate Effectively" });
  header(s, "Handling Difficult Moments", "التعامل مع المواقف الصعبة");
  cardBox(s, MX, 1.85, 6.0, 4.85);
  iconCircle(s, I.shield, MX + 0.3, 2.1, 0.7);
  tb(s, [{ text: "With customers: Interaction Guidelines", options: { fontSize: 16, bold: true, color: S.house, breakLine: true } }, { text: "مع العملاء: إرشادات التعامل", options: { fontSize: 15, bold: true, color: S.sbux, ...AR } }], MX + 1.2, 2.08, 4.6, 0.8);
  const ig = [
    ["Assess the behaviour, not the person", "قيّم السلوك لا الشخص"],
    ["Ask another partner to observe – look, listen, be aware", "اطلب من زميل أن يراقب الموقف"],
    ["Smile, introduce yourself, ask the customer's name", "ابتسم وعرّف بنفسك واسأل عن اسمه"],
    ["Listen actively, use a calm tone, clearly state what you need", "أنصت بهدوء ووضّح ما تحتاجه بوضوح"],
  ];
  const igRuns = [];
  ig.forEach(([e, a], j) => {
    igRuns.push({ text: e, options: { fontSize: 14, color: S.house, bullet: j === 0 ? { indent: 14 } : { type: "number", indent: 18, numberStartAt: 1 }, breakLine: true, bold: j === 0 } });
    igRuns.push({ text: a, options: { fontSize: 13, color: S.sbux, ...AR, breakLine: j < ig.length - 1, paraSpaceAfter: 8 } });
  });
  tb(s, igRuns, MX + 0.3, 3.05, 5.4, 3.5);
  cardBox(s, 6.93, 1.85, W - MX - 6.93, 4.85, S.house);
  iconCircle(s, I.hands, 7.23, 2.1, 0.7, S.gold);
  tb(s, [{ text: "Between partners: resolve conflict", options: { fontSize: 16, bold: true, color: S.white, breakLine: true } }, { text: "بين الشركاء: حل الخلافات", options: { fontSize: 15, bold: true, color: S.light, ...AR } }], 8.13, 2.08, 4.5, 0.8);
  const cf = [
    ["Step off the floor – never argue in front of customers", "ابتعد عن الأرضية ولا تتجادل أمام العملاء"],
    ["Hear each side separately, then together", "استمع لكل طرف ثم لهما معاً"],
    ["Focus on facts and the shared goal: the customer", "ركّز على الحقائق والهدف المشترك"],
    ["Agree next steps; document & escalate to your SM if needed", "اتفقوا على الحل، ووثّق وصعّد للمدير عند الحاجة"],
  ];
  const cfRuns = [];
  cf.forEach(([e, a], j) => {
    cfRuns.push({ text: e, options: { fontSize: 14, color: S.white, bullet: { indent: 14 }, breakLine: true } });
    cfRuns.push({ text: a, options: { fontSize: 13, color: S.light, ...AR, breakLine: j < cf.length - 1, paraSpaceAfter: 8 } });
  });
  tb(s, cfRuns, 7.23, 3.05, W - MX - 7.53, 3.5);
  s.addNotes("The Interaction Guidelines are quoted from the Starbucks Shift Supervisor Approach (ACT model, level 3: 'the situation is relatively safe, but disrupts the third place'). If the behaviour does not stop or there is potential danger, move up the ACT escalation levels: follow Store Safety Procedures, and in immediate danger call emergency services.\n\nThe partner-conflict steps are recommended practice; always follow your local partner policies and involve your Store Manager for anything involving policy, harassment or safety.");

  // ============ SECTION 3 ============
  pres.addSection({ title: "03 Effective Time Management" });
  s = pres.addSlide({ masterName: "Section", sectionTitle: "03 Effective Time Management" });
  s.addText("03", { placeholder: "num" });
  s.addText("Effective Time Management", { placeholder: "title" });
  s.addText("إدارة الوقت بفعالية", { placeholder: "artitle", ...AR });
  s.addText("Plan the shift, protect the peak, finish strong", { placeholder: "sub" });
  s.addShape(pres.shapes.OVAL, { x: 9.0, y: 1.6, w: 3.9, h: 3.9, fill: { color: S.green }, line: { color: S.green, width: 0 }, objectName: "sec-circle" });
  s.addImage({ data: I.clock, x: 10.1, y: 2.7, w: 1.7, h: 1.7, objectName: "sec-icon" });
  s.addImage({ data: LOGO_WHITE, x: W - MX - 0.62, y: 0.4, w: 0.62, h: 0.62, objectName: "sec-logo" });
  s.addNotes("Session 3. On a shift, time is the scarcest resource. A supervisor manages three clocks at once: the customer's wait time, the team's labour hours and breaks, and the store's routines and tasks.");

  // 20. Planning tools
  s = pres.addSlide({ masterName: "Content", sectionTitle: "03 Effective Time Management" });
  header(s, "Plan Before You Lead: Your Planning Tools", "خطّط قبل أن تقود: أدوات التخطيط");
  const tools = [
    [I.calendar, "Daily Coverage Report", "Who's on, positions, routines, rest & meal breaks", "تقرير التغطية اليومي", "مَن في الشفت والمواقع والاستراحات"],
    [I.clipboard, "Daily Plan", "Today's priorities and notes from the last shift", "الخطة اليومية", "أولويات اليوم وملاحظات الشفت السابق"],
    [I.walk, "Store Walk", "Condition of the café: clean, safe, customer-ready", "جولة المتجر", "نظافة وسلامة وجاهزية المقهى"],
    [I.tasks, "Operations Station & Play Caller Cards", "Routine tasks, set by time of day", "محطة العمليات وبطاقات الخطة", "المهام الروتينية حسب الوقت"],
    [I.book, "Partner Hub", "Updates, launches and what to share", "Partner Hub", "التحديثات والإطلاقات وما يجب مشاركته"],
  ];
  tools.forEach(([ic, en, enb, ar, arb], i) => {
    const col = i < 3 ? i : i - 3, row = i < 3 ? 0 : 1;
    const w = row === 0 ? 3.82 : 5.93;
    const x = row === 0 ? MX + col * 4.12 : MX + col * 6.13;
    const y = row === 0 ? 1.85 : 4.4, h = 2.3;
    cardBox(s, x, y, w, h);
    iconCircle(s, ic, x + 0.28, y + 0.28, 0.7);
    tb(s, biText(en, enb, ar, arb, { headSize: 15, bodySize: 13 }), x + 1.15, y + 0.25, w - 1.4, h - 0.45);
  });
  s.addNotes("From the Shift Supervisor Approach: 'Uses information from Partner Hub, Daily Plan and Store Walk to prioritize activities on shift' and 'Uses the Daily Coverage Report and store plays to determine positions, routines, tasks and the plan for rest and meal breaks'; 'Completes tasks on the Operations Station Play Caller Cards'.\n\nRule of thumb: invest the first 10–15 minutes of your shift in preparing – it saves hours of reacting.");

  // 21. Peak vs non-peak
  s = pres.addSlide({ masterName: "Content", sectionTitle: "03 Effective Time Management" });
  header(s, "Peak vs. Non-Peak: Protect the Customer", "الذروة وغير الذروة: احمِ تجربة العميل");
  cardBox(s, MX, 1.85, 4.55, 4.85, S.green);
  iconCircle(s, I.bolt, MX + 0.3, 2.1, 0.7, S.house);
  tb(s, [{ text: "During peak", options: { fontSize: 20, bold: true, color: S.white, breakLine: true } }, { text: "وقت الذروة", options: { fontSize: 18, bold: true, color: S.light, ...AR } }], MX + 1.2, 2.05, 3.1, 0.85);
  const peak = [["Everyone on customer-facing positions", "الجميع في مواقع خدمة العملاء"], ["You stand where you read customer cues", "قف حيث ترى احتياج العميل"], ["Flex the play as queues build", "عدّل الخطة مع زيادة الطابور"], ["Pause non-critical tasks", "أجّل المهام غير الضرورية"]];
  const pr = []; peak.forEach(([e, a], j) => { pr.push({ text: e, options: { fontSize: 14, color: S.white, bullet: { indent: 14 }, breakLine: true } }); pr.push({ text: a, options: { fontSize: 13, color: S.light, ...AR, breakLine: j < peak.length - 1, paraSpaceAfter: 7 } }); });
  tb(s, pr, MX + 0.3, 3.1, 3.95, 3.5);
  cardBox(s, MX + 4.75, 1.85, 4.55, 4.85);
  iconCircle(s, I.broom, MX + 5.05, 2.1, 0.7);
  tb(s, [{ text: "During non-peak", options: { fontSize: 20, bold: true, color: S.house, breakLine: true } }, { text: "خارج الذروة", options: { fontSize: 18, bold: true, color: S.sbux, ...AR } }], MX + 5.95, 2.05, 3.1, 0.85);
  const np = [["Clean Plays & Station Assessments", "خطط النظافة وتقييم المحطات"], ["Restock & prep for the next peak", "إعادة التعبئة والتجهيز للذروة"], ["Rest and meal breaks", "الاستراحات ووجبات الشركاء"], ["Coaching, orders & deliveries", "التدريب والطلبيات والاستلام"]];
  const nr = []; np.forEach(([e, a], j) => { nr.push({ text: e, options: { fontSize: 14, color: S.house, bullet: { indent: 14 }, breakLine: true } }); nr.push({ text: a, options: { fontSize: 13, color: S.sbux, ...AR, breakLine: j < np.length - 1, paraSpaceAfter: 7 } }); });
  tb(s, nr, MX + 5.05, 3.1, 3.95, 3.5);
  // stat column
  const sx = 10.15, sw = W - MX - sx;
  cardBox(s, sx, 1.85, sw, 2.32, S.house);
  tb(s, [{ text: "≤ 4 min", options: { fontSize: 40, bold: true, color: S.gold, breakLine: true } }, { text: "Green Apron Service wait-time goal", options: { fontSize: 12, color: S.white, breakLine: true } }, { text: "هدف وقت الانتظار", options: { fontSize: 12, color: S.light, ...AR } }], sx + 0.25, 1.95, sw - 0.5, 2.12, { valign: "middle" });
  cardBox(s, sx, 4.38, sw, 2.32, S.house);
  tb(s, [{ text: "−2 min", options: { fontSize: 40, bold: true, color: S.gold, breakLine: true } }, { text: "Avg. wait cut in the 2025 pilot stores", options: { fontSize: 12, color: S.white, breakLine: true } }, { text: "انخفاض متوسط الانتظار في التجربة", options: { fontSize: 12, color: S.light, ...AR } }], sx + 0.25, 4.48, sw - 0.5, 2.12, { valign: "middle" });
  s.addNotes("The Shift Supervisor Approach asks supervisors to put themselves 'in the best position to read customer cues throughout the shift' and to 'understand when and how to flex the play to optimize the customer experience'.\n\nFigures: Starbucks' Green Apron Service model targets getting orders to customers in four minutes or less; in the pilot, about three-quarters of in-store orders at the busiest times were completed within four minutes and average wait times fell by about two minutes (company-reported, 2025).\n\nKey habit: move tasks out of peak, not customers.");

  // 22. Priority matrix
  s = pres.addSlide({ masterName: "Content", sectionTitle: "03 Effective Time Management" });
  header(s, "Prioritise: The Urgent / Important Matrix", "رتّب أولوياتك: مصفوفة العاجل والمهم");
  const mx0 = 1.75, my0 = 1.95, cw = 5.3, chh = 2.3, gap = 0.2;
  tb(s, [{ text: "URGENT  ·  عاجل", options: { fontSize: 12, bold: true, color: S.muted, align: "center" } }], mx0, 1.62, cw, 0.3);
  tb(s, [{ text: "NOT URGENT  ·  غير عاجل", options: { fontSize: 12, bold: true, color: S.muted, align: "center" } }], mx0 + cw + gap, 1.62, cw, 0.3);
  tb(s, [{ text: "IMPORTANT", options: { fontSize: 12, bold: true, color: S.muted, align: "center", breakLine: true } }, { text: "مهم", options: { fontSize: 12, bold: true, color: S.muted, align: "center", rtlMode: true, lang: "ar-EG" } }], MX, my0, 1.0, chh, { valign: "middle" });
  tb(s, [{ text: "NOT IMPORTANT", options: { fontSize: 12, bold: true, color: S.muted, align: "center", breakLine: true } }, { text: "غير مهم", options: { fontSize: 12, bold: true, color: S.muted, align: "center", rtlMode: true, lang: "ar-EG" } }], MX, my0 + chh + gap, 1.0, chh, { valign: "middle" });
  const quad = [
    ["DO NOW", "نفّذ فوراً", "Safety hazard · queue building · product outage · upset customer", "خطر سلامة · طابور يكبر · نفاد منتج · عميل غاضب", S.green, S.white, S.light],
    ["SCHEDULE", "خطّط له", "Coaching · prep for next peak · break plan · Daily Plan notes", "التدريب · التجهيز للذروة · خطة الاستراحات · ملاحظات الخطة", S.house, S.white, S.light],
    ["DELEGATE", "فوّض", "Restock cups & lids · answer the phone · tidy condiment bar", "تعبئة الأكواب · الرد على الهاتف · ترتيب ركن الإضافات", S.light, S.house, S.sbux],
    ["DROP / LATER", "ألغِ أو أجّل", "Side chats in peak · re-doing finished work · non-essential checks", "أحاديث جانبية وقت الذروة · إعادة عمل منتهٍ · مراجعات غير ضرورية", S.tint, S.house, S.sbux],
  ];
  quad.forEach(([en, ar, enb, arb, fill, c1, c2], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = mx0 + col * (cw + gap), y = my0 + row * (chh + gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: chh, rectRadius: 0.12, fill: { color: fill }, line: { color: fill, width: 0 }, shadow: shadow(), objectName: nm("quad") });
    tb(s, [{ text: en, options: { fontSize: 20, bold: true, color: c1 } }], x + 0.3, y + 0.22, 2.6, 0.5, { valign: "middle" });
    tb(s, [{ text: ar, options: { fontSize: 20, bold: true, color: c2, ...AR } }], x + 2.9, y + 0.22, cw - 3.2, 0.5, { valign: "middle" });
    tb(s, [{ text: enb, options: { fontSize: 14, color: c1, breakLine: true, paraSpaceAfter: 6 } }, { text: arb, options: { fontSize: 14, color: c1, ...AR } }], x + 0.3, y + 0.85, cw - 0.6, chh - 1.0);
  });
  s.addNotes("The Eisenhower (Urgent/Important) matrix applied to a Starbucks shift. Most supervisors live in 'Do now'; great supervisors protect time for 'Schedule' – coaching and preparing for the next peak – which is what reduces tomorrow's emergencies.\n\nActivity: list everything you did on your last shift and sort it into the four boxes.");

  // 23. Deploy & delegate
  s = pres.addSlide({ masterName: "Content", sectionTitle: "03 Effective Time Management" });
  header(s, "Deploy & Delegate: Right Partner, Right Position", "التوزيع والتفويض: الشريك المناسب في المكان المناسب");
  const dep = [
    [I.calendar, "Read the coverage", "Check who's on and when peaks hit", "اقرأ التغطية", "مَن في الشفت ومتى الذروة"],
    [I.sitemap, "Place strengths", "Strongest partners on key positions", "وزّع حسب القوة", "الأقوى في المواقع الحرجة"],
    [I.hourglass, "Plan breaks early", "Rest & meal breaks outside the peak", "خطّط للاستراحات", "الاستراحات خارج وقت الذروة"],
    [I.flag, "Delegate clearly", "Task + outcome + deadline", "فوّض بوضوح", "المهمة + النتيجة + الموعد"],
    [I.check, "Follow up", "Check, thank and adjust", "تابِع", "راجع واشكر وعدّل"],
  ];
  const dw = (W - 2 * MX) / 5;
  dep.forEach(([ic, en, enb, ar, arb], i) => {
    const x = MX + i * dw;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.1, y: 1.85, w: dw - 0.2, h: 2.95, rectRadius: 0.12, fill: { color: i % 2 ? S.tint : S.light }, line: { color: S.tint, width: 0 }, objectName: nm("dep") });
    tb(s, [{ text: `0${i + 1}`, options: { fontSize: 13, bold: true, color: S.sbux } }], x + 0.3, 2.0, 0.6, 0.35);
    iconCircle(s, ic, x + dw - 0.95, 2.0, 0.6);
    tb(s, biText(en, enb, ar, arb, { headSize: 15, bodySize: 13 }), x + 0.3, 2.75, dw - 0.6, 1.95);
  });
  cardBox(s, MX, 5.0, W - 2 * MX, 1.7, S.house);
  iconCircle(s, I.exclaim, MX + 0.3, 5.45, 0.8, S.gold);
  tb(s, [
    { text: "Top time-wasters to avoid:", options: { fontSize: 15, bold: true, color: S.gold, breakLine: true } },
    { text: "Doing every task yourself · unclear instructions · late breaks that collide with peak · no hand-off notes", options: { fontSize: 14, color: S.white } },
  ], MX + 1.35, 5.12, 4.85, 1.45, { valign: "middle" });
  tb(s, [
    { text: "أكثر ما يضيّع الوقت:", options: { fontSize: 15, bold: true, color: S.gold, ...AR, breakLine: true } },
    { text: "فعل كل شيء بنفسك · تعليمات غير واضحة · استراحات متأخرة وقت الذروة · غياب ملاحظات التسليم", options: { fontSize: 14, color: S.white, ...AR } },
  ], 7.05, 5.12, W - MX - 7.35, 1.45, { valign: "middle" });
  s.addNotes("Deployment = putting the right partner in the right position at the right time. In 2025 Starbucks moved to an evolved staffing model that adjusts roster size, labour hours, peak coverage and deployment, with more deployment decisions in the hands of store leaders rather than a fixed script – which makes the supervisor's judgement on shift even more important.\n\nWhen delegating, state the task, the expected outcome and when it should be done – then follow up and say thank you.");

  // 24. Sample timeline
  s = pres.addSlide({ masterName: "Content", sectionTitle: "03 Effective Time Management" });
  header(s, "A Well-Managed Opening Shift (Example)", "مثال: إدارة شفت صباحي بإحكام");
  const tl = [
    ["05:30", "Prepare", "Check in with yourself, store & comms; Store Walk", "استعد: راجع الخطة والتقارير وجولة المتجر", S.light, S.house],
    ["06:00", "Quick Connect", "Positions, breaks, one focus for today", "اجتماع سريع: المواقع والاستراحات والتركيز", S.light, S.house],
    ["06:30", "Morning peak", "Lead from the floor, flex the play, ≤ 4 min", "ذروة الصباح: قُد من الأرضية وعدّل الخطة", S.green, S.white],
    ["09:30", "Reset", "Breaks, Clean Plays, restock, quick coaching", "إعادة ضبط: استراحات ونظافة وتعبئة وتوجيه", S.light, S.house],
    ["11:30", "Lunch peak", "Full deployment, customer connection focus", "ذروة الظهيرة: توزيع كامل وتركيز على العميل", S.green, S.white],
    ["13:30", "Transition", "Daily Plan notes, thank team, self-review", "التسليم: ملاحظات وشكر الفريق ومراجعة ذاتية", S.house, S.white],
  ];
  const tlw = (W - 2 * MX) / 6;
  s.addShape(pres.shapes.LINE, { x: MX + tlw / 2, y: 2.35, w: tlw * 5, h: 0, line: { color: S.light, width: 3 }, objectName: "tl-line" });
  tl.forEach(([t, en, enb, arb, fill, col], i) => {
    const x = MX + i * tlw;
    s.addShape(pres.shapes.OVAL, { x: x + tlw / 2 - 0.2, y: 2.15, w: 0.4, h: 0.4, fill: { color: fill === S.light ? S.green : fill }, line: { color: S.white, width: 3 }, objectName: nm("tl-dot") });
    tb(s, [{ text: t, options: { fontSize: 16, bold: true, color: S.sbux, align: "center" } }], x, 1.65, tlw, 0.4);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.08, y: 2.85, w: tlw - 0.16, h: 3.85, rectRadius: 0.12, fill: { color: fill }, line: { color: fill, width: 0 }, shadow: shadow(), objectName: nm("tl-card") });
    tb(s, [
      { text: en, options: { fontSize: 16, bold: true, color: col, breakLine: true, paraSpaceAfter: 6 } },
      { text: enb, options: { fontSize: 13, color: col, breakLine: true, paraSpaceAfter: 10 } },
      { text: arb, options: { fontSize: 13, color: col, ...AR } },
    ], x + 0.25, 3.05, tlw - 0.5, 3.5);
  });
  s.addNotes("Illustrative only – adapt times to your store's peaks, trading hours and Daily Coverage Report. The pattern is what matters: prepare before the doors open, protect the peaks, use the valleys for breaks, cleaning, restocking and coaching, and always finish with a clean transition.");

  // ============ CLOSE ============
  pres.addSection({ title: "Closing" });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Closing" });
  header(s, "Reflect & Commit", "تأمّل والتزم");
  tb(s, [{ text: "Rate yourself: L = Learning · O = Owning · A = Advising", options: { fontSize: 14, bold: true, color: S.muted } }], MX, 1.65, 7, 0.35);
  tb(s, [{ text: "قيّم نفسك: تعلُّم · امتلاك · توجيه", options: { fontSize: 14, bold: true, color: S.muted, ...AR } }], 7.6, 1.65, W - MX - 7.6, 0.35);
  const refl = [
    ["I transition my shift by checking out with the store, the team and myself.", "أسلّم شفتي بالمراجعة مع المتجر والفريق ونفسي."],
    ["I put myself in the best position to read customer cues.", "أضع نفسي حيث أرى احتياجات العملاء."],
    ["I understand when and how to flex the play.", "أعرف متى وكيف أعدّل خطة الشفت."],
    ["I consistently document key information for the team.", "أوثّق المعلومات المهمة للفريق باستمرار."],
    ["I set an energetic and positive tone on my shifts.", "أصنع روحاً إيجابية ونشيطة في شفتاتي."],
  ];
  refl.forEach(([e, a], i) => {
    const y = 2.1 + i * 0.92, h = 0.8;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y, w: W - 2 * MX, h, rectRadius: 0.1, fill: { color: S.tint }, line: { color: S.tint, width: 0 }, objectName: nm("refl") });
    tb(s, [{ text: e, options: { fontSize: 14, color: S.house } }], MX + 0.3, y, 5.4, h, { valign: "middle" });
    tb(s, [{ text: a, options: { fontSize: 14, color: S.sbux, ...AR } }], 6.05, y, 3.9, h, { valign: "middle" });
    ["L", "O", "A"].forEach((L, k) => {
      const cx = 10.25 + k * 0.82;
      s.addShape(pres.shapes.OVAL, { x: cx, y: y + 0.12, w: 0.56, h: 0.56, fill: { color: S.white }, line: { color: S.green, width: 1.5 }, objectName: nm("loa") });
      tb(s, [{ text: L, options: { fontSize: 14, bold: true, color: S.sbux, align: "center" } }], cx, y + 0.12, 0.56, 0.56, { valign: "middle" });
    });
  });
  s.addNotes("These statements are taken from the official Shift Supervisor Approach reflection. Ask each participant to circle L, O or A and be ready to discuss an example with their coach / Store Manager. Then ask everyone to write ONE commitment for their next shift.");

  // Key takeaways
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Closing" });
  header(s, "Key Takeaways", "أهم الرسائل");
  const kt = [
    [I.route, "Transition", "Lead the play, not just the bar. Use Prepare › Lead › Transition and ACT every shift.", "الانتقال", "قُد الخطة لا البار فقط. استخدم نمط الشفت ونموذج ACT دائماً."],
    [I.comments, "Communicate", "Quick Connect, listen first, LATTE for recovery, SBI-N for feedback.", "التواصل", "اجتماع سريع، أنصت أولاً، LATTE لاستعادة العميل، وSBI-N للتغذية الراجعة."],
    [I.clock, "Time", "Plan with your tools, protect the peak, delegate clearly, hand off cleanly.", "الوقت", "خطّط بأدواتك، احمِ الذروة، فوّض بوضوح، وسلّم بإحكام."],
  ];
  kt.forEach(([ic, en, enb, ar, arb], i) => {
    const x = MX + i * 4.12, y = 1.85, w = 3.82, h = 3.6;
    cardBox(s, x, y, w, h, i === 1 ? S.green : S.tint);
    const dark = i === 1;
    iconCircle(s, ic, x + 0.3, y + 0.3, 0.75, dark ? S.house : S.green);
    tb(s, biText(en, enb, ar, arb, { headSize: 20, bodySize: 14, headColor: dark ? S.white : S.house, bodyColor: dark ? S.white : S.house, arColor: dark ? S.light : S.sbux }), x + 0.3, y + 1.25, w - 0.6, h - 1.4);
  });
  cardBox(s, MX, 5.65, W - 2 * MX, 1.05, S.house);
  tb(s, [{ text: "“How will I lead today?”  →  “How did I lead today?”", options: { fontSize: 17, bold: true, italic: true, color: S.white } }], MX + 0.35, 5.65, 6.0, 1.05, { valign: "middle" });
  tb(s, [{ text: "«كيف سأقود اليوم؟» ← «كيف قدتُ اليوم؟»", options: { fontSize: 17, bold: true, color: S.gold, ...AR } }], 7.15, 5.65, W - MX - 7.5, 1.05, { valign: "middle" });
  s.addNotes("Close with the two questions from the Shift Pattern: start every shift with 'How will I lead today?' and end it with 'How did I lead today?' and 'What will I do differently on my next shift?'");

  // Thank you
  s = pres.addSlide({ masterName: "Cover", sectionTitle: "Closing" });
  s.addShape(pres.shapes.OVAL, { x: 7.3, y: 0.95, w: 5.6, h: 5.6, fill: { color: S.green }, line: { color: S.green, width: 0 }, objectName: "end-circle" });
  s.addImage({ data: LOGO_WHITE, x: 8.3, y: 1.95, w: 3.6, h: 3.6, objectName: "end-logo" });
  tb(s, [{ text: "Thank You", options: { fontSize: 54, bold: true, color: S.white } }], MX + 0.1, 1.3, 7, 1.1);
  tb(s, [{ text: "شكراً لكم", options: { fontSize: 44, bold: true, color: S.light, ...AR } }], MX + 0.1, 2.4, 6.2, 0.95);
  tb(s, [{ text: "Questions & discussion  ·  أسئلة ونقاش", options: { fontSize: 18, color: S.gold } }], MX + 0.1, 3.45, 7, 0.5);
  tb(s, [
    { text: "Sources  ·  المصادر", options: { fontSize: 11, bold: true, color: S.light, breakLine: true } },
    { text: "Starbucks, Excellence in Operations Standards – Shift Supervisor Approach & Career Development Guide (2018, internal)", options: { fontSize: 10, color: S.light, bullet: { indent: 10 }, breakLine: true } },
    { text: "Starbucks Mission & Values; The Green Apron Book (Five Ways of Being)", options: { fontSize: 10, color: S.light, bullet: { indent: 10 }, breakLine: true } },
    { text: "Charles Duhigg, The Power of Habit – the LATTE method", options: { fontSize: 10, color: S.light, bullet: { indent: 10 }, breakLine: true } },
    { text: "Starbucks “Back to Starbucks” / Green Apron Service coverage (Reuters, NBC News, Customer Experience Dive, 2025)", options: { fontSize: 10, color: S.light, bullet: { indent: 10 }, breakLine: true } },
    { text: "Center for Creative Leadership – SBI feedback model; Eisenhower matrix", options: { fontSize: 10, color: S.light, bullet: { indent: 10 } } },
  ], MX + 0.1, 4.55, 6.3, 2.3);
  s.addNotes("Thank participants. Invite questions. Remind everyone to share their one commitment with their Store Manager this week.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  // Arabic (complex script) fonts → Arial instead of Times New Roman
  const zip = await JSZip.loadAsync(fs.readFileSync(OUT));
  const tp = "ppt/theme/theme1.xml";
  let x = await zip.file(tp).async("string");
  x = x.replace(/<a:cs typeface=""\/>/g, '<a:cs typeface="Arial"/>').replace(/<a:font script="Arab" typeface="[^"]*"\/>/g, '<a:font script="Arab" typeface="Arial"/>');
  zip.file(tp, x);
  fs.writeFileSync(OUT, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
