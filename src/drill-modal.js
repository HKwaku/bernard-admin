// src/drill-modal.js
// Shared drill-through modal for analytics

function closeDrillModal() {
  const modal = document.getElementById('drill-modal');
  if (modal) modal.classList.remove('active');
}

export function initDrillThroughModal() {
  let modal = document.getElementById('drill-modal');
  if (modal) return;

  modal = document.createElement('div');
  modal.id = 'drill-modal';
  modal.className = 'drill-modal-overlay';
  modal.innerHTML = `
    <div class="drill-modal-content">
      <div class="drill-modal-header">
        <h3 class="drill-modal-title" id="drill-modal-title">Details</h3>
        <button class="drill-modal-close" id="drill-modal-close">&times;</button>
      </div>
      <div class="drill-modal-body" id="drill-modal-body">Loading…</div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('drill-modal-close').addEventListener('click', closeDrillModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeDrillModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrillModal();
  });
}

export function openDrillModal(title, bodyHtml) {
  initDrillThroughModal();
  document.getElementById('drill-modal-title').textContent = title;
  document.getElementById('drill-modal-body').innerHTML = bodyHtml;
  document.getElementById('drill-modal').classList.add('active');
}
