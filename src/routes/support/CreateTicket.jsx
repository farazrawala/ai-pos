import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FaCloudArrowUp, FaPaperclip } from 'react-icons/fa6';
import { createSupportTicket, clearCreateStatus } from '../../features/support/supportSlice.js';
import {
  ATTACHMENT_ACCEPT,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  getTicketId,
  isAttachmentAllowed,
} from '../../features/support/supportConstants.js';
import AttachmentPreview from '../../components/support/AttachmentPreview.jsx';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { toast } from '../../utils/toast.js';
import '../../styles/support-module.css';

const INITIAL_FORM = {
  subject: '',
  category: '',
  priority: 'medium',
  description: '',
};

export default function CreateTicket() {
  useRequireModuleAccess('support');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(clearCreateStatus());
    return () => {
      files.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, [dispatch]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const addFiles = useCallback((incoming) => {
    const list = Array.from(incoming || []);
    if (!list.length) return;
    const next = [];
    list.forEach((file) => {
      if (!isAttachmentAllowed(file)) {
        toast.error(`"${file.name}" is not allowed or exceeds 10 MB.`);
        return;
      }
      if (file.type?.startsWith('image/')) {
        file.previewUrl = URL.createObjectURL(file);
      }
      next.push(file);
    });
    if (next.length) setFiles((prev) => [...prev, ...next]);
  }, []);

  const removeFile = (index) => {
    setFiles((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  };

  const validate = () => {
    const next = {};
    if (!String(form.subject || '').trim()) next.subject = 'Subject is required';
    if (!form.category) next.category = 'Category is required';
    if (!form.priority) next.priority = 'Priority is required';
    if (!String(form.description || '').trim()) next.description = 'Description is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      const result = await dispatch(
        createSupportTicket({
          subject: form.subject.trim(),
          category: form.category,
          priority: form.priority,
          description: form.description.trim(),
          message: form.description.trim(),
          attachments: files,
        })
      ).unwrap();
      toast.success('Ticket created successfully.');
      const id = getTicketId(result);
      navigate(id ? `/support/${id}` : '/support', { replace: true });
    } catch (err) {
      toast.error(err || 'Failed to create ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer?.files);
  };

  return (
    <div className="container-fluid py-4 support-module">
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb bg-transparent mb-0 p-0">
          <li className="breadcrumb-item">
            <Link to="/">Home</Link>
          </li>
          <li className="breadcrumb-item">
            <Link to="/support">Support</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Create Ticket
          </li>
        </ol>
      </nav>

      <div className="row justify-content-center">
        <div className="col-12 col-lg-8 col-xl-7">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-transparent border-0">
              <h5 className="mb-0">Create Support Ticket</h5>
              <p className="text-sm text-muted mb-0">Describe your issue and our team will get back to you</p>
            </div>
            <div className="card-body pt-0">
              <form onSubmit={onSubmit} noValidate>
                <div className="mb-3">
                  <label className="form-label" htmlFor="ticket-subject">
                    Subject <span className="text-danger">*</span>
                  </label>
                  <input
                    id="ticket-subject"
                    type="text"
                    className={`form-control ${errors.subject ? 'is-invalid' : ''}`}
                    value={form.subject}
                    onChange={(e) => updateField('subject', e.target.value)}
                    placeholder="Brief summary of your issue"
                    maxLength={200}
                    disabled={submitting}
                  />
                  {errors.subject ? <div className="invalid-feedback">{errors.subject}</div> : null}
                </div>

                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label" htmlFor="ticket-category">
                      Category <span className="text-danger">*</span>
                    </label>
                    <select
                      id="ticket-category"
                      className={`form-select ${errors.category ? 'is-invalid' : ''}`}
                      value={form.category}
                      onChange={(e) => updateField('category', e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">Select category</option>
                      {TICKET_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {errors.category ? <div className="invalid-feedback">{errors.category}</div> : null}
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label" htmlFor="ticket-priority">
                      Priority <span className="text-danger">*</span>
                    </label>
                    <select
                      id="ticket-priority"
                      className={`form-select ${errors.priority ? 'is-invalid' : ''}`}
                      value={form.priority}
                      onChange={(e) => updateField('priority', e.target.value)}
                      disabled={submitting}
                    >
                      {TICKET_PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    {errors.priority ? <div className="invalid-feedback">{errors.priority}</div> : null}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label" htmlFor="ticket-description">
                    Description <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="ticket-description"
                    className={`form-control support-rich-textarea ${errors.description ? 'is-invalid' : ''}`}
                    rows={8}
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Provide as much detail as possible…"
                    disabled={submitting}
                  />
                  {errors.description ? <div className="invalid-feedback">{errors.description}</div> : null}
                </div>

                <div className="mb-4">
                  <label className="form-label">Attachments</label>
                  <div
                    className={`support-dropzone ${dragging ? 'is-dragging' : ''}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    aria-label="Upload attachments"
                  >
                    <FaCloudArrowUp className="support-dropzone__icon" aria-hidden />
                    <p className="mb-1 fw-semibold">Drag & drop files here</p>
                    <p className="text-xs text-muted mb-0">
                      Images, PDF, ZIP, DOCX · max 10 MB each · <FaPaperclip className="me-1" />
                      click to browse
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="d-none"
                      multiple
                      accept={ATTACHMENT_ACCEPT}
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = '';
                      }}
                      disabled={submitting}
                    />
                  </div>
                  {files.length > 0 ? (
                    <div className="support-reply-box__files mt-2">
                      {files.map((file, idx) => (
                        <AttachmentPreview
                          key={`${file.name}-${idx}`}
                          file={file}
                          onRemove={() => removeFile(idx)}
                          compact
                        />
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="d-flex justify-content-between gap-2">
                  <Link to="/support" className={`btn btn-outline-secondary mb-0 ${submitting ? 'disabled' : ''}`}>
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-primary mb-0" disabled={submitting}>
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                        Submitting…
                      </>
                    ) : (
                      'Submit Ticket'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
