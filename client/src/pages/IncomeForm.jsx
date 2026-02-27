import React, { useState, useEffect } from 'react';
import { Save, Plus, User, X, Trash2, Calendar, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

function IncomeForm({ onAdd, onAddBatch, onAddBatchToDues, onUpdate, onDelete, editData, members, records = [], duesSettings = [], onCancel }) {
    const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

    // Derive PRESET_ITEMS from duesSettings + some standard ones
    const DUES_ITEMS = duesSettings.map(s => s.category);
    const OTHER_ITEMS = [
        '授證紅箱',
        '交接紅箱',
        '例會歡喜紅箱',
        '其他紅箱',
        '其他收入-利息收入',
        '其他收入-其他'
    ];
    const ALL_PRESET_ITEMS = [...DUES_ITEMS, ...OTHER_ITEMS];

    // Dynamic AUTO_PERIODS derived from items with month ranges in names
    const getAutoPeriod = (item) => {
        if (item === '1-3月社費') return { start: '01', end: '03' };
        if (item === '4-6月社費') return { start: '04', end: '06' };
        if (item === '7-9月社費') return { start: '07', end: '09' };
        if (item === '10-12月社費') return { start: '10', end: '12' };
        if (item === '總半年費(1-6)') return { start: '01', end: '06' };
        if (item === '總半年費(7-12)') return { start: '07', end: '12' };
        return null;
    };

    const toMinguoYear = (adYear) => parseInt(adYear) - 1911;

    const initialDate = new Date().toISOString().split('T')[0];
    const initialYear = initialDate.split('-')[0];
    const defaultItem = ALL_PRESET_ITEMS[0];
    const defaultAuto = getAutoPeriod(defaultItem);

    const [formData, setFormData] = useState({
        date: initialDate,
        item: defaultItem,
        customItem: '',
        member: '',
        account: '淑華代收付',
        amount: '',
        remark: '',
        isPrepaid: !!defaultAuto,
        startPeriod: defaultAuto ? `${initialYear}-${defaultAuto.start}` : currentMonth,
        endPeriod: defaultAuto ? `${initialYear}-${defaultAuto.end}` : currentMonth
    });

    const [isCustom, setIsCustom] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);

    // Batch Collection State
    const [outstandingDues, setOutstandingDues] = useState([]);
    const [selectedDues, setSelectedDues] = useState([]); // Array of category names
    const [receivedAmount, setReceivedAmount] = useState(''); // 當次收款金額
    const [prevOverpayment, setPrevOverpayment] = useState(0); // 前期溢收款餘額

    useEffect(() => {
        if (editData) {
            const isPreset = ALL_PRESET_ITEMS.includes(editData.item);
            setFormData({
                date: editData.date,
                item: isPreset ? editData.item : 'CUSTOM',
                customItem: isPreset ? '' : editData.item,
                member: editData.member || '',
                account: editData.account || '淑華代收付',
                amount: editData.amount,
                remark: editData.remark || '',
                isPrepaid: !!(editData.startPeriod && editData.endPeriod),
                startPeriod: editData.startPeriod || currentMonth,
                endPeriod: editData.endPeriod || currentMonth
            });
            setIsCustom(!isPreset);
            setMemberSearch(editData.member || '');
        }
    }, [editData]);

    // Calculate Outstanding Dues when member changes
    useEffect(() => {
        if (!formData.member || editData) {
            setOutstandingDues([]);
            setPrevOverpayment(0);
            return;
        }

        const selectedYear = formData.date.split('-')[0];

        const memberPayments = records.filter(r =>
            r.type === 'income' &&
            r.member === formData.member &&
            r.date.startsWith(selectedYear)
        );

        const unpaid = duesSettings.filter(setting => {
            const isDue = !setting.dueDate || setting.dueDate <= formData.date;
            if (!isDue) return false;
            const hasPaid = memberPayments.some(p => p.item === setting.category);
            return !hasPaid;
        });

        setOutstandingDues(unpaid);
        setSelectedDues(unpaid.map(u => u.category));

        // Calculate previous overpayment balance (all time, not just this year)
        const overpaymentRecords = records.filter(r =>
            r.type === 'income' &&
            r.member === formData.member &&
            r.item === '溢收款'
        );
        const balance = overpaymentRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
        setPrevOverpayment(balance > 0 ? balance : 0);
    }, [formData.member, formData.date, duesSettings, records]);

    // Sync periods when date changes for auto-items (New records only)
    useEffect(() => {
        if (editData) return;

        const year = formData.date.split('-')[0];
        const auto = getAutoPeriod(formData.item);
        if (auto) {
            setFormData(prev => ({
                ...prev,
                isPrepaid: true,
                startPeriod: `${year}-${auto.start}`,
                endPeriod: `${year}-${auto.end}`
            }));
        }
    }, [formData.date, formData.item]);

    const handleStartPeriodChange = (val) => {
        setFormData(prev => {
            const newData = { ...prev, startPeriod: val };
            if (val > prev.endPeriod) {
                newData.endPeriod = val;
            }
            return newData;
        });
    };

    // ----- Batch settlement preview -----
    const computeSettlement = () => {
        const received = parseFloat(receivedAmount) || 0;
        const totalAvailable = received + prevOverpayment;
        let remaining = totalAvailable;
        const settled = [];
        const skipped = [];

        const selectedItems = outstandingDues.filter(u => selectedDues.includes(u.category));
        for (const item of selectedItems) {
            if (remaining >= item.standardAmount) {
                settled.push(item);
                remaining -= item.standardAmount;
            } else {
                skipped.push(item);
            }
        }

        const surplus = remaining; // 0 or positive (remaining funds after all settled items)
        // usedOverpayment: how much of prevOverpayment was actually consumed
        const settledTotal = settled.reduce((s, i) => s + i.standardAmount, 0);
        const usedOverpayment = Math.max(0, Math.min(prevOverpayment, settledTotal - received));

        return { settled, skipped, surplus, usedOverpayment, received, totalAvailable };
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!formData.member) {
            alert('請選擇社友姓名（非社友請選「其他」）');
            return;
        }

        // Batch Mode
        if (!editData && selectedDues.length > 0) {
            const received = parseFloat(receivedAmount) || 0;
            if (received <= 0 && prevOverpayment <= 0) {
                alert('請輸入收款金額');
                return;
            }

            const { settled, surplus, usedOverpayment } = computeSettlement();

            if (settled.length === 0 && surplus === 0) {
                alert('收款金額不足以沖抵任何一筆應收項目，請確認金額是否正確。');
                return;
            }

            const selectedYear = formData.date.split('-')[0];

            // Build settled records
            const settledRecords = settled.map(u => {
                const auto = getAutoPeriod(u.category);
                return {
                    type: 'income',
                    date: formData.date,
                    item: u.category,
                    member: formData.member,
                    account: formData.account,
                    amount: u.standardAmount,
                    remark: formData.remark,
                    startPeriod: auto ? `${selectedYear}-${auto.start}` : null,
                    endPeriod: auto ? `${selectedYear}-${auto.end}` : null
                };
            });

            const extraRecords = [];

            // KEY FIX: surplus = received + prevOverpayment - settledTotal
            // The surplus already INCLUDES prevOverpayment. So if we leave the old
            // overpayment records intact, we'll double-count.
            // Solution: always cancel the entire old balance first, then store the new surplus.
            if (prevOverpayment > 0) {
                extraRecords.push({
                    type: 'income',
                    date: formData.date,
                    item: '溢收款',
                    member: formData.member,
                    account: formData.account,
                    amount: -prevOverpayment,
                    remark: `前期溢收款結清（沖抵本次收款計算）`,
                    startPeriod: null,
                    endPeriod: null
                });
            }

            // Record any new surplus as overpayment
            if (surplus > 0) {
                extraRecords.push({
                    type: 'income',
                    date: formData.date,
                    item: '溢收款',
                    member: formData.member,
                    account: formData.account,
                    amount: surplus,
                    remark: `溢收款（收款 ${received.toLocaleString()}，超出已沖項目總額）`,
                    startPeriod: null,
                    endPeriod: null
                });
            }

            const allRecords = [...settledRecords, ...extraRecords];

            // Always redirect to dues page so user can see updated payment status
            onAddBatchToDues(allRecords);
            resetForm();
            return;
        }

        // Single Mode
        const finalItem = isCustom ? formData.customItem : formData.item;
        if (!finalItem || !formData.amount) return;

        const payload = {
            ...formData,
            item: finalItem,
            type: 'income',
            startPeriod: formData.isPrepaid ? formData.startPeriod : null,
            endPeriod: formData.isPrepaid ? formData.endPeriod : null
        };

        if (editData) {
            onUpdate(editData.id, payload);
        } else {
            onAdd(payload);
        }

        if (!editData) {
            resetForm();
        }
    };

    const resetForm = () => {
        setFormData({
            date: new Date().toISOString().split('T')[0],
            item: ALL_PRESET_ITEMS[0],
            customItem: '',
            member: '',
            amount: '',
            remark: '',
            account: '淑華代收付',
            isPrepaid: false,
            startPeriod: currentMonth,
            endPeriod: currentMonth
        });
        setIsCustom(false);
        setMemberSearch('');
        setOutstandingDues([]);
        setSelectedDues([]);
        setReceivedAmount('');
        setPrevOverpayment(0);
    };

    const handleItemChange = (e) => {
        const val = e.target.value;
        const year = formData.date.split('-')[0];
        const auto = getAutoPeriod(val);

        if (val === 'CUSTOM') {
            setIsCustom(true);
            setFormData({ ...formData, item: 'CUSTOM', isPrepaid: false });
        } else {
            setIsCustom(false);
            const setting = duesSettings.find(s => s.category === val);
            const newAmount = setting && setting.standardAmount > 0 ? setting.standardAmount : formData.amount;

            if (auto) {
                setFormData({
                    ...formData,
                    item: val,
                    amount: newAmount,
                    isPrepaid: true,
                    startPeriod: `${year}-${auto.start}`,
                    endPeriod: `${year}-${auto.end}`
                });
            } else {
                setFormData({ ...formData, item: val, amount: newAmount, isPrepaid: false });
            }
        }
    };

    const toggleDueSelection = (cat) => {
        setSelectedDues(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const filteredMembers = members.filter(m => {
        const nameMatch = m.name && m.name.includes(memberSearch);
        const nicknameMatch = m.nickname && m.nickname.toLowerCase().includes(memberSearch.toLowerCase());
        return nameMatch || nicknameMatch;
    });

    const selectMember = (name) => {
        setFormData({ ...formData, member: name });
        setMemberSearch(name);
        setIsMemberDropdownOpen(false);
    };

    // Compute settlement preview for UI display
    const settlement = (!editData && selectedDues.length > 0)
        ? computeSettlement()
        : null;

    const received = parseFloat(receivedAmount) || 0;
    const totalAvailable = received + prevOverpayment;

    return (
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Plus size={24} color="var(--success)" />
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                        {editData ? '編輯收入單' : '填寫收入單'}
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
                        <label>收費日期</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>收款人</label>
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

                <div className="form-group" style={{ position: 'relative' }}>
                    <label>社友姓名 <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>(必填)</span></label>
                    <div style={{ position: 'relative' }}>
                        <User size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                        <input
                            type="text"
                            placeholder="點擊選擇或搜尋社友..."
                            style={{ paddingLeft: '2.5rem' }}
                            value={memberSearch}
                            onChange={(e) => {
                                setMemberSearch(e.target.value);
                                setIsMemberDropdownOpen(true);
                                if (e.target.value === '') setFormData({ ...formData, member: '' });
                            }}
                            onFocus={() => {
                                setIsMemberDropdownOpen(true);
                            }}
                            onClick={(e) => {
                                if (isMemberDropdownOpen && memberSearch === formData.member) {
                                    setIsMemberDropdownOpen(false);
                                } else {
                                    setIsMemberDropdownOpen(true);
                                }
                            }}
                            readOnly={!!formData.member && memberSearch === formData.member}
                        />
                        {memberSearch && (
                            <button
                                type="button"
                                onClick={() => {
                                    setMemberSearch('');
                                    setFormData({ ...formData, member: '' });
                                    setIsMemberDropdownOpen(true);
                                }}
                                style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', color: '#94a3b8', padding: '0.25rem' }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {isMemberDropdownOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 100,
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '0.5rem',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            marginTop: '0.25rem'
                        }}>
                            <div
                                onClick={() => selectMember('其他')}
                                style={{
                                    padding: '0.75rem 1rem',
                                    cursor: 'pointer',
                                    borderBottom: '2px solid #f1f5f9',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: '#f8fafc'
                                }}
                                className="member-item"
                            >
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '700', color: 'var(--primary)' }}>其他</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>非社友收入 / 外部入帳</span>
                                </div>
                            </div>
                            {filteredMembers.map(m => (
                                <div
                                    key={m.id}
                                    onClick={() => selectMember(m.name)}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid #f1f5f9',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                    className="member-item"
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '600' }}>{m.name}</span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 'bold' }}>{m.jobTitle1 || '社友'}</span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.nickname}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Batch Collection Section */}
                {!editData && outstandingDues.length > 0 && (
                    <div style={{
                        background: 'rgba(79, 70, 229, 0.05)',
                        padding: '1.25rem',
                        borderRadius: '0.75rem',
                        border: '1px solid rgba(79, 70, 229, 0.2)',
                        marginBottom: '1.5rem'
                    }}>
                        <h4 style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <Save size={18} /> 待沖帳項目 (截至今日)
                        </h4>

                        {/* 收款金額 + 前期溢收款 row */}
                        <div style={{ display: 'grid', gridTemplateColumns: prevOverpayment > 0 ? '1fr 1fr' : '1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label style={{ fontSize: '0.85rem' }}>收款金額 (NT$) <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input
                                    type="number"
                                    placeholder="輸入當次收款金額"
                                    value={receivedAmount}
                                    onChange={e => setReceivedAmount(e.target.value)}
                                    style={{ fontWeight: '700' }}
                                    min="0"
                                />
                            </div>
                            {prevOverpayment > 0 && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-end',
                                    padding: '0.75rem',
                                    background: 'rgba(16, 185, 129, 0.08)',
                                    borderRadius: '0.5rem',
                                    border: '1px solid rgba(16, 185, 129, 0.3)'
                                }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>前期溢收款餘額</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--success)' }}>
                                        NT$ {prevOverpayment.toLocaleString()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 可用沖帳合計 */}
                        {(received > 0 || prevOverpayment > 0) && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.6rem 0.75rem',
                                background: 'rgba(79, 70, 229, 0.08)',
                                borderRadius: '0.5rem',
                                marginBottom: '0.75rem',
                                fontSize: '0.875rem'
                            }}>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    可用沖帳合計
                                    {prevOverpayment > 0 && <span style={{ fontSize: '0.75rem', marginLeft: '0.3rem' }}>（含前期溢收款 {prevOverpayment.toLocaleString()}）</span>}
                                </span>
                                <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '1rem' }}>
                                    NT$ {totalAvailable.toLocaleString()}
                                </span>
                            </div>
                        )}

                        {/* Dues list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {outstandingDues.map(u => {
                                const isChecked = selectedDues.includes(u.category);
                                const willSettle = settlement && settlement.settled.some(s => s.category === u.category);
                                const willSkip = settlement && settlement.skipped.some(s => s.category === u.category);
                                return (
                                    <label key={u.category} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.5rem 0.75rem',
                                        background: isChecked ? 'white' : 'transparent',
                                        borderRadius: '0.5rem',
                                        cursor: 'pointer',
                                        border: isChecked ? '1px solid var(--primary)' : '1px solid transparent',
                                        transition: 'all 0.2s',
                                        opacity: isChecked ? 1 : 0.6
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleDueSelection(u.category)}
                                                style={{ width: '1.15rem', height: '1.15rem' }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{u.category}</div>
                                                {u.dueDate && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>應收日：{u.dueDate}</div>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {willSettle && (
                                                <CheckCircle2 size={15} color="var(--success)" title="可沖清" />
                                            )}
                                            {willSkip && (
                                                <AlertCircle size={15} color="#f59e0b" title="金額不足，本次跳過" />
                                            )}
                                            <div style={{ fontWeight: '700', color: willSkip ? '#f59e0b' : willSettle ? 'var(--success)' : 'var(--primary)' }}>
                                                NT$ {u.standardAmount.toLocaleString()}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>

                        {/* Settlement Summary */}
                        {settlement && (
                            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1' }}>
                                {settlement.settled.length > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                                            ✅ 可沖清 {settlement.settled.length} 項
                                        </span>
                                        <span style={{ fontWeight: '700', color: 'var(--success)' }}>
                                            NT$ {settlement.settled.reduce((s, i) => s + i.standardAmount, 0).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {settlement.skipped.length > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#f59e0b' }}>
                                            ⚠️ 金額不足，跳過 {settlement.skipped.length} 項
                                        </span>
                                        <span style={{ fontWeight: '700', color: '#f59e0b' }}>
                                            NT$ {settlement.skipped.reduce((s, i) => s + i.standardAmount, 0).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {settlement.surplus > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>
                                            💰 沖完後溢收款
                                        </span>
                                        <span style={{ fontWeight: '700', color: 'var(--primary)' }}>
                                            NT$ {settlement.surplus.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Single Item Section (Only if no batch items selected or during edit) */}
                {(selectedDues.length === 0 || editData) && (
                    <>
                        <div className="form-group">
                            <label>項目名稱</label>
                            <select
                                value={isCustom ? 'CUSTOM' : formData.item}
                                onChange={handleItemChange}
                                required
                            >
                                {ALL_PRESET_ITEMS.map(item => (
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
                                    placeholder="請輸入新項目名稱"
                                    value={formData.customItem}
                                    onChange={(e) => setFormData({ ...formData, customItem: e.target.value })}
                                    required
                                />
                            </div>
                        )}

                        <div className="form-group" style={{
                            background: '#f0fdf4',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #bbf7d0',
                            marginBottom: '1rem'
                        }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: formData.isPrepaid ? '1rem' : '0' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.isPrepaid}
                                    onChange={e => setFormData({ ...formData, isPrepaid: e.target.checked })}
                                    style={{ width: '1.25rem', height: '1.25rem' }}
                                />
                                <span style={{ fontWeight: '700', color: 'var(--success)' }}>此筆為「跨月份平攤」收入 (預收性質)</span>
                            </label>

                            {formData.isPrepaid && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid #bbf7d0', paddingTop: '1rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>認列開始</label>
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
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>認列結束</label>
                                            <input
                                                type="month"
                                                value={formData.endPeriod}
                                                onChange={e => setFormData({ ...formData, endPeriod: e.target.value })}
                                                required
                                            />
                                        </div>
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
                    </>
                )}

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
                    <button type="submit" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                        <Save size={18} /> {editData ? '更新收入' : '儲存收入'}
                    </button>
                    {editData && (
                        <button
                            type="button"
                            onClick={() => onDelete(editData.id)}
                            style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
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
            <style dangerouslySetInnerHTML={{
                __html: `
                .member-item:hover {
                    background-color: #f8fafc;
                }
            `}} />
        </div>
    );
}

export default IncomeForm;
