// ==========================================
// GLOBAL ERROR BOUNDARY & TELEMETRY
// ==========================================
window.__appErrors = [];
window.addEventListener("error", (event) => {
  const errObj = {
    type: "error",
    message: event.message || "Unknown error",
    filename: event.filename ? event.filename.split("/").pop() : "unknown",
    lineno: event.lineno,
    colno: event.colno,
    time: new Date().toLocaleTimeString()
  };
  window.__appErrors.unshift(errObj);
  if (window.__appErrors.length > 20) window.__appErrors.pop();
  if (typeof updateDiagnosticsUI === "function") updateDiagnosticsUI();
});

window.addEventListener("unhandledrejection", (event) => {
  const errObj = {
    type: "unhandledrejection",
    message: (event.reason && (event.reason.message || event.reason.toString())) || "Unhandled Promise Rejection",
    filename: "promise",
    time: new Date().toLocaleTimeString()
  };
  window.__appErrors.unshift(errObj);
  if (window.__appErrors.length > 20) window.__appErrors.pop();
  if (typeof updateDiagnosticsUI === "function") updateDiagnosticsUI();
});

// Safe LocalStorage setter with quota recovery
function safeLocalStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`[Storage Warning] Failed to write key "${key}". Attempting quota recovery...`, e);
    if (typeof versionHistory !== "undefined" && Array.isArray(versionHistory) && versionHistory.length > 4) {
      versionHistory = versionHistory.slice(0, Math.floor(versionHistory.length / 2));
      try {
        localStorage.setItem("antigravity_resume_versions", JSON.stringify(versionHistory));
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        console.error("[Storage Error] Quota still exceeded after pruning snapshots", retryErr);
      }
    }
    if (window.__appErrors) {
      window.__appErrors.unshift({
        type: "QuotaExceededError",
        message: "Browser localStorage quota exceeded; snapshot pruned to maintain integrity.",
        filename: "localStorage",
        time: new Date().toLocaleTimeString()
      });
      if (typeof updateDiagnosticsUI === "function") updateDiagnosticsUI();
    }
    return false;
  }
}

// State Management
let state = JSON.parse(JSON.stringify(DEFAULT_RESUME_DATA));

// Preset Color Palettes
const THEMES = {
  illustrator: { name: "Illustrator Navy & Teal", primary: "#1C3A5E", accent: "#0B7A75", body: "#2C3E50", muted: "#6C757D", divider: "#0B7A75" },
  monochrome:  { name: "Printer Friendly Black & White", primary: "#000000", accent: "#111111", body: "#1a1a1a", muted: "#555555", divider: "#000000" },
  charcoal:    { name: "Executive Charcoal & Blue", primary: "#1E293B", accent: "#3B82F6", body: "#334155", muted: "#64748B", divider: "#3B82F6" },
  emerald:     { name: "Tech Emerald", primary: "#0F5132", accent: "#198754", body: "#212529", muted: "#6C757D", divider: "#198754" },
  burgundy:    { name: "Classic Burgundy", primary: "#581845", accent: "#900C3F", body: "#2C3E50", muted: "#6C757D", divider: "#900C3F" },
  indigo:      { name: "Modern Indigo", primary: "#311B92", accent: "#6200EA", body: "#212121", muted: "#757575", divider: "#6200EA" }
};

let focusTargetField = null;

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("antigravity_resume_data");
  if (saved) {
    try {
      state = JSON.parse(saved);
    } catch(e) {
      state = JSON.parse(JSON.stringify(DEFAULT_RESUME_DATA));
    }
  }

  if (!state.entryHeights) state.entryHeights = {};
  if (!state.sectionPaddings) state.sectionPaddings = {};
  if (!state.docThemes) state.docThemes = {};
  if (!state.settings.sectionOrder) {
    state.settings.sectionOrder = ["summary", "skills", "experience", "education", "certifications", "achievements"];
  }

  initProfilesSystem();
  initTabSystem();
  populateFormFields();
  applySettings();
  renderCanvas();
  setupEventListeners();
  initDragResizeHandlers();
  initVersionHistory();
  initDiagnosticsSystem();

  // Proactive Font-Loading Sync
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      distributePages();
      if (typeof updateDiagnosticsUI === "function") updateDiagnosticsUI();
    });
  }

  // Initialize history stack with pristine loaded state
  lastRecordedStateJSON = JSON.stringify(state);
  updateUndoRedoButtons();
});

// ==========================================
// RESUME PROFILES / VARIANTS MANAGER SYSTEM
// ==========================================
let resumeProfiles = [];
let currentProfileId = "default";

