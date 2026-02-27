import React, { useState, useEffect } from 'react';
import { Save, Minus, X, Trash2, Calendar } from 'lucide-react';

const PRESET_EXPENSES = [
    '辨公室租金及水電',
    '人事費 -薪資/油資',
    '文具費',
    '郵電費',
    '健保費',
    '印刷費',
    '雜費及設備更新',
    '助秘提撥金',
    '例會餐費(一般/聯合)',
    '例會餐費(女賓夕/眷屬聯歡)',
    '資訊維修費(含地區網站)',
    '健遊活動',
    '演講車馬費',
    '爐邊會',
    '金蘭聯誼',
    '高球費用',
    '職業參觀',
    '授證之旅補助',
    '還社長',
    '研習班',
    '服務計畫委員會',
    '社員發展委員會',
    '扶輪基金委員會',
    '公共關係委員會',
    '預備費'
];

function ExpenseForm({ onAdd, onUpdate, onDelete, editData, onCancel }) {
    const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

    // Minguo Calendar Helpers
    const toMinguoYear = (adYear) => parseInt(adYear) - 1911;
    const toMinguoDate = (adDateStr) => {
        if (!adDateStr) return '';
        const [y, m, d] = adDateStr.split('-');
        return `${toMinguoYear(y)}-${m}-${d}`;
    };
    const toMinguoMonth = (adMonthStr) => {
        if (!adMonthStr || !adMonthStr.includes('-')) return adMonthStr;
        const [y, m] = adMonthStr.split('-');
        return `${toMinguoYear(y)}-${m}`;
    };

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        item: PRESET_EXPENSES[0],
        customItem: '',
        amount: '',
        remark: '',
        account: '淑華代收付',
        isPrepaid: false,
        startPeriod: currentMonth,
        endPeriod: currentMonth
    });

    const [isCustom, setIsCustom] = useState(false);

    useEffect(() => {
        if (editData) {
            const isPreset = PRESET_EXPENSES.includes(editData.item);
            setFormData({
                date: editData.date,
                item: isPreset ? editData.item : 'CUSTOM',
                customItem: isPreset ? '' : editData.item,
                amount: editData.amount,
                remark: editData.remark || '',
                account: editData.account || '淑華代收付',
                isPrepaid: !!(editData.startPeriod && editData.endPeriod),
                startPeriod: editData.startPeriod || currentMonth,
                endPeriod: editData.endPeriod || currentMonth
            });
            setIsCustom(!isPreset);
        }
    }, [editData]);

    const handleStartPeriodChange = (val) => {
        setFormData(prev => {
            const newData = { ...prev, startPeriod: val };
            // If new start period > current end period, sync end period to start period
            if (val > prev.endPeriod) {
                newData.endPeriod = val;
            }
            return newData;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const finalItem = isCustom ? formData.customItem : formData.item;
        if (!finalItem || !formData.amount) return;

        const payload = {
            ...formData,
            item: finalItem,
            type: 'expense',
            // Only send periods if isPrepaid is true
            startPeriod: formData.isPrepaid ? formData.startPeriod : null,
            endPeriod: formData.isPrepaid ? formData.endPeriod : null
        };

        if (editData) {
            onUpdate(editData.id, payload);
        } else {
            onAdd(payload);
        }

        if (!editData) {
            setFormData({
                date: new Date().toISOString().split('T')[0],
                item: PRESET_EXPENSES[0],
                customItem: '',
                amount: '',
                remark: '',
                account: '淑華代收付',
                isPrepaid: false,
                startPeriod: currentMonth,
                endPeriod: currentMonth
            });
            setIsCustom(false);
        }
    };

    const handleItemChange = (e) => {
        const val = e.target.value;
        if (val === 'CUSTOM') {
            setIsCustom(true);
            setFormData({ ...formData, item: 'CUSTOM' });
        } else {
            setIsCustom(false);
            setFormData({ ...formData, item: val });
        }
    };

    return (
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Minus size={24} color="var(--danger)" />
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                        {editData ? '編輯支出單' : '填寫支出單'}
                    </h3>
                </div>
                {editData && (
                    <button onClick={onCancel} style={{ background: '#e2e8f0', color: 'var(--text-main)', padding: '0.5rem' }}>
                        <X size={18} />
                    </button>
                )}
            </div>
            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label>支出日期</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>付款人</label>
                        <select
                            value={formData.account}
                            onChange={e => setFormData({ ...formData, account: e.target.value })}
                            required
                        >
                            <option value="淑華代收付">淑華代收付</option>
                            <option value="一銀帳戶">一銀帳戶</option>
                            <option value="社長代收付">社長代收付</option>
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label>項目名稱</label>
                    <select
                        value={isCustom ? 'CUSTOM' : formData.item}
                        onChange={handleItemChange}
                        required
                    >
                        {PRESET_EXPENSES.map(item => (
                            <option key={item} value={item}>{item}</option>
                        ))}
                        <option value="CUSTOM">+ 新增自定義項目...</option>
                    </select>
                </div>

                {isCustom && (
                    <div className="form-group">
                        <label>自定義項目名稱</label>
                        <input
                            type="text"
                            placeholder="例如：裝修費、活動費..."
                            value={formData.customItem}
                            onChange={(e) => setFormData({ ...formData, customItem: e.target.value })}
                            required
                        />
                    </div>
                )}

                <div className="form-group" style={{
                    background: '#f8fafc',
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0',
                    marginBottom: '1rem'
                }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: formData.isPrepaid ? '1rem' : '0' }}>
                        <input
                            type="checkbox"
                            checked={formData.isPrepaid}
                            onChange={e => setFormData({ ...formData, isPrepaid: e.target.checked })}
                            style={{ width: '1.25rem', height: '1.25rem' }}
                        />
                        <span style={{ fontWeight: '700', color: 'var(--primary)' }}>此筆為「跨月份平攤」費用 (預付性質)</span>
                    </label>

                    {formData.isPrepaid && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>開始年月</label>
                                    <input
                                        type="month"
                                        value={formData.startPeriod}
                                        onChange={e => handleStartPeriodChange(e.target.value)}
                                        required
                                    />
                                </div>
                                <div style={{ paddingTop: '1.25rem' }}>
                                    <ArrowRight size={20} color="#94a3b8" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>結束年月</label>
                                    <input
                                        type="month"
                                        value={formData.endPeriod}
                                        onChange={e => setFormData({ ...formData, endPeriod: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                系統將依照你選擇的年月區間，自動將總金額平均分攤至各月報表。
                            </div>
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label>金額 (NT$)</label>
                    <input
                        type="number"
                        placeholder="請輸入金額"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>備註</label>
                    <textarea
                        rows="3"
                        placeholder="其他說明..."
                        value={formData.remark}
                        onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                    ></textarea>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="submit" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'var(--danger)' }}>
                        <Save size={18} /> {editData ? '更新支出' : '儲存支出'}
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

// Internal icon for the separator
function ArrowRight({ size, color }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14m-7-7 7 7-7 7" />
        </svg>
    );
}

export default ExpenseForm;
