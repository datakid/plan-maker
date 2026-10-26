const I18N = {ar:{}, en:{}};
function defs(obj){ for(const k in obj){ const v = obj[k]; if(typeof v==='function'){ I18N.ar[k] = v; I18N.en[k] = v; } else { I18N.ar[k] = v[0]; I18N.en[k] = v[1]; } } }
function t(key){
  const d = I18N[App.ui.lang] || I18N.ar;
  let v = d[key]; if(v===undefined) v = I18N.ar[key];
  if(v===undefined) return key;
  if(typeof v==='function'){ const a = Array.prototype.slice.call(arguments, 1); return v.apply(null, a); }
  return v;
}
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
  storageFullTitle:['مساحة التخزين ممتلئة','Storage is full'],
  storageFullBody:['لم يُحفظ آخر تغيير. بياناتك ما زالت في هذه النافذة، فنزّل نسخة احتياطية الآن قبل إغلاق الصفحة.','Your last change was not saved. Your data is still in this window, so download a backup now before closing the page.'],
  roTitle:['تغيّرت البيانات في نافذة أخرى','Data changed in another window'],
  roBody:['أُوقف الحفظ هنا حتى لا تُمحى البيانات الأحدث. أعد التحميل للمتابعة.','Saving is paused here so the newer data is not overwritten. Reload to continue.'],
  roReload:['إعادة التحميل','Reload'], roKeep:['اعتماد بيانات هذه النافذة','Use this window’s data'],
  roKeepQ:['ستحل بيانات هذه النافذة محل ما حُفظ في النافذة الأخرى.','This window’s data will replace what the other window saved.'],
  recoveredToast:['استُعيدت البيانات من آخر حفظ سليم','Data recovered from the last good save'],
  corruptToast:['تعذّرت قراءة البيانات المحفوظة. حُفظت نسخة منها وبدأ التطبيق ببيانات جديدة','Saved data could not be read. A copy was kept and the app started with fresh data'],
  snapTitle:['نسخ تلقائية سابقة','Automatic snapshots'], snapEmpty:['لا توجد نسخ تلقائية بعد','No automatic snapshots yet'], snapRestore:['استعادة','Restore'],
  snapR_approve:['قبل الاعتماد','Before approve'], snapR_import:['قبل الاستيراد','Before import'], snapR_restore:['قبل الاستعادة','Before restore'],
  genStageSelect:['اختيار الجهات','Selecting facilities'], genStageLayout:['توزيع الأيام','Laying out days'], genStageTeams:['تكوين الفرق','Building teams'], genStageSearch:['البحث عن حل','Searching'], genStagePolish:['تحسين الخطة','Polishing'], genStageExplain:['تجهيز الشرح','Preparing explanations'],
  genCancelled:['أُلغي التوليد','Generation cancelled'],
  genKeep:['واصل البحث','Keep searching'],
  genTruncated:['توقّف البحث مبكرًا على هذا الجهاز، وقد تختلف النتيجة على جهاز أسرع','Search stopped early on this device; a faster device may give a different result'],
  undone:['تم التراجع','Undone'], redone:['تمت الإعادة','Redone'], redo:['إعادة','Redo'],
  edited:['تم تعديل الخطة','Plan edited'],
  diffChip:[(a, r, m, c)=>'التغييرات: ‎+'+a+' ‎−'+r+' · نُقلت '+m+' · تغيّر فريق '+c, (a, r, m, c)=>'Changes: +'+a+' −'+r+' · moved '+m+' · team changed '+c],
  diffKeep:['استرجاع الخطة السابقة','Keep previous plan'], diffDismiss:['إخفاء','Dismiss'],
  errToast:['حدث خطأ غير متوقع. بياناتك محفوظة.','Something went wrong. Your data is safe.'], copyDiag:['نسخ التشخيص','Copy diagnostic'],
  newVersion:['يتوفر إصدار جديد من التطبيق','A new version is available'], reloadNow:['تحديث الآن','Update now'],
  rulesSimple:['مبسّط','Simple'], rulesAdvanced:['متقدّم','Advanced'], rulesSearch:['ابحث في القواعد','Search rules'],
  rulesSimpleHint:['القواعد الأساسية فقط. اختر متقدّم لرؤية كل القواعد والأوزان.','Key rules only. Choose Advanced for every rule and weight.'],
  rulesNoMatch:['لا توجد قاعدة بهذا الاسم','No rule matches that search'],
  frTitle:['ثلاث خطوات قبل التوليد','Three steps before you generate'],
  frDays:['تأكد من أيام العمل','Check the work days'], frDaysHint:['الأيام التي يعمل فيها الفريق والإجازات.','The days the team works, and holidays.'],
  frTeam:['راجع الفريق','Check the team'], frTeamHint:['من هو نشط، وأيام الإجازة، والمجموعات.','Who is active, days off and groups.'],
  frGen:['اضغط توليد','Press Generate'], frGenHint:['ويمكنك تعديل الخطة بعد ذلك.','You can edit the plan afterwards.'], frOpen:['فتح','Open'],
  emptyFacilities:['لا توجد جهات بعد. أضف جهة أو استورد ملفًا من تبويب البيانات.','No facilities yet. Add one, or import a file from the Data tab.'],
  emptyTeam:['لا يوجد أفراد بعد. أضف شخصًا أو استورد الفريق من تبويب البيانات.','No team members yet. Add one, or import the team from the Data tab.'],
  fixSetExact:[(k, n)=>'اخفض عدد زيارات ('+k+') إلى '+n, (k, n)=>'Lower exact '+k+' to '+n],
  fixDayPrefer:[(rule, day)=>'اجعل «'+rule+'» يوم '+day+' «مفضّل»', (rule, day)=>'Change '+rule+' on '+day+' to Prefer'],
  fixGoalPrefer:['اجعل هذا الهدف «مفضّل»','Make this goal Prefer'],
  fixNoEveryDay:['أوقف إلزام الزيارة كل يوم متاح','Stop requiring a visit on every eligible day'],
  storageLabel:['المساحة المستخدمة','Storage used'], appVersion:['إصدار التطبيق','App version'],

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
  vDayUpTo:(n,d)=>`حتى ${n} يوميًا · ${d} أيام`, vDayExactly:(n,d)=>`${n} يوميًا بالضبط · ${d} أيام`,
  vUpTo:['حتى','Up to'], vExactlyOpt:['بالضبط','Exactly'], vUseAll:['استخدام كل الأيام','Use all days'], vUseOff:['لا','Off'], vUseTry:['محاولة','Try'], vUseMust:['إلزامي','Must'],
  vUseAllHint:['«محاولة» تفضّل زيارة في كل يوم مؤهل، و«إلزامي» تفرضها.','Try prefers a visit on every eligible day; Must requires one.'], vPerDayMode:['عدد الزيارات في اليوم','Visits per day'], vCountMode:['العدد الإجمالي','Total count'],
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
  gpTitle:['تفضيلات حسب النوع','Preferences by gender'], gpHint:['تفضيل مرن يُرجّح التوزيع ولا يمنعه.','Soft preference: tilts assignment, never blocks it.'],
  gpMale:['الذكور','Men'], gpFemale:['الإناث','Women'], gpDist:['المسافة','Distance'], gpKind:['نوع الجهة','Facility type'], gpDays:['أيام مفضلة','Preferred days'], gpAnyDay:['أي يوم','Any day'], gpStrength:['القوة','Strength'],
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
function defs2(obj){ for(const k in obj){ I18N.ar[k] = obj[k][0]; I18N.en[k] = obj[k][1]; } }
defs({
  sGoals:['الأهداف','Goals'], sFixed:['زيارات مثبّتة','Fixed visits'],
  goalsTitle:['أهداف الخطة','Plan goals'], goalsHint:['ما تريد تحقيقه. «إلزامي» يُقدَّم أولًا، و«قدر الإمكان» يملأ ما تبقى.','What the plan should achieve. "Must" goes first, "Try" fills what is left.'],
  goalsManage:['إدارة الأهداف','Manage goals'], goalAdd:['هدف جديد','New goal'], goalsNone:['لا أهداف. تعمل الخطة بالإعدادات العادية.','No goals. The plan uses the normal settings.'],
  goalsNoneShort:['بدون أهداف','No goals'], goalProgressTitle:['تقدّم الأهداف','Goal progress'],
  gTypeCover:['تغطية','Cover'], gTypeAtLeast:['حد أدنى','At least'], gTypeAtMost:['حد أقصى','At most'], gTypeMaxGap:['أقصى مدة بدون زيارة','Max gap'],
  gHintCover:['زيارة كل جهة في النطاق عدد مرات معين، مع تاريخ إنهاء اختياري.','Visit every facility in scope N times, optionally by a deadline.'],
  gHintAtLeast:['عدد أدنى من الزيارات للنطاق في كل خطة.','A minimum number of visits to the scope in each plan.'],
  gHintAtMost:['لا يتجاوز عدد زيارات النطاق هذا الحد في الخطة.','Never exceed this many visits to the scope in a plan.'],
  gHintMaxGap:['لا تمر على أي جهة في النطاق مدة أطول من هذه دون زيارة.','No facility in scope goes longer than this without a visit.'],
  gMust:['إلزامي','Must'], gTry:['قدر الإمكان','Try'], gScope:['النطاق','Scope'], gTimes:['مرات لكل جهة','Times each'],
  gSince:['يُحتسب من','Counting from'], gBy:['الإنهاء قبل','Finish by'], gNoDeadline:['بدون موعد','No deadline'], gRepeat:['يبدأ دورة جديدة عند الاكتمال','Start over when complete'],
  gN:['العدد','Count'], gPerPlan:['في الخطة','per plan'], gDays:['المدة','Gap'], daysU:['يوم','days'],
  gsAll:['كل الجهات','All facilities'], scopeFacility:['جهات','Facilities'], choose:['اختر…','Choose…'],
  gp_met:['تحقق','Met'], gp_short:['لم يكتمل','Short'], gp_progress:['قيد التقدم','In progress'], gp_new:['جديد','New'], gPaced:['موزع حتى الموعد','Paced to deadline'],
  cGoals:['الأهداف الإلزامية','Required goals'],
  fixedTag:['مثبّتة','Fixed'], fixedNew:['زيارة مثبّتة جديدة','New fixed visit'], fixedAdd:['تثبيت زيارة','Fix a visit'], fixedNone:['لا يوجد','None'], fixedTap:['حدد يومًا وجهة وفريقًا','Pick a day, place and team'],
  fixedHint:['حدد تاريخًا وجهة وأشخاصًا. تُوضع أولًا، ويُحجز أشخاصها في ذلك اليوم، وتُبنى بقية الخطة حولها.','Set a date, place and people. They go in first, their people are held that day, and the rest of the plan works around them.'],
  fixedSaved:['حُفظت الزيارة المثبّتة','Fixed visit saved'],
  ovDate:['التاريخ','Date'], ovFacility:['الجهة','Facility'], ovPeople:['الفريق','People'], ovAddPerson:['أضف شخصًا','Add person'],
  ovPickFacility:['اختر الجهة','Choose facility'], ovAutoShort:['فريق تلقائي','Auto team'], ovNote:['ملاحظة','Note'],
  ovFill:['أكمل باقي المقاعد تلقائيًا','Fill remaining seats automatically'], ovFillHint:['إن أوقفته يذهب الأشخاص المحددون فقط.','When off, only the people you picked go.'],
  ovNoFacility:['لم تُحدد الجهة','No facility selected'], ovNoDate:['لم يُحدد التاريخ','No date set'],
  ovExcluded:['الجهة مستبعدة عادةً — ستُزار في هذا اليوم فقط','Facility is normally excluded — visited on this day only'],
  ovAddsDay:['اليوم ليس يوم عمل — سيُضاف لهذه الزيارة فقط','Not a workday — added just for this visit'],
  ovGone:['شخص محذوف في الفريق','A deleted person is in the team'], ovAutoTeam:['بدون أشخاص: يُختار الفريق تلقائيًا','No people: the team is picked automatically'],
  lateTag:['متأخرة','Late'], vdFix:['تثبيت هذه الزيارة','Fix this visit'], vdEditFixed:['تعديل المثبّتة','Edit fixed visit'],
  vdFixedHint:['هذه الزيارة مثبّتة. تبقى في مكانها مع فريقها عند إعادة التوليد.','This visit is fixed: it keeps its date and team on regenerate.']
});
defs({
  gTypePerson:['قاعدة لشخص','Person rule'], gTypeTogether:['ثنائي معًا','Pair together'], gTypeSpecial:['زيارة خاصة','Special visit'],
  gHintPerson:['مثل: لا يخرج إلى المتعاقدة أبدًا، أو يخرج ٦ زيارات بالضبط في هذه الخطة.','e.g. never goes to contracted, or makes exactly 6 visits this plan.'],
  gHintTogether:['يخرج شخصان معًا في نسبة من زياراتهما، مثل نصف الأماكن.','Two people share a share of their visits, e.g. half the places.'],
  gHintSpecial:['زيارة لجهة معينة خلال فترة مرنة، مع أشخاص محددين إن أردت. يختار المخطط أنسب يوم.','A visit to a chosen place within a flexible window, optionally with set people. The planner picks the best day.'],
  gGroupFac:['أهداف الجهات','Facility goals'], gGroupPeople:['أهداف الأشخاص','People goals'],
  gWho:['الأشخاص','People'], gRel:['القاعدة','Rule'], gVisitsN:['عدد الزيارات','Visits'], gWhere:['في','At'], gOnlyWhere:['فقط في','Only at'], gCountWhere:['تُحتسب في','Counted at'],
  rel_never:['لا يخرج أبدًا','Never'], rel_only:['فقط','Only'], rel_exactly:['بالضبط','Exactly'], rel_between:['بين حدّين','Between'], rel_atLeast:['على الأقل','At least'], rel_atMost:['على الأكثر','At most'],
  trel_atLeast:['معًا على الأقل','Together at least'], trel_atMost:['معًا على الأكثر','Together at most'],
  gPair:['الثنائي','Pair'], gShare:['النسبة','Share'], gTogetherHow:['النسبة من زيارات الأقل خروجًا منهما. ١٠٠٪ = دائمًا معًا، ٠٪ على الأكثر = لا يجتمعان.','Share of the visits of whichever goes out less. 100% = always together; at most 0% = never together.'],
  gBetween:['خلال','Between'], gPlanStart:['بداية الخطة','Plan start'], gPlanEnd:['نهاية الخطة','Plan end'],
  gNeedPeople:['اختر أشخاصًا','Pick people'], gNeedPair:['اختر شخصين','Pick two people'], choosePerson:['اختر شخصًا','Choose person'],
  gpClean:['لا مخالفات','No breaks'], specialTag:['خاصة','Special'],
  pLoad:['الحمل','Workload'], pPerPlan:['الزيارات في كل خطة','Visits per plan'], pPerPlanHint:['تلقائي = حسب النصيب. أو حدد عددًا بالضبط أو نطاقًا.','Auto = by share. Or set an exact number or a range.'],
  pPerPlanShort:['/خطة','/plan'], pQAuto:['تلقائي','Auto'], pQExact:['بالضبط','Exact'], pQRange:['نطاق','Range'], pQMin:['الحد الأدنى','Minimum'], pQMax:['الحد الأقصى','Maximum'],
  pGoals:['قواعد هذا الشخص','Rules for this person'], gAddFor_person:['قاعدة','Rule'], gAddFor_together:['ثنائي','Pair'], gAddFor_special:['زيارة خاصة','Special visit'],
  rRule:['قاعدة','rule'], rQuota:['بلغ الحد','at limit'], cPeople:['قواعد الأشخاص','People rules']
});
defs2({
  gtPersonT:[(p,r,n,s,m)=>`${p}: ${({never:'لا يخرج',only:'فقط',exactly:n+' بالضبط',between:'من '+n+' إلى '+Math.max(n,m||n),atLeast:n+' على الأقل',atMost:n+' على الأكثر'})[r]}${s?' · '+s:''}`, (p,r,n,s,m)=>`${p}: ${({never:'never',only:'only',exactly:'exactly '+n,between:n+' to '+Math.max(n,m||n),atLeast:'at least '+n,atMost:'at most '+n})[r]}${s?' · '+s:''}`],
  gVisitsMin:['الحد الأدنى','Minimum'], gVisitsMax:['الحد الأقصى','Maximum'],
  gtTogetherT:[(a,b,r,p,s)=>`${a} + ${b}: ${r==='atLeast'?'≥':'≤'}${p}٪ معًا${s?' · '+s:''}`, (a,b,r,p,s)=>`${a} + ${b}: ${r==='atLeast'?'≥':'≤'}${p}% together${s?' · '+s:''}`],
  gtSpecialT:[(f,n)=>`زيارة خاصة: ${f}${n>1?' ×'+n:''}`, (f,n)=>`Special: ${f}${n>1?' ×'+n:''}`],
  gpBreaks:[n=>`${n} مخالفة`, n=>`${n} breaks`],
  gpTogether:[(b,n,p)=>`${b} من ${n} معًا (${p}٪)`, (b,n,p)=>`${b} of ${n} together (${p}%)`],
  dPersonRule:[(p,f)=>`${p} في ${f} رغم قاعدته`, (p,f)=>`${p} at ${f} despite a rule`],
  dQuotaPerson:[(p,q,l)=>`${p}: ${q} زيارة (المطلوب ${l})`, (p,q,l)=>`${p}: ${q} visits (wanted ${l})`],
  dPersonFewDays:[(p,n,a)=>`${p}: مطلوب ${n} ومتاح ${a} يوم فقط`, (p,n,a)=>`${p}: ${n} wanted but only ${a} days available`],
  dPersonEmptyScope:[g=>`«${g}»: النطاق فارغ`, g=>`"${g}": the scope is empty`],
  dTogetherNoSeats:[g=>`«${g}»: لا توجد جهة تتسع لهما معًا`, g=>`"${g}": no place has seats for both`],
  dSpecialNoFacility:[g=>`«${g}»: لم تُحدد الجهة`, g=>`"${g}": no facility set`],
  dSpecialPeopleGone:[g=>`«${g}»: بعض الأشخاص غير نشطين`, g=>`"${g}": some people are inactive`],
  dSpecialNoDay:[g=>`«${g}»: لا يوجد يوم مناسب في الفترة`, g=>`"${g}": no suitable day in the window`]
});
defs2({
  gtCoverT:[(s,n)=>`تغطية ${s}${n>1?' ×'+n:''}`, (s,n)=>`Cover ${s}${n>1?' ×'+n:''}`],
  gtAtLeastT:[(n,s)=>`${n} على الأقل: ${s}`, (n,s)=>`At least ${n}: ${s}`],
  gtAtMostT:[(n,s)=>`${n} كحد أقصى: ${s}`, (n,s)=>`At most ${n}: ${s}`],
  gtMaxGapT:[(s,d)=>`${s} كل ${d} يوم`, (s,d)=>`${s} every ${d} days`],
  gStCover:[(a,b)=>`${a}/${b} منجزة`, (a,b)=>`${a}/${b} done`],
  gStGap:[(a,b)=>`${a} من ${b} متأخرة`, (a,b)=>`${a} of ${b} overdue`],
  gStPool:[n=>`${n} جهة`, n=>`${n} facilities`],
  goalsN:[n=>`${n} أهداف`, n=>`${n} goals`],
  goalsDemand:[(m,tr)=>`${m} إلزامي · ${tr} مرغوب`, (m,tr)=>`${m} required · ${tr} wanted`],
  fixedN:[n=>`${n} مثبّتة`, n=>`${n} fixed`],
  fixedBad:[n=>`${n} بها تعارض`, n=>`${n} with conflicts`],
  fixedInPlan:[n=>`${n} في فترة الخطة`, n=>`${n} in plan period`],
  fixedAddOn:[d=>`تثبيت زيارة يوم ${d}`, d=>`Fix a visit on ${d}`],
  vdDeadline:[d=>`مطلوبة قبل ${d}`, d=>`Due by ${d}`],
  ovPeopleN:[n=>`${n} أشخاص`, n=>`${n} people`],
  ovUsualTeam:[s=>`الفريق المعتاد: ${s}`, s=>`Usual team: ${s}`],
  vsSeatsOf:[p=>`مقاعد ${p} في هذه الزيارة`, p=>`${p} seats on this visit`], vsSeatsHint:['اتركه فارغًا للعدد المعتاد. الأرقام هنا تخص هذه الزيارة فقط.','Leave blank for the usual number. These numbers apply to this visit only.'], vsLock:['اجعل المقاعد = الأشخاص المسمّين','Seats = named people'], vsAuto:['إرجاع المقاعد للمعتاد','Back to usual seats'],
  vrBlock:['قواعد هذه الزيارة','Rules for this visit'], vrGender:['قاعدة الجنس','Gender rule'], vrInherit:['الافتراضي','Inherit'], vrNone:['بلا','None'], vrCustom:['مخصّصة','Custom'], vrMinEach:['أدنى نسبة لكل جنس %','Min % of each gender'], vrAvoidEven:['تجنّب التساوي','Avoid an even split'], vrSenior:['مشرف أقدم','Senior required'], vrOn:['مطلوب','On'], vrOff:['غير مطلوب','Off'],
  dupPolicy:['الطلبات المكررة لنفس الجهة','Duplicate requests for one place'], dupAsk:['اسأل','Ask'], dupMerge:['ادمج','Merge'], dupKeep:['أبقِ الاثنين','Keep both'], dupReject:['تجاهل الأحدث','Reject newer'], dupHint:['عند تداخل طلبين لنفس الجهة: «اسأل» ينبّهك ويُبقي الاثنين، «ادمج» يجمعهما في زيارة واحدة، «تجاهل الأحدث» يلغي الأحدث.','When two requests for one place overlap: Ask warns and keeps both, Merge joins them into one visit, Reject newer drops the newer one.'], dupToast:['طلبان متداخلان لنفس الجهة','Two overlapping requests for the same place'],
  rsOff:['غائب أو في إجازة','is off'], rsQuota:['وصل إلى حدّه','is at their limit'], rsCycle:['في فترة راحة دورته','is in a rest cycle'], rsHeld:['محجوز بزيارة ثابتة','is held by a fixed visit'], fixSeatDown:[n=>`خفّض المقاعد إلى ${n}`, n=>`Lower seats to ${n}`], seatsTitle:['المقاعد حسب الفريق','Seats by team'],
  modelTitle:['المعادلة','The equation'], modelCopy:['نسخ','Copy'], modelTxt:['تصدير txt','Export .txt'], modelJson:['تصدير json','Export .json'],
  guestsLabel:['ضيوف من خارج الفريق','Guests (outside people)'], guestAdd:['إضافة ضيف','Add guest'], guestNew:['ضيف جديد…','New guest…'], guestName:['الاسم','Name'], guestPool:['الفريق (اختياري)','Pool (optional)'], guestNoPool:['بلا مقعد (إضافي)','No seat (extra)'], guestGender:['الجنس (اختياري)','Gender (optional)'], guestM:['ذكر','Male'], guestF:['أنثى','Female'], guestMark:['(ضيف)','(guest)'],
  locSeats:['المقاعد','Seats'], locSeatsHint:['مقاعد كل فريق لجهات هذا الموقع، وتُستخدم ما لم تحدد الجهة مقاعدها.','Seats per pool for the facilities in this location, used unless a facility sets its own.'], vsDefault:['الافتراضي','Default'], vsCustom:['معدّل','Custom'],
  vsOnly:['التكملة من هؤلاء فقط','Fill only from these people'], vsNever:['لا يشارك في هذه الزيارة','Not on this visit'],
  vFixed:['المثبّتة فقط','Fixed only'], vFixedHint:['لا تضيف الخطة أي جهة عشوائية: فقط الزيارات المثبّتة والمستهدفات الخاصة.','The plan adds no random places: only fixed visits and special goals.'],
  vMinPerDay:['حد أدنى في اليوم','Minimum per day'], vMinPerDayHint:['لجعل عدد الزيارات في اليوم ثابتًا اجعل الحد الأدنى مساويًا للحد الأقصى.','For a fixed number of visits per day, set the minimum equal to the per-day maximum.'],
  fSeats:['عدد المقاعد في هذه الجهة','Seats at this place'], fSeatsHint:['اتركه فارغًا لاستخدام العدد المعتاد. اكتب عددًا أقل (حتى 0) لتصغير الزيارة، مثل شخص واحد فقط.','Leave blank for the usual seats. Enter a smaller number (even 0) to shrink the visit, for example one person only.'],
  ovInactive:[p=>`${p} غير مشارك حاليًا`, p=>`${p} is not active`],
  ovPersonOff:[p=>`${p} غير متاح في هذا اليوم`, p=>`${p} is unavailable that day`],
  ovPersonBlocked:[p=>`${p} محظور من هذه الجهة`, p=>`${p} is blocked from this facility`],
  ovPersonTwice:[p=>`${p} في زيارة مثبّتة أخرى نفس اليوم`, p=>`${p} is in another fixed visit that day`],
  ovBigTeam:[(a,b)=>`الفريق ${a} أكبر من المعتاد ${b}`, (a,b)=>`Team of ${a} is larger than usual ${b}`],
  dGoalShortPool:[(g,n,h)=>`«${g}»: المتاح ${h} من ${n}`, (g,n,h)=>`"${g}": only ${h} of ${n} available`],
  dGoalShort:[(g,a,b)=>`هدف «${g}»: ${a} من ${b}`, (g,a,b)=>`Goal "${g}": ${a} of ${b}`],
  dGoalNoRoom:[f=>`لا يوجد يوم متاح لـ ${f} (مطلوبة لهدف)`, f=>`No free day for ${f} (needed by a goal)`],
  dGoalOverCap:[(n,c)=>`الأهداف تطلب ${n} زيارة زيادة عن سعة الفترة (${c}) — أُجّلت للدورة القادمة`, (n,c)=>`Goals ask for ${n} more visits than the period holds (${c}) — moved to next cycle`],
  dCapBlocked:[f=>`${f}: منعها حد أقصى`, f=>`${f}: held back by an at-most goal`],
  dFixedTwice:[(p,d)=>`${p} في زيارتين مثبّتتين ${fmtDate(d,'short')}`, (p,d)=>`${p} is in two fixed visits ${fmtDate(d,'short')}`],
  dFixedOff:[(p,d)=>`${p} مثبّت رغم عدم توفره ${fmtDate(d,'short')}`, (p,d)=>`${p} fixed although unavailable ${fmtDate(d,'short')}`],
  dFixedBlocked:[(p,f)=>`${p} مثبّت في جهة محظورة ${f}`, (p,f)=>`${p} fixed at blocked facility ${f}`],
  dLate:[(f,d)=>`${f}: بعد الموعد ${d?fmtDate(d,'dm'):''}`, (f,d)=>`${f}: after its due date ${d?fmtDate(d,'dm'):''}`]
});
I18N.en.workdaysN = n=>`${n} workdays`;
I18N.en.covUntil = (d,n)=>`Until ${d} · ${n} workdays`;
I18N.en.vSummary = (b,c)=>`${b} basic · ${c} contracted`;
I18N.en.vDayUpTo = (n,d)=>`Up to ${n}/day · ${d} days`;
I18N.en.vDayExactly = (n,d)=>`Exactly ${n}/day · ${d} days`;
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

