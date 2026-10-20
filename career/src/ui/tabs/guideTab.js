// Guide tab: how the new systems work and the standards they are built on —
// the same facts the certification exams ask about.
import { LABOR_TARGET } from '../../systems/shift/shift.js'
import { $, setHtml } from '../dom.js'
import { section } from '../section.js'

const table = (head, rows) => `
  <div class="overflow-x-auto">
    <table class="w-full text-[11px] text-emerald-100 border-separate border-spacing-y-1">
      <thead><tr>${head.map((h) => `<th class="text-right font-extrabold text-[#CBA258] px-2 py-1">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr class="bg-[#0b1915]">${r.map((c, i) => `<td class="px-2 py-1.5 ${i === 0 ? 'font-extrabold text-white rounded-r-lg' : ''} ${i === r.length - 1 ? 'rounded-l-lg' : ''} font-num">${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`

const bullets = (items) => `<ul class="space-y-1.5 text-[11px] text-emerald-100 leading-relaxed">${items.map((t) => `<li class="flex gap-1.5"><span class="text-[#CBA258]">•</span><span>${t}</span></li>`).join('')}</ul>`

export function installGuideTab() {
  const root = $('sbcGuideRoot')
  if (!root) return { render() {} }
  function render() {
    setHtml(
      root,
      `
      <div class="sb-card rounded-2xl p-3.5 shadow-xl">
        <div class="border-b border-emerald-800/60 pb-2.5 mb-3">
          <h3 class="text-sm font-extrabold text-[#CBA258]">📘 الدليل والمعايير</h3>
          <p class="text-[11px] text-emerald-200/80">إزاي تلعب المسيرة الجديدة، والمعايير الحقيقية اللي مبنية عليها الاختبارات والمشكلات والوردية.</p>
        </div>
        ${bullets([
          '<strong>الألف مهمة:</strong> 5 مهام نشطة دائماً من الفصل الحالي. «خلال يوم/وردية» تبدأ من جديد مع كل يوم أو وردية، و«متتالية» تنكسر بأول خطأ. أنهِ الألف ليُكتب اسمك مع مديري المناطق.',
          '<strong>الوردية:</strong> 3 ورديات يومياً (افتتاح 6ص – ذروة 11ص – إغلاق 4م). كل وردية لها تقرير بتقدير من A+ إلى F حسب الخدمة والعمالة والراحات وDRB والجودة والمشكلات.',
          '<strong>المشكلات المعقدة:</strong> تظهر فجأة بعداد تنازلي. كل قرار له تأثير فوري وأحياناً تبعات بعد ساعات. القرارات المعلّمة 🔒 تحتاج صلاحية مشرف أو مدير — كباريستا تقدر تبلّغ المشرف.',
          '<strong>الترقيات:</strong> كل ترقية = مهام + مؤشرات أداء من ورديات حقيقية + شهادة + مقابلة أمام اللجنة (70% للنجاح). الرسوب = انتظار يوم كامل.',
          '<strong>الحفظ:</strong> كل تقدمك يتحفظ تلقائياً على الجهاز وعلى حسابك، ولا يضيع بالخروج. «إعادة ضبط الفرع» لا تمس مسيرتك ولا مهامك.',
        ])}
      </div>
      ${section(
        '☕ الأكواب والمضخات والشوت',
        'معايير البار التي تسأل عنها شهادة «أساسيات الباريستا».',
        table(
          ['الحجم', 'السعة', 'مضخات السيرب', 'شوتات (لاتيه)'],
          [
            ['Short', '8 أونصات', '2', '1'],
            ['Tall', '12 أونصة', '3', '1'],
            ['Grande', '16 أونصة', '4', '2'],
            ['Venti ساخن', '20 أونصة', '5', '2'],
            ['Venti مثلج', '24 أونصة', '6', '3'],
          ],
        ) +
          bullets([
            'شوت الإسبريسو الصحيح <strong>من 18 إلى 23 ثانية</strong>: أسرع = طحنة خشنة (نعّم)، أبطأ = طحنة ناعمة (خشّن).',
            'خطوات التذوق: <strong>Smell → Slurp → Locate → Describe</strong>.',
            'الثلج بالمغرفة المخصصة فقط — ولو انكسر زجاج قرب الثلج: <strong>«Burn the ice»</strong> وتعقيم الصندوق.',
          ]),
        'emerald',
      )}
      ${section(
        '💚 خدمة العملاء (Green Apron Service)',
        '',
        bullets([
          'هدف ستاربكس منذ 2025: تسليم الطلب في <strong>4 دقائق</strong> للصالة والدرايف ثرو، وطلبات الموبايل في الوقت المحدد لها.',
          'نموذج الاعتذار <strong>LATTE</strong>: Listen (استمع) • Acknowledge (اعترف) • Take action (تصرّف) • Thank (اشكر) • Explain (وضّح).',
          'الترحيب والاقتراح المناسب (Upsell) يرفع رضا الزبون والبقشيش — بدون إلحاح.',
        ]),
        'amber',
      )}
      ${section(
        '🛡️ سلامة الغذاء و DRB',
        'ما تراجعه زيارة NSF / QASA في دفتر السجلات اليومي.',
        table(
          ['البند', 'المعيار', 'الإجراء لو خارج المعيار'],
          [
            ['حرارة الثلاجات', '5°م (41°ف) أو أقل', '5–7°م اضبط وأعد القياس • فوق 7°م أعدم الأصناف واطلب صيانة'],
            ['محلول التعقيم', '150 – 400 ppm', 'أقل: محلول جديد • أعلى: خفّف'],
            ['جرادل التعقيم', 'كل 4 ساعات', 'غيّر المحلول والجرادل'],
            ['المخبوزات', 'Day Dots بتاريخ اليوم', 'سحب المنتهي وتسجيله في الهدر'],
            ['غسيل اليدين', '20 ثانية على الأقل', 'قبل التحضير وبعد أي تلوث'],
          ],
        ),
        'sky',
      )}
      ${section(
        '⚖️ قانون العمل والعمالة',
        'قانون العمل المصري رقم 14 لسنة 2025.',
        bullets([
          'ساعات العمل: <strong>8 ساعات يومياً و48 أسبوعياً</strong> بحد أقصى (المادة 117).',
          'راحة لا تقل عن <strong>ساعة</strong> بحيث لا يعمل أحد أكثر من <strong>5 ساعات متصلة</strong> (المادة 118). في اللعبة تُحسب المخالفة عند تجاوز 5 ساعات بدون راحة 20 دقيقة على الأقل.',
          'المدى الكامل ليوم العمل لا يتجاوز 10 ساعات (المادة 119).',
          `نسبة العمالة المستهدفة في اللعبة: <strong>${LABOR_TARGET.min}% – ${LABOR_TARGET.max}%</strong> من المبيعات. أعلى = تكلفة زائدة (انصراف مبكر)، أقل مع زبائن غاضبين = نقص (استدعاء).`,
        ]),
        'purple',
      )}
      ${section(
        '🧑\u200D💼 الصلاحيات حسب المنصب',
        '',
        table(
          ['المنصب', 'ما يستطيع'],
          [
            ['باريستا / مدرب', 'البار والطلبات، الراحة، DRB، قائمة الافتتاح/الإغلاق، إبلاغ المشرف'],
            ['مشرف وردية', 'توزيع المحطات، الاستدعاء والانصراف المبكر، عدّ الدرج، قرارات الأزمات الأساسية'],
            ['مساعد مدير / مدير فرع', 'كل ما سبق + التعيين والنقل والخصومات والقرارات المالية الكبيرة'],
          ],
        ),
        'indigo',
      )}`,
    )
  }
  return { render }
}
