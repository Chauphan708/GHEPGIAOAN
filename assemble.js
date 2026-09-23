const fs = require('fs');
const path = require('path');

const jszipCode = fs.readFileSync(path.join(__dirname, 'node_modules', 'jszip', 'dist', 'jszip.min.js'), 'utf-8');
const docxMergerCode = fs.readFileSync(path.join(__dirname, 'node_modules', 'docx-merger', 'dist', 'docx-merger.js'), 'utf-8');
const clientLogicCode = fs.readFileSync(path.join(__dirname, 'client_html5_logic.js'), 'utf-8');

// Loại bỏ triệt để ký tự Byte Order Mark (BOM \uFEFF) nếu có
let styleCss = fs.readFileSync(path.join(__dirname, 'public', 'css', 'style.css'), 'utf-8');
styleCss = styleCss.replace(/^\uFEFF/, '');

let templateHtml = fs.readFileSync(path.join(__dirname, 'html5_template.html'), 'utf-8');
templateHtml = templateHtml.replace(/^\uFEFF/, '');

// Dùng function replacer (() => content) để ngăn chặn hoàn toàn lỗi mở rộng ký tự $ của JavaScript
const finalHtml = templateHtml
    .replace('/* __CSS_PLACEHOLDER__ */', () => styleCss)
    .replace('/* __JSZIP_PLACEHOLDER__ */', () => jszipCode)
    .replace('/* __DOCX_MERGER_PLACEHOLDER__ */', () => docxMergerCode)
    .replace('/* __CLIENT_LOGIC_PLACEHOLDER__ */', () => clientLogicCode);

const out1 = path.join(__dirname, 'Ghep_Giao_An_HTML5.html');
const out2 = path.join(__dirname, 'public', 'standalone.html');
const out3 = path.join(__dirname, 'public', 'index.html');
const out4 = path.join(__dirname, 'index.html');

fs.writeFileSync(out1, finalHtml, 'utf-8');
fs.writeFileSync(out2, finalHtml, 'utf-8');
fs.writeFileSync(out3, finalHtml, 'utf-8');
fs.writeFileSync(out4, finalHtml, 'utf-8');

console.log('Successfully built Ghep_Giao_An_HTML5.html! Size:', fs.statSync(out1).size, 'bytes');