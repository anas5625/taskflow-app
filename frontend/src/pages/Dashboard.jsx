import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const statusLabel = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const priorityColors = { low: '#7c7c8e', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' };

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/dashboard')
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><span className="spinner" style={{width:32,height:32}} /></div>;

  const { stats, my_tasks, recent_activity } = data;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👋 Hello, {user.name.split(' ')[0]}</h1>
          <p className="page-subtitle">Here's what's happening across your projects</p>
        </div>
        {user.role === 'admin' && (
          <Link to="/projects/new" className="btn btn-primary">+ New Project</Link>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{color:'var(--accent)'}}>{stats.total_projects}</div>
          <div className="stat-label">Projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.todo}</div>
          <div className="stat-label">To Do</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color:'var(--info)'}}>{stats.in_progress}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color:'var(--warning)'}}>{stats.review}</div>
          <div className="stat-label">In Review</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color:'var(--success)'}}>{stats.done}</div>
          <div className="stat-label">Done</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color: stats.overdue > 0 ? 'var(--danger)' : 'var(--text)'}}>{stats.overdue}</div>
          <div className="stat-label">Overdue</div>
        </div>
      </div>

      <div className="grid-2" style={{gap: 24}}>
        <div className="card">
          <h3 style={{fontFamily:'var(--font-display)', fontWeight:700, marginBottom:16}}>My Tasks</h3>
          {my_tasks.length === 0 ? (
            <div className="empty-state" style={{padding:'24px 0'}}>
              <div className="empty-icon">✅</div>
              <div className="empty-text">No pending tasks</div>
            </div>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {my_tasks.map(task => (
                <div key={task.id} style={{
                  padding: '10px 14px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${task.is_overdue ? 'rgba(239,68,68,0.2)' : 'var(--border)'}`,
                  display:'flex', alignItems:'center', gap:10,
                }}>
                  <div style={{
                    width: 3, height: 32, borderRadius: 2,
                    background: priorityColors[task.priority] || '#3b82f6',
                    flexShrink: 0
                  }} />
                  <div style={{flex:1, overflow:'hidden'}}>
                    <div style={{fontSize:13.5, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{task.title}</div>
                    <div style={{fontSize:11.5, color:'var(--text-muted)'}}>{task.project_name}</div>
                  </div>
                  <span className={`badge badge-${task.status}`}>{statusLabel[task.status]}</span>
                  {task.is_overdue && <span className="badge badge-overdue">Overdue</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{fontFamily:'var(--font-display)', fontWeight:700, marginBottom:16}}>Recent Activity</h3>
          {recent_activity.length === 0 ? (
            <div className="empty-state" style={{padding:'24px 0'}}>
              <div className="empty-icon">📭</div>
              <div className="empty-text">No recent activity</div>
            </div>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {recent_activity.map(task => (
                <div key={task.id} style={{padding:'10px 14px', background:'var(--bg-elevated)', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)'}}>
                  <div style={{fontSize:13.5, fontWeight:500, marginBottom:4}}>{task.title}</div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontSize:11.5, color:'var(--text-muted)'}}>{task.project_name}</span>
                    <span className={`badge badge-${task.status}`}>{statusLabel[task.status]}</span>
                  </div>
                  {task.assignee_name && (
                    <div style={{fontSize:11.5, color:'var(--text-muted)', marginTop:2}}>→ {task.assignee_name}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
