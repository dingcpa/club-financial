import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, X, Trash2, Calendar, ArrowRight } from 'lucide-react';

function TransferForm({ onAdd, onUpdate, onDelete, editData, onCancel }) {
    const ACCOUNTS = ['淑華代收付', '一銀帳戶', '社長代收付'];

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        fromAccount: '淑華代收付',
        toAccount: '一銀帳戶',
        amount: '',
        remark: ''
    });

    useEffect(() => {
        if (editData) {
            setFormData({
                date: editData.date,
                fromAccount: editData.fromAccount || '淑華代收付',
                toAccount: editData.toAccount || '一銀帳戶',
                amount: editData.amount,
                remark: editData.remark || ''
            });
        }
    }, [editData]);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            alert('請輸入有效金額');
            return;
        }

        if (formData.fromAccount === formData.toAccount) {
            alert('轉出帳戶與轉入帳戶不能相同');
            return;
        }

        const payload = {
            ...formData,
            item: `資金調撥: ${formData.fromAccount} ➡ ${formData.toAccount}`,
            type: 'transfer',
            amount: parseFloat(formData.amount)
        };

        if (editData) {
            onUpdate(editData.id, payload);
        } else {
            onAdd(payload);
        }

        if (!editData) {
            setFormData({
                date: new Date().toISOString().split('T')[0],
                fromAccount: '淑華代收付',
                toAccount: '一銀帳戶',
                amount: '',
                remark: ''
            });
        }
    };

    return (
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <RefreshCw size={24} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                        {editData ? '編輯調撥單' : '填寫調撥單'}
                    </h3>
                </div>
                {editData && (
                    <button onClick={onCancel} style={{ background: '#e2e8f0', color: 'var(--text-main)', padding: '0.5rem' }}>
                        <X size={18} />
                    </button>
                )}
            </div>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>調撥日期</label>
                    <input
                        type="date"
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        required
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>轉出帳戶</label>
                        <select
                            value={formData.fromAccount}
                            onChange={e => setFormData({ ...formData, fromAccount: e.target.value })}
                            required
                        >
                            {ACCOUNTS.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                        </select>
                    </div>
                    <div style={{ paddingTop: '1.5rem' }}>
                        <ArrowRight size={24} color="#94a3b8" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>轉入帳戶</label>
                        <select
                            value={formData.toAccount}
                            onChange={e => setFormData({ ...formData, toAccount: e.target.value })}
                            required
                        >
                            {ACCOUNTS.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label>調撥金額 (NT$)</label>
                    <input
                        type="number"
                        placeholder="請輸入調撥金額"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>備註說明</label>
                    <textarea
                        rows="3"
                        placeholder="例如：提款支應、帳戶互轉..."
                        value={formData.remark}
                        onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                    ></textarea>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="submit" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)' }}>
                        <Save size={18} /> {editData ? '更新調撥' : '儲存調撥'}
                    </button>
                    {editData && (
                        <button
                            type="button"
                            onClick={() => onDelete(editData.id)}
                            style={{ background: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Trash2 size={18} /> 刪除
                        </button>
                    )}
                    {editData && (
                        <button type="button" onClick={onCancel} style={{ background: '#94a3b8' }}>
                            取消
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

export default TransferForm;
