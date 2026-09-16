import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(here,'../public');
const release=JSON.parse(fs.readFileSync(path.join(here,'release.json'),'utf8'));
const retailer=JSON.parse(fs.readFileSync(path.join(here,'retailer-links.json'),'utf8'));
let template=fs.readFileSync(path.join(here,'site.html'),'utf8');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
template=template.replace(/maxlength="160"/g,'maxlength="120"')
 .replace('You can also request updates directly by email.','You can also <a href="mailto:wayne@falbeygroup.com">request updates directly by email</a>.')
 .replace('The on-sale date goes to newsletter subscribers first.','Subscribe to the newsletter for the confirmed on-sale date.')
 .replace('the exact on-sale date and final cover reveal go to <a class="inline" href="#/newsletter">newsletter subscribers</a> before they appear anywhere else.','the exact on-sale date and final cover reveal will be shared here and in the <a class="inline" href="#/newsletter">newsletter</a>.');
let script=template.match(/<script>([\s\S]*?)<\/script>/)[1];
const dataStart=script.indexOf('var BOOKS=');
const dataEnd=script.indexOf('/* ============ stars ============ */');
const elements={};
const context=vm.createContext({document:{getElementById(id){return elements[id]??={innerHTML:'',dataset:{}};}}});
vm.runInContext(script.slice(dataStart,dataEnd),context);
for(const book of context.BOOKS)for(const key of ['az','ap','bn','kb','gp'])book[key]=retailer[book.id][key];
context.fill('filesHome',context.BOOKS);context.fill('filesAll',context.BOOKS);context.fillCovers();
for(const id of ['tick','filesHome','filesAll','covGrid']){
 template=template.replace(new RegExp('(<div[^>]*id="'+id+'"[^>]*>)[\\s\\S]*?(</div>)'),(_,a,b)=>a+elements[id].innerHTML+b);
}
script=script.slice(0,dataStart)+script.slice(dataEnd);
script=script.replace("var LAUNCH={date:'',amazon:'',apple:''};",'var LAUNCH='+JSON.stringify({date:release.date,amazon:release.amazon,apple:release.apple})+';');
script=script.replace('scan();\nonScroll();','renderLaunch();\nscan();\nonScroll();');
script=script.replace("if(message&&!message.value.trim()){invalid(message,'Add a message before sending.');return}",`if(message&&!message.value.trim()){invalid(message,'Add a message before sending.');return}
    var name=form.querySelector('input[name="name"]');
    if(name&&new TextEncoder().encode(name.value).length>120){invalid(name,'Please shorten your name or use an initial.');return}
    if(message&&new TextEncoder().encode(message.value).length>8000){invalid(message,'Please shorten your message or send it directly by email.');return}`);
