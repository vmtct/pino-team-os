/* Route only the two UI-only pilots to the canonical workspace. Other modules retain their entry. */
(function() {
  'use strict';
  const url = new URL(location.href);
  const key = url.searchParams.get('module') || 'students';
  if (key !== 'students' && key !== 'classes') return;
  const target = new URL('./playground.html', url);
  target.search = url.search;
  target.searchParams.set('module', key);
  target.hash = url.hash;
  location.replace(target.href);
})();
