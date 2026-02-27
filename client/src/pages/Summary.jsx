import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, Edit3, Calendar, X, Eye, ArrowRight } from 'lucide-react';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function Summary({ records, loading, onEdit }) {
    const currentYear = new Date().getFullYear().toString();
    const currentMonth = (new Date().getMonth() + 1).toString();

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [detailView, setDetailView] = useState(null); // { name: string, type: string, records: [] }

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '3rem' }}>載入中...</div>;
    }

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

    // Helper to parse "X-Y月" from item name (Legacy Fallback)
    const parsePeriod = (itemName) => {
        const match = itemName.match(/(\d+)-(\d+)月/);
        if (match) {
            return { start: parseInt(match[1]), end: parseInt(match[2]) };
        }
        return null;
    };

    // Helper to check if dashboard month is in range
    const isDashboardMonthInRange = (targetY, targetM, startP, endP) => {
        if (!startP || !endP) return false;

        if (startP.includes('-')) {
            const targetStr = `${targetY}-${targetM.toString().padStart(2, '0')}`;
            return targetStr >= startP && targetStr <= endP;
        }

        const startM = parseInt(startP);
        const endM = parseInt(endP);
        return targetM >= startM && targetM <= endM;
    };

    // Helper to calculate total months in a range
    const getTotalMonthsInRange = (startP, endP) => {
        if (!startP || !endP) return 1;
        if (startP.includes('-')) {
            const [sY, sM] = startP.split('-').map(Number);
            const [eY, eM] = endP.split('-').map(Number);
            return (eY - sY) * 12 + (eM - sM) + 1;
        }
        return parseInt(endP) - parseInt(startP) + 1;
    };

    // Logic for Monthly Report Calculation
    const targetYear = parseInt(selectedYear);
    const targetMonth = parseInt(selectedMonth);

    let totalIncome = 0;
    let totalExpense = 0;
    const incomeGroups = {};
    const expenseGroups = {};

    // Category Mapping Logic
    const getIncomeCategory = (item) => {
        const duesItems = ['1-3月社費', '4-6月社費', '7-9月社費', '10-12月社費', '入社費'];
        const redBoxItems = [
            '授證紅箱', '交接紅箱', '春節紅箱', '母親節紅箱', '父親節紅箱', '中秋節紅箱',
            '例會歡喜紅箱', '其他紅箱'
        ];

        if (duesItems.includes(item)) return '社費收入';
        if (redBoxItems.some(rb => item.includes(rb))) return '紅箱收入';
        return '其他收入';
    };

    const getExpenseCategory = (item) => {
        const officeItems = ['辨公室租金及水電', '人事費 -薪資/油資', '文具費', '郵電費', '健保費', '印刷費', '雜費及設備更新', '助秘提撥金'];
        const mealItems = ['例會餐費(一般/聯合)', '例會餐費(女賓夕/眷屬聯歡)'];
        const activityItems = [
            '資訊維修費(含地區網站)',
            '健遊活動', '演講車馬費', '爐邊會', '金蘭聯誼', '高球費用', '職業參觀', '授證之旅補助', '還社長', '研習班'
        ];

        if (officeItems.includes(item)) return '辦公室設備費';
        if (mealItems.includes(item)) return '餐費';
        if (activityItems.includes(item)) return '社務活動費';
        return '其他';
    };

    records.forEach(record => {
        if (record.type === 'transfer') return; // Transfers don't affect P&L

        const dateParts = record.date.split('-');
        const recordYear = parseInt(dateParts[0]);
        const recordMonth = parseInt(dateParts[1]);

        // Support Legacy Names for categorization during transition if needed
        let item = record.item;
        if (item === '一般例會/聯合例會') item = '例會餐費(一般/聯合)';
        if (item === '女賓夕/眷屬聯歡') item = '例會餐費(女賓夕/眷屬聯歡)';
        if (item === '其他收入-例會歡喜紅箱') item = '例會歡喜紅箱';
        if (item === '其他收入-其他紅箱') item = '其他紅箱';

        // Unified period deduction
        let startP = record.startPeriod;
        let endP = record.endPeriod;
        if (startP === undefined && record.startMonth) startP = record.startMonth;
        if (endP === undefined && record.endMonth) endP = record.endMonth;

        if (startP === undefined) {
            const p = parsePeriod(item);
            if (p) {
                startP = p.start.toString();
                endP = p.end.toString();
            }
        }

        const isMonthOnly = startP && !startP.includes('-');
        const sameYear = recordYear === targetYear;
        const inRange = startP && endP && (
            (isMonthOnly && sameYear && isDashboardMonthInRange(targetYear, targetMonth, startP, endP)) ||
            (!isMonthOnly && isDashboardMonthInRange(targetYear, targetMonth, startP, endP))
        );

        if (startP && endP) {
            // Amortized Record
            if (inRange) {
                const monthsCount = getTotalMonthsInRange(startP, endP);
                const allocatedAmount = record.amount / monthsCount;

                const groups = record.type === 'income' ? incomeGroups : expenseGroups;
                const groupKey = item;
                if (!groups[groupKey]) groups[groupKey] = { total: 0, records: [] };

                groups[groupKey].records.push({
                    ...record,
                    item, // Use updated item name
                    displayAmount: allocatedAmount,
                    isAllocated: true,
                    periodNote: isMonthOnly
                        ? `(${toMinguoYear(recordYear)}-${startP.padStart(2, '0')} ~ ${toMinguoYear(recordYear)}-${endP.padStart(2, '0')} 平攤)`
                        : `(${toMinguoMonth(startP)} ~ ${toMinguoMonth(endP)} 平攤)`
                });
                groups[groupKey].total += allocatedAmount;
                if (record.type === 'income') totalIncome += allocatedAmount;
                else totalExpense += allocatedAmount;
            }
        } else {
            // Regular Record: Only if in payment month
            if (recordYear === targetYear && recordMonth === targetMonth) {
                const groups = record.type === 'income' ? incomeGroups : expenseGroups;
                const groupKey = item;
                if (!groups[groupKey]) groups[groupKey] = { total: 0, records: [] };

                groups[groupKey].records.push({ ...record, item, displayAmount: record.amount });
                groups[groupKey].total += record.amount;
                if (record.type === 'income') totalIncome += record.amount;
                else totalExpense += record.amount;
            }
        }
    });

    const balance = totalIncome - totalExpense;
    const availableYears = Array.from(new Set(records.map(r => r.date.split('-')[0]))).sort((a, b) => b - a);

    const incomeTableData = Object.keys(incomeGroups).map(name => ({
        category: getIncomeCategory(name),
        name,
        type: 'income',
        ...incomeGroups[name]
    })).sort((a, b) => {
        const order = { '社費收入': 1, '紅箱收入': 2, '其他收入': 3 };
        const orderA = order[a.category] || 99;
        const orderB = order[b.category] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, 'zh-Hant');
    });

    const EXPENSE_CAT_ORDER = {
        '辦公室設備費': 1,
        '餐費': 2,
        '社務活動費': 3,
        '其他': 4
    };

    const expenseTableData = Object.keys(expenseGroups).map(name => ({
        category: getExpenseCategory(name),
        name,
        type: 'expense',
        ...expenseGroups[name]
    })).sort((a, b) => {
        const orderA = EXPENSE_CAT_ORDER[a.category] || 99;
        const orderB = EXPENSE_CAT_ORDER[b.category] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, 'zh-Hant');
    });

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Wallet size={24} color="var(--primary)" /> {toMinguoYear(selectedYear)}年 {selectedMonth}月 收支月報表
                </h3>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div className="glass-card" style={{ padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={16} color="var(--text-muted)" />
                        <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 'bold', outline: 'none' }}>
                            {availableYears.length > 0 ? (
                                availableYears.map(y => <option key={y} value={y}>{toMinguoYear(y)} 年度</option>)
                            ) : (
                                <option value={currentYear}>{toMinguoYear(currentYear)} 年度</option>
                            )}
                        </select>
                    </div>
                    <div className="glass-card" style={{ padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 'bold', outline: 'none' }}>
                            {MONTHS.map(m => <option key={m} value={m}>{m}月份</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="dashboard-header">
                <div className="glass-card stat-card">
                    <div className="stat-label">本月合計收入</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>
                        NT$ {Math.round(totalIncome).toLocaleString()}
                    </div>
                    <TrendingUp size={20} color="var(--success)" style={{ marginTop: '0.5rem' }} />
                </div>
                <div className="glass-card stat-card">
                    <div className="stat-label">本月合計支出</div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>
                        NT$ {Math.round(totalExpense).toLocaleString()}
                    </div>
                    <TrendingDown size={20} color="var(--danger)" style={{ marginTop: '0.5rem' }} />
                </div>
                <div className="glass-card stat-card" style={{ background: 'var(--primary)', color: 'white' }}>
                    <div className="stat-label" style={{ color: 'rgba(255,255,255,0.8)' }}>本月收支餘額</div>
                    <div className="stat-value">
                        NT$ {Math.round(balance).toLocaleString()}
                    </div>
                    <Wallet size={20} color="white" style={{ marginTop: '0.5rem' }} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* Income Table */}
                <div className="glass-card" style={{ padding: '1rem' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--success)', marginBottom: '1rem', borderBottom: '2px solid var(--success)', paddingBottom: '0.5rem' }}>
                        收入明細表
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
                            <thead>
                                <tr style={{ background: 'transparent' }}>
                                    <th style={{ background: 'transparent', border: 'none', fontSize: '0.85rem' }}>類別</th>
                                    <th style={{ background: 'transparent', border: 'none', fontSize: '0.85rem' }}>項目名稱</th>
                                    <th style={{ textAlign: 'right', background: 'transparent', border: 'none', fontSize: '0.85rem' }}>月計</th>
                                </tr>
                            </thead>
                            <tbody>
                                {incomeTableData.length === 0 ? (
                                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>無收入紀錄</td></tr>
                                ) : (
                                    incomeTableData.map((group, index) => (
                                        <tr key={index} className="summary-row" onClick={() => setDetailView(group)} style={{ cursor: 'pointer', background: '#f0fdf4', borderRadius: '0.5rem' }}>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 'bold' }}>{group.category}</td>
                                            <td style={{ fontWeight: '600' }}>{group.name}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '800' }} className="income-amt">
                                                {Math.round(group.total).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Expense Table */}
                <div className="glass-card" style={{ padding: '1rem' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--danger)', marginBottom: '1rem', borderBottom: '2px solid var(--danger)', paddingBottom: '0.5rem' }}>
                        支出明細表
                    </h4>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
                            <thead>
                                <tr style={{ background: 'transparent' }}>
                                    <th style={{ background: 'transparent', border: 'none', fontSize: '0.85rem' }}>類別</th>
                                    <th style={{ background: 'transparent', border: 'none', fontSize: '0.85rem' }}>項目名稱</th>
                                    <th style={{ textAlign: 'right', background: 'transparent', border: 'none', fontSize: '0.85rem' }}>月計</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenseTableData.length === 0 ? (
                                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>無支出紀錄</td></tr>
                                ) : (
                                    expenseTableData.map((group, index) => (
                                        <tr key={index} className="summary-row" onClick={() => setDetailView(group)} style={{ cursor: 'pointer', background: '#fef2f2', borderRadius: '0.5rem' }}>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 'bold' }}>{group.category}</td>
                                            <td style={{ fontWeight: '600' }}>{group.name}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '800' }} className="expense-amt">
                                                {Math.round(group.total).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {detailView && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)'
                }} onClick={() => setDetailView(null)}>
                    <div style={{
                        background: 'white', width: '100%', maxWidth: '800px',
                        borderRadius: '1rem', overflow: 'hidden', display: 'flex',
                        flexDirection: 'column', maxHeight: '90vh'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div>
                                <div style={{ opacity: 0.8, fontSize: '0.875rem' }}>{toMinguoYear(selectedYear)}年 {selectedMonth}月 淨收支</div>
                                <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>NT$ {Math.round(balance).toLocaleString()}</div>
                                <h4 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{detailView.name} 明細</h4>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                    本月認列合計：<strong style={{ color: detailView.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>NT$ {Math.round(detailView.total).toLocaleString()}</strong>
                                </div>
                            </div>
                            <button onClick={() => setDetailView(null)} style={{ background: 'transparent' }}><X size={20} /></button>
                        </div>

                        <div style={{ overflowY: 'auto', padding: '1.5rem' }}>
                            <table style={{ fontSize: '0.875rem' }}>
                                <thead>
                                    <tr>
                                        <th>原始日期</th>
                                        {detailView.type === 'income' && <th>社友</th>}
                                        <th style={{ textAlign: 'right' }}>本月認列額</th>
                                        <th>類型/區間</th>
                                        <th>備註</th>
                                        <th style={{ width: '40px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detailView.records.map((record, i) => (
                                        <tr key={record.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td>{toMinguoDate(record.date)}</td>
                                            {detailView.type === 'income' && <td style={{ fontWeight: '600' }}>{record.member || '-'}</td>}
                                            <td style={{ textAlign: 'right', fontWeight: '700' }} className={detailView.type === 'income' ? 'income-amt' : 'expense-amt'}>
                                                NT$ {Math.round(record.displayAmount).toLocaleString()}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {record.isAllocated ? '平攤認列' : '全額認列'}
                                                    </span>
                                                    {record.isAllocated && (
                                                        <span style={{
                                                            padding: '0.15rem 0.5rem',
                                                            background: '#f0fdf4',
                                                            color: '#16a34a',
                                                            borderRadius: '1rem',
                                                            fontSize: '0.7rem',
                                                            fontWeight: '600',
                                                            display: 'inline-block',
                                                            alignSelf: 'start'
                                                        }}>
                                                            {record.periodNote.replace('(', '').replace(' 平攤)', '')}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ maxWidth: '150px', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                                                {record.remark || '-'}
                                            </td>
                                            <td>
                                                <button onClick={() => { setDetailView(null); onEdit(record); }} title="編輯原始紀錄" style={{ background: 'transparent' }}>
                                                    <Edit3 size={16} color="var(--primary)" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
                            <button onClick={() => setDetailView(null)} style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.5rem' }}>關閉視窗</button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .summary-row:hover {
                    background-color: #f8fafc !important;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                }
                `
            }} />
        </div>
    );
}

export default Summary;
