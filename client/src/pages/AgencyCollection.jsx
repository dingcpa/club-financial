import React, { useState, useEffect } from 'react';
import {
    HandCoins, Plus, X, Check, Users, Calendar,
    ChevronDown, ChevronUp, Trash2, CheckCircle2, Clock, AlertCircle, Edit3
} from 'lucide-react';

const API_URL = 'http://localhost:5000/api/agency-collections';

function AgencyCollection({ members = [] }) {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        defaultAmount: '',
        targetMembers: [], // [{name: string, amount: number}]
        remark: ''
    });

    useEffect(() => {
        fetchCollections();
    }, []);

    const fetchCollections = async () => {
        setLoading(true);
        try {
            const res = await fetch(API_URL);
            const data = await res.json();
            setCollections(data);
        } catch (err) {
            console.error('Error fetching collections:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!formData.title || formData.targetMembers.length === 0) {
            alert('請填寫項目名稱並選擇至少一位社友');
            return;
        }

        // Check all members have valid amounts
        const invalidMembers = formData.targetMembers.filter(m => !m.amount || m.amount <= 0);
        if (invalidMembers.length > 0) {
            alert('請確認所有社友都有設定金額');
            return;
        }

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formData.title,
                    targetMembers: formData.targetMembers,
                    remark: formData.remark
                })
            });
            if (res.ok) {
                setFormData({ title: '', defaultAmount: '', targetMembers: [], remark: '' });
                setShowForm(false);
                fetchCollections();
            }
        } catch (err) {
            console.error('Error creating collection:', err);
        }
    };

    const handlePayment = async (collectionId, memberName, amount) => {
        try {
            const res = await fetch(`${API_URL}/${collectionId}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    memberName,
                    date: new Date().toISOString().split('T')[0],
                    amount
                })
            });
            if (res.ok) fetchCollections();
        } catch (err) {
            console.error('Error recording payment:', err);
        }
    };

    const handleRemovePayment = async (collectionId, memberName) => {
        try {
            const res = await fetch(`${API_URL}/${collectionId}/pay/${encodeURIComponent(memberName)}`, {
                method: 'DELETE'
            });
            if (res.ok) fetchCollections();
        } catch (err) {
            console.error('Error removing payment:', err);
        }
    };

    const handleClose = async (collectionId) => {
        const collection = collections.find(c => c.id === collectionId);
        if (!collection) return;

        const totalCollected = collection.paidMembers.reduce((sum, p) => sum + p.amount, 0);
        const remark = window.prompt('結案備註（例如：已轉交給XXX）', '');

        try {
            const res = await fetch(`${API_URL}/${collectionId}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    closedAmount: totalCollected,
                    closedRemark: remark || ''
                })
            });
            if (res.ok) fetchCollections();
        } catch (err) {
            console.error('Error closing collection:', err);
        }
    };

    const handleDelete = async (collectionId) => {
        if (!window.confirm('確定要刪除此代收項目嗎？')) return;
        try {
            const res = await fetch(`${API_URL}/${collectionId}`, { method: 'DELETE' });
            if (res.ok) fetchCollections();
        } catch (err) {
            console.error('Error deleting collection:', err);
        }
    };

    const toggleMember = (memberName) => {
        const defaultAmt = parseFloat(formData.defaultAmount) || 0;
        setFormData(prev => {
            const existing = prev.targetMembers.find(m => m.name === memberName);
            if (existing) {
                return {
                    ...prev,
                    targetMembers: prev.targetMembers.filter(m => m.name !== memberName)
                };
            } else {
                return {
                    ...prev,
                    targetMembers: [...prev.targetMembers, { name: memberName, amount: defaultAmt }]
                };
            }
        });
    };

    const updateMemberAmount = (memberName, amount) => {
        setFormData(prev => ({
            ...prev,
            targetMembers: prev.targetMembers.map(m =>
                m.name === memberName ? { ...m, amount: parseFloat(amount) || 0 } : m
            )
        }));
    };

    const selectAllMembers = () => {
        const defaultAmt = parseFloat(formData.defaultAmount) || 0;
        setFormData(prev => ({
            ...prev,
            targetMembers: members.map(m => ({ name: m.name, amount: defaultAmt }))
        }));
    };

    const clearAllMembers = () => {
        setFormData(prev => ({ ...prev, targetMembers: [] }));
    };

    const applyDefaultToAll = () => {
        const defaultAmt = parseFloat(formData.defaultAmount) || 0;
        setFormData(prev => ({
            ...prev,
            targetMembers: prev.targetMembers.map(m => ({ ...m, amount: defaultAmt }))
        }));
    };

    // Helper to get member info from collection (handles both old and new format)
    const getTargetMemberInfo = (collection, memberName) => {
        // New format: targetMembers is array of {name, amount}
        if (collection.targetMembers.length > 0 && typeof collection.targetMembers[0] === 'object') {
            return collection.targetMembers.find(m => m.name === memberName);
        }
        // Old format: targetMembers is array of strings, use amountPerPerson
        return { name: memberName, amount: collection.amountPerPerson || 0 };
    };

    const getTargetMemberNames = (collection) => {
        if (collection.targetMembers.length > 0 && typeof collection.targetMembers[0] === 'object') {
            return collection.targetMembers.map(m => m.name);
        }
        return collection.targetMembers;
    };

    const getTotalTargetAmount = (collection) => {
        if (collection.targetMembers.length > 0 && typeof collection.targetMembers[0] === 'object') {
            return collection.targetMembers.reduce((sum, m) => sum + (m.amount || 0), 0);
        }
        return collection.targetMembers.length * (collection.amountPerPerson || 0);
    };

    const totalSelectedAmount = formData.targetMembers.reduce((sum, m) => sum + (m.amount || 0), 0);

    const openCollections = collections.filter(c => c.status === 'open');
    const closedCollections = collections.filter(c => c.status === 'closed');

    if (loading) {
        return (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ color: 'var(--text-muted)' }}>載入中...</div>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <HandCoins size={28} color="var(--primary)" />
                        <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>代收代付專區</h2>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                管理社友間的代收款項，不計入社團正式收支
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            background: showForm ? '#94a3b8' : 'var(--primary)'
                        }}
                    >
                        {showForm ? <X size={18} /> : <Plus size={18} />}
                        {showForm ? '取消' : '新增代收項目'}
                    </button>
                </div>
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="glass-card" style={{ marginBottom: '1.5rem', border: '2px solid var(--primary)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} color="var(--primary)" /> 建立新的代收項目
                    </h3>
                    <form onSubmit={handleCreate}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>項目名稱 <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input
                                    type="text"
                                    placeholder="例如：XXX當選理事長賀禮"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>預設金額 (NT$)</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="number"
                                        placeholder="例如：500"
                                        value={formData.defaultAmount}
                                        onChange={e => setFormData({ ...formData, defaultAmount: e.target.value })}
                                        min="0"
                                        style={{ flex: 1 }}
                                    />
                                    {formData.targetMembers.length > 0 && formData.defaultAmount && (
                                        <button
                                            type="button"
                                            onClick={applyDefaultToAll}
                                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', background: '#64748b', whiteSpace: 'nowrap' }}
                                        >
                                            套用至全部
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>備註</label>
                            <input
                                type="text"
                                placeholder="其他說明..."
                                value={formData.remark}
                                onChange={e => setFormData({ ...formData, remark: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>選擇應收社友 <span style={{ color: 'var(--danger)' }}>*</span></span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" onClick={selectAllMembers} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#64748b' }}>
                                        全選
                                    </button>
                                    <button type="button" onClick={clearAllMembers} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#94a3b8' }}>
                                        清除
                                    </button>
                                </div>
                            </label>
                            <div style={{
                                maxHeight: '300px',
                                overflowY: 'auto',
                                padding: '0.75rem',
                                background: '#f8fafc',
                                borderRadius: '0.5rem',
                                border: '1px solid #e2e8f0'
                            }}>
                                {members.map(m => {
                                    const selected = formData.targetMembers.find(t => t.name === m.name);
                                    return (
                                        <div
                                            key={m.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.5rem 0.75rem',
                                                marginBottom: '0.5rem',
                                                background: selected ? 'white' : 'transparent',
                                                borderRadius: '0.5rem',
                                                border: selected ? '1px solid var(--primary)' : '1px solid transparent',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={!!selected}
                                                onChange={() => toggleMember(m.name)}
                                                style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                                            />
                                            <span style={{
                                                flex: 1,
                                                fontWeight: selected ? '600' : '400',
                                                color: selected ? 'var(--primary)' : 'var(--text-main)'
                                            }}>
                                                {m.name}
                                                {m.nickname && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>({m.nickname})</span>}
                                            </span>
                                            {selected && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>NT$</span>
                                                    <input
                                                        type="number"
                                                        value={selected.amount || ''}
                                                        onChange={e => updateMemberAmount(m.name, e.target.value)}
                                                        placeholder="金額"
                                                        min="0"
                                                        style={{
                                                            width: '80px',
                                                            padding: '0.3rem 0.5rem',
                                                            fontSize: '0.9rem',
                                                            textAlign: 'right',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '0.25rem'
                                                        }}
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                <span>已選擇 {formData.targetMembers.length} 位社友</span>
                                <span style={{ fontWeight: '600', color: 'var(--primary)' }}>
                                    預計收款 NT$ {totalSelectedAmount.toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <button type="submit" style={{ width: '100%' }}>
                            建立代收項目
                        </button>
                    </form>
                </div>
            )}

            {/* Open Collections */}
            {openCollections.length > 0 && (
                <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={20} color="#f59e0b" /> 進行中 ({openCollections.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {openCollections.map(collection => {
                            const isExpanded = expandedId === collection.id;
                            const targetNames = getTargetMemberNames(collection);
                            const paidCount = collection.paidMembers.length;
                            const totalCount = targetNames.length;
                            const totalCollected = collection.paidMembers.reduce((sum, p) => sum + p.amount, 0);
                            const targetAmount = getTotalTargetAmount(collection);
                            const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;
                            const unpaidMembers = targetNames.filter(
                                name => !collection.paidMembers.some(p => p.memberName === name)
                            );

                            return (
                                <div
                                    key={collection.id}
                                    style={{
                                        background: '#fffbeb',
                                        border: '1px solid #fcd34d',
                                        borderRadius: '0.75rem',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* Header */}
                                    <div
                                        onClick={() => setExpandedId(isExpanded ? null : collection.id)}
                                        style={{
                                            padding: '1rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '0.25rem' }}>
                                                {collection.title}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                建立於 {collection.createdDate}
                                                {collection.remark && ` · ${collection.remark}`}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: '700', color: 'var(--primary)' }}>
                                                    {paidCount} / {totalCount} 人
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    NT$ {totalCollected.toLocaleString()} / {targetAmount.toLocaleString()}
                                                </div>
                                            </div>
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div style={{ padding: '0 1rem', paddingBottom: isExpanded ? '0' : '1rem' }}>
                                        <div style={{ height: '6px', background: '#fde68a', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${progress}%`,
                                                height: '100%',
                                                background: progress === 100 ? 'var(--success)' : 'var(--primary)',
                                                transition: 'width 0.3s'
                                            }} />
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div style={{ padding: '1rem', borderTop: '1px solid #fcd34d' }}>
                                            {/* Unpaid Members */}
                                            {unpaidMembers.length > 0 && (
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#f59e0b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        <AlertCircle size={14} /> 未收款 ({unpaidMembers.length})
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {unpaidMembers.map(name => {
                                                            const memberInfo = getTargetMemberInfo(collection, name);
                                                            const amount = memberInfo?.amount || 0;
                                                            return (
                                                                <div
                                                                    key={name}
                                                                    style={{
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'center',
                                                                        padding: '0.5rem 0.75rem',
                                                                        background: 'white',
                                                                        borderRadius: '0.5rem',
                                                                        border: '1px solid #e2e8f0'
                                                                    }}
                                                                >
                                                                    <span style={{ fontWeight: '500' }}>{name}</span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                                            NT$ {amount.toLocaleString()}
                                                                        </span>
                                                                        <button
                                                                            onClick={() => handlePayment(collection.id, name, amount)}
                                                                            style={{
                                                                                padding: '0.3rem 0.6rem',
                                                                                fontSize: '0.8rem',
                                                                                background: 'var(--success)',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '0.25rem'
                                                                            }}
                                                                        >
                                                                            <Check size={14} /> 已收
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Paid Members */}
                                            {collection.paidMembers.length > 0 && (
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--success)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                        <CheckCircle2 size={14} /> 已收款 ({collection.paidMembers.length})
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {collection.paidMembers.map(p => (
                                                            <div
                                                                key={p.memberName}
                                                                style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    padding: '0.5rem 0.75rem',
                                                                    background: '#dcfce7',
                                                                    borderRadius: '0.5rem'
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                    <CheckCircle2 size={16} color="var(--success)" />
                                                                    <span style={{ fontWeight: '500' }}>{p.memberName}</span>
                                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                        {p.date}
                                                                    </span>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                    <span style={{ fontWeight: '600', color: 'var(--success)' }}>
                                                                        NT$ {p.amount.toLocaleString()}
                                                                    </span>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (window.confirm(`確定要取消 ${p.memberName} 的收款記錄嗎？`)) {
                                                                                handleRemovePayment(collection.id, p.memberName);
                                                                            }
                                                                        }}
                                                                        style={{
                                                                            padding: '0.2rem 0.4rem',
                                                                            fontSize: '0.75rem',
                                                                            background: '#f1f5f9',
                                                                            color: '#64748b'
                                                                        }}
                                                                        title="取消收款"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #fcd34d' }}>
                                                {paidCount === totalCount && totalCount > 0 && (
                                                    <button
                                                        onClick={() => handleClose(collection.id)}
                                                        style={{ background: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                                    >
                                                        <CheckCircle2 size={16} /> 結案
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(collection.id)}
                                                    style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                                >
                                                    <Trash2 size={16} /> 刪除
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Closed Collections */}
            {closedCollections.length > 0 && (
                <div className="glass-card">
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={20} color="var(--success)" /> 已結案 ({closedCollections.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {closedCollections.map(collection => (
                            <div
                                key={collection.id}
                                style={{
                                    padding: '1rem',
                                    background: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '0.5rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                                        {collection.title}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        結案日期: {collection.closedDate} ·
                                        共收 {collection.paidMembers.length} 人
                                        {collection.closedRemark && ` · ${collection.closedRemark}`}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ fontWeight: '700', color: 'var(--success)' }}>
                                        NT$ {(collection.closedAmount || 0).toLocaleString()}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(collection.id)}
                                        style={{ padding: '0.4rem', background: '#f1f5f9', color: '#64748b' }}
                                        title="刪除"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {collections.length === 0 && !showForm && (
                <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <HandCoins size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
                    <div style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        尚無代收代付項目
                    </div>
                    <button onClick={() => setShowForm(true)}>
                        <Plus size={18} /> 建立第一個代收項目
                    </button>
                </div>
            )}
        </div>
    );
}

export default AgencyCollection;
