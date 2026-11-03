/* ===================== i18n ===================== */
const I = {
  ar: {
    brand: "One Transind", sample: "بيانات تجريبية", sector: "القطاع", role: "الدور", all: "كل القطاعات",
    v_dash: "لوحة المجموعة", v_sales: "المبيعات", v_act: "مبيعات التجارة (فعلي)", v_pipe: "الفرص والصفقات", v_acc: "العملاء", v_hr: "الموارد البشرية", v_log: "اللوجستيات", v_fin: "المالية",
    foot: "",
    r_ceo: "الإدارة العليا", r_cfo: "المدير المالي", r_mgr: "مدير قطاع السلع", r_rep: "مندوب مبيعات", r_hr: "الموارد البشرية", r_log: "مدير اللوجستيات",
    revYtd: "الإيرادات منذ بداية السنة", pipe: "قيمة الفرص المفتوحة", ar: "الذمم المستحقة", emp: "الموظفون", ontime: "التسليم في الوقت", qar: "ر.ق", m: "مليون",
    vsLy: "مقارنة بالسنة الماضية", revBySec: "الإيرادات حسب القطاع (مليون ر.ق، يناير–سبتمبر 2026)", trend: "الإيرادات الشهرية للمجموعة (مليون ر.ق)", actual: "الفعلي", target: "المستهدف",
    alerts: "تنبيهات تحتاج متابعة", src_or: "المصدر: EBS (وصلة تجريبية)", src_crm: "المصدر: CRM", src_hr: "المصدر: نظام الموارد البشرية (تجريبي)", src_wms: "المصدر: المستودعات وتتبع الأسطول (تجريبي)",
    newDeal: "فرصة جديدة", account: "العميل", value: "القيمة (ر.ق)", owner: "المسؤول", add: "إضافة", close: "الإغلاق المتوقع", next: "المرحلة التالية", moveHint: "اسحب البطاقة بين المراحل أو اضغط \"المرحلة التالية\". الفرصة اللي توصل آخر مرحلة تنرسل كأمر بيع.",
    sentSo: "تم إرسال أمر بيع {so} (تجريبي)", soCreated: "أمر بيع", openDeals: "فرص مفتوحة", winRate: "نسبة الكسب", avgDeal: "متوسط قيمة الفرصة",
    custs: "العملاء", custId: "رقم العميل", aging: "أعمار الديون", current: "غير مستحق", d30: "1–30 يوم", d60: "31–60 يوم", d90: "61–90 يوم", over90: "أكثر من 90",
    invoices: "الفواتير", invNo: "رقم الفاتورة", date: "التاريخ", due: "الاستحقاق", amount: "المبلغ", balance: "المتبقي", deals: "الفرص", credit: "حد الائتمان", channel: "القناة",
    hc: "عدد الموظفين حسب القطاع", leave: "طلبات الإجازة", docs: "وثائق تنتهي خلال 60 يوم", approve: "موافقة", reject: "رفض", approved: "تمت الموافقة", rejected: "مرفوض", pending: "بانتظار الموافقة",
    empName: "الموظف", type: "النوع", from: "من", days: "الأيام", doc: "الوثيقة", expires: "تنتهي", left: "متبقي", dayU: "يوم", newHires: "تعيينات هذا الشهر", turnover: "معدل الدوران السنوي", pendingL: "إجازات بانتظار الموافقة", docsExp: "وثائق قريبة الانتهاء",
    fleet: "الأسطول", dry: "جاف", chilled: "مبرّد", frozen: "مجمّد", onRoute: "في الطريق", idle: "متوقفة", maint: "صيانة", shipments: "شحنات اليوم", to: "إلى", temp: "الحرارة", status: "الحالة", vehicle: "السيارة", eta: "الوصول",
    s_load: "قيد التحميل", s_route: "في الطريق", s_done: "تم التسليم", s_late: "متأخرة", wh: "استخدام المستودعات", customs: "التخليص الجمركي (QECC)", bl: "البوليصة", cust_cl: "المستورد",
    c_docs: "مراجعة المستندات", c_insp: "فحص", c_rel: "تم الإفراج", outlets: "منافذ البيع المغطاة",
    gm: "هامش الربح الإجمالي", dso: "متوسط أيام التحصيل", revTarget: "الإيرادات مقابل المستهدف السنوي", ofTarget: "من المستهدف", syncNow: "مزامنة الآن", lastSync: "آخر مزامنة",
    records: "السجلات", ok: "ناجح", fail: "فشل",
    v_rest: "المطاعم", r_rest: "مدير عمليات المطاعم", todaySales: "مبيعات اليوم", tx: "عدد الفواتير", ticket: "متوسط الفاتورة", branches: "الفروع المتصلة", byBrand: "مبيعات اليوم حسب العلامة (ر.ق)", byHour: "المبيعات حسب الساعة اليوم (ألف ر.ق)", chMix: "قنوات الطلب", branchPerf: "أداء الفروع اليوم", branch: "الفرع", vsTgt: "مقابل المستهدف", src_pos: "المصدر: نقاط البيع (تجريبي)",
    ai: "رؤى ذكية", aiSrc: "ذكاء اصطناعي · تجريبي", coverage: "تغطية منافذ البيع حسب القناة", chan: "القناة", total: "الإجمالي", reached: "نوصلها", cov: "التغطية", src_profile: "المصدر: الملف التعريفي للشركة", act: "إجراء",
    mtdT: "مبيعات هذا الشهر", mtdSub: "أكتوبر 2026، من 1 إلى 20 أكتوبر", allCo: "كل الشركات", companies: "الشركات", brands: "العلامات", products: "المنتجات", share: "الحصة", vsLm: "مقابل نفس الفترة الشهر الماضي", units: "الكمية", clickHint: "اضغط على أي سطر عشان تنزل للتفاصيل",
    live: "مباشر", open: "عرض التفاصيل", gTarget: "من مستهدف الشهر (31 مليون)", gLine: "الخط الأبيض: مضى {e}% من الشهر", gTip: "حققنا {p}% من المستهدف، ومضى {e}% من الشهر",
    dir: "دليل الموظفين", depts: "الأقسام", jobs: "الوظائف", staff: "الموظفون", empId: "الرقم الوظيفي", job: "الوظيفة", dept: "القسم", nat: "الجنسية", joined: "تاريخ التعيين", loc: "الموقع", searchPh: "ابحث بالاسم أو الوظيفة أو الرقم",
    salesStaff: "موظفو المبيعات", maintStaff: "موظفو الصيانة", maintBySec: "موظفو الصيانة حسب القطاع", salesTeam: "أداء فريق مبيعات السلع الاستهلاكية (أكتوبر)", area: "المنطقة / الحسابات", mTarget: "المستهدف الشهري (ر.ق)", achieved: "المحقق", visits: "زيارات هذا الشهر", showing: "يعرض {n} من {t}",
    brSales: "مبيعات الفروع هذا الشهر", brBrands: "البراندات في الفرع", brCount: "{n} فرع", allBr: "كل الفروع", brHint: "اضغط على الفرع عشان تشوف البراندات", lastOrder: "آخر طلب",
    month: "الشهر", mtdOf: "حتى 20 أكتوبر", salesM: "مبيعات {m}", vsLy1: "مقابل {m} 2025", vsLy2: "مقابل {m} 2024", samePeriod: "نفس الفترة", ytd: "منذ بداية 2026", ytdLy: "مقابل نفس الفترة 2025", proj: "توقع نهاية الشهر", projSub: "حسب معدل البيع اليومي", tgtAtt: "تحقيق المستهدف",
    cmpT: "مقارنة شهرية: 2026 مقابل 2025 و2024 (مليون ر.ق)", partial: "أكتوبر 2026 حتى يوم 20 فقط", mtdTag: "جزئي",
    brk: "تفصيل المبيعات", lvlSec: "القطاعات", lvlBrand: "البراندات", lvlProd: "المنتجات", yoy: "مقابل 2025", price: "متوسط السعر", trend12: "آخر 10 شهور",
    ana: "التحليل والرؤية", anaSrc: "محسوب تلقائياً من الأرقام",
    a_grow: "أسرع نمو: {s} بزيادة {p}% عن {m} 2025.", a_decl: "أضعف أداء: {s} بتراجع {p}% عن {m} 2025. يحتاج مراجعة الأسعار والتوزيع.", a_declNone: "ما في قطاع تراجع عن {m} 2025.",
    a_top: "أكبر براند: {b} بحصة {p}% من مبيعات {s}.", a_proj: "لو استمر معدل البيع الحالي، يقفل أكتوبر على {v} مليون، يعني {p}% من مستهدف الشهر ({t} مليون) و{y}% مقارنة بأكتوبر 2025 كامل.",
    a_ytd: "من يناير إلى اليوم: {v} مليون، بزيادة {p}% عن نفس الفترة 2025، ونمو سنوي مركّب {c}% منذ 2024.", a_season: "الموسمية: أعلى شهر في 2025 كان {m} ({v} مليون). رمضان 2027 يبدأ تقريباً في 8 فبراير، فالتوريد الموسمي للسلع والمطاعم لازم يكون جاهز من منتصف ديسمبر.",
    a_conc: "التركّز: أكبر 5 عملاء في السلع الاستهلاكية يمثلون {p}% من المبيعات (الميرة ولولو وكارفور وسفاري ووقود). أي تغيير عندهم يأثر مباشرة.", a_van: "مبيعات الفان (RoutePro) تمثل حوالي 30% من السلع الاستهلاكية، وهي القناة اللي تنمو أسرع ({p}%) لأن 38 بقالة جديدة دخلت هذا الشهر.",
    a_fnb: "المطاعم: طلبات التوصيل (طلبات وسنونو) وصلت 32% من مبيعات المطاعم، مقابل 24% السنة الماضية. هامشها أقل بسبب العمولة، فالتطبيق الخاص يستاهل دفعة.",
    secKpi: "مؤشرات القطاع", k_van: "مبيعات الفان", k_ka: "الحسابات الرئيسية", k_horeca: "الفنادق والمطاعم", k_whole: "الجملة", k_ret: "نسبة المرتجعات", k_oos: "خسارة نفاد المخزون", k_price: "تحقق السعر", k_promo: "رفع العروض", k_dine: "داخل المطعم", k_deliv: "توصيل", k_take: "استلام", k_ticket: "متوسط الفاتورة", k_lfl: "نمو الفروع المتماثلة", k_occ: "نسبة الإشغال", k_rent: "متوسط الإيجار الشهري", k_renew: "تجديد العقود", k_fill: "امتلاء الشاحنات", k_cpd: "تكلفة التوصيل", k_otif: "التسليم في الوقت", k_basket: "متوسط السلة", k_foot: "الزوار", k_margin: "الهامش", k_backlog: "الأعمال المتعاقدة", k_renewC: "تجديد العقود",
    actT: "ترانسند للتجارة والتوزيع · مبيعات سبتمبر", actual: "بيانات فعلية", srcCsv: "المصدر: ملف مبيعات سبتمبر من ManERP (91,112 سطر)", cost: "التكلفة", gmv: "هامش الربح الإجمالي", custAct: "عملاء نشطون", itemsN: "أصناف مباعة", returns: "المرتجعات والخصومات", avgCust: "متوسط المبيعات للعميل", lines: "سطور الفواتير",
    drillP: "حسب القسم والبراند والمنتج", drillC: "حسب العميل والفرع والبراند", dep: "القسم", grp: "العميل / السلسلة", brCust: "الفرع / الحساب", margin: "الهامش", custsN: "عملاء", itemsK: "أصناف", pack: "التعبئة",
    topCust: "أكبر 10 عملاء", brandM: "هامش الربح حسب البراند", searchAct: "ابحث عن عميل أو براند أو منتج",
    i_top: "KDD لوحده {p}% من مبيعات التجارة، وأكبر 3 براندات ({b}) تمثل {q}%. أي اهتزاز في توريد KDD يأثر على ربع المبيعات.",
    i_conc: "أكبر 10 عملاء يمثلون {p}% من المبيعات، والميرة لوحدها {m}% عبر {n} فرع. التركّز عالي، والمفاوضات السنوية مع الميرة ولولو هي أهم قرار تجاري.",
    i_deliv: "طلبات وسنونو (منصات التوصيل) صارت عميل بحجم {v} مليون ({p}%)، أكبر من كارفور. قناة جديدة تستاهل مندوب مخصص وأسعار خاصة.",
    i_ret: "المرتجعات والخصومات {v} مليون ({p}% من المبيعات) في {n} سطر. الأعلى في {b}. مراجعة صلاحية المنتجات وتكرار الزيارات تقلّلها.",
    i_margin: "هامش الربح الإجمالي {p}%. براندات هامشها أقل من 15%: {b}. وفي {n} صنف ينباع بأقل من تكلفته.",
    i_tail: "{n} عميل من أصل {t} مبيعاتهم أقل من 500 ريال في الشهر. تكلفة زيارتهم أعلى من ربحهم، والأفضل تحويلهم للطلب عبر التطبيق أو الجملة.",
    noAccess: "هذا الدور ما عنده صلاحية على هذي الشاشة.", prob: "الاحتمال", stage: "المرحلة", lost: "",
  },
  en: {
    brand: "One Transind", sample: "Sample data", sector: "Sector", role: "Role", all: "All sectors",
    v_dash: "Group dashboard", v_sales: "Sales", v_act: "Trading sales (actual)", v_pipe: "Pipeline & deals", v_acc: "Customers", v_hr: "Human resources", v_log: "Logistics", v_fin: "Finance",
    foot: "",
    r_ceo: "Group management", r_cfo: "CFO", r_mgr: "FMCG sector manager", r_rep: "Sales rep", r_hr: "HR", r_log: "Logistics manager",
    revYtd: "Revenue year to date", pipe: "Open pipeline value", ar: "Receivables outstanding", emp: "Employees", ontime: "On-time delivery", qar: "QAR", m: "M",
    vsLy: "vs last year", revBySec: "Revenue by sector (QAR M, Jan–Sep 2026)", trend: "Group monthly revenue (QAR M)", actual: "Actual", target: "Target",
    alerts: "Needs follow-up", src_or: "Source: EBS (mock adapter)", src_crm: "Source: CRM", src_hr: "Source: HR system (sample)", src_wms: "Source: warehouse & fleet tracking (sample)",
    newDeal: "New opportunity", account: "Customer", value: "Value (QAR)", owner: "Owner", add: "Add", close: "Expected close", next: "Next stage", moveHint: "Drag a card between stages or press \"Next stage\". A deal reaching the last stage is sent as a sales order.",
    sentSo: "Sales order {so} sent (mock)", soCreated: "Sales order", openDeals: "Open opportunities", winRate: "Win rate", avgDeal: "Average deal size",
    custs: "Customers", custId: "Customer no.", aging: "AR aging", current: "Not due", d30: "1–30 days", d60: "31–60 days", d90: "61–90 days", over90: "Over 90",
    invoices: "Invoices", invNo: "Invoice no.", date: "Date", due: "Due", amount: "Amount", balance: "Balance", deals: "Opportunities", credit: "Credit limit", channel: "Channel",
    hc: "Headcount by sector", leave: "Leave requests", docs: "Documents expiring within 60 days", approve: "Approve", reject: "Reject", approved: "Approved", rejected: "Rejected", pending: "Pending",
    empName: "Employee", type: "Type", from: "From", days: "Days", doc: "Document", expires: "Expires", left: "Left", dayU: "d", newHires: "New hires this month", turnover: "Annual turnover", pendingL: "Leave awaiting approval", docsExp: "Documents expiring soon",
    fleet: "Fleet", dry: "Dry", chilled: "Chilled", frozen: "Frozen", onRoute: "On route", idle: "Idle", maint: "Maintenance", shipments: "Today's shipments", to: "To", temp: "Temp", status: "Status", vehicle: "Vehicle", eta: "ETA",
    s_load: "Loading", s_route: "On route", s_done: "Delivered", s_late: "Late", wh: "Warehouse utilisation", customs: "Customs clearance (QECC)", bl: "Bill of lading", cust_cl: "Importer",
    c_docs: "Document review", c_insp: "Inspection", c_rel: "Released", outlets: "Outlets covered",
    gm: "Gross margin", dso: "Days sales outstanding", revTarget: "Revenue vs annual target", ofTarget: "of target", syncNow: "Sync now", lastSync: "Last sync",
    records: "Records", ok: "OK", fail: "Failed",
    v_rest: "Restaurants", r_rest: "Restaurant ops manager", todaySales: "Sales today", tx: "Transactions", ticket: "Average ticket", branches: "Branches online", byBrand: "Sales today by brand (QAR)", byHour: "Sales by hour today (QAR k)", chMix: "Order channels", branchPerf: "Branch performance today", branch: "Branch", vsTgt: "vs target", src_pos: "Source: POS (sample)",
    ai: "AI insights", aiSrc: "AI · sample", coverage: "Outlet coverage by channel", chan: "Channel", total: "Total", reached: "Reached", cov: "Coverage", src_profile: "Source: company profile", act: "Action",
    mtdT: "Sales this month", mtdSub: "October 2026, 1–20 Oct", allCo: "All companies", companies: "Companies", brands: "Brands", products: "Products", share: "Share", vsLm: "vs same period last month", units: "Units", clickHint: "Click any row to drill down",
    live: "Live", open: "View details", gTarget: "of monthly target (31M)", gLine: "White tick: {e}% of the month gone", gTip: "{p}% of target reached with {e}% of the month gone",
    dir: "Employee directory", depts: "Departments", jobs: "Job titles", staff: "Employees", empId: "Employee ID", job: "Job title", dept: "Department", nat: "Nationality", joined: "Joined", loc: "Location", searchPh: "Search name, job title or ID",
    salesStaff: "Sales staff", maintStaff: "Maintenance staff", maintBySec: "Maintenance staff by sector", salesTeam: "FMCG sales team performance (October)", area: "Area / accounts", mTarget: "Monthly target (QAR)", achieved: "Achieved", visits: "Visits this month", showing: "Showing {n} of {t}",
    brSales: "Branch sales this month", brBrands: "Brands at this branch", brCount: "{n} branches", allBr: "All branches", brHint: "Click a branch to see its brands", lastOrder: "Last order",
    month: "Month", mtdOf: "to 20 October", salesM: "Sales {m}", vsLy1: "vs {m} 2025", vsLy2: "vs {m} 2024", samePeriod: "same period", ytd: "2026 year to date", ytdLy: "vs same period 2025", proj: "Month-end projection", projSub: "at current daily run rate", tgtAtt: "Target attainment",
    cmpT: "Monthly comparison: 2026 vs 2025 and 2024 (QAR M)", partial: "October 2026 covers 20 days only", mtdTag: "partial",
    brk: "Sales breakdown", lvlSec: "Sectors", lvlBrand: "Brands", lvlProd: "Products", yoy: "vs 2025", price: "Avg price", trend12: "Last 10 months",
    ana: "Analysis & insights", anaSrc: "Computed from the figures",
    a_grow: "Fastest growth: {s}, up {p}% on {m} 2025.", a_decl: "Weakest: {s}, down {p}% on {m} 2025. Pricing and distribution need a review.", a_declNone: "No sector is below {m} 2025.",
    a_top: "Largest brand: {b} with {p}% of {s} sales.", a_proj: "At the current run rate October closes at {v}M, which is {p}% of the monthly target ({t}M) and {y}% of a full October 2025.",
    a_ytd: "January to date: {v}M, up {p}% on the same period of 2025, a {c}% compound annual growth since 2024.", a_season: "Seasonality: the strongest month of 2025 was {m} ({v}M). Ramadan 2027 starts around 8 February, so seasonal stock for FMCG and restaurants must be in place by mid-December.",
    a_conc: "Concentration: the top 5 FMCG customers are {p}% of sales (Al Meera, Lulu, Carrefour, Safari, Woqod). Any change at one of them shows up immediately.", a_van: "Van sales (RoutePro) are about 30% of FMCG and the fastest-growing channel ({p}%), with 38 new groceries added this month.",
    a_fnb: "Restaurants: delivery (Talabat, Snoonu) reached 32% of restaurant sales, from 24% a year ago. Its margin is lower because of commission, so the own app deserves a push.",
    secKpi: "Sector indicators", k_van: "Van sales", k_ka: "Key accounts", k_horeca: "HORECA", k_whole: "Wholesale", k_ret: "Returns rate", k_oos: "Out-of-stock loss", k_price: "Price realisation", k_promo: "Promo uplift", k_dine: "Dine-in", k_deliv: "Delivery", k_take: "Takeaway", k_ticket: "Average ticket", k_lfl: "Like-for-like growth", k_occ: "Occupancy", k_rent: "Average monthly rent", k_renew: "Lease renewals", k_fill: "Truck fill rate", k_cpd: "Cost per delivery", k_otif: "On-time in full", k_basket: "Average basket", k_foot: "Footfall", k_margin: "Margin", k_backlog: "Contracted backlog", k_renewC: "Contract renewals",
    actT: "Transind Trading & Distribution · September sales", actual: "Actual data", srcCsv: "Source: September sales export from ManERP (91,112 lines)", cost: "Cost", gmv: "Gross margin", custAct: "Active customers", itemsN: "Items sold", returns: "Returns & credits", avgCust: "Average sales per customer", lines: "Invoice lines",
    drillP: "By department, brand and product", drillC: "By customer, branch and brand", dep: "Department", grp: "Customer / chain", brCust: "Branch / account", margin: "Margin", custsN: "customers", itemsK: "items", pack: "Packing",
    topCust: "Top 10 customers", brandM: "Gross margin by brand", searchAct: "Search a customer, brand or product",
    i_top: "KDD alone is {p}% of trading sales, and the top 3 brands ({b}) are {q}%. Any supply issue at KDD touches a quarter of sales.",
    i_conc: "The top 10 customers are {p}% of sales; Al Meera alone is {m}% across {n} branches. Concentration is high, so the annual negotiations with Al Meera and Lulu are the most important commercial decision.",
    i_deliv: "Talabat and Snoonu (delivery platforms) are now a {v}M customer ({p}%), bigger than Carrefour. A new channel that deserves a dedicated rep and pricing.",
    i_ret: "Returns and credits are {v}M ({p}% of sales) across {n} lines, highest in {b}. Reviewing shelf life and visit frequency brings this down.",
    i_margin: "Gross margin is {p}%. Brands under 15% margin: {b}. {n} items sell below cost.",
    i_tail: "{n} of {t} customers buy under QAR 500 a month. Serving them costs more than they earn; move them to app ordering or wholesale.",
    noAccess: "This role has no access to this screen.", prob: "Probability", stage: "Stage",
  }
};