function formatTimeLabel(date) {
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr}, ${timeStr}`;
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initProfilesSystem() {
  const savedProfiles = localStorage.getItem("antigravity_resume_profiles");
  const savedCurrentId = localStorage.getItem("antigravity_current_profile_id");

  if (savedProfiles) {
    try {
      resumeProfiles = JSON.parse(savedProfiles);
    } catch(e) {
      resumeProfiles = [];
    }
  }

  if (!Array.isArray(resumeProfiles) || resumeProfiles.length === 0) {
    // Migration: Create initial profile from active state
    const title = (state.header && state.header.professionalTitle && state.header.professionalTitle !== "PROFESSIONAL TITLE / ROLE") 
      ? state.header.professionalTitle 
      : "Main Resume";
    const initialProfile = {
      id: "profile-" + Date.now(),
      name: title,
      updatedAt: formatTimeLabel(new Date()),
      data: JSON.parse(JSON.stringify(state))
    };
    resumeProfiles = [initialProfile];
    currentProfileId = initialProfile.id;
    saveProfilesToStorage();
  } else {
    currentProfileId = (savedCurrentId && resumeProfiles.some(p => p.id === savedCurrentId))
      ? savedCurrentId
      : resumeProfiles[0].id;
    
    // Load active profile data into state
    const activeProf = resumeProfiles.find(p => p.id === currentProfileId);
    if (activeProf && activeProf.data) {
      state = JSON.parse(JSON.stringify(activeProf.data));
    }
  }

  updateProfileDropdown();
}

function saveProfilesToStorage() {
  localStorage.setItem("antigravity_resume_profiles", JSON.stringify(resumeProfiles));
  localStorage.setItem("antigravity_current_profile_id", currentProfileId);
}

function updateActiveProfileData() {
  const activeProf = resumeProfiles.find(p => p.id === currentProfileId);
  if (activeProf) {
    activeProf.data = JSON.parse(JSON.stringify(state));
    activeProf.updatedAt = formatTimeLabel(new Date());
    saveProfilesToStorage();
    updateProfileDropdown();
  }
}

function getCurrentProfileName() {
  const activeProf = resumeProfiles.find(p => p.id === currentProfileId);
  return activeProf ? activeProf.name : "Resume Variant";
}

function updateProfileDropdown() {
  const sel = document.getElementById("select-resume-profile");
  if (!sel) return;

  sel.innerHTML = "";
  resumeProfiles.forEach(prof => {
    const opt = document.createElement("option");
    opt.value = prof.id;
    opt.textContent = `${prof.name} (${prof.updatedAt || 'Recent'})`;
    if (prof.id === currentProfileId) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  });
}

function switchProfile(targetId) {
  if (targetId === currentProfileId) return;
  const targetProf = resumeProfiles.find(p => p.id === targetId);
  if (!targetProf) return;

  flushTypingTransaction();
  updateActiveProfileData();

  currentProfileId = targetId;
  saveProfilesToStorage();

  state = JSON.parse(JSON.stringify(targetProf.data));
  localStorage.setItem("antigravity_resume_data", JSON.stringify(state));

  // Reset undo/redo for new profile context
  undoStack.length = 0;
  redoStack.length = 0;
  lastRecordedStateJSON = JSON.stringify(state);
  updateUndoRedoButtons();

  populateFormFields();
  applySettings();
  renderCanvas();
  updateProfileDropdown();
  updateVersionDropdown();

  showToast(`✓ Switched to resume variant: "${targetProf.name}"`);
}

function openNewVariantModal() {
  const modal = document.getElementById("modal-new-variant");
  const input = document.getElementById("input-new-variant-name");
  const err = document.getElementById("new-variant-error");
  const cardCopy = document.getElementById("source-card-copy");
  const cardBlank = document.getElementById("source-card-blank");
  const radioCopy = cardCopy?.querySelector("input");

  if (!modal || !input) return;

  input.value = "";
  if (err) err.style.display = "none";
  input.style.borderColor = "";

  if (radioCopy) radioCopy.checked = true;
  cardCopy?.classList.add("selected");
  cardBlank?.classList.remove("selected");

  modal.classList.add("active");
  setTimeout(() => input.focus(), 60);
}

// Backward-compatible alias for existing onclick handlers
function promptCreateNewProfile() {
  openNewVariantModal();
}

async function promptDuplicateCurrentProfile() {
  const currentProf = resumeProfiles.find(p => p.id === currentProfileId);
  const defaultName = currentProf ? `${currentProf.name} (Copy)` : "New Variant";
  const name = await appPrompt({
    title: "Duplicate Resume Variant",
    message: "Enter a name for your duplicated resume variant:",
    defaultValue: defaultName,
    placeholder: "e.g. Senior Designer (Tailored)",
    confirmText: "Duplicate Variant"
  });
  if (!name || !name.trim()) return;

  flushTypingTransaction();
  updateActiveProfileData();

  const newProfile = {
    id: "profile-" + Date.now(),
    name: name.trim(),
    updatedAt: formatTimeLabel(new Date()),
    data: JSON.parse(JSON.stringify(state))
  };

  resumeProfiles.push(newProfile);
  saveProfilesToStorage();
  switchProfile(newProfile.id);
  recordVersionSnapshot(`Variant: ${newProfile.name}`, true, true, `Duplicated Variant: ${newProfile.name}`);
}

function openProfilesManagerModal() {
  renderProfilesManagerList();
  document.getElementById("modal-profile-manage")?.classList.add("active");
}

function renderProfilesManagerList() {
  const container = document.getElementById("profiles-manager-list");
  if (!container) return;

  container.innerHTML = "";
  resumeProfiles.forEach(prof => {
    const isActive = prof.id === currentProfileId;
    const item = document.createElement("div");
    item.className = `profile-list-item ${isActive ? 'active' : ''}`;
    item.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;">
        <strong style="font-size: 0.88rem; color: #1e293b; line-height: 1.35; word-break: break-word;">${escapeHTML(prof.name)}</strong>
        <span style="font-size: 0.72rem; color: #64748b;">Updated: ${prof.updatedAt || 'Recently'}</span>
      </div>
      <div style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
        ${isActive ? '<span class="version-card-badge current" style="display: inline-flex; align-items: center; justify-content: center; height: 26px; padding: 0 9px; border-radius: 5px; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Active</span>' : ''}
        ${!isActive ? `<button class="btn btn-sm btn-outline" onclick="switchProfile('${prof.id}'); closeModal('modal-profile-manage');">Activate</button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="renameProfile('${prof.id}')">Rename</button>
        <button class="btn btn-sm btn-outline" style="color: #ef4444;" onclick="deleteProfile('${prof.id}')" ${resumeProfiles.length <= 1 ? 'disabled' : ''}>Delete</button>
      </div>
    `;
    container.appendChild(item);
  });
}

async function renameProfile(id) {
  const prof = resumeProfiles.find(p => p.id === id);
  if (!prof) return;
  const newName = await appPrompt({
    title: "Rename Resume Variant",
    message: `Enter a new name for variant "${prof.name}":`,
    defaultValue: prof.name,
    confirmText: "Save Name"
  });
  if (newName && newName.trim()) {
    const oldName = prof.name;
    prof.name = newName.trim();
    saveProfilesToStorage();

    // Update all version history entries linked to this profile
    versionHistory.forEach(ver => {
      if (ver.profileId === id || ver.profileName === oldName) {
        ver.profileName = prof.name;
        if (ver.label && ver.label.includes(oldName)) {
          ver.label = ver.label.replaceAll(oldName, prof.name);
        }
        if (ver.customName && ver.customName.includes(oldName)) {
          ver.customName = ver.customName.replaceAll(oldName, prof.name);
        }
      }
    });
    localStorage.setItem("antigravity_resume_versions", JSON.stringify(versionHistory));

    updateProfileDropdown();
    updateVersionDropdown();
    renderProfilesManagerList();
    renderVersionHistoryList();
    showToast(`✓ Profile renamed to "${prof.name}"`);
  }
}

async function deleteProfile(id) {
  if (resumeProfiles.length <= 1) {
    showToast("⚠️ You must keep at least one resume profile.");
    return;
  }
  const prof = resumeProfiles.find(p => p.id === id);
  if (!prof) return;
  const confirmed = await appConfirm({
    title: "Delete Resume Variant",
    message: `Are you sure you want to delete profile "${prof.name}"?\n\nThis action cannot be undone.`,
    confirmText: "Delete Profile",
    isDanger: true
  });
  if (confirmed) {
    resumeProfiles = resumeProfiles.filter(p => p.id !== id);
    if (currentProfileId === id) {
      currentProfileId = resumeProfiles[0].id;
      state = JSON.parse(JSON.stringify(resumeProfiles[0].data));
      populateFormFields();
      applySettings();
      renderCanvas();
    }
    saveProfilesToStorage();
    updateProfileDropdown();
    renderProfilesManagerList();
    showToast(`✓ Profile deleted.`);
  }
}

// ==========================================
// 40-VERSION REVISION & PREVIEW SYSTEM
// ==========================================
const MAX_VERSIONS = 40;
let versionHistory = [];
let selectedPreviewVersionId = null;
let currentHistoryFilter = 'all'; // 'all' | 'starred' | 'manual' | 'auto'
let currentHistorySearch = '';

let lastAutoSavedStateJSON = "";
const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5-minute auto-save cycle

function extractMetadataFromState(st) {
  return {
    candidateName: (st.header && st.header.fullName) ? st.header.fullName : "Untitled Candidate",
    roleTitle: (st.header && st.header.professionalTitle) ? st.header.professionalTitle : "General Resume",
    jobCount: (st.experience && Array.isArray(st.experience)) ? st.experience.length : 0,
    companies: (st.experience && Array.isArray(st.experience)) ? st.experience.map(e => e.company).filter(Boolean) : [],
    skillsCount: (st.skills && Array.isArray(st.skills)) ? st.skills.reduce((acc, col) => acc + (col.items ? col.items.length : 0), 0) : 0,
    summaryExcerpt: (st.summary || "").slice(0, 100)
  };
}

function initVersionHistory() {
  const saved = localStorage.getItem("antigravity_resume_versions");
  if (saved) {
    try {
      versionHistory = JSON.parse(saved);
    } catch(e) {
      versionHistory = [];
    }
  }

  // Ensure legacy versions have metadata and profile association
  versionHistory.forEach(ver => {
    if (!ver.roleTitle || !ver.candidateName) {
      try {
        const parsed = JSON.parse(ver.stateJSON);
        const m = extractMetadataFromState(parsed);
        ver.roleTitle = m.roleTitle;
        ver.candidateName = m.candidateName;
        ver.jobCount = m.jobCount;
        ver.companies = m.companies;
        ver.skillsCount = m.skillsCount;
      } catch(e) {}
    }
    if (!ver.profileId && resumeProfiles.length > 0) {
      ver.profileId = resumeProfiles[0].id;
      ver.profileName = resumeProfiles[0].name;
    }
  });

  if (!Array.isArray(versionHistory) || versionHistory.length === 0) {
    recordVersionSnapshot("Initial Document State", true, true);
  } else {
    updateVersionCountBadge();
    updateVersionDropdown();
  }

  // Initialize auto-save baseline
  lastAutoSavedStateJSON = JSON.stringify(state);

  // Background 5-Minute Auto-Save Engine
  setInterval(() => {
    const currentJSON = JSON.stringify(state);
    if (currentJSON !== lastAutoSavedStateJSON) {
      lastAutoSavedStateJSON = currentJSON;
      flushTypingTransaction();
      saveState(true);
      recordVersionSnapshot("Auto-Save (5 min)", false, false);
      showToast("⏱ Auto-saved revision (5 min)");
    }
  }, AUTO_SAVE_INTERVAL_MS);
}

function recordVersionSnapshot(label = "Document Edit", isManual = false, isPinned = false, customName = null) {
  const now = new Date();
  const timestamp = formatTimeLabel(now);
  const currentStateJSON = JSON.stringify(state);

  // Avoid duplicate consecutive versions for the same profile variant
  if (versionHistory.length > 0 && 
      versionHistory[0].stateJSON === currentStateJSON && 
      versionHistory[0].profileId === currentProfileId) {
    if (customName) {
      versionHistory[0].customName = customName;
      versionHistory[0].label = customName;
      if (isPinned) versionHistory[0].isPinned = true;
      localStorage.setItem("antigravity_resume_versions", JSON.stringify(versionHistory));
      updateVersionDropdown();
      renderVersionHistoryList();
    }
    return;
  }

  const meta = extractMetadataFromState(state);

  const snapshot = {
    id: Date.now(),
    label: customName || label,
    customName: customName || null,
    timestamp: timestamp,
    isManual: !!isManual,
    isPinned: !!isPinned,
    profileId: currentProfileId,
    profileName: getCurrentProfileName(),
    stateJSON: currentStateJSON,
    candidateName: meta.candidateName,
    roleTitle: meta.roleTitle,
    jobCount: meta.jobCount,
    companies: meta.companies,
    skillsCount: meta.skillsCount,
    summaryExcerpt: meta.summaryExcerpt
  };

  versionHistory.unshift(snapshot);
  pruneVersionHistory();

  localStorage.setItem("antigravity_resume_versions", JSON.stringify(versionHistory));
  updateVersionCountBadge();
  updateVersionDropdown();
}

function pruneVersionHistory() {
  if (versionHistory.length <= MAX_VERSIONS) return;
  let excess = versionHistory.length - MAX_VERSIONS;
  // Prune only unpinned items from the oldest end
  for (let i = versionHistory.length - 1; i >= 0 && excess > 0; i--) {
    if (!versionHistory[i].isPinned) {
      versionHistory.splice(i, 1);
      excess--;
    }
  }
}

function updateVersionCountBadge() {
  const badge = document.getElementById("version-count-badge");
  if (badge) {
    badge.textContent = versionHistory.length;
  }
}

function updateVersionDropdown() {
  const sel = document.getElementById("select-version-dropdown");
  if (!sel) return;

  sel.innerHTML = "";
  const activeProf = resumeProfiles.find(p => p.id === currentProfileId);
  const activeProfName = activeProf ? activeProf.name : getCurrentProfileName();
  const currentJSON = JSON.stringify(state);

  // Group versions into Active Variant vs Other Variants
  const currentVariantVersions = versionHistory.filter(v => 
    v.profileId === currentProfileId || (!v.profileId && resumeProfiles[0]?.id === currentProfileId)
  );
  const otherVariantVersions = versionHistory.filter(v => !currentVariantVersions.includes(v));

  let hasSelected = false;

  // 1. Active Variant Group
  const currentGroup = document.createElement("optgroup");
  currentGroup.label = `Active Variant: ${activeProfName}`;

  // Check if current editor matches any snapshot in current variant
  const currentMatch = currentVariantVersions.find(v => v.stateJSON === currentJSON);

  if (!currentMatch) {
    const liveOpt = document.createElement("option");
    liveOpt.value = "live-canvas";
    liveOpt.textContent = `● Active: ${activeProfName} (Current Canvas)`;
    liveOpt.selected = true;
    hasSelected = true;
    currentGroup.appendChild(liveOpt);
  }

  currentVariantVersions.forEach(ver => {
    const isCurrent = ver.stateJSON === currentJSON && !hasSelected;
    const opt = document.createElement("option");
    opt.value = ver.id;
    
    const icon = isCurrent ? "● Active: " : (ver.isPinned ? "⭐ " : (ver.isManual ? "💾 " : "⏱ "));
    const labelDetail = ver.customName || (ver.label && ver.label !== "Document Edit" ? ver.label : activeProfName);
    opt.textContent = `${icon}${labelDetail} (${ver.timestamp})`;
    
    if (isCurrent) {
      opt.selected = true;
      hasSelected = true;
    }
    currentGroup.appendChild(opt);
  });

  sel.appendChild(currentGroup);

  // 2. Revisions from Other Variants
  if (otherVariantVersions.length > 0) {
    const otherGroup = document.createElement("optgroup");
    otherGroup.label = "Revisions from Other Variants";

    otherVariantVersions.forEach(ver => {
      const prof = resumeProfiles.find(p => p.id === ver.profileId);
      const profName = prof ? prof.name : (ver.profileName || 'Other Variant');
      const opt = document.createElement("option");
      opt.value = ver.id;
      const icon = ver.isPinned ? "⭐ " : (ver.isManual ? "💾 " : "⏱ ");
      const labelDetail = ver.customName ? `[${profName}] ${ver.customName}` : `[${profName}] ${ver.label || 'Revision'}`;
      opt.textContent = `${icon}${labelDetail} (${ver.timestamp})`;
      otherGroup.appendChild(opt);
    });

    sel.appendChild(otherGroup);
  }
}

window.togglePinVersion = function(id, e) {
  if (e) e.stopPropagation();
  const ver = versionHistory.find(v => v.id === id);
  if (!ver) return;
  ver.isPinned = !ver.isPinned;
  localStorage.setItem("antigravity_resume_versions", JSON.stringify(versionHistory));
  renderVersionHistoryList();
  updateVersionDropdown();
  showToast(ver.isPinned ? "⭐ Revision starred & protected from auto-deletion" : "Revision unstarred");
};

window.renameVersionPrompt = async function(id, e) {
  if (e) e.stopPropagation();
  const ver = versionHistory.find(v => v.id === id);
  if (!ver) return;
  const currentName = ver.customName || ver.label;
  const newName = await appPrompt({
    title: "Rename Revision Snapshot",
    message: "Enter a custom name or label for this revision snapshot:",
    defaultValue: currentName,
    confirmText: "Save Label"
  });
  if (newName !== null && newName.trim()) {
    ver.customName = newName.trim();
    ver.label = newName.trim();
    localStorage.setItem("antigravity_resume_versions", JSON.stringify(versionHistory));
    renderVersionHistoryList();
    updateVersionDropdown();
    showToast(`✓ Revision renamed to: "${ver.label}"`);
  }
};

window.promptSaveManualState = async function() {
  const defaultLabel = `${state.header?.professionalTitle || 'Resume'} - Milestone`;
  const customLabel = await appPrompt({
    title: "Save Named Snapshot",
    message: "Enter a custom name for this snapshot checkpoint (optional):",
    defaultValue: defaultLabel,
    confirmText: "Save Snapshot"
  });
  if (customLabel === null) return; // User cancelled

  flushTypingTransaction();
  saveState(true);
  recordVersionSnapshot(customLabel.trim() || "Manual Save (Ctrl+S)", true, true, customLabel.trim() || null);
  showToast("✓ Saved named snapshot & starred to history!");
  renderVersionHistoryList();
  updateVersionDropdown();
};

function renderVersionHistoryList() {
  const container = document.getElementById("version-history-list");
  if (!container) return;

  // Counts for tabs
  const totalCount = versionHistory.length;
  const starredCount = versionHistory.filter(v => v.isPinned).length;
  const manualCount = versionHistory.filter(v => v.isManual || v.customName).length;
  const autoCount = versionHistory.filter(v => !v.isManual && !v.customName).length;

  const countAll = document.getElementById("count-all");
  const countStarred = document.getElementById("count-starred");
  const countManual = document.getElementById("count-manual");
  const countAuto = document.getElementById("count-auto");
  if (countAll) countAll.textContent = totalCount;
  if (countStarred) countStarred.textContent = starredCount;
  if (countManual) countManual.textContent = manualCount;
  if (countAuto) countAuto.textContent = autoCount;

  // Filter items
  const query = (currentHistorySearch || "").toLowerCase().trim();
  const filtered = versionHistory.filter(ver => {
    // Tab filter
    if (currentHistoryFilter === 'starred' && !ver.isPinned) return false;
    if (currentHistoryFilter === 'manual' && (!ver.isManual && !ver.customName)) return false;
    if (currentHistoryFilter === 'auto' && (ver.isManual || ver.customName)) return false;

    // Search query filter
    if (query) {
      const matchLabel = (ver.label || "").toLowerCase().includes(query);
      const matchRole = (ver.roleTitle || "").toLowerCase().includes(query);
      const matchName = (ver.candidateName || "").toLowerCase().includes(query);
      const matchCompanies = (ver.companies || []).some(c => c.toLowerCase().includes(query));
      if (!matchLabel && !matchRole && !matchName && !matchCompanies) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 30px 10px; font-size: 0.85rem;">No revisions match your current filter.</div>`;
    renderInspectionPanel(null);
    return;
  }

  // Ensure valid selection for preview panel
  if (!selectedPreviewVersionId || !filtered.some(v => v.id === selectedPreviewVersionId)) {
    selectedPreviewVersionId = filtered[0].id;
  }

  const currentJSON = JSON.stringify(state);
  container.innerHTML = "";

  filtered.forEach(ver => {
    const isCurrent = ver.stateJSON === currentJSON;
    const isSelected = ver.id === selectedPreviewVersionId;

    const card = document.createElement("div");
    card.className = `version-card ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`;
    card.onclick = () => {
      selectedPreviewVersionId = ver.id;
      renderVersionHistoryList();
    };

    const companyTags = (ver.companies || []).slice(0, 3).map(c => `<span class="version-meta-pill">${escapeHTML(c)}</span>`).join("");
    const moreCompanies = (ver.companies && ver.companies.length > 3) ? `<span class="version-meta-pill">+${ver.companies.length - 3}</span>` : "";

    const profObj = resumeProfiles.find(p => p.id === ver.profileId);
    const profBadgeName = profObj ? profObj.name : (ver.profileName || getCurrentProfileName());

    card.innerHTML = `
      <div class="version-card-top">
        <div class="version-card-name-group">
          <button class="version-star-btn ${ver.isPinned ? 'starred' : ''}" title="${ver.isPinned ? 'Starred & Protected' : 'Star & Protect revision'}" onclick="togglePinVersion(${ver.id}, event)">
            ${ver.isPinned ? '★' : '☆'}
          </button>
          <span class="version-card-label" title="${escapeHTML(ver.label)}">${escapeHTML(ver.label)}</span>
        </div>
        <span class="version-card-badge ${isCurrent ? 'current' : (ver.isManual ? 'manual' : 'auto')}">
          ${isCurrent ? 'Active Now' : (ver.isManual ? 'Manual' : 'Auto')}
        </span>
      </div>

      <div class="version-card-role" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <span class="version-meta-pill" style="font-weight: 700; color: #0b7a75; background: #f0fdfa; border: 1px solid #ccfbf1;">${escapeHTML(profBadgeName)}</span>
        <span>${escapeHTML(ver.roleTitle || 'Untitled')}</span>
        <span class="candidate-name">• ${escapeHTML(ver.candidateName || '')}</span>
      </div>

      <div class="version-card-meta">
        <span class="version-meta-pill" style="font-weight: 600;">💼 ${ver.jobCount || 0} Jobs</span>
        <span class="version-meta-pill" style="font-weight: 600;">⚡ ${ver.skillsCount || 0} Skills</span>
        ${companyTags}
        ${moreCompanies}
      </div>

      <div class="version-card-bottom">
        <span class="version-time-text">${ver.timestamp}</span>
        <div class="version-card-actions">
          <button class="version-btn-sm" title="Preview contents" onclick="event.stopPropagation(); selectedPreviewVersionId = ${ver.id}; renderVersionHistoryList();">👁️ Peek</button>
          <button class="version-btn-sm restore-action" title="Restore this revision" onclick="event.stopPropagation(); restoreVersion(${ver.id}, true)">↺ Restore</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  const selectedVer = versionHistory.find(v => v.id === selectedPreviewVersionId);
  renderInspectionPanel(selectedVer);
}

function renderInspectionPanel(ver) {
  const inspectPane = document.getElementById("history-preview-content");
  if (!inspectPane) return;

  if (!ver) {
    inspectPane.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 40px 20px;">Select any revision from the list to preview its contents and diffs here.</div>`;
    return;
  }

  let snapshotData = null;
  try {
    snapshotData = JSON.parse(ver.stateJSON);
  } catch(e) {
    inspectPane.innerHTML = `<div style="color: #ef4444; padding: 20px;">Could not parse snapshot data.</div>`;
    return;
  }

  const currentJSON = JSON.stringify(state);
  const isCurrent = ver.stateJSON === currentJSON;

  // Compute Diffs
  const diffs = [];
  if (isCurrent) {
    diffs.push(`<span class="diff-tag diff-tag-green">✓ Matches Current Editor Exactly</span>`);
  } else {
    // Title diff
    const curTitle = state.header?.professionalTitle || "";
    const snapTitle = snapshotData.header?.professionalTitle || "";
    if (curTitle !== snapTitle) {
      diffs.push(`<span class="diff-tag diff-tag-amber">Role: "${escapeHTML(snapTitle)}" vs active "${escapeHTML(curTitle)}"</span>`);
    }

    // Job count diff
    const curJobs = (state.experience || []).length;
    const snapJobs = (snapshotData.experience || []).length;
    if (curJobs !== snapJobs) {
      diffs.push(`<span class="diff-tag diff-tag-amber">Experience: ${snapJobs} jobs (active has ${curJobs})</span>`);
    }

    // Skills count diff
    const curSkills = (state.skills || []).reduce((acc, c) => acc + (c.items ? c.items.length : 0), 0);
    const snapSkills = (snapshotData.skills || []).reduce((acc, c) => acc + (c.items ? c.items.length : 0), 0);
    if (curSkills !== snapSkills) {
      diffs.push(`<span class="diff-tag diff-tag-amber">Skills: ${snapSkills} skills (active has ${curSkills})</span>`);
    }

    if (diffs.length === 0) {
      diffs.push(`<span class="diff-tag diff-tag-amber">Minor content or formatting adjustments</span>`);
    }
  }

  // Build Experience Preview List
  let expHTML = "";
  if (snapshotData.experience && snapshotData.experience.length > 0) {
    expHTML = snapshotData.experience.map(exp => `
      <div class="preview-exp-row">
        <div style="font-weight: 700; font-size: 0.8rem; color: #1e293b;">${escapeHTML(exp.title || 'Job Title')} <span style="font-weight: 400; color: #64748b;">at ${escapeHTML(exp.company || 'Company')}</span></div>
        <div style="font-size: 0.72rem; color: #94a3b8; margin-bottom: 3px;">${escapeHTML(exp.dateRange || '')} ${exp.location ? '• ' + escapeHTML(exp.location) : ''}</div>
        ${exp.description ? `<div style="font-size: 0.76rem; color: #475569; margin-bottom: 4px; font-style: italic;">${escapeHTML(exp.description)}</div>` : ''}
        ${exp.bullets && exp.bullets.length ? `<ul style="margin: 0; padding-left: 16px; font-size: 0.74rem; color: #334155;">${exp.bullets.slice(0, 3).map(b => `<li>${escapeHTML(b)}</li>`).join('')}${exp.bullets.length > 3 ? `<li style="color: #94a3b8;">+ ${exp.bullets.length - 3} more bullets</li>` : ''}</ul>` : ''}
      </div>
    `).join("");
  } else {
    expHTML = `<div style="color: #94a3b8; font-size: 0.75rem;">No experience entries.</div>`;
  }

  // Build Skills Preview
  let skillsHTML = "";
  if (snapshotData.skills && snapshotData.skills.length > 0) {
    const allSkills = [];
    snapshotData.skills.forEach(col => {
      if (col.items) allSkills.push(...col.items);
    });
    skillsHTML = allSkills.slice(0, 12).map(s => `<span class="version-meta-pill" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">${escapeHTML(s)}</span>`).join(" ");
    if (allSkills.length > 12) skillsHTML += ` <span class="version-meta-pill">+${allSkills.length - 12} more</span>`;
  } else {
    skillsHTML = `<span style="color: #94a3b8; font-size: 0.75rem;">No skills listed.</span>`;
  }

  inspectPane.innerHTML = `
    <div class="history-preview-card">
      <div class="preview-hero">
        <div class="preview-hero-title-row">
          <div style="display: flex; align-items: center; gap: 6px;">
            <button class="version-star-btn ${ver.isPinned ? 'starred' : ''}" title="Star revision" onclick="togglePinVersion(${ver.id}, event)">
              ${ver.isPinned ? '★' : '☆'}
            </button>
            <strong style="font-size: 0.95rem; color: #1e293b;">${escapeHTML(ver.label)}</strong>
            <button class="btn btn-sm btn-outline" style="padding: 1px 5px; font-size: 0.7rem;" title="Rename revision" onclick="renameVersionPrompt(${ver.id}, event)">✏️</button>
          </div>
          <span class="version-card-badge ${isCurrent ? 'current' : (ver.isManual ? 'manual' : 'auto')}">
            ${isCurrent ? 'Active Canvas' : (ver.isManual ? 'Manual Save' : 'Auto-Save')}
          </span>
        </div>
        <div style="font-size: 0.74rem; color: #64748b;">Saved: <strong>${ver.timestamp}</strong> ${ver.profileName ? `• Profile: <strong>${escapeHTML(ver.profileName)}</strong>` : ''}</div>
      </div>

      <div class="diff-box">
        <span class="diff-box-title">Differences vs Current Working Copy:</span>
        <div class="diff-tags-row">${diffs.join("")}</div>
      </div>

      <div class="preview-section-card">
        <div class="preview-section-title">Header & Objective</div>
        <div style="font-weight: 700; font-size: 0.88rem; color: #0f172a;">${escapeHTML(snapshotData.header?.fullName || 'Full Name')}</div>
        <div style="font-size: 0.8rem; color: #0b7a75; font-weight: 600; margin-bottom: 4px;">${escapeHTML(snapshotData.header?.professionalTitle || 'Role Title')}</div>
        <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 6px;">${escapeHTML(snapshotData.header?.email || '')} • ${escapeHTML(snapshotData.header?.phone || '')} • ${escapeHTML(snapshotData.header?.address || '')}</div>
        ${snapshotData.summary ? `<div style="font-size: 0.75rem; color: #334155; line-height: 1.4; background: #f8fafc; padding: 6px 8px; border-radius: 4px; border-left: 2px solid #0b7a75;">${escapeHTML(snapshotData.summary)}</div>` : ''}
      </div>

      <div class="preview-section-card">
        <div class="preview-section-title">Work Experience (${snapshotData.experience?.length || 0})</div>
        ${expHTML}
      </div>

      <div class="preview-section-card">
        <div class="preview-section-title">Skills Overview</div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;">${skillsHTML}</div>
      </div>

      <div class="preview-actions-bar">
        <button class="btn btn-primary" style="flex: 1; font-size: 0.82rem;" onclick="restoreVersion(${ver.id}, true)">
          ↺ Restore into Active Editor
        </button>
        <button class="btn btn-outline" style="flex: 1; font-size: 0.82rem; border-color: #0b7a75; color: #0b7a75;" onclick="branchVersionAsProfile(${ver.id})">
          ⎇ Branch as New Profile...
        </button>
      </div>
    </div>
  `;
}

window.restoreVersion = async function(id, askConfirm = true) {
  const target = versionHistory.find(v => v.id === id);
  if (!target) return;

  let confirmed = true;
  if (askConfirm) {
    confirmed = await appConfirm({
      title: "Restore Revision Snapshot",
      message: `Restore canvas to "${target.label}" (${target.timestamp})?\n\nA safety backup checkpoint of your current canvas will be created automatically so you won't lose your work.`,
      confirmText: "Restore Snapshot"
    });
  }

  if (confirmed) {
    flushTypingTransaction();

    // 1. Take safety snapshot of what was on screen BEFORE restoring
    recordVersionSnapshot("Pre-Restore Safety Backup", true, true);

    // 2. Load target snapshot
    state = JSON.parse(target.stateJSON);
    
    saveState(true);
    populateFormFields();
    applySettings();
    renderCanvas();
    updateVersionDropdown();

    closeModal("modal-history");
    showToast(`✓ Restored to revision: "${target.label}" (${target.timestamp})`);
  } else {
    updateVersionDropdown();
  }
};

window.branchVersionAsProfile = async function(id) {
  const ver = versionHistory.find(v => v.id === id);
  if (!ver) return;

  const defaultName = `${ver.roleTitle || ver.label} (Branched)`;
  const profileName = await appPrompt({
    title: "Branch Snapshot as New Variant",
    message: "Enter a name for this new branched resume variant:",
    defaultValue: defaultName,
    placeholder: "e.g. Senior Designer (Branched)",
    confirmText: "Branch Variant"
  });
  if (!profileName || !profileName.trim()) return;

  flushTypingTransaction();
  updateActiveProfileData();

  const branchedData = JSON.parse(ver.stateJSON);
  const newProfile = {
    id: "profile-" + Date.now(),
    name: profileName.trim(),
    updatedAt: formatTimeLabel(new Date()),
    data: branchedData
  };

  resumeProfiles.push(newProfile);
  saveProfilesToStorage();
  closeModal("modal-history");
  switchProfile(newProfile.id);
  recordVersionSnapshot(`Branched from revision: ${ver.label}`, true, true);
  showToast(`✓ Created and branched into new profile: "${newProfile.name}"`);
};

