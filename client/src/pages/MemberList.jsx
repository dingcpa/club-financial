import React, { useState } from 'react';
import { Users, Search, Cake, UserCheck, Phone, Smartphone, MapPin, Mail, Plus, Edit2, Trash2, Save, X } from 'lucide-react';

function MemberList({ members, loading, onAdd, onUpdate, onDelete }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        name: '', nickname: '', birthday: '', phone: '', mobile: '', email: '', address: '',
        jobTitle1: '社友', jobTitle2: '', customJobTitle2: ''
    });

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '3rem' }}>載入中...</div>;
    }

    const handleEdit = (member) => {
        setEditingId(member.id);
        setFormData({
            ...member,
            jobTitle1: member.jobTitle1 || '社友',
            jobTitle2: (member.jobTitle2 === '理事' || member.jobTitle2 === '監事' || !member.jobTitle2) ? (member.jobTitle2 || '') : 'CUSTOM',
            customJobTitle2: (member.jobTitle2 === '理事' || member.jobTitle2 === '監事' || !member.jobTitle2) ? '' : member.jobTitle2
        });
        setIsAdding(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSave = () => {
        if (!formData.name) return alert('請輸入姓名');

        const finalJobTitle2 = formData.jobTitle2 === 'CUSTOM' ? formData.customJobTitle2 : formData.jobTitle2;
        const payload = { ...formData, jobTitle2: finalJobTitle2 };
        delete payload.customJobTitle2;

        if (editingId) {
            onUpdate(editingId, payload);
            setEditingId(null);
        } else {
            onAdd(payload);
            setIsAdding(false);
        }
        setFormData({ name: '', nickname: '', birthday: '', phone: '', mobile: '', email: '', address: '', jobTitle1: '社友', jobTitle2: '', customJobTitle2: '' });
    };

    // Hierarchy Mapping for sorting
    const TITLE_ORDER = {
        '社長(P)': 1,
        '祕書(S)': 2,
        '社當(PE)': 3,
        '副社長(VP)': 4,
        '前社長(PP)': 5,
        '社友': 6,
        '': 7
    };

    const getTitlePriority = (title) => TITLE_ORDER[title] || 99;

    const filteredMembers = members
        .filter(m =>
            m.name.includes(searchTerm) ||
            (m.nickname && m.nickname.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (m.mobile && m.mobile.includes(searchTerm)) ||
            (m.jobTitle1 && m.jobTitle1.includes(searchTerm))
        )
        .sort((a, b) => {
            const prioA = getTitlePriority(a.jobTitle1 || '社友');
            const prioB = getTitlePriority(b.jobTitle1 || '社友');
            if (prioA !== prioB) return prioA - prioB;
            return a.name.localeCompare(b.name, 'zh-Hant');
        });

    return (
        <div className="glass-card">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={18} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>社友名冊管理</h3>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flex: '1', maxWidth: '500px', justifyContent: 'flex-end' }}>
                    <div style={{ position: 'relative', flex: '1', maxWidth: '200px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="搜尋姓名、手機、職稱..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ padding: '0.35rem 0.5rem 0.35rem 1.75rem', width: '100%', fontSize: '0.8rem' }}
                        />
                    </div>
                    <button
                        onClick={() => { setIsAdding(!isAdding); setEditingId(null); setFormData({ name: '', nickname: '', birthday: '', phone: '', mobile: '', email: '', address: '', jobTitle1: '社友', jobTitle2: '', customJobTitle2: '' }); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: isAdding ? '#94a3b8' : 'var(--primary)', padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                    >
                        {isAdding ? <X size={14} /> : <Plus size={14} />} {isAdding ? '取消' : '新增'}
                    </button>
                </div>
            </div>

            {(isAdding || editingId) && (
                <div className="glass-card" style={{ marginBottom: '1rem', background: '#f8fafc', border: '1px solid var(--primary)', padding: '0.75rem' }}>
                    <h4 style={{ marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>{editingId ? '編輯社員：' + formData.name : '新增社友'}</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                        <div className="form-group"><label style={{ fontSize: '0.7rem' }}>姓名*</label><input style={{ padding: '0.3rem', fontSize: '0.8rem' }} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                        <div className="form-group"><label style={{ fontSize: '0.7rem' }}>社名</label><input style={{ padding: '0.3rem', fontSize: '0.8rem' }} value={formData.nickname} onChange={e => setFormData({ ...formData, nickname: e.target.value })} /></div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.7rem' }}>職稱 1</label>
                            <select
                                style={{ padding: '0.3rem', fontSize: '0.8rem' }}
                                value={formData.jobTitle1}
                                onChange={e => setFormData({ ...formData, jobTitle1: e.target.value })}
                            >
                                <option value="社長(P)">社長(P)</option>
                                <option value="祕書(S)">祕書(S)</option>
                                <option value="社當(PE)">社當(PE)</option>
                                <option value="副社長(VP)">副社長(VP)</option>
                                <option value="前社長(PP)">前社長(PP)</option>
                                <option value="社友">社友</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.7rem' }}>職稱 2</label>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <select
                                    style={{ padding: '0.3rem', fontSize: '0.8rem', flex: 1 }}
                                    value={formData.jobTitle2}
                                    onChange={e => setFormData({ ...formData, jobTitle2: e.target.value })}
                                >
                                    <option value="">(無)</option>
                                    <option value="理事">理事</option>
                                    <option value="監事">監事</option>
                                    <option value="CUSTOM">+ 新增其他...</option>
                                </select>
                                {formData.jobTitle2 === 'CUSTOM' && (
                                    <input
                                        style={{ padding: '0.3rem', fontSize: '0.8rem', flex: 2 }}
                                        placeholder="輸入職稱"
                                        value={formData.customJobTitle2}
                                        onChange={e => setFormData({ ...formData, customJobTitle2: e.target.value })}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="form-group"><label style={{ fontSize: '0.7rem' }}>生日</label><input style={{ padding: '0.3rem', fontSize: '0.8rem' }} type="date" value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })} /></div>
                        <div className="form-group"><label style={{ fontSize: '0.7rem' }}>市話</label><input style={{ padding: '0.3rem', fontSize: '0.8rem' }} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                        <div className="form-group"><label style={{ fontSize: '0.7rem' }}>手機</label><input style={{ padding: '0.3rem', fontSize: '0.8rem' }} value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value })} /></div>
                        <div className="form-group"><label style={{ fontSize: '0.7rem' }}>Email</label><input style={{ padding: '0.3rem', fontSize: '0.8rem' }} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}><label style={{ fontSize: '0.7rem' }}>地址</label><input style={{ padding: '0.3rem', fontSize: '0.8rem' }} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} /></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button onClick={() => { setIsAdding(false); setEditingId(null); }} style={{ background: '#94a3b8', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>取消</button>
                        <button onClick={handleSave} style={{ background: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>
                            <Save size={14} /> 儲存變更
                        </button>
                    </div>
                </div>
            )}

            <div style={{ overflowX: 'auto', borderRadius: '0.5rem', border: '1px solid #e2e8f0', background: 'white' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '850px', fontSize: '0.8rem' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', background: '#f8fafc', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', position: 'sticky', left: 0, zIndex: 1, width: '80px' }}>姓名</th>
                            <th style={{ textAlign: 'left', background: '#f8fafc', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', width: '80px' }}>職稱</th>
                            <th style={{ textAlign: 'left', background: '#f8fafc', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', width: '70px' }}>社名</th>
                            <th style={{ textAlign: 'left', background: '#f8fafc', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', width: '90px' }}>生日</th>
                            <th style={{ textAlign: 'left', background: '#f8fafc', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', width: '160px' }}>聯絡資訊</th>
                            <th style={{ textAlign: 'left', background: '#f8fafc', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', maxWidth: '140px' }}>地址</th>
                            <th style={{ textAlign: 'center', background: '#f8fafc', padding: '0.5rem', borderBottom: '2px solid #e2e8f0', width: '80px' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredMembers.length === 0 ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>尚未建立資料</td>
                            </tr>
                        ) : (
                            filteredMembers.map((member, index) => (
                                <tr key={member.id} style={{ background: index % 2 === 0 ? 'white' : '#fcfcfd' }}>
                                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', fontWeight: '600', position: 'sticky', left: 0, background: index % 2 === 0 ? 'white' : '#fcfcfd', zIndex: 1 }}>{member.name}</td>
                                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold' }}>{member.jobTitle1 || '社友'}</span>
                                            {member.jobTitle2 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{member.jobTitle2}</span>}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                        <span style={{ padding: '0.1rem 0.3rem', background: 'rgba(79, 70, 229, 0.05)', borderRadius: '0.2rem', color: 'var(--primary)', fontSize: '0.7rem', fontWeight: '500' }}>
                                            {member.nickname}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                        {member.birthday}
                                    </td>
                                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem', fontSize: '0.7rem' }}>
                                            <Smartphone size={10} color="var(--primary)" /> <span style={{ color: 'var(--text-main)' }}>{member.mobile || '-'}</span>
                                            <Phone size={10} color="#64748b" /> <span style={{ color: 'var(--text-muted)' }}>{member.phone || '-'}</span>
                                            <Mail size={10} color="#94a3b8" /> <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email || '-'}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9', color: 'var(--text-muted)', fontSize: '0.75rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={member.address}>
                                        {member.address || '-'}
                                    </td>
                                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem' }}>
                                            <button
                                                onClick={() => handleEdit(member)}
                                                style={{ padding: '0.25rem', background: '#f1f5f9', color: 'var(--primary)', border: 'none' }}
                                                title="編輯"
                                            >
                                                <Edit2 size={12} />
                                            </button>
                                            <button
                                                onClick={() => onDelete(member.id)}
                                                style={{ padding: '0.25rem', background: '#fef2f2', color: 'var(--danger)', border: 'none' }}
                                                title="刪除"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default MemberList;
