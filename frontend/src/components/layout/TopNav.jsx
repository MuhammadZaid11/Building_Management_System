export default function TopNav({ user, menuOpen, onMenu, onLogout }) {
  return (
    <header className="topbar">
      <button
        type="button"
        className="menu-button"
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        onClick={onMenu}
      >
        Menu
      </button>
      <div className="user-meta">
        <p className="user-name">{user?.name}</p>
        <p className="user-role">{user?.role}</p>
      </div>
      <button type="button" className="button button-quiet" onClick={onLogout}>
        Log out
      </button>
    </header>
  )
}
