/**
 * ============================================================================
 * INLINE PREVIEW EDITING — "Canva-style" click-to-edit/delete
 * ============================================================================
 * injectInteractivity() takes the already-rendered resume HTML (from either
 * a code template in packages/templates or an admin/AI-authored dynamic
 * template — see templateResolver.ts) and appends a <style> + <script>
 * block that makes every element the renderers tagged with data-cf-field /
 * data-cf-entry-wrap / data-cf-section-title (see
 * packages/templates/src/helpers.ts and dynamicTemplateRenderer.ts)
 * clickable, editable, and deletable, then reports changes back to the
 * parent page via postMessage.
 *
 * DELIBERATELY ONLY CALLED FOR THE LIVE EDITOR'S INTERACTIVE PREVIEW.
 * PDF export, DOCX export, and the read-only AI-chat-builder preview all
 * call template.renderHtml()/renderDynamicTemplate() directly and never
 * pass through this function — the data-cf-* attributes are already
 * harmless there (nothing reads them without this script), but the visible
 * hover outlines/delete buttons this injects would be actively wrong to
 * ship in an exported file. See POST /resumes/preview-render's
 * `interactive` flag.
 *
 * SECURITY NOTE — this is why the iframe uses sandbox="allow-scripts"
 * *without* allow-same-origin (see ResumePreview.tsx): this script runs in
 * an isolated, opaque-origin context. It cannot read the parent page's
 * cookies, localStorage, or DOM, and the parent cannot reach into it
 * either — the only channel in either direction is postMessage, which is
 * exactly what this script uses. A malformed or (in principle) malicious
 * dynamic template's HTML can at worst run JS that posts bogus messages;
 * the parent-side handler (ResumePreview.tsx) validates message shape and
 * ignores anything unexpected before ever touching resume state.
 * ============================================================================
 *
 * CSP NOTE: this script's exact runtime bytes must match the sha256 hash
 * whitelisted in app.ts's helmet script-src (srcdoc iframes inherit the
 * parent document's CSP, and there's no nonce here, so an inline script only
 * runs if its hash is explicitly listed). If you edit SCRIPT below,
 * recompute the hash from the EVALUATED string, not the raw source — the
 * source contains escaped backslashes (e.g. `\\u00D7`) that collapse to a
 * single backslash once the JS engine evaluates the template literal, and
 * only those evaluated bytes are ever sent to the browser:
 *
 *   node -e "
 *     const fs = require('fs');
 *     const src = fs.readFileSync('previewInteractivity.ts', 'utf8');
 *     const rawBody = src.match(/const SCRIPT = \`([\s\S]*?)\`;/)[1];
 *     const evaluated = eval('\`' + rawBody + '\`');
 *     const start = evaluated.indexOf('id=\"cf-interactive-script\">') + 'id=\"cf-interactive-script\">'.length;
 *     const inner = evaluated.slice(start, evaluated.indexOf('</script>'));
 *     console.log('sha256-' + require('crypto').createHash('sha256').update(inner, 'utf8').digest('base64'));
 *   "
 *
 * and paste the result into app.ts. A previous version of this file had CRLF
 * line endings while app.ts's whitelisted hash was computed against LF
 * content — same script, different bytes, different hash. Keep this file
 * LF-only.
 */

const STYLE = `
<style id="cf-interactive-style">
  [data-cf-field] { cursor: text; border-radius: 3px; transition: box-shadow .1s ease; }
  [data-cf-field]:hover { box-shadow: 0 0 0 2px rgba(79,70,229,0.35); }
  [data-cf-field][contenteditable="true"] { box-shadow: 0 0 0 2px rgba(79,70,229,0.9) !important; outline: none; cursor: text; }
  [data-cf-entry-wrap] { position: relative; }
  [data-cf-entry-wrap].cf-hover { outline: 1.5px dashed rgba(79,70,229,0.55); outline-offset: 3px; border-radius: 4px; }
  [data-cf-section-title] { position: relative; cursor: default; }
  [data-cf-section-title].cf-hover { box-shadow: 0 0 0 2px rgba(220,38,38,0.35); border-radius: 3px; }
  #cf-delete-btn {
    position: fixed; z-index: 2147483647; display: none;
    width: 22px; height: 22px; border-radius: 999px; border: none;
    background: #dc2626; color: #fff; align-items: center; justify-content: center;
    cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.35);
    font: 13px/1 -apple-system, sans-serif; padding: 0;
  }
  #cf-delete-btn:hover { background: #b91c1c; }
</style>`;

