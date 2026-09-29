const I18N = {ar:{}, en:{}};
function defs(obj){ for(const k in obj){ const v = obj[k]; if(typeof v==='function'){ I18N.ar[k] = v; I18N.en[k] = v; } else { I18N.ar[k] = v[0]; I18N.en[k] = v[1]; } } }
function t(key){
  const d = I18N[App.ui.lang] || I18N.ar;
  let v = d[key]; if(v===undefined) v = I18N.ar[key];
  if(v===undefined) return key;
  if(typeof v==='function'){ const a = Array.prototype.slice.call(arguments, 1); return v.apply(null, a); }
  return v;
}
function fmtNum(n){ return String(n); }
function wdName(i, style){ return t(style==='short' ? 'wdShort' : (style==='min' ? 'wdMin' : 'wdFull'))[i]; }
function monthName(m){ return t('months')[m]; }
function fmtDate(iso, style){
  if(!iso) return '—';
  const o = ordOf(iso), {y,m,d} = ymdOf(o);
  if(style==='short') return wdName(wdOf(o),'short')+' '+d;
  if(style==='dm') return d+' '+monthName(m);
  if(style==='wdm') return wdName(wdOf(o),'short')+' '+d+' '+monthName(m);
  return d+' '+monthName(m)+' '+y;
}
function kindLabel(k){ return t(k==='basic' ? 'kBasic' : (k==='contracted' ? 'kContracted' : 'kExcluded')); }