const D = d=>fmtDate(d, 'short');
function seatWho(who){
  const phrase = r=>t(r==='off' ? 'rsOff' : (r==='quota' ? 'rsQuota' : (r==='cycle' ? 'rsCycle' : 'rsHeld')));
  return who.map(w=>{ const p = personById(w.id); return (p ? p.name : '?')+' '+phrase(w.reason); }).join(App.ui.lang==='ar' ? '، ' : ', ');
}
defs({
  dRun:[(p,a,b)=>`${p}: تجاوز حد الأيام المتتالية (${D(a)} → ${D(b)})`, (p,a,b)=>`${p}: too many consecutive days (${D(a)} → ${D(b)})`],
  dRest:[(p,a,b)=>`${p}: راحة غير كافية بين ${D(a)} و${D(b)}`, (p,a,b)=>`${p}: not enough rest between ${D(a)} and ${D(b)}`],
  dPatternDay:[(p,d)=>`${p}: ${D(d)} خارج دورة عمله`, (p,d)=>`${p}: ${D(d)} is outside the work cycle`],
  dPatternGoalCycle:[(p,n)=>`${p}: ${n} يوم خارج دورة العمل`, (p,n)=>`${p}: ${n} day(s) outside the work cycle`],
  dPatternDaySoft:[(p,d)=>`${p}: يفضّل عدم العمل في ${D(d)} حسب دورته`, (p,d)=>`${p}: prefers not to work on ${D(d)} per the cycle`],
  dWeek:[(p,n,m)=>`${p}: ${n} زيارات في أسبوع واحد (الحد ${m})`, (p,n,m)=>`${p}: ${n} visits in one week (limit ${m})`],
  dRepeatBlock:[(p,f)=>`${p} زار ${f} بما يكفي — منع التكرار`, (p,f)=>`${p} has visited ${f} enough times — repeat block`],
  dTeamUnknown:[(id,f,d)=>`${f} · ${D(d)}: عضو غير معروف (${id})`, (id,f,d)=>`${f} · ${D(d)}: unknown team member (${id})`],
  dTeamPoolUnknown:[(f,d)=>`${f} · ${D(d)}: فريق من مجموعة غير معرّفة`, (f,d)=>`${f} · ${D(d)}: team uses an unknown pool`],
  dTeamDup:[(p,f,d)=>`${f} · ${D(d)}: ${p} مكرر في الفريق`, (p,f,d)=>`${f} · ${D(d)}: ${p} listed twice in the team`],
  dDupMerged:[(f,n)=>`${f}: تم دمج ${n} طلبات زيارة في زيارة واحدة`, (f,n)=>`${f}: ${n} visit requests merged into one visit`],
  dDupRejected:[(g,f)=>`${f}: تم تجاهل الطلب الأحدث «${g}» لأنه مكرر`, (g,f)=>`${f}: the newer request "${g}" was ignored as a duplicate`],
  dDupAsk:[(f,n)=>`${f}: ${n} طلبات زيارة متداخلة — ادمجها أو أبقِها من إعدادات التكرار`, (f,n)=>`${f}: ${n} overlapping visit requests — merge or keep them in the duplicate setting`],
  dGuestDup:[(g,f,d)=>`${f} · ${D(d)}: الضيف ${g} موجود في أكثر من زيارة في اليوم نفسه`, (g,f,d)=>`${f} · ${D(d)}: guest ${g} is on more than one visit the same day`],
  dTeamInactive:[(p,f,d)=>`${f} · ${D(d)}: ${p} غير نشط`, (p,f,d)=>`${f} · ${D(d)}: ${p} is inactive`],
  dTeamPool:[(p,f,d)=>`${f} · ${D(d)}: ${p} في مقعد مجموعة أخرى`, (p,f,d)=>`${f} · ${D(d)}: ${p} sits in another pool's seat`],
  dTeamOversize:[(f,d,n)=>`${f} · ${D(d)}: ${n} زيادة عن المقاعد`, (f,d,n)=>`${f} · ${D(d)}: ${n} more than the seats`],
  dVisitPerson:[(p,f,d)=>`${f} · ${D(d)}: ${p} غير مسموح به في هذه الزيارة`, (p,f,d)=>`${f} · ${D(d)}: ${p} is not allowed on this visit`],
  dLockedMissing:[(p,f,d)=>`${f} · ${D(d)}: ${p} مثبّت لكنه غير موجود في الفريق`, (p,f,d)=>`${f} · ${D(d)}: ${p} is locked but missing from the team`],
  dOutOfPlan:[(f,d)=>`${f} · ${D(d)}: خارج فترة الخطة`, (f,d)=>`${f} · ${D(d)}: outside the plan period`],
  dNotWorkday:[(f,d)=>`${f} · ${D(d)}: ليس يوم عمل`, (f,d)=>`${f} · ${D(d)}: not a workday`],
  dActivityRest:[(f,d)=>`${f} · ${D(d)}: يوم راحة حسب نمط العمل العام`, (f,d)=>`${f} · ${D(d)}: rest day under the plan work pattern`],
  dActivityCycleSoft:[(f,d)=>`${f} · ${D(d)}: يوم غير مفضّل حسب نمط العمل العام`, (f,d)=>`${f} · ${D(d)}: a non-preferred day under the plan work pattern`],
  dWeekday:[(f,d)=>`${f} · ${D(d)}: يوم غير مسموح لهذه الجهة`, (f,d)=>`${f} · ${D(d)}: not an allowed weekday for this facility`],
  dDayOnly:[(f,d)=>`${f} · ${D(d)}: هذا اليوم مخصص لفئة أخرى`, (f,d)=>`${f} · ${D(d)}: the day is reserved for another category`],
  dSeniorNone:[(f,d)=>`${f} · ${D(d)}: لا يوجد صاحب خبرة كافية في الفريق المتاح`, (f,d)=>`${f} · ${D(d)}: no one skilled enough exists in the available pool`],
  dDayDup:[(p,d)=>`${p}: في أكثر من زيارة يوم ${D(d)}`, (p,d)=>`${p}: on more than one visit on ${D(d)}`],
  dFacDup:[(f,d)=>`${f}: زيارتان في ${D(d)}`, (f,d)=>`${f}: visited twice on ${D(d)}`],
  dCapDay:[(d,n,m)=>`${D(d)}: ${n} زيارات (الحد ${m})`, (d,n,m)=>`${D(d)}: ${n} visits (limit ${m})`],
  dCapWeek:[(w,n,m)=>`أسبوع ${D(w)}: ${n} زيارات (الحد ${m})`, (w,n,m)=>`Week of ${D(w)}: ${n} visits (limit ${m})`],
  dSpacing:[(a,b,g)=>`${D(a)} و${D(b)}: ${g} يوم فقط بين يومي نشاط`, (a,b,g)=>`${D(a)} and ${D(b)}: only ${g} day(s) between active days`],
  dActivityRest2:[(a,b,g)=>`${D(a)} و${D(b)}: راحة غير كافية في نمط الخطة`, (a,b,g)=>`${D(a)} and ${D(b)}: not enough rest in the plan pattern`],
  dActivityRun:[(a,b)=>`${D(a)} → ${D(b)}: أيام نشاط متتالية أكثر من المسموح`, (a,b)=>`${D(a)} → ${D(b)}: more consecutive active days than allowed`],
  dEveryDay:[d=>`${D(d)}: يوم مؤهل بلا زيارة`, d=>`${D(d)}: an eligible day with no visit`],
  dCoverShort:[(t,n,m)=>`${t}: ${n} من ${m}`, (t,n,m)=>`${t}: ${n} of ${m}`],
  dAtLeastShort:[(t,n,m)=>`${t}: ${n} من ${m}`, (t,n,m)=>`${t}: ${n} of ${m}`],
  dSpecialShort:[(t,n,m)=>`${t}: ${n} من ${m}`, (t,n,m)=>`${t}: ${n} of ${m}`],
  dTogetherShort:[(t,n,m)=>`${t}: ${n}% (المطلوب ${m}%)`, (t,n,m)=>`${t}: ${n}% (wanted ${m}%)`],
  dCapMust:[(t,n,m)=>`${t}: ${n} زيارات، الحد الأقصى ${m}`, (t,n,m)=>`${t}: ${n} visits, maximum ${m}`],
  dCapPref:[(t,n,m)=>`${t}: ${n} زيارات، تجاوز المفضّل ${m}`, (t,n,m)=>`${t}: ${n} visits, preferred maximum ${m} exceeded`],
  dGapNone:[(f)=>`${f}: لا سجل زيارة سابق، لذلك تلزم زيارة أولى`, (f)=>`${f}: no earlier visit on record, so a first visit is required`],
  dGapOverdue:[(f,due)=>`${f}: تأخرت الزيارة عن ${D(due)}`, (f,due)=>`${f}: overdue since ${D(due)}`],
  dGapLate:[(f,due,vis)=>`${f}: كان يجب الزيارة قبل ${D(due)} وتمت ${D(vis)}`, (f,due,vis)=>`${f}: due by ${D(due)} but visited ${D(vis)}`],
  dGapTail:[(f,due)=>`${f}: تحتاج زيارة قبل ${D(due)} داخل الخطة`, (f,due)=>`${f}: needs a visit by ${D(due)} inside the plan`],
  dHistoryUnresolved:[n=>`${n} سجلات سابقة بلا ربط — لم تُحتسب في القواعد`, n=>`${n} earlier history entries could not be matched — not counted by the rules`],
  cTeam:['فرق سليمة','Valid teams'], cCalendar:['التقويم وأيام الجهات','Calendar and facility days'], cCaps:['حدود اليوم والأسبوع','Day and week limits'],
  cWeek:['حد الأسبوع للأشخاص','Per-person week limits'], cRest:['الراحة ودورات العمل','Rest and work cycles'], cSpacing:['التباعد بين أيام النشاط','Spacing between active days'],
  cDays:['زيارة في كل يوم مؤهل','A visit on every eligible day'],
  xBoundsEmpty:[(p,lo,hi)=>`${p}: حدّ أدنى ${lo} أعلى من الأقصى ${hi}`, (p,lo,hi)=>`${p}: minimum ${lo} is above maximum ${hi}`],
  xQuotaDays:[(p,lo,can)=>`${p}: يلزم ${lo} زيارة لكن أقصى ما تسمح به أيام العمل والقواعد ${can}`, (p,lo,can)=>`${p}: needs ${lo} visits but days and rules allow at most ${can}`],
  xHardOverVolume:[(n,m)=>`الالتزامات الإلزامية ${n} أكثر من الحجم المحدد ${m}`, (n,m)=>`${n} mandatory visits exceed the set volume of ${m}`],
  xPoolDayShort:[(p,n,d,nd,av,who)=>`${p}: ${n===1 ? 'ينقص مقعد' : (n===2 ? 'ينقص مقعدان' : 'ينقص '+n+' مقاعد')} يوم ${D(d)} (مطلوب ${nd}، متاح ${av}${who.length ? '؛ '+seatWho(who) : ''})`, (p,n,d,nd,av,who)=>`${p}: short ${n} seat${n===1?'':'s'} on ${D(d)} (need ${nd}, available ${av}${who.length ? '; '+seatWho(who) : ''})`],
  xPoolSeatsHigh:[(p,s,c)=>`«${p}»: المقاعد ${s} أكثر مما يستطيع الفريق تغطيته (${c})`, (p,s,c)=>`"${p}": ${s} seats exceed what the team can cover (${c})`],
  xPoolSeatsLow:[(p,s,c)=>`«${p}»: المقاعد ${s} أقل من مجموع الحدود الدنيا (${c})`, (p,s,c)=>`"${p}": ${s} seats are below the sum of minimums (${c})`],
  xAtLeastPool:[(g,n,m)=>`${g}: يلزم ${n} لكن النطاق يحوي ${m} جهة فقط`, (g,n,m)=>`${g}: needs ${n} but the scope has only ${m} facilities`],
  xOnlyEmpty:[g=>`${g}: لا توجد جهة مسموحة لهذه القاعدة`, g=>`${g}: no facility is allowed by this rule`],
  xCapVsMin:[(a,b)=>`«${a}» يتعارض مع «${b}» لأن الحد الأقصى أقل من الحد الأدنى`, (a,b)=>`"${a}" conflicts with "${b}": the maximum is below the minimum`],
  xRigidSeats:[(a,b)=>`${a} و${b} ثنائي صارم لكن لا توجد جهة بمقاعد تكفيهما`, (a,b)=>`${a} and ${b} are a rigid pair but no facility has seats for both`],
  xRigidDays:[(a,b)=>`${a} و${b} ثنائي صارم لكن لا يتوافقان في يوم واحد`, (a,b)=>`${a} and ${b} are a rigid pair but never share an available day`],
  xEveryDayVolume:[(n,d)=>`زيارة في كل يوم مؤهل تحتاج ${d} زيارة والحجم ${n}`, (n,d)=>`A visit on every eligible day needs ${d} visits but the volume is ${n}`],
  xEveryDayWeekCap:[(n,c,w)=>`أسبوع ${D(w)}: ${n} يوم مؤهل والحد الأسبوعي ${c}`, (n,c,w)=>`Week of ${D(w)}: ${n} eligible days but the weekly cap is ${c}`],
  xEveryDayCap:[d=>`${D(d)}: حد اليوم لا يسمح بزيارة`, d=>`${D(d)}: the day cap leaves no room for a visit`],
  xEveryDayRest:[()=>`قاعدة الراحة تمنع العمل في أيام مؤهلة متتالية`, ()=>`The rest rule prevents working on consecutive eligible days`],
  xEveryDayRun:[(src,m,w)=>`حد الأيام المتتالية ${m} أقل من ${w} يوم مؤهل متتالية`, (src,m,w)=>`The consecutive-day limit ${m} is below ${w} consecutive eligible days`],
  xEveryDayStaff:[d=>`${D(d)}: لا يوجد من يكفي للعمل في هذا اليوم`, d=>`${D(d)}: not enough people can work on this day`]
});