window.saveManualState = function() {
  flushTypingTransaction();
  saveState(true);
  recordVersionSnapshot("Manual Save (Ctrl+S)", true);
  showToast("✓ Resume saved successfully! (Ctrl+S)");
  renderVersionHistoryList();
  updateVersionDropdown();
};

// UNDO / REDO HISTORY STACK (BLOCK TRANSACTION SYSTEM)
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 50;
let isUndoRedoAction = false;
let lastRecordedStateJSON = "";
let typingDebounceTimer = null;
let isTypingTransaction = false;

// Record a block change:
// - Structural actions (add/delete job, move section, merge, theme) -> committed immediately as atomic snapshot
// - Text typing -> batched into a single cohesive typing block (debounced 500ms or on blur/enter)
function recordStateChange(isStructural = false) {
  if (isUndoRedoAction) return;

  if (isStructural) {
    if (typingDebounceTimer) {
      clearTimeout(typingDebounceTimer);
      typingDebounceTimer = null;
    }
    commitSnapshot();
    isTypingTransaction = false;
    return;
  }

  // Start of a text typing block
  if (!isTypingTransaction) {
    isTypingTransaction = true;
  }

  // Debounce typing so whole words/sentences are grouped into 1 undo block
  if (typingDebounceTimer) clearTimeout(typingDebounceTimer);
  typingDebounceTimer = setTimeout(() => {
    commitSnapshot();
    isTypingTransaction = false;
  }, 500);
}

function commitSnapshot() {
  const currentJSON = JSON.stringify(state);
  if (currentJSON === lastRecordedStateJSON) return;

  if (lastRecordedStateJSON) {
    undoStack.push(lastRecordedStateJSON);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0; // Clear redo on new action
  }
  lastRecordedStateJSON = currentJSON;
  updateUndoRedoButtons();
}

function flushTypingTransaction() {
  if (typingDebounceTimer) {
    clearTimeout(typingDebounceTimer);
    typingDebounceTimer = null;
  }
  if (isTypingTransaction) {
    commitSnapshot();
    isTypingTransaction = false;
  }
}

function undo() {
  flushTypingTransaction();

  if (undoStack.length === 0) {
    showToast("Nothing to undo.");
    return;
  }
  isUndoRedoAction = true;
  const previousStateJSON = undoStack.pop();
  redoStack.push(JSON.stringify(state));

  state = JSON.parse(previousStateJSON);
  lastRecordedStateJSON = previousStateJSON;

  populateFormFields();
  applySettings();
  renderCanvas();
  localStorage.setItem("antigravity_resume_data", previousStateJSON);
  isUndoRedoAction = false;
  updateUndoRedoButtons();
  showToast("↶ Undo (Reverted last block change)");
}

function redo() {
  flushTypingTransaction();

  if (redoStack.length === 0) {
    showToast("Nothing to redo.");
    return;
  }
  isUndoRedoAction = true;
  const nextStateJSON = redoStack.pop();
  undoStack.push(JSON.stringify(state));

  state = JSON.parse(nextStateJSON);
  lastRecordedStateJSON = nextStateJSON;

  populateFormFields();
  applySettings();
  renderCanvas();
  localStorage.setItem("antigravity_resume_data", nextStateJSON);
  isUndoRedoAction = false;
  updateUndoRedoButtons();
  showToast("↷ Redo (Restored block change)");
}

function updateUndoRedoButtons() {
  const btnUndo = document.getElementById("btn-undo");
  const btnRedo = document.getElementById("btn-redo");
  if (btnUndo) {
    btnUndo.disabled = undoStack.length === 0;
    btnUndo.style.opacity = undoStack.length === 0 ? "0.45" : "1";
    btnUndo.style.cursor = undoStack.length === 0 ? "not-allowed" : "pointer";
  }
  if (btnRedo) {
    btnRedo.disabled = redoStack.length === 0;
    btnRedo.style.opacity = redoStack.length === 0 ? "0.45" : "1";
    btnRedo.style.cursor = redoStack.length === 0 ? "not-allowed" : "pointer";
  }
}

function saveState(isStructural = false) {
  recordStateChange(isStructural);
  updateActiveProfileData();
  localStorage.setItem("antigravity_resume_data", JSON.stringify(state));
}

