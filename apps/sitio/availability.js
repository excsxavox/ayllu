/* AYLLU: disponibilidad del sitio. Puede usar la agenda real de la API (mismos
 * places/unitCount del móvil) o un inventario local de respaldo.
 */
var AylluAvailability = (() => {
  const DAY = 86400000;
  const META = {
    glamping: { subtitle: 'Una estancia en la naturaleza', type: 'stay', perUnit: 2, unit: 'glamping', plural: 'glampings', times: ['15:00'], maxGuests: 8, note: 'Entrada 15:00 y salida 11:00. Cupos según la agenda de AYLLU.' },
    acampar: { subtitle: 'Campamento junto al lago', type: 'stay', perUnit: 2, unit: 'espacio', plural: 'espacios', times: ['15:00'], maxGuests: 12, note: 'Cupos según la agenda de AYLLU. Implementos por confirmar.' },
    restaurante: { subtitle: 'Una mesa para compartir', type: 'slot', perUnit: 1, unit: 'mesa', plural: 'mesas', times: ['09:00','11:00','13:00','15:00'], maxGuests: 12, note: 'Mesas según la agenda de AYLLU. Carta y precios por confirmar.' },
    pesca: { subtitle: 'Disfruta la laguna a tu ritmo', type: 'slot', perUnit: 1, unit: 'plaza', plural: 'plazas', times: ['09:00','11:00','14:00'], maxGuests: 12, note: 'Cupos según la agenda de AYLLU.' },
    botes: { subtitle: 'Otra forma de descubrir el paisaje', type: 'slot', perUnit: 3, unit: 'bote', plural: 'botes', times: ['10:00','11:00','12:00','14:00','15:00'], maxGuests: 12, note: 'Botes según la agenda de AYLLU.' },
    senderismo: { subtitle: 'Un recorrido al aire libre', type: 'slot', perUnit: 1, unit: 'plaza', plural: 'plazas', times: ['09:00','12:00'], maxGuests: 10, note: 'Cupos según la agenda de AYLLU.' }
  };
  const SERVICES = {
    glamping: { name: 'Glamping', units: 4, ...META.glamping },
    restaurante: { name: 'Restaurante AYLLU', units: 8, ...META.restaurante },
    pesca: { name: 'Pesca en el lago', units: 12, ...META.pesca },
    botes: { name: 'Botes a remo', units: 4, ...META.botes },
    senderismo: { name: 'Senderismo', units: 10, ...META.senderismo }
  };
  let liveAgenda = null;
  const CABANA_PLACES = new Set(['glamping', 'acampar']);
  function applyAgenda(agenda) {
    liveAgenda = agenda || null;
    if (agenda?.places?.length) {
      agenda.places = agenda.places.filter((place) => CABANA_PLACES.has(place.id));
    }
    if (!agenda?.places?.length) return SERVICES;
    const keep = new Set(agenda.places.map((place) => place.id));
    Object.keys(SERVICES).forEach((id) => { if (!keep.has(id)) delete SERVICES[id]; });
    agenda.places.forEach((place) => {
      const meta = META[place.id] || {
        subtitle: place.name,
        type: place.trackGuests ? 'stay' : 'slot',
        perUnit: place.trackGuests ? 2 : 1,
        unit: 'unidad',
        plural: 'unidades',
        times: place.trackGuests ? ['15:00'] : ['10:00', '12:00', '14:00'],
        maxGuests: Math.max(place.unitCount * (place.trackGuests ? 2 : 1), 8),
        note: 'Cupos según la agenda de AYLLU.',
      };
      SERVICES[place.id] = {
        name: place.name,
        units: place.unitCount,
        ...meta,
        maxGuests: Math.max(meta.maxGuests || 8, place.unitCount * (meta.perUnit || 1)),
      };
    });
    return SERVICES;
  }
  function isClosedDay(day) {
    if (liveAgenda?.days?.[day]) {
      const cells = Object.values(liveAgenda.days[day]);
      if (cells.some((c) => c && c.closed === true)) return true;
    }
    return Array.isArray(liveAgenda?.closedDates) && liveAgenda.closedDates.includes(day);
  }
  function liveUnits(service, day) {
    if (isClosedDay(day)) return [];
    const free = liveAgenda?.days?.[day]?.[service]?.free;
    if (typeof free !== 'number') return null;
    return Array.from({ length: Math.max(0, free) }, (_, i) => `${service}-${i + 1}`);
  }
  function localDay(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now);
    const get = t => parts.find(p => p.type === t).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0,10) === value;
  }
  function addDays(day, n) { return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0,10); }
  function tx(key, fallback, vars) {
    const raw = window.AylluI18n?.t?.(key, vars);
    if (raw && raw !== key) return raw;
    let s = fallback;
    if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replaceAll(`{${k}}`, String(v)); });
    return s;
  }
  function dateLabel(day, full = false) {
    const loc = window.AylluI18n?.locale?.() || 'es-EC';
    return new Intl.DateTimeFormat(loc, { timeZone:'UTC', ...(full ? {weekday:'long', day:'numeric', month:'long'} : {day:'numeric', month:'short', year:'numeric'}) }).format(new Date(`${day}T12:00:00Z`));
  }
  function hash(text) { let h=0; for(const c of text) h=(Math.imul(h,31)+c.charCodeAt(0))>>>0; return h; }
  function baseUnits(service, day, time) {
    const live = liveUnits(service, day);
    if (live) return live;
    const s=SERVICES[service];
    if(!s) return [];
    // Respaldo local solo si la API no respondió.
    if(hash(`${service}:${day}`)%13 === 0) return [];
    return Array.from({length:s.units}, (_,i)=>`${service}-${i+1}`).filter(id => hash(`${day}:${time}:${id}`)%7 >= 2);
  }
  function createEngine({now=()=>new Date(), inventory=baseUnits}={}) {
    const used = new Map();
    let sequence=0;
    const bounds = () => {
      const min = localDay(now());
      const horizon = Math.max(1, Math.min(180, liveAgenda?.horizonDays || 14));
      return { min, max: addDays(min, horizon - 1) };
    };
    function validate(q) {
      const s=SERVICES[q.service];
      if(!s) return tx('av.pick', 'Selecciona una experiencia.');
      const b=bounds();
      if(!validDate(q.date)) return tx('av.date', 'Elige una fecha válida.');
      if(q.date<b.min) return tx('av.fromToday', 'Selecciona una fecha de hoy en adelante.');
      if(q.date>b.max) return tx('av.horizon', 'Puedes consultar los próximos días disponibles en la agenda.');
      if(!Number.isInteger(q.guests)||q.guests<1||q.guests>s.maxGuests) return tx('av.guests', `Puedes consultar entre 1 y ${s.maxGuests} personas para ${s.name}.`, {max:s.maxGuests,name:s.name});
      if(s.type==='stay') {
        if(!Number.isInteger(q.nights)||q.nights<1||q.nights>7) return tx('av.nights', 'Elige entre 1 y 7 noches.');
        if(addDays(q.date,q.nights-1)>b.max) return tx('av.stayOver', 'La estancia supera las fechas disponibles en la agenda.');
        const nights=Array.from({length:q.nights},(_,i)=>addDays(q.date,i));
        if(nights.some(isClosedDay)) return tx('av.closed', 'Hay días cerrados a visitas en esas fechas. Elige otras.');
      } else if(isClosedDay(q.date)) {
        return tx('av.closed', 'Ese día está cerrado a visitas.');
      }
      return '';
    }
    function nightsOf(q) { return Array.from({length:SERVICES[q.service].type==='stay'?q.nights:1},(_,i)=>addDays(q.date,i)); }
    const key=(service,day,time)=>`${service}|${day}|${time}`;
    function pastTime(day, time) {
      const stamp=now();
      if(day!==localDay(stamp)) return false;
      // Ecuador continental siempre usa UTC-5; no cambia por horario de verano.
      return Date.parse(`${day}T${time}:00-05:00`) <= stamp.getTime();
    }
    function available(q,time) {
      if(pastTime(q.date,time)) return [];
      const lists=nightsOf(q).map(day=>inventory(q.service,day,time).filter(id=>!used.get(key(q.service,day,time))?.has(id)));
      // La MISMA unidad debe quedar libre durante TODAS las noches.
      return lists[0].filter(id=>lists.every(list=>list.includes(id)));
    }
    function query(q) {
      const error=validate(q);
      if(error) return {error,slots:[],status:'invalid',available:0};
      const s=SERVICES[q.service],required=Math.ceil(q.guests/s.perUnit);
      const slots=s.times.map(time=>{const units=available(q,time); return {time,units:units.length,required,available:units.length>=required,past:pastTime(q.date,time)};});
      const best=Math.max(0,...slots.map(slot=>slot.units));
      return {error:'',slots,required,available:best,status:best<required?'full':best-required<=1?'limited':'available'};
    }
    function reserve(q,time) {
      const found=query(q), slot=found.slots.find(s=>s.time===time);
      if(found.error) return {ok:false,error:found.error};
      if(!slot?.available) return {ok:false,error:tx('av.gone','La opción ya no tiene cupo para tu grupo. Elige otra fecha u horario.')};
      const ids=available(q,time).slice(0,found.required);
      nightsOf(q).forEach(day=>{const k=key(q.service,day,time);if(!used.has(k))used.set(k,new Set());ids.forEach(id=>used.get(k).add(id));});
      sequence++;
      return {ok:true,ref:`AYLLU-${String(sequence).padStart(4,'0')}`,query:{...q},time,units:ids.length,departure:SERVICES[q.service].type==='stay'?addDays(q.date,q.nights):null};
    }
    function alternatives(q,limit=3) {
      const results=[],b=bounds();let start=validDate(q.date)&&q.date>=b.min?q.date:b.min;
      const span = Math.max(1, (Date.parse(`${b.max}T00:00:00Z`) - Date.parse(`${b.min}T00:00:00Z`)) / DAY);
      for(let offset=1;offset<=span&&results.length<limit;offset++) {
        const date=addDays(start,offset);if(date>b.max) break;
        const r=query({...q,date}); if(!r.error&&r.slots.some(s=>s.available))results.push({date,...r});
      }
      return results;
    }
    return {query,reserve,validate,bounds,alternatives,live:()=>Boolean(liveAgenda)};
  }
  return {SERVICES,createEngine,applyAgenda,addDays,dateLabel,validDate,localDay};
})();
if (typeof window !== "undefined") window.AylluAvailability = AylluAvailability;
if(typeof module !== 'undefined' && module.exports) module.exports=AylluAvailability;
