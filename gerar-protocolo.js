// ... existing code ...

// Counter management
let notesCount = 0;
const MAX_NOTES = 99;

// Function to update the counter display
function updateCounter() {
    const counterElement = document.getElementById('records-count');
    if (counterElement) {
        counterElement.textContent = notesCount;
        console.log('Counter updated to:', notesCount); // Debugging
    } else {
        console.error('Counter element not found!');
    }
}

// Function to add a note with limit check
function addNote() {
    if (notesCount >= MAX_NOTES) {
        showLimitMessage();
        return false; // Prevent adding more notes
    }
    
    notesCount++;
    updateCounter();
    return true; // Allow adding the note
}

// Function to remove a note
function removeNote() {
    if (notesCount > 0) {
        notesCount--;
        updateCounter();
    }
}

// Function to show limit message
function showLimitMessage() {
    const message = document.createElement('div');
    message.className = 'limit-message';
    message.textContent = 'Limite máximo de 99 registros atingido!';
    document.body.appendChild(message);
    
    // Remove the message after animation completes
    setTimeout(() => {
        document.body.removeChild(message);
    }, 3000);
}

// Remove all counter-related code
document.addEventListener('DOMContentLoaded', function() {
    // Remove counter initialization code
    const gravarNotaBtn = document.getElementById('gravar-nota');
    if (gravarNotaBtn) {
        // Restore original click handler
        gravarNotaBtn.onclick = function(event) {
            // Original code without counter check
            if (typeof originalClickHandler === 'function') {
                return originalClickHandler.call(this, event);
            }
        };
    }
});

// Remove these functions completely:
// - updateCounter()
// - addNote()
// - removeNote()
// - showLimitMessage()
// - Any references to notesCount and MAX_NOTES

// Update note removal function
function excluirNota(button) {
    const row = button.closest('tr');
    if (row) {
        row.remove();
        // Remove counter update call
    }
}

// Initialize counter with existing rows
document.addEventListener('DOMContentLoaded', function() {
    const table = document.querySelector('table tbody');
    notesCount = table ? table.rows.length : 0;
    updateCounter();
    console.log('Initial notes count:', notesCount); // Debugging
});