// Toast notification helper
function showToast(msg) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "toast-msg";
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span>⚡</span> ${msg}`;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function initTabSystem() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      const target = document.getElementById(`panel-${tab.dataset.tab}`);
      if (target) target.classList.add("active");
    });
  });
}

function populateFormFields() {
  document.getElementById("input-fullName").value = state.header.fullName || "";
  document.getElementById("input-proTitle").value = state.header.professionalTitle || "";
  document.getElementById("input-phone").value = state.header.phone || "";
  document.getElementById("input-email").value = state.header.email || "";
  document.getElementById("input-address").value = state.header.address || "";
  document.getElementById("input-linkedin").value = state.header.linkedin || "";
  document.getElementById("input-website").value = state.header.website || "";

  document.getElementById("input-summary").value = state.summary || "";

  renderSkillsForm();
  renderExperienceForm();
  renderEducationForm();
  renderCertificationsForm();
  renderAchievementsForm();
  renderAddSectionButtons();
}

function renderAddSectionButtons() {
  const container = document.getElementById("add-sections-container");
  if (!container) return;
  container.innerHTML = "";

  const allSections = {
    summary: "Professional Summary",
    skills: "Core Skills",
    experience: "Professional Experience",
    education: "Education",
    certifications: "Certifications",
    achievements: "Languages & Achievements"
  };

  let html = `
    <div class="form-section">
      <div class="form-section-title">Section Order & Layout</div>
      <div style="font-size: 0.78rem; color: #64748b; margin-bottom: 10px;">Reorder sections across pages:</div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
  `;

  state.settings.sectionOrder.forEach((k, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === state.settings.sectionOrder.length - 1;
    html += `
      <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
        <span style="font-size: 0.82rem; font-weight: 600; color: #334155;">${allSections[k] || k.toUpperCase()}</span>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-sm btn-outline" ${isFirst ? 'disabled style="opacity: 0.4;"' : ''} onclick="moveSection('${k}', -1)">↑</button>
          <button class="btn btn-sm btn-outline" ${isLast ? 'disabled style="opacity: 0.4;"' : ''} onclick="moveSection('${k}', 1)">↓</button>
          <button class="btn btn-sm btn-outline" style="color: #ef4444;" onclick="deleteSection('${k}')">✕</button>
        </div>
      </div>
    `;
  });

  html += `</div></div>`;

  const missing = Object.keys(allSections).filter(k => !state.settings.sectionOrder.includes(k));
  if (missing.length > 0) {
    html += `<div style="font-size: 0.8rem; font-weight: 600; margin-bottom: 8px; color: #475569;">Restore Deleted Sections:</div><div style="display: flex; flex-wrap: wrap; gap: 6px;">`;
    missing.forEach(k => {
      html += `<button class="btn btn-sm btn-outline" onclick="restoreSection('${k}')">+ ${allSections[k]}</button>`;
    });
    html += `</div>`;
  }
  container.innerHTML = html;
}

window.restoreSection = function(secKey) {
  if (!state.settings.sectionOrder.includes(secKey)) {
    state.settings.sectionOrder.push(secKey);
    renderCanvas();
    populateFormFields();
    saveState();
    showToast(`Restored ${secKey.toUpperCase()} section!`);
  }
};

window.deleteSection = async function(secKey) {
  const confirmed = await appConfirm({
    title: "Remove Section",
    message: `Remove the ${secKey.toUpperCase()} section? The sections below will automatically shift up to take its place.`,
    confirmText: "Remove Section",
    isDanger: true
  });
  if (confirmed) {
    const idx = state.settings.sectionOrder.indexOf(secKey);
    if (idx !== -1) {
      state.settings.sectionOrder.splice(idx, 1);
      delete state.sectionPaddings[secKey];
      renderCanvas();
      populateFormFields();
      saveState();
      showToast(`Deleted section. Content shifted up seamlessly!`);
    }
  }
};

function renderSkillsForm() {
  const container = document.getElementById("skills-form-container");
  if (!container) return;
  container.innerHTML = "";

  state.skills.forEach((colObj, colIdx) => {
    const colDiv = document.createElement("div");
    colDiv.className = "form-group";
    colDiv.innerHTML = `
      <label>Skills Column ${colIdx + 1}</label>
      <textarea class="form-control" data-skill-col="${colIdx}">${colObj.items.join("\n")}</textarea>
      <span style="font-size: 0.72rem; color: #64748b;">One skill per line</span>
    `;
    container.appendChild(colDiv);
  });
}

function renderExperienceForm() {
  const container = document.getElementById("exp-form-container");
  if (!container) return;
  container.innerHTML = "";

  state.experience.forEach((exp, idx) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-title">${exp.title || "Job Position"}</span>
        <div class="item-card-actions">
          <button class="btn btn-sm btn-outline" onclick="moveExp(${idx}, -1)">↑</button>
          <button class="btn btn-sm btn-outline" onclick="moveExp(${idx}, 1)">↓</button>
          <button class="btn btn-sm btn-outline" style="color: #ef4444;" onclick="deleteExp(${idx})">✕</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Job Title</label>
          <input type="text" class="form-control" value="${exp.title}" oninput="updateExp(${idx}, 'title', this.value)">
        </div>
        <div class="form-group">
          <label>Company</label>
          <input type="text" class="form-control" value="${exp.company}" oninput="updateExp(${idx}, 'company', this.value)">
        </div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Location</label>
          <input type="text" class="form-control" value="${exp.location}" oninput="updateExp(${idx}, 'location', this.value)">
        </div>
        <div class="form-group">
          <label>Date Range</label>
          <input type="text" class="form-control" value="${exp.dateRange}" oninput="updateExp(${idx}, 'dateRange', this.value)">
        </div>
      </div>
      <div class="form-group">
        <label>Role Overview / Brief Description <span style="font-size: 0.72rem; color: #94a3b8; font-weight: normal;">(Optional)</span></label>
        <textarea class="form-control" rows="2" style="font-size: 0.8rem; resize: vertical;" oninput="updateExp(${idx}, 'description', this.value)" placeholder="e.g. Lead product design and clinician workflow optimization across enterprise health platforms...">${exp.description || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Bullet Highlights</label>
        <textarea class="form-control" oninput="updateExpBullets(${idx}, this.value)">${exp.bullets.join("\n")}</textarea>
        <span style="font-size: 0.72rem; color: #64748b;">One bullet point per line</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderEducationForm() {
  const container = document.getElementById("edu-form-container");
  if (!container) return;
  container.innerHTML = "";

  state.education.forEach((edu, idx) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-card-header">
        <span class="item-card-title">${edu.degree || "Degree"}</span>
        <button class="btn btn-sm btn-outline" style="color: #ef4444;" onclick="deleteEdu(${idx})">✕</button>
      </div>
      <div class="form-group">
        <label>Degree / Qualification</label>
        <input type="text" class="form-control" value="${edu.degree}" oninput="updateEdu(${idx}, 'degree', this.value)">
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Institution / University</label>
          <input type="text" class="form-control" value="${edu.institution}" oninput="updateEdu(${idx}, 'institution', this.value)">
        </div>
        <div class="form-group">
          <label>Graduation Date</label>
          <input type="text" class="form-control" value="${edu.dateRange}" oninput="updateEdu(${idx}, 'dateRange', this.value)">
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderCertificationsForm() {
  const container = document.getElementById("cert-form-container");
  if (!container) return;
  container.innerHTML = "";

  state.certifications.forEach((cert, idx) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.style.padding = "8px 12px";
    card.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="text" class="form-control" value="${cert.name}" oninput="updateCert(${idx}, this.value)">
        <button class="btn btn-sm btn-outline" style="color: #ef4444;" onclick="deleteCert(${idx})">✕</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderAchievementsForm() {
  const container = document.getElementById("ach-form-container");
  if (!container) return;
  container.innerHTML = "";

  state.achievements.forEach((ach, idx) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.style.padding = "8px 12px";
    card.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="text" class="form-control" value="${ach.text}" oninput="updateAch(${idx}, this.value)">
        <button class="btn btn-sm btn-outline" style="color: #ef4444;" onclick="deleteAch(${idx})">✕</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// Generate Section HTML snippet
function generateSectionHTML(secKey) {
  const s = state.settings;
  const titleText = s.sectionTitles[secKey] || secKey.toUpperCase();
  const customSecPadding = state.sectionPaddings ? (state.sectionPaddings[secKey] || 0) : 0;
  const secStyleAttr = customSecPadding > 0 ? `style="padding-bottom: ${customSecPadding}px;"` : '';

  let secContent = "";

  if (secKey === "summary" && state.summary) {
    secContent = `<div class="res-summary-text" contenteditable="true" data-field="summary">${state.summary}</div>`;
  } 
  else if (secKey === "skills" && state.skills.length) {
    const colsHTML = state.skills.map((colObj, cIdx) => {
      const lis = colObj.items.map((item, iIdx) => `<li contenteditable="true" data-field="skills.${cIdx}.${iIdx}">${item}</li>`).join("");
      return `<ul class="res-skills-col">${lis}</ul>`;
    }).join("");
    secContent = `<div class="res-skills-grid">${colsHTML}</div>`;
  }
  else if (secKey === "experience" && state.experience.length) {
    const entriesHTML = state.experience.map((exp, expIdx) => {
      const bullets = exp.bullets.map((b, bIdx) => `
        <li contenteditable="true" data-field="exp.${expIdx}.${bIdx}">${b}</li>
      `).join("");

      const entryId = exp.id || `exp-${expIdx}`;
      const customHeight = state.entryHeights ? (state.entryHeights[entryId] || 0) : 0;
      const entryStyleAttr = customHeight > 0 ? `style="min-height: ${customHeight}px; padding-bottom: ${customHeight/2}px;"` : '';

      return `
        <div class="res-entry" data-entry-id="${entryId}" data-exp-idx="${expIdx}" ${entryStyleAttr}>
          <div class="res-entry-controls">
            <button class="entry-btn" title="Move Up" onclick="moveExp(${expIdx}, -1)">↑</button>
            <button class="entry-btn" title="Move Down" onclick="moveExp(${expIdx}, 1)">↓</button>
            <button class="entry-btn entry-btn-del" title="Delete Job" onclick="deleteExp(${expIdx})">✕</button>
          </div>
          <div class="res-entry-head">
            <span class="res-entry-role" contenteditable="true" data-field="exp.${expIdx}.title">${exp.title}</span>
            <span class="res-entry-date" contenteditable="true" data-field="exp.${expIdx}.dateRange">${exp.dateRange}</span>
          </div>
          <div class="res-entry-sub">
            <span class="company-name" contenteditable="true" data-field="exp.${expIdx}.company">${exp.company}</span> 
            <span class="res-pipe">|</span> 
            <span class="company-location" contenteditable="true" data-field="exp.${expIdx}.location">${exp.location}</span>
          </div>
          <div class="res-entry-desc" contenteditable="true" data-field="exp.${expIdx}.description" data-placeholder="Brief job description / role overview (optional)...">${exp.description || ''}</div>
          <ul class="res-bullets">${bullets}</ul>
          <button class="canvas-add-bullet-btn" onclick="addBulletToExp(${expIdx})" title="Add bullet point">+ Add Bullet</button>

          <!-- Pull & Drag Handle to Extend or Merge Container -->
          <div class="res-drag-handle" data-target-type="entry" data-target-id="${entryId}" data-exp-idx="${expIdx}" title="Drag down to pull & extend container length, or drag into next entry to merge them!">
            <div class="res-drag-handle-bar"></div>
            <div class="res-drag-handle-tooltip">Pull down to extend length / merge</div>
          </div>
        </div>
      `;
    }).join("");

    secContent = `
      ${entriesHTML}
      <button class="canvas-add-section-btn" onclick="addExp()" title="Add Standard Job Position">+ Add Standard Job Position</button>
    `;
  }
  else if (secKey === "education" && state.education.length) {
    secContent = state.education.map((edu, eduIdx) => `
      <div class="res-entry" data-edu-idx="${eduIdx}">
        <div class="res-entry-head">
          <span class="res-entry-role" contenteditable="true" data-field="edu.${eduIdx}.degree">${edu.degree}</span>
          <span class="res-entry-date" contenteditable="true" data-field="edu.${eduIdx}.dateRange">${edu.dateRange}</span>
        </div>
        <div class="res-entry-sub">
          <span class="company-name" contenteditable="true" data-field="edu.${eduIdx}.institution">${edu.institution}</span>
        </div>
      </div>
    `).join("");
  }
  else if (secKey === "certifications" && state.certifications.length) {
    const lis = state.certifications.map((c, cIdx) => `<li contenteditable="true" data-field="cert.${cIdx}">${c.name}</li>`).join("");
    secContent = `<ul class="res-simple-list">${lis}</ul>`;
  }
  else if (secKey === "achievements" && state.achievements.length) {
    const lis = state.achievements.map((a, aIdx) => `<li contenteditable="true" data-field="ach.${aIdx}">${a.text}</li>`).join("");
    secContent = `<ul class="res-simple-list">${lis}</ul>`;
  }

  if (secContent) {
    return `
      <div class="res-section" data-section="${secKey}" ${secStyleAttr}>
        <div class="res-section-controls">
          <button class="sec-btn" title="Move Up" onclick="moveSection('${secKey}', -1)">↑</button>
          <button class="sec-btn" title="Move Down" onclick="moveSection('${secKey}', 1)">↓</button>
          <button class="sec-btn sec-btn-del" title="Delete Section (shifts content up)" onclick="deleteSection('${secKey}')">✕</button>
        </div>
        <div class="res-section-header">
          <div class="res-section-title" contenteditable="true" data-field="sectionTitle.${secKey}">${titleText}</div>
          <hr class="res-divider-line" />
        </div>
        ${secContent}

        <!-- Drag Handle to Extend Section Spacing -->
        <div class="res-drag-handle" data-target-type="section" data-target-id="${secKey}" title="Drag down to pull & extend section height into next section">
          <div class="res-drag-handle-bar"></div>
          <div class="res-drag-handle-tooltip">Pull down to extend section length</div>
        </div>
      </div>
    `;
  }
  return "";
}

// RENDER THE RESUME CANVAS (DYNAMIC MULTI-PAGE FLOW)
function renderCanvas() {
  const container = document.getElementById("resume-pages-container");
  if (!container) return;

  const h = state.header;
  const contactParts = [];
  if (h.phone) contactParts.push(`<span>${h.phone}</span>`);
  if (h.email) contactParts.push(`<span>${h.email}</span>`);
  if (h.address) contactParts.push(`<span>${h.address}</span>`);
  if (h.linkedin) contactParts.push(`<span>${h.linkedin}</span>`);
  if (h.website) contactParts.push(`<span>${h.website}</span>`);

  const contactHTML = contactParts.map((item, index) => {
    return `<span class="res-contact-item">${item}</span>` + (index < contactParts.length - 1 ? ` <span class="res-pipe">|</span> ` : '');
  }).join("");

  const headerHTML = `
    <div class="res-header">
      <div class="res-name" contenteditable="true" data-field="header.fullName">${h.fullName}</div>
      <div class="res-title" contenteditable="true" data-field="header.professionalTitle">${h.professionalTitle}</div>
      <div class="res-contact-bar">${contactHTML}</div>
      <hr class="res-divider-line" />
    </div>
  `;

  // First render everything into Page 1 to measure natural layout
  container.innerHTML = `
    <div class="resume-paper-page" data-page="1" id="page-1">
      ${headerHTML}
      <div id="page-1-content">
        ${state.settings.sectionOrder.map(k => generateSectionHTML(k)).join("")}
      </div>
      <div class="page-footer-tag" id="page-1-tag">Page 1</div>
    </div>
  `;

  // Strictly reset scroll positions on all sheets so header is never pushed out of bounds
  document.querySelectorAll('.resume-paper-page').forEach(p => {
    p.scrollTop = 0;
    p.scrollLeft = 0;
  });

  bindCanvasEvents();

  if (distributePagesTimer) clearTimeout(distributePagesTimer);
  distributePagesTimer = setTimeout(distributePages, 80);
}

let distributePagesTimer = null;

// Distribute overflowing content onto Page 2 cleanly with seamless re-snap
function distributePages() {
  if (distributePagesTimer) {
    clearTimeout(distributePagesTimer);
    distributePagesTimer = null;
  }
  const container = document.getElementById("resume-pages-container");
  const badge = document.getElementById("page-count-badge");
  const page1 = document.getElementById("page-1");
  const page1Content = document.getElementById("page-1-content");
  if (!page1 || !page1Content) return;

  // 1. Seamless Pull-Back: Re-integrate any Page 2 content back into Page 1 before measuring
  const existingPage2 = document.getElementById("page-2");
  if (existingPage2) {
    const p2Content = document.getElementById("page-2-content");
    if (p2Content) {
      // Pull continued experience entries back into Page 1 experience section
      const contExpSec = p2Content.querySelector('[data-section="experience-cont"]');
      if (contExpSec) {
        const p1ExpSec = page1Content.querySelector('[data-section="experience"]');
        if (p1ExpSec) {
          const addSectionBtn = contExpSec.querySelector(".canvas-add-section-btn") || p2Content.querySelector(".canvas-add-section-btn");
          const addBulletBtn = p1ExpSec.querySelector(".canvas-add-bullet-btn");
          const entries = Array.from(contExpSec.querySelectorAll(".res-entry"));
          entries.forEach(entry => {
            if (addBulletBtn) {
              p1ExpSec.insertBefore(entry, addBulletBtn);
            } else {
              p1ExpSec.appendChild(entry);
            }
          });
          if (addSectionBtn) {
            p1ExpSec.appendChild(addSectionBtn);
          }
        }
        contExpSec.remove();
      }

      // Pull remaining sections back into Page 1 in correct order
      const remainingSections = Array.from(p2Content.children);
      remainingSections.forEach(sec => {
        if (sec.classList && sec.classList.contains("res-section")) {
          page1Content.appendChild(sec);
        }
      });
    }
    existingPage2.remove();
  }

  // 2. Measure complete content with Symmetrical Top & Bottom Margins (38px top, 38px bottom)
  const PAGE_HEIGHT_PX = 1056; // Strict 11in at 96 DPI
  const marginY = 38;
  const TARGET_SPLIT_Y = PAGE_HEIGHT_PX - marginY - 6; // 1012px from top edge of paper

  const page1Top = page1.getBoundingClientRect().top;
  const sections = Array.from(page1Content.children);

  // Check if content exceeds usable area
  let needsSplit = false;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].getBoundingClientRect().bottom - page1Top > TARGET_SPLIT_Y) {
      needsSplit = true;
      break;
    }
  }

  if (needsSplit) {
    const overflowElements = [];
    let isOverflowing = false;

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      const secRect = sec.getBoundingClientRect();
      const relativeBottom = secRect.bottom - page1Top;

      if (isOverflowing) {
        overflowElements.push(sec);
      } else if (relativeBottom > TARGET_SPLIT_Y) {
        // If experience section, try splitting at entry level
        if (sec.dataset.section === "experience") {
          const entries = Array.from(sec.querySelectorAll(".res-entry"));
          let splitFound = false;

          entries.forEach((entry) => {
            const entryRect = entry.getBoundingClientRect();
            if (entryRect.bottom - page1Top > TARGET_SPLIT_Y || splitFound) {
              splitFound = true;
              overflowElements.push({ type: "entry", section: "experience", node: entry });
            }
          });

          if (!splitFound) {
            overflowElements.push(sec);
            isOverflowing = true;
          }
        } else {
          overflowElements.push(sec);
          isOverflowing = true;
        }
      }
    }

    if (overflowElements.length > 0) {
      const page2 = document.createElement("div");
      page2.className = "resume-paper-page";
      page2.id = "page-2";
      page2.dataset.page = "2";

      const page2Content = document.createElement("div");
      page2Content.id = "page-2-content";

      overflowElements.forEach(item => {
        if (item.type === "entry" && item.section === "experience") {
          let p2ExpSec = page2Content.querySelector('[data-section="experience-cont"]');
          if (!p2ExpSec) {
            p2ExpSec = document.createElement("div");
            p2ExpSec.className = "res-section";
            p2ExpSec.dataset.section = "experience-cont";
            page2Content.appendChild(p2ExpSec);
          }
          p2ExpSec.appendChild(item.node);
        } else if (item instanceof HTMLElement) {
          page2Content.appendChild(item);
        }
      });

      // Move "+ Add Standard Job Position" button to Page 2 if experience continues on Page 2
      const p2ExpSec = page2Content.querySelector('[data-section="experience-cont"]');
      if (p2ExpSec) {
        const p1AddBtn = page1Content.querySelector('[data-section="experience"] .canvas-add-section-btn');
        if (p1AddBtn) {
          p2ExpSec.appendChild(p1AddBtn);
        }
      }

      page2.appendChild(page2Content);
      const p2Tag = document.createElement("div");
      p2Tag.className = "page-footer-tag";
      p2Tag.textContent = "Page 2 of 2";
      page2.appendChild(p2Tag);
      container.appendChild(page2);

      document.getElementById("page-1-tag").textContent = "Page 1 of 2";

      if (badge) {
        badge.textContent = "📄 2 Pages (8.5 x 11 in)";
        badge.classList.add("multi-page");
      }

      // Strictly reset scroll positions on all sheets
      document.querySelectorAll('.resume-paper-page').forEach(p => {
        p.scrollTop = 0;
        p.scrollLeft = 0;
      });

      if (focusTargetField) {
        const el = document.querySelector(`[data-field="${focusTargetField}"]`);
        if (el) {
          el.focus({ preventScroll: true });
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(el);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        focusTargetField = null;
      }

      bindCanvasEvents();
      return;
    }
  }

  document.getElementById("page-1-tag").textContent = "Page 1 of 1";
  if (badge) {
    badge.textContent = "📄 1 Page (8.5 x 11 in)";
    badge.classList.remove("multi-page");
  }

  // Strictly reset scroll positions on all sheets
  document.querySelectorAll('.resume-paper-page').forEach(p => {
    p.scrollTop = 0;
    p.scrollLeft = 0;
  });

  if (focusTargetField) {
    const el = document.querySelector(`[data-field="${focusTargetField}"]`);
    if (el) {
      el.focus({ preventScroll: true });
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    focusTargetField = null;
  }

  bindCanvasEvents();
}

// Universal Plain-Text & Bullet/Symbol Sanitizer on Paste
function cleanPastedText(rawText, isSingleLine = false) {
  if (!rawText) return "";

  let text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ");

  const cleanLine = (line) => {
    return line
      .replace(/^[\s\t•·●○■▪▫◆◇⁃‣*–—\-➔➜→➤➢►▸✔✓☑★☆\u2022\u00B7\u25CF\u25CB\u25A0\u25AA\u25AB\u25C6\u25C7\u2043\u2023\u2794\u279C\u2192\u27A4\u27A2\u25BA\u25B8\u2714\u2713\u2611\u2605\u2606]+/, "")
      .replace(/^(?:->|=>|>|-->|==>|\d+[\.\)]\s*)/, "")
      .replace(/^[\s\t•·●○■▪▫◆◇⁃‣*–—\-➔➜→➤➢►▸✔✓☑★☆]+/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  if (isSingleLine) {
    return cleanLine(text.replace(/[\n\r]+/g, " "));
  }

  const lines = text.split("\n").map(cleanLine).filter(l => l.length > 0);
  return lines.join("\n");
}

// Bind Inline Editing on Canvas to State & Sidebar
function bindCanvasEvents() {
  const editables = document.querySelectorAll('.resume-paper-page [contenteditable="true"]');
  
  editables.forEach(el => {
    if (el._canvasBound) return;
    el._canvasBound = true;

    // Intercept Paste to Strip All Rich Formatting, Bullets, Dots, and Arrows
    el.addEventListener('paste', (e) => {
      e.preventDefault();
      const rawText = (e.clipboardData || window.clipboardData)?.getData('text/plain') || "";
      const field = el.dataset.field || "";

      // Multi-line paste into a Bullet Point -> create distinct bullets for each line!
      if (field.startsWith("exp.") && field.split(".").length === 3 && !isNaN(field.split(".")[2])) {
        const parts = field.split(".");
        const expIdx = parseInt(parts[1]);
        const bulletIdx = parseInt(parts[2]);
        const cleanLines = cleanPastedText(rawText, false).split("\n").filter(l => l.trim() !== "");

        if (cleanLines.length === 0) return;

        if (cleanLines.length === 1) {
          document.execCommand('insertText', false, cleanLines[0]);
          state.experience[expIdx].bullets[bulletIdx] = el.innerText.trim();
          renderExperienceForm();
          saveState();
          return;
        }

        // Multi-line paste: update current bullet and insert new ones
        state.experience[expIdx].bullets[bulletIdx] = cleanLines[0];
        for (let i = 1; i < cleanLines.length; i++) {
          state.experience[expIdx].bullets.splice(bulletIdx + i, 0, cleanLines[i]);
        }

        focusTargetField = `exp.${expIdx}.${bulletIdx + cleanLines.length - 1}`;
        renderCanvas();
        renderExperienceForm();
        saveState(true);
        return;
      }

      if (field === "summary") {
        const cleanText = cleanPastedText(rawText, false);
        document.execCommand('insertText', false, cleanText);
        state.summary = el.innerText.trim();
        const input = document.getElementById("input-summary");
        if (input) input.value = state.summary;
        saveState();
        return;
      }

      // Single-line field (Name, Title, Company, Location, Date, etc.)
      const cleanText = cleanPastedText(rawText, true);
      document.execCommand('insertText', false, cleanText);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    el.addEventListener('keydown', (e) => {
      const field = el.dataset.field;

      if (e.key === "Enter" && field && field.startsWith("exp.")) {
        const parts = field.split(".");
        if (parts.length === 3 && !isNaN(parts[2])) {
          e.preventDefault();
          const expIdx = parseInt(parts[1]);
          const bulletIdx = parseInt(parts[2]);
          
          state.experience[expIdx].bullets.splice(bulletIdx + 1, 0, "New bullet point...");
          focusTargetField = `exp.${expIdx}.${bulletIdx + 1}`;
          
          renderCanvas();
          renderExperienceForm();
          saveState();
        }
      }
      else if (e.key === "Backspace" && el.innerText.trim() === "" && field && field.startsWith("exp.")) {
        const parts = field.split(".");
        if (parts.length === 3 && !isNaN(parts[2])) {
          const expIdx = parseInt(parts[1]);
          const bulletIdx = parseInt(parts[2]);

          if (state.experience[expIdx].bullets.length > 1) {
            e.preventDefault();
            const parentLi = el.closest('li');
            if (parentLi) {
              parentLi.classList.add('res-bullet-removing');
            }

            setTimeout(() => {
              state.experience[expIdx].bullets.splice(bulletIdx, 1);
              const prevIdx = Math.max(0, bulletIdx - 1);
              focusTargetField = `exp.${expIdx}.${prevIdx}`;

              renderCanvas();
              renderExperienceForm();
              saveState();
            }, 140);
          }
        }
      }
    });

    el.addEventListener('blur', (e) => {
      const field = e.target.dataset.field;
      const text = e.target.innerText.trim();

      if (!field) return;

      if (field.startsWith("header.")) {
        const key = field.split(".")[1];
        state.header[key] = text;
        const input = document.getElementById(`input-${key}`);
        if (input) input.value = text;
      }
      else if (field === "summary") {
        state.summary = text;
        const input = document.getElementById("input-summary");
        if (input) input.value = text;
      }
      else if (field.startsWith("skills.")) {
        const [, colIdx, itemIdx] = field.split(".");
        state.skills[colIdx].items[itemIdx] = text;
        renderSkillsForm();
      }
      else if (field.startsWith("exp.")) {
        const parts = field.split(".");
        const expIdx = parseInt(parts[1]);
        const key = parts[2];
        if (key === "title" || key === "company" || key === "location" || key === "dateRange" || key === "description") {
          state.experience[expIdx][key] = text;
        } else {
          const bulletIdx = parseInt(key);
          if (state.experience[expIdx].bullets[bulletIdx] !== undefined) {
            state.experience[expIdx].bullets[bulletIdx] = text;
          }
        }
        renderExperienceForm();
      }
      else if (field.startsWith("edu.")) {
        const [, eduIdx, key] = field.split(".");
        state.education[eduIdx][key] = text;
        renderEducationForm();
      }
      else if (field.startsWith("cert.")) {
        const [, certIdx] = field.split(".");
        state.certifications[certIdx].name = text;
        renderCertificationsForm();
      }
      else if (field.startsWith("ach.")) {
        const [, achIdx] = field.split(".");
        state.achievements[achIdx].text = text;
        renderAchievementsForm();
      }
      else if (field.startsWith("sectionTitle.")) {
        const [, secKey] = field.split(".");
        state.settings.sectionTitles[secKey] = text;
      }

      saveState();
      setTimeout(distributePages, 50);
    });
  });
}

// PULL & DRAG CONTAINER RESIZING AND SMART MERGING LOGIC
function initDragResizeHandlers() {
  let isDragging = false;
  let startY = 0;
  let startHeight = 0;
  let activeElement = null;
  let activeType = "";
  let activeId = "";
  let activeExpIdx = -1;
  let nextEntryOriginalTop = null;
  let potentialMergeTarget = null;
  let mergeBadge = null;

  document.addEventListener("mousedown", (e) => {
    const handle = e.target.closest(".res-drag-handle");
    if (!handle) return;

    isDragging = true;
    startY = e.clientY;
    activeType = handle.dataset.targetType;
    activeId = handle.dataset.targetId;
    activeExpIdx = handle.dataset.expIdx ? parseInt(handle.dataset.expIdx) : -1;

    if (activeType === "entry") {
      activeElement = document.querySelector(`[data-entry-id="${activeId}"]`);
      startHeight = activeElement ? activeElement.offsetHeight : 50;
      
      if (activeExpIdx !== -1 && activeExpIdx < state.experience.length - 1) {
        const nextEntryEl = document.querySelector(`[data-exp-idx="${activeExpIdx + 1}"]`);
        if (nextEntryEl) {
          nextEntryOriginalTop = nextEntryEl.getBoundingClientRect().top;
        }
      }
    } else if (activeType === "section") {
      activeElement = document.querySelector(`[data-section="${activeId}"]`);
      startHeight = activeElement ? activeElement.offsetHeight : 100;
    }

    if (activeElement) {
      activeElement.classList.add("resizing");
      handle.classList.add("active");
    }

    document.body.style.cursor = "ns-resize";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging || !activeElement) return;

    const deltaY = e.clientY - startY;
    const newHeight = Math.max(30, startHeight + deltaY);

    if (activeType === "entry") {
      activeElement.style.minHeight = `${newHeight}px`;
      activeElement.style.paddingBottom = `${Math.max(4, deltaY / 2)}px`;

      // Check if active container is dragged down to overlap into NEXT entry to trigger Merge!
      if (activeExpIdx !== -1 && activeExpIdx < state.experience.length - 1) {
        const nextExpIdx = activeExpIdx + 1;
        const nextEntryEl = document.querySelector(`[data-exp-idx="${nextExpIdx}"]`);
        
        if (nextEntryEl) {
          // If dragged down by 60px or past next entry's original top position
          if (deltaY > 60 || (nextEntryOriginalTop && e.clientY >= nextEntryOriginalTop)) {
            potentialMergeTarget = nextEntryEl;
            nextEntryEl.classList.add("merge-target");

            if (!mergeBadge) {
              mergeBadge = document.createElement("div");
              mergeBadge.className = "merge-indicator-badge";
              mergeBadge.innerHTML = `⚡ Release to Merge into "${state.experience[activeExpIdx].title}"`;
              nextEntryEl.appendChild(mergeBadge);
            }
          } else {
            if (potentialMergeTarget) {
              potentialMergeTarget.classList.remove("merge-target");
              if (mergeBadge) { mergeBadge.remove(); mergeBadge = null; }
              potentialMergeTarget = null;
            }
          }
        }
      }

      if (!state.entryHeights) state.entryHeights = {};
      state.entryHeights[activeId] = newHeight;
    } else if (activeType === "section") {
      const newPadding = Math.max(0, deltaY);
      activeElement.style.paddingBottom = `${newPadding}px`;
      if (!state.sectionPaddings) state.sectionPaddings = {};
      state.sectionPaddings[activeId] = newPadding;
    }

    const tooltip = activeElement.querySelector(".res-drag-handle-tooltip");
    if (tooltip) {
      if (potentialMergeTarget) {
        tooltip.textContent = `⚡ OVERLAPPING: Release mouse to Merge containers!`;
      } else {
        tooltip.textContent = `Height: ${Math.round(newHeight)}px (Pulling container length)`;
      }
    }
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = "default";

      // EXECUTE CONTAINER MERGE IF OVERLAPPED
      if (potentialMergeTarget && activeExpIdx !== -1 && activeExpIdx < state.experience.length - 1) {
        const nextExpIdx = activeExpIdx + 1;
        const primaryJob = state.experience[activeExpIdx];
        const secondaryJob = state.experience[nextExpIdx];

        // Clear and remove secondary container contents completely!
        state.experience.splice(nextExpIdx, 1);
        delete state.entryHeights[activeId];

        showToast(`Merged container space! "${secondaryJob.title}" was cleared.`);
      }

      if (potentialMergeTarget) {
        potentialMergeTarget.classList.remove("merge-target");
        if (mergeBadge) { mergeBadge.remove(); mergeBadge = null; }
        potentialMergeTarget = null;
      }

      if (activeElement) {
        activeElement.classList.remove("resizing");
        const handle = activeElement.querySelector(".res-drag-handle");
        if (handle) handle.classList.remove("active");
      }

      saveState();
      renderExperienceForm();
      renderCanvas();
    }
  });
}

window.addBulletToExp = function(expIdx) {
  state.experience[expIdx].bullets.push("New key achievement statement...");
  focusTargetField = `exp.${expIdx}.${state.experience[expIdx].bullets.length - 1}`;
  renderCanvas();
  renderExperienceForm();
  saveState();
};

// THEME SYSTEM & DYNAMIC DOCUMENT PALETTE EXTRACTOR
function getAllThemes() {
  const all = { ...THEMES };
  if (state.docThemes && typeof state.docThemes === 'object') {
    Object.assign(all, state.docThemes);
  }
  return all;
}

function rgbToHex(r, g, b) {
  const toHex = c => Math.min(255, Math.max(0, Math.round(c))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
      case gNorm: h = (bNorm - rNorm) / d + 2; break;
      case bNorm: h = (rNorm - gNorm) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function shiftHue(hex, degree) {
  const hsl = hexToHsl(hex);
  return hslToHex(hsl.h + degree, Math.max(40, hsl.s), hsl.l);
}

function generateDocThemes(primaryHex, accentHex, docName = "Document") {
  const primaryHsl = hexToHsl(primaryHex);
  const isDarkOrMono = primaryHsl.s < 12 || primaryHsl.l < 15;

  let modernAccent = accentHex;
  if (accentHex.toLowerCase() === primaryHex.toLowerCase() || Math.abs(hexToHsl(primaryHex).h - hexToHsl(accentHex).h) < 20) {
    modernAccent = shiftHue(primaryHex, 140);
  }

  const cleanDocName = docName.replace(/\.[^/.]+$/, "").substring(0, 14);

  return {
    doc_original: {
      name: `Doc Original (${cleanDocName})`,
      primary: primaryHex,
      accent: accentHex,
      body: "#2C3E50",
      muted: "#6C757D",
      divider: accentHex
    },
    doc_modern: {
      name: `Doc Modern Accent`,
      primary: primaryHex,
      accent: modernAccent,
      body: "#1E293B",
      muted: "#64748B",
      divider: modernAccent
    },
    doc_clean: {
      name: `Doc Clean Minimal`,
      primary: isDarkOrMono ? "#111111" : primaryHex,
      accent: isDarkOrMono ? "#333333" : hslToHex(primaryHsl.h, Math.min(30, primaryHsl.s), 35),
      body: "#1a1a1a",
      muted: "#555555",
      divider: isDarkOrMono ? "#111111" : primaryHex
    }
  };
}

async function extractPaletteFromPDF(pdfDoc, fileName) {
  try {
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    await page.render({ canvasContext: ctx, viewport }).promise;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colorWeights = {};

    for (let i = 0; i < imgData.length; i += 16) {
      const r = imgData[i], g = imgData[i + 1], b = imgData[i + 2], a = imgData[i + 3];
      if (a < 128) continue;
      // Filter out pure white backgrounds and pure black text
      if (r > 238 && g > 238 && b > 238) continue;
      if (r < 25 && g < 25 && b < 25) continue;

      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const lum = (max + min) / 510;

      // Group nearby colors (24-step quantization)
      const qr = Math.round(r / 24) * 24;
      const qg = Math.round(g / 24) * 24;
      const qb = Math.round(b / 24) * 24;
      const hex = rgbToHex(qr, qg, qb);

      // Higher weight for colorful / saturated brand elements
      const weight = (sat > 0.15 ? 4 : 1) * (lum > 0.15 && lum < 0.85 ? 2 : 1);
      colorWeights[hex] = (colorWeights[hex] || 0) + weight;
    }

    const sortedColors = Object.keys(colorWeights).sort((a, b) => colorWeights[b] - colorWeights[a]);

    if (sortedColors.length >= 2) {
      return generateDocThemes(sortedColors[0], sortedColors[1], fileName);
    } else if (sortedColors.length === 1) {
      const p = sortedColors[0];
      return generateDocThemes(p, shiftHue(p, 120), fileName);
    }
  } catch(e) {
    console.warn("Palette extraction fallback:", e);
  }
  return generateDocThemes("#1C3A5E", "#0B7A75", fileName || "Doc");
}

function renderThemeSwatches() {
  const container = document.getElementById("color-swatch-list");
  if (!container) return;
  container.innerHTML = "";

  // Built-in standard themes
  Object.keys(THEMES).forEach(themeKey => {
    const t = THEMES[themeKey];
    const swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.dataset.theme = themeKey;
    swatch.title = t.name;
    swatch.style.background = `linear-gradient(135deg, ${t.primary} 50%, ${t.accent} 50%)`;
    if (state.settings.theme === themeKey) swatch.classList.add("active");
    swatch.addEventListener("click", () => switchTheme(themeKey));
    container.appendChild(swatch);
  });

  // Uploaded document extracted themes
  if (state.docThemes && Object.keys(state.docThemes).length > 0) {
    const divider = document.createElement("div");
    divider.className = "doc-swatch-divider";
    divider.title = "Themes extracted from uploaded document";
    container.appendChild(divider);

    Object.keys(state.docThemes).forEach(themeKey => {
      const t = state.docThemes[themeKey];
      const swatch = document.createElement("div");
      swatch.className = "color-swatch doc-swatch";
      swatch.dataset.theme = themeKey;
      swatch.title = `📄 ${t.name}`;
      swatch.style.background = `linear-gradient(135deg, ${t.primary} 50%, ${t.accent} 50%)`;
      if (state.settings.theme === themeKey) swatch.classList.add("active");
      swatch.addEventListener("click", () => switchTheme(themeKey));
      container.appendChild(swatch);
    });
  }
}

function switchTheme(themeKey) {
  const allThemes = getAllThemes();
  if (allThemes[themeKey]) {
    const t = allThemes[themeKey];
    state.settings.theme = themeKey;
    state.settings.primaryColor = t.primary;
    state.settings.accentColor = t.accent;
    state.settings.dividerColor = t.divider || t.accent;
    applySettings();
    renderCanvas();
    saveState(true);
    showToast(`Applied "${t.name || themeKey}" theme!`);
  }
}

function applySettings() {
  const s = state.settings;
  const allThemes = getAllThemes();
  const activeTheme = allThemes[s.theme] || THEMES.illustrator;
  const root = document.documentElement;

  root.style.setProperty('--res-primary', s.primaryColor || activeTheme.primary);
  root.style.setProperty('--res-accent', s.accentColor || activeTheme.accent);
  root.style.setProperty('--res-divider', s.dividerColor || activeTheme.divider || s.accentColor || activeTheme.accent);
  root.style.setProperty('--res-font', `'${s.fontFamily}', sans-serif`);
  root.style.setProperty('--res-line-height', s.lineSpacing.toString());

  renderThemeSwatches();

  const fontSel = document.getElementById("select-font");
  if (fontSel && s.fontFamily) {
    let opt = Array.from(fontSel.options).find(o => o.value.toLowerCase() === s.fontFamily.toLowerCase());
    if (!opt) {
      ensureGoogleFontLoaded(s.fontFamily);
      opt = document.createElement("option");
      opt.value = s.fontFamily;
      opt.textContent = `✨ ${s.fontFamily} (Doc Font)`;
      fontSel.insertBefore(opt, fontSel.firstChild);
    }
    fontSel.value = opt.value;
  }
}

function setupEventListeners() {
  ['fullName', 'proTitle', 'phone', 'email', 'address', 'linkedin', 'website'].forEach(key => {
    const input = document.getElementById(`input-${key}`);
    if (input) {
      input.addEventListener('input', (e) => {
        const map = { fullName: 'fullName', proTitle: 'professionalTitle', phone: 'phone', email: 'email', address: 'address', linkedin: 'linkedin', website: 'website' };
        state.header[map[key]] = e.target.value;
        saveState();
        renderCanvas();
      });
    }
  });

  const sumInput = document.getElementById("input-summary");
  if (sumInput) {
    sumInput.addEventListener('input', (e) => {
      state.summary = e.target.value;
      saveState();
      renderCanvas();
    });
  }

  const skillsContainer = document.getElementById("skills-form-container");
  if (skillsContainer) {
    skillsContainer.addEventListener('input', (e) => {
      if (e.target.dataset.skillCol !== undefined) {
        const colIdx = parseInt(e.target.dataset.skillCol);
        const lines = e.target.value.split('\n').filter(l => l.trim() !== "");
        state.skills[colIdx].items = lines;
        saveState();
        renderCanvas();
      }
    });
  }

  const fontSel = document.getElementById("select-font");
  if (fontSel) {
    fontSel.addEventListener('change', (e) => {
      state.settings.fontFamily = e.target.value;
      applySettings();
      saveState();
    });
  }

  const verSel = document.getElementById("select-version-dropdown");
  if (verSel) {
    verSel.addEventListener('change', (e) => {
      const verId = parseInt(e.target.value);
      if (!isNaN(verId)) {
        restoreVersion(verId, false);
      }
    });
  }

  document.getElementById("btn-undo")?.addEventListener("click", undo);
  document.getElementById("btn-redo")?.addEventListener("click", redo);
  document.getElementById("btn-save-state")?.addEventListener("click", saveManualState);
  document.getElementById("btn-version-history")?.addEventListener("click", () => {
    renderVersionHistoryList();
    document.getElementById("modal-history")?.classList.add("active");
  });
  document.getElementById("btn-peek-history")?.addEventListener("click", () => {
    renderVersionHistoryList();
    document.getElementById("modal-history")?.classList.add("active");
  });

  // Profile management event listeners
  document.getElementById("select-resume-profile")?.addEventListener("change", (e) => switchProfile(e.target.value));
  document.getElementById("btn-new-profile")?.addEventListener("click", openNewVariantModal);
  document.getElementById("btn-duplicate-profile")?.addEventListener("click", promptDuplicateCurrentProfile);
  document.getElementById("btn-manage-profiles")?.addEventListener("click", openProfilesManagerModal);
  initVariantModalEvents();
  initUploadModalEvents();

  // History modal tabs and search filter
  document.querySelectorAll(".history-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
      document.querySelectorAll(".history-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentHistoryFilter = tab.getAttribute("data-filter") || 'all';
      renderVersionHistoryList();
    });
  });

  const histSearch = document.getElementById("history-search-input");
  if (histSearch) {
    histSearch.addEventListener("input", (e) => {
      currentHistorySearch = e.target.value;
      renderVersionHistoryList();
    });
  }

  document.getElementById("btn-upload-doc")?.addEventListener("click", () => document.getElementById("file-import-doc").click());
  document.getElementById("file-import-doc")?.addEventListener("change", handleDocUpload);
  document.getElementById("btn-export-pdf")?.addEventListener("click", prepareForPDFExport);
  document.getElementById("btn-export-json")?.addEventListener("click", exportJSON);
  document.getElementById("btn-ats-text")?.addEventListener("click", openATSModal);
  document.getElementById("btn-diagnostics")?.addEventListener("click", openDiagnosticsModal);
  document.getElementById("btn-reset-template")?.addEventListener("click", resetTemplate);

  // Global Keyboard Shortcuts: Ctrl+Z (Undo), Ctrl+Y (Redo), Ctrl+S (Save)
  window.addEventListener("keydown", (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (!isCtrlOrCmd) return;

    const key = e.key.toLowerCase();

    if (key === 's') {
      e.preventDefault();
      saveManualState();
    } else if (key === 'z') {
      if (e.shiftKey) {
        e.preventDefault();
        redo();
      } else {
        e.preventDefault();
        undo();
      }
    } else if (key === 'y') {
      e.preventDefault();
      redo();
    }
  });

  // Global Plain-Text & Bullet/Symbol Sanitizer for all form inputs & textareas
  document.addEventListener('paste', (e) => {
    const target = e.target;
    if (!target || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

    e.preventDefault();
    const rawText = (e.clipboardData || window.clipboardData).getData('text/plain');
    const isSingleLine = target instanceof HTMLInputElement;
    const cleanText = cleanPastedText(rawText, isSingleLine);

    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const val = target.value;

    target.value = val.substring(0, start) + cleanText + val.substring(end);
    target.selectionStart = target.selectionEnd = start + cleanText.length;

    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }, true);
}

// ==========================================
// RESUME FONT & TYPOGRAPHY ABSORPTION SYSTEM
// ==========================================
function cleanFontFamily(rawName) {
  if (!rawName || typeof rawName !== 'string') return null;
  let name = rawName.trim();
  // Strip PDF subset prefix (e.g. "ABCDEF+" or "BAAAAA+")
  name = name.replace(/^[A-Z]{6}\+/, '');
  // Strip TrueType / PostScript prefixes like TT or OTF
  name = name.replace(/^TT[0-9]+[a-z]?/i, '');
  // Remove PostScript tags and qualifiers
  name = name.replace(/PSMT|MT|PS|LF/g, '');
  // Remove style/weight suffixes preceded by hyphen, underscore, comma or space
  name = name.replace(/[-_, ]*(Regular|Bold|Italic|Oblique|Light|Medium|SemiBold|DemiBold|Demi|Semi|Black|Thin|ExtraBold|UltraLight|Book)/gi, '');
  // Handle CamelCase font names: e.g. TimesNewRoman -> Times New Roman, OpenSans -> Open Sans
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  name = name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  name = name.trim();

  // Known standard aliases
  const aliases = {
    "Arial": "Arial",
    "Calibri": "Calibri",
    "Helvetica": "Helvetica",
    "Helvetica Neue": "Helvetica Neue",
    "Times": "Times New Roman",
    "Times New Roman": "Times New Roman",
    "Georgia": "Georgia",
    "Garamond": "Garamond",
    "Verdana": "Verdana",
    "Trebuchet": "Trebuchet MS",
    "Trebuchet MS": "Trebuchet MS",
    "Open Sans": "Open Sans",
    "Poppins": "Poppins",
    "Montserrat": "Montserrat",
    "Roboto": "Roboto",
    "Inter": "Inter",
    "Lato": "Lato",
    "Merriweather": "Merriweather",
    "Raleway": "Raleway",
    "Nunito": "Nunito",
    "Playfair Display": "Playfair Display",
    "Source Sans": "Source Sans Pro",
    "Source Sans Pro": "Source Sans Pro",
    "Source Sans 3": "Source Sans 3",
    "Courier New": "Courier New",
    "Century Gothic": "Century Gothic",
    "Cambria": "Cambria",
    "Palatino": "Palatino Linotype",
    "Palatino Linotype": "Palatino Linotype",
    "Segoe UI": "Segoe UI"
  };

  if (aliases[name]) {
    return aliases[name];
  }

  // If name is a generic fallback, ignore
  if (/^(sans-serif|serif|monospace|cursive|fantasy)$/i.test(name)) {
    return null;
  }

  // If too short or random digits (e.g. "g_d0_f1")
  if (name.length < 3 || /^g_[a-z0-9_]+$/i.test(name) || /^[0-9_]+$/.test(name)) {
    return null;
  }

  return name;
}

function ensureGoogleFontLoaded(fontFamily) {
  if (!fontFamily) return;
  const systemFonts = ['Arial', 'Calibri', 'Helvetica', 'Helvetica Neue', 'Times New Roman', 'Georgia', 'Garamond', 'Verdana', 'Trebuchet MS', 'Courier New', 'Century Gothic', 'Cambria', 'Palatino Linotype', 'Segoe UI', 'Tahoma'];
  if (systemFonts.some(f => f.toLowerCase() === fontFamily.toLowerCase())) {
    return; // System font available natively in OS
  }

  const linkId = `google-font-${fontFamily.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  if (document.getElementById(linkId)) return;

  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap`;
  link.onerror = () => {
    console.log(`Font "${fontFamily}" will be rendered via local system or browser fallback.`);
  };
  document.head.appendChild(link);
}

function registerAndApplyFont(fontFamily) {
  if (!fontFamily) return;
  ensureGoogleFontLoaded(fontFamily);

  const select = document.getElementById("select-font");
  if (select) {
    let opt = Array.from(select.options).find(o => o.value.toLowerCase() === fontFamily.toLowerCase());
    if (!opt) {
      opt = document.createElement("option");
      opt.value = fontFamily;
      opt.textContent = `✨ ${fontFamily} (Detected)`;
      select.insertBefore(opt, select.firstChild);
    }
    select.value = opt.value;
  }

  state.settings.fontFamily = fontFamily;
  document.documentElement.style.setProperty('--res-font', `'${fontFamily}', sans-serif`);
}

async function extractFontsFromPDF(pdf) {
  const fontWeights = {};
  const recordFont = (rawFamily, weight = 10) => {
    if (!rawFamily) return;
    const clean = cleanFontFamily(rawFamily);
    if (clean) {
      fontWeights[clean] = (fontWeights[clean] || 0) + weight;
    }
  };

  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // 1. Inspect text items & text styles
      if (textContent && textContent.items) {
        textContent.items.forEach(item => {
          const str = (item.str || "").trim();
          if (!str) return;
          
          let rawFamily = null;
          if (textContent.styles && textContent.styles[item.fontName]) {
            rawFamily = textContent.styles[item.fontName].fontFamily;
          }
          if (rawFamily && rawFamily !== 'sans-serif' && rawFamily !== 'serif' && rawFamily !== 'monospace') {
            recordFont(rawFamily, str.length);
          }
        });
      }

      // 2. Inspect PDF.js loaded font objects in commonObjs / page objs
      [page.commonObjs, pdf.commonObjs, page.objs].forEach(objsStore => {
        if (!objsStore) return;
        const store = objsStore._objs || {};
        Object.values(store).forEach(entry => {
          const d = entry ? (entry.data || entry) : null;
          if (d) {
            if (d.name) recordFont(d.name, 35);
            if (d.loadedName) recordFont(d.loadedName, 25);
            if (d.fallbackName && d.fallbackName !== 'sans-serif' && d.fallbackName !== 'serif') {
              recordFont(d.fallbackName, 15);
            }
          }
        });
      });
    }
  } catch(e) {
    console.warn("Font extraction non-critical error:", e);
  }

  const sortedFonts = Object.keys(fontWeights).sort((a, b) => fontWeights[b] - fontWeights[a]);
  return {
    primaryFont: sortedFonts[0] || null,
    headingFont: sortedFonts[1] || sortedFonts[0] || null,
    allFonts: sortedFonts
  };
}

// Spatial & Column-Aware PDF Text Re-ordering
function extractPageTextSpatially(items) {
  if (!items || items.length === 0) return "";
  
  const validItems = items.filter(it => it && it.str && it.str.trim().length > 0);
  if (validItems.length === 0) return "";

  const sortTopToBottom = (a, b) => {
    const yDiff = b.transform[5] - a.transform[5];
    if (Math.abs(yDiff) > 5) {
      return yDiff; // Higher y first (top of page down)
    }
    return a.transform[4] - b.transform[4]; // Left to right
  };

  const buildLinesFromItems = (itemsList) => {
    if (itemsList.length === 0) return [];
    itemsList.sort(sortTopToBottom);
    
    const lines = [];
    let currentLine = [];
    let currentY = null;

    itemsList.forEach(it => {
      const y = it.transform[5];
      if (currentY === null || Math.abs(currentY - y) <= 4.5) {
        currentLine.push(it.str.trim());
        if (currentY === null) currentY = y;
      } else {
        if (currentLine.length > 0) {
          lines.push(currentLine.join(" "));
        }
        currentLine = [it.str.trim()];
        currentY = y;
      }
    });
    if (currentLine.length > 0) {
      lines.push(currentLine.join(" "));
    }
    return lines;
  };

  const xs = validItems.map(it => it.transform[4]);
  const ys = validItems.map(it => it.transform[5]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;

  const splitX = minX + width * 0.60;
  const headerThresholdY = maxY - height * 0.26;

  const headerItems = [];
  const leftItems = [];
  const rightItems = [];

  validItems.forEach(it => {
    const x = it.transform[4];
    const y = it.transform[5];
    if (y > headerThresholdY) {
      headerItems.push(it);
    } else if (x < splitX) {
      leftItems.push(it);
    } else {
      rightItems.push(it);
    }
  });

  if (leftItems.length >= 4 && rightItems.length >= 4) {
    const headerLines = buildLinesFromItems(headerItems);
    const leftLines = buildLinesFromItems(leftItems);
    const rightLines = buildLinesFromItems(rightItems);
    return [...headerLines, ...leftLines, ...rightLines].join("\n");
  } else {
    return buildLinesFromItems(validItems).join("\n");
  }
}

// Letter-Spacing / Tracking Untracking Helper
function unspaceLetterSpacing(str) {
  if (!str) return "";
  let s = str.trim();
  if (/\b([A-Za-z]\s+){2,}[A-Za-z]\b/.test(s)) {
    if (s.includes("  ")) {
      s = s.split(/\s{2,}/).map(word => word.replace(/\s+/g, '')).join(" ");
    } else {
      const chars = s.split(/\s+/);
      if (chars.every(c => c.length === 1)) {
        s = chars.join("");
      }
    }
  }
  return s;
}

// Heading normalizer immune to letter tracking/spacing
function normalizeSectionHeading(line) {
  if (!line || line.length > 55) return null;
  const rawLetters = line.replace(/[^A-Za-z]/g, '').toUpperCase();
  
  if (/^(?:PROFESSIONAL)?SUMMARY$|^PROFILE$|^ABOUTME$|^OBJECTIVE$|^EXECUTIVESUMMARY$/.test(rawLetters)) {
    return 'summary';
  }
  if (/^(?:CORE|TECHNICAL|KEY)?SKILLS$|^COMPETENCIES$|^AREASOFEXPERTISE$|^TECHNOLOGIES$|^TOOLS$/.test(rawLetters)) {
    return 'skills';
  }
  if (/^(?:WORK|PROFESSIONAL|RELEVANT|EMPLOYMENT)?EXPERIENCE$|^WORKHISTORY$|^EMPLOYMENTHISTORY$/.test(rawLetters)) {
    return 'experience';
  }
  if (/^EDUCATION$|^ACADEMICBACKGROUND$|^DEGREES$|^EDUCATIONTRAINING$/.test(rawLetters)) {
    return 'education';
  }
  if (/^CERTIFICATIONS$|^CERTIFICATES$|^LICENSESCERTIFICATIONS$/.test(rawLetters)) {
    return 'certifications';
  }
  if (/^LANGUAGESACHIEVEMENTS$|^ACHIEVEMENTS$|^AWARDS$|^HONORS$|^LANGUAGES$/.test(rawLetters)) {
    return 'achievements';
  }
  if (/^CONTACT$|^CONTACTME$|^CONTACTINFO$|^CONTACTINFORMATION$/.test(rawLetters)) {
    return 'contact';
  }
  return null;
}

// ==========================================
// INTELLIGENT CLIENT-SIDE RESUME TEXT PARSER
// ==========================================
function parseResumeText(fullText, fileName = "") {
  const result = {
    header: {
      fullName: "",
      professionalTitle: "",
      phone: "",
      email: "",
      address: "",
      linkedin: "",
      website: ""
    },
    summary: "",
    skills: [
      { col: 1, items: [] },
      { col: 2, items: [] },
      { col: 3, items: [] }
    ],
    experience: [],
    education: [],
    certifications: [],
    achievements: [],
    settings: JSON.parse(JSON.stringify(DEFAULT_RESUME_DATA.settings))
  };

  if (!fullText || typeof fullText !== 'string') {
    return result;
  }

  const rawLines = fullText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (rawLines.length === 0) return result;

  // 1. Contact information regexes
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/;
  const linkedinRegex = /(?:linkedin\.com\/(?:in\/)?[\w-]+|in\/[\w-]+)/i;
  const webRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.(?:github\.io|gitlab\.io|dev|tech|me|app|com|org|io)(?:\/[^\s,]*)?)/i;
  const locationRegex = /\b([A-Z][a-zA-Z\s.-]+,\s*[A-Z]{2}(?:\s+\d{5})?)\b/;

  const emailMatch = fullText.match(emailRegex);
  if (emailMatch) result.header.email = emailMatch[0];

  const phoneMatch = fullText.match(phoneRegex);
  if (phoneMatch) result.header.phone = phoneMatch[0];

  const linkedinMatch = fullText.match(linkedinRegex);
  if (linkedinMatch) result.header.linkedin = linkedinMatch[0];

  // Prevent email domain (e.g. gmail.com) from being captured as candidate portfolio website
  const webMatches = fullText.match(new RegExp(webRegex, 'gi'));
  if (webMatches) {
    const emailDomain = emailMatch ? emailMatch[0].split('@')[1].toLowerCase() : '';
    const validWeb = webMatches.find(w => {
      const cleanW = w.replace(/^https?:\/\//i, '').replace(/^www\./i, '').toLowerCase();
      if (cleanW === emailDomain || cleanW.startsWith(emailDomain)) return false;
      if (/^(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|icloud\.com)/i.test(cleanW)) return false;
      return true;
    });
    if (validWeb) result.header.website = validWeb;
  }

  const locMatch = fullText.match(locationRegex);
  if (locMatch) result.header.address = locMatch[1];

  // 2. Identify candidate Name, Title & Narrative Summary from header block
  let detectedSummary = "";
  for (let i = 0; i < Math.min(10, rawLines.length); i++) {
    const line = unspaceLetterSpacing(rawLines[i]);
    const headingKey = normalizeSectionHeading(line);
    if (headingKey) break; // Reached first section heading!

    if (emailRegex.test(line) || phoneRegex.test(line) || /linkedin\.com|github\.com/i.test(line)) continue;
    if (/^(resume|curriculum vitae|cv|portfolio)$/i.test(line.replace(/[^a-zA-Z]/g, ''))) continue;

    // Narrative summary paragraph placed directly under title without heading
    if (line.length > 55 && result.header.fullName) {
      detectedSummary = detectedSummary ? (detectedSummary + " " + line) : line;
      continue;
    }

    if (!result.header.fullName && /^[A-Za-zÀ-ÖØ-öø-ÿ\s.'-]+$/.test(line) && line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 6) {
      result.header.fullName = line;
    } else if (result.header.fullName && !result.header.professionalTitle && line.length < 65) {
      result.header.professionalTitle = line;
    }
  }

  if (detectedSummary) {
    result.summary = detectedSummary;
  }

  // 3. Section Boundary Parsing
  const sectionBuckets = {
    summary: [],
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    achievements: [],
    contact: []
  };

  let currentSection = null;
  for (let i = 0; i < rawLines.length; i++) {
    const line = unspaceLetterSpacing(rawLines[i]);
    const matchedKey = normalizeSectionHeading(line);

    if (matchedKey) {
      currentSection = matchedKey;
      continue;
    }

    if (currentSection && sectionBuckets[currentSection]) {
      sectionBuckets[currentSection].push(line);
    }
  }

  // Explicit summary section overrides implicit narrative
  if (sectionBuckets.summary.length > 0) {
    result.summary = sectionBuckets.summary.join(" ");
  }

  // Contact section: parse address if not yet found
  if (sectionBuckets.contact.length > 0 && !result.header.address) {
    sectionBuckets.contact.forEach(l => {
      if (!emailRegex.test(l) && !phoneRegex.test(l) && locationRegex.test(l)) {
        result.header.address = (l.match(locationRegex) || [l])[0];
      }
    });
  }

  // 4. Parse Skills
  if (sectionBuckets.skills.length > 0) {
    let allSkills = [];
    sectionBuckets.skills.forEach(line => {
      const clean = line.replace(/^[•\-*–—▪▫›\u2014\u2013\u2022]\s*/, '').trim();
      const parts = clean.split(/[,•|;▪▫›\t]+/).map(p => p.trim()).filter(p => p.length > 0);
      allSkills.push(...parts);
    });
    allSkills = allSkills.filter(s => s.length > 1 && s.length < 40);
    if (allSkills.length > 0) {
      const col1 = [], col2 = [], col3 = [];
      allSkills.forEach((skill, idx) => {
        if (idx % 3 === 0) col1.push(skill);
        else if (idx % 3 === 1) col2.push(skill);
        else col3.push(skill);
      });
      result.skills = [
        { col: 1, items: col1 },
        { col: 2, items: col2 },
        { col: 3, items: col3 }
      ];
    }
  }

  // 5. Parse Work Experience
  if (sectionBuckets.experience.length > 0) {
    const dateRegex = /(?:(?:Jan|Feb|Mar|Apr|May|Mayu|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*(?:–|—|-|to)\s*(?:(?:Jan|Feb|Mar|Apr|May|Mayu|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}|Present|Current)/i;
    const expLines = sectionBuckets.experience;
    const jobs = [];
    let currentJob = null;

    for (let i = 0; i < expLines.length; i++) {
      const line = expLines[i];
      const isBullet = /^[•\-*–—▪▫›\u2014\u2013\u2022]/.test(line);
      const cleanLine = line.replace(/^[•\-*–—▪▫›\u2014\u2013\u2022]\s*/, '').trim();
      const hasDate = dateRegex.test(line);

      if (isBullet) {
        if (!currentJob) {
          currentJob = {
            id: "exp-" + (jobs.length + 1) + "-" + Date.now(),
            title: "Position Title",
            company: "",
            location: "",
            dateRange: "",
            description: "",
            bullets: []
          };
          jobs.push(currentJob);
        }
        currentJob.bullets.push(cleanLine);
      } else if (hasDate) {
        const dateMatch = line.match(dateRegex);
        let dateStr = dateMatch ? dateMatch[0] : "";
        dateStr = dateStr.replace(/Mayu/gi, 'May');
        const otherText = line.replace(dateRegex, '').replace(/[|•–—\-]/g, ' ').trim();

        if (!currentJob || currentJob.bullets.length > 0 || currentJob.dateRange) {
          let jobTitle = otherText || "Job Position";
          let jobCompany = "";
          let jobLocation = "";
          if (otherText.includes('|')) {
            const parts = otherText.split('|').map(p => p.trim());
            jobCompany = parts[0];
            jobLocation = parts[1] || "";
          }
          currentJob = {
            id: "exp-" + (jobs.length + 1) + "-" + Date.now(),
            title: jobTitle,
            company: jobCompany,
            location: jobLocation,
            dateRange: dateStr,
            description: "",
            bullets: []
          };
          jobs.push(currentJob);
        } else {
          currentJob.dateRange = dateStr;
          if (otherText) {
            if (otherText.includes('|')) {
              const parts = otherText.split('|').map(p => p.trim());
              currentJob.company = parts[0];
              currentJob.location = parts[1] || currentJob.location;
            } else if (!currentJob.company) {
              currentJob.company = otherText;
            }
          }
        }
      } else {
        if (!currentJob || currentJob.bullets.length > 0) {
          if (line.length < 65) {
            let jobTitle = line;
            let jobLocation = "";
            if (line.includes(',')) {
              const parts = line.split(',');
              jobTitle = parts[0].trim();
              jobLocation = parts.slice(1).join(',').trim();
            }
            currentJob = {
              id: "exp-" + (jobs.length + 1) + "-" + Date.now(),
              title: jobTitle,
              company: "",
              location: jobLocation,
              dateRange: "",
              description: "",
              bullets: []
            };
            jobs.push(currentJob);
          } else if (currentJob && currentJob.bullets.length > 0) {
            currentJob.bullets[currentJob.bullets.length - 1] += " " + line;
          }
        } else {
          if (line.includes('|')) {
            const parts = line.split('|').map(p => p.trim());
            currentJob.company = parts[0];
            currentJob.location = parts[1] || currentJob.location;
          } else if (!currentJob.company) {
            currentJob.company = line;
          } else if (!currentJob.location && line.includes(',')) {
            currentJob.location = line;
          } else if (!currentJob.description) {
            currentJob.description = line;
          }
        }
      }
    }

    if (jobs.length > 0) {
      result.experience = jobs;
    }
  }

  // 6. Parse Education
  if (sectionBuckets.education.length > 0) {
    const eduLines = sectionBuckets.education;
    const eduEntries = [];
    let currentEdu = null;

    const degreeRegex = /(?:Bachelor|Master|Associate|Doctor|B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?B\.?A\.?|Ph\.?D\.?|Diploma|Degree|High\s+School)\b/i;
    const instRegex = /(?:School|University|College|Academy|Institute|Polytechnic)\b/i;
    const yearRegex = /\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(19\d{2}|20\d{2})(?:\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(19\d{2}|20\d{2}))?\b/i;

    eduLines.forEach(line => {
      const clean = line.replace(/^[•\-*–—▪▫›\u2014\u2013\u2022]\s*/, '').trim();
      const hasDegree = degreeRegex.test(clean);
      const hasInst = instRegex.test(clean);
      const dateMatch = clean.match(yearRegex);

      if (!currentEdu) {
        currentEdu = {
          id: "edu-" + (eduEntries.length + 1) + "-" + Date.now(),
          degree: hasDegree ? clean : "High School Diploma",
          institution: hasInst ? clean : "",
          dateRange: dateMatch ? dateMatch[0] : ""
        };
        eduEntries.push(currentEdu);
      } else {
        if (hasInst && !currentEdu.institution) {
          currentEdu.institution = clean;
          if (currentEdu.degree === clean) currentEdu.degree = "High School Diploma";
        } else if (hasDegree) {
          currentEdu.degree = clean;
        } else if (dateMatch && !currentEdu.dateRange) {
          currentEdu.dateRange = dateMatch[0];
        } else if (!currentEdu.institution) {
          currentEdu.institution = clean;
        }
      }
    });

    if (eduEntries.length > 0) {
      result.education = eduEntries;
    }
  }

  // 7. Parse Certifications
  if (sectionBuckets.certifications.length > 0) {
    result.certifications = sectionBuckets.certifications
      .map(line => line.replace(/^[•\-*–—▪▫›\u2014\u2013\u2022]\s*/, '').trim())
      .filter(line => line.length > 2)
      .map((line, idx) => ({ id: "cert-" + (idx + 1) + "-" + Date.now(), name: line }));
  }

  // 8. Parse Achievements / Languages
  if (sectionBuckets.achievements.length > 0) {
    result.achievements = sectionBuckets.achievements
      .map(line => line.replace(/^[•\-*–—▪▫›\u2014\u2013\u2022]\s*/, '').trim())
      .filter(line => line.length > 2)
      .map((line, idx) => ({ id: "ach-" + (idx + 1) + "-" + Date.now(), text: line }));
  }

  return result;
}

// Global holding area for pending document import
let pendingDocImport = null;

// Universal PDF, AI, and JSON Document Uploader & Parser
async function handleDocUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  e.target.value = ""; // Reset input so user can re-select same file if desired

  if (fileName.endsWith('.json')) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        recordVersionSnapshot("Pre-Upload Backup", true, true, "Pre-Upload Backup");
        state = JSON.parse(evt.target.result);
        populateFormFields();
        applySettings();
        renderCanvas();
        saveState(true);
        showToast("✓ Resume JSON loaded successfully! Auto-backup saved in History.");
      } catch(err) {
        showToast("⚠️ Invalid JSON file format.");
      }
    };
    reader.readAsText(file);
    return;
  }

  // Handle PDF or AI file
  showToast("Reading uploaded document & extracting typography & palettes...");
  
  // 1. Take safety snapshot of active editor before proceeding
  recordVersionSnapshot("Pre-Upload Backup", true, true, "Pre-Upload Backup");

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const arrayBuffer = evt.target.result;
      let fullText = "";
      let docThemes = null;
      let detectedFont = null;

      if (window.pdfjsLib) {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Spatial multi-column aware line extraction
          const pageText = extractPageTextSpatially(textContent.items);
          fullText += pageText + "\n\n";
        }

        // Extract typography & dominant font
        const fontInfo = await extractFontsFromPDF(pdf);
        detectedFont = fontInfo.primaryFont;

        // Extract colors and generate doc-specific themes
        docThemes = await extractPaletteFromPDF(pdf, file.name);
      } else {
        docThemes = generateDocThemes("#1C3A5E", "#0B7A75", file.name);
      }

      // Parse text into structured resume fields
      const parsedResume = parseResumeText(fullText, file.name);

      // Store in pending holding area and present upload modal
      pendingDocImport = {
        file: file,
        fileName: file.name,
        fullText: fullText,
        parsedResume: parsedResume,
        docThemes: docThemes,
        detectedFont: detectedFont
      };

      openUploadOptionsModal(pendingDocImport);

    } catch(err) {
      console.warn("PDF parsing fallback to template:", err);
      const docThemes = generateDocThemes("#1C3A5E", "#0B7A75", file.name);
      pendingDocImport = {
        file: file,
        fileName: file.name,
        fullText: "",
        parsedResume: parseResumeText("", file.name),
        docThemes: docThemes,
        detectedFont: null
      };
      openUploadOptionsModal(pendingDocImport);
    }
  };
  reader.readAsArrayBuffer(file);
}

function openUploadOptionsModal(importData) {
  const modal = document.getElementById("modal-upload-options");
  if (!modal) return;

  const fileNameEl = document.getElementById("upload-summary-filename");
  const fontEl = document.getElementById("upload-summary-font");
  const personEl = document.getElementById("upload-summary-person");
  const paletteEl = document.getElementById("upload-summary-palette");
  const variantInput = document.getElementById("input-upload-variant-name");

  if (fileNameEl) fileNameEl.textContent = importData.fileName || "Uploaded Resume";
  
  if (fontEl) {
    if (importData.detectedFont) {
      fontEl.textContent = `✨ Font: ${importData.detectedFont} (Absorbed)`;
      fontEl.style.display = "inline-flex";
    } else {
      fontEl.textContent = `✨ Font: System Modern`;
    }
  }

  if (personEl) {
    const name = importData.parsedResume?.header?.fullName;
    const role = importData.parsedResume?.header?.professionalTitle;
    if (name && role) {
      personEl.textContent = `Parsed: ${name} • ${role}`;
    } else if (name) {
      personEl.textContent = `Parsed: ${name}`;
    } else {
      personEl.textContent = `Parsed document sections & layout`;
    }
  }

  if (paletteEl && importData.docThemes && importData.docThemes.doc_original) {
    const t = importData.docThemes.doc_original;
    paletteEl.innerHTML = `
      <span style="display:inline-block; width:13px; height:13px; border-radius:50%; background:${t.primary}; border:1px solid #fff; box-shadow:0 1px 2px rgba(0,0,0,0.15);" title="Primary: ${t.primary}"></span>
      <span style="display:inline-block; width:13px; height:13px; border-radius:50%; background:${t.accent}; border:1px solid #fff; box-shadow:0 1px 2px rgba(0,0,0,0.15);" title="Accent: ${t.accent}"></span>
    `;
  }

  const candidateName = importData.parsedResume?.header?.fullName;
  const defaultVariantName = candidateName 
    ? `${candidateName} (Imported)` 
    : `${importData.fileName.replace(/\.[^/.]+$/, "")} (Imported)`;
  if (variantInput) {
    variantInput.value = defaultVariantName;
  }

  const cardNew = document.getElementById("upload-card-new-variant");
  const cardCurrent = document.getElementById("upload-card-current");
  const cardThemeOnly = document.getElementById("upload-card-theme-only");
  const radioNew = cardNew?.querySelector("input");

  if (radioNew) radioNew.checked = true;
  cardNew?.classList.add("selected");
  cardCurrent?.classList.remove("selected");
  cardThemeOnly?.classList.remove("selected");
  document.getElementById("upload-variant-name-wrap")?.style.setProperty("display", "block");

  modal.classList.add("active");
}

function parseAndLoadDocumentText(text, filename, extractedDocThemes = null, extractedFont = null) {
  const savedDocThemes = extractedDocThemes || state.docThemes || {};
  const parsed = parseResumeText(text, filename);
  
  state = JSON.parse(JSON.stringify(parsed));
  state.entryHeights = {};
  state.sectionPaddings = {};
  state.docThemes = savedDocThemes;

  if (savedDocThemes && savedDocThemes.doc_original) {
    state.settings.theme = "doc_original";
    state.settings.primaryColor = savedDocThemes.doc_original.primary;
    state.settings.accentColor = savedDocThemes.doc_original.accent;
    state.settings.dividerColor = savedDocThemes.doc_original.divider;
  }

  if (extractedFont) {
    registerAndApplyFont(extractedFont);
  }

  populateFormFields();
  applySettings();
  renderCanvas();
  saveState(true);
}

window.addExp = function() {
  state.experience.push({
    id: "exp-" + Date.now(),
    title: "Job Title / Position",
    company: "Company Name",
    location: "City, State",
    dateRange: "Month Year – Present",
    description: "",
    bullets: [
      "Managed daily operations, workflows, and cross-functional communications across teams.",
      "Improved processes and project delivery schedules, increasing overall team efficiency by 25%.",
      "Prepared executive reports, presentations, and documentation for key stakeholders."
    ]
  });
  renderExperienceForm();
  renderCanvas();
  saveState(true);
  showToast("Added standard Job Position (with 3 bullet points)!");
};

window.updateExp = function(idx, key, val) {
  state.experience[idx][key] = val;
  renderCanvas();
  saveState(false);
};

window.updateExpBullets = function(idx, rawVal) {
  const lines = rawVal.split('\n');
  state.experience[idx].bullets = lines;
  renderCanvas();
  saveState(false);
};

window.deleteExp = function(idx) {
  state.experience.splice(idx, 1);
  renderExperienceForm();
  renderCanvas();
  saveState(true);
  showToast("Job entry deleted. Content shifted up!");
};

window.moveExp = function(idx, dir) {
  const target = idx + dir;
  if (target >= 0 && target < state.experience.length) {
    const temp = state.experience[idx];
    state.experience[idx] = state.experience[target];
    state.experience[target] = temp;
    renderExperienceForm();
    renderCanvas();
    saveState(true);
  }
};

window.addEdu = function() {
  state.education.push({
    id: "edu-" + Date.now(),
    degree: "Degree / Specialization",
    institution: "University / Institution",
    dateRange: "Graduated: Year"
  });
  renderEducationForm();
  renderCanvas();
  saveState(true);
};

window.updateEdu = function(idx, key, val) {
  state.education[idx][key] = val;
  renderCanvas();
  saveState(false);
};

window.deleteEdu = function(idx) {
  state.education.splice(idx, 1);
  renderEducationForm();
  renderCanvas();
  saveState(true);
  showToast("Education entry deleted. Content shifted up!");
};

window.addCert = function() {
  state.certifications.push({ id: "cert-" + Date.now(), name: "New Professional Certification" });
  renderCertificationsForm();
  renderCanvas();
  saveState(true);
};

window.updateCert = function(idx, val) {
  state.certifications[idx].name = val;
  renderCanvas();
  saveState(false);
};

window.deleteCert = function(idx) {
  state.certifications.splice(idx, 1);
  renderCertificationsForm();
  renderCanvas();
  saveState(true);
  showToast("Certification deleted. Content shifted up!");
};

window.addAch = function() {
  state.achievements.push({ id: "ach-" + Date.now(), text: "New Award or Accomplishment" });
  renderAchievementsForm();
  renderCanvas();
  saveState(true);
};

window.updateAch = function(idx, val) {
  state.achievements[idx].text = val;
  renderCanvas();
  saveState(false);
};

window.deleteAch = function(idx) {
  state.achievements.splice(idx, 1);
  renderAchievementsForm();
  renderCanvas();
  saveState(true);
  showToast("Achievement deleted. Content shifted up!");
};

window.moveSection = function(secKey, dir) {
  const order = state.settings.sectionOrder;
  const idx = order.indexOf(secKey);
  const target = idx + dir;
  if (target >= 0 && target < order.length) {
    const temp = order[idx];
    order[idx] = order[target];
    order[target] = temp;
    
    renderCanvas();
    populateFormFields();
    saveState(true);

    const title = (state.settings.sectionTitles[secKey] || secKey).toUpperCase();
    showToast(`Moved ${title} ${dir < 0 ? "Up" : "Down"}!`);

    // Smoothly scroll to the moved section and highlight it!
    setTimeout(() => {
      const movedEl = document.querySelector(`[data-section="${secKey}"]`);
      if (movedEl) {
        movedEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        movedEl.classList.add('section-moved-highlight');
        setTimeout(() => movedEl.classList.remove('section-moved-highlight'), 2000);
      }
    }, 120);
  }
};

function prepareForPDFExport() {
  // 1. Clean up any empty bullets or blank lines/descriptions
  let cleaned = false;
  state.experience.forEach(exp => {
    const originalLen = exp.bullets.length;
    exp.bullets = exp.bullets.filter(b => b && b.trim() !== "");
    if (exp.bullets.length !== originalLen) cleaned = true;
    if (exp.description && !exp.description.trim()) {
      exp.description = "";
      cleaned = true;
    }
  });

  // 2. Re-render canvas and sync sidebar
  renderCanvas();
  renderExperienceForm();
  if (cleaned) saveState(false);

  // 3. Immediately distribute pages synchronously to ensure 100% stable DOM
  distributePages();

  // 4. Sanitize DOM for pure vector PDF generation:
  // Strip all interactive handles, controls, empty nodes, and contenteditable attributes
  // so Adobe Acrobat receives clean linear text flow without empty layout boxes or stacking contexts
  document.querySelectorAll('.res-drag-handle, .res-entry-controls, .res-section-controls, .canvas-add-bullet-btn, .canvas-add-section-btn, .merge-indicator-badge, .page-footer-tag').forEach(el => el.remove());
  document.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  document.querySelectorAll('.res-entry, .res-section').forEach(el => {
    el.style.minHeight = '';
    el.style.paddingBottom = '';
  });
  document.querySelectorAll('.res-entry-desc').forEach(el => {
    if (!el.textContent || !el.textContent.trim()) el.remove();
  });
  document.body.classList.add('exporting-pdf');

  const restoreAfterPrint = () => {
    document.body.classList.remove('exporting-pdf');
    // Seamlessly restore the interactive canvas and drag handles
    renderCanvas();
    window.removeEventListener('afterprint', restoreAfterPrint);
  };
  window.addEventListener('afterprint', restoreAfterPrint);

  // 5. Trigger print with fallback restoration
  setTimeout(() => {
    window.print();
    setTimeout(restoreAfterPrint, 2000);
  }, 120);
}

function exportJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `resume_${state.header.fullName.replace(/\s+/g, '_')}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      state = JSON.parse(evt.target.result);
      populateFormFields();
      applySettings();
      renderCanvas();
      saveState();
      showToast("Resume data imported successfully!");
    } catch(err) {
      showToast("⚠️ Invalid JSON file format.");
    }
  };
  reader.readAsText(file);
}

