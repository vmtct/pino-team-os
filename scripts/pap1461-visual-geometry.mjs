// PAP-1461 · Epic PAP-184 / PLT-UI-GOVERNANCE
// Reusable fail-closed rendered-control geometry probe (PINO DS/TDD G3).
// Inspects individual text fragment boxes and siblings; root scrollWidth alone is insufficient.
export const G3_VIEWPORTS = Object.freeze([320, 390, 768, 1024, 1440]);

export async function inspectListboxGeometry(page, {
  listSelector = '[role="listbox"]',
  optionSelector = '[role="option"]',
  minCount = 1,
  minHitHeight = 44,
  expectedAlign = 'left',
  maxOverflowPx = 2,
} = {}) {
  return page.evaluate(({listSelector, optionSelector, minCount, minHitHeight, expectedAlign, maxOverflowPx}) => {
    const list = document.querySelector(listSelector);
    if (!list) return {pass:false,issues:['LISTBOX_MISSING'],options:[]};
    const options = [...list.querySelectorAll(optionSelector)];
    const issues = [];
    if (options.length < minCount) issues.push('INSUFFICIENT_OPTIONS:'+options.length);
    const rounded = n => Math.round(n * 10) / 10;
    const within = (outer, inner) =>
      inner.left >= outer.left - maxOverflowPx && inner.right <= outer.right + maxOverflowPx
      && inner.top >= outer.top - maxOverflowPx && inner.bottom <= outer.bottom + maxOverflowPx;
    let previous = null;
    const samples = options.map((option, index) => {
      const rect = option.getBoundingClientRect(),style = getComputedStyle(option);
      if (rect.height < minHitHeight) issues.push('HIT_TARGET_TOO_SHORT:'+index+':'+rounded(rect.height));
      if (rect.width <= 0 || rect.height <= 0) issues.push('OPTION_COLLAPSED:'+index);
      if (expectedAlign && style.textAlign !== expectedAlign)
        issues.push('TEXT_ALIGNMENT:'+index+':'+style.textAlign);
      if (previous && rect.top < previous.bottom - maxOverflowPx)
        issues.push('SIBLING_OVERLAP:'+index+':'+rounded(previous.bottom-rect.top));
      previous = rect;
      // Element geometry alone misses glyphs overflowing a fixed-height button.
      const elements = [...option.querySelectorAll('span,strong,small')];
      for (const element of elements) {
        if (getComputedStyle(element).display === 'none') continue;
        if (!within(rect, element.getBoundingClientRect()))
          issues.push('CHILD_OUTSIDE_OPTION:'+index+':'+element.tagName.toLowerCase());
      }
      const walker = document.createTreeWalker(option, NodeFilter.SHOW_TEXT);
      let node, textFragments=0;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim() || getComputedStyle(node.parentElement).display === 'none') continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const fragment of range.getClientRects()) {
          if (fragment.width <= 0.2 || fragment.height <= 0.2) continue;
          textFragments++;
          if (!within(rect, fragment)) issues.push('GLYPH_OUTSIDE_OPTION:'+index);
        }
        range.detach();
      }
      if (!textFragments) issues.push('NO_TEXT_FRAGMENTS:'+index);
      return {index,top:rounded(rect.top),bottom:rounded(rect.bottom),
        height:rounded(rect.height),width:rounded(rect.width),
        textAlign:style.textAlign,whiteSpace:style.whiteSpace,textFragments};
    });
    const root=document.documentElement;
    if (root.scrollWidth>root.clientWidth+maxOverflowPx)
      issues.push('DOCUMENT_HORIZONTAL_OVERFLOW:'+rounded(root.scrollWidth-root.clientWidth));
    const host=list.getBoundingClientRect();
    const scrollStyle=getComputedStyle(list);
    if (list.scrollHeight>list.clientHeight+maxOverflowPx && !['scroll','auto'].includes(scrollStyle.overflowY))
      issues.push('LIST_SCROLL_CLIPPED');
    if (host.width<=0 || host.height<=0)issues.push('LISTBOX_COLLAPSED');
    return {pass:issues.length===0,issues,
      options:samples,optionCount:options.length,
      list:{height:rounded(host.height),scrollHeight:list.scrollHeight,clientHeight:list.clientHeight,overflowY:scrollStyle.overflowY},
      viewport:{innerWidth,clientWidth:root.clientWidth,scrollWidth:root.scrollWidth}};
  },{listSelector,optionSelector,minCount,minHitHeight,expectedAlign,maxOverflowPx});
}
