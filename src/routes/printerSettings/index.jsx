import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  loadPrinters,
  savePrinter,
  removePrinter,
  loadTemplates,
  saveTemplate,
  loadAssignments,
  saveAssignment,
  loadCategoryLinks,
  saveCategoryLinks,
} from '../../features/printers/printersSlice.js';
import { fetchCategoriesRequest } from '../../features/categories/categoriesAPI.js';
import {
  PRINTER_DEPARTMENTS,
  DEFAULT_RECEIPT_TEMPLATE,
  DEFAULT_BRIDGE_URL,
  CONNECTION_TEST_RESULTS,
} from '../../features/printers/printerConstants.js';
import { validatePrinterPayload } from '../../features/printers/printerValidation.js';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import {
  printerService,
  globalPrintQueue,
  detectDirectTcpSupport,
  loadBridgeUrl,
  saveBridgeUrl,
} from '../../services/printing/index.js';
import { toast } from '../../utils/toast.js';
import PrinterFormModal from './PrinterFormModal.jsx';
import './printer-settings-module.css';

const TABS = [
  { id: 'printers', label: 'Printers' },
  { id: 'templates', label: 'Templates' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'categories', label: 'Categories' },
  { id: 'queue', label: 'Print queue' },
  { id: 'bridge', label: 'Bridge setup' },
];

const statusBadge = (status) => {
  const map = {
    online: 'success',
    offline: 'secondary',
    timeout: 'warning',
    refused: 'danger',
    error: 'danger',
  };
  return map[status] || 'secondary';
};

