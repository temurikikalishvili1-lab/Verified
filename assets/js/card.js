// Checkout page functionality
class CheckoutManager {
    constructor() {
        this.wishlist = this.getWishlistFromStorage();
        this.emailServiceReady = false;
        this.stripe = null;
        this.elements = null;
        this.cardElement = null;
        this.stripeReady = false;
        this.currency = 'usd';
        this.init();
    }

    init() {
        this.configureEmail();
        this.displayOrderSummary();
        this.setupFormHandlers();
        this.setupInputFormatters();
        this.initStripe();
    }

    getWishlistFromStorage() {
        const wishlist = localStorage.getItem('wishlist');
        return wishlist ? JSON.parse(wishlist) : [];
    }

    displayOrderSummary() {
        const orderItems = document.getElementById('order-items');
        const orderTotal = document.getElementById('order-total');

        if (!orderItems || !orderTotal) return;

        // If wishlist is empty, redirect back to basket
        if (this.wishlist.length === 0) {
            setTimeout(() => {
                window.location.href = 'basket.html';
            }, 1000);
            return;
        }

        // Clear existing items
        orderItems.innerHTML = '';

        let totalPrice = 0;

        this.wishlist.forEach(item => {
            const price = parseFloat(item.price.replace('$', ''));
            totalPrice += price;

            const itemElement = document.createElement('div');
            itemElement.className = 'order-item';
            itemElement.innerHTML = `
                <span class="order-item-name">${item.title}</span>
                <span class="order-item-price">${item.price}</span>
            `;
            orderItems.appendChild(itemElement);
        });

        orderTotal.textContent = totalPrice.toFixed(2);
    }

    detectCardType(cardNumber) {
        // Remove spaces for detection
        const cleaned = cardNumber.replace(/\s/g, '');
        
        if (cleaned.startsWith('4')) {
            return 'visa';
        } else if (cleaned.startsWith('5')) {
            return 'mastercard';
        } else if (cleaned.startsWith('34') || cleaned.startsWith('37')) {
            return 'american_express';
        }
        return null;
    }

    displayCardIcon(cardType) {
        const iconDisplay = document.getElementById('card-icon-display');
        if (!iconDisplay) return;

        if (cardType) {
            const iconPath = `images/${cardType}.png`;
            iconDisplay.innerHTML = `<img src="${iconPath}" alt="${cardType}">`;
            iconDisplay.classList.add('active');
        } else {
            iconDisplay.innerHTML = '';
            iconDisplay.classList.remove('active');
        }
    }