/* ===================== sample data ===================== */
const SECTORS = [
  {
    id: "fmcg", ar: "السلع الاستهلاكية والتوزيع", en: "FMCG & Distribution", rev: 124, tgt: 168, hc: 560,
    stages: [["عميل محتمل", "Prospect"], ["إدراج منتج", "Listing"], ["طلب تجريبي", "Trial order"], ["عميل دائم", "Regular account"]]
  },
  {
    id: "fnb", ar: "الأغذية والمشروبات", en: "Food & Beverage", rev: 50, tgt: 69, hc: 430,
    stages: [["طلب تموين", "Catering request"], ["عرض سعر", "Quotation"], ["تأكيد", "Confirmed"], ["تم التنفيذ", "Delivered"]]
  },
  {
    id: "re", ar: "العقارات", en: "Real Estate", rev: 29, tgt: 38, hc: 60,
    stages: [["استفسار", "Inquiry"], ["معاينة", "Viewing"], ["عرض", "Offer"], ["عقد موقّع", "Contract signed"]]
  },
  {
    id: "retail", ar: "الهايبرماركت والتجزئة", en: "Hypermarkets & Retail", rev: 22, tgt: 30, hc: 160,
    stages: [["طلب جملة", "Bulk inquiry"], ["عرض سعر", "Quotation"], ["تأكيد", "Confirmed"], ["تم التوريد", "Supplied"]]
  },
  {
    id: "log", ar: "اللوجستيات", en: "Logistics", rev: 17, tgt: 24, hc: 180,
    stages: [["طلب خدمة", "Service request"], ["تسعير", "Pricing"], ["عقد", "Contract"], ["تشغيل", "Live"]]
  },
  {
    id: "con", ar: "الإنشاءات والتصميم الداخلي", en: "Construction & Interiors", rev: 13, tgt: 20, hc: 90,
    stages: [["مناقصة", "Tender"], ["تقديم", "Submitted"], ["ترسية", "Awarded"], ["تنفيذ", "In execution"]]
  },
  {
    id: "hb", ar: "الصحة والجمال", en: "Health & Beauty", rev: 9, tgt: 13, hc: 60,
    stages: [["عميل محتمل", "Prospect"], ["عرض", "Proposal"], ["تأكيد", "Confirmed"], ["عميل دائم", "Regular"]]
  },
  {
    id: "fm", ar: "إدارة المرافق", en: "Facility Management", rev: 8, tgt: 11, hc: 260,
    stages: [["مناقصة", "Tender"], ["زيارة موقع", "Site visit"], ["عرض", "Proposal"], ["عقد", "Contract"]]
  },
];
const SEC = Object.fromEntries(SECTORS.map(s => [s.id, s]));
const REPS = [["أحمد", "Ahmed"], ["ريم", "Reem"], ["فيصل", "Faisal"], ["سارة", "Sara"], ["راجيش", "Rajesh"], ["منى", "Mona"]];

const BRANCHES = {
  "CUST-1001": [["الغرافة", "Al Gharrafa"], ["الدفنة", "Dafna"], ["الوكرة", "Al Wakra"], ["الخور", "Al Khor"], ["أم صلال", "Umm Salal"], ["الهلال", "Hilal"], ["الريان", "Al Rayyan"], ["معيذر", "Muaither"], ["الثمامة", "Al Thumama"], ["عين خالد", "Ain Khaled"], ["اللقطة", "Al Luqta"], ["الشمال", "Al Shamal"]],
  "CUST-1002": [["الدفنة", "Dafna"], ["الغرافة", "Al Gharrafa"], ["الخور", "Al Khor"], ["برواية", "Barwa Village"], ["هايبر الهلال", "Hilal Hyper"], ["مسيمير", "Mesaimeer"], ["أبو هامور", "Abu Hamour"], ["الوكرة", "Al Wakra"]],
  "CUST-1003": [["فيلاجيو", "Villaggio"], ["سيتي سنتر", "City Center"], ["لاندمارك", "Landmark"], ["دار السلام", "Dar Al Salam"], ["مول قطر", "Mall of Qatar"], ["الدوحة فستيفال سيتي", "Doha Festival City"], ["المرقاب", "Al Mirqab"]],
  "CUST-1004": [["اللؤلؤة", "The Pearl"], ["الدوحة فستيفال سيتي", "Doha Festival City"], ["السد", "Al Sadd"], ["دوحة أوايسس", "Doha Oasis"]],
  "CUST-1005": [["أبو هامور", "Abu Hamour"], ["السلوى", "Salwa Road"], ["الوكرة", "Al Wakra"], ["المنصورة", "Al Mansoura"], ["أم صلال", "Umm Salal"]],
  "CUST-1006": [["الخور", "Al Khor"], ["اللقطة", "Al Luqta"], ["قطر مول", "Mall of Qatar"]],
  "CUST-1007": [["الوعب", "Al Waab"], ["الهلال", "Hilal"], ["الخليج الغربي", "West Bay"], ["الريان", "Al Rayyan"], ["الشحانية", "Al Shahaniya"]],
  "CUST-1008": [["الغرافة", "Al Gharrafa"], ["عين خالد", "Ain Khaled"], ["أبو هامور", "Abu Hamour"], ["الوكرة", "Al Wakra"], ["المنتزه", "Al Muntazah"], ["بن محمود", "Bin Mahmoud"]],
  "CUST-1009": [["الوكرة", "Al Wakra"], ["اللقطة", "Al Luqta"], ["بن عمران", "Bin Omran"], ["الوعب", "Al Waab"]],
  "CUST-1010": [["سدرة", "Sidra"], ["الريان", "Al Rayyan"], ["الوكرة", "Al Wakra"], ["الخور", "Al Khor"], ["دخان", "Dukhan"], ["مسيعيد", "Mesaieed"], ["الشمال", "Al Shamal"], ["لوسيل", "Lusail"], ["المطار", "Airport"], ["الغرافة", "Al Gharrafa"]],
  "CUST-1011": [["الريان", "Al Rayyan"], ["المعمورة", "Al Maamoura"], ["السد", "Al Sadd"], ["اللقطة", "Al Luqta"], ["عين خالد", "Ain Khaled"], ["أم صلال", "Umm Salal"], ["الثمامة", "Al Thumama"], ["الوكير", "Al Wukair"]],
  "CUST-1012": [["الصناعية", "Industrial Area"], ["مخزن الجملة", "Wholesale store"]],
};
function branchSales(cid) {
  const list = BRANCHES[cid] || []; const n = +cid.slice(-2); let h = n * 7919; const r = () => { h = (h * 9301 + 49297) % 233280; return h / 233280 };
  const base = R ? 0 : [0, 980, 760, 520, 210, 330, 160, 240, 270, 190, 420, 310, 140][n] * 1000; const w = list.map((b, i) => 0.4 + r() * 1.2); const tw = w.reduce((a, x) => a + x, 0);
  return list.map((b, i) => { const v = Math.round(base * w[i] / tw / 100) * 100; return { i, name: b, value: v, lm: Math.round(v * (0.86 + r() * 0.26) / 100) * 100, last: dateAdd(-Math.floor(r() * 9)) } })
}
function branchBrands(cid, bi) {
  const fm = MTD_TREE[0].brands; let h = (+cid.slice(-2)) * 131 + bi * 17; const r = () => { h = (h * 9301 + 49297) % 233280; return h / 233280 };
  const bs = branchSales(cid)[bi]; const w = fm.map(b => b[2] * (0.5 + r())); const tw = w.reduce((a, x) => a + x, 0);
  const out = fm.map((b, i) => ({ i, name: b, value: Math.round(bs.value * w[i] / tw / 10) * 10, lm: Math.round(bs.lm * w[i] / tw * (0.9 + r() * 0.2) / 10) * 10 })).sort((a, b) => b.value - a.value);
  out[0].value += bs.value - out.reduce((a, x) => a + x.value, 0); return out
}
function branchHTML() {
  const cid = S.acc, list = branchSales(cid); const bi = S.branch;
  const rows = bi == null ? list : branchBrands(cid, bi); const tot = rows.reduce((a, x) => a + x.value, 0), lm = rows.reduce((a, x) => a + x.lm, 0), mx = Math.max(1, ...rows.map(x => x.value)), ch = lm ? (tot / lm - 1) * 100 : 0;
  const crumbs = bi == null ? `<span class="cur">${t("allBr")}</span>` : `<button type="button" data-bb="">${t("allBr")}</button><i>›</i><span class="cur">${esc(L(list[bi].name))}</span>`;
  return `<header><h2>${bi == null ? t("brSales") : t("brBrands")}</h2><span class="src">${t("mtdSub")} · ${t("src_or")}</span></header>
  <div class="mtd"><span class="big">${fmt(tot)} ${t("qar")}</span><span class="d ${ch >= 0 ? "up" : "down"}" style="font-size:12.5px">${ch >= 0 ? "▲" : "▼"} ${fmt(Math.abs(ch), 1)}% ${t("vsLm")}</span></div>
  <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px"><nav class="crumbs" aria-label="breadcrumb">${crumbs}</nav><span class="src">${bi == null ? t("brCount").replace("{n}", list.length) + " · " + t("brHint") : ""}</span></div>
  <div class="drill">${rows.sort((a, b) => b.value - a.value).map(r => {
    const c = r.lm ? (r.value / r.lm - 1) * 100 : 0; return `<button type="button" class="dr" ${bi == null ? "" : "disabled"} data-br="${r.i}" data-tip="${esc(L(r.name))}: ${fmt(r.value)} ${t("qar")} · ${t("share")} ${fmt(r.value / tot * 100, 1)}%">
   <span class="lab">${esc(L(r.name))}${r.last ? `<small>${t("lastOrder")}: <span class="mono">${r.last}</span></small>` : ""}</span>
   <span class="track"><span class="fill" style="width:${Math.max(1, r.value / mx * 100)}%"></span></span>
   <span class="num" style="text-align:end">${fmt(r.value)}<small style="display:block;font-size:11px" class="${c >= 0 ? "up" : "down"}">${c >= 0 ? "▲" : "▼"} ${fmt(Math.abs(c), 1)}%</small></span>
   <span class="chev" aria-hidden="true">${bi == null ? "›" : ""}</span></button>`
  }).join("")}</div>`
}
function bindBranch() {
  const box = $("#brBox"); if (!box) return;
  box.querySelectorAll("[data-br]").forEach(b => b.onclick = () => { if (S.branch == null) { S.branch = +b.dataset.br; box.innerHTML = branchHTML(); bindBranch() } });
  box.querySelectorAll("[data-bb]").forEach(b => b.onclick = () => { S.branch = null; box.innerHTML = branchHTML(); bindBranch() })
}
const FMCG_ACC = [
  ["الميرة", "Al Meera", "CUST-1001", "Supermarkets"], ["لولو هايبرماركت", "Lulu Hypermarket", "CUST-1002", "Supermarkets"], ["كارفور", "Carrefour", "CUST-1003", "Supermarkets"],
  ["مونوبري", "Monoprix", "CUST-1004", "Supermarkets"], ["سفاري", "Safari", "CUST-1005", "Supermarkets"], ["سبار", "Spar", "CUST-1006", "Supermarkets"],
  ["أنصار جاليري", "Ansar Gallery", "CUST-1007", "Supermarkets"], ["سوق البلدي", "Souq Al Baladi", "CUST-1008", "Supermarkets"], ["سيتي هايبر", "City Hyper", "CUST-1009", "Supermarkets"],
  ["وقود", "Woqod", "CUST-1010", "Petrol stations"], ["روابي", "Rawabi", "CUST-1011", "Supermarkets"], ["مرزا", "Mirza", "CUST-1012", "Wholesale"],
];
const OTHER_ACC = {
  fnb: [["الخطوط الجوية القطرية – صالة", "Qatar Airways lounge"], ["تموين مؤتمر شركة", "Corporate conference catering"], ["حفلات مدارس – كيك", "School events cakes"], ["فعالية اليوم الوطني", "National Day event"], ["طلبات مكاتب دانكن", "Dunkin office orders"]],
  re: [["سكن موظفين – شركة مقاولات", "Staff housing – contractor"], ["فيلا – مجمّع فاخر", "Villa – premium compound"], ["شقق مفروشة – عقد سنوي", "Furnished flats – annual lease"], ["مكاتب إدارية", "Office space"], ["فيلا عائلية", "Family villa"]],
  retail: [["توريد ضيافة مكاتب", "Office pantry supply"], ["طلبات مطاعم بالجملة", "Restaurant bulk orders"], ["سلال رمضان لشركة", "Corporate Ramadan baskets"], ["مدارس – مقصف", "School canteen"]],
  log: [["تخزين مبرد – مورد ألبان", "Chilled storage – dairy supplier"], ["تخليص جمركي – مستورد أجهزة", "Customs – electronics importer"], ["توزيع ميل أخير – علامة مشروبات", "Last-mile – beverage brand"], ["تخزين مجمّد – مستورد لحوم", "Frozen storage – meat importer"]],
  con: [["تصميم داخلي – فيلا خاصة", "Interior fit-out – private villa"], ["تجديد فرع مطعم", "Restaurant branch refit"], ["مكاتب شركة – تشطيب", "Corporate office fit-out"], ["مجمّع سكني – صيانة", "Residential compound works"]],
  hb: [["صيدليات – إدراج فيتامينات", "Pharmacy chain – vitamins listing"], ["باقة عرائس – صالون Pavati", "Bridal package – Pavati"], ["نادي رياضي – مكملات", "Gym – supplements"], ["متجر إلكتروني", "Online store"]],
  fm: [["عقد تنظيف – برج مكاتب", "Cleaning – office tower"], ["لاندسكيب – مجمّع سكني", "Landscaping – compound"], ["ضيافة – مقر شركة", "Hospitality – HQ"], ["تنظيف – مدرسة خاصة", "Cleaning – private school"]],
};

let seed = 42; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
function pick(a) { return a[Math.floor(rnd() * a.length)] }
function makeDeals() {
  const out = []; let n = 1;
  FMCG_ACC.forEach(a => { const st = Math.floor(rnd() * 4); out.push({ id: "D-" + (1000 + n++), sector: "fmcg", acc: [a[0], a[1]], cust: a[2], value: Math.round((80 + rnd() * 900)) * 1000, stage: st, owner: Math.floor(rnd() * REPS.length), close: dateAdd(10 + Math.floor(rnd() * 80)), so: st === 3 ? "SO-6" + (4100 + n) : null }) });
  Object.entries(OTHER_ACC).forEach(([sid, list]) => list.forEach(a => { const st = Math.floor(rnd() * 4); const base = sid === "re" ? 1500 : sid === "con" ? 900 : sid === "log" ? 400 : 120; out.push({ id: "D-" + (1000 + n++), sector: sid, acc: a, cust: null, value: Math.round(base * (0.4 + rnd() * 1.6)) * 1000, stage: st, owner: Math.floor(rnd() * REPS.length), close: dateAdd(10 + Math.floor(rnd() * 90)), so: st === 3 ? "SO-6" + (4100 + n) : null }) }));
  return out;
}
const TODAY = new Date("2026-10-19T12:00:00");
function dateAdd(d) { const x = new Date(TODAY); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }

const MONTHS = [["ينا", "Jan"], ["فبر", "Feb"], ["مار", "Mar"], ["أبر", "Apr"], ["ماي", "May"], ["يون", "Jun"], ["يول", "Jul"], ["أغس", "Aug"], ["سبت", "Sep"], ["أكت", "Oct"], ["نوف", "Nov"], ["ديس", "Dec"]];

const TGT = [30, 30, 32, 31, 30, 28, 27, 28, 33, 31, 32, 41];  // sums to 373 = sector targets

const EMP_NAMES = [["خالد المري", "Khalid Al Marri"], ["نور حسن", "Noor Hassan"], ["جوزيف ماثيو", "Joseph Mathew"], ["عائشة الكواري", "Aisha Al Kuwari"], ["سانجاي نائر", "Sanjay Nair"], ["محمد إقبال", "Mohammed Iqbal"], ["لينا يوسف", "Lina Youssef"], ["أنيل كومار", "Anil Kumar"], ["حمد السليطي", "Hamad Al Sulaiti"], ["ماريا سانتوس", "Maria Santos"]];
const LEAVE_T = [["سنوية", "Annual"], ["مرضية", "Sick"], ["طارئة", "Emergency"], ["حج", "Hajj"]];
const DOC_T = [["بطاقة شخصية (QID)", "QID"], ["جواز سفر", "Passport"], ["رخصة قيادة", "Driving licence"], ["عقد عمل", "Employment contract"], ["شهادة صحية", "Health card"]];
function makeLeaves() { return EMP_NAMES.slice(0, 7).map((e, i) => ({ id: "L-" + (300 + i), emp: e, sector: pick(SECTORS).id, type: pick(LEAVE_T), from: dateAdd(3 + i * 2), days: [3, 5, 14, 21, 2, 10, 7][i], state: i > 4 ? "approved" : "pending" })) }
function makeDocs() { return EMP_NAMES.map((e, i) => ({ emp: e, sector: SECTORS[i % 8].id, doc: DOC_T[i % 5], left: [6, 12, 19, 24, 31, 38, 44, 49, 55, 59][i] })) }