defs({
  statusInfeasible:[n=>`لا توجد خطة صالحة بهذه القواعد — ${n} مخالفة إلزامية في المسودة`, n=>`No valid plan exists under these rules — ${n} hard violation(s) in the draft`],
  statusExhausted:[n=>`توقف البحث قبل إيجاد خطة صالحة — ${n} مخالفة إلزامية، والإمكانية غير مؤكدة`, n=>`Search stopped before finding a valid plan — ${n} hard violation(s); feasibility unknown`],
  statusInvalid:[n=>`الخطة بها ${n} مخالفة إلزامية`, n=>`The plan has ${n} hard violation(s)`],
  statusInfeasibleHint:['تعارضات مثبتة بين القواعد أدناه. عدّل القواعد ثم أعد التوليد.','Proven conflicts between the rules below. Adjust the rules and regenerate.'],
  statusExhaustedHint:['لم يثبت التعارض ولم تُوجد خطة ضمن حدود وقت البحث. جرّب تخفيف قاعدة أو أعد التوليد.','No conflict was proven and no plan was found within the search limits. Relax a rule or regenerate.'],
  statusInvalidHint:['لا يمكن اعتماد الخطة قبل إصلاح المخالفات الإلزامية.','The plan cannot be approved until the hard violations are fixed.'],
  toastInfeasible:['لا توجد خطة صالحة — راجع التعارضات','No valid plan exists — see the conflicts'], toastExhausted:['لم تُوجد خطة صالحة ضمن حدود البحث','No valid plan found within the search limits'], toastInvalid:['المسودة بها مخالفات إلزامية','The draft has hard violations'],
  moreN:[n=>`و${n} أخرى`, n=>`+${n} more`],
  editBreaksTitle:['هذا التعديل يخالف قواعد إلزامية','This edit breaks hard rules'], editApplyAnyway:['طبّق رغم ذلك','Apply anyway'],
  approveBlockedTitle:['لا يمكن اعتماد الخطة','The plan cannot be approved']
});

