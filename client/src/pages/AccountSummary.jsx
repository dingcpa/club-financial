import React, { useState, useMemo } from 'react';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Search, Calendar, ChevronRight, ChevronDown, Edit3 } from 'lucide-react';

function AccountSummary({ records, loading, onEdit }) {
    const [selectedAccount, setSelectedAccount] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const ACCOUNTS = ['淑華代收付', '一銀帳戶', '社長代收付'];

    // Minguo Calendar Helpers
    const toMinguoYear = (adYear) => parseInt(adYear) - 1911;
    const toMinguoDate = (adDateStr) => {
        if (!adDateStr) return '';
        const [y, m, d] = adDateStr.split('-');
        return `${toMinguoYear(y)}-${m}-${d}`;
    };

    const accountData = useMemo(() => {
        const stats = {
            '淑華代收付': { income: 0, expense: 0, balance: 0, transactions: [] },
            '一銀帳戶': { income: 0, expense: 0, balance: 0, transactions: [] },
            '社長代收付': { income: 0, expense: 0, balance: 0, transactions: [] }
        };

        records.forEach(record => {
            const amount = parseFloat(record.amount) || 0;

            if (record.type === 'transfer') {
                const fromAcc = record.fromAccount;
                const toAcc = record.toAccount;

                if (stats[fromAcc]) {
                    stats[fromAcc].expense += amount; // Count transfer out as cumulative payment
                    stats[fromAcc].balance -= amount;
                    stats[fromAcc].transactions.push(record);
                }
                if (stats[toAcc]) {
                    stats[toAcc].income += amount; // Count transfer in as cumulative receipt
                    stats[toAcc].balance += amount;
                    stats[toAcc].transactions.push(record);
                }
            } else {
                const acc = record.account || '淑華代收付';
                if (stats[acc]) {
                    if (record.type === 'income') {
                        stats[acc].income += amount;
                        stats[acc].balance += amount;
                    } else {
                        stats[acc].expense += amount;
                        stats[acc].balance -= amount;
                    }
                    stats[acc].transactions.push(record);
                }
            }
        });

        // Sort transactions by date descending
        Object.keys(stats).forEach(acc => {
            stats[acc].transactions.sort((a, b) => b.date.localeCompare(a.date));
        });

        return stats;
    }, [records]);

    const filteredTransactions = useMemo(() => {
        let txs = [];
        if (selectedAccount === 'ALL') {
            // In ALL view, we want one instance of each record
            txs = records.filter(t =>
                (t.type === 'transfer') ||
                (ACCOUNTS.includes(t.account || '淑華代收付'))
            );
        } else {
            txs = accountData[selectedAccount].transactions;
        }

        return txs
            .filter(t =>
                (t.item || '').includes(searchTerm) ||
                (t.member || '').includes(searchTerm) ||
                (t.remark || '').includes(searchTerm)
            )
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [accountData, selectedAccount, searchTerm]);

    if (loading) return <div className="loading">讀取中...</div>;

    return (
        <div className="account-summary-container">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <Wallet size={28} color="var(--primary)" />
                <h3 style={{ fontSize: '1.75rem', fontWeight: '800' }}>資金帳戶明細表</h3>
            </div>

            {/* Account Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {ACCOUNTS.map(acc => (
                    <div
                        key={acc}
                        className={`glass-card ${selectedAccount === acc ? 'active-account' : ''}`}
                        onClick={() => setSelectedAccount(acc === selectedAccount ? 'ALL' : acc)}
                        style={{
                            padding: '1.5rem',
                            cursor: 'pointer',
                            border: selectedAccount === acc ? '2px solid var(--primary)' : '1px solid transparent',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <span style={{ fontWeight: '700', color: 'var(--text-muted)' }}>{acc}</span>
                            <Wallet size={20} color={selectedAccount === acc ? 'var(--primary)' : '#94a3b8'} />
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem' }}>
                            NT$ {Math.round(accountData[acc].balance).toLocaleString()}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                            <div>
                                <div style={{ color: 'var(--success)', fontWeight: '600' }}>累積收款</div>
                                <div>+{Math.round(accountData[acc].income).toLocaleString()}</div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--danger)', fontWeight: '600' }}>累積付款</div>
                                <div>-{Math.round(accountData[acc].expense).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Transaction List */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                        {selectedAccount === 'ALL' ? '所有帳戶' : selectedAccount} 明細紀錄
                    </h4>
                    <div style={{ display: 'flex', gap: '0.75rem', flex: 1, maxWidth: '400px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="搜尋項目、社友或備註..."
                                style={{ paddingLeft: '2.5rem' }}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                                <th style={{ padding: '1rem 0.5rem' }}>日期</th>
                                <th style={{ padding: '1rem 0.5rem' }}>帳戶</th>
                                <th style={{ padding: '1rem 0.5rem' }}>項目 / 對象</th>
                                <th style={{ padding: '1rem 0.5rem', textAlign: 'right' }}>金額</th>
                                <th style={{ padding: '1rem 0.5rem' }}>備註</th>
                                <th style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        無相關交易紀錄
                                    </td>
                                </tr>
                            ) : (
                                filteredTransactions.map((tx, idx) => (
                                    <tr key={tx.id || idx} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.9rem' }}>
                                        <td style={{ padding: '1rem 0.5rem' }}>{toMinguoDate(tx.date)}</td>
                                        <td style={{ padding: '1rem 0.5rem' }}>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '0.2rem 0.5rem',
                                                background: '#f1f5f9',
                                                borderRadius: '0.25rem',
                                                color: 'var(--text-muted)'
                                            }}>
                                                {tx.type === 'transfer'
                                                    ? `${tx.fromAccount} ➡ ${tx.toAccount}`
                                                    : (tx.account || '淑華代收付')
                                                }
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem' }}>
                                            <div style={{ fontWeight: '600' }}>
                                                {tx.type === 'transfer' ? (
                                                    <span style={{ color: 'var(--primary)' }}>資金調撥</span>
                                                ) : tx.item}
                                            </div>
                                            {tx.type !== 'transfer' && tx.member && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{tx.member}</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', textAlign: 'right', fontWeight: '700' }} className={
                                            tx.type === 'transfer'
                                                ? (selectedAccount === 'ALL' ? '' : (tx.toAccount === selectedAccount ? 'income-amt' : 'expense-amt'))
                                                : (tx.type === 'income' ? 'income-amt' : 'expense-amt')
                                        }>
                                            {tx.type === 'transfer'
                                                ? (selectedAccount === 'ALL' ? '' : (tx.toAccount === selectedAccount ? '+' : '-'))
                                                : (tx.type === 'income' ? '+' : '-')
                                            }{Math.round(tx.amount).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: '200px' }}>
                                            {tx.remark || '-'}
                                        </td>
                                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                                            <button
                                                className="btn-icon"
                                                onClick={() => onEdit(tx)}
                                                style={{ padding: '0.4rem', color: 'var(--primary)', background: 'transparent' }}
                                                title="編輯"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .active-account {
                    background: #f0f7ff !important;
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
                }
            `}} />
        </div>
    );
}

export default AccountSummary;