const BRANDS = [["دانكن", "Dunkin", 44, 142300, 3480], ["باسكن روبنز", "Baskin Robbins", 38, 96400, 2610], ["مستر شاورما", "Mr. Shawarma", 5, 31200, 1040], ["برجر ستوب", "Burger Stop", 2, 9100, 240], ["آسيان ووك", "Asian Wok", 1, 6300, 130]];
const HOURS = [[7, 5.4], [8, 12.7], [9, 15.9], [10, 12.0], [11, 11.5], [12, 17.3], [13, 21.9], [14, 16.1], [15, 13.2], [16, 14.4], [17, 17.7], [18, 19.3], [19, 23.4], [20, 28.5], [21, 26.2], [22, 19.7], [23, 10.1]];
const CHMIX = [["داخل المطعم", "Dine-in", 34], ["استلام", "Takeaway", 27], ["طلبات", "Talabat", 21], ["سنونو", "Snoonu", 11], ["تطبيقنا", "Own app", 7]];
const BRANCH_P = [["دانكن – اللؤلؤة", "Dunkin – The Pearl", 9840, 112], ["دانكن – مول قطر", "Dunkin – Mall of Qatar", 9120, 104], ["باسكن روبنز – فيلاجيو", "Baskin Robbins – Villaggio", 8410, 118], ["مستر شاورما – السد", "Mr. Shawarma – Al Sadd", 7930, 97], ["دانكن – الخليج الغربي", "Dunkin – West Bay", 7480, 91], ["باسكن روبنز – كتارا", "Baskin Robbins – Katara", 6950, 109], ["دانكن – مطار حمد", "Dunkin – Hamad Airport", 6620, 86], ["مستر شاورما – الوكرة", "Mr. Shawarma – Al Wakra", 5210, 78]];
const CHANNELS = [["المتاجر التقليدية", "Traditional trade", 170, 170], ["السوبرماركت", "Supermarkets", 75, 75], ["البقالات والتوزيع المباشر", "Groceries & direct", 2000, 1829], ["الفنادق والمطاعم", "HORECA", 1000, 842], ["محطات الوقود", "Petrol stations", 107, 107], ["الجملة", "Wholesale", 65, 45]];
const AI = [
  ["توقع الطلب", "Demand forecast", "متوقع يرتفع طلب الآيس كريم في فروع باسكن روبنز 18% هالأسبوع مع حرارة 36°. زيادة التوريد المجمّد لـ 12 فرع.", "Ice-cream demand at Baskin Robbins expected +18% this week at 36°C. Raise frozen replenishment for 12 branches.", ""],
  ["خطر التحصيل", "Collection risk", "سوق البلدي: احتمال تأخر الدفعة الجاية 72% حسب نمط آخر 6 شهور. تذكير واتساب جاهز للإرسال.", "Souq Al Baladi: 72% chance the next payment is late, based on the last 6 months. WhatsApp reminder ready.", "bad"],
  ["نفاد مخزون", "Stock-out risk", "كيلوقز كورن فليكس 500غ: المخزون في لولو الدفنة يكفي 6 أيام. اقتراح طلب 240 كرتون.", "Kellogg's Corn Flakes 500g: Lulu Dafna has 6 days of stock. Suggested order: 240 cartons.", "warn"],
  ["فرصة بيع", "Sales opportunity", "38 بقالة في الوكرة والخور ما طلبت شيبس عمان من 30 يوم. أضفتها لمسار المندوبين بكرة.", "38 groceries in Al Wakra and Al Khor have not ordered Oman Chips in 30 days. Added to tomorrow's rep routes.", "good"],
];
// Month-to-date sales tree: company -> brand -> product. [ar,en,weight,(unit price QAR)]
const MTD_TREE = [
  {
    ar: "ترانسند للتجارة", en: "Transind Trading", sector: "fmcg", total: 7920000, lm: 7310000, brands: [
      ["كيلوقز", "Kellogg's", 22, [["كورن فليكس 500غ", "Corn Flakes 500g", 40, 14.5], ["كوكو بوبس 375غ", "Coco Pops 375g", 25, 16], ["سبيشال كي 375غ", "Special K 375g", 18, 19], ["برينجلز أصلي 165غ", "Pringles Original 165g", 17, 9.5]]],
      ["ليز / فريتو لاي", "Lay's / Frito-Lay", 19, [["ليز ملح 23غ", "Lay's Salted 23g", 38, 1], ["دوريتوس جبنة 23غ", "Doritos Nacho 23g", 27, 1], ["شيتوس 25غ", "Cheetos 25g", 20, 1], ["ليز ستيكس 45غ", "Lay's Stax 45g", 15, 4]]],
      ["كوكاكولا المانع", "Coca-Cola Almana", 15, [["كوكاكولا علب 330مل", "Coca-Cola can 330ml", 48, 1.5], ["سبرايت 330مل", "Sprite 330ml", 22, 1.5], ["فانتا برتقال 330مل", "Fanta Orange 330ml", 18, 1.5], ["ماء أركيوس 500مل", "Arwa water 500ml", 12, 0.75]]],
      ["البادية", "Al Badia", 12, [["أرز بسمتي 5كغ", "Basmati rice 5kg", 45, 32], ["زيت دوار الشمس 1.8ل", "Sunflower oil 1.8L", 30, 15], ["سكر 2كغ", "Sugar 2kg", 25, 9]]],
      ["أولكر", "Ulker", 10, [["بسكويت ديجستف", "Digestive biscuits", 40, 4.5], ["شوكولاتة جوديفا مصغّرة", "Godiva Mini Bites", 25, 12], ["كاكاو ويفر", "Cocoa wafer", 35, 1.5]]],
      ["KDD", "KDD", 9, [["حليب كامل الدسم 1ل", "Full cream milk 1L", 45, 6.5], ["عصير برتقال 1ل", "Orange juice 1L", 35, 7], ["كريمة طبخ", "Cooking cream", 20, 4]]],
      ["شيبس عمان", "Oman Chips", 7, [["شيبس عمان 15غ", "Oman Chips 15g", 70, 0.5], ["شيبس عمان عائلي 75غ", "Oman Chips family 75g", 30, 2]]],
      ["نباتي", "Nabati", 6, [["ريشيز ويفر جبنة", "Richeese wafer", 60, 1], ["نباتي بسكويت", "Nabati biscuits", 40, 1]]]]
  },
  {
    ar: "ترانسند للأغذية والمشروبات", en: "Transind F&B", sector: "fnb", total: 3410000, lm: 3260000, brands: [
      ["دانكن", "Dunkin", 50, [["قهوة مثلجة", "Iced coffee", 34, 16], ["دونات قليزد", "Original Glazed donut", 22, 6], ["علبة 12 دونات", "Box of 12 donuts", 18, 55], ["مونشكنز", "Munchkins", 14, 20], ["ساندويتش فطور", "Breakfast sandwich", 12, 18]]],
      ["باسكن روبنز", "Baskin Robbins", 34, [["سكوب واحد", "Single scoop", 36, 14], ["كيك آيس كريم", "Ice-cream cake", 28, 120], ["ميلك شيك", "Milkshake", 22, 22], ["علبة عائلية", "Family pack", 14, 45]]],
      ["مستر شاورما", "Mr. Shawarma", 11, [["شاورما دجاج", "Chicken shawarma", 48, 12], ["صحن شاورما لحم", "Beef shawarma plate", 32, 32], ["وجبة عائلية", "Family meal", 20, 85]]],
      ["برجر ستوب", "Burger Stop", 3, [["برجر كلاسيك", "Classic burger", 60, 28], ["وجبة كومبو", "Combo meal", 40, 38]]],
      ["آسيان ووك", "Asian Wok", 2, [["نودلز دجاج", "Chicken noodles", 55, 34], ["أرز مقلي", "Fried rice", 45, 30]]]]
  },
  {
    ar: "ترانسند للعقارات", en: "Transind Real Estate", sector: "re", total: 2140000, lm: 2090000, brands: [
      ["المنزل للشقق الفندقية", "Al Manzil Residence", 42, [["شقة غرفة", "One-bedroom apartment", 55, 11500], ["شقة غرفتين", "Two-bedroom apartment", 45, 15500]]],
      ["120 السد للشقق الفندقية", "120 Al Sadd Residence", 38, [["جناح استوديو", "Studio suite", 50, 8500], ["جناح غرفة", "One-bedroom suite", 50, 12000]]],
      ["حدائق بلاسم", "Balasem Gardens", 20, [["فيلا", "Villa", 100, 18000]]]]
  },
  {
    ar: "السوبرماركت", en: "Supermarkets", sector: "retail", total: 1520000, lm: 1490000, brands: [
      ["فود بالاس", "Food Palace", 70, [["خضار وفواكه", "Fresh produce", 30, null], ["مواد غذائية", "Grocery", 40, null], ["مشروبات", "Beverages", 18, null], ["منظفات", "Household", 12, null]]],
      ["دكّان", "Dukkan", 30, [["مواد غذائية", "Grocery", 55, null], ["وجبات خفيفة", "Snacks", 25, null], ["مشروبات", "Beverages", 20, null]]]]
  },
  {
    ar: "ترانسند للخدمات اللوجستية", en: "Transind Logistics", sector: "log", total: 1210000, lm: 1150000, brands: [
      ["ترانسند للخدمات اللوجستية", "Transind Logistics", 68, [["تخزين مبرد ومجمد", "Chilled & frozen storage", 45, null], ["تخزين جاف", "Dry storage", 25, null], ["توزيع", "Distribution", 30, null]]],
      ["السريع القطري للتخليص (QECC)", "Qatar Express Customs Clearance (QECC)", 32, [["تخليص بحري", "Sea freight clearance", 60, null], ["تخليص جوي", "Air freight clearance", 40, null]]]]
  },
  {
    ar: "ترانسند للمقاولات", en: "Transind Contracting (TCC)", sector: "con", total: 910000, lm: 1020000, brands: [
      ["TCC", "TCC", 100, [["تصميم داخلي", "Interior fit-out", 55, null], ["صيانة", "Maintenance works", 45, null]]]]
  },
  {
    ar: "الصحة والجمال", en: "Health & Beauty", sector: "hb", total: 620000, lm: 590000, brands: [
      ["ناتشورال إسنشيالز", "Natural Essentials", 34, [["فيتامين د3", "Vitamin D3", 40, 45], ["أوميغا 3", "Omega 3", 35, 65], ["ملتي فيتامين", "Multivitamin", 25, 55]]],
      ["لايف بلان", "Lifeplan", 22, [["كولاجين", "Collagen", 55, 85], ["مغنيسيوم", "Magnesium", 45, 40]]],
      ["صالون بافاتي", "Pavati salon", 28, [["شعر وتصفيف", "Hair styling", 55, null], ["باقات عرائس", "Bridal packages", 45, null]]],
      ["بيس إي لوتشي", "Pace e Luce", 16, [["عناية بالبشرة", "Skin care", 100, null]]]]
  },
  {
    ar: "إدارة المرافق", en: "Facility Management", sector: "fm", total: 550000, lm: 540000, brands: [
      ["كلوف", "Clove", 64, [["عقود تنظيف", "Cleaning contracts", 70, null], ["ضيافة", "Hospitality staff", 30, null]]],
      ["توب جرين", "Top Green", 36, [["لاندسكيب", "Landscaping", 65, null], ["صيانة حدائق", "Garden maintenance", 35, null]]]]
  },
];
// Seasonality per sector (12 factors) and 3 years of monthly sales (QAR M). 2026 Jan–Sep sums to each sector's YTD; Oct 2026 is month-to-date.
const SEASON = { fmcg: [1.0, 1.02, 1.14, 1.06, 0.98, 0.93, 0.88, 0.9, 1.0, 1.03, 1.02, 1.1], fnb: [0.95, 0.96, 1.08, 1.0, 0.97, 0.94, 0.9, 0.92, 1.0, 1.04, 1.06, 1.2], re: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], retail: [0.98, 1.0, 1.16, 1.04, 0.97, 0.94, 0.9, 0.92, 1.0, 1.02, 1.03, 1.12], log: [0.96, 0.98, 1.06, 1.02, 1.0, 0.98, 0.94, 0.96, 1.0, 1.04, 1.04, 1.06], con: [0.9, 0.95, 1.0, 1.05, 1.08, 1.05, 0.95, 0.92, 1.0, 1.04, 1.06, 1.0], hb: [0.96, 1.0, 1.02, 1.0, 1.0, 0.98, 0.9, 0.92, 1.0, 1.04, 1.06, 1.14], fm: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] };
const YOY = { fmcg: [1.058, 1.081], fnb: [1.052, 1.069], re: [1.03, 1.044], retail: [1.06, 1.052], log: [1.07, 1.09], con: [1.04, 0.96], hb: [1.08, 1.11], fm: [1.05, 1.06] }; // [2025/2024, 2026/2025]
// Real FMCG sales from Postgres (/api/sales): "this month" is the latest complete month (index R.period), earlier months of the year feed the YTD.
const R = window.__SALES;
const CU = window.__CUST; // real customers from Postgres (/api/customers)
if (R) {
  const fm = MTD_TREE[0], p = R.period, mn = MONTHS[p], yr = R.year;
  fm.total = R.mtd; fm.lm = R.lm; fm.real = R.tree;
  SEC.fmcg.rev = +R.months.slice(0, p).reduce((a, v) => a + v, 0).toFixed(1);
  I.en.mtdSub = mn[1] + " " + yr + " (complete month)"; I.ar.mtdSub = mn[0] + " " + yr + " (شهر كامل)";
  I.en.revBySec = I.en.revBySec.replace(/Jan–w+ 2026/, "Jan–" + MONTHS[Math.max(p - 1, 0)][1] + " " + yr)
}
if (R) { // real mode: anything not backed by Postgres shows 0
  SECTORS.forEach(s => { s.tgt = 0; s.hc = 0; if (s.id !== "fmcg") s.rev = 0 });
  MTD_TREE.forEach(c => { if (c.sector !== "fmcg") { c.total = 0; c.lm = 0 } });
  TGT.fill(0); AI.length = 0
}
const MTD_SEC = {}; MTD_TREE.forEach(c => { MTD_SEC[c.sector] = c.total / 1e6 });
function noise(sid, y, m) { let h = (sid.length * 131 + y * 17 + m * 7) * 2654435761 % 2147483647; h = (h * 48271) % 2147483647; return 0.965 + (h % 700) / 10000 }
const MON_CACHE = {};
function MON(sid, y) {
  const k = sid + y; if (MON_CACHE[k]) return MON_CACHE[k];
  if (R) return MON_CACHE[k] = sid === "fmcg" && y === 2026 ? R.months : Array.from({ length: 12 }, (_, m) => y === 2026 && m > R.period ? null : 0); const se = SEASON[sid], base = SEC[sid].rev / se.slice(0, 9).reduce((a, x) => a + x, 0);
  let arr = se.map((f, m) => base * f);
  if (y === 2026) { const n = arr.slice(0, 9).map((v, m) => v * noise(sid, y, m)), sc = SEC[sid].rev / n.reduce((a, x) => a + x, 0); arr = n.map(v => +(v * sc).toFixed(2)); arr[9] = +MTD_SEC[sid].toFixed(2); arr[10] = null; arr[11] = null }
  else { const d = y === 2025 ? YOY[sid][1] : YOY[sid][1] * YOY[sid][0]; arr = arr.map((v, m) => +(v / d * noise(sid, y, m)).toFixed(2)) }
  return MON_CACHE[k] = arr
}
function MONG(y) { return Array.from({ length: 12 }, (_, m) => { const vs = SECTORS.filter(s => inScope(s.id)).map(s => MON(s.id, y)[m]); return vs.some(v => v == null) ? null : +vs.reduce((a, x) => a + x, 0).toFixed(2) }) }
const ACT = (() => { const g = Array.from({ length: 9 }, (_, m) => SECTORS.reduce((a, s) => a + MON(s.id, 2026)[m], 0)); return g.map(v => +v.toFixed(1)) })();
if (R && R.period < 9) ACT.length = R.period + 1; // chart stops at the real "this month"
function mtdNodes(path) {
  // returns {rows:[{label,sub,value,lm,units,leaf}], title}
  const cos = MTD_TREE.filter(c => inScope(c.sector));
  if (path.length === 0) return cos.map((c, i) => ({ i, label: L([c.ar, c.en]), sub: sName(c.sector), value: c.total, lm: c.lm }));
  const c = cos[path[0]];
  if (c.real) {
    if (path.length === 1) return c.real.map((b, i) => ({ i, label: b.n, value: b.v, lm: b.lm }));
    return c.real[path[1]].items.map((x, i) => ({ i, label: x.n, value: x.v, lm: x.lm, units: x.u || null, leaf: true }))
  }
  const bw = c.brands.reduce((a, b) => a + b[2], 0); const ratio = c.lm / c.total;
  const brands = c.brands.map((b, i) => { const v = Math.round(c.total * b[2] / bw / 100) * 100; return { i, label: L(b), value: v, lm: Math.round(v * ratio * (0.93 + ((i * 37) % 14) / 100) / 100) * 100 } });
  if (path.length === 1) return brands;
  const b = c.brands[path[1]], bv = brands[path[1]].value, pw = b[3].reduce((a, p) => a + p[2], 0);
  return b[3].map((p, i) => { const v = Math.round(bv * p[2] / pw / 10) * 10; return { i, label: L(p), value: v, lm: Math.round(v * (0.9 + ((i * 29 + path[1] * 7) % 22) / 100) / 10) * 10, units: p[3] ? Math.round(v / p[3]) : null, leaf: true } });
}
const SHIP_TO = [["الميرة – الغرافة", "Al Meera – Gharrafa"], ["لولو – الدفنة", "Lulu – Dafna"], ["كارفور – فيلاجيو", "Carrefour – Villaggio"], ["وقود – الوكرة", "Woqod – Al Wakra"], ["دانكن – اللؤلؤة", "Dunkin – The Pearl"], ["سفاري – السلوى", "Safari – Salwa Rd"], ["باسكن روبنز – مول قطر", "Baskin Robbins – Mall of Qatar"], ["مونوبري – اللؤلؤة", "Monoprix – The Pearl"], ["أنصار جاليري", "Ansar Gallery"], ["سبار – الخور", "Spar – Al Khor"]];
function makeShipments() {
  const st = ["s_done", "s_route", "s_route", "s_load", "s_done", "s_late", "s_route", "s_done", "s_load", "s_route"]; const tp = ["dry", "chilled", "dry", "dry", "frozen", "chilled", "frozen", "dry", "chilled", "dry"];
  return SHIP_TO.map((t, i) => ({ id: "SH-" + (88210 + i), to: t, temp: tp[i], status: st[i], veh: "QTR-" + (2140 + i * 7), eta: `${String(8 + i).padStart(2, "0")}:${i % 2 ? "30" : "15"}` }))
}
const WAREHOUSES = [["المستودع الرئيسي – الصناعية", "Main DC – Industrial Area", 3800, 86], ["مبرّد ومجمّد – الصناعية", "Chilled & frozen – Industrial Area", 2600, 93], ["مستودع الوكرة", "Al Wakra", 2400, 71], ["مستودع أبو هامور", "Abu Hamour", 2900, 64], ["مستودع الدوحة الجديدة", "New Doha store", 2300, 78], ["مخزن مسيعيد", "Mesaieed", 2000, 52], ["مناطق – المستودع الجديد", "Manateq – new DC", 17500, 18]];
const CUSTOMS = [["BL-QA-55120", "مستورد أغذية خفيفة", "Snacks importer", "c_rel"], ["BL-QA-55134", "موزّع ألبان", "Dairy distributor", "c_insp"], ["BL-QA-55141", "ترانسند للتجارة – كيلوقز", "Transind Trading – Kellogg's", "c_docs"], ["BL-QA-55150", "مستورد أجهزة", "Electronics importer", "c_docs"]];

function makeInvoices() {
  const inv = []; let n = 0; const buckets = ["current", "current", "current", "d30", "d30", "d60", "d90", "over90"];
  FMCG_ACC.forEach((a, ai) => {
    for (let k = 0; k < 4; k++) {
      const b = buckets[(ai + k * 3) % buckets.length]; const amt = Math.round(20 + rnd() * 260) * 1000; const off = { current: -15, d30: 20, d60: 45, d90: 75, over90: 120 }[b];
      inv.push({ number: "AR-26-" + (40500 + n++), customerId: a[2], date: dateAdd(-off - 30), dueDate: dateAdd(-off), amount: amt, balance: b === "current" && k === 0 ? amt : Math.round(amt * (b === "current" ? 1 : 0.6 + rnd() * 0.4) / 100) * 100, bucket: b })
    }
  });
  return inv;
}