const SCRIPT = `
<script id="cf-interactive-script">
(function () {
  var CF_SECTION = 'data-cf-section';
  var CF_ENTRY_WRAP = 'data-cf-entry-wrap';
  var CF_SECTION_TITLE = 'data-cf-section-title';
  var CF_FIELD = 'data-cf-field';

  var delBtn = document.createElement('button');
  delBtn.id = 'cf-delete-btn';
  delBtn.type = 'button';
  delBtn.setAttribute('aria-label', 'Delete');
  delBtn.textContent = '\\u00D7';
  document.body.appendChild(delBtn);

  var hoveredEntry = null;
  var hoveredTitle = null;
  var editingEl = null;

  function post(msg) {
    try { window.parent.postMessage(Object.assign({ source: 'careerforge-preview' }, msg), '*'); }
    catch (e) { /* no-op — parent may not be listening yet */ }
  }

  function positionDeleteBtn(target) {
    var r = target.getBoundingClientRect();
    delBtn.style.top = Math.max(0, r.top - 8) + 'px';
    delBtn.style.left = Math.max(0, r.right - 8) + 'px';
    delBtn.style.display = 'flex';
  }

  function hideDeleteBtn() {
    delBtn.style.display = 'none';
    delBtn.dataset.action = '';
  }

  function clearHover() {
    if (hoveredEntry) { hoveredEntry.classList.remove('cf-hover'); hoveredEntry = null; }
    if (hoveredTitle) { hoveredTitle.classList.remove('cf-hover'); hoveredTitle = null; }
  }

  document.addEventListener('mouseover', function (e) {
    if (editingEl) return; // don't fight the active edit
    var titleEl = e.target.closest('[' + CF_SECTION_TITLE + ']');
    var entryEl = e.target.closest('[' + CF_ENTRY_WRAP + ']');
    // Prefer whichever is closer to the cursor (deepest match wins);
    // an entry nested inside another hoverable rarely happens here, so
    // simple precedence (title beats entry beats nothing) is enough.
    clearHover();
    if (titleEl) {
      hoveredTitle = titleEl;
      titleEl.classList.add('cf-hover');
      delBtn.dataset.action = 'delete-section';
      delBtn.dataset.sectionId = titleEl.getAttribute(CF_SECTION_TITLE) || '';
      positionDeleteBtn(titleEl);
    } else if (entryEl) {
      hoveredEntry = entryEl;
      entryEl.classList.add('cf-hover');
      delBtn.dataset.action = 'delete-entry';
      delBtn.dataset.sectionId = entryEl.getAttribute(CF_SECTION) || '';
      delBtn.dataset.entryId = entryEl.getAttribute(CF_ENTRY_WRAP) || '';
      positionDeleteBtn(entryEl);
    } else {
      hideDeleteBtn();
    }
  });

  document.addEventListener('mouseleave', function () { clearHover(); hideDeleteBtn(); }, true);

  delBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var action = delBtn.dataset.action;
    if (action === 'delete-entry') {
      post({ type: 'delete-entry', sectionId: delBtn.dataset.sectionId, entryId: delBtn.dataset.entryId });
    } else if (action === 'delete-section') {
      post({ type: 'delete-section', sectionId: delBtn.dataset.sectionId });
    }
    clearHover();
    hideDeleteBtn();
  });

  function commitEdit(el) {
    el.removeAttribute('contenteditable');
    el.classList.remove('cf-editing');
    var sectionId = el.getAttribute(CF_SECTION);
    var entryId = el.getAttribute('data-cf-entry');
    var field = el.getAttribute(CF_FIELD);
    post({ type: 'field-edit', sectionId: sectionId, entryId: entryId, field: field, value: el.innerText });
    editingEl = null;
  }

  document.addEventListener('click', function (e) {
    if (e.target === delBtn) return;
    var fieldEl = e.target.closest('[' + CF_FIELD + ']');
    if (!fieldEl) {
      if (editingEl) commitEdit(editingEl);
      return;
    }
    if (editingEl && editingEl !== fieldEl) commitEdit(editingEl);
    if (editingEl === fieldEl) return; // already editing this one
    fieldEl.setAttribute('contenteditable', 'true');
    editingEl = fieldEl;
    fieldEl.focus();
    // Place cursor at the click point rather than jumping to start/end.
    if (document.caretRangeFromPoint) {
      var range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (range) {
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  });

  document.addEventListener(
    'focusout',
    function (e) {
      if (editingEl && e.target === editingEl) commitEdit(editingEl);
    },
    true,
  );

  document.addEventListener('keydown', function (e) {
    if (!editingEl) return;
    if (e.key === 'Enter' && editingEl.getAttribute(CF_FIELD).indexOf('description') === -1 && editingEl.getAttribute(CF_FIELD) !== 'text') {
      // Single-line-ish fields (name, title, company, ...) commit on Enter
      // instead of inserting a line break. Description/summary fields are
      // allowed multi-line, so Enter behaves normally there.
      e.preventDefault();
      editingEl.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      editingEl.blur();
    }
  });
})();
</script>`;

/**
 * Injects the interactive style + script into a fully-rendered resume HTML
 * document, just before </head> and </body> respectively (falling back to
 * appending at the end if those tags aren't found, since dynamic templates
 * are free-form admin/AI-authored HTML and a well-formed document isn't
 * strictly guaranteed).
 */
export function injectInteractivity(html: string): string {
  let out = html;

  out = /<\/head>/i.test(out)
    ? out.replace(/<\/head>/i, `${STYLE}</head>`)
    : out + STYLE;

  out = /<\/body>/i.test(out)
    ? out.replace(/<\/body>/i, `${SCRIPT}</body>`)
    : out + SCRIPT;

  return out;
}