defs({
  qTitle:['الكميات','Quantities'], qRequested:['المطلوب (الحجم)','Requested volume'], qScheduled:['المجدول','Scheduled'], qStaffedValid:['مكتمل الفريق وصالح','Fully staffed and valid'],
  qCarried:['مؤجل للدورة القادمة','Carried over'], qEligibleDays:['أيام مؤهلة','Eligible days'], qCoveredDays:['أيام فيها زيارة صالحة','Days with a valid visit'], qUncoveredDays:['أيام مؤهلة بلا زيارة','Eligible days uncovered'],
  qRequiredN:[n=>`مطلوب ${n}`, n=>`required ${n}`], qRequiredRange:[(a,b)=>`مطلوب ${a}–${b}`, (a,b)=>`required ${a}–${b}`], qShareN:[n=>`نصيب عادل ${n}`, n=>`fair share ${n}`]
});

defs({
  gTypePattern:['نمط عمل/راحة','Work/rest pattern'],
  gHintPattern:['راحة دنيا بين أيام العمل، حد للأيام المتتالية، أو دورة عمل وراحة لأشخاص محددين.','A minimum rest between workdays, a limit on consecutive days, or a work/rest cycle for chosen people.'],
  gtPatternT:[(p,l)=>`نمط ${p}: ${l}`, (p,l)=>`Pattern ${p}: ${l}`],
  patRestN:[n=>`راحة ${n} يوم`, n=>`${n} rest day(s)`], patRunN:[n=>`حتى ${n} يوم متتالٍ`, n=>`up to ${n} days in a row`],
  patCycleN:[(a,b)=>`دورة ${a} عمل / ${b} راحة`, (a,b)=>`${a} on / ${b} off cycle`], patNone:['بلا قيود','No limits'],
  patPresetNoRun:['لا أيام متتالية','No consecutive days'], patPresetMaxRun2:['حتى يومين متتاليين','Up to 2 days in a row'], patPresetNone:['بلا قيود','No limits'],
  patMinRest:['أيام الراحة الدنيا بين يومي عمل','Minimum rest days between workdays'], patMaxRun:['أقصى أيام عمل متتالية','Maximum consecutive workdays'],
  patCycle:['دورة عمل وراحة','Work/rest cycle'], patCycleOn:['أيام العمل','Work days'], patCycleOff:['أيام الراحة','Rest days'], patCycleFrom:['تبدأ في','Anchored at'], patNoLimit:['بلا','None'],
  prTitle:['قواعد العمل والراحة','Work/rest rules'], prInherit:['افتراضي الفريق','Team default'], prCustom:['مخصص','Custom'], prNone:['بلا قيود','No limits'],
  prHint:['تُطبَّق على أيام عمل هذا الشخص داخل الخطة. «بلا قيود» يلغي القاعدة العامة له.','Applies to this person\'s workdays inside the plan. "No limits" overrides the global rule for them.'],
  prPreview:[(a,b)=>`متاح ${a} يوم · مُسند ${b}`, (a,b)=>`${a} eligible days · ${b} assigned`]
});

