import { formatDate } from './utils.js';

// Helper function to get the last day of the month
function getLastDayOfMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

// Helper function to get adjusted date considering month boundaries
function getAdjustedDate(year, month, day) {
    const lastDay = getLastDayOfMonth(year, month);
    const adjustedDay = Math.min(day, lastDay);
    return new Date(year, month, adjustedDay);
}

export const calculateCardDetails = (card) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to start of day
    
    let currentBalance = 0;
    let accumulatedCashback = 0;

    card.transactions.forEach(tx => {
         if (tx.type === 'expense') {
             currentBalance += tx.amount;
             // Calculate cashback for expenses if card has cashback
             if (card.hasCashback && card.cashbackPercentage > 0) {
                 accumulatedCashback += tx.amount * (card.cashbackPercentage / 100);
             }
         } else if (tx.type === 'payment') {
             currentBalance -= tx.amount;
         } else if (tx.type === 'installment_purchase') {
             // For installment purchases, only the remaining amount contributes to the current balance
             currentBalance += tx.remainingAmount;
             // Calculate cashback for installment purchases if card has cashback
             if (card.hasCashback && card.cashbackPercentage > 0) {
                 accumulatedCashback += tx.totalAmount * (card.cashbackPercentage / 100);
             }
         }
    });

    // Calculate current statement cycle dates with proper month/year handling
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // Get cutoff day adjusted for current month
    const currentCutoff = getAdjustedDate(currentYear, currentMonth, card.cutoffDay);
    
    // Determine if we're before or after cutoff this month
    const isAfterCutoff = today > currentCutoff;
    
    // Calculate next cutoff date (always in future)
    let nextCutoff;
    if (isAfterCutoff) {
        // Next cutoff is next month
        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
        nextCutoff = getAdjustedDate(nextYear, nextMonth, card.cutoffDay);
    } else {
        // Next cutoff is this month
        nextCutoff = currentCutoff;
    }
    
    // Calculate previous cutoff (for payment to avoid interest)
    let prevCutoff;
    if (isAfterCutoff) {
        prevCutoff = currentCutoff;
    } else {
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        prevCutoff = getAdjustedDate(prevYear, prevMonth, card.cutoffDay);
    }
    
    // Calculate payment due date (always after the cutoff that corresponds to paymentForPeriod)
    const paymentCutoff = isAfterCutoff ? currentCutoff : prevCutoff;
    const paymentMonth = paymentCutoff.getMonth();
    const paymentYear = paymentCutoff.getFullYear();
    let paymentDueDate = getAdjustedDate(paymentYear, paymentMonth, card.paymentDay);
    
    // If payment day is before cutoff day, it's in next month
    if (card.paymentDay < card.cutoffDay) {
        paymentDueDate.setMonth(paymentDueDate.getMonth() + 1);
    }
    
    // --- Calculate 'Pago para no generar intereses' ---
    // This includes all transactions from the PREVIOUS billing period
    let paymentForPeriodAmount = 0;
    
    // Calculate the cutoff before the previous cutoff
    let prevPrevCutoff;
    const prevPrevMonth = prevCutoff.getMonth() === 0 ? 11 : prevCutoff.getMonth() - 1;
    const prevPrevYear = prevCutoff.getMonth() === 0 ? prevCutoff.getFullYear() - 1 : prevCutoff.getFullYear();
    prevPrevCutoff = getAdjustedDate(prevPrevYear, prevPrevMonth, card.cutoffDay);
    
    card.transactions.forEach(tx => {
        const txDate = new Date(tx.date + 'T00:00:00');
        // Transactions from prevPrevCutoff (exclusive) to prevCutoff (inclusive)
        if (txDate > prevPrevCutoff && txDate <= prevCutoff) {
            if (tx.type === 'expense') {
                paymentForPeriodAmount += tx.amount;
            } else if (tx.type === 'payment' && !tx.relatedInstallmentId) {
                paymentForPeriodAmount -= tx.amount;
            }
        }
    });
    
    // Add installment payments due in the previous period
    const activeInstallments = card.transactions.filter(tx => tx.type === 'installment_purchase' && tx.paidMonths < tx.months);
    activeInstallments.forEach(inst => {
        const purchaseDate = new Date(inst.date + 'T00:00:00');
        // If the purchase was made before the previous cutoff, a payment was due in that period
        if (prevCutoff > purchaseDate) {
            // Check if a payment for this installment was made within the previous period
            const wasPaidInPrevPeriod = card.transactions.some(p => 
                p.relatedInstallmentId === inst.id &&
                new Date(p.date + 'T00:00:00') > prevPrevCutoff &&
                new Date(p.date + 'T00:00:00') <= prevCutoff
            );
            if (!wasPaidInPrevPeriod) {
                paymentForPeriodAmount += inst.monthlyPayment;
            }
        }
    });
    
    // Subtract payments made after the previous cutoff (these reduce the amount to pay)
    card.transactions.forEach(tx => {
        const txDate = new Date(tx.date + 'T00:00:00');
        if (tx.type === 'payment' && txDate > prevCutoff && !tx.relatedInstallmentId) {
            paymentForPeriodAmount -= tx.amount;
        }
    });
    
    // --- Calculate 'Próximo Pago (Estimado)' ---
    // This includes all transactions from the CURRENT billing period
    let nextPaymentAmount = 0;
    
    card.transactions.forEach(tx => {
        const txDate = new Date(tx.date + 'T00:00:00');
        // Transactions from prevCutoff (exclusive) to nextCutoff (inclusive)
        if (txDate > prevCutoff && txDate <= nextCutoff) {
            if (tx.type === 'expense') {
                nextPaymentAmount += tx.amount;
            }
        }
    });
    
    // Add installment payments due in the current period
    activeInstallments.forEach(inst => {
        const purchaseDate = new Date(inst.date + 'T00:00:00');
        // If the purchase was made before the next cutoff, a payment is due in this period
        if (nextCutoff > purchaseDate) {
            // Check if a payment for this installment has already been made within this period
            const hasBeenPaidThisPeriod = card.transactions.some(p => 
                p.relatedInstallmentId === inst.id &&
                new Date(p.date + 'T00:00:00') > prevCutoff &&
                new Date(p.date + 'T00:00:00') <= nextCutoff
            );
            if (!hasBeenPaidThisPeriod) {
                nextPaymentAmount += inst.monthlyPayment;
            }
        }
    });

    return {
        currentBalance: Math.max(0, currentBalance),
        availableCredit: Math.max(0, card.limit - currentBalance),
        nextCutoffDate: formatDate(nextCutoff.toISOString().split('T')[0]),
        paymentDueDate: formatDate(paymentDueDate.toISOString().split('T')[0]),
        paymentForPeriod: Math.max(0, paymentForPeriodAmount),
        nextPayment: Math.max(0, nextPaymentAmount),
        accumulatedCashback: accumulatedCashback,
    };
};