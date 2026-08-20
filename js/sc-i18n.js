// ============================================================================
// SecondChance Collective — Arabic / English
//
// The site is 88 exported HTML pages with English baked into the markup, so
// rather than re-author every page this walks the DOM and swaps text against a
// dictionary keyed on the exact English string. Anything not in the dictionary
// is left alone, which is deliberate: an untranslated word is survivable, a
// mistranslated price is not.
//
// Kept in English on purpose:
//   · the wordmark "SecondChance collective"
//   · designer names (Chanel, Hermès, Loro Piana…)
//   · payment rails (Visa, Mastercard, CliQ, eFAWATEERcom)
//   · listing references (SC-000123)
// ============================================================================

const AR = {
  // --- global navigation -------------------------------------------------
  'Shop': 'تسوّق',
  'Sell': 'بيع',
  'Sell now': 'ابدأ البيع',
  'List an item': 'أضف قطعة',
  'Sign in': 'تسجيل الدخول',
  'Sign out': 'تسجيل الخروج',
  'Sign up': 'إنشاء حساب',
  'Create account': 'إنشاء حساب',
  'Members': 'الأعضاء',
  'Home': 'الرئيسية',
  'Search': 'بحث',
  'Search listings': 'ابحث في القطع',
  'Skip to content': 'تخطَّ إلى المحتوى',
  'Menu': 'القائمة',
  'Close': 'إغلاق',
  'Back': 'رجوع',
  'Next': 'التالي',
  'Previous': 'السابق',
  'Loading…': 'جارٍ التحميل…',
  'Show more': 'عرض المزيد',

  // --- categories --------------------------------------------------------
  'All': 'الكل',
  'All categories': 'كل الفئات',
  'All brands': 'كل الماركات',
  'New in': 'وصل حديثًا',
  'Bags': 'حقائب',
  'Womenswear': 'أزياء نسائية',
  'Menswear': 'أزياء رجالية',
  'Shoes': 'أحذية',
  'Watches': 'ساعات',
  'Jewellery': 'مجوهرات',
  'Accessories': 'إكسسوارات',
  'Vintage': 'قطع كلاسيكية',
  'Categories': 'الفئات',
  'Brands': 'الماركات',

  // --- homepage ----------------------------------------------------------
  'Buy and sell pre-owned luxury in Jordan.': 'بيع واشترِ قطع الفخامة المستعملة في الأردن.',
  'Every piece over JOD 350 is authenticated by our experts before it reaches you.':
    'كل قطعة تتجاوز ٣٥٠ دينارًا يفحصها خبراؤنا قبل أن تصلك.',
  'Every piece over JOD 350 authenticated': 'توثيق كل قطعة فوق ٣٥٠ دينارًا',
  'Just listed': 'أُضيفت للتو',
  'Nothing counterfeit gets through.': 'لا مجال للتقليد.',
  'pieces authenticated': 'قطعة موثّقة',
  'How it works': 'كيف تعمل المنصّة',

  // --- listing card & detail ---------------------------------------------
  'Buy now': 'اشترِ الآن',
  'Buy it now': 'اشترِ الآن',
  'with protection': 'مع حماية المشتري',
  '% off': '٪ خصم',
  'off': 'خصم',
  'Size': 'المقاس',
  'Colour': 'اللون',
  'Color': 'اللون',
  'Condition': 'الحالة',
  'Category': 'الفئة',
  'Brand': 'الماركة',
  'Listed': 'المعروضة',
  'Reference': 'الرقم المرجعي',
  'Authenticated': 'موثّقة',
  'Verified seller': 'بائع موثّق',
  'Verified': 'موثّق',
  'Featured': 'مميّزة',
  'Sold': 'مُباعة',
  'Reserved': 'محجوزة',
  'From the seller': 'من البائع',
  'Save this piece': 'احفظ القطعة',
  'Saved': 'المحفوظات',
  'Report': 'إبلاغ',
  'Report a listing': 'الإبلاغ عن قطعة',
  'Report this listing': 'الإبلاغ عن هذه القطعة',
  'views': 'مشاهدة',
  'saved': 'حفظ',
  'This piece has sold.': 'بيعت هذه القطعة.',
  'Find something similar': 'ابحث عن قطعة مشابهة',
  'Shop all': 'تسوّق كل القطع',
  'Newest first': 'الأحدث أولًا',
  'Price: low to high': 'السعر: من الأقل للأعلى',
  'Price: high to low': 'السعر: من الأعلى للأقل',
  'Most viewed': 'الأكثر مشاهدة',
  'Clear filters': 'مسح عوامل التصفية',
  'Search pieces': 'ابحث عن قطعة',
  'Nothing matches': 'لا نتائج مطابقة',
  'Price': 'السعر',

  // --- conditions --------------------------------------------------------
  'New with tags': 'جديدة مع البطاقة',
  'New without tags': 'جديدة بدون بطاقة',
  'Very good': 'بحالة ممتازة',
  'Good': 'بحالة جيدة',
  'Fair': 'بحالة مقبولة',

  // --- selling -----------------------------------------------------------
  'Your listings': 'قطعك المعروضة',
  'Seller fees': 'عمولة البائع',
  'Pricing your piece': 'تسعير قطعتك',
  'Pickup and delivery': 'الاستلام والتوصيل',
  'Publish listing': 'انشر القطعة',
  'Save as draft': 'احفظ كمسودّة',
  'Photos': 'الصور',
  'Front': 'الأمام',
  'Back': 'الخلف',
  'Detail': 'تفصيل',
  'Label': 'البطاقة',
  'Title': 'العنوان',
  'Description': 'الوصف',
  'Notes': 'ملاحظات',
  'Asking price': 'السعر المطلوب',
  'Original retail': 'سعر التجزئة الأصلي',
  'What you take home': 'ما ستحصل عليه',
  'Commission': 'العمولة',

  // --- trust -------------------------------------------------------------
  'Buyer Protection': 'حماية المشتري',
  'Trust and safety': 'الثقة والأمان',
  'Authentication': 'التوثيق',
  'Returns and refunds': 'الإرجاع والاسترداد',
  'Returns': 'الإرجاع',
  'Authenticity': 'الأصالة',

  // --- help / footer -----------------------------------------------------
  'Help': 'المساعدة',
  'Help centre': 'مركز المساعدة',
  'Contact us': 'تواصل معنا',
  'About us': 'من نحن',
  'About': 'من نحن',
  'Track an order': 'تتبّع طلبك',
  'Terms': 'الشروط',
  'Privacy': 'الخصوصية',
  'Cookies': 'ملفات الارتباط',
  'Jordan': 'الأردن',
  'FAQs': 'الأسئلة الشائعة',

  // --- account -----------------------------------------------------------
  'Account': 'حسابي',
  'Profile': 'الملف الشخصي',
  'Overview': 'نظرة عامة',
  'Purchases': 'مشترياتي',
  'Sales': 'مبيعاتي',
  'Orders': 'الطلبات',
  'Payouts': 'التحويلات',
  'Notifications': 'الإشعارات',
  'Settings': 'الإعدادات',
  'Email': 'البريد الإلكتروني',
  'Password': 'كلمة المرور',
  'Phone': 'رقم الهاتف',
  'Mobile number': 'رقم الجوال',
  'Full name': 'الاسم الكامل',
  'Username': 'اسم المستخدم',
  'City': 'المدينة',
  'Area': 'المنطقة',
  'Address': 'العنوان',
  'Save changes': 'حفظ التغييرات',
  'Cancel': 'إلغاء',
  'Confirm': 'تأكيد',
  'Delete': 'حذف',
  'Edit': 'تعديل',
  'Open': 'فتح',

  // --- auth --------------------------------------------------------------
  'Forgot password?': 'نسيت كلمة المرور؟',
  'Reset password': 'إعادة تعيين كلمة المرور',
  'Remember me': 'تذكّرني',
  'Already have an account?': 'لديك حساب بالفعل؟',
  'Verify': 'تأكيد',
  'Resend code': 'إعادة إرسال الرمز',
  'Send a new link': 'أرسل رابطًا جديدًا',
  'Go to your account': 'اذهب إلى حسابك',
  'Start browsing': 'ابدأ التصفّح',
  'Try signing in': 'جرّب تسجيل الدخول',

  // --- checkout ----------------------------------------------------------
  'Checkout': 'إتمام الشراء',
  'Place order': 'تأكيد الطلب',
  'Order placed': 'تم استلام طلبك',
  'What you pay': 'ما ستدفعه',
  'Item': 'القطعة',
  'Delivery': 'التوصيل',
  'Delivery notes': 'ملاحظات التوصيل',
  'Free': 'مجانًا',
  'Total': 'المجموع',
  'Where it goes': 'عنوان التوصيل',
  'How you pay': 'طريقة الدفع',
  'Discount code': 'رمز الخصم',
  'Cash on delivery': 'الدفع عند الاستلام',
  'optional': 'اختياري',
  'See my order': 'عرض طلبي',

  // --- statuses ----------------------------------------------------------
  'Active': 'نشطة',
  'Pending': 'قيد المراجعة',
  'Draft': 'مسودّة',
  'Approved': 'مقبولة',
  'Rejected': 'مرفوضة',
  'Cancelled': 'ملغاة',
  'Shipped': 'تم الشحن',
  'Delivered': 'تم التسليم',
  'Paid': 'مدفوعة',
  'Refunded': 'مستردّة',

  // --- picked up from a coverage sweep of the exported pages -------------
  'Every piece over JOD 350 is authenticated before it reaches you.':
    'كل قطعة تتجاوز ٣٥٠ دينارًا موثّقة قبل أن تصلك.',
  'One size': 'مقاس واحد',
  'No reduction': 'بدون تخفيض',
  'Refine your search': 'حسّن بحثك',
  'Search results': 'نتائج البحث',
  'Recent searches': 'عمليات بحث سابقة',
  'Trending': 'الأكثر رواجًا',
  'No results': 'لا نتائج',
  'Filters': 'التصفية',
  'Sort': 'الترتيب',
  'Apply': 'تطبيق',
  'Reset': 'إعادة تعيين',
  'Follow': 'متابعة',
  'Message seller': 'راسل البائع',
  'Ask a question': 'اسأل سؤالًا',
  'Similar pieces': 'قطع مشابهة',
  'You may also like': 'قد يعجبك أيضًا',
  'Recently viewed': 'شاهدتها مؤخرًا',
  'View all': 'عرض الكل',
  'See all': 'عرض الكل',
  'Learn more': 'اعرف المزيد',
  'Read more': 'اقرأ المزيد',
  'Get started': 'ابدأ الآن',
  'Continue': 'متابعة',
  'Submit': 'إرسال',
  'Send': 'إرسال',
  'Done': 'تم',
  'Yes': 'نعم',
  'No': 'لا',
  'Or': 'أو',
  'and': 'و',
  'Free pickup': 'استلام مجاني',
  'Fast delivery': 'توصيل سريع',
  'Secure payment': 'دفع آمن',
  'Money back guarantee': 'ضمان استرداد المال',
  'Was': 'كان',
  'Now': 'الآن',
  'New': 'جديد',
  'Popular': 'رائج',
  'Sale': 'تخفيضات',
  'Newsletter': 'النشرة البريدية',
  'Subscribe': 'اشترك',
  'Follow us': 'تابعنا',
  'Payment methods': 'طرق الدفع',
  'Currency': 'العملة',
  'Country': 'الدولة',
  'Language': 'اللغة',
  'All rights reserved.': 'جميع الحقوق محفوظة.',
};

