/* Reserva en la web: arma el pedido y lo continúa por WhatsApp. */
(() => {
  const {SERVICES,createEngine,addDays,dateLabel,validDate}=window.AylluAvailability;
  const root=document.querySelector('#booking-app');
  if(!root) return;
  let engine=createEngine();
  let today=engine.bounds().min;
  const state={step:1,service:'glamping',date:addDays(today,1),guests:2,nights:1,time:null,month:addDays(today,1).slice(0,7),extras:new Set(),name:'',receipt:null,error:'',agendaReady:false};
  const waNumber=()=>String(window.AylluSite?.whatsappGlamping||window.AylluSite?.whatsapp||'15556310030').replace(/\D/g,'');
  const waResto=()=>String(window.AylluSite?.whatsappResto||window.AylluSite?.whatsapp||waNumber()).replace(/\D/g,'');
  function restoWhatsAppUrl(){
    const en=window.AylluI18n?.locale?.()==='en';
    const text=en
      ?'Hi 🌿 I want to reserve a table at AYLLU Restaurant.\n\nCan you help me with availability?'
      :'Hola 🌿 Quiero reservar una mesa en Restaurante AYLLU.\n\n¿Me ayudan con disponibilidad?';
    return `https://wa.me/${waResto()}?text=${encodeURIComponent(text)}`;
  }
  function bindRestoWa(){
    document.querySelectorAll('#resto-wa-cta, #resto-section-wa').forEach((el)=>{
      el.addEventListener('click',(e)=>{
        e.preventDefault();
        window.open(restoWhatsAppUrl(),'_blank','noopener');
      });
    });
  }
  bindRestoWa();
  function whatsAppMessage(){
    const s=SERVICES[state.service],en=window.AylluI18n?.locale?.()==='en';
    const lines=en?[
      'Hi 🌿 I want to book from the website:',
      '',
      `• Experience: ${s.name}`,
      `• Date: ${dateLabel(state.date,true)}`,
      s.type==='stay'?`• Nights: ${state.nights}`:'',
      s.type==='stay'?`• Departure: ${dateLabel(addDays(state.date,state.nights))}`:'',
      `• Guests: ${state.guests}`,
      state.time?`• Time: ${state.time}`:'',
      state.extras.size?`• Also interested in: ${[...state.extras].map(id=>extraLabel(id)).join(', ')}`:'',
      state.name.trim()?`• Name: ${state.name.trim()}`:'',
      '',
      'Can you help me confirm it?',
    ]:[
      'Hola 🌿 Quiero reservar desde la web:',
      '',
      `• Experiencia: ${s.name}`,
      `• Fecha: ${dateLabel(state.date,true)}`,
      s.type==='stay'?`• Noches: ${state.nights}`:'',
      s.type==='stay'?`• Salida: ${dateLabel(addDays(state.date,state.nights))}`:'',
      `• Personas: ${state.guests}`,
      state.time?`• Horario: ${state.time}`:'',
      state.extras.size?`• También me interesa: ${[...state.extras].map(id=>extraLabel(id)).join(', ')}`:'',
      state.name.trim()?`• Nombre: ${state.name.trim()}`:'',
      '',
      '¿Me ayudan a confirmarla?',
    ];
    return lines.filter(Boolean).join('\n');
  }
  function whatsAppUrl(){return `https://wa.me/${waNumber()}?text=${encodeURIComponent(whatsAppMessage())}`;}
  const t=(k,v)=>window.AylluI18n?.t?.(k,v)??k;
  const EXTRA_KEYS=['restaurante','pesca','glamping','acampar','senderismo','botes','juegos','parqueadero'];
  const extraLabel=(id)=>SERVICES[id]?.name||t(`extra.${id}`);
  const extrasFor=()=>EXTRA_KEYS.filter((id)=>id!==state.service && SERVICES[id]);
  const who=(n)=>n===1?t('bk.person1'):t('bk.personN');
  const nightsWord=(n)=>n===1?t('bk.night1'):t('bk.nightN');
  const labels=()=>({available:t('bk.legOk'),limited:t('bk.legLow'),full:t('bk.legFull'),invalid:t('bk.legOut')});
  window.AylluI18n?.applyServices?.();
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const svg={
    glamping:'<path d="m12 3 10 17H2L12 3Zm0 8 5 9H7l5-9Z"/>',
    restaurante:'<path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18M17 3c-3 4-3 8 1 9V3Zm1 9v9"/>',
    pesca:'<path d="M5 20 15 4l5 2v8a3 3 0 0 1-6 0v-2"/>',
    botes:'<path d="M3 13h18l-4 6H7l-4-6Zm2-9 13 12M3 21q3-2 6 0t6 0 6 0"/>',
    senderismo:'<circle cx="13" cy="4" r="2"/><path d="m7 11 4-4 4 3 4 1M11 7l-1 7-4 7m4-7 5 3 1 4m3-10v10"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 11h18"/>',
    check:'<path d="m5 12 4 4L20 5"/>',users:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m1-18a4 4 0 0 1 0 8m1 3a6 6 0 0 1 4 5v2"/>'
  };
  const icon=(id)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg[id]||svg.calendar}</svg>`;
  function q(){return {service:state.service,date:state.date,guests:state.guests,nights:state.nights};}
  function availableSlot(){return engine.query(q()).slots.find(slot=>slot.time===state.time&&slot.available);}
  function announce(text){document.querySelector('#booking-live').textContent=text;}
  function changeTimeDefault(){const found=engine.query(q());if(!found.slots.some(s=>s.time===state.time&&s.available))state.time=null;if(SERVICES[state.service].type==='stay'&&found.slots[0]?.available)state.time=found.slots[0].time;}
  function unitText(n){const s=SERVICES[state.service];return `${n} ${n===1?s.unit:s.plural}`;}
  function summary(){const s=SERVICES[state.service],chosen=availableSlot(),result=engine.query(q());return `<aside class="booking-summary"><p class="booking-overline">${t('bk.yourVisit')}</p><div class="booking-summary-title">${icon(state.service)}<h3>${s.name}</h3></div><dl><div><dt>${s.type==='stay'?t('bk.arrivalDt'):t('bk.dateDt')}</dt><dd>${dateLabel(state.date)}</dd></div>${s.type==='stay'?`<div><dt>${t('bk.outDt')}</dt><dd>${dateLabel(addDays(state.date,state.nights))}</dd></div><div><dt>${t('bk.stayDt')}</dt><dd>${state.nights} ${nightsWord(state.nights)}</dd></div>`:''}<div><dt>${t('bk.guests')}</dt><dd>${state.guests}</dd></div><div><dt>${t('bk.timeDt')}</dt><dd>${state.time||t('bk.pickLater')}${s.type==='stay'&&state.time?` · ${t('bk.checkin')}`:''}</dd></div></dl>${state.step>1?`<div class="booking-summary-status ${chosen?'ok':'pending'}">${chosen?icon('check'):icon('calendar')}<span>${chosen?t('bk.quotaOk'):result.error?t('bk.fixDates'):state.time?t('bk.checkAvail'):t('bk.pickOpt')}<small>${t('bk.simAvail')}</small></span></div>`:''}<div class="booking-pricing"><strong>${t('bk.rate')}</strong><p>${t('bk.noCharge')}</p></div><p class="booking-summary-help">${t('bk.changeHint')}</p><a href="${whatsAppUrl()}" target="_blank" rel="noopener noreferrer">${t('bk.contact')}</a></aside>`;}
  function guestControl(){return `<div class="booking-guests"><div><label for="booking-guests">${t('bk.guests')}</label><span>${t('bk.guestsHint')}</span></div><div class="booking-stepper"><button type="button" data-book="less" aria-label="${t('bk.less')}" ${state.guests<=1?'disabled':''}>−</button><input id="booking-guests" type="number" min="1" max="${SERVICES[state.service].maxGuests}" value="${state.guests}" inputmode="numeric" aria-describedby="booking-guests-note"><button type="button" data-book="more" aria-label="${t('bk.more')}" ${state.guests>=SERVICES[state.service].maxGuests?'disabled':''}>+</button></div></div><p id="booking-guests-note" class="booking-meta">${t('bk.cap',{max:SERVICES[state.service].maxGuests})}</p>`;}
  function experienceStep(){return `<div class="booking-panel-head"><p class="booking-overline">${t('bk.s01')}</p><h3 id="booking-focus" tabindex="-1">${t('bk.q1')}</h3><p>${t('bk.q1p')}</p></div><div class="booking-services" role="group" aria-label="${t('bk.group')}">${Object.entries(SERVICES).map(([id,s])=>`<button id="service-${id}" class="booking-service ${state.service===id?'selected':''}" data-service="${id}" aria-pressed="${state.service===id}"><span class="booking-service-icon">${icon(id)}</span><span><strong>${s.name}</strong><small>${s.subtitle}</small></span><span class="booking-radio" aria-hidden="true"></span></button>`).join('')}</div>${guestControl()}<div class="booking-extra-info"><strong>${t('bk.extraTitle')}</strong><p>${t('bk.extraP')}</p></div><div class="booking-actions"><span>${t('bk.nextHint')}</span><button class="button" data-book="next">${t('bk.next')} <span aria-hidden="true">→</span></button></div>`;}
  function calendar(){const b=engine.bounds(),[year,month]=state.month.split('-').map(Number),first=new Date(Date.UTC(year,month-1,1)),offset=(first.getUTCDay()+6)%7,days=new Date(Date.UTC(year,month,0)).getUTCDate(),monthTitle=new Intl.DateTimeFormat(window.AylluI18n?.locale?.()||'es-EC',{month:'long',year:'numeric',timeZone:'UTC'}).format(first),maxLast=SERVICES[state.service].type==='stay'?addDays(b.max,-state.nights+1):b.max,wd=t('bk.wdShort').split(','),wdFull=[t('bk.wd.mon'),t('bk.wd.tue'),t('bk.wd.wed'),t('bk.wd.thu'),t('bk.wd.fri'),t('bk.wd.sat'),t('bk.wd.sun')],st=labels();
    const stayBit=SERVICES[state.service].type==='stay'?t('bk.andStay',{n:state.nights,nights:nightsWord(state.nights)}):'';
    return `<div class="booking-calendar"><div class="booking-calendar-head"><h4>${monthTitle}</h4><div><button id="booking-prev-month" data-book="prev-month" aria-label="${t('bk.prevMonth')}" ${state.month<=b.min.slice(0,7)?'disabled':''}>‹</button><button id="booking-next-month" data-book="next-month" aria-label="${t('bk.nextMonth')}" ${state.month>=b.max.slice(0,7)?'disabled':''}>›</button></div></div><div class="booking-weekdays">${wd.map((d,i)=>`<span aria-label="${wdFull[i]}">${d}</span>`).join('')}</div><div class="booking-dates">${'<span class="booking-day-empty"></span>'.repeat(offset)}${Array.from({length:days},(_,i)=>{const day=`${state.month}-${String(i+1).padStart(2,'0')}`,disabled=day<b.min||day>maxLast,r=disabled?{status:'invalid'}:engine.query({...q(),date:day});return `<button id="booking-date-${day}" data-date="${day}" class="booking-day ${r.status} ${day===state.date?'selected':''}" ${disabled?'disabled':''} aria-pressed="${day===state.date}" aria-label="${dateLabel(day,true)}. ${st[r.status]}. ${t('bk.exData')}"><span>${i+1}</span><i aria-hidden="true">${disabled?'':r.status==='full'?'—':r.status==='limited'?'!':'✓'}</i></button>`;}).join('')}</div><div class="booking-legend"><span><b class="green">✓</b> ${t('bk.legOk')}</span><span><b class="amber">!</b> ${t('bk.legLow')}</span><span><b class="gray">—</b> ${t('bk.legFull')}</span></div><p class="booking-meta">${t('bk.calMeta',{guests:state.guests,who:who(state.guests),stay:stayBit})}</p></div>`;
  }
  function slots(){const s=SERVICES[state.service],r=engine.query(q());let html=`<div class="booking-options"><div><p class="booking-overline">${dateLabel(state.date,true)}</p><h4>${s.type==='stay'?t('bk.stayAvail'):t('bk.pickTime')}</h4><p class="booking-meta">${t('bk.ecTime')}</p></div>`;
    if(r.error)return html+`<div class="booking-empty"><strong>${t('bk.badDate')}</strong><p>${esc(r.error)}</p></div></div>`;
    if(r.status==='full'){const next=engine.alternatives(q());html+=`<div class="booking-empty"><strong>${t('bk.noGroup')}</strong><p>${t('bk.tryOther')}</p></div>${next.length?`<div class="booking-alternatives"><p>${t('bk.otherDates')}</p>${next.map(d=>`<button data-date="${d.date}">${dateLabel(d.date)} <span>${t('bk.seeSlots')}</span></button>`).join('')}</div>`:''}`;}
    else if(s.type==='stay'){html+=`<button id="booking-stay" class="booking-stay-option ${state.time?'selected':''}" data-time="${s.times[0]}" aria-pressed="${!!state.time}"><span class="booking-option-icon">${icon('glamping')}</span><strong>${t('bk.stayFor',{n:state.guests,who:who(state.guests)})}</strong><span>${unitText(r.required)} · ${state.nights} ${nightsWord(state.nights)}</span><span class="booking-stock ${r.status}">${t('bk.freeStay',{units:unitText(r.available)})}</span><small>${t('bk.checkInOut')}</small>${icon('check')}</button>`;}
    else {html+=`<div class="booking-times" role="group" aria-label="${t('bk.times')}">${r.slots.map(slot=>`<button id="booking-time-${slot.time.replace(':','')}" data-time="${slot.time}" class="booking-time ${state.time===slot.time?'selected':''}" ${slot.available?'':'disabled'} aria-pressed="${state.time===slot.time}" aria-label="${slot.time}. ${slot.available?t('bk.unitsFree',{units:unitText(slot.units)}):slot.past?t('bk.past'):t('bk.noSlot')}"><strong>${slot.time}</strong><span>${slot.past?t('bk.past'):slot.available?unitText(slot.units):t('bk.legFull')}</span></button>`).join('')}</div>`;}
    return html+`<p class="booking-service-note">${s.note}</p></div>`;
  }
  function availabilityStep(){const s=SERVICES[state.service],b=engine.bounds();return `<div class="booking-panel-head"><p class="booking-overline">${t('bk.s02')}</p><h3 id="booking-focus" tabindex="-1">${t('bk.find')}</h3><p>${t('bk.findP')}</p></div><div class="booking-date-controls"><label>${s.type==='stay'?t('bk.arrival'):t('bk.visit')}<input id="booking-arrival" type="date" value="${state.date}" min="${b.min}" max="${s.type==='stay'?addDays(b.max,-state.nights+1):b.max}" required></label>${s.type==='stay'?`<label>${t('bk.nights')}<select id="booking-nights">${Array.from({length:7},(_,i)=>`<option value="${i+1}" ${state.nights===i+1?'selected':''}>${i+1} ${nightsWord(i+1)}</option>`).join('')}</select></label>`:''}<label>${t('bk.guests')}<select id="booking-party">${Array.from({length:s.maxGuests},(_,i)=>`<option value="${i+1}" ${state.guests===i+1?'selected':''}>${i+1} ${who(i+1)}</option>`).join('')}</select></label></div><div class="booking-availability-grid">${calendar()}${slots()}</div><div class="booking-actions"><button class="booking-back" data-book="back">${t('bk.backExp')}</button><button class="button" data-book="review" ${availableSlot()?'':'disabled'}>${t('bk.reviewCta')} <span aria-hidden="true">→</span></button></div>`;}
  function reviewStep(){const s=SERVICES[state.service],slot=availableSlot();return `<div class="booking-panel-head"><p class="booking-overline">${t('bk.s03')}</p><h3 id="booking-focus" tabindex="-1">${t('bk.review')}</h3><p>${t('bk.reviewP')}</p></div><div class="booking-review-main"><span class="booking-review-icon">${icon(state.service)}</span><div><h4>${s.name}</h4><p>${dateLabel(state.date,true)}</p><p>${state.guests} ${who(state.guests)} · ${state.time}${s.type==='stay'?` · ${state.nights} ${nightsWord(state.nights)}`:''}</p><span class="booking-stock available">${slot?t('bk.demoOk'):t('bk.checkAvail')}</span></div></div><label class="booking-name-field">${t('bk.name')}<input id="booking-name" type="text" value="${esc(state.name)}" autocomplete="name" maxlength="80" placeholder="${t('bk.namePh')}" required></label><fieldset class="booking-extras"><legend>${t('bk.moreQ')}</legend><p>${t('bk.moreP')}</p>${extrasFor().map(id=>`<label><input type="checkbox" data-extra="${id}" ${state.extras.has(id)?'checked':''}> ${esc(extraLabel(id))}</label>`).join('')}</fieldset><div class="booking-disclaimer"><strong>${t('bk.warn')}</strong><p>${t('bk.warnP')}</p></div><div class="booking-actions"><button class="booking-back" data-book="back">${t('bk.backDate')}</button><button class="button" data-book="confirm" ${slot?'':'disabled'}>${t('bk.simulate')} ${icon('check')}</button></div>`;}
  function receipt(){const r=state.receipt,s=SERVICES[r.query.service];return `<div class="booking-receipt"><span class="booking-success-icon">${icon('check')}</span><p class="booking-overline">${t('bk.done')}</p><h3 id="booking-focus" tabindex="-1">${t('bk.ready')}</h3><p>${t('bk.notReal')}</p><div class="booking-receipt-details"><strong>${r.ref}</strong><h4>${s.name}</h4><p>${dateLabel(r.query.date)} · ${r.time}<br>${r.query.guests} ${who(r.query.guests)}${r.departure?` · ${t('bk.outDt')} ${dateLabel(r.departure)}`:''}${r.name?`<br>${esc(r.name)}`:''}</p>${r.extras.length?`<p class="booking-meta">${t('bk.also',{list:r.extras.map(id=>extraLabel(id)).map(esc).join(', ')})}</p>`:''}</div><p class="booking-meta">${t('bk.resetHint')}</p><div class="booking-receipt-actions"><a class="button" href="${r.waUrl||whatsAppUrl()}" target="_blank" rel="noopener noreferrer">${t('bk.openWa')}</a><button class="booking-back" data-book="restart">${t('bk.again')}</button></div></div>`;}
  function render(focusId){const steps=[t('bk.step1'),t('bk.step2'),t('bk.step3')];const content=state.receipt?receipt():`<ol class="booking-steps" aria-label="${t('bk.steps')}">${steps.map((name,i)=>`<li class="${state.step===i+1?'current':state.step>i+1?'done':''}" ${state.step===i+1?'aria-current="step"':''}><span>${state.step>i+1?'✓':i+1}</span>${name}</li>`).join('')}</ol><div class="booking-layout"><div class="booking-panel">${state.step===1?experienceStep():state.step===2?availabilityStep():reviewStep()}</div>${summary()}</div>`;root.innerHTML=`<div class="booking-demo-label"><span>${t('bk.demo')}</span><p>${t('bk.demoP')}</p></div>${state.error?`<p class="booking-error" role="alert">${esc(state.error)}</p>`:''}${content}`;if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});}
  function updateSearch(){state.error='';changeTimeDefault();}
  function changeDate(date){if(!validDate(date)){state.error=t('bk.invalidDate');return;}state.date=date;state.month=date.slice(0,7);updateSearch();}
  root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const action=b.dataset.book;let focusId;
    if(b.dataset.service){state.service=b.dataset.service;state.guests=Math.min(state.guests,SERVICES[state.service].maxGuests);state.time=null;state.extras.delete(state.service);focusId=b.id;updateSearch();}
    if(b.dataset.date){changeDate(b.dataset.date);focusId=`booking-date-${state.date}`;announce(t('bk.annDate',{date:dateLabel(state.date,true),status:labels()[engine.query(q()).status]}));}
    if(b.dataset.time){state.time=b.dataset.time;state.error='';focusId=b.id;announce(t('bk.annTime',{time:state.time}));}
    if(action==='less'||action==='more'){state.guests=Math.max(1,Math.min(SERVICES[state.service].maxGuests,state.guests+(action==='more'?1:-1)));updateSearch();focusId='booking-guests';}
    if(action==='next'){state.step=2;updateSearch();focusId='booking-focus';}
    if(action==='review'){if(!availableSlot())return;state.step=3;focusId='booking-focus';}
    if(action==='back'){state.step=Math.max(1,state.step-1);focusId='booking-focus';}
    if(action==='prev-month'||action==='next-month'){const [y,m]=state.month.split('-').map(Number),next=new Date(Date.UTC(y,m-1+(action==='next-month'?1:-1),1));state.month=next.toISOString().slice(0,7);focusId=b.id;}
    if(action==='confirm'){
      if(!state.name.trim()){state.error=t('bk.nameRequired');focusId='booking-name';render(focusId);return;}
      if(!waNumber()){state.error=t('bk.waMissing');focusId='booking-focus';render(focusId);return;}
      const r=engine.reserve(q(),state.time);
      if(!r.ok){state.error=r.error;state.step=2;changeTimeDefault();}
      else{
        const waUrl=whatsAppUrl();
        state.receipt={...r,extras:[...state.extras],name:state.name.trim(),waUrl};
        announce(t('bk.annOk'));
        window.open(waUrl,'_blank','noopener');
      }
      focusId='booking-focus';
    }
    if(action==='restart'){state.receipt=null;state.step=1;state.error='';state.time=null;state.name='';updateSearch();focusId='booking-focus';}
    render(focusId);
  });
  root.addEventListener('input',e=>{if(e.target.id==='booking-name'){state.name=e.target.value;state.error='';}});
  root.addEventListener('change',e=>{const input=e.target;if(input.dataset.extra){if(input.checked)state.extras.add(input.dataset.extra);else state.extras.delete(input.dataset.extra);return;}
    if(input.id==='booking-name'){state.name=input.value;state.error='';return;}
    if(input.id==='booking-guests'||input.id==='booking-party'){const value=Number(input.value),max=SERVICES[state.service].maxGuests;if(!Number.isInteger(value)||value<1||value>max){state.error=t('bk.guestRange',{max});}else{state.guests=value;updateSearch();}}
    if(input.id==='booking-nights'){state.nights=Number(input.value);updateSearch();}
    if(input.id==='booking-arrival')changeDate(input.value);
    render(input.id);
  });
  function openService(service,step=2){if(!SERVICES[service])service=Object.keys(SERVICES)[0]||service;if(!SERVICES[service])return;state.service=service;state.extras.delete(service);state.step=step;state.receipt=null;state.guests=Math.min(state.guests,SERVICES[service].maxGuests);state.time=null;updateSearch();render('booking-focus');document.querySelector('#visita').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  window.addEventListener('ayllu:lang',()=>{window.AylluI18n?.applyServices?.();render();});
  document.querySelector('#glamping-cta')?.addEventListener('click',()=>openService('glamping'));
  document.querySelectorAll('[data-booking-service]').forEach(link=>link.addEventListener('click',()=>openService(link.dataset.bookingService)));
  async function loadAgenda(){
    const api=String(window.AylluSite?.api||'').replace(/\/$/,'');
    const slug=window.AylluSite?.company||'alpha-demo';
    if(!api){state.agendaReady=false;updateSearch();render();return;}
    try{
      const from=window.AylluAvailability.localDay();
      const probe=await fetch(`${api}/public/${encodeURIComponent(slug)}/agenda?from=${from}&to=${from}`);
      if(!probe.ok) throw new Error(`agenda ${probe.status}`);
      const hint=await probe.json();
      const to=addDays(from, Math.max(0, (hint.horizonDays||14)-1));
      const res=await fetch(`${api}/public/${encodeURIComponent(slug)}/agenda?from=${from}&to=${to}`);
      if(!res.ok) throw new Error(`agenda ${res.status}`);
      const agenda=await res.json();
      window.AylluAvailability.applyAgenda(agenda);
      engine=createEngine();
      today=engine.bounds().min;
      if(!SERVICES[state.service]) state.service=Object.keys(SERVICES)[0]||'glamping';
      state.guests=Math.min(state.guests, SERVICES[state.service]?.maxGuests||state.guests);
      if(state.date<today) state.date=addDays(today,1);
      if(state.date>engine.bounds().max) state.date=today;
      state.month=state.date.slice(0,7);
      state.agendaReady=true;
      state.error='';
    }catch(err){
      console.error('No se pudo cargar la agenda', err);
      state.agendaReady=false;
      state.error=t('bk.agendaFail');
    }
    updateSearch();render();
  }
  updateSearch();render();
  loadAgenda();
})();
