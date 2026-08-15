import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import AppModal from '../AppModal.jsx';
import { selectAuthUser } from '../../features/user/userSlice.js';
import * as api from '../../features/tasks/tasksAPI.js';
import { TASK_PRIORITIES, ATTACHMENT_ACCEPT, getPriorityMeta } from '../../features/tasks/tasksConstants.js';
import { toast } from '../../utils/toast.js';

function toInputDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
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

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="xl"
      title={task ? `#${task.task_number} ${task.title}` : 'Task'}
      subtitle={task ? priority.label : ''}
      footer={
        <div className="d-flex justify-content-between w-100">
          <div className="d-flex gap-2">
            {canDelete ? (
              <>
                <button type="button" className="btn btn-outline-warning btn-sm" onClick={archive}>
                  Archive
                </button>
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={remove}>
                  Delete
                </button>
              </>
            ) : null}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      {loading || !task ? (
        <div className="p-4 text-center text-muted">Loading…</div>
      ) : (
        <div className="row">
          <div className="col-lg-8">
            <div className="tasks-detail-section">
              <h6>Title</h6>
              <input
                className="form-control"
                defaultValue={task.title}
                disabled={!canEdit || saving}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== task.title) {
                    saveField({ title: e.target.value.trim() });
                  }
                }}
              />
            </div>
            <div className="tasks-detail-section">
              <h6>Description</h6>
              <textarea
                className="form-control"
                rows={5}
                defaultValue={task.description || ''}
                disabled={!canEdit || saving}
                onBlur={(e) => {
                  if (e.target.value !== (task.description || '')) {
                    saveField({ description: e.target.value });
                  }
                }}
              />
            </div>

            <div className="tasks-detail-section">
              <h6>Checklists</h6>
              {(task.checklists || []).map((cl) => {
                const done = (cl.items || []).filter((i) => i.is_completed).length;
                const total = (cl.items || []).length;
                return (
                  <div key={cl._id} className="border rounded p-2 mb-2">
                    <div className="d-flex justify-content-between mb-2">
                      <strong>{cl.title}</strong>
                      <span className="text-muted small">
                        {done}/{total} completed
                      </span>
                    </div>
                    {(cl.items || []).map((item) => (
                      <label key={item._id} className="d-flex align-items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          checked={!!item.is_completed}
                          disabled={!canEdit}
                          onChange={() => toggleItem(cl._id, item._id)}
                        />
                        <span className={item.is_completed ? 'text-decoration-line-through text-muted' : ''}>
                          {item.title}
                        </span>
                      </label>
                    ))}
                    {canEdit ? (
                      <div className="input-group input-group-sm mt-2">
                        <input
                          className="form-control"
                          placeholder="Add item"
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
                        <button type="button" className="btn btn-outline-primary" onClick={() => addItem(cl._id)}>
                          Add
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {canEdit ? (
                <div className="input-group input-group-sm">
                  <input
                    className="form-control"
                    value={checklistTitle}
                    onChange={(e) => setChecklistTitle(e.target.value)}
                    placeholder="New checklist title"
                  />
                  <button type="button" className="btn btn-primary" onClick={addChecklist}>
                    Add checklist
                  </button>
                </div>
              ) : null}
            </div>

            <div className="tasks-detail-section">
              <h6>Comments</h6>
              <div className="mb-3">
                {(task.comments || []).map((c) => (
                  <div key={c._id} className="border rounded p-2 mb-2">
                    <div className="d-flex justify-content-between">
                      <strong>{c.user_id?.name || 'User'}</strong>
                      <span className="text-muted small">
                        {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                        {c.is_edited ? ' (edited)' : ''}
                      </span>
                    </div>
                    <div className="mt-1">{c.body}</div>
                    {String(c.user_id?._id || c.user_id) === String(currentUser?._id) ? (
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-danger p-0 mt-1"
                        onClick={() => removeOwnComment(c._id, c.user_id?._id || c.user_id)}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <form onSubmit={submitComment}>
                <textarea
                  className="form-control mb-2"
                  rows={2}
                  placeholder="Add a comment… use @Name to mention"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <button type="submit" className="btn btn-sm btn-primary">
                  Comment
                </button>
              </form>
            </div>

            <div className="tasks-detail-section">
              <h6>Activity</h6>
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
              {!task.activity?.length ? <div className="text-muted">No activity yet.</div> : null}
            </div>
          </div>

          <div className="col-lg-4">
            <div className="tasks-detail-section">
              <h6>Status / Column</h6>
              <select
                className="form-select form-select-sm"
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
            <div className="tasks-detail-section">
              <h6>Priority</h6>
              <select
                className="form-select form-select-sm"
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
            <div className="tasks-detail-section">
              <h6>Assignees</h6>
              <select
                className="form-select form-select-sm"
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
            <div className="tasks-detail-section">
              <h6>Labels</h6>
              <input
                className="form-control form-control-sm"
                defaultValue={(task.labels || []).join(', ')}
                disabled={!canEdit}
                placeholder="comma,separated"
                onBlur={(e) => {
                  const labels = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  saveField({ labels });
                }}
              />
            </div>
            <div className="tasks-detail-section">
              <h6>Dates</h6>
              <label className="form-label small mb-0">Start</label>
              <input
                type="date"
                className="form-control form-control-sm mb-2"
                defaultValue={toInputDate(task.start_date)}
                disabled={!canEdit}
                onChange={(e) => saveField({ start_date: e.target.value || null })}
              />
              <label className="form-label small mb-0">Due</label>
              <input
                type="date"
                className="form-control form-control-sm"
                defaultValue={toInputDate(task.due_date)}
                disabled={!canEdit}
                onChange={(e) => saveField({ due_date: e.target.value || null })}
              />
            </div>
            <div className="tasks-detail-section">
              <h6>Completed</h6>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={!!task.is_completed}
                  disabled={!canEdit}
                  onChange={(e) => saveField({ is_completed: e.target.checked })}
                  id="task-completed"
                />
                <label className="form-check-label" htmlFor="task-completed">
                  Mark completed
                </label>
              </div>
            </div>
            <div className="tasks-detail-section">
              <h6>Attachments</h6>
              {(task.attachments || []).map((att) => (
                <div key={att._id} className="small border rounded p-2 mb-1">
                  <a href={att.url} target="_blank" rel="noreferrer">
                    {att.name}
                  </a>
                  <div className="text-muted">
                    {(att.size / 1024).toFixed(1)} KB · {att.mime_type || 'file'}
                  </div>
                </div>
              ))}
              {canEdit ? (
                <input type="file" className="form-control form-control-sm" accept={ATTACHMENT_ACCEPT} onChange={onUpload} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </AppModal>
  );
}
