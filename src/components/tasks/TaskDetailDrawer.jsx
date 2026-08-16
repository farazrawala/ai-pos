import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  FaBoxArchive,
  FaCalendarDays,
  FaCheck,
  FaFlag,
  FaPaperclip,
  FaPlus,
  FaRegCommentDots,
  FaTrashCan,
  FaUserGroup,
} from 'react-icons/fa6';
import AppModal from '../AppModal.jsx';
import { selectAuthUser } from '../../features/user/userSlice.js';
import * as api from '../../features/tasks/tasksAPI.js';
import {
  TASK_PRIORITIES,
  ATTACHMENT_ACCEPT,
  getLabelStyle,
  getPriorityMeta,
  userInitials,
} from '../../features/tasks/tasksConstants.js';
import { toast } from '../../utils/toast.js';

function toInputDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function SectionTitle({ children, icon: Icon }) {
  return (
    <h6 className="tasks-detail-section-title">
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </h6>
  );
}

export default function TaskDetailDrawer({
  open,
  taskId,
  columns = [],
  members = [],
  onClose,
  onChanged,
  canEdit = true,
  canDelete = true,
}) {
  const currentUser = useSelector(selectAuthUser);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');
  const [checklistTitle, setChecklistTitle] = useState('Checklist');
  const [newItemByChecklist, setNewItemByChecklist] = useState({});

  const load = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await api.fetchTask(taskId);
      setTask(res.data);
    } catch (e) {
      toast.error(e.message || 'Failed to load task');
      onClose?.();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && taskId) load();
    if (!open) setTask(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId]);

  const saveField = async (patch) => {
    if (!task || !canEdit) return;
    setSaving(true);
    try {
      const res = await api.updateTask(task._id, patch);
      setTask((prev) => ({ ...prev, ...res.data }));
      onChanged?.(res.data);
      toast.success('Task updated');
    } catch (e) {
      toast.error(e.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const submitComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    try {
      await api.addComment(task._id, { body: comment.trim() });
      setComment('');
      await load();
      onChanged?.();
      toast.success('Comment added');
    } catch (err) {
      toast.error(err.message || 'Failed to comment');
    }
  };

  const removeOwnComment = async (commentId, userId) => {
    if (String(userId) !== String(currentUser?._id) && !window.confirm('Delete this comment?')) return;
    try {
      await api.deleteComment(task._id, commentId);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e.message || 'Failed to delete comment');
    }
  };

  const addChecklist = async () => {
    try {
      await api.addChecklist(task._id, { title: checklistTitle || 'Checklist' });
      setChecklistTitle('Checklist');
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e.message || 'Failed to add checklist');
    }
  };

  const toggleItem = async (checklistId, itemId) => {
    try {
      await api.updateChecklist(task._id, checklistId, { toggle_item_id: itemId });
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e.message || 'Failed to update item');
    }
  };

  const addItem = async (checklistId) => {
    const title = String(newItemByChecklist[checklistId] || '').trim();
    if (!title) return;
    try {
      await api.updateChecklist(task._id, checklistId, { add_item: { title } });
      setNewItemByChecklist((prev) => ({ ...prev, [checklistId]: '' }));
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e.message || 'Failed to add item');
    }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await api.uploadTaskAttachment(task._id, file);
      await load();
      onChanged?.();
      toast.success('Attachment uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    }
  };

  const archive = async () => {
    if (!window.confirm('Archive this task?')) return;
    try {
      await api.archiveTask(task._id);
      toast.success('Task archived');
      onChanged?.();
      onClose?.();
    } catch (e) {
      toast.error(e.message || 'Archive failed');
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this task permanently?')) return;
    try {
      await api.deleteTask(task._id);
      toast.success('Task deleted');
      onChanged?.();
      onClose?.();
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    }
  };

  const priority = getPriorityMeta(task?.priority);
  const labels = task?.labels || [];

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        task ? (
          <span className="tasks-detail-modal-title">
            <span className="tasks-detail-modal-number">#{task.task_number}</span>
            {task.title}
          </span>
        ) : (
          'Task'
        )
      }
      subtitle={
        task ? (
          <span className="tasks-detail-modal-meta">
            <span
              className="tasks-label-chip tasks-detail-priority-chip"
              style={{ background: priority.chipBg, color: priority.chipColor }}
            >
              <FaFlag size={10} aria-hidden />
              {priority.label}
            </span>
            {task.is_completed ? (
              <span className="tasks-detail-status-chip is-done">
                <FaCheck size={10} aria-hidden />
                Completed
              </span>
            ) : null}
            {saving ? <span className="tasks-saving-pill">Saving…</span> : null}
          </span>
        ) : null
      }
      footer={
        <div className="tasks-detail-footer">
          <div className="tasks-detail-footer-left">
            {canDelete ? (
              <>
                <button type="button" className="tasks-detail-btn tasks-detail-btn-archive" onClick={archive}>
                  <FaBoxArchive aria-hidden />
                  Archive
                </button>
                <button type="button" className="tasks-detail-btn tasks-detail-btn-danger" onClick={remove}>
                  <FaTrashCan aria-hidden />
                  Delete
                </button>
              </>
            ) : null}
          </div>
          <button type="button" className="tasks-detail-btn tasks-detail-btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      {loading || !task ? (
        <div className="tasks-module tasks-detail-loading">
          <div className="tasks-skeleton-card" style={{ height: 72, marginBottom: '0.85rem' }} />
          <div className="tasks-skeleton-card" style={{ height: 140, marginBottom: '0.85rem' }} />
          <div className="tasks-skeleton-card" style={{ height: 100 }} />
        </div>
      ) : (
        <div className="tasks-module tasks-detail-layout">
          <div className="tasks-detail-main">
            <div className="tasks-detail-panel">
              <SectionTitle>Title</SectionTitle>
              <input
                className="tasks-detail-input tasks-detail-title-input"
                defaultValue={task.title}
                disabled={!canEdit || saving}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== task.title) {
                    saveField({ title: e.target.value.trim() });
                  }
                }}
              />
            </div>

            <div className="tasks-detail-panel">
              <SectionTitle>Description</SectionTitle>
              <textarea
                className="tasks-detail-input tasks-detail-textarea"
                rows={5}
                placeholder="Add a more detailed description…"
                defaultValue={task.description || ''}
                disabled={!canEdit || saving}
                onBlur={(e) => {
                  if (e.target.value !== (task.description || '')) {
                    saveField({ description: e.target.value });
                  }
                }}
              />
            </div>

            <div className="tasks-detail-panel">
              <SectionTitle>Checklists</SectionTitle>
              {(task.checklists || []).map((cl) => {
                const done = (cl.items || []).filter((i) => i.is_completed).length;
                const total = (cl.items || []).length;
                const pct = total ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={cl._id} className="tasks-checklist-card">
                    <div className="tasks-checklist-card-head">
                      <strong>{cl.title}</strong>
                      <span className={`tasks-checklist-progress-label ${pct === 100 ? 'is-done' : ''}`}>
                        {done}/{total} completed
                      </span>
                    </div>
                    <div className="tasks-checklist-bar" aria-hidden>
                      <div className="tasks-checklist-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="tasks-checklist-items">
                      {(cl.items || []).map((item) => (
                        <label
                          key={item._id}
                          className={`tasks-checklist-item ${item.is_completed ? 'is-done' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={!!item.is_completed}
                            disabled={!canEdit}
                            onChange={() => toggleItem(cl._id, item._id)}
                          />
                          <span>{item.title}</span>
                        </label>
                      ))}
                    </div>
                    {canEdit ? (
                      <div className="tasks-inline-add">
                        <input
                          className="tasks-detail-input"
                          placeholder="Add an item"
                          value={newItemByChecklist[cl._id] || ''}
                          onChange={(e) =>
                            setNewItemByChecklist((prev) => ({ ...prev, [cl._id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addItem(cl._id);
                            }
                          }}
                        />
                        <button type="button" className="tasks-detail-btn tasks-detail-btn-ghost" onClick={() => addItem(cl._id)}>
                          Add
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {canEdit ? (
                <div className="tasks-inline-add tasks-inline-add-primary">
                  <input
                    className="tasks-detail-input"
                    value={checklistTitle}
                    onChange={(e) => setChecklistTitle(e.target.value)}
                    placeholder="New checklist title"
                  />
                  <button type="button" className="tasks-detail-btn tasks-detail-btn-primary" onClick={addChecklist}>
                    <FaPlus size={11} aria-hidden />
                    Add checklist
                  </button>
                </div>
              ) : null}
            </div>

            <div className="tasks-detail-panel">
              <SectionTitle icon={FaRegCommentDots}>Comments</SectionTitle>
              <div className="tasks-comment-list">
                {(task.comments || []).map((c) => (
                  <div key={c._id} className="tasks-comment-card">
                    <div className="tasks-avatar" title={c.user_id?.name || 'User'}>
                      {userInitials(c.user_id)}
                    </div>
                    <div className="tasks-comment-body">
                      <div className="tasks-comment-meta">
                        <strong>{c.user_id?.name || 'User'}</strong>
                        <span>
                          {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                          {c.is_edited ? ' · edited' : ''}
                        </span>
                      </div>
                      <p>{c.body}</p>
                      {String(c.user_id?._id || c.user_id) === String(currentUser?._id) ? (
                        <button
                          type="button"
                          className="tasks-comment-delete"
                          onClick={() => removeOwnComment(c._id, c.user_id?._id || c.user_id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!task.comments?.length ? (
                  <div className="tasks-detail-empty">No comments yet. Start the conversation.</div>
                ) : null}
              </div>
              <form className="tasks-comment-compose" onSubmit={submitComment}>
                <textarea
                  className="tasks-detail-input tasks-detail-textarea"
                  rows={2}
                  placeholder="Add a comment… use @Name to mention"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button type="submit" className="tasks-detail-btn tasks-detail-btn-primary" disabled={!comment.trim()}>
                  Comment
                </button>
              </form>
            </div>

            <div className="tasks-detail-panel">
              <SectionTitle>Activity</SectionTitle>
              {(task.activity || []).map((a) => (
                <div key={a._id} className="tasks-activity-item">
                  <div>
                    <strong>{a.user_id?.name || 'User'}</strong> {String(a.action || '').replace(/_/g, ' ')}
                  </div>
                  <div className="text-muted small">
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                  </div>
                </div>
              ))}
              {!task.activity?.length ? <div className="tasks-detail-empty">No activity yet.</div> : null}
            </div>
          </div>

          <aside className="tasks-detail-aside">
            <div className="tasks-detail-panel tasks-detail-meta-panel">
              <SectionTitle>Status</SectionTitle>
              <select
                className="tasks-detail-input"
                value={task.column_id?._id || task.column_id || ''}
                disabled={!canEdit}
                onChange={(e) => saveField({ column_id: e.target.value })}
              >
                {columns.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="tasks-detail-panel tasks-detail-meta-panel">
              <SectionTitle icon={FaFlag}>Priority</SectionTitle>
              <select
                className="tasks-detail-input"
                value={task.priority || 'medium'}
                disabled={!canEdit}
                onChange={(e) => saveField({ priority: e.target.value })}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="tasks-detail-panel tasks-detail-meta-panel">
              <SectionTitle icon={FaUserGroup}>Assignees</SectionTitle>
              <select
                className="tasks-detail-input tasks-detail-multi"
                multiple
                size={Math.min(6, Math.max(3, members.length || 3))}
                value={(task.assignee_ids || []).map((a) => String(a._id || a))}
                disabled={!canEdit}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                  saveField({ assignee_ids: selected });
                }}
              >
                {members.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name || m.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="tasks-detail-panel tasks-detail-meta-panel">
              <SectionTitle>Labels</SectionTitle>
              {labels.length ? (
                <div className="tasks-card-labels mb-2">
                  {labels.map((label) => {
                    const tone = getLabelStyle(label);
                    return (
                      <span
                        key={label}
                        className="tasks-label-chip"
                        style={{ background: tone.bg, color: tone.color }}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              ) : null}
              <input
                className="tasks-detail-input"
                defaultValue={labels.join(', ')}
                disabled={!canEdit}
                placeholder="comma, separated"
                onBlur={(e) => {
                  const next = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  saveField({ labels: next });
                }}
              />
            </div>

            <div className="tasks-detail-panel tasks-detail-meta-panel">
              <SectionTitle icon={FaCalendarDays}>Dates</SectionTitle>
              <label className="tasks-detail-field-label">Start</label>
              <input
                type="date"
                className="tasks-detail-input mb-2"
                defaultValue={toInputDate(task.start_date)}
                disabled={!canEdit}
                onChange={(e) => saveField({ start_date: e.target.value || null })}
              />
              <label className="tasks-detail-field-label">Due</label>
              <input
                type="date"
                className="tasks-detail-input"
                defaultValue={toInputDate(task.due_date)}
                disabled={!canEdit}
                onChange={(e) => saveField({ due_date: e.target.value || null })}
              />
            </div>

            <div className="tasks-detail-panel tasks-detail-meta-panel">
              <label className={`tasks-completed-toggle ${task.is_completed ? 'is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!task.is_completed}
                  disabled={!canEdit}
                  onChange={(e) => saveField({ is_completed: e.target.checked })}
                />
                <span className="tasks-completed-toggle-box" aria-hidden>
                  <FaCheck size={12} />
                </span>
                <span>
                  <strong>{task.is_completed ? 'Completed' : 'Mark completed'}</strong>
                  <small>{task.is_completed ? 'Task is done' : 'Toggle when finished'}</small>
                </span>
              </label>
            </div>

            <div className="tasks-detail-panel tasks-detail-meta-panel">
              <SectionTitle icon={FaPaperclip}>Attachments</SectionTitle>
              <div className="tasks-attachment-list">
                {(task.attachments || []).map((att) => (
                  <a
                    key={att._id}
                    href={att.url}
                    target="_blank"
                    rel="noreferrer"
                    className="tasks-attachment-card"
                  >
                    <span className="tasks-attachment-icon">
                      <FaPaperclip size={12} aria-hidden />
                    </span>
                    <span>
                      <strong>{att.name}</strong>
                      <small>
                        {(att.size / 1024).toFixed(1)} KB · {att.mime_type || 'file'}
                      </small>
                    </span>
                  </a>
                ))}
              </div>
              {canEdit ? (
                <label className="tasks-upload-dropzone">
                  <input type="file" accept={ATTACHMENT_ACCEPT} onChange={onUpload} />
                  <FaPaperclip aria-hidden />
                  <span>
                    <strong>Upload a file</strong>
                    <small>PDF, images, docs, zip</small>
                  </span>
                </label>
              ) : null}
            </div>
          </aside>
        </div>
      )}
    </AppModal>
  );
}
