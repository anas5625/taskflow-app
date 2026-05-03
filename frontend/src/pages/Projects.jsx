import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/projects')
      .then(res => setProjects(res.data.projects))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true); setError('');
    try {
      const res = await api.post('/projects', form);
      setProjects(p => [res.data.project, ...p]);
      setShowCreate(false);
      setForm({ name: '', description: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project and all its tasks?')) return;
    await api.delete(`/projects/${id}`);
    setProjects(p => p.filter(x => x.id !== id));
  };

  const statusColors = { active: 'var(--success)', completed: 'var(--info)', archived: 'var(--text-dim)' };

  if (loading) return <div className="loading-page"><span className="spinner" style={{width:32,height:32}} /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''} accessible to you</p>
        </div>
        {user.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Project</button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <div className="empty-text">No projects yet{user.role === 'admin' ? '. Create your first project!' : '. Ask an admin to add you to a project.'}</div>
        </div>
      ) : (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16}}>
          {projects.map(project => (
            <div key={project.id} className="card" style={{cursor:'pointer', transition:'all 0.15s', position:'relative'}}>
              <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:8}}>
                <div>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                    <span style={{width:8, height:8, borderRadius:'50%', background: statusColors[project.status], flexShrink:0}} />
                    <span style={{fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600}}>{project.status}</span>
                  </div>
                  <Link to={`/projects/${project.id}`} style={{textDecoration:'none', color:'inherit'}}>
                    <h3 style={{fontFamily:'var(--font-display)', fontWeight:700, fontSize:16}}>{project.name}</h3>
                  </Link>
                </div>
                {user.role === 'admin' && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(project.id)}>🗑</button>
                )}
              </div>
              {project.description && (
                <p style={{fontSize:13, color:'var(--text-muted)', marginBottom:12, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>{project.description}</p>
              )}
              <div style={{display:'flex', gap:12, fontSize:12, color:'var(--text-muted)', borderTop:'1px solid var(--border)', paddingTop:12, marginTop:8}}>
                <span>👥 {project.member_count} member{project.member_count !== '1' ? 's' : ''}</span>
                <span>📋 {project.task_count} task{project.task_count !== '1' ? 's' : ''}</span>
              </div>
              {project.owner_name && (
                <div style={{fontSize:11.5, color:'var(--text-dim)', marginTop:6}}>by {project.owner_name}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">New Project</span>
              <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input className="form-input" placeholder="e.g. Website Redesign" value={form.name}
                  onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" placeholder="What is this project about?"
                  value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
              </div>
              <div style={{display:'flex', gap:10, justifyContent:'flex-end'}}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
