// src/blocked_bookings.js
// Block cabins for a date range – styled like custom booking modal

import { supabase } from './config/supabase.js';
import { toast } from './utils/helpers.js';

// ----------------- Block Dates Modal -----------------

export async function openBlockDatesModal() {
  try {
    // Load active room types (cabins)
    const { data: rooms, error } = await supabase
      .from('room_types')
      .select('id, code, name')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;

    const roomOptionsHtml = (rooms || []).length
      ? rooms
          .map(
            (rm) => `
              <label style="display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer">
                <input 
                  type="checkbox"
                  class="bd-room-checkbox"
                  value="${rm.id}"
                  data-code="${rm.code || ''}"
                  data-name="${rm.name || ''}"
                  style="width:auto"
                />
                <span>${(rm.code || '').toUpperCase()} – ${rm.name || ''}</span>
              </label>
            `
          )
          .join('')
      : '<div class="muted">No room types available</div>';

    const modal = document.createElement('div');
    modal.id = 'block-dates-modal';
    modal.className = 'modal show';

    modal.innerHTML = `
      <div class="content" onclick="event.stopPropagation()">
        <div class="hd">
          <h3 style="margin:0">Block Cabins for Date Range</h3>
          <button class="btn" id="bd-close-btn">×</button>
        </div>

        <div class="bd">
          <p style="margin-top:0;color:#64748b;font-size:0.9rem">
            Select one or more cabins and a date range. Each day in the range will be
            blocked from booking, similar to how blocked dates work in the guest booking flow.
          </p>

          <div class="form-grid">
            <div class="form-group" style="min-width:0">
              <label>Cabins</label>
              <div
                id="bd-rooms-list"
                style="
                  border:1px solid var(--ring);
                  border-radius:var(--radius-md);
                  padding:10px;
                  max-height:200px;
                  overflow-y:auto;
                  display:flex;
                  flex-direction:column;
                  gap:6px;
                "
              >
                ${roomOptionsHtml}
              </div>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label>Start date</label>
              <input id="bd-in" type="date" />
            </div>
            <div class="form-group">
              <label>End date</label>
              <input id="bd-out" type="date" />
            </div>
          </div>

          <div class="form-group">
            <label>Reason</label>
            <select id="bd-reason">
                <option value="maintenance">Maintenance</option>
                <option value="staff holiday">Staff holiday</option>
                <option value="other">Private Event</option>
                <option value="other">Other</option>
            </select>
            </div>

        </div>

        <div class="ft">
          <button class="btn" id="bd-cancel">Cancel</button>
          <button class="btn btn-primary" id="bd-save">Block Dates</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();

    // Close handlers (backdrop, X button, Cancel)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });
    modal.querySelector('#bd-close-btn')?.addEventListener('click', close);
    modal.querySelector('#bd-cancel')?.addEventListener('click', close);

    const inEl = modal.querySelector('#bd-in');
    const outEl = modal.querySelector('#bd-out');

    // Basic UX: default start to today, end to tomorrow
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().slice(0, 10);

    if (inEl) {
      inEl.value = todayISO;
      inEl.min = todayISO;
    }
    if (outEl) {
      outEl.value = tomorrowISO;
      outEl.min = todayISO;
    }

    // Keep checkout at least +1 day
    inEl?.addEventListener('change', () => {
      if (!inEl.value) return;
      const ci = new Date(inEl.value);
      if (Number.isNaN(ci.getTime())) return;
      const co = new Date(ci);
      co.setDate(co.getDate() + 1);
      if (outEl) {
        outEl.value = co.toISOString().slice(0, 10);
        outEl.min = inEl.value;
      }
    });

    // Save handler
    modal.querySelector('#bd-save')?.addEventListener('click', async () => {
      try {
        const selectedRoomIds = Array.from(
          modal.querySelectorAll('.bd-room-checkbox:checked')
        ).map((cb) => cb.value);

        if (!selectedRoomIds.length) {
          alert('Please select at least one cabin to block.');
          return;
        }

        if (!inEl.value || !outEl.value) {
          alert('Please select both start and end dates.');
          return;
        }

        const start = new Date(inEl.value);
        const end = new Date(outEl.value);

        if (
          Number.isNaN(start.getTime()) ||
          Number.isNaN(end.getTime())
        ) {
          alert('One or both dates are invalid.');
          return;
        }

        if (end <= start) {
          alert('End date must be after start date.');
          return;
        }

        const reason = modal.querySelector('#bd-reason')?.value || null;


        const startISO = inEl.value;
        const endISO = outEl.value;

        // Build rows for each day in [start, end)
        const rows = [];
        for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().slice(0, 10);
          selectedRoomIds.forEach((roomId) => {
            rows.push({
              room_type_id: roomId,
              blocked_date: dateStr,
              reason,
            });
          });
        }

        // Clear existing blocked dates for these rooms in this range
        const { error: delErr } = await supabase
          .from('blocked_dates')
          .delete()
          .in('room_type_id', selectedRoomIds)
          .gte('blocked_date', startISO)
          .lt('blocked_date', endISO);

        if (delErr) {
          alert(
            'Error clearing existing blocked dates: ' +
              (delErr.message || delErr)
          );
          return;
        }

        // Insert new ones
        if (rows.length) {
          const { error: insErr } = await supabase
            .from('blocked_dates')
            .insert(rows);
          if (insErr) {
            alert(
              'Error saving blocked dates: ' +
                (insErr.message || insErr)
            );
            return;
          }
        }

        toast('Dates blocked for selected cabins');
        close();
      } catch (e) {
        alert('Error blocking dates: ' + (e.message || e));
      }
    });
  } catch (e) {
    alert('Error loading cabins: ' + (e.message || e));
  }
}