defs({
  gp_exceeded:['تجاوز','Exceeded'], gAtLeastRepeat:['يُحتسب تكرار الجهة','Count repeat visits to the same facility'],
  goalSnapshotHint:['نتائج وقت التوليد (القواعد تغيّرت منذ ذلك الحين)','Results at generation time (rules changed since)'], goalCurrentTitle:['حسب القواعد الحالية','Under the current rules']
});

defs({
  rRest:['العمل والراحة','Work and rest'], rRestHint:['قواعد راحة وأيام متتالية ودورات عمل — عامة للخطة أو افتراضية لكل شخص.','Rest, consecutive-day and work-cycle rules — for the whole plan, or as a default for each person.'],
  rrActivity:['نمط أيام الخطة (للخطة كلها)','Plan activity pattern (whole plan)'], rrActivityHint:['يُطبَّق على الأيام التي فيها أي زيارة، بصرف النظر عن الأشخاص.','Applies to days with any visit, regardless of who goes.'],
  rrPerson:['القاعدة الافتراضية لكل شخص','Default rule for each person'], rrPersonHint:['يُطبَّق على كل شخص إلا من له قاعدة مخصصة أو «بلا قيود».','Applies to each person unless they have a custom or "No limits" rule.'],
  spStrict:['التباعد','Spacing is'], spStrictHint:['إلزامي يمنع الخطة المخالفة، والمفضّل يُحتسب كتفضيل فقط.','Must rejects plans that break it; Try only counts as a preference.'],
  requireEvery:['زيارة في كل يوم مؤهل','Require a visit on every eligible plan day'], requireEveryHint:['إذا فُعّل صار كل يوم عمل مؤهل في الخطة يحتاج زيارة مكتملة الفريق. افتراضيًا مُعطّل.','When on, every eligible workday in the plan needs a fully staffed visit. Off by default.']
});
defs({gAddFor_pattern:['نمط عمل/راحة','Work/rest pattern']});

