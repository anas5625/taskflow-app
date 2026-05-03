import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Team() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users').then(res => setUsers(res.data.users)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><span className="spinner" style={{width:32,height:32}} /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">{users.length} user{users.length !== 1 ? 's' : ''} registered</p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <div className="user-avatar" style={{width:30, height:30, fontSize:11}}>
                      {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                    </div>
                    <span style={{fontWeight:500}}>{u.name}</span>
                    {u.id === user.id && <span style={{fontSize:11, color:'var(--accent)'}}>(you)</span>}
                  </div>
                </td>
                <td style={{color:'var(--text-muted)'}}>{u.email}</td>
                <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                <td style={{color:'var(--text-muted)', fontSize:13}}>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
