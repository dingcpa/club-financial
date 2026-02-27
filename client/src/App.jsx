import React, { useState, useEffect } from 'react';
import { PlusCircle, MinusCircle, RefreshCw, List, Wallet, Users, PiggyBank, BookOpen, ChevronDown, ChevronRight, Search, HandCoins, Menu, FileText, BarChart3 } from 'lucide-react';
import './index.css';

// Components
import IncomeForm from './pages/IncomeForm';
import ExpenseForm from './pages/ExpenseForm';
import Summary from './pages/Summary';
import MemberDues from './pages/MemberDues';
import PrepaidIncome from './pages/PrepaidIncome';
import PrepaidExpense from './pages/PrepaidExpense';
import MemberList from './pages/MemberList';
import AccountSummary from './pages/AccountSummary';
import TransferForm from './pages/TransferForm';
import RecordListPanel from './pages/RecordListPanel';
import AgencyCollection from './pages/AgencyCollection';

const API_URL = 'http://localhost:5000/api/finance';
const MEMBERS_API = 'http://localhost:5000/api/members';
const DUES_SETTINGS_API = 'http://localhost:5000/api/dues-settings';

function App() {
  const [activeTab, setActiveTab] = useState('summary');
  const [records, setRecords] = useState([]);
  const [members, setMembers] = useState([]);
  const [duesSettings, setDuesSettings] = useState([
    { category: '1-3月社費', dueDate: '2026-01-01', standardAmount: 16500 },
    { category: '4-6月社費', dueDate: '2026-04-01', standardAmount: 16500 },
    { category: '7-9月社費', dueDate: '2026-07-01', standardAmount: 16500 },
    { category: '10-12月社費', dueDate: '2026-10-01', standardAmount: 16500 },
    { category: '總半年費(1-6)', dueDate: '2026-01-01', standardAmount: 600 },
    { category: '總半年費(7-12)', dueDate: '2026-07-01', standardAmount: 600 },
    { category: 'EREY費', dueDate: '2026-07-01', standardAmount: 3000 },
    { category: '春節紅箱', dueDate: '2026-02-01', standardAmount: 1000 },
    { category: '母親節紅箱', dueDate: '2026-05-01', standardAmount: 1000 },
    { category: '父親節紅箱', dueDate: '2026-08-01', standardAmount: 1000 },
    { category: '中秋節紅箱', dueDate: '2026-09-01', standardAmount: 1000 },
    { category: '入社費', dueDate: '', standardAmount: 5000 }
  ]);
  const [loading, setLoading] = useState(true);
  const [memLoading, setMemLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({
    reports: true,
    members: true,
    transactions: true
  });

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}?t=${Date.now()}`);
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error('Error refreshing records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    setMemLoading(true);
    try {
      const response = await fetch(MEMBERS_API);
      const data = await response.json();
      setMembers(data);
    } catch (error) {
      console.error('Error refreshing members:', error);
    } finally {
      setMemLoading(false);
    }
  };

  const fetchDuesSettings = async () => {
    try {
      const response = await fetch(DUES_SETTINGS_API);
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        setDuesSettings(data);
      }
    } catch (error) {
      console.error('Error fetching dues settings:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setMemLoading(true);
      await Promise.all([
        fetchRecords(),
        fetchMembers(),
        fetchDuesSettings()
      ]);
    };
    init();
  }, []);

  const addRecord = async (newRecord) => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRecord),
      });
      if (response.ok) {
        fetchRecords();
        setActiveTab('summary');
      }
    } catch (error) {
      console.error('Error adding record:', error);
    }
  };

  const addRecordsBatch = async (newRecords) => {
    try {
      const response = await fetch(`${API_URL}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRecords),
      });
      if (response.ok) {
        fetchRecords();
        setActiveTab('summary');
      }
    } catch (error) {
      console.error('Error adding batch records:', error);
    }
  };

  const addRecordsBatchAndGoToDues = async (newRecords) => {
    try {
      const response = await fetch(`${API_URL}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRecords),
      });
      if (response.ok) {
        fetchRecords();
        setActiveTab('dues');
      }
    } catch (error) {
      console.error('Error adding batch records:', error);
    }
  };

  const updateRecord = async (id, updatedRecord) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedRecord),
      });
      if (response.ok) {
        await fetchRecords(); // Await refresh
        setEditingRecord(null);
        setActiveTab('summary');
      }
    } catch (error) {
      console.error('Error updating record:', error);
    }
  };

  const deleteRecord = async (id) => {
    if (!window.confirm('確定要刪除此筆紀錄嗎？此動作無法復原。')) return;
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchRecords();
        setEditingRecord(null);
        setActiveTab('summary');
      }
    } catch (error) {
      console.error('Error deleting record:', error);
    }
  };

  const addMember = async (newMember) => {
    try {
      console.log('Frontend adding member:', newMember);
      const response = await fetch(MEMBERS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember),
      });
      if (response.ok) {
        console.log('Add member success');
        fetchMembers();
      } else {
        console.error('Add member failed:', response.status);
      }
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const updateMember = async (id, updatedMember) => {
    try {
      console.log(`Frontend updating member ID ${id}:`, updatedMember);
      const response = await fetch(`${MEMBERS_API}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMember),
      });
      if (response.ok) {
        console.log('Update member success');
        fetchMembers();
      } else {
        console.error('Update member failed:', response.status);
      }
    } catch (error) {
      console.error('Error updating member:', error);
    }
  };

  const deleteMember = async (id) => {
    if (!window.confirm('確定要刪除此位社友嗎？相關繳費紀錄仍會保留姓名，但無法再從選單選取。')) return;
    try {
      console.log(`Frontend deleting member ID ${id}`);
      const response = await fetch(`${MEMBERS_API}/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        console.log('Delete member success');
        fetchMembers();
      } else {
        console.error('Delete member failed:', response.status);
      }
    } catch (error) {
      console.error('Error deleting member:', error);
    }
  };

  // Dues Settings Handlers
  const addDuesSetting = async (setting) => {
    try {
      const res = await fetch(DUES_SETTINGS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setting)
      });
      const data = await res.json();
      setDuesSettings([...duesSettings, data]);
    } catch (err) {
      console.error('Error adding dues setting:', err);
    }
  };

  const updateDuesSetting = async (oldCategory, setting) => {
    try {
      const res = await fetch(`${DUES_SETTINGS_API}/${encodeURIComponent(oldCategory)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setting)
      });
      const data = await res.json();
      setDuesSettings(duesSettings.map(s => s.category === oldCategory ? data : s));
    } catch (err) {
      console.error('Error updating dues setting:', err);
    }
  };

  const deleteDuesSetting = async (category) => {
    try {
      await fetch(`${DUES_SETTINGS_API}/${encodeURIComponent(category)}`, {
        method: 'DELETE'
      });
      setDuesSettings(duesSettings.filter(s => s.category !== category));
    } catch (err) {
      console.error('Error deleting dues setting:', err);
    }
  };

  const handleEditClick = (record) => {
    setEditingRecord(record);
    setActiveTab(record.type);
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    // Stay on the current tab so the user can keep browsing the list panel
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Wallet size={24} color="#4f46e5" />
            <h2>社團收支系統</h2>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <Menu size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {/* 報表查詢 */}
          <div className="sidebar-group">
            <div className="sidebar-group-header" onClick={() => toggleGroup('reports')}>
              <span>報表查詢</span>
              {expandedGroups.reports ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            <div className={`sidebar-group-items ${!expandedGroups.reports ? 'collapsed' : ''}`} style={{ maxHeight: expandedGroups.reports ? '500px' : '0' }}>
              <div
                className={`sidebar-item ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => { setActiveTab('summary'); setEditingRecord(null); }}
              >
                <span className="icon"><BarChart3 size={18} /></span>
                <span>收支月報表</span>
              </div>
              <div
                className={`sidebar-item ${activeTab === 'prepaid-income' ? 'active' : ''}`}
                onClick={() => { setActiveTab('prepaid-income'); setEditingRecord(null); }}
              >
                <span className="icon"><PiggyBank size={18} /></span>
                <span>預收收入明細</span>
              </div>
              <div
                className={`sidebar-item ${activeTab === 'prepaid-expense' ? 'active' : ''}`}
                onClick={() => { setActiveTab('prepaid-expense'); setEditingRecord(null); }}
              >
                <span className="icon"><BookOpen size={18} /></span>
                <span>預付支出明細</span>
              </div>
              <div
                className={`sidebar-item ${activeTab === 'accounts' ? 'active' : ''}`}
                onClick={() => { setActiveTab('accounts'); setEditingRecord(null); }}
              >
                <span className="icon"><Wallet size={18} /></span>
                <span>資金帳戶明細</span>
              </div>
            </div>
          </div>

          {/* 社友管理 */}
          <div className="sidebar-group">
            <div className="sidebar-group-header" onClick={() => toggleGroup('members')}>
              <span>社友管理</span>
              {expandedGroups.members ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            <div className={`sidebar-group-items ${!expandedGroups.members ? 'collapsed' : ''}`} style={{ maxHeight: expandedGroups.members ? '500px' : '0' }}>
              <div
                className={`sidebar-item ${activeTab === 'dues' ? 'active' : ''}`}
                onClick={() => { setActiveTab('dues'); setEditingRecord(null); }}
              >
                <span className="icon"><List size={18} /></span>
                <span>社友繳費總覽</span>
              </div>
              <div
                className={`sidebar-item ${activeTab === 'members' ? 'active' : ''}`}
                onClick={() => { setActiveTab('members'); setEditingRecord(null); }}
              >
                <span className="icon"><Users size={18} /></span>
                <span>社友名冊</span>
              </div>
              <div
                className={`sidebar-item ${activeTab === 'agency' ? 'active' : ''}`}
                onClick={() => { setActiveTab('agency'); setEditingRecord(null); }}
              >
                <span className="icon"><HandCoins size={18} /></span>
                <span>代收代付</span>
              </div>
            </div>
          </div>

          {/* 收支單據 */}
          <div className="sidebar-group">
            <div className="sidebar-group-header" onClick={() => toggleGroup('transactions')}>
              <span>收支單據</span>
              {expandedGroups.transactions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            <div className={`sidebar-group-items ${!expandedGroups.transactions ? 'collapsed' : ''}`} style={{ maxHeight: expandedGroups.transactions ? '500px' : '0' }}>
              {/* 收入單 */}
              <div
                className={`sidebar-item ${activeTab === 'income' ? 'active' : ''}`}
                onClick={() => { setActiveTab('income'); setEditingRecord(null); }}
              >
                <span className="icon"><PlusCircle size={18} /></span>
                <span>新增收入單</span>
              </div>
              <div
                className={`sidebar-item ${activeTab === 'income-list' ? 'active' : ''}`}
                onClick={() => { setActiveTab('income-list'); setEditingRecord(null); }}
              >
                <span className="icon"><Search size={18} /></span>
                <span>查詢收入單</span>
              </div>
              {/* 支出單 */}
              <div
                className={`sidebar-item ${activeTab === 'expense' ? 'active' : ''}`}
                onClick={() => { setActiveTab('expense'); setEditingRecord(null); }}
              >
                <span className="icon"><MinusCircle size={18} /></span>
                <span>新增支出單</span>
              </div>
              <div
                className={`sidebar-item ${activeTab === 'expense-list' ? 'active' : ''}`}
                onClick={() => { setActiveTab('expense-list'); setEditingRecord(null); }}
              >
                <span className="icon"><Search size={18} /></span>
                <span>查詢支出單</span>
              </div>
              {/* 調撥單 */}
              <div
                className={`sidebar-item ${activeTab === 'transfer' ? 'active' : ''}`}
                onClick={() => { setActiveTab('transfer'); setEditingRecord(null); }}
              >
                <span className="icon"><RefreshCw size={18} /></span>
                <span>新增調撥單</span>
              </div>
              <div
                className={`sidebar-item ${activeTab === 'transfer-list' ? 'active' : ''}`}
                onClick={() => { setActiveTab('transfer-list'); setEditingRecord(null); }}
              >
                <span className="icon"><Search size={18} /></span>
                <span>查詢調撥單</span>
              </div>
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="container">
        {activeTab === 'summary' && (
          <Summary records={records} loading={loading} onEdit={handleEditClick} />
        )}

        {activeTab === 'prepaid-income' && (
          <PrepaidIncome records={records} loading={loading} />
        )}

        {activeTab === 'prepaid-expense' && (
          <PrepaidExpense records={records} loading={loading} />
        )}

        {activeTab === 'dues' && (
          <MemberDues
            records={records}
            members={members}
            duesSettings={duesSettings}
            loading={loading || memLoading}
            onEdit={handleEditClick}
            onAddDuesSetting={addDuesSetting}
            onUpdateDuesSetting={updateDuesSetting}
            onDeleteDuesSetting={deleteDuesSetting}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountSummary records={records} loading={loading} onEdit={handleEditClick} />
        )}

        {activeTab === 'agency' && (
          <AgencyCollection members={members} />
        )}

        {activeTab === 'members' && (
          <MemberList
            members={members}
            loading={memLoading}
            onAdd={addMember}
            onUpdate={updateMember}
            onDelete={deleteMember}
          />
        )}

        {activeTab === 'income-list' && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <RecordListPanel
              records={records}
              type="income"
              editingId={editingRecord?.id}
              onEdit={handleEditClick}
              fullPage
            />
          </div>
        )}

        {activeTab === 'income' && (
          <IncomeForm
            onAdd={addRecord}
            onAddBatch={addRecordsBatch}
            onAddBatchToDues={addRecordsBatchAndGoToDues}
            onUpdate={updateRecord}
            onDelete={deleteRecord}
            editData={editingRecord}
            members={members}
            records={records}
            duesSettings={duesSettings}
            onCancel={handleCancelEdit}
          />
        )}

        {activeTab === 'expense-list' && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <RecordListPanel
              records={records}
              type="expense"
              editingId={editingRecord?.id}
              onEdit={handleEditClick}
              fullPage
            />
          </div>
        )}

        {activeTab === 'expense' && (
          <ExpenseForm
            onAdd={addRecord}
            onUpdate={updateRecord}
            onDelete={deleteRecord}
            editData={editingRecord}
            onCancel={handleCancelEdit}
          />
        )}

        {activeTab === 'transfer-list' && (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <RecordListPanel
              records={records}
              type="transfer"
              editingId={editingRecord?.id}
              onEdit={handleEditClick}
              fullPage
            />
          </div>
        )}

        {activeTab === 'transfer' && (
          <TransferForm
            onAdd={addRecord}
            onUpdate={updateRecord}
            onDelete={deleteRecord}
            editData={editingRecord}
            onCancel={handleCancelEdit}
          />
        )}
        </div>

        <footer style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          &copy; 2026 社團財務管理系統 | <span style={{ color: '#6366f1', fontWeight: 'bold' }}>v2.2 (Amortization Fixed)</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
