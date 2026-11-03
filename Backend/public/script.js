if (void 0 === KEEPNOTE) {
  var KEEPNOTE = {};
}

/* =========================================================
   NOTES MODULE
========================================================= */

KEEPNOTE.notesFunction = (function () {
  /* ---------------------------------------------------------
       PRIVATE FUNCTIONS
    --------------------------------------------------------- */

  async function getNotes() {
    try {
      let response = await fetch(`note/notes`, {
        method: `GET`,
        headers: {
          "Content-Type": "application/json",
        },
      });
      let data = await response.json();
      if (response.status === 200) {
        if (data.allNotes.length > 0) {
          return data.allNotes;
        } else {
          return [];
        }
      } else {
        console.log("something went wrong");
      }

      //   return JSON.parse(localStorage.getItem("notes")) || [];
    } catch (error) {
      console.error("Unable to load notes:", error);
      return [];
    }
  }

  function saveNotes() {
    let textAreas = document.querySelectorAll(".note textarea");
    let notes = [];

    textAreas.forEach(function (textarea) {
      notes.push(textarea.value);
    });

    localStorage.setItem("notes", JSON.stringify(notes));
  }
  let minimizeBtn;

  function createNote(text, add, noteId) {
    text = text || "";

    let note = document.createElement("div");
    note.classList.add("note");
    note.setAttribute("data-id", `${noteId}`);
    note.setAttribute("aria-current", `${noteId ? true : false}`);

    note.insertAdjacentHTML(
      "afterbegin",
      `
    <div class="operation">

        <button type="button" class="expand" title="Expand note">
            <i class="fas fa-expand"></i>
        </button>
        <button type="button" class="minimize hidden" title="minimize note">
            <i class="fas fa-compress"></i>
        </button>

        <button type="button" class="edit_note ${add ? "hidden" : ""}" title="Edit note">
            <i class="fas fa-edit"></i>
        </button>
        <button type="button" class="save_note ${add ? "" : "hidden"}" title="Save note">
            <i class="fas fa-check"></i>
        </button>

        <button type="button" class="delete" title="Delete note">
            <i class="fas fa-trash-alt"></i>
        </button>

    </div>

    <div class="note-content ${text ? "" : "hidden"}"><p></p></div>

    <textarea class="${text ? "hidden" : ""}"></textarea>
`,
    );

    let expandBtn = note.querySelector(".expand");
    minimizeBtn = note.querySelector(".minimize");
    let NoteControlBtn = note.querySelectorAll(".save_note, .edit_note");
    let editBtn = note.querySelector(".edit_note");
    let saveBtn = note.querySelector(".save_note");
    let deleteBtn = note.querySelector(".delete");
    let editIcon = note.querySelector(".fa-edit");
    let mainDiv = note.querySelector(".note-content");
    let textArea = note.querySelector("textarea");

    textArea.value = text;
    mainDiv.textContent = text;

    // EDIT / SAVE (one button, toggles based on current mode)
    $(NoteControlBtn).on("click", function () {
      let isEditing = !textArea.classList.contains("hidden");

      if (isEditing) {
        // save -> show text
        mainDiv.textContent = textArea.value;
        mainDiv.classList.remove("hidden");
        textArea.classList.add("hidden");
        $(saveBtn).addClass("hidden");
        $(editBtn).removeClass("hidden");
        editBtn.title = "Edit note";

        saveNotes();
      } else {
        // edit -> show textarea
        mainDiv.classList.add("hidden");
        textArea.classList.remove("hidden");
        $(editBtn).addClass("hidden");
        $(saveBtn).removeClass("hidden");
        editBtn.title = "Save note";
        textArea.focus();
      }
    });

    // EXPAND / COLLAPSE
    expandBtn.addEventListener("click", function () {
      let isOpen = note.classList.toggle("expanded");
      let icon = expandBtn.querySelector("i");

      icon.classList.toggle("fa-expand-alt", !isOpen);
      icon.classList.toggle("fa-compress-alt", isOpen);
      expandBtn.title = isOpen ? "Collapse note" : "Expand note";

      if (isOpen) note.scrollIntoView({ behavior: "smooth", block: "nearest" });
      note.querySelector(".minimize").classList.remove("hidden");
      $(expandBtn).addClass("hidden");
    });

    // DELETE
    deleteBtn.addEventListener("click", async function () {
      let $note = $(this).closest(".note");
      let noteId = $note.data("id");

      let response = await fetch(`note/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          noteId: noteId,
        }),
      });
      let data = await response.json();
      if (response.status === 200) {
        showPopupMessage(data.message);
        note.remove();
      } else {
        console.log("something went wrong");
      }
    });

    // AUTO-SAVE while typing
    textArea.addEventListener("input", function (event) {
      mainDiv.textContent = event.target.value;
      saveNotes();
    });

    $("#notesContainer").append(note);
  }

  $(document).on("click", ".note .minimize", function () {
    const $note = $(this).closest(".note");
    const isOpen = $note.toggleClass("expanded").hasClass("expanded");

    $(this)
      .attr("title", isOpen ? "Collapse note" : "Expand note")
      .find("i")
      .toggleClass("fa-expand-alt", !isOpen)
      .toggleClass("fa-compress-alt", isOpen);

    if (isOpen) {
      $note[0].scrollIntoView({ behavior: "smooth", block: "nearest" });
      $note[0].querySelector(".minimize").classList.add("hidden");
      $note[0].querySelector(".expand").classList.remove("hidden");
    }
  });

  $("body").on("click", ".save_note, .edit_note", async function () {
    let $note = $(this).closest(".note");
    // console.log($note.text().trim());
    let $noteText = $note.text().trim();
    let editNote = $note.attr("aria-current") === "true";
    let noteId = $note.attr("data-id");

    if ($(this).hasClass("save_note")) {
      const randomId = Math.random().toString(36).substring(2, 10);

      let response = await fetch(`note/${editNote ? "edit" : "entry"}`, {
        method: `${editNote ? "PATCH" : "POST"}`,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note: $noteText,
          ...(editNote && { noteId: noteId }),
        }),
      });
      let data = await response.json();
      if (response.status === 200) {
        showPopupMessage(data.message);
        $(this).closest(".note").attr("data-id", data.notesId);
        $(this).closest(".note").attr("aria-current", true);
        return;
      } else {
        console.log("something went wrong");
      }
    }
  });

  async function loadNotes() {
    let notes = await getNotes();

    notes.forEach(function (note) {
      createNote(note.note, false, note.noteId);
    });
  }

  function initialize() {
    let addButton = document.querySelector("#add");

    loadNotes();

    if (addButton) {
      addButton.addEventListener("click", function () {
        createNote("", (add = true), "");
      });
    }
  }

  const messagePopup = document.getElementById("messagePopup");
  const popupMessage = document.getElementById("popupMessage");
  const closePopup = document.getElementById("closePopup");

  // Show a message at the top
  function showPopupMessage(message) {
    popupMessage.textContent = message;
    messagePopup.classList.remove("hide");
    messagePopup.classList.remove("hidden");
  }

  // Close the popup
  closePopup.addEventListener("click", () => {
    messagePopup.classList.add("hide");
    messagePopup.classList.add("hidden");
  });

  /* ---------------------------------------------------------
       PUBLIC METHODS
    --------------------------------------------------------- */

  return {
    init: initialize,
    create: createNote,
    save: saveNotes,
    load: loadNotes,
  };
})();

/* =========================================================
   AUTHENTICATION MODULE
========================================================= */

KEEPNOTE.authFunction = (function () {
  /* ---------------------------------------------------------
       PRIVATE VARIABLES
    --------------------------------------------------------- */
  let authContainer = document.querySelector(".auth-buttons");

  let authOverlay = document.querySelector("#authOverlay");

  let loginButton = document.querySelector("#login");
  let signupButton = document.querySelector("#signup");

  let closeAuth = document.querySelector("#closeAuth");

  let loginFormContainer = document.querySelector("#loginForm");
  let signupFormContainer = document.querySelector("#signupForm");

  let loginForm = document.querySelector("#loginForm form");
  let signupForm = document.querySelector("#signupForm form");

  let showSignup = document.querySelector("#showSignup");
  let showLogin = document.querySelector("#showLogin");

  let logoutButton = document.querySelector(".logout-btn");
  let authButtons = document.querySelector(".authBtn");
  let userGreeting = document.querySelector(".user_greet");

  /* ---------------------------------------------------------
       AUTH UI
    --------------------------------------------------------- */

  function openAuth(type) {
    authOverlay.classList.add("active");

    if (type === "login") {
      showLoginForm();
    } else {
      showSignupForm();
    }
  }

  function closeAuthModal() {
    authOverlay.classList.remove("active");
  }

  function showLoginForm() {
    loginFormContainer.classList.remove("hidden");
    signupFormContainer.classList.add("hidden");
  }

  function showSignupForm() {
    signupFormContainer.classList.remove("hidden");
    loginFormContainer.classList.add("hidden");
  }

  /* ---------------------------------------------------------
       AUTH UI STATE
    --------------------------------------------------------- */

  function showLoggedInUser(userName) {
    userGreeting.textContent = "Welcome, " + userName + "!";

    logoutButton.classList.remove("hidden");
    authButtons.classList.add("hidden");
    authContainer.classList.remove("auth-loading");
  }

  function showLoggedOutUser() {
    userGreeting.textContent = "";

    logoutButton.classList.add("hidden");
    authButtons.classList.remove("hidden");
    authContainer.classList.remove("auth-loading");
  }

  /* ---------------------------------------------------------
       API REQUEST
    --------------------------------------------------------- */

  async function apiRequest(url, options) {
    options = options || {};

    let response = await fetch(url, {
      method: options.method || "GET",

      credentials: "include",

      headers: {
        "Content-Type": "application/json",
      },

      body: options.body ? JSON.stringify(options.body) : null,
    });

    return response;
  }

  /* ---------------------------------------------------------
       LOGIN
    --------------------------------------------------------- */

  async function login(event) {
    event.preventDefault();

    let email = $("#loginEmail");
    let password = $("#loginPassword");

    let valid = true;

    removeError(email);
    removeError(password);

    /* Email */

    if (email.val().trim() === "") {
      showError(email, "Email is required");

      valid = false;
    } else if (!isValidEmail(email.val().trim())) {
      showError(email, "Enter a valid email address");

      valid = false;
    }

    /* Password */

    if (password.val() === "") {
      showError(password, "Password is required");

      valid = false;
    } else if (!isValidPassword(password.val())) {
      showError(
        password,
        "Password must be 8-12 characters and contain a special character",
      );

      valid = false;
    }

    if (!valid) {
      return;
    }

    try {
      let response = await apiRequest("/auth/login", {
        method: "POST",

        body: {
          email: email.val().trim().toLowerCase(),
          password: password.val(),
        },
      });

      let data = await response.json();

      if (!response.ok) {
        alert(data.message || "Login failed");

        return;
      }

      showLoggedInUser(data.user);

      event.target.reset();

      closeAuthModal();
      // loadNotes()
      KEEPNOTE.notesFunction.load();
    } catch (error) {
      console.error("Login error:", error);

      alert("Something went wrong. Please try again.");
    }
  }

  /* ---------------------------------------------------------
       SIGNUP
    --------------------------------------------------------- */

  async function signup(event) {
    event.preventDefault();

    let firstName = $("#firstName");
    let lastName = $("#lastName");
    let email = $("#signupEmail");
    let password = $("#signupPassword");

    let valid = true;

    removeError(firstName);
    removeError(lastName);
    removeError(email);
    removeError(password);

    /* First Name */

    if (firstName.val().trim() === "") {
      showError(firstName, "First name is required");

      valid = false;
    }

    /* Last Name */

    if (lastName.val().trim() === "") {
      showError(lastName, "Last name is required");

      valid = false;
    }

    /* Email */

    if (email.val().trim() === "") {
      showError(email, "Email is required");

      valid = false;
    } else if (!isValidEmail(email.val().trim())) {
      showError(email, "Enter a valid email address");

      valid = false;
    }

    /* Password */

    if (password.val() === "") {
      showError(password, "Password is required");

      valid = false;
    } else if (!isValidPassword(password.val())) {
      showError(
        password,
        "Password must be 8-12 characters and contain a special character",
      );

      valid = false;
    }

    if (!valid) {
      return;
    }

    try {
      let response = await apiRequest("/auth/register", {
        method: "POST",

        body: {
          firstName: firstName.val().trim(),
          lastName: lastName.val().trim(),
          email: email.val().trim(),
          password: password.val(),
        },
      });

      let data = await response.json();

      if (!response.ok) {
        alert(data.message || "Registration failed");

        return;
      }

      alert(data.message || "Account created successfully");

      showLoggedInUser(data.fullName);

      event.target.reset();

      closeAuthModal();
    } catch (error) {
      console.error("Signup error:", error);

      alert("Something went wrong. Please try again.");
    }
  }

  /* ---------------------------------------------------------
       LOGOUT
    --------------------------------------------------------- */

  async function logout() {
    try {
      let response = await fetch("/auth/logout", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      showLoggedOutUser();
      $(".notes-container").empty();
    } catch (error) {
      console.error("Logout error:", error);

      alert("Unable to logout. Please try again.");
    }
  }

  /* ---------------------------------------------------------
       CHECK AUTHENTICATION
    --------------------------------------------------------- */

  async function checkAuthentication() {
    try {
      let response = await fetch("/auth/getMe", {
        credentials: "include",
      });

      if (!response.ok) {
        showLoggedOutUser();

        return;
      }

      let user = await response.json();

      if (user.loggedIn) {
        showLoggedInUser(user.userName);
      } else {
        showLoggedOutUser();
      }
    } catch (error) {
      console.error("Authentication check failed:", error);

      showLoggedOutUser();
    }
  }

  /* ---------------------------------------------------------
       VALIDATION
    --------------------------------------------------------- */

  function isValidEmail(email) {
    let emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailPattern.test(email);
  }

  function isValidPassword(password) {
    let correctLength = password.length >= 8 && password.length <= 12;

    let specialCharacter = /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]';`~]/.test(
      password,
    );

    return correctLength && specialCharacter;
  }

  /* ---------------------------------------------------------
       ERROR HANDLING
    --------------------------------------------------------- */

  function showError(input, message) {
    removeError(input);

    input.addClass("input-error");

    let error = $("<small>").addClass("error-message").text(message);

    input.parent().append(error);
  }

  function removeError(input) {
    input.removeClass("input-error");

    input.parent().find(".error-message").remove();
  }

  /* ---------------------------------------------------------
       EVENT LISTENERS
    --------------------------------------------------------- */

  function initialize() {
    $(".logout-btn").addClass("hidden");

    loginButton.addEventListener("click", function () {
      openAuth("login");
    });

    signupButton.addEventListener("click", function () {
      openAuth("signup");
    });

    closeAuth.addEventListener("click", function () {
      closeAuthModal();
    });

    showSignup.addEventListener("click", function () {
      showSignupForm();
    });

    showLogin.addEventListener("click", function () {
      showLoginForm();
    });

    authOverlay.addEventListener("click", function (event) {
      if (event.target === authOverlay) {
        closeAuthModal();
      }
    });

    loginForm.addEventListener("submit", login);

    signupForm.addEventListener("submit", signup);

    logoutButton.addEventListener("click", logout);

    checkAuthentication();
  }

  /* ---------------------------------------------------------
       PUBLIC METHODS
    --------------------------------------------------------- */

  return {
    init: initialize,
    login: login,
    signup: signup,
    logout: logout,
    checkAuthentication: checkAuthentication,
  };
})();

/* =========================================================
   APPLICATION START
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  KEEPNOTE.notesFunction.init();

  KEEPNOTE.authFunction.init();
});