// PRISTINE FACTORY RESET TO ORIGINAL ILLUSTRATOR STATE
async function resetTemplate() {
  const confirmed = await appConfirm({
    title: "Reset to Illustrator Template",
    message: "Reset resume to original Adobe Illustrator template state?\n\nAll edits, custom heights, and multi-page extensions will be completely restored to pristine factory defaults.",
    confirmText: "Reset Resume",
    isDanger: true
  });
  if (confirmed) {
    localStorage.removeItem("antigravity_resume_data");

    state = JSON.parse(JSON.stringify(DEFAULT_RESUME_DATA));
    state.entryHeights = {};
    state.sectionPaddings = {};
    state.docThemes = {};

    state.settings.theme = "illustrator";
    state.settings.primaryColor = "#1C3A5E";
    state.settings.accentColor = "#0B7A75";
    state.settings.fontFamily = "Poppins";
    state.settings.fontScale = 100;
    state.settings.lineSpacing = 1.42;
    state.settings.sectionOrder = ["summary", "skills", "experience", "education", "certifications", "achievements"];

    populateFormFields();
    applySettings();
    renderCanvas();
    saveState();
    showToast("Resume reset to pristine Illustrator template!");
  }
}

function openATSModal() {
  const modal = document.getElementById("modal-ats");
  const codeBlock = document.getElementById("ats-text-output");
  if (!modal || !codeBlock) return;

  const h = state.header || {};
  let text = `${(h.fullName || '').toUpperCase()}\n${(h.professionalTitle || '').toUpperCase()}\n`;
  const contactParts = [h.phone, h.email, h.address, h.linkedin, h.website].filter(Boolean);
  if (contactParts.length) text += contactParts.join(" | ") + "\n\n";

  const sectionOrder = (state.settings && state.settings.sectionOrder) || [
    "summary", "skills", "experience", "education", "certifications", "achievements"
  ];
  const sectionTitles = (state.settings && state.settings.sectionTitles) || {};

  sectionOrder.forEach(secKey => {
    const title = (sectionTitles[secKey] || secKey).toUpperCase();
    text += `=== ${title} ===\n`;

    if (secKey === "summary" && state.summary) {
      text += `${state.summary}\n\n`;
    }
    else if (secKey === "skills" && Array.isArray(state.skills)) {
      state.skills.forEach(col => {
        (col.items || []).forEach(item => { text += `• ${item}\n`; });
      });
      text += `\n`;
    }
    else if (secKey === "experience" && Array.isArray(state.experience)) {
      state.experience.forEach(exp => {
        text += `${exp.title || ''} | ${exp.company || ''} (${exp.location || ''}) -- ${exp.dateRange || ''}\n`;
        if (exp.description) {
          text += `  ${exp.description}\n`;
        }
        (exp.bullets || []).forEach(b => { text += `  - ${b}\n`; });
        text += `\n`;
      });
    }
    else if (secKey === "education" && Array.isArray(state.education)) {
      state.education.forEach(edu => {
        text += `${edu.degree || ''} - ${edu.institution || ''} (${edu.dateRange || ''})\n`;
      });
      text += `\n`;
    }
    else if (secKey === "certifications" && Array.isArray(state.certifications)) {
      state.certifications.forEach(c => { text += `• ${c.name || ''}\n`; });
      text += `\n`;
    }
    else if (secKey === "achievements" && Array.isArray(state.achievements)) {
      state.achievements.forEach(a => { text += `• ${a.text || ''}\n`; });
      text += `\n`;
    }
  });

  codeBlock.textContent = text;
  modal.classList.add("active");
}