const RULE_TEXT = {
  'day.cap':['حد الزيارات في اليوم','Weekday max visits','زيارة زائدة','1 visit over','لا يتجاوز العدد الحد في هذا اليوم أبدًا','The day never goes over its maximum'],
  'day.min':['حد أدنى للزيارات في اليوم','Weekday min visits','زيارة ناقصة','1 visit short','يصل اليوم إلى الحد الأدنى دائمًا','The day always reaches its minimum'],
  'day.kind':['نوع الجهات في اليوم','Weekday kind lean','زيارة من النوع الآخر','1 visit of the other kind','كل زيارات اليوم (أو واحدة على الأقل) من النوع المحدد','All visits that day (or at least one) are of the chosen kind'],
  'day.band':['بُعد الجهات في اليوم','Weekday distance lean','زيارة في النطاق الآخر','1 visit in the other band','كل زيارات اليوم (أو واحدة على الأقل) في النطاق المحدد','All visits that day (or at least one) are in the chosen band'],
  'day.category':['فئات مفضلة في اليوم','Weekday favoured categories','زيارة خارج الفئات','1 visit outside the categories','كل زيارات اليوم (أو واحدة على الأقل) من الفئات المحددة','All visits that day (or at least one) are in the chosen categories'],
  'day.only':['فئات مسموحة في اليوم','Weekday allowed categories','زيارة خارج المسموح','1 visit outside','لا توجد زيارة خارج الفئات المسموحة','No visit falls outside the allowed categories'],
  'fac.weekdays':['أيام زيارة الجهة','Facility weekdays','زيارة في يوم آخر','1 visit on another weekday','لا تُزار الجهة إلا في أيامها','The facility is only visited on its weekdays'],
  'vol.week':['حد الزيارات في الأسبوع','Max visits per week','زيارة زائدة','1 visit over','لا يتجاوز الأسبوع الحد أبدًا','No week goes over the cap'],
  'vol.everyDay':['زيارة في كل يوم متاح','A visit every eligible day','يوم فارغ','1 empty day','لا يبقى يوم متاح بلا زيارة','No eligible day stays empty'],
  'vol.exact':['أعداد محددة للأساسية والمتعاقدة','Exact basic/contracted counts','زيارة عن الهدف','1 visit off target','تطابق الأعداد المحددة تمامًا','Counts match the targets exactly'],
  'vol.share':['نسبة الأساسية','Basic share','زيارة عن الحصة','1 visit off the share','تطابق الحصة بعد التقريب تمامًا','The share matches after rounding exactly'],
  'vol.quota':['حصص الفئات','Category quotas','زيارة ناقصة أو زائدة','1 visit short or over','تتطابق حصة كل فئة تمامًا','Every category quota is met exactly'],
  'vol.gap':['الفاصل بين أيام النشاط','Gap between active days','زوج أيام متقاربة','1 pair too close','لا يوجد زوج أيام أقرب من الفاصل','No pair of active days is closer than the gap'],
  'vol.activity':['نمط النشاط في الخطة','Plan activity pattern','مخالفة','1 breach','لا يخالف الخطة نمط النشاط','The plan never breaks the activity pattern'],
  'fac.pinned':['جهة مثبّتة','Pinned facility','جهة مثبّتة غائبة','1 pinned facility missing','تُدرج كل جهة مثبّتة','Every pinned facility is included'],
  'dist.pick':['اختيار الجهات حسب البُعد','Pick facilities by distance','زيارة في النطاق المعاكس','1 visit in the opposite band','لا زيارة في النطاق المعاكس','No visit in the opposite band'],
  'p.blocked':['جهات ممنوعة على الفرد','Person blocked facilities','تكليف ممنوع','1 assignment','لا يُكلَّف الفرد بجهة ممنوعة عليه','The person is never assigned to a blocked facility'],
  'p.avail':['توفر الفرد','Person availability','تكليف في يوم غير متاح','1 assignment on an off day','لا تكليف خارج نمط التوفر','No assignment outside the availability pattern'],
  'p.maxRun':['أقصى أيام متتالية','Person max run','مخالفة','1 breach','لا يتجاوز الفرد الحد','The person never goes over the limit'],
  'p.maxWeek':['أقصى زيارات أسبوعيًا','Person max per week','مخالفة','1 breach','لا يتجاوز الفرد الحد','The person never goes over the limit'],
  'p.rest':['راحة الفرد بين الزيارات','Person rest pattern','مخالفة','1 breach','لا يُخالف الفرد نمط الراحة','The person never breaks the rest pattern'],
  'p.quota':['عدد زيارات الفرد في الخطة','Person visits per plan','زيارة خارج المدى','1 visit outside the range','يقع عدد الزيارات داخل المدى','The visit count stays inside the range'],
  'p.dist':['تفضيل بُعد الفرد','Person distance preference','تكليف في النطاق المعاكس','1 assignment in the opposite band','لا تكليف في النطاق المعاكس','No assignment in the opposite band'],
  'fair.load':['عدالة التوزيع','Fairness by share','انحراف عن المتوقع','Σ max(0, |load − expected| − 0.5)','يقع حِمل كل فرد ضمن ±1 من المتوقع','Every person stays within ±1 of the expected load'],
  'gender.rule':['قاعدة الجنس في الفريق','Team gender rule','فريق غير مطابق','1 invalid team','كل فريق ضمن النطاق مطابق','Every in-scope team is valid'],
  'gender.pref.m':['تفضيل الذكور','Male preference','عدم تطابق','1 mismatch per dimension','لا يوجد عدم تطابق','No mismatch'],
  'gender.pref.f':['تفضيل الإناث','Female preference','عدم تطابق','1 mismatch per dimension','لا يوجد عدم تطابق','No mismatch'],
  'senior':['الأقدمية','Seniority','فريق بلا عضو مؤهل','1 team with no qualified member','في كل فريق عضو مؤهل متى أمكن','Every team has a qualified member when attainable'],
  'pair':['قاعدة الثنائيات','Pair rule','زيارة تخالف القاعدة','1 visit breaking it','لا زيارة تخالف القاعدة','No visit breaks the rule'],
  'rotate':['تدوير الأفراد','People rotation','تكرار على الجهة','Prefer: prior visits to the facility; Must: each assignment over N','لا يزيد عدد مرات التكرار على الحد','Repeats on a facility never exceed the limit'],
  'dist.short':['رحلات قصيرة من المقر','Short trips','رحلة بعيدة','1 far-band trip','لا رحلات في النطاق البعيد','No far-band trips'],
  'dist.balanceFar':['توازن الرحلات البعيدة','Balance far trips','فرق في الرحلات البعيدة','Σ max(0, far − minFar − 1)','لا يزيد الفرق على 1','The spread stays within 1'],
  'goal.cover':['هدف التغطية','Cover goal','زيارة ناقصة','1 missing visit','يتحقق الهدف','The goal is met'],
  'goal.atLeast':['هدف حد أدنى','At-least goal','زيارة ناقصة','1 missing visit','يتحقق الهدف','The goal is met'],
  'goal.atMost':['هدف حد أقصى','At-most goal','زيارة زائدة','1 extra visit','يتحقق الهدف','The goal is met'],
  'goal.maxGap':['هدف أقصى فاصل','Max-gap goal','جهة متأخرة','1 late facility','يتحقق الهدف','The goal is met'],
  'goal.person':['هدف فرد','Person goal','زيارة مخالفة','1 offending visit','يتحقق الهدف','The goal is met'],
  'goal.together':['هدف معًا','Together goal','زيارات دون النسبة','Visits below the % target','يتحقق الهدف','The goal is met'],
  'goal.special':['زيارة خاصة','Special visit','زيارة غائبة','1 missing visit','تتحقق الزيارة','The visit happens'],
  'goal.pattern':['نمط فرد','Person pattern goal','مخالفة','1 breach','يتحقق النمط','The pattern holds'],
  'due.priority':['أولوية المتأخرة','Overdue priority','مكافأة','Reward by overdue percentile','هذه القاعدة تفضيل فقط لأنها ترتيب نسبي لا شرط يمكن إثباته','This is a ranking objective, not a condition that can hold or fail'],
  'skill.match':['تطابق المهارة','Skill match','فرق مهارة','Skill gap','هذه القاعدة تفضيل فقط لأنها درجة تطابق وليست شرطًا','This is a degree of fit, not a condition that can hold or fail'],
  'space.shape':['شكل التوزيع الزمني','Spacing shape','انحراف','Deviation from the shape','هذه القاعدة تفضيل فقط لأنها شكل مفضّل وليست شرطًا','This is a preferred shape, not a condition that can hold or fail'],
  'p.spread':['تباعد أيام الفرد','Consecutive-day spread','أيام متتالية','Consecutive days','هذه القاعدة تفضيل فقط لأنها درجة تباعد وليست شرطًا','This is a degree of spread, not a condition that can hold or fail']
};
for(const id in RULE_TEXT){
  const r = RULE_TEXT[id];
  I18N.ar['rn_'+id] = r[0]; I18N.en['rn_'+id] = r[1];
  I18N.ar['ru_'+id] = r[2]; I18N.en['ru_'+id] = r[3];
  I18N.ar['rm_'+id] = r[4]; I18N.en['rm_'+id] = r[5];
}
defs2({
  rs_calendar:['التقويم يحدد أيام العمل والإجازات','The calendar defines workdays and holidays'],
  rs_daysOff:['الإجازات وأيام الغياب','Days off and leave'],
  rs_retired:['الأفراد المتقاعدون أو غير النشطين','Retired or inactive people'],
  rs_onePlace:['مكان واحد للفرد في اليوم','One place per person per day'],
  rs_facilityOnce:['الجهة مرة واحدة في اليوم','The same facility at most once per day'],
  rs_seats:['المقاعد من المجموعة الصحيحة ولا مقعد شاغر','Seats come from the right pool and none is left open'],
  rs_perDay:['سعة اليوم العامة','The global per-day capacity'],
  rs_fixedVisit:['تاريخ الزيارة الثابتة وجهتها','A fixed visit date and facility'],
  lvMust:['إلزامي','Must'], lvPrefer:['مُفضّل','Prefer'], lvWeight:['الأهمية','Weight'], lvPriority:['الأولوية عند التعذّر','Priority if impossible'],
  lvLight:['خفيف','Light'], lvNormal:['متوسط','Normal'], lvStrong:['قوي','Strong'], lvAlways:['ثابت','Always'],
  lvMustMeans:['الإلزامي يعني','Must means'], lvPreferOnlyTip:['هذه القاعدة تفضيل فقط','This rule is prefer-only'], lvStructuralTip:['قاعدة ثابتة لا تُغيَّر','A fixed rule that cannot be changed'],
  lvChipLabel:['مستوى القاعدة','Rule level']
});

