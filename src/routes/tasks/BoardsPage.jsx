import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FaBoxArchive, FaCopy, FaPen, FaPlus } from 'react-icons/fa6';
import { useRequireModuleAccess } from '../../hooks/useRequireModuleAccess.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { loadBoards } from '../../features/tasks/tasksSlice.js';
import * as api from '../../features/tasks/tasksAPI.js';
import { BOARD_COLORS, userInitials } from '../../features/tasks/tasksConstants.js';
import AppModal from '../../components/AppModal.jsx';
import { toast } from '../../utils/toast.js';
import '../../styles/tasks-module.css';

export default function BoardsPage() {
  useRequireModuleAccess('tasks');
  const { canCreate, canEdit, canDelete } = usePermissions('tasks');
  const dispatch = useDispatch();
  const { boards, boardsLoading, boardsError } = useSelector((s) => s.tasks);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', color: BOARD_COLORS[0] });
  const [saving, setSaving] = useState(false);

  const refresh = () => dispatch(loadBoards({ limit: 100 }));

  useEffect(() => {
    refresh();
  }, [dispatch]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', color: BOARD_COLORS[0] });
    setModalOpen(true);
  };

  const openEdit = (board, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditing(board);
    setForm({
      name: board.name || '',
      description: board.description || '',
      color: board.color || BOARD_COLORS[0],
    });
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.updateBoard(editing._id, form);
        toast.success('Board updated');
      } else {
        await api.createBoard(form);
        toast.success('Board created');
      }
      setModalOpen(false);
      refresh();
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onArchive = async (board, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!window.confirm(`Archive board "${board.name}"?`)) return;
    try {
      await api.archiveBoard(board._id);
      toast.success('Board archived');
      refresh();
    } catch (err) {
      toast.error(err.message || 'Archive failed');
    }
  };

  const onDuplicate = async (board, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    try {
      await api.duplicateBoard(board._id, { copy_tasks: false });
      toast.success('Board duplicated');
      refresh();
    } catch (err) {
      toast.error(err.message || 'Duplicate failed');
    }
  };

  const onSeed = async () => {
    try {
      await api.seedDemoBoard();
      toast.success('Demo board ready');
      refresh();
    } catch (err) {
      toast.error(err.message || 'Seed failed');
    }
  };

  return (
    <div className="tasks-module tasks-workspace">
      <div className="tasks-page-header">
        <div>
          <h4 className="mb-0">Task Boards</h4>
          <p className="text-muted mb-0 small">Organize work across Kanban boards</p>
        </div>
        <div className="tasks-board-toolbar">
          {canCreate ? (
            <button type="button" className="btn btn-sm btn-light" onClick={onSeed}>
              Seed demo board
            </button>
          ) : null}
          {canCreate ? (
            <button type="button" className="tasks-create-btn" onClick={openCreate}>
              <FaPlus size={12} />
              Create board
            </button>
          ) : null}
        </div>
      </div>

      {boardsError ? <div className="alert alert-danger">{boardsError}</div> : null}

      {boardsLoading ? (
        <div className="tasks-board-grid">
          {[1, 2, 3].map((i) => (
            <div key={i} className="tasks-skeleton-card" />
          ))}
        </div>
      ) : null}

      {!boardsLoading && !boards.length ? (
        <div className="tasks-empty-state">
          <h5>No boards yet</h5>
          <p className="text-muted">Create a board to start managing tasks.</p>
          {canCreate ? (
            <button type="button" className="tasks-create-btn" onClick={openCreate}>
              <FaPlus size={12} />
              Create your first board
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="tasks-board-grid">
        {boards.map((board) => {
          const members = board.members || [];
          return (
            <div key={board._id} className="tasks-board-card">
              <Link to={`/tasks/boards/${board._id}`} className="tasks-board-card__link">
                <div
                  className="tasks-board-card__banner"
                  style={{ '--board-color': board.color || '#3b82f6' }}
                >
                  <h5>{board.name}</h5>
                </div>
                <div className="tasks-board-card__body">
                  <p>{board.description || 'No description'}</p>
                </div>
              </Link>
              <div className="tasks-board-card__footer">
                <span className="tasks-board-card__meta">
                  {members.length ? (
                    <span className="tasks-avatar-stack">
                      {members.slice(0, 3).map((m) => (
                        <span key={m._id || m} className="tasks-avatar" title={m.name || m.email}>
                          {userInitials(m)}
                        </span>
                      ))}
                    </span>
                  ) : null}
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </span>
                <div className="tasks-board-actions">
                  {canEdit ? (
                    <button type="button" title="Edit board" onClick={(e) => openEdit(board, e)}>
                      <FaPen size={11} />
                    </button>
                  ) : null}
                  {canCreate ? (
                    <button type="button" title="Duplicate board" onClick={(e) => onDuplicate(board, e)}>
                      <FaCopy size={11} />
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className="is-danger"
                      title="Archive board"
                      onClick={(e) => onArchive(board, e)}
                    >
                      <FaBoxArchive size={11} />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AppModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit board' : 'Create board'}
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="board-form" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <form id="board-form" onSubmit={save}>
          <div className="mb-3">
            <label className="form-label">Name</label>
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="mb-2">
            <label className="form-label">Color</label>
            <div className="d-flex gap-2 flex-wrap">
              {BOARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="btn p-0"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: c,
                    border: form.color === c ? '3px solid #111' : '2px solid #fff',
                    boxShadow: '0 0 0 1px #ccc',
                  }}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                />
              ))}
            </div>
          </div>
        </form>
      </AppModal>
    </div>
  );
}