window.closeModal = function(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("active");

  if (id === "modal-app-dialog" && currentDialogResolve) {
    currentDialogResolve(false);
    currentDialogResolve = null;
  }
};

window.copyATSText = function() {
  const text = document.getElementById("ats-text-output").textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast("✓ ATS text copied to clipboard!");
  });
};

// ==========================================
// CUSTOM APP DIALOGS (Confirm & Prompt)
// ==========================================
let currentDialogResolve = null;

window.appConfirm = function({
  title = "Confirm Action",
  subtitle = "",
  message = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = false
} = {}) {
  return new Promise((resolve) => {
    currentDialogResolve = resolve;

    const modal = document.getElementById("modal-app-dialog");
    const titleEl = document.getElementById("dialog-title");
    const subEl = document.getElementById("dialog-subtitle");
    const msgEl = document.getElementById("dialog-message");
    const badgeEl = document.getElementById("dialog-icon-badge");
    const inputWrap = document.getElementById("dialog-input-wrap");
    const btnCancel = document.getElementById("dialog-btn-cancel");
    const btnConfirm = document.getElementById("dialog-btn-confirm");
    const btnClose = document.getElementById("dialog-btn-close");

    if (!modal) return resolve(false);

    titleEl.textContent = title;
    if (subtitle) {
      subEl.textContent = subtitle;
      subEl.style.display = "block";
    } else {
      subEl.style.display = "none";
    }
    msgEl.textContent = message;
    if (inputWrap) inputWrap.style.display = "none";

    if (badgeEl) {
      badgeEl.className = "modal-icon-badge " + (isDanger ? "danger" : "");
      if (isDanger) {
        badgeEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
      } else {
        badgeEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      }
    }

    if (btnConfirm) {
      btnConfirm.className = isDanger ? "btn btn-danger" : "btn btn-primary";
      btnConfirm.textContent = confirmText;
    }
    if (btnCancel) btnCancel.textContent = cancelText;

    const cleanup = () => {
      if (btnConfirm) btnConfirm.onclick = null;
      if (btnCancel) btnCancel.onclick = null;
      if (btnClose) btnClose.onclick = null;
      currentDialogResolve = null;
    };

    if (btnConfirm) {
      btnConfirm.onclick = () => {
        closeModal("modal-app-dialog");
        cleanup();
        resolve(true);
      };
    }

    const cancelHandler = () => {
      closeModal("modal-app-dialog");
      cleanup();
      resolve(false);
    };

    if (btnCancel) btnCancel.onclick = cancelHandler;
    if (btnClose) btnClose.onclick = cancelHandler;

    modal.classList.add("active");
    setTimeout(() => btnConfirm?.focus(), 60);
  });
};