defs({
  appName:['الخطة','al-Khitta'],
  tabPlan:['الخطة','Plan'], tabFacilities:['الجهات','Facilities'], tabTeam:['الفريق','Team'], tabRules:['القواعد','Rules'], tabData:['البيانات','Data'],
  wdFull:[['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'],['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']],
  wdShort:[['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'],['Sun','Mon','Tue','Wed','Thu','Fri','Sat']],
  wdMin:[['ح','ن','ث','ر','خ','ج','س'],['S','M','T','W','T','F','S']],
  months:[['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],['January','February','March','April','May','June','July','August','September','October','November','December']],
  kBasic:['أساسية','Basic'], kContracted:['متعاقدة','Contracted'], kExcluded:['مستبعدة','Excluded'],
  cancel:['إلغاء','Cancel'], confirm:['تأكيد','Confirm'], save:['حفظ','Save'], del:['حذف','Delete'], add:['إضافة','Add'], close:['إغلاق','Close'],
  apply:['تطبيق','Apply'], clear:['مسح','Clear'], done:['تم','Done'], all:['الكل','All'], none:['لا شيء','None'], on:['تشغيل','On'], off:['إيقاف','Off'],
  undo:['تراجع','Undo'], back:['رجوع','Back'], search:['بحث','Search'], reset:['استعادة الافتراضي','Reset'], any:['أي','Any'], edit:['تعديل','Edit'],
  themeToggle:['المظهر','Theme'], langToggle:['English','العربية'],
  storageFull:['امتلأت مساحة التخزين — لم يُحفظ آخر تغيير','Storage full — last change not saved'],
  migrated:['نُقلت بياناتك إلى الإصدار الجديد','Your data was moved to the new version'],

  sPeriod:['الفترة','Period'], sWorkdays:['أيام العمل','Workdays'], sVisits:['الزيارات','Visits'], sTeam:['الفريق','Team'],
  pWeek:['أسبوع','Week'], pMonth:['شهر','Month'], pNextMonth:['الشهر القادم','Next month'], pQuarter:['ربع سنة','Quarter'], pCustom:['مخصص','Custom'],
  goalRange:['فترة زمنية','Date range'], goalCoverage:['تغطية جهات','Cover facilities'],
  from:['من','From'], to:['إلى','To'], startDate:['تاريخ البدء','Start date'],
  scope:['الجهات المستهدفة','Target facilities'], scopeAll:['الكل','All'], scopeType:['النوع','Type'], scopeCategory:['التصنيف','Category'], scopeLocation:['الموقع','Location'],
  times:['مرات لكل جهة','Times each'],
  workdaysN:n=>[`${n} يوم عمل`,`${n} workdays`][0], 
  covUntil:(d,n)=>`حتى ${d} · ${n} يوم عمل`,
  covUnreachable:['لا يمكن الوصول للتغطية بهذه الإعدادات','Coverage not reachable with these settings'],
  vFill:['ملء الأيام','Fill days'], vExact:['عدد محدد','Exact'], vQuota:['حسب التصنيف','By category'],
  vShare:['نسبة الأساسية','Basic share'], vPerDay:['جهات في اليوم','Per day'], vPerWeek:['حد أسبوعي','Weekly cap'], noLimit:['بلا حد','No limit'],
  vSummary:(b,c)=>`${b} أساسية · ${c} متعاقدة`,
  vOver:(n,c)=>`المطلوب ${n} يتجاوز السعة ${c}`,
  capLine:c=>`السعة ${c}`,
  teamActive:n=>`${n} نشط`,
  holidays:['إجازات','Holidays'], extraDays:['أيام عمل إضافية','Extra workdays'],
  generate:['توليد الخطة','Generate plan'], regenerate:['إعادة التوليد','Regenerate'], generating:['جارٍ التوليد…','Generating…'],
  genHint:['كل شيء جاهز. الإعدادات الافتراضية تعمل مباشرة.','Ready. Defaults work as-is.'],
  staleMsg:['تغيّرت البيانات بعد التوليد','Data changed since generation'],
  vList:['قائمة','List'], vCalendar:['تقويم','Calendar'], vMatrix:['مصفوفة','Matrix'], vSummaryView:['ملخص','Summary'],
  approve:['اعتماد','Approve'], approved:['معتمدة','Approved'], unapprove:['إلغاء الاعتماد','Unapprove'],
  exportBtn:['تصدير','Export'], print:['طباعة','Print'],
  statusReady:n=>`${n} زيارة · جاهزة`, statusIssues:(n,k)=>`${n} زيارة · ${k} للمراجعة`, statusBlocked:(n,k)=>`${n} زيارة · ${k} مشكلة`,
  statusApproved:n=>`${n} زيارة · معتمدة`,
  cycle:n=>`الدورة ${n}`,
  emptyPlan:['لم تُجدول أي زيارة. راجع الأيام والفريق.','No visits scheduled. Check days and team.'],
  focusing:n=>`تمييز: ${n}`,
  colDate:['التاريخ','Date'], colFacility:['الجهة','Facility'], colCategory:['التصنيف','Category'], colTeam:['الفريق','Team'],
  openSeat:['مقعد شاغر','Open seat'], moved:['نُقلت','Moved'],
  matrixTotal:['المجموع','Total'], legendBasic:['أساسية','Basic'], legendContracted:['متعاقدة','Contracted'], legendOff:['غير متاح','Unavailable'],
  kpiVisits:['الزيارات','Visits'], kpiDays:['أيام الزيارة','Visit days'], kpiWorkdays:['أيام العمل','Workdays'], kpiKm:['كم إجمالي','Total km'],
  loadTitle:['توزيع العمل','Workload'], loadExpected:['المتوقع','Expected'], checksTitle:['الفحوص','Checks'], notesTitle:['ملاحظات','Notes'],
  carryTitle:['تنتظر الدورة القادمة','Waiting for next cycle'],
  cOpen:['كل المقاعد مشغولة','All seats filled'], cDup:['لا تكرار لشخص في اليوم','No one twice a day'], cAvail:['الجميع متاح في يومه','Everyone available on their day'],
  cBlocked:['لا جهات محظورة','No blocked facilities'], cGender:['قواعد النوع','Gender rules'], cSenior:['الخبرة في الجهات المهمة','Seniority on key facilities'],
  cPairs:['قواعد الثنائيات الصارمة','Rigid pair rules'], cRun:['حد الأيام المتتالية','Consecutive-day limits'],
  dOpenSeats:(f,d,n)=>`${f} · ${fmtDate(d,'short')}: ${n} مقعد شاغر`,
  dGender:(f,d,m,fe)=>`${f} · ${fmtDate(d,'short')}: النوع ${m} ذ / ${fe} أ`,
  dSenior:(f,d)=>`${f} · ${fmtDate(d,'short')}: لا يوجد صاحب خبرة كافية`,
  dPair:(f,d)=>`${f} · ${fmtDate(d,'short')}: قاعدة ثنائية لم تُحترم`,
  dUnavailable:(p,d)=>`${p} غير متاح ${fmtDate(d,'short')}`,
  dBlocked:(p,f)=>`${p} محظور من ${f}`,
  dRun:(p,d)=>`${p} تجاوز حد الأيام المتتالية ${fmtDate(d,'short')}`,
  dGenderUnknown:n=>`${n} بلا نوع محدد — لا تُطبَّق عليهم قواعد النوع`,
  dShort:(a,b)=>`جُدول ${a} من ${b} مطلوبة`,
  dQuotaShort:(c,q,n)=>`«${c}»: طُلب ${q} والمتاح ${n}`,
  dShortBasic:(q,n)=>`الأساسية: طُلب ${q} والمتاح ${n}`, dShortContracted:(q,n)=>`المتعاقدة: طُلب ${q} والمتاح ${n}`,
  dNoRoom:f=>`لا يوجد يوم مناسب لـ ${f}`, dPinnedOut:f=>`جهة مثبّتة خارج الخطة: ${f}`,
  dDayMin:(wd,n)=>`${wdName(wd)}: ${n} يوم دون الحد الأدنى`, dMissingFacility:['جهة محذوفة في الخطة','Deleted facility in plan'],
  errRange:['تاريخ النهاية قبل البداية','End date is before start'], errNoWorkdays:['لا توجد أيام عمل في الفترة','No workdays in range'],
  vdWhy:['سبب الاختيار','Why this facility'], vdOverdue:n=>n>=1000?'لم تُزر من قبل':`آخر زيارة منذ ${n} يوم`, vdRank:(r,k)=>`الترتيب ${r} في ${k}`,
  vdTeam:['الفريق','Team'], vdSwap:['تبديل','Swap'], vdFill:['شغل المقعد','Fill seat'], vdMove:['نقل لتاريخ آخر','Move to another date'],
  vdReplace:['استبدال الجهة','Replace facility'], vdRemove:['حذف الزيارة','Remove visit'], vdHistory:['آخر الزيارات','Recent visits'], vdNoHistory:['لا يوجد سجل','No history'],
  vdLocked:['الخطة معتمدة — ألغِ الاعتماد للتعديل','Plan approved — unapprove to edit'],
  rBusy:['لديه زيارة في اليوم','Busy that day'], rOff:['غير متاح','Unavailable'], rBlocked:['محظور','Blocked'],
  loadN:n=>`${n} زيارة`, conflicts:n=>`${n} تعارض`, dayFull:['ممتلئ','Full'], wdNotAllowed:['يوم غير مسموح','Day not allowed'],
  expTitle:['تصدير الخطة','Export plan'], expMode:['المحتوى','Content'], expFull:['كامل','Full'], expNoTeam:['بدون الفريق','Without team'], expNoFac:['بدون أسماء الجهات','Without facility names'],
  expXlsx:['ملف Excel','Excel file'], expCsv:['ملف CSV','CSV file'], expCopy:['نسخ للحافظة','Copy'], copied:['تم النسخ','Copied'],
  expMatrix:['مصفوفة الفريق (Excel)','Team matrix (Excel)'],
  hFacility:['جهة المرور','Facility'], hCategory:['المنطقة','Category'], hCycle:['الخطة','Cycle'], hType:['المرور','Type'], hDate:['التاريخ','Date'], hTeam:['القائم بالمرور','Team'],

  fTitle:['الجهات','Facilities'], fSearch:['بحث بالاسم','Search name'], fAllKinds:['كل الأنواع','All types'], fAllCats:['كل التصنيفات','All categories'], fAllLocs:['كل المواقع','All locations'],
  fSortOverdue:['الأكثر تأخرًا','Most overdue'], fSortName:['الاسم','Name'], fSortImp:['الأهمية','Importance'], fSortKm:['المسافة','Distance'],
  fAdd:['جهة جديدة','New facility'], fCount:n=>`${n} جهة`, fSelected:n=>`${n} محددة`,
  fExclude:['استبعاد','Exclude'], fInclude:['إدراج','Include'], fPin:['تثبيت','Pin'], fUnpin:['إلغاء التثبيت','Unpin'], fSetImp:['الأهمية','Importance'], fSetFreq:['الوتيرة','Frequency'],
  fName:['الاسم','Name'], fCategory:['التصنيف','Category'], fLocation:['الموقع','Location'], fKind:['النوع','Type'], fAutoKind:['حسب التصنيف','By category'],
  fImportance:['الأهمية','Importance'], fImportanceHint:['من 0 إلى 100. عند تجاوز حد الخبرة يضم الفريق شخصًا بخبرة لا تقل عنها.','0–100. Above the seniority threshold, the team includes someone at least this skilled.'],
  fFreq:['وتيرة الزيارة','Visit frequency'], fFreqHint:['نسبة من الوتيرة العادية. 0٪ لا تُزار.','Relative to normal. 0% is never visited.'],
  fPinned:['مثبّتة في الدورة القادمة','Pinned for next cycle'], fExcluded:['مستبعدة','Excluded'], fDays:['أيام الزيارة المسموحة','Allowed visit days'], fAnyDay:['أي يوم','Any day'],
  fLast:['آخر زيارة','Last visit'], fVisits:['عدد الزيارات','Visits'], fNever:['لم تُزر','Never'], fDaysAgo:n=>`منذ ${n} يوم`,
  fDelete:['حذف الجهة','Delete facility'], fDeleteQ:['ستُحذف الجهة نهائيًا.','This facility will be permanently deleted.'],
  fNewName:['اسم الجهة','Facility name'], fReview:['تحتاج مراجعة','Needs review'],
  catTitle:['التصنيفات','Categories'], catHint:['نوع كل تصنيف يحدد مسار زيارته.','Each category decides the visit track.'],
  locTitle:['المواقع والمسافات','Locations & distance'], locHint:['المسافة من المقر بالكيلومتر.','Distance from HQ in km.'], locAdd:['موقع جديد','New location'],
  bandNear:['قريب','Near'], bandMid:['متوسط','Mid'], bandFar:['بعيد','Far'],

  tTitle:['الفريق','Team'], tAdd:['شخص جديد','New person'], tRetired:['المتقاعدون','Retired'], tShowRetired:n=>`المتقاعدون (${n})`,
  tPools:['المجموعات والمقاعد','Groups & seats'], tPoolsHint:['عدد المقاعد لكل مجموعة في كل زيارة.','Seats each group takes per visit.'], tPoolAdd:['مجموعة جديدة','New group'],
  tSeatsBasic:['مقاعد الأساسية','Basic seats'], tSeatsContracted:['مقاعد المتعاقدة','Contracted seats'], tSeatsByCat:['استثناء لتصنيف','Category override'],
  tPoolDelQ:['سيُنقل أفراد المجموعة إلى المجموعة الأولى.','Members move to the first group.'],
  pName:['الاسم','Name'], pPool:['المجموعة','Group'], pGender:['النوع','Gender'], pMale:['ذكر','Male'], pFemale:['أنثى','Female'], pUnset:['غير محدد','Unset'],
  pTitle:['الوظيفة','Title'], pActive:['مشارك في الخطط','Takes part in plans'],
  pSkill:['الخبرة','Skill'], pSkillHint:['من 0 إلى 100 لكل نوع. تحدد من يغطي الجهات المهمة ولا تغيّر عدد الزيارات.','0–100 per type. Decides who covers key facilities; not how many visits.'],
  pSkillCat:['خبرة خاصة بتصنيف','Category-specific skill'],
  pShare:['نصيب الزيارات','Visit share'], pShareHint:['100٪ = مثل الآخرين.','100% = same as others.'], pFixed:['عدد ثابت','Fixed count'], pFixedOff:['نسبي','Proportional'],
  pAvail:['نمط الحضور','Availability pattern'], pAvailPlan:['أيام الخطة','Plan days'], pAvailWeekdays:['أيام محددة','Set weekdays'], pAvailCycle:['دورة عمل/راحة','Work/rest cycle'],
  pCycleOn:['أيام عمل','Days on'], pCycleOff:['أيام راحة','Days off'], pCycleAnchor:['يبدأ العمل في','Cycle starts'],
  pCyclePreview:['الأسبوعان القادمان','Next two weeks'],
  pLimits:['حدود','Limits'], pMaxRun:['أقصى أيام متتالية','Max consecutive days'], pMaxWeek:['أقصى زيارات أسبوعيًا','Max visits per week'],
  pOrigin:['نقطة الانطلاق','Starts from'], pDistPref:['تفضيل المسافة','Distance preference'], pDistNear:['القريب','Near'], pDistAny:['بلا تفضيل','Any'], pDistFar:['البعيد','Far'],
  pOff:['أيام الغياب','Days off'], pOffHint:['اضغط يومًا للتبديل، Shift لتحديد فترة.','Click a day to toggle; Shift for a range.'], pOffClear:['مسح الكل','Clear all'],
  pBlocked:['جهات محظورة','Blocked facilities'], pBlockedAdd:['أضف جهة…','Add facility…'],
  pRetire:['نقل للمتقاعدين','Retire'], pRestore:['استعادة','Restore'], pDelete:['حذف','Delete'], pDeleteQ:['سيُحذف الشخص نهائيًا.','This person will be permanently deleted.'],
  pNewName:['اسم الشخص','Person name'], pStats:(n,e)=>`${n} زيارة سابقة`,

  rTitle:['القواعد','Rules'],
  rCalendar:['التقويم','Calendar'], rCalendarHint:['أيام العمل الافتراضية لكل الفريق.','Default workdays for everyone.'],
  rVolume:['حجم الزيارات','Visit volume'], rSpacing:['توزيع الأيام','Day spacing'],
  spEven:['موزعة على الفترة','Spread across period'], spPack:['متتالية من البداية','Packed from start'], spGap:['بفاصل أدنى','With minimum gap'], spGapDays:['الفاصل بالأيام','Gap in days'],
  rDays:['أيام الأسبوع','Weekdays'], rDaysHint:['ضبط اختياري لكل يوم. الفارغ يتبع العام.','Optional per-day tuning. Blank follows global.'],
  dCap:['أقصى','Max'], dMin:['أدنى','Min'], dLean:['النوع','Type'], dDist:['المسافة','Distance'], dFavor:['يفضّل','Favors'], dOnly:['فقط','Only'],
  dOffDay:['إجازة','Off'],
  rGender:['قواعد النوع','Gender rules'], rGenderHint:['أول قاعدة مطابقة تُطبق على الزيارة.','The first matching rule applies to a visit.'],
  gAdd:['قاعدة جديدة','New rule'], gKinds:['النوع','Type'], gCats:['التصنيفات','Categories'], gFacs:['جهات محددة','Specific facilities'],
  gMinEach:['الحد الأدنى لكل نوع','Minimum of each'], gAvoidEven:['تجنّب التعادل (مثل 2+2)','Avoid even split (e.g. 2+2)'],
  gAllKinds:['كل الأنواع','All types'], gAllCats:['كل التصنيفات','All categories'], gAllFacs:['كل الجهات','All facilities'],
  gPreview:n=>`فريق من ${n}`,
  gExample:(n,a,b)=>`فريق ${n}: ${a}`,
  rSeniority:['الخبرة والأهمية','Seniority'], rSeniorityHint:['الجهات فوق الحد تحصل على شخص بخبرة لا تقل عن أهميتها.','Facilities above the threshold get someone at least as skilled as their importance.'],
  senThreshold:['حد الأهمية','Importance threshold'], senMode:['الأسلوب','Mode'], senRequire:['إلزام','Require'], senPrefer:['تفضيل','Prefer'], senMatch:['مطابقة بقية المقاعد','Match other seats'],
  senAffects:n=>`${n} جهة فوق الحد`,
  rPairs:['الثنائيات','Pairs'], rPairsHint:['اجمع شخصين أو افصلهما.','Keep two people together or apart.'],
  prAdd:['قاعدة جديدة','New pair'], prTogether:['معًا','Together'], prAvoid:['منفصلان','Apart'], prFlexible:['مرنة','Flexible'], prRigid:['صارمة','Rigid'],
  prLight:['خفيفة','Light'], prMedium:['متوسطة','Medium'], prStrong:['قوية','Strong'], prPickA:['الشخص الأول','First person'], prPickB:['الشخص الثاني','Second person'],
  rFairness:['العدالة والتنويع','Fairness & rotation'],
  fairCarry:['احتساب الدورات السابقة','Count previous cycles'], fairCarryHint:['من زار أقل سابقًا يأخذ أولوية.','Those with fewer past visits go first.'],
  rotOn:['تنويع الأشخاص على الجهات','Rotate people across facilities'], rotStrength:['القوة','Strength'],
  rbOn:['منع التكرار بعد عدد زيارات','Block repeats after N visits'], rbTimes:['عدد الزيارات','Visits'],
  rDistance:['المسافة','Distance'], rDistanceHint:['تحديد القريب والبعيد يُستخدم في كل التفضيلات.','Near and far bands are used by every preference.'],
  distNearKm:['قريب حتى','Near up to'], distFarKm:['بعيد من','Far from'], km:['كم','km'],
  distOrigin:['حساب الرحلة من','Measure trips from'], distHq:['المقر','HQ'], distHome:['نقطة انطلاق الشخص','Person’s start point'],
  distShort:['تفضيل الرحلات القصيرة للجميع','Prefer short trips for all'], distPick:['ترجيح الجهات عند الاختيار','Facility pick bias'],
  distBalance:['توزيع الرحلات البعيدة بالتساوي','Share far trips evenly'],
  bandCounts:(a,b,c)=>`${a} قريب · ${b} متوسط · ${c} بعيد`,
  strength:['القوة','Strength'], sLight:['خفيف','Light'], sNormal:['عادي','Normal'], sStrong:['قوي','Strong'],

  dataTitle:['البيانات','Data'], impTitle:['استيراد','Import'], impHistory:['سجل زيارات سابق','Visit history'], impFacilities:['قائمة الجهات','Facility list'], impTeam:['قائمة الفريق','Team list'],
  impDrop:['اسحب ملف XLSX أو CSV أو اضغط للاختيار','Drop XLSX or CSV, or click to choose'], impPaste:['أو الصق البيانات','Or paste data'], impParse:['معالجة','Process'],
  impTemplate:['تنزيل قالب','Download template'], impRows:(a,b)=>`${a} من ${b} صف`, impApply:['تطبيق','Apply'], impDone:['تم الاستيراد','Imported'],
  impNew:['جديد','New'], impChanged:['تغيّر','Changed'], impUnknown:['أسماء غير معروفة','Unknown names'], impError:['تعذّرت قراءة الملف','Could not read file'],
  impMissingCols:c=>`أعمدة مفقودة: ${c}`,
  bkTitle:['نسخ احتياطي','Backup'], bkExport:['تنزيل نسخة','Download backup'], bkRestore:['استعادة نسخة','Restore backup'], bkRestored:['تمت الاستعادة','Restored'], bkError:['ملف غير صالح','Invalid file'],
  rsTitle:['إعادة الضبط','Reset'], rsAll:['مسح كل البيانات','Erase all data'], rsQ:['ستُحذف كل البيانات المحلية لهذا التطبيق.','All local data for this app will be erased.'],
  rsSettings:['إعادة القواعد للافتراضي','Reset rules to default'], rsSettingsQ:['ستعود كل القواعد للافتراضي. الجهات والفريق لا تتأثر.','All rules return to default. Facilities and team are kept.'],
  unTitle:['أسماء تحتاج ربطًا','Names to resolve'], unLink:['ربط بـ','Link to'], unAdd:['إضافة شخص','Add person'], unIgnore:['تجاهل','Ignore'],
  statsTitle:['الأرقام','Numbers'], statsFac:['جهات قابلة للزيارة','Schedulable facilities'], statsPeople:['أشخاص نشطون','Active people'], statsCycle:['آخر دورة معتمدة','Last approved cycle'],
  appearance:['المظهر','Appearance'], thLight:['فاتح','Light'], thDark:['داكن','Dark'], thAuto:['تلقائي','Auto'], language:['اللغة','Language']
});
I18N.en.workdaysN = n=>`${n} workdays`;
I18N.en.covUntil = (d,n)=>`Until ${d} · ${n} workdays`;
I18N.en.vSummary = (b,c)=>`${b} basic · ${c} contracted`;
I18N.en.vOver = (n,c)=>`${n} requested exceeds capacity ${c}`;
I18N.en.capLine = c=>`Capacity ${c}`;
I18N.en.teamActive = n=>`${n} active`;
I18N.en.statusReady = n=>`${n} visits · ready`;
I18N.en.statusIssues = (n,k)=>`${n} visits · ${k} to review`;
I18N.en.statusBlocked = (n,k)=>`${n} visits · ${k} problems`;
I18N.en.statusApproved = n=>`${n} visits · approved`;
I18N.en.cycle = n=>`Cycle ${n}`;
I18N.en.focusing = n=>`Highlight: ${n}`;
I18N.en.dOpenSeats = (f,d,n)=>`${f} · ${fmtDate(d,'short')}: ${n} open seat${n>1?'s':''}`;
I18N.en.dGender = (f,d,m,fe)=>`${f} · ${fmtDate(d,'short')}: gender ${m}M / ${fe}F`;
I18N.en.dSenior = (f,d)=>`${f} · ${fmtDate(d,'short')}: no one skilled enough`;
I18N.en.dPair = (f,d)=>`${f} · ${fmtDate(d,'short')}: pair rule broken`;
I18N.en.dUnavailable = (p,d)=>`${p} unavailable ${fmtDate(d,'short')}`;
I18N.en.dBlocked = (p,f)=>`${p} is blocked from ${f}`;
I18N.en.dRun = (p,d)=>`${p} exceeds consecutive days ${fmtDate(d,'short')}`;
I18N.en.dGenderUnknown = n=>`${n} without gender — gender rules skip them`;
I18N.en.dShort = (a,b)=>`Scheduled ${a} of ${b} requested`;
I18N.en.dQuotaShort = (c,q,n)=>`"${c}": ${q} requested, ${n} available`;
I18N.en.dShortBasic = (q,n)=>`Basic: ${q} requested, ${n} available`;
I18N.en.dShortContracted = (q,n)=>`Contracted: ${q} requested, ${n} available`;
I18N.en.dNoRoom = f=>`No suitable day for ${f}`;
I18N.en.dPinnedOut = f=>`Pinned facility left out: ${f}`;
I18N.en.dDayMin = (wd,n)=>`${wdName(wd)}: ${n} day(s) below minimum`;
I18N.en.vdOverdue = n=>n>=1000?'Never visited':`Last visit ${n} days ago`;
I18N.en.vdRank = (r,k)=>`Rank ${r} in ${k}`;
I18N.en.loadN = n=>`${n} visits`;
I18N.en.conflicts = n=>`${n} conflict${n>1?'s':''}`;
I18N.en.fCount = n=>`${n} facilities`;
I18N.en.fSelected = n=>`${n} selected`;
I18N.en.fDaysAgo = n=>`${n} days ago`;
I18N.en.tShowRetired = n=>`Retired (${n})`;
I18N.en.pStats = n=>`${n} past visits`;
I18N.en.gPreview = n=>`Team of ${n}`;
I18N.en.gExample = (n,a)=>`Team of ${n}: ${a}`;
I18N.en.senAffects = n=>`${n} facilities above threshold`;
I18N.en.bandCounts = (a,b,c)=>`${a} near · ${b} mid · ${c} far`;
I18N.en.impRows = (a,b)=>`${a} of ${b} rows`;
I18N.en.impMissingCols = c=>`Missing columns: ${c}`;
I18N.ar.workdaysN = n=>`${n} يوم عمل`;