defs2({
  dMinDay:[(d,n,m)=>`${fmtDate(d,'short')}: ${n} من ${m} زيارة`, (d,n,m)=>`${fmtDate(d,'short')}: ${n} of ${m} visits`],
  dDayKind:[(d,k,u)=>`${fmtDate(d,'short')}: ${u} خارج النوع (${k})`, (d,k,u)=>`${fmtDate(d,'short')}: ${u} outside the kind (${k})`],
  dDayBand:[(d,k,u)=>`${fmtDate(d,'short')}: ${u} خارج النطاق (${k})`, (d,k,u)=>`${fmtDate(d,'short')}: ${u} outside the band (${k})`],
  dDayCategory:[(d,k,u)=>`${fmtDate(d,'short')}: ${u} خارج الفئات (${k})`, (d,k,u)=>`${fmtDate(d,'short')}: ${u} outside the categories (${k})`],
  dExactOff:[(nb,tb,nc,tc)=>`أساسية ${nb}/${tb} · متعاقدة ${nc}/${tc}`, (nb,tb,nc,tc)=>`Basic ${nb}/${tb} · Contracted ${nc}/${tc}`],
  dShareOff:[(n,w)=>`أساسية ${n} والمطلوب ${w}`, (n,w)=>`Basic ${n}, wanted ${w}`],
  dQuotaOff:[u=>`${u} زيارة عن حصص الفئات`, u=>`${u} visits off the category quotas`],
  dPinnedMissing:[n=>`${n} مثبّتة وغير مُدرجة`, n=>`${n} is pinned but not included`],
  dDistPick:[(f,d)=>`${f} · ${fmtDate(d,'short')}: في النطاق المعاكس`, (f,d)=>`${f} · ${fmtDate(d,'short')}: in the opposite band`],
  dPersonDist:[(p,f)=>`${p} ← ${f}: يخالف تفضيل البُعد`, (p,f)=>`${p} → ${f}: against the distance preference`],
  dGenderPref:[(p,f)=>`${p} ← ${f}: يخالف التفضيل`, (p,f)=>`${p} → ${f}: against the preference`],
  dFairLoad:[(pl,u)=>`انحراف العدالة ${u}`, (pl,u)=>`Fairness deviation ${u}`],
  dRotate:[(p,f)=>`${p} زار ${f} من قبل`, (p,f)=>`${p} has visited ${f} before`],
  dShortTrip:[(p,f)=>`${p} ← ${f}: رحلة بعيدة`, (p,f)=>`${p} → ${f}: a far trip`],
  dBalanceFar:[(pl,u)=>`فرق الرحلات البعيدة ${u}`, (pl,u)=>`Far-trip spread ${u}`],
  cPrefs:['التفضيلات','Preferences']
});