export default function PrinterSettingsPage() {
  useRequireModuleAccess('printer-settings');
  const { canEdit, canDelete, isAdmin } = usePermissions('printer-settings');
  const canModify = isAdmin || canEdit;
  const dispatch = useDispatch();
  const { list: printers, templates, assignments, categoryLinks, status, saveStatus } = useSelector(
    (s) => s.printers
  );
  const company = useSelector((s) => s.user.company);

  const [tab, setTab] = useState('printers');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [testStatus, setTestStatus] = useState({});
  const [bridgeUrl, setBridgeUrl] = useState(() => loadBridgeUrl() || DEFAULT_BRIDGE_URL);
  const [bridgeHealth, setBridgeHealth] = useState(null);
  const [queueJobs, setQueueJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [templateForm, setTemplateForm] = useState({ ...DEFAULT_RECEIPT_TEMPLATE });
  const [categoryMap, setCategoryMap] = useState({});

  const directTcp = useMemo(() => detectDirectTcpSupport(), []);

  useEffect(() => {
    dispatch(loadPrinters());
    dispatch(loadTemplates());
    dispatch(loadAssignments());
    dispatch(loadCategoryLinks());
    fetchCategoriesRequest({ page: 1, limit: 1000, sortBy: 'name', sortOrder: 'asc' })
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCategories([]));
  }, [dispatch]);

  useEffect(() => {
    printerService.setBridgeUrl(bridgeUrl);
  }, [bridgeUrl]);

  useEffect(() => {
    const unsub = globalPrintQueue.subscribe(setQueueJobs);
    setQueueJobs(globalPrintQueue.getSnapshot());
    return unsub;
  }, []);

  useEffect(() => {
    if (templates.length) setTemplateForm({ ...DEFAULT_RECEIPT_TEMPLATE, ...templates[0] });
  }, [templates]);

  useEffect(() => {
    const map = {};
    for (const link of categoryLinks) {
      map[String(link.category_id)] = String(link.printer_id);
    }
    setCategoryMap(map);
  }, [categoryLinks]);

  const assignmentByDept = useMemo(() => {
    const m = {};
    for (const a of assignments) m[a.department] = a.printer_id;
    return m;
  }, [assignments]);

  const openAdd = () => {
    setEditing(null);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSavePrinter = async (form) => {
    const errors = validatePrinterPayload(form);
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    try {
      await dispatch(savePrinter({ id: editing?._id, data: form })).unwrap();
      toast.success(editing?._id ? 'Printer updated.' : 'Printer added.');
      setModalOpen(false);
      dispatch(loadPrinters());
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this printer?')) return;
    try {
      await dispatch(removePrinter(id)).unwrap();
      toast.success('Printer deleted.');
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Delete failed');
    }
  };

  const runTestConnection = async (printer) => {
    const id = printer._id;
    setTestStatus((s) => ({ ...s, [id]: { loading: true } }));
    try {
      const result = await printerService.testConnection(printer);
      setTestStatus((s) => ({ ...s, [id]: { loading: false, ...result } }));
      toast.info(result.message || CONNECTION_TEST_RESULTS[result.status] || result.status);
    } catch (e) {
      setTestStatus((s) => ({ ...s, [id]: { loading: false, status: 'error', message: e.message } }));
      toast.error(e.message);
    }
  };

  const runTestPrint = async (printer) => {
    try {
      await printerService.testPrint(printer);
      toast.success('Test page sent to printer.');
    } catch (e) {
      toast.error(e.message || 'Test print failed');
    }
  };

  const saveBridge = () => {
    saveBridgeUrl(bridgeUrl);
    printerService.setBridgeUrl(bridgeUrl);
    toast.success('Bridge URL saved.');
  };

  const checkBridgeHealth = async () => {
    try {
      const h = await printerService.bridge.healthCheck();
      setBridgeHealth({ ok: true, ...h });
      toast.success('Print bridge is online.');
    } catch (e) {
      setBridgeHealth({ ok: false, message: e.message });
      toast.error(e.message || 'Bridge offline');
    }
  };

  const handleAssignmentChange = async (department, printer_id) => {
    try {
      await dispatch(saveAssignment({ department, printer_id })).unwrap();
      dispatch(loadAssignments());
      toast.success('Assignment saved.');
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Save failed');
    }
  };

  const handleSaveCategories = async () => {
    const links = Object.entries(categoryMap)
      .filter(([, printer_id]) => printer_id)
      .map(([category_id, printer_id]) => ({ category_id, printer_id }));
    try {
      await dispatch(saveCategoryLinks(links)).unwrap();
      dispatch(loadCategoryLinks());
      toast.success('Category assignments saved.');
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Save failed');
    }
  };

  const handleSaveTemplate = async () => {
    try {
      await dispatch(saveTemplate(templateForm)).unwrap();
      toast.success('Template saved.');
    } catch (e) {
      toast.error(typeof e === 'string' ? e : e?.message || 'Save failed');
    }
  };

  const templateToggle = (key) =>
    setTemplateForm((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="container-fluid py-4 px-3 printer-settings-page">
      <div className="card shadow-sm">
        <div className="card-header pb-0">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <h5 className="mb-1">Printer settings</h5>
              <p className="text-sm text-muted mb-0">
                Network printers via local print bridge — no drivers on the POS server.
              </p>
            </div>
            {tab === 'printers' && canModify ? (
              <button type="button" className="btn btn-sm btn-primary mb-0" onClick={openAdd}>
                Add printer
              </button>
            ) : null}
          </div>
          <ul className="nav nav-tabs mt-3 border-0">
            {TABS.map((t) => (
              <li className="nav-item" key={t.id}>
                <button
                  type="button"
                  className={`nav-link ${tab === t.id ? 'active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card-body">
          {tab === 'printers' && (
            <>
              {status === 'loading' ? <p className="text-muted">Loading printers…</p> : null}
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>IP</th>
                      <th>Port</th>
                      <th>Type</th>
                      <th>Paper</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-muted py-4">No printers configured</td>
                      </tr>
                    ) : (
                      printers.map((p) => {
                        const ts = testStatus[p._id];
                        return (
                          <tr key={p._id}>
                            <td className="fw-semibold">{p.name}</td>
                            <td><code>{p.ip_address}</code></td>
                            <td>{p.port}</td>
                            <td>{p.printer_type === 'esc_pos' ? 'ESC/POS' : 'Network'}</td>
                            <td>{p.paper_width}</td>
                            <td>
                              <span className={`badge bg-${p.status === 'enabled' ? 'success' : 'secondary'}`}>
                                {p.status}
                              </span>
                              {ts?.status ? (
                                <span className={`badge bg-${statusBadge(ts.status)} ms-1`}>{ts.status}</span>
                              ) : null}
                            </td>
                            <td className="text-end text-nowrap">
                              <button type="button" className="btn btn-sm btn-outline-secondary mb-0 me-1" disabled={ts?.loading} onClick={() => runTestConnection(p)}>
                                Test
                              </button>
                              <button type="button" className="btn btn-sm btn-outline-primary mb-0 me-1" onClick={() => runTestPrint(p)}>
                                Test print
                              </button>
                              {canModify ? (
                                <button type="button" className="btn btn-sm btn-outline-dark mb-0 me-1" onClick={() => openEdit(p)}>Edit</button>
                              ) : null}
                              {canDelete || isAdmin ? (
                                <button type="button" className="btn btn-sm btn-outline-danger mb-0" onClick={() => handleDelete(p._id)}>Delete</button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'templates' && (
            <div className="row g-3">
              <div className="col-lg-8">
                <h6 className="text-uppercase text-muted text-xs fw-bold">Receipt template fields</h6>
                <div className="row g-2">
                  {Object.keys(DEFAULT_RECEIPT_TEMPLATE)
                    .filter((k) => k.startsWith('show_'))
                    .map((key) => (
                      <div className="col-md-4" key={key}>
                        <div className="form-check">
                          <input
                            id={`tpl-${key}`}
                            type="checkbox"
                            className="form-check-input"
                            checked={templateForm[key] !== false}
                            onChange={() => templateToggle(key)}
                          />
                          <label className="form-check-label text-sm" htmlFor={`tpl-${key}`}>
                            {key.replace(/^show_/, '').replace(/_/g, ' ')}
                          </label>
                        </div>
                      </div>
                    ))}
                </div>
                <div className="mt-3">
                  <label className="form-label">Footer text</label>
                  <input className="form-control form-control-sm" value={templateForm.footer_text || ''} onChange={(e) => setTemplateForm((p) => ({ ...p, footer_text: e.target.value }))} />
                </div>
                {canModify ? (
                  <button type="button" className="btn btn-primary btn-sm mt-3 mb-0" onClick={handleSaveTemplate}>Save template</button>
                ) : null}
              </div>
              <div className="col-lg-4">
                <div className="alert alert-light border">
                  <strong>Preview uses:</strong> {company?.company_name || company?.name || 'Your business'}
                </div>
              </div>
            </div>
          )}

          {tab === 'assignments' && (
            <div className="row g-3">
              {PRINTER_DEPARTMENTS.map((dept) => (
                <div className="col-md-6 col-lg-4" key={dept.value}>
                  <label className="form-label">{dept.label}</label>
                  <select
                    className="form-select form-select-sm"
                    value={assignmentByDept[dept.value] || ''}
                    disabled={!canModify}
                    onChange={(e) => handleAssignmentChange(dept.value, e.target.value)}
                  >
                    <option value="">— No printer —</option>
                    {printers.filter((p) => p.status === 'enabled').map((p) => (
                      <option key={p._id} value={p._id}>{p.name} ({p.ip_address})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {tab === 'categories' && (
            <>
              <p className="text-sm text-muted">Assign product categories to printers for automatic kitchen/bar tickets.</p>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Printer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => {
                      const catId = String(cat._id ?? cat.id);
                      return (
                        <tr key={catId}>
                          <td>{cat.name ?? cat.category_name}</td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={categoryMap[catId] || ''}
                              disabled={!canModify}
                              onChange={(e) => setCategoryMap((m) => ({ ...m, [catId]: e.target.value }))}
                            >
                              <option value="">— None —</option>
                              {printers.map((p) => (
                                <option key={p._id} value={p._id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {canModify ? (
                <button type="button" className="btn btn-primary btn-sm mb-0" onClick={handleSaveCategories}>Save category assignments</button>
              ) : null}
            </>
          )}

          {tab === 'queue' && (
            <>
              <div className="d-flex gap-2 mb-3">
                <button type="button" className="btn btn-sm btn-outline-secondary mb-0" onClick={() => globalPrintQueue.clearCompleted()}>Clear completed</button>
              </div>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Error</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {queueJobs.length === 0 ? (
                      <tr><td colSpan={5} className="text-muted text-center py-3">Queue empty</td></tr>
                    ) : (
                      queueJobs.map((j) => (
                        <tr key={j.id}>
                          <td><code className="text-xs">{j.id}</code></td>
                          <td>{j.type}</td>
                          <td><span className={`badge bg-${statusBadge(j.status === 'printed' ? 'online' : j.status === 'failed' ? 'error' : 'timeout')}`}>{j.status}</span></td>
                          <td className="text-danger text-sm">{j.error || '—'}</td>
                          <td>
                            {j.status === 'failed' ? (
                              <button type="button" className="btn btn-sm btn-outline-primary mb-0" onClick={() => globalPrintQueue.retryFailed(j.id)}>Retry</button>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'bridge' && (
            <div className="row g-3">
              <div className="col-lg-7">
                <div className="alert alert-warning py-2">
                  <strong>Browser limitation:</strong> {directTcp.reason}
                </div>
                <p className="text-sm">
                  Install the <strong>POS Print Bridge</strong> on a PC/tablet on the same Wi‑Fi. The mobile browser sends print jobs to the bridge over HTTP; the bridge forwards raw ESC/POS to <code>IP:9100</code>.
                </p>
                <label className="form-label">Bridge URL</label>
                <div className="input-group input-group-sm mb-2">
                  <input className="form-control" value={bridgeUrl} onChange={(e) => setBridgeUrl(e.target.value)} placeholder={DEFAULT_BRIDGE_URL} />
                  <button type="button" className="btn btn-primary mb-0" onClick={saveBridge}>Save</button>
                  <button type="button" className="btn btn-outline-secondary mb-0" onClick={checkBridgeHealth}>Check</button>
                </div>
                {bridgeHealth ? (
                  <p className={`text-sm ${bridgeHealth.ok ? 'text-success' : 'text-danger'}`}>
                    {bridgeHealth.ok ? 'Bridge online' : bridgeHealth.message}
                  </p>
                ) : null}
                <p className="text-xs text-muted mb-0">
                  Run locally: <code>node print-bridge/server.mjs</code> (default port 17890)
                </p>
              </div>
              <div className="col-lg-5">
                <div className="card bg-light border-0">
                  <div className="card-body text-sm">
                    <strong>Supported browsers</strong>
                    <ul className="mb-0 ps-3">
                      <li>Chrome / Edge (desktop & Android)</li>
                      <li>Safari (iOS — bridge required)</li>
                      <li>Samsung Internet</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <PrinterFormModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSavePrinter}
        saving={saveStatus === 'loading'}
        errors={formErrors}
      />
    </div>
  );
}