// Strings that must never be translated, even if a key happens to match.
const KEEP_EN = /^(SecondChance|collective|SecondChance Collective|Visa|Mastercard|CliQ|eFAWATEERcom|JOD|SC-\d+)$/i;

const STORAGE_KEY = 'sc-lang';
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'NOSCRIPT', 'CODE', 'PRE']);

export function currentLang() {
  return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en';
}

// Prices and counts: Jordan uses Western digits in commerce, so pin the
// numbering system rather than letting ar-JO default to Arabic-Indic.
export function locale() {
  return currentLang() === 'ar' ? 'ar-JO-u-nu-latn' : 'en-JO';
}

function translateNode(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (SKIP_TAGS.has(node.parentNode?.nodeName)) return NodeFilter.FILTER_REJECT;
      return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const raw = node.nodeValue;
    const key = raw.trim();
    if (KEEP_EN.test(key)) continue;

    const hit = AR[key];
    if (!hit) continue;

    // keep the original leading/trailing whitespace so inline layout holds
    if (!node.$en) node.$en = raw;
    node.nodeValue = raw.replace(key, hit);
  }

  // attributes that surface as visible text
  for (const el of root.querySelectorAll('[placeholder],[aria-label],[title]')) {
    for (const attr of ['placeholder', 'aria-label', 'title']) {
      const val = el.getAttribute(attr);
      if (!val || KEEP_EN.test(val.trim())) continue;
      const hit = AR[val.trim()];
      if (!hit) continue;
      if (!el.dataset['en' + attr]) el.dataset['en' + attr] = val;
      el.setAttribute(attr, hit);
    }
  }
}

