import React, { useState, useMemo } from 'react';
import { Search, Edit3, X, TrendingUp, TrendingDown, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 15;

const TYPE_CONFIG = {
    income: {
        label: '收入單',
        color: 'var(--success)',
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        amtClass: 'income-amt',
        sign: '+',
    },
    expense: {
        label: '支出單',
        color: 'var(--danger)',
        bgColor: '#fef2f2',
        borderColor: '#fecaca',
        amtClass: 'expense-amt',
        sign: '-',
    },
    transfer: {
        label: '調撥單',
        color: 'var(--primary)',
        bgColor: '#f0f4ff',
        borderColor: '#c7d2fe',
        amtClass: '',
        sign: '⇄',
    },
};

const toMinguoDate = (adDateStr) => {
    if (!adDateStr) return '';
    const [y, m, d] = adDateStr.split('-');
    return `${parseInt(y) - 1911}-${m}-${d}`;
};

function RecordListPanel({ records = [], type, editingId, onEdit }) {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.income;

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return records
            .filter(r => r.type === type)
            .filter(r => {
                if (!q) return true;
                return (
                    (r.item || '').toLowerCase().includes(q) ||
                    (r.member || '').toLowerCase().includes(q) ||
                    (r.remark || '').toLowerCase().includes(q) ||
                    (r.account || '').toLowerCase().includes(q) ||
                    (r.fromAccount || '').toLowerCase().includes(q) ||
                    (r.toAccount || '').toLowerCase().includes(q) ||
                    toMinguoDate(r.date).includes(q) ||
                    String(r.amount || '').includes(q)
                );
            })
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [records, type, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const handleSearch = (val) => {
        setSearch(val);
        setPage(1);
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: 'white',
            borderRadius: '1rem',
            border: `1px solid ${cfg.borderColor}`,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
            {/* Header */}
            <div style={{
                padding: '0.875rem 1rem',
                background: cfg.bgColor,
                borderBottom: `1px solid ${cfg.borderColor}`,
                flexShrink: 0
            }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: cfg.color, marginBottom: '0.5rem' }}>
                    {cfg.label}歷史記錄 ({filtered.length} 筆)
                </div>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="搜尋項目、社友、金額..."
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.4rem 0.75rem',
                            paddingLeft: '2rem',
                            paddingRight: search ? '2rem' : '0.75rem',
                            fontSize: '0.8rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.4rem',
                            background: 'white',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                    {search && (
                        <button
                            onClick={() => handleSearch('')}
                            style={{ position: 'absolute', right: '0.4rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', padding: '0.1rem', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {paged.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                        {search ? '查無符合的記錄' : '尚無記錄'}
                    </div>
                ) : (
                    paged.map(r => {
                        const isEditing = editingId === r.id;
                        return (
                            <div
                                key={r.id}
                                onClick={() => onEdit(r)}
                                style={{
                                    padding: '0.6rem 1rem',
                                    borderBottom: '1px solid #f1f5f9',
                                    cursor: 'pointer',
                                    background: isEditing ? cfg.bgColor : 'white',
                                    borderLeft: isEditing ? `3px solid ${cfg.color}` : '3px solid transparent',
                                    transition: 'background 0.15s',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                                className="record-list-row"
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    {/* Date */}
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.15rem' }}>
                                        {toMinguoDate(r.date)}
                                    </div>
                                    {/* Item */}
                                    <div style={{
                                        fontWeight: '600',
                                        fontSize: '0.85rem',
                                        color: '#1e293b',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {type === 'transfer'
                                            ? `${r.fromAccount} → ${r.toAccount}`
                                            : r.item
                                        }
                                    </div>
                                    {/* Sub info */}
                                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.1rem' }}>
                                        {type === 'income' && r.member && <span>{r.member} · </span>}
                                        {type !== 'transfer' && r.account && <span>{r.account}</span>}
                                        {r.remark && <span style={{ color: '#94a3b8' }}> · {r.remark}</span>}
                                    </div>
                                </div>
                                {/* Amount */}
                                <div style={{
                                    fontWeight: '700',
                                    fontSize: '0.9rem',
                                    color: cfg.color,
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                }}>
                                    {cfg.sign !== '⇄' ? cfg.sign : ''}
                                    {Math.abs(r.amount).toLocaleString()}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 1rem',
                    borderTop: '1px solid #f1f5f9',
                    background: '#f8fafc',
                    flexShrink: 0,
                    fontSize: '0.75rem',
                    color: '#64748b'
                }}>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        style={{ background: 'transparent', padding: '0.2rem', border: 'none', cursor: safePage === 1 ? 'default' : 'pointer', opacity: safePage === 1 ? 0.3 : 1, color: '#475569' }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span>{safePage} / {totalPages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                        style={{ background: 'transparent', padding: '0.2rem', border: 'none', cursor: safePage === totalPages ? 'default' : 'pointer', opacity: safePage === totalPages ? 0.3 : 1, color: '#475569' }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `.record-list-row:hover { background-color: #f8fafc !important; }` }} />
        </div>
    );
}

export default RecordListPanel;
