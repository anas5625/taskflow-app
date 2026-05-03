import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const COLUMNS = [
  { key: 'todo', label: 'To Do', color: '#7c7c8e' },
  { key: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { key: 'review', label: 'Review', color: '#f59e0b' },
  { key: 'done', label: 'Done', color: '#22c55e' },
];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const priorityColors = { low: '#7c7c8e', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' };

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban'); // kanban | list
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', status: 'todo', priority: 'medium', assignee_id: '', due_date: '' });
  const [memberForm, setMemberForm] = useState({ userId: '', role: 'member' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    Promise.all([
      api.get(`/projects/${id}`),
      api.get(`/projects/${id}/tasks`),
      api.get('/users'),
    ]).then(([projRes, taskRes, usersRes]) => {
      setProject(projRes.data.project);
      setMembers(projRes.data.members);
      setTasks(taskRes.data.tasks);
      setAllUsers(usersRes.data.users);
    }).finally(() => setLoading(false));
  }, [id]);

  const openCreateTask = () => {
    setSelectedTask(null);
    setTaskForm({ title: '', description: '', status: 'todo', priority: 'medium', assignee_id: '', due_date: '' });
    setError('');
    setShowTaskModal(true);
  };

  const openEditTask = (task) => {
    setSelectedTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assignee_id: task.assignee_id || '',
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
    });
    setError('');
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const payload = { ...taskForm, assignee_id: taskForm.assignee_id || null, due_date: taskForm.due_date || null };
      if (selectedTask) {
        const res = await api.put(`/projects/${id}/tasks/${selectedTask.id}`, payload);
        setTasks(t => t.map(x => x.id === selectedTask.id ? res.data.task : x));
      } else {
        const res = await api.post(`/projects/${id}/tasks`, payload);
        setTasks(t => [res.data.task, ...t]);
      }
      setShowTaskModal(false);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    await api.delete(`/projects/${id}/tasks/${taskId}`);
    setTasks(t => t.filter(x => x.id !== taskId));
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await api.put(`/projects/${id}/tasks/${taskId}`, { status: newStatus });
      setTasks(t => t.map(x => x.id === taskId ? res.data.task : x));
    } catch {}
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api.post(`/projects/${id}/members`, memberForm);
      const projRes = await api.get(`/projects/${id}`);
      setMembers(projRes.data.members);
      setShowMemberModal(false);
      setMemberForm({ userId: '', role: 'member' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member?')) return;
    await api.delete(`/projects/${id}/members/${userId}`);
    setMembers(m => m.filter(x => x.id !== userId));
  };

  if (loading) return <div className="loading-page"><span className="spinner" style={{width:32,height:32}} /></div>;
  if (!project) return <div>Project not found</div>;

  const tasksByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.key] = tasks.filter(t => t.status === col.key);
    return acc;
  }, {});

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <div style={{fontSize:12.5, color:'var(--text-muted)', marginBottom:8}}>
          <Link to="/projects" style={{color:'var(--text-muted)', textDecoration:'none'}}>Projects</Link> → {project.name}
        </div>
        <div className="page-header" style={{marginBottom:0}}>
          <div>
            <h1 className="page-title">{project.name}</h1>
            {project.description && <p className="page-subtitle">{project.description}</p>}
          </div>
          <div style={{display:'flex', gap:10}}>
            {isAdmin && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setShowMemberModal(true); }}>
                👥 Members ({members.length})
              </button>
            )}
            <button className="btn btn-primary" onClick={openCreateTask}>+ Add Task</button>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div style={{display:'flex', gap:4, marginBottom:20, background:'var(--bg-elevated)', padding:4, borderRadius:'var(--radius-sm)', width:'fit-content'}}>
        {['kanban', 'list'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding:'6px 14px', borderRadius:'6px', border:'none', cursor:'pointer',
            background: view === v ? 'var(--accent)' : 'transparent',
            color: view === v ? '#fff' : 'var(--text-muted)',
            fontSize:13, fontWeight:500, fontFamily:'var(--font-body)',
            transition:'all 0.15s',
          }}>{v === 'kanban' ? '⬛ Kanban' : '☰ List'}</button>
        ))}
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="kanban-board">
          {COLUMNS.map(col => (
            <div key={col.key} className="kanban-col">
              <div className="kanban-col-header">
                <span style={{color: col.color}}>{col.label}</span>
                <span className="kanban-count">{tasksByStatus[col.key].length}</span>
              </div>
              {tasksByStatus[col.key].length === 0 ? (
                <div style={{textAlign:'center', color:'var(--text-dim)', fontSize:12, padding:'20px 0'}}>No tasks</div>
              ) : (
                tasksByStatus[col.key].map(task => (
                  <div key={task.id} className="task-card" onClick={() => openEditTask(task)}>
                    <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6, marginBottom:6}}>
                      <div className="task-card-title">{task.title}</div>
                      <div style={{width:8, height:8, borderRadius:'50%', background: priorityColors[task.priority], flexShrink:0, marginTop:4}} />
                    </div>
                    <div className="task-card-meta">
                      <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                      {task.is_overdue && <span className="badge badge-overdue">Overdue</span>}
                      {task.assignee_name && <span className="task-assignee">→ {task.assignee_name}</span>}
                    </div>
                    {task.due_date && (
                      <div style={{fontSize:11, color: task.is_overdue ? 'var(--danger)' : 'var(--text-dim)', marginTop:6}}>
                        📅 {new Date(task.due_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign:'center', color:'var(--text-muted)', padding:32}}>No tasks yet</td></tr>
              ) : tasks.map(task => (
                <tr key={task.id}>
                  <td>
                    <div style={{fontWeight:500}}>{task.title}</div>
                    {task.description && <div style={{fontSize:12, color:'var(--text-muted)', marginTop:2}}>{task.description.substring(0,60)}{task.description.length > 60 ? '...' : ''}</div>}
                  </td>
                  <td>
                    <select className="form-select" style={{width:'auto', padding:'4px 8px', fontSize:12}}
                      value={task.status} onChange={e => handleStatusChange(task.id, e.target.value)}>
                      {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </td>
                  <td><span className={`badge badge-${task.priority}`}>{task.priority}</span></td>
                  <td style={{color:'var(--text-muted)', fontSize:13}}>{task.assignee_name || '—'}</td>
                  <td style={{fontSize:13, color: task.is_overdue ? 'var(--danger)' : 'var(--text-muted)'}}>
                    {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
                    {task.is_overdue && ' ⚠️'}
                  </td>
                  <td>
                    <div style={{display:'flex', gap:6}}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEditTask(task)}>Edit</button>
                      {(isAdmin || task.created_by === user.id) && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(task.id)}>Del</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTaskModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{selectedTask ? 'Edit Task' : 'New Task'}</span>
              <button className="modal-close" onClick={() => setShowTaskModal(false)}>×</button>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSaveTask}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" placeholder="Task title" value={taskForm.title}
                  onChange={e => setTaskForm(f => ({...f, title: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" placeholder="Task description..."
                  value={taskForm.description} onChange={e => setTaskForm(f => ({...f, description: e.target.value}))} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={taskForm.status} onChange={e => setTaskForm(f => ({...f, status: e.target.value}))}>
                    {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={taskForm.priority} onChange={e => setTaskForm(f => ({...f, priority: e.target.value}))}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Assignee</label>
                  <select className="form-select" value={taskForm.assignee_id} onChange={e => setTaskForm(f => ({...f, assignee_id: e.target.value}))}>
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input className="form-input" type="date" value={taskForm.due_date}
                    onChange={e => setTaskForm(f => ({...f, due_date: e.target.value}))} />
                </div>
              </div>
              <div style={{display:'flex', gap:10, justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (selectedTask ? 'Update Task' : 'Create Task')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowMemberModal(false)}>
          <div className="modal" style={{maxWidth:560}}>
            <div className="modal-header">
              <span className="modal-title">Project Members</span>
              <button className="modal-close" onClick={() => setShowMemberModal(false)}>×</button>
            </div>

            <div style={{marginBottom:20}}>
              <h4 style={{fontSize:12, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10}}>Current Members</h4>
              {members.map(m => (
                <div key={m.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg-elevated)', borderRadius:'var(--radius-sm)', marginBottom:6}}>
                  <div>
                    <span style={{fontWeight:500, fontSize:13.5}}>{m.name}</span>
                    <span style={{color:'var(--text-muted)', fontSize:12, marginLeft:8}}>{m.email}</span>
                  </div>
                  <div style={{display:'flex', gap:8, alignItems:'center'}}>
                    <span className={`badge badge-${m.role}`}>{m.role}</span>
                    {isAdmin && m.id !== user.id && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.id)}>Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {isAdmin && (
              <>
                <div className="divider" />
                <h4 style={{fontSize:12, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10}}>Add Member</h4>
                {error && <div className="error-msg">{error}</div>}
                <form onSubmit={handleAddMember}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">User</label>
                      <select className="form-select" value={memberForm.userId} onChange={e => setMemberForm(f => ({...f, userId: e.target.value}))} required>
                        <option value="">Select user...</option>
                        {allUsers.filter(u => !members.find(m => m.id === u.id)).map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Role</label>
                      <select className="form-select" value={memberForm.role} onChange={e => setMemberForm(f => ({...f, role: e.target.value}))}>
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div style={{display:'flex', justifyContent:'flex-end'}}>
                    <button type="submit" className="btn btn-primary" disabled={saving || !memberForm.userId}>
                      {saving ? 'Adding...' : 'Add Member'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
