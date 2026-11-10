/* Минимальная запись и чтение .xlsx без библиотек: один лист, текст и числа */
(function(){
const enc=new TextEncoder(),dec=new TextDecoder();
const T=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
const crc=b=>{let c=~0;for(let i=0;i<b.length;i++)c=T[(c^b[i])&255]^(c>>>8);return ~c>>>0;};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
const col=i=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;};
function zip(files){const parts=[],cen=[];let off=0;const u16=v=>[v&255,v>>8&255],u32=v=>[v&255,v>>8&255,v>>16&255,v>>24&255];
  files.forEach(([name,data])=>{const nb=enc.encode(name),c=crc(data);
    const h=new Uint8Array([0x50,0x4b,3,4,20,0,0,8,0,0,0,0,0x21,0,...u32(c),...u32(data.length),...u32(data.length),...u16(nb.length),0,0,...nb]);
    parts.push(h,data);
    cen.push(new Uint8Array([0x50,0x4b,1,2,20,0,20,0,0,8,0,0,0,0,0x21,0,...u32(c),...u32(data.length),...u32(data.length),...u16(nb.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(off),...nb]));
    off+=h.length+data.length;});
  const cs=cen.reduce((a,b)=>a+b.length,0);
  return new Blob([...parts,...cen,new Uint8Array([0x50,0x4b,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(cs),...u32(off),0,0])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});}
/* sheets: [{name, rows:[[...]], widths:[..], headRows:1}] */
function build(sheets){
  const files=[];
  files.push(['[Content_Types].xml',enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>')]);
  files.push(['_rels/.rels',enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')]);
  files.push(['xl/workbook.xml',enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>`<sheet name="${esc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>')]);
  files.push(['xl/_rels/workbook.xml.rels',enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)]);
  files.push(['xl/styles.xml',enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EDF7"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF3D6"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')]);
  sheets.forEach((s,si)=>{
    const rows=s.rows.map((r,ri)=>{const st=ri<(s.headRows==null?1:s.headRows)?1:(s.sample&&s.sample.includes(ri)?2:(s.wrap?3:0));
      return `<row r="${ri+1}">`+r.map((v,ci)=>{if(v===''||v==null)return st?`<c r="${col(ci)}${ri+1}" s="${st}"/>`:'';const ref=col(ci)+(ri+1);
        return typeof v==='number'?`<c r="${ref}"${st?` s="${st}"`:''}><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"${st?` s="${st}"`:''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;}).join('')+'</row>';}).join('');
    const w=(s.widths||[]).length?'<cols>'+s.widths.map((x,i)=>`<col min="${i+1}" max="${i+1}" width="${x}" customWidth="1"/>`).join('')+'</cols>':'';
    files.push([`xl/worksheets/sheet${si+1}.xml`,enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${s.headRows===0?'':'<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'}</sheetView></sheetViews>${w}<sheetData>${rows}</sheetData></worksheet>`)]);});
  return zip(files);
}
function download(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);}
async function inflate(b){const ds=new DecompressionStream('deflate-raw');const w=ds.writable.getWriter();w.write(b);w.close();return new Uint8Array(await new Response(ds.readable).arrayBuffer());}
async function unzip(buf){const b=new Uint8Array(buf),dv=new DataView(buf);let e=b.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error('zip');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out={};
  for(let i=0;i<n;i++){const m=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
    const name=dec.decode(b.subarray(p+46,p+46+nl));const ln=dv.getUint16(lo+26,true),lx=dv.getUint16(lo+28,true),st=lo+30+ln+lx;const raw=b.subarray(st,st+cs);
    out[name]=m===0?raw:m===8?await inflate(raw):null;p+=46+nl+xl+cl;}
  return out;}
const txt=u=>u?dec.decode(u):'';
const colIdx=r=>{const m=/^([A-Z]+)/.exec(r);let n=0;for(const ch of m[1])n=n*26+ch.charCodeAt(0)-64;return n-1;};
/* возвращает массив строк (массивы значений) первого листа или листа с именем */
async function read(buf,sheetName){
  const f=await unzip(buf);const dp=new DOMParser(),x=s=>dp.parseFromString(s,'application/xml');
  const wb=x(txt(f['xl/workbook.xml'])),rels=x(txt(f['xl/_rels/workbook.xml.rels']));
  const shs=[...wb.getElementsByTagName('sheet')];let sh=shs.find(s=>s.getAttribute('name')===sheetName)||shs[0];if(!sh)throw new Error('no sheet');
  const rid=sh.getAttribute('r:id')||sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  const rel=[...rels.getElementsByTagName('Relationship')].find(r=>r.getAttribute('Id')===rid);
  let path=rel.getAttribute('Target').replace(/^\//,'');path=path.startsWith('xl/')?path:'xl/'+path;
  const ss=f['xl/sharedStrings.xml']?[...x(txt(f['xl/sharedStrings.xml'])).getElementsByTagName('si')].map(si=>[...si.getElementsByTagName('t')].map(t=>t.textContent).join('')):[];
  const doc=x(txt(f[path])),rows=[];
  [...doc.getElementsByTagName('row')].forEach(r=>{const row=[];[...r.getElementsByTagName('c')].forEach(c=>{const i=colIdx(c.getAttribute('r')),t=c.getAttribute('t');let v;
    if(t==='inlineStr')v=[...c.getElementsByTagName('t')].map(q=>q.textContent).join('');
    else{const ve=c.getElementsByTagName('v')[0];v=ve?ve.textContent:'';if(t==='s')v=ss[+v]||'';else if(t!=='str'&&t!=='b'&&v!==''&&!isNaN(+v))v=+v;}
    row[i]=v;});
    rows[+r.getAttribute('r')-1]=row;});
  return Array.from(rows,r=>r||[]);
}
window.SHTATKA_XLSX={build,read,download};
})();
