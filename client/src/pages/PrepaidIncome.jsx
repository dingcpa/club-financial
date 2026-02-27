import React, { useState } from 'react';
import { PiggyBank, ArrowRight, History, Calendar } from 'lucide-react';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function PrepaidIncome({ records, loading }) {
    const currentYear = new Date().getFullYear().toString();
    const currentMonth = (new Date().getMonth() + 1).toString();

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

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

    // Helper to parse "X-Y月"
    const parsePeriod = (itemName) => {
        const match = itemName.match(/(\d+)-(\d+)月/);
        if (match) {
            return { start: parseInt(match[1]), end: parseInt(match[2]) };
        }
        return null;
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

    // Helper to calculate recognized months relative to target dashboard date
    const getRecognizedMonths = (targetY, targetM, startP, endP, recordDate) => {
        if (!startP || !endP) return 0;

        const targetStr = `${targetY}-${targetM.toString().padStart(2, '0')}`;
        const totalMonths = getTotalMonthsInRange(startP, endP);

        if (startP.includes('-')) {
            // YYYY-MM format
            if (targetStr < startP) return 0;
            if (targetStr >= endP) return totalMonths;

            // Calculate months from start to target
            const [sY, sM] = startP.split('-').map(Number);
            return (targetY - sY) * 12 + (targetM - sM) + 1;
        } else {
            // Legacy month-only format
            const recordYear = parseInt(recordDate.split('-')[0]);
            if (targetY < recordYear) return 0;
            if (targetY > recordYear) return totalMonths;

            const startM = parseInt(startP);
            const endM = parseInt(endP);
            return Math.max(0, Math.min(totalMonths, targetM - startM + 1));
        }
    };

    const targetYear = parseInt(selectedYear);
    const targetMonth = parseInt(selectedMonth);

    const prepaidRecords = [];
    let totalPrepaidLiability = 0;

    records.filter(r => r.type === 'income').forEach(record => {
        // Priority to explicit YYYY-MM periods
        let startP = record.startPeriod;
        let endP = record.endPeriod;
        let isYYYYMM = !!(startP && startP.includes('-'));

        // Month-only fields
        if (startP === undefined && record.startMonth) startP = record.startMonth;
        if (endP === undefined && record.endMonth) endP = record.endMonth;

        // Fallback
        if (startP === undefined) {
            const p = parsePeriod(record.item);
            if (p) {
                startP = p.start.toString();
                endP = p.end.toString();
            }
        }

        if (!startP) return;

        const monthsCount = getTotalMonthsInRange(startP, endP);
        const monthlyAmount = record.amount / monthsCount;
        const recognizedMonths = getRecognizedMonths(targetYear, targetMonth, startP, endP, record.date);

        const recognizedAmount = recognizedMonths * monthlyAmount;
        const remainingAmount = record.amount - recognizedAmount;

        const recordYear = record.date.split('-')[0];
        const formattedStart = isYYYYMM ? toMinguoMonth(startP) : `${toMinguoYear(recordYear)}-${startP.padStart(2, '0')}`;
        const formattedEnd = isYYYYMM ? toMinguoMonth(endP) : `${toMinguoYear(recordYear)}-${endP.padStart(2, '0')}`;

        prepaidRecords.push({
            ...record,
            periodText: `${formattedStart} ~ ${formattedEnd}`,
            total: record.amount,
            recognized: recognizedAmount,
            remaining: remainingAmount,
            monthsLeft: monthsCount - recognizedMonths,
            isYYYYMM
        });

        totalPrepaidLiability += remainingAmount;
    });

    const availableYears = Array.from(new Set(records.map(r => r.date.split('-')[0]))).sort((a, b) => b - a);

    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <PiggyBank size={24} color="var(--success)" /> {toMinguoYear(selectedYear)}年 {selectedMonth}月 預收收入明細表
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

            <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
                <div className="glass-card stat-card" style={{ flex: 1, background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)', color: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <PiggyBank size={32} />
                        <div>
                            <div style={{ opacity: 0.8, fontSize: '0.875rem' }}>截至 {toMinguoYear(selectedYear)}年{selectedMonth}月 預收收入餘額</div>
                            <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>NT$ {Math.round(totalPrepaidLiability).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card">
                <div style={{ overflowX: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th>收款日期</th>
                                <th>社友</th>
                                <th>項目</th>
                                <th>認列區間</th>
                                <th style={{ textAlign: 'right' }}>原始金額</th>
                                <th style={{ textAlign: 'right' }}>已認列 (累計)</th>
                                <th style={{ textAlign: 'right', color: 'var(--success)' }}>剩餘預收額</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prepaidRecords.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        此期間尚無預收收入紀錄
                                    </td>
                                </tr>
                            ) : (
                                prepaidRecords.sort((a, b) => {
                                    const aZero = Math.round(a.remaining) === 0;
                                    const bZero = Math.round(b.remaining) === 0;
                                    if (aZero && !bZero) return 1;
                                    if (!aZero && bZero) return -1;
                                    return new Date(b.date) - new Date(a.date);
                                }).map(r => (
                                    <tr key={r.id} style={{ opacity: r.remaining === 0 ? 0.6 : 1 }}>
                                        <td>{toMinguoDate(r.date)}</td>
                                        <td style={{ fontWeight: '600' }}>{r.member || '-'}</td>
                                        <td>{r.item}</td>
                                        <td>
                                            <span style={{
                                                padding: '0.25rem 0.6rem',
                                                background: '#f0fdf4',
                                                color: '#16a34a',
                                                borderRadius: '1rem',
                                                fontSize: '0.75rem',
                                                fontWeight: '600'
                                            }}>
                                                {r.periodText}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{Math.round(r.total).toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', color: '#6366f1' }}>{Math.round(r.recognized).toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: r.remaining > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                                            {Math.round(r.remaining).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                    <History size={20} color="var(--primary)" />
                    <div>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>已認列 (累計)</div>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            截至 <strong>{toMinguoYear(selectedYear)}年 {selectedMonth}月</strong> 已轉入各月收支報表中的認列金額。
                        </p>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                    <ArrowRight size={20} color="var(--success)" />
                    <div>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>預收收入餘額</div>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            截至 <strong>{toMinguoYear(selectedYear)}年 {selectedMonth}月</strong> 尚未認列為收入的預收項餘額。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PrepaidIncome;
