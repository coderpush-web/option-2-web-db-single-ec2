import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, Plus, Database, Server, Clock, HardDrive, 
  Trash2, ShieldAlert, Cpu, Layers, Tag
} from 'lucide-react';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [dbInfo, setDbInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data.tasks || []);
      setDbInfo(data.dbInfo || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle, priority: 'High' })
      });
      if (res.ok) {
        setNewTaskTitle('');
        fetchTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const env = dbInfo?.env || 'Production';
  const isDev = env.toLowerCase() === 'dev';

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', padding: '24px 32px' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '20px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '10px', borderRadius: '10px', display: 'flex' }}>
            <CheckSquare size={28} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>TaskOrbit DevOps Board</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Option 2: Web App + Embedded SQLite DB on Single EC2 (Dockerized)</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ 
            background: isDev ? 'rgba(234, 179, 8, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
            color: isDev ? '#eab308' : '#10b981', 
            border: `1px solid ${isDev ? '#eab308' : '#10b981'}`,
            padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600'
          }}>
            {env.toUpperCase()} ENVIRONMENT
          </span>

          <span style={{ background: '#1e293b', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={14} color="#10b981" /> SQLite 3 File DB
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
        
        {/* Left Column: Task Creator & Board */}
        <div style={{ gridColumn: 'span 8' }}>
          {/* New Task Input Card */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '12px' }}>
              <input 
                type="text" 
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Nhập nhiệm vụ mới (ví dụ: Update Dockerfile on ECR, Run CI check)..."
                style={{ flex: 1, background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', padding: '12px 16px', color: '#f8fafc', fontSize: '14px' }}
              />
              <button 
                type="submit"
                style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0 20px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} /> Thêm Task
              </button>
            </form>
          </div>

          {/* Task List */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="#10b981" /> Danh sách Tasks lưu trữ tại SQLite ({tasks.length})
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'normal' }}>Volume Mount: /var/data/sqlite</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tasks.map((task) => (
                <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#f1f5f9' }}>{task.title}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>ID: #{task.id} • Created: {task.created_at}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ background: '#1e293b', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>{task.priority || 'Normal'}</span>
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: DB & Architecture Specs */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SQLite Engine Spec */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={16} /> SQLite Database Engine
            </h4>
            <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 8px 0' }}><strong>Kiểu CSDL:</strong> Embedded SQLite File</p>
              <p style={{ margin: '0 0 8px 0' }}><strong>Đường dẫn lưu trữ:</strong> <code>/app/data/app.sqlite</code></p>
              <p style={{ margin: '0 0 8px 0' }}><strong>Tổng số bản ghi:</strong> {tasks.length} rows</p>
              <p style={{ margin: 0 }}><strong>Trạng thái kết nối:</strong> <span style={{ color: '#10b981' }}>● Active (Local I/O)</span></p>
            </div>
          </div>

          {/* Tradeoff Alert Box */}
          <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#eab308', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} /> Đánh giá Kiến trúc (Option 2)
            </h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
              Cơ sở dữ liệu đặt cùng EC2 giúp tối ưu chi phí thấp nhất (~$21/tháng). Tuy nhiên, rủi ro I/O contention và thiếu HA khi instance gặp sự cố phần cứng.
            </p>
          </div>

          {/* Domain mapping */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#f8fafc' }}>Domain Binding</h4>
            <div style={{ fontSize: '13px', color: '#38bdf8', fontWeight: '600' }}>
              {isDev ? 'opt2-dev.png261.dev' : 'opt2.png261.dev'}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
              Proxied with Cloudflare Universal SSL / CDN
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}
