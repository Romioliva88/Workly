(function () {
  'use strict';
  // Clave pública de configuración web del proyecto Firebase Workly.
  // No es una contraseña ni una clave de administrador.
  const API_KEY = 'AIzaSyAw-jJa95giiQDtjMd-9dku1Cznky-KAPk';
  const STORAGE_KEY = 'workly_firebase_session_v2';
  const PROJECT_ID = 'workly-439fb';
  let idToken = null;
  let currentUid = null;
  let tokenExpiresAt = 0;
  const screens = ['welcome', 'login', 'register', 'home', 'workspace'];
  const el = id => document.getElementById(id);
  const show = name => screens.forEach(id => el(id).classList.toggle('hidden', id !== name));
  const msg = (id, value) => { el(id).textContent = value; };
  const errors = {
    EMAIL_EXISTS: 'Este correo ya está registrado. Prueba iniciar sesión.',
    EMAIL_NOT_FOUND: 'No se encontró una cuenta con ese correo.',
    INVALID_PASSWORD: 'Contraseña incorrecta.',
    INVALID_LOGIN_CREDENTIALS: 'Correo o contraseña incorrectos.',
    INVALID_EMAIL: 'Ingresa un correo válido.',
    WEAK_PASSWORD: 'La contraseña es demasiado débil (mínimo 6 caracteres).',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Demasiados intentos. Espera unos minutos.',
    USER_DISABLED: 'Esta cuenta está deshabilitada.',
    OPERATION_NOT_ALLOWED: 'Activa Correo electrónico/contraseña en Firebase Authentication.',
    NETWORK_REQUEST_FAILED: 'No hay conexión. Revisa tu internet.'
  };
  const friendly = e => errors[e.message] || 'No se pudo completar la operación. ' + (e.message || 'Revisa tu conexión.');
  async function post(url, data) {
    let response;
    try { response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
    catch (_) { throw new Error('NETWORK_REQUEST_FAILED'); }
    let result = {};
    try { result = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(result.error?.message || 'REQUEST_FAILED');
    return result;
  }
  // Secure Token REST exige datos de formulario, no JSON.
  async function refreshFirebaseToken(refreshToken) {
    let response;
    try {
      response = await fetch('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(API_KEY), {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({grant_type:'refresh_token',refresh_token}).toString()
      });
    } catch (_) { throw new Error('NETWORK_REQUEST_FAILED'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || 'TOKEN_REFRESH_FAILED');
    return result;
  }
  const auth = (method, body) => post('https://identitytoolkit.googleapis.com/v1/accounts:' + method + '?key=' + encodeURIComponent(API_KEY), body);
  function saveSession(result) {
    // Solo se almacena el token de renovación y correo, nunca la contraseña.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ refreshToken: result.refreshToken, email: result.email, expiresAt: Date.now() + Number(result.expiresIn || 3600) * 1000 }));
    idToken = result.idToken; currentUid = result.localId; tokenExpiresAt = Date.now() + Number(result.expiresIn || 3600) * 1000;
    if (el('userEmail')) el('userEmail').textContent = result.email || '';
    navigate('home');
  }
  async function restoreSession() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { return; }
    if (!saved?.refreshToken) return;
    try {
      const result = await refreshFirebaseToken(saved.refreshToken);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ refreshToken: result.refresh_token, email: saved.email, expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000 }));
      idToken = result.id_token; currentUid = result.user_id; tokenExpiresAt = Date.now() + Number(result.expires_in || 3600) * 1000;
      if (el('userEmail')) el('userEmail').textContent = saved.email || '';
      navigate('home');
    } catch (e) {
      // Sin internet se conserva el token para intentar recuperar la sesión después.
      if (e.message !== 'NETWORK_REQUEST_FAILED') localStorage.removeItem(STORAGE_KEY);
    }
  }
  el('startButton').addEventListener('click', () => show('login'));
  el('backButton').addEventListener('click', () => { msg('loginMessage', ''); show('welcome'); });
  el('registerButton').addEventListener('click', () => { msg('loginMessage', ''); show('register'); });
  el('registerBackButton').addEventListener('click', () => { msg('registerMessage', ''); show('login'); });
  el('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const button = e.currentTarget.querySelector('button[type=submit]');
    button.disabled = true; msg('loginMessage', 'Iniciando sesión...');
    try { const r = await auth('signInWithPassword', { email: el('email').value.trim(), password: el('password').value, returnSecureToken: true }); el('password').value = ''; saveSession(r); msg('loginMessage', ''); }
    catch (err) { msg('loginMessage', friendly(err)); }
    finally { button.disabled = false; }
  });
  el('registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (el('registerPassword').value !== el('confirmPassword').value) { msg('registerMessage', 'Las contraseñas no coinciden.'); return; }
    const button = e.currentTarget.querySelector('button[type=submit]');
    button.disabled = true; msg('registerMessage', 'Creando cuenta...');
    try { const r = await auth('signUp', { email: el('registerEmail').value.trim(), password: el('registerPassword').value, returnSecureToken: true }); el('registerPassword').value = ''; el('confirmPassword').value = ''; saveSession(r); msg('registerMessage', ''); }
    catch (err) { msg('registerMessage', friendly(err)); }
    finally { button.disabled = false; }
  });
  el('forgotButton').addEventListener('click', async () => {
    const email = el('email').value.trim();
    if (!email) { msg('loginMessage', 'Escribe primero tu correo electrónico y luego pulsa «Olvidé mi contraseña».'); return; }
    msg('loginMessage', 'Solicitando recuperación...');
    try { await auth('sendOobCode', { requestType: 'PASSWORD_RESET', email }); msg('loginMessage', 'Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar tu contraseña.'); }
    catch (err) { msg('loginMessage', friendly(err)); }
  });
  const modules = {
    messages: ['Mensajes', 'Comunicación entre integrantes del equipo', '☏'],
    meetings: ['Reuniones', 'Organiza encuentros y coordina tu agenda', '▦'],
    documents: ['Documentos', 'Consulta y comparte archivos del equipo', '▤'],
    email: ['Correo', 'Comunicación corporativa desde Workly', '✉'],
    sensors: ['Sensores ambientales', 'Temperatura, humedad y luminosidad', '◉'],
    analytics: ['Análisis', 'Indicadores del uso y del ambiente laboral', '▥'],
    profile: ['Mi perfil', 'Información de tu cuenta Workly', '♙']
  };
  const DB = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';
  function field(value) { if (typeof value === 'number') return {doubleValue:value}; if (typeof value === 'boolean') return {booleanValue:value}; return {stringValue:String(value ?? '')}; }
  function unfield(v) { return v?.stringValue ?? (v?.doubleValue === undefined ? (v?.booleanValue ?? '') : Number(v.doubleValue)); }
  function decode(doc) { const o = {id:doc.name.split('/').pop()}; for (const [k,v] of Object.entries(doc.fields || {})) o[k] = unfield(v); return o; }
  async function ensureToken(force=false) {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved?.refreshToken) throw Error('Tu sesión no está activa. Inicia sesión nuevamente.');
    if (!force && idToken && Date.now() < tokenExpiresAt - 60000) return idToken;
    try {
      const fresh = await refreshFirebaseToken(saved.refreshToken);
      idToken=fresh.id_token; currentUid=fresh.user_id;
      tokenExpiresAt=Date.now()+Number(fresh.expires_in||3600)*1000;
      localStorage.setItem(STORAGE_KEY,JSON.stringify({refreshToken:fresh.refresh_token||saved.refreshToken,email:saved.email,expiresAt:tokenExpiresAt}));
      return idToken;
    } catch(e) { throw Error('No se pudo renovar la sesión: '+(e.message||'Error desconocido')+'. Cierra sesión e ingresa de nuevo si persiste.'); }
  }
  async function db(path,method='GET',values) {
    const body=values?JSON.stringify({fields:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,field(v)]))}):undefined;
    async function request(force=false) {
      const token=await ensureToken(force);
      try {return await fetch(DB+'/'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body}:{})});}
      catch(e){throw Error('No hay conexión con Firestore. Revisa internet.');}
    }
    let res=await request();
    if(res.status===401)res=await request(true);
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw Error('Firestore ('+res.status+'): '+(data.error?.message||'Error desconocido'));
    return data;
  }
  function make(tag, text, cls) {const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n;}
  function action(label, fn) {const b=make('button',label,'primary');b.type='button';b.addEventListener('click',fn);return b;}
  function status(container) {const p=make('p','','note');container.append(p);return t=>{p.textContent=t};}
  function formField(form,label,type='text',required=true) {const l=make('label',label);const input=document.createElement('input');input.type=type;input.required=required;input.placeholder=label;form.append(l,input);return input;}
  function formSubmit(form,label,handler) {
    const b=action(label,async()=>{
      // Los módulos usan contenedores div; validar sus campos directamente.
      for (const input of form.querySelectorAll('input, textarea, select')) {
        if (!input.reportValidity()) return;
      }
      b.disabled=true;
      try { await handler(); }
      catch (e) { window.alert('No se pudo completar la operación: '+(e.message||e)); }
      finally { b.disabled=false; }
    });
    form.append(b);
  }
  function localKey(name) {return 'workly_v4_'+name+'_'+currentUid;}
  function localGet(name) {try{return JSON.parse(localStorage.getItem(localKey(name))||'[]')}catch(_){return []}}
  function localPut(name,data){localStorage.setItem(localKey(name),JSON.stringify(data))}
  async function messagesUI(c) {
    c.append(make('p','Sala general del equipo: los mensajes son visibles para todos los usuarios registrados. No envíes información confidencial.','note'));
    const list=make('div'); list.className='v46-chat'; c.append(list);
    const form=make('div');const input=formField(form,'Escribe un mensaje');input.maxLength=1000;const closeForm=collapsibleForm(c,'Nuevo mensaje',form);
    const say=status(c);
    async function load(){list.replaceChildren();say('Cargando mensajes...');try{const r=await db('mensajes?pageSize=100');const items=(r.documents||[]).map(decode).sort((a,b)=>a.fecha.localeCompare(b.fecha));for(const m of items){const box=make('div',undefined,'v46-bubble'+(m.uid===currentUid?' mine':''));box.append(make('strong',m.uid===currentUid?'Tú':(m.autor||'Usuario')),make('p',m.texto||''),make('small',new Date(m.fecha).toLocaleString('es-CL')));list.append(box)}say(items.length?'Mensajes actualizados.':'Todavía no hay mensajes.')}catch(e){say(e.message)}}
    formSubmit(form,'Enviar mensaje',async()=>{const texto=input.value.trim();if(!texto)return;say('Enviando...');try{await db('mensajes','POST',{texto,autor:el('userEmail').textContent,uid:currentUid,fecha:new Date().toISOString()});input.value='';closeForm();await load()}catch(e){say(e.message)}});
    c.append(action('Actualizar mensajes',load));await load();
  }
  function collapsibleForm(c, label, form) {
    const toggle=action('+ '+label,()=>{
      const open=form.hidden;
      form.hidden=!open;
      toggle.textContent=open?'Cancelar':' + '+label;
      if(open)form.querySelector('input, textarea')?.focus();
    });
    toggle.classList.add('workly-add-button');
    form.hidden=true;
    c.append(toggle,form);
    return ()=>{form.hidden=true;toggle.textContent='+ '+label};
  }
  async function meetingsUI(c){
    c.append(make('p','Agenda compartida: las reuniones son visibles para todos los usuarios registrados.','note'));
    const form=make('div');const title=formField(form,'Nombre de la reunión');const date=formField(form,'Fecha y hora','datetime-local');const detail=formField(form,'Lugar o enlace', 'text',false);const closeForm=collapsibleForm(c,'Nueva reunión',form);const say=status(c);const list=make('div');c.append(list);
    async function load(){list.replaceChildren();say('Cargando reuniones...');try{const r=await db('reuniones?pageSize=100');const items=(r.documents||[]).map(decode).sort((a,b)=>a.fecha.localeCompare(b.fecha));for(const m of items){const box=make('div',undefined,'workly-entry');const details=make('div');details.hidden=true;
      const expand=action('Ver detalles',()=>{details.hidden=!details.hidden;expand.textContent=details.hidden?'Ver detalles':'Ocultar detalles'});
      box.append(make('strong',m.titulo),make('p',new Date(m.fecha).toLocaleString('es-CL')),expand);
      details.append(make('p','Lugar o enlace: '+(m.detalle||'No especificado')));
      if(m.uid===currentUid)details.append(action('Cancelar reunión',async()=>{if(!window.confirm('¿Cancelar esta reunión?'))return;try{await db('reuniones/'+encodeURIComponent(m.id),'DELETE');await load()}catch(e){say(e.message)}}));
      box.append(details);list.append(box)}say(items.length?'Agenda actualizada.':'No hay reuniones programadas.')}catch(e){say(e.message)}}
    formSubmit(form,'Crear reunión',async()=>{try{await db('reuniones','POST',{titulo:title.value.trim(),fecha:new Date(date.value).toISOString(),detalle:detail.value.trim(),uid:currentUid,autor:el('userEmail').textContent});title.value='';date.value='';detail.value='';closeForm();await load()}catch(e){say(e.message)}});c.append(action('Actualizar agenda',load));await load();
  }
  function documentsUI(c){c.append(make('p','Notas y documentos de texto guardados únicamente en este dispositivo y esta cuenta. Todavía no se comparten en la nube.','note'));const form=make('div');const title=formField(form,'Título del documento');const body=make('textarea');body.placeholder='Contenido del documento';body.rows=5;form.append(body);const closeForm=collapsibleForm(c,'Nuevo documento',form);const list=make('div');c.append(list);function load(){list.replaceChildren();for(const d of localGet('docs')){const box=make('div',undefined,'workly-entry');box.append(make('strong',d.titulo),make('p',d.contenido));box.append(action('Eliminar',()=>{localPut('docs',localGet('docs').filter(x=>x.id!==d.id));load()}));list.append(box)}}formSubmit(form,'Guardar documento',async()=>{if(!body.value.trim())return;const docs=localGet('docs');docs.push({id:Date.now(),titulo:title.value,contenido:body.value});localPut('docs',docs);title.value='';body.value='';closeForm();load();window.alert('Documento guardado en este dispositivo.')});load()}
  function emailUI(c){c.append(make('p','Abre tu aplicación de correo para enviar el mensaje. Workly aún no tiene un servidor de correo corporativo integrado.','note'));const form=make('div');const to=formField(form,'Correo destinatario','email');const subject=formField(form,'Asunto');const body=make('textarea');body.placeholder='Escribe el mensaje';body.rows=5;form.append(body);c.append(form);formSubmit(form,'Abrir correo para enviar',async()=>{location.href='mailto:'+encodeURIComponent(to.value)+'?subject='+encodeURIComponent(subject.value)+'&body='+encodeURIComponent(body.value)})}
  // Workly v4.7: interfaces renovadas sin cambiar las claves ni el almacenamiento.
  function metricCard(icon,label,value,unit,accent){
    const card=make('div',undefined,'v47-metric');card.style.setProperty('--metric-accent',accent);
    const top=make('div',undefined,'v47-metric-head');top.append(make('span',icon,'v47-metric-icon'),make('span',label,'v47-metric-label'));card.append(top);
    const reading=make('div',undefined,'v47-metric-reading');reading.append(make('strong',String(value)),make('span',unit));card.append(reading);return {card,reading};
  }
  function sensorsUI(c){
    c.classList.add('v47-module');
    const hero=make('section',undefined,'v47-sensor-hero');hero.append(make('div','WORKLY  /  SMART BUILDING','v47-kicker'),make('h2','Control ambiental'),make('p','Monitor de condiciones del espacio · información demostrativa','v47-muted'));
    const mode=make('div',undefined,'v47-status');mode.append(make('span','●','v47-status-dot'),make('span','MODO SIMULACIÓN · Sin medición física'));hero.append(mode);c.append(hero);
    const history=localGet('sensores');const last=history.length?history[history.length-1]:null;
    const dial=make('section',undefined,'v47-main-dial');dial.append(make('div','TEMPERATURA','v47-dial-label'));const ring=make('div',undefined,'v47-ring');const ringInside=make('div',undefined,'v47-ring-inside');const tValue=make('strong',last?String(last.temperatura):'23');ringInside.append(tValue,make('span','°C'),make('small','VALOR SIMULADO'));ring.append(ringInside);dial.append(ring);dial.append(make('p','Última simulación guardada en este dispositivo','v47-muted'));c.append(dial);
    const pair=make('div',undefined,'v47-pair');const humidity=metricCard('◌','HUMEDAD',last?last.humedad:55,'%','#76d5e5');const light=metricCard('✧','LUMINOSIDAD',last?last.luz:450,'lux','#e8b975');pair.append(humidity.card,light.card);c.append(pair);
    const control=make('section',undefined,'v47-panel');control.append(make('div','AJUSTAR AMBIENTE','v47-kicker'));const toggle=action('＋ Nueva simulación',()=>{form.hidden=!form.hidden;toggle.textContent=form.hidden?'＋ Nueva simulación':'− Cerrar simulación'});toggle.classList.add('v47-copper-btn');control.append(toggle);
    const form=make('div',undefined,'v47-slider-form');form.hidden=true;const inputs=[];for(const [label,unit,min,max,initial] of [['Temperatura','°C',0,45,23],['Humedad','%',0,100,55],['Luminosidad','lux',0,1500,450]]){
      const line=make('label',undefined,'v47-slider-line');const title=make('div',undefined,'v47-slider-title');title.append(make('span',label),make('strong',initial+' '+unit));const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.value=initial;input.addEventListener('input',()=>{title.querySelector('strong').textContent=input.value+' '+unit;alertText.textContent=alerts()});line.append(title,input);form.append(line);inputs.push(input);
    }
    const alertText=make('p','','v47-muted');function alerts(){const [t,h,l]=inputs.map(x=>+x.value);return [t>30?'Temperatura alta':null,h>70?'Humedad alta':null,l<150?'Luminosidad baja':null].filter(Boolean).join(' · ')||'Parámetros simulados dentro de los umbrales de demostración.'}alertText.textContent=alerts();form.append(alertText);
    const save=action('Guardar simulación',()=>{const values=inputs.map(x=>+x.value);const records=localGet('sensores');records.push({fecha:new Date().toISOString(),temperatura:values[0],humedad:values[1],luz:values[2],origen:'simulado'});localPut('sensores',records);tValue.textContent=String(values[0]);humidity.reading.querySelector('strong').textContent=String(values[1]);light.reading.querySelector('strong').textContent=String(values[2]);form.hidden=true;toggle.textContent='＋ Nueva simulación';renderHistory();});save.classList.add('v47-copper-btn');form.append(save);control.append(form);c.append(control);
    const records=make('section',undefined,'v47-panel');c.append(records);function renderHistory(){records.replaceChildren();const items=localGet('sensores');records.append(make('div','HISTORIAL · '+items.length+' REGISTROS','v47-kicker'));if(!items.length)records.append(make('p','Aún no hay simulaciones guardadas.','v47-muted'));for(const item of items.slice(-5).reverse()){const entry=make('div',undefined,'v47-history');entry.append(make('span',new Date(item.fecha).toLocaleString('es-CL')),make('strong',item.temperatura+' °C · '+item.humedad+' % · '+item.luz+' lux'));records.append(entry)}}renderHistory();
    const real=make('section',undefined,'v47-panel');real.append(make('div','SENSORES REALES','v47-kicker'));const realStatus=make('p','Comprobando luminosidad real…','v47-muted');real.append(realStatus,make('p','Temperatura y humedad reales requieren un sensor externo conectado. Las simulaciones nunca se presentan como lecturas reales.','v47-muted'));c.append(real);
    if('AmbientLightSensor' in window){try{const sensor=new window.AmbientLightSensor({frequency:1});sensor.addEventListener('reading',()=>{if(realStatus.isConnected)realStatus.textContent='Luminosidad real: '+sensor.illuminance+' lux · '+new Date().toLocaleTimeString('es-CL')});sensor.addEventListener('error',()=>{realStatus.textContent='Sensor de luz real no disponible o sin permiso.'});sensor.start()}catch(_){realStatus.textContent='Sensor de luz real no disponible o sin permiso.'}}else realStatus.textContent='Luminosidad real no disponible en esta WebView.';
  }
  function analyticsUI(c){
    c.classList.add('v47-module');const data=localGet('sensores');const hero=make('section',undefined,'v47-analytics-hero');hero.append(make('div','WORKLY  /  INTELLIGENCE','v47-kicker'),make('h2','Orbit Analytics'),make('p','Resumen de las simulaciones ambientales almacenadas en este teléfono.','v47-muted'));c.append(hero);
    const summary=make('section',undefined,'v47-orbit');const orbit=make('div',undefined,'v47-orbit-ring');const center=make('div',undefined,'v47-orbit-center');center.append(make('small','REGISTROS'),make('strong',String(data.length)),make('span','SIMULADOS'));orbit.append(center);summary.append(orbit);c.append(summary);
    const kpis=make('div',undefined,'v47-analytics-grid');const metrics=[['temperatura','TEMPERATURA','°C','#a58aff'],['humedad','HUMEDAD','%','#63dfeb'],['luz','LUMINOSIDAD','lux','#ffac89']];for(const [key,label,unit,color] of metrics){const avg=data.length?data.reduce((sum,item)=>sum+Number(item[key]||0),0)/data.length:null;const metric=metricCard('◈',label,avg===null?'—':avg.toFixed(1),unit,color);metric.card.append(make('small','PROMEDIO SIMULADO','v47-mini'));kpis.append(metric.card)}c.append(kpis);
    const graph=make('section',undefined,'v47-panel');graph.append(make('div','EVOLUCIÓN · TEMPERATURA SIMULADA','v47-kicker'));if(!data.length){graph.append(make('p','Registra una simulación en Sensores para visualizar la evolución.','v47-muted'))}else{
      const samples=data.slice(-8);const bars=make('div',undefined,'v47-bars');for(const [index,item] of samples.entries()){const barWrap=make('div',undefined,'v47-bar-wrap');const bar=make('div',undefined,'v47-bar');bar.style.height=Math.max(8,Math.min(100,Number(item.temperatura)/45*100))+'%';bar.setAttribute('aria-label','Registro '+(index+1)+': '+item.temperatura+' °C');barWrap.append(bar,make('small',String(index+1)));bars.append(barWrap)}graph.append(bars);graph.append(make('p','Últimos '+samples.length+' registros · escala 0–45 °C','v47-muted'))
    }c.append(graph);
    const footer=make('div','DATOS SIMULADOS · ALMACENAMIENTO LOCAL · NO SON MÉTRICAS DE PRODUCTIVIDAD REAL','v47-disclaimer');c.append(footer);
  }
  function navigate(page) {
    document.querySelectorAll('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    if(page==='home'){show('home');return}
    const module=modules[page];if(!module)return;
    el('moduleTitle').textContent=module[0];el('moduleDescription').textContent=module[1];el('moduleIcon').textContent=module[2];
    const c=el('moduleContent');c.replaceChildren();show('workspace');
    if(page==='profile'){c.append(make('p','Cuenta: '+(el('userEmail').textContent||'')));c.append(action('Cerrar sesión',()=>{localStorage.removeItem(STORAGE_KEY);idToken=null;currentUid=null;el('loginForm').reset();show('login')}));}
    else if(page==='messages')messagesUI(c);
    else if(page==='meetings')meetingsUI(c);
    else if(page==='documents')documentsUI(c);
    else if(page==='email')emailUI(c);
    else if(page==='sensors')sensorsUI(c);
    else if(page==='analytics')analyticsUI(c);
  }
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.page)));
  el('returnHome').addEventListener('click', () => navigate('home'));
  restoreSession();
})();
