
document.documentElement.classList.add('js');

/* ============ data ============ */
/* ============ stars ============ */
(function(){
  var pattern=[1,0,2,0,0,1,0,2,0,1,0,0,2,1,0,0,2,1,1]; // 1=active 2=lost 0=stood down
  var s=document.getElementById('stars');
  if(s) s.innerHTML=pattern.map(function(p){
    return '<i class="'+(p===1?'act':p===2?'lost':'')+'">\u2605</i>'}).join('');
})();

/* ============ launch countdown (set date to activate) ============ */
/* Release countdown: fill in date (YYYY-MM-DD) + preorder URLs to activate.
   Release is set for November 2026; exact day pending. Leave blank to keep hidden. */
var LAUNCH={"date":"","amazon":"","apple":""};
function renderLaunch(){
  var slot=document.getElementById('launchSlot'); if(!slot)return;
  if(!LAUNCH.date){slot.innerHTML='';return}
  var d=Math.max(0,Math.ceil((new Date(LAUNCH.date+'T00:00:00')-new Date())/864e5));
  slot.innerHTML='<div class="tile" style="margin-bottom:34px"><div class="t-lab"><span class="dot"></span> Launch window confirmed</div>'
   +'<h3>'+(d>0?d+' days':'Out now')+'</h3><p>'+(d>0?'Releases '+LAUNCH.date+'. Reserve your copy now.':'Available at all major retailers.')+'</p>'
   +'<div class="buys" style="margin-top:22px">'
   +(LAUNCH.amazon?'<a class="p" href="'+LAUNCH.amazon+'" target="_blank" rel="noopener">'+(d>0?'Preorder':'Buy')+' \u2014 Amazon</a>':'')
   +(LAUNCH.apple?'<a href="'+LAUNCH.apple+'" target="_blank" rel="noopener">Apple Books</a>':'')+'</div></div>';
}

/* Keep links from the previous hash-based site working. */
(function(){
  if(!location.hash.startsWith('#/'))return;
  var old=location.hash.slice(2).replace(/\/$/,'');
  var route=old.split('/')[0];
  var routes={home:'/',series:'/series/',book:'/books/', 'hidden-dragons':'/hidden-dragons/',excerpt:'/sample-chapter/',appearances:'/appearances/',newsletter:'/newsletter/',about:'/about/',media:'/press/',contact:'/contact/'};
  var target=routes[route]||'/';
  if(route==='book')target=/^sd-0[1-8]$/.test(old.split('/')[1]||'')?'/books/'+old.split('/')[1]+'/':'/series/';
  if(route==='excerpt'&&old.split('/')[1]==='chapter-one')target+='#chapter-one';
  location.replace(target);
})();

/* ============ reader-controlled promotional trailers ============ */
document.querySelectorAll('[data-play-trailer]').forEach(function(button){
  var video=document.getElementById(button.getAttribute('data-play-trailer'));
  button.addEventListener('click',function(){
    var promise=video.play();
    if(promise)promise.catch(function(){button.hidden=false;});
  });
  video.addEventListener('play',function(){button.hidden=true;});
  video.addEventListener('pause',function(){button.hidden=false;});
  video.addEventListener('ended',function(){button.hidden=false;});
});

/* ============ accessible mobile menu ============ */
var navEl=document.getElementById('nav');
var links=document.getElementById('links'),burger=document.getElementById('burger');
var menuBackground=Array.from(document.querySelectorAll('main,footer,.statusbar,.cipher,.skip-link'));
function closeMenu(returnFocus){
  var wasOpen=links.classList.contains('open');
  links.classList.remove('open');navEl.classList.remove('menu-open');document.body.classList.remove('menu-locked');
  links.removeAttribute('role');links.removeAttribute('aria-modal');links.removeAttribute('aria-label');
  burger.setAttribute('aria-expanded','false');burger.setAttribute('aria-label','Open menu');
  menuBackground.forEach(function(el){el.inert=false});
  if(returnFocus&&wasOpen)burger.focus();
}
function openMenu(){
  links.classList.add('open');navEl.classList.add('menu-open');document.body.classList.add('menu-locked');
  links.setAttribute('role','dialog');links.setAttribute('aria-modal','true');links.setAttribute('aria-label','Navigation menu');
  burger.setAttribute('aria-expanded','true');burger.setAttribute('aria-label','Close menu');
  menuBackground.forEach(function(el){el.inert=true});
  document.getElementById('closer').focus();
}
burger.addEventListener('click',function(){links.classList.contains('open')?closeMenu(true):openMenu()});
document.getElementById('closer').addEventListener('click',function(){closeMenu(true)});
document.addEventListener('keydown',function(e){
  if(!links.classList.contains('open'))return;
  if(e.key==='Escape'){e.preventDefault();closeMenu(true);return}
  if(e.key!=='Tab')return;
  var items=Array.from(links.querySelectorAll('a,button')).filter(function(el){return el.getClientRects().length});
  var first=items[0],last=items[items.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
});
window.matchMedia('(min-width:901px)').addEventListener('change',function(e){if(e.matches)closeMenu(false)});
window.addEventListener('pageshow',function(){closeMenu(false)});

/* ============ accurately reported contact / subscription requests ============ */
document.querySelectorAll('form[data-form]').forEach(function(form){
  var msg=document.getElementById(form.getAttribute('data-msg'));
  form.querySelectorAll('input,textarea').forEach(function(field){
    if(field.name==='bot-field')return;
    field.setAttribute('aria-describedby',msg.id);
    field.addEventListener('input',function(){field.removeAttribute('aria-invalid')});
  });
  form.addEventListener('submit',async function(e){
    e.preventDefault();
    var email=form.querySelector('input[type="email"]'), message=form.querySelector('textarea');
    var button=form.querySelector('button[type="submit"]');
    if(button.disabled)return;
    function invalid(field,text){msg.textContent=text;field.setAttribute('aria-invalid','true');field.focus()}
    if(!email.validity.valid||!email.value.trim()){invalid(email,'Enter a valid email address.');return}
    if(message&&!message.value.trim()){invalid(message,'Add a message before sending.');return}
    var name=form.querySelector('input[name="name"]');
    if(name&&new TextEncoder().encode(name.value).length>120){invalid(name,'Please shorten your name or use an initial.');return}
    if(message&&new TextEncoder().encode(message.value).length>8000){invalid(message,'Please shorten your message or send it directly by email.');return}
    button.disabled=true;form.setAttribute('aria-busy','true');msg.textContent='Sending your request…';
    var controller=new AbortController();var timeout=setTimeout(function(){controller.abort()},15000);
    try{
      var response=await fetch(form.action,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams(new FormData(form)).toString(),signal:controller.signal});
      var data=await response.json().catch(function(){return null});
      if(!data)throw new Error('The form is temporarily unavailable.');
      if(!response.ok||data.ok!==true){var failure=new Error(data.message||'Your request could not be sent.');failure.readerMessage=true;throw failure}
      msg.textContent=data.message;form.reset();
    }catch(error){
      var explanation=error.name==='AbortError'?'The request timed out.':error.readerMessage?error.message:'The form is temporarily unavailable.';
      msg.textContent=explanation+(explanation.indexOf('wayne@falbeygroup.com')<0?' You can email wayne@falbeygroup.com directly.':'');
    }finally{clearTimeout(timeout);button.disabled=false;form.removeAttribute('aria-busy')}
  });
});