function restoreNode(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.$en) node.nodeValue = node.$en;
  }
  for (const el of root.querySelectorAll('[placeholder],[aria-label],[title]')) {
    for (const attr of ['placeholder', 'aria-label', 'title']) {
      const saved = el.dataset['en' + attr];
      if (saved) el.setAttribute(attr, saved);
    }
  }
}

export function applyLang(lang) {
  const html = document.documentElement;

  // Deliberately no fade. Animating opacity on <html> promotes the whole
  // document to a composited layer, which switches every glyph from subpixel
  // to grayscale antialiasing — the page comes back looking veiled. Switching
  // instantly is also simply faster to read.
  {
    const finish = () => {
    if (lang === 'ar') {
      html.setAttribute('lang', 'ar-JO');
      html.setAttribute('dir', 'rtl');
      html.classList.add('sc-ar');
      translateNode(document.body);
    } else {
      html.setAttribute('lang', 'en-JO');
      html.setAttribute('dir', 'ltr');
      html.classList.remove('sc-ar');
      restoreNode(document.body);
    }
    localStorage.setItem(STORAGE_KEY, lang);
    document.querySelectorAll('[data-lang-label]').forEach(el => {
      el.textContent = lang === 'ar' ? 'العربية / English' : 'English / العربية';
    });
    dispatchEvent(new CustomEvent('sc:langchange', { detail: { lang } }));
    };

    finish();
  }
}