defs2({
  xDayKindCapacity:[(k,n,c)=>`العدد المحدد للنوع ${k} هو ${n} لكن الأيام المسموحة لا تتسع إلا لـ ${c} بسبب قاعدة نوع اليوم`, (k,n,c)=>`The exact ${k} count is ${n} but the days that still allow it hold only ${c}, because of the day kind rule`],
  xExactOverFacilities:[(k,n,c)=>`العدد المحدد للنوع ${k} هو ${n} وعدد الجهات المتاحة ${c}`, (k,n,c)=>`The exact ${k} count is ${n} but only ${c} facilities exist`],
  xDayRuleNone:[(d,r)=>`${d}: قاعدة «${r}» إلزامية ولا توجد زيارة ممكنة تحققها`, (d,r)=>`${d}: the Must rule "${r}" cannot be met by any possible visit`]
});

defs2({lvHowAll:['كل زيارات اليوم','Every visit that day'], lvHowOne:['زيارة واحدة على الأقل','At least one visit'], lvHowMany:['ينطبق على','Applies to'], rn_structural:['قواعد ثابتة','Fixed rules'], rn_dueNote:['أولوية الجهات المتأخرة','Prioritise overdue facilities']});

defs2({dSpread:[(p,u)=>`${p}: ${u} أيام متتالية`, (p,u)=>`${p}: ${u} consecutive days`], rn_spreadHint:['توزيع أيام الأفراد بلا تتابع','Spread each person across non-consecutive days']});

defs2({
  ptSearch:['بحث عن فرد','Search people'], ptShowRetired:['عرض المتقاعدين','Show retired'], ptColumns:['الأعمدة','Columns'],
  ptgBasic:['الأساسي','Basics'], ptgSkills:['المهارة','Skills'], ptgPlan:['الحِمل','Load'], ptgAvail:['التوفر والغياب','Availability and leave'], ptgRules:['الممنوعات والقواعد','Blocked and rules'], ptgLimits:['الحدود والتفضيلات','Limits and preferences'],
  ptName:['الاسم','Name'], ptPool:['المجموعة','Pool'], ptGender:['الجنس','Gender'], ptActive:['نشط','Active'], ptSkillB:['مهارة أساسية','Basic skill'], ptSkillC:['مهارة متعاقدة','Contracted skill'],
  ptPerPlan:['في الخطة','Per plan'], ptShare:['النسبة','Share'], ptMaxRun:['أقصى متتالية','Max run'], ptMaxWeek:['أقصى/أسبوع','Max/week'], ptDist:['البُعد','Distance'],
  ptAvail:['التوفر','Availability'], ptOff:['الغياب','Days off'], ptBlocked:['الممنوع','Blocked'], ptRules:['القواعد','Rules'], ptLoad:['الحِمل','Load'],
  ptSeats:[(b,c)=>`${b} أساسية · ${c} متعاقدة`, (b,c)=>`${b} basic · ${c} contracted`],
  ptDetails:['فتح التفاصيل','Open details'], ptDuplicate:['تكرار','Duplicate'], ptPrev:['السابق','Previous'], ptNext:['التالي','Next'], ptClosePanel:['إغلاق اللوحة','Close panel'],
  ptSelected:[n=>`${n} محدد`, n=>`${n} selected`], ptUndo:['تراجع','Undo'], ptBulkDone:[n=>`تم تعديل ${n}`, n=>`Edited ${n}`],
  ptSetPool:['المجموعة','Set pool'], ptSetGender:['الجنس','Set gender'], ptSetSkill:['المهارة','Set skill'], ptSetPerPlan:['في الخطة','Set per plan'], ptSetShare:['النسبة','Set share'], ptSetMaxRun:['أقصى متتالية','Set max run'], ptSetMaxWeek:['أقصى/أسبوع','Set max/week'], ptSetDist:['البُعد','Set distance'], ptSetLevel:['مستوى قاعدة','Set level'], ptAddOff:['إضافة غياب','Add days off'], ptAddBlocked:['إضافة ممنوع','Add blocked'], ptApply:['تطبيق','Apply'],
  ptFrom:['من','From'], ptTo:['إلى','To'], ptNoLimit:['بلا حد','No limit'], ptNoMatch:['لا نتائج','No matches'], ptCopySuffix:[' (نسخة)',' (copy)'], ptActiveOn:['نشط','Active'], ptActiveOff:['غير نشط','Inactive']
});

defs2({
  gFilter_all:['الكل','All'], gFilter_fac:['الجهات','Facility'], gFilter_people:['الأفراد','People'], gFilter_must:['إلزامي','Must'], gFilter_prefer:['مُفضّل','Prefer'], gFilter_off:['متوقف','Off'], gFilter_failing:['غير محقق','Failing'],
  gMoveUp:['لأعلى','Move up'], gMoveDown:['لأسفل','Move down'], gDeleted:['حُذف الهدف','Goal deleted'],
  gfTimes:['المرات','Times'], gfN:['العدد','Count'], gfDays:['الأيام','Days'], gfPct:['النسبة','Percent']
});

defs2({
  wNotProbed:['لم يُفحص ضمن الميزانية الزمنية','Not probed within the time budget'],
  wNoFix:['لا يوجد تغيير واحد يعالج هذا البند','No single change fixes this item'],
  wFixFree:['يمكن معالجته بتغيير واحد دون كسر قاعدة أخرى','A single change fixes it without breaking another rule'],
  wBreaks:[r=>`معالجته تكسر: ${r}`, r=>`Fixing it would break: ${r}`],
  wWhyTitle:['لماذا لم يتحقق','Why this is unmet'], rcTitle:['مساهمة القواعد','Rule contributions'], rcUnits:['وحدات','units'], rcWeight:['الأهمية','weight'], rcScore:['الدرجة','score'], rcDue:['أولوية المتأخرة','Overdue priority']
});
