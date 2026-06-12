import React, { useState } from 'react';
import { Key, FileText, Clock, Settings, Search, Download, Trash2, Edit2, History, Plus, Tag, Folder } from 'lucide-react';

export default function Dashboard({ vaultData, vaultMasterKey, onLock }) {
    const { passwordsState, notesState, totpState, settingsState } = vaultData;
    const [activeTab, setActiveTab] = useState('passwords');
    const [searchQuery, setSearchQuery] = useState('');
    const [folderFilter, setFolderFilter] = useState('');

    const folders = [...new Set(passwordsState.map(p => p.folder).filter(f => f))].sort();

    const filteredPasswords = passwordsState.filter(p => {
        const matchesSearch = p.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (p.user && p.user.toLowerCase().includes(searchQuery.toLowerCase())) ||
                              (p.cat && p.cat.toLowerCase().includes(searchQuery.toLowerCase())) ||
                              (p.tags && p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
        const matchesFolder = folderFilter === '' || p.folder === folderFilter;
        return matchesSearch && matchesFolder;
    });

    return (
        <div className="w-full max-w-6xl glass-panel rounded-2xl flex flex-col md:flex-row shadow-2xl min-h-[680px] overflow-hidden fade-in">
            {/* Sidebar */}
            <div className="w-full md:w-60 bg-slate-950/50 border-r border-slate-800/60 p-6 flex flex-col justify-between shrink-0">
                <div>
                    <div className="flex items-center gap-3 mb-8 px-2">
                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                            <Key className="w-5 h-5" />
                        </div>
                        <h1 className="text-xl font-bold text-white tracking-wide">AetherVault</h1>
                    </div>
                    <nav className="space-y-2">
                        <button onClick={() => setActiveTab('passwords')} className={`tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'passwords' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                            <Key className="w-4 h-4" /> Credentials
                        </button>
                        <button onClick={() => setActiveTab('notes')} className={`tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'notes' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                            <FileText className="w-4 h-4" /> Secure Notes
                        </button>
                        <button onClick={() => setActiveTab('totp')} className={`tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'totp' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                            <Clock className="w-4 h-4" /> Authenticator
                        </button>
                        <button onClick={() => setActiveTab('settings')} className={`tab-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'settings' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
                            <Settings className="w-4 h-4" /> Settings
                        </button>
                    </nav>
                </div>
                <div className="pt-6 border-t border-slate-800/60 mt-6">
                    <button onClick={onLock} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors">
                        LOCK VAULT
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-8 bg-[#0a0a0a] relative overflow-hidden flex flex-col">
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none"></div>

                {activeTab === 'passwords' && (
                    <div className="fade-in flex-1 flex flex-col h-full">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">Credentials</h2>
                                <p className="text-xs text-slate-500">Manage your encrypted passwords</p>
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="relative w-full md:w-40">
                                    <Folder className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                                    <select 
                                        value={folderFilter}
                                        onChange={(e) => setFolderFilter(e.target.value)}
                                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                                    >
                                        <option value="">All Folders</option>
                                        {folders.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div className="relative flex-1 md:w-64">
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                                    <input 
                                        type="text" 
                                        placeholder="Search vault..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-600"
                                    />
                                </div>
                                <button className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl overflow-hidden flex-1 flex flex-col relative z-10">
                            <div className="overflow-y-auto flex-1 p-2 custom-scroll">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-xs font-semibold text-slate-500 border-b border-slate-800/60 uppercase tracking-wider sticky top-0 bg-slate-900/90 backdrop-blur z-20">
                                            <th className="px-4 py-3 rounded-tl-xl">Label</th>
                                            <th className="px-4 py-3">Username / ID</th>
                                            <th className="px-4 py-3 text-right rounded-tr-xl">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPasswords.length === 0 ? (
                                            <tr>
                                                <td colSpan="3" className="px-4 py-12 text-center text-slate-500 text-sm">
                                                    No credentials found. Create one!
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredPasswords.map(p => (
                                                <tr key={p.id} className="group hover:bg-white/[0.02] border-b border-slate-800/30 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-slate-200 flex items-center gap-2">
                                                            {p.label}
                                                            {p.folder && <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md border border-slate-700/50 flex items-center gap-1"><Folder className="w-3 h-3"/> {p.folder}</span>}
                                                        </div>
                                                        <div className="text-xs text-slate-500 flex gap-1 mt-1">
                                                            {p.tags && p.tags.map(t => <span key={t} className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide border border-indigo-500/20 flex items-center gap-0.5"><Tag className="w-2 h-2"/>{t}</span>)}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">{p.user || '—'}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Key className="w-4 h-4" /></button>
                                                            <button className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                                            {p.history && p.history.length > 0 && <button className="p-1.5 text-amber-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><History className="w-4 h-4" /></button>}
                                                            <button className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'settings' && (
                    <div className="fade-in space-y-6">
                        <div className="border-b border-slate-800 pb-4">
                            <h2 className="text-xl font-bold text-white">Vault Settings</h2>
                            <p className="text-xs text-slate-500 mt-0.5">Configure session security and generator defaults</p>
                        </div>
                        <div className="max-w-lg space-y-6">
                            <div className="p-5 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-4">
                                <h3 className="text-md font-semibold text-white flex items-center gap-2">Session Security</h3>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1">Inactivity Lock Timeout</label>
                                    <select 
                                        defaultValue={settingsState.inactivityMs}
                                        className="w-full bg-slate-950 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                                    >
                                        <option value="60000">1 Minute</option>
                                        <option value="300000">5 Minutes</option>
                                        <option value="900000">15 Minutes</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {['notes', 'totp'].includes(activeTab) && (
                    <div className="fade-in flex items-center justify-center h-full text-slate-500">
                        {activeTab.toUpperCase()} View - Migration in Progress
                    </div>
                )}

            </div>
        </div>
    );
}
