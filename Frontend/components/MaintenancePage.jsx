import "./MaintenancePage.css";

function MaintenancePage() {
  return (
    <main className="maintenance-page">
      <section className="maintenance-card" aria-labelledby="maintenance-title">
        <div className="maintenance-brand">
          <img
            src="/assets/insavenote-high-resolution-logo.png"
            alt=""
            className="maintenance-logo"
          />
          <span>InSaveNote</span>
        </div>

        <div className="maintenance-art" aria-hidden="true">
          <span className="maintenance-orbit maintenance-orbit-one" />
          <span className="maintenance-orbit maintenance-orbit-two" />
          <div className="maintenance-toolbox">
            <svg viewBox="0 0 96 96" fill="none">
              <path d="M34 32v-7a7 7 0 0 1 7-7h14a7 7 0 0 1 7 7v7" />
              <rect x="15" y="31" width="66" height="49" rx="9" />
              <path d="M15 49h66M40 49v8h16v-8" />
              <path d="m40 67 5 5 11-12" />
            </svg>
          </div>
          <span className="maintenance-spark maintenance-spark-one">✦</span>
          <span className="maintenance-spark maintenance-spark-two">✳</span>
        </div>

        <p className="maintenance-eyebrow">
          <span className="maintenance-status-dot" />
          A little maintenance in progress
        </p>
        <h1 id="maintenance-title">We’ll be back soon.</h1>
        <p className="maintenance-description">
          We’re making a few improvements to InSaveNote. Please check back in a
          little while.
        </p>

        <div className="maintenance-divider" />
        <p className="maintenance-footnote">
          Thanks for your patience while we get things ready.
        </p>
      </section>
    </main>
  );
}

export default MaintenancePage;
