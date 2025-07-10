import { getCards, saveCards, formatCurrency, formatDate, setupModalClose, generateUUID } from './utils.js';
import { renderAppContent, renderSummary, createTransactionRowHtml, createInstallmentItemHtml, setupTransactionActionListeners, setupInstallmentActionListeners, setupInstallmentDeleteActionListeners } from './render.js';
import { setupCardModal, setupTransactionModal } from './modals.js';
import { setupThemeSelector, setupDataImportExport } from './theme-import-export.js';
import { calculateCardDetails } from './calculations.js';

document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('SW registered: ', registration);
                })
                .catch(registrationError => {
                    console.log('SW registration failed: ', registrationError);
                });
        });
    }

    // PWA Install Prompt
    let deferredPrompt;
    const installBanner = document.getElementById('install-banner');
    const installBtn = document.getElementById('install-app-btn');
    const dismissBtn = document.getElementById('dismiss-install-btn');

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        // Show install banner if not dismissed
        if (!localStorage.getItem('installBannerDismissed')) {
            installBanner.classList.remove('hidden');
        }
    });

    // Install button click handler
    installBtn.addEventListener('click', () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the A2HS prompt');
                    installBanner.classList.add('hidden');
                } else {
                    console.log('User dismissed the A2HS prompt');
                }
                deferredPrompt = null;
            });
        }
    });

    // Dismiss button click handler
    dismissBtn.addEventListener('click', () => {
        installBanner.classList.add('hidden');
        localStorage.setItem('installBannerDismissed', 'true');
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        installBanner.classList.add('hidden');
    });

    // DOM Elements
    const body = document.body;
    const cardModal = document.getElementById('card-modal');
    const transactionModal = document.getElementById('transaction-modal');
    const cardForm = document.getElementById('card-form');
    const transactionForm = document.getElementById('transaction-form');
    const cardsContainer = document.getElementById('cards-container'); // Now displays single card
    const sidebarCardList = document.getElementById('sidebar-card-list'); // New: for sidebar card list
    const cardTemplate = document.getElementById('card-template');
    const cardListItemTemplate = document.getElementById('card-list-item-template');
    const noCardsMessage = document.getElementById('no-cards-message');
    const addCardFromEmptyStateBtn = document.getElementById('add-card-from-empty-state');
    const selectCardMessage = document.getElementById('select-card-message'); // New: message to select card
    const themeSwitcher = document.getElementById('theme-switcher');
    const mobileThemeSwitcher = document.getElementById('mobile-theme-switcher');
    
    // NEW: Import/Export buttons with unique IDs
    const exportBtnSidebar = document.getElementById('export-btn-sidebar');
    const importBtnSidebar = document.getElementById('import-btn-sidebar');
    const importFileSidebar = document.getElementById('import-file-sidebar');
    const exportBtnSettings = document.getElementById('export-btn-settings');
    const importBtnSettings = document.getElementById('import-btn-settings');
    const importFileSettings = document.getElementById('import-file-settings');

    const installmentsGroup = document.getElementById('installments-group');
    const typeSelect = document.getElementById('type');
    const totalDebtEl = document.getElementById('total-debt');
    const totalAvailableEl = document.getElementById('total-available');
    const totalLimitEl = document.getElementById('total-limit');
    const addCardBtnSidebar = document.getElementById('add-card-btn-sidebar'); // New: Add card button in sidebar
    const editCardBtn = document.getElementById('edit-card-btn'); // NEW: Edit button in main view
    
    // NEW Mobile Nav Elements
    const mobileNav = document.getElementById('mobile-nav');
    const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');
    const mobileAddCardBtn = document.getElementById('mobile-add-card-btn');
    const mobileBackBtn = document.getElementById('mobile-back-btn'); // NEW

    // NEW: Desktop Nav Elements
    const desktopNavBtns = document.querySelectorAll('.desktop-nav-btn');

    // NEW: Desktop cards list elements
    const desktopCardsListSection = document.getElementById('desktop-cards-list-section');
    const desktopCardsGrid = document.getElementById('desktop-cards-grid');
    const desktopNoCardsMessage = document.getElementById('desktop-no-cards-message');
    const addCardBtnDesktopList = document.getElementById('add-card-btn-desktop-list');
    const addCardFromDesktopEmptyState = document.getElementById('add-card-from-desktop-empty-state');

    // NEW Modal elements
    const transactionDetailModal = document.getElementById('transaction-detail-modal');
    const transactionDetailTableBody = document.getElementById('modal-transactions-table-body');
    const transactionDetailCardAlias = document.getElementById('transaction-card-alias');
    const transactionDetailCardIdInput = document.getElementById('transaction-detail-card-id');
    const noTransactionsMessage = document.getElementById('no-transactions-message');

    const installmentDetailModal = document.getElementById('installment-detail-modal');
    const installmentDetailList = document.getElementById('modal-installments-list');
    const installmentDetailCardAlias = document.getElementById('installment-card-alias');
    const installmentDetailCardIdInput = document.getElementById('installment-detail-card-id');
    const noInstallmentsMessageModal = document.getElementById('no-installments-message-modal');

    // NEW: Budget Elements
    const budgetSection = document.getElementById('budget-section');
    const budgetSetup = document.getElementById('budget-setup');
    const budgetDashboard = document.getElementById('budget-dashboard');
    const setupBudgetBtn = document.getElementById('setup-budget-btn');
    const budgetModal = document.getElementById('budget-modal');
    const budgetForm = document.getElementById('budget-form');
    const editBudgetBtn = document.getElementById('edit-budget-btn');
    const resetBudgetBtn = document.getElementById('reset-budget-btn');
    const mobileBudgetBtn = document.getElementById('mobile-budget-btn');

    // NEW: Budget Expense Elements
    const addBudgetExpenseBtn = document.getElementById('add-budget-expense-btn');
    const budgetExpenseModal = document.getElementById('budget-expense-modal');
    const budgetExpenseForm = document.getElementById('budget-expense-form');
    const budgetExpenseListContainer = document.getElementById('budget-expense-list-container');
    const noBudgetExpensesMessage = document.getElementById('no-budget-expenses-message');

    // NEW: Settings Section
    const settingsSection = document.getElementById('settings-section');

    // NEW: Theme modal elements
    const themeModal = document.getElementById('theme-modal');
    const themeSelectorContainer = document.getElementById('theme-selector-container');

    // NEW: Calendar view state
    let currentCalendarDate = new Date();
    let currentCalendarView = 'list'; // 'list', 'calendar', or 'day'
    let selectedDayTransactions = [];

    // NEW: Calendar view elements
    const transactionListViewBtn = document.getElementById('transaction-list-view-btn');
    const transactionCalendarViewBtn = document.getElementById('transaction-calendar-view-btn');
    const transactionListView = document.getElementById('transaction-list-view');
    const transactionCalendarView = document.getElementById('transaction-calendar-view');
    const transactionDayDetail = document.getElementById('transaction-day-detail');
    const calendarGrid = document.querySelector('.calendar-grid');
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const calendarPrevMonth = document.getElementById('calendar-prev-month');
    const calendarNextMonth = document.getElementById('calendar-next-month');
    const backToCalendar = document.getElementById('back-to-calendar');
    const dayDetailTitle = document.getElementById('day-detail-title');
    const dayTransactionsList = document.getElementById('day-transactions-list');
    const noTransactionsCalendarMessage = document.getElementById('no-transactions-calendar-message');

    // NEW: Get all toggle buttons and their corresponding grids
    const summaryToggles = [
        { btn: document.getElementById('toggle-general-summary'), grid: document.getElementById('general-summary-grid') },
        { btn: document.getElementById('toggle-payments-summary'), grid: document.getElementById('payments-summary-grid') },
        { btn: document.getElementById('toggle-installments-summary'), grid: document.getElementById('installments-summary-grid') }
    ];

    // Layout Elements
    const appLayout = document.getElementById('app-layout');
    const mainContentPanel = document.getElementById('main-content-panel');
    const cardListPanel = document.getElementById('card-list-panel');
    const mobileHeaderTitle = document.getElementById('mobile-header-title');

    // NEW: Zoom control elements
    const zoomSlider = document.getElementById('zoom-slider');
    const zoomValue = document.getElementById('zoom-value');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');

    // State
    let cards = getCards();
    let budget = JSON.parse(localStorage.getItem('budget')) || null;
    let zoomLevel = parseInt(localStorage.getItem('zoomLevel')) || (window.innerWidth >= 992 ? 85 : 100); // Default 85% for large screens
    let selectedCardId = cards.length > 0 ? cards[0].id : null; // New: Track selected card for detail view
    let previousMobileView = 'home'; // NEW: Track previous view for back button

    // --- RENDER FUNCTION WRAPPER ---
    // This function orchestrates rendering and saving state after any data change.
    const updateUI = () => {
        const hasCards = cards.length > 0;
        const selectedCard = cards.find(c => c.id === selectedCardId);

        renderAppContent(
            cards,
            selectedCardId,
            cardsContainer,
            sidebarCardList,
            cardTemplate,
            cardListItemTemplate,
            noCardsMessage,
            selectCardMessage,
            {
                onDeleteCard: handleDeleteCard,
                onAddTransaction: handleAddTransactionClick,
                onCardSelect: handleCardSelection,
                onViewTransactions: handleViewTransactionsClick, // NEW
                onViewInstallments: handleViewInstallmentsClick // NEW
            }
        );
        renderSummary(cards, totalDebtEl, totalAvailableEl, totalLimitEl);
        renderBudget();
        saveCards(cards); // Save after any operation that modifies cards
        localStorage.setItem('budget', JSON.stringify(budget));
        
        // NEW: Update header title and edit button visibility
        if (editCardBtn) {
            editCardBtn.style.display = selectedCard ? 'inline-flex' : 'none';
        }
        if (window.innerWidth < 992) {
             updateMobileHeader();
        }
    };

    // --- DATA MANIPULATION FUNCTIONS (passed as callbacks to modules) ---
    const handleImportSuccess = (importedData) => {
        const { cards: importedCards, budget: importedBudget, theme: importedTheme, zoom: importedZoom } = importedData;
        
        cards = importedCards || [];
        budget = importedBudget || null;
        
        // Handle zoom import
        if (typeof importedZoom === 'number') {
            applyZoom(importedZoom);
        }
        
        selectedCardId = cards.length > 0 ? cards[0].id : null;
        
        // The theme is applied by the import module, but we update the UI here
        // to reflect all data changes at once.
        updateUI();
    };

    const handleSaveCard = (newCardData, type) => {
        if (type === 'new') {
            const newId = String(Date.now());
            const newCard = { 
                ...newCardData, 
                id: newId, 
                transactions: [],
                hasCashback: newCardData.hasCashback || false,
                cashbackPercentage: newCardData.cashbackPercentage || 0
            };
            cards.push(newCard);
            selectedCardId = newId; // Select the newly added card
        } else {
            // Find and update existing card data
            const index = cards.findIndex(c => c.id === newCardData.id);
            if (index !== -1) {
                cards[index] = { 
                    ...cards[index], 
                    ...newCardData,
                    hasCashback: newCardData.hasCashback || false,
                    cashbackPercentage: newCardData.cashbackPercentage || 0
                };
                selectedCardId = newCardData.id; // Ensure the edited card remains selected
            }
        }
        updateUI();
        // On mobile, switch back to the card list view after adding/editing a card
        if (window.innerWidth < 992) {
            // If adding a new card, go to home to see it. If editing, go back to card list.
            switchMobileView('cards');
        }
    };

    const handleDeleteCard = (cardId) => {
        cards = cards.filter(c => c.id !== cardId);
        if (selectedCardId === cardId) {
            selectedCardId = cards.length > 0 ? cards[0].id : null; // Select first card or null if no cards left
        }
        if (transactionDetailModal.open && transactionDetailCardIdInput.value === cardId) {
            transactionDetailModal.close();
        }
        if (installmentDetailModal.open && installmentDetailCardIdInput.value === cardId) {
            installmentDetailModal.close();
        }
        // If we were viewing the deleted card on mobile, go back to the card list
        if (window.innerWidth < 992 && selectedCardId === null) {
            switchMobileView('cards');
        } else if (window.innerWidth < 992) {
            // If on mobile and other cards exist, switch to home view to see the new selected card
            switchMobileView('home');
        }
        updateUI(); // Move updateUI to the end to refresh header correctly
    };

    const handleSaveTransaction = (cardId, transactionData) => {
        const card = cards.find(c => c.id === cardId);
        if (card) {
            card.transactions.push(transactionData);
        } else {
            console.error('Card not found for ID:', cardId);
            alert('Error: No se pudo encontrar la tarjeta asociada. Por favor, intente de nuevo.');
        }
        updateUI();
        // Refresh the detail modal if it's open for this card
        if (transactionDetailModal && transactionDetailModal.open && transactionDetailCardIdInput && transactionDetailCardIdInput.value === cardId) {
            refreshTransactionDetailModal(cardId);
        }
        if (installmentDetailModal && installmentDetailModal.open && installmentDetailCardIdInput && installmentDetailCardIdInput.value === cardId) {
            refreshInstallmentDetailModal(cardId);
        }
    };

    const handlePayInstallment = (cardId, installmentId) => {
        const card = cards.find(c => c.id === cardId);
        if (!card) {
            console.error('Card not found for ID:', cardId);
            alert('Error: No se pudo encontrar la tarjeta asociada.');
            return;
        }

        const installment = card.transactions.find(tx => tx.id === installmentId && tx.type === 'installment_purchase');
        if (!installment) {
            console.error('Installment not found for ID:', installmentId);
            alert('Error: No se pudo encontrar la compra a plazo.');
            return;
        }

        if (installment.paidMonths >= installment.months) {
            alert('Esta compra a plazo ya está pagada en su totalidad.');
            return;
        }
        
        // NEW: Prompt for payment date
        const todayStr = new Date().toISOString().split('T')[0];
        const paymentDateStr = prompt(`¿En qué fecha se realizó el pago de ${formatCurrency(installment.monthlyPayment)}?\n(Mes ${installment.paidMonths + 1}/${installment.months})`, todayStr);

        if (!paymentDateStr) return; // User cancelled prompt

        // Basic validation for the date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDateStr)) {
            alert("Formato de fecha inválido. Por favor usa AAAA-MM-DD.");
            return;
        }

        if (confirm(`¿Confirmar pago con fecha ${paymentDateStr}?`)) {
            installment.paidMonths++;
            installment.remainingAmount -= installment.monthlyPayment;
            if (installment.remainingAmount < 0.01) installment.remainingAmount = 0; // Prevent negative floating point errors

            // Add a new 'payment' transaction to the card's general transaction list
            const paymentTx = {
                id: generateUUID(), // Use our compatible UUID generator
                type: 'payment',
                date: paymentDateStr, // Use user-provided date
                description: `Pago MSI: ${installment.description} (${installment.paidMonths}/${installment.months})`,
                amount: installment.monthlyPayment,
                relatedInstallmentId: installment.id // Link to original installment
            };
            card.transactions.push(paymentTx);
            updateUI();
            alert('Pago registrado con éxito!');

            // Refresh the installment detail modal if it's open for this card
            if (installmentDetailModal && installmentDetailModal.open && installmentDetailCardIdInput && installmentDetailCardIdInput.value === cardId) {
                refreshInstallmentDetailModal(cardId);
            }
            // Also refresh transaction detail modal if it's open for this card (due to new payment tx)
            if (transactionDetailModal && transactionDetailModal.open && transactionDetailCardIdInput && transactionDetailCardIdInput.value === cardId) {
                refreshTransactionDetailModal(cardId);
            }
        }
    };

    const handleDeleteTransaction = (cardId, transactionId) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este movimiento? Esta acción no se puede rehacer.')) {
            return;
        }

        const card = cards.find(c => c.id === cardId);
        if (card) {
            const transactionToDelete = card.transactions.find(tx => tx.id === transactionId);
            if (!transactionToDelete) {
                alert('Error: No se pudo encontrar el movimiento.');
                return;
            }

            // If this is an installment payment, reverse the changes on the parent installment object.
            if (transactionToDelete.type === 'payment' && transactionToDelete.relatedInstallmentId) {
                const parentInstallment = card.transactions.find(tx => tx.id === transactionToDelete.relatedInstallmentId);
                if (parentInstallment) {
                    parentInstallment.paidMonths--;
                    parentInstallment.remainingAmount += parentInstallment.monthlyPayment;
                     // Clamp the value to the total amount to prevent floating point inaccuracies from making it larger
                    if (parentInstallment.remainingAmount > parentInstallment.totalAmount) {
                        parentInstallment.remainingAmount = parentInstallment.totalAmount;
                    }
                }
            }

            // Filter out the transaction by its ID
            card.transactions = card.transactions.filter(tx => tx.id !== transactionId);

            alert('Movimiento eliminado con éxito.');
            updateUI(); // Re-render the UI and save state

            // If the transaction detail modal is open for this card, refresh its content
            if (transactionDetailModal && transactionDetailModal.open && transactionDetailCardIdInput && transactionDetailCardIdInput.value === cardId) {
                refreshTransactionDetailModal(cardId);
            }
            // Also refresh the installment detail modal as its state has changed
            if (installmentDetailModal && installmentDetailModal.open && installmentDetailCardIdInput && installmentDetailCardIdInput.value === cardId) {
                refreshInstallmentDetailModal(cardId);
            }
            
        } else {
            console.error('Card not found for ID:', cardId);
            alert('Error: No se pudo encontrar la tarjeta asociada para eliminar el movimiento.');
        }
    };

    const handleDeleteInstallment = (cardId, installmentId) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta compra a plazo y todos los pagos asociados?')) {
            return;
        }

        const card = cards.find(c => c.id === cardId);
        if (card) {
            const initialLength = card.transactions.length;
            // Filter out the installment purchase itself AND any payments related to it
            card.transactions = card.transactions.filter(tx => 
                tx.id !== installmentId && tx.relatedInstallmentId !== installmentId
            );

            if (card.transactions.length < initialLength) {
                alert('Compra a plazo y movimientos asociados eliminados.');
                updateUI();
                // If the installment detail modal is open for this card, refresh its content
                if (installmentDetailModal && installmentDetailModal.open && installmentDetailCardIdInput && installmentDetailCardIdInput.value === cardId) {
                    refreshInstallmentDetailModal(cardId);
                }
                // Also refresh transaction detail modal if it's open (due to removed payment txs)
                if (transactionDetailModal && transactionDetailModal.open && transactionDetailCardIdInput && transactionDetailCardIdInput.value === cardId) {
                    refreshTransactionDetailModal(cardId);
                }
            } else {
                alert('Error: No se pudo encontrar la compra a plazo.');
            }
        } else {
            console.error('Card not found for ID:', cardId);
            alert('Error: No se pudo encontrar la tarjeta asociada para eliminar la compra a plazo.');
        }
    };

    // --- NEW: Budget Functions ---

    const renderBudget = () => {
        // Defensive check: Ensure budget object has required properties.
        if (budget) {
            if (typeof budget.totalAmount === 'undefined') budget = null;
            if (typeof budget.startDate === 'undefined') budget.startDate = new Date().toISOString().split('T')[0];
            if (typeof budget.expenses === 'undefined') budget.expenses = [];
            if (typeof budget.rolloverOption === 'undefined') budget.rolloverOption = 'nextDay';
        }

        if (!budget || !budget.totalAmount) {
            budgetSetup.classList.remove('hidden');
            budgetDashboard.classList.add('hidden');
            return;
        }

        budgetSetup.classList.add('hidden');
        budgetDashboard.classList.remove('hidden');

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startDate = new Date(budget.startDate);
        const startOfMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        
        // If we are in a new month, reset the budget
        if (today.getMonth() !== startDate.getMonth() || today.getFullYear() !== startDate.getFullYear()) {
             if (confirm('¡Nuevo mes! ¿Quieres reiniciar tu presupuesto para este mes con el mismo monto? Se borrarán los gastos del mes pasado.')) {
                budget.startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                budget.expenses = [];
                localStorage.setItem('budget', JSON.stringify(budget));
             }
        }

        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const totalDaysInMonth = endOfMonth.getDate();
        const daysPassed = (today - startOfMonth) / (1000 * 60 * 60 * 24);
        const daysRemaining = totalDaysInMonth - today.getDate();

        let totalSpentThisMonth = 0;
        let spentToday = 0;

        // NEW: Calculate spending based on budget's own expenses
        budget.expenses.forEach(expense => {
            const expenseDate = new Date(expense.date + 'T00:00:00');
             if (expenseDate.getMonth() === today.getMonth() && expenseDate.getFullYear() === today.getFullYear()) {
                totalSpentThisMonth += expense.amount;
            }
            if(expenseDate.toDateString() === today.toDateString()) {
                spentToday += expense.amount;
            }
        });

        const remainingBudget = budget.totalAmount - totalSpentThisMonth;
        
        // Calculate recommended daily spending
        const idealSpentToDate = (budget.totalAmount / totalDaysInMonth) * (daysPassed + 1);
        const diff = idealSpentToDate - totalSpentThisMonth;

        let dailyRecommendation = remainingBudget / (daysRemaining + 1);

        if (budget.rolloverOption === 'nextDay' && diff > 0) {
             dailyRecommendation = (remainingBudget / (daysRemaining + 1)) + (diff / (daysRemaining + 1));
        } else if(budget.rolloverOption === 'distribute' && diff > 0) {
            dailyRecommendation = remainingBudget / (daysRemaining + 1);
        }
        
        document.getElementById('budget-remaining-amount').textContent = formatCurrency(remainingBudget);
        document.getElementById('budget-progress').value = (totalSpentThisMonth / budget.totalAmount) * 100;
        document.getElementById('budget-spent-label').textContent = `Gastado: ${formatCurrency(totalSpentThisMonth)}`;
        document.getElementById('budget-total-label').textContent = `Total: ${formatCurrency(budget.totalAmount)}`;
        document.getElementById('budget-daily-recommendation').textContent = formatCurrency(Math.max(0, dailyRecommendation));
        document.getElementById('budget-spent-today').textContent = formatCurrency(spentToday);
        document.getElementById('budget-days-remaining').textContent = daysRemaining + 1;

        // NEW: Render budget expenses list
        renderBudgetExpenses();
    };

    const handleSaveBudget = (e) => {
        e.preventDefault();
        const formData = new FormData(budgetForm);
        const amount = parseFloat(formData.get('budget-amount'));
        const rollover = formData.get('rollover-option');

        if (amount > 0) {
            if (budget) { // Editing existing budget
                budget.totalAmount = amount;
                budget.rolloverOption = rollover;
            } else { // Creating a new budget
                budget = {
                    totalAmount: amount,
                    rolloverOption: rollover,
                    startDate: new Date().toISOString().split('T')[0],
                    expenses: [] // Initialize expenses array
                };
            }
            budgetModal.close();
            updateUI();
        } else {
            alert('Por favor, ingresa un monto de presupuesto válido.');
        }
    };

    // NEW: Functions for Budget Expenses
    const renderBudgetExpenses = () => {
        if (!budget || !budget.expenses) return;

        const expensesThisMonth = budget.expenses
            .filter(exp => {
                const expDate = new Date(exp.date + 'T00:00:00');
                const today = new Date();
                return expDate.getMonth() === today.getMonth() && expDate.getFullYear() === today.getFullYear();
            })
            .sort((a,b) => new Date(b.date) - new Date(a.date));
        
        noBudgetExpensesMessage.classList.toggle('hidden', expensesThisMonth.length > 0);
        budgetExpenseListContainer.innerHTML = '';
        
        expensesThisMonth.forEach(expense => {
            const expenseEl = document.createElement('div');
            expenseEl.className = 'budget-expense-item';
            expenseEl.innerHTML = `
                <div class="budget-expense-info">
                    <span>${expense.description}</span>
                    <span>${formatDate(expense.date)}</span>
                </div>
                <div class="budget-expense-amount">${formatCurrency(expense.amount)}</div>
                <button class="icon-button small danger" data-expense-id="${expense.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            `;
            expenseEl.querySelector('button').addEventListener('click', () => handleDeleteBudgetExpense(expense.id));
            budgetExpenseListContainer.appendChild(expenseEl);
        });
    };

    const handleSaveBudgetExpense = (e) => {
        e.preventDefault();
        const formData = new FormData(budgetExpenseForm);
        const newExpense = {
            id: generateUUID(), // Use our compatible UUID generator
            description: formData.get('description'),
            amount: parseFloat(formData.get('amount')),
            date: formData.get('date'),
        };
        budget.expenses.push(newExpense);
        budgetExpenseModal.close();
        updateUI();
    };

    const handleDeleteBudgetExpense = (expenseId) => {
        if (confirm('¿Estás seguro de que quieres eliminar este gasto?')) {
            budget.expenses = budget.expenses.filter(exp => exp.id !== expenseId);
            updateUI();
        }
    };

    // New: Handle card selection from sidebar
    const handleCardSelection = (cardId) => {
        selectedCardId = cardId;
        updateUI();
        switchMobileView('home'); // Go to home view to see details on both mobile and desktop
    };

    // Callback to pass to render.js for opening transaction modal
    let addTransactionModalCallback = null;
    const handleAddTransactionClick = (cardId) => {
        if (addTransactionModalCallback) {
            addTransactionModalCallback(cardId);
        }
    };

    // New: Callback to store the function that opens the card modal
    let openCardModalCallback = null;

    // NEW: Functions to handle opening and rendering Transaction/Installment Details Modals
    const refreshTransactionDetailModal = (cardId) => {
        const card = cards.find(c => c.id === cardId);
        if (!card) return;

        transactionDetailCardAlias.textContent = card.alias;
        transactionDetailCardIdInput.value = card.id;

        const transactionsForDisplay = [...card.transactions]
            .filter(tx => tx.type !== 'installment_purchase') // Exclude raw installment purchases
            .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date, most recent first

        // Render list view
        transactionDetailTableBody.innerHTML = transactionsForDisplay.map(tx => createTransactionRowHtml(tx, card.id)).join('');

        if (transactionsForDisplay.length === 0) {
            noTransactionsMessage.classList.remove('hidden');
        } else {
            noTransactionsMessage.classList.add('hidden');
        }

        // Render calendar view
        currentCalendarDate = new Date();
        renderCalendar(cardId, currentCalendarDate);

        // Reset to calendar view (changed from list to calendar)
        switchTransactionView('calendar');

        // Re-attach listeners for delete buttons within the modal content
        setupTransactionActionListeners(transactionDetailTableBody, handleDeleteTransaction);
    };

    const handleViewTransactionsClick = (cardId) => {
        refreshTransactionDetailModal(cardId);
        transactionDetailModal.showModal();
    };

    const refreshInstallmentDetailModal = (cardId) => {
        const card = cards.find(c => c.id === cardId);
        if (!card) return;

        installmentDetailCardAlias.textContent = card.alias;
        installmentDetailCardIdInput.value = card.id;

        const installmentPurchases = card.transactions.filter(tx => tx.type === 'installment_purchase');

        installmentDetailList.innerHTML = installmentPurchases.map(inst => createInstallmentItemHtml(inst, card.id)).join('');

        if (installmentPurchases.length === 0) {
            noInstallmentsMessageModal.classList.remove('hidden');
        } else {
            noInstallmentsMessageModal.classList.add('hidden');
        }

        // Re-attach listeners for installment action buttons within the modal content
        setupInstallmentActionListeners(installmentDetailList, handlePayInstallment);
        setupInstallmentDeleteActionListeners(installmentDetailList, handleDeleteInstallment);
    };

    const handleViewInstallmentsClick = (cardId) => {
        refreshInstallmentDetailModal(cardId);
        installmentDetailModal.showModal();
    };

    // NEW: Calendar functions
    const switchTransactionView = (view) => {
        currentCalendarView = view;
        
        // Update toggle buttons
        transactionListViewBtn.classList.toggle('active', view === 'list');
        transactionCalendarViewBtn.classList.toggle('active', view === 'calendar');
        
        // Update view visibility
        transactionListView.classList.toggle('hidden', view !== 'list');
        transactionCalendarView.classList.toggle('hidden', view !== 'calendar');
        transactionDayDetail.classList.toggle('hidden', view !== 'day');
    };

    const renderCalendar = (cardId, date = new Date()) => {
        const card = cards.find(c => c.id === cardId);
        if (!card) return;

        const year = date.getFullYear();
        const month = date.getMonth();
        
        // Update header
        calendarMonthYear.textContent = new Intl.DateTimeFormat('es-ES', { 
            month: 'long', 
            year: 'numeric' 
        }).format(date);

        // Get transactions for this month
        const transactionsForDisplay = card.transactions
            .filter(tx => tx.type !== 'installment_purchase')
            .filter(tx => {
                const txDate = new Date(tx.date + 'T00:00:00');
                return txDate.getFullYear() === year && txDate.getMonth() === month;
            });

        // Group transactions by day
        const transactionsByDay = {};
        transactionsForDisplay.forEach(tx => {
            const day = new Date(tx.date + 'T00:00:00').getDate();
            if (!transactionsByDay[day]) {
                transactionsByDay[day] = [];
            }
            transactionsByDay[day].push(tx);
        });

        // Clear existing calendar days (keep headers)
        const existingDays = calendarGrid.querySelectorAll('.calendar-day');
        existingDays.forEach(day => day.remove());

        // Calculate calendar layout
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const firstDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        // Add previous month's trailing days
        const prevMonth = new Date(year, month - 1, 0);
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const day = prevMonth.getDate() - i;
            const dayEl = createCalendarDay(day, true, []);
            calendarGrid.appendChild(dayEl);
        }

        // Add current month's days
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month, day);
            const isToday = dayDate.toDateString() === today.toDateString();
            const dayTransactions = transactionsByDay[day] || [];
            const dayEl = createCalendarDay(day, false, dayTransactions, isToday, cardId);
            calendarGrid.appendChild(dayEl);
        }

        // Add next month's leading days
        const remainingCells = 42 - (firstDayOfWeek + daysInMonth);
        for (let day = 1; day <= remainingCells && remainingCells < 7; day++) {
            const dayEl = createCalendarDay(day, true, []);
            calendarGrid.appendChild(dayEl);
        }

        // Show/hide no transactions message
        noTransactionsCalendarMessage.classList.toggle('hidden', transactionsForDisplay.length > 0);
    };

    const createCalendarDay = (dayNumber, isOtherMonth, transactions, isToday = false, cardId = null) => {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        
        if (isOtherMonth) {
            dayEl.classList.add('other-month');
        }
        if (isToday) {
            dayEl.classList.add('today');
        }
        if (transactions.length > 0) {
            dayEl.classList.add('has-transactions');
        }

        dayEl.innerHTML = `
            <div class="calendar-day-number">${dayNumber}</div>
            <div class="calendar-transaction-indicators">
                ${transactions.slice(0, 3).map(tx => 
                    `<div class="calendar-transaction-dot ${tx.type}"></div>`
                ).join('')}
            </div>
            ${transactions.length > 0 ? `<div class="calendar-transaction-count">${transactions.length}</div>` : ''}
        `;

        if (transactions.length > 0 && !isOtherMonth) {
            dayEl.addEventListener('click', () => showDayDetail(dayNumber, transactions, cardId));
        }

        return dayEl;
    };

    const showDayDetail = (day, transactions, cardId) => {
        selectedDayTransactions = transactions;
        const card = cards.find(c => c.id === cardId);
        const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(currentCalendarDate);
        
        dayDetailTitle.textContent = `${day} de ${monthName}`;
        
        dayTransactionsList.innerHTML = transactions.map(tx => {
            const isPayment = tx.type === 'payment';
            const amountClass = isPayment ? 'payment-text' : 'expense-text';
            const amountSign = isPayment ? '-' : '+';
            
            return `
                <div class="day-transaction-item">
                    <div class="day-transaction-info">
                        <div class="day-transaction-description">${tx.description}</div>
                        <div class="day-transaction-type">${isPayment ? 'Pago' : 'Gasto'}</div>
                    </div>
                    <div class="day-transaction-amount ${amountClass}">
                        ${amountSign} ${formatCurrency(tx.amount)}
                    </div>
                    <button class="icon-button small danger" 
                        data-card-id="${cardId}" 
                        data-transaction-id="${tx.id}"
                        data-action="delete-transaction"
                        aria-label="Eliminar movimiento">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
        }).join('');

        // Re-attach listeners for delete buttons
        setupTransactionActionListeners(dayTransactionsList, handleDeleteTransaction);
        
        switchTransactionView('day');
    };

    // NEW: Calendar event listeners
    transactionListViewBtn?.addEventListener('click', () => switchTransactionView('list'));
    transactionCalendarViewBtn?.addEventListener('click', () => switchTransactionView('calendar'));
    
    calendarPrevMonth?.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        const cardId = transactionDetailCardIdInput.value;
        renderCalendar(cardId, currentCalendarDate);
    });
    
    calendarNextMonth?.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        const cardId = transactionDetailCardIdInput.value;
        renderCalendar(cardId, currentCalendarDate);
    });
    
    backToCalendar?.addEventListener('click', () => {
        switchTransactionView('calendar');
    });

    // NEW: Zoom functionality
    const applyZoom = (level) => {
        zoomLevel = level;
        document.documentElement.style.fontSize = `${level}%`;
        localStorage.setItem('zoomLevel', level);
        if (zoomSlider) zoomSlider.value = level;
        if (zoomValue) zoomValue.textContent = `${level}%`;
    };

    const setupZoomControls = () => {
        if (!zoomSlider || !zoomValue || !zoomResetBtn) return;

        zoomSlider.addEventListener('input', (e) => {
            applyZoom(parseInt(e.target.value));
        });

        zoomResetBtn.addEventListener('click', () => {
            const defaultZoom = window.innerWidth >= 992 ? 85 : 100;
            applyZoom(defaultZoom);
        });

        // Initialize zoom
        applyZoom(zoomLevel);
    };

    // --- Mobile Navigation Logic ---
    const updateMobileHeader = () => {
        const view = appLayout.dataset.view;
        const hasCards = cards.length > 0;
        if (view === 'home') {
            mobileHeaderTitle.textContent = hasCards ? 'Resumen' : 'Credit Tracker';
            mobileBackBtn.classList.add('hidden');
        } else if (view === 'cards') {
            mobileHeaderTitle.textContent = 'Mis Tarjetas';
            mobileBackBtn.classList.add('hidden');
        } else if (view === 'budget') {
            mobileHeaderTitle.textContent = 'Presupuesto';
            mobileBackBtn.classList.add('hidden');
        } else if (view === 'settings') {
            mobileHeaderTitle.textContent = 'Ajustes';
            mobileBackBtn.classList.add('hidden');
        }
    };
    
    const switchMobileView = (view) => {
        appLayout.dataset.view = view;

        // Hide all main sections first
        document.getElementById('summary').classList.add('hidden');
        document.getElementById('payments-summary').classList.add('hidden');
        document.getElementById('installments-summary').classList.add('hidden');
        document.getElementById('card-detail-section').classList.add('hidden');
        document.getElementById('no-cards-message').classList.add('hidden');
        document.getElementById('select-card-message').classList.add('hidden');
        budgetSection.classList.add('hidden');
        settingsSection.classList.add('hidden');
        desktopCardsListSection.classList.add('hidden');
        
        // Show the correct section based on the view
        if (view === 'home') {
            const hasCards = cards.length > 0;
            document.getElementById('summary').classList.toggle('hidden', !hasCards);
            document.getElementById('payments-summary').classList.toggle('hidden', !hasCards);
            
            // Check for active installments in actual data instead of DOM
            let hasActiveInstallments = false;
            if (hasCards) {
                cards.forEach(card => {
                    card.transactions.forEach(tx => {
                        if (tx.type === 'installment_purchase' && tx.paidMonths < tx.months) {
                            hasActiveInstallments = true;
                        }
                    });
                });
            }
            document.getElementById('installments-summary').classList.toggle('hidden', !hasCards || !hasActiveInstallments);
            
            document.getElementById('card-detail-section').classList.toggle('hidden', !hasCards);
            noCardsMessage.classList.toggle('hidden', hasCards);
            selectCardMessage.classList.toggle('hidden', !hasCards || !!selectedCardId);
        } else if (view === 'cards') {
            // On desktop, show the desktop cards list in main content
            if (window.innerWidth >= 992) {
                desktopCardsListSection.classList.remove('hidden');
                renderDesktopCardsList();
            }
            // This view is handled by the app-layout data attribute in CSS for mobile
            // Explicitly ensure installments summary stays hidden
            document.getElementById('installments-summary').classList.add('hidden');
        } else if (view === 'budget') {
            budgetSection.classList.remove('hidden');
            // Explicitly ensure installments summary stays hidden
            document.getElementById('installments-summary').classList.add('hidden');
        } else if (view === 'settings') {
            settingsSection.classList.remove('hidden');
            // Explicitly ensure installments summary stays hidden
            document.getElementById('installments-summary').classList.add('hidden');
        }

        mobileNav.classList.remove('hidden'); // Nav is always visible now unless a modal is open

        mobileNavBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // NEW: Update desktop nav buttons
        desktopNavBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        updateMobileHeader();
        mainContentPanel.scrollTo(0, 0); // Scroll to top on view change
    };

    // NEW: Function to render desktop cards list
    const renderDesktopCardsList = () => {
        const hasCards = cards.length > 0;
        
        desktopNoCardsMessage.classList.toggle('hidden', hasCards);
        desktopCardsGrid.style.display = hasCards ? '' : 'none';
        
        if (hasCards) {
            desktopCardsGrid.innerHTML = '';
            cards.forEach(card => {
                const item = document.importNode(cardListItemTemplate.content, true);
                const details = calculateCardDetails(card);
                
                item.querySelector('.card-list-item').dataset.cardId = card.id;
                if (card.id === selectedCardId) {
                    item.querySelector('.card-list-item-button').classList.add('active');
                }
                item.querySelector('[data-id="alias"]').textContent = card.alias;
                item.querySelector('[data-id="bank-last4"]').textContent = `${card.bank} - ${card.last4}`;
                item.querySelector('[data-id="currentBalance"]').textContent = formatCurrency(details.currentBalance);
                
                // Add click listener for card selection
                item.querySelector('.card-list-item-button').addEventListener('click', () => {
                    handleCardSelection(card.id);
                });
                
                desktopCardsGrid.appendChild(item);
            });
        }
    };

    mobileNavBtns.forEach(btn => {
        btn.addEventListener('click', () => switchMobileView(btn.dataset.view));
    });

    // NEW: Desktop nav event listeners
    desktopNavBtns.forEach(btn => {
        btn.addEventListener('click', () => switchMobileView(btn.dataset.view));
    });
    
    mobileBackBtn.addEventListener('click', () => {
        // This button is now hidden, but keeping logic in case it's re-introduced
        if (appLayout.dataset.view === 'cards') {
            switchMobileView('home');
        }
    });

    addCardFromEmptyStateBtn.addEventListener('click', () => {
        if (openCardModalCallback) {
            openCardModalCallback(); // Open 'add card' modal
        }
    });

    // NEW: Desktop cards list event listeners
    addCardBtnDesktopList?.addEventListener('click', () => {
        if (openCardModalCallback) {
            openCardModalCallback();
        }
    });

    addCardFromDesktopEmptyState?.addEventListener('click', () => {
        if (openCardModalCallback) {
            openCardModalCallback();
        }
    });

    // NEW: Generic setup for all summary toggles
    summaryToggles.forEach(toggle => {
        if (toggle.btn && toggle.grid) {
            toggle.btn.addEventListener('click', () => {
                const isExpanded = toggle.btn.getAttribute('aria-expanded') === 'true';
                toggle.btn.setAttribute('aria-expanded', !isExpanded);
                toggle.grid.classList.toggle('hidden');
            });
        }
    });

    // NEW: Setup close listeners for the new detail modals
    setupModalClose(transactionDetailModal);
    setupModalClose(installmentDetailModal);
    setupModalClose(themeModal);
    setupModalClose(budgetModal);
    setupModalClose(budgetExpenseModal); // NEW

    // Event listeners for new UI elements
    addCardBtnSidebar?.addEventListener('click', () => {
        if (openCardModalCallback) {
            openCardModalCallback(); // Directly call the stored callback to open the modal
        }
    });

    editCardBtn?.addEventListener('click', () => {
        if (openCardModalCallback) {
            const selectedCard = cards.find(c => c.id === selectedCardId);
            if (selectedCard) {
                openCardModalCallback(selectedCard);
            }
        }
    });

    // NEW: Budget event listeners
    setupBudgetBtn?.addEventListener('click', () => budgetModal.showModal());
    editBudgetBtn?.addEventListener('click', () => {
        document.getElementById('budget-amount').value = budget.totalAmount;
        document.querySelector(`input[name="rollover-option"][value="${budget.rolloverOption}"]`).checked = true;
        budgetModal.showModal();
    });
    resetBudgetBtn?.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres reiniciar el presupuesto para el mes actual? Se conservará el monto total y se borrarán los gastos registrados.')) {
            budget.startDate = new Date().toISOString().split('T')[0];
            budget.expenses = [];
            updateUI();
        }
    });
    budgetForm?.addEventListener('submit', handleSaveBudget);

    // NEW: Budget Expense Listeners
    addBudgetExpenseBtn?.addEventListener('click', () => {
        budgetExpenseForm.reset();
        document.getElementById('budget-expense-date').value = new Date().toISOString().split('T')[0];
        budgetExpenseModal.showModal();
    });
    budgetExpenseForm?.addEventListener('submit', handleSaveBudgetExpense);

    // NEW: Add event listener for modal close buttons
    document.querySelectorAll('dialog').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target.matches('.close') || e.target.hasAttribute('data-close-modal')) {
                modal.close();
            }
        });
    });

    // --- INITIALIZE MODULES ---
    setupCardModal(cardModal, cardForm, handleSaveCard, (callback) => {
        openCardModalCallback = callback; // Store the callback from modals.js
    });
    setupTransactionModal(transactionModal, transactionForm, installmentsGroup, typeSelect, handleSaveTransaction, (callback) => {
        addTransactionModalCallback = callback; // Store the callback from modals.js for later use by render.js
    });
    
    // NEW: Setup theme selector modal
    setupThemeSelector(themeModal, themeSelectorContainer, [themeSwitcher, mobileThemeSwitcher]);
    
    // NEW: Setup for both sets of import/export buttons with zoom support
    const getCardsRef = () => cards;
    const getBudgetRef = () => budget;
    const getZoomRef = () => zoomLevel;

    setupDataImportExport(exportBtnSidebar, importBtnSidebar, importFileSidebar, getCardsRef, getBudgetRef, getZoomRef, handleImportSuccess);
    setupDataImportExport(exportBtnSettings, importBtnSettings, importFileSettings, getCardsRef, getBudgetRef, getZoomRef, handleImportSuccess);

    // NEW: Setup zoom controls
    setupZoomControls();

    // Initial Render
    switchMobileView('home'); // Set initial view for mobile
    updateUI();
});