export function toggleLang() {
  applyLang(currentLang() === 'ar' ? 'en' : 'ar');
}

// Translate content added after load (search results, modals, listing grids).
function observe() {
  new MutationObserver(muts => {
    if (currentLang() !== 'ar') return;
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1) translateNode(n);
        else if (n.nodeType === 3 && n.nodeValue.trim()) {
          const hit = AR[n.nodeValue.trim()];
          if (hit && !KEEP_EN.test(n.nodeValue.trim())) {
            n.$en = n.nodeValue;
            n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), hit);
          }
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

export function initI18n() {
  // Wire every language control on the page. The footer button in the export
  // has no handler and no id, so it is matched on its label text.
  const controls = new Set(document.querySelectorAll('[data-lang-toggle]'));
  document.querySelectorAll('button, a').forEach(el => {
    if (/English\s*\/\s*العربية|العربية\s*\/\s*English/.test(el.textContent)) controls.add(el);
  });

  controls.forEach(el => {
    el.setAttribute('type', 'button');
    el.setAttribute('aria-label', 'Switch language / تغيير اللغة');
    // mark the text node so the label can be updated on switch
    [...el.childNodes].forEach(n => {
      if (n.nodeType === 3 && n.nodeValue.includes('/')) {
        const span = document.createElement('span');
        span.setAttribute('data-lang-label', '');
        span.textContent = n.nodeValue.trim();
        n.replaceWith(span);
      }
    });
    el.addEventListener('click', e => { e.preventDefault(); toggleLang(); });
  });

  observe();
  if (currentLang() === 'ar') applyLang('ar');
}

export const t = key => (currentLang() === 'ar' && AR[key]) || key;