// Native navigation supplies document focus. The explicitly focusable article makes
// both direct chapter URLs and within-page chapter jumps keyboard accessible.
script+=`\nfunction focusChapter(){if(location.hash==='#chapter-one'){var chapter=document.getElementById('chapter-one');if(chapter)chapter.focus({preventScroll:true})}}\nwindow.addEventListener('hashchange',focusChapter);focusChapter();\n`;
const styles=[...template.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]);
let css=styles.find(s=>s.includes(':root{'));
css+='\n@media(min-width:901px){.menu-close{display:none}}\n.file:focus-within .redact{color:var(--text);background:transparent}\n';
// Mobile navigation and content remain available even when JavaScript is disabled.
const nojs='<noscript><style>.view{display:block}.rv{opacity:1!important;transform:none!important}.trailer-play,.burger,.menu-close{display:none!important}@media(max-width:900px){.links{position:static;display:flex;flex-direction:row;flex-wrap:wrap;gap:4px;padding:10px 0;background:none}.links a{font-size:15px;padding:8px}.nav-in{flex-wrap:wrap}}.meter-fill{width:100%}</style></noscript>';
fs.writeFileSync(path.join(out,'assets/site.css'),css);
fs.writeFileSync(path.join(out,'assets/site.js'),script);
const assetVersion=crypto.createHash('sha256').update(css+script).digest('hex').slice(0,10);
const commonHead=template.match(/<link rel="icon"[\s\S]*?(?=<noscript>)/)[0];
const start=template.indexOf('<body>')+6;
const main=template.indexOf('<main id="main"');
const mainEnd=template.indexOf('</main>');
let header=template.slice(start,main);
const footer=template.slice(mainEnd+7,template.indexOf('<script>',mainEnd));
const viewRegion=template.slice(main,mainEnd);
const viewStarts=[...viewRegion.matchAll(/<div class="view" data-route="([^"]+)">/g)];
const views={};
for(let i=0;i<viewStarts.length;i++){
 const match=viewStarts[i];
 views[match[1]]=viewRegion.slice(match.index,viewStarts[i+1]?.index??viewRegion.length).replace(/<!--[^]*?-->/g,'').trim();
}
const routes={home:'/',series:'/series/','hidden-dragons':'/hidden-dragons/',excerpt:'/sample-chapter/',appearances:'/appearances/',newsletter:'/newsletter/',about:'/about/',media:'/press/',contact:'/contact/'};
function paths(html){
 return html.replace(/href="#\/([^\"]*)"/g,(_,route)=>{
  if(route.startsWith('book/'))return 'href="/books/'+route.split('/')[1]+'/"';
  if(route==='excerpt/chapter-one')return 'href="/sample-chapter/#chapter-one"';
  return 'href="'+(routes[route]??'/')+'"';
 }).replace(/\b(src|poster|href)="((?:assets|covers)\/[^\"]+|og-card\.png)"/g,'$1="/$2"')
 .replace(/ onerror="[^"]*"/g,'')
 .replace(/(data-count="(\d+)"[^>]*>)0(?=<)/g,'$1$2');
}
const definitions=[
 ['home','John Wayne Falbey — The Sleeping Dogs Thrillers','Discover the eight Sleeping Dogs thrillers by John Wayne Falbey. Read Chapter One of Hidden Dragons, Sleeping Dogs, coming November 2026.'],
 ['series','The Sleeping Dogs Series — Books in Reading Order','Explore all eight published Sleeping Dogs thrillers in order, with book descriptions and retailer links. The ninth arrives November 2026.'],
 ['hidden-dragons','Hidden Dragons, Sleeping Dogs — Coming November 2026','The ninth Sleeping Dogs thriller by John Wayne Falbey. Watch the trailer, explore the new threat, and read the sample chapter.'],
 ['excerpt','Read Chapter One — Hidden Dragons, Sleeping Dogs','Read “Birthplace of Dragons,” Chapter One of the ninth Sleeping Dogs thriller, and watch the promotional trailer. Coming November 2026.'],
 ['appearances','Appearances — John Wayne Falbey','Author appearances, interviews, library programs and book club visits. Contact John Wayne Falbey for booking inquiries.'],
 ['newsletter','Newsletter — John Wayne Falbey','Subscribe to John Wayne Falbey’s newsletter for occasional release news, author appearances and updates on the Sleeping Dogs thrillers.'],
 ['about','About John Wayne Falbey','Meet John Wayne Falbey, author of the Sleeping Dogs techno-political thrillers, former attorney and real estate developer.'],
 ['media','Press Kit — John Wayne Falbey','Author biographies, book information, headshot, cover previews and interview contacts for editors, podcast producers and event hosts.'],
 ['contact','Contact — John Wayne Falbey','Contact John Wayne Falbey for reader mail, event proposals, interviews, media and rights inquiries.']
];
const pages=definitions.map(([route,title,description])=>({route,title,description,url:routes[route],body:views[route]}));
for(const book of context.BOOKS){
 context.renderBook(book.id);
 pages.push({route:'book',book,title:book.t+' — John Wayne Falbey',description:book.hook,url:'/books/'+book.id+'/',body:views.book.replace('<div class="wrap page-h" id="bookView"></div>','<div class="wrap page-h" id="bookView">'+elements.bookView.innerHTML+'</div>')});
}
pages.push({route:'404',title:'Page Not Found — John Wayne Falbey',description:'Find the Sleeping Dogs series, new release and sample chapter.',url:'/404.html',body:'<div class="view on"><div class="wrap page-h"><div class="lab">File not found</div><h1 id="page-title">This page has moved.</h1><p class="sub">Return to the series or open the new book’s sample chapter.</p><div class="sample-actions"><a class="btn btn-p" href="/series/">Explore the series</a><a class="btn btn-g" href="/sample-chapter/">Read Chapter One</a></div></div></div>'});
for(const page of pages){
 const canonical=release.domain+page.url;
 const preview=page.book?'/assets/social/'+page.book.id+'.png':['hidden-dragons','excerpt'].includes(page.route)?'/assets/social/hidden-dragons.png':'/og-card.png';
 const imageAlt=page.book?page.book.t+' book cover':['hidden-dragons','excerpt'].includes(page.route)?'Hidden Dragons, Sleeping Dogs — sample cover':'John Wayne Falbey — Sleeping Dogs thrillers';
 const schema={'@context':'https://schema.org','@graph':[
  {'@type':'Person','@id':release.domain+'/#author',name:release.author,url:release.domain+'/about/'},
  {'@type':'WebPage','@id':canonical,url:canonical,name:page.title,description:page.description,inLanguage:'en',isPartOf:{'@id':release.domain+'/#website'}},
  {'@type':'WebSite','@id':release.domain+'/#website',url:release.domain+'/',name:'Falbey Books'}
 ]};
 if(page.book||['hidden-dragons','excerpt'].includes(page.route))schema['@graph'].push({'@type':'Book',name:page.book?.t??release.title,author:{'@id':release.domain+'/#author'},image:release.domain+(page.book?'/covers/'+page.book.id+'.jpg':'/covers/hidden-dragons-sample-960.webp'),url:release.domain+(page.book?page.url:'/hidden-dragons/'),inLanguage:'en',isPartOf:{'@type':'BookSeries',name:'Sleeping Dogs'},...(page.book?{datePublished:page.book.y}:{})});
 let nav=header.replace(/<a([^>]*?)data-nav="([^"]+)"([^>]*)>/g,(tag,before,route,after)=>{
  if(route!==(page.route==='book'?'series':page.route))return tag;
  if(/class="/.test(before))before=before.replace(/class="([^"]*)"/,'class="$1 on"');else before+='class="on" ';
  return '<a'+before+'data-nav="'+route+'"'+after+' aria-current="page">';
 });
 let body=page.body.replace('class="view"','class="view on"');
 if(page.route==='home')body=body.replace('<h1 class="hero-h">','<h1 class="hero-h" id="page-title">');
 const html='<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'+
 `<title>${escape(page.title)}</title>\n<meta name="description" content="${escape(page.description)}">\n<link rel="canonical" href="${canonical}">\n`+
 `<meta property="og:title" content="${escape(page.title)}">\n<meta property="og:description" content="${escape(page.description)}">\n<meta property="og:type" content="${page.book?'book':'website'}">\n<meta property="og:url" content="${canonical}">\n<meta property="og:image" content="${release.domain+preview}">\n<meta property="og:image:alt" content="${escape(imageAlt)}">\n<meta property="og:site_name" content="Falbey Books">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${escape(page.title)}">\n<meta name="twitter:description" content="${escape(page.description)}">\n<meta name="twitter:image" content="${release.domain+preview}">\n<meta name="twitter:image:alt" content="${escape(imageAlt)}">\n`+
 (page.route==='404'?'<meta name="robots" content="noindex">\n':'')+commonHead+`<link rel="stylesheet" href="/assets/site.css?v=${assetVersion}">\n`+nojs+
 '<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>\n</head>\n<body>'+paths(nav+'<main id="main" tabindex="-1">'+body+'</main>'+footer)+`<script src="/assets/site.js?v=${assetVersion}" defer></script>\n</body>\n</html>\n`;
 const file=path.join(out,page.url==='/'?'index.html':page.url==='/404.html'?'404.html':page.url.slice(1)+'index.html');
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,html);
}
fs.writeFileSync(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+pages.filter(p=>p.route!=='404').map(p=>'<url><loc>'+release.domain+p.url+'</loc><lastmod>'+release.updated+'</lastmod></url>').join('\n')+'\n</urlset>\n');
fs.writeFileSync(path.join(out,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /form-handler.php\nSitemap: '+release.domain+'/sitemap.xml\n');
fs.copyFileSync(path.join(here,'apache.htaccess'),path.join(out,'.htaccess'));
fs.mkdirSync(path.resolve(here,'../.build'),{recursive:true});
fs.writeFileSync(path.resolve(here,'../.build/build-manifest.json'),JSON.stringify({builtAt:new Date().toISOString(),domain:release.domain,pages:pages.map(({url,title})=>({url,title})),assetVersion,retailerChecked:'2026-09-15',trailerSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(out,'assets/hidden-dragons-helix-trailer.mp4'))).digest('hex')},null,2));
console.log(`Built ${pages.length} static pages for ${release.domain}; trailer preserved.`);
