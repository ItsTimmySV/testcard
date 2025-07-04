import { formatCurrency, formatDate } from './utils.js';
import { calculateCardDetails } from './calculations.js';

// Function to attach event listeners specific to card actions
const setupCardActionListeners = (onDeleteCard, onAddTransaction, onCardSelect, onViewTransactions, onViewInstallments) => {
    // Main card detail actions
    document.querySelectorAll('[data-action="add-transaction"]').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.closest('.card').dataset.cardId;
            onAddTransaction(cardId);
        };
    });
    document.querySelectorAll('[data-action="delete-card"]').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.closest('.card').dataset.cardId;
            if (confirm('¿Estás seguro de que quieres eliminar esta tarjeta y todos sus movimientos?')) {
                onDeleteCard(cardId);
            }
        };
    });
    document.querySelectorAll('[data-action="view-transactions"]').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.closest('.card').dataset.cardId;
            onViewTransactions(cardId);
        };
    });
    document.querySelectorAll('[data-action="view-installments"]').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.closest('.card').dataset.cardId;
            onViewInstallments(cardId);
        };
    });

    // Sidebar/list card selection
    document.querySelectorAll('.card-list-item-button').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.closest('.card-list-item').dataset.cardId;
            onCardSelect(cardId);
        };
    });
};

// Function to attach event listeners specific to installment payments within a given container
export const setupInstallmentActionListeners = (containerEl, onPayInstallment) => {
    containerEl.querySelectorAll('.pay-installment-btn').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.dataset.cardId;
            const installmentId = e.currentTarget.dataset.installmentId;
            onPayInstallment(cardId, installmentId);
        };
    });
};

// Function to attach event listeners specific to transaction deletion within a given container
export const setupTransactionActionListeners = (containerEl, onDeleteTransaction) => {
    containerEl.querySelectorAll('[data-action="delete-transaction"]').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.dataset.cardId;
            const transactionId = e.currentTarget.dataset.transactionId;
            onDeleteTransaction(cardId, transactionId);
        };
    });
};

// NEW: Function to attach event listeners for installment deletion within a given container
export const setupInstallmentDeleteActionListeners = (containerEl, onDeleteInstallment) => {
    containerEl.querySelectorAll('[data-action="delete-installment"]').forEach(btn => {
        btn.onclick = (e) => {
            const cardId = e.currentTarget.dataset.cardId;
            const installmentId = e.currentTarget.dataset.installmentId;
            onDeleteInstallment(cardId, installmentId);
        };
    });
};

// NEW: Function to generate HTML for a single transaction row
export const createTransactionRowHtml = (tx, cardId) => {
    const isPayment = tx.type === 'payment';
    const amountClass = isPayment ? 'payment-text' : 'expense-text';
    const amountSign = isPayment ? '-' : '+';
    const formattedAmount = `${amountSign} ${formatCurrency(tx.amount)}`;
    
    // Filter out installment_purchase from main transaction list in the modal too
    if (tx.type === 'installment_purchase') return '';

    return `
        <tr>
            <td>${formatDate(tx.date)}</td>
            <td>${tx.description}</td>
            <td class="align-right ${amountClass}">${formattedAmount}</td>
            <td class="align-center">
                <button class="icon-button small danger" 
                    data-card-id="${cardId}" 
                    data-transaction-id="${tx.id}"
                    data-action="delete-transaction"
                    aria-label="Eliminar movimiento">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </td>
        </tr>
    `;
};

// NEW: Function to generate HTML for a single installment item
export const createInstallmentItemHtml = (inst, cardId) => {
    return `
        <article class="installment-item" data-installment-id="${inst.id}">
            <div class="installment-item-header">
                <h6>${inst.description}</h6>
                <button class="icon-button small danger installment-delete-btn" 
                    data-card-id="${cardId}" 
                    data-installment-id="${inst.id}"
                    data-action="delete-installment"
                    aria-label="Eliminar compra a plazo">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
             <div class="installment-progress">
                <div class="installment-progress-info">
                    <span>${formatCurrency(inst.remainingAmount)} restantes</span>
                    <span>${inst.paidMonths} / ${inst.months} meses</span>
                </div>
                <progress value="${inst.paidMonths}" max="${inst.months}"></progress>
            </div>
            <div class="installment-details">
                <div><small>Monto Original</small><p>${formatCurrency(inst.totalAmount)}</p></div>
                <div><small>Mensualidad</small><p>${formatCurrency(inst.monthlyPayment)}</p></div>
            </div>
            <div class="installment-actions">
                <button class="gradient-button small pay-installment-btn" 
                    data-card-id="${cardId}" 
                    data-installment-id="${inst.id}"
                    ${inst.paidMonths >= inst.months ? 'disabled' : ''}>
                    Pagar Mes ${inst.paidMonths + 1}
                </button>
            </div>
        </article>
    `;
};

