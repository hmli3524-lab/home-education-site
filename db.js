/**
 * Firebase sync layer — monkey-patches localStorage so all existing code
 * automatically syncs to Firebase with zero changes.
 *
 * Usage: include <script src="db.js"></script> BEFORE any other scripts.
 * Then wrap your init code in: _dbReady.then(function() { ... });
 */
var FIREBASE_DB = "https://home-education-1ee3d-default-rtdb.firebaseio.com/data";

(function() {
  var _setItem = localStorage.setItem.bind(localStorage);
  var _removeItem = localStorage.removeItem.bind(localStorage);

  // Intercept setItem: write to localStorage AND Firebase
  localStorage.setItem = function(key, value) {
    _setItem(key, value);
    var payload;
    try { payload = JSON.parse(value); } catch(e) { payload = value; }
    fetch(FIREBASE_DB + '/' + encodeURIComponent(key) + '.json', {
      method: 'PUT',
      body: JSON.stringify(payload)
    }).catch(function() {});
  };

  // Intercept removeItem: delete from localStorage AND Firebase
  localStorage.removeItem = function(key) {
    _removeItem(key);
    fetch(FIREBASE_DB + '/' + encodeURIComponent(key) + '.json', {
      method: 'DELETE'
    }).catch(function() {});
  };

  // On page load: pull all Firebase data into localStorage
  // Merge strategy: Firebase wins UNLESS the value is empty/default and local has real content
  window._dbReady = fetch(FIREBASE_DB + '.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data) return;
      for (var key in data) {
        if (!data.hasOwnProperty(key)) continue;
        var val = data[key];
        var serialized = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);

        // For answer keys: don't overwrite local content with empty Firebase answers
        if (key.indexOf('answers_') === 0 && typeof val === 'object' && val !== null) {
          var local = null;
          try { local = JSON.parse(localStorage.getItem(key)); } catch(e) {}
          if (local) {
            // Merge: keep whichever has more content
            var fbHasContent = (val.q1 || val.q2 || val.q3);
            var localHasContent = (local.q1 || local.q2 || local.q3);
            if (!fbHasContent && localHasContent) {
              // Local has content but Firebase is empty — push local to Firebase
              fetch(FIREBASE_DB + '/' + encodeURIComponent(key) + '.json', {
                method: 'PUT',
                body: JSON.stringify(local)
              }).catch(function() {});
              continue; // don't overwrite local
            }
          }
        }

        _setItem(key, serialized);
      }
    })
    .catch(function() {
      // Offline — localStorage still works as fallback
    });
})();