window.appPrompt = function({
  title = "Input Required",
  subtitle = "",
  message = "",
  defaultValue = "",
  placeholder = "",
  confirmText = "Save",
  cancelText = "Cancel"
} = {}) {
  return new Promise((resolve) => {
    currentDialogResolve = resolve;

    const modal = document.getElementById("modal-app-dialog");
    const titleEl = document.getElementById("dialog-title");
    const subEl = document.getElementById("dialog-subtitle");
    const msgEl = document.getElementById("dialog-message");
    const badgeEl = document.getElementById("dialog-icon-badge");
    const inputWrap = document.getElementById("dialog-input-wrap");
    const inputEl = document.getElementById("dialog-input");
    const btnCancel = document.getElementById("dialog-btn-cancel");
    const btnConfirm = document.getElementById("dialog-btn-confirm");
    const btnClose = document.getElementById("dialog-btn-close");

    if (!modal || !inputEl) return resolve(null);

    titleEl.textContent = title;
    if (subtitle) {
      subEl.textContent = subtitle;
      subEl.style.display = "block";
    } else {
      subEl.style.display = "none";
    }
    msgEl.textContent = message;

    if (badgeEl) {
      badgeEl.className = "modal-icon-badge";
      badgeEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
    }

    if (btnConfirm) {
      btnConfirm.className = "btn btn-primary";
      btnConfirm.textContent = confirmText;
    }
    if (btnCancel) btnCancel.textContent = cancelText;

    if (inputWrap) inputWrap.style.display = "block";
    inputEl.value = defaultValue || "";
    inputEl.placeholder = placeholder || "";

    const cleanup = () => {
      if (btnConfirm) btnConfirm.onclick = null;
      if (btnCancel) btnCancel.onclick = null;
      if (btnClose) btnClose.onclick = null;
      inputEl.onkeydown = null;
      currentDialogResolve = null;
    };

    const doSubmit = () => {
      const val = inputEl.value.trim();
      closeModal("modal-app-dialog");
      cleanup();
      resolve(val);
    };

    const doCancel = () => {
      closeModal("modal-app-dialog");
      cleanup();
      resolve(null);
    };

    if (btnConfirm) btnConfirm.onclick = doSubmit;
    if (btnCancel) btnCancel.onclick = doCancel;
    if (btnClose) btnClose.onclick = doCancel;

    inputEl.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doSubmit();
      }
    };

    modal.classList.add("active");
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 60);
  });
};