// Main render function for all content
export const renderAppContent = (cards, selectedCardId, cardsContainer, sidebarCardListEl, cardTemplate, cardListItemTemplate, noCardsMessageEl, selectCardMessageEl, callbacks) => {
    const cardDetailTitle = document.getElementById('card-detail-title');
    
    // 1. Render Card List
    sidebarCardListEl.innerHTML = '';
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
        
        sidebarCardListEl.appendChild(item);
    });

    // 2. Render Selected Card Details or appropriate message
    cardsContainer.innerHTML = '';
    const selectedCard = cards.find(c => c.id === selectedCardId);
    
    // Toggle visibility of sections based on state
    const hasCards = cards.length > 0;
    // On Desktop, these are always visible if there are cards
    document.getElementById('summary').style.display = hasCards ? '' : 'none';
    document.getElementById('payments-summary').style.display = hasCards ? '' : 'none';
    document.getElementById('card-detail-section').style.display = hasCards ? '' : 'none';

    noCardsMessageEl.classList.toggle('hidden', hasCards);
    selectCardMessageEl.classList.toggle('hidden', !hasCards || !!selectedCard);
    cardsContainer.style.display = !!selectedCard ? '' : 'none';

    if (selectedCard) {
        cardDetailTitle.textContent = selectedCard.alias;
        const cardElement = document.importNode(cardTemplate.content, true);
        const details = calculateCardDetails(selectedCard);
        
        cardElement.querySelector('.card').dataset.cardId = selectedCard.id;
        cardElement.querySelector('[data-id="currentBalance"]').textContent = formatCurrency(details.currentBalance);
        cardElement.querySelector('[data-id="availableCredit"]').textContent = formatCurrency(details.availableCredit);
        cardElement.querySelector('[data-id="limit"]').textContent = formatCurrency(selectedCard.limit);
        const creditUsage = selectedCard.limit > 0 ? (details.currentBalance / selectedCard.limit) * 100 : 0;
        cardElement.querySelector('[data-id="credit-progress"]').value = creditUsage;
        
        cardElement.querySelector('[data-id="paymentForPeriod"]').textContent = formatCurrency(details.paymentForPeriod);
        cardElement.querySelector('[data-id="nextPayment"]').textContent = formatCurrency(details.nextPayment);
        cardElement.querySelector('[data-id="nextCutoffDate"]').textContent = details.nextCutoffDate;
        cardElement.querySelector('[data-id="paymentDueDate"]').textContent = details.paymentDueDate;

        cardsContainer.appendChild(cardElement);
    } else {
        cardDetailTitle.textContent = "Detalles de la Tarjeta";
    }

    // Attach event listeners after rendering all
    setupCardActionListeners(
        callbacks.onDeleteCard, 
        callbacks.onAddTransaction, 
        callbacks.onCardSelect,
        callbacks.onViewTransactions,
        callbacks.onViewInstallments
    );
};

// Render summary totals
export const renderSummary = (cards, totalDebtEl, totalAvailableEl, totalLimitEl) => {
    let totalLimit = 0;
    let totalDebt = 0;
    let totalPaymentForPeriod = 0;
    let totalNextPayment = 0;
    let totalInstallmentsDebt = 0;
    let totalInstallmentsMonthly = 0;
    let totalActiveInstallments = 0;

    cards.forEach(card => {
        const details = calculateCardDetails(card);
        totalLimit += card.limit;
        totalDebt += details.currentBalance;
        totalPaymentForPeriod += details.paymentForPeriod;
        totalNextPayment += details.nextPayment;

        card.transactions.forEach(tx => {
            if (tx.type === 'installment_purchase' && tx.paidMonths < tx.months) {
                totalInstallmentsDebt += tx.remainingAmount;
                totalInstallmentsMonthly += tx.monthlyPayment;
                totalActiveInstallments++;
            }
        });
    });

    const totalAvailable = totalLimit - totalDebt;

    totalDebtEl.textContent = formatCurrency(totalDebt);
    totalAvailableEl.textContent = formatCurrency(totalAvailable);
    totalLimitEl.textContent = formatCurrency(totalLimit);

    // Render new summary items for period payment and next payment
    const totalPaymentForPeriodEl = document.getElementById('total-payment-for-period');
    const totalNextPaymentEl = document.getElementById('total-next-payment');
    if (totalPaymentForPeriodEl) totalPaymentForPeriodEl.textContent = formatCurrency(totalPaymentForPeriod);
    if (totalNextPaymentEl) totalNextPaymentEl.textContent = formatCurrency(totalNextPayment);

    // Calculate and render installment summary
    const installmentsSummarySection = document.getElementById('installments-summary');
    const totalInstallmentsDebtEl = document.getElementById('total-installments-debt');
    const totalInstallmentsMonthlyEl = document.getElementById('total-installments-monthly');
    const totalActiveInstallmentsEl = document.getElementById('total-active-installments');

    if (installmentsSummarySection && totalActiveInstallments > 0) {
        // The section's visibility is controlled by switchMobileView.
        // This function just ensures the content is up-to-date.
        // The section itself is shown/hidden based on the current view.
        if (totalInstallmentsDebtEl) totalInstallmentsDebtEl.textContent = formatCurrency(totalInstallmentsDebt);
        if (totalInstallmentsMonthlyEl) totalInstallmentsMonthlyEl.textContent = formatCurrency(totalInstallmentsMonthly);
        if (totalActiveInstallmentsEl) totalActiveInstallmentsEl.textContent = totalActiveInstallments;
    } else if (installmentsSummarySection) {
        // Clear content if there are no active installments.
        if (totalInstallmentsDebtEl) totalInstallmentsDebtEl.textContent = formatCurrency(0);
        if (totalInstallmentsMonthlyEl) totalInstallmentsMonthlyEl.textContent = formatCurrency(0);
        if (totalActiveInstallmentsEl) totalActiveInstallmentsEl.textContent = '0';
    }
};