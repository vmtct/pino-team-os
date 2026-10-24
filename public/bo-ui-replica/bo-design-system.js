/* PAP-879: shared UI-only three-level contract extracted from Founder-approved Hồ Sơ Đăng Ký. */
(function (root, factory) {
  const contract = factory();
  if (typeof module === 'object' && module.exports) module.exports = contract;
  root.PinoBODesignSystem = contract;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const DETAIL_TABS = Object.freeze(['Tổng quan', 'Hoạt động', 'Tài liệu']);
  const LEVELS = Object.freeze(['table', 'drawer', 'detail']);
  function detailTabs() { return [...DETAIL_TABS]; }
  function moduleSchema({ key, label, fields }) {
    if (!/^[a-z][a-z0-9-]*$/.test(key || '')) throw new Error('invalid module key');
    if (!label || !Array.isArray(fields) || !fields.length) throw new Error('invalid module schema');
    const ids = new Set();
    const normalized = fields.map(({ key: fieldKey, label: fieldLabel, type = 'text', readonly = false }) => {
      if (!/^[a-z][a-z0-9-]*$/.test(fieldKey || '') || ids.has(fieldKey)) throw new Error('invalid or duplicate field key');
      ids.add(fieldKey);
      return Object.freeze({ key: fieldKey, label: String(fieldLabel || fieldKey), type, readonly: Boolean(readonly || fieldKey === 'id') });
    });
    if (!ids.has('id')) throw new Error('module schema requires immutable id');
    return Object.freeze({ key, label, fields: Object.freeze(normalized), levels: LEVELS });
  }
  return Object.freeze({ DETAIL_TABS, LEVELS, detailTabs, moduleSchema });
});