function initVariantModalEvents() {
  const cardCopy = document.getElementById("source-card-copy");
  const cardBlank = document.getElementById("source-card-blank");
  const radioCopy = cardCopy?.querySelector("input");
  const radioBlank = cardBlank?.querySelector("input");

  cardCopy?.addEventListener("click", () => {
    if (radioCopy) radioCopy.checked = true;
    cardCopy.classList.add("selected");
    cardBlank?.classList.remove("selected");
  });

  cardBlank?.addEventListener("click", () => {
    if (radioBlank) radioBlank.checked = true;
    cardBlank.classList.add("selected");
    cardCopy?.classList.remove("selected");
  });

  const input = document.getElementById("input-new-variant-name");
  const submitBtn = document.getElementById("btn-submit-new-variant");
  const err = document.getElementById("new-variant-error");

  const submitNewVariant = () => {
    const name = input?.value.trim();
    if (!name) {
      if (err) err.style.display = "block";
      if (input) {
        input.style.borderColor = "#ef4444";
        input.focus();
      }
      return;
    }

    const copyCurrent = radioCopy ? radioCopy.checked : true;
    const newProfile = {
      id: "profile-" + Date.now(),
      name: name,
      updatedAt: formatTimeLabel(new Date()),
      data: copyCurrent ? JSON.parse(JSON.stringify(state)) : JSON.parse(JSON.stringify(DEFAULT_RESUME_DATA))
    };

    resumeProfiles.push(newProfile);
    saveProfilesToStorage();
    closeModal("modal-new-variant");
    closeModal("modal-profile-manage");
    switchProfile(newProfile.id);
    recordVersionSnapshot(`Variant: ${newProfile.name}`, true, true, `Created Variant: ${newProfile.name}`);
    showToast(`✓ Created new resume variant: "${newProfile.name}"`);
  };

  submitBtn?.addEventListener("click", submitNewVariant);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitNewVariant();
    }
  });
  input?.addEventListener("input", () => {
    if (err) err.style.display = "none";
    if (input) input.style.borderColor = "";
  });

  // Global dismiss handlers: Escape key and clicking modal backdrop
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const activeModals = document.querySelectorAll(".modal-overlay.active");
      activeModals.forEach(modal => closeModal(modal.id));
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
      closeModal(e.target.id);
    }
  });
}

function initUploadModalEvents() {
  const cardNew = document.getElementById("upload-card-new-variant");
  const cardCurrent = document.getElementById("upload-card-current");
  const cardThemeOnly = document.getElementById("upload-card-theme-only");
  const radioNew = cardNew?.querySelector("input");
  const radioCurrent = cardCurrent?.querySelector("input");
  const radioThemeOnly = cardThemeOnly?.querySelector("input");

  cardNew?.addEventListener("click", () => {
    if (radioNew) radioNew.checked = true;
    cardNew.classList.add("selected");
    cardCurrent?.classList.remove("selected");
    cardThemeOnly?.classList.remove("selected");
    document.getElementById("upload-variant-name-wrap")?.style.setProperty("display", "block");
  });

  cardCurrent?.addEventListener("click", () => {
    if (radioCurrent) radioCurrent.checked = true;
    cardCurrent.classList.add("selected");
    cardNew?.classList.remove("selected");
    cardThemeOnly?.classList.remove("selected");
    document.getElementById("upload-variant-name-wrap")?.style.setProperty("display", "none");
  });

  cardThemeOnly?.addEventListener("click", () => {
    if (radioThemeOnly) radioThemeOnly.checked = true;
    cardThemeOnly.classList.add("selected");
    cardNew?.classList.remove("selected");
    cardCurrent?.classList.remove("selected");
    document.getElementById("upload-variant-name-wrap")?.style.setProperty("display", "none");
  });

  const confirmBtn = document.getElementById("btn-confirm-upload-import");
  confirmBtn?.addEventListener("click", executeDocumentImport);

  const inputName = document.getElementById("input-upload-variant-name");
  inputName?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeDocumentImport();
    }
  });
}

function executeDocumentImport() {
  if (!pendingDocImport) {
    closeModal("modal-upload-options");
    return;
  }

  const { parsedResume, docThemes, detectedFont, fileName } = pendingDocImport;
  const radioNew = document.getElementById("upload-card-new-variant")?.querySelector("input");
  const radioCurrent = document.getElementById("upload-card-current")?.querySelector("input");
  const radioThemeOnly = document.getElementById("upload-card-theme-only")?.querySelector("input");
  const variantInput = document.getElementById("input-upload-variant-name");

  const isNewVariant = radioNew ? radioNew.checked : true;
  const isCurrent = radioCurrent ? radioCurrent.checked : false;
  const isThemeOnly = radioThemeOnly ? radioThemeOnly.checked : false;

  flushTypingTransaction();

  // 1. Font Absorption
  if (detectedFont) {
    registerAndApplyFont(detectedFont);
  }

  // 2. Prepare target state
  let targetState;
  if (isThemeOnly) {
    targetState = JSON.parse(JSON.stringify(state));
  } else if (isCurrent) {
    // Preserve existing resume content and overlay parsed sections
    targetState = JSON.parse(JSON.stringify(state));

    if (parsedResume.header.fullName) targetState.header.fullName = parsedResume.header.fullName;
    if (parsedResume.header.professionalTitle) targetState.header.professionalTitle = parsedResume.header.professionalTitle;
    if (parsedResume.header.email) targetState.header.email = parsedResume.header.email;
    if (parsedResume.header.phone) targetState.header.phone = parsedResume.header.phone;
    if (parsedResume.header.address) targetState.header.address = parsedResume.header.address;
    if (parsedResume.header.linkedin) targetState.header.linkedin = parsedResume.header.linkedin;
    if (parsedResume.header.website) targetState.header.website = parsedResume.header.website;

    if (parsedResume.summary) targetState.summary = parsedResume.summary;
    if (parsedResume.skills && parsedResume.skills.some(c => c.items && c.items.length > 0)) {
      targetState.skills = parsedResume.skills;
    }
    if (parsedResume.experience && parsedResume.experience.length > 0) {
      targetState.experience = parsedResume.experience;
    }
    if (parsedResume.education && parsedResume.education.length > 0) {
      targetState.education = parsedResume.education;
    }
    if (parsedResume.certifications && parsedResume.certifications.length > 0) {
      targetState.certifications = parsedResume.certifications;
    }
    if (parsedResume.achievements && parsedResume.achievements.length > 0) {
      targetState.achievements = parsedResume.achievements;
    }
  } else {
    // New variant: Clean structure with ONLY the candidate's actual data - NO dummy placeholders
    targetState = {
      header: {
        fullName: parsedResume.header.fullName || "Candidate Name",
        professionalTitle: parsedResume.header.professionalTitle || "Professional Title",
        phone: parsedResume.header.phone || "",
        email: parsedResume.header.email || "",
        address: parsedResume.header.address || "",
        linkedin: parsedResume.header.linkedin || "",
        website: parsedResume.header.website || ""
      },
      summary: parsedResume.summary || "",
      skills: (parsedResume.skills && parsedResume.skills.some(c => c.items && c.items.length > 0))
        ? parsedResume.skills
        : [{ col: 1, items: [] }, { col: 2, items: [] }, { col: 3, items: [] }],
      experience: parsedResume.experience || [],
      education: parsedResume.education || [],
      certifications: parsedResume.certifications || [],
      achievements: parsedResume.achievements || [],
      settings: JSON.parse(JSON.stringify(DEFAULT_RESUME_DATA.settings)),
      entryHeights: {},
      sectionPaddings: {},
      docThemes: {}
    };
  }

  // Apply themes
  if (docThemes && docThemes.doc_original) {
    targetState.docThemes = docThemes;
    targetState.settings.theme = "doc_original";
    targetState.settings.primaryColor = docThemes.doc_original.primary;
    targetState.settings.accentColor = docThemes.doc_original.accent;
    targetState.settings.dividerColor = docThemes.doc_original.divider;
  }
  if (detectedFont) {
    targetState.settings.fontFamily = detectedFont;
  }

  if (isNewVariant) {
    const variantName = (variantInput?.value.trim()) || "Imported Resume";
    const newProfile = {
      id: "profile-" + Date.now(),
      name: variantName,
      updatedAt: formatTimeLabel(new Date()),
      data: targetState
    };

    updateActiveProfileData(); // Keep current profile cleanly saved
    resumeProfiles.push(newProfile);
    saveProfilesToStorage();
    closeModal("modal-upload-options");
    switchProfile(newProfile.id);
    recordVersionSnapshot(`Imported: ${newProfile.name}`, true, true, `Imported: ${newProfile.name}`);
    showToast(`✓ Created new variant "${variantName}"! Your previous resume is untouched.`);
  } else if (isCurrent) {
    state = targetState;
    closeModal("modal-upload-options");
    populateFormFields();
    applySettings();
    renderCanvas();
    saveState(true);
    recordVersionSnapshot(`Imported: ${fileName}`, true, true, `Imported: ${fileName}`);
    showToast(`✓ Document content imported into current resume! (Auto-backup saved in History)`);
  } else if (isThemeOnly) {
    if (docThemes && docThemes.doc_original) {
      state.docThemes = docThemes;
      state.settings.theme = "doc_original";
      state.settings.primaryColor = docThemes.doc_original.primary;
      state.settings.accentColor = docThemes.doc_original.accent;
      state.settings.dividerColor = docThemes.doc_original.divider;
    }
    if (detectedFont) {
      state.settings.fontFamily = detectedFont;
    }
    closeModal("modal-upload-options");
    applySettings();
    renderCanvas();
    saveState(true);
    recordVersionSnapshot(`Theme & Font from ${fileName}`, true, true);
    showToast(`✓ Absorbed font "${detectedFont || 'Doc Font'}" & color palette applied! Text preserved.`);
  }

  pendingDocImport = null;
}

// ==========================================
// SYSTEM DIAGNOSTICS & ISSUE REPRODUCTION
// ==========================================
function initDiagnosticsSystem() {
  document.getElementById("btn-copy-diag-bundle")?.addEventListener("click", copyDiagnosticBundle);
  document.getElementById("btn-download-diag-bundle")?.addEventListener("click", downloadDiagnosticBundle);
  document.getElementById("btn-load-diag-bundle")?.addEventListener("click", loadDiagnosticBundleFromInput);
  document.getElementById("btn-run-stress-case")?.addEventListener("click", runSelectedStressTest);
  document.getElementById("select-stress-test")?.addEventListener("change", updateStressTestDesc);

  updateStressTestDesc();
}

function openDiagnosticsModal() {
  updateDiagnosticsUI();
  const modal = document.getElementById("modal-diagnostics");
  if (modal) modal.classList.add("active");
}

function updateDiagnosticsUI() {
  const fontEl = document.getElementById("diag-font-status");
  const dprEl = document.getElementById("diag-dpr");
  const viewportEl = document.getElementById("diag-viewport");
  const pagesEl = document.getElementById("diag-pages");
  const errCountEl = document.getElementById("diag-error-count");
  const errTextEl = document.getElementById("diag-error-counter-text");
  const storageEl = document.getElementById("diag-storage-count");
  const errListEl = document.getElementById("diag-error-log-list");

  if (fontEl) {
    const status = (document.fonts && document.fonts.status) || "unknown";
    fontEl.textContent = status.toUpperCase();
    fontEl.className = `diag-metric-value ${status === 'loaded' ? 'diag-status-ok' : 'diag-status-warn'}`;
  }

  if (dprEl) {
    const dpr = window.devicePixelRatio || 1;
    dprEl.textContent = `${dpr}x ${dpr > 1 ? '(HiDPI)' : '(Standard)'}`;
  }

  if (viewportEl) {
    viewportEl.textContent = `${window.innerWidth}×${window.innerHeight} (${screen.width}×${screen.height})`;
  }

  if (pagesEl) {
    const pages = document.querySelectorAll(".resume-paper-page").length;
    pagesEl.textContent = `${pages} Page${pages > 1 ? 's' : ''}`;
  }

  const errors = window.__appErrors || [];
  if (errCountEl) {
    errCountEl.textContent = errors.length;
    errCountEl.className = `diag-metric-value ${errors.length === 0 ? 'diag-status-ok' : 'diag-status-err'}`;
  }
  if (errTextEl) {
    errTextEl.textContent = errors.length;
  }

  if (storageEl) {
    const count = (typeof versionHistory !== "undefined" && Array.isArray(versionHistory)) ? versionHistory.length : 0;
    storageEl.textContent = `${count} snapshot${count !== 1 ? 's' : ''}`;
  }

  if (errListEl) {
    if (errors.length === 0) {
      errListEl.innerHTML = `<div style="color: #10b981; font-size: 0.78rem;">✓ No unhandled runtime errors detected.</div>`;
    } else {
      errListEl.innerHTML = errors.map(err => {
        return `<div class="diag-log-item"><strong>[${err.time}]</strong> ${escapeHTML(err.message)} <span style="opacity: 0.7;">(${err.filename || 'app'})</span></div>`;
      }).join("");
    }
  }

  updateStressTestDesc();
}

function updateStressTestDesc() {
  const select = document.getElementById("select-stress-test");
  const descEl = document.getElementById("stress-case-desc");
  if (!select || !descEl || !window.STRESS_FIXTURES) return;
  const fixture = window.STRESS_FIXTURES[select.value];
  if (fixture) {
    descEl.textContent = fixture.description;
  }
}

function generateDiagnosticBundle() {
  const p1 = document.getElementById("page-1");
  const p2 = document.getElementById("page-2");

  return {
    timestamp: new Date().toISOString(),
    crucesBuilderVersion: "1.0.0",
    clientEnvironment: {
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio || 1,
      screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      fontsStatus: (document.fonts && document.fonts.status) || "unknown",
      online: navigator.onLine
    },
    domTelemetry: {
      pageCount: document.querySelectorAll(".resume-paper-page").length,
      page1Height: p1 ? Math.round(p1.getBoundingClientRect().height) : null,
      page1ScrollHeight: p1 ? p1.scrollHeight : null,
      page2Height: p2 ? Math.round(p2.getBoundingClientRect().height) : null,
      page2ScrollHeight: p2 ? p2.scrollHeight : null,
      sectionOrder: state.settings?.sectionOrder || []
    },
    storageTelemetry: {
      activeProfileId: currentProfileId,
      totalProfiles: resumeProfiles.length,
      versionSnapshotsCount: (typeof versionHistory !== "undefined" && Array.isArray(versionHistory)) ? versionHistory.length : 0
    },
    trappedErrors: window.__appErrors || [],
    resumeState: state
  };
}

function copyDiagnosticBundle() {
  const bundle = generateDiagnosticBundle();
  const text = JSON.stringify(bundle, null, 2);
  navigator.clipboard.writeText(text).then(() => {
    showToast("✓ Diagnostic Bundle copied to clipboard!");
  }).catch(() => {
    showToast("⚠️ Could not access clipboard; try Download JSON instead.");
  });
}

function downloadDiagnosticBundle() {
  const bundle = generateDiagnosticBundle();
  const text = JSON.stringify(bundle, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `cruces-resume-diagnostic-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("✓ Diagnostic JSON downloaded!");
}

function loadDiagnosticBundleFromInput() {
  const inputEl = document.getElementById("diag-import-input");
  if (!inputEl) return;
  const raw = inputEl.value.trim();
  if (!raw) {
    showToast("⚠️ Please paste a diagnostic bundle JSON first.");
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const targetState = parsed.resumeState || (parsed.header && parsed.settings ? parsed : null);

    if (!targetState || !targetState.header || !targetState.settings) {
      showToast("⚠️ Invalid diagnostic format: resumeState missing or corrupted.");
      return;
    }

    recordVersionSnapshot("Pre-Diagnostic Load Backup", false, false, "Pre-Diagnostic Load Backup");

    state = targetState;
    if (!state.entryHeights) state.entryHeights = {};
    if (!state.sectionPaddings) state.sectionPaddings = {};
    if (!state.docThemes) state.docThemes = {};
    if (!state.settings.sectionOrder) {
      state.settings.sectionOrder = ["summary", "skills", "experience", "education", "certifications", "achievements"];
    }

    populateFormFields();
    applySettings();
    renderCanvas();
    saveState(true);
    closeModal("modal-diagnostics");
    inputEl.value = "";
    showToast("✓ Diagnostic state loaded & canvas rendered!");
  } catch (err) {
    console.error("Failed to parse diagnostic JSON:", err);
    showToast("⚠️ JSON parse error: " + err.message);
  }
}

function runSelectedStressTest() {
  const select = document.getElementById("select-stress-test");
  if (!select || !window.STRESS_FIXTURES) return;
  const key = select.value;
  const fixture = window.STRESS_FIXTURES[key];
  if (!fixture || !fixture.data) {
    showToast(`⚠️ Test case "${key}" not found.`);
    return;
  }

  recordVersionSnapshot(`Pre-Stress-Test Backup (${fixture.name})`, false, false, `Backup before ${fixture.name}`);

  state = JSON.parse(JSON.stringify(fixture.data));
  if (!state.entryHeights) state.entryHeights = {};
  if (!state.sectionPaddings) state.sectionPaddings = {};
  if (!state.docThemes) state.docThemes = {};
  if (!state.settings.sectionOrder) {
    state.settings.sectionOrder = ["summary", "skills", "experience", "education", "certifications", "achievements"];
  }

  populateFormFields();
  applySettings();
  renderCanvas();
  saveState(true);
  closeModal("modal-diagnostics");
  showToast(`✓ Loaded stress case: ${fixture.name}`);
}

window.openDiagnosticsModal = openDiagnosticsModal;
window.generateDiagnosticBundle = generateDiagnosticBundle;
