import React, { useState, useEffect, useCallback } from 'react';

const API = '/api/admin';

function authHeaders() {
  const token = localStorage.getItem('zync_token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
async function apiFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(url, { headers: authHeaders(), ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Icons ────────────────────────────────────────────────────────────
const I = {
  Dashboard: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  Users:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>,
  Messages:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Chats:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>,
  Stories:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9" strokeDasharray="2 2"/></svg>,
  Security:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
  Shield:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Close:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Trash:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
  Edit:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Eye:       () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  Online:    () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-2.5 h-2.5 text-green-400"><circle cx="12" cy="12" r="10"/></svg>,
  Search:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Chevron:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polyline points="9 18 15 12 9 6"/></svg>,
  IP:        () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 10h2l1 3 2-6 1 3h3"/></svg>,
  Calendar:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Trophy:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M12 17v4"/><path d="M8 21h8"/><path d="M6 9a6 6 0 0 0 12 0V3H6z"/></svg>,
  Media:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Week:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>,
  Save:      () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Refresh:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  Group:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>,
  Personal:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>,
};

// ─── Helpers ──────────────────────────────────────────────────────────
function Spinner() {
  return <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-vortex-500 border-t-transparent rounded-full animate-spin"/></div>;
}
function Badge({ children, color = 'zinc' }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = { zinc: 'bg-zinc-800 text-zinc-400', blue: 'bg-blue-500/15 text-blue-400', green: 'bg-green-500/15 text-green-400', red: 'bg-red-500/15 text-red-400', vortex: 'bg-vortex-500/15 text-vortex-400', yellow: 'bg-yellow-500/15 text-yellow-400' };
  return <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${map[color] || map.zinc}`}>{children}</span>;
}
function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex gap-1.5 justify-center pt-3">
      {Array.from({ length: Math.min(pages, 10) }, (_, i) => (
        <button key={i} onClick={() => onChange(i + 1)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === i + 1 ? 'bg-vortex-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>{i + 1}</button>
      ))}
    </div>
  );
}
function StatCard({ label, value, Icon, gradient, sub }: { label: string; value: number | string; Icon: () => React.ReactNode; gradient: string; sub?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center gap-3 hover:border-zinc-700 transition-colors">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${gradient}`}><Icon /></div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-white leading-tight">{value}</div>
        <div className="text-xs text-zinc-500 leading-tight">{label}</div>
        {sub && <div className="text-xs text-zinc-600 leading-tight">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────
function ConfirmModal({ title, desc, onConfirm, onCancel, danger = true }: { title: string; desc: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-80 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${danger ? 'bg-red-500/15 text-red-400' : 'bg-yellow-500/15 text-yellow-400'}`}><I.Trash /></div>
          <div><h3 className="text-white font-semibold text-sm">{title}</h3><p className="text-zinc-500 text-xs">{desc}</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-white text-sm hover:bg-zinc-700 transition-colors">Отмена</button>
          <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl text-white text-sm transition-colors ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-yellow-600 hover:bg-yellow-500'}`}>Удалить</button>
        </div>
      </div>
    </div>
  );
}

// ─── User Detail Modal ────────────────────────────────────────────────
function UserDetailModal({ userId, onClose, onDeleted }: { userId: string; onClose: () => void; onDeleted: () => void }) {
  const [data, setData] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    apiFetch(`${API}/users/${userId}`).then(d => {
      setData(d);
      setDisplayName(d.user.displayName || '');
      setBio(d.user.bio || '');
    }).catch(console.error);
  }, [userId]);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`${API}/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ displayName, bio }) });
      setEditing(false);
      setData((prev: any) => ({ ...prev, user: { ...prev.user, displayName, bio } }));
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  }

  async function del() {
    try {
      await apiFetch(`${API}/users/${userId}`, { method: 'DELETE' });
      onDeleted(); onClose();
    } catch (e: any) { alert(e.message); }
  }

  if (!data) return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8"><Spinner /></div>
    </div>
  );

  const u = data.user;
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] backdrop-blur-sm p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <h2 className="text-white font-semibold flex items-center gap-2"><I.Eye /> Профиль пользователя</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-xl hover:bg-zinc-800 transition-colors"><I.Close /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-vortex-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shrink-0">
              {(u.displayName?.[0] || u.username[0]).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-semibold">{u.displayName || u.username}</span>
                {u.isOnline ? <Badge color="green">онлайн</Badge> : <Badge color="zinc">офлайн</Badge>}
              </div>
              <div className="text-zinc-500 text-sm">@{u.username}</div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Сообщений', val: u._count?.messages || 0 },
              { label: 'Историй', val: u._count?.stories || 0 },
              { label: 'Чатов', val: u._count?.chatMembers || 0 },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
                <div className="text-white font-bold text-lg">{s.val}</div>
                <div className="text-zinc-600 text-xs">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Info fields */}
          <div className="space-y-2 text-sm">
            {[
              { icon: <I.Calendar />, label: 'Регистрация', val: new Date(u.createdAt).toLocaleString('ru') },
              { icon: <I.Calendar />, label: 'Последний раз', val: new Date(u.lastSeen).toLocaleString('ru') },
              { icon: <I.IP />, label: 'IP адрес', val: u.registrationIp || '—' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3 px-3 py-2 bg-zinc-900 rounded-xl border border-zinc-800">
                <span className="text-zinc-500 shrink-0">{f.icon}</span>
                <span className="text-zinc-500 shrink-0">{f.label}:</span>
                <span className="text-zinc-300 truncate">{f.val}</span>
              </div>
            ))}
            {data.sameIpCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 rounded-xl border border-red-500/20 text-red-400 text-xs">
                <I.Security />
                Ещё {data.sameIpCount} аккаунт(ов) с этого IP
              </div>
            )}
          </div>

          {/* Edit form */}
          {editing ? (
            <div className="space-y-2">
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Имя" maxLength={50}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-vortex-500 transition-colors"/>
              <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Bio" maxLength={500} rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-vortex-500 transition-colors resize-none"/>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700 transition-colors">Отмена</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-xl bg-vortex-600 text-white text-sm hover:bg-vortex-500 transition-colors flex items-center justify-center gap-1.5">
                  <I.Save />{saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {u.username !== 'amebo4ka' && <>
                <button onClick={() => setEditing(true)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors flex items-center justify-center gap-1.5"><I.Edit /> Редактировать</button>
                <button onClick={() => setConfirmDel(true)} className="flex-1 py-2.5 rounded-xl bg-red-600/20 text-red-400 text-sm hover:bg-red-600/30 transition-colors flex items-center justify-center gap-1.5"><I.Trash /> Удалить</button>
              </>}
            </div>
          )}
        </div>
      </div>
      {confirmDel && <ConfirmModal title="Удалить пользователя?" desc="Все данные будут удалены безвозвратно" onConfirm={del} onCancel={() => setConfirmDel(false)} />}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); apiFetch(`${API}/stats`).then(setStats).catch(console.error).finally(() => setLoading(false)); };
  useEffect(load, []);
  if (loading) return <Spinner />;
  if (!stats) return <div className="text-center text-zinc-500 py-10">Ошибка загрузки</div>;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Обзор системы</h2>
        <button onClick={load} className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"><I.Refresh /></button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Пользователей" value={stats.totalUsers} Icon={() => <I.Users />} gradient="bg-blue-500/15 text-blue-400" sub={`+${stats.newUsersWeek} за неделю`}/>
        <StatCard label="Онлайн" value={stats.onlineUsers} Icon={() => <I.Online />} gradient="bg-green-500/15 text-green-400"/>
        <StatCard label="Сообщений" value={stats.totalMessages} Icon={() => <I.Messages />} gradient="bg-vortex-500/15 text-vortex-400" sub={`+${stats.newMessagesWeek} за неделю`}/>
        <StatCard label="Чатов" value={stats.totalChats} Icon={() => <I.Chats />} gradient="bg-orange-500/15 text-orange-400"/>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Новых сегодня" value={stats.newUsersToday} Icon={() => <I.Week />} gradient="bg-cyan-500/15 text-cyan-400"/>
        <StatCard label="Сообщений сегодня" value={stats.newMessagesToday} Icon={() => <I.Messages />} gradient="bg-pink-500/15 text-pink-400"/>
        <StatCard label="Медиафайлов" value={stats.totalMedia} Icon={() => <I.Media />} gradient="bg-yellow-500/15 text-yellow-400"/>
      </div>
      {/* Top users */}
      {stats.topUsers?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2"><I.Trophy /> Топ по активности</h3>
          <div className="space-y-2">
            {stats.topUsers.map((u: any, i: number) => (
              <div key={u.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-zinc-500/20 text-zinc-400' : i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 text-zinc-500'}`}>#{i+1}</div>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-vortex-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{(u.displayName?.[0] || u.username[0]).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-white text-sm font-medium">{u.displayName || u.username}</span>
                  <span className="text-zinc-600 text-xs ml-2">@{u.username}</span>
                </div>
                <Badge color="vortex">{u._count.messages} сообщ.</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0); const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1); const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await apiFetch(`${API}/users?page=${page}&search=${encodeURIComponent(search)}`); setUsers(d.users); setTotal(d.total); setPages(d.pages); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, [page, search]);
  useEffect(() => { load(); }, [load]);

  async function del(id: string) {
    try { await apiFetch(`${API}/users/${id}`, { method: 'DELETE' }); setConfirmDel(null); load(); }
    catch (e: any) { alert(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Пользователи <span className="text-zinc-600 font-normal normal-case">({total})</span></h2>
        <div className="relative">
          <input className="bg-zinc-800 text-white rounded-xl px-4 py-2 text-sm outline-none border border-zinc-700 focus:border-vortex-500 w-52 transition-colors pl-9" placeholder="Поиск..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/>
          <span className="absolute left-3 top-2.5 text-zinc-500"><I.Search /></span>
        </div>
      </div>
      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-zinc-700 transition-colors group">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-vortex-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0 text-sm">{(u.displayName?.[0] || u.username[0]).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium text-sm">{u.displayName || u.username}</span>
                  <span className="text-zinc-600 text-xs">@{u.username}</span>
                  {u.isOnline && <I.Online />}
                </div>
                <div className="text-xs text-zinc-600 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{u._count?.messages || 0} сообщ.</span>
                  <span>·</span>
                  <span>{new Date(u.createdAt).toLocaleDateString('ru')}</span>
                  {u.registrationIp && <><span>·</span><span className="font-mono">{u.registrationIp}</span></>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setSelectedUser(u.id)} className="text-zinc-500 hover:text-vortex-400 p-1.5 rounded-lg hover:bg-vortex-500/10 transition-all" title="Подробнее"><I.Eye /></button>
                {u.username !== 'amebo4ka' && <button onClick={() => setConfirmDel(u.id)} className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all" title="Удалить"><I.Trash /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} onChange={setPage}/>
      {selectedUser && <UserDetailModal userId={selectedUser} onClose={() => setSelectedUser(null)} onDeleted={load}/>}
      {confirmDel && <ConfirmModal title="Удалить пользователя?" desc="Все данные будут удалены безвозвратно" onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)}/>}
    </div>
  );
}

// ─── Messages ─────────────────────────────────────────────────────────
function MessagesTab() {
  const [messages, setMessages] = useState<any[]>([]);
  const [total, setTotal] = useState(0); const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1); const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await apiFetch(`${API}/messages?page=${page}&search=${encodeURIComponent(search)}`); setMessages(d.messages); setTotal(d.total); setPages(d.pages); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, [page, search]);
  useEffect(() => { load(); }, [load]);

  async function del(id: string) {
    try { await apiFetch(`${API}/messages/${id}`, { method: 'DELETE' }); load(); }
    catch (e: any) { alert(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Сообщения <span className="text-zinc-600 font-normal normal-case">({total})</span></h2>
        <div className="relative">
          <input className="bg-zinc-800 text-white rounded-xl px-4 py-2 text-sm outline-none border border-zinc-700 focus:border-vortex-500 w-52 transition-colors pl-9" placeholder="Поиск по тексту..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/>
          <span className="absolute left-3 top-2.5 text-zinc-500"><I.Search /></span>
        </div>
      </div>
      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {messages.map(m => (
            <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors group">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-vortex-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                  {(m.sender?.displayName?.[0] || m.sender?.username?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-vortex-400 text-xs font-semibold">@{m.sender?.username}</span>
                    <span className="text-zinc-700"><I.Chevron /></span>
                    <span className="text-zinc-500 text-xs">{m.chat?.name || (m.chat?.type === 'personal' ? 'Личный чат' : 'Группа')}</span>
                    {m.media?.length > 0 && <Badge color="blue">{m.media[0].type}</Badge>}
                    <span className="text-zinc-700 text-xs ml-auto">{new Date(m.createdAt).toLocaleString('ru')}</span>
                  </div>
                  <p className="text-zinc-300 text-sm break-words leading-relaxed">{m.type === 'text' ? (m.content || '—') : <span className="text-zinc-500 italic">[{m.type}]</span>}</p>
                </div>
                <button onClick={() => del(m.id)} className="text-zinc-700 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all shrink-0 opacity-0 group-hover:opacity-100"><I.Trash /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} onChange={setPage}/>
    </div>
  );
}

// ─── Chats ────────────────────────────────────────────────────────────
function ChatsTab() {
  const [chats, setChats] = useState<any[]>([]);
  const [total, setTotal] = useState(0); const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await apiFetch(`${API}/chats?page=${page}`); setChats(d.chats); setTotal(d.total); setPages(d.pages); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, [page]);
  useEffect(() => { load(); }, [load]);

  async function del(id: string) {
    try { await apiFetch(`${API}/chats/${id}`, { method: 'DELETE' }); setConfirmDel(null); load(); }
    catch (e: any) { alert(e.message); }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Чаты <span className="text-zinc-600 font-normal normal-case">({total})</span></h2>
      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {chats.map(c => (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3 hover:border-zinc-700 transition-colors group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.type === 'group' ? 'bg-blue-500/15 text-blue-400' : 'bg-vortex-500/15 text-vortex-400'}`}>
                {c.type === 'group' ? <I.Group /> : <I.Personal />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">{c.name || (c.type === 'personal' ? 'Личный чат' : 'Групповой чат')}</span>
                  <Badge color={c.type === 'group' ? 'blue' : 'zinc'}>{c.type === 'group' ? 'Группа' : 'Личный'}</Badge>
                </div>
                <div className="text-xs text-zinc-600 mt-0.5">{c._count?.members || 0} участн. · {c._count?.messages || 0} сообщ. · {new Date(c.createdAt).toLocaleDateString('ru')}</div>
              </div>
              <button onClick={() => setConfirmDel(c.id)} className="text-zinc-700 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"><I.Trash /></button>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} onChange={setPage}/>
      {confirmDel && <ConfirmModal title="Удалить чат?" desc="Все сообщения в чате будут удалены" onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)}/>}
    </div>
  );
}

// ─── Stories ──────────────────────────────────────────────────────────
function StoriesTab() {
  const [stories, setStories] = useState<any[]>([]);
  const [total, setTotal] = useState(0); const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const d = await apiFetch(`${API}/stories?page=${page}`); setStories(d.stories); setTotal(d.total); setPages(d.pages); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, [page]);
  useEffect(() => { load(); }, [load]);

  async function del(id: string) {
    try { await apiFetch(`${API}/stories/${id}`, { method: 'DELETE' }); setConfirmDel(null); load(); }
    catch (e: any) { alert(e.message); }
  }

  const isExpired = (exp: string) => new Date(exp) < new Date();

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Истории <span className="text-zinc-600 font-normal normal-case">({total})</span></h2>
      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {stories.map(s => (
            <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-3 hover:border-zinc-700 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/15 text-yellow-400 flex items-center justify-center shrink-0"><I.Stories /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-medium">@{s.user?.username}</span>
                  <Badge color={s.type === 'text' ? 'vortex' : 'blue'}>{s.type}</Badge>
                  {isExpired(s.expiresAt) ? <Badge color="zinc">истекла</Badge> : <Badge color="green">активна</Badge>}
                </div>
                <div className="text-xs text-zinc-600 mt-0.5 flex gap-3 flex-wrap">
                  <span>{s._count?.views || 0} просмотров</span>
                  <span>Создана: {new Date(s.createdAt).toLocaleString('ru')}</span>
                  <span>Истекает: {new Date(s.expiresAt).toLocaleString('ru')}</span>
                </div>
                {s.content && <p className="text-zinc-500 text-xs mt-1 truncate">{s.content}</p>}
              </div>
              <button onClick={() => setConfirmDel(s.id)} className="text-zinc-700 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"><I.Trash /></button>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} pages={pages} onChange={setPage}/>
      {confirmDel && <ConfirmModal title="Удалить историю?" desc="История будет удалена безвозвратно" onConfirm={() => del(confirmDel)} onCancel={() => setConfirmDel(null)}/>}
    </div>
  );
}

// ─── Security ─────────────────────────────────────────────────────────
function SecurityTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${API}/duplicate-ips`).then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
        <I.Security /> Безопасность
      </h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center shrink-0"><I.IP /></div>
          <div>
            <div className="text-white font-medium text-sm">Дублирующиеся IP-адреса</div>
            <div className="text-zinc-500 text-xs">Несколько аккаунтов с одного адреса</div>
          </div>
          <Badge color={data?.duplicates?.length > 0 ? 'red' : 'green'} >{data?.duplicates?.length || 0} найдено</Badge>
        </div>
        {data?.duplicates?.length === 0 && <div className="text-center text-zinc-600 text-sm py-4">Подозрительных IP не обнаружено</div>}
        <div className="space-y-2">
          {data?.duplicates?.map((d: any) => (
            <div key={d.ip} className="border border-zinc-800 rounded-xl overflow-hidden">
              <button onClick={() => setExpanded(expanded === d.ip ? null : d.ip)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-red-400">{d.ip}</span>
                  <Badge color="red">{d.accounts.length} аккаунта</Badge>
                </div>
                <span className={`text-zinc-500 transition-transform ${expanded === d.ip ? 'rotate-90' : ''}`}><I.Chevron /></span>
              </button>
              {expanded === d.ip && (
                <div className="border-t border-zinc-800 divide-y divide-zinc-800/50">
                  {d.accounts.map((a: any) => (
                    <div key={a.id} className="px-4 py-2.5 flex items-center gap-3 bg-zinc-900/50">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-vortex-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{a.username[0].toUpperCase()}</div>
                      <div className="flex-1">
                        <span className="text-white text-sm">@{a.username}</span>
                        <span className="text-zinc-600 text-xs ml-2">{new Date(a.createdAt).toLocaleDateString('ru')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Дашборд', Icon: I.Dashboard },
  { id: 'users',     label: 'Пользователи', Icon: I.Users },
  { id: 'messages',  label: 'Сообщения', Icon: I.Messages },
  { id: 'chats',     label: 'Чаты', Icon: I.Chats },
  { id: 'stories',   label: 'Истории', Icon: I.Stories },
  { id: 'security',  label: 'Безопасность', Icon: I.Security },
];

// ─── Main ─────────────────────────────────────────────────────────────
export default function AdminPage({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('dashboard');
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-vortex-500 to-purple-600 flex items-center justify-center text-white"><I.Shield /></div>
            <div><h1 className="text-white font-semibold leading-tight">Админ панель</h1><p className="text-zinc-600 text-xs">Zync Messenger</p></div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-xl hover:bg-zinc-800 transition-colors"><I.Close /></button>
        </div>
        {/* Tabs */}
        <div className="flex gap-0.5 px-4 pt-3 pb-0 border-b border-zinc-800 shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-t-lg text-xs font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? 'text-vortex-400 border-vortex-500 bg-vortex-500/5' : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
              <t.Icon />{t.label}
            </button>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'users'     && <UsersTab />}
          {tab === 'messages'  && <MessagesTab />}
          {tab === 'chats'     && <ChatsTab />}
          {tab === 'stories'   && <StoriesTab />}
          {tab === 'security'  && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}