/* ============ file tap + cipher ============ */
document.addEventListener('click',function(e){
  var f=e.target.closest&&e.target.closest('.file');
  if(f&&!(e.target.closest('a'))) f.classList.toggle('open');
});
var cip=document.getElementById('cipher');
cip.addEventListener('click',function(){
  var on=cip.classList.toggle('dec');
  cip.setAttribute('aria-pressed',on?'true':'false');
  cip.setAttribute('aria-label',on?'Decoded transmission: The ninth file is coming. Hidden Dragons, Sleeping Dogs. Activate to encrypt.':'Encrypted transmission. Activate to decrypt.');
  var c=document.getElementById('cipherCta'); if(c)c.textContent=on?'Encrypt':'Decrypt';
});

/* ============ spotlight ============ */
document.addEventListener('mousemove',function(e){
  var t=e.target.closest&&e.target.closest('.spot');
  if(!t)return;
  var r=t.getBoundingClientRect();
  t.style.setProperty('--mx',(e.clientX-r.left)+'px');
  t.style.setProperty('--my',(e.clientY-r.top)+'px');
});

/* ============ reveal / counters / meters ============ */
var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(el){
  if(el.dataset.done)return; el.dataset.done='1';
  var target=parseInt(el.getAttribute('data-count'),10);
  if(reduced){el.textContent=target;return}
  var t0=null,dur=1500;
  function step(t){
    if(!t0)t0=t;
    var p=Math.min((t-t0)/dur,1);
    el.textContent=Math.round((1-Math.pow(1-p,3))*target);
    if(p<1)requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
var io=null;
if('IntersectionObserver' in window){
  io=new IntersectionObserver(function(es){
    es.forEach(function(en){
      if(!en.isIntersecting)return;
      var el=en.target;
      el.classList.add('in');
      el.querySelectorAll('[data-count]').forEach(countUp);
      el.querySelectorAll('[data-meter]').forEach(function(m){m.classList.add('go')});
      if(el.id==='mon'){
        var st=document.getElementById('stars');
        if(st){
          st.classList.add('lit');
          [].forEach.call(st.children,function(c,i){c.style.transitionDelay=(i*45)+'ms'});
        }
      }
      io.unobserve(el);
    });
  },{threshold:.12,rootMargin:'0px 0px -6% 0px'});
}
function scan(){
  var root=document.querySelector('.view.on')||document;
  var els=root.querySelectorAll('.rv:not(.in)');
  if(!io){
    els.forEach(function(el){el.classList.add('in')});
    root.querySelectorAll('[data-count]').forEach(function(c){c.textContent=c.getAttribute('data-count')});
    root.querySelectorAll('[data-meter]').forEach(function(m){m.classList.add('go')});
    var st=document.getElementById('stars'); if(st)st.classList.add('lit');
    return;
  }
  els.forEach(function(el,i){el.style.transitionDelay=Math.min(i%3,2)*70+'ms';io.observe(el)});
}

/* ============ scroll fx ============ */
var nav=document.getElementById('nav'),prog=document.getElementById('prog'),hero=document.getElementById('heroImg');
var ticking=false;
function onScroll(){
  if(ticking)return; ticking=true;
  requestAnimationFrame(function(){
    var y=window.scrollY||0;
    nav.classList.toggle('stuck',y>10);
    var h=document.documentElement.scrollHeight-window.innerHeight;
    prog.style.width=(h>0?(y/h)*100:0)+'%';
    if(hero&&!reduced&&y<900) hero.style.transform='translateY('+(y*0.22)+'px)';
    ticking=false;
  });
}
window.addEventListener('scroll',onScroll,{passive:true});

/* ============ boot ============ */
scan();
onScroll();

function focusChapter(){if(location.hash==='#chapter-one'){var chapter=document.getElementById('chapter-one');if(chapter)chapter.focus({preventScroll:true})}}
window.addEventListener('hashchange',focusChapter);focusChapter();
