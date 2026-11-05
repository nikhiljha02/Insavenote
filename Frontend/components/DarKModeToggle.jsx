import React, { useState, useEffect } from "react";
import "./DarkModeToggle.css";
import styled from "styled-components";

function readSavedTheme() {
  try {
    return window.localStorage.getItem("theme");
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    window.localStorage.setItem("theme", theme);
  } catch {
    // Keep the toggle usable when browser storage is unavailable.
  }
}

export default function DarkModeToggle() {
  // 1. Use the saved theme or the page's initial theme to initialize state.
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = readSavedTheme();
    if (savedTheme) return savedTheme === "dark";

    // Keep the initial toggle in sync with the theme class in index.html.
    return document.documentElement.classList.contains("dark");
  });

  // 2. Apply theme class to the HTML/Body element whenever state changes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      saveTheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      saveTheme("light");
    }
  }, [isDark]);

  return (
    <StyledWrapper>
      <label>
        <input
          className="toggle-checkbox"
          type="checkbox"
          aria-label="Toggle dark mode"
          checked={isDark}
          onChange={(event) => setIsDark(event.target.checked)}
        />
        <div className="toggle-slot" style={{ cursor: "pointer" }}>
          <div className="sun-icon-wrapper">
            <div
              className="iconify sun-icon"
              data-icon="feather-sun"
              data-inline="false"
            />
          </div>
          <div className="toggle-button" />
          <div className="moon-icon-wrapper">
            <div
              className="iconify moon-icon"
              data-icon="feather-moon"
              data-inline="false"
            />
          </div>
        </div>
      </label>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  display: inline-flex;
  flex: 0 0 auto;

  label {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    cursor: pointer;
    touch-action: manipulation;
  }

  .toggle-checkbox {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  .toggle-slot {
    font-size: clamp(9px, 2.5vw, 10px);
    position: relative;
    height: 3.5em;
    width: 7em;
    overflow: hidden;
    border: 0px solid transparent;
    border-radius: 10em;
    background-color: #e2dfdf;
    transition: background-color 250ms;
  }

  .toggle-checkbox:focus-visible + .toggle-slot {
    outline: 2px solid currentColor;
    outline-offset: 3px;
  }

  .toggle-checkbox:checked ~ .toggle-slot {
    background-color: #374151;
  }

  .toggle-button {
    transform: translate(0.3em, 0.25em);
    position: absolute;
    height: 3em;
    width: 3em;
    border-radius: 50%;
    background-color: #ffeccf;
    box-shadow: inset 0px 0px 0px 0.75em #ffbb52;
    transition:
      background-color 250ms,
      border-color 250ms,
      transform 500ms cubic-bezier(0.26, 2, 0.46, 0.71);
  }

  .toggle-checkbox:checked ~ .toggle-slot .toggle-button {
    background-color: #485367;
    box-shadow: inset 0px 0px 0px 0.75em white;
    transform: translate(3.65em, 0.25em);
  }

  .sun-icon {
    position: absolute;
    height: 6em;
    width: 6em;
    color: #ffbb52;
  }

  .sun-icon-wrapper {
    position: absolute;
    height: 6em;
    width: 6em;
    opacity: 1;
    transform: translate(2em, 2em) rotate(15deg);
    transform-origin: 50% 50%;
    transition:
      opacity 150ms,
      transform 500ms cubic-bezier(0.26, 2, 0.46, 0.71);
  }

  .toggle-checkbox:checked ~ .toggle-slot .sun-icon-wrapper {
    opacity: 0;
    transform: translate(3em, 2em) rotate(0deg);
  }

  .moon-icon {
    position: absolute;
    height: 6em;
    width: 6em;
    color: white;
  }

  .moon-icon-wrapper {
    position: absolute;
    height: 6em;
    width: 6em;
    opacity: 0;
    transform: translate(11em, 2em) rotate(0deg);
    transform-origin: 50% 50%;
    transition:
      opacity 150ms,
      transform 500ms cubic-bezier(0.26, 2.5, 0.46, 0.71);
  }

  .toggle-checkbox:checked ~ .toggle-slot .moon-icon-wrapper {
    opacity: 1;
    transform: translate(2em, 2em) rotate(-15deg);
  }
`;
