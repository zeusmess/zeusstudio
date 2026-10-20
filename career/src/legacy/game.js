import { emit } from '../core/events.js';
import { INITIAL_BRANCHES } from '../data/branches.js';
import { drawAmbient, drawCar, drawMachineFx, drawPerson, nightLevel } from '../render/scene.js';

// Extension points for the new systems (shift, incidents, career, cloud sync).
// Each hook is optional: with none set the game behaves as it always did.
export const hooks = {
  passiveMultiplier: null,      // () => number — share of the network income the player's rank earns
  isOnShift: null,              // (staff) => boolean — is this partner on the floor right now
  spawnRateMultiplier: null,    // () => number — store hours, rush events, incidents
  stepSpeedMultiplier: null,    // (stepKey) => number — deployment, broken machines
  patienceMultiplier: null,     // () => number
  onSave: null,                 // (snapshot) => void — persistence (local + cloud)
  onPromoteSelfClicked: null,   // () => void — opens the career ladder instead of a free promotion
  canSelectRole: null,          // (roleKey) => boolean — roles above the earned rank stay locked
  playerName: null              // () => string — the registered name
};

// =========================================================================
// SYNTHESIZED SOUND ENGINE (Web Audio API)
// =========================================================================
let audioCtx = null;
let isMuted = false;

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (isMuted) return;
  try {
    initAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'cash') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1318.5, now + 0.07);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === 'step') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.08);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'ding') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.setValueAtTime(587.3, now + 0.1);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'email') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(987.77, now + 0.09);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'angry') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.25);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'fanfare') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      osc.frequency.setValueAtTime(1046.5, now + 0.24);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    }
  } catch (e) {}
}

// =========================================================================
// GAME DATA DEFINITIONS
// =========================================================================
const STEP_LABELS = {
  shot: { name: 'سحب إسبريسو/قهوة', icon: '☕' },
  milk: { name: 'تبخير الحليب', icon: '🥛' },
  cold: { name: 'ثلج وخفق بارد', icon: '🧊' },
  syrup: { name: 'سيرب وإضافات', icon: '🍯' },
  oven: { name: 'تسخين الفرن', icon: '🔥' }
};

const INITIAL_MENU = [
  // 1. مشروباتنا الكلاسيكية - الساخنة (From Image 1 & 2)
  {
    id: 'flat_white',
    name: 'دبل شوت™ قهوة ساخنة وايت موكا',
    category: 'البار الساخن',
    icon: '☕',
    basePrice: 5.80,
    price: 5.80,
    egpShort: null,
    egpTall: 175,
    egpGrande: 185,
    egpVenti: 195,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 11,
    steps: ['shot', 'milk', 'syrup'],
    stockUse: { beans: 4, milk: 4, ice: 0, cups: 2, food: 0 }
  },
  {
    id: 'caramel_macchiato',
    name: 'كاراميل ماكياتو ساخن (Caramel Macchiato)',
    category: 'البار الساخن',
    icon: '🍯',
    basePrice: 4.85,
    price: 4.85,
    egpShort: 135,
    egpTall: 145,
    egpGrande: 155,
    egpVenti: 165,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 12,
    steps: ['shot', 'milk', 'syrup'],
    stockUse: { beans: 3, milk: 4, ice: 0, cups: 2, food: 0 }
  },
  {
    id: 'white_mocha',
    name: 'موكا بالشوكولاته البيضاء (White Mocha)',
    category: 'البار الساخن',
    icon: '🍫',
    basePrice: 4.50,
    price: 4.50,
    egpShort: 125,
    egpTall: 135,
    egpGrande: 145,
    egpVenti: 155,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 12,
    steps: ['shot', 'milk', 'syrup'],
    stockUse: { beans: 3, milk: 4, ice: 0, cups: 2, food: 0 }
  },
  {
    id: 'cappuccino',
    name: 'كابتشينو كلاسيك (Cappuccino)',
    category: 'البار الساخن',
    icon: '☁️',
    basePrice: 4.00,
    price: 4.00,
    egpShort: 110,
    egpTall: 120,
    egpGrande: 130,
    egpVenti: 140,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 10,
    steps: ['shot', 'milk'],
    stockUse: { beans: 3, milk: 4, ice: 0, cups: 2, food: 0 }
  },
  {
    id: 'spanish_latte_hot',
    name: 'سبانيش لاتيه ساخن (Spanish Latte)',
    category: 'البار الساخن',
    icon: '✨',
    basePrice: 4.50,
    price: 4.50,
    egpShort: 125,
    egpTall: 135,
    egpGrande: 145,
    egpVenti: 160,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 11,
    steps: ['shot', 'milk', 'syrup'],
    stockUse: { beans: 3, milk: 5, ice: 0, cups: 2, food: 0 }
  },
  {
    id: 'caffe_latte',
    name: 'كافيه لاتيه ساخن (Caffè Latte)',
    category: 'البار الساخن',
    icon: '🥛',
    basePrice: 4.00,
    price: 4.00,
    egpShort: 110,
    egpTall: 120,
    egpGrande: 130,
    egpVenti: 140,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 10,
    steps: ['shot', 'milk'],
    stockUse: { beans: 3, milk: 4, ice: 0, cups: 2, food: 0 }
  },
  {
    id: 'caffe_americano',
    name: 'كافيه أمريكانو ساخن (Caffè Americano)',
    category: 'البار الساخن',
    icon: '☕',
    basePrice: 3.80,
    price: 3.80,
    egpShort: 105,
    egpTall: 115,
    egpGrande: 125,
    egpVenti: 135,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 7,
    steps: ['shot'],
    stockUse: { beans: 4, milk: 0, ice: 0, cups: 2, food: 0 }
  },
  {
    id: 'pike_coffee',
    name: 'قهوة اليوم المقطرة (Pike Place Roast)',
    category: 'البار الساخن',
    icon: '☕',
    basePrice: 3.50,
    price: 3.50,
    egpShort: 95,
    egpTall: 105,
    egpGrande: 115,
    egpVenti: 125,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 6,
    steps: ['shot'],
    stockUse: { beans: 3, milk: 0, ice: 0, cups: 2, food: 0 }
  },

  // 2. نكهات مميزة طوال اليوم والمشروبات المثلجة (From Image 1, 2, 3)
  {
    id: 'iced_doubleshot_dolce',
    name: 'دبل شوت™ مثلج مخفوق دولتشي دي ليتشي',
    category: 'البار البارد',
    icon: '🧋',
    basePrice: 5.85,
    price: 5.85,
    egpTall: 175,
    egpGrande: 190,
    egpVenti: 205,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 13,
    steps: ['shot', 'cold', 'milk', 'syrup'],
    stockUse: { beans: 4, milk: 3, ice: 4, cups: 3, food: 0 }
  },
  {
    id: 'iced_white_mocha',
    name: 'دبل شوت™ مثلج مخفوق وايت موكا',
    category: 'البار البارد',
    icon: '🥤',
    basePrice: 5.85,
    price: 5.85,
    egpTall: 175,
    egpGrande: 190,
    egpVenti: 205,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 13,
    steps: ['shot', 'cold', 'milk', 'syrup'],
    stockUse: { beans: 4, milk: 3, ice: 4, cups: 3, food: 0 }
  },
  {
    id: 'shaken_espresso',
    name: 'دبل شوت™ مثلج مخفوق (Iced Shaken Espresso)',
    category: 'البار البارد',
    icon: '🧋',
    basePrice: 5.15,
    price: 5.15,
    egpTall: 155,
    egpGrande: 170,
    egpVenti: 180,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 12,
    steps: ['shot', 'cold', 'syrup'],
    stockUse: { beans: 4, milk: 2, ice: 4, cups: 3, food: 0 }
  },
  {
    id: 'iced_caramel_macchiato',
    name: 'كراميل ماكياتو مثلج (Iced Caramel Macchiato)',
    category: 'البار البارد',
    icon: '🍯',
    basePrice: 4.85,
    price: 4.85,
    egpTall: 145,
    egpGrande: 155,
    egpVenti: 165,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 12,
    steps: ['shot', 'milk', 'cold', 'syrup'],
    stockUse: { beans: 3, milk: 4, ice: 4, cups: 3, food: 0 }
  },
  {
    id: 'iced_spanish_latte',
    name: 'سبانيش لاتيه مثلج (Iced Spanish Latte)',
    category: 'البار البارد',
    icon: '🧊',
    basePrice: 4.50,
    price: 4.50,
    egpTall: 135,
    egpGrande: 145,
    egpVenti: 160,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 11,
    steps: ['shot', 'milk', 'cold', 'syrup'],
    stockUse: { beans: 3, milk: 4, ice: 4, cups: 3, food: 0 }
  },
  {
    id: 'iced_matcha_latte',
    name: 'ماتشا لاتيه مثلج (Iced Matcha Latte)',
    category: 'البار البارد',
    icon: '🍵',
    basePrice: 4.50,
    price: 4.50,
    egpTall: 135,
    egpGrande: 150,
    egpVenti: 160,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 11,
    steps: ['milk', 'cold', 'syrup'],
    stockUse: { beans: 0, milk: 5, ice: 4, cups: 3, food: 0 }
  },
  {
    id: 'iced_signature_choc',
    name: 'شوكولاته مميزة مثلجة (Signature Iced Chocolate)',
    category: 'البار البارد',
    icon: '🍫',
    basePrice: 4.20,
    price: 4.20,
    egpTall: 125,
    egpGrande: 140,
    egpVenti: 155,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 10,
    steps: ['milk', 'cold', 'syrup'],
    stockUse: { beans: 0, milk: 5, ice: 4, cups: 3, food: 0 }
  },
  {
    id: 'iced_caffe_latte',
    name: 'كافيه لاتيه مثلجة (Iced Caffè Latte)',
    category: 'البار البارد',
    icon: '🥛',
    basePrice: 4.00,
    price: 4.00,
    egpTall: 120,
    egpGrande: 130,
    egpVenti: 140,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 10,
    steps: ['shot', 'milk', 'cold'],
    stockUse: { beans: 3, milk: 4, ice: 4, cups: 3, food: 0 }
  },
  {
    id: 'reserve_nitro',
    name: 'كولد بروو مثلج (Starbucks Cold Brew)',
    category: 'البار البارد',
    icon: '✨',
    basePrice: 3.85,
    price: 3.85,
    egpTall: 115,
    egpGrande: 130,
    egpVenti: 140,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 9,
    steps: ['shot', 'cold'],
    stockUse: { beans: 4, milk: 0, ice: 4, cups: 3, food: 0 }
  },
  {
    id: 'iced_americano',
    name: 'كافيه أمريكانو مثلج (Iced Caffè Americano)',
    category: 'البار البارد',
    icon: '🧊',
    basePrice: 3.85,
    price: 3.85,
    egpTall: 115,
    egpGrande: 125,
    egpVenti: 135,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 8,
    steps: ['shot', 'cold'],
    stockUse: { beans: 4, milk: 0, ice: 4, cups: 3, food: 0 }
  },

  // 3. فرابتشينو و Starbucks Refresha & Refreshments (From Image 4 & 5)
  {
    id: 'mocha_frapp',
    name: 'جافا تشيب فرابتشينو (Java Chip Frappuccino)',
    category: 'الفرابوتشينو والريفرشرز',
    icon: '🍫',
    basePrice: 5.35,
    price: 5.35,
    egpTall: 160,
    egpGrande: 170,
    egpVenti: 180,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 14,
    steps: ['shot', 'cold', 'milk', 'syrup'],
    stockUse: { beans: 3, milk: 4, ice: 5, cups: 3, food: 0 }
  },
  {
    id: 'caramel_frapp',
    name: 'دبل كاراميل فرابتشينو (Double Caramel Frappuccino)',
    category: 'الفرابوتشينو والريفرشرز',
    icon: '🥤',
    basePrice: 5.35,
    price: 5.35,
    egpTall: 160,
    egpGrande: 170,
    egpVenti: 180,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 14,
    steps: ['cold', 'milk', 'syrup'],
    stockUse: { beans: 2, milk: 4, ice: 5, cups: 3, food: 0 }
  },
  {
    id: 'white_mocha_frapp',
    name: 'وايت موكا فرابتشينو (White Mocha Frappuccino)',
    category: 'الفرابوتشينو والريفرشرز',
    icon: '🤍',
    basePrice: 5.35,
    price: 5.35,
    egpTall: 160,
    egpGrande: 170,
    egpVenti: 180,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 14,
    steps: ['shot', 'cold', 'milk', 'syrup'],
    stockUse: { beans: 2, milk: 4, ice: 5, cups: 3, food: 0 }
  },
  {
    id: 'vanilla_cream_frapp',
    name: 'فانيلا بالكريمة فرابتشينو (Vanilla Cream)',
    category: 'الفرابوتشينو والريفرشرز',
    icon: '🍦',
    basePrice: 5.35,
    price: 5.35,
    egpTall: 160,
    egpGrande: 170,
    egpVenti: 180,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 13,
    steps: ['cold', 'milk', 'syrup'],
    stockUse: { beans: 0, milk: 5, ice: 5, cups: 3, food: 0 }
  },
  {
    id: 'strawberry_cream_frapp',
    name: 'فراولة وكريمة فرابتشينو (Strawberries & Cream)',
    category: 'الفرابوتشينو والريفرشرز',
    icon: '🍓',
    basePrice: 5.35,
    price: 5.35,
    egpTall: 160,
    egpGrande: 170,
    egpVenti: 180,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 13,
    steps: ['cold', 'milk', 'syrup'],
    stockUse: { beans: 0, milk: 5, ice: 5, cups: 3, food: 0 }
  },
  {
    id: 'matcha_cream_frapp',
    name: 'ماتشا بالكريمة فرابتشينو (Matcha Cream)',
    category: 'الفرابوتشينو والريفرشرز',
    icon: '🍵',
    basePrice: 5.35,
    price: 5.35,
    egpTall: 160,
    egpGrande: 170,
    egpVenti: 180,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 13,
    steps: ['cold', 'milk', 'syrup'],
    stockUse: { beans: 0, milk: 5, ice: 5, cups: 3, food: 0 }
  },
  {
    id: 'mango_dragonfruit_refresha',
    name: 'مانجو دراجون فروت ريفرشا (Mango Dragonfruit)',
    category: 'الفرابوتشينو والريفرشرز',
    icon: '🐉',
    basePrice: 5.00,
    price: 5.00,
    egpTall: 150,
    egpGrande: 160,
    egpVenti: 170,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 10,
    steps: ['cold', 'syrup'],
    stockUse: { beans: 0, milk: 0, ice: 5, cups: 3, food: 0 }
  },
  {
    id: 'strawberry_refresher',
    name: 'ستروبيري أساي ريفرشا (Strawberry Açaí Refresha)',
    category: 'الفرابوتشينو والريفرشرز',
    icon: '🍓',
    basePrice: 5.00,
    price: 5.00,
    egpTall: 150,
    egpGrande: 160,
    egpVenti: 170,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 10,
    steps: ['cold', 'syrup'],
    stockUse: { beans: 0, milk: 0, ice: 5, cups: 3, food: 0 }
  },
  {
    id: 'berry_hibiscus_refresha',
    name: 'بيري هيبسكس ريفرشا (Berry Hibiscus Refresha)',
    category: 'الفرابوتشينو والريفرشرز',
    icon: '🌺',
    basePrice: 5.00,
    price: 5.00,
    egpTall: 150,
    egpGrande: 160,
    egpVenti: 170,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 10,
    steps: ['cold', 'syrup'],
    stockUse: { beans: 0, milk: 0, ice: 5, cups: 3, food: 0 }
  },
  {
    id: 'lemon_mint_breeze',
    name: 'ليمون بالنعناع المنعش (Lemon Mint Breeze)',
    category: 'الفرابوتشينو والريفرشرز',
    icon: '🍋',
    basePrice: 4.65,
    price: 4.65,
    egpTall: 140,
    egpGrande: 150,
    egpVenti: 160,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 9,
    steps: ['cold', 'syrup'],
    stockUse: { beans: 0, milk: 0, ice: 5, cups: 3, food: 0 }
  },
  {
    id: 'iced_tea_lemonade',
    name: 'شاي أسود / أخضر مثلج بالليمون (Iced Tea Lemonade)',
    category: 'الفرابوتشينو والريفرشرز',
    icon: '🍹',
    basePrice: 3.50,
    price: 3.50,
    egpTall: 105,
    egpGrande: 115,
    egpVenti: 125,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 8,
    steps: ['cold', 'syrup'],
    stockUse: { beans: 0, milk: 0, ice: 4, cups: 3, food: 0 }
  },

  // 4. المخبوزات والساندويتشات
  {
    id: 'butter_croissant',
    name: 'كرواسون زبدة فرنسي مسخن (Butter Croissant)',
    category: 'فرن التسخين',
    icon: '🥐',
    basePrice: 3.25,
    price: 3.25,
    egpTall: 95,
    egpGrande: 110,
    egpVenti: 125,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 8,
    steps: ['oven'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 5 }
  },
  {
    id: 'turkey_panini',
    name: 'ساندويتش ديك رومي وجبنة وبيستو ساخن',
    category: 'فرن التسخين',
    icon: '🥪',
    basePrice: 5.85,
    price: 5.85,
    egpTall: 175,
    egpGrande: 195,
    egpVenti: 210,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 11,
    steps: ['oven', 'syrup'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 2, food: 6 }
  }
];

const INITIAL_UPGRADES = [
  {
    id: 'clover_vertica',
    name: 'ماكينة Clover Vertica للتخمير الفوري',
    desc: 'تطحن وتحضّر القهوة الطازجة في 30 ثانية وتزيد سرعة خطوة سحب القهوة بنسبة +35%.',
    icon: '☕',
    level: 0,
    maxLevel: 3,
    baseCost: 150,
    costMult: 1.8
  },
  {
    id: 'mastrena_pro',
    name: 'ماكينة Thermoplan Mastrena II Pro',
    desc: 'سحب 6 شوتات إسبريسو معاً وتبخير الحليب أسرع بنسبة +30% لكل مستوى.',
    icon: '⚡',
    level: 0,
    maxLevel: 3,
    baseCost: 220,
    costMult: 1.85
  },
  {
    id: 'siren_cold_bar',
    name: 'منظومة Siren System للبار البارد',
    desc: 'موزعات ثلج وحليب علوية فوق الخلاطات تقلص زمن تحضير الفرابوتشينو والبارد بنسبة +40%.',
    icon: '🧊',
    level: 0,
    maxLevel: 3,
    baseCost: 260,
    costMult: 1.9
  },
  {
    id: 'smart_queue_ai',
    name: 'خوارزمية Smart Queue & DPM الذكية',
    desc: 'توازن طابور الصالة والدرايف ثرو والموبايل وتزيد وقت صبر جميع الزبائن بنسبة +20% لكل مستوى.',
    icon: '🧠',
    level: 0,
    maxLevel: 3,
    baseCost: 300,
    costMult: 2.0
  },
  {
    id: 'turbochef_double',
    name: 'أفران TurboChef السريعة المزدوجة',
    desc: 'مضاعفة سرعة تسخين الكرواسون والساندويتشات وتقليل استهلاك مخزون المخبوزات.',
    icon: '🔥',
    level: 0,
    maxLevel: 3,
    baseCost: 190,
    costMult: 1.75
  }
];


const INITIAL_MISSIONS = [
  {
    id: 'm_serve_5',
    title: 'بداية الوردية الصباحية',
    desc: 'قم بتحضير وتسليم 5 طلبات للزبائن بنجاح.',
    reward: 120,
    target: 5,
    type: 'served',
    claimed: false
  },
  {
    id: 'm_dt_3',
    title: 'سيد شباك الدرايف ثرو (DTO/DTR)',
    desc: 'سلّم 4 طلبات لسيارات الدرايف ثرو قبل انتهاء الوقت.',
    reward: 150,
    target: 4,
    type: 'dt_served',
    claimed: false
  },
  {
    id: 'm_clean_3',
    title: 'دورة دعم العمليات (CS Cleanliness)',
    desc: 'نظّف الطاولات أو عقّم البار 3 مرات للحفاظ على بيئة الفرع.',
    reward: 110,
    target: 3,
    type: 'clean_actions',
    claimed: false
  },
  {
    id: 'm_hire_3',
    title: 'توسيع فريق الباريستا الأول',
    desc: 'اجعل عدد الباريستات في فريقك يصل إلى 3 موظفين.',
    reward: 200,
    target: 3,
    type: 'staff_count',
    claimed: false
  },
  {
    id: 'm_menu_6',
    title: 'تطوير منيو المشروبات',
    desc: 'افتح مشروباً جديداً ليصبح لديك 6 أصناف مفتوحة في المنيو.',
    reward: 220,
    target: 6,
    type: 'menu_unlocked',
    claimed: false
  },
  {
    id: 'm_upgrade_2',
    title: 'ثورة معدات Siren System',
    desc: 'اشترِ ترقيتين لمعدات البار في تبويب المعدات.',
    reward: 280,
    target: 2,
    type: 'upgrades_bought',
    claimed: false
  },
  {
    id: 'm_serve_25',
    title: 'نجم ذروة الصباح (Peak Master)',
    desc: 'قم بخدمة 25 زبوناً إجمالاً عبر جميع القنوات.',
    reward: 450,
    target: 25,
    type: 'served',
    claimed: false
  },
  {
    id: 'm_breaks_2',
    title: 'بيئة عمل صحية (Partner Care)',
    desc: 'أرسل موظفيك إلى غرفة الاستراحة (Break Room) مرتين لتجديد طاقتهم.',
    reward: 160,
    target: 2,
    type: 'breaks_given',
    claimed: false
  },
  {
    id: 'm_emails_3',
    title: 'مدير إقليمي متفاعل',
    desc: 'اتخذ قرارات إدارية في 3 إيميلات واردة من الإدارة أو الأوبريشن.',
    reward: 200,
    target: 3,
    type: 'emails_resolved',
    claimed: false
  },
  {
    id: 'm_audit_1',
    title: 'اجتياز تفتيش الأوبريشن (QASA Pass)',
    desc: 'اجتز زيارة تفتيشية لمدير المنطقة أو الأوبريشن بنجاح.',
    reward: 300,
    target: 1,
    type: 'audits_passed',
    claimed: false
  },
  {
    id: 'm_hire_4',
    title: 'توسيع فريق الباريستا',
    desc: 'اجعل إجمالي عدد الباريستات في شبكتك يصل إلى 4 موظفين.',
    reward: 250,
    target: 4,
    type: 'staff_count',
    claimed: false
  },
  {
    id: 'm_branch_2',
    title: 'الفرع الثاني وتوزيع التشغيل',
    desc: 'افتح فرع الطريق السريع وانقل أو عيّن باريستا للعمل فيه.',
    reward: 650,
    target: 2,
    type: 'branches_unlocked',
    claimed: false
  },
  {
    id: 'm_branch_all',
    title: 'إمبراطور ستاربكس ريزيرف',
    desc: 'افتح جميع الفروع الخمسة حول المدينة!',
    reward: 2500,
    target: 5,
    type: 'branches_unlocked',
    claimed: false
  }
];

const EMAIL_TEMPLATES = [
  {
    key: 'ops_amr_atef_audit',
    sender: 'أ. عمرو عاطف (مدير الأوبريشن - Operations Manager)',
    roleBadge: 'إدارة الأوبريشن 📋',
    subject: 'متابعة معايير التشغيل والـ QASA across الـ 79 فرعاً',
    body: 'صباح الخير، أتابع معكم اليوم مؤشرات التشغيل لـ 79 فرعاً. نركز بشدة على عدم تجاوز زمن شباك الدرايف ثرو 42 ثانية، وتوافر المخزون (CLIMBS)، ومنح الباريستات فترات راحة منتظمة. هل نعتمد خطة الصيانة والتعقيم الفورية؟',
    choices: [
      { label: '🫧 تنفيذ تعقيم شامل ومعايرة الماكينات فوراً (-$25 / +8% رضا عمرو عاطف)', cost: 25, dmDelta: 4, opsDelta: 8, fullCleanAndCalibrate: true },
      { label: '📊 الالتزام بالجدول الدوري لموظف الـ CS (+2% أوبريشن)', cost: 0, dmDelta: 1, opsDelta: 2 }
    ]
  },
  {
    key: 'training_mahmoud_ahmed',
    sender: 'أ. محمود أحمد (مدير التدريب - Training Manager)',
    roleBadge: 'إدارة التدريب 🎓',
    subject: 'برنامج اعتماد مهارات Siren Craft وشهادة Coffee Master للباريستات',
    body: 'تحية طيبة! لاحظت أثناء مراجعة أداء الباريستات أن تدريب الطاقم على تسلسل المشروبات الجديد (سحب الإسبريسو قبل تبخير الحليب) يرفع سرعة البار بنسبة 20%. هل نبدأ ورشة تدريب سريعة للطاقم الآن؟',
    choices: [
      { label: '🎓 عقد ورشة تدريب مع أ. محمود أحمد (-$45 / رفع سرعة وطاقة كل الباريستات!)', cost: 45, dmDelta: 5, opsDelta: 6, trainBoostAll: true, boostStaffEnergy: 100 },
      { label: '📚 إرسال كتيبات الوصفات الرقمية للباريستات مجاناً (+2% تدريب)', cost: 0, dmDelta: 2, opsDelta: 2 }
    ]
  },
  {
    key: 'dm_ashraf_october',
    sender: 'أ. أشرف السمان (مدير منطقة أكتوبر وزايد والصحراوي)',
    roleBadge: 'منطقة أكتوبر وزايد 🛣️',
    subject: 'ضغط سيارات الدرايف ثرو في فروع الصحراوي وأركان ومول العرب',
    body: 'لدينا ذروة عالية جداً اليوم على خط أكتوبر والشيخ زايد والطريق الصحراوي (16 فرعاً). نحتاج لتأمين شحنة إمداد سريعة وتحفيز فريق الدرايف ثرو لكسب مكافأة المبيعات.',
    choices: [
      { label: '🚗 دعم خط الدرايف ثرو وتعبئة المخزون (-$30 / +8% رضا أشرف السمان)', cost: 30, dmDelta: 8, opsDelta: 4, targetDmId: 'highway_dt', fullRestock: true },
      { label: '👍 المتابعة بالطاقم الحالي (+2% رضا المنطقة)', cost: 0, dmDelta: 2, opsDelta: 1, targetDmId: 'highway_dt' }
    ]
  },
  {
    key: 'dm_mostafa_heliopolis',
    sender: 'أ. مصطفى أبو سريع (مدير منطقة مصر الجديدة ومدينة نصر)',
    roleBadge: 'مصر الجديدة ومدينة نصر 🌟',
    subject: 'إقبال قياسي على المشروبات الباردة في الكوربة وسيتي ستارز وألماظة',
    body: 'فروع مصر الجديدة ومدينة نصر (16 فرعاً) تشهد طلباً ضخماً على الآيس شيكن إسبريسو والفرابوتشينو. نقترح تفعيل عرض ترويجي خاص لزيادة إيرادات الوردية فوراً!',
    choices: [
      { label: '🥤 إطلاق الحملة الترويجية للمشروبات الباردة (+$110 إيرادات فورية!)', cost: -110, dmDelta: 7, opsDelta: 3, targetDmId: 'university' },
      { label: '⏳ تأجيل الحملة لتخفيف الضغط عن البار البارد', cost: 0, dmDelta: 1, opsDelta: 3, targetDmId: 'university' }
    ]
  },
  {
    key: 'dm_waleed_tagamoa',
    sender: 'أ. وليد عبد الله (مدير منطقة التجمع الخامس والمعادي)',
    roleBadge: 'التجمع الخامس والمعادي 💼',
    subject: 'طلبية شركات VIP واجتماعات في كايرو فيستيفال وشارع 9 المعادي',
    body: 'صباح النشاط! وصلتنا طلبية قهوة مختصة ومخبوزات ساخنة لـ 3 شركات كبرى في التجمع الخامس والمعادي (17 فرعاً). تجهيزها الآن سيحقق ربحاً ممتازاً ويرفع تقييم المنطقة.',
    choices: [
      { label: '🚀 تجهيز طلبية الـ VIP فوراً (+$145 ربح صافي و+8% رضا وليد عبد الله)', cost: -145, dmDelta: 8, opsDelta: 4, targetDmId: 'financial_vip' },
      { label: '📋 الاعتذار للتركيز على زبائن الصالة الحاليين', cost: 0, dmDelta: -2, opsDelta: 2, targetDmId: 'financial_vip' }
    ]
  },
  {
    key: 'dm_fatma_downtown',
    sender: 'أ. فاطمة عبد المنعم (مديرة منطقة وسط البلد والرحاب)',
    roleBadge: 'وسط البلد والرحاب 🏙️',
    subject: 'متابعة مظهر الصالة وراحة الباريستات في فروع وسط البلد والرحاب',
    body: 'أهلاً بك! فروع وسط البلد والرحاب (15 فرعاً) تستقبل زواراً على مدار اليوم. يهمني جداً الحفاظ على نظافة الطاولات وإعطاء الموظفين فترات راحة في الـ Break Room.',
    choices: [
      { label: '🛋️ تمويل استراحة الموظفين وتنظيف شامل (-$25 / +8% رضا فاطمة عبد المنعم)', cost: 25, dmDelta: 8, opsDelta: 6, targetDmId: 'downtown', boostStaffEnergy: 100, fullCleanAndCalibrate: true },
      { label: '✨ تنفيذ جولة تنظيف عادية (+3% رضا المنطقة)', cost: 0, dmDelta: 3, opsDelta: 2, targetDmId: 'downtown' }
    ]
  },
  {
    key: 'dm_bassem_alexandria',
    sender: 'أ. باسم حسنين (مدير منطقة الإسكندرية)',
    roleBadge: 'منطقة الإسكندرية 🌊',
    subject: 'تقرير فروع كورنيش الإسكندرية وسان ستيفانو وكفر عبده',
    body: 'تحياتي من عروس البحر المتوسط! فروع الإسكندرية الـ 15 تعمل بكامل طاقتها، ولدينا فرصة لتوريد مشروبات ستاربكس لمؤتمر ساحلي كبير اليوم.',
    choices: [
      { label: '🌊 الموافقة على تموين المؤتمر الساحلي (+$160 ربح صافي و+9% رضا باسم حسنين)', cost: -160, dmDelta: 9, opsDelta: 4, targetDmId: 'reserve_roastery' },
      { label: '📦 الاكتفاء بتشغيل الفروع المعتاد', cost: 0, dmDelta: 2, opsDelta: 2, targetDmId: 'reserve_roastery' }
    ]
  }
];

const CUSTOMER_NAMES = [
  'أحمد', 'سارة', 'يوسف', 'مريم', 'عمر', 'نور', 'خالد', 'ليلى',
  'كريم', 'ندى', 'محمود', 'رنا', 'طارق', 'ياسمين', 'زياد', 'هاجر',
  'مصطفى', 'سلمى', 'حسن', 'فريدة', 'رامي', 'دينا'
];

const APPLICANT_TEMPLATES = [
  { name: 'آدم الشامي', specialty: 'خبير بار ساخن ولاتيه آرت ☕', role: 'hot_bar', speedMult: 1.25, cost: 180 },
  { name: 'مايا الكيلاني', specialty: 'سريعة جداً في الدرايف ثرو 🚗', role: 'warming_dtr', speedMult: 1.22, cost: 175 },
  { name: 'سيف المنصور', specialty: 'محترف بار بارد وفرابوتشينو 🧊', role: 'cold_bar', speedMult: 1.28, cost: 195 },
  { name: 'جنى عبد العزيز', specialty: 'مختصة جودة وتعقيم CS 🫧', role: 'cs', speedMult: 1.20, cost: 165 },
  { name: 'فارس النجار', specialty: 'باريستا شامل متعدد المهام ⚡', role: 'flex', speedMult: 1.32, cost: 215 }
];

const STATION_ROLES = [
  { id: 'flex', label: '⚡ شامل (Flex All-Rounder)' },
  { id: 'hot_bar', label: '☕ البار الساخن (Hot Bar)' },
  { id: 'cold_bar', label: '🧊 البار البارد (Cold Bar)' },
  { id: 'warming_dtr', label: '🔥 الفرن والشباك (Warming & DTR)' },
  { id: 'cs', label: '🧹 دعم وتنظيف (Customer Support)' }
];

// =========================================================================
// STATE MANAGEMENT
// =========================================================================
function createInitialState() {
  return {
    money: 550.00,
    reputation: 96,
    cleanliness: 100,
    machineHealth: 100,
    dmSatisfaction: 92,
    opsScore: 94,
    autoBreak: true,
    day: 1,
    dayMinutes: 480, // 08:00 AM
    speed: 1,
    paused: false,
    activeBranchId: 'downtown',
    selectedTicketId: null,
    nextId: 200,
    stats: {
      served: 0,
      dt_served: 0,
      angry: 0,
      clean_actions: 0,
      upgrades_bought: 0,
      breaks_given: 0,
      emails_resolved: 0,
      audits_passed: 0,
      avgDtSeconds: 38
    },
    supplies: {
      beans: 100,
      milk: 100,
      ice: 100,
      cups: 100,
      food: 100
    },
    csTimer: 45,
    inspection: {
      active: false,
      type: 'dm_qasa',
      inspectorName: 'أ. طارق المنشاوي وم. سلمى الكيلاني',
      timeLeft: 0,
      x: 60,
      y: 340,
      targetX: 350,
      targetY: 260
    },
    auditHistory: [
      {
        day: 1,
        title: 'فحص الجاهزية الصباحي الأولي',
        score: 95,
        result: 'ممتاز - الفرع مطابق لمعايير القاسا (QASA)'
      }
    ],
    menu: JSON.parse(JSON.stringify(INITIAL_MENU)),
    upgrades: JSON.parse(JSON.stringify(INITIAL_UPGRADES)),
    branches: JSON.parse(JSON.stringify(INITIAL_BRANCHES)),
    missions: JSON.parse(JSON.stringify(INITIAL_MISSIONS)),
    applicants: [
      Object.assign({ id: 901 }, APPLICANT_TEMPLATES[0]),
      Object.assign({ id: 902 }, APPLICANT_TEMPLATES[1])
    ],
    staff: [
      {
        id: 1,
        name: 'زياد (مشرف الوردية)',
        branchId: 'downtown',
        role: 'flex',
        level: 2,
        speedMult: 1.20,
        energy: 95,
        onBreak: false,
        breakTimeLeft: 0,
        x: 330,
        y: 205,
        targetX: 330,
        targetY: 205,
        busyText: 'جاهز على البار'
      },
      {
        id: 2,
        name: 'حبيبة (باريستا)',
        branchId: 'downtown',
        storeName: 'Nile City Cairo',
        shift: 'morning',
        sickLeave: false,
        role: 'hot_bar',
        level: 1,
        speedMult: 1.05,
        energy: 88,
        onBreak: false,
        breakTimeLeft: 0,
        x: 420,
        y: 205,
        targetX: 420,
        targetY: 205,
        busyText: 'البار الساخن'
      },
      {
        id: 3,
        name: 'عمران (باريستا بارد وريفرشا)',
        branchId: 'downtown',
        storeName: 'Nile City Cairo',
        shift: 'peak',
        sickLeave: false,
        role: 'cold_bar',
        level: 2,
        speedMult: 1.18,
        energy: 94,
        onBreak: false,
        breakTimeLeft: 0,
        x: 560,
        y: 205,
        targetX: 560,
        targetY: 205,
        busyText: 'البار البارد'
      }
    ],
    trainingScore: 95,
    emails: [
      {
        id: 501,
        sender: 'أ. عمرو عاطف (مدير الأوبريشن - Operations Manager)',
        roleBadge: 'إدارة الأوبريشن 📋',
        timeStr: 'اليوم 1 - 08:00 ص',
        subject: 'خطة تشغيل شبكة الـ 79 فرعاً والتنسيق مع مديري المناطق الخمسة',
        body: 'أهلاً بك في قيادة العمليات! شبكتنا تضم 79 فرعاً موزعة على 5 مناطق بقيادة: أ. أشرف السمان (أكتوبر وزايد والصحراوي)، أ. مصطفى أبو سريع (مصر الجديدة ومدينة نصر)، أ. وليد عبد الله (التجمع والمعادي)، أ. فاطمة عبد المنعم (وسط البلد والرحاب)، وأ. باسم حسنين (الإسكندرية). اختر أولويتك لليوم الأول:',
        read: false,
        resolved: false,
        choices: [
          { label: '🚀 صرف ميزانية دعم تشغيلي للفروع (+$100 نقداً و+5% تقييم عمرو عاطف)', cost: -100, dmDelta: 5, opsDelta: 6, boostStaffEnergy: 100 },
          { label: '🫧 رفع جاهزية الفروع لزيارات الـ QASA (+9% تقييم الأوبريشن)', cost: 0, dmDelta: 4, opsDelta: 9, fullCleanAndCalibrate: true }
        ]
      },
      {
        id: 502,
        sender: 'أ. محمود أحمد (مدير التدريب - Training Manager)',
        roleBadge: 'إدارة التدريب 🎓',
        timeStr: 'اليوم 1 - 08:03 ص',
        subject: 'اعتماد خطة تدريب الباريستات وتوزيعهم بين الفروع',
        body: 'صباح الخير! بصفتي مدير التدريب، أذكرك بأهمية تدريب الباريستات ورفع مستواهم، وإرسالهم لفترات راحة في الـ Break Room قبل أن تهبط طاقتهم تحت 30%، مع نقلهم بمرونة بين المناطق الخمس حسب ضغط التشغيل.',
        read: false,
        resolved: false,
        choices: [
          { label: '🎓 اعتماد خطة أ. محمود أحمد التدريبية (-$20 / رفع سرعة الطاقم +10%)', cost: 20, dmDelta: 4, opsDelta: 6, trainBoostAll: true },
          { label: '👍 تم الاطلاع وسنتابع حالة الموظفين من لوحة الباريستات', cost: 0, dmDelta: 2, opsDelta: 3 }
        ]
      },
      {
        id: 504,
        sender: 'نظام خدمة العملاء (Customer Care - شكوى عالية الخطورة 🔴)',
        roleBadge: 'شكوى عميل عالية 🔴',
        timeStr: 'اليوم 1 - 08:06 ص',
        subject: 'شكوى عالية من العميلة "أ. نهى عبد الرحمن" في فرع طلعت حرب (حليب شوفان / وايت موكا)',
        body: 'العميلة أ. نهى عبد الرحمن وصلت الآن إلى الفرع وتنتظر الاعتذار في ركن خدمة العملاء! سبب الشكوى: تقديم حليب عادي بدلاً من حليب الشوفان (+30 ج.م) في مشروب دبل شوت مثلج مخفوق وايت موكا (كبير 205 ج.م).',
        read: false,
        resolved: false,
        choices: [
          { label: '🤝 النزول للاعتذار للعميلة بالفرع وتقديم المشروب مجاناً + قسيمة هدية (-$15 / +8% رضا)', cost: 15, dmDelta: 6, opsDelta: 8, resolveComplaintId: 701 },
          { label: '☕ إعادة تحضير المشروب بحليب الشوفان والاعتذار الرسمي (+4% رضا)', cost: 5, dmDelta: 3, opsDelta: 4, resolveComplaintId: 701 }
        ]
      },
      {
        id: 505,
        sender: 'الإدارة الهندسية وصيانة المعدات (Facilities & Maintenance 🔧)',
        roleBadge: 'طلب صيانة معدات 🛠️',
        timeStr: 'اليوم 1 - 08:07 ص',
        subject: 'تنبيه صيانة: انخفاض ضغط صمام البخار في ماكينة Mastrena II #2',
        body: 'أظهر الفحص الذكي لماكينة الإسبريسو الثانية حاجتها إلى معايرة وتبديل جوان البخار لضمان جودة فوم الكابتشينو واللاتيه.',
        read: false,
        resolved: false,
        choices: [
          { label: '🛠️ إرسال فني صيانة فوري وإصلاح الماكينة 100% (-$20 / +7% أوبريشن)', cost: 20, dmDelta: 4, opsDelta: 7, fixEquipmentId: 'eq_mastrena_2' }
        ]
      },
      {
        id: 503,
        sender: 'أ. فاطمة عبد المنعم (مديرة منطقة وسط البلد والرحاب)',
        roleBadge: 'وسط البلد والرحاب 🏙️',
        timeStr: 'اليوم 1 - 08:05 ص',
        subject: 'انطلاق الوردية في فروع وسط البلد والرحاب (15 فرعاً)',
        body: 'أهلاً بك في منطقتنا! بدأنا اليوم بتشغيل 3 فروع رئيسية من أصل 15 فرعاً في وسط البلد والرحاب. كلما حققنا أرباحاً يمكنك فتح باقي الفروع في منطقتنا وفي مناطق زملائي المديرين حتى نصل إلى 79 فرعاً!',
        read: false,
        resolved: false,
        choices: [
          { label: '☕ تحفيز باريستات وسط البلد والرحاب (+5% رضا أ. فاطمة عبد المنعم)', cost: 0, dmDelta: 5, opsDelta: 2, targetDmId: 'downtown' }
        ]
      }
    ],
    orders: [],
    activeMenuCat: 'all',
    activeSubStoreName: 'Nile City Cairo',
    complaintFilter: 'all',
    wide3D: false,
    camAngle: 0,
    complaints: [
      {
        id: 701,
        severity: 'high',
        severityLabel: 'عالية الخطورة 🔴',
        customerName: 'أ. نهى عبد الرحمن',
        branchName: 'Nile City Cairo',
        drinkName: 'دبل شوت™ مثلج مخفوق وايت موكا (كبير 205 ج.م)',
        issue: 'طلبت حليب شوفان خالي من الألبان (+30 ج.م) وتم تحضيره بحليب عادي بالإضافة لتأخير التسليم 12 دقيقة!',
        inStore: true,
        resolved: false,
        compCost: 15,
        x: 195,
        y: 358
      },
      {
        id: 702,
        severity: 'medium',
        severityLabel: 'متوسطة 🟡',
        customerName: 'م. وائل شكري',
        branchName: 'Arkan Plaza',
        drinkName: 'جافا تشيب فرابتشينو (وسط 170 ج.م)',
        issue: 'المشروب قليل الثلج وبدون كريمة مخفوقة رغم دفع +20 ج.م للإضافة.',
        inStore: true,
        resolved: false,
        compCost: 8,
        x: 255,
        y: 362
      },
      {
        id: 703,
        severity: 'low',
        severityLabel: 'منخفضة 🟢',
        customerName: 'سلمى زكي',
        branchName: 'Al Rehab Avenue',
        drinkName: 'كابتشينو كلاسيك (عادي 120 ج.م)',
        issue: 'نقص المناديل الورقية على طاولة الصالة رقم 2 وتأخر بسيط في النداء على الاسم.',
        inStore: false,
        resolved: false,
        compCost: 0,
        x: 305,
        y: 360
      }
    ],
    equipmentList: [
      { id: 'eq_mastrena_1', name: 'ماكينة الإسبريسو Mastrena II #1', icon: '☕', health: 92, status: 'تعمل بكفاءة', ticketOpen: false, cost: 15 },
      { id: 'eq_mastrena_2', name: 'ماكينة الإسبريسو Mastrena II #2', icon: '⚡', health: 64, status: 'تحتاج معايرة وصيانة صمام البخار', ticketOpen: true, cost: 20 },
      { id: 'eq_siren_blender', name: 'خلاطات الفرابوتشينو Vitamix & Siren', icon: '🥤', health: 88, status: 'تعمل بكفاءة', ticketOpen: false, cost: 15 },
      { id: 'eq_turbochef', name: 'فرن التسخين المزدوج TurboChef', icon: '🔥', health: 79, status: 'يحتاج تنظيف فلاتر الحرارة', ticketOpen: false, cost: 15 },
      { id: 'eq_ice_maker', name: 'ماكينة الثلج والفلاتر Manitowoc', icon: '🧊', health: 95, status: 'تعمل بكفاءة', ticketOpen: false, cost: 12 },
      { id: 'eq_pastry_chill', name: 'ثلاجة عرض المخبوزات والألبان 3D', icon: '🥐', health: 90, status: 'تعمل بكفاءة (تبريد 4°C)', ticketOpen: false, cost: 12 }
    ],
    sickRequests: [
      {
        id: 801,
        staffId: 2,
        staffName: 'حبيبة (باريستا)',
        branchName: 'Nile City Cairo',
        reason: 'نزلة برد وإجهاد حراري — مرفق شهادة طبية لطلب إجازة مرضية اليوم وتغطية الوردية ببديل.',
        days: 1,
        resolved: false,
        statusText: 'بانتظار موافقة مدير الفرع'
      }
    ],
    weeklyOrders: [
      { id: 'wk_beans', name: 'طلبية أسبوعية: حبوب بن (بلوند روست + سيجنتشر روست)', qty: '45 كجم', cost: 28, egpCost: 8400, orderedThisWeek: false, stockKey: 'beans' },
      { id: 'wk_milks', name: 'طلبية أسبوعية: حليب كامل + خالي لاكتوز + شوفان ولوز وجوز هند', qty: '180 لتر', cost: 24, egpCost: 7200, orderedThisWeek: false, stockKey: 'milk' },
      { id: 'wk_syrups', name: 'طلبية أسبوعية: صوص وايت موكا + دولتشي دي ليتشي + كراميل + ماتشا', qty: '60 عبوة', cost: 22, egpCost: 6600, orderedThisWeek: false, stockKey: 'cups' },
      { id: 'wk_refresha', name: 'طلبية أسبوعية: مركزات ريفرشا (مانجو دراجون فروت + ستروبيري أساي + هيبسكس)', qty: '50 عبوة', cost: 21, egpCost: 6300, orderedThisWeek: false, stockKey: 'ice' }
    ],
    tables: [
      { id: 1, x: 240, y: 420, dirty: false, occupiedBy: null, shape: 'round' },
      { id: 2, x: 410, y: 430, dirty: false, occupiedBy: null, shape: 'rect' },
      { id: 3, x: 585, y: 430, dirty: false, occupiedBy: null, shape: 'round' },
      { id: 4, x: 755, y: 420, dirty: false, occupiedBy: null, shape: 'rect' },
      { id: 5, x: 325, y: 515, dirty: false, occupiedBy: null, shape: 'round' },
      { id: 6, x: 670, y: 515, dirty: false, occupiedBy: null, shape: 'round' }
    ],
    floatingTexts: [],
    particles: []
  };
}

let state = createInitialState();

function loadSavedState(savedState) {
  try {
    const parsed = savedState;
    if (parsed) {
      if (parsed && typeof parsed.money === 'number' && Array.isArray(parsed.staff)) {
        const fresh = createInitialState();
        state = Object.assign(fresh, parsed);
        // Ensure all 28 authentic menu items exist and are UNLOCKED & AVAILABLE
        state.menu = fresh.menu.map(fm => {
          const ex = (parsed.menu || []).find(m => m.id === fm.id);
          return Object.assign({}, fm, ex ? { active: ex.active !== false } : {}, { unlocked: true });
        });
        if (!Array.isArray(state.complaints) || state.complaints.length === 0) state.complaints = fresh.complaints;
        if (!Array.isArray(state.equipmentList) || state.equipmentList.length === 0) state.equipmentList = fresh.equipmentList;
        if (!Array.isArray(state.sickRequests)) state.sickRequests = fresh.sickRequests;
        if (!Array.isArray(state.weeklyOrders) || state.weeklyOrders.length === 0) state.weeklyOrders = fresh.weeklyOrders;
        // Always sync official 79 branch names and unlock all regions so player can control any branch
        state.branches = fresh.branches;
        if (!state.activeSubStoreName || state.activeSubStoreName === 'فرع طلعت حرب') {
          state.activeSubStoreName = 'Nile City Cairo';
        }
        state.tables = fresh.tables;
        state.orders = [];
        state.floatingTexts = [];
        state.particles = [];
      }
    }
  } catch (e) {}
}

function saveGameState() {
  try {
    const copy = Object.assign({}, state, {
      orders: [],
      floatingTexts: [],
      particles: []
    });
    if (hooks.onSave) hooks.onSave(copy);
    else localStorage.setItem('sb_empire_sim_v3', JSON.stringify(copy));
  } catch (e) {}
}

// =========================================================================
// HELPER GETTERS & BRANCH / STAFF CALCULATIONS
// =========================================================================
function getActiveBranch() {
  return state.branches.find(b => b.id === state.activeBranchId) || state.branches[0];
}

function getBranchStaff(branchId) {
  return state.staff.filter(s => (s.branchId || 'downtown') === branchId);
}

function getActiveBranchStaff() {
  const all = getBranchStaff(state.activeBranchId);
  return hooks.isOnShift ? all.filter(s => hooks.isOnShift(s)) : all;
}

function getUpgradeLevel(id) {
  const u = state.upgrades.find(item => item.id === id);
  return u ? u.level : 0;
}

function getStepSpeedBonus(stepKey) {
  let mult = (state.machineHealth / 100);
  if (stepKey === 'shot') {
    mult += getUpgradeLevel('clover_vertica') * 0.35 + getUpgradeLevel('mastrena_pro') * 0.25;
  } else if (stepKey === 'milk') {
    mult += getUpgradeLevel('mastrena_pro') * 0.35;
  } else if (stepKey === 'cold') {
    mult += getUpgradeLevel('siren_cold_bar') * 0.45;
  } else if (stepKey === 'oven') {
    mult += getUpgradeLevel('turbochef_double') * 0.45;
  } else if (stepKey === 'syrup') {
    mult += getUpgradeLevel('siren_cold_bar') * 0.2;
  }
  if (hooks.stepSpeedMultiplier) mult *= hooks.stepSpeedMultiplier(stepKey);
  return Math.max(0.25, mult);
}

function getPatienceBonusMultiplier() {
  const base = 1.0 + getUpgradeLevel('smart_queue_ai') * 0.22;
  return hooks.patienceMultiplier ? base * hooks.patienceMultiplier() : base;
}

function getBranchEfficiencyRatio(branch) {
  const assigned = getBranchStaff(branch.id).filter(s => !s.onBreak).length;
  const req = branch.requiredStaff || 2;
  if (assigned === 0) return 0.15;
  return Math.min(1.5, assigned / req);
}

function getTotalOpenBranchesCount() {
  return state.branches.reduce((acc, b) => acc + (b.unlocked ? (b.openBranches || 1) : 0), 0);
}

function getPassiveIncomePerSec() {
  let total = 0;
  state.branches.forEach(b => {
    if (b.unlocked) {
      const eff = getBranchEfficiencyRatio(b);
      const subCount = b.openBranches || 1;
      const branchIncome = b.passiveRate * (1 + (subCount - 1) * 0.35) * b.level * eff;
      if (b.id !== state.activeBranchId) {
        total += branchIncome;
      } else if (subCount > 1) {
        // Extra sub-branches in the active region also generate passive income!
        total += branchIncome * 0.65;
      }
    }
  });
  return hooks.passiveMultiplier ? total * hooks.passiveMultiplier() : total;
}

function setHtml(el, html) {
  if (!el || el._sbcHtml === html) return;
  el.innerHTML = html;
  el._sbcHtml = html;
}

function showToast(msg) {
  const toast = document.getElementById('canvasToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.style.opacity = '0';
  }, 3200);
}

function addFloatingText(text, x, y, color) {
  state.floatingTexts.push({
    text,
    x,
    y,
    color: color || '#34d399',
    alpha: 1.0,
    vy: -0.9
  });
}

function spawnSparkles(x, y, color) {
  for (let i = 0; i < 10; i++) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3.2,
      vy: (Math.random() - 0.5) * 3.2,
      life: 1.0,
      color: color || '#CBA258'
    });
  }
}

// =========================================================================
// CORPORATE INBOX & DYNAMIC EMAIL GENERATOR
// =========================================================================
function pushNewEmail(templateObj, customSubject, customBody) {
  const newMail = {
    id: ++state.nextId,
    sender: templateObj.sender,
    roleBadge: templateObj.roleBadge,
    timeStr: formatDayClock(state.dayMinutes),
    subject: customSubject || templateObj.subject,
    body: customBody || templateObj.body,
    read: false,
    resolved: false,
    choices: JSON.parse(JSON.stringify(templateObj.choices || []))
  };
  state.emails.unshift(newMail);
  if (state.emails.length > 20) {
    state.emails.pop();
  }
  playSound('email');
  showToast(`📧 إيميل جديد من ${templateObj.sender.split('(')[0]}: "${newMail.subject}"`);
  updateHUD();
  renderInboxTab();
}

function generateSituationalEmail(manualTrigger) {
  // Check operational state to send realistic context-aware emails
  const understaffedBranch = state.branches.find(b => b.unlocked && getBranchStaff(b.id).length < (b.requiredStaff || 2));
  const tiredStaff = state.staff.find(s => s.energy < 38 && !s.onBreak);

  if (understaffedBranch) {
    pushNewEmail({
      sender: `${understaffedBranch.dmName || 'مدير المنطقة'} (${understaffedBranch.dmTitle || 'DM'})`,
      roleBadge: 'عاجل - تغطية الفروع 🚨',
      subject: `عجز باريستات في ${understaffedBranch.name}!`,
      body: `يرجى التدخل السريع! منطقتنا تعمل حالياً بعدد (${getBranchStaff(understaffedBranch.id).length}/${understaffedBranch.requiredStaff} باريستا) بينما ضغط التشغيل وصل إلى ${understaffedBranch.loadPct}%. قم بنقل باريستا إلينا من تبويب الباريستات أو عيّن موظف دعم فوراً!`,
      choices: [
        { label: `👨\u200D🍳 تعيين باريستا دعم فوري لمنطقة ${understaffedBranch.dmName} (-$160 / +8% رضا)`, cost: 160, dmDelta: 8, opsDelta: 4, targetDmId: understaffedBranch.id, emergencyHireBranch: understaffedBranch.id },
        { label: '🔄 سأنقل موظفاً بنفسي من قائمة الباريستات (+2% رضا)', cost: 0, dmDelta: 2, opsDelta: 1, targetDmId: understaffedBranch.id }
      ]
    });
    return;
  }

  if (tiredStaff) {
    pushNewEmail({
      sender: 'أ. عمرو عاطف (مدير الأوبريشن) وأ. محمود أحمد (مدير التدريب)',
      roleBadge: 'تنبيه راحة الموظفين 🥱',
      subject: `الباريستا "${tiredStaff.name}" مرهق وبحاجة لفترة راحة (Break)!`,
      body: `انخفضت طاقة ${tiredStaff.name} إلى ${Math.round(tiredStaff.energy)}% بسبب ضغط الوردية. يوصي أ. عمرو عاطف وأ. محمود أحمد بإرساله لغرفة الاستراحة لمدة 14 ثانية لاستعادة نشاطه 100% ومنع أخطاء التحضير.`,
      choices: [
        { label: '🛋️ إرسال المرهقين للاستراحة وتوزيع قهوة مجانية (-$15 / +6% أوبريشن)', cost: 15, dmDelta: 3, opsDelta: 6, boostStaffEnergy: 100 },
        { label: '👍 سأمنحه راحة يدوياً الآن من تبويب الباريستات', cost: 0, dmDelta: 1, opsDelta: 2 }
      ]
    });
    return;
  }

  const tpl = EMAIL_TEMPLATES[Math.floor(Math.random() * EMAIL_TEMPLATES.length)];
  pushNewEmail(tpl);
}


// =========================================================================
// CUSTOMER COMPLAINTS (HIGH / MEDIUM / LOW), IN-STORE APOLOGY & EMAILS
// =========================================================================
function createCustomerComplaint(custName, drinkTitle, issueText, forcedSeverity) {
  const severities = ['high', 'medium', 'low'];
  const sev = forcedSeverity || severities[Math.floor(Math.random() * severities.length)];
  const sevMap = {
    high: { label: 'عالية الخطورة 🔴', cost: 15, dmPenalty: -4 },
    medium: { label: 'متوسطة 🟡', cost: 8, dmPenalty: -2 },
    low: { label: 'منخفضة 🟢', cost: 0, dmPenalty: -1 }
  };
  const meta = sevMap[sev] || sevMap.medium;
  const curStore = state.activeSubStoreName || getActiveBranch().name;
  const compId = ++state.nextId;

  const newComp = {
    id: compId,
    severity: sev,
    severityLabel: meta.label,
    customerName: custName || CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)],
    branchName: curStore,
    drinkName: drinkTitle || 'دبل شوت™ مثلج مخفوق وايت موكا (كبير 205 ج.م)',
    issue: issueText || 'تأخر في تسليم الطلب أو اختلاف في نوع الحليب المفضل للعميل.',
    inStore: true,
    resolved: false,
    compCost: meta.cost,
    x: 195 + ((compId * 43) % 110),
    y: 358
  };

  state.complaints.unshift(newComp);
  // Send official complaint email
  pushNewEmail({
    sender: `خدمة عملاء ستاربكس (${meta.label})`,
    roleBadge: `شكوى ${meta.label}`,
    subject: `شكوى من العميل "${newComp.customerName}" في ${curStore}`,
    body: `حضر العميل "${newComp.customerName}" إلى الفرع لتسجيل شكوى (${meta.label}) بخصوص مشروب "${newComp.drinkName}": ${newComp.issue}. ينتظر العميل حالياً عند ركن خدمة العملاء للاعتذار له!`,
    choices: [
      { label: `🤝 الاعتذار للعميل بالفرع وتعويضه فوراً (-$${meta.cost} / +7% رضا وسمعة)`, cost: meta.cost, dmDelta: 5, opsDelta: 6, resolveComplaintId: compId },
      { label: '☕ استبدال المشروب مجاناً والاعتذار الرسمي (+4% رضا)', cost: 0, dmDelta: 3, opsDelta: 3, resolveComplaintId: compId }
    ]
  });

  updateHUD();
  renderOpsTab();
}

function apologizeAndResolveComplaint(compId) {
  const comp = state.complaints.find(c => c.id === compId);
  if (!comp || comp.resolved) return;

  if (comp.compCost > 0 && state.money < comp.compCost) {
    showToast(`⚠️ تحتاج إلى $${comp.compCost} لتعويض العميل وتقديم قسيمة هدية!`);
    playSound('angry');
    return;
  }

  state.money = +(state.money - (comp.compCost || 0)).toFixed(2);
  comp.resolved = true;
  comp.inStore = false;
  emit('complaint:resolved', { complaint: comp });

  // Also mark any matching email resolved
  state.emails.forEach(m => {
    if ((m.choices || []).some(ch => ch.resolveComplaintId === compId)) {
      m.resolved = true;
      m.read = true;
    }
  });

  state.reputation = Math.min(100, +(state.reputation + 2.5).toFixed(1));
  state.dmSatisfaction = Math.min(100, +(state.dmSatisfaction + 4).toFixed(1));
  state.opsScore = Math.min(100, +(state.opsScore + 4).toFixed(1));
  const curBr = getActiveBranch();
  curBr.dmSatisfaction = Math.min(100, (curBr.dmSatisfaction || 90) + 4);

  playSound('fanfare');
  spawnSparkles(comp.x || 220, comp.y || 355, '#34d399');
  addFloatingText(`🤝 تم الاعتذار وإرضاء ${comp.customerName}!`, comp.x || 240, (comp.y || 355) - 15, '#34d399');
  showToast(`🤝 قمت بالاعتذار للعميل "${comp.customerName}" في الفرع وتطبيق نموذج LATTE بنجاح! ارتفعت السمعة ورضا المدير.`);

  updateHUD();
  renderOpsTab();
  renderInboxTab();
}

function repairEquipmentItem(eqId) {
  const eq = (state.equipmentList || []).find(e => e.id === eqId);
  if (!eq) return;
  const cost = eq.cost || 15;
  if (state.money < cost) {
    showToast(`⚠️ تحتاج إلى $${cost} لإرسال طلب صيانة وإصلاح ${eq.name}!`);
    playSound('angry');
    return;
  }
  state.money = +(state.money - cost).toFixed(2);
  eq.health = 100;
  eq.status = 'تعمل بكفاءة 100% (تمت الصيانة)';
  eq.ticketOpen = false;
  emit('repair', { eqId });

  // Recalculate overall machineHealth
  const avgHealth = state.equipmentList.reduce((acc, item) => acc + item.health, 0) / state.equipmentList.length;
  state.machineHealth = Math.round(avgHealth);
  state.opsScore = Math.min(100, +(state.opsScore + 3).toFixed(1));

  playSound('fanfare');
  spawnSparkles(480, 145, '#818cf8');
  showToast(`🔧 تم إرسال فني الصيانة وإصلاح "${eq.name}" بكفاءة 100%!`);
  updateHUD();
  renderOpsTab();
}

function approveSickLeaveRequest(reqId) {
  const req = (state.sickRequests || []).find(r => r.id === reqId);
  if (!req || req.resolved) return;
  req.resolved = true;
  req.statusText = '✅ تمت الموافقة على الإجازة المرضية وتكليف باريستا بديل';
  emit('sick:approved', { staffId: req.staffId });

  const member = state.staff.find(s => s.id === req.staffId);
  if (member) {
    member.sickLeave = true;
    member.shift = 'sick';
    member.onBreak = true;
    member.breakTimeLeft = 25;
    member.energy = 100;
    member.busyText = '🏥 في إجازة مرضية معتمدة';
  }

  // Add a temporary backup barista or boost team morale
  state.opsScore = Math.min(100, +(state.opsScore + 4).toFixed(1));
  state.dmSatisfaction = Math.min(100, +(state.dmSatisfaction + 3).toFixed(1));
  playSound('fanfare');
  showToast(`🏥 تمت الموافقة على الإجازة المرضية لـ "${req.staffName}" وتأمين تغطية الوردية!`);
  updateHUD();
  renderStaffTab();
  renderOpsTab();
}

function orderWeeklySupplyItem(wkId) {
  const wk = (state.weeklyOrders || []).find(w => w.id === wkId);
  if (!wk) return;
  if (state.money < wk.cost) {
    showToast(`⚠️ الرصيد غير كافٍ لاعتماد ${wk.name} ($${wk.cost})!`);
    playSound('angry');
    return;
  }
  state.money = +(state.money - wk.cost).toFixed(2);
  wk.orderedThisWeek = true;
  emit('weekly:ordered', { id: wk.id });
  if (wk.stockKey && state.supplies[wk.stockKey] !== undefined) {
    state.supplies[wk.stockKey] = 100;
  }
  state.supplies.beans = Math.min(100, state.supplies.beans + 35);
  state.supplies.milk = Math.min(100, state.supplies.milk + 35);
  state.opsScore = Math.min(100, +(state.opsScore + 2.5).toFixed(1));
  playSound('cash');
  showToast(`🚚 وصلت شحنة "${wk.name}" وتم تموين مخازن الفرع بالكامل!`);
  updateHUD();
  renderOpsTab();
}

// =========================================================================
// DISTRICT MANAGER & QASA OPERATIONS LIVE FLOOR VISIT
// =========================================================================
function startInspectionVisit(isManual, customVisitorTitle) {
  if (state.inspection.active) {
    if (isManual) showToast('👔 لجنة التفتيش موجودة داخل الفرع بالفعل!');
    return;
  }
  const curBranch = getActiveBranch();
  const visitorLabel = customVisitorTitle || `${curBranch.dmName} (${curBranch.dmTitle}) وأ. عمرو عاطف (الأوبريشن) وأ. محمود أحمد (التدريب)`;
  state.inspection.active = true;
  state.inspection.inspectorName = visitorLabel;
  state.inspection.timeLeft = 18;
  state.inspection.x = 65;
  state.inspection.y = 355;
  state.inspection.targetX = 340;
  state.inspection.targetY = 250;

  playSound('ding');
  document.getElementById('inspectionBannerText').textContent = `زيارة ميدانية جارية الآن: ${visitorLabel} داخل الفرع!`;
  showToast(`🚨 زيارة ميدانية جارية الآن من: ${visitorLabel}!`);
  document.getElementById('inspectionBanner').classList.remove('hidden');
  updateHUD();
  renderOpsTab();
}

function finishInspectionVisit() {
  state.inspection.active = false;
  document.getElementById('inspectionBanner').classList.add('hidden');

  // Evaluate 4 real criteria
  const cleanScore = state.cleanliness >= 80 ? 25 : Math.round(state.cleanliness * 0.25);
  const machineScore = state.machineHealth >= 80 ? 25 : Math.round(state.machineHealth * 0.25);
  const activeStaff = getActiveBranchStaff();
  const exhaustedCount = activeStaff.filter(s => s.energy < 30 && !s.onBreak).length;
  const staffScore = exhaustedCount === 0 && activeStaff.length > 0 ? 25 : Math.max(5, 25 - exhaustedCount * 12);
  const dtScore = state.stats.avgDtSeconds <= 45 ? 25 : Math.max(10, 25 - (state.stats.avgDtSeconds - 45));

  const totalScore = Math.min(100, Math.max(20, cleanScore + machineScore + staffScore + dtScore));
  const passed = totalScore >= 75;
  emit('audit:finished', { score: totalScore, passed });

  if (passed) {
    const bonus = totalScore >= 90 ? 240 : 140;
    state.money = +(state.money + bonus).toFixed(2);
    state.dmSatisfaction = Math.min(100, state.dmSatisfaction + 6);
    state.opsScore = Math.min(100, state.opsScore + 7);
    state.stats.audits_passed += 1;
    playSound('fanfare');
    addFloatingText(`📋 اجتياز التفتيش +$${bonus}!`, 380, 170, '#34d399');
    showToast(`🏆 اجتزت تفتيش الأوبريشن ومدير المنطقة بنتيجة ${totalScore}% وحصلت على مكافأة +$${bonus}!`);
  } else {
    const fine = 60;
    state.money = Math.max(0, +(state.money - fine).toFixed(2));
    state.dmSatisfaction = Math.max(20, state.dmSatisfaction - 8);
    state.opsScore = Math.max(20, state.opsScore - 9);
    playSound('angry');
    addFloatingText(`⚠️ مخالفة تفتيش -$${fine}`, 380, 170, '#f87171');
    showToast(`⚠️ نتيجة التفتيش ${totalScore}% (أقل من 75%). تم تسجيل ملاحظات وخصم $${fine}!`);
  }

  state.auditHistory.unshift({
    day: state.day,
    title: `زيارة تفتيش (${getActiveBranch().name})`,
    score: totalScore,
    result: passed ? `ناجح بتفوق (+$${totalScore >= 90 ? 240 : 140})` : `ملاحظات تشغيلية (-$60)`
  });

  const curBr = getActiveBranch();
  curBr.dmSatisfaction = Math.min(100, Math.max(20, (curBr.dmSatisfaction || 90) + (passed ? 6 : -7)));
  state.trainingScore = Math.min(100, Math.max(20, (state.trainingScore || 95) + (passed ? 4 : -4)));

  // Also send official audit report email
  pushNewEmail({
    sender: `${curBr.dmName} وأ. عمرو عاطف (الأوبريشن) وأ. محمود أحمد (التدريب)`,
    roleBadge: passed ? 'تقرير زيارة ناجح 🏆' : 'ملاحظات زيارة ⚠️',
    subject: `تقرير الزيارة الميدانية لـ ${curBr.name}: ${totalScore}%`,
    body: `تم إتمام الزيارة الميدانية المشتركة بواسطة ${curBr.dmName}، ومدير الأوبريشن أ. عمرو عاطف، ومدير التدريب أ. محمود أحمد. النظافة: ${cleanScore}/25، كفاءة الماكينات: ${machineScore}/25، راحة وطاقة الباريستات: ${staffScore}/25، سرعة شباك الدرايف ثرو: ${dtScore}/25.`,
    choices: [
      { label: '📌 اعتماد توصيات أ. عمرو عاطف وأ. محمود أحمد (+3% رضا الإدارة)', cost: 0, dmDelta: 3, opsDelta: 3 }
    ]
  });

  updateHUD();
  renderOpsTab();
  renderMissionsTab();
}

// =========================================================================
// ORDER GENERATION & CUSTOMER CHANNELS
// =========================================================================
function spawnCustomerOrder(forcedChannel) {
  if (state.orders.length >= 9) return;
  const availableMenu = state.menu.filter(m => m.unlocked && m.active);
  if (availableMenu.length === 0) return;

  // Most orders are drinks: a food item alone is less likely than a beverage
  // (18 food items would otherwise make up 38% of all orders).
  const itemWeight = (m) => (m.category === 'فرن التسخين' ? 0.45 : 1);
  const totalWeight = availableMenu.reduce((acc, m) => acc + itemWeight(m), 0);
  let pick = Math.random() * totalWeight;
  let item = availableMenu[availableMenu.length - 1];
  for (const m of availableMenu) {
    pick -= itemWeight(m);
    if (pick <= 0) { item = m; break; }
  }
  const branch = getActiveBranch();

  const channels = ['cafe', 'drive_thru', 'mobile', 'delivery'];
  const weights = branch.id === 'highway_dt'
    ? [0.2, 0.55, 0.15, 0.1]
    : branch.id === 'university'
      ? [0.35, 0.2, 0.35, 0.1]
      : [0.38, 0.32, 0.20, 0.10];

  let channel = forcedChannel;
  if (!channel) {
    const r = Math.random();
    let sum = 0;
    channel = 'cafe';
    for (let i = 0; i < channels.length; i++) {
      sum += weights[i];
      if (r <= sum) {
        channel = channels[i];
        break;
      }
    }
  }

  const priceRatio = item.price / item.basePrice;
  const basePatience = channel === 'drive_thru' ? 42 : channel === 'cafe' ? 46 : 55;
  const maxTime = Math.max(22, Math.round((basePatience / Math.max(0.8, priceRatio * 0.9)) * getPatienceBonusMultiplier()));

  const custName = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
  const sizes = item.egpShort ? ['Short', 'Tall', 'Grande', 'Venti'] : ['Tall', 'Grande', 'Venti'];
  const sizeArMap = { Short: 'صغير Short', Tall: 'عادي Tall', Grande: 'وسط Grande', Venti: 'كبير Venti' };
  const size = sizes[Math.floor(Math.random() * sizes.length)];
  let egpPrice = item.egpTall || 140;
  if (size === 'Short' && item.egpShort) egpPrice = item.egpShort;
  else if (size === 'Tall') egpPrice = item.egpTall || 140;
  else if (size === 'Grande') egpPrice = item.egpGrande || Math.round((item.egpTall || 140) + 15);
  else if (size === 'Venti') egpPrice = item.egpVenti || Math.round((item.egpTall || 140) + 25);

  const customAddons = [
    { label: 'حليب خالي من اللاكتوز (مجاناً)', addEgp: 0 },
    { label: 'حليب شوفان (+30 ج.م)', addEgp: 30 },
    { label: 'حليب لوز (+30 ج.م)', addEgp: 30 },
    { label: 'حليب جوز الهند (+30 ج.م)', addEgp: 30 },
    { label: 'إسبريسو بلوند روست + شوت (+20 ج.م)', addEgp: 20 },
    { label: 'كريمة مخفوقة ونكهة (+20 ج.م)', addEgp: 20 },
    { label: 'حليب كامل قياسي', addEgp: 0 }
  ];
  const chosenAddon = customAddons[Math.floor(Math.random() * customAddons.length)];
  egpPrice += chosenAddon.addEgp;
  const sizeMult = egpPrice / (item.egpTall || 140);
  const milkChoice = chosenAddon.label;

  const stepStates = {};
  item.steps.forEach(s => {
    stepStates[s] = false;
  });

  const id = ++state.nextId;
  const carColors = ['#ef4444', '#3b82f6', '#eab308', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

  const order = {
    id,
    customerName: custName,
    channel,
    itemId: item.id,
    itemName: item.name,
    itemIcon: item.icon,
    size,
    sizeLabel: sizeArMap[size] || size,
    egpPrice,
    milkChoice,
    price: +(item.price * sizeMult * branch.tipMult).toFixed(2),
    stepsRequired: item.steps.slice(),
    stepStates,
    stockUse: Object.assign({}, item.stockUse),
    progress: 0,
    maxTime,
    timeLeft: maxTime,
    carColor: carColors[id % carColors.length],
    x: channel === 'drive_thru' ? 760 : 60,
    y: channel === 'drive_thru' ? 58 : 355
  };

  state.orders.push(order);

  if (channel === 'drive_thru') {
    playSound('ding');
  }

  if (!state.selectedTicketId) {
    state.selectedTicketId = order.id;
  }

  renderTicketsQueue();
  renderWorkbench();
}

// =========================================================================
// CRAFTING, HANDOFF, AND SUPPLIES LOGIC
// =========================================================================
function hasEnoughSupplies(stockUse) {
  return (
    state.supplies.beans >= (stockUse.beans || 0) &&
    state.supplies.milk >= (stockUse.milk || 0) &&
    state.supplies.ice >= (stockUse.ice || 0) &&
    state.supplies.cups >= (stockUse.cups || 0) &&
    state.supplies.food >= (stockUse.food || 0)
  );
}

function consumeSupplies(stockUse) {
  state.supplies.beans = Math.max(0, state.supplies.beans - (stockUse.beans || 0));
  state.supplies.milk = Math.max(0, state.supplies.milk - (stockUse.milk || 0));
  state.supplies.ice = Math.max(0, state.supplies.ice - (stockUse.ice || 0));
  state.supplies.cups = Math.max(0, state.supplies.cups - (stockUse.cups || 0));
  state.supplies.food = Math.max(0, state.supplies.food - (stockUse.food || 0));
}

function syncOrderProgressFromSteps(order) {
  const total = order.stepsRequired.length;
  if (total === 0) {
    order.progress = 100;
    return;
  }
  const doneCount = order.stepsRequired.filter(s => order.stepStates[s]).length;
  order.progress = Math.min(100, Math.round((doneCount / total) * 100));
}

function performOrderStep(order, stepKey, isManual) {
  if (!order) return false;
  if (!order.stepsRequired.includes(stepKey)) {
    if (isManual) showToast('⚠️ هذه الخطوة غير مطلوبة في وصفة هذا الطلب!');
    return false;
  }
  if (order.stepStates[stepKey]) {
    if (isManual) showToast('✅ تم إنجاز هذه الخطوة بالفعل!');
    return false;
  }
  if (!hasEnoughSupplies(order.stockUse)) {
    if (isManual) {
      showToast('🚨 نفد المخزون من البار! اضغط "تعبئة كل المخزون" في محطة الـ CS أولاً.');
      playSound('angry');
    }
    return false;
  }

  order.stepStates[stepKey] = true;
  syncOrderProgressFromSteps(order);
  if (isManual) emit('order:step', { order, stepKey });
  if (isManual) {
    playSound('step');
    spawnSparkles(400, 195, '#34d399');
  }

  if (order.progress >= 100) {
    completeAndHandoffOrder(order.id, isManual);
  } else {
    renderWorkbench();
    renderTicketsQueue();
  }
  return true;
}

function completeAndHandoffOrder(orderId, isManualBonus) {
  const idx = state.orders.findIndex(o => o.id === orderId);
  if (idx === -1) return;
  const order = state.orders[idx];

  if (!hasEnoughSupplies(order.stockUse)) {
    showToast('🚨 المخزون غير كافٍ لإتمام الطلب! قم بتعبئة المخزون فوراً.');
    playSound('angry');
    return;
  }

  consumeSupplies(order.stockUse);

  const ratioLeft = order.timeLeft / order.maxTime;
  const speedTip = ratioLeft > 0.5 ? +(order.price * 0.25).toFixed(2) : ratioLeft > 0.25 ? +(order.price * 0.1).toFixed(2) : 0;
  const manualBonus = isManualBonus ? 1.00 : 0;
  const totalEarned = +(order.price + speedTip + manualBonus).toFixed(2);

  state.money = +(state.money + totalEarned).toFixed(2);
  state.stats.served += 1;
  if (order.channel === 'drive_thru') {
    state.stats.dt_served += 1;
    const elapsed = Math.max(12, Math.round(order.maxTime - order.timeLeft));
    state.stats.avgDtSeconds = Math.round(state.stats.avgDtSeconds * 0.7 + elapsed * 0.3);
  }

  state.reputation = Math.min(100, +(state.reputation + 0.4).toFixed(1));
  state.dmSatisfaction = Math.min(100, +(state.dmSatisfaction + 0.25).toFixed(1));
  state.machineHealth = Math.max(35, +(state.machineHealth - 0.6).toFixed(1));

  if (order.channel === 'cafe' && Math.random() < 0.52) {
    const cleanTables = state.tables.filter(t => !t.dirty);
    if (cleanTables.length > 0) {
      cleanTables[Math.floor(Math.random() * cleanTables.length)].dirty = true;
      state.cleanliness = Math.max(20, state.cleanliness - 6);
    }
  } else {
    state.cleanliness = Math.max(20, state.cleanliness - 1.5);
  }

  playSound('cash');
  const popX = order.channel === 'drive_thru' ? 230 : 510;
  const popY = order.channel === 'drive_thru' ? 58 : 210;
  addFloatingText(`+$${totalEarned.toFixed(2)}`, popX, popY, '#34d399');
  spawnSparkles(popX, popY, '#CBA258');

  emit('order:served', {
    order,
    earned: totalEarned,
    tip: speedTip,
    ratioLeft,
    manual: !!isManualBonus,
    elapsed: Math.max(0, +(order.maxTime - order.timeLeft).toFixed(1))
  });
  state.orders.splice(idx, 1);
  if (state.selectedTicketId === orderId) {
    state.selectedTicketId = state.orders.length > 0 ? state.orders[0].id : null;
  }

  updateHUD();
  renderTicketsQueue();
  renderWorkbench();
  renderMissionsTab();
}

// =========================================================================
// CUSTOMER SUPPORT (CS) & BREAK MANAGEMENT ACTIONS
// =========================================================================
function cleanLobbyTables(isAutoCS) {
  let cleanedCount = 0;
  state.tables.forEach(t => {
    if (t.dirty) {
      t.dirty = false;
      cleanedCount++;
      spawnSparkles(t.x, t.y, '#38bdf8');
    }
  });
  if (cleanedCount > 0 || state.cleanliness < 100) {
    state.cleanliness = Math.min(100, state.cleanliness + 18);
    state.opsScore = Math.min(100, +(state.opsScore + 1.2).toFixed(1));
    state.stats.clean_actions += 1;
    if (!isAutoCS) {
      emit('clean:manual', { kind: 'tables' });
      playSound('step');
      showToast(`🧹 تم تنظيف طاولات الصالة ورفع مستوى النظافة إلى ${Math.round(state.cleanliness)}%!`);
    }
    updateHUD();
    renderMissionsTab();
  } else if (!isAutoCS) {
    showToast('✨ جميع طاولات الصالة نظيفة ولامعة حالياً!');
  }
}

function sanitizeBarStations(isAutoCS) {
  state.cleanliness = Math.min(100, state.cleanliness + 20);
  state.opsScore = Math.min(100, +(state.opsScore + 1.5).toFixed(1));
  state.csTimer = 45;
  state.stats.clean_actions += 1;
  if (!isAutoCS) {
    emit('clean:manual', { kind: 'sanitize' });
    playSound('step');
    spawnSparkles(400, 195, '#2dd4bf');
    showToast('🫧 تم تعقيم عصا البخار وتبديل أدوات الـ Smallwares وتجديد دورة الـ CS!');
  }
  updateHUD();
  renderMissionsTab();
}

function calibrateMachines(isAutoCS) {
  state.machineHealth = 100;
  state.opsScore = Math.min(100, +(state.opsScore + 1.5).toFixed(1));
  if (!isAutoCS) {
    emit('clean:manual', { kind: 'calibrate' });
    playSound('step');
    spawnSparkles(370, 140, '#818cf8');
    showToast('🔧 تمت معايرة ماكينات Mastrena II وClover Vertica إلى كفاءة 100%!');
  }
  updateHUD();
}

function restockAllSupplies(isFreeCS) {
  const cost = isFreeCS ? 0 : 25;
  if (!isFreeCS && state.money < cost) {
    showToast('⚠️ الرصيد غير كافٍ لشراء شحنة مخزون ($25)!');
    playSound('angry');
    return;
  }
  if (!isFreeCS) {
    state.money = +(state.money - cost).toFixed(2);
  }
  state.supplies.beans = 100;
  state.supplies.milk = 100;
  state.supplies.ice = 100;
  state.supplies.cups = 100;
  state.supplies.food = 100;
  if (!isFreeCS) {
    emit('restock', {});
    playSound('step');
    showToast('📦 تم ملء جميع محطات البار (حبوب البن، الحليب، الثلج، الأكواب، المخبوزات) بنسبة 100%!');
  }
  updateHUD();
}

function sendBaristaToBreak(staffId, isAuto) {
  const b = state.staff.find(s => s.id === staffId);
  if (!b || b.onBreak) return;
  b.onBreak = true;
  b.breakTimeLeft = 14;
  b.targetX = 52;
  b.targetY = 185 + (b.id % 2) * 32;
  b.busyText = '☕ في استراحة (Break)';
  state.stats.breaks_given += 1;
  emit('staff:break', { staffId, auto: !!isAuto });
  state.opsScore = Math.min(100, +(state.opsScore + 1.0).toFixed(1));
  if (!isAuto) {
    playSound('step');
    showToast(`🛋️ أرسلت "${b.name}" إلى غرفة الاستراحة لمدة 14 ثانية لاستعادة نشاطه 100%!`);
  }
  updateHUD();
  renderStaffTab();
  renderMissionsTab();
}

// =========================================================================
// SIMULATION TICK (1 Second Logical Tick)
// =========================================================================
let spawnAccumulator = 0;
let emailTickCounter = 0;
let spawnLpCaseFn = null; // set once the V8 controls are wired

function simulationStep() {
  if (state.paused) return;

  const mult = state.speed;
  for (let s = 0; s < mult; s++) {
    // 1. Advance clock & daypart
    state.dayMinutes += 2;
    if (state.dayMinutes >= 1320) {
      emit('day:end', { day: state.day });
      state.day += 1;
      state.dayMinutes = 360;
      emit('day:start', { day: state.day });
      // Fluctuate branch loads each new day
      state.branches.forEach(b => {
        b.loadPct = Math.min(100, Math.max(45, b.loadPct + Math.round((Math.random() - 0.45) * 18)));
      });
      showToast(`🌅 بداية اليوم ${state.day} - تم تحديث تقارير ضغط التشغيل في الفروع!`);
      generateSituationalEmail(false);
      saveGameState();
    }

    // 2. Passive income from other unlocked branches
    const passive = getPassiveIncomePerSec();
    if (passive > 0) {
      state.money = +(state.money + passive).toFixed(2);
    }

    // 3. Periodic situational emails & scheduled inspections
    emailTickCounter += 1;
    if (emailTickCounter % 38 === 0) {
      generateSituationalEmail(false);
    }
    if (emailTickCounter % 65 === 0 && !state.inspection.active) {
      startInspectionVisit(false);
    }

    // 4. Active Inspection Visit Countdown & Movement
    if (state.inspection.active) {
      state.inspection.timeLeft -= 1;
      // Move inspector around the store stations
      const waypoints = [
        { x: 200, y: 260 },
        { x: 380, y: 245 },
        { x: 540, y: 255 },
        { x: 115, y: 200 },
        { x: 350, y: 320 }
      ];
      const wp = waypoints[state.inspection.timeLeft % waypoints.length];
      state.inspection.targetX = wp.x;
      state.inspection.targetY = wp.y;
      document.getElementById('inspectionTimerBadge').textContent = `${state.inspection.timeLeft}ث`;

      if (state.inspection.timeLeft <= 0) {
        finishInspectionVisit();
      }
    }

    // 5. CS Timer countdown
    state.csTimer = Math.max(0, state.csTimer - 1);
    if (state.csTimer === 0) {
      state.cleanliness = Math.max(15, state.cleanliness - 1);
      state.opsScore = Math.max(20, +(state.opsScore - 0.3).toFixed(1));
    }

    // 6. Spawn orders based on daypart & branch traffic
    const branch = getActiveBranch();
    const hr = Math.floor(state.dayMinutes / 60);
    let daypartRate = 0.26;
    if (hr >= 7 && hr < 11) daypartRate = 0.42;
    else if (hr >= 11 && hr < 16) daypartRate = 0.30;
    else if (hr >= 16) daypartRate = 0.24;

    spawnAccumulator += daypartRate * branch.trafficMult * (hooks.spawnRateMultiplier ? hooks.spawnRateMultiplier() : 1);
    if (spawnAccumulator >= 1.0) {
      spawnAccumulator -= 1.0;
      spawnCustomerOrder();
    }

    // 7. Update active orders countdown & check anger timeout
    const cleanlinessPenalty = state.cleanliness < 50 ? 1.6 : 1.0;
    for (let i = state.orders.length - 1; i >= 0; i--) {
      const ord = state.orders[i];
      ord.timeLeft = +(ord.timeLeft - cleanlinessPenalty).toFixed(1);
      if (ord.timeLeft <= 0) {
        state.stats.angry += 1;
        state.reputation = Math.max(10, +(state.reputation - 3.5).toFixed(1));
        state.dmSatisfaction = Math.max(15, +(state.dmSatisfaction - 2.0).toFixed(1));
        state.opsScore = Math.max(15, +(state.opsScore - 1.5).toFixed(1));
        playSound('angry');
        const ax = ord.channel === 'drive_thru' ? 240 : 480;
        const ay = ord.channel === 'drive_thru' ? 60 : 280;
        addFloatingText(`😡 غادر غاضباً!`, ax, ay, '#f87171');
        showToast(`😡 غادر ${ord.customerName} (${ord.itemName}) بسبب التأخير وسجل شكوى عميل!`);
        createCustomerComplaint(ord.customerName, `${ord.itemName} (${ord.sizeLabel || ord.size})`, 'تأخير تحضير المشروب عن الوقت المسموح ومغادرة الطابور بغضب.', 'high');
        emit('order:angry', { order: ord });
        const removedId = ord.id;
        state.orders.splice(i, 1);
        if (state.selectedTicketId === removedId) {
          state.selectedTicketId = state.orders.length > 0 ? state.orders[0].id : null;
        }
      }
    }

    // 8. Run Barista AI, Energy Drain & Break Recovery
    runBaristaAI();
    emit('sim:step', { minutes: 2 });
  }

  emit('sim:tick', { speed: mult });
  updateHUD();
  renderTicketsQueue();
  renderWorkbench();
  checkMissionAlert();
}

function runBaristaAI() {
  // First handle break recovery across ALL branches
  state.staff.forEach(b => {
    if (b.onBreak) {
      b.breakTimeLeft -= 1;
      b.energy = Math.min(100, b.energy + 8);
      b.busyText = `🛋️ راحة (${Math.max(0, b.breakTimeLeft)}ث)`;
      if (b.breakTimeLeft <= 0 || b.energy >= 100) {
        b.onBreak = false;
        b.energy = 100;
        b.busyText = '✨ عاد بنشاط 100%';
      }
    } else if ((b.branchId || 'downtown') !== state.activeBranchId) {
      // Staff in other branches slowly drain energy and auto-rest if autoBreak is on
      b.energy = Math.max(15, +(b.energy - 0.35).toFixed(1));
      if (state.autoBreak && b.energy <= 28) {
        b.onBreak = true;
        b.breakTimeLeft = 12;
      }
    }
  });

  // Active branch staff work on stations
  const activeStaff = getActiveBranchStaff();
  activeStaff.forEach((barista, idx) => {
    if (barista.onBreak) {
      barista.targetX = 50;
      barista.targetY = 180 + (idx % 3) * 35;
      return;
    }

    // Auto-break check if enabled and energy is low
    if (state.autoBreak && barista.energy <= 24 && activeStaff.filter(s => !s.onBreak).length > 1) {
      sendBaristaToBreak(barista.id, true);
      return;
    }

    const fatiguePenalty = barista.energy < 30 ? 0.45 : 1.0;

    // CS Role
    if (barista.role === 'cs') {
      barista.targetX = 185;
      barista.targetY = 205;
      const hasDirty = state.tables.some(t => t.dirty);
      const lowStock = Object.values(state.supplies).some(v => v < 45);
      if (hasDirty) {
        cleanLobbyTables(true);
        barista.energy = Math.max(10, +(barista.energy - 0.8).toFixed(1));
        barista.busyText = 'ينظف الصالة 🧹';
        return;
      }
      if (lowStock) {
        state.supplies.beans = Math.min(100, state.supplies.beans + 25);
        state.supplies.milk = Math.min(100, state.supplies.milk + 25);
        state.supplies.ice = Math.min(100, state.supplies.ice + 25);
        state.supplies.cups = Math.min(100, state.supplies.cups + 25);
        state.supplies.food = Math.min(100, state.supplies.food + 25);
        barista.energy = Math.max(10, +(barista.energy - 0.8).toFixed(1));
        barista.busyText = 'يموّن البار 📦';
        return;
      }
      if (state.csTimer < 15 || state.cleanliness < 85 || state.machineHealth < 85) {
        sanitizeBarStations(true);
        calibrateMachines(true);
        barista.busyText = 'يعقّم ويعاير 🫧';
        return;
      }
    }

    if (state.orders.length === 0) {
      barista.busyText = barista.energy < 30 ? '🥱 مرهق (يحتاج راحة)' : 'جاهز على البار';
      barista.targetX = 270 + (idx * 85) % 320;
      barista.targetY = 205;
      return;
    }

    let targetOrder = null;
    let targetStep = null;
    const sortedOrders = state.orders.slice().sort((a, b) => a.timeLeft - b.timeLeft);

    for (let o of sortedOrders) {
      for (let st of o.stepsRequired) {
        if (!o.stepStates[st]) {
          const roleMatches =
            barista.role === 'flex' ||
            barista.role === 'cs' ||
            (barista.role === 'hot_bar' && (st === 'shot' || st === 'milk' || st === 'syrup')) ||
            (barista.role === 'cold_bar' && (st === 'cold' || st === 'syrup' || st === 'milk')) ||
            (barista.role === 'warming_dtr' && (st === 'oven' || o.channel === 'drive_thru'));

          if (roleMatches) {
            targetOrder = o;
            targetStep = st;
            break;
          }
        }
      }
      if (targetOrder) break;
    }

    if (!targetOrder && sortedOrders.length > 0) {
      targetOrder = sortedOrders[0];
      targetStep = targetOrder.stepsRequired.find(s => !targetOrder.stepStates[s]);
    }

    if (targetOrder && targetStep) {
      const stationCoords = {
        shot: { x: 360, y: 205 },
        milk: { x: 405, y: 205 },
        cold: { x: 500, y: 205 },
        syrup: { x: 455, y: 205 },
        oven: { x: 590, y: 205 }
      };
      const dest = stationCoords[targetStep] || { x: 380, y: 205 };
      barista.targetX = dest.x + (idx % 2 === 0 ? -10 : 10);
      barista.targetY = dest.y;
      barista.busyText = `${barista.energy < 30 ? '🥱 ' : STEP_LABELS[targetStep].icon + ' '}${targetOrder.itemName.split(' ')[0]}`;

      barista._workAcc = (barista._workAcc || 0) + (0.50 * barista.speedMult * fatiguePenalty * getStepSpeedBonus(targetStep));
      if (barista._workAcc >= 1.0) {
        barista._workAcc = 0;
        barista.energy = Math.max(5, +(barista.energy - 1.4).toFixed(1));
        if (hasEnoughSupplies(targetOrder.stockUse)) {
          performOrderStep(targetOrder, targetStep, false);
        } else {
          barista.busyText = '⚠️ نقص مخزون!';
        }
      }
    }
  });
}

// =========================================================================
// UI RENDERERS
// =========================================================================
function formatDayClock(mins) {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h24 >= 12 ? 'م' : 'ص';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mStr = m < 10 ? '0' + m : '' + m;
  return `اليوم ${state.day} - ${h12}:${mStr} ${period}`;
}

function getDaypartText(mins) {
  const hr = Math.floor(mins / 60);
  if (hr < 7) return '🌅 وردية الافتتاح (Opening)';
  if (hr < 11) return '☀️ ذروة الصباح (Morning Peak)';
  if (hr < 16) return '🌤️ وردية الظهيرة (Mid Shift)';
  return '🌙 المساء والإغلاق (Closing)';
}

function updateHUD() {
  const branch = getActiveBranch();
  const activeStaff = getActiveBranchStaff();

  document.getElementById('hudBranchBadge').textContent = branch.name;
  document.getElementById('canvasStoreTitle').textContent = `خريطة ${branch.name}: الصالة + البار + استراحة الموظفين + الدرايف ثرو`;
  document.getElementById('hudDaypartLabel').textContent = getDaypartText(state.dayMinutes);
  document.getElementById('hudClock').textContent = formatDayClock(state.dayMinutes);
  document.getElementById('hudMoney').textContent = `$${state.money.toFixed(2)}`;

  const passive = getPassiveIncomePerSec();
  document.getElementById('hudPassiveIncome').textContent = `+$${passive.toFixed(1)}/ث`;

  const curDmSat = branch.dmSatisfaction !== undefined ? branch.dmSatisfaction : state.dmSatisfaction;
  const dmShortName = (branch.dmName || 'مدير المنطقة').replace('أ. ', '');
  const dmNameEl = document.getElementById('hudDmNameLabel');
  if (dmNameEl) dmNameEl.textContent = dmShortName;
  document.getElementById('hudDmScore').textContent = `${Math.round(curDmSat)}%`;
  document.getElementById('hudOpsScore').textContent = `${Math.round(state.opsScore)}%`;
  const trainEl = document.getElementById('hudTrainScore');
  if (trainEl) trainEl.textContent = `${Math.round(state.trainingScore || 95)}%`;
  const brTotalEl = document.getElementById('hudBranchesTotal');
  if (brTotalEl) brTotalEl.textContent = `${getTotalOpenBranchesCount()} / 79`;

  const stars = (Math.max(1, (state.reputation / 20))).toFixed(1);
  document.getElementById('hudReputation').textContent = `${stars} ★`;
  document.getElementById('hudCleanliness').textContent = `${Math.round(state.cleanliness)}%`;
  document.getElementById('hudDtTimer').textContent = `${state.stats.avgDtSeconds} ثانية`;
  document.getElementById('machineHealthLabel').textContent = `${Math.round(state.machineHealth)}%`;

  document.getElementById('statStaffCount').textContent = activeStaff.filter(s => !s.onBreak).length;
  document.getElementById('statBreakCount').textContent = activeStaff.filter(s => s.onBreak).length;
  document.getElementById('statQueueCount').textContent = state.orders.length;
  document.getElementById('statServedCount').textContent = state.stats.served;
  document.getElementById('statAngryCount').textContent = state.stats.angry;

  document.getElementById('csCycleTimerBadge').textContent =
    state.csTimer > 0 ? `⏱️ دورة الـ CS القادمة: ${state.csTimer} ث` : `🚨 حان وقت تعقيم البار وتجديد الـ CS!`;

  const dirtyCount = state.tables.filter(t => t.dirty).length;
  document.getElementById('dirtyTablesBadge').textContent = dirtyCount;

  // Unread emails badge
  const unreadCount = state.emails.filter(e => !e.resolved).length;
  const inboxBadge = document.getElementById('inboxUnreadBadge');
  inboxBadge.textContent = unreadCount;
  inboxBadge.classList.toggle('hidden', unreadCount === 0);

  // Staff fatigue indicator
  const anyFatigued = state.staff.some(s => s.energy < 30 && !s.onBreak);
  document.getElementById('staffFatigueDot').classList.toggle('hidden', !anyFatigued);

  // Supply bars
  const keys = [
    { k: 'beans', valId: 'stockBeansVal', barId: 'stockBeansBar' },
    { k: 'milk', valId: 'stockMilkVal', barId: 'stockMilkBar' },
    { k: 'ice', valId: 'stockIceVal', barId: 'stockIceBar' },
    { k: 'cups', valId: 'stockCupsVal', barId: 'stockCupsBar' },
    { k: 'food', valId: 'stockFoodVal', barId: 'stockFoodBar' }
  ];
  keys.forEach(item => {
    const val = Math.round(state.supplies[item.k]);
    document.getElementById(item.valId).textContent = `${val}%`;
    document.getElementById(item.barId).style.width = `${val}%`;
  });

  const sqLvl = getUpgradeLevel('smart_queue_ai');
  document.getElementById('smartQueueBadge').textContent =
    sqLvl > 0 ? `خوارزمية Smart Queue v${sqLvl} نشطة 🧠` : 'الأولوية: FIFO عادي';

  // Update active individual store badge & dropdown
  const activeSubStore = state.activeSubStoreName || (branch.branchNames && branch.branchNames[0]) || branch.name;
  document.getElementById('hudBranchBadge').textContent = `${activeSubStore} (${branch.dmName})`;
  document.getElementById('canvasStoreTitle').textContent = `منظور 3D لـ ${activeSubStore} — إشراف ${branch.dmName}`;

  const storeSel = document.getElementById('hudStoreSelector');
  if (storeSel) {
    const allOpenOptions = [];
    state.branches.forEach(b => {
      if (b.unlocked) {
        const cnt = b.openBranches || 1;
        for (let i = 0; i < cnt; i++) {
          const sName = (b.branchNames && b.branchNames[i]) ? b.branchNames[i] : `${b.name.split('(')[0].trim()} #${i + 1}`;
          const val = `${b.id}__${sName}`;
          const isSelected = (b.id === state.activeBranchId && activeSubStore === sName);
          allOpenOptions.push(`<option value="${val}" ${isSelected ? 'selected' : ''}>📍 ${sName} (${b.dmName})</option>`);
        }
      }
    });
    storeSel.innerHTML = allOpenOptions.join('');
  }

  // Update Complaints, Maintenance & Sick Leave badges + Live In-Store Complaint Banner
  const openComplaints = (state.complaints || []).filter(c => !c.resolved);
  const inStoreComplaint = openComplaints.find(c => c.inStore);
  const compBadge = document.getElementById('complaintsCountBadge');
  if (compBadge) {
    compBadge.textContent = openComplaints.length;
    compBadge.classList.toggle('hidden', openComplaints.length === 0);
  }

  const liveCompBanner = document.getElementById('liveComplaintBanner');
  if (liveCompBanner) {
    if (inStoreComplaint) {
      liveCompBanner.classList.remove('hidden');
      document.getElementById('liveComplaintBannerText').textContent =
        `شكوى (${inStoreComplaint.severityLabel}) بالفرع الآن: العميل "${inStoreComplaint.customerName}" يشتكي من (${inStoreComplaint.drinkName}) وينتظر اعتذارك!`;
      document.getElementById('btnBannerApologizeNow').setAttribute('data-apologize-id', inStoreComplaint.id);
    } else {
      liveCompBanner.classList.add('hidden');
    }
  }

  const openMaintCount = (state.equipmentList || []).filter(e => e.ticketOpen || e.health < 75).length;
  const maintBadge = document.getElementById('maintCountBadge');
  if (maintBadge) {
    maintBadge.textContent = openMaintCount;
    maintBadge.classList.toggle('hidden', openMaintCount === 0);
  }

  const openSickCount = (state.sickRequests || []).filter(r => !r.resolved).length;
  const sickBadge = document.getElementById('sickCountBadge');
  if (sickBadge) {
    sickBadge.textContent = openSickCount;
    sickBadge.classList.toggle('hidden', openSickCount === 0);
  }
}

function getChannelMeta(ch) {
  if (ch === 'drive_thru') return { label: 'درايف ثرو 🚗', cls: 'bg-sky-900/90 text-sky-200 border-sky-500/50' };
  if (ch === 'mobile') return { label: 'تطبيق الموبايل 📱', cls: 'bg-purple-900/90 text-purple-200 border-purple-500/50' };
  if (ch === 'delivery') return { label: 'توصيل سريع 🛵', cls: 'bg-amber-900/90 text-amber-200 border-amber-500/50' };
  return { label: 'زبون الصالة 🏪', cls: 'bg-emerald-900/90 text-emerald-200 border-emerald-500/50' };
}

function renderWorkbench() {
  const order = state.orders.find(o => o.id === state.selectedTicketId) || state.orders[0];
  if (order && state.selectedTicketId !== order.id) {
    state.selectedTicketId = order.id;
  }

  const iconEl = document.getElementById('wbDrinkIcon');
  const nameEl = document.getElementById('wbDrinkName');
  const infoEl = document.getElementById('wbCustomerInfo');
  const priceEl = document.getElementById('wbPrice');
  const timerEl = document.getElementById('wbTimerText');
  const chEl = document.getElementById('selectedTicketChannel');
  const stepsEl = document.getElementById('wbStepsList');
  const progEl = document.getElementById('wbProgressBar');

  if (!order) {
    iconEl.textContent = '☕';
    nameEl.textContent = 'لا يوجد طلب محدد حالياً';
    infoEl.textContent = 'بانتظار دخول زبون أو سيارة درايف ثرو (أو اضغط "⚡ موجة ذروة")';
    priceEl.textContent = '$0.00';
    timerEl.textContent = '-- ثانية';
    chEl.textContent = 'البار جاهز';
    stepsEl.innerHTML = '<span class="text-[11px] text-slate-400">عند وصول تيكت جديد، اضغط على أزرار الماكينات بالأسفل لتحضيره فوراً!</span>';
    progEl.style.width = '0%';
    return;
  }

  const chMeta = getChannelMeta(order.channel);
  iconEl.textContent = order.itemIcon;
  nameEl.textContent = `${order.itemName} — حجم ${order.sizeLabel || order.size}`;
  infoEl.textContent = `الزبون: ${order.customerName} • التعديل: ${order.milkChoice}`;
  priceEl.textContent = `$${order.price.toFixed(2)} (${order.egpPrice || 145} ج.م)`;
  timerEl.textContent = `⏳ ${Math.ceil(order.timeLeft)} ثانية`;
  chEl.textContent = chMeta.label;
  progEl.style.width = `${order.progress}%`;

  stepsEl.innerHTML = order.stepsRequired.map(st => {
    const done = order.stepStates[st];
    const meta = STEP_LABELS[st];
    return `
      <span class="px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 ${
        done
          ? 'bg-emerald-700/80 text-white border-emerald-400'
          : 'bg-slate-800/90 text-amber-200 border-amber-500/50 animate-pulse'
      }">
        <span>${done ? '✅' : meta.icon}</span>
        <span>${meta.name}</span>
      </span>
    `;
  }).join('');
}

function renderTicketsQueue() {
  const container = document.getElementById('ticketsContainer');
  if (!container) return;

  if (state.orders.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 px-4 rounded-xl bg-[#0b1915]/60 border border-dashed border-emerald-800/60 text-emerald-300/70 text-xs">
        لا توجد تيكتات في الطابور حالياً. سيصل الزبائن والسيارات خلال لحظات أو اضغط زر <strong>⚡ موجة ذروة</strong> بالأعلى!
      </div>
    `;
    return;
  }

  container.innerHTML = state.orders.map(order => {
    const isSelected = order.id === state.selectedTicketId;
    const ratio = Math.max(0, order.timeLeft / order.maxTime);
    const isUrgent = ratio < 0.32;
    const barColor = ratio > 0.55 ? 'bg-emerald-400' : ratio > 0.3 ? 'bg-amber-400' : 'bg-rose-500';
    const mood = ratio > 0.6 ? '😊' : ratio > 0.32 ? '😐' : '😠';
    const chMeta = getChannelMeta(order.channel);

    const stepBadges = order.stepsRequired.map(st => {
      const done = order.stepStates[st];
      return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${
        done ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-300'
      }">${done ? '✓' : STEP_LABELS[st].icon} ${STEP_LABELS[st].name.split(' ')[0]}</span>`;
    }).join(' ');

    return `
      <div data-ticket-id="${order.id}" class="ticket-item cursor-pointer rounded-xl p-2.5 bg-[#0b1915]/90 border border-emerald-800/70 transition ${
        isSelected ? 'ticket-selected' : ''
      } ${isUrgent ? 'urgent-pulse' : ''}">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <div class="flex items-center gap-2">
            <span class="text-lg">${order.itemIcon}</span>
            <div>
              <div class="text-xs font-extrabold text-white flex items-center gap-1.5">
                <span>${order.itemName}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded border ${chMeta.cls}">${chMeta.label}</span>
              </div>
              <div class="text-[11px] text-emerald-300/90 font-semibold">${mood} ${order.customerName} • <span class="text-amber-300 font-bold">حجم ${order.sizeLabel || order.size} (${order.egpPrice || 145} ج.م)</span> • ${order.milkChoice}</div>
            </div>
          </div>
          <div class="text-left shrink-0">
            <div class="text-xs font-extrabold font-num text-emerald-400">$${order.price.toFixed(2)}</div>
            <div class="text-[11px] font-bold font-num ${isUrgent ? 'text-rose-400' : 'text-amber-300'}">${Math.ceil(order.timeLeft)}ث</div>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
          <div class="flex flex-wrap gap-1">${stepBadges}</div>
          <span class="text-[10px] font-bold text-[#CBA258]">إنجاز: ${order.progress}%</span>
        </div>
        <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full ${barColor} transition-all duration-200" style="width: ${Math.round(ratio * 100)}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderStaffTab() {
  const hireCost = 180 + Math.max(0, state.staff.length - 2) * 95;
  document.getElementById('hireCostText').textContent = `$${hireCost}`;
  const autoBtn = document.getElementById('btnAutoBreakToggle');
  autoBtn.textContent = state.autoBreak ? '🛋️ راحة تلقائية: مفعل' : '🛋️ راحة تلقائية: متوقف';
  autoBtn.className = state.autoBreak
    ? 'px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold bg-emerald-800 text-white border border-emerald-400 transition'
    : 'px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold bg-slate-800 text-slate-300 border border-slate-600 transition';

  // Render Applicants Pool
  const appContainer = document.getElementById('applicantsContainer');
  if (state.applicants.length === 0) {
    // Refill applicants pool
    state.applicants = [
      Object.assign({ id: ++state.nextId }, APPLICANT_TEMPLATES[Math.floor(Math.random() * APPLICANT_TEMPLATES.length)]),
      Object.assign({ id: ++state.nextId }, APPLICANT_TEMPLATES[Math.floor(Math.random() * APPLICANT_TEMPLATES.length)])
    ];
  }
  appContainer.innerHTML = state.applicants.map(app => `
    <div class="bg-[#132922] border border-emerald-700/50 rounded-xl p-2 flex items-center justify-between gap-2">
      <div>
        <div class="text-xs font-extrabold text-white">${app.name}</div>
        <div class="text-[10px] text-emerald-300">${app.specialty} • سرعة ${Math.round(app.speedMult * 100)}%</div>
      </div>
      <button data-hire-applicant="${app.id}" class="px-2.5 py-1 rounded-lg text-[11px] font-extrabold sb-btn-gold shrink-0">
        تعيين ($${app.cost})
      </button>
    </div>
  `).join('');

  // Render Sick Leave Requests
  const sickContainer = document.getElementById('sickRequestsContainer');
  if (sickContainer) {
    if (!state.sickRequests || state.sickRequests.length === 0) {
      sickContainer.innerHTML = `<div class="text-[11px] text-emerald-300">✅ لا توجد طلبات إجازات مرضية معلقة حالياً.</div>`;
    } else {
      sickContainer.innerHTML = state.sickRequests.map(req => `
        <div class="p-2.5 rounded-xl bg-slate-900/90 border ${req.resolved ? 'border-emerald-700/50 opacity-80' : 'border-rose-500'} flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="text-xs font-extrabold text-white">🏥 ${req.staffName} — <span class="text-amber-300">${req.branchName}</span></div>
            <div class="text-[11px] text-rose-200/90">${req.reason}</div>
          </div>
          <div>
            ${req.resolved
              ? `<span class="text-[11px] font-bold text-emerald-400">${req.statusText}</span>`
              : `<button data-approve-sick="${req.id}" class="px-3 py-1.5 rounded-xl text-xs font-extrabold sb-btn-gold">✅ موافقة وتكليف بديل</button>`
            }
          </div>
        </div>
      `).join('');
    }
  }

  // Render Weekly Shift Schedules Table
  const shiftContainer = document.getElementById('shiftScheduleContainer');
  if (shiftContainer) {
    const shiftOptions = [
      { id: 'morning', label: '🌅 وردية الصباح (07:00 ص - 03:00 م)' },
      { id: 'peak', label: '☀️ وردية الذروة والظهيرة (11:00 ص - 07:00 م)' },
      { id: 'evening', label: '🌙 وردية المساء والإغلاق (03:00 م - 11:00 م)' },
      { id: 'off', label: '🏖️ راحة أسبوعية مجدولة (Day Off)' },
      { id: 'sick', label: '🏥 إجازة مرضية معتمدة (Sick Leave)' }
    ];
    shiftContainer.innerHTML = state.staff.map(b => {
      const curShift = b.shift || 'morning';
      return `
        <div class="p-2 rounded-lg bg-slate-900/90 border border-purple-800/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div class="font-extrabold text-white flex items-center gap-1.5">
            <span>👨\u200D🍳 ${b.name}</span>
            <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-amber-300">${b.storeName || 'فرع طلعت حرب'}</span>
          </div>
          <select data-staff-shift="${b.id}" class="bg-[#0b1915] border border-purple-500/60 text-purple-200 text-[11px] font-bold rounded-lg px-2.5 py-1">
            ${shiftOptions.map(so => `<option value="${so.id}" ${curShift === so.id ? 'selected' : ''}>${so.label}</option>`).join('')}
          </select>
        </div>
      `;
    }).join('');
  }

  // Render Staff List with Station Select, Break Button, and Branch Transfer Select
  const unlockedBranches = state.branches.filter(b => b.unlocked);
  const container = document.getElementById('staffListContainer');

  container.innerHTML = state.staff.map(b => {
    const trainCost = b.level * 120;
    const bBranch = state.branches.find(br => br.id === (b.branchId || 'downtown')) || state.branches[0];
    const energyPct = Math.round(b.energy ?? 90);
    const energyColor = energyPct > 55 ? 'bg-emerald-400' : energyPct > 30 ? 'bg-amber-400' : 'bg-rose-500';

    const roleOptions = STATION_ROLES.map(r =>
      `<option value="${r.id}" ${b.role === r.id ? 'selected' : ''}>${r.label}</option>`
    ).join('');

    const branchOptions = unlockedBranches.map(br =>
      `<option value="${br.id}" ${(b.branchId || 'downtown') === br.id ? 'selected' : ''}>📍 ${br.name}</option>`
    ).join('');

    return `
      <div class="bg-[#0b1915] border ${energyPct < 30 ? 'border-rose-500' : 'border-emerald-800/70'} rounded-xl p-3 space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-full ${b.onBreak ? 'bg-purple-900 border-purple-400' : 'bg-[#00704A] border-[#CBA258]'} border flex items-center justify-center text-lg">
              ${b.onBreak ? '🛋️' : '👨\u200D🍳'}
            </div>
            <div>
              <div class="text-xs font-extrabold text-white flex items-center gap-1.5">
                <span>${b.name}</span>
                <span class="text-[#CBA258] font-num">(مستوى ${b.level})</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60">${bBranch.name.split('(')[0]}</span>
              </div>
              <div class="text-[11px] text-emerald-300/80">السرعة: <strong class="font-num">${Math.round(b.speedMult * 100)}%</strong> • الحالة: <strong class="text-amber-200">${b.busyText}</strong></div>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button data-staff-break="${b.id}" ${b.onBreak ? 'disabled' : ''} class="px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold ${
              b.onBreak ? 'bg-purple-950 text-purple-300 opacity-70' : 'bg-amber-600 hover:bg-amber-500 text-slate-950'
            } transition">
              ${b.onBreak ? `🛋️ يستريح (${b.breakTimeLeft}ث)` : '☕ إرسال لراحة'}
            </button>
            <button data-staff-train="${b.id}" class="px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold sb-btn-primary text-white">
              ⬆️ تدريب ($${trainCost})
            </button>
          </div>
        </div>

        <!-- Energy Bar -->
        <div>
          <div class="flex justify-between text-[10px] font-bold mb-0.5">
            <span>⚡ طاقة وتركيز الباريستا:</span>
            <span class="font-num ${energyPct < 30 ? 'text-rose-400' : 'text-emerald-300'}">${energyPct}% ${energyPct < 30 ? '(مرهق جداً - يحتاج راحة!)' : ''}</span>
          </div>
          <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full ${energyColor} transition-all duration-300" style="width:${energyPct}%"></div>
          </div>
        </div>

        <!-- Station Role & Inter-Branch Transfer Controls -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <div>
            <label class="block text-[10px] text-emerald-300/80 mb-0.5">تخصيص المحطة داخل الفرع:</label>
            <select data-staff-role="${b.id}" class="w-full bg-slate-900 border border-emerald-600/60 text-white text-[11px] font-bold rounded-lg px-2 py-1">
              ${roleOptions}
            </select>
          </div>
          <div>
            <label class="block text-[10px] text-amber-300/90 mb-0.5">🔄 نقل الموظف إلى فرع آخر حسب التشغيل:</label>
            <select data-staff-transfer="${b.id}" class="w-full bg-slate-900 border border-[#CBA258]/60 text-amber-200 text-[11px] font-bold rounded-lg px-2 py-1">
              ${branchOptions}
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderInboxTab() {
  const container = document.getElementById('inboxListContainer');
  if (!container) return;

  container.innerHTML = state.emails.map(mail => {
    return `
      <div class="bg-[#0b1915] border ${mail.resolved ? 'border-emerald-900/50 opacity-80' : 'border-[#CBA258] shadow-md'} rounded-xl p-3 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-950 text-[#CBA258] border border-[#CBA258]/40">${mail.roleBadge}</span>
              <span class="text-xs font-extrabold text-white">${mail.sender}</span>
            </div>
            <div class="text-xs font-bold text-amber-300 mt-1">📩 ${mail.subject}</div>
          </div>
          <span class="text-[10px] font-num text-emerald-300/70 shrink-0">${mail.timeStr}</span>
        </div>
        <p class="text-[11px] text-slate-200 leading-relaxed bg-black/25 p-2.5 rounded-lg border border-emerald-900/40">${mail.body}</p>
        <div class="flex flex-wrap items-center gap-2 pt-1">
          ${
            mail.resolved
              ? `<span class="text-[11px] font-bold text-emerald-400">✅ تم اتخاذ القرار والرد على الإيميل</span>`
              : (mail.choices || []).map((ch, idx) => `
                  <button data-email-id="${mail.id}" data-choice-idx="${idx}" class="px-3 py-1.5 rounded-xl text-[11px] font-extrabold ${
                    idx === 0 ? 'sb-btn-gold' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                  } transition">
                    ${ch.label}
                  </button>
                `).join('')
          }
        </div>
      </div>
    `;
  }).join('');
}

function renderOpsTab() {
  const tScore = Math.round(state.trainingScore || 95);
  document.getElementById('opsPanelDmVal').textContent = `${tScore}%`;
  document.getElementById('opsPanelDmBar').style.width = `${tScore}%`;
  document.getElementById('opsPanelQasaVal').textContent = `${Math.round(state.opsScore)}%`;
  document.getElementById('opsPanelQasaBar').style.width = `${Math.round(state.opsScore)}%`;

  const dmsContainer = document.getElementById('regionalDmsContainer');
  if (dmsContainer) {
    dmsContainer.innerHTML = state.branches.map(b => {
      const sat = Math.round(b.dmSatisfaction !== undefined ? b.dmSatisfaction : state.dmSatisfaction);
      const openCnt = b.unlocked ? (b.openBranches || 1) : 0;
      const maxCnt = b.maxBranches || 15;
      const staffCnt = getBranchStaff(b.id).length;
      return `
        <div class="p-2.5 rounded-xl bg-slate-900/90 border ${b.id === state.activeBranchId ? 'border-[#CBA258]' : 'border-emerald-900/60'} flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="text-xs font-extrabold text-white flex items-center gap-1.5">
              <span>👔 ${b.dmName}</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50">${b.dmTitle}</span>
            </div>
            <div class="text-[10px] text-emerald-300 mt-0.5">
              الفروع المفتوحة بالمنطقة: <strong class="font-num text-amber-300">${openCnt} / ${maxCnt} فرعاً</strong> • الباريستات المعينون: <strong class="font-num">${staffCnt}/${b.requiredStaff}</strong>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="text-left">
              <div class="text-[10px] text-slate-400">نسبة الرضا</div>
              <div class="text-xs font-extrabold font-num ${sat >= 85 ? 'text-emerald-400' : sat >= 65 ? 'text-amber-300' : 'text-rose-400'}">${sat}%</div>
            </div>
            <button data-visit-dm="${b.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-indigo-800 hover:bg-indigo-700 text-white border border-indigo-500">
              📋 جولة مع ${b.dmName.split(' ')[1]}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  const activeStaff = getActiveBranchStaff();
  const exhausted = activeStaff.filter(s => s.energy < 30 && !s.onBreak).length;
  const checks = [
    {
      label: 'نظافة الطاولات والبار (≥ 80%)',
      ok: state.cleanliness >= 80,
      val: `${Math.round(state.cleanliness)}%`
    },
    {
      label: 'معايرة وصيانة الماكينات (≥ 80%)',
      ok: state.machineHealth >= 80,
      val: `${Math.round(state.machineHealth)}%`
    },
    {
      label: 'عدم إرهاق الباريستات (إعطاء راحات)',
      ok: exhausted === 0 && activeStaff.length > 0,
      val: exhausted === 0 ? 'ممتاز (0 مرهق)' : `${exhausted} مرهق!`
    },
    {
      label: 'سرعة شباك الدرايف ثرو (≤ 45 ثانية)',
      ok: state.stats.avgDtSeconds <= 45,
      val: `${state.stats.avgDtSeconds} ثانية`
    }
  ];

  document.getElementById('auditChecklistContainer').innerHTML = checks.map(c => `
    <div class="p-2 rounded-lg bg-slate-900/90 border ${c.ok ? 'border-emerald-600/50 text-emerald-200' : 'border-rose-500/60 text-rose-200'} flex items-center justify-between">
      <span>${c.ok ? '✅' : '⚠️'} ${c.label}</span>
      <strong class="font-num">${c.val}</strong>
    </div>
  `).join('');

  document.getElementById('auditHistoryContainer').innerHTML = state.auditHistory.map(h => `
    <div class="p-2 rounded-lg bg-slate-900/70 border border-emerald-900/60 flex items-center justify-between">
      <span><strong>اليوم ${h.day}:</strong> ${h.title} — ${h.result}</span>
      <span class="font-num font-extrabold px-2 py-0.5 rounded ${h.score >= 75 ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-200'}">${h.score}%</span>
    </div>
  `).join('');

  // Render Customer Complaints List
  const compContainer = document.getElementById('complaintsListContainer');
  if (compContainer) {
    const cFilter = state.complaintFilter || 'all';
    const list = (state.complaints || []).filter(c => cFilter === 'all' || c.severity === cFilter);
    if (list.length === 0) {
      compContainer.innerHTML = `<div class="p-3 rounded-xl bg-slate-900/70 text-xs text-emerald-300 text-center">🎉 لا توجد شكاوى في هذا التصنيف حالياً!</div>`;
    } else {
      compContainer.innerHTML = list.map(c => {
        const badgeCls = c.severity === 'high'
          ? 'bg-rose-900 text-rose-200 border-rose-400'
          : c.severity === 'medium'
            ? 'bg-amber-900 text-amber-200 border-amber-400'
            : 'bg-emerald-900 text-emerald-200 border-emerald-400';
        return `
          <div class="p-3 rounded-xl bg-slate-900/95 border ${c.resolved ? 'border-emerald-800/50 opacity-75' : 'border-rose-500/80'} space-y-1.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="text-[10px] font-extrabold px-2 py-0.5 rounded border ${badgeCls}">${c.severityLabel}</span>
                <span class="text-xs font-extrabold text-white">العميل: ${c.customerName}</span>
                <span class="text-[10px] text-amber-300">(${c.branchName})</span>
                ${c.inStore && !c.resolved ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-rose-600 text-white font-bold animate-pulse">🧍 متواجد بالفرع الآن!</span>` : ''}
              </div>
              ${c.resolved
                ? `<span class="text-[11px] font-bold text-emerald-400">✅ تم الاعتذار للعميل وإغلاق الشكوى</span>`
                : `<button data-apologize-id="${c.id}" class="px-3 py-1.5 rounded-xl text-xs font-extrabold sb-btn-gold shadow">
                    🤝 اعتذر للعميل بالفرع وعوّضه (${c.compCost > 0 ? '-$' + c.compCost : 'مجاناً'})
                  </button>`
              }
            </div>
            <div class="text-[11px] text-amber-200 font-bold">🍹 المشروب: ${c.drinkName}</div>
            <div class="text-[11px] text-slate-200 bg-black/30 p-2 rounded-lg">💬 تفاصيل الشكوى: "${c.issue}"</div>
          </div>
        `;
      }).join('');
    }
  }

  // Render Equipment Maintenance List
  const eqContainer = document.getElementById('equipmentMaintenanceContainer');
  if (eqContainer && state.equipmentList) {
    eqContainer.innerHTML = state.equipmentList.map(eq => {
      const needsFix = eq.health < 85 || eq.ticketOpen;
      return `
        <div class="p-2.5 rounded-xl bg-slate-900/90 border ${needsFix ? 'border-amber-400' : 'border-indigo-800/60'} flex flex-col justify-between gap-2">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-xs font-extrabold text-white">${eq.icon} ${eq.name}</div>
              <div class="text-[10px] ${needsFix ? 'text-amber-300 font-bold' : 'text-emerald-300'}">${eq.status}</div>
            </div>
            <span class="font-num text-xs font-extrabold ${eq.health >= 85 ? 'text-emerald-400' : 'text-rose-400'}">${eq.health}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full ${eq.health >= 85 ? 'bg-emerald-400' : 'bg-amber-400'}" style="width:${eq.health}%"></div>
          </div>
          <div class="flex justify-end">
            <button data-repair-eq="${eq.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${needsFix ? 'sb-btn-gold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">
              🛠️ إرسال طلب صيانة ($${eq.cost})
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Weekly Supply Orders
  const wkContainer = document.getElementById('weeklyOrdersContainer');
  if (wkContainer && state.weeklyOrders) {
    wkContainer.innerHTML = state.weeklyOrders.map(wk => `
      <div class="p-2.5 rounded-xl bg-slate-900/90 border ${wk.orderedThisWeek ? 'border-emerald-600/60' : 'border-amber-600/50'} flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="text-xs font-extrabold text-white">📦 ${wk.name}</div>
          <div class="text-[10px] text-amber-300">الكمية الأسبوعية القياسية: <strong>${wk.qty}</strong> • التكلفة: <strong>${wk.egpCost} ج.م ($${wk.cost})</strong></div>
        </div>
        <button data-order-weekly="${wk.id}" class="px-3 py-1.5 rounded-xl text-[11px] font-extrabold ${wk.orderedThisWeek ? 'bg-emerald-800 text-emerald-200' : 'sb-btn-gold'}">
          ${wk.orderedThisWeek ? '🔄 طلب شحنة إضافية ($' + wk.cost + ')' : '🚚 اعتماد الطلبية ($' + wk.cost + ')'}
        </button>
      </div>
    `).join('');
  }
}

function renderBranchesTab() {
  const container = document.getElementById('branchesListContainer');
  const totalOpen = getTotalOpenBranchesCount();

  const summaryHtml = `
    <div class="bg-gradient-to-r from-emerald-950 via-[#122b23] to-amber-950/60 border border-[#CBA258]/60 rounded-xl p-3 mb-2 flex flex-wrap items-center justify-between gap-2">
      <div>
        <div class="text-xs font-extrabold text-[#CBA258]">🇪🇬 شبكة فروع ستاربكس مصر (5 مناطق إقليمية - 79 فرعاً)</div>
        <div class="text-[11px] text-emerald-200">مدير الأوبريشن: <strong>أ. عمرو عاطف</strong> • مدير التدريب: <strong>أ. محمود أحمد</strong></div>
      </div>
      <div class="px-3 py-1 rounded-xl bg-black/40 border border-[#CBA258]/50 text-xs font-extrabold font-num text-amber-300">
        إجمالي الفروع المفتوحة: ${totalOpen} / 79 فرعاً
      </div>
    </div>
  `;

  container.innerHTML = summaryHtml + state.branches.map(b => {
    const isCurrent = b.id === state.activeBranchId;
    const openCnt = b.unlocked ? (b.openBranches || 1) : 0;
    const maxCnt = b.maxBranches || 15;
    const upgCost = Math.round(260 * Math.pow(1.35, Math.max(0, openCnt - 1)));
    const branchStaff = getBranchStaff(b.id);
    const reqStaff = b.requiredStaff || 2;
    const eff = getBranchEfficiencyRatio(b);
    const currentPassive = (b.passiveRate * (1 + Math.max(0, openCnt - 1) * 0.35) * b.level * eff).toFixed(1);
    const q = (state.branchSearchQuery || '').trim().toLowerCase();
    const individualStoresButtons = Array.from({ length: openCnt }, (_, idx) => {
      const sName = (b.branchNames && b.branchNames[idx]) ? b.branchNames[idx] : `${b.name.split('(')[0].trim()} #${idx + 1}`;
      if (q && !sName.toLowerCase().includes(q) && !b.name.toLowerCase().includes(q) && !b.dmName.toLowerCase().includes(q)) {
        return '';
      }
      const isSelectedStore = isCurrent && state.activeSubStoreName === sName;
      const isDtStore = /dt|drive/i.test(sName);
      return `<button data-control-substore="${b.id}__${sName}" class="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold transition border ${
        isSelectedStore
          ? 'bg-[#CBA258] text-slate-950 border-white shadow-lg scale-105'
          : 'bg-emerald-950/95 hover:bg-emerald-800 text-emerald-100 border-emerald-600/60'
      }">${isDtStore ? '🚗' : '🏪'} ${sName} ${isSelectedStore ? '✅ (نشط الآن)' : ''}</button>`;
    }).filter(Boolean).join(' ');

    if (!b.unlocked) {
      return `
        <div class="bg-[#0b1915]/75 border border-slate-700 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl opacity-70">${b.icon}</div>
            <div>
              <div class="text-xs sm:text-sm font-extrabold text-slate-200">${b.name}</div>
              <div class="text-[11px] text-indigo-300 font-bold">👔 مدير المنطقة: ${b.dmName} (إجمالي ${maxCnt} فرعاً بالمنطقة)</div>
              <div class="text-[11px] text-slate-400">${b.desc}</div>
              <div class="text-[11px] text-amber-300/90 mt-0.5">الطاقم المطلوب: <strong>${reqStaff} باريستا</strong> • الدخل الأساسي: <strong>+$${b.passiveRate.toFixed(1)}/ث</strong></div>
            </div>
          </div>
          <button data-branch-unlock="${b.id}" class="px-3.5 py-2 rounded-xl text-xs font-extrabold sb-btn-gold">
            🏢 تدشين المنطقة ($${b.unlockCost})
          </button>
        </div>
      `;
    }

    const staffEnough = branchStaff.length >= reqStaff;
    const canOpenMore = openCnt < maxCnt;
    return `
      <div class="bg-[#0b1915] border ${isCurrent ? 'border-[#CBA258]' : 'border-emerald-800/70'} rounded-xl p-3.5 space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-emerald-900/70 border border-[#CBA258]/50 flex items-center justify-center text-2xl">${b.icon}</div>
            <div>
              <div class="text-xs sm:text-sm font-extrabold text-white flex flex-wrap items-center gap-1.5">
                <span>${b.name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-[#CBA258] border border-[#CBA258]/40 font-num">${openCnt} / ${maxCnt} فرعاً</span>
              </div>
              <div class="text-[11px] text-indigo-300 font-bold">👔 ${b.dmName} (${b.dmTitle}) — الرضا: ${Math.round(b.dmSatisfaction || 92)}%</div>
              <div class="text-[10px] text-amber-200 font-bold mt-1">🎛️ اضغط على أي فرع مفتوح بالأسفل للتحكم المباشر فيه:</div><div class="flex flex-wrap gap-1.5 mt-1">${individualStoresButtons}</div>
              <div class="flex flex-wrap items-center gap-2 text-[11px] mt-1">
                <span class="text-amber-300">دخل المنطقة: <strong class="font-num">+$${currentPassive}/ث</strong></span>
                <span>•</span>
                <span class="${staffEnough ? 'text-emerald-400' : 'text-rose-400 font-bold'}">
                  👨\u200D🍳 الباريستات بالمنطقة: ${branchStaff.length} / ${reqStaff} ${staffEnough ? '(تغطية ممتازة)' : '(عجز موظفين - انقل باريستا!)'}
                </span>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${
              canOpenMore
                ? `<button data-branch-upgrade="${b.id}" class="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold sb-btn-primary text-white">
                    ➕ فتح فرع جديد بالمنطقة ($${upgCost})
                  </button>`
                : `<span class="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-600/50">✅ مكتملة (${maxCnt}/${maxCnt})</span>`
            }
            ${
              isCurrent
                ? `<span class="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[#CBA258]/20 text-[#CBA258] border border-[#CBA258]">📍 المنطقة النشطة</span>`
                : `<button data-branch-switch="${b.id}" class="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-slate-800 hover:bg-slate-700 text-white border border-slate-600">🚀 إدارة هذه المنطقة</button>`
            }
          </div>
        </div>
        <!-- Operational Load Bar -->
        <div class="bg-slate-900/80 rounded-lg p-2 flex items-center justify-between gap-3 text-[11px]">
          <span class="text-slate-300">📊 ضغط التشغيل في فروع ${b.dmName.split(' ')[1]}: <strong class="font-num text-amber-300">${b.loadPct}%</strong></span>
          <span class="text-emerald-300">كفاءة التشغيل: <strong class="font-num">${Math.round(eff * 100)}%</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

function getItemSizePrices(item) {
  const ratio = item.price / (item.basePrice || item.price || 1);
  const shortEgp = item.egpShort ? Math.round(item.egpShort * ratio) : null;
  const tallEgp = Math.round((item.egpTall || 135) * ratio);
  const grandeEgp = Math.round((item.egpGrande || (item.egpTall + 15) || 150) * ratio);
  const ventiEgp = Math.round((item.egpVenti || (item.egpTall + 25) || 165) * ratio);
  const tallUsd = +(tallEgp / 30).toFixed(2);
  const grandeUsd = +(grandeEgp / 30).toFixed(2);
  const ventiUsd = +(ventiEgp / 30).toFixed(2);
  return { shortEgp, tallEgp, grandeEgp, ventiEgp, tallUsd, grandeUsd, ventiUsd };
}

function renderMenuTab() {
  const container = document.getElementById('menuListContainer');
  if (!container) return;
  const activeCat = state.activeMenuCat || 'all';

  // Highlight active category button
  document.querySelectorAll('.menu-cat-btn').forEach(btn => {
    const cat = btn.getAttribute('data-menu-cat');
    if (cat === activeCat) {
      btn.className = 'menu-cat-btn px-3 py-1.5 rounded-xl text-xs font-extrabold bg-[#00704A] text-white border border-[#CBA258] shadow';
    } else {
      btn.className = 'menu-cat-btn px-3 py-1.5 rounded-xl text-xs font-extrabold bg-slate-900 text-emerald-200 border border-emerald-700/50 hover:bg-emerald-950';
    }
  });

  const filtered = state.menu.filter(item => activeCat === 'all' || item.category === activeCat);

  container.innerHTML = filtered.map(item => {
    const stepsText = item.steps.map(s => STEP_LABELS[s].icon + ' ' + STEP_LABELS[s].name).join(' + ');
    const sp = getItemSizePrices(item);
    const isBakery = item.category === 'فرن التسخين';

    const sizesGridHtml = isBakery
      ? `<div class="grid grid-cols-2 gap-1.5 mt-2 text-[11px]">
          <div class="bg-slate-900/90 border border-amber-700/40 rounded-lg px-2.5 py-1 flex items-center justify-between">
            <span class="text-amber-200 font-bold">🥐 قطعة ساخنة (Standard):</span>
            <strong class="font-num text-emerald-400">${sp.tallEgp} ج.م ($${sp.tallUsd})</strong>
          </div>
          <div class="bg-slate-900/90 border border-amber-700/40 rounded-lg px-2.5 py-1 flex items-center justify-between">
            <span class="text-amber-200 font-bold">🥪 وجبة دبل (Double Warmed):</span>
            <strong class="font-num text-emerald-400">${sp.grandeEgp} ج.م ($${sp.grandeUsd})</strong>
          </div>
        </div>`
      : `<div class="grid ${sp.shortEgp ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-1.5 mt-2 text-[11px]">
          ${sp.shortEgp ? `
          <div class="bg-slate-900/90 border border-amber-700/40 rounded-lg px-2 py-1 text-center">
            <div class="text-[10px] text-amber-300 font-bold">☕ صغير (Short)</div>
            <div class="font-num font-extrabold text-white">${sp.shortEgp}.00 ج.م</div>
          </div>` : ''}
          <div class="bg-slate-900/90 border border-emerald-700/40 rounded-lg px-2 py-1 text-center">
            <div class="text-[10px] text-emerald-300 font-bold">🥤 عادي (Tall)</div>
            <div class="font-num font-extrabold text-white">${sp.tallEgp}.00 ج.م <span class="text-emerald-400">($${sp.tallUsd})</span></div>
          </div>
          <div class="bg-slate-900/90 border border-[#CBA258]/50 rounded-lg px-2 py-1 text-center">
            <div class="text-[10px] text-[#CBA258] font-bold">🥤 وسط (Grande)</div>
            <div class="font-num font-extrabold text-white">${sp.grandeEgp}.00 ج.م <span class="text-emerald-400">($${sp.grandeUsd})</span></div>
          </div>
          <div class="bg-slate-900/90 border border-sky-600/40 rounded-lg px-2 py-1 text-center">
            <div class="text-[10px] text-sky-300 font-bold">🥤 كبير (Venti)</div>
            <div class="font-num font-extrabold text-white">${sp.ventiEgp}.00 ج.م <span class="text-emerald-400">($${sp.ventiUsd})</span></div>
          </div>
        </div>`;

    if (!item.unlocked) {
      return `
        <div class="bg-[#0b1915]/80 border border-slate-700 rounded-xl p-3.5 space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl opacity-75">${item.icon}</div>
              <div>
                <div class="text-sm font-extrabold text-slate-200">${item.name} <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300">${item.category}</span></div>
                <div class="text-[11px] text-slate-400">خطوات التحضير: ${stepsText}</div>
              </div>
            </div>
            <button data-menu-unlock="${item.id}" class="px-3.5 py-2 rounded-xl text-xs font-extrabold sb-btn-gold shrink-0">
              🔓 فتح الصنف ($${item.unlockCost})
            </button>
          </div>
          ${sizesGridHtml}
        </div>
      `;
    }

    return `
      <div class="bg-[#0b1915] border border-emerald-700/70 rounded-xl p-3.5 space-y-1.5 shadow-md">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-emerald-900/70 border border-[#CBA258]/50 flex items-center justify-center text-2xl">${item.icon}</div>
            <div>
              <div class="text-sm font-extrabold text-white flex flex-wrap items-center gap-1.5">
                <span>${item.name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-[#CBA258] border border-[#CBA258]/40">${item.category}</span>
              </div>
              <div class="text-[11px] text-emerald-300/90">${stepsText}</div>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <button data-price-down="${item.id}" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-sm border border-slate-600" title="تخفيض سعر كل الأحجام">-</button>
            <span class="px-2 font-num font-extrabold text-xs text-emerald-400" title="السعر الأساسي لحجم Tall">$${item.price.toFixed(2)}</span>
            <button data-price-up="${item.id}" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-sm border border-slate-600" title="رفع سعر كل الأحجام">+</button>
            <button data-menu-toggle="${item.id}" class="px-3 py-1.5 rounded-lg text-xs font-extrabold ${
              item.active ? 'bg-emerald-700 text-white' : 'bg-rose-900/80 text-rose-200'
            }">
              ${item.active ? '✅ متاح' : '⏸️ متوقف'}
            </button>
          </div>
        </div>
        ${sizesGridHtml}
      </div>
    `;
  }).join('');
}

function renderUpgradesTab() {
  const container = document.getElementById('upgradesListContainer');
  container.innerHTML = state.upgrades.map(u => {
    const isMax = u.level >= u.maxLevel;
    const cost = Math.round(u.baseCost * Math.pow(u.costMult, u.level));
    return `
      <div class="bg-[#0b1915] border border-emerald-800/70 rounded-xl p-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-11 h-11 rounded-xl bg-emerald-900/60 border border-[#CBA258]/40 flex items-center justify-center text-2xl shrink-0">${u.icon}</div>
          <div>
            <div class="text-xs font-extrabold text-white">${u.name} <span class="text-[#CBA258] font-num">(${u.level}/${u.maxLevel})</span></div>
            <div class="text-[11px] text-emerald-200/80">${u.desc}</div>
          </div>
        </div>
        ${
          isMax
            ? `<span class="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-900/60 text-emerald-300 border border-emerald-600/40 shrink-0">🌟 مكتمل</span>`
            : `<button data-upgrade-buy="${u.id}" class="px-3 py-1.5 rounded-xl text-xs font-extrabold sb-btn-gold shrink-0">ترقية ($${cost})</button>`
        }
      </div>
    `;
  }).join('');
}

function getMissionCurrentValue(m) {
  if (m.type === 'served') return state.stats.served;
  if (m.type === 'dt_served') return state.stats.dt_served;
  if (m.type === 'clean_actions') return state.stats.clean_actions;
  if (m.type === 'breaks_given') return state.stats.breaks_given;
  if (m.type === 'emails_resolved') return state.stats.emails_resolved;
  if (m.type === 'audits_passed') return state.stats.audits_passed;
  if (m.type === 'staff_count') return state.staff.length;
  if (m.type === 'menu_unlocked') return state.menu.filter(i => i.unlocked).length;
  if (m.type === 'upgrades_bought') return state.stats.upgrades_bought;
  if (m.type === 'branches_unlocked') return state.branches.filter(b => b.unlocked).length;
  return 0;
}

function checkMissionAlert() {
  const hasClaimable = state.missions.some(m => !m.claimed && getMissionCurrentValue(m) >= m.target);
  const dot = document.getElementById('missionAlertDot');
  if (dot) {
    dot.classList.toggle('hidden', !hasClaimable);
  }
}

function renderMissionsTab() {
  const container = document.getElementById('missionsListContainer');
  if (!container) return;

  container.innerHTML = state.missions.map(m => {
    const cur = Math.min(m.target, getMissionCurrentValue(m));
    const pct = Math.round((cur / m.target) * 100);
    const ready = cur >= m.target && !m.claimed;

    return `
      <div class="bg-[#0b1915] border ${ready ? 'border-[#CBA258]' : 'border-emerald-800/70'} rounded-xl p-3">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <div>
            <div class="text-xs font-extrabold text-white">${m.title}</div>
            <div class="text-[11px] text-emerald-200/80">${m.desc}</div>
          </div>
          <div class="shrink-0">
            ${
              m.claimed
                ? `<span class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-700">✅ تم الاستلام</span>`
                : ready
                  ? `<button data-mission-claim="${m.id}" class="px-3 py-1.5 rounded-xl text-xs font-extrabold sb-btn-gold animate-bounce">🎁 استلام +$${m.reward}</button>`
                  : `<span class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 text-amber-300 font-num">المكافأة: $${m.reward}</span>`
            }
          </div>
        </div>
        <div class="flex items-center justify-between text-[10px] text-emerald-300 mb-1 font-num">
          <span>التقدم: ${cur} / ${m.target}</span>
          <span>${pct}%</span>
        </div>
        <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-emerald-500 to-[#CBA258]" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
  checkMissionAlert();
}

// =========================================================================
// TRUE 3D ARCHITECTURAL STORE, BAR, MACHINES, TABLES & CHAIRS ENGINE
// =========================================================================
const canvas = document.getElementById('storeCanvas');
const ctx = canvas.getContext('2d');
const LOGICAL_W = 960;
const LOGICAL_H = 560;

function resizeCanvas() {
  const wrapper = document.getElementById('canvasWrapper');
  if (!wrapper) return;
  const rect = wrapper.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = (rect.width || LOGICAL_W) * dpr;
  canvas.height = (rect.height || LOGICAL_H) * dpr;
}

function drawRoundedRect(c, x, y, w, h, r, fill, stroke, lineWidth) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lineWidth || 1.5;
    c.stroke();
  }
}

// Draw a 3D Box with Top Face, Front Extruded Face, Right Side Shadow Face, and Floor Shadow
function draw3DBox(c, x, y, w, h, depth, topColor, frontColor, sideColor, borderColor) {
  // Floor drop shadow
  c.fillStyle = 'rgba(0, 0, 0, 0.38)';
  drawRoundedRect(c, x + 5, y + depth + 6, w + 4, h, 6, 'rgba(0,0,0,0.38)', null, 0);

  // Front Vertical Extruded Face (3D Thickness)
  c.fillStyle = frontColor;
  c.beginPath();
  c.moveTo(x, y + h);
  c.lineTo(x + w, y + h);
  c.lineTo(x + w, y + h + depth);
  c.lineTo(x, y + h + depth);
  c.closePath();
  c.fill();
  if (borderColor) {
    c.strokeStyle = borderColor;
    c.lineWidth = 1.2;
    c.stroke();
  }

  // Right bevel/side face for 3D isometric feel
  if (sideColor) {
    c.fillStyle = sideColor;
    c.beginPath();
    c.moveTo(x + w, y);
    c.lineTo(x + w + 7, y + 6);
    c.lineTo(x + w + 7, y + h + depth);
    c.lineTo(x + w, y + h + depth);
    c.closePath();
    c.fill();
  }

  // Top Surface Face
  drawRoundedRect(c, x, y, w, h, 5, topColor, borderColor || 'rgba(255,255,255,0.2)', 1.5);
}

// Draw a Realistic 3D Cafe Table with 4 3D Chairs (Backrest, Cushion, Legs)
function draw3DTableAndChairs(c, t) {
  const tx = t.x;
  const ty = t.y;
  const isRect = t.shape === 'rect';

  // 4 Chairs around the table: Left, Right, Top, Bottom
  const chairPositions = [
    { cx: tx - 48, cy: ty - 4, dir: 'left' },
    { cx: tx + 48, cy: ty - 4, dir: 'right' },
    { cx: tx, cy: ty - 38, dir: 'top' },
    { cx: tx, cy: ty + 34, dir: 'bottom' }
  ];

  chairPositions.forEach(ch => {
    // Chair shadow
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(ch.cx, ch.cy + 11, 13, 6, 0, 0, Math.PI * 2);
    c.fill();

    // Chair wooden legs
    c.strokeStyle = '#451a03';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(ch.cx - 8, ch.cy + 3);
    c.lineTo(ch.cx - 10, ch.cy + 12);
    c.moveTo(ch.cx + 8, ch.cy + 3);
    c.lineTo(ch.cx + 10, ch.cy + 12);
    c.stroke();

    // 3D Leather/Fabric Seat Cushion
    drawRoundedRect(c, ch.cx - 12, ch.cy - 6, 24, 13, 4, '#065f46', '#34d399', 1.2);
    // Seat front thickness
    c.fillStyle = '#064e3b';
    c.fillRect(ch.cx - 11, ch.cy + 4, 22, 4);

    // 3D Curved Chair Backrest
    if (ch.dir === 'top') {
      drawRoundedRect(c, ch.cx - 13, ch.cy - 14, 26, 9, 4, '#78350f', '#CBA258', 1.2);
    } else if (ch.dir === 'bottom') {
      drawRoundedRect(c, ch.cx - 13, ch.cy + 3, 26, 8, 4, '#78350f', '#CBA258', 1.2);
    } else if (ch.dir === 'left') {
      drawRoundedRect(c, ch.cx - 15, ch.cy - 10, 7, 18, 3, '#78350f', '#CBA258', 1.2);
    } else {
      drawRoundedRect(c, ch.cx + 8, ch.cy - 10, 7, 18, 3, '#78350f', '#CBA258', 1.2);
    }
  });

  // Table Floor Shadow
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.beginPath();
  c.ellipse(tx, ty + 18, isRect ? 38 : 34, 14, 0, 0, Math.PI * 2);
  c.fill();

  // 3D Central Cast-Iron Table Pedestal & Base
  c.fillStyle = '#1e293b';
  c.beginPath();
  c.ellipse(tx, ty + 16, 15, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.fillRect(tx - 4, ty - 2, 8, 18);

  // 3D Extruded Tabletop (Wood / Marble)
  if (isRect) {
    // Front 3D edge of rectangular table
    drawRoundedRect(c, tx - 38, ty - 14, 76, 32, 8, '#451a03', '#d97706', 1.5);
    // Top surface
    drawRoundedRect(c, tx - 38, ty - 20, 76, 30, 8, t.dirty ? '#7f1d1d' : '#92400e', t.dirty ? '#f87171' : '#fbbf24', 2);
  } else {
    // 3D Cylinder Rim
    c.beginPath();
    c.ellipse(tx, ty - 1, 34, 20, 0, 0, Math.PI * 2);
    c.fillStyle = '#451a03';
    c.fill();

    // 3D Tabletop Surface
    c.beginPath();
    c.ellipse(tx, ty - 6, 34, 20, 0, 0, Math.PI * 2);
    c.fillStyle = t.dirty ? '#7f1d1d' : '#b45309';
    c.fill();
    c.lineWidth = 2.2;
    c.strokeStyle = t.dirty ? '#f87171' : '#fde68a';
    c.stroke();
  }

  // Items on the Table (3D Coffee Cups / Laptop / Dirty Dishes)
  if (t.dirty) {
    c.font = '14px sans-serif';
    c.textAlign = 'center';
    c.fillText('🥤🧻', tx, ty - 6);
    drawRoundedRect(c, tx - 36, ty - 34, 72, 16, 5, '#991b1b', '#fca5a5', 1.2);
    c.fillStyle = '#ffffff';
    c.font = 'bold 9.5px "Cairo Variable", Cairo, sans-serif';
    c.fillText('🧹 اضغط للتنظيف!', tx, ty - 22);
  } else {
    // Subtle decorative cup/menu on clean table
    c.fillStyle = '#fef3c7';
    c.beginPath();
    c.arc(tx - 10, ty - 8, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#00704A';
    c.beginPath();
    c.arc(tx + 10, ty - 6, 3.5, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#ffffff';
    c.font = 'bold 10.5px "Cairo Variable", Cairo, sans-serif';
    c.textAlign = 'center';
    c.fillText(`طاولة ${t.id}`, tx, ty + 2);
  }
}

// Draw a 3D Humanoid Character (Barista, Customer, or Manager)
function draw3DPerson(c, x, y, shirtColor, apronColor, icon, labelText, badgeColor, energyRatio, isSelected, entity, kind) {
  drawPerson(c, { x, y, shirt: shirtColor, apron: apronColor, icon, label: labelText, badgeColor, ratio: energyRatio, selected: isSelected, entity, kind });
}

// Draw a 3D Car in the Drive-Thru Lane
function draw3DCar(c, ord, isSelected) {
  drawCar(c, ord, isSelected, nightLevel(state.dayMinutes) > 0.3);
}

function renderCanvasScene() {
  const w = canvas.width;
  const h = canvas.height;
  const scaleX = w / LOGICAL_W;
  const scaleY = h / LOGICAL_H;

  ctx.save();
  ctx.scale(scaleX, scaleY);

  const branch = getActiveBranch();

  // 1. 3D PERSPECTIVE FLOOR & ARCHITECTURAL WALLS
  const floorGrad = ctx.createLinearGradient(0, 105, 0, LOGICAL_H);
  floorGrad.addColorStop(0, '#0f231d');
  floorGrad.addColorStop(0.45, branch.floorColor || '#17332a');
  floorGrad.addColorStop(1, '#10241d');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // 3D Perspective Floor Tiles (Angled lines from back bar to front window)
  ctx.strokeStyle = 'rgba(212, 233, 226, 0.055)';
  ctx.lineWidth = 1;
  for (let gx = -120; gx <= LOGICAL_W + 120; gx += 48) {
    ctx.beginPath();
    ctx.moveTo(gx, 110);
    ctx.lineTo(gx + (gx - LOGICAL_W / 2) * 0.28, LOGICAL_H);
    ctx.stroke();
  }
  for (let gy = 115; gy < LOGICAL_H; gy += 36) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(LOGICAL_W, gy);
    ctx.stroke();
  }

  // 2. TOP 3D DRIVE-THRU LANE & EXTERIOR LANDSCAPING (Y: 0 -> 108)
  ctx.fillStyle = '#131c2b';
  ctx.fillRect(0, 0, LOGICAL_W, 104);
  // 3D Sidewalk Curb between Drive-Thru and Store Building
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 98, LOGICAL_W, 8);
  ctx.fillStyle = '#00704A';
  ctx.fillRect(0, 104, LOGICAL_W, 5);

  // Dashed Road Divider
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2.2;
  ctx.setLineDash([20, 14]);
  ctx.beginPath();
  ctx.moveTo(0, 50);
  ctx.lineTo(LOGICAL_W, 50);
  ctx.stroke();
  ctx.setLineDash([]);

  // 3D DTO Speaker Canopy (Right side of Drive-Thru)
  draw3DBox(ctx, 740, 8, 175, 28, 10, '#0f172a', '#1e293b', '#090d16', '#38bdf8');
  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'bold 11px "Cairo Variable", Cairo, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎙️ كشك الطلب الصوتي (DTO)', 827, 26);

  // 3D DTR Pickup Window Canopy (Left/Center of Drive-Thru)
  draw3DBox(ctx, 195, 62, 200, 30, 10, '#064e3b', '#042f2e', '#022c22', '#CBA258');
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 11px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText(`🪟 شباك تسليم السيارات DTR (${state.stats.avgDtSeconds}ث)`, 295, 81);

  // 3. LEFT 3D BOH PARTNER BREAK ROOM (X: 16 -> 150, Y: 120 -> 335)
  draw3DBox(ctx, 16, 120, 134, 195, 22, '#1e1b4b', '#110e2e', '#09071a', '#a855f7');
  ctx.fillStyle = '#f3e8ff';
  ctx.font = 'bold 11.5px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText('🛋️ استراحة الباريستات', 83, 142);
  ctx.fillStyle = '#c084fc';
  ctx.font = '10px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText('(Break Room +100% طاقة)', 83, 157);

  // 3D L-Shaped Sofa & Coffee Table inside Break Room
  draw3DBox(ctx, 28, 172, 110, 26, 10, '#581c87', '#3b0764', '#2e1065', '#c084fc');
  draw3DBox(ctx, 52, 222, 62, 30, 8, '#78350f', '#451a03', '#290f02', '#fbbf24');
  ctx.fillStyle = '#fde68a';
  ctx.font = '11px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText('☕🍩', 83, 241);

  // 4. PARALLEL 3D STARBUCKS BAR ARCHITECTURE (X: 166 -> 942)
  // 4A. Back Bar Counter (3D Extruded Equipment Counter: Y: 120 -> 192, Depth: 24)
  draw3DBox(ctx, 166, 120, 774, 68, 24, '#1c1917', '#292524', '#0c0a09', '#CBA258');

  // 5 3D Workstations Mounted on Back Bar:
  const backStations = [
    { x: 178, y: 126, w: 126, h: 52, depth: 12, title: '🧹 محطة CS والمخزون', sub: `البن ${Math.round(state.supplies.beans)}% • الحليب ${Math.round(state.supplies.milk)}%`, topCol: '#115e59', frontCol: '#134e4a', icon: '📦' },
    { x: 314, y: 126, w: 126, h: 52, depth: 12, title: '🪟 كاشير شباك DTR', sub: 'شاشة طلبات السيارات', topCol: '#1e3a8a', frontCol: '#172554', icon: '🚗' },
    { x: 450, y: 126, w: 168, h: 52, depth: 14, title: '☕ ماكينات Mastrena II', sub: 'البار الساخن + Clover Vertica', topCol: '#065f46', frontCol: '#064e3b', icon: '⚡' },
    { x: 628, y: 126, w: 156, h: 52, depth: 14, title: '🧊 منظومة Siren الباردة', sub: 'خلاطات الفرابوتشينو والثلج', topCol: '#0e7490', frontCol: '#155e75', icon: '🥤' },
    { x: 794, y: 126, w: 134, h: 52, depth: 14, title: '🔥 أفران TurboChef', sub: 'تسخين الكرواسون والساندويتش', topCol: '#9a3412', frontCol: '#7c2d12', icon: '🥐' }
  ];

  backStations.forEach(st => {
    draw3DBox(ctx, st.x, st.y, st.w, st.h, st.depth, st.topCol, st.frontCol, '#090d16', 'rgba(255,255,255,0.32)');
    // 3D metallic top details (espresso hoppers / blenders / oven screen)
    drawRoundedRect(ctx, st.x + 8, st.y + 6, 26, 22, 4, 'rgba(0,0,0,0.35)', 'rgba(255,255,255,0.2)', 1);
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(st.icon, st.x + 21, st.y + 22);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Cairo Variable", Cairo, sans-serif';
    ctx.fillText(st.title, st.x + st.w / 2 + 10, st.y + 21);
    ctx.fillStyle = '#d1fae5';
    ctx.font = '9.5px "Cairo Variable", Cairo, sans-serif';
    ctx.fillText(st.sub, st.x + st.w / 2 + 6, st.y + 38);
  });

  // 4B. Barista Walking Aisle (Between Back Bar and Front Counter: Y: 205 -> 265)
  // Anti-fatigue rubber mat grid on barista floor
  drawRoundedRect(ctx, 176, 214, 754, 44, 6, 'rgba(0,0,0,0.28)', 'rgba(203,162,88,0.18)', 1);

  // 4C. Front Customer-Facing 3D Bar Counter (Y: 262 -> 312, Extruded Wooden Slat Front Depth: 34)
  draw3DBox(ctx, 166, 262, 774, 46, 34, '#294a3e', '#451a03', '#290f02', '#CBA258');

  // Draw signature Starbucks vertical wood slats on the 3D front face of the counter
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
  ctx.lineWidth = 2;
  for (let sx = 174; sx < 934; sx += 12) {
    ctx.beginPath();
    ctx.moveTo(sx, 309);
    ctx.lineTo(sx, 341);
    ctx.stroke();
  }

  // 3D Glass Pastry Display Case & POS on Left of Front Counter
  draw3DBox(ctx, 178, 254, 155, 42, 12, '#0f2922', '#064e3b', '#022c22', '#34d399');
  ctx.fillStyle = '#a7f3d0';
  ctx.font = 'bold 11px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText('🖥️ كاشير الصالة (POS)', 255, 273);
  ctx.fillStyle = '#fde68a';
  ctx.font = '9.5px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText('🥐 ثلاجة عرض المخبوزات 3D', 255, 289);

  // 3D Beverage Handoff Plane in Center of Front Counter
  draw3DBox(ctx, 355, 254, 310, 42, 12, '#132a23', '#0b1915', '#050b09', '#CBA258');
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 11.5px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText(`🛎️ بار تسليم المشروبات — ${state.activeSubStoreName || 'Nile City Cairo'}`, 510, 274);
  ctx.fillStyle = '#d1fae5';
  ctx.font = '9.5px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText('☕ أكواب Tall / Grande / Venti جاهزة للتسليم', 510, 290);

  // 3D Mobile Order & Delivery Pickup Station (Right of Front Counter)
  draw3DBox(ctx, 685, 254, 240, 42, 12, '#2e1065', '#1e1b4b', '#0f0728', '#c084fc');
  ctx.fillStyle = '#f3e8ff';
  ctx.font = 'bold 11px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText('📱 منصة طلبات الموبايل والتوصيل (MOP)', 805, 274);
  ctx.fillStyle = '#ddd6fe';
  ctx.font = '9.5px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText('🛵 تسليم سريع للمندوبين وتطبيق ستاربكس', 805, 290);

  // 4D. OVERHEAD TEAL DIGITAL MENU BOARDS (Matching the Real Starbucks Egypt Menu Boards!)
  const menuBoards = [
    { x: 185, w: 175, title: 'مشروباتنا الكلاسيكية', sub: 'وايت موكا 175 • ماكياتو 145 • كابتشينو 120' },
    { x: 372, w: 185, title: 'نكهات مميزة طوال اليوم', sub: 'أمريكانو 115 • لاتيه 120 • كولد برو 115' },
    { x: 569, w: 175, title: 'فرابتشينو ممزوج', sub: 'جافا تشيب • كراميل • فانيلا 160/170/180' },
    { x: 756, w: 175, title: 'Starbucks Refresha', sub: 'مانجو دراجون • ستروبيري أساي 150/160/170' }
  ];
  menuBoards.forEach(mb => {
    draw3DBox(ctx, mb.x, 104, mb.w, 22, 4, '#2a6f64', '#16423b', '#0d2924', '#a7f3d0');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9.5px "Cairo Variable", Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mb.title, mb.x + mb.w / 2, 114);
    ctx.fillStyle = '#d1fae5';
    ctx.font = '8.5px "Cairo Variable", Cairo, sans-serif';
    ctx.fillText(mb.sub, mb.x + mb.w / 2, 123);
  });

  // 5. STORE ENTRANCE & 3D CUSTOMER APOLOGY DESK (ركن شكاوى العملاء والاعتذار بالفرع)
  draw3DBox(ctx, 18, 385, 92, 130, 16, '#064e3b', '#022c22', '#011c16', '#34d399');
  ctx.fillStyle = '#d1fae5';
  ctx.font = 'bold 12px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText('🚪 مدخل الفرع', 64, 445);
  ctx.font = '18px sans-serif';
  ctx.fillText('🌿', 64, 475);

  // 3D Customer Care & Apology Podium (Where complaining customers stand in the branch)
  draw3DBox(ctx, 172, 344, 155, 28, 10, '#7f1d1d', '#450a0a', '#2a0505', '#fca5a5');
  ctx.fillStyle = '#fecdd3';
  ctx.font = 'bold 10px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText('🗣️ ركن شكاوى العملاء والاعتذار (اضغط العميل للاعتذار)', 249, 362);

  // 6. 3D CAFE LOBBY TABLES & CHAIRS (6 Detailed 3D Tables with 4 Chairs Each!)
  state.tables.forEach(t => {
    draw3DTableAndChairs(ctx, t);
  });

  // 6B. Machines at work and the light of the hour (drawn under the people).
  drawMachineFx(ctx, state);
  drawAmbient(ctx, state, LOGICAL_W, LOGICAL_H);

  // 7. 3D BARISTAS WORKING BEHIND THE BAR OR RESTING IN BREAK ROOM
  const activeStaff = getActiveBranchStaff();
  activeStaff.forEach((b, idx) => {
    // Map old coordinate ranges smoothly to the wider 3D bar
    const mappedTargetX = b.onBreak ? 78 : Math.min(890, Math.max(210, b.targetX * 1.25));
    const mappedTargetY = b.onBreak ? 195 + (idx % 3) * 36 : 232;
    b.x += (mappedTargetX - b.x) * 0.09;
    b.y += (mappedTargetY - b.y) * 0.09;

    const lowEnergy = (b.energy ?? 90) < 30 && !b.onBreak;
    draw3DPerson(
      ctx,
      b.x,
      b.y,
      b.onBreak ? '#581c87' : lowEnergy ? '#7f1d1d' : '#1e293b',
      b.onBreak ? null : '#00704A',
      b.onBreak ? '🛋️' : '👨\u200D🍳',
      `${b.name.split(' ')[0]}: ${b.busyText}`,
      lowEnergy ? '#f87171' : '#CBA258',
      (b.energy ?? 90) / 100,
      false,
      b,
      'barista'
    );
  });

  // 8. 3D DISTRICT MANAGER & OPERATIONS INSPECTOR (When Visit Active)
  if (state.inspection.active) {
    const ins = state.inspection;
    const tx = Math.min(850, Math.max(180, ins.targetX * 1.25));
    const ty = Math.min(480, Math.max(330, ins.targetY * 1.35));
    ins.x += (tx - ins.x) * 0.05;
    ins.y += (ty - ins.y) * 0.05;

    // Glowing golden inspection ring on the floor
    ctx.strokeStyle = '#CBA258';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(ins.x, ins.y + 16, 26, 10, 0, 0, Math.PI * 2);
    ctx.stroke();

    draw3DPerson(
      ctx,
      ins.x,
      ins.y,
      '#1e1b4b',
      '#312e81',
      '👔',
      `📋 لجنة التفتيش (${ins.timeLeft}ث)`,
      '#CBA258',
      ins.timeLeft / 18,
      true,
      ins,
      'inspector'
    );
  }

  // 8B. 3D COMPLAINING CUSTOMERS IN STORE WAITING FOR APOLOGY
  const activeInStoreComplaints = (state.complaints || []).filter(c => !c.resolved && c.inStore);
  activeInStoreComplaints.forEach((comp, idx) => {
    const cx = 200 + (idx * 65) % 130;
    const cy = 356;
    comp.x = cx;
    comp.y = cy;

    // Pulsing red ring under complaining customer
    ctx.strokeStyle = comp.severity === 'high' ? '#ef4444' : comp.severity === 'medium' ? '#f59e0b' : '#10b981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 16, 24, 9, 0, 0, Math.PI * 2);
    ctx.stroke();

    draw3DPerson(
      ctx,
      cx,
      cy,
      comp.severity === 'high' ? '#991b1b' : '#92400e',
      null,
      '😡',
      `🤝 اعتذر لـ ${comp.customerName.split(' ')[0]} (${comp.severityLabel})`,
      '#f87171',
      0.25,
      true,
      comp,
      'complaint'
    );
  });

  // 9. 3D DRIVE-THRU CARS & 3D IN-STORE CUSTOMERS
  const dtOrders = state.orders.filter(o => o.channel === 'drive_thru');
  const storeOrders = state.orders.filter(o => o.channel !== 'drive_thru');

  dtOrders.forEach((ord, idx) => {
    const targetX = 300 + idx * 140;
    ord.x += (targetX - ord.x) * 0.1;
    ord.y = 44;
    draw3DCar(ctx, ord, ord.id === state.selectedTicketId);
  });

  storeOrders.forEach((ord, idx) => {
    const targetX = ord.channel === 'cafe' ? 375 + (idx * 82) % 285 : 700 + (idx * 72) % 190;
    const targetY = 352 + (idx % 2) * 26;
    ord.x += (targetX - ord.x) * 0.09;
    ord.y += (targetY - ord.y) * 0.09;

    const ratio = Math.max(0, ord.timeLeft / ord.maxTime);
    const mood = ratio > 0.6 ? '😊' : ratio > 0.32 ? '😐' : '😡';
    const shirtCol = ord.channel === 'mobile' ? '#6b21a8' : ord.channel === 'delivery' ? '#b45309' : '#0f766e';

    draw3DPerson(
      ctx,
      ord.x,
      ord.y,
      shirtCol,
      null,
      mood,
      `${ord.itemIcon} ${ord.size} (${Math.ceil(ord.timeLeft)}ث)`,
      ord.id === state.selectedTicketId ? '#CBA258' : '#38bdf8',
      ratio,
      ord.id === state.selectedTicketId,
      ord,
      'customer'
    );
  });

  // 10. PARTICLES & FLOATING TEXTS
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.04;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.y += ft.vy;
    ft.alpha -= 0.022;
    if (ft.alpha <= 0) {
      state.floatingTexts.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = ft.alpha;
    ctx.fillStyle = ft.color;
    ctx.font = '800 15px "Cairo Variable", Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.globalAlpha = 1.0;
  }

  ctx.restore();
  requestAnimationFrame(renderCanvasScene);
}

// =========================================================================
// EVENT LISTENERS & INTERACTIVE CONTROLS
// =========================================================================
function setupEventListeners() {
  // Canvas Click Interaction
  canvas.addEventListener('click', (e) => {
    initAudio();
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (LOGICAL_W / (rect.width || LOGICAL_W));
    const cy = (e.clientY - rect.top) * (LOGICAL_H / (rect.height || LOGICAL_H));

    // Check if clicked a Complaining Customer at the 3D Apology Desk
    for (let comp of (state.complaints || [])) {
      if (!comp.resolved && comp.inStore) {
        const distC = Math.hypot(cx - (comp.x || 210), cy - (comp.y || 356));
        if (distC <= 52) {
          apologizeAndResolveComplaint(comp.id);
          return;
        }
      }
    }

    // Check if clicked 3D Break Room (X: 16..150, Y: 120..335)
    if (cx >= 16 && cx <= 150 && cy >= 120 && cy <= 335) {
      const tired = getActiveBranchStaff().find(s => !s.onBreak && s.energy < 85);
      if (tired) {
        sendBaristaToBreak(tired.id, false);
      } else {
        showToast('🛋️ غرفة استراحة الموظفين: جميع الباريستات في الفرع بكامل نشاطهم حالياً!');
      }
      return;
    }

    // Check if clicked a dirty table
    for (let t of state.tables) {
      const dist = Math.hypot(cx - t.x, cy - t.y);
      if (dist <= 46) {
        if (t.dirty) {
          t.dirty = false;
          state.cleanliness = Math.min(100, state.cleanliness + 10);
          state.opsScore = Math.min(100, +(state.opsScore + 1.0).toFixed(1));
          state.stats.clean_actions += 1;
          playSound('step');
          spawnSparkles(t.x, t.y, '#38bdf8');
          addFloatingText('✨ نظيفة!', t.x, t.y - 10, '#38bdf8');
          updateHUD();
          renderMissionsTab();
        } else {
          showToast(`✨ الطاولة ${t.id} نظيفة وجاهزة للزبائن!`);
        }
        return;
      }
    }

    // Check if clicked a customer or car on canvas
    for (let ord of state.orders) {
      const dist = Math.hypot(cx - ord.x, cy - ord.y);
      if (dist <= 48) {
        state.selectedTicketId = ord.id;
        playSound('step');
        renderTicketsQueue();
        renderWorkbench();
        return;
      }
    }
  });

  // Full-Width 3D Store View Toggle & Camera Angle Toggle
  const btnWide3D = document.getElementById('btnToggleWide3D');
  if (btnWide3D) {
    btnWide3D.addEventListener('click', () => {
      state.wide3D = !state.wide3D;
      const leftCol = document.getElementById('leftStoreCol');
      const rightCol = document.getElementById('rightTabsCol');
      const wrapper = document.getElementById('canvasWrapper');
      const lbl = document.getElementById('wide3DLabel');
      if (state.wide3D) {
        leftCol.className = 'lg:col-span-12 flex flex-col gap-3.5 transition-all duration-300';
        rightCol.className = 'lg:col-span-12 flex flex-col gap-3.5 transition-all duration-300';
        wrapper.className = 'w-full h-[620px] sm:h-[740px] rounded-2xl overflow-hidden border-2 border-[#CBA258] bg-[#0e1f1a] relative shadow-2xl';
        lbl.textContent = 'وضع الشاشة المقسمة العادي';
        showToast('🖥️ تم تكبير الفرع ثلاثي الأبعاد (3D) بعرض الشاشة بالكامل!');
      } else {
        leftCol.className = 'lg:col-span-7 flex flex-col gap-3.5 transition-all duration-300';
        rightCol.className = 'lg:col-span-5 flex flex-col gap-3.5 transition-all duration-300';
        wrapper.className = 'w-full h-[580px] sm:h-[680px] rounded-2xl overflow-hidden border-2 border-[#CBA258]/50 bg-[#0e1f1a] relative shadow-2xl';
        lbl.textContent = 'تكبير الفرع 3D بعرض الشاشة';
      }
      setTimeout(resizeCanvas, 60);
    });
  }

  const btnCamAngle = document.getElementById('btnToggleCamAngle');
  if (btnCamAngle) {
    btnCamAngle.addEventListener('click', () => {
      state.camAngle = ((state.camAngle || 0) + 1) % 3;
      const wrapper = document.getElementById('canvasWrapper');
      if (state.camAngle === 1) {
        wrapper.style.transform = 'perspective(1200px) rotateX(6deg)';
        btnCamAngle.textContent = '🎥 زاوية 3D: إيزومترك مرتفع';
      } else if (state.camAngle === 2) {
        wrapper.style.transform = 'perspective(1000px) rotateX(10deg) scale(1.02)';
        btnCamAngle.textContent = '🎥 زاوية 3D: قريب للبار';
      } else {
        wrapper.style.transform = 'none';
        btnCamAngle.textContent = '🎥 زاوية 3D: بانوراما';
      }
    });
  }

  // Menu Category Filter Buttons
  const catContainer = document.getElementById('menuCategoryFilters');
  if (catContainer) {
    catContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-menu-cat]');
      if (!btn) return;
      initAudio();
      state.activeMenuCat = btn.getAttribute('data-menu-cat');
      renderMenuTab();
    });
  }


  // Branch Search Input in Branches Tab
  const branchSearchInput = document.getElementById('branchSearchInput');
  if (branchSearchInput) {
    branchSearchInput.addEventListener('input', (e) => {
      state.branchSearchQuery = e.target.value || '';
      renderBranchesTab();
    });
  }

  // HUD Individual Store Selector (Control ANY Opened Branch Directly!)
  const hudStoreSelector = document.getElementById('hudStoreSelector');
  if (hudStoreSelector) {
    hudStoreSelector.addEventListener('change', (e) => {
      initAudio();
      const parts = (e.target.value || '').split('__');
      const bId = parts[0];
      const sName = parts[1];
      const b = state.branches.find(item => item.id === bId);
      if (b && b.unlocked) {
        state.activeBranchId = b.id;
        state.activeSubStoreName = sName || b.name;
        playSound('ding');
        showToast(`🎛️ أنت تتحكم الآن مباشرة في "${state.activeSubStoreName}" (منطقة ${b.dmName})!`);
        updateHUD();
        renderBranchesTab();
        renderStaffTab();
        renderOpsTab();
      }
    });
  }

  // Quick Jump Buttons to Advanced Store Systems
  function activateTabByName(tabKey, scrollTargetId) {
    initAudio();
    document.querySelectorAll('.nav-tab').forEach(b => {
      b.classList.toggle('tab-active', b.getAttribute('data-tab') === tabKey);
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById(`tab-${tabKey}`);
    if (panel) panel.classList.remove('hidden');
    if (tabKey === 'ops') renderOpsTab();
    if (tabKey === 'staff') renderStaffTab();
    if (scrollTargetId) {
      const el = document.getElementById(scrollTargetId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  document.getElementById('btnQuickJumpComplaints').addEventListener('click', () => activateTabByName('ops', 'complaintsSectionCard'));
  document.getElementById('btnQuickJumpMaintenance').addEventListener('click', () => activateTabByName('ops', 'maintenanceSectionCard'));
  document.getElementById('btnQuickJumpSchedules').addEventListener('click', () => activateTabByName('staff', 'sickLeaveSection'));
  document.getElementById('btnQuickJumpWeeklyOrders').addEventListener('click', () => activateTabByName('ops', 'weeklyOrdersSectionCard'));

  // Live Banner Apologize Button
  document.getElementById('btnBannerApologizeNow').addEventListener('click', (e) => {
    initAudio();
    const compId = Number(e.currentTarget.getAttribute('data-apologize-id'));
    if (compId) apologizeAndResolveComplaint(compId);
  });

  // Spawn New Complaining Customer in Branch
  document.getElementById('btnSpawnComplaintCustomer').addEventListener('click', () => {
    initAudio();
    const sampleComplaints = [
      { drink: 'دبل شوت™ مثلج مخفوق دولتشي دي ليتشي (كبير 205 ج.م)', issue: 'العميل طلب حليب لوز خالي من الألبان (+30 ج.م) ولاحظ طعم حليب عادي!', sev: 'high' },
      { drink: 'مانجو دراجون فروت ريفرشا (وسط 160 ج.م)', issue: 'المشروب قليل قطع الفاكهة وتأخر على البار 8 دقائق.', sev: 'medium' },
      { drink: 'كاراميل ماكياتو ساخن (صغير 135 ج.م)', issue: 'نقص صوص الكراميل على الوجه وعدم توفر حوامل أكواب.', sev: 'low' }
    ];
    const pick = sampleComplaints[Math.floor(Math.random() * sampleComplaints.length)];
    createCustomerComplaint(null, pick.drink, pick.issue, pick.sev);
    showToast('🗣️ دخل عميل صاحب شكوى إلى الفرع الآن وينتظر اعتذارك عند ركن خدمة العملاء!');
  });

  // Complaint Severity Filters
  document.getElementById('complaintSeverityFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-comp-sev]');
    if (!btn) return;
    initAudio();
    state.complaintFilter = btn.getAttribute('data-comp-sev');
    renderOpsTab();
  });

  // Apologize & Resolve Complaint Delegation
  document.getElementById('complaintsListContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-apologize-id]');
    if (!btn) return;
    initAudio();
    apologizeAndResolveComplaint(Number(btn.getAttribute('data-apologize-id')));
  });

  // Equipment Maintenance Delegation
  document.getElementById('equipmentMaintenanceContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-repair-eq]');
    if (!btn) return;
    initAudio();
    repairEquipmentItem(btn.getAttribute('data-repair-eq'));
  });

  document.getElementById('btnMaintainAllMachines').addEventListener('click', () => {
    initAudio();
    const cost = 45;
    if (state.money < cost) {
      showToast('⚠️ تحتاج إلى $45 لصيانة ومعايرة جميع معدات الفرع!');
      playSound('angry');
      return;
    }
    state.money = +(state.money - cost).toFixed(2);
    (state.equipmentList || []).forEach(eq => {
      eq.health = 100;
      eq.status = 'تعمل بكفاءة 100% (صيانة شاملة)';
      eq.ticketOpen = false;
    });
    state.machineHealth = 100;
    state.opsScore = Math.min(100, state.opsScore + 6);
    emit('repair', { eqId: 'all' });
    playSound('fanfare');
    showToast('🛠️ تمت صيانة ومعايرة جميع ماكينات الإسبريسو والخلاطات والأفران بنسبة 100%!');
    updateHUD();
    renderOpsTab();
  });

  // Weekly Supply Orders Delegation
  document.getElementById('weeklyOrdersContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-order-weekly]');
    if (!btn) return;
    initAudio();
    orderWeeklySupplyItem(btn.getAttribute('data-order-weekly'));
  });

  document.getElementById('btnApproveFullWeeklyOrder').addEventListener('click', () => {
    initAudio();
    const cost = 95;
    if (state.money < cost) {
      showToast('⚠️ تحتاج إلى $95 لاعتماد الطلبية الأسبوعية المجمعة للفرع!');
      playSound('angry');
      return;
    }
    state.money = +(state.money - cost).toFixed(2);
    (state.weeklyOrders || []).forEach(w => { w.orderedThisWeek = true; });
    emit('weekly:ordered', { id: 'all' });
    restockAllSupplies(true);
    state.opsScore = Math.min(100, state.opsScore + 6);
    state.dmSatisfaction = Math.min(100, state.dmSatisfaction + 4);
    playSound('fanfare');
    showToast('🚚 تم اعتماد الطلبية الأسبوعية الكاملة وتموين الفرع بنسبة 100%!');
    updateHUD();
    renderOpsTab();
  });

  // Sick Leave Requests & Shift Schedules Delegation
  document.getElementById('btnSimulateSickRequest').addEventListener('click', () => {
    initAudio();
    const member = state.staff[Math.floor(Math.random() * state.staff.length)];
    if (!member) return;
    const reqId = ++state.nextId;
    state.sickRequests.unshift({
      id: reqId,
      staffId: member.id,
      staffName: member.name,
      branchName: state.activeSubStoreName || getActiveBranch().name,
      reason: 'طلب إجازة مرضية طارئة لمدة يوم مع تقرير طبي ويحتاج لتكليف باريستا بديل لتغطية الوردية.',
      days: 1,
      resolved: false,
      statusText: 'بانتظار موافقة مدير الفرع'
    });
    pushNewEmail({
      sender: `الموارد البشرية HR — طلب إجازة مرضية (${member.name})`,
      roleBadge: 'إجازة مرضية 🏥',
      subject: `طلب إجازة مرضية من "${member.name}" وتغطية جدول الوردية`,
      body: `تقدم الباريستا "${member.name}" بطلب إجازة مرضية اليوم. يرجى الموافقة من تبويب الجداول والإجازات أو من هذا الإيميل لتكليف بديل فوراً.`,
      choices: [
        { label: '✅ الموافقة على الإجازة المرضية وتكليف بديل (+4% أوبريشن)', cost: 0, dmDelta: 3, opsDelta: 4 }
      ]
    });
    updateHUD();
    renderStaffTab();
  });

  document.getElementById('sickRequestsContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-approve-sick]');
    if (!btn) return;
    initAudio();
    approveSickLeaveRequest(Number(btn.getAttribute('data-approve-sick')));
  });

  document.getElementById('shiftScheduleContainer').addEventListener('change', (e) => {
    const staffId = Number(e.target.getAttribute('data-staff-shift'));
    if (!staffId) return;
    const b = state.staff.find(s => s.id === staffId);
    if (b) {
      b.shift = e.target.value;
      showToast(`📅 تم تحديث جدول وردية "${b.name}" بنجاح!`);
      renderStaffTab();
    }
  });

  document.getElementById('btnAutoScheduleShifts').addEventListener('click', () => {
    initAudio();
    const shifts = ['morning', 'peak', 'evening'];
    state.staff.forEach((b, i) => {
      if (!b.sickLeave) {
        b.shift = shifts[i % shifts.length];
      }
    });
    state.opsScore = Math.min(100, state.opsScore + 3);
    playSound('step');
    showToast('📅 تمت موازنة جداول الورديات الصباحية والذروة والمسائية لجميع الموظفين!');
    updateHUD();
    renderStaffTab();
  });

  // Navigation Tabs
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      const target = btn.getAttribute('data-tab');
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('tab-active'));
      btn.classList.add('tab-active');

      document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.add('hidden');
      });
      const activePanel = document.getElementById(`tab-${target}`);
      if (activePanel) {
        activePanel.classList.remove('hidden');
      }

      if (target === 'staff') renderStaffTab();
      if (target === 'inbox') renderInboxTab();
      if (target === 'ops') renderOpsTab();
      if (target === 'menu') renderMenuTab();
      if (target === 'upgrades') renderUpgradesTab();
      if (target === 'missions') renderMissionsTab();
      if (target === 'branches') renderBranchesTab();
    });
  });

  // Ticket selection in Queue
  document.getElementById('ticketsContainer').addEventListener('click', (e) => {
    const card = e.target.closest('[data-ticket-id]');
    if (!card) return;
    initAudio();
    state.selectedTicketId = Number(card.getAttribute('data-ticket-id'));
    renderTicketsQueue();
    renderWorkbench();
  });

  // Crafting Step Buttons
  document.querySelectorAll('.craft-step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      const stepKey = btn.getAttribute('data-step');
      const order = state.orders.find(o => o.id === state.selectedTicketId) || state.orders[0];
      if (!order) {
        showToast('⏳ لا توجد طلبات في الطابور حالياً! اضغط "⚡ موجة ذروة" لاستدعاء زبائن.');
        return;
      }
      state.selectedTicketId = order.id;
      performOrderStep(order, stepKey, true);
    });
  });

  // Instant Finish & Handoff Button
  document.getElementById('btnDeliverOrder').addEventListener('click', () => {
    initAudio();
    const order = state.orders.find(o => o.id === state.selectedTicketId) || state.orders[0];
    if (!order) {
      showToast('⏳ لا يوجد طلب لتسليمه حالياً!');
      return;
    }
    if (!hasEnoughSupplies(order.stockUse)) {
      showToast('🚨 نفد المخزون! اضغط "تعبئة كل المخزون" أولاً.');
      playSound('angry');
      return;
    }
    order.stepsRequired.forEach(s => { order.stepStates[s] = true; });
    order.progress = 100;
    completeAndHandoffOrder(order.id, true);
  });

  // Quick CS Buttons
  document.getElementById('btnQuickCleanLobby').addEventListener('click', () => {
    initAudio();
    cleanLobbyTables(false);
  });
  document.getElementById('btnQuickSanitize').addEventListener('click', () => {
    initAudio();
    sanitizeBarStations(false);
  });
  document.getElementById('btnQuickCalibrate').addEventListener('click', () => {
    initAudio();
    calibrateMachines(false);
  });
  document.getElementById('btnQuickRestockAll').addEventListener('click', () => {
    initAudio();
    restockAllSupplies(false);
  });

  // Auto-Break Toggle
  document.getElementById('btnAutoBreakToggle').addEventListener('click', () => {
    initAudio();
    state.autoBreak = !state.autoBreak;
    showToast(state.autoBreak ? '🛋️ تم تفعيل جدولة الراحة التلقائية للموظفين المرهقين!' : '⏸️ تم إيقاف الراحة التلقائية؛ أنت تتحكم بالراحات يدوياً الآن.');
    renderStaffTab();
  });

  // Hire New Barista (Standard button)
  document.getElementById('btnHireBarista').addEventListener('click', () => {
    initAudio();
    const cost = 180 + Math.max(0, state.staff.length - 2) * 95;
    if (state.money < cost) {
      showToast(`⚠️ تحتاج إلى $${cost} لتوظيف باريستا جديد!`);
      playSound('angry');
      return;
    }
    state.money = +(state.money - cost).toFixed(2);
    const tpl = APPLICANT_TEMPLATES[state.staff.length % APPLICANT_TEMPLATES.length];
    state.staff.push({
      id: ++state.nextId,
      name: tpl.name,
      branchId: state.activeBranchId,
      role: tpl.role,
      level: 1,
      speedMult: tpl.speedMult,
      energy: 100,
      onBreak: false,
      breakTimeLeft: 0,
      x: 350,
      y: 205,
      targetX: 350,
      targetY: 205,
      busyText: 'انضم للفريق!'
    });
    emit('staff:hire', {});
    playSound('fanfare');
    showToast(`🎉 تم تعيين "${tpl.name}" في ${getActiveBranch().name}!`);
    updateHUD();
    renderStaffTab();
    renderBranchesTab();
    renderMissionsTab();
  });

  // Hire Specific Applicant from HR Pool
  document.getElementById('applicantsContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-hire-applicant]');
    if (!btn) return;
    initAudio();
    const appId = Number(btn.getAttribute('data-hire-applicant'));
    const idx = state.applicants.findIndex(a => a.id === appId);
    if (idx === -1) return;
    const app = state.applicants[idx];
    if (state.money < app.cost) {
      showToast(`⚠️ تحتاج إلى $${app.cost} لتعيين ${app.name}!`);
      playSound('angry');
      return;
    }
    state.money = +(state.money - app.cost).toFixed(2);
    state.staff.push({
      id: ++state.nextId,
      name: app.name,
      branchId: state.activeBranchId,
      role: app.role,
      level: 1,
      speedMult: app.speedMult,
      energy: 100,
      onBreak: false,
      breakTimeLeft: 0,
      x: 360,
      y: 205,
      targetX: 360,
      targetY: 205,
      busyText: 'جاهز للعمل!'
    });
    state.applicants.splice(idx, 1);
    emit('staff:hire', {});
    playSound('fanfare');
    showToast(`🎉 تم تعيين "${app.name}" (${app.specialty}) في ${getActiveBranch().name}!`);
    updateHUD();
    renderStaffTab();
    renderBranchesTab();
    renderMissionsTab();
  });

  // Staff Role Change & Branch Transfer Delegation
  document.getElementById('staffListContainer').addEventListener('change', (e) => {
    const roleStaffId = Number(e.target.getAttribute('data-staff-role'));
    if (roleStaffId) {
      const b = state.staff.find(s => s.id === roleStaffId);
      if (b) {
        b.role = e.target.value;
        showToast(`✅ تم تحديث محطة ${b.name} على البار!`);
        renderStaffTab();
      }
      return;
    }

    const transferStaffId = Number(e.target.getAttribute('data-staff-transfer'));
    if (transferStaffId) {
      const b = state.staff.find(s => s.id === transferStaffId);
      const destBranch = state.branches.find(br => br.id === e.target.value);
      if (b && destBranch) {
        b.branchId = destBranch.id;
        b.onBreak = false;
        playSound('ding');
        showToast(`🔄 تم نقل "${b.name}" للعمل في ${destBranch.name} لتغطية التشغيل!`);
        updateHUD();
        renderStaffTab();
        renderBranchesTab();
      }
    }
  });

  // Staff Break & Train Buttons Delegation
  document.getElementById('staffListContainer').addEventListener('click', (e) => {
    const breakBtn = e.target.closest('[data-staff-break]');
    if (breakBtn) {
      initAudio();
      const staffId = Number(breakBtn.getAttribute('data-staff-break'));
      sendBaristaToBreak(staffId, false);
      return;
    }

    const btn = e.target.closest('[data-staff-train]');
    if (!btn) return;
    initAudio();
    const staffId = Number(btn.getAttribute('data-staff-train'));
    const b = state.staff.find(s => s.id === staffId);
    if (!b) return;
    const cost = b.level * 120;
    if (state.money < cost) {
      showToast(`⚠️ تحتاج إلى $${cost} لتدريب ${b.name}!`);
      playSound('angry');
      return;
    }
    state.money = +(state.money - cost).toFixed(2);
    b.level += 1;
    b.speedMult = +(b.speedMult + 0.22).toFixed(2);
    b.energy = 100;
    emit('staff:train', { staffId });
    playSound('fanfare');
    showToast(`⬆️ ارتفع مستوى ${b.name} إلى المستوى ${b.level} واستعاد كامل نشاطه!`);
    updateHUD();
    renderStaffTab();
  });

  // Inbox Email Decision Handling
  document.getElementById('inboxListContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-email-id]');
    if (!btn) return;
    initAudio();
    const mailId = Number(btn.getAttribute('data-email-id'));
    const cIdx = Number(btn.getAttribute('data-choice-idx'));
    const mail = state.emails.find(m => m.id === mailId);
    if (!mail || mail.resolved) return;

    const choice = (mail.choices || [])[cIdx];
    if (!choice) return;

    if (choice.cost > 0 && state.money < choice.cost) {
      showToast(`⚠️ الرصيد غير كافٍ لتنفيذ هذا القرار ($${choice.cost})!`);
      playSound('angry');
      return;
    }

    state.money = +(state.money - (choice.cost || 0)).toFixed(2);
    state.dmSatisfaction = Math.min(100, Math.max(10, state.dmSatisfaction + (choice.dmDelta || 0)));
    state.opsScore = Math.min(100, Math.max(10, state.opsScore + (choice.opsDelta || 0)));

    if (choice.resolveComplaintId) {
      apologizeAndResolveComplaint(choice.resolveComplaintId);
    }
    if (choice.fixEquipmentId) {
      const eq = (state.equipmentList || []).find(item => item.id === choice.fixEquipmentId);
      if (eq) {
        eq.health = 100;
        eq.status = 'تعمل بكفاءة 100% (تمت الصيانة)';
        eq.ticketOpen = false;
      }
    }
    if (choice.targetDmId) {
      const targetBr = state.branches.find(b => b.id === choice.targetDmId);
      if (targetBr) {
        targetBr.dmSatisfaction = Math.min(100, Math.max(20, (targetBr.dmSatisfaction || 90) + (choice.dmDelta || 0)));
      }
    }
    if (choice.trainBoostAll) {
      state.trainingScore = Math.min(100, (state.trainingScore || 95) + 5);
      state.staff.forEach(s => {
        s.speedMult = +(s.speedMult + 0.08).toFixed(2);
      });
    }
    if (choice.boostStaffEnergy) {
      state.staff.forEach(s => {
        s.energy = Math.min(100, (s.energy || 80) + choice.boostStaffEnergy);
        s.onBreak = false;
      });
    }
    if (choice.fullCleanAndCalibrate) {
      cleanLobbyTables(true);
      sanitizeBarStations(true);
      calibrateMachines(true);
    }
    if (choice.fullRestock) {
      restockAllSupplies(true);
    }
    if (choice.emergencyHireBranch) {
      state.staff.push({
        id: ++state.nextId,
        name: 'باريستا دعم إقليمي',
        branchId: choice.emergencyHireBranch,
        role: 'flex',
        level: 2,
        speedMult: 1.25,
        energy: 100,
        onBreak: false,
        breakTimeLeft: 0,
        x: 350,
        y: 205,
        targetX: 350,
        targetY: 205,
        busyText: 'دعم الفروع'
      });
    }

    mail.resolved = true;
    mail.read = true;
    state.stats.emails_resolved += 1;
    emit('email:resolved', { mail, choice });
    playSound('fanfare');
    showToast(`📧 تم تنفيذ قرارك الإداري وتحديث رضا مدير المنطقة والأوبريشن!`);
    updateHUD();
    renderInboxTab();
    renderOpsTab();
    renderStaffTab();
    renderMissionsTab();
  });

  document.getElementById('btnGenerateSituationalEmail').addEventListener('click', () => {
    initAudio();
    generateSituationalEmail(true);
  });

  // Trigger Audit Visit Button
  document.getElementById('btnTriggerAuditVisit').addEventListener('click', () => {
    initAudio();
    startInspectionVisit(true);
  });

  // Training Session with Mahmoud Ahmed
  document.getElementById('btnTrainingSession').addEventListener('click', () => {
    initAudio();
    const cost = 65;
    if (state.money < cost) {
      showToast('⚠️ تحتاج إلى $65 لعقد دورة تدريبية مع أ. محمود أحمد!');
      playSound('angry');
      return;
    }
    state.money = +(state.money - cost).toFixed(2);
    state.trainingScore = Math.min(100, (state.trainingScore || 95) + 6);
    state.opsScore = Math.min(100, state.opsScore + 4);
    state.staff.forEach(s => {
      s.speedMult = +(s.speedMult + 0.10).toFixed(2);
      s.energy = 100;
      s.onBreak = false;
    });
    playSound('fanfare');
    showToast('🎓 عقد أ. محمود أحمد (مدير التدريب) دورة Siren Craft للطاقم! ارتفعت سرعة وطاقة كل الباريستات!');
    updateHUD();
    renderOpsTab();
    renderStaffTab();
  });

  // Specific Regional DM Visit Trigger
  document.getElementById('regionalDmsContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-visit-dm]');
    if (!btn) return;
    initAudio();
    const bId = btn.getAttribute('data-visit-dm');
    const b = state.branches.find(item => item.id === bId);
    if (!b) return;
    startInspectionVisit(true, `${b.dmName} (${b.dmTitle}) وأ. عمرو عاطف (الأوبريشن)`);
  });

  // Menu Delegation
  document.getElementById('menuListContainer').addEventListener('click', (e) => {
    initAudio();
    const unlockBtn = e.target.closest('[data-menu-unlock]');
    if (unlockBtn) {
      const id = unlockBtn.getAttribute('data-menu-unlock');
      const item = state.menu.find(m => m.id === id);
      if (!item) return;
      if (state.money < item.unlockCost) {
        showToast(`⚠️ تحتاج إلى $${item.unlockCost} لفتح ${item.name}!`);
        playSound('angry');
        return;
      }
      state.money = +(state.money - item.unlockCost).toFixed(2);
      item.unlocked = true;
      playSound('fanfare');
      showToast(`🍹 تمت إضافة "${item.name}" إلى منيو الفرع!`);
      updateHUD();
      renderMenuTab();
      renderMissionsTab();
      return;
    }

    const downBtn = e.target.closest('[data-price-down]');
    if (downBtn) {
      const item = state.menu.find(m => m.id === downBtn.getAttribute('data-price-down'));
      if (item && item.price > 1.5) {
        item.price = +(item.price - 0.5).toFixed(2);
        renderMenuTab();
      }
      return;
    }

    const upBtn = e.target.closest('[data-price-up]');
    if (upBtn) {
      const item = state.menu.find(m => m.id === upBtn.getAttribute('data-price-up'));
      if (item && item.price < 15.0) {
        item.price = +(item.price + 0.5).toFixed(2);
        renderMenuTab();
      }
      return;
    }

    const toggleBtn = e.target.closest('[data-menu-toggle]');
    if (toggleBtn) {
      const item = state.menu.find(m => m.id === toggleBtn.getAttribute('data-menu-toggle'));
      const activeCount = state.menu.filter(m => m.unlocked && m.active).length;
      if (item) {
        if (item.active && activeCount <= 1) {
          showToast('⚠️ يجب إبقاء صنف واحد على الأقل مفعلاً في المنيو!');
          return;
        }
        item.active = !item.active;
        renderMenuTab();
      }
    }
  });

  // Upgrades Delegation
  document.getElementById('upgradesListContainer').addEventListener('click', (e) => {
    const buyBtn = e.target.closest('[data-upgrade-buy]');
    if (!buyBtn) return;
    initAudio();
    const u = state.upgrades.find(item => item.id === buyBtn.getAttribute('data-upgrade-buy'));
    if (!u || u.level >= u.maxLevel) return;
    const cost = Math.round(u.baseCost * Math.pow(u.costMult, u.level));
    if (state.money < cost) {
      showToast(`⚠️ الرصيد غير كافٍ لشراء ترقية ${u.name} ($${cost})!`);
      playSound('angry');
      return;
    }
    state.money = +(state.money - cost).toFixed(2);
    u.level += 1;
    state.stats.upgrades_bought += 1;
    emit('upgrade:bought', { id: u.id, level: u.level });
    state.dmSatisfaction = Math.min(100, state.dmSatisfaction + 3);
    playSound('fanfare');
    showToast(`⚙️ تمت ترقية ${u.name} إلى المستوى ${u.level}!`);
    updateHUD();
    renderUpgradesTab();
    renderMissionsTab();
  });

  // Missions Claim Delegation
  document.getElementById('missionsListContainer').addEventListener('click', (e) => {
    const claimBtn = e.target.closest('[data-mission-claim]');
    if (!claimBtn) return;
    initAudio();
    const m = state.missions.find(item => item.id === claimBtn.getAttribute('data-mission-claim'));
    if (!m || m.claimed) return;
    m.claimed = true;
    state.money = +(state.money + m.reward).toFixed(2);
    playSound('fanfare');
    addFloatingText(`+$${m.reward} مكافأة مهمة!`, 380, 180, '#fbbf24');
    showToast(`🏆 استلمت مكافأة المهمة "${m.title}" (+$${m.reward})!`);
    updateHUD();
    renderMissionsTab();
  });

  // Branches Delegation
  document.getElementById('branchesListContainer').addEventListener('click', (e) => {
    initAudio();
    const unlockBtn = e.target.closest('[data-branch-unlock]');
    if (unlockBtn) {
      const b = state.branches.find(item => item.id === unlockBtn.getAttribute('data-branch-unlock'));
      if (!b || b.unlocked) return;
      if (state.money < b.unlockCost) {
        showToast(`⚠️ تحتاج إلى $${b.unlockCost} لافتتاح ${b.name}!`);
        playSound('angry');
        return;
      }
      state.money = +(state.money - b.unlockCost).toFixed(2);
      b.unlocked = true;
      b.openBranches = Math.max(1, b.openBranches || 2);
      // Automatically assign 1 initial barista to the newly opened branch
      state.staff.push({
        id: ++state.nextId,
        name: `باريستا ${b.name.split(' ')[1]}`,
        branchId: b.id,
        role: 'flex',
        level: 1,
        speedMult: 1.1,
        energy: 100,
        onBreak: false,
        breakTimeLeft: 0,
        x: 350,
        y: 205,
        targetX: 350,
        targetY: 205,
        busyText: 'جاهز بالفرع الجديد'
      });
      state.dmSatisfaction = Math.min(100, state.dmSatisfaction + 8);
      playSound('fanfare');
      showToast(`🎉 مبروك! تم افتتاح "${b.name}" بنجاح! يمكنك نقل المزيد من الموظفين إليه.`);
      updateHUD();
      renderBranchesTab();
      renderStaffTab();
      renderMissionsTab();
      return;
    }

    const upgBtn = e.target.closest('[data-branch-upgrade]');
    if (upgBtn) {
      const b = state.branches.find(item => item.id === upgBtn.getAttribute('data-branch-upgrade'));
      if (!b) return;
      const openCnt = b.openBranches || 1;
      const maxCnt = b.maxBranches || 15;
      if (openCnt >= maxCnt) {
        showToast(`✅ تم افتتاح جميع فروع ${b.name} (${maxCnt} فرعاً)!`);
        return;
      }
      const cost = Math.round(260 * Math.pow(1.35, Math.max(0, openCnt - 1)));
      if (state.money < cost) {
        showToast(`⚠️ تحتاج إلى $${cost} لفتح فرع جديد مع ${b.dmName}!`);
        playSound('angry');
        return;
      }
      state.money = +(state.money - cost).toFixed(2);
      b.openBranches = openCnt + 1;
      b.level += 1;
      b.dmSatisfaction = Math.min(100, (b.dmSatisfaction || 90) + 4);
      if (b.openBranches % 4 === 0) {
        b.requiredStaff = (b.requiredStaff || 2) + 1;
      }
      const newStoreName = (b.branchNames && b.branchNames[(b.openBranches - 1) % b.branchNames.length]) || `فرع رقم ${b.openBranches}`;
      playSound('fanfare');
      showToast(`🎉 تم افتتاح "${newStoreName}" في منطقة ${b.dmName}! (إجمالي الفروع: ${getTotalOpenBranchesCount()}/79)`);
      updateHUD();
      renderBranchesTab();
      renderOpsTab();
      renderMissionsTab();
      return;
    }

    const subStoreBtn = e.target.closest('[data-control-substore]');
    if (subStoreBtn) {
      const parts = (subStoreBtn.getAttribute('data-control-substore') || '').split('__');
      const b = state.branches.find(item => item.id === parts[0]);
      if (b && b.unlocked) {
        state.activeBranchId = b.id;
        state.activeSubStoreName = parts[1] || b.name;
        playSound('ding');
        showToast(`🎛️ انتقلت الآن للتحكم المباشر في "${state.activeSubStoreName}" (إشراف ${b.dmName})!`);
        updateHUD();
        renderBranchesTab();
        renderStaffTab();
        renderOpsTab();
      }
      return;
    }

    const switchBtn = e.target.closest('[data-branch-switch]');
    if (switchBtn) {
      const b = state.branches.find(item => item.id === switchBtn.getAttribute('data-branch-switch'));
      if (!b || !b.unlocked) return;
      state.activeBranchId = b.id;
      state.orders = [];
      state.selectedTicketId = null;
      spawnCustomerOrder('cafe');
      spawnCustomerOrder('drive_thru');
      playSound('ding');
      showToast(`🚀 انتقلت الآن لإدارة "${b.name}" مباشرة!`);
      updateHUD();
      renderBranchesTab();
      renderStaffTab();
      renderTicketsQueue();
      renderWorkbench();
    }
  });

  // Top HUD Controls
  document.getElementById('btnPause').addEventListener('click', () => {
    state.paused = !state.paused;
    const btn = document.getElementById('btnPause');
    btn.textContent = state.paused ? '▶️ استئناف' : '⏸️ إيقاف';
    showToast(state.paused ? '⏸️ تم إيقاف الوردية مؤقتاً' : '▶️ تم استئناف العمل في الفرع');
  });

  document.getElementById('btnSpeed1').addEventListener('click', () => {
    state.speed = 1;
    document.getElementById('btnSpeed1').className = 'px-2 py-1.5 rounded-lg text-xs font-bold bg-[#00704A] text-white border border-emerald-400 transition';
    document.getElementById('btnSpeed2').className = 'px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-600 transition';
  });

  document.getElementById('btnSpeed2').addEventListener('click', () => {
    state.speed = 2;
    document.getElementById('btnSpeed2').className = 'px-2 py-1.5 rounded-lg text-xs font-bold bg-[#00704A] text-white border border-emerald-400 transition';
    document.getElementById('btnSpeed1').className = 'px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-600 transition';
    showToast('⏩ سرعة اللعب الآن مضاعفة (2x)!');
  });

  document.getElementById('btnRushWave').addEventListener('click', () => {
    initAudio();
    spawnCustomerOrder('cafe');
    spawnCustomerOrder('drive_thru');
    spawnCustomerOrder('mobile');
    showToast('⚡ وصلت موجة ذروة جديدة إلى الصالة والدرايف ثرو والموبايل!');
  });

  document.getElementById('btnMute').addEventListener('click', () => {
    isMuted = !isMuted;
    document.getElementById('btnMute').textContent = isMuted ? '🔇' : '🔊';
  });

  // APK Modal & Standalone HTML Downloader
  const apkModal = document.getElementById('apkModal');
  document.getElementById('btnApkModal').addEventListener('click', () => apkModal.classList.remove('hidden'));
  document.getElementById('btnCloseApk').addEventListener('click', () => apkModal.classList.add('hidden'));
  document.getElementById('btnGotItApk').addEventListener('click', () => apkModal.classList.add('hidden'));
  document.getElementById('btnDownloadStandaloneHtml').addEventListener('click', () => {
    try {
      const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Starbucks_Empire_Simulator_Pro.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('⬇️ تم بدء تنزيل ملف اللعبة المستقل!');
    } catch (err) {
      showToast('✅ يمكنك حفظ الملف مباشرة أو استخدام حزمة الـ ZIP المرفقة!');
    }
  });

  // Help Modal
  const helpModal = document.getElementById('helpModal');
  document.getElementById('btnHelpModal').addEventListener('click', () => helpModal.classList.remove('hidden'));
  document.getElementById('btnCloseHelp').addEventListener('click', () => helpModal.classList.add('hidden'));
  document.getElementById('btnGotItHelp').addEventListener('click', () => helpModal.classList.add('hidden'));

  // Reset Modal
  const resetModal = document.getElementById('resetModal');
  document.getElementById('btnResetModal').addEventListener('click', () => resetModal.classList.remove('hidden'));
  document.getElementById('btnCancelReset').addEventListener('click', () => resetModal.classList.add('hidden'));
  document.getElementById('btnConfirmReset').addEventListener('click', () => {
    const keepCareer = state.sbc;
    const keepProfile = state.playerProfile;
    state = createInitialState();
    if (keepCareer) state.sbc = keepCareer;
    if (keepProfile) state.playerProfile = Object.assign({}, keepProfile, { onboardingDone: true });
    ensure500NetworkStaffAndMetadata();
    resetModal.classList.add('hidden');
    emit('game:reset', {});
    saveGameState();
    spawnCustomerOrder('cafe');
    spawnCustomerOrder('drive_thru');
    updateHUD();
    renderTicketsQueue();
    renderWorkbench();
    renderStaffTab();
    renderInboxTab();
    renderOpsTab();
    renderMenuTab();
    renderUpgradesTab();
    renderMissionsTab();
    renderBranchesTab();
    showToast('🔄 تمت إعادة ضبط اللعبة والبدء من اليوم الأول!');
  });

  window.addEventListener('resize', resizeCanvas);
}

// =========================================================================
// BOOTSTRAP ON LOAD
// =========================================================================
let mainIntervalId = null;


// =========================================================================
// V7 EXPANSION ENGINE: 75 BRANCHES, 500 UNIQUE STAFF, OPENING CAREER SCREEN,
// ROLE PERMISSIONS, PROMOTIONS, DEDUCTIONS, EMPLOYEE OF THE MONTH,
// OPERATING HOURS (7AM-12AM vs 24H DT), DELIVERY COMPLAINTS & 5 PERSONALITIES
// =========================================================================
const FIRST_NAMES_POOL = [
  'أحمد', 'محمد', 'عمر', 'يوسف', 'علي', 'خالد', 'طارق', 'كريم', 'مصطفى', 'محمود',
  'زياد', 'مروان', 'حسام', 'رامي', 'سيف', 'فارس', 'آدم', 'مازن', 'شريف', 'تامر',
  'أمير', 'باسم', 'وليد', 'أشرف', 'عمرو', 'هادي', 'نبيل', 'سامح', 'وائل', 'إسلام',
  'إيهاب', 'معتز', 'باهر', 'شادي', 'نديم', 'ياسين', 'حمزة', 'عادل', 'حازم', 'مدحت',
  'سارة', 'مريم', 'نور', 'ليلى', 'ندى', 'رنا', 'ياسمين', 'هاجر', 'سلمى', 'فريدة',
  'دينا', 'حبيبة', 'ملك', 'جنى', 'مايا', 'نهى', 'ريم', 'شيرين', 'هدى', 'إيمان',
  'آية', 'بسنت', 'روان', 'تقى', 'سمر', 'لبنى', 'يارا', 'نوران', 'ماهينور', 'جميلة',
  'فاطمة', 'عائشة', 'خلود', 'أسماء', 'نسمة', 'رضوى', 'داليا', 'غادة', 'عبير', 'منار'
];

const LAST_NAMES_POOL = [
  'المنشاوي', 'الشامي', 'الكيلاني', 'المنصور', 'عبد العزيز', 'النجار', 'الشاذلي', 'الشناوي', 'الدمرداش', 'الحسيني',
  'أبو سريع', 'السمان', 'حسانين', 'عبد المنعم', 'عبد الله', 'عاطف', 'شكري', 'زكي', 'سليم', 'الجندي',
  'الرفاعي', 'البدري', 'التهامي', 'الأنصاري', 'الفرماوي', 'السباعي', 'المغربي', 'الهواري', 'العشري', 'الزيات',
  'الصاوي', 'الغزالي', 'الحداد', 'المهدي', 'الفيومي', 'الأسيوطي', 'الطنطاوي', 'المحلاوي', 'الرشيدي', 'الدمياطي',
  'الشرقاوي', 'الغرباوي', 'البحيري', 'المنوفي', 'القليوبي', 'الجيزاوي', 'السكندري', 'السويسي', 'الإسماعيلي', 'البورسعيدي',
  'علام', 'شاهين', 'سرور', 'قنديل', 'مرسي', 'فهمي', 'رمزي', 'صدقي', 'لطفي', 'عزمي',
  'حلمي', 'صبري', 'شوقي', 'فوزي', 'مجدي', 'وجدي', 'رشدي', 'حمدي', 'فتحي', 'حجازي'
];

const CUSTOMER_PERSONALITIES = [
  {
    id: 'rushed',
    label: '⚡ مستعجل',
    badgeCls: 'bg-amber-950 text-amber-300 border-amber-500/60',
    patienceMult: 0.72,
    tipMult: 1.45,
    desc: 'زبون مستعجل جداً للعمل! إذا أنجزت طلبه بسرعة يمنحك بقشيشاً مضاعفاً.'
  },
  {
    id: 'calm',
    label: '😌 هادي',
    badgeCls: 'bg-emerald-950 text-emerald-300 border-emerald-500/60',
    patienceMult: 1.35,
    tipMult: 1.15,
    desc: 'زبون هادئ ومبتسم، يتمتع بصبر طويل ويرفع تقييم الفرع.'
  },
  {
    id: 'indecisive',
    label: '🤔 محتار',
    badgeCls: 'bg-purple-950 text-purple-300 border-purple-500/60',
    patienceMult: 1.10,
    tipMult: 1.30,
    desc: 'زبون محتار في اختيار النكهة والحليب — اضغط زر الاقتراح لترشيح مشروب وكسب +$3!'
  },
  {
    id: 'nervous',
    label: '😡 عصبي',
    badgeCls: 'bg-rose-950 text-rose-300 border-rose-500/60',
    patienceMult: 0.68,
    tipMult: 1.10,
    desc: 'زبون عصبي المزاج! أي تأخير يجعله يغضب فوراً ويرسل شكوى عالية الخطورة.'
  },
  {
    id: 'authority',
    label: '👑 صاحب سلطة VIP',
    badgeCls: 'bg-indigo-950 text-[#CBA258] border-[#CBA258]',
    patienceMult: 0.85,
    tipMult: 2.20,
    desc: 'شخصية هامة وصاحب سلطة! خدمته بإتقان ترفع رضا مدير المنطقة +4% والسمعة فوراً.'
  }
];

const HIGH_PEAK_BRANCHES_SET = new Set([
  'Nile City Cairo',
  'Arkan Plaza',
  'Cairo Festival City',
  'Korba Cairo',
  'Mall of Egypt-1',
  'San Stefano Mall Alexandria',
  'Water Way Cairo',
  'City Stars Cairo - 1',
  'Grand Egyptian Museum - GEM',
  'Emarat Masr Madinaty DT',
  'Point 90 Cairo',
  'Al Rehab Avenue',
  'Gamaet Eldewal',
  'Rest Cairo Alex Road (Drive-Thru)',
  'Almaza City Centre Cairo'
]);

const QUIET_BRANCHES_SET = new Set([
  'Al Nada Hospital',
  'Tahra Palace',
  'Gate Way',
  'Cairo Complex',
  'Starbucks – W51',
  'One Katamya',
  'Espana',
  'Smouha Lotus Stars Cairo',
  'Designia Mall',
  'The Yard Mall Cairo',
  'South Park Madinaty',
  'City Scape Mall',
  'Melanite Plaza October',
  'Raya Plaza Cairo',
  'Merryland',
  'Arabella Plaza Cairo',
  'Mivida BP',
  'Maadi Naser Street',
  'Green Plaza-Alex',
  'Immortal Alex'
]);

const ROLE_PERMISSIONS_META = {
  barista: {
    id: 'barista',
    title: '👨\u200D🍳 باريستا (Barista)',
    shortTitle: 'باريستا (Barista)',
    desc: 'مسؤول عن تحضير المشروبات الساخنة والباردة على بار Siren 3D، تسخين المخبوزات، ونظافة الصالة. قرارات التعيين والنقل والترقيات والخصومات تتطلب ترقيتك لمشرف أو مدير.',
    canCraft: true,
    canManageShift: false,
    canManageStoreHR: false
  },
  supervisor: {
    id: 'supervisor',
    title: '👔 مشرف وردية (Shift Supervisor)',
    shortTitle: 'مشرف وردية (SSV)',
    desc: 'مسؤول عن قيادة الشيفت، توزيع الباريستات على المحطات، منح فترات الراحة، حل شكاوى الصالة والدليفري، وتوقيع خصومات التأخير.',
    canCraft: true,
    canManageShift: true,
    canManageStoreHR: false
  },
  manager: {
    id: 'manager',
    title: '👑 مدير فرع (Store Manager)',
    shortTitle: 'مدير فرع (Store Manager)',
    desc: 'صلاحيات تنفيذية كاملة: التعيين، النقل بين الـ 75 فرعاً لتغطية الذروة، ترقية الموظفين، توقيع خصومات الغياب والتأخير، وتتويج الموظف المثالي للشهر.',
    canCraft: true,
    canManageShift: true,
    canManageStoreHR: true
  }
};

function is24HourBranch(storeName) {
  return /dt|drive|chill out|airport|toll|rest/i.test(storeName || '');
}

function getBranchHoursText(storeName) {
  return is24HourBranch(storeName)
    ? '🕒 يعمل 24 ساعة (Drive-Thru)'
    : '🕖 07:00 ص - 12:00 منتصف الليل';
}

function getBranchPeakMeta(storeName) {
  if (HIGH_PEAK_BRANCHES_SET.has(storeName)) {
    return { level: 'high', label: '🔥 ذروة عالية جداً (يحتاج دعم)', cls: 'bg-rose-950 text-rose-200 border-rose-500/70' };
  }
  if (QUIET_BRANCHES_SET.has(storeName)) {
    return { level: 'quiet', label: '🌿 فرع هادئ (يديره مشرف/مساعد)', cls: 'bg-emerald-950 text-emerald-200 border-emerald-600/60' };
  }
  return { level: 'normal', label: '⚡ تشغيل نشط منتظم', cls: 'bg-amber-950 text-amber-200 border-amber-500/60' };
}

// Generate all 75 branches metadata & exactly 500 uniquely named employees across the 75 branches
function ensure500NetworkStaffAndMetadata() {
  const allStores = [];
  state.branches.forEach(reg => {
    (reg.branchNames || []).forEach(sName => {
      allStores.push({ storeName: sName, regionId: reg.id, dmName: reg.dmName });
    });
  });

  // Build deterministic unique names generator
  let nameCursor = 0;
  function nextUniqueFullName() {
    const fn = FIRST_NAMES_POOL[nameCursor % FIRST_NAMES_POOL.length];
    const ln = LAST_NAMES_POOL[Math.floor(nameCursor / FIRST_NAMES_POOL.length) % LAST_NAMES_POOL.length];
    const middle = FIRST_NAMES_POOL[(nameCursor * 7 + 13) % FIRST_NAMES_POOL.length];
    nameCursor++;
    if (nameCursor > FIRST_NAMES_POOL.length * 4) {
      return `${fn} ${middle} ${ln}`;
    }
    return `${fn} ${ln}`;
  }

  if (!Array.isArray(state.allNetworkStaff) || state.allNetworkStaff.length !== 500) {
    const roster = [];
    let empId = 1000;

    // Distribute 500 staff across 75 branches:
    // First 15 stores -> 8 staff (120)
    // Next 20 stores -> 7 staff (140)
    // Remaining 40 stores -> 6 staff (240)
    // Total = 120 + 140 + 240 = 500 employees!
    allStores.forEach((st, idx) => {
      const count = idx < 15 ? 8 : idx < 35 ? 7 : 6;
      const isQuiet = QUIET_BRANCHES_SET.has(st.storeName) || idx >= 55;
      const stationCycle = ['flex', 'hot_bar', 'cold_bar', 'warming_dtr', 'cs', 'hot_bar', 'cold_bar', 'warming_dtr'];
      const shiftCycle = ['morning', 'peak', 'evening', 'morning', 'peak', 'evening', 'morning', 'peak'];

      for (let slot = 0; slot < count; slot++) {
        let jobTitle = 'باريستا معتمد (Barista)';
        let jobCode = 'barista';
        let level = 1 + (slot % 2);
        let speedMult = 1.12;

        if (slot === 0) {
          if (!isQuiet) {
            jobTitle = 'مدير فرع (Store Manager)';
            jobCode = 'store_manager';
            level = 4;
            speedMult = 1.42;
          } else {
            jobTitle = 'مساعد مدير قائد فرع (ASM Lead)';
            jobCode = 'assistant_manager';
            level = 3;
            speedMult = 1.32;
          }
        } else if (slot === 1) {
          if (!isQuiet && idx < 50) {
            jobTitle = 'مساعد مدير فرع (Assistant Manager)';
            jobCode = 'assistant_manager';
            level = 3;
            speedMult = 1.30;
          } else {
            jobTitle = 'مشرف وردية أول (Shift Supervisor)';
            jobCode = 'shift_supervisor';
            level = 3;
            speedMult = 1.26;
          }
        } else if (slot === 2 || (slot === 3 && !isQuiet && idx < 50)) {
          jobTitle = 'مشرف وردية (Shift Supervisor)';
          jobCode = 'shift_supervisor';
          level = 2;
          speedMult = 1.24;
        } else if (slot === count - 1) {
          jobTitle = 'باريستا دليفري ودعم (Delivery Barista)';
          jobCode = 'barista_delivery';
          level = 1;
          speedMult = 1.15;
        } else {
          jobTitle = 'باريستا معتمد (Barista)';
          jobCode = 'barista';
          level = 1 + (idx % 2);
          speedMult = +(1.10 + (slot * 0.04)).toFixed(2);
        }

        const fullName = nextUniqueFullName();
        roster.push({
          id: ++empId,
          name: `${fullName} (${jobTitle.split('(')[0].trim()})`,
          cleanName: fullName,
          jobTitle,
          jobCode,
          branchId: st.regionId,
          storeName: st.storeName,
          shift: shiftCycle[slot % shiftCycle.length],
          sickLeave: false,
          lateMinutes: (empId % 19 === 0) ? 25 : 0,
          absentToday: (empId % 37 === 0),
          deductionsCount: 0,
          role: stationCycle[slot % stationCycle.length],
          level,
          speedMult,
          energy: 86 + (slot * 2) % 14,
          onBreak: false,
          breakTimeLeft: 0,
          x: 240 + (slot * 78) % 580,
          y: 205,
          targetX: 240 + (slot * 78) % 580,
          targetY: 205,
          busyText: slot === 0 ? '👑 إشراف الفرع والبار' : slot <= 2 ? '👔 قيادة الشيفت والبار' : '☕ جاهز على المحطة'
        });
      }
    });

    state.allNetworkStaff = roster;
  }

  if (!state.playerProfile) {
    state.playerProfile = {
      name: 'أحمد المنشاوي',
      role: 'manager',
      onboardingDone: false
    };
  }

  if (!state.employeeOfMonth) {
    const firstSup = state.allNetworkStaff[0];
    state.employeeOfMonth = {
      id: firstSup.id,
      name: firstSup.name,
      storeName: firstSup.storeName,
      score: 99
    };
  }

  if (!Array.isArray(state.disciplinaryCases) || state.disciplinaryCases.length === 0) {
    state.disciplinaryCases = [
      {
        id: 9501,
        staffId: state.allNetworkStaff[4].id,
        staffName: state.allNetworkStaff[4].name,
        storeName: state.allNetworkStaff[4].storeName,
        type: 'late',
        reason: 'تأخير 30 دقيقة عن بداية وردية الصباح (07:00 ص) بدون إخطار مسبق.',
        resolved: false,
        actionTaken: ''
      },
      {
        id: 9502,
        staffId: state.allNetworkStaff[11].id,
        staffName: state.allNetworkStaff[11].name,
        storeName: state.allNetworkStaff[11].storeName,
        type: 'absent',
        reason: 'غياب عن وردية الذروة بدون إذن مسبق مما تسبب في ضغط على البار.',
        resolved: false,
        actionTaken: ''
      }
    ];
  }

  if (!Array.isArray(state.deliveryComplaints) || state.deliveryComplaints.length === 0) {
    state.deliveryComplaints = [
      {
        id: 9601,
        platform: 'طلبات (Talabat) 🛵',
        customerName: 'د. مروان الشاذلي',
        branchName: state.activeSubStoreName || 'Nile City Cairo',
        orderItems: '2 دبل شوت مثلج وايت موكا + 1 كرواسون زبدة',
        issue: 'انسكاب جزء من المشروب داخل كيس الدليفري بسبب عدم إحكام الغطاء الحراري وتأخر الطيار 14 دقيقة.',
        resolved: false,
        compCost: 12
      },
      {
        id: 9602,
        platform: 'ستاربكس دليفري (Starbucks App) 📱',
        customerName: 'المستشارة نهال الحسيني',
        branchName: state.activeSubStoreName || 'Nile City Cairo',
        orderItems: '1 كراميل ماكياتو ساخن Venti + ساندويتش ديك رومي',
        issue: 'وصول المشروب الساخن بارداً ونسيان مناديل المائدة والسكر البني في الحقيبة.',
        resolved: false,
        compCost: 10
      }
    ];
  }

  if (state.thermalSealEnabled === undefined) {
    state.thermalSealEnabled = true;
  }
  if (!state.storeAmbience) {
    state.storeAmbience = 'morning_jazz';
  }
  if (!state.staffViewFilter) {
    state.staffViewFilter = 'branch';
  }

  syncActiveStoreStaffIntoState();
}

// Sync the 6 to 8 employees of the currently active sub-store into `state.staff` so the 3D Canvas & Barista AI animate all 6-8 staff live!
function syncActiveStoreStaffIntoState() {
  if (!Array.isArray(state.allNetworkStaff)) return;
  const curStore = state.activeSubStoreName || 'Nile City Cairo';
  const storeTeam = state.allNetworkStaff.filter(s => s.storeName === curStore);
  if (storeTeam.length > 0) {
    state.staff = storeTeam;
  }
}

function checkRolePermission(requiredLevel, actionTitle) {
  const curRole = (state.playerProfile && state.playerProfile.role) || 'manager';
  if (curRole === 'manager') return true;
  if (curRole === 'supervisor' && requiredLevel === 'supervisor') return true;

  const neededText = requiredLevel === 'manager' ? '👑 مدير فرع (Store Manager)' : '👔 مشرف وردية (Shift Supervisor) أو مدير فرع';
  showToast(`🔒 صلاحية "${actionTitle}" تتطلب مسمى وظيفي: ${neededText}! يمكنك ترقية مسماك الوظيفي من البطاقة العلوية.`);
  playSound('angry');
  return false;
}

function getUniqueCustomerName() {
  state._custNameIdx = ((state._custNameIdx || 17) + 1) % (FIRST_NAMES_POOL.length * LAST_NAMES_POOL.length);
  const fn = FIRST_NAMES_POOL[state._custNameIdx % FIRST_NAMES_POOL.length];
  const ln = LAST_NAMES_POOL[(state._custNameIdx * 3 + 5) % LAST_NAMES_POOL.length];
  return `${fn} ${ln}`;
}

function renderOpeningModalBranches() {
  const grid = document.getElementById('openingBranchesGrid');
  if (!grid) return;
  const q = (document.getElementById('openingBranchSearch')?.value || '').trim().toLowerCase();
  const filter = state._openingFilter || 'all';
  const selectedStore = state.activeSubStoreName || 'Nile City Cairo';

  const cards = [];
  state.branches.forEach(reg => {
    (reg.branchNames || []).forEach(sName => {
      const is24 = is24HourBranch(sName);
      const peakMeta = getBranchPeakMeta(sName);
      if (filter === 'peak' && peakMeta.level !== 'high') return;
      if (filter === '24h' && !is24) return;
      if (filter === 'quiet' && peakMeta.level !== 'quiet') return;
      if (q && !sName.toLowerCase().includes(q) && !reg.dmName.toLowerCase().includes(q)) return;

      const team = (state.allNetworkStaff || []).filter(s => s.storeName === sName);
      const leader = team[0];
      const isSelected = sName === selectedStore;

      cards.push(`
        <div data-pick-opening-store="${reg.id}__${sName}" class="cursor-pointer rounded-xl p-2.5 border transition ${
          isSelected
            ? 'bg-[#00704A]/45 border-2 border-[#CBA258] shadow-lg'
            : 'bg-[#0b1915]/95 hover:bg-emerald-950/70 border-emerald-800/70'
        }">
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="text-xs font-extrabold text-white truncate">${is24 ? '🚗' : '🏪'} ${sName}</span>
            <span class="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-950 text-[#CBA258] border border-[#CBA258]/40 shrink-0">👥 ${team.length} موظفين</span>
          </div>
          <div class="flex flex-wrap items-center gap-1 mb-1">
            <span class="text-[9.5px] px-1.5 py-0.2 rounded border ${peakMeta.cls}">${peakMeta.label}</span>
            <span class="text-[9.5px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-200 border border-sky-700/50">${is24 ? '🕒 24 ساعة' : '🕖 7ص - 12ص'}</span>
          </div>
          <div class="text-[10px] text-slate-300 truncate">
            ${leader ? leader.name : '👑 مدير محل'} • إشراف ${reg.dmName}
          </div>
        </div>
      `);
    });
  });

  grid.innerHTML = cards.join('') || `<div class="col-span-3 text-center py-6 text-xs text-slate-400">لا توجد فروع مطابقة للبحث.</div>`;
  updateOpeningSummaryText();
}

function updateOpeningSummaryText() {
  const sumEl = document.getElementById('openingSelectionSummary');
  if (!sumEl) return;
  const roleKey = (state.playerProfile && state.playerProfile.role) || 'manager';
  const roleMeta = ROLE_PERMISSIONS_META[roleKey] || ROLE_PERMISSIONS_META.manager;
  const sName = state.activeSubStoreName || 'Nile City Cairo';
  const hrs = getBranchHoursText(sName);
  sumEl.innerHTML = `📍 الفرع المختار: <strong class="text-white">${sName}</strong> (${hrs}) • المسمى الوظيفي: <strong class="text-[#CBA258]">${roleMeta.title}</strong>`;
}

function renderQuickRadarModal() {
  const grid = document.getElementById('quickRadarGrid');
  if (!grid) return;
  const cards = [];
  state.branches.forEach(reg => {
    (reg.branchNames || []).forEach(sName => {
      const team = (state.allNetworkStaff || []).filter(s => s.storeName === sName);
      const is24 = is24HourBranch(sName);
      const peakMeta = getBranchPeakMeta(sName);
      const isCur = state.activeSubStoreName === sName;

      cards.push(`
        <div class="rounded-xl p-2.5 bg-[#0b1915] border ${isCur ? 'border-2 border-[#CBA258]' : 'border-emerald-800/70'} flex flex-col justify-between gap-2">
          <div>
            <div class="flex items-center justify-between gap-1">
              <span class="text-xs font-extrabold text-white truncate">${is24 ? '🚗' : '🏪'} ${sName}</span>
              <span class="text-[10px] font-num font-bold text-amber-300">👥 ${team.length} موظفين</span>
            </div>
            <div class="flex flex-wrap gap-1 mt-1">
              <span class="text-[9.5px] px-1.5 py-0.2 rounded border ${peakMeta.cls}">${peakMeta.label}</span>
              <span class="text-[9.5px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-200">${is24 ? '24 ساعة DT' : '7 ص - 12 ص'}</span>
            </div>
          </div>
          <div class="flex items-center justify-between gap-1.5 pt-1 border-t border-emerald-900/50">
            <button data-radar-jump="${reg.id}__${sName}" class="flex-1 py-1 rounded-lg text-[10px] font-extrabold ${isCur ? 'bg-[#CBA258] text-slate-950' : 'bg-emerald-800 hover:bg-emerald-700 text-white'}">
              ${isCur ? '✅ الفرع الحالي' : '🚀 انتقل للفرع'}
            </button>
            ${peakMeta.level === 'high' ? `
              <button data-radar-support="${reg.id}__${sName}" class="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-rose-700 hover:bg-rose-600 text-white" title="نقل باريستا دعم فوري لهذا الفرع">
                ➕ دعم ذروة
              </button>
            ` : ''}
          </div>
        </div>
      `);
    });
  });
  grid.innerHTML = cards.join('');
}

function renderV7Enhancements() {
  ensure500NetworkStaffAndMetadata();

  const curStore = state.activeSubStoreName || 'Nile City Cairo';
  const hrsText = getBranchHoursText(curStore);
  const peakMeta = getBranchPeakMeta(curStore);
  const roleKey = (state.playerProfile && state.playerProfile.role) || 'manager';
  const roleMeta = ROLE_PERMISSIONS_META[roleKey] || ROLE_PERMISSIONS_META.manager;

  // Top HUD Role, Hours, Peak, and 500-Staff Badges
  const roleBadge = document.getElementById('hudRoleBadgeText');
  if (roleBadge) roleBadge.textContent = `${state.playerProfile.name || 'مدير'} — ${roleMeta.shortTitle}`;

  const hrsBadge = document.getElementById('hudBranchHoursBadge');
  if (hrsBadge) hrsBadge.textContent = hrsText;

  const peakBadge = document.getElementById('hudBranchPeakBadge');
  if (peakBadge) {
    peakBadge.textContent = peakMeta.label;
    peakBadge.className = `text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${peakMeta.cls}`;
  }

  const totalStaffEl = document.getElementById('hudTotalNetworkStaff');
  if (totalStaffEl) totalStaffEl.textContent = (state.allNetworkStaff || []).length;

  const storeTeam = (state.allNetworkStaff || []).filter(s => s.storeName === curStore);
  const leader = storeTeam[0];
  const mgrBadge = document.getElementById('hudBranchManagerTypeBadge');
  if (mgrBadge && leader) {
    mgrBadge.textContent = `👤 يقود الفرع: ${leader.name} (${storeTeam.length} موظفين بالفرع)`;
  }

  const brTotalEl = document.getElementById('hudBranchesTotal');
  if (brTotalEl) brTotalEl.textContent = `75 / 75 فرعاً`;

  // Update Role & Permissions Box in Staff Tab
  const roleTitleBox = document.getElementById('playerRoleTitleBox');
  const roleDescBox = document.getElementById('playerRolePermsDesc');
  if (roleTitleBox) roleTitleBox.textContent = `${roleMeta.title} — ${state.playerProfile.name}`;
  if (roleDescBox) roleDescBox.textContent = roleMeta.desc;

  // Update 500-Staff Breakdown Counters
  const allStaff = state.allNetworkStaff || [];
  const smCnt = allStaff.filter(s => s.jobCode === 'store_manager').length;
  const asmCnt = allStaff.filter(s => s.jobCode === 'assistant_manager').length;
  const ssvCnt = allStaff.filter(s => s.jobCode === 'shift_supervisor').length;
  const barCnt = allStaff.filter(s => s.jobCode === 'barista' || s.jobCode === 'barista_delivery').length;

  const el500 = document.getElementById('staffTabTotal500');
  if (el500) el500.textContent = allStaff.length;
  const elSM = document.getElementById('staffTabSMCount');
  if (elSM) elSM.textContent = smCnt;
  const elASM = document.getElementById('staffTabASMCount');
  if (elASM) elASM.textContent = asmCnt;
  const elSSV = document.getElementById('staffTabSSVCount');
  if (elSSV) elSSV.textContent = ssvCnt;
  const elBar = document.getElementById('staffTabBaristaCount');
  if (elBar) elBar.textContent = barCnt;

  const rosterSum = document.getElementById('activeBranchRosterSummary');
  if (rosterSum) {
    rosterSum.textContent = `📍 طاقم فرع ${curStore}: ${storeTeam.length} موظفين (مدير/مساعد + 2 مشرف وردية + باريستات)`;
  }

  // Employee of the Month Showcase
  if (state.employeeOfMonth) {
    const eName = document.getElementById('eotmName');
    const eBranch = document.getElementById('eotmBranch');
    if (eName) eName.textContent = state.employeeOfMonth.name;
    if (eBranch) eBranch.textContent = `فرع ${state.employeeOfMonth.storeName} • تقييم الأداء: ${state.employeeOfMonth.score}%`;
  }

  // Disciplinary & Attendance Cases (خصومات التأخير والغياب)
  const discContainer = document.getElementById('disciplinaryCasesContainer');
  if (discContainer) {
    setHtml(discContainer, (state.disciplinaryCases || []).map(dc => `
      <div class="p-2 rounded-xl bg-slate-900/95 border ${dc.resolved ? 'border-emerald-700/50 opacity-75' : 'border-amber-500/80'} flex flex-wrap items-center justify-between gap-2 text-xs">
        <div>
          <div class="font-extrabold text-white">
            ${dc.type === 'absent' ? '🚫 غياب بدون إذن:' : '⏱️ تأخير عن الوردية:'} ${dc.staffName}
            <span class="text-[10px] text-amber-300">(${dc.storeName})</span>
          </div>
          <div class="text-[10px] text-slate-300">${dc.reason}</div>
        </div>
        <div class="flex flex-wrap gap-1">
          ${dc.resolved
            ? `<span class="text-[10px] font-bold text-emerald-400">✅ ${dc.actionTaken}</span>`
            : `
              <button data-disc-action="deduct_late" data-disc-id="${dc.id}" class="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-amber-600 hover:bg-amber-500 text-slate-950">
                ⏱️ خصم تأخير (ربع يوم)
              </button>
              <button data-disc-action="deduct_absent" data-disc-id="${dc.id}" class="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-rose-700 hover:bg-rose-600 text-white">
                🚫 خصم غياب (يوم كامل)
              </button>
              <button data-disc-action="pardon" data-disc-id="${dc.id}" class="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-slate-800 hover:bg-slate-700 text-slate-200">
                🤝 قبول عذر
              </button>
            `
          }
        </div>
      </div>
    `).join(''));
  }

  // Delivery Complaints Hub
  const delivContainer = document.getElementById('deliveryComplaintsContainer');
  if (delivContainer) {
    setHtml(delivContainer, (state.deliveryComplaints || []).map(dc => `
      <div class="p-2.5 rounded-xl bg-slate-900/95 border ${dc.resolved ? 'border-emerald-700/50 opacity-75' : 'border-orange-500/80'} space-y-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs font-extrabold text-white">
            <span class="px-2 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-500/40 text-[10px]">${dc.platform}</span>
            <span>العميل: ${dc.customerName}</span>
            <span class="text-[10px] text-amber-300">(${dc.branchName})</span>
          </div>
          ${dc.resolved
            ? `<span class="text-[11px] font-bold text-emerald-400">✅ تم تعويض عميل الدليفري وإرسال البديل</span>`
            : `<button data-resolve-delivery="${dc.id}" class="px-3 py-1 rounded-xl text-[11px] font-extrabold sb-btn-gold shadow">
                🛵 إرسال مشروب بديل مع طيار خاص (-$${dc.compCost})
              </button>`
          }
        </div>
        <div class="text-[11px] text-amber-200 font-bold">📦 الطلب: ${dc.orderItems}</div>
        <div class="text-[11px] text-slate-200 bg-black/30 p-1.5 rounded-lg">💬 شكوى الدليفري: "${dc.issue}"</div>
      </div>
    `).join(''));
  }
}

// Override Staff List Renderer when filtering 500 staff or showing promotions/deductions buttons on each staff member
const _origRenderStaffTab = renderStaffTab;
renderStaffTab = function () {
  ensure500NetworkStaffAndMetadata();
  _origRenderStaffTab();
  renderV7Enhancements();

  const container = document.getElementById('staffListContainer');
  if (!container) return;

  const filterMode = state.staffViewFilter || 'branch';
  const searchQ = (document.getElementById('staffSearchInput500')?.value || '').trim().toLowerCase();
  const curStore = state.activeSubStoreName || 'Nile City Cairo';

  let list = state.allNetworkStaff || state.staff;
  if (filterMode === 'branch' && !searchQ) {
    list = list.filter(s => s.storeName === curStore);
  } else if (filterMode === 'supervisors') {
    list = list.filter(s => s.jobCode !== 'barista' && s.jobCode !== 'barista_delivery');
  }
  if (searchQ) {
    list = list.filter(s =>
      s.name.toLowerCase().includes(searchQ) ||
      (s.storeName || '').toLowerCase().includes(searchQ) ||
      (s.jobTitle || '').toLowerCase().includes(searchQ)
    );
  }

  const displayList = list.slice(0, 45);
  const allStoreNames = [];
  state.branches.forEach(reg => {
    (reg.branchNames || []).forEach(sn => allStoreNames.push({ regionId: reg.id, storeName: sn }));
  });

  container.innerHTML = displayList.map(b => {
    const trainCost = b.level * 120;
    const energyPct = Math.round(b.energy ?? 90);
    const energyColor = energyPct > 55 ? 'bg-emerald-400' : energyPct > 30 ? 'bg-amber-400' : 'bg-rose-500';
    const roleOptions = STATION_ROLES.map(r =>
      `<option value="${r.id}" ${b.role === r.id ? 'selected' : ''}>${r.label}</option>`
    ).join('');

    const storeOptions = allStoreNames.map(st =>
      `<option value="${st.regionId}__${st.storeName}" ${b.storeName === st.storeName ? 'selected' : ''}>📍 ${st.storeName}</option>`
    ).join('');

    return `
      <div class="bg-[#0b1915] border ${energyPct < 30 ? 'border-rose-500' : 'border-emerald-800/70'} rounded-xl p-3 space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-full ${b.onBreak ? 'bg-purple-900 border-purple-400' : 'bg-[#00704A] border-[#CBA258]'} border flex items-center justify-center text-lg">
              ${b.jobCode === 'store_manager' ? '👑' : b.jobCode === 'assistant_manager' || b.jobCode === 'shift_supervisor' ? '👔' : '👨\u200D🍳'}
            </div>
            <div>
              <div class="text-xs font-extrabold text-white flex flex-wrap items-center gap-1.5">
                <span>${b.name}</span>
                <span class="text-[#CBA258] font-num">(مستوى ${b.level})</span>
                <span class="text-[10px] px-2 py-0.2 rounded bg-emerald-950 text-amber-300 border border-[#CBA258]/40">🏪 ${b.storeName}</span>
              </div>
              <div class="text-[11px] text-emerald-300/85">
                السرعة: <strong class="font-num">${Math.round(b.speedMult * 100)}%</strong> • الحالة: <strong class="text-amber-200">${b.busyText}</strong>
                ${b.deductionsCount > 0 ? ` • <span class="text-rose-400 font-bold">خصومات: ${b.deductionsCount}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-1">
            <button data-staff-break="${b.id}" ${b.onBreak ? 'disabled' : ''} class="px-2 py-1 rounded-lg text-[10px] font-extrabold ${
              b.onBreak ? 'bg-purple-950 text-purple-300 opacity-70' : 'bg-amber-600 hover:bg-amber-500 text-slate-950'
            } transition">
              ${b.onBreak ? `🛋️ يستريح (${b.breakTimeLeft}ث)` : '☕ راحة'}
            </button>
            <button data-staff-train="${b.id}" class="px-2 py-1 rounded-lg text-[10px] font-extrabold sb-btn-primary text-white">
              ⬆️ تدريب ($${trainCost})
            </button>
            <button data-staff-promote="${b.id}" class="px-2 py-1 rounded-lg text-[10px] font-extrabold sb-btn-gold" title="ترقية المسمى الوظيفي للموظف">
              🎖️ ترقية ($90)
            </button>
            <button data-staff-deduct="${b.id}" class="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-rose-900 hover:bg-rose-800 text-rose-100 border border-rose-500/50" title="توقيع خصم تأخير أو غياب">
              ⚠️ خصم
            </button>
          </div>
        </div>

        <!-- Energy Bar -->
        <div>
          <div class="flex justify-between text-[10px] font-bold mb-0.5">
            <span>⚡ طاقة وتركيز الموظف:</span>
            <span class="font-num ${energyPct < 30 ? 'text-rose-400' : 'text-emerald-300'}">${energyPct}%</span>
          </div>
          <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full ${energyColor} transition-all duration-300" style="width:${energyPct}%"></div>
          </div>
        </div>

        <!-- Station Role & Direct 75-Store Transfer -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <div>
            <label class="block text-[10px] text-emerald-300/80 mb-0.5">تخصيص المحطة داخل الفرع:</label>
            <select data-staff-role="${b.id}" class="w-full bg-slate-900 border border-emerald-600/60 text-white text-[11px] font-bold rounded-lg px-2 py-1">
              ${roleOptions}
            </select>
          </div>
          <div>
            <label class="block text-[10px] text-amber-300/90 mb-0.5">🔄 نقل الموظف لأي فرع من الـ 75 فرعاً:</label>
            <select data-staff-store-transfer="${b.id}" class="w-full bg-slate-900 border border-[#CBA258]/60 text-amber-200 text-[11px] font-bold rounded-lg px-2 py-1">
              ${storeOptions}
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

// Enhance spawnCustomerOrder to attach unique customer names & 5 distinct personalities
const _origSpawnCustomerOrder = spawnCustomerOrder;
spawnCustomerOrder = function (forcedChannel) {
  const prevLen = state.orders.length;
  _origSpawnCustomerOrder(forcedChannel);
  if (state.orders.length > prevLen) {
    const newest = state.orders[state.orders.length - 1];
    newest.customerName = getUniqueCustomerName();
    const pers = CUSTOMER_PERSONALITIES[newest.id % CUSTOMER_PERSONALITIES.length];
    newest.personalityId = pers.id;
    newest.personalityLabel = pers.label;
    newest.personalityBadgeCls = pers.badgeCls;
    newest.personalityDesc = pers.desc;
    newest.maxTime = Math.max(18, Math.round(newest.maxTime * pers.patienceMult));
    newest.timeLeft = newest.maxTime;
    newest.price = +(newest.price * pers.tipMult).toFixed(2);
    newest.customerName = `${newest.customerName} (${pers.label})`;
    renderTicketsQueue();
    renderWorkbench();
  }
};

// Enhance renderWorkbench to update the Customer Personality bar
const _origRenderWorkbench = renderWorkbench;
renderWorkbench = function () {
  _origRenderWorkbench();
  const order = state.orders.find(o => o.id === state.selectedTicketId) || state.orders[0];
  const badgeEl = document.getElementById('wbPersonalityBadge');
  const descEl = document.getElementById('wbPersonalityDesc');
  if (order && badgeEl && descEl) {
    badgeEl.textContent = order.personalityLabel || '😌 هادي';
    badgeEl.className = `px-2 py-0.5 rounded font-extrabold border ${order.personalityBadgeCls || 'bg-emerald-950 text-emerald-300 border-emerald-500/60'}`;
    descEl.textContent = order.personalityDesc || 'زبون يطلب قهوة طازجة.';
  }
};

// Hook into updateHUD to keep all v7 badges synced
const _origUpdateHUD = updateHUD;
updateHUD = function () {
  ensure500NetworkStaffAndMetadata();
  _origUpdateHUD();
  renderV7Enhancements();
};

function setupV7EventListeners() {
  ensure500NetworkStaffAndMetadata();
  renderOpeningModalBranches();

  // Role selection cards in Opening Modal
  document.getElementById('roleCardsContainer')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-select-role]');
    if (!card) return;
    initAudio();
    const roleKey = card.getAttribute('data-select-role');
    if (hooks.canSelectRole && !hooks.canSelectRole(roleKey)) {
      playSound('angry');
      return;
    }
    state.playerProfile.role = roleKey;
    document.querySelectorAll('.role-choice-card').forEach(c => {
      const isSel = c.getAttribute('data-select-role') === roleKey;
      c.className = isSel
        ? 'role-choice-card cursor-pointer rounded-2xl p-3.5 bg-[#16382d] border-2 border-[#CBA258] shadow-lg transition'
        : 'role-choice-card cursor-pointer rounded-2xl p-3.5 bg-[#0b1915] border-2 border-emerald-800/70 hover:border-[#CBA258] transition';
    });
    playSound('step');
    updateOpeningSummaryText();
  });

  // Opening Modal Filter Buttons
  document.querySelectorAll('.open-branch-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      state._openingFilter = btn.getAttribute('data-open-filter');
      renderOpeningModalBranches();
    });
  });

  document.getElementById('openingBranchSearch')?.addEventListener('input', () => {
    renderOpeningModalBranches();
  });

  // Pick branch in Opening Modal
  document.getElementById('openingBranchesGrid')?.addEventListener('click', (e) => {
    const card = e.target.closest('[data-pick-opening-store]');
    if (!card) return;
    initAudio();
    const [regId, sName] = (card.getAttribute('data-pick-opening-store') || '').split('__');
    if (regId && sName) {
      state.activeBranchId = regId;
      state.activeSubStoreName = sName;
      syncActiveStoreStaffIntoState();
      playSound('step');
      renderOpeningModalBranches();
    }
  });

  // Start Career Button in Opening Modal
  const closeOpeningAndStart = () => {
    initAudio();
    const nameInput = document.getElementById('inputPlayerName');
    const registeredName = hooks.playerName ? hooks.playerName() : '';
    if (registeredName) {
      state.playerProfile.name = registeredName;
    } else if (nameInput && nameInput.value.trim()) {
      state.playerProfile.name = nameInput.value.trim();
    }
    state.playerProfile.onboardingDone = true;
    emit('onboarding:done', { role: state.playerProfile.role, store: state.activeSubStoreName });
    syncActiveStoreStaffIntoState();
    document.getElementById('openingScreenModal')?.classList.add('hidden');
    playSound('fanfare');
    const roleMeta = ROLE_PERMISSIONS_META[state.playerProfile.role] || ROLE_PERMISSIONS_META.manager;
    showToast(`🎉 أهلاً بك يا "${state.playerProfile.name}" (${roleMeta.shortTitle}) في فرع ${state.activeSubStoreName}!`);
    updateHUD();
    renderStaffTab();
    renderBranchesTab();
    renderOpsTab();
  };

  document.getElementById('btnStartCareerNow')?.addEventListener('click', closeOpeningAndStart);
  document.getElementById('btnCloseOpeningModalQuick')?.addEventListener('click', closeOpeningAndStart);

  // Reopen Opening Modal anytime from HUD
  document.getElementById('btnOpenCareerModal')?.addEventListener('click', () => {
    initAudio();
    renderOpeningModalBranches();
    document.getElementById('openingScreenModal')?.classList.remove('hidden');
  });

  // Quick 75-Branch Radar Modal
  const radarModal = document.getElementById('quickRadarModal');
  document.getElementById('btnQuickBranchRadar')?.addEventListener('click', () => {
    initAudio();
    renderQuickRadarModal();
    radarModal?.classList.remove('hidden');
  });
  document.getElementById('btnCloseQuickRadar')?.addEventListener('click', () => {
    radarModal?.classList.add('hidden');
  });

  document.getElementById('quickRadarGrid')?.addEventListener('click', (e) => {
    const jumpBtn = e.target.closest('[data-radar-jump]');
    if (jumpBtn) {
      initAudio();
      const [regId, sName] = (jumpBtn.getAttribute('data-radar-jump') || '').split('__');
      state.activeBranchId = regId;
      state.activeSubStoreName = sName;
      syncActiveStoreStaffIntoState();
      radarModal?.classList.add('hidden');
      playSound('ding');
      showToast(`🚀 انتقلت فوراً إلى فرع "${sName}" (${getBranchHoursText(sName)})!`);
      updateHUD();
      renderStaffTab();
      renderBranchesTab();
      renderOpsTab();
      return;
    }

    const supBtn = e.target.closest('[data-radar-support]');
    if (supBtn) {
      initAudio();
      if (!checkRolePermission('manager', 'نقل وتعيين موظفي دعم بين الفروع')) return;
      const [regId, sName] = (supBtn.getAttribute('data-radar-support') || '').split('__');
      const donor = (state.allNetworkStaff || []).find(s => s.storeName !== sName && s.jobCode === 'barista');
      if (donor) {
        donor.branchId = regId;
        donor.storeName = sName;
        syncActiveStoreStaffIntoState();
        playSound('fanfare');
        showToast(`🔄 تم نقل "${donor.name}" لدعم الذروة العالية في فرع ${sName}!`);
        renderQuickRadarModal();
        updateHUD();
        renderStaffTab();
      }
    }
  });

  // Open-World Controls: Ambience, Coffee Tasting, Viral Trend, Delivery Order
  document.getElementById('selectStoreAmbience')?.addEventListener('change', (e) => {
    initAudio();
    state.storeAmbience = e.target.value;
    const b = getActiveBranch();
    if (state.storeAmbience === 'morning_jazz') b.floorColor = '#17382e';
    else if (state.storeAmbience === 'cozy_sunset') b.floorColor = '#2c1d14';
    else if (state.storeAmbience === 'night_neon') b.floorColor = '#111b30';
    else if (state.storeAmbience === 'vip_roastery') b.floorColor = '#291f12';
    state.reputation = Math.min(100, +(state.reputation + 1.0).toFixed(1));
    playSound('ding');
    showToast('🎶 تم تغيير أجواء وإضاءة وموسيقى الفرع بنجاح! الزبائن مستمتعون بالأجواء.');
    updateHUD();
  });

  document.getElementById('btnHostCoffeeTasting')?.addEventListener('click', () => {
    initAudio();
    if (state.money < 30) {
      showToast('⚠️ تحتاج إلى $30 لتنظيم جلسة تذوق القهوة للزبائن!');
      return;
    }
    state.money = +(state.money - 30).toFixed(2);
    state.reputation = Math.min(100, +(state.reputation + 3.0).toFixed(1));
    state.dmSatisfaction = Math.min(100, +(state.dmSatisfaction + 3.0).toFixed(1));
    state.orders.forEach(o => { o.timeLeft = Math.min(o.maxTime, o.timeLeft + 14); });
    emit('tasting', {});
    playSound('fanfare');
    spawnSparkles(480, 340, '#CBA258');
    showToast('☕ أقمت فعالية تذوق قهوة (Coffee Tasting) في الصالة! زاد صبر الزبائن وارتفعت سمعة الفرع.');
    updateHUD();
    renderTicketsQueue();
  });

  document.getElementById('btnLaunchViralDrink')?.addEventListener('click', () => {
    initAudio();
    if (state.money < 45) {
      showToast('⚠️ تحتاج إلى $45 لإطلاق حملة المشروب السري على السوشيال ميديا!');
      return;
    }
    state.money = +(state.money + 65).toFixed(2); // Net +$65 viral rush sales
    spawnCustomerOrder('mobile');
    spawnCustomerOrder('delivery');
    playSound('fanfare');
    showToast('📱 ترند المشروب السري انتشر على تيك توك وإنستغرام! تدفقت طلبات الموبايل والدليفري (+65$ أرباح فورية)!');
    updateHUD();
  });

  document.getElementById('btnCallDeliveryOrder')?.addEventListener('click', () => {
    initAudio();
    spawnCustomerOrder('delivery');
    playSound('ding');
    showToast('🛵 وصل طيار دليفري جديد لاستلام طلب توصيل من الفرع!');
  });

  // Customer Personality Special Action Button on Workbench
  document.getElementById('btnCustomerSpecialAction')?.addEventListener('click', () => {
    initAudio();
    const order = state.orders.find(o => o.id === state.selectedTicketId) || state.orders[0];
    if (!order) {
      showToast('⏳ اختر تيكت زبون أولاً للتفاعل معه!');
      return;
    }
    if (order.specialDone) {
      showToast('✅ قمت بالترحيب بهذا الزبون وتقديم الاقتراح بالفعل!');
      return;
    }
    order.specialDone = true;
    emit('upsell', { order });
    order.timeLeft = Math.min(order.maxTime + 10, order.timeLeft + 12);
    order.price = +(order.price + 2.50).toFixed(2);
    if (order.personalityId === 'authority') {
      state.dmSatisfaction = Math.min(100, +(state.dmSatisfaction + 4).toFixed(1));
      showToast('👑 رحبت بصاحب السلطة VIP شخصياً وقدمت له قهوة مختصة! ارتفع رضا مدير المنطقة +4%.');
    } else if (order.personalityId === 'indecisive') {
      showToast('💡 رشحت للزبون المحتار إضافة حليب الشوفان وصوص الوايت موكا (+2.50$ بيع إضافي Upsell)!');
    } else {
      showToast('😊 ابتسم الزبون وزاد وقت صبره وبقشيش الطلب!');
    }
    playSound('cash');
    updateHUD();
    renderWorkbench();
    renderTicketsQueue();
  });

  // Promote Player Self Role
  document.getElementById('btnPromoteSelfRole')?.addEventListener('click', () => {
    initAudio();
    if (hooks.onPromoteSelfClicked) {
      hooks.onPromoteSelfClicked();
      return;
    }
    const cur = state.playerProfile.role;
    if (cur === 'barista') {
      state.playerProfile.role = 'supervisor';
      playSound('fanfare');
      showToast('🎉 مبروك الترقية! أصبحت الآن "مشرف وردية (Shift Supervisor)" بجميع صلاحيات إدارة الشيفت والشكاوى!');
    } else if (cur === 'supervisor') {
      state.playerProfile.role = 'manager';
      playSound('fanfare');
      showToast('👑 مبروك الترقية الكبرى! أصبحت الآن "مدير فرع (Store Manager)" بصلاحيات كاملة على الـ 75 فرعاً والـ 500 موظف!');
    } else {
      showToast('👑 أنت بالفعل في أعلى منصب بالفرع: مدير فرع (Store Manager) بصلاحيات كاملة!');
    }
    updateHUD();
    renderStaffTab();
  });

  // Crown Employee of the Month
  document.getElementById('btnCrownBestEmployee')?.addEventListener('click', () => {
    initAudio();
    if (!checkRolePermission('manager', 'تتويج الموظف المثالي للشهر')) return;
    if (state.money < 50) {
      showToast('⚠️ تحتاج إلى $50 لصرف مكافأة الموظف المثالي للشهر!');
      return;
    }
    state.money = +(state.money - 50).toFixed(2);
    const candidates = state.staff.length > 0 ? state.staff : state.allNetworkStaff;
    const winner = candidates[Math.floor(Math.random() * candidates.length)];
    state.employeeOfMonth = {
      id: winner.id,
      name: winner.name,
      storeName: winner.storeName || state.activeSubStoreName,
      score: 99
    };
    state.staff.forEach(s => { s.energy = 100; s.onBreak = false; });
    emit('eotm', { staffId: winner.id });
    state.dmSatisfaction = Math.min(100, +(state.dmSatisfaction + 5).toFixed(1));
    state.opsScore = Math.min(100, +(state.opsScore + 4).toFixed(1));
    playSound('fanfare');
    showToast(`🏆 تم تتويج "${winner.name}" بلقب الموظف المثالي للشهر! ارتفعت طاقة الفريق إلى 100%.`);
    updateHUD();
    renderStaffTab();
  });

  // Simulate & Handle Tardiness / Absence Disciplinary Cases
  document.getElementById('btnSimulateTardinessCase')?.addEventListener('click', () => {
    initAudio();
    const pool = state.allNetworkStaff || state.staff;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const isAbsent = Math.random() < 0.45;
    state.disciplinaryCases.unshift({
      id: ++state.nextId,
      staffId: pick.id,
      staffName: pick.name,
      storeName: pick.storeName || state.activeSubStoreName,
      type: isAbsent ? 'absent' : 'late',
      reason: isAbsent
        ? 'تغيب عن الوردية بدون إذن مسبق وتم رصده في كشف البصمة الصباحي.'
        : 'تأخر 35 دقيقة عن موعد فتح الفرع الصباحي.',
      resolved: false,
      actionTaken: ''
    });
    playSound('ding');
    showToast(`📋 تم فحص البصمة: رصد حالة ${isAbsent ? 'غياب' : 'تأخير'} للموظف "${pick.name}"!`);
    renderV7Enhancements();
  });

  document.getElementById('disciplinaryCasesContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-disc-action]');
    if (!btn) return;
    initAudio();
    const act = btn.getAttribute('data-disc-action');
    if (act === 'deduct_absent' && !checkRolePermission('manager', 'خصم غياب يوم كامل')) return;
    if (act === 'deduct_late' && !checkRolePermission('supervisor', 'توقيع خصم تأخير')) return;

    const id = Number(btn.getAttribute('data-disc-id'));
    const dc = (state.disciplinaryCases || []).find(item => item.id === id);
    if (!dc || dc.resolved) return;

    dc.resolved = true;
    emit('disc:resolved', { action: act });
    const emp = (state.allNetworkStaff || []).find(s => s.id === dc.staffId);
    if (act === 'deduct_late') {
      dc.actionTaken = 'تم توقيع خصم تأخير (ربع يوم +$15 للخزينة)';
      state.money = +(state.money + 15).toFixed(2);
      state.opsScore = Math.min(100, +(state.opsScore + 2).toFixed(1));
      if (emp) emp.deductionsCount = (emp.deductionsCount || 0) + 1;
      showToast(`⏱️ تم توقيع خصم تأخير على "${dc.staffName}" وضبط التزام الوردية!`);
    } else if (act === 'deduct_absent') {
      dc.actionTaken = 'تم توقيع خصم غياب يوم كامل (+$35) وتكليف بديل';
      state.money = +(state.money + 35).toFixed(2);
      state.opsScore = Math.min(100, +(state.opsScore + 3).toFixed(1));
      if (emp) emp.deductionsCount = (emp.deductionsCount || 0) + 1;
      showToast(`🚫 تم توقيع خصم غياب على "${dc.staffName}" وتغطية مكانه على البار!`);
    } else {
      dc.actionTaken = 'تم قبول العذر وتوجيه تنبيه ودي';
      if (emp) emp.energy = 100;
      showToast(`🤝 تم قبول عذر "${dc.staffName}" مع تنبيه الالتزام بمواعيد البصمة.`);
    }
    playSound('step');
    updateHUD();
    renderStaffTab();
  });

  // Staff Filter Buttons & 500-Staff Search
  document.querySelectorAll('.staff-view-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      initAudio();
      state.staffViewFilter = btn.getAttribute('data-staff-filter');
      document.querySelectorAll('.staff-view-filter-btn').forEach(b => {
        const active = b.getAttribute('data-staff-filter') === state.staffViewFilter;
        b.className = active
          ? 'staff-view-filter-btn px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-[#00704A] text-white border border-[#CBA258]'
          : 'staff-view-filter-btn px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-900 text-emerald-200 border border-emerald-700/50';
      });
      renderStaffTab();
    });
  });

  document.getElementById('staffSearchInput500')?.addEventListener('input', () => {
    renderStaffTab();
  });

  // Staff Promote, Deduct, and 75-Store Transfer inside #staffListContainer
  document.getElementById('staffListContainer')?.addEventListener('click', (e) => {
    const promBtn = e.target.closest('[data-staff-promote]');
    if (promBtn) {
      initAudio();
      if (!checkRolePermission('manager', 'ترقية الموظفين')) return;
      const empId = Number(promBtn.getAttribute('data-staff-promote'));
      const emp = (state.allNetworkStaff || []).find(s => s.id === empId) || state.staff.find(s => s.id === empId);
      if (!emp) return;
      if (state.money < 90) {
        showToast('⚠️ تحتاج إلى $90 لاعتماد ترقية الموظف وصرف علاوة الترقية!');
        return;
      }
      state.money = +(state.money - 90).toFixed(2);
      emit('staff:promote', { staffId: emp.id, from: emp.jobCode });
      emp.level += 1;
      emp.speedMult = +(emp.speedMult + 0.18).toFixed(2);
      emp.energy = 100;
      if (emp.jobCode === 'barista' || emp.jobCode === 'barista_delivery') {
        emp.jobCode = 'shift_supervisor';
        emp.jobTitle = 'مشرف وردية (Shift Supervisor)';
        emp.name = `${emp.cleanName || emp.name.split('(')[0].trim()} (مشرف وردية)`;
      } else if (emp.jobCode === 'shift_supervisor') {
        emp.jobCode = 'assistant_manager';
        emp.jobTitle = 'مساعد مدير فرع (Assistant Manager)';
        emp.name = `${emp.cleanName || emp.name.split('(')[0].trim()} (مساعد مدير)`;
      } else {
        emp.jobCode = 'store_manager';
        emp.jobTitle = 'مدير فرع أول (Senior Store Manager)';
        emp.name = `${emp.cleanName || emp.name.split('(')[0].trim()} (مدير فرع)`;
      }
      playSound('fanfare');
      showToast(`🎖️ مبروك! تمت ترقية "${emp.name}" ورفع سرعته وكفاءته القيادية!`);
      updateHUD();
      renderStaffTab();
      return;
    }

    const dedBtn = e.target.closest('[data-staff-deduct]');
    if (dedBtn) {
      initAudio();
      if (!checkRolePermission('supervisor', 'توقيع جزاء أو خصم إداري')) return;
      const empId = Number(dedBtn.getAttribute('data-staff-deduct'));
      const emp = (state.allNetworkStaff || []).find(s => s.id === empId) || state.staff.find(s => s.id === empId);
      if (!emp) return;
      emp.deductionsCount = (emp.deductionsCount || 0) + 1;
      state.money = +(state.money + 20).toFixed(2);
      playSound('step');
      showToast(`⚠️ تم توقيع خصم تأخير/مخالفة ($20) على "${emp.name}" وتنبيهه بالالتزام!`);
      updateHUD();
      renderStaffTab();
    }
  });

  document.getElementById('staffListContainer')?.addEventListener('change', (e) => {
    const stTransId = Number(e.target.getAttribute('data-staff-store-transfer'));
    if (!stTransId) return;
    initAudio();
    if (!checkRolePermission('manager', 'نقل الموظفين بين الفروع الـ 75')) {
      renderStaffTab();
      return;
    }
    const emp = (state.allNetworkStaff || []).find(s => s.id === stTransId);
    const [regId, newStoreName] = (e.target.value || '').split('__');
    if (emp && newStoreName) {
      emp.branchId = regId;
      emp.storeName = newStoreName;
      emit('staff:transfer', { staffId: emp.id });
      syncActiveStoreStaffIntoState();
      playSound('ding');
      showToast(`🔄 تم نقل "${emp.name}" فوراً للعمل في فرع "${newStoreName}"!`);
      updateHUD();
      renderStaffTab();
    }
  });

  // Delivery Hub Controls
  document.getElementById('btnToggleThermalSeal')?.addEventListener('click', (e) => {
    initAudio();
    state.thermalSealEnabled = !state.thermalSealEnabled;
    e.currentTarget.textContent = state.thermalSealEnabled
      ? '📦 التغليف الحراري المزدوج: مفعل ✅'
      : '📦 التغليف الحراري المزدوج: متوقف ⚠️';
    showToast(state.thermalSealEnabled
      ? '📦 تم تفعيل أختام التغليف الحراري المانع للانسكاب لكل طلبات الدليفري!'
      : '⚠️ تم إيقاف التغليف الحراري المزدوج (قد تزيد شكاوى الدليفري).');
  });

  document.getElementById('btnSimulateDeliveryComplaint')?.addEventListener('click', () => {
    initAudio();
    spawnCustomerOrder('delivery');
    const curStore = state.activeSubStoreName || 'Nile City Cairo';
    const cName = getUniqueCustomerName();
    const newId = ++state.nextId;
    const issues = [
      'انسكاب صوص الكراميل داخل كيس التوصيل بسبب سرعة دراجة الطيار.',
      'وصول الفرابوتشينو ذائباً لتأخر الطيار في الزحام 18 دقيقة.',
      'نقص شوت إسبريسو إضافي مدفوع (+20 ج.م) في طلب الدليفري.'
    ];
    const chosenIssue = issues[newId % issues.length];
    state.deliveryComplaints.unshift({
      id: newId,
      platform: newId % 2 === 0 ? 'طلبات (Talabat) 🛵' : 'مرسول (Mrsool) 📦',
      customerName: cName,
      branchName: curStore,
      orderItems: 'دبل شوت مثلج مخفوق + كرواسون زبدة',
      issue: chosenIssue,
      resolved: false,
      compCost: 10
    });

    pushNewEmail({
      sender: `إدارة خدمة الدليفري والتوصيل (${curStore})`,
      roleBadge: 'شكوى دليفري 🛵',
      subject: `شكوى توصيل واردة للفرع من العميل "${cName}"`,
      body: `تم تسجيل شكوى دليفري على فرع ${curStore}: "${chosenIssue}". يرجى إرسال مشروب بديل مع طيار خاص لتفادي تقييم سلبي على المنصة.`,
      choices: [
        { label: '🛵 إرسال طلب بديل مجاني مع طيار فوري (-$10 / +6% أوبريشن وسمعة)', cost: 10, dmDelta: 4, opsDelta: 6 }
      ]
    });
    renderV7Enhancements();
  });

  document.getElementById('deliveryComplaintsContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-resolve-delivery]');
    if (!btn) return;
    initAudio();
    if (!checkRolePermission('supervisor', 'حل شكاوى الدليفري وإرسال بديل')) return;
    const id = Number(btn.getAttribute('data-resolve-delivery'));
    const dc = (state.deliveryComplaints || []).find(item => item.id === id);
    if (!dc || dc.resolved) return;
    if (state.money < dc.compCost) {
      showToast(`⚠️ تحتاج إلى $${dc.compCost} لإرسال الطلب البديل مع الطيار!`);
      return;
    }
    state.money = +(state.money - dc.compCost).toFixed(2);
    dc.resolved = true;
    emit('delivery:resolved', { id: dc.id });
    state.reputation = Math.min(100, +(state.reputation + 2.0).toFixed(1));
    state.opsScore = Math.min(100, +(state.opsScore + 3.0).toFixed(1));
    playSound('fanfare');
    showToast(`🛵 تم إرسال طلب دليفري بديل بتغليف حراري للعميل "${dc.customerName}" وارتفع تقييم الفرع!`);
    updateHUD();
    renderV7Enhancements();
  });

  // Also sync active store staff whenever switching branches via HUD or Branches Tab
  document.getElementById('hudStoreSelector')?.addEventListener('change', () => {
    syncActiveStoreStaffIntoState();
    updateHUD();
    renderStaffTab();
  });
  document.getElementById('branchesListContainer')?.addEventListener('click', () => {
    setTimeout(() => {
      syncActiveStoreStaffIntoState();
      updateHUD();
      renderStaffTab();
    }, 30);
  });
}


// =========================================================================
// V8 EXPANSION ENGINE:
// 1. 16+ NEW FOOD ITEMS (SANDWICHES, CROISSANTS, CAKES) & 3D DISPLAY FRIDGE
// 2. STARBUCKS SIREN LOGOS EVERYWHERE ON THE 3D CANVAS & UI
// 3. LANDSCAPE WIDESCREEN MODE & MODERN SEGMENTED COMMAND PODS
// 4. PRICE HIKES & MIXED CUSTOMER SENTIMENT (HAPPY vs PRICE COMPLAINTS)
// 5. STAFF RESIGNATIONS, RETENTION, TRAINING & PROMOTIONS
// 6. SURPRISE ANNUAL NSF AUDIT (QUALITY & EMPLOYEE HYGIENE; < GREEN = FIRE/TRANSFER/DEDUCT SM)
// 7. ADVANCED LP (LOSS PREVENTION) SECURITY VISITS & 4 INVESTIGATION TRACKS
// =========================================================================

const V8_EXTRA_FOOD_ITEMS = [
  // الساندويتشات الساخنة والبانيني (Sandwiches & Paninis)
  {
    id: 'chicken_fajita_panini',
    name: 'ساندويتش دجاج فاهيتا وتشيدر بالبيستو (Chicken Fajita Panini)',
    category: 'فرن التسخين',
    subGroup: 'sandwiches',
    icon: '🥪',
    basePrice: 6.20,
    price: 6.20,
    egpTall: 185,
    egpGrande: 210,
    egpVenti: 225,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 10,
    steps: ['oven', 'syrup'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 5 }
  },
  {
    id: 'halloumi_zaatar_ciabatta',
    name: 'ساندويتش حلومي مشوي بالزعتر والطماطم المجففة (Halloumi Ciabatta)',
    category: 'فرن التسخين',
    subGroup: 'sandwiches',
    icon: '🥖',
    basePrice: 5.90,
    price: 5.90,
    egpTall: 175,
    egpGrande: 195,
    egpVenti: 215,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 10,
    steps: ['oven'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 5 }
  },
  {
    id: 'tuna_melt_panini',
    name: 'ساندويتش تونة ميلت بالجبنة الشيدر والذرة (Tuna Melt Panini)',
    category: 'فرن التسخين',
    subGroup: 'sandwiches',
    icon: '🥪',
    basePrice: 6.00,
    price: 6.00,
    egpTall: 180,
    egpGrande: 200,
    egpVenti: 220,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 10,
    steps: ['oven'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 5 }
  },
  {
    id: 'roast_beef_swiss',
    name: 'ساندويتش روست بيف بالجبنة السويسرية والماسترد (Roast Beef & Swiss)',
    category: 'فرن التسخين',
    subGroup: 'sandwiches',
    icon: '🥩',
    basePrice: 6.50,
    price: 6.50,
    egpTall: 195,
    egpGrande: 220,
    egpVenti: 240,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 11,
    steps: ['oven', 'syrup'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 6 }
  },
  {
    id: 'egg_bacon_brioche',
    name: 'ساندويتش أومليت بالجبنة والبيكون البقري للفطور (Egg & Beef Bacon Brioche)',
    category: 'فرن التسخين',
    subGroup: 'sandwiches',
    icon: '🍳',
    basePrice: 5.50,
    price: 5.50,
    egpTall: 165,
    egpGrande: 185,
    egpVenti: 200,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 9,
    steps: ['oven'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 5 }
  },
  {
    id: 'falafel_tahini_wrap',
    name: 'راب فلافل وحمص بالطحينة ساخن (Falafel & Hummus Tortilla Wrap)',
    category: 'فرن التسخين',
    subGroup: 'sandwiches',
    icon: '🌯',
    basePrice: 4.80,
    price: 4.80,
    egpTall: 145,
    egpGrande: 165,
    egpVenti: 180,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 9,
    steps: ['oven'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 4 }
  },

  // الكرواسون والمخبوزات (Croissants & Pastries in 3D Fridge)
  {
    id: 'cheese_croissant',
    name: 'كرواسون بالجبنة الرومي والشيدر السايحة (Triple Cheese Croissant)',
    category: 'فرن التسخين',
    subGroup: 'croissants',
    icon: '🥐',
    basePrice: 3.85,
    price: 3.85,
    egpTall: 115,
    egpGrande: 130,
    egpVenti: 145,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 8,
    steps: ['oven'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 4 }
  },
  {
    id: 'chocolate_croissant',
    name: 'كرواسون بالشوكولاتة البلجيكية الفاخرة (Pain au Chocolat)',
    category: 'فرن التسخين',
    subGroup: 'croissants',
    icon: '🍫',
    basePrice: 4.00,
    price: 4.00,
    egpTall: 120,
    egpGrande: 135,
    egpVenti: 150,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 8,
    steps: ['oven', 'syrup'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 4 }
  },
  {
    id: 'almond_croissant',
    name: 'كرواسون باللوز المحمص والكريمة (Almond Cream Croissant)',
    category: 'فرن التسخين',
    subGroup: 'croissants',
    icon: '🌰',
    basePrice: 4.35,
    price: 4.35,
    egpTall: 130,
    egpGrande: 145,
    egpVenti: 160,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 8,
    steps: ['oven'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 4 }
  },
  {
    id: 'zaatar_croissant',
    name: 'كرواسون زعتر بري وجبنة فيتا (Zaatar & Feta Croissant)',
    category: 'فرن التسخين',
    subGroup: 'croissants',
    icon: '🌿',
    basePrice: 3.65,
    price: 3.65,
    egpTall: 110,
    egpGrande: 125,
    egpVenti: 140,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 7,
    steps: ['oven'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 4 }
  },
  {
    id: 'cinnamon_roll',
    name: 'سينامون رول بصوص الكريمة الغني (Warm Cinnamon Swirl Roll)',
    category: 'فرن التسخين',
    subGroup: 'croissants',
    icon: '🍥',
    basePrice: 4.50,
    price: 4.50,
    egpTall: 135,
    egpGrande: 150,
    egpVenti: 165,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 8,
    steps: ['oven', 'syrup'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 4 }
  },

  // الكيك والتشيز كيك والحلويات (Cakes & Cheesecakes in 3D Fridge)
  {
    id: 'ny_berry_cheesecake',
    name: 'نيويورك تشيز كيك بالفراولة والتوت (New York Berry Cheesecake)',
    category: 'فرن التسخين',
    subGroup: 'cakes',
    icon: '🍰',
    basePrice: 5.50,
    price: 5.50,
    egpTall: 165,
    egpGrande: 185,
    egpVenti: 200,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 7,
    steps: ['syrup'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 5 }
  },
  {
    id: 'choc_fudge_cake',
    name: 'كيكة الشوكولاتة الفادج الثلاثية (Triple Chocolate Fudge Cake)',
    category: 'فرن التسخين',
    subGroup: 'cakes',
    icon: '🎂',
    basePrice: 5.35,
    price: 5.35,
    egpTall: 160,
    egpGrande: 180,
    egpVenti: 195,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 7,
    steps: ['oven', 'syrup'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 5 }
  },
  {
    id: 'carrot_walnut_cake',
    name: 'كيكة الجزر بالجوز وفروستينج الكريمة (Classic Carrot & Walnut Cake)',
    category: 'فرن التسخين',
    subGroup: 'cakes',
    icon: '🥕',
    basePrice: 5.00,
    price: 5.00,
    egpTall: 150,
    egpGrande: 170,
    egpVenti: 185,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 7,
    steps: ['syrup'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 4 }
  },
  {
    id: 'tiramisu_brownie',
    name: 'تيراميسو الإسبريسو وبراونيز الكراميل المملح (Espresso Tiramisu)',
    category: 'فرن التسخين',
    subGroup: 'cakes',
    icon: '🍮',
    basePrice: 5.65,
    price: 5.65,
    egpTall: 170,
    egpGrande: 190,
    egpVenti: 205,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 7,
    steps: ['shot', 'syrup'],
    stockUse: { beans: 1, milk: 0, ice: 0, cups: 1, food: 5 }
  },
  {
    id: 'blueberry_muffin_lemon',
    name: 'كيك الليمون المثلج ومفن التوت الأزرق (Lemon Loaf & Blueberry Muffin)',
    category: 'فرن التسخين',
    subGroup: 'cakes',
    icon: '🧁',
    basePrice: 4.20,
    price: 4.20,
    egpTall: 125,
    egpGrande: 140,
    egpVenti: 155,
    unlocked: true,
    active: true,
    unlockCost: 0,
    prepTime: 6,
    steps: ['oven'],
    stockUse: { beans: 0, milk: 0, ice: 0, cups: 1, food: 4 }
  }
];

function ensureV8StateAndMenu() {
  ensure500NetworkStaffAndMetadata();

  // Merge all 16 new food items into state.menu
  V8_EXTRA_FOOD_ITEMS.forEach(fi => {
    if (!state.menu.some(m => m.id === fi.id)) {
      state.menu.push(JSON.parse(JSON.stringify(fi)));
    }
  });

  if (state.landscapeMode === undefined) {
    state.landscapeMode = true;
  }
  document.body.classList.toggle('portrait-9-16', !!state.landscapeMode);

  if (state.priceMultiplier === undefined) {
    state.priceMultiplier = 1.0;
  }
  if (state.happyPriceCustomers === undefined) state.happyPriceCustomers = 14;
  if (state.angryPriceCustomers === undefined) state.angryPriceCustomers = 3;

  // NSF State
  if (!state.nsfAudit) {
    state.nsfAudit = {
      partnerHygiene: 96,
      foodTempAndDates: 95,
      fridgeTempC: 3.8,
      sanitizerPpm: 200,
      lastGrade: 'GREEN',
      lastScore: 96,
      failedManagerPendingAction: false,
      surpriseCountdown: 95
    };
  }

  // Staff Resignations State
  if (!Array.isArray(state.resignations) || state.resignations.length === 0) {
    const s1 = (state.allNetworkStaff || [])[5] || state.staff[1];
    const s2 = (state.allNetworkStaff || [])[14] || state.staff[2];
    state.resignations = [
      {
        id: 9701,
        staffId: s1 ? s1.id : 1005,
        staffName: s1 ? s1.name : 'مروان الشامي (باريستا معتمد)',
        storeName: state.activeSubStoreName || 'Nile City Cairo',
        reason: 'تلقى عرض عمل من كافيه منافس براتب أعلى ويشعر بضغط ساعات الذروة دون ترقية.',
        resolved: false,
        outcomeText: ''
      },
      {
        id: 9702,
        staffId: s2 ? s2.id : 1014,
        staffName: s2 ? s2.name : 'فريدة الكيلاني (مشرف وردية)',
        storeName: state.activeSubStoreName || 'Nile City Cairo',
        reason: 'تقدم بطلب استقالة بسبب إرهاق الورديات المتتالية وتأخر إلحاقه بدورة تدريب مساعد مدير.',
        resolved: false,
        outcomeText: ''
      }
    ];
  }

  // Advanced Loss Prevention (LP) State
  if (!Array.isArray(state.lpCases) || state.lpCases.length === 0) {
    const s3 = (state.allNetworkStaff || [])[6] || state.staff[0];
    const s4 = (state.allNetworkStaff || [])[7] || state.staff[1];
    state.lpCases = [
      {
        id: 9801,
        type: 'emp_theft',
        typeBadge: '💸 سرقة موظف / عجز كاشير',
        badgeCls: 'bg-rose-950 text-rose-200 border-rose-500',
        storeName: state.activeSubStoreName || 'Nile City Cairo',
        title: `رصد عجز مالي ($85) وإلغاء فواتير مشبوه بواسطة "${s3 ? s3.cleanName : 'سامح النجار'}"`,
        details: 'كشفت مراجعة كاميرات الـ CCTV وتقرير الـ POS قيام الموظف بإلغاء 4 فواتير كاش بعد استلام المبلغ من الزبائن.',
        resolved: false,
        outcome: ''
      },
      {
        id: 9802,
        type: 'lost_found',
        typeBadge: '🔍 مفقودات عميل (Lost & Found)',
        badgeCls: 'bg-emerald-950 text-emerald-200 border-emerald-500',
        storeName: state.activeSubStoreName || 'Nile City Cairo',
        title: 'نسيان حقيبة لابتوب وسماعة AirPods Pro للعميل "د. شريف الدمرداش" على طاولة 3',
        details: 'تم العثور على المتعلقات أثناء جولة تنظيف الـ CS. يجب تحريزها في خزنة الـ LP برقم محضر وتسليمها للعميل.',
        resolved: false,
        outcome: ''
      },
      {
        id: 9803,
        type: 'staff_fight',
        typeBadge: '⚡ خلاف حاد بين موظفين',
        badgeCls: 'bg-purple-950 text-purple-200 border-purple-500',
        storeName: state.activeSubStoreName || 'Nile City Cairo',
        title: `مشادة كلامية وخلاف على البار بين "${s3 ? s3.cleanName : 'كريم'}" و"${s4 ? s4.cleanName : 'يوسف'}"`,
        details: 'نشب خلاف حاد بين الموظفين أثناء ضغط الذروة حول أولوية تحضير طلبات الدرايف ثرو مقابل الصالة مما أبطأ سرعة البار.',
        resolved: false,
        outcome: ''
      }
    ];
  }
}

// Helper to draw authentic Starbucks Siren Circular Green Logo on the 3D Canvas
function drawStarbucksSirenLogo(c, cx, cy, r, withGlow) {
  c.save();
  if (withGlow) {
    c.shadowColor = '#00704A';
    c.shadowBlur = 12;
  }
  // Outer Gold Ring
  c.beginPath();
  c.arc(cx, cy, r + 2, 0, Math.PI * 2);
  c.fillStyle = '#CBA258';
  c.fill();

  // Iconic Starbucks Green Circle
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fillStyle = '#00704A';
  c.fill();

  // Inner White Concentric Ring
  c.beginPath();
  c.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  c.strokeStyle = '#ffffff';
  c.lineWidth = Math.max(1.2, r * 0.08);
  c.stroke();

  // Twin-tailed Siren & Crown Motif
  c.fillStyle = '#ffffff';
  c.font = `${Math.max(10, Math.round(r * 1.05))}px sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('🧜\u200D♀️', cx, cy + 1);

  // Golden Crown Star above Siren
  c.fillStyle = '#fde68a';
  c.font = `bold ${Math.max(7, Math.round(r * 0.45))}px sans-serif`;
  c.fillText('♛', cx, cy - r * 0.56);
  c.restore();
}

// Draw 3D Glass Pastry, Croissant, Cake & Sandwich Fridge + Starbucks Logos Everywhere on the 3D Canvas
function drawV8CanvasOverlays() {
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return;
  const scaleX = w / LOGICAL_W;
  const scaleY = h / LOGICAL_H;

  ctx.save();
  ctx.scale(scaleX, scaleY);

  // 1. STARBUCKS LOGOS EVERYWHERE IN THE 3D STORE!
  // Logo 1: Illuminated Drive-Thru Monument Sign (Top Left Drive-Thru Entrance)
  draw3DBox(ctx, 22, 10, 152, 34, 8, '#042f2e', '#00704A', '#022c22', '#CBA258');
  drawStarbucksSirenLogo(ctx, 44, 27, 13, true);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10.5px "Cairo Variable", Cairo, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('STARBUCKS DRIVE-THRU', 110, 24);
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 9px "Cairo Variable", Cairo, sans-serif';
  ctx.fillText('★ مفتوح لخدمتكم ★', 110, 36);

  // Logo 2: Center Medallion on the 3D Wooden Front Bar Counter
  drawStarbucksSirenLogo(ctx, 512, 323, 18, true);

  // Logo 3: Back Bar Wall Illuminated Siren Emblem
  drawStarbucksSirenLogo(ctx, 442, 152, 14, true);
  drawStarbucksSirenLogo(ctx, 788, 152, 14, true);

  // Logo 4: Store Entrance Welcome Mat & Glass Door Logo
  drawStarbucksSirenLogo(ctx, 64, 412, 15, true);

  // Logo 5: Break Room Partner Wall Logo
  drawStarbucksSirenLogo(ctx, 83, 286, 14, false);

  // Logo 6: Mini Starbucks Logos on Clean 3D Tables
  state.tables.forEach(t => {
    if (!t.dirty) {
      drawStarbucksSirenLogo(ctx, t.x, t.y - 16, 7.5, false);
    }
  });

  // 2. UPGRADED 3D GLASS DISPLAY FRIDGE WITH 3 ILLUMINATED SHELVES (CROISSANTS, CAKES, SANDWICHES)
  const fx = 175;
  const fy = 238;
  const fw = 172;
  const fh = 64;
  draw3DBox(ctx, fx, fy, fw, fh, 14, 'rgba(14, 116, 144, 0.38)', '#064e3b', '#022c22', '#34d399');

  // Illuminated Glass Interior & 3 Shelves
  drawRoundedRect(ctx, fx + 5, fy + 4, fw - 10, fh - 8, 5, 'rgba(236, 254, 255, 0.16)', '#67e8f9', 1.2);
  // Shelf 1: Croissants
  ctx.strokeStyle = 'rgba(253, 230, 138, 0.7)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(fx + 8, fy + 22);
  ctx.lineTo(fx + fw - 8, fy + 22);
  ctx.moveTo(fx + 8, fy + 41);
  ctx.lineTo(fx + fw - 8, fy + 41);
  ctx.stroke();

  ctx.font = '11.5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🥐 🥐 🍫 🧀 🌰 🍥', fx + fw / 2, fy + 17);
  ctx.fillText('🍰 🎂 🥕 🍮 🧁 🍓', fx + fw / 2, fy + 36);
  ctx.fillText('🥪 🥖 🥩 🍳 🌯 🧀', fx + fw / 2, fy + 54);

  // Temperature & Logo badge on 3D Fridge
  drawStarbucksSirenLogo(ctx, fx + 14, fy + 12, 8, false);
  drawRoundedRect(ctx, fx + fw - 48, fy - 10, 48, 14, 4, '#083344', '#22d3ee', 1);
  ctx.fillStyle = '#a5f3fc';
  ctx.font = 'bold 8.5px Inter, "Cairo Variable", Cairo, sans-serif';
  ctx.fillText(`🌡️${(state.nsfAudit?.fridgeTempC || 3.8).toFixed(1)}°C`, fx + fw - 24, fy - 1);

  // 3. Price Sentiment Bubble above Customers when Price Wave is Active
  if ((state.priceMultiplier || 1) > 1.02) {
    state.orders.forEach(ord => {
      if (ord.channel !== 'drive_thru' && ord.priceSentiment) {
        const bx = ord.x;
        const by = ord.y - 58;
        const isHappy = ord.priceSentiment === 'happy';
        drawRoundedRect(ctx, bx - 54, by, 108, 15, 5, isHappy ? 'rgba(6, 78, 59, 0.92)' : 'rgba(127, 29, 29, 0.95)', isHappy ? '#34d399' : '#f87171', 1);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8.5px "Cairo Variable", Cairo, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isHappy ? '😍 الجودة تستاهل السعر!' : '😡💸 الأسعار غليت أوي!', bx, by + 10);
      }
    });
  }

  ctx.restore();
}

// Hook into requestAnimationFrame via renderCanvasScene so our 3D logos & 3D pastry fridge draw every frame
const _origDraw3DPerson = draw3DPerson;
draw3DPerson = function (c, x, y, shirtColor, apronColor, icon, labelText, badgeColor, energyRatio, isSelected) {
  _origDraw3DPerson(c, x, y, shirtColor, apronColor, icon, labelText, badgeColor, energyRatio, isSelected);
  // Put tiny Starbucks Siren pin on every Barista's green apron!
  if (apronColor === '#00704A') {
    c.save();
    c.beginPath();
    c.arc(x, y + 1, 3.2, 0, Math.PI * 2);
    c.fillStyle = '#ffffff';
    c.fill();
    c.beginPath();
    c.arc(x, y + 1, 2.2, 0, Math.PI * 2);
    c.fillStyle = '#00704A';
    c.fill();
    c.restore();
  }
};

// Draw V8 overlays right before floatingTexts in renderCanvasScene by wrapping draw3DTableAndChairs on table #6
const _origDraw3DTable = draw3DTableAndChairs;
draw3DTableAndChairs = function (c, t) {
  _origDraw3DTable(c, t);
  if (t && t.id === 6) {
    drawV8CanvasOverlays();
  }
};

// =========================================================================
// SURPRISE ANNUAL NSF AUDIT ENGINE (أهم زيارة في السنة)
// =========================================================================
function runSurpriseNsfAudit(isManual) {
  ensureV8StateAndMenu();
  const curStore = state.activeSubStoreName || 'Nile City Cairo';
  const nsf = state.nsfAudit;

  // Start visual floor walk as well
  startInspectionVisit(false, `🛡️ مفتش الـ NSF الدولي (فحص الكوالتي وهايجين الموظف ودرجات الحرارة)`);

  // Calculate comprehensive NSF Score (0 - 100)
  const hygienePts = Math.round((nsf.partnerHygiene / 100) * 30); // 30 pts
  const tempAndDatesPts = Math.round((nsf.foodTempAndDates / 100) * 30); // 30 pts
  const cleanAndSanitizerPts = Math.round(((state.cleanliness * 0.5 + (nsf.sanitizerPpm >= 150 ? 100 : 50) * 0.5) / 100) * 25); // 25 pts
  const exhaustedOrSickOnBar = state.staff.filter(s => (s.energy < 25 || s.sickLeave) && !s.onBreak).length;
  const staffHealthPts = exhaustedOrSickOnBar === 0 ? 15 : Math.max(0, 15 - exhaustedOrSickOnBar * 8); // 15 pts

  const totalScore = Math.min(100, Math.max(25, hygienePts + tempAndDatesPts + cleanAndSanitizerPts + staffHealthPts));
  let grade = 'GREEN';
  let gradeBadgeText = `🛡️ تقييم NSF: GREEN 🟢 (${totalScore}%)`;
  let gradeBadgeCls = 'text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-400 shadow';

  if (totalScore < 70) {
    grade = 'RED';
    gradeBadgeText = `🚨 تقييم NSF: RED 🔴 (${totalScore}%)`;
    gradeBadgeCls = 'text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-200 border-2 border-rose-500 animate-pulse';
  } else if (totalScore < 85) {
    grade = 'YELLOW';
    gradeBadgeText = `⚠️ تقييم NSF: YELLOW 🟡 (${totalScore}%)`;
    gradeBadgeCls = 'text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-200 border-2 border-amber-500 animate-pulse';
  }

  nsf.lastGrade = grade;
  nsf.lastScore = totalScore;
  emit('nsf:finished', { score: totalScore, grade });

  const hudBadge = document.getElementById('hudNsfGradeBadge');
  if (hudBadge) {
    hudBadge.textContent = gradeBadgeText;
    hudBadge.className = gradeBadgeCls;
  }

  if (grade === 'GREEN') {
    nsf.failedManagerPendingAction = false;
    state.money = +(state.money + 400).toFixed(2);
    state.dmSatisfaction = Math.min(100, +(state.dmSatisfaction + 8).toFixed(1));
    state.opsScore = Math.min(100, +(state.opsScore + 9).toFixed(1));
    state.reputation = Math.min(100, +(state.reputation + 4).toFixed(1));
    playSound('fanfare');
    showToast(`🟢 اجتياز تاريخي لزيارة الـ NSF المفاجئة بتقدير GREEN (${totalScore}%)! مكافأة التميز +$400!`);

    pushNewEmail({
      sender: 'هيئة تفتيش سلامة الغذاء الدولية (NSF International Audit 🛡️)',
      roleBadge: 'شهادة GREEN 🟢',
      subject: `مبروك! فرع ${curStore} حقق تقدير GREEN (${totalScore}%) في زيارة الـ NSF المفاجئة`,
      body: `أشاد مفتش الـ NSF بالتزام الباريستات بغسيل الأيدي ونظافة المرايل (${nsf.partnerHygiene}%)، وضبط حرارة ثلاجة الكرواسون والكيك عند ${nsf.fridgeTempC}°C، وملصقات الصلاحية (Date Dots). تم صرف مكافأة +$400 للفرع!`,
      choices: [
        { label: '🏆 الاحتفال مع فريق الفرع واستلام شهادة الـ NSF الذهبية (+5% رضا الإدارة)', cost: 0, dmDelta: 5, opsDelta: 5 }
      ]
    });
  } else {
    // LESS THAN GREEN -> Severe consequence: Fire or Transfer Store Manager + Financial Deduction!
    nsf.failedManagerPendingAction = true;
    const fine = 120;
    state.money = Math.max(0, +(state.money - fine).toFixed(2));
    state.dmSatisfaction = Math.max(15, +(state.dmSatisfaction - 12).toFixed(1));
    state.opsScore = Math.max(15, +(state.opsScore - 14).toFixed(1));
    playSound('angry');

    const branchLeader = state.staff[0] || { name: 'مدير الفرع الحالي' };
    showToast(`🚨 كارثة رقابية! الفرع حصل على ${grade} (${totalScore}%) أقل من GREEN في زيارة الـ NSF! تم توقيع خصم -$${fine} وفتح قرار رفد أو نقل مدير الفرع!`);

    pushNewEmail({
      sender: 'أ. عمرو عاطف (مدير الأوبريشن) وهيئة تفتيش الـ NSF الدولية 🚨',
      roleBadge: `رسوب NSF (${grade}) 🔴`,
      subject: `قرار عاجل: حصول فرع ${curStore} على تقدير أقل من GREEN (${totalScore}%) في زيارة NSF المفاجئة!`,
      body: `حصل الفرع على تقدير ${grade} (${totalScore}%) بسبب قصور في الكوالتي أو هايجين الموظف أو حرارة الثلاجات. طبقاً للوائح ستاربكس الصارمة في أهم زيارة في السنة: تم توقيع خصم مالي فوري (-$120)، ويجب الآن إما رفد مدير الفرع المقصر (${branchLeader.name}) أو نقله فوراً لفرع آخر!`,
      choices: [
        { label: `🚫 رفد مدير الفرع المقصر (${branchLeader.name}) وتعيين مدير جديد كفء فوراً (+8% استعادة انضباط الأوبريشن)`, cost: 0, dmDelta: 6, opsDelta: 8 },
        { label: `🔄 نقل مدير الفرع لفرع آخر هادئ مع تثبيت الخصم المالي (-$120) وإعادة تهيئة الفرع للـ Green`, cost: 0, dmDelta: 4, opsDelta: 6 }
      ]
    });
  }

  state.auditHistory.unshift({
    day: state.day,
    title: `🛡️ زيارة الـ NSF السنوية المفاجئة (${curStore})`,
    score: totalScore,
    result: grade === 'GREEN'
      ? `🟢 GREEN ممتاز (+$400 مكافأة)`
      : `🔴 ${grade} أقل من Green (خصم -$120 وقرار رفد/نقل مدير الفرع!)`
  });

  renderV8UI();
  updateHUD();
  renderOpsTab();
}

// =========================================================================
// RENDER V8 SECTIONS (RESIGNATIONS, NSF, LP, 3D FRIDGE & PRICE WAVE)
// =========================================================================
function renderV8UI() {
  ensureV8StateAndMenu();

  // 1. Landscape Button Label
  const landLbl = document.getElementById('landscapeModeLabel');
  if (landLbl) {
    landLbl.textContent = state.landscapeMode ? 'أبعاد بورتريه 9:16: مفعلة 📱' : 'عرض الشاشة الكاملة 🖥️';
  }

  // 2. Resignations Hub
  const openResignations = (state.resignations || []).filter(r => !r.resolved);
  const resBadge = document.getElementById('resignationsCountBadge');
  if (resBadge) {
    resBadge.textContent = openResignations.length;
    resBadge.classList.toggle('hidden', openResignations.length === 0);
  }

  const resContainer = document.getElementById('resignationsListContainer');
  if (resContainer) {
    setHtml(resContainer, (state.resignations || []).map(r => `
      <div class="p-2.5 rounded-xl bg-slate-900/95 border ${r.resolved ? 'border-emerald-700/50 opacity-75' : 'border-rose-500/80'} flex flex-wrap items-center justify-between gap-2 text-xs">
        <div>
          <div class="font-extrabold text-white flex items-center gap-1.5">
            <span>📄 طلب استقالة: ${r.staffName}</span>
            <span class="text-[10px] px-2 py-0.2 rounded bg-emerald-950 text-amber-300">${r.storeName}</span>
          </div>
          <div class="text-[10.5px] text-rose-200 mt-0.5">💬 السبب: "${r.reason}"</div>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${r.resolved
            ? `<span class="text-[11px] font-bold text-emerald-400">✅ ${r.outcomeText}</span>`
            : `
              <button data-resig-action="retain_promote" data-resig-id="${r.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold sb-btn-gold">
                🤝 إقناع بالبقاء + ترقية ($65)
              </button>
              <button data-resig-action="retain_train" data-resig-id="${r.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-purple-700 hover:bg-purple-600 text-white">
                🎓 تدريب وتطوير ($40)
              </button>
              <button data-resig-action="accept_replace" data-resig-id="${r.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-rose-800 hover:bg-rose-700 text-white">
                📝 قبول الاستقالة وتعيين بديل ($85)
              </button>
            `
          }
        </div>
      </div>
    `).join(''));
  }

  // 3. NSF Audit Panel
  const nsf = state.nsfAudit;
  const hygEl = document.getElementById('nsfHygieneVal');
  if (hygEl) hygEl.textContent = `${Math.round(nsf.partnerHygiene)}%`;
  const foodEl = document.getElementById('nsfFoodSafetyVal');
  if (foodEl) foodEl.textContent = `${Math.round(nsf.foodTempAndDates)}% (${nsf.fridgeTempC.toFixed(1)}°C)`;
  const sanEl = document.getElementById('nsfSanitizerVal');
  if (sanEl) sanEl.textContent = `${nsf.sanitizerPpm} ppm ${nsf.sanitizerPpm >= 180 ? '✅' : '⚠️'}`;

  const resText = document.getElementById('nsfLastResultText');
  const penBox = document.getElementById('nsfPenaltyActionsBox');
  if (resText) {
    if (nsf.lastGrade === 'GREEN') {
      resText.innerHTML = `<span class="text-emerald-400">🟢 GREEN (${nsf.lastScore}%) — الفرع مطابق لأعلى معايير الكوالتي وهايجين الموظف الدولية!</span>`;
    } else {
      resText.innerHTML = `<span class="text-rose-400">🚨 ${nsf.lastGrade} (${nsf.lastScore}%) — أقل من GREEN! تقصير في الكوالتي أو الهايجين يستوجب رفد أو نقل مدير الفرع وتوقيع خصم!</span>`;
    }
  }
  if (penBox) {
    penBox.classList.toggle('hidden', !nsf.failedManagerPendingAction);
    penBox.classList.toggle('flex', !!nsf.failedManagerPendingAction);
  }

  // 4. Loss Prevention (LP) Cases
  const openLp = (state.lpCases || []).filter(c => !c.resolved);
  const lpBadge = document.getElementById('lpCasesCountBadge');
  if (lpBadge) {
    lpBadge.textContent = openLp.length;
    lpBadge.classList.toggle('hidden', openLp.length === 0);
  }
  const hudLp = document.getElementById('hudLpSecurityBadge');
  if (hudLp) {
    hudLp.textContent = openLp.length === 0 ? '🕵️\u200D♂️ أمن LP: مستقر 100%' : `🕵️\u200D♂️ أمن LP: ${openLp.length} تحقيقات جارية`;
  }

  const lpContainer = document.getElementById('lpCasesContainer');
  if (lpContainer) {
    setHtml(lpContainer, (state.lpCases || []).map(lp => {
      let actionButtons = '';
      if (!lp.resolved) {
        if (lp.type === 'emp_theft') {
          actionButtons = `
            <button data-lp-act="fire_thief" data-lp-id="${lp.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-rose-700 hover:bg-rose-600 text-white">
              🚫 استرداد الـ $85 ورفد الموظف فوراً
            </button>
            <button data-lp-act="deduct_thief" data-lp-id="${lp.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-600 hover:bg-amber-500 text-slate-950">
              ⚠️ خصم مضاعف (+$110) وإنذار نهائي
            </button>
          `;
        } else if (lp.type === 'cust_theft') {
          actionButtons = `
            <button data-lp-act="cctv_recover" data-lp-id="${lp.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold sb-btn-gold">
              📹 تفريغ كاميرات 3D واسترداد المسروقات للعميل
            </button>
          `;
        } else if (lp.type === 'lost_found') {
          actionButtons = `
            <button data-lp-act="return_lost" data-lp-id="${lp.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-700 hover:bg-emerald-600 text-white">
              🔐 تحريز بالخزنة وتسليم الأمانة للعميل (+$45 مكافأة)
            </button>
          `;
        } else {
          actionButtons = `
            <button data-lp-act="mediate_staff" data-lp-id="${lp.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-purple-700 hover:bg-purple-600 text-white">
              🤝 جلسة صلح رسمية وفصل جدول الورديات
            </button>
            <button data-lp-act="transfer_fighter" data-lp-id="${lp.id}" class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-600 hover:bg-amber-500 text-slate-950">
              🔄 نقل أحد الموظفين لفرع آخر + خصم ($25)
            </button>
          `;
        }
      }

      return `
        <div class="p-2.5 rounded-xl bg-slate-900/95 border ${lp.resolved ? 'border-emerald-700/50 opacity-75' : 'border-sky-500/80'} space-y-1.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded border ${lp.badgeCls}">${lp.typeBadge}</span>
              <span class="text-xs font-extrabold text-white">${lp.title}</span>
            </div>
            <span class="text-[10px] text-amber-300 font-bold">📍 ${lp.storeName}</span>
          </div>
          <p class="text-[10.5px] text-slate-300 bg-black/30 p-2 rounded-lg">${lp.details}</p>
          <div class="flex flex-wrap items-center justify-end gap-1.5">
            ${lp.resolved
              ? `<span class="text-[11px] font-bold text-emerald-400">✅ ${lp.outcome}</span>`
              : actionButtons
            }
          </div>
        </div>
      `;
    }).join(''));
  }

  // 5. Price Wave & 3D Display Fridge Visual Grid
  const pBadge = document.getElementById('priceIndexBadge');
  if (pBadge) {
    const pct = Math.round((state.priceMultiplier || 1) * 100);
    pBadge.textContent = `مستوى الأسعار: ${pct}% ${pct > 110 ? '🔥 (مرتفع)' : '(طبيعي)'}`;
  }
  const hCount = document.getElementById('statHappyPriceCount');
  if (hCount) hCount.textContent = state.happyPriceCustomers || 14;
  const aCount = document.getElementById('statAngryPriceCount');
  if (aCount) aCount.textContent = state.angryPriceCustomers || 3;

  const fridgeGrid = document.getElementById('fridgeShelvesVisualGrid');
  if (fridgeGrid) {
    const croissants = state.menu.filter(m => m.subGroup === 'croissants' || m.id === 'butter_croissant');
    const sandwiches = state.menu.filter(m => m.subGroup === 'sandwiches' || m.id === 'turkey_panini');
    const cakes = state.menu.filter(m => m.subGroup === 'cakes');

    const renderShelf = (title, icon, items, borderCol) => `
      <div class="bg-[#0b1915] border ${borderCol} rounded-xl p-2.5 space-y-1.5">
        <div class="text-xs font-black text-amber-300 flex items-center justify-between border-b border-emerald-900/80 pb-1">
          <span>${icon} ${title}</span>
          <span class="text-[10px] text-emerald-300">${items.length} أصناف متوفرة</span>
        </div>
        <div class="space-y-1 max-h-[150px] overflow-y-auto pr-1">
          ${items.map(it => {
            const egp = Math.round((it.egpTall || 135) * (it.price / (it.basePrice || it.price || 1)));
            return `
              <div class="flex items-center justify-between gap-1 text-[10.5px] bg-black/30 px-2 py-1 rounded-lg">
                <span class="text-white font-bold truncate">${it.icon} ${it.name.split('(')[0]}</span>
                <span class="font-num font-extrabold text-emerald-400 shrink-0">${egp} ج.م</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    fridgeGrid.innerHTML =
      renderShelf('الرف الأول: الكرواسون والدانش الفرنسي', '🥐', croissants, 'border-amber-500/50') +
      renderShelf('الرف الثاني: الساندويتشات والبانيني الساخن', '🥪', sandwiches, 'border-emerald-500/50') +
      renderShelf('الرف الثالث: التشيز كيك والكيك الفاخر', '🍰', cakes, 'border-pink-500/50');
  }
}

// Hook into spawnCustomerOrder so customers also reacted to price hikes and order lots of new sandwiches/croissants/cakes!
const _v7SpawnOrder = spawnCustomerOrder;
spawnCustomerOrder = function (forcedChannel) {
  const prevLen = state.orders.length;
  _v7SpawnOrder(forcedChannel);
  if (state.orders.length > prevLen) {
    const newest = state.orders[state.orders.length - 1];
    const pMult = state.priceMultiplier || 1.0;
    if (pMult > 1.04) {
      // Some customers love the prestige/quality, others complain about the price hike!
      const isHappy = Math.random() < 0.58;
      newest.priceSentiment = isHappy ? 'happy' : 'angry_price';
      if (isHappy) {
        state.happyPriceCustomers = (state.happyPriceCustomers || 14) + 1;
        newest.price = +(newest.price * 1.15).toFixed(2);
        newest.customerName += ' 😍(مبسوط بالجودة)';
      } else {
        state.angryPriceCustomers = (state.angryPriceCustomers || 3) + 1;
        newest.timeLeft = Math.max(15, Math.round(newest.timeLeft * 0.82));
        newest.customerName += ' 💸(مشتكي من السعر)';
      }
    }
    renderTicketsQueue();
    renderWorkbench();
    renderV8UI();
  }
};

// Periodic Surprise Unannounced NSF Audit & Slowly Drifting Hygiene/Temp
const _v7SimStep = simulationStep;
let v8TickCount = 0;
simulationStep = function () {
  _v7SimStep();
  if (state.paused) return;
  v8TickCount++;
  if (state.nsfAudit) {
    if (v8TickCount % 12 === 0) {
      state.nsfAudit.partnerHygiene = Math.max(55, +(state.nsfAudit.partnerHygiene - 0.8).toFixed(1));
      state.nsfAudit.foodTempAndDates = Math.max(55, +(state.nsfAudit.foodTempAndDates - 0.6).toFixed(1));
    }
    state.nsfAudit.surpriseCountdown = (state.nsfAudit.surpriseCountdown || 95) - 1;
    if (state.nsfAudit.surpriseCountdown <= 0) {
      state.nsfAudit.surpriseCountdown = 110 + Math.floor(Math.random() * 60);
      runSurpriseNsfAudit(false);
    }
  }
};

function setupV8EventListeners() {
  ensureV8StateAndMenu();
  renderMenuTab();
  renderV8UI();

  // Landscape Mode Toggle
  document.getElementById('btnToggleLandscapeMode')?.addEventListener('click', () => {
    initAudio();
    state.landscapeMode = !state.landscapeMode;
    document.body.classList.toggle('portrait-9-16', !!state.landscapeMode);
    renderV8UI();
    setTimeout(resizeCanvas, 60);
    showToast(state.landscapeMode
      ? '📱 تم تفعيل أبعاد البورتريه (9:16) المتناسقة للأيقونات والواجهة!'
      : '🖥️ تم التبديل لعرض الشاشة العريضة.');
  });

  // Quick Jump Buttons in Segmented Command Dock
  const jumpTo = (tabName, elId) => {
    initAudio();
    document.querySelectorAll('.nav-tab').forEach(b => {
      b.classList.toggle('tab-active', b.getAttribute('data-tab') === tabName);
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`)?.classList.remove('hidden');
    if (tabName === 'ops') renderOpsTab();
    if (tabName === 'staff') renderStaffTab();
    if (tabName === 'menu') renderMenuTab();
    renderV8UI();
    if (elId) {
      document.getElementById(elId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  document.getElementById('btnQuickJumpNSF')?.addEventListener('click', () => jumpTo('ops', 'nsfAuditSectionCard'));
  document.getElementById('btnQuickJumpLP')?.addEventListener('click', () => jumpTo('ops', 'lpSecuritySectionCard'));
  document.getElementById('btnQuickJumpResignations')?.addEventListener('click', () => jumpTo('staff', 'resignationsHubSection'));
  document.getElementById('btnQuickJumpFoodFridge')?.addEventListener('click', () => jumpTo('menu', 'priceWaveControlCard'));

  // Price Hike Wave Controls
  const applyMenuPriceWave = (mult, label) => {
    initAudio();
    state.priceMultiplier = mult;
    state.menu.forEach(item => {
      item.price = +(item.basePrice * mult).toFixed(2);
    });
    if (mult > 1.05) {
      // Spawn both a happy customer and a price-complaining customer!
      state.happyPriceCustomers = (state.happyPriceCustomers || 14) + 3;
      state.angryPriceCustomers = (state.angryPriceCustomers || 3) + 2;
      createCustomerComplaint(
        getUniqueCustomerName(),
        'ساندويتش روست بيف + دبل شوت وايت موكا Venti',
        `العميل يشتكي من موجة غلاء الأسعار (${label}) ويطلب تفسيراً أو خصم ولاء Stars، بينما أشاد زبائن آخرون بالجودة العالية!`,
        'medium'
      );
    }
    playSound('cash');
    showToast(`📈 تم تطبيق ${label} على المنيو! بعض الزبائن مبسوطون بالجودة والبرستيج وبعضهم سجل شكوى من غلاء الأسعار.`);
    renderMenuTab();
    renderV8UI();
    updateHUD();
  };

  document.getElementById('btnApplyPriceHike15')?.addEventListener('click', () => applyMenuPriceWave(1.20, 'موجة غلاء الأسعار (+20%)'));
  document.getElementById('btnApplyPriceHike35')?.addEventListener('click', () => applyMenuPriceWave(1.35, 'موجة الغلاء الكبرى (+35%)'));
  document.getElementById('btnLaunchValueCombo')?.addEventListener('click', () => {
    initAudio();
    state.reputation = Math.min(100, +(state.reputation + 3.5).toFixed(1));
    state.happyPriceCustomers = (state.happyPriceCustomers || 14) + 5;
    state.orders.forEach(o => {
      o.priceSentiment = 'happy';
      o.timeLeft = o.maxTime;
    });
    playSound('fanfare');
    showToast('🎟️ أطلقت عرض كومبو (قهوة + كرواسون أو ساندويتش بخصم ولاء)! تحول الزبائن المشتكون من الأسعار إلى زبائن مبسوطين!');
    renderV8UI();
    updateHUD();
  });

  // 3D Display Fridge Restock
  document.getElementById('btnRestockDisplayFridge')?.addEventListener('click', () => {
    initAudio();
    if (state.money < 22) {
      showToast('⚠️ تحتاج إلى $22 لملء ثلاجة العرض بالكرواسون والكيك والساندويتشات الطازجة!');
      return;
    }
    state.money = +(state.money - 22).toFixed(2);
    state.supplies.food = 100;
    state.nsfAudit.foodTempAndDates = 100;
    state.nsfAudit.fridgeTempC = 3.6;
    playSound('fanfare');
    showToast('🥐🍰 تم ملء ثلاجة العرض الزجاجية 3D بالكرواسون الساخن، التشيز كيك، والساندويتشات مع ملصقات Date Dots جديدة!');
    updateHUD();
    renderV8UI();
  });

  // Resignations & Batch Training Controls
  document.getElementById('btnBatchTrainBranchStaff')?.addEventListener('click', () => {
    initAudio();
    if (state.money < 55) {
      showToast('⚠️ تحتاج إلى $55 لعقد برنامج تدريب مكثف لطاقم الفرع!');
      return;
    }
    state.money = +(state.money - 55).toFixed(2);
    state.trainingScore = Math.min(100, (state.trainingScore || 95) + 5);
    state.nsfAudit.partnerHygiene = 100;
    state.staff.forEach(s => {
      s.level += 1;
      s.speedMult = +(s.speedMult + 0.12).toFixed(2);
      s.energy = 100;
    });
    playSound('fanfare');
    showToast('🎓 تم تدريب جميع موظفي الفرع على معايير الباريستا وهايجين الـ NSF ورفع مستواهم!');
    updateHUD();
    renderStaffTab();
    renderV8UI();
  });

  document.getElementById('btnSimulateResignation')?.addEventListener('click', () => {
    initAudio();
    const pool = state.staff.length > 0 ? state.staff : state.allNetworkStaff;
    const emp = pool[Math.floor(Math.random() * pool.length)];
    const reasons = [
      'تلقى عرضاً براتب أعلى في كافيه آخر ويطلب ترقية لمشرف وردية أو علاوة للبقاء.',
      'يشعر بضغط شديد في ساعات الذروة ويطلب برنامج تدريب وتعديل جدول الوردية.',
      'يرغب في الاستقالة بسبب بعد المسافة أو خلاف سابق في الشيفت.'
    ];
    const chosenReason = reasons[Math.floor(Math.random() * reasons.length)];
    state.resignations.unshift({
      id: ++state.nextId,
      staffId: emp.id,
      staffName: emp.name,
      storeName: emp.storeName || state.activeSubStoreName,
      reason: chosenReason,
      resolved: false,
      outcomeText: ''
    });
    pushNewEmail({
      sender: `إدارة الموارد البشرية HR — إخطار استقالة (${emp.name})`,
      roleBadge: 'طلب استقالة 📝',
      subject: `طلب استقالة مقدم من الموظف "${emp.name}" في فرع ${state.activeSubStoreName}`,
      body: `تقدم "${emp.name}" بطلب استقالة رسمي: "${chosenReason}". يمكنك إقناعه بالبقاء عبر ترقيته أو تدريبه، أو قبول الاستقالة وتعيين بديل فوري.`,
      choices: [
        { label: '🤝 إقناع الموظف بالبقاء وترقيته وصرف مكافأة (-$65 / +6% استقرار الفريق)', cost: 65, dmDelta: 5, opsDelta: 6 }
      ]
    });
    renderV8UI();
  });

  document.getElementById('resignationsListContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-resig-action]');
    if (!btn) return;
    initAudio();
    if (!checkRolePermission('supervisor', 'البت في استقالات الموظفين والترقيات')) return;
    const act = btn.getAttribute('data-resig-action');
    const id = Number(btn.getAttribute('data-resig-id'));
    const res = (state.resignations || []).find(r => r.id === id);
    if (!res || res.resolved) return;

    const emp = (state.allNetworkStaff || []).find(s => s.id === res.staffId) || state.staff.find(s => s.id === res.staffId);

    if (act === 'retain_promote') {
      if (state.money < 65) {
        showToast('⚠️ تحتاج إلى $65 لإقناع الموظف بالبقاء واعتماد علاوة الترقية!');
        return;
      }
      state.money = +(state.money - 65).toFixed(2);
      res.resolved = true;
      emit('resignation:resolved', { action: act });
      res.outcomeText = 'تم إقناعه بالبقاء وترقيته لمنصب أعلى بنجاح 🌟';
      if (emp) {
        emp.level += 1;
        emp.speedMult = +(emp.speedMult + 0.18).toFixed(2);
        emp.energy = 100;
        emp.jobCode = 'shift_supervisor';
        emp.name = `${emp.cleanName || emp.name.split('(')[0].trim()} (مشرف وردية)`;
      }
      playSound('fanfare');
      showToast(`🤝 نجحت في إقناع "${res.staffName}" بالبقاء وسحب الاستقالة بعد ترقيته!`);
    } else if (act === 'retain_train') {
      if (state.money < 40) {
        showToast('⚠️ تحتاج إلى $40 لإلحاق الموظف ببرنامج التدريب والتطوير!');
        return;
      }
      state.money = +(state.money - 40).toFixed(2);
      res.resolved = true;
      emit('resignation:resolved', { action: act });
      res.outcomeText = 'سحب الاستقالة وانضم لبرنامج تدريب Coffee Master 🎓';
      if (emp) {
        emp.level += 1;
        emp.speedMult = +(emp.speedMult + 0.14).toFixed(2);
        emp.energy = 100;
      }
      playSound('fanfare');
      showToast(`🎓 سحب "${res.staffName}" استقالته بعد إلحاقه ببرنامج التدريب مع أ. محمود أحمد!`);
    } else {
      if (state.money < 85) {
        showToast('⚠️ تحتاج إلى $85 لصرف مستحقات نهاية الخدمة وتعيين موظف بديل فوراً!');
        return;
      }
      state.money = +(state.money - 85).toFixed(2);
      res.resolved = true;
      emit('resignation:resolved', { action: act });
      const newName = getUniqueCustomerName();
      res.outcomeText = `تم قبول الاستقالة وتعيين البديل "${newName} (باريستا معتمد)" فوراً ✅`;
      if (emp) {
        emp.cleanName = newName;
        emp.name = `${newName} (باريستا معتمد)`;
        emp.level = 1;
        emp.energy = 100;
        emp.deductionsCount = 0;
      }
      playSound('step');
      showToast(`📝 تم قبول استقالة الموظف وتعيين البديل "${newName}" فوراً للحفاظ على قوة الفرع!`);
    }
    updateHUD();
    renderStaffTab();
    renderV8UI();
  });

  // NSF Audit Controls & Store Manager Disciplinary Buttons
  document.getElementById('btnBoostPartnerHygiene')?.addEventListener('click', () => {
    initAudio();
    state.nsfAudit.partnerHygiene = 100;
    playSound('step');
    showToast('🧼 تم فحص هايجين جميع الموظفين: غسيل الأيدي 100%، المرايل نظيفة، وأغطية الرأس ملتزمة بمعايير NSF!');
    renderV8UI();
  });

  document.getElementById('btnCheckDateDotsAndTemp')?.addEventListener('click', () => {
    initAudio();
    if (state.money < 12) {
      showToast('⚠️ تحتاج إلى $12 لتجديد ملصقات الصلاحية وفحص الثرموستات!');
      return;
    }
    state.money = +(state.money - 12).toFixed(2);
    state.nsfAudit.foodTempAndDates = 100;
    state.nsfAudit.fridgeTempC = 3.6;
    playSound('step');
    showToast('🌡️ تم ضبط حرارة ثلاجة الكرواسون والكيك عند 3.6°C وتجديد ملصقات الصلاحية (Date Dots) بالكامل!');
    updateHUD();
    renderV8UI();
  });

  document.getElementById('btnRefreshSanitizerBuckets')?.addEventListener('click', () => {
    initAudio();
    if (state.money < 10) {
      showToast('⚠️ تحتاج إلى $10 لتجديد محلول التعقيم Quat Sanitizer!');
      return;
    }
    state.money = +(state.money - 10).toFixed(2);
    state.nsfAudit.sanitizerPpm = 200;
    state.cleanliness = 100;
    playSound('step');
    showToast('🧪 تم ضبط محلول التعقيم عند 200 ppm وتعقيم ملاقط الفرن وعصا البخار لمعايير الـ NSF!');
    updateHUD();
    renderV8UI();
  });

  document.getElementById('btnTriggerSurpriseNSF')?.addEventListener('click', () => {
    initAudio();
    runSurpriseNsfAudit(true);
  });

  document.getElementById('btnNsfFireStoreManager')?.addEventListener('click', () => {
    initAudio();
    const sm = state.staff[0];
    const oldName = sm ? sm.name : 'مدير الفرع المقصر';
    const newSmName = getUniqueCustomerName();
    if (sm) {
      sm.cleanName = newSmName;
      sm.name = `${newSmName} (مدير فرع جديد - معتمد NSF)`;
      sm.level = 4;
      sm.speedMult = 1.45;
      sm.energy = 100;
    }
    state.nsfAudit.failedManagerPendingAction = false;
    state.nsfAudit.partnerHygiene = 98;
    state.nsfAudit.foodTempAndDates = 98;
    state.opsScore = Math.min(100, +(state.opsScore + 8).toFixed(1));
    playSound('fanfare');
    showToast(`🚫 تم رفد مدير الفرع المقصر "${oldName}" بسبب رسوب الـ NSF، وتعيين "${newSmName}" لإعادة الفرع إلى GREEN!`);
    updateHUD();
    renderStaffTab();
    renderV8UI();
  });

  document.getElementById('btnNsfTransferAndDeductSM')?.addEventListener('click', () => {
    initAudio();
    const sm = state.staff[0];
    const oldStore = state.activeSubStoreName || 'Nile City Cairo';
    const quietTarget = 'Gate Way';
    if (sm) {
      sm.deductionsCount = (sm.deductionsCount || 0) + 2;
    }
    state.nsfAudit.failedManagerPendingAction = false;
    state.ActiveTransferredFrom = oldStore;
    state.activeSubStoreName = quietTarget;
    syncActiveStoreStaffIntoState();
    playSound('ding');
    showToast(`🔄 تم توقيع خصم مالي صارم (-$120) ونقل مدير الفرع من "${oldStore}" إلى فرع "${quietTarget}" بسبب النزول عن GREEN في زيارة الـ NSF!`);
    updateHUD();
    renderStaffTab();
    renderV8UI();
  });

  // Loss Prevention (LP) Controls & 4 Investigation Scenarios
  const spawnLpCaseByType = (typeKey) => {
    initAudio();
    const curStore = state.activeSubStoreName || 'Nile City Cairo';
    const emp1 = state.staff[Math.floor(Math.random() * state.staff.length)] || { cleanName: 'سامح النجار' };
    const emp2 = state.staff[(Math.floor(Math.random() * state.staff.length) + 1) % Math.max(1, state.staff.length)] || { cleanName: 'طارق سليم' };
    const cust = getUniqueCustomerName();

    const map = {
      emp_theft: {
        type: 'emp_theft',
        typeBadge: '💸 سرقة موظف / عجز كاشير',
        badgeCls: 'bg-rose-950 text-rose-200 border-rose-500',
        title: `تحقيق LP: رصد سرقة وعجز ($85) في درج الكاشير بواسطة "${emp1.cleanName || emp1.name}"`,
        details: 'أظهرت كاميرات المراقبة CCTV وتقرير جرد الخزنة قيام الموظف بإلغاء فاتورتين نقديتين وعدم توريد قيمتهما بالدرج.'
      },
      cust_theft: {
        type: 'cust_theft',
        typeBadge: '👜 سرقة متعلقات عميل',
        badgeCls: 'bg-amber-950 text-amber-200 border-amber-500',
        title: `بلاغ سرقة هاتف ومحفظة للعميل "${cust}" داخل صالة الفرع`,
        details: 'أبلغ العميل مفتش الـ LP عن اختفاء محفظته وهاتفه من على الطاولة أثناء استلام مشروبه من البار.'
      },
      lost_found: {
        type: 'lost_found',
        typeBadge: '🔍 مفقودات عميل (Lost & Found)',
        badgeCls: 'bg-emerald-950 text-emerald-200 border-emerald-500',
        title: `مفقودات عميل: العثور على ساعة ذكية ومفاتيح سيارة للعميل "${cust}"`,
        details: 'عثر باريستا الـ CS على المتعلقات تحت الكرسي الثلاثي الأبعاد. يجب تحريزها في خزنة الـ LP وتسليمها للعميل.'
      },
      staff_fight: {
        type: 'staff_fight',
        typeBadge: '⚡ خلاف حاد بين موظفين',
        badgeCls: 'bg-purple-950 text-purple-200 border-purple-500',
        title: `خلاف ومشادة بين "${emp1.cleanName || emp1.name}" و"${emp2.cleanName || emp2.name}" أثناء الذروة`,
        details: 'تصاعد خلاف بين الموظفين حول توزيع مهام البار الساخن والبارد، مما يتطلب تدخل الـ LP ومدير الفرع فوراً.'
      }
    };

    const tpl = map[typeKey] || map.emp_theft;
    state.lpCases.unshift({
      id: ++state.nextId,
      type: tpl.type,
      typeBadge: tpl.typeBadge,
      badgeCls: tpl.badgeCls,
      storeName: curStore,
      title: tpl.title,
      details: tpl.details,
      resolved: false,
      outcome: ''
    });
    playSound('ding');
    showToast(`🕵️\u200D♂️ سجل مفتش الـ LP ملف تحقيق جديد: ${tpl.typeBadge}!`);
    renderV8UI();
  };
  spawnLpCaseFn = spawnLpCaseByType;

  document.getElementById('btnTriggerLpVisit')?.addEventListener('click', () => {
    initAudio();
    startInspectionVisit(true, '🕵️\u200D♂️ مفتش الـ LP (مراجعة الكاميرات وجرد الخزنة وأمن الصالة)');
  });

  document.getElementById('btnSimulateLpIncident')?.addEventListener('click', () => {
    const types = ['emp_theft', 'cust_theft', 'lost_found', 'staff_fight'];
    spawnLpCaseByType(types[Math.floor(Math.random() * types.length)]);
  });

  document.querySelectorAll('[data-spawn-lp]').forEach(btn => {
    btn.addEventListener('click', () => {
      spawnLpCaseByType(btn.getAttribute('data-spawn-lp'));
    });
  });

  document.getElementById('lpCasesContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lp-act]');
    if (!btn) return;
    initAudio();
    const act = btn.getAttribute('data-lp-act');
    const id = Number(btn.getAttribute('data-lp-id'));
    const lp = (state.lpCases || []).find(c => c.id === id);
    if (!lp || lp.resolved) return;

    lp.resolved = true;
    emit('lp:resolved', { type: lp.type, action: act });
    if (act === 'fire_thief') {
      state.money = +(state.money + 85).toFixed(2);
      state.opsScore = Math.min(100, +(state.opsScore + 5).toFixed(1));
      lp.outcome = 'تم استرداد المبلغ المسروق (+$85) وفصل الموظف السارق وتعيين بديل أمين ✅';
      showToast('🕵️\u200D♂️ تم استرداد الـ $85 للخزنة وفصل الموظف المخالف بموجب تحقيق الـ LP!');
    } else if (act === 'deduct_thief') {
      state.money = +(state.money + 110).toFixed(2);
      lp.outcome = 'تم استرداد العجز مع غرامة مضاعفة (+$110) وتوقيع إنذار نهائي ✅';
      showToast('⚠️ تم تحصيل العجز مع غرامة انضباطية (+$110) وتوقيع تعهد رقابي صارم!');
    } else if (act === 'cctv_recover') {
      state.reputation = Math.min(100, +(state.reputation + 4.0).toFixed(1));
      state.dmSatisfaction = Math.min(100, +(state.dmSatisfaction + 4.0).toFixed(1));
      lp.outcome = 'تم تفريغ كاميرات 3D وضبط السارق وإعادة المتعلقات للعميل مع مشروب ضيافة ✅';
      showToast('📹 نجح مفتش الـ LP في تحديد السارق عبر الكاميرات وإعادة متعلقات العميل كاملة!');
    } else if (act === 'return_lost') {
      state.money = +(state.money + 45).toFixed(2);
      state.reputation = Math.min(100, +(state.reputation + 3.5).toFixed(1));
      lp.outcome = 'تم تسليم المفقودات للعميل بمحضر أمانات رسمي (+$45 مكافأة أمانة) ✅';
      showToast('🔐 استلم العميل مفقوداته من خزنة الـ LP وشكر إدارة الفرع (+$45 مكافأة)!');
    } else if (act === 'mediate_staff') {
      state.staff.forEach(s => { s.energy = 100; });
      state.opsScore = Math.min(100, +(state.opsScore + 4).toFixed(1));
      lp.outcome = 'تم عقد جلسة صلح رسمية وفصل جدول الورديات بين الموظفين وعاد الهدوء للبار ✅';
      showToast('🤝 تم فض الخلاف بين الموظفين وتوزيعهم على ورديات منفصلة بنجاح!');
    } else if (act === 'transfer_fighter') {
      state.money = +(state.money + 25).toFixed(2);
      lp.outcome = 'تم توقيع خصم انضباطي (+$25) ونقل أحد الموظفين لفرع آخر لمنع تكرار المشادة ✅';
      showToast('🔄 تم نقل أحد طرفي النزاع لفرع آخر وتوقيع خصم انضباطي لضبط البار!');
    }
    playSound('fanfare');
    updateHUD();
    renderV8UI();
  });
}

export function startGame(options = {}) {
  setTimeout(setupV7EventListeners, 50);
  setTimeout(setupV8EventListeners, 90);

  if (options.savedState) loadSavedState(options.savedState);
  ensure500NetworkStaffAndMetadata();
  const registeredName = hooks.playerName ? hooks.playerName() : '';
  if (registeredName) {
    state.playerProfile.name = registeredName;
    const nameInput = document.getElementById('inputPlayerName');
    if (nameInput) {
      nameInput.value = registeredName;
      nameInput.readOnly = true;
    }
  }
  if (state.playerProfile && state.playerProfile.onboardingDone) {
    document.getElementById('openingScreenModal')?.classList.add('hidden');
  }
  resizeCanvas();
  setupEventListeners();

  spawnCustomerOrder('cafe');
  spawnCustomerOrder('drive_thru');

  updateHUD();
  renderTicketsQueue();
  renderWorkbench();
  renderStaffTab();
  renderInboxTab();
  renderOpsTab();
  renderMenuTab();
  renderUpgradesTab();
  renderMissionsTab();
  renderBranchesTab();

  if (mainIntervalId) clearInterval(mainIntervalId);
  mainIntervalId = setInterval(simulationStep, 1000);
  requestAnimationFrame(renderCanvasScene);
  emit('game:started', {});
}

// What the new systems may read and call. Functions are wrapped so a later
// re-assignment (the V7/V8 layers wrap several renderers) is always the one called.
export const game = {
  get state() { return state; },
  saveNow: () => saveGameState(),
  showToast: (msg) => showToast(msg),
  playSound: (type) => playSound(type),
  initAudio: () => initAudio(),
  pushNewEmail: (tpl, subject, body) => pushNewEmail(tpl, subject, body),
  updateHUD: () => updateHUD(),
  renderTicketsQueue: () => renderTicketsQueue(),
  renderWorkbench: () => renderWorkbench(),
  renderStaffTab: () => renderStaffTab(),
  renderInboxTab: () => renderInboxTab(),
  renderOpsTab: () => renderOpsTab(),
  renderMenuTab: () => renderMenuTab(),
  renderUpgradesTab: () => renderUpgradesTab(),
  renderMissionsTab: () => renderMissionsTab(),
  renderBranchesTab: () => renderBranchesTab(),
  renderV8UI: () => renderV8UI(),
  getActiveBranch: () => getActiveBranch(),
  getActiveBranchStaff: () => getActiveBranchStaff(),
  getStoreTeam: () => getBranchStaff(state.activeBranchId),
  getUpgradeLevel: (id) => getUpgradeLevel(id),
  addFloatingText: (text, x, y, color) => addFloatingText(text, x, y, color),
  spawnSparkles: (x, y, color) => spawnSparkles(x, y, color),
  checkRolePermission: (level, title) => checkRolePermission(level, title),
  spawnCustomerOrder: (channel) => spawnCustomerOrder(channel),
  createCustomerComplaint: (name, drink, issue, severity) => createCustomerComplaint(name, drink, issue, severity),
  startInspectionVisit: (manual, title) => startInspectionVisit(manual, title),
  runSurpriseNsfAudit: (manual) => runSurpriseNsfAudit(manual),
  sendBaristaToBreak: (id, auto) => sendBaristaToBreak(id, auto),
  getPassiveIncomePerSec: () => getPassiveIncomePerSec(),
  formatDayClock: (mins) => formatDayClock(mins),
  syncActiveStoreStaffIntoState: () => syncActiveStoreStaffIntoState(),
  ensureNetwork: () => ensure500NetworkStaffAndMetadata(),
  getUniqueName: () => getUniqueCustomerName(),
  spawnLpCase: (typeKey) => (spawnLpCaseFn ? spawnLpCaseFn(typeKey) : undefined),
  ROLE_PERMISSIONS_META,
  STATION_ROLES,
  STEP_LABELS
};
