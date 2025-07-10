export const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export const formatDate = (dateString) => {
    const date = new Date(dateString + 'T00:00:00'); // Ensure date is parsed as local time
    return date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const saveCards = (cards) => localStorage.setItem('cards', JSON.stringify(cards));

export const getCards = () => JSON.parse(localStorage.getItem('cards')) || [];

// NEW: UUID generator with fallback for compatibility
export const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback UUID generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// NEW: Utility to set up modal close listeners
export const setupModalClose = (modalElement) => {
    if (!modalElement) return; // Add null check
    modalElement.addEventListener('click', (e) => {
        if (e.target.matches('.close') || e.target === modalElement) {
            modalElement.close();
        }
    });
};