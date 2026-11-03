import "./NotesSkeleton.css";

function NotesSkeleton() {
  return (
    <div className="skeleton-page">
      {/* Navbar */}
      <header className="skeleton-navbar">
        <div className="skeleton-container navbar-content">
          <img
            className="skeleton-logo-image"
            src="/assets/insavenote-high-resolution-logo.png"
            alt="InSaveNote"
          />

          <div className="navbar-right">
            <div className="skeleton skeleton-avatar" />
            <div className="skeleton skeleton-toggle" />
          </div>
        </div>
      </header>

      {/* Main section */}
      <main className="skeleton-container">
        <div className="skeleton-toolbar">
          <div className="skeleton skeleton-button" />
        </div>

        {/* Notes grid */}
        <div className="skeleton-grid">
          {Array.from({ length: 12 }).map((_, index) => (
            <div className="skeleton skeleton-note" key={index} />
          ))}
        </div>
      </main>
    </div>
  );
}

export default NotesSkeleton;
