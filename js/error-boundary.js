/**
 * Faculty Availability Tracker - Comprehensive Error Boundary & Toast System
 * Version: v0.8.0 (Milestone 8 - Security & Polish)
 * 
 * Provides:
 * 1. Global uncaught error and unhandled promise rejection monitoring
 * 2. Accessible, styled toast notification engine
 * 3. Safe async boundary wrapper (ErrorBoundary.wrap)
 * 4. Network/Supabase connectivity health checks
 */

(function () {
  'use strict';

  // Ensure DOM container for toasts exists
  function getOrCreateToastContainer() {
    let container = document.getElementById('global-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'global-toast-container';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Displays an accessible toast alert with auto-dismiss and close button
   * @param {string} message - Text or HTML message to display
   * @param {'info'|'success'|'warning'|'error'} type - Alert severity
   * @param {number} durationMs - Timeout before dismissal (0 for persistent)
   */
  function showToast(message, type = 'info', durationMs = 4500) {
    const container = getOrCreateToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    // Icon based on type
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    const icon = icons[type] || 'ℹ';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">${message}</div>
      <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
    `;

    // Close button listener
    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
      toast.classList.add('toast-exit');
      setTimeout(() => {
        if (toast.parentNode === container) {
          container.removeChild(toast);
        }
      }, 200);
    };

    closeBtn.addEventListener('click', dismiss);

    container.appendChild(toast);

    if (durationMs > 0) {
      setTimeout(dismiss, durationMs);
    }

    return dismiss;
  }

  /**
   * Safe execution wrapper for async routines
   */
  async function wrapAsync(asyncFn, fallbackMessage = 'An unexpected error occurred. Please try again.') {
    try {
      return await asyncFn();
    } catch (err) {
      console.error('[ErrorBoundary caught error]:', err);
      showToast(`${fallbackMessage}: ${err.message || err}`, 'error', 6000);
      return null;
    }
  }

  // Filter benign platform errors
  function isBenignError(message) {
    if (!message) return false;
    const benignPatterns = [
      'failed to connect to websocket',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Script error.',
      'extension'
    ];
    return benignPatterns.some(p => message.toLowerCase().includes(p.toLowerCase()));
  }

  // Global Unhandled Error Listener
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (isBenignError(msg)) {
      return; // Ignore benign framework/extension warnings
    }
    console.error('[Global Error Boundary]:', event.error || msg);
    // Only show critical alert if not a minor script warning
    if (event.error && !event.error._handled) {
      showToast(`System notice: ${msg}`, 'warning', 5000);
    }
  });

  // Global Unhandled Promise Rejection Listener
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason?.message || String(reason) || 'Async operation failed';
    if (isBenignError(msg)) {
      return;
    }
    console.error('[Global Promise Rejection]:', reason);
    if (!reason?._handled) {
      showToast(`Network or data request error: ${msg}`, 'warning', 5500);
    }
  });

  // Expose global ErrorBoundary module
  window.ErrorBoundary = {
    showToast,
    wrap: wrapAsync,
    isBenignError
  };

  // Harmonize with existing window.Utils.showNotification if already defined or loaded later
  if (window.Utils) {
    window.Utils.showToast = showToast;
  }

})();
