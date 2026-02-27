import React, { useState } from 'react';
import { Users, CheckCircle, XCircle, DollarSign, Calendar, Settings, Plus, Save, Trash2, X } from 'lucide-react';

function MemberDues({ records, members, duesSettings, loading, onEdit, onAddDuesSetting, onUpdateDuesSetting, onDeleteDuesSetting }) {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSetting, setEditingSetting] = useState(null);
    const [modalData, setModalData] = useState({ category: '', dueDate: '', standardAmount: '' });

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '3rem' }}>載入中...</div>;
    }

    // Base categories from settings
    const settingCats = duesSettings.map(s => (s.category || '').trim()).filter(Boolean);

    // Categories used in records for the selected year
    const recordCatsForYear = records
        .filter(r => r.type === 'income' && r.member && r.item && r.date.startsWith(selectedYear))
        .map(r => r.item.trim());

    const DUES_CATEGORIES = Array.from(new Set([
        ...settingCats,
        ...recordCatsForYear
    ]));

    const openAddModal = () => {
        setEditingSetting(null);
        setModalData({ category: '', dueDate: '', standardAmount: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (cat) => {
        const setting = duesSettings.find(s => s.category.trim() === cat.trim());
        if (setting) {
            setEditingSetting(setting);
            setModalData({
                category: setting.category,
                dueDate: setting.dueDate || '',
                standardAmount: setting.standardAmount.toString()
            });
        } else {
            // Case for items found in records but not in settings
            setEditingSetting(null);
            setModalData({
                category: cat,
                dueDate: '',
                standardAmount: '0'
            });
        }
        setIsModalOpen(true);
    };

    const handleModalSubmit = (e) => {
        e.preventDefault();
        const payload = {
            category: modalData.category,
            dueDate: modalData.dueDate,
            standardAmount: parseFloat(modalData.standardAmount) || 0
        };

        if (editingSetting) {
            onUpdateDuesSetting(editingSetting.category, payload);
        } else {
            onAddDuesSetting(payload);
        }
        setIsModalOpen(false);
    };

    // Get available years from records
    const availableYears = Array.from(new Set(records.map(r => r.date.split('-')[0]))).sort((a, b) => b - a);
    if (!availableYears.includes(selectedYear)) {
        availableYears.push(selectedYear);
        availableYears.sort((a, b) => b - a);
    }

    // Aggregate data by member
    const memberPaymentData = {};
    const incomeRecords = records.filter(r => {
        const isIncome = r.type === 'income' && (r.member || '').trim();
        const isSelectedYear = r.date.startsWith(selectedYear);
        const item = (r.item || '').trim();
        return isIncome && isSelectedYear && item;
    });

    incomeRecords.forEach(record => {
        const memberName = record.member.trim();
        const category = record.item.trim();

        if (!memberPaymentData[memberName]) {
            memberPaymentData[memberName] = {};
        }

        if (!memberPaymentData[memberName][category]) {
            memberPaymentData[memberName][category] = { amount: 0, record: null };
        }

        memberPaymentData[memberName][category].amount += record.amount;
        memberPaymentData[memberName][category].record = record;
    });

    // Calculate overpayment balance per member (all time, not year-filtered)
    const memberOverpayment = {};
    records
        .filter(r => r.type === 'income' && r.member && r.item === '溢收款')
        .forEach(r => {
            const name = r.member.trim();
            memberOverpayment[name] = (memberOverpayment[name] || 0) + r.amount;
        });

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

    const getMemberTitle = (memberName) => {
        const m = members.find(mem => mem.name === memberName);
        return m ? (m.jobTitle1 || '社友') : '';
    };

    const getTitlePriority = (memberName) => {
        const title = getMemberTitle(memberName);
        return TITLE_ORDER[title] || 99;
    };

    const sortMembers = (mList) => {
        return [...mList].sort((a, b) => {
            const prioA = getTitlePriority(a);
            const prioB = getTitlePriority(b);
            if (prioA !== prioB) return prioA - prioB;
            return a.localeCompare(b, 'zh-Hant');
        });
    };

    // Use all registration members as the base list
    const dispMembers = members.map(m => m.name);

    // Also include any members from records who are not in the registration list
    const legacyMembers = Object.keys(memberPaymentData).filter(name => !dispMembers.includes(name));
    const allUniqueMembers = sortMembers([...dispMembers, ...legacyMembers]);

    // Minguo Calendar Helpers
    const toMinguoYear = (adYear) => parseInt(adYear) - 1911;

    return (
        <div className="glass-card">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Users size={24} color="var(--primary)" />
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{toMinguoYear(selectedYear)}年度 社友繳費明細表</h3>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                        onClick={openAddModal}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                        <Plus size={16} /> 新增收費項目
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <Calendar size={18} color="var(--text-muted)" />
                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>年度：</span>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            style={{ border: 'none', background: 'transparent', fontWeight: '700', color: 'var(--primary)', cursor: 'pointer', outline: 'none', padding: '2px' }}
                        >
                            {availableYears.length > 0 ? (
                                availableYears.map(y => <option key={y} value={y}>{toMinguoYear(y)} 年度</option>)
                            ) : (
                                <option value={selectedYear}>{toMinguoYear(selectedYear)} 年度</option>
                            )}
                        </select>
                    </div>
                </div>
            </div>

            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <table style={{ fontSize: '0.875rem', borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
                    <thead>
                        <tr>
                            <th style={{ position: 'sticky', top: 0, left: 0, background: '#f1f5f9', zIndex: 20, minWidth: '80px', borderRight: '1px solid #e2e8f0', borderBottom: '2px solid #cbd5e1' }}>職稱</th>
                            <th style={{ position: 'sticky', top: 0, left: '80px', background: '#f1f5f9', zIndex: 20, minWidth: '100px', borderRight: '1px solid #e2e8f0', borderBottom: '2px solid #cbd5e1' }}>社友姓名</th>
                            {DUES_CATEGORIES.map(cat => {
                                const setting = duesSettings.find(s => s.category === cat);
                                return (
                                    <th
                                        key={cat}
                                        style={{ position: 'sticky', top: 0, textAlign: 'center', minWidth: '120px', whiteSpace: 'nowrap', cursor: 'pointer', background: '#f1f5f9', zIndex: 10, borderBottom: '2px solid #cbd5e1' }}
                                        onClick={() => openEditModal(cat)}
                                        title={`點擊編輯 ${cat} 的收費設定`}
                                    >
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                                            <span>{cat}</span>
                                            {setting && setting.standardAmount > 0 && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'normal' }}>
                                                    (應收 {setting.standardAmount.toLocaleString()})
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                );
                            })}
                            <th style={{ position: 'sticky', top: 0, textAlign: 'right', fontWeight: 'bold', background: '#f1f5f9', zIndex: 10, borderLeft: '1px solid #e2e8f0', borderBottom: '2px solid #cbd5e1', whiteSpace: 'nowrap', minWidth: '100px' }}>年度總計</th>
                            <th style={{ position: 'sticky', top: 0, textAlign: 'right', fontWeight: 'bold', background: '#ecfdf5', zIndex: 10, borderLeft: '1px solid #bbf7d0', borderBottom: '2px solid #bbf7d0', whiteSpace: 'nowrap', minWidth: '100px', color: 'var(--success)' }}>溢收款餘額</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allUniqueMembers.length === 0 ? (
                            <tr>
                                <td colSpan={DUES_CATEGORIES.length + 3} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                    尚未建立社友資料且無繳費紀錄
                                </td>
                            </tr>
                        ) : (
                            allUniqueMembers.map(member => {
                                let memberTotal = 0;
                                const payments = memberPaymentData[member] || {};
                                const jobTitle = getMemberTitle(member);

                                return (
                                    <tr key={member}>
                                        <td style={{
                                            position: 'sticky',
                                            left: 0,
                                            background: 'white',
                                            zIndex: 1,
                                            borderRight: '1px solid #e2e8f0',
                                            fontSize: '0.75rem',
                                            color: 'var(--primary)',
                                            fontWeight: '600'
                                        }}>
                                            {jobTitle}
                                        </td>
                                        <td style={{
                                            fontWeight: '600',
                                            position: 'sticky',
                                            left: '80px',
                                            background: 'white',
                                            zIndex: 1,
                                            borderRight: '1px solid #e2e8f0'
                                        }}>
                                            {member}
                                        </td>
                                        {DUES_CATEGORIES.map(cat => {
                                            const data = payments[cat];
                                            const amount = data ? data.amount : 0;
                                            const record = data ? data.record : null;
                                            const setting = duesSettings.find(s => s.category === cat);
                                            const expectedAmt = setting ? setting.standardAmount : 0;
                                            memberTotal += amount;

                                            return (
                                                <td key={cat} style={{ textAlign: 'center', padding: '0.5rem' }}>
                                                    {amount > 0 ? (
                                                        <div
                                                            onClick={() => onEdit(record)}
                                                            title="點擊查看或編輯此筆紀錄"
                                                            style={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'center',
                                                                cursor: 'pointer',
                                                                padding: '0.25rem',
                                                                borderRadius: '0.25rem',
                                                                transition: 'background 0.2s',
                                                            }}
                                                            className="payment-cell"
                                                        >
                                                            <CheckCircle size={16} color="var(--success)" />
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: '700' }}>
                                                                {amount.toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}>
                                                            <XCircle size={16} color="#cbd5e1" />
                                                            {expectedAmt > 0 && (
                                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                                    應收 {expectedAmt.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td style={{
                                            textAlign: 'right',
                                            fontWeight: '800',
                                            color: 'var(--primary)',
                                            background: '#f8fafc',
                                            borderLeft: '1px solid #e2e8f0',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            NT$ {memberTotal.toLocaleString()}
                                        </td>
                                        <td style={{
                                            textAlign: 'right',
                                            fontWeight: '700',
                                            background: '#ecfdf5',
                                            borderLeft: '1px solid #bbf7d0',
                                            whiteSpace: 'nowrap',
                                            color: (memberOverpayment[member] || 0) > 0 ? 'var(--success)' : 'var(--text-muted)'
                                        }}>
                                            {(memberOverpayment[member] || 0) > 0
                                                ? `NT$ ${Math.round(memberOverpayment[member]).toLocaleString()}`
                                                : '—'
                                            }
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Billing Settings Modal */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    paddingTop: '10vh',
                    zIndex: 1000
                }}>
                    <div className="glass-card" style={{ width: '90%', maxWidth: '400px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h4 style={{ fontWeight: '700', fontSize: '1.25rem' }}>
                                {editingSetting ? '編輯收費設定' : '新增收費項目'}
                            </h4>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', color: '#94a3b8' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleModalSubmit}>
                            <div className="form-group">
                                <label>項目名稱</label>
                                <input
                                    type="text"
                                    value={modalData.category}
                                    onChange={e => setModalData({ ...modalData, category: e.target.value })}
                                    placeholder="例如：114年春季旅遊"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>應收日期 (可為空)</label>
                                <input
                                    type="date"
                                    value={modalData.dueDate}
                                    onChange={e => setModalData({ ...modalData, dueDate: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>統一應收金額 (NT$)</label>
                                <input
                                    type="number"
                                    value={modalData.standardAmount}
                                    onChange={e => setModalData({ ...modalData, standardAmount: e.target.value })}
                                    placeholder="0"
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="submit" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                                    <Save size={18} /> 儲存設定
                                </button>
                                {editingSetting && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm('確定要刪除此收費項目嗎？')) {
                                                onDeleteDuesSetting(editingSetting.category);
                                                setIsModalOpen(false);
                                            }
                                        }}
                                        style={{ background: 'var(--danger)', padding: '0.5rem' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(79, 70, 229, 0.05)', borderRadius: '0.5rem', border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <DollarSign size={16} /> 功能說明
                </h4>
                <ul style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '1.25rem', lineHeight: '1.6' }}>
                    <li>點擊 <strong>[新增收費項目]</strong> 按鈕可擴充報表欄位。</li>
                    <li>點擊 <strong>表頭項目名稱</strong>（例如：1-3月社費）可設定統一應收金額。</li>
                    <li>設定金額後，未繳費社友的格位會自動顯示 <strong>[應收 XXX]</strong> 提醒文字。</li>
                </ul>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        .payment-cell:hover {
          background: rgba(16, 185, 129, 0.1);
        }
        table th {
          background: #f8fafc;
          color: var(--text-main);
          font-weight: 700;
          padding: 0.75rem;
          border-bottom: 2px solid #e2e8f0;
        }
        table th:hover {
          background: #f1f5f9;
        }
        table td {
          padding: 0.75rem;
          border-bottom: 1px solid #e2e8f0;
        }
      `}} />
        </div>
    );
}

export default MemberDues;