    setupInputFormatters() {
        // Format card number (add spaces every 4 digits) and detect card type
        const cardNumberInput = document.getElementById('card-number');
        if (cardNumberInput) {
            cardNumberInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\s/g, '');
                
                // Detect card type first to determine max length
                const cardType = this.detectCardType(value);
                const maxLength = cardType === 'american_express' ? 15 : 16;
                
                if (value.length > maxLength) value = value.slice(0, maxLength);
                
                // Format with spaces (Amex: 4-6-5, others: 4-4-4-4)
                if (cardType === 'american_express') {
                    value = value.replace(/(.{4})(.{6})(.{0,5})/, '$1 $2 $3').trim();
                } else {
                    value = value.replace(/(.{4})/g, '$1 ').trim();
                }
                
                e.target.value = value;

                // Display card icon
                this.displayCardIcon(cardType);
            });
        }

        // Format expiry date (MM/YY)
        const expiryInput = document.getElementById('expiry-date');
        if (expiryInput) {
            expiryInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length >= 2) {
                    value = value.slice(0, 2) + '/' + value.slice(2, 4);
                }
                e.target.value = value;
            });
        }

        // Format CVV (numbers only)
        const cvvInput = document.getElementById('cvv');
        if (cvvInput) {
            cvvInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '');
            });
        }
    }

    setupFormHandlers() {
        const paymentForm = document.getElementById('payment-form');
        if (paymentForm) {
            paymentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handlePayment();
            });
        }
    }

    async handlePayment() {
        const cardholderName = document.getElementById('cardholder-name').value;
        const customerEmail = document.getElementById('customer-email').value;

        if (cardholderName.trim().length < 2) {
            this.showNotification('Please enter the cardholder name', 'error');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail)) {
            this.showNotification('Please enter a valid email address', 'error');
            return;
        }

        if (!this.stripeReady || !this.cardElement) {
            this.showNotification('Payment form is not ready. Please refresh.', 'error');
            return;
        }

        // Build payload for backend (only prices are needed)
        const items = this.wishlist.map(item => ({
            price: this.parsePrice(item.price)
        })).filter(item => Number.isFinite(item.price) && item.price > 0);

        const total = items.reduce((sum, item) => sum + item.price, 0);
        if (!items.length || total <= 0) {
            this.showNotification('Your basket is empty or invalid.', 'error');
            return;
        }

        this.showNotification('Creating payment...', 'info');

        const clientSecret = await this.createPaymentIntent(items);
        if (!clientSecret) return;

        this.showNotification('Processing payment...', 'info');

        const { error, paymentIntent } = await this.stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: this.cardElement,
                billing_details: {
                    name: cardholderName,
                    email: customerEmail
                }
            },
            receipt_email: customerEmail
        });

        if (error) {
            this.showNotification(error.message || 'Payment failed. Please try again.', 'error');
            return;
        }

        if (paymentIntent?.status === 'succeeded') {
            localStorage.removeItem('wishlist');
            this.showNotification('Payment successful! Your courses have been purchased.', 'success');
            this.sendPurchaseEmail(customerEmail);
            setTimeout(() => {
                window.location.href = 'main.html';
            }, 2000);
        } else {
            this.showNotification('Payment not completed. Please try again.', 'error');
        }
    }

    showNotification(message, type = 'success') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.checkout-notification');
        existingNotifications.forEach(notif => notif.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'checkout-notification';
        notification.textContent = message;
        
        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            info: '#3498db'
        };

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.success};
            color: white;
            padding: 1rem 2rem;
            border-radius: 10px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            font-weight: bold;
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    configureEmail() {
        // Initialize EmailJS if the script is available and keys are provided.
        if (typeof emailjs !== 'undefined') {
            try {
                emailjs.init('I5dswEBm59WQYramj');
                this.emailServiceReady = true;
            } catch (err) {
                console.warn('EmailJS init failed:', err);
            }
        }
    }

    sendPurchaseEmail(customerEmail) {
        if (!this.emailServiceReady) {
            console.warn('Email service not configured. Skipping email send.');
            return;
        }

        // Build a simple text summary of the order.
        const itemsSummary = this.wishlist
            .map(item => `${item.title} - ${item.price}`)
            .join('\\n');

        const totalPrice = this.wishlist.reduce((sum, item) => {
            const price = parseFloat(item.price.replace('$', ''));
            return sum + (isNaN(price) ? 0 : price);
        }, 0).toFixed(2);

        emailjs.send('service_ex0ud4s', 'template_x6i5eph', {
            customer_email: customerEmail,
            order_items: itemsSummary,
            order_total: `$${totalPrice}`
        }).then(() => {
            console.log('Receipt email sent');
        }).catch((err) => {
            console.warn('Failed to send receipt email:', err);
        });
    }

    parsePrice(priceString = '') {
        const numeric = parseFloat(String(priceString).replace(/[^0-9.]/g, ''));
        return Number.isFinite(numeric) ? numeric : 0;
    }

    async initStripe() {
        if (typeof Stripe === 'undefined') {
            this.showNotification('Stripe.js failed to load. Check your network.', 'error');
            return;
        }

        try {
            const res = await fetch('/api/payments/config');
            const data = await res.json();
            const publishableKey = data?.publishableKey;
            this.currency = data?.currency || 'usd';

            if (!publishableKey) {
                this.showNotification('Stripe publishable key is missing on the server.', 'error');
                return;
            }

            this.stripe = Stripe(publishableKey);
            this.elements = this.stripe.elements();
            const cardElementContainer = document.getElementById('card-element');
            if (!cardElementContainer) {
                this.showNotification('Card element container is missing.', 'error');
                return;
            }
            this.cardElement = this.elements.create('card', { hidePostalCode: true });
            this.cardElement.mount(cardElementContainer);
            this.stripeReady = true;
        } catch (err) {
            console.error('Stripe init failed:', err);
            this.showNotification('Unable to initialize Stripe. Please try again later.', 'error');
        }
    }

    async createPaymentIntent(items) {
        try {
            const res = await fetch('/api/payments/create-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });

            const data = await res.json();
            if (!res.ok) {
                this.showNotification(data?.error || 'Failed to create payment intent.', 'error');
                return null;
            }

            return data?.clientSecret || null;
        } catch (err) {
            console.error('Payment intent request failed:', err);
            this.showNotification('Network error while creating payment.', 'error');
            return null;
        }
    }
}

// Initialize checkout manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const checkoutManager = new CheckoutManager();
    
    // Make checkoutManager globally available
    window.checkoutManager = checkoutManager;
});

// Add CSS for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