/* ===================== mock ERP adapter (same interface as crm/integration/erp-adapter.js) ===================== */
class MockAdapter {
  constructor(d) { this.d = d; this.seq = 70001 }
  async testConnection() { await wait(600); return { ok: true, detail: "mock" } }
  async listInvoices({ customerId } = {}) { return this.d.invoices.filter(i => !customerId || i.customerId === customerId) }
  async getAging(customerId) { const b = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 }; (await this.listInvoices({ customerId })).forEach(i => b[i.bucket] += i.balance); return b }
  async createSalesOrder() { await wait(400); return "SO-" + (this.seq++) }
}
const api = async (u, m, b) => { const r = await fetch(u, { method: m, headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); if (!r.ok) throw new Error(r.status); return r.json() };
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ===================== state ===================== */
const ROLES = {
  ceo: { views: ["sales", "act", "dash", "pipe", "rest", "acc", "hr", "log", "fin"] },
  cfo: { views: ["sales", "act", "dash", "acc", "fin"] },
  mgr: { views: ["sales", "act", "dash", "pipe", "acc", "hr", "log"], lock: "fmcg" },
  rep: { views: ["pipe", "acc", "sales", "act"], lock: "fmcg", owner: 0 },
  rest: { views: ["sales", "rest", "dash", "hr"], lock: "fnb" },
  hr: { views: ["hr"] },
  log: { views: ["log", "sales", "dash"], lock: "log" },
};
const VIEWS = [
  ["sales", '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'],
  ["act", '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
  ["dash", '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>'],
  ["pipe", '<path d="M4 4h16M4 12h10M4 20h6M18 10l3 3-3 3"/>'],
  ["rest", '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>'],
  ["acc", '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'],
  ["hr", '<path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>'],
  ["log", '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>'],
  ["fin", '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'],
];
const S = { lang: "en", view: "sales", mon: 9, sector: "all", role: "ceo", acc: "CUST-1001", salesSector: "fmcg", kind: "mock", drill: [], hrPath: [], branch: null, sdrill: [] };
const DATA = {
  deals: makeDeals(), leaves: makeLeaves(), docs: makeDocs(), ships: makeShipments(), invoices: makeInvoices(),
  log: [{ t: "19:15", job: "AR invoices → CRM", ok: true, n: 48 }, { t: "19:00", job: "Customers → CRM", ok: true, n: 12 }, { t: "18:45", job: "AR invoices → CRM", ok: true, n: 3 }, { t: "18:30", job: "Sales order SO-64117 → ERP", ok: true, n: 1 }, { t: "18:15", job: "HCM workers → HR", ok: false, n: 0 }]
};
if (window.__BOOT) Object.assign(DATA, window.__BOOT);
if (R) Object.assign(DATA, { deals: [], invoices: [], ships: [], leaves: [], docs: [], log: [] });
const ERP = new MockAdapter(DATA);
try { const s = JSON.parse(localStorage.getItem("t1-ui-v3") || "{}"); Object.assign(S, s) } catch (e) { }
function save() { try { localStorage.setItem("t1-ui-v3", JSON.stringify({ lang: S.lang, view: S.view, sector: S.sector, role: S.role, salesSector: S.salesSector })) } catch (e) { } }

const t = k => I[S.lang][k] ?? I.en[k] ?? k;
const L = pair => S.lang === "ar" ? pair[0] : pair[1];
const sName = id => S.lang === "ar" ? SEC[id].ar : SEC[id].en;
const fmt = (n, d = 0) => new Intl.NumberFormat("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
const money = n => n >= 1e6 ? fmt(n / 1e6, 2) + " " + t("m") : fmt(n);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = s => document.querySelector(s);
function scope() { const r = ROLES[S.role]; return r.lock || S.sector }
function inScope(sid) { const sc = scope(); return sc === "all" || sc === sid }

/* ===================== shell ===================== */
function renderShell() {
  document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === "ar" ? "rtl" : "ltr";
  $("#brandName").textContent = t("brand"); const rf = $("#railFoot"); if (rf) rf.textContent = t("foot"); const sb = $("#sampleBadge"); if (sb) sb.textContent = t("sample"); $("#liveTxt").textContent = t("live") + " · " + (DATA.log[0]?.t ?? "");
  $("#lblSector").textContent = t("sector"); $("#lblRole").textContent = t("role"); $("#langBtn").textContent = S.lang === "ar" ? "English" : "العربية";
  const r = ROLES[S.role]; if (!r.views.includes(S.view)) S.view = r.views[0];
  $("#nav").innerHTML = VIEWS.filter(v => r.views.includes(v[0])).map(v => `<button type="button" data-v="${v[0]}" ${S.view === v[0] ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${v[1]}</svg>${t("v_" + v[0])}</button>`).join("");
  const ss = $("#sectorSel"); ss.innerHTML = `<option value="all">${t("all")}</option>` + SECTORS.map(s => `<option value="${s.id}">${sName(s.id)}</option>`).join("");
  ss.value = r.lock || S.sector; ss.disabled = !!r.lock;
  $("#roleSel").innerHTML = Object.keys(ROLES).map(k => `<option value="${k}">${t("r_" + k)}</option>`).join(""); $("#roleSel").value = S.role;
  $("#viewTitle").textContent = t("v_" + S.view);
  VIEW_FN[S.view](); save();
}
$("#nav").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (b) { S.view = b.dataset.v; renderShell() } });
$("#sectorSel").addEventListener("change", e => { S.sector = e.target.value; S.drill = []; S.hrPath = []; S.sdrill = []; if (S.sector !== "all") S.salesSector = S.sector; renderShell() });
$("#roleSel").addEventListener("change", e => { S.role = e.target.value; S.drill = []; S.hrPath = []; S.sdrill = []; renderShell() });
$("#langBtn").addEventListener("click", () => { S.lang = S.lang === "ar" ? "en" : "ar"; renderShell() });

/* tooltip */
const tip = $("#tip");
document.addEventListener("pointermove", e => {
  const el = e.target.closest("[data-tip]"); if (!el) { tip.hidden = true; return } tip.textContent = el.dataset.tip; tip.hidden = false;
  const w = tip.offsetWidth; let x = e.clientX + 12; if (x + w > innerWidth - 8) x = e.clientX - w - 12; tip.style.left = Math.max(8, x) + "px"; tip.style.top = (e.clientY + 14) + "px"
});
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 3200) }

/* ===================== chart helpers ===================== */
function hbars(rows, { fmtV = v => fmt(v), max } = {}) {
  const m = max || Math.max(...rows.map(r => r.v)) || 1;
  return `<div class="hbars">${rows.map(r => `<div class="hbar" data-tip="${esc(r.l)}: ${esc(fmtV(r.v))}${r.extra ? " · " + esc(r.extra) : ""}"><span class="lab">${esc(r.l)}</span><span class="track"><span class="fill ${r.cls || ""}" style="display:block;width:${Math.max(1, r.v / m * 100)}%"></span></span><span class="num">${esc(r.show ?? fmtV(r.v))}</span></div>`).join("")}</div>`
}
function lineChart() {
  const W = 640, H = 230, pl = 36, pr = 12, pt = 12, pb = 26, max = 50, iw = W - pl - pr, ih = H - pt - pb;
  const x = i => pl + i * (iw / 11), y = v => pt + ih - (v / max) * ih;
  const grid = [0, 10, 20, 30, 40, 50].map(v => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" /><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("");
  const xl = MONTHS.map((m, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" style="font-family:var(--f-body)">${L(m)}</text>`).join("");
  const tp = TGT.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const ap = ACT.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join("");
  const area = ap + `L${x(ACT.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const hits = MONTHS.map((m, i) => `<rect x="${x(i) - iw / 22}" y="${pt}" width="${iw / 11}" height="${ih}" fill="transparent" data-tip="${L(m)} 2026 · ${t("actual")}: ${ACT[i] ?? "—"} · ${t("target")}: ${TGT[i]}"/>`).join("");
  const last = ACT.length - 1;
  return `<div class="tw"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:420px;direction:ltr" role="img" aria-label="${esc(t("trend"))}">
  ${grid}${xl}<defs><linearGradient id="lca" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--cyan);stop-opacity:.32"/><stop offset="1" style="stop-color:var(--brand);stop-opacity:0"/></linearGradient><linearGradient id="lcl" x1="0" x2="1"><stop offset="0" style="stop-color:#4a63ff"/><stop offset="1" style="stop-color:#3ad6ff"/></linearGradient></defs><path d="${area}" fill="url(#lca)"/><path d="${tp}" fill="none" stroke="var(--series-2)" stroke-width="2" stroke-dasharray="5 4"/>
  <path d="${ap}" fill="none" stroke="url(#lcl)" stroke-width="2.5" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(58,214,255,.5))"/>
  <circle cx="${x(last)}" cy="${y(ACT[last])}" r="4.5" fill="var(--series)" stroke="var(--panel)" stroke-width="2"/>
  <text x="${x(last)}" y="${y(ACT[last]) - 10}" text-anchor="middle" style="fill:var(--ink)">${ACT[last]}</text>${hits}</svg></div>
  <div class="legend"><span><i></i>${t("actual")}</span><span><i class="t"></i>${t("target")}</span></div>`
}
let sparkN = 0;
function spark(arr) {
  const id = "sg" + (sparkN++), W = 120, H = 30, mn = Math.min(...arr), mx = Math.max(...arr), r = mx - mn || 1;
  const d = arr.map((v, i) => (i ? "L" : "M") + (i / (arr.length - 1) * W).toFixed(1) + "," + (H - 3 - (v - mn) / r * (H - 6)).toFixed(1)).join("");
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--cyan);stop-opacity:.35"/><stop offset="1" style="stop-color:var(--cyan);stop-opacity:0"/></linearGradient></defs><path d="${d}L${W},${H}L0,${H}Z" fill="url(#${id})"/><path d="${d}" fill="none" style="stroke:var(--cyan)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`
}
const kpi = (l, v, d, cls = "", sp, go) => go ? `<button type="button" class="kpi" data-go="${go}"><span class="l">${l}</span><span class="v">${v}</span>${d ? `<span class="d ${cls}">${d}</span>` : ""}${sp ? spark(sp) : ""}<span class="go">${t("open")} ›</span></button>` : `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span>${d ? `<span class="d ${cls}">${d}</span>` : ""}${sp ? spark(sp) : ""}</div>`;
document.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (!g) return; const [v, sid] = g.dataset.go.split(":"); S.view = v; if (v === "hr") S.hrPath = sid ? [sid] : []; if (R) { // real mode: sample constants the other views read show 0
  BRANDS.forEach(b => { b[2] = b[3] = b[4] = 0 }); HOURS.forEach(h => { h[1] = 0 }); CHMIX.forEach(c => { c[2] = 0 });
  BRANCH_P.forEach(b => { b[2] = b[3] = 0 }); CHANNELS.forEach(c => { c[2] = c[3] = 0 }); WAREHOUSES.forEach(w => { w[2] = w[3] = 0 });
  SALES_TEAM.forEach(m => { m[5] = m[6] = m[7] = 0 }); CUSTOMS.length = 0;
  Object.values(ORG).forEach(depts => depts.forEach(jobs => jobs.forEach(j => { j[2] = 0 })))
}
renderShell(); scrollTo(0, 0) });

/* ===================== views ===================== */
const C = $("#content");
function gauge(p, el) {
  const r = 46, cx = 60, cy = 58, ang = a => Math.PI * (1 - a), pt = a => [cx + r * Math.cos(ang(a)), cy - r * Math.sin(ang(a))];
  const [x1, y1] = pt(0), [x2, y2] = pt(Math.min(p, 1)), [ex, ey] = pt(el), [ix, iy] = [cx + (r - 14) * Math.cos(ang(el)), cy - (r - 14) * Math.sin(ang(el))];
  return `<div class="gauge" data-tip="${t("gTip").replace("{p}", fmt(p * 100, 0)).replace("{e}", fmt(el * 100, 0))}"><svg viewBox="0 0 120 66" width="120" height="66" aria-hidden="true" style="direction:ltr"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" style="stop-color:#4a63ff"/><stop offset="1" style="stop-color:#3ad6ff"/></linearGradient></defs>
  <path d="M${x1},${y1}A${r},${r} 0 0 1 ${pt(1)[0]},${pt(1)[1]}" fill="none" stroke="rgba(140,160,255,.14)" stroke-width="10" stroke-linecap="round"/>
  <path d="M${x1},${y1}A${r},${r} 0 0 1 ${x2},${y2}" fill="none" stroke="url(#gg)" stroke-width="10" stroke-linecap="round" style="filter:drop-shadow(0 0 5px rgba(58,214,255,.55))"/>
  <line x1="${ix}" y1="${iy}" x2="${ex}" y2="${ey}" style="stroke:var(--ink)" stroke-width="2"/>
  <text x="60" y="56" text-anchor="middle" style="fill:#fff;font-size:17px">${fmt(p * 100, 0)}%</text></svg>
  <span class="gl"><b>${t("gTarget")}</b><span>${t("gLine").replace("{e}", fmt(el * 100, 0))}</span></span></div>`
}
/* ===================== actual trading data (September) ===================== */
let TDX = null;
function tdIndex() {
  if (TDX) return TDX; const item = TD.items.map(() => ({ s: 0, c: 0, n: 0, cu: new Set() })), cust = TD.custs.map(() => ({ s: 0, c: 0, n: 0 })), byCust = TD.custs.map(() => []); let tot = 0, cost = 0, ret = 0, retN = 0;
  TD.rows.forEach((r, i) => { const [ci, ii, s, c] = r; item[ii].s += s; item[ii].c += c; item[ii].n++; item[ii].cu.add(ci); cust[ci].s += s; cust[ci].c += c; cust[ci].n++; byCust[ci].push(i); tot += s; cost += c; if (s < 0) { ret += s; retN++ } });
  const grp = TD.groups.map(() => ({ s: 0, c: 0, n: 0, br: 0 })); cust.forEach((x, i) => { const g = TD.custs[i][2]; grp[g].s += x.s; grp[g].c += x.c; grp[g].n += x.n; if (x.s !== 0) grp[g].br++ });
  const brand = TD.brands.map(() => ({ s: 0, c: 0, k: 0, cu: new Set() })); item.forEach((x, i) => { const b = TD.items[i][2]; brand[b].s += x.s; brand[b].c += x.c; if (x.s !== 0) brand[b].k++; x.cu.forEach(v => brand[b].cu.add(v)) });
  return TDX = { item, cust, byCust, grp, brand, tot, cost, ret, retN }
}
const mPct = (s, c) => s ? ((s - c) / s * 100) : 0;
const mChip = (s, c) => { const m = mPct(s, c); return `<span class="chip ${m >= 30 ? "good" : m >= 15 ? "plain" : m >= 5 ? "warn" : "bad"}" style="font-size:10.5px"><span class="num">${fmt(m, 1)}%</span></span>` };
function actRows(kind, path) {
  const X = tdIndex(); const q = (S.actQ || "").toLowerCase(); let rows = [];
  if (kind === "p") {
    const m = new Map();
    TD.rows.forEach(r => {
      const [ci, ii, s, c, d] = r; const it = TD.items[ii]; if (path.length >= 1 && d !== path[0]) return; if (path.length >= 2 && it[2] !== path[1]) return;
      const key = path.length === 0 ? d : path.length === 1 ? it[2] : ii; const o = m.get(key) || { k: key, label: path.length === 0 ? TD.deps[d] : path.length === 1 ? TD.brands[it[2]] : it[1], s: 0, c: 0, it: new Set(), cu: new Set(), leaf: path.length === 2, code: it[0], pk: it[3] }; o.s += s; o.c += c; o.it.add(ii); o.cu.add(ci); m.set(key, o)
    });
    rows = [...m.values()].filter(o => o.s || o.c).map(o => ({ ...o, sub: path.length === 2 ? o.code + " · " + t("pack") + " " + o.pk + " · " + o.cu.size + " " + t("custsN") : o.it.size + " " + t("itemsK") + " · " + o.cu.size + " " + t("custsN") }));
  } else {
    if (path.length === 0) rows = TD.groups.map((g, i) => ({ k: i, label: g, s: X.grp[i].s, c: X.grp[i].c, sub: X.grp[i].br + " " + (S.lang === "ar" ? "فرع/حساب" : "branches") })).filter(r => r.s || r.c);
    else if (path.length === 1) rows = TD.custs.map((cu, i) => ({ cu, i })).filter(z => z.cu[2] === path[0] && (X.cust[z.i].s || X.cust[z.i].c)).map(z => ({ k: z.i, label: z.cu[1], s: X.cust[z.i].s, c: X.cust[z.i].c, sub: z.cu[0] + " · " + X.cust[z.i].n + " " + t("lines") }));
    else if (path.length === 2) { const m = new Map(); X.byCust[path[1]].forEach(ri => { const r = TD.rows[ri], b = TD.items[r[1]][2]; const o = m.get(b) || { k: b, label: TD.brands[b], s: 0, c: 0, n: 0 }; o.s += r[2]; o.c += r[3]; o.n++; m.set(b, o) }); rows = [...m.values()].map(o => ({ ...o, sub: o.n + " " + t("itemsK") })) }
    else rows = X.byCust[path[1]].map(ri => TD.rows[ri]).filter(r => TD.items[r[1]][2] === path[2]).map(r => ({ k: r[1], label: TD.items[r[1]][1], s: r[2], c: r[3], sub: TD.items[r[1]][0] + " · " + t("pack") + " " + TD.items[r[1]][3], leaf: true }));
  }
  if (q) rows = rows.filter(r => r.label.toLowerCase().includes(q) || (r.sub || "").toLowerCase().includes(q));
  return rows.sort((a, b) => b.s - a.s)
}
function actDrillHTML(kind) {
  const path = S.actPath[kind] || []; const rows = actRows(kind, path); const tot = rows.reduce((a, r) => a + r.s, 0), cost = rows.reduce((a, r) => a + r.c, 0), mx = Math.max(1, ...rows.map(r => Math.abs(r.s)));
  const names = kind === "p" ? [t("dep"), t("brands"), t("products")] : [t("grp"), t("brCust"), t("brands"), t("products")];
  const labelAt = (lvl) => { const pth = path.slice(0, lvl); const r = actRows(kind, pth.slice(0, -1)).find(x => x.k === pth[pth.length - 1]); return r ? r.label : "" };
  const cr = [path.length ? `<button type="button" data-ac="${kind}:0">${t("all")}</button>` : `<span class="cur">${t("all")}</span>`];
  for (let l = 1; l <= path.length; l++) { const keep = S.actQ; S.actQ = ""; const lab = labelAt(l); S.actQ = keep; cr.push(l < path.length ? `<button type="button" data-ac="${kind}:${l}">${esc(lab)}</button>` : `<span class="cur">${esc(lab)}</span>`) }
  const leaf = rows.length && rows[0].leaf; const shown = rows.slice(0, S.actMore === kind ? rows.length : 25);
  return `<header><h2>${kind === "p" ? t("drillP") : t("drillC")}</h2><span class="src">${t("srcCsv")}</span></header>
  <div class="mtd"><span class="big">${fmt(tot)} ${t("qar")}</span><span class="src">${t("cost")}: <span class="num">${fmt(cost)}</span></span><span>${mChip(tot, cost)} <span class="src">${t("gmv")}</span></span></div>
  <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px"><nav class="crumbs" aria-label="breadcrumb">${cr.join("<i>›</i>")}</nav><span class="src">${names[path.length]} · ${fmt(rows.length)}${leaf ? "" : " · " + t("clickHint")}</span></div>
  <div class="drill">${shown.map(r => `<button type="button" class="dr" ${leaf ? "disabled" : ""} data-ak="${kind}:${r.k}" data-tip="${esc(r.label)}: ${fmt(r.s)} ${t("qar")} · ${t("share")} ${fmt(r.s / tot * 100, 1)}% · ${t("cost")} ${fmt(r.c)}">
   <span class="lab">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</span>
   <span class="track"><span class="fill ${r.s < 0 ? "bad" : ""}" style="width:${Math.max(1, Math.abs(r.s) / mx * 100)}%"></span></span>
   <span class="num" style="text-align:end">${fmt(r.s)}<small style="display:block;font-size:11px">${mChip(r.s, r.c)}</small></span>
   <span class="chev" aria-hidden="true">${leaf ? "" : "›"}</span></button>`).join("")}</div>
  ${rows.length > shown.length ? `<button class="btn sm" type="button" data-more="${kind}" style="margin-top:10px">${S.lang === "ar" ? "عرض الكل" : "Show all"} (${fmt(rows.length)})</button>` : ""}`
}
function actInsights() {
  const X = tdIndex(); const tot = X.tot; const br = TD.brands.map((b, i) => ({ b, ...X.brand[i] })).sort((a, b) => b.s - a.s); const gr = TD.groups.map((g, i) => ({ g, ...X.grp[i] })).sort((a, b) => b.s - a.s);
  const top10 = gr.slice(0, 10).reduce((a, x) => a + x.s, 0); const meera = gr.find(x => x.g === "Al Meera") || { s: 0, br: 0 }; const dl = (gr.find(x => x.g === "Talabat") || { s: 0 }).s + (gr.find(x => x.g === "Snoonu") || { s: 0 }).s;
  const retByDep = TD.deps.map((d, i) => { let s = 0; TD.rows.forEach(r => { if (r[2] < 0 && r[4] === i) s += r[2] }); return { d, s } }).sort((a, b) => a.s - b.s)[0];
  const low = br.filter(x => x.s > 50000 && mPct(x.s, x.c) < 15).map(x => x.b); const neg = X.item.filter(x => x.s > 0 && x.c > x.s).length;
  const tail = X.cust.filter(x => x.s > 0 && x.s < 500).length, act = X.cust.filter(x => x.s > 0).length;
  const out = [["warn", t("i_top").replace("{p}", fmt(br[0].s / tot * 100, 1)).replace("{b}", br.slice(0, 3).map(x => x.b).join("، ")).replace("{q}", fmt(br.slice(0, 3).reduce((a, x) => a + x.s, 0) / tot * 100, 1))],
  ["warn", t("i_conc").replace("{p}", fmt(top10 / tot * 100, 1)).replace("{m}", fmt(meera.s / tot * 100, 1)).replace("{n}", meera.br)],
  ["good", t("i_deliv").replace("{v}", fmt(dl / 1e6, 2)).replace("{p}", fmt(dl / tot * 100, 1))],
  ["bad", t("i_ret").replace("{v}", fmt(-X.ret / 1e6, 2)).replace("{p}", fmt(-X.ret / tot * 100, 1)).replace("{n}", fmt(X.retN)).replace("{b}", retByDep.d)],
  ["plain", t("i_margin").replace("{p}", fmt(mPct(tot, X.cost), 1)).replace("{b}", low.slice(0, 5).join("، ") || "—").replace("{n}", fmt(neg))],
  ["plain", t("i_tail").replace("{n}", fmt(tail)).replace("{t}", fmt(act))]];
  return `<header><h2>${t("ana")}</h2><span class="live"><i></i>${t("anaSrc")}</span></header><div class="conn">${out.map(o => `<div class="panel" style="background:rgba(255,255,255,.02)"><span><span class="chip ${o[0]}">${o[0] === "good" ? "▲" : o[0] === "bad" ? "▼" : o[0] === "warn" ? "!" : "i"}</span></span><p style="color:var(--text);margin-top:6px">${o[1]}</p></div>`).join("")}</div>`
}
function actual() {
  const X = tdIndex(); S.actPath = S.actPath || { p: [], c: [] }; const act = X.cust.filter(x => x.s > 0).length, items = X.item.filter(x => x.s > 0).length;
  const gr = TD.groups.map((g, i) => ({ g, ...X.grp[i] })).sort((a, b) => b.s - a.s).slice(0, 10); const br = TD.brands.map((b, i) => ({ b, ...X.brand[i] })).filter(x => x.s > 100000).sort((a, b) => mPct(b.s, b.c) - mPct(a.s, a.c));
  C.innerHTML = `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="margin-inline-end:auto">${t("actT")}</h2><span class="live"><i></i>${t("actual")}</span><input class="search" id="actQ" type="search" value="${esc(S.actQ || "")}" placeholder="${t("searchAct")}" aria-label="${t("searchAct")}"></div>
 <div class="kpis">${kpi(t("salesM").replace("{m}", S.lang === "ar" ? "سبتمبر" : "September"), fmt(X.tot / 1e6, 2) + " " + t("m"), fmt(X.tot) + " " + t("qar"))}${kpi(t("gmv"), fmt(mPct(X.tot, X.cost), 1) + "%", t("cost") + ": " + fmt(X.cost / 1e6, 2) + " " + t("m"))}${kpi(t("custAct"), fmt(act), TD.groups.length + " " + (S.lang === "ar" ? "سلسلة/عميل" : "chains"))}${kpi(t("itemsN"), fmt(items), TD.brands.length + " " + (S.lang === "ar" ? "براند" : "brands"))}${kpi(t("returns"), fmt(X.ret / 1e6, 2) + " " + t("m"), fmt(-X.ret / X.tot * 100, 1) + "% · " + fmt(X.retN) + " " + t("lines"), "down")}${kpi(t("avgCust"), fmt(X.tot / act), fmt(TD.rows.length) + " " + t("lines"))}</div>
 <div class="grid">
  <section class="panel c6" id="actP">${actDrillHTML("p")}</section>
  <section class="panel c6" id="actC">${actDrillHTML("c")}</section>
  <section class="panel c12">${actInsights()}</section>
  <section class="panel c6"><header><h2>${t("topCust")}</h2><span class="src">${t("srcCsv")}</span></header><div class="tw"><table><thead><tr><th>${t("grp")}</th><th class="n">${t("value")}</th><th class="n">${t("share")}</th><th class="n">${t("margin")}</th><th class="n">${S.lang === "ar" ? "فروع" : "Branches"}</th></tr></thead><tbody>${gr.map(x => `<tr><td>${esc(x.g)}</td><td class="n num">${fmt(x.s)}</td><td class="n num">${fmt(x.s / X.tot * 100, 1)}%</td><td class="n">${mChip(x.s, x.c)}</td><td class="n num">${x.br}</td></tr>`).join("")}</tbody></table></div></section>
  <section class="panel c6"><header><h2>${t("brandM")}</h2><span class="src">${S.lang === "ar" ? "البراندات اللي مبيعاتها فوق 100 ألف" : "Brands above QAR 100k"}</span></header><div class="tw scroll"><table><thead><tr><th>${t("brands")}</th><th class="n">${t("value")}</th><th class="n">${t("margin")}</th><th class="n">${t("itemsK")}</th><th class="n">${t("custsN")}</th></tr></thead><tbody>${br.map(x => `<tr><td>${esc(x.b)}</td><td class="n num">${fmt(x.s)}</td><td class="n">${mChip(x.s, x.c)}</td><td class="n num">${x.k}</td><td class="n num">${x.cu.size}</td></tr>`).join("")}</tbody></table></div></section>
 </div>`;
  bindAct();
  const q = $("#actQ"); let tm; q.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { S.actQ = q.value.trim(); $("#actP").innerHTML = actDrillHTML("p"); $("#actC").innerHTML = actDrillHTML("c"); bindAct() }, 250) }
}
function bindAct() {
  C.querySelectorAll("[data-ak]").forEach(b => b.onclick = () => { const [k, v] = b.dataset.ak.split(":"); const max = k === "p" ? 2 : 3; if (S.actPath[k].length >= max) return; S.actPath[k] = [...S.actPath[k], +v]; S.actQ = ""; $("#actQ").value = ""; $(k === "p" ? "#actP" : "#actC").innerHTML = actDrillHTML(k); bindAct() });
  C.querySelectorAll("[data-ac]").forEach(b => b.onclick = () => { const [k, l] = b.dataset.ac.split(":"); S.actPath[k] = S.actPath[k].slice(0, +l); S.actMore = null; $(k === "p" ? "#actP" : "#actC").innerHTML = actDrillHTML(k); bindAct() });
  C.querySelectorAll("[data-more]").forEach(b => b.onclick = () => { const k = b.dataset.more; S.actMore = k; $(k === "p" ? "#actP" : "#actC").innerHTML = actDrillHTML(k); bindAct() })
}

