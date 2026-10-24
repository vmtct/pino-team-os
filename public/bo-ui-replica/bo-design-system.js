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
  function tableColumns({ noun, fields, compact = false }) {
    if (!noun || !Array.isArray(fields)) throw new Error('table requires noun and fields');
    const shown = compact ? fields.slice(0, 2) : fields;
    return Object.freeze([{ key: 'title', label: noun }, { key: 'id', label: 'ID', readonly: true }, ...shown.map(key => ({ key, label: key }))].map(x => Object.freeze(x)));
  }
  function drawerProperties({ fields, record, isCreate = false }) {
    if (!Array.isArray(fields)) throw new Error('drawer fields must be an array');
    const values = record?.values || {};
    const props = fields.map(key => Object.freeze({ key, label: key, value: values[key] ?? '', editable: true }));
    props.push(Object.freeze({ key: 'id', label: 'ID', value: isCreate ? 'Tự tạo khi lưu' : (record?.id || ''), editable: false }));
    return Object.freeze(props);
  }
  function renderDrawerPropertyRows({ properties, escapeHtml, badgeHtml }) {
    if (!Array.isArray(properties) || typeof escapeHtml !== 'function') throw new Error('invalid drawer renderer inputs');
    const esc = escapeHtml;
    return properties.map(p => {
      if (!p.editable) return '<div class="drawer-field"><dt>'+esc(p.label)+'</dt><dd class="id-tag">'+esc(p.value)+'</dd></div>';
      const value = p.value;
      const markup = value ? (/trạng thái|kết quả|đồng bộ|kết nối/i.test(p.key) && typeof badgeHtml === 'function' ? badgeHtml(value) : '<span>'+esc(value)+'</span>') : '<span class="property-placeholder">Chưa có</span>';
      return '<div class="drawer-field"><dt>'+esc(p.label)+'</dt><dd><button type="button" class="property-edit" data-prop="'+esc(p.key)+'" title="Click để sửa '+esc(p.label)+'">'+markup+'<span class="property-pencil">✎</span></button></dd></div>';
    }).join('');
  }  function renderTableHeader({ columns, sortKey, descending = false, escapeHtml }) {
    if (!Array.isArray(columns) || typeof escapeHtml !== 'function') throw new Error('invalid table header inputs');
    return '<tr>'+columns.map(({key,label}) => '<th data-key="'+escapeHtml(key)+'" data-sort="'+(sortKey === key ? 'active' : '')+'">'+escapeHtml(label)+' <span class="sort-icon">'+(sortKey === key ? (descending ? '↓' : '↑') : '↕')+'</span></th>').join('')+'<th class="row-action-column"></th></tr>';
  }  return Object.freeze({ DETAIL_TABS, LEVELS, detailTabs, moduleSchema, tableColumns, drawerProperties, renderDrawerPropertyRows, renderTableHeader });
});