/* ===================== sales centre ===================== */
const DAYS_IN = R ? 31 : 20, DAYS_OF = 31; // real data: the "this month" is a complete month, no proration
function salesRows() {
  const m = S.mon, partial = !R && m === 9, pf = partial ? DAYS_IN / DAYS_OF : 1; const p = S.sdrill || [];
  const secs = SECTORS.filter(s => inScope(s.id));
  if (p.length === 0) return secs.map(s => ({ k: s.id, label: sName(s.id), value: MON(s.id, 2026)[m] * 1e6, ly: MON(s.id, 2025)[m] * 1e6 * pf, ly2: MON(s.id, 2024)[m] * 1e6 * pf, sub: MTD_TREE.filter(c => c.sector === s.id).map(c => L([c.ar, c.en])).join(" · ") }));
  const sid = p[0], cos = MTD_TREE.filter(c => c.sector === sid); const sv = MON(sid, 2026)[m] * 1e6, ly = MON(sid, 2025)[m] * 1e6 * pf, ly2 = MON(sid, 2024)[m] * 1e6 * pf;
  const brands = cos.flatMap(c => c.brands.map(b => ({ b, c }))); const bw = brands.reduce((a, x) => a + x.b[2] * x.c.total, 0);
  const rowsB = brands.map((x, i) => { const w = x.b[2] * x.c.total / bw, g = noise(sid, 2025, i) + 0.01; return { k: i, label: L(x.b), sub: cos.length > 1 ? L([x.c.ar, x.c.en]) : "", value: Math.round(sv * w / 100) * 100, ly: ly * w / (g * 1.02) * (1 + ((i * 7) % 9 - 4) / 60), ly2: ly2 * w / (g * 1.02) * (1 + ((i * 5) % 7 - 3) / 50), _b: x.b } });
  if (p.length === 1) return rowsB;
  const br = rowsB[p[1]], prods = br._b[3], pw = prods.reduce((a, q) => a + q[2], 0);
  return prods.map((q, i) => { const w = q[2] / pw; const v = Math.round(br.value * w / 10) * 10; return { k: i, label: L(q), value: v, ly: br.ly * w * (1 + ((i * 11) % 13 - 6) / 50), ly2: br.ly2 * w * (1 + ((i * 3) % 11 - 5) / 40), units: q[3] ? Math.round(v / q[3]) : null, price: q[3], leaf: true, sid } })
}
function cmpChart() {
  const Y = [2024, 2025, 2026], series = Y.map(y => S.sdrill && S.sdrill.length ? MON(S.sdrill[0], y) : MONG(y));
  const W = 720, H = 250, pl = 38, pr = 10, pt = 14, pb = 28, iw = W - pl - pr, ih = H - pt - pb, gw = iw / 12, bw = gw / 4.2;
  const mx = Math.max(...series.flat().filter(v => v != null)) * 1.12, yy = v => pt + ih - v / mx * ih;
  const step = mx > 60 ? 20 : mx > 25 ? 10 : mx > 12 ? 5 : mx > 5 ? 2 : 1; let grid = ""; for (let v = 0; v <= mx; v += step)grid += `<line x1="${pl}" x2="${W - pr}" y1="${yy(v)}" y2="${yy(v)}" stroke="var(--line)"/><text x="${pl - 6}" y="${yy(v) + 4}" text-anchor="end">${v}</text>`;
  const fills = ["rgba(140,160,255,.28)", "#4a63ff", "url(#cmpg)"];
  let bars = ""; for (let m = 0; m < 12; m++) {
    const x0 = pl + m * gw; if (m === S.mon) bars += `<rect x="${x0 + 1}" y="${pt - 4}" width="${gw - 2}" height="${ih + 4}" rx="6" fill="rgba(58,214,255,.08)" stroke="rgba(58,214,255,.35)"/>`;
    const tipv = Y.map((y, i) => `${y}: ${series[i][m] == null ? "—" : fmt(series[i][m], 1)}`).join(" · ");
    Y.forEach((y, i) => { const v = series[i][m]; if (v == null) return; const x = x0 + gw * 0.1 + i * bw * 1.05; bars += `<rect x="${x}" y="${yy(v)}" width="${bw}" height="${Math.max(1, ih - (yy(v) - pt))}" rx="3" fill="${fills[i]}" ${i === 2 && m === 9 ? 'stroke="var(--cyan)" stroke-dasharray="3 2" opacity=".85"' : ""}/>` });
    bars += `<rect x="${x0}" y="${pt}" width="${gw}" height="${ih}" fill="transparent" data-tip="${L(MONTHS[m])} · ${tipv}${!R && m === 9 ? " (" + t("mtdTag") + ")" : ""}" data-mon="${m}" style="cursor:pointer"/><text x="${x0 + gw / 2}" y="${H - 8}" text-anchor="middle" style="font-family:var(--f-body)">${L(MONTHS[m])}</text>`
  }
  return `<div class="tw"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:560px;direction:ltr" role="img" aria-label="${esc(t("cmpT"))}"><defs><linearGradient id="cmpg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:#3ad6ff"/><stop offset="1" style="stop-color:#4a63ff"/></linearGradient></defs>${grid}${bars}</svg></div>
  <div class="legend"><span><i style="background:rgba(140,160,255,.28);height:10px;width:10px;border-radius:2px"></i>2024</span><span><i style="background:#4a63ff;height:10px;width:10px;border-radius:2px"></i>2025</span><span><i style="background:linear-gradient(#3ad6ff,#4a63ff);height:10px;width:10px;border-radius:2px"></i>2026</span><span class="src">${t("partial")}</span></div>`
}
function pct(a, b) { return b ? ((a / b - 1) * 100) : 0 }
const dlt = (a, b, small) => { const c = pct(a, b); return `<span class="${c >= 0 ? "up" : "down"}" style="font-size:${small ? 11 : 12.5}px">${c >= 0 ? "▲" : "▼"} ${fmt(Math.abs(c), 1)}%</span>` };
function salesDrillHTML() {
  const p = S.sdrill || [], rows = salesRows(); const tot = rows.reduce((a, r) => a + r.value, 0), ly = rows.reduce((a, r) => a + r.ly, 0), ly2 = rows.reduce((a, r) => a + r.ly2, 0), mx = Math.max(1, ...rows.map(r => r.value));
  const leaf = p.length === 2; const lvl = [t("lvlSec"), t("lvlBrand"), t("lvlProd")][p.length];
  const cr = [p.length ? `<button type="button" data-sc="0">${t("all")}</button>` : `<span class="cur">${t("all")}</span>`];
  if (p.length >= 1) cr.push(p.length > 1 ? `<button type="button" data-sc="1">${esc(sName(p[0]))}</button>` : `<span class="cur">${esc(sName(p[0]))}</span>`);
  if (p.length === 2) { const b = salesRowsAt([p[0]])[p[1]]; cr.push(`<span class="cur">${esc(b.label)}</span>`) }
  return `<header><h2>${t("brk")} · ${L(MONTHS[S.mon])} 2026${S.mon === 9 ? " (" + t("mtdOf") + ")" : ""}</h2><span class="src">${t("src_or")}</span></header>
  <div class="mtd"><span class="big">${fmt(tot)} ${t("qar")}</span><span>${dlt(tot, ly)} <span class="src">${t("vsLy1").replace("{m}", L(MONTHS[S.mon]))}</span></span><span>${dlt(tot, ly2)} <span class="src">${t("vsLy2").replace("{m}", L(MONTHS[S.mon]))}</span></span></div>
  <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px"><nav class="crumbs" aria-label="breadcrumb">${cr.join("<i>›</i>")}</nav><span class="src">${lvl}${leaf ? "" : " · " + t("clickHint")}</span></div>
  <div class="drill">${rows.slice().sort((a, b) => b.value - a.value).map(r => `<button type="button" class="dr" ${leaf ? "disabled" : ""} data-sk="${r.k}" data-tip="${esc(r.label)}: ${fmt(r.value)} ${t("qar")} · ${t("share")} ${fmt(r.value / tot * 100, 1)}% · 2025: ${fmt(r.ly)} · 2024: ${fmt(r.ly2)}">
   <span class="lab">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : r.units ? `<small>${t("units")}: <span class="num">${fmt(r.units)}</span> · ${t("price")}: <span class="num">${fmt(r.price, 2)}</span></small>` : ""}</span>
   <span class="track"><span class="fill" style="width:${Math.max(1, r.value / mx * 100)}%"></span></span>
   <span class="num" style="text-align:end">${fmt(r.value)}<small style="display:block;font-size:11px">${dlt(r.value, r.ly, 1)}</small></span>
   <span class="chev" aria-hidden="true">${leaf ? "" : "›"}</span></button>`).join("")}</div>
  ${leaf ? `<div class="tw" style="margin-top:14px"><table><thead><tr><th>${t("products")}</th><th class="n">${L(MONTHS[S.mon])} 2026</th><th class="n">${L(MONTHS[S.mon])} 2025</th><th class="n">${L(MONTHS[S.mon])} 2024</th><th class="n">${t("yoy")}</th><th class="n">${t("units")}</th><th class="n">${t("share")}</th><th>${t("trend12")}</th></tr></thead><tbody>${rows.map(r => { const se = MON(r.sid, 2026).slice(0, 10); se[9] = se[9] * DAYS_OF / DAYS_IN; return `<tr><td>${esc(r.label)}</td><td class="n num">${fmt(r.value)}</td><td class="n num">${fmt(r.ly)}</td><td class="n num">${fmt(r.ly2)}</td><td class="n">${dlt(r.value, r.ly, 1)}</td><td class="n num">${r.units ? fmt(r.units) : "—"}</td><td class="n num">${fmt(r.value / tot * 100, 1)}%</td><td style="width:120px">${spark(se.map(v => v * r.value / tot))}</td></tr>` }).join("")}</tbody></table></div>` : ""}`
}
function salesRowsAt(path) { const keep = S.sdrill; S.sdrill = path; const r = salesRows(); S.sdrill = keep; return r }
function analysis() {
  const m = S.mon, mn = L(MONTHS[m]), secRows = salesRowsAt([]).map(r => ({ ...r, g: pct(r.value, r.ly) })).sort((a, b) => b.g - a.g);
  const out = []; const sc = S.sdrill && S.sdrill.length ? S.sdrill[0] : null;
  const gRows = sc ? salesRowsAt([sc]).map(r => ({ ...r, g: pct(r.value, r.ly) })).sort((a, b) => b.g - a.g) : secRows;
  if (gRows.length > 1) {
    out.push(["good", t("a_grow").replace("{s}", gRows[0].label).replace("{p}", fmt(secRows[0].g, 1)).replace("{m}", mn)]);
    const w = gRows[gRows.length - 1]; out.push(w.g < 0 ? ["bad", t("a_decl").replace("{s}", w.label).replace("{p}", fmt(Math.abs(w.g), 1)).replace("{m}", mn)] : ["plain", t("a_declNone").replace("{m}", mn)])
  }
  const sid = sc || secRows[0].k; const br = salesRowsAt([sid]).sort((a, b) => b.value - a.value); const bt = br.reduce((a, r) => a + r.value, 0);
  out.push(["plain", t("a_top").replace("{b}", br[0].label).replace("{p}", fmt(br[0].value / bt * 100, 1)).replace("{s}", sName(sid))]);
  const g26 = sc ? MON(sc, 2026) : MONG(2026), g25 = sc ? MON(sc, 2025) : MONG(2025), g24 = sc ? MON(sc, 2024) : MONG(2024);
  if (!R && m === 9) {
    const mtd = g26[9], proj = mtd / DAYS_IN * DAYS_OF; const tg = sc ? SEC[sc].tgt * SEASON[sc][9] / SEASON[sc].reduce((a, x) => a + x, 0) : TGT[9];
    out.push([proj >= tg ? "good" : "warn", t("a_proj").replace("{v}", fmt(proj, 1)).replace("{p}", fmt(proj / tg * 100, 0)).replace("{t}", fmt(tg, 0)).replace("{y}", fmt(proj / g25[9] * 100, 0))])
  }
  const ytd = g26.slice(0, 9).reduce((a, x) => a + x, 0) + g26[9], ytdL = g25.slice(0, 9).reduce((a, x) => a + x, 0) + g25[9] * DAYS_IN / DAYS_OF, ytd24 = g24.slice(0, 9).reduce((a, x) => a + x, 0) + g24[9] * DAYS_IN / DAYS_OF;
  out.push(["plain", t("a_ytd").replace("{v}", fmt(ytd, 1)).replace("{p}", fmt(pct(ytd, ytdL), 1)).replace("{c}", fmt((Math.sqrt(ytd / ytd24) - 1) * 100, 1))]);
  const bi = g25.indexOf(Math.max(...g25)); out.push(["plain", t("a_season").replace("{m}", L(MONTHS[bi])).replace("{v}", fmt(g25[bi], 1))]);
  if (!sc || sc === "fmcg") { out.push(["warn", t("a_conc").replace("{p}", "58")]); out.push(["good", t("a_van").replace("{p}", "11.4")]) }
  if (!sc || sc === "fnb") out.push(["plain", t("a_fnb")]);
  return `<header><h2>${t("ana")}</h2><span class="sample">${t("aiSrc")}</span></header><div class="conn">${out.map(o => `<div class="panel" style="background:rgba(255,255,255,.02)"><span><span class="chip ${o[0]}">${o[0] === "good" ? "▲" : o[0] === "bad" ? "▼" : o[0] === "warn" ? "!" : "i"}</span></span><p style="color:var(--text);margin-top:6px">${o[1]}</p></div>`).join("")}</div>`
}
const SEC_KPI = {
  fmcg: [["k_van", "30%", "▲ 11.4%", "up"], ["k_ka", "41%", "▲ 6.2%", "up"], ["k_horeca", "17%", "▲ 4.0%", "up"], ["k_whole", "12%", "▼ 2.1%", "down"], ["k_ret", "1.8%", "▼ 0.3 pt", "up"], ["k_oos", "2.4%", "≈ 190k QAR", "down"], ["k_price", "96.5%", ""], ["k_promo", "+14%", ""]],
  fnb: [["k_dine", "34%", ""], ["k_deliv", "32%", "▲ 8 pt", "up"], ["k_take", "27%", ""], ["k_ticket", "38.0", "▲ 2.1%", "up"], ["k_lfl", "+5.9%", ""], ["k_margin", "61%", "▼ 1.2 pt", "down"]],
  re: [["k_occ", "93%", "▲ 2 pt", "up"], ["k_rent", "11,900", "▲ 3.5%", "up"], ["k_renew", "88%", ""]],
  retail: [["k_basket", "142", "▲ 1.8%", "up"], ["k_foot", "+4.2%", ""], ["k_lfl", "+2.0%", ""], ["k_margin", "22%", ""]],
  log: [["k_fill", "84%", "▲ 3 pt", "up"], ["k_cpd", "18.5", "▼ 4%", "up"], ["k_otif", "94.2%", "▼ 1.1 pt", "down"]],
  con: [["k_backlog", "14.2 M", ""], ["k_margin", "12%", "▼ 2 pt", "down"]],
  hb: [["k_lfl", "+9.8%", ""], ["k_ticket", "215", "▲ 4%", "up"], ["k_margin", "48%", ""]],
  fm: [["k_renewC", "91%", ""], ["k_margin", "19%", "▲ 1 pt", "up"]]
};
function salesCenter() {
  const m = S.mon, partial = !R && m === 9, pf = partial ? DAYS_IN / DAYS_OF : 1; if (S.sdrill && S.sdrill.length && !inScope(S.sdrill[0])) S.sdrill = [];
  const sc = S.sdrill && S.sdrill.length ? S.sdrill[0] : null; const g26 = sc ? MON(sc, 2026) : MONG(2026), g25 = sc ? MON(sc, 2025) : MONG(2025), g24 = sc ? MON(sc, 2024) : MONG(2024);
  const cur = g26[m], ly = g25[m] * pf, ly2 = g24[m] * pf; const ytd = g26.slice(0, 9).reduce((a, x) => a + x, 0) + g26[9], ytdL = g25.slice(0, 9).reduce((a, x) => a + x, 0) + g25[9] * DAYS_IN / DAYS_OF;
  const tg = sc ? SEC[sc].tgt * SEASON[sc][m] / SEASON[sc].reduce((a, x) => a + x, 0) : TGT[m]; const proj = partial ? cur / DAYS_IN * DAYS_OF : cur;
  const mn = L(MONTHS[m]);
  C.innerHTML = `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label class="ctl">${t("month")}<select id="monSel">${MONTHS.map((x, i) => `<option value="${i}" ${i === m ? "selected" : ""} ${i > 9 ? "disabled" : ""}>${L(x)} 2026${i === 9 ? " · " + t("mtdTag") : ""}</option>`).join("")}</select></label>
  ${ROLES[S.role].lock || S.sector !== "all" ? "" : `<div class="tabs"><button type="button" data-ss="" aria-pressed="${!sc}">${t("all")}</button>${SECTORS.map(s => `<button type="button" data-ss="${s.id}" aria-pressed="${sc === s.id}">${sName(s.id)}</button>`).join("")}</div>`}</div>
 <div class="kpis">
  ${kpi(t("salesM").replace("{m}", mn) + (partial ? " · " + t("mtdOf") : ""), fmt(cur, 2) + " " + t("m"), dlt(cur * 1e6, ly * 1e6) + " " + t("vsLy1").replace("{m}", mn), "", g26.slice(0, 10).map((v, i) => i === 9 ? v * DAYS_OF / DAYS_IN : v))}
  ${kpi(t("vsLy2").replace("{m}", mn), fmt(ly2, 2) + " " + t("m"), dlt(cur * 1e6, ly2 * 1e6) + (partial ? " · " + t("samePeriod") : ""), "", g24)}
  ${kpi(t("ytd"), fmt(ytd, 1) + " " + t("m"), dlt(ytd * 1e6, ytdL * 1e6) + " " + t("ytdLy"), "", [ytdL * 0.3, ytdL * 0.52, ytdL * 0.78, ytdL, ytd])}
  ${partial ? kpi(t("proj"), fmt(proj, 1) + " " + t("m"), t("projSub"), "", [g25[9] * 0.9, g25[9], cur, proj]) : ""}
  ${kpi(t("tgtAtt"), fmt(proj / tg * 100, 0) + "%", fmt(proj, 1) + " / " + fmt(tg, 1) + " " + t("m"), proj >= tg ? "up" : "down")}
 </div>
 <div class="grid">
  <section class="panel c12"><header><h2>${t("cmpT")}${sc ? " · " + sName(sc) : ""}</h2><span class="src">${t("src_or")}</span></header>${cmpChart()}</section>
  <section class="panel c12" id="sdBox">${salesDrillHTML()}</section>
  <section class="panel c12">${analysis()}</section>
  ${(sc ? [sc] : SECTORS.filter(s => inScope(s.id)).map(s => s.id)).map(id => `<section class="panel c6"><header><h2>${t("secKpi")} · ${sName(id)}</h2><span class="sample">${t("sample")}</span></header><div class="kpis" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">${SEC_KPI[id].map(k => `<div class="kpi" style="padding:10px 12px"><span class="l">${t(k[0])}</span><span class="v" style="font-size:20px">${k[1]}</span>${k[2] ? `<span class="d ${k[3] || ""}" style="font-size:11.5px">${k[2]}</span>` : ""}</div>`).join("")}</div></section>`).join("")}
 </div>`;
  $("#monSel").onchange = e => { S.mon = +e.target.value; salesCenter() };
  C.querySelectorAll("[data-ss]").forEach(b => b.onclick = () => { S.sdrill = b.dataset.ss ? [b.dataset.ss] : []; salesCenter() });
  C.querySelectorAll("[data-mon]").forEach(r => r.onclick = () => { S.mon = +r.dataset.mon; salesCenter() });
  bindSd();
}
function bindSd() {
  const box = $("#sdBox"); if (!box) return;
  box.querySelectorAll("[data-sk]").forEach(b => b.onclick = () => { const p = S.sdrill || []; if (p.length >= 2) return; S.sdrill = p.length === 0 ? [b.dataset.sk] : [p[0], +b.dataset.sk]; if (p.length === 0) salesCenter(); else { box.innerHTML = salesDrillHTML(); bindSd() } });
  box.querySelectorAll("[data-sc]").forEach(b => b.onclick = () => { S.sdrill = (S.sdrill || []).slice(0, +b.dataset.sc); salesCenter() })
}

function drillHTML() {
  const path = S.drill || []; const cos = MTD_TREE.filter(c => inScope(c.sector));
  if (path[0] >= cos.length) S.drill = [];
  const real = S.drill.length > 0 && cos[S.drill[0]].real; const rows = mtdNodes(S.drill); const total = rows.reduce((a, r) => a + r.value, 0), lm = rows.reduce((a, r) => a + r.lm, 0);
  const max = Math.max(...rows.map(r => r.value)); const ch = (total / lm - 1) * 100;
  const crumbs = [`<button type="button" data-cr="0">${t("allCo")}</button>`];
  if (S.drill.length > 0) { const c = cos[S.drill[0]]; crumbs.push(S.drill.length > 1 ? `<button type="button" data-cr="1">${esc(L([c.ar, c.en]))}</button>` : `<span class="cur">${esc(L([c.ar, c.en]))}</span>`) }
  if (S.drill.length > 1) { crumbs.push(`<span class="cur">${esc(real ? real[S.drill[1]].n : L(cos[S.drill[0]].brands[S.drill[1]]))}</span>`) }
  if (S.drill.length === 0) crumbs[0] = `<span class="cur">${t("allCo")}</span>`;
  const lvl = [t("companies"), t("brands"), t("products")][S.drill.length];
  const leaf = S.drill.length === 2;
  return `<header><h2>${t("mtdT")}</h2><span class="src">${t("mtdSub")} · ${t("src_or")}</span></header>
  <div class="mtd"><span class="big">${fmt(total)} ${t("qar")}</span><span class="d ${ch >= 0 ? "up" : "down"}" style="font-size:12.5px">${ch >= 0 ? "▲" : "▼"} ${fmt(Math.abs(ch), 1)}% ${t("vsLm")}</span>${S.drill.length === 0 && scope() === "all" && !R ? gauge(total / 31e6, 20 / 31) : ""}</div>
  <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px"><nav class="crumbs" aria-label="breadcrumb">${crumbs.join("<i>›</i>")}</nav><span class="src">${lvl}${leaf ? "" : " · " + t("clickHint")}</span></div>
  <div class="drill">${rows.sort((a, b) => b.value - a.value).map(r => {
    const c = r.lm ? (r.value / r.lm - 1) * 100 : 0; return `<button type="button" class="dr" ${leaf ? "disabled" : ""} data-dr="${r.i}" data-tip="${esc(r.label)}: ${fmt(r.value)} ${t("qar")} · ${t("share")} ${fmt(r.value / total * 100, 1)}%${r.units ? " · " + t("units") + " " + fmt(r.units) : ""}">
   <span class="lab">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : r.units ? `<small>${t("units")}: <span class="num">${fmt(r.units)}</span></small>` : ""}</span>
   <span class="track"><span class="fill" style="width:${Math.max(1, r.value / max * 100)}%"></span></span>
   <span class="num" style="text-align:end">${fmt(r.value)}<small style="display:block;font-size:11px" class="${c >= 0 ? "up" : "down"}">${c >= 0 ? "▲" : "▼"} ${fmt(Math.abs(c), 1)}%</small></span>
   <span class="chev" aria-hidden="true">${leaf ? "" : "›"}</span></button>`
  }).join("")}</div>`;
}
function bindDrill() {
  const box = $("#drillBox"); if (!box) return;
  box.querySelectorAll("[data-dr]").forEach(b => b.onclick = () => { if (S.drill.length < 2) { S.drill = [...S.drill, +b.dataset.dr]; box.innerHTML = drillHTML(); bindDrill() } });
  box.querySelectorAll("[data-cr]").forEach(b => b.onclick = () => { S.drill = S.drill.slice(0, +b.dataset.cr); box.innerHTML = drillHTML(); bindDrill() });
}
function dash() {
  const secs = SECTORS.filter(s => inScope(s.id));
  const rev = secs.reduce((a, s) => a + s.rev, 0);
  const open = DATA.deals.filter(d => inScope(d.sector) && d.stage < 3).reduce((a, d) => a + d.value, 0);
  const arTot = scope() === "all" || scope() === "fmcg" ? DATA.invoices.reduce((a, i) => a + i.balance, 0) : 0;
  const hc = secs.reduce((a, s) => a + s.hc, 0);
  const late = DATA.ships.filter(s => s.status === "s_late").length;
  const pendingL = DATA.leaves.filter(l => l.state === "pending").length;
  const over90 = DATA.invoices.filter(i => i.bucket === "over90");
  C.innerHTML = `
 <div class="kpis">
  ${kpi(t("mtdT"), money(MTD_TREE.filter(c => inScope(c.sector)).reduce((a, c) => a + c.total, 0)), t("mtdSub"), "", R ? ACT : [0.71, 0.78, 0.92, 0.95, 0.88, 0.81, 0.97, 1.02, 0.9, 0.86, 0.94, 1.08, 0.99, 0.93, 0.96, 1.11, 1.04, 0.95, 1.0, 1.06])}
  ${kpi(t("revYtd"), fmt(rev) + " " + t("m"), R ? "" : "▲ 7.4% " + t("vsLy"), "up", ACT)}
  ${kpi(t("pipe"), money(open), DATA.deals.filter(d => inScope(d.sector) && d.stage < 3).length + " " + t("openDeals"), "", R ? [0, 0] : [12, 13.1, 12.6, 14, 15.2, 14.8, 16.6])}
  ${arTot ? kpi(t("ar"), money(arTot), t("src_or"), "", R ? [0, 0] : [7.4, 7.1, 6.9, 7.2, 6.8, 6.63]) : ""}
  ${kpi(t("emp"), fmt(hc), "", "", R ? [0, 0] : [1712, 1730, 1744, 1761, 1770, 1786, 1800], "hr")}
  ${kpi(t("ontime"), R ? "0%" : "94.2%", R ? "" : "▼ 1.1%", "down", R ? [0, 0] : [95.8, 95.1, 95.6, 94.9, 95.3, 94.2])}
 </div>
 <div class="grid">
  <section class="panel c12" id="drillBox">${drillHTML()}</section>
  <section class="panel c7"><header><h2>${t("trend")}</h2><span class="src">${t("src_or")}</span></header>${lineChart()}</section>
  <section class="panel c5"><header><h2>${t("revBySec")}</h2><span class="src">${t("src_or")}</span></header>
   ${hbars(secs.map(s => ({ l: sName(s.id), v: s.rev, extra: s.tgt ? Math.round(s.rev / s.tgt * 100) + "% " + t("ofTarget") : "" })).sort((a, b) => b.v - a.v))}</section>
  <section class="panel c12" ${AI.length ? "" : "hidden"}><header><h2>${t("ai")}</h2><span class="sample">${t("aiSrc")}</span></header>
   <div class="conn">${AI.map(a => `<div class="panel" style="background:var(--bg)"><span><span class="chip ${a[4]}">${S.lang === "ar" ? a[0] : a[1]}</span></span><p style="color:var(--text)">${S.lang === "ar" ? a[2] : a[3]}</p></div>`).join("")}</div></section>
  <section class="panel c12"><header><h2>${t("alerts")}</h2></header>
   <div class="tw"><table><tbody>
    ${over90.slice(0, 3).map(i => { const a = FMCG_ACC.find(x => x[2] === i.customerId); return `<tr><td><span class="chip bad">${t("over90")}</span></td><td>${L(a)} · <span class="mono">${i.number}</span></td><td class="n num">${fmt(i.balance)} ${t("qar")}</td></tr>` }).join("")}
    <tr><td><span class="chip warn">${t("s_late")}</span></td><td>${DATA.ships.filter(s => s.status === "s_late").map(s => L(s.to) + " · " + s.id).join("، ")}</td><td class="n num">${late}</td></tr>
    <tr><td><span class="chip warn">${t("pending")}</span></td><td>${t("pendingL")}</td><td class="n num">${pendingL}</td></tr>
    <tr><td><span class="chip warn">${t("docsExp")}</span></td><td>${DATA.docs.filter(d => d.left <= 14).map(d => L(d.emp) + " – " + L(d.doc)).join("، ")}</td><td class="n num">${DATA.docs.filter(d => d.left <= 14).length}</td></tr>
   </tbody></table></div></section>
 </div>`; bindDrill()
}

function pipeline() {
  const lock = ROLES[S.role].lock; const sid = lock || (S.sector !== "all" ? S.sector : S.salesSector); S.salesSector = sid;
  const sec = SEC[sid]; const own = ROLES[S.role].owner;
  const deals = DATA.deals.filter(d => d.sector === sid && (own == null || d.owner === own));
  const open = deals.filter(d => d.stage < 3), won = deals.filter(d => d.stage === 3);
  C.innerHTML = `
 ${lock || S.sector !== "all" ? "" : `<div class="tabs" role="group" aria-label="${t("sector")}">${SECTORS.map(s => `<button type="button" data-s="${s.id}" aria-pressed="${s.id === sid}">${sName(s.id)}</button>`).join("")}</div>`}
 <div class="kpis">
  ${kpi(t("pipe"), money(open.reduce((a, d) => a + d.value, 0)), open.length + " " + t("openDeals"))}
  ${kpi(t("winRate"), deals.length ? Math.round(won.length / deals.length * 100) + "%" : "—", "")}
  ${kpi(t("avgDeal"), deals.length ? money(deals.reduce((a, d) => a + d.value, 0) / deals.length) : "—", "")}
 </div>
 <section class="panel"><header><h2>${sName(sid)}</h2><span class="src">${t("src_crm")}</span></header>
  <p class="note" style="margin-bottom:12px">${t("moveHint")}</p>
  <div class="pipe" id="pipe">${sec.stages.map((st, i) => {
    const ds = deals.filter(d => d.stage === i); return `<div class="col" data-stage="${i}"><header><b>${L(st)}</b><span class="num">${ds.length} · ${money(ds.reduce((a, d) => a + d.value, 0))}</span></header>
   ${ds.map(d => `<article class="deal ${i === 3 ? "won" : ""}" draggable="true" data-id="${d.id}"><span class="a">${esc(L(d.acc))}</span>
    <span class="m"><span class="num">${fmt(d.value)} ${t("qar")}</span><span>${L(REPS[d.owner])}</span></span>
    <span class="m"><span class="mono">${d.id} · ${d.close}</span>${i < 3 ? `<button class="btn sm" type="button" data-next="${d.id}">${t("next")}</button>` : `<span class="chip good">${t("soCreated")} ${d.so || ""}</span>`}</span></article>`).join("") || `<span class="empty">—</span>`}</div>`
  }).join("")}</div>
 </section>
 ${sid === "fmcg" ? `<section class="panel"><header><h2>${t("coverage")}</h2><span class="src">${t("src_profile")}</span></header><div class="tw"><table>
  <thead><tr><th>${t("chan")}</th><th class="n">${t("total")}</th><th class="n">${t("reached")}</th><th style="width:38%">${t("cov")}</th></tr></thead>
  <tbody>${CHANNELS.map(c => { const p = c[2] ? Math.round(c[3] / c[2] * 100) : 0; return `<tr><td>${L(c)}</td><td class="n num">${fmt(c[2])}</td><td class="n num">${fmt(c[3])}</td><td><div class="hbar" style="grid-template-columns:1fr auto" data-tip="${esc(L(c))}: ${p}%"><span class="track"><span class="fill ${p < 75 ? "warn" : ""}" style="display:block;width:${p}%"></span></span><span class="num">${p}%</span></div></td></tr>` }).join("")}
  <tr><td><b>${t("total")}</b></td><td class="n num"><b>${R ? 0 : "3,417"}</b></td><td class="n num"><b>${R ? 0 : "3,068"}</b></td><td class="num"><b>${R ? 0 : 90}%</b></td></tr></tbody></table></div></section>` : ""}
 <section class="panel"><header><h2>${t("newDeal")}</h2></header>
  <form class="inline" id="dealForm"><label class="f">${t("account")}<input id="fAcc" required value="${S.lang === "ar" ? "عميل جديد" : "New customer"}"></label>
   <label class="f">${t("value")}<input id="fVal" type="number" min="0" step="1000" required value="150000"></label>
   <label class="f">${t("owner")}<select id="fOwn">${REPS.map((r, i) => `<option value="${i}">${L(r)}</option>`).join("")}</select></label>
   <label class="f">${t("close")}<input id="fClose" type="date" value="${dateAdd(30)}"></label>
   <button class="btn primary" type="submit">${t("add")}</button></form></section>`;
  C.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { S.salesSector = b.dataset.s; pipeline(); save() });
  C.querySelectorAll("[data-next]").forEach(b => b.onclick = () => moveDeal(b.dataset.next, null));
  const pipe = $("#pipe"); let dragId = null;
  pipe.addEventListener("dragstart", e => { const d = e.target.closest(".deal"); if (d) { dragId = d.dataset.id; e.dataTransfer.setData("text/plain", dragId) } });
  pipe.querySelectorAll(".col").forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("over") }); col.addEventListener("dragleave", () => col.classList.remove("over"));
    col.addEventListener("drop", e => { e.preventDefault(); col.classList.remove("over"); if (dragId) moveDeal(dragId, +col.dataset.stage) })
  });
  $("#dealForm").onsubmit = e => {
    e.preventDefault(); const v = +$("#fVal").value; const name = $("#fAcc").value.trim(); if (!name || !v) return;
    api("/api/deals", "POST", { sector: sid, acc: name, value: v, owner: +$("#fOwn").value, close: $("#fClose").value || dateAdd(30) }).then(d => { DATA.deals.push(d); pipeline() }).catch(() => toast("Could not save deal"))
  };
}
async function moveDeal(id, to) {
  const d = DATA.deals.find(x => x.id === id); if (!d) return; const target = to == null ? Math.min(3, d.stage + 1) : to; if (target === d.stage) return;
  let r; try { r = await api("/api/deals/" + id, "PATCH", { stage: target }) } catch (e) { return toast("Could not save deal") }
  Object.assign(d, r.deal); if (r.log) { DATA.log.unshift(r.log); toast(t("sentSo").replace("{so}", d.so)) }
  if (S.view === "pipe") pipeline()
}

function rest() {
  const tot = BRANDS.reduce((a, b) => a + b[3], 0), tx = BRANDS.reduce((a, b) => a + b[4], 0), br = BRANDS.reduce((a, b) => a + b[2], 0);
  const W = 640, H = 200, pl = 30, pb = 24, pt = 10, max = 35, iw = W - pl - 10, ih = H - pt - pb, bw = iw / HOURS.length;
  const y = v => pt + ih - v / max * ih;
  const cols = HOURS.map((h, i) => `<rect x="${pl + i * bw + 2}" y="${y(h[1])}" width="${bw - 4}" height="${ih - (y(h[1]) - pt)}" rx="3" fill="var(--series)" data-tip="${h[0]}:00 · ${h[1]}k ${t("qar")}"/><text x="${pl + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${h[0]}</text>`).join("");
  const grid = [0, 10, 20, 30].map(v => `<line x1="${pl}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("");
  C.innerHTML = `<div class="kpis">${kpi(t("todaySales"), fmt(tot) + " " + t("qar"), R ? "" : "▲ 6.2% " + (S.lang === "ar" ? "عن نفس اليوم الأسبوع الماضي" : "vs same day last week"), "up")}${kpi(t("tx"), fmt(tx), "")}${kpi(t("ticket"), fmt(tx ? tot / tx : 0, 1) + " " + t("qar"), "")}${kpi(t("branches"), br + " / " + br, "")}</div>
 <div class="grid">
  <section class="panel c7"><header><h2>${t("byHour")}</h2><span class="src">${t("src_pos")}</span></header><div class="tw"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:420px;direction:ltr" role="img" aria-label="${esc(t("byHour"))}">${grid}${cols}</svg></div></section>
  <section class="panel c5"><header><h2>${t("byBrand")}</h2><span class="src">${t("src_pos")}</span></header>${hbars(BRANDS.map(b => ({ l: L(b), v: b[3], extra: b[2] + " " + (S.lang === "ar" ? "فرع" : "branches") })))}
   <header style="margin-top:18px"><h2>${t("chMix")}</h2></header>${hbars(CHMIX.map(c => ({ l: L(c), v: c[2] })), { fmtV: v => v + "%", max: 100 })}</section>
  <section class="panel c12"><header><h2>${t("branchPerf")}</h2><span class="src">${t("src_pos")}</span></header><div class="tw"><table>
   <thead><tr><th>${t("branch")}</th><th class="n">${t("todaySales")}</th><th style="width:40%">${t("vsTgt")}</th></tr></thead>
   <tbody>${BRANCH_P.map(b => `<tr><td>${L(b)}</td><td class="n num">${fmt(b[2])}</td><td><div class="hbar" style="grid-template-columns:1fr auto" data-tip="${esc(L(b))}: ${b[3]}%"><span class="track"><span class="fill ${b[3] < 90 ? "warn" : ""}" style="display:block;width:${Math.min(100, b[3] / 1.2)}%"></span></span><span class="num">${b[3]}%</span></div></td></tr>`).join("")}</tbody></table></div>
   <p class="note" style="margin-top:8px">${S.lang === "ar" ? "عدد الفروع لكل علامة وأرقام المبيعات تجريبية. المؤكد من ملف الشركة: أكثر من 80 فرع لباسكن روبنز ودانكن، و5 مطاعم مستر شاورما، ومطعم آسيان ووك." : "Branch split and sales are sample figures. Confirmed in the company profile: 80+ Baskin Robbins and Dunkin branches, 5 Mr. Shawarma, 1 Asian Wok."}</p></section>
 </div>`}

// Real customers: top-10 chart, customer list, and for the selected customer a monthly trend plus brand split.
function monthBars(vals) {
  const W = 640, H = 200, pl = 48, pb = 24, pt = 10, iw = W - pl - 10, ih = H - pt - pb, bw = iw / 12;
  const mx = Math.max(1, ...vals), step = Math.pow(10, Math.floor(Math.log10(mx))), top = Math.ceil(mx / step) * step;
  const y = v => pt + ih - Math.max(0, v) / top * ih, k = v => v >= 1e6 ? +(v / 1e6).toFixed(1) + "M" : Math.round(v / 1e3) + "K";
  const grid = [0, 1, 2, 3, 4].map(i => { const v = top * i / 4; return `<line x1="${pl}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${k(v)}</text>`}).join("");
  const cols = MONTHS.map((m, i) => { const v = vals[i]; return `<text x="${pl + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${L(m)}</text>` + (v == null ? "" : `<rect x="${pl + i * bw + 3}" y="${y(v)}" width="${bw - 6}" height="${Math.max(1, pt + ih - y(v))}" rx="3" fill="var(--series)" data-tip="${L(m)} · ${fmt(v)} ${t("qar")}"/>`) }).join("");
  return `<div class="tw"><svg viewBox="0 0 ${W} ${H}" width="100%" style="min-width:420px;direction:ltr" role="img">${grid}${cols}</svg></div>`
}
function accReal() {
  // same layout as the sample Customers page: list on the left; header, brand sales, aging, invoices and deals on the right
  const cs = CU.customers; if (!cs.find(x => x.id === S.acc)) S.acc = cs[0]?.id;
  const c = cs.find(x => x.id === S.acc), ar = S.lang === "ar", mn = L(MONTHS[CU.period]);
  if (!c) { C.innerHTML = `<section class="panel"><p class="empty">—</p></section>`; return }
  const ch = c.lm ? (c.mtd / c.lm - 1) * 100 : 0, bmx = Math.max(1, ...c.brands.map(b => b.v)), btot = c.brands.reduce((a, b) => a + b.v, 0);
  const vals = Array.from({ length: 12 }, (_, i) => i <= CU.period ? c.months[i] ?? 0 : null);
  const aging = ["current", "d30", "d60", "d90", "over90"];
  C.innerHTML = `<div class="split">
 <section class="panel"><header><h2>${t("custs")} · ${sName("fmcg")}</h2><span class="src">${ar ? "أعلى" : "Top"} ${cs.length} / ${fmt(CU.customerCount)}</span></header>
  <div class="list">${cs.map(x => `<button class="row" type="button" data-acc="${esc(x.id)}" aria-current="${x.id === S.acc}"><span><b style="color:var(--ink)">${esc(x.name)}</b><br><span class="mono" style="font-size:11.5px;color:var(--muted)">${esc(x.id)} · ${esc(x.cat)}</span></span><span class="num">${fmt(x.mtd)}</span></button>`).join("")}</div></section>
 <div style="display:grid;gap:16px;align-content:start;min-width:0">
  <section class="panel"><header><h2>${esc(c.name)}</h2><span class="chip plain">${t("custId")}: <span class="mono">${esc(c.id)}</span></span></header>
   <div class="kpis">${kpi(t("balance"), fmt(0) + " " + t("qar"), "")}${kpi(t("credit"), fmt(0) + " " + t("qar"), "")}${kpi(t("channel"), c.cat || "—", c.group || "")}</div></section>
  <section class="panel"><header><h2>${ar ? "المبيعات حسب العلامة هذا الشهر" : "Brand sales this month"}</h2><span class="src">${t("mtdSub")} · ${t("src_or")}</span></header>
   <div class="mtd"><span class="big">${fmt(c.mtd)} ${t("qar")}</span><span class="d ${ch >= 0 ? "up" : "down"}" style="font-size:12.5px">${ch >= 0 ? "▲" : "▼"} ${fmt(Math.abs(ch), 1)}% ${t("vsLm")}</span></div>
   <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px"><nav class="crumbs" aria-label="breadcrumb"><span class="cur">${t("allBr")}</span></nav><span class="src">${ar ? "العلامات" : "Brands"}: ${c.brands.length}</span></div>
   <div class="drill">${c.brands.map(b => { const d = b.lm ? (b.v / b.lm - 1) * 100 : 0; return `<button type="button" class="dr" disabled data-tip="${esc(b.n)}: ${fmt(b.v)} ${t("qar")} · ${t("share")} ${fmt(btot ? b.v / btot * 100 : 0, 1)}%">
    <span class="lab">${esc(b.n)}</span><span class="track"><span class="fill" style="width:${Math.max(1, Math.max(0, b.v) / bmx * 100)}%"></span></span>
    <span class="num" style="text-align:end">${fmt(b.v)}<small style="display:block;font-size:11px" class="${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${fmt(Math.abs(d), 1)}%</small></span><span class="chev" aria-hidden="true"></span></button>` }).join("")}</div></section>
  <section class="panel"><header><h2>${ar ? "المبيعات الشهرية" : "Monthly sales"} ${CU.year}</h2><span class="src">${t("qar")}</span></header>${monthBars(vals)}</section>
  <section class="panel"><header><h2>${t("aging")}</h2><span class="src">${t("src_or")}</span></header>
   ${hbars(aging.map(k => ({ l: t(k), v: 0, cls: k === "over90" || k === "d90" ? "bad" : k === "d60" ? "warn" : "" })), { fmtV: v => fmt(v) + " " + t("qar"), max: 1 })}</section>
  <section class="panel"><header><h2>${t("invoices")}</h2><span class="src">${t("src_or")}</span></header><div class="tw"><table>
   <thead><tr><th>${t("invNo")}</th><th>${t("date")}</th><th>${t("due")}</th><th class="n">${t("amount")}</th><th class="n">${t("balance")}</th><th>${t("status")}</th></tr></thead>
   <tbody><tr><td colspan="6" class="empty">—</td></tr></tbody></table></div></section>
  <section class="panel"><header><h2>${t("deals")}</h2><span class="src">${t("src_crm")}</span></header><div class="tw"><table>
   <thead><tr><th>ID</th><th>${t("stage")}</th><th>${t("owner")}</th><th class="n">${t("value")}</th></tr></thead>
   <tbody><tr><td colspan="4" class="empty">—</td></tr></tbody></table></div></section>
 </div></div>`;
  C.querySelectorAll("[data-acc]").forEach(b => b.onclick = () => { S.acc = b.dataset.acc; accReal() })
}
async function acc() {
  if (CU) return accReal();
  const own = ROLES[S.role].owner;
  const list = FMCG_ACC.filter(a => own == null || DATA.deals.some(d => d.cust === a[2] && d.owner === own));
  if (!list.find(a => a[2] === S.acc)) S.acc = list[0]?.[2];
  const a = FMCG_ACC.find(x => x[2] === S.acc);
  const inv = await ERP.listInvoices({ customerId: S.acc }); const ag = await ERP.getAging(S.acc);
  const aging = ["current", "d30", "d60", "d90", "over90"]; const tot = aging.reduce((s, k) => s + ag[k], 0);
  const deals = DATA.deals.filter(d => d.cust === S.acc);
  C.innerHTML = `<div class="split">
 <section class="panel"><header><h2>${t("custs")} · ${sName("fmcg")}</h2><span class="src">${t("src_or")}</span></header>
  <div class="list">${list.map(x => { const b = DATA.invoices.filter(i => i.customerId === x[2]).reduce((s, i) => s + i.balance, 0); return `<button class="row" type="button" data-acc="${x[2]}" aria-current="${x[2] === S.acc}"><span><b style="color:var(--ink)">${L(x)}</b><br><span class="mono" style="font-size:11.5px;color:var(--muted)">${x[2]} · ${t("brCount").replace("{n}", (BRANCHES[x[2]] || []).length)}</span></span><span class="num">${fmt(b)}</span></button>` }).join("")}</div></section>
 <div style="display:grid;gap:16px;align-content:start;min-width:0">
  <section class="panel"><header><h2>${L(a)}</h2><span class="chip plain">${t("custId")}: <span class="mono">${a[2]}</span></span></header>
   <div class="kpis">${kpi(t("balance"), fmt(tot) + " " + t("qar"), "")}${kpi(t("credit"), fmt(R ? 0 : 1500000) + " " + t("qar"), "")}${kpi(t("channel"), S.lang === "ar" ? { "Supermarkets": "سوبرماركت", "Petrol stations": "محطات وقود", "Wholesale": "جملة" }[a[3]] : a[3], "")}</div></section>
  <section class="panel" id="brBox">${branchHTML()}</section>
  <section class="panel"><header><h2>${t("aging")}</h2><span class="src">${t("src_or")}</span></header>
   ${hbars(aging.map(k => ({ l: t(k), v: ag[k], cls: k === "over90" || k === "d90" ? "bad" : k === "d60" ? "warn" : "" })), { fmtV: v => fmt(v) + " " + t("qar"), max: Math.max(1, ...aging.map(k => ag[k])) })}</section>
  <section class="panel"><header><h2>${t("invoices")}</h2><span class="src">${t("src_or")}</span></header><div class="tw"><table>
   <thead><tr><th>${t("invNo")}</th><th>${t("date")}</th><th>${t("due")}</th><th class="n">${t("amount")}</th><th class="n">${t("balance")}</th><th>${t("status")}</th></tr></thead>
   <tbody>${inv.map(i => `<tr><td class="mono">${i.number}</td><td class="mono">${i.date}</td><td class="mono">${i.dueDate}</td><td class="n num">${fmt(i.amount)}</td><td class="n num">${fmt(i.balance)}</td><td><span class="chip ${i.bucket === "current" ? "good" : i.bucket === "d30" ? "plain" : i.bucket === "d60" ? "warn" : "bad"}">${t(i.bucket)}</span></td></tr>`).join("")}</tbody></table></div></section>
  <section class="panel"><header><h2>${t("deals")}</h2><span class="src">${t("src_crm")}</span></header><div class="tw"><table>
   <thead><tr><th>ID</th><th>${t("stage")}</th><th>${t("owner")}</th><th class="n">${t("value")}</th></tr></thead>
   <tbody>${deals.map(d => `<tr><td class="mono">${d.id}</td><td>${L(SEC.fmcg.stages[d.stage])}</td><td>${L(REPS[d.owner])}</td><td class="n num">${fmt(d.value)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">—</td></tr>`}</tbody></table></div></section>
 </div></div>`;
  C.querySelectorAll("[data-acc]").forEach(b => b.onclick = () => { S.acc = b.dataset.acc; S.branch = null; acc() }); bindBranch();
}

const DEPT_N = [["المبيعات", "Sales"], ["العمليات والمستودعات", "Operations"], ["الصيانة", "Maintenance"], ["الإدارة والدعم", "Admin & support"]];
const ORG = {
  fmcg: [[["مندوب مبيعات (فان)", "Van salesman", 120], ["منسّق عرض", "Merchandiser", 60], ["مشرف مبيعات", "Sales supervisor", 18], ["مدير حسابات رئيسية", "Key account manager", 12]],
  [["سائق توصيل", "Delivery driver", 110], ["أمين مستودع", "Storekeeper", 60], ["مساعد توصيل", "Delivery helper", 40], ["مشغّل رافعة", "Forklift operator", 40]],
  [["ميكانيكي أسطول", "Fleet mechanic", 22], ["فني تبريد", "Refrigeration technician", 10], ["كهربائي", "Electrician", 8]],
  [["محاسب", "Accountant", 18], ["خدمة عملاء", "Customer service", 16], ["إدخال بيانات", "Data entry clerk", 14], ["موظف موارد بشرية", "HR officer", 6], ["مدير", "Manager", 6]]],
  fnb: [[["منسّق تموين", "Catering coordinator", 12], ["تنفيذي مبيعات شركات", "Corporate sales executive", 8]],
  [["طاقم خدمة / باريستا", "Crew / barista", 220], ["طبّاخ", "Cook", 70], ["كاشير", "Cashier", 40], ["مدير فرع", "Branch manager", 30]],
  [["فني معدات مطاعم", "Kitchen equipment technician", 15], ["فني تكييف", "AC technician", 10]],
  [["محاسب", "Accountant", 10], ["مدير منطقة", "Area manager", 8], ["موظف موارد بشرية", "HR officer", 7]]],
  re: [[["وكيل تأجير", "Leasing agent", 12]], [["مدير عقار", "Property manager", 8]],
  [["سبّاك", "Plumber", 8], ["كهربائي", "Electrician", 8], ["فني تكييف", "AC technician", 8], ["فني صيانة عامة", "Handyman", 6]], [["محاسب", "Accountant", 5], ["موظف استقبال", "Receptionist", 5]]],
  retail: [[["مشرف فرع", "Store supervisor", 15]], [["كاشير", "Cashier", 50], ["مرتّب رفوف", "Shelf stocker", 50], ["قسم الطازج", "Fresh counter staff", 20]], [["فني صيانة", "Maintenance technician", 10]], [["محاسب", "Accountant", 8], ["مدير متجر", "Store manager", 7]]],
  log: [[["تطوير أعمال", "Business development", 10]], [["سائق", "Driver", 70], ["مشغّل مستودع", "Warehouse operator", 50], ["مخلّص جمركي", "Customs clearance agent", 20]], [["ميكانيكي", "Mechanic", 14], ["فني تبريد شاحنات", "Reefer technician", 6]], [["منسّق عمليات", "Operations coordinator", 10]]],
  con: [[["مقدّر تكاليف", "Estimator", 5]], [["دهّان", "Painter", 20], ["نجّار", "Carpenter", 15], ["مهندس موقع", "Site engineer", 10], ["رئيس عمال", "Foreman", 10]], [["فني كهروميكانيك", "MEP technician", 20]], [["إداري مشاريع", "Project administrator", 10]]],
  hb: [[["مندوب طبي", "Medical rep", 12], ["مستشارة تجميل", "Beauty advisor", 8]], [["مصففة شعر", "Hair stylist", 18], ["أخصائية عناية", "Therapist", 12]], [["فني", "Technician", 2]], [["محاسب", "Accountant", 4], ["موظف استقبال", "Receptionist", 4]]],
  fm: [[["مدير حسابات", "Account manager", 6]], [["عامل نظافة", "Cleaner", 50], ["مشرف نظافة", "Cleaning supervisor", 20]],
  [["مزارع لاندسكيب", "Landscaping gardener", 60], ["فني صيانة عامة", "Maintenance technician", 50], ["سبّاك", "Plumber", 20], ["كهربائي", "Electrician", 20], ["فني تكييف", "AC technician", 20]], [["منسّق", "Coordinator", 14]]],
};
const FN = [["محمد", "Mohammed"], ["أحمد", "Ahmed"], ["علي", "Ali"], ["خالد", "Khalid"], ["يوسف", "Yousef"], ["عمر", "Omar"], ["راجيش", "Rajesh"], ["سوريش", "Suresh"], ["أنيل", "Anil"], ["جوزيف", "Joseph"], ["مارك", "Mark"], ["رامون", "Ramon"], ["بيجاي", "Bijay"], ["رام", "Ram"], ["طارق", "Tariq"], ["بلال", "Bilal"], ["فاطمة", "Fatima"], ["مريم", "Maryam"], ["سارة", "Sara"], ["ماريا", "Maria"], ["أنجلي", "Anjali"], ["حسن", "Hassan"], ["كريم", "Karim"], ["سانجاي", "Sanjay"]];
const LN = [["الكواري", "Al Kuwari"], ["المري", "Al Marri"], ["النعيمي", "Al Nuaimi"], ["حسن", "Hassan"], ["إبراهيم", "Ibrahim"], ["نائر", "Nair"], ["كومار", "Kumar"], ["ماثيو", "Mathew"], ["سانتوس", "Santos"], ["ريّس", "Reyes"], ["ثابا", "Thapa"], ["شريستا", "Shrestha"], ["خان", "Khan"], ["سيد", "Syed"], ["فرنانديز", "Fernandes"], ["عثمان", "Osman"], ["منون", "Menon"], ["الهاجري", "Al Hajri"]];
const NAT = [["قطر", "Qatar"], ["الهند", "India"], ["الفلبين", "Philippines"], ["نيبال", "Nepal"], ["مصر", "Egypt"], ["باكستان", "Pakistan"], ["سريلانكا", "Sri Lanka"], ["الأردن", "Jordan"]];
const LOCS = {
  fmcg: [["المستودع الرئيسي – الصناعية", "Main DC – Industrial Area"], ["الوكرة", "Al Wakra"], ["أبو هامور", "Abu Hamour"], ["المكتب الرئيسي", "Head office"]], fnb: [["دانكن – اللؤلؤة", "Dunkin – The Pearl"], ["باسكن روبنز – فيلاجيو", "Baskin Robbins – Villaggio"], ["مستر شاورما – السد", "Mr. Shawarma – Al Sadd"], ["المطبخ المركزي", "Central kitchen"]],
  re: [["المنزل – بن عمران", "Al Manzil – Bin Omran"], ["120 السد", "120 Al Sadd"]], retail: [["فود بالاس", "Food Palace"], ["دكّان", "Dukkan"]], log: [["مناطق", "Manateq"], ["ميناء حمد", "Hamad Port"]], con: [["مواقع المشاريع", "Project sites"]], hb: [["اللؤلؤة", "The Pearl"], ["المكتب الرئيسي", "Head office"]], fm: [["مواقع العملاء", "Client sites"], ["المكتب الرئيسي", "Head office"]]
};
const SID_N = { fmcg: 1, fnb: 2, re: 3, retail: 4, log: 5, con: 6, hb: 7, fm: 8 };
function roster(sid, d, j) {
  const job = ORG[sid][d][j]; let h = SID_N[sid] * 1000 + d * 100 + j * 13; const r = () => { h = (h * 9301 + 49297) % 233280; return h / 233280 }; const out = [];
  for (let n = 0; n < job[2]; n++) {
    const f = FN[Math.floor(r() * FN.length)], l = LN[Math.floor(r() * LN.length)], na = NAT[Math.floor(r() * NAT.length)], lc = LOCS[sid][Math.floor(r() * LOCS[sid].length)];
    out.push({ id: "T-" + (SID_N[sid] * 10000 + d * 2000 + j * 250 + n + 1), name: [f[0] + " " + l[0], f[1] + " " + l[1]], ini: f[1][0] + l[1].replace("Al ", "")[0], nat: na, loc: lc, joined: (2008 + Math.floor(r() * 18)) + "-" + String(1 + Math.floor(r() * 12)).padStart(2, "0") })
  }
  return out
}
const deptHc = (sid, d) => ORG[sid][d].reduce((a, j) => a + j[2], 0);
const SALES_TEAM = [["سلطان الهاجري", "Sultan Al Hajri", 3, "الميرة ولولو", "Al Meera & Lulu", 1800000, 104, 46], ["جيمس فرنانديز", "James Fernandes", 3, "كارفور ومونوبري", "Carrefour & Monoprix", 1500000, 91, 52],
["عبدالله الكبيسي", "Abdulla Al Kubaisi", 2, "الدوحة", "Doha", 950000, 97, 88], ["فينود منون", "Vinod Menon", 2, "الشمال", "North", 820000, 88, 74],
["سوريش بابو", "Suresh Babu", 0, "الوكرة", "Al Wakra", 210000, 112, 412], ["أحمد سمير", "Ahmed Samir", 0, "الخور", "Al Khor", 185000, 76, 365], ["رامي حداد", "Rami Haddad", 0, "الصناعية", "Industrial Area", 240000, 99, 398],
["طارق عثمان", "Tariq Osman", 0, "الريان", "Al Rayyan", 205000, 93, 420], ["بلال أختر", "Bilal Akhtar", 0, "السد", "Al Sadd", 195000, 85, 377], ["يوسف النعيمي", "Yousef Al Nuaimi", 0, "أم صلال", "Umm Salal", 170000, 108, 341],
["كيران راج", "Kiran Raj", 1, "لولو الدفنة", "Lulu Dafna", null, null, 96], ["مارك ريّس", "Mark Reyes", 1, "كارفور فيلاجيو", "Carrefour Villaggio", null, null, 92]];
function hrDirHTML() {
  const p = S.hrPath || []; const lockS = scope() !== "all" ? scope() : null; if (lockS && p[0] !== lockS) { S.hrPath = [lockS]; return hrDirHTML() }
  const cr = []; const crumb = (lab, n, last) => last ? `<span class="cur">${esc(lab)}</span>` : `<button type="button" data-hp="${n}">${esc(lab)}</button>`;
  cr.push(crumb(t("all"), 0, p.length === 0));
  if (p[0]) cr.push(crumb(sName(p[0]), 1, p.length === 1));
  if (p.length > 1) cr.push(crumb(L(DEPT_N[p[1]]), 2, p.length === 2));
  if (p.length > 2) cr.push(crumb(L(ORG[p[0]][p[1]][p[2]]), 3, true));
  let rows, lvl, body;
  if (p.length === 0) { lvl = t("sector"); rows = SECTORS.map(s => ({ k: s.id, l: sName(s.id), sub: DEPT_N.map((d, i) => L(d) + " " + deptHc(s.id, i)).join(" · "), v: s.hc })) }
  else if (p.length === 1) { lvl = t("depts"); rows = DEPT_N.map((d, i) => ({ k: i, l: L(d), sub: ORG[p[0]][i].map(j => L(j)).join("، "), v: deptHc(p[0], i) })) }
  else if (p.length === 2) { lvl = t("jobs"); rows = ORG[p[0]][p[1]].map((j, i) => ({ k: i, l: L(j), v: j[2] })) }
  if (rows) {
    const mx = Math.max(...rows.map(r => r.v)), tot = rows.reduce((a, r) => a + r.v, 0);
    body = `<div class="drill">${rows.sort((a, b) => b.v - a.v).map(r => `<button type="button" class="dr" data-hk="${r.k}" data-tip="${esc(r.l)}: ${fmt(r.v)} · ${fmt(r.v / tot * 100, 1)}%"><span class="lab">${esc(r.l)}${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</span><span class="track"><span class="fill" style="width:${Math.max(1, r.v / mx * 100)}%"></span></span><span class="num" style="text-align:end">${fmt(r.v)}</span><span class="chev" aria-hidden="true">›</span></button>`).join("")}</div>`
  }
  else {
    const list = roster(p[0], p[1], p[2]); lvl = t("staff");
    body = `<input class="search" id="empQ" type="search" placeholder="${t("searchPh")}" aria-label="${t("searchPh")}" style="margin-bottom:10px"><div class="tw scroll"><table><thead><tr><th>${t("empName")}</th><th>${t("empId")}</th><th>${t("job")}</th><th>${t("dept")}</th><th>${t("loc")}</th><th>${t("nat")}</th><th>${t("joined")}</th></tr></thead><tbody id="empRows">${list.map(e => `<tr data-q="${esc((e.name.join(" ") + " " + e.id + " " + L(ORG[p[0]][p[1]][p[2]])).toLowerCase())}"><td><span class="who"><span class="avatar">${e.ini}</span>${esc(L(e.name))}</span></td><td class="mono">${e.id}</td><td>${L(ORG[p[0]][p[1]][p[2]])}</td><td>${L(DEPT_N[p[1]])}</td><td>${L(e.loc)}</td><td>${L(e.nat)}</td><td class="mono">${e.joined}</td></tr>`).join("")}</tbody></table></div>`
  }
  const total = p.length === 0 ? SECTORS.reduce((a, s) => a + s.hc, 0) : p.length === 1 ? SEC[p[0]].hc : p.length === 2 ? deptHc(p[0], p[1]) : ORG[p[0]][p[1]][p[2]][2];
  return `<header><h2>${t("dir")}</h2><span class="src">${t("src_hr")}</span></header>
  <div class="mtd"><span class="big">${fmt(total)}</span><span class="src">${t("emp")}</span></div>
  <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px"><nav class="crumbs" aria-label="breadcrumb">${cr.join("<i>›</i>")}</nav><span class="src">${lvl}${rows ? " · " + t("clickHint") : ""}</span></div>${body}`
}
function bindHr() {
  const box = $("#hrDir");
  box.querySelectorAll("[data-hk]").forEach(b => b.onclick = () => { const k = b.dataset.hk; S.hrPath = [...(S.hrPath || []), S.hrPath && S.hrPath.length ? +k : k]; hr(); $("#hrDir").scrollIntoView({ block: "nearest" }) });
  box.querySelectorAll("[data-hp]").forEach(b => b.onclick = () => { S.hrPath = (S.hrPath || []).slice(0, +b.dataset.hp); hr() });
  const q = $("#empQ"); if (q) q.oninput = () => { const v = q.value.trim().toLowerCase(); box.querySelectorAll("#empRows tr").forEach(r => r.hidden = v && !r.dataset.q.includes(v)) }
}
function hr() {
  const secs = SECTORS.filter(s => inScope(s.id));
  const leaves = DATA.leaves.filter(l => inScope(l.sector)), docs = DATA.docs.filter(d => inScope(d.sector));
  const sales = secs.reduce((a, s) => a + deptHc(s.id, 0), 0), maint = secs.reduce((a, s) => a + deptHc(s.id, 2), 0);
  const showTeam = inScope("fmcg") && (S.hrPath || [])[0] === "fmcg";
  C.innerHTML = `<div class="kpis">${kpi(t("emp"), fmt(secs.reduce((a, s) => a + s.hc, 0)), t("newHires") + ": " + (R ? "0" : scope() === "all" ? "23" : "4"), "", R ? [0, 0] : [1712, 1730, 1744, 1761, 1770, 1786, 1800])}${kpi(t("salesStaff"), fmt(sales), "")}${kpi(t("maintStaff"), fmt(maint), "▲ 64 " + (S.lang === "ar" ? "هذه السنة" : "this year"), "up")}${kpi(t("pendingL"), leaves.filter(l => l.state === "pending").length, "")}${kpi(t("docsExp"), docs.length, "")}</div>
 <div class="grid">
  <section class="panel c12" id="hrDir">${hrDirHTML()}</section>
  ${showTeam ? `<section class="panel c12"><header><h2>${t("salesTeam")}</h2><span class="src">${t("src_crm")}</span></header><div class="tw"><table>
   <thead><tr><th>${t("empName")}</th><th>${t("job")}</th><th>${t("area")}</th><th class="n">${t("mTarget")}</th><th style="width:24%">${t("achieved")}</th><th class="n">${t("visits")}</th></tr></thead>
   <tbody>${SALES_TEAM.map(m => `<tr><td><span class="who"><span class="avatar">${m[1].split(" ").map(x => x[0]).join("").slice(0, 2)}</span>${S.lang === "ar" ? m[0] : m[1]}</span></td><td>${L(ORG.fmcg[0][m[2]])}</td><td>${S.lang === "ar" ? m[3] : m[4]}</td><td class="n num">${m[5] ? fmt(m[5]) : "—"}</td><td>${m[6] ? `<div class="hbar" style="grid-template-columns:1fr auto"><span class="track"><span class="fill ${m[6] < 90 ? "warn" : ""}" style="display:block;width:${Math.min(100, m[6] / 1.2)}%"></span></span><span class="num">${m[6]}%</span></div>` : "—"}</td><td class="n num">${m[7]}</td></tr>`).join("")}</tbody></table></div></section>` : ""}
  <section class="panel c5"><header><h2>${t("maintBySec")}</h2><span class="src">${t("src_hr")}</span></header>${hbars(secs.map(s => ({ l: sName(s.id), v: deptHc(s.id, 2), extra: ORG[s.id][2].map(j => L(j) + " " + j[2]).join("، ") })).sort((a, b) => b.v - a.v))}</section>
  <section class="panel c7"><header><h2>${t("leave")}</h2><span class="src">${t("src_hr")}</span></header><div class="tw"><table>
   <thead><tr><th>${t("empName")}</th><th>${t("sector")}</th><th>${t("type")}</th><th>${t("from")}</th><th class="n">${t("days")}</th><th>${t("status")}</th></tr></thead>
   <tbody>${leaves.map(l => `<tr><td>${L(l.emp)}</td><td>${sName(l.sector)}</td><td>${L(l.type)}</td><td class="mono">${l.from}</td><td class="n num">${l.days}</td><td>${l.state === "pending" ? `<span style="display:inline-flex;gap:6px"><button class="btn sm primary" type="button" data-ap="${l.id}">${t("approve")}</button><button class="btn sm" type="button" data-rj="${l.id}">${t("reject")}</button></span>` : `<span class="chip ${l.state === "approved" ? "good" : "bad"}">${t(l.state)}</span>`}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">—</td></tr>`}</tbody></table></div></section>
  <section class="panel c12"><header><h2>${t("docs")}</h2><span class="src">${t("src_hr")}</span></header><div class="tw"><table>
   <thead><tr><th>${t("empName")}</th><th>${t("sector")}</th><th>${t("doc")}</th><th>${t("expires")}</th><th class="n">${t("left")}</th></tr></thead>
   <tbody>${docs.map(d => `<tr><td>${L(d.emp)}</td><td>${sName(d.sector)}</td><td>${L(d.doc)}</td><td class="mono">${dateAdd(d.left)}</td><td class="n"><span class="chip ${d.left <= 14 ? "bad" : d.left <= 30 ? "warn" : "plain"}"><span class="num">${d.left}</span> ${t("dayU")}</span></td></tr>`).join("") || `<tr><td colspan="5" class="empty">—</td></tr>`}</tbody></table></div></section>
 </div>`;
  bindHr();
  C.querySelectorAll("[data-ap],[data-rj]").forEach(b => b.onclick = () => { const l = DATA.leaves.find(x => x.id === (b.dataset.ap || b.dataset.rj)); l.state = b.dataset.ap ? "approved" : "rejected"; hr() });
}

function logi() {
  const fleet = R ? [["dry", 0, 0, 0, 0], ["chilled", 0, 0, 0, 0], ["frozen", 0, 0, 0, 0]] : [["dry", 120, 84, 28, 8], ["chilled", 62, 47, 11, 4], ["frozen", 30, 22, 6, 2]];
  C.innerHTML = `<div class="kpis">${kpi(t("fleet"), R ? "0" : "212", R ? "" : t("dry") + " 120 · " + t("chilled") + " 62 · " + t("frozen") + " 30")}${kpi(t("onRoute"), R ? "0" : "153", "")}${kpi(t("ontime"), R ? "0%" : "94.2%", R ? "" : "▼ 1.1%", "down")}${kpi(t("outlets"), R ? "0 / 0" : "3,068 / 3,417", R ? "" : "90%")}</div>
 <div class="grid">
  <section class="panel c12"><header><h2>${t("shipments")}</h2><span class="src">${t("src_wms")}</span></header><div class="tw"><table>
   <thead><tr><th>ID</th><th>${t("to")}</th><th>${t("temp")}</th><th>${t("vehicle")}</th><th>${t("eta")}</th><th>${t("status")}</th></tr></thead>
   <tbody>${DATA.ships.map(s => `<tr><td class="mono">${s.id}</td><td>${L(s.to)}</td><td>${t(s.temp)}</td><td class="mono">${s.veh}</td><td class="mono">${s.eta}</td><td><span class="chip ${s.status === "s_done" ? "good" : s.status === "s_late" ? "bad" : s.status === "s_load" ? "plain" : ""}">${t(s.status)}</span></td></tr>`).join("")}</tbody></table></div></section>
  <section class="panel c6"><header><h2>${t("wh")}</h2><span class="src">${t("src_wms")}</span></header>${hbars(WAREHOUSES.map(w => ({ l: L(w), v: w[3], cls: w[3] >= 90 ? "bad" : w[3] >= 80 ? "warn" : "", extra: fmt(w[2]) + " m²" })), { fmtV: v => v + "%", max: 100 })}</section>
  <section class="panel c6"><header><h2>${t("fleet")}</h2><span class="src">${t("src_wms")}</span></header><div class="tw"><table>
   <thead><tr><th>${t("type")}</th><th class="n">${t("fleet")}</th><th class="n">${t("onRoute")}</th><th class="n">${t("idle")}</th><th class="n">${t("maint")}</th></tr></thead>
   <tbody>${fleet.map(f => `<tr><td>${t(f[0])}</td><td class="n num">${f[1]}</td><td class="n num">${f[2]}</td><td class="n num">${f[3]}</td><td class="n num">${f[4]}</td></tr>`).join("")}</tbody></table></div>
   <header style="margin-top:18px"><h2>${t("customs")}</h2></header><div class="tw"><table>
   <thead><tr><th>${t("bl")}</th><th>${t("cust_cl")}</th><th>${t("status")}</th></tr></thead>
   <tbody>${CUSTOMS.map(c => `<tr><td class="mono">${c[0]}</td><td>${S.lang === "ar" ? c[1] : c[2]}</td><td><span class="chip ${c[3] === "c_rel" ? "good" : c[3] === "c_insp" ? "warn" : "plain"}">${t(c[3])}</span></td></tr>`).join("")}</tbody></table></div></section>
 </div>`}

function fin() {
  const secs = SECTORS.filter(s => inScope(s.id)); const rev = secs.reduce((a, s) => a + s.rev, 0);
  const arTot = DATA.invoices.reduce((a, i) => a + i.balance, 0);
  C.innerHTML = `<div class="kpis">${kpi(t("revYtd"), fmt(rev) + " " + t("m"), R ? "" : "▲ 7.4% " + t("vsLy"), "up")}${kpi(t("gm"), R ? "0%" : "23.6%", "")}${kpi(t("ar"), money(arTot), "")}${kpi(t("dso"), R ? "0" : "52", R ? "" : "▲ 3", "down")}</div>
 <div class="grid">
  <section class="panel c7"><header><h2>${t("revTarget")}</h2><span class="src">${t("src_or")}</span></header><div class="tw"><table>
   <thead><tr><th>${t("sector")}</th><th class="n">${t("actual")}</th><th class="n">${t("target")}</th><th style="width:40%">${t("ofTarget")}</th></tr></thead>
   <tbody>${secs.map(s => { const p = s.tgt ? Math.round(s.rev / s.tgt * 100) : 0; return `<tr><td>${sName(s.id)}</td><td class="n num">${s.rev}</td><td class="n num">${s.tgt}</td><td><div class="hbar" style="grid-template-columns:1fr auto" data-tip="${esc(sName(s.id))}: ${p}%"><span class="track"><span class="fill ${p < 70 ? "warn" : ""}" style="display:block;width:${Math.min(100, p)}%"></span></span><span class="num">${p}%</span></div></td></tr>` }).join("")}</tbody></table></div>
   <p class="note" style="margin-top:8px">${S.lang === "ar" ? "الأرقام بالمليون ريال قطري. المستهدف سنوي، والفعلي حتى نهاية سبتمبر (75% من السنة)." : "Figures in QAR M. Target is full-year; actual runs to end of September (75% of the year)."}</p></section>
  <section class="panel c5"><header><h2>${t("aging")}</h2><span class="src">${t("src_or")}</span></header>
   ${(() => { const b = { current: 0, d30: 0, d60: 0, d90: 0, over90: 0 }; DATA.invoices.forEach(i => b[i.bucket] += i.balance); return hbars(Object.keys(b).map(k => ({ l: t(k), v: b[k], cls: k === "over90" || k === "d90" ? "bad" : k === "d60" ? "warn" : "" })), { fmtV: v => fmt(v) + " " + t("qar") }) })()}
   <div style="display:flex;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap"><button class="btn" type="button" id="syncBtn">${t("syncNow")}</button><span class="src" id="syncInfo">${t("lastSync")}: ${(DATA.log[0]?.t ?? "")}</span></div></section>
  <section class="panel c12"><header><h2>${t("invoices")}</h2><span class="src">${t("src_or")}</span></header><div class="tw"><table>
   <thead><tr><th>${t("invNo")}</th><th>${t("account")}</th><th>${t("due")}</th><th class="n">${t("amount")}</th><th class="n">${t("balance")}</th><th>${t("status")}</th></tr></thead>
   <tbody>${DATA.invoices.filter(i => i.bucket !== "current").sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 12).map(i => { const a = FMCG_ACC.find(x => x[2] === i.customerId); return `<tr><td class="mono">${i.number}</td><td>${L(a)}</td><td class="mono">${i.dueDate}</td><td class="n num">${fmt(i.amount)}</td><td class="n num">${fmt(i.balance)}</td><td><span class="chip ${i.bucket === "d30" ? "plain" : i.bucket === "d60" ? "warn" : "bad"}">${t(i.bucket)}</span></td></tr>` }).join("")}</tbody></table></div></section>
 </div>`;
  $("#syncBtn").onclick = async e => { e.target.disabled = true; await wait(700); const tm = new Date().toTimeString().slice(0, 5); DATA.log.unshift({ t: tm, job: "AR invoices → CRM", ok: true, n: DATA.invoices.length }); $("#syncInfo").textContent = t("lastSync") + ": " + tm; e.target.disabled = false; toast(t("ok") + " · " + DATA.invoices.length + " " + t("records")) };
}

const VIEW_FN = { sales: salesCenter, act: actual, dash, pipe: pipeline, rest, acc, hr, log: logi, fin };
if (R) { // real mode: sample constants the other views read show 0
  BRANDS.forEach(b => { b[2] = b[3] = b[4] = 0 }); HOURS.forEach(h => { h[1] = 0 }); CHMIX.forEach(c => { c[2] = 0 });
  BRANCH_P.forEach(b => { b[2] = b[3] = 0 }); CHANNELS.forEach(c => { c[2] = c[3] = 0 }); WAREHOUSES.forEach(w => { w[2] = w[3] = 0 });
  SALES_TEAM.forEach(m => { m[5] = m[6] = m[7] = 0 }); CUSTOMS.length = 0;
  Object.values(ORG).forEach(depts => depts.forEach(jobs => jobs.forEach(j => { j[2] = 0 })))
}
